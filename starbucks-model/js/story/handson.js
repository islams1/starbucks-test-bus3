// What the player does with their own hands at the table and in the replay:
//  · the balance: coins into the orders' pan, one per extra completed order a day, until the beam is level
//  · the order rail: pull tickets off it and read their times to find the order that has waited longest
//  · the memo: sign it with the pen before it is locked
// Each one can also be done from the buttons in the prompt (keyboard / no dragging).
import * as THREE from 'three';
import {scene, camera, onUpdate} from '../core/engine.js';
import {TABLE} from '../world/room.js';
import {BAL, setBalance} from '../world/scale.js';
import {TP} from '../world/tableprops.js';
import {MQ, ticketInfo} from '../world/maquette.js';
import {canvasTex} from '../world/materials.js';
import {grabbable, removeGrabbable, tweenTo, setWorld, toScreen} from '../ui/hand.js';
import {prompt} from '../ui/ui.js';
import {sfx} from '../core/audio.js';
import {coin, slide} from './sound.js';
import {S, log} from './state.js';
import {breakEven} from './score.js';

const EN = new URLSearchParams(location.search).get('lang') === 'en';
const ar = (a, e) => EN ? e : a;
const Y = TABLE.y;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const brass = new THREE.MeshStandardMaterial({color: 0xc39a5b, roughness: 0.28, metalness: 1});
const coinGeo = new THREE.CylinderGeometry(0.0125, 0.0125, 0.0028, 20);

/** prompt with buttons (the no-drag way); returns a function to clear it */
function promptButtons(html, buttons) {
  prompt(`<span class="hp-txt" aria-live="polite">${html}</span>${buttons.map(b => `<button type="button" class="hp-btn" data-b="${b.id}">${b.label}</button>`).join('')}`);
  const el = document.getElementById('prompt'); el.classList.add('hands');
  el.querySelectorAll('[data-b]').forEach(btn => btn.onclick = (e) => { e.stopPropagation(); const b = buttons.find(x => x.id === btn.dataset.b); if (b) b.use(); });
  return () => { el.classList.remove('hands'); prompt(''); };
}
const setPromptText = (html) => { const t = document.querySelector('#prompt .hp-txt'); if (t) t.innerHTML = html; };
const doneButtons = () => document.querySelectorAll('#prompt .hp-btn').forEach(b => b.remove());     // the step is over

// a soft ring that shows where a thing will go
function marker(r = 0.07) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.004, 8, 40), new THREE.MeshBasicMaterial({color: 0xffe2a8, transparent: true, opacity: 0.85, depthTest: false, toneMapped: false}));
  m.rotation.x = -Math.PI / 2; m.renderOrder = 20; m.visible = false; scene.add(m);
  return m;
}

// ================================================================= the balance by hand
let tray = null;
function buildTray() {
  if (tray) return tray;
  tray = new THREE.Group(); tray.position.set(-0.74, Y, 0.2); scene.add(tray);
  const wood = new THREE.MeshStandardMaterial({color: 0x5a3c28, roughness: 0.55});
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.075, 0.012, 40), wood); dish.position.y = 0.006; dish.castShadow = dish.receiveShadow = true; tray.add(dish);
  // left: stacks of four (four extra orders a day each) · right: single coins (one order)
  const stacks = new THREE.Group(), singles = new THREE.Group(); tray.add(stacks, singles);
  for (let s = 0; s < 6; s++) { const st = new THREE.Group(); st.position.set(-0.04 + (s % 2) * 0.028, 0.013, -0.03 + Math.floor(s / 2) * 0.028); for (let k = 0; k < 4; k++) { const c = new THREE.Mesh(coinGeo, brass); c.position.y = 0.0014 + k * 0.0029; c.castShadow = true; st.add(c); } stacks.add(st); }
  for (let s = 0; s < 5; s++) { const c = new THREE.Mesh(coinGeo, brass); c.position.set(0.032 + (s % 2) * 0.026, 0.0134, -0.026 + Math.floor(s / 2) * 0.026); c.rotation.z = (s % 3) * 0.05; c.castShadow = true; singles.add(c); }
  // bigger invisible handles so the small coins are easy to take
  const hm = new THREE.MeshBasicMaterial({visible: false});
  const hs = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.04, 0.1), hm); hs.position.set(-0.026, 0.025, 0); stacks.add(hs);
  const h1 = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.04, 0.1), hm); h1.position.set(0.045, 0.025, 0); singles.add(h1);
  const tag = (t, x) => { const tx = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#e9dcc0'; g.fillRect(0, 0, w, h); g.fillStyle = '#3a2a18'; g.font = '600 30px "IBM Plex Sans Arabic"'; g.textAlign = 'center'; g.fillText(t, w / 2, 43); });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.019), new THREE.MeshStandardMaterial({map: tx, roughness: 0.7})); m.rotation.x = -Math.PI / 2 + 0.5; m.position.set(x, 0.012, 0.072); tray.add(m); };
  tag(ar('4 طلبات', '4 orders'), -0.028); tag(ar('طلب واحد', '1 order'), 0.045);
  tray.userData = {stacks, singles};
  tray.visible = false;
  return tray;
}
export const trayCenter = () => buildTray().localToWorld(V3(0, 0.02, 0));
let _panHandle = null;
function panHandle() {
  if (!_panHandle) { _panHandle = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.07, 0.15), new THREE.MeshBasicMaterial({visible: false})); _panHandle.position.y = 0.02; BAL.pans[0].add(_panHandle); }
  return _panHandle;
}

/** put coins in the orders' pan until the beam is level; onOrders(n) keeps the tablet / the replay's figures in step */
export function balanceByHand({onOrders = () => {}} = {}) {
  const T = buildTray(); T.visible = true;
  const m = S.model; m.contrib = 3; m.orders = 0;
  const goal = breakEven(m.contrib);
  const panPos = () => BAL.pans[0].getWorldPosition(new THREE.Vector3()).add(V3(0, 0.012, 0));
  const ring = marker(0.068);
  const show = (n) => {
    setBalance(n, m.contrib); onOrders(n);
    const more = goal - n;
    setPromptText(n === 0 ? ar('اسحب العملات من الصحن إلى كفة الطلبات: عملة لكل طلب إضافي في اليوم.', 'Drag coins from the dish into the orders’ pan: one coin per extra order a day.')
      : ar(`في كفة الطلبات: <b>${n}</b> طلبًا إضافيًا في اليوم`, `In the orders’ pan: <b>${n}</b> extra orders a day`) + (more < 0 ? ar(' · الكفة رجحت — أرجع بعض العملات', ' · it tips past level — take some back') : ''));
  };
  let done = null;
  const finished = new Promise(r => done = r);
  const set = (n) => {
    n = Math.max(0, Math.min(40, n)); if (n === m.orders) return;
    m.orders = n; log('coins', n); show(n);
    if (n === goal) { setTimeout(() => { if (m.orders === goal) done(); }, 900); }
  };
  const fly = async (n, from) => {
    const g = new THREE.Group(); for (let k = 0; k < n; k++) { const c = new THREE.Mesh(coinGeo, brass); c.position.y = k * 0.0029; g.add(c); } scene.add(g); setWorld(g, from);
    await tweenTo(g, panPos(), 0.32, {arc: 0.05}); scene.remove(g); coin(); set(m.orders + n);
  };
  const carry = (n) => { const g = new THREE.Group(); for (let k = 0; k < n; k++) { const c = new THREE.Mesh(coinGeo, brass); c.position.y = k * 0.0029; c.castShadow = true; g.add(c); } scene.add(g); return g; };
  const hover = (t) => { ring.visible = !!t; if (t) ring.position.copy(t.pos).add(V3(0, 0.004, 0)); };
  const toPan = () => [{id: 'pan', pos: panPos(), r: 90}];
  const dropOnPan = (n) => async (t, g) => {
    if (t) { await tweenTo(g, panPos(), 0.18, {arc: 0.02}); scene.remove(g); coin(); set(m.orders + n); }
    else { slide(); await tweenTo(g, trayCenter(), 0.25, {arc: 0.03}); scene.remove(g); }
  };
  const off = [
    grabbable({id: 'coins4', objects: () => [T.userData.stacks], when: () => T.visible, planeY: Y + 0.02, lift: 0.04,
      grab: (h) => { const g = carry(4); setWorld(g, h.point); sfx.ui(); return g; }, targets: toPan, hover, drop: dropOnPan(4)}),
    grabbable({id: 'coins1', objects: () => [T.userData.singles], when: () => T.visible, planeY: Y + 0.02, lift: 0.04,
      grab: (h) => { const g = carry(1); setWorld(g, h.point); sfx.ui(); return g; }, targets: toPan, hover, drop: dropOnPan(1)}),
    // a coin taken out of the pan goes back to the dish (an invisible handle makes the small pan easy to take from)
    grabbable({id: 'coinback', objects: () => [panHandle()], when: () => T.visible && m.orders > 0, planeY: Y + 0.05, lift: 0.03,
      grab: (h) => { const g = carry(1); setWorld(g, panPos()); set(m.orders - 1); return g; },
      targets: () => [{id: 'tray', pos: trayCenter(), r: 110}], hover,
      drop: async (t, g) => { slide(); await tweenTo(g, trayCenter(), 0.25, {arc: 0.03}); scene.remove(g); }}),
  ];
  const clear = promptButtons('', [
    {id: 'p4', label: ar('+ حزمة (4)', '+ stack (4)'), use: () => fly(4, T.userData.stacks.getWorldPosition(new THREE.Vector3()))},
    {id: 'p1', label: ar('+ عملة (1)', '+ coin (1)'), use: () => fly(1, T.userData.singles.getWorldPosition(new THREE.Vector3()))},
    {id: 'm1', label: ar('− عملة', '− coin'), use: () => { if (m.orders > 0) { set(m.orders - 1); slide(); } }},
  ]);
  show(0);
  const key = (e) => { if (e.key === '+' || e.key === '=') fly(1, T.userData.singles.getWorldPosition(new THREE.Vector3())); else if (e.key === '-' || e.key === '_') { if (m.orders > 0) { set(m.orders - 1); slide(); } } };
  addEventListener('keydown', key);
  return finished.then(() => {
    setPromptText(ar(`✓ توازنت الكفتان عند <b>${goal}</b> طلبًا إضافيًا في اليوم`, `✓ The pans balance at <b>${goal}</b> extra orders a day`));
    off.forEach(f => f()); removeEventListener('keydown', key); scene.remove(ring); doneButtons();
    setTimeout(clear, 2600);
    return goal;
  });
}
export function hideTray() { if (tray) tray.visible = false; }

// ================================================================= the order rail by hand
/** pull tickets off the rail and read them; resolves when the oldest one (the order that has waited longest) is found */
export function ticketHunt() {
  const T = MQ.tickets, n = MQ.ticketCount || 0;
  MQ.ticketsHeld = true;                         // the rail stays as it is while it is being read
  let held = null, back = null, done = null;
  const finished = new Promise(r => done = r);
  const home = new Map(T.map(t => [t, {p: t.position.clone(), q: t.quaternion.clone(), s: t.scale.clone()}]));
  const putBack = async (t) => {
    if (!t) return; const h = home.get(t); const to = t.parent.localToWorld(h.p.clone());
    await tweenTo(t, to, 0.25); t.position.copy(h.p); t.quaternion.copy(h.q); t.scale.copy(h.s);
  };
  const pull = async (t) => {
    if (held === t) return;
    clearTimeout(back); const prev = held; held = t; putBack(prev);
    const i = T.indexOf(t), info = ticketInfo(i);
    sfx.paper ? sfx.paper() : sfx.ui();
    // up to the eye, facing it
    const dir = camera.getWorldDirection(new THREE.Vector3()), up = V3(0, 1, 0).applyQuaternion(camera.quaternion);
    const to = camera.position.clone().addScaledVector(dir, 0.42).addScaledVector(up, -0.04);
    const pq = t.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    t.quaternion.copy(pq.multiply(camera.getWorldQuaternion(new THREE.Quaternion())));
    tweenTo(t, to, 0.3);
    const oldest = i === 0;
    log('ticket', info.no);
    setPromptText(ar(`تذكرة <b>#${info.no}</b> · ${info.drink[0]} · طُلبت ${info.at} — على السكة منذ <b>${info.waited === 0 ? 'لحظات' : info.waited + ' دقائق'}</b>`, `Ticket <b>#${info.no}</b> · ${info.drink[1]} · ordered ${info.at} — on the rail for <b>${info.waited === 0 ? 'moments' : info.waited + ' min'}</b>`)
      + (oldest ? ar(' · ✓ أقدم طلب ما زال ينتظر', ' · ✓ the oldest order still waiting') : ''));
    back = setTimeout(() => { if (held === t) { held = null; putBack(t); } }, oldest ? 3200 : 2600);
    if (oldest) setTimeout(done, 1800);
  };
  const off = grabbable({id: 'tickets', modes: ['cafe'], objects: () => T.slice(0, n), when: () => true, grab: (h) => { pull(h.object); return null; }, drop: () => {}});
  const clear = promptButtons(ar('اسحب التذاكر من السكة واقرأ أوقاتها: أي طلب ينتظر أطول من غيره؟', 'Pull tickets off the rail and read their times: which order has waited longest?'),
    [{id: 'old', label: ar('اسحب الأقدم', 'Pull the oldest'), use: () => T[0] && pull(T[0])}]);
  return finished.then(async () => {
    off(); doneButtons(); await putBack(held); held = null; MQ.ticketsHeld = false;
    const k = MQ.ticketCount; T.forEach((t, i) => { t.visible = i < k; });
    setTimeout(clear, 1500);
  });
}

// ================================================================= the memo: sign it
/** draw the memo summary on the pad with a signature line; the player signs with the pen (drag on the pad) */
export function signMemo(lines) {
  const c = TP.memoTex.image, g = c.getContext('2d'), W = c.width, H = c.height;
  const SIGN_Y = H - 92;
  const paint = () => {
    g.fillStyle = '#fbf8f0'; g.fillRect(0, 0, W, H); g.strokeStyle = '#e4dccb'; g.lineWidth = 1; for (let y = 90; y < SIGN_Y - 40; y += 34) { g.beginPath(); g.moveTo(20, y); g.lineTo(W - 20, y); g.stroke(); }
    g.fillStyle = '#2f4a3f'; g.font = '600 30px "IBM Plex Sans Arabic"'; g.textAlign = EN ? 'left' : 'right'; g.fillText(EN ? 'Decision memo' : 'مذكرة القرار', EN ? 24 : W - 24, 56);
    g.fillStyle = '#1f2a44'; g.font = '500 21px "Noto Naskh Arabic"';
    lines.slice(0, 7).forEach((t, i) => g.fillText(String(t).slice(0, 36), EN ? 24 : W - 24, 116 + i * 34));
    g.strokeStyle = '#8a7f6a'; g.lineWidth = 2; g.beginPath(); g.moveTo(30, SIGN_Y + 40); g.lineTo(W - 30, SIGN_Y + 40); g.stroke();
    g.fillStyle = '#8a7f6a'; g.font = '500 18px "IBM Plex Sans Arabic"'; g.fillText(EN ? 'Signature' : 'التوقيع', EN ? 30 : W - 30, SIGN_Y + 66);
    TP.memoTex.needsUpdate = true;
  };
  paint();
  const pen = TP.pen, penHome = {p: pen.position.clone(), r: pen.rotation.clone()};
  const axis = V3(0, 1, 0).applyEuler(new THREE.Euler(0.55, 0, -0.35));
  const penAt = (p) => { pen.rotation.set(0.55, 0, -0.35); pen.position.copy(p).addScaledVector(axis, 0.07); };
  let last = null, length = 0, done = null;
  const finished = new Promise(r => done = r);
  const ink = (u, v) => {
    const x = u * W, y = (1 - v) * H;
    if (last) { g.strokeStyle = '#1b2a52'; g.lineWidth = 3.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(last[0], last[1]); g.lineTo(x, y); g.stroke(); length += Math.hypot(x - last[0], y - last[1]); TP.memoTex.needsUpdate = true; }
    last = [x, y];
  };
  const off = grabbable({id: 'sign', modes: ['seat', 'cine'], objects: () => [TP.memo], stroke: true,
    move: (h) => { if (!h || !h.uv) { last = null; return; } penAt(h.point); ink(h.uv.x, h.uv.y); },
    end: () => { last = null; if (length > W * 0.45) finish(); }});
  // a short flourish along the signature line (the no-drag way; also the QA drag path)
  const flourish = () => { const pts = []; for (let k = 0; k <= 40; k++) { const t = k / 40; pts.push([0.2 + t * 0.6, 1 - (SIGN_Y + 30 - Math.sin(t * Math.PI * 3) * 14 - t * 8) / H]); } return pts; };
  window.__signPts = () => flourish().filter((_, i) => i % 4 === 0).map(([u, v]) => toScreen(TP.memo.localToWorld(V3((u - 0.5) * 0.15, (v - 0.5) * 0.2, 0))).slice(0, 2));
  const auto = async () => {
    const pts = flourish();
    last = null;
    for (const [u, v] of pts) { const p = TP.memo.localToWorld(V3((u - 0.5) * 0.15, (v - 0.5) * 0.2, 0)); penAt(p); ink(u, v); await new Promise(r => setTimeout(r, 18)); }
    last = null; finish();
  };
  let ended = false;
  const finish = () => { if (ended) return; ended = true; off(); done(); };
  const clear = promptButtons(ar('وقّع المذكرة بالقلم: اسحب على سطر التوقيع', 'Sign the memo with the pen: drag along the signature line'), [{id: 'sg', label: ar('وقّع', 'Sign'), use: auto}]);
  return finished.then(async () => {
    // the stamp
    g.save(); g.translate(W * 0.3, SIGN_Y - 34); g.rotate(-0.12); g.strokeStyle = 'rgba(166,52,40,.85)'; g.lineWidth = 4; g.strokeRect(-70, -26, 140, 52);
    g.fillStyle = 'rgba(166,52,40,.85)'; g.font = '700 26px "IBM Plex Sans Arabic"'; g.textAlign = 'center'; g.fillText(EN ? 'CONFIRMED' : 'مؤكدة', 0, 9); g.restore();
    TP.memoTex.needsUpdate = true; slide();
    setPromptText(ar('✓ وُقّعت المذكرة', '✓ Memo signed')); doneButtons();
    await new Promise(r => setTimeout(r, 700));
    pen.position.copy(penHome.p); pen.rotation.copy(penHome.r);
    setTimeout(clear, 1600);
  });
}

// ================================================================= the comment cards: turn them over, sort them
let mats = null;
function buildMats() {
  if (mats) return mats;
  const mk = (label, x, z, col) => {
    const t = canvasTex(320, 200, (g, w, h) => { g.fillStyle = col; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 6; g.setLineDash([14, 10]); g.strokeRect(14, 14, w - 28, h - 28); g.setLineDash([]);
      g.fillStyle = '#fff'; g.font = '600 44px "IBM Plex Sans Arabic"'; g.textAlign = 'center'; g.fillText(label, w / 2, h / 2 + 16); });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.1), new THREE.MeshStandardMaterial({map: t, roughness: 0.9})); m.rotation.x = -Math.PI / 2; m.position.set(x, Y + 0.0012, z); m.receiveShadow = true; m.visible = false; scene.add(m);
    return m;
  };
  mats = {speed: mk(ar('سرعة', 'Speed'), -0.86, 0.3, '#4f6b5e'), accuracy: mk(ar('دقة الطلب', 'Order accuracy'), -0.56, 0.27, '#6b5a45')};
  return mats;
}
export const commentsCenter = () => V3(-0.66, Y + 0.02, 0.4);
/**
 * cards: [{k, text, ok}] — each card is turned over the first time it is taken (opened), and sorted by putting it on a
 * mat; onTag(k, tag) returns the feedback line. Resolves 'done' or 'list' (the player asked for the list instead)
 */
export function sortComments({cards, tags, onOpen, onTag}) {
  const M = buildMats(); M.speed.visible = M.accuracy.visible = true;
  const spots = [V3(-0.84, Y + 0.003, 0.52), V3(-0.63, Y + 0.003, 0.57)];   // (left of the queue card)
  const meshes = TP.cards.slice(0, cards.length), home = meshes.map(m => ({p: m.position.clone(), r: m.rotation.z, s: m.scale.clone()}));
  const face = (m, c, open) => {
    const cv = m.material.map.image, g = cv.getContext('2d'), w = cv.width, h = cv.height;
    g.fillStyle = open ? '#fbf7ee' : '#e9dcc0'; g.fillRect(0, 0, w, h);
    if (open) { g.fillStyle = '#1f2a44'; g.font = '500 28px "Noto Naskh Arabic"'; g.textAlign = 'center'; wrap(g, c.text, w / 2, h / 2 - 14, w - 30, 38); }
    else { g.fillStyle = '#6b5a45'; g.font = '600 30px "IBM Plex Sans Arabic"'; g.textAlign = 'center'; g.fillText(ar('تعليق زبون', 'A comment'), w / 2, h / 2 + 10); }
    m.material.map.needsUpdate = true;
  };
  const opened = new Set(cards.filter(c => S.ev[c.k]).map(c => c.k));
  cards.forEach((c, i) => face(meshes[i], c, opened.has(c.k)));
  // out of the box onto the table in front of the player, a little bigger
  meshes.forEach((m, i) => { tweenTo(m, spots[i], 0.45, {arc: 0.06, scale: V3(1.6, 1.6, 1.6)}); m.rotation.z = (i ? -0.06 : 0.05); });
  const ring = marker(0.085);
  const placed = {};
  let done = null; const finished = new Promise(r => done = r);
  const matPos = (t) => M[t].getWorldPosition(new THREE.Vector3());
  const reveal = (i) => { const c = cards[i]; if (!opened.has(c.k)) { opened.add(c.k); face(meshes[i], c, true); onOpen(c.k); } setPromptText(`«${c.text.replace(/[«»"]/g, '')}» — ${ar('ضعها على المكان المناسب', 'put it where it belongs')}`); };
  const tag = async (i, t) => {
    const c = cards[i]; placed[c.k] = t;
    await tweenTo(meshes[i], matPos(t).add(V3((Object.values(placed).filter(x => x === t).length - 1) * 0.02, 0.002, 0)), 0.22, {arc: 0.02});
    setPromptText(onTag(c.k, t));
    if (cards.every(x => placed[x.k] || tags[x.k])) setTimeout(() => finish('done'), 2200);
  };
  const offs = meshes.map((m, i) => grabbable({id: 'card' + i, objects: () => [m], when: () => true, planeY: Y + 0.01, lift: 0.04,
    grab: () => { sfx.paper ? sfx.paper() : sfx.ui(); reveal(i); return m; },
    targets: () => [{id: 'speed', pos: matPos('speed'), r: 95}, {id: 'accuracy', pos: matPos('accuracy'), r: 95}],
    hover: (t) => { ring.visible = !!t; if (t) ring.position.copy(t.pos).add(V3(0, 0.004, 0)); },
    drop: async (t) => { if (t) await tag(i, t.id); else await tweenTo(m, spots[i], 0.25, {arc: 0.02}); }}));
  let ended = false;
  const finish = (how) => { if (ended) return; ended = true; done(how); };
  const clear = promptButtons(ar('خذ بطاقة لتقرأها، ثم ضعها على «سرعة» أو «دقة الطلب».', 'Take a card to read it, then put it on “Speed” or “Order accuracy”.'), [
    {id: 'rd', label: ar('اقلب البطاقتين', 'Turn both over'), use: () => cards.forEach((c, i) => { if (!opened.has(c.k)) { opened.add(c.k); face(meshes[i], c, true); onOpen(c.k); } })},
    {id: 'ls', label: ar('صنّفها من قائمة', 'Sort from a list'), use: () => finish('list')},
    {id: 'ok', label: ar('تم', 'Done'), use: () => finish('done')},
  ]);
  return finished.then(async (how) => {
    offs.forEach(f => f()); scene.remove(ring); doneButtons(); clear();
    await Promise.all(meshes.map((m, i) => tweenTo(m, m.parent.localToWorld(home[i].p.clone()), 0.35, {arc: 0.04, scale: home[i].s})));
    meshes.forEach((m, i) => { m.rotation.z = home[i].r; });
    M.speed.visible = M.accuracy.visible = false;
    return how;
  });
}
function wrap(g, text, x, y, maxW, lh) {
  const words = String(text).split(' '); let line = '', lines = [];
  for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line);
  lines.forEach((l, i) => g.fillText(l, x, y + (i - (lines.length - 1) / 2) * lh));
}
