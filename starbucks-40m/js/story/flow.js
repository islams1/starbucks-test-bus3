// Scene director: 0 source card → 1 morning peak → 2 quiet afternoon → 3 price the improvement (upstairs, dusk)
// → 4 recommendation to the committee → 5 debrief (memo beside the published case, review questions, score).
import * as THREE from 'three';
import {camera, onUpdate, onOverlay, wait, clock, Q, renderer} from '../core/engine.js';
import {setInput, lock, unlock} from '../core/input.js';
import {playVoice, sfx} from '../core/audio.js';
import * as cine from '../core/cine.js';
import {characters as C} from '../actors/character.js';
import {player, setPlayerMode, teleport, lookTowards} from '../actors/player.js';
import {buildPerformance} from '../actors/performance.js';
import {anchors, cafe, screens, setTickets, setLevel, setClockHands, liveGroup, UP} from '../world/building.js';
import {setTimeOfDay} from '../world/lighting.js';
import {buildNav} from '../world/nav.js';
import * as P from '../world/props.js';
import {subtitle, hideSubtitle, choose, toast, objective, fade, hud, $, show} from '../ui/ui.js';
import {addHotspot, removeHotspot, markDone, setHotspotsBusy, hotspots} from '../ui/hotspots.js';
import {S, log, saveCommit, loadCommit, clearCommit} from './state.js';
import {sit, stand, lineUp, QSLOTS, slotFace, startStaff, setStaffPace, watchGlance, qIdle, sleep} from './cast.js';
import {showStopwatch, setStopwatch} from './held.js';
import {startCafeSound, setCrowd, printer, doorBell, steam, tick as tickSnd, whoosh, cups as cupSnd} from './sound.js';
import {askNumber, openTablet, drawTabletScreen} from './tablet.js';
import * as MEMO from './memo.js';
import * as DB from './debrief.js';
import {ROUTES, CONDS} from './score.js';

const EN = Q.get('lang') === 'en';
const ar = (a, e) => EN ? e : a;
let LINES = null, SPK = null;
export function initLines(lines, speakers) { LINES = lines; SPK = speakers; }
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- controls
export function freeControls() { cine.stop(); setPlayerMode('free'); setInput(true, true); hud(true); setHotspotsBusy(false); }
export function cineControls() { setInput(false); setPlayerMode('cine'); hud(true); }
export const panelOpen = () => !$('panel').classList.contains('hidden') || !$('card').classList.contains('hidden');

// ---------------------------------------------------------------- HUD: clock, tasks, scene tag, time-lapse badge
let dayMin = 8 * 60 + 10;
export function setDayClock(min) {
  dayMin = min; setClockHands(min);
  const h = Math.floor(min / 60), m = Math.floor(min % 60);
  $('calendar').querySelector('.time').innerHTML = `${h > 12 ? h - 12 : h}:${String(m).padStart(2, '0')}<small class="ampm">${h < 12 ? ar('صباحًا', 'am') : ar('مساءً', 'pm')}</small>`;
  $('calendar').querySelector('.day').textContent = ar('الثلاثاء', 'Tuesday');
}
let TASKS = [];
function setTasks(list) { TASKS = list; renderTasks(); }
function renderTasks() { const el = $('tasks'); if (!el) return; el.innerHTML = TASKS.map(x => `<li class="${x.done() ? 'done' : ''}">${x.t}</li>`).join(''); }
let taskT = 0; onUpdate((dt) => { taskT += dt; if (taskT > 0.5) { taskT = 0; renderTasks(); } });
function sceneTag(t) { $('scenetag').textContent = t; }
function lapse(on, x = 20) { const b = $('timelapse'); if (!b) return; b.textContent = `⏩ ×${x}`; b.classList.toggle('on', on); }

// ---------------------------------------------------------------- dialogue
const REACTION = {shocked: 'surprise', disappointed: 'worry', sad: 'worry', worried: 'worry', tense: 'worry', excited: 'smile', happy: 'smile', proud: 'smile', pleased: 'smile', warm: 'smile', confident: 'nod', firm: 'nod', skeptical: 'skeptical', unsure: 'skeptical'};
function listenersReact(speaker, emo) {
  const r = REACTION[emo]; if (!r || !speaker) return;
  for (const c of Object.values(C)) {
    if (!c || c === speaker || c === player.ch || !c.holder.visible || c.holder.position.distanceTo(speaker.holder.position) > 4) continue;
    setTimeout(() => c.react(Math.random() < 0.35 && r !== 'surprise' ? 'nod' : r), 400 + Math.random() * 900);
  }
}
/** turn the player's eyes towards a point (free mode) */
let lookTween = null;
onUpdate((dt) => {
  if (!lookTween || player.mode !== 'free') { lookTween = null; return; }
  const L = lookTween; L.t += dt; const k = Math.min(1, L.t / L.dur), e = k * k * (3 - 2 * k);
  let dy = ((L.yaw - L.y0 + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  player.yaw = L.y0 + dy * e; player.pitch = L.p0 + (L.pitch - L.p0) * e; player.ch.holder.rotation.y = player.yaw;
  if (k >= 1) lookTween = null;
});
export function faceTowards(p, dur = 0.7) {
  const h = player.ch.holder.position, dx = p.x - h.x, dz = p.z - h.z;
  lookTween = {t: 0, dur, y0: player.yaw, p0: player.pitch, yaw: Math.atan2(dx, dz), pitch: Math.max(-0.5, Math.min(0.5, -Math.atan2(p.y - (h.y + player.eye), Math.hypot(dx, dz))))};
}
const _fw = new THREE.Vector3(), _to = new THREE.Vector3();
function inView(p, deg = 32) { camera.getWorldDirection(_fw); _to.copy(p).sub(camera.position).normalize(); return _fw.dot(_to) > Math.cos(deg * Math.PI / 180); }
function turnTo(ch, p) { ch._turnTo = Math.atan2(p.x - ch.holder.position.x, p.z - ch.holder.position.z); }
let chain = Promise.resolve();
export function line(id, opt = {}) { const r = chain.then(() => lineImpl(id, opt)); chain = r.catch(() => {}); return r; }
async function lineImpl(id, {face = true} = {}) {
  const L = LINES[id]; if (!L) { console.warn('line?', id); return; }
  const sp = SPK[L.s], url = `assets/vo/ar/${id}`;
  const text = EN ? L.en : (L.sub || L.t), name = EN ? sp.en[0] : sp.name, role = EN ? sp.en[1] : sp.role;
  const words = await fetch(url + '.json').then(r => r.ok ? r.json() : []).catch(() => []);
  const who = L.s === 'player' || L.s === 'narrator' ? null : C[L.s];
  let timeFn = () => 0;
  if (who && who.holder.visible) {
    if (face && !who.seated && !who.walking) turnTo(who, camera.position);
    who.lookAt('camera'); who.lockLook = true;
    if (player.mode === 'free' && who.holder.position.distanceTo(camera.position) < 7) { const hp = who.headPos().clone(); hp.y -= 0.1; if (!inView(hp)) faceTowards(hp); }
    listenersReact(who, L.e);
    const perf = buildPerformance(L.t, words, {speakerId: L.s, emotion: L.e, seated: !!who.seated, pointTarget: null});
    const p = who.say(url, {emotion: L.e, perf});
    await new Promise(r => { const t = () => who.voice ? (timeFn = who.voice.time, r()) : requestAnimationFrame(t); t(); setTimeout(r, 1500); });
    subtitle(name, role, text, EN ? null : words, () => timeFn());
    await p; who.lockLook = false;
  } else {
    const v = await playVoice(url + '.mp3', null, {});
    subtitle(name, role, text, EN ? null : words, v.time); await v.done;
  }
  await wait(0.2); hideSubtitle();
}
/** player reply: choose a line, then say it. opts [{id, key}] */
async function ask(q, opts) {
  const wasFree = player.mode === 'free';
  setInput(false);
  const o = await choose(q, opts.map(x => ({...x, text: x.text || (EN ? LINES[x.id].en : LINES[x.id].t)})));
  if (wasFree) { setInput(true, true); lock(); }
  if (o.id) await line(o.id);
  return o.key || o.id;
}

// ---------------------------------------------------------------- evidence
const EVT = {
  rail: () => ar('تراكم عند الاستلام: 9 تذاكر تنتظر عند البار، والكاشير ينهي الطلب في أقل من دقيقة.', 'Backlog at pickup: 9 tickets wait at the bar; the register takes under a minute.'),
  peak: () => ar('انتظار الذروة (8:10 ص): 7 دقائق من الطلب حتى الاستلام.', 'Peak wait (8:10 am): 7 minutes from order to pickup.'),
  off: () => ar('انتظار الهدوء (3:00 م): دقيقتان.', 'Off-peak wait (3:00 pm): 2 minutes.'),
  ben: () => ar('بن: «كنت سأتأخر عن موعدي، فخرجت.»', 'Ben: "I was going to be late, so I left."'),
  salma: () => ar('سلمى: «مشروبي يخرج صحيحًا في العادة.»', 'Salma: "My drink usually comes out right."'),
};
function gain(k) { if (S.ev[k]) return; S.ev[k] = true; log('ev', k); sfx.evidence(); toast(`<b>${ar('دليل جديد', 'New evidence')}</b> · ${EVT[k]()}`, 'ev'); }
const stills = {};
/** grab the next rendered frame as an image (for the wait card's "static view") */
function captureStill(key) {
  return new Promise(res => { const off = onOverlay(() => { off(); try { stills[key] = renderer.domElement.toDataURL('image/jpeg', 0.7); } catch (e) {} res(); }); });
}
export function toggleTray(on = $('tray').classList.contains('hidden')) {
  if (!on) { show('tray', false); if (player.mode === 'free') { setInput(true, true); } return; }
  setInput(false);
  const el = $('tray');
  const tagTxt = (k) => S.tags[k] ? `<span class="tag ${S.tags[k]}">${S.tags[k] === 'speed' ? ar('سرعة', 'Speed') : ar('دقة الطلب', 'Order accuracy')}</span>` : '';
  const rows = [];
  if (S.ev.rail) rows.push(`<div class="evc"><b>${ar('سكة التذاكر', 'Order rail')}</b><p>${EVT.rail()}</p></div>`);
  if (S.ev.peak || S.ev.off) rows.push(`<div class="evc wait"><b>${ar('بطاقة الانتظار', 'Queue observation card')}</b> <span class="illus">${ar('تعليمي', 'Illustrative')}</span>
    <table><tr><th>${ar('الفترة', 'Period')}</th><th>${ar('متوسط الانتظار', 'Median wait')}</th></tr>
    <tr data-still="peak" class="${S.ev.peak ? '' : 'locked'}"><td>${ar('الذروة، 8:10 ص', 'Peak, 8:10 am')}</td><td>${S.ev.peak ? ar('7 دقائق', '7 minutes') : '—'}</td></tr>
    <tr data-still="off" class="${S.ev.off ? '' : 'locked'}"><td>${ar('الهدوء، 3:00 م', 'Off-peak, 3:00 pm')}</td><td>${S.ev.off ? ar('دقيقتان', '2 minutes') : '—'}</td></tr></table><div class="still"></div></div>`);
  if (S.ev.ben) rows.push(`<div class="evc"><b>${ar('تعليق زبون', 'Customer comment')}</b><p>${EVT.ben()}</p>${tagTxt('ben')}</div>`);
  if (S.ev.salma) rows.push(`<div class="evc"><b>${ar('تعليق زبون', 'Customer comment')}</b><p>${EVT.salma()}</p>${tagTxt('salma')}</div>`);
  if (S.hyp) rows.push(`<div class="evc"><b>${ar('فرضيتك الأولى', 'Your first hypothesis')}</b><p>${{peak: ar('انتظار الاستلام في الذروة', 'Peak wait at pickup'), acc: ar('دقة الطلبات', 'Order accuracy'), all: ar('مشكلة خدمة عامة في الفرع', 'A storewide service problem')}[S.hyp]}</p></div>`);
  el.innerHTML = `<div class="tray-in"><div class="tray-head"><b>${ar('درج الأدلة', 'Evidence tray')}</b><kbd>Tab</kbd></div>${rows.join('') || `<p class="empty">${ar('لم تجمع أدلة بعد.', 'No evidence yet.')}</p>`}<button class="ghost" id="trayclose">${ar('إغلاق', 'Close')}</button></div>`;
  el.querySelectorAll('[data-still]').forEach(tr => tr.onclick = () => { const s = stills[tr.dataset.still]; const box = el.querySelector('.still'); box.innerHTML = s ? `<img src="${s}"><small>${tr.dataset.still === 'peak' ? ar('لقطة من الذروة', 'Still from the peak') : ar('لقطة من الهدوء', 'Still from the quiet period')}</small>` : ''; });
  el.querySelector('#trayclose').onclick = () => toggleTray(false);
  show('tray', true);
}

// ---------------------------------------------------------------- props that move: door, cups at the pickup shelf
let doorT = 0, doorOpen = 0;
onUpdate((dt) => { if (!cafe.door) return; doorT = Math.max(0, doorT - dt); const want = doorT > 0 ? 1 : 0; doorOpen += (want - doorOpen) * (1 - Math.exp(-5 * dt)); cafe.door.rotation.y = -doorOpen * 1.25; });
function openDoor(sec = 2.2) { if (doorT <= 0) doorBell(); doorT = sec; }
const shelfCups = [];
function cupOnShelf() { const x = 3.85 + (shelfCups.length % 8) * 0.24; const c = P.redCup(liveGroup, x, 1.265, 29.05); shelfCups.push(c); cupSnd(); return c; }
function takeCup(c) { const i = shelfCups.indexOf(c); if (i >= 0) shelfCups.splice(i, 1); liveGroup.remove(c); }
function clearShelf() { while (shelfCups.length) liveGroup.remove(shelfCups.pop()); }
/** a paper cup in someone's right hand */
function holdCup(ch, on = true) {
  if (ch._cup) { ch._cup.removeFromParent(); ch._cup = null; }
  if (!on) return;
  const hand = ch.mesh.skeleton.getBoneByName('Bip01_R_Hand'); if (!hand) return;
  const g = new THREE.Group(); P.redCup(g, 0, -0.06, 0); g.scale.setScalar(100); g.position.set(8, 3, 4); g.rotation.set(0, 0, Math.PI / 2);
  hand.add(g); ch._cup = g;
}

// ---------------------------------------------------------------- people: walking routes in the café
const PICK = [[3.9, 30.35], [4.75, 30.55], [5.55, 30.3], [4.25, 31.15], [5.15, 31.2], [3.6, 31.1]];
const pickFace = Math.PI;
async function walk(ch, pts, speed = 1.15) { ch.seated = false; await ch.walkTo(pts, {speed, nav: false}); }
async function leaveByDoor(ch) {
  await walk(ch, [[3.2, 34.9], [3.2, 35.6]], 1.2); openDoor(); await walk(ch, [[3.2, 37.2], [9 + Math.random() * 4, 38.2]], 1.25); ch.hide(); holdCup(ch, false);
}
async function goSit(ch, seat) { await ch.walkTo([[seat.x + Math.sin(seat.ry) * 0.55, seat.z + Math.cos(seat.ry) * 0.55]], {speed: 1.1}); sit(ch, seat, {anim: ch.g === 'm' ? 'm_sit_table_idle_neutral_01' : 'f_sit_table_breathe_01'}); }

// ================================================================= SCENE 0
async function scene0() {
  S.scene = 0; hud(false);
  const el = $('card'); el.className = 'source0'; show('card', true);
  el.innerHTML = `<div class="src0"><div class="tagl src">${ar('من الحالة المنشورة', 'From the published case')}</div><p>${ar('تشير أبحاث الشركة إلى فجوة في الخدمة. المقترح: ساعات عمل إضافية في الفروع، بتكلفة نحو <b>40 مليون دولار</b> في السنة. هل ستعود هذه الأموال؟ لا أحد يعرف بعد.', 'The company\'s research points to a service gap. The proposal: extra labor hours in the stores, at a cost of about <b>$40 million</b> a year. Will that money come back? Nobody knows yet.')}</p><small>Harvard Business Publishing, case 504-016 (Moon &amp; Quelch)</small></div>`;
  await fade(false, 600);
  await line('nar_open');
  await wait(0.6);
  await fade(true, 500); show('card', false);
}

// ================================================================= SCENE 1 — morning peak
const PEAK_QUEUE = ['salma', 'q1', 'q2', 'q3', 'q4', 's1', 's2'];
const PICKUP_CROWD = ['q5', 'q6', 'q7', 'q8'];
async function setupPeak() {
  setLevel(0); buildNav(); setTimeOfDay('morning'); setDayClock(8 * 60 + 10); sceneTag(ar('سيناريو تعليمي', 'Illustrative scenario'));
  for (const c of Object.values(C)) if (c !== player.ch) c.hide();
  setTickets(9, 38); clearShelf();
  startStaff({busy: true}); setStaffPace(true);
  lineUp(PEAK_QUEUE, 0);
  C.salma.setBase('f_idle_neutral_01'); C.salma.faceTo(-2.2, 28.5);
  PICKUP_CROWD.forEach((id, i) => stand(C[id], PICK[i][0], PICK[i][1], pickFace + (i - 1.5) * 0.2, qIdle(id)));
  stand(C.noor, 1.2, 27.75, Math.PI / 2, 'f_idle_neutral_02');
  teleport(6.7, 30.95, 0); lookTowards(4.25, 1.5, 28.3);
  startCafeSound(); setCrowd(1);
}
async function scene1() {
  S.scene = 1;
  await setupPeak();
  freeControls(); await fade(false, 900);
  // Noor comes along the bar with two cups, puts them on the shelf, turns to you
  await walk(C.noor, [[3.6, 27.95], [4.3, 28.25]], 1.45); C.noor.faceTo(4.3, 30); cupOnShelf(); cupOnShelf();
  await line('noor_s1_open');
  objective(ar('شاهد بنفسك أين يتعطل الطلب', 'See for yourself where the order gets stuck'));
  const benDone = {v: false, heard: false};
  setTasks([
    {t: ar('افحص سكة التذاكر', 'Inspect the order rail'), done: () => !!S.ev.rail},
    {t: ar('تتبّع طلبًا من الكاشير حتى الاستلام', 'Track one order from register to pickup'), done: () => !!S.ev.peak},
    {t: ar('اسمع من زبونين', 'Hear from two customers'), done: () => !!(S.ev.ben && S.ev.salma)},
  ]);
  addHotspot({id: 'rail', label: ar('سكة التذاكر', 'Order rail'), icon: 'board', pos: anchors.rail, range: 3.0, when: () => !S.ev.rail, use: inspectRail});
  // Ben's moment ~12 s in (he cannot be missed by accident: the track task waits for him)
  const ben = benEvent(benDone);
  await ben;
  // after Ben: Noor cues the tracking
  await line('noor_track');
  const track = new Promise(res => addHotspot({id: 'track', label: ar('تتبّع طلب سلمى', 'Track Salma\'s order'), icon: 'chart', kind: 'person', pos: V3(-2.2, 1.6, 29.95), range: 3.4, when: () => !S.ev.peak, use: async () => { removeHotspot('track'); await trackPeak(); res(); }}));
  await track;
  // Salma at the pickup shelf with her cup
  await new Promise(res => addHotspot({id: 'salma', label: ar('اسأل سلمى', 'Ask Salma'), icon: 'person', kind: 'person', pos: () => C.salma.headPos().clone().add(V3(0, 0.25, 0)), range: 2.6, when: () => !S.ev.salma, use: async () => {
    removeHotspot('salma'); C.salma.lockLook = true; turnTo(C.salma, camera.position);
    await line('p_salma'); await line('salma_reply'); gain('salma'); res();
  }}));
  if (!S.ev.rail) await new Promise(res => { const t = setInterval(() => { if (S.ev.rail) { clearInterval(t); res(); } }, 300); });
  await notebook();
  await line('noor_s1_end');
  // Salma leaves with her drink
  leaveByDoor(C.salma);
  await wait(1.0);
}
async function inspectRail() {
  removeHotspot('rail'); cineControls();
  await cine.shot(V3(2.75, 1.5, 30.15), V3(2.7, 1.47, 29.1), 1.0, {fov: 48});
  printer(); await wait(2.2);
  gain('rail');
  await line('noor_rail');
  freeControls();
}
async function benEvent(state) {
  await sleep(10);
  const ben = C.ben; ben.place(9.5, 38.3, -Math.PI / 2); ben.setBase('m_idle_neutral_01');
  await walk(ben, [[3.2, 37.4]], 1.3); openDoor(); await walk(ben, [[3.2, 35.4], [1.2, 34.95]], 1.2);
  const slot = QSLOTS[7]; await walk(ben, [[slot[0], slot[1]]], 1.0); ben.faceTo(QSLOTS[6][0], QSLOTS[6][1]);
  await sleep(2.5); await watchGlance(ben, 1.7); await sleep(2.2); await watchGlance(ben, 1.5); await sleep(0.8);
  ben.setBase('m_idle_neutral_01');
  await walk(ben, [[2.6, 35.2], [3.2, 35.45]], 1.15); ben.faceTo(3.2, 37);
  // he pauses at the door for 6 s: the player can stop him
  let talked = false;
  await new Promise(res => {
    addHotspot({id: 'ben', label: ar('تحدث مع بن', 'Talk to Ben'), icon: 'person', kind: 'person', pos: () => ben.headPos().clone().add(V3(0, 0.25, 0)), range: 3.6, use: async () => {
      talked = true; removeHotspot('ben'); turnTo(ben, camera.position); ben.lockLook = true;
      await line('p_ben'); await line('ben_leave'); gain('ben'); ben.lockLook = false; res();
    }});
    setTimeout(() => { if (!talked) { removeHotspot('ben'); res(); } }, 6000);
  });
  ben.faceTo(3.2, 37); openDoor(); await walk(ben, [[3.2, 37.3], [-9, 38.4]], 1.35); ben.hide();
  if (!talked) {
    await line('noor_card');
    await new Promise(res => addHotspot({id: 'card', label: ar('بطاقة في صندوق الرأي', 'Card in the comment box'), icon: 'envelope', pos: anchors.commentBox, range: 2.6, use: async () => {
      removeHotspot('card'); setInput(false);
      const el = $('card'); el.className = 'paper'; show('card', true);
      el.innerHTML = `<div class="ccard"><div class="cc-h">${ar('رأيك يهمنا', 'We value your opinion')}</div><p class="hand">${ar('«خرجت لأنني كنت سأتأخر.»', '"I left because I was going to be late."')}</p><button class="primary">${ar('احتفظ بالبطاقة', 'Keep the card')}</button></div>`;
      el.querySelector('button').onclick = () => { show('card', false); gain('ben'); freeControls(); lock(); res(); };
    }}));
  }
}
/** time-lapse tracking of one order (20× for the stopwatch and the clock; people move at their own pace) */
async function trackPeak() {
  cineControls(); setHotspotsBusy(true);
  await cine.shot(V3(7.05, 1.74, 29.8), V3(1.6, 1.32, 29.1), 1.2, {fov: 58});
  showStopwatch(true);
  // Salma orders: ticket #47 prints and goes on the rail
  C.salma.lookAt(null);
  await wait(0.8); printer();
  let tickets = Array.from({length: 9}, (_, i) => 38 + i).concat([47]);
  const draw = () => setTickets(tickets.length, tickets[0]);
  draw();
  const order = [...PEAK_QUEUE];       // front of the line: who orders next
  const crowd = [...PICKUP_CROWD];     // waiting at the pickup shelf
  let gameSec = 0; const T = 21;       // 7 minutes in 21 s
  lapse(true, 20); whoosh();
  const t0 = clock.t; let last = t0;
  const run = onUpdate(() => { const s = Math.min(T, clock.t - t0); gameSec = s * 20; setStopwatch(gameSec); setDayClock(8 * 60 + 13 + gameSec / 60); if (clock.t - last > 0.5) { last = clock.t; tickSnd(); } });
  // Salma goes to wait at the pickup shelf
  order.shift(); walk(C.salma, [[-1.2, 30.4], [2.6, 30.9], [PICK[5][0], PICK[5][1]]], 1.1).then(() => { C.salma.faceTo(4.6, 29); C.salma.setBase('f_idle_neutral_01'); });
  let next = 48; const sched = [];
  for (let k = 0; k < 10; k++) sched.push(k * 2.1 + 1.9);
  let pulled = 0, ordered = 0;
  for (const tt of sched) {
    while (clock.t - t0 < tt) await wait(0.05);
    // the oldest ticket comes off the rail: its cup goes on the shelf
    const num = tickets.shift(); pulled++; draw(); steam(); const cup = cupOnShelf();
    if (num === 47) break;
    // someone waiting takes a cup and goes (alternating: out of the door / to a table)
    const who = crowd.shift();
    if (who) { const ch = C[who]; (async () => { await walk(ch, [[cup.position.x, 29.75]], 1.0); ch.faceTo(cup.position.x, 29); await wait(0.5); takeCup(cup); holdCup(ch); await wait(0.3); if (pulled % 2) await leaveByDoor(ch); else await goSit(ch, anchors.seats[(pulled / 2 | 0) % anchors.seats.length]); })(); }
    // the line moves: the front person has ordered, steps over to the pickup shelf; the rest move up one slot
    if (pulled % 2 === 0 && order.length) {
      const front = order.shift(); ordered++; tickets.push(next++); draw(); printer();
      const fc = C[front]; const spot = PICK[(ordered + 1) % PICK.length];
      walk(fc, [[-1.2, 30.4], [spot[0] - 0.3, spot[1] + 0.6], spot], 1.05).then(() => { fc.faceTo(spot[0], 29); fc.setBase(qIdle(front) || (fc.g === 'm' ? 'm_idle_neutral_01' : 'f_idle_neutral_01')); crowd.push(front); });
      order.forEach((id, i) => { const s = QSLOTS[i]; walk(C[id], [[s[0], s[1]]], 0.9).then(() => C[id].faceTo(QSLOTS[Math.max(0, i - 1)][0], i === 0 ? 28 : QSLOTS[Math.max(0, i - 1)][1])); });
    }
  }
  while (clock.t - t0 < T) await wait(0.05);
  run(); setStopwatch(420); setDayClock(8 * 60 + 20); lapse(false);
  // Salma picks up #47
  const cup = shelfCups[shelfCups.length - 1];
  await walk(C.salma, [[cup.position.x, 29.75]], 1.0); C.salma.faceTo(cup.position.x, 29); await wait(0.4); takeCup(cup); holdCup(C.salma);
  await walk(C.salma, [[4.9, 30.5]], 0.9); C.salma.faceTo(3, 32);
  await captureStill('peak');
  gain('peak');
  await wait(1.2); showStopwatch(false);
  teleport(7.05, 29.85, 0); freeControls(); lookTowards(C.salma.headPos().x, 1.5, C.salma.headPos().z); lock();
}
/** the notebook: tag both comments */
function notebook() {
  setInput(false);
  const el = $('panel'); el.className = 'notebook'; show('panel', true);
  const item = (k, q) => `<div class="nb-item" data-k="${k}"><p class="hand">${q}</p><div class="nb-btns"><button data-t="speed">${ar('سرعة', 'Speed')}</button><button data-t="accuracy">${ar('دقة الطلب', 'Order accuracy')}</button></div><div class="nb-fb"></div></div>`;
  el.innerHTML = `<div class="nb-page"><div class="nb-h">${ar('دفتر الملاحظات — صنّف كل تعليق', 'Notebook — tag each comment')}</div>${item('ben', ar('بن: «كنت سأتأخر عن موعدي، فخرجت.»', 'Ben: "I was going to be late, so I left."'))}${item('salma', ar('سلمى: «مشروبي يخرج صحيحًا في العادة.»', 'Salma: "My drink usually comes out right."'))}<button class="primary" id="nbdone" disabled>${ar('تم', 'Done')}</button></div>`;
  return new Promise(res => {
    el.querySelectorAll('.nb-item').forEach(it => it.querySelectorAll('button').forEach(b => b.onclick = () => {
      const k = it.dataset.k; if (S.tags[k]) return; S.tags[k] = b.dataset.t; sfx.ui(); log('tag', k, b.dataset.t);
      it.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); it.classList.add('tagged');
      it.querySelector('.nb-fb').textContent = ar('هذه ملاحظة من زبون واحد، وليست قياسًا.', 'This is one customer\'s observation, not a measurement.');
      el.querySelector('#nbdone').disabled = !(S.tags.ben && S.tags.salma);
    }));
    el.querySelector('#nbdone').onclick = () => { sfx.ui(); el.className = 'hidden'; freeControls(); lock(); res(); };
  });
}

// ================================================================= SCENE 2 — quiet afternoon
async function scene2() {
  S.scene = 2;
  cineControls(); await fade(true, 700);
  timeCard(ar('3:00 عصرًا', '3:00 pm'), ar('نفس اليوم · الفرع نفسه', 'Same day · same store'));
  for (const c of Object.values(C)) if (c !== player.ch) { c.hide(); holdCup(c, false); }
  setTimeOfDay('afternoon'); setDayClock(15 * 60); setTickets(0); clearShelf(); setCrowd(0.25); setStaffPace(false);
  startStaff({busy: false});
  sit(C.s1, anchors.seats[0], {anim: 'f_sit_table_breathe_01'}); sit(C.s2, anchors.seats[3], {anim: 'm_sit_table_idle_neutral_01'});
  holdCup(C.s1, false);
  stand(C.q2, -2.2, 29.95, Math.PI, 'f_idle_neutral_01');
  stand(C.noor, 4.0, 30.55, Math.PI + 0.9, 'f_idle_neutral_02');
  teleport(3.15, 31.6, 0); lookTowards(-1.8, 1.4, 30.0);
  await wait(2.4); hideTimeCard();
  freeControls(); await fade(false, 900);
  objective(ar('قِس الانتظار في الوقت الهادئ', 'Measure the wait in the quiet period'));
  setTasks([{t: ar('تتبّع طلبًا في الوقت الهادئ', 'Track one order in the quiet period'), done: () => !!S.ev.off}]);
  await new Promise(res => addHotspot({id: 'track2', label: ar('تتبّع هذا الطلب', 'Track this order'), icon: 'chart', kind: 'person', pos: V3(-2.2, 1.6, 29.95), range: 3.6, use: async () => { removeHotspot('track2'); await trackOff(); res(); }}));
  await line('noor_s2');
  toggleTray(true);
  await new Promise(res => { const t = setInterval(() => { if ($('tray').classList.contains('hidden')) { clearInterval(t); res(); } }, 200); });
  await line('noor_q');
  const k = await ask(ar('ما مشكلة الخدمة التي ستحقق فيها أولًا؟', 'Which service problem would you investigate first?'), [{id: 'p_h_peak', key: 'peak'}, {id: 'p_h_acc', key: 'acc'}, {id: 'p_h_all', key: 'all'}]);
  S.hyp = k; log('hyp', k);
  await line({peak: 'noor_h_peak', acc: 'noor_h_acc', all: 'noor_h_all'}[k]);
  await line('noor_s2_up');
  objective(ar('اصعد إلى غرفة الاجتماعات', 'Go up to the meeting room'));
  setTasks([{t: ar('اصعد إلى غرفة الاجتماعات (السلم في الركن الغربي)', 'Go up to the meeting room (stairs, west corner)'), done: () => false}]);
  await new Promise(res => addHotspot({id: 'stairs', label: ar('اصعد إلى غرفة الاجتماعات', 'Go upstairs'), icon: 'door', pos: V3(anchors.stairs.x, 1.6, anchors.stairs.z - 0.4), range: 2.8, use: async () => { removeHotspot('stairs'); res(); }}));
}
async function trackOff() {
  cineControls(); setHotspotsBusy(true);
  await cine.shot(V3(7.45, 1.76, 30.15), V3(1.0, 1.3, 29.1), 1.2, {fov: 56});
  showStopwatch(true); await wait(0.6); printer();
  setTickets(1, 112);
  lapse(true, 20); whoosh();
  const t0 = clock.t, T = 6; let last = t0;
  const run = onUpdate(() => { const s = Math.min(T, clock.t - t0); setStopwatch(s * 20); setDayClock(15 * 60 + 1 + s * 20 / 60); if (clock.t - last > 0.5) { last = clock.t; tickSnd(); } });
  walk(C.q2, [[-1.2, 30.4], [3.5, 30.4]], 1.1).then(() => { C.q2.faceTo(3.6, 29); C.q2.setBase('f_cell_phone_textmessage'); });
  await wait(T - 0.9); setTickets(0); steam(); const cup = cupOnShelf();
  while (clock.t - t0 < T) await wait(0.05);
  run(); setStopwatch(120); lapse(false);
  await walk(C.q2, [[cup.position.x, 29.75]], 1.0); C.q2.faceTo(cup.position.x, 29); await wait(0.4); takeCup(cup); holdCup(C.q2);
  await captureStill('off');
  gain('off'); await wait(1.0); showStopwatch(false);
  goSit(C.q2, anchors.seats[2]);
  teleport(7.05, 29.85, 0); freeControls(); lookTowards(C.noor.headPos().x, 1.5, C.noor.headPos().z); lock();
}
function timeCard(big, small) { const el = $('card'); el.className = 'timecard'; el.innerHTML = `<div class="tc"><b>${big}</b><span>${small}</span></div>`; show('card', true); }
function hideTimeCard() { show('card', false); }

// ================================================================= SCENE 3 — price the improvement (upstairs, 5:30 pm)
let tabletScreen = null;
async function setupMeeting() {
  for (const c of Object.values(C)) if (c !== player.ch) { c.hide(); holdCup(c, false); }
  setLevel(1); setTimeOfDay('dusk'); setDayClock(17 * 60 + 30); setCrowd(0.15);
  const m = anchors.meet;
  sit(C.ellis, m.ellis, {anim: 'm_sit_table_idle_neutral_01'});
  if (!tabletScreen) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 360;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const g = P.group(liveGroup, cafe.tabletPos.x, cafe.tabletPos.y, cafe.tabletPos.z, Math.PI);
    P.rbox(g, 0.26, 0.012, 0.19, 0.01, new THREE.MeshStandardMaterial({color: 0x1a1b1d, roughness: 0.4}), 0, 0, 0);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.17), new THREE.MeshStandardMaterial({map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.7, roughness: 0.2})); s.rotation.x = -Math.PI / 2; s.position.y = 0.0125; g.add(s);
    tabletScreen = {c, t, draw: (mm) => { drawTabletScreen(c.getContext('2d'), c.width, c.height, mm); t.needsUpdate = true; }};
  }
  tabletScreen.draw(S.model);
  MEMO.bindScreen(screens.meet);
  MEMO.slide(ar('اجتماع لجنة الاستثمار', 'Investment committee'), [[ar('الموضوع', 'Topic'), ar('استثمار في العمالة لتحسين الخدمة', 'A labor investment to improve service')]]);
}
async function scene3() {
  S.scene = 3;
  cineControls(); await fade(true, 700);
  timeCard(ar('5:30 مساءً', '5:30 pm'), ar('غرفة الاجتماعات فوق المقهى', 'The meeting room above the café'));
  await setupMeeting();
  const a = anchors.meet.arrive; teleport(a.x, a.z, a.ry, UP); lookTowards(anchors.meet.ellis.x, UP + 1.2, anchors.meet.ellis.z);
  await wait(2.4); hideTimeCard();
  freeControls(); await fade(false, 900);
  objective(ar('اجلس مع إليس', 'Sit down with Ellis'));
  setTasks([{t: ar('اجلس مع إليس عند الطاولة', 'Sit down with Ellis at the table'), done: () => S.scene > 3}]);
  await new Promise(res => addHotspot({id: 'seat', label: ar('اجلس', 'Sit down'), icon: 'chair', pos: V3(anchors.meet.player.x, UP + 1.0, anchors.meet.player.z), range: 3.2, use: async () => { removeHotspot('seat'); res(); }}));
  await seatPlayer();
  await line('ellis_open');
  await line('ellis_ask');
  const n1 = await askNumber(ar('كم طلبًا إضافيًا في اليوم يغطي العمالة؟', 'How many extra orders a day cover the labor?'), ar('العمالة 21,600$ في السنة · 360 يوم عمل · كل طلب يضيف 3$', 'Labor $21,600 a year · 360 operating days · each order adds $3'));
  S.beFirst = n1; log('be1', n1);
  if (n1 === 20) await line('ellis_right');
  else {
    await line('ellis_hint');
    const n2 = await askNumber(ar('حاول مرة أخرى', 'Try again'), ar('اقسم التكلفة السنوية على أيام العمل، ثم على ربح الطلب', 'Divide the yearly cost by the operating days, then by the profit per order'));
    S.beSecond = n2; log('be2', n2);
    await line(n2 === 20 ? 'ellis_right' : 'ellis_wrong2');
  }
  await line('ellis_play');
  const said = {};
  await openTablet({
    onPreset: (n) => { if (n === 12 && !said[12]) { said[12] = 1; line('ellis_12'); } if (n === 26 && !said[26]) { said[26] = 1; line('ellis_26'); } },
    onContrib: (c) => { if (c === 2.5 && !said.c25) { said.c25 = 1; line('ellis_25'); } else if (c !== 3 && c !== 2.5 && !said.c) { said.c = 1; line('ellis_contrib'); } },
    onDraw: (m) => tabletScreen && tabletScreen.draw(m),
  });
  await chain;
  await line('ellis_done');
  // Priya and Noor come in and sit down
  const m = anchors.meet, door = m.door;
  C.priya.place(door.x, door.z, -Math.PI / 2, UP); C.priya.setBase('f_idle_neutral_01');
  C.noor.place(door.x + 0.6, door.z, -Math.PI / 2, UP); C.noor.setBase('f_idle_neutral_02');
  cine.shot(V3(m.player.x - 0.3, UP + 1.25, m.player.z - 0.1), V3(-1.0, UP + 1.4, 31.4), 1.2, {fov: 52});
  const pw = C.priya.walkTo([[-1.4, 31.3], [-2.0, 32.4], [m.priya.x + 0.5, m.priya.z]], {speed: 1.1, nav: false}).then(() => sit(C.priya, m.priya, {anim: 'f_sit_table_idle_neutral_01'}));
  await wait(0.8);
  const nw = C.noor.walkTo([[-1.4, 31.3], [-3.0, 31.5], [m.noor.x, m.noor.z - 0.5]], {speed: 1.1, nav: false}).then(() => sit(C.noor, m.noor, {anim: 'f_sit_table_breathe_01'}));
  await Promise.all([pw, nw]);
}
async function seatPlayer() {
  cineControls();
  const s = anchors.meet.player, e = anchors.meet.ellis;
  teleport(s.x, s.z, s.ry, UP);                     // the (hidden) body sits in the chair: nobody walks into it
  await cine.shot(V3(s.x, UP + 1.22, s.z + 0.05), V3(e.x + 0.15, UP + 1.02, e.z), 1.2, {fov: 50});
  cine.handheld(0.5);
}

// ================================================================= SCENE 4 — the recommendation
async function scene4({practice = false} = {}) {
  S.scene = 4;
  const m = anchors.meet;
  if (!practice) {
    cineControls(); await fade(true, 500);
    // you stand at the screen, clicker in hand; three-quarter view of the table
    await cine.shot(V3(-6.85, UP + 1.64, 33.75), V3(-2.9, UP + 1.12, 32.75), 0.01, {fov: 50});
    cine.handheld(0.6);
    await fade(false, 600);
    objective(ar('أوصِ اللجنة بقرار', 'Recommend a decision to the committee'));
    setTasks([{t: ar('ابنِ مذكرة القرار على الشاشة', 'Build the decision memo on the screen'), done: () => !!S.committed}]);
    await line('priya_open');
  }
  let memo;
  for (;;) {
    memo = {};
    MEMO.slide(ar('1 · التوصية', '1 · Recommendation'), [], ar('اختر توصية', 'Pick a recommendation'));
    memo.route = await MEMO.pick(ar('التوصية', 'Recommendation'), MEMO.routeOpts());
    if (!practice) await line(ROUTES[memo.route].line);
    MEMO.slide(ar('2 · دليل من الزبائن', '2 · Customer evidence'), [[ar('التوصية', 'Recommendation'), EN ? ROUTES[memo.route].en : ROUTES[memo.route].t]]);
    memo.cust = await MEMO.pick(ar('دليل من الزبائن', 'Customer evidence'), MEMO.custOpts());
    MEMO.slide(ar('3 · دليل من التكلفة', '3 · Cost evidence'), [[ar('التوصية', 'Recommendation'), EN ? ROUTES[memo.route].en : ROUTES[memo.route].t]]);
    memo.cost = await MEMO.pick(ar('دليل من التكلفة', 'Cost evidence'), MEMO.costOpts());
    MEMO.slide(ar('4 · شرط المراجعة', '4 · Review condition'), [[ar('التوصية', 'Recommendation'), EN ? ROUTES[memo.route].en : ROUTES[memo.route].t]]);
    memo.cond = await MEMO.pick(ar('شرط المراجعة: ما الذي يجعلك تستمر أو تتراجع؟', 'Review condition: what would make you keep or reverse it?'), MEMO.condOpts(S.log.length));
    MEMO.slide(ar('مذكرة القرار', 'Decision memo'), [[ar('التوصية', 'Recommendation'), EN ? ROUTES[memo.route].en : ROUTES[memo.route].t], [ar('شرط المراجعة', 'Review condition'), EN ? CONDS[memo.cond].en : CONDS[memo.cond].t]]);
    if (await MEMO.review(memo)) break;
  }
  memo.model = {...S.model}; memo.hyp = S.hyp;
  if (practice) { S.practice.push(memo); return memo; }
  S.committed = memo; log('commit', memo.route, memo.cond); saveCommit();
  await consequence(memo);
  await line(memo.cond === memo.route ? 'priya_match' : memo.cond === 'feel' ? 'priya_feel' : 'priya_other');
  await line('priya_close');
  return memo;
}
const presentView = () => cine.shot(V3(-6.85, UP + 1.64, 33.75), V3(-2.9, UP + 1.12, 32.75), 0.9, {fov: 50});
const screenView = () => cine.shot(V3(-4.9, UP + 1.55, 34.35), V3(-7.7, UP + 1.55, 33.0), 0.9, {fov: 46});
async function consequence(memo) {
  const badge = EN ? ROUTES[memo.route].badgeEn : ROUTES[memo.route].badge;
  screenView();
  if (memo.route === 'all') {
    MEMO.slide(ar('النشر في كل الفروع', 'Rollout in all stores'), [[ar('الوسم', 'Label'), badge], [ar('نتيجة 12 طلبًا (تعليمي)', '12-order result (illustrative)'), '−$8,640 / ' + ar('فرع / سنة', 'store / year')]]);
    await wait(2.0); presentView(); await line('noor_c_all'); await line('ellis_c_all');
  } else if (memo.route === 'pilot') {
    screens.meet.draw((g, W, H) => {
      g.fillStyle = '#f3efe7'; g.fillRect(0, 0, W, H); g.fillStyle = '#1f3a30'; g.fillRect(0, 0, W, 120); g.fillStyle = '#f3efe7'; g.font = '600 54px "IBM Plex Sans Arabic"'; g.textAlign = 'right'; g.fillText(ar('تجربة بفروع متطابقة', 'Matched-store pilot'), W - 70, 80);
      const cal = (x, title, col) => { g.fillStyle = '#fff'; g.fillRect(x, 190, 640, 560); g.strokeStyle = '#c9bfa9'; g.lineWidth = 3; g.strokeRect(x, 190, 640, 560); g.fillStyle = col; g.fillRect(x, 190, 640, 80); g.fillStyle = '#fff'; g.font = '600 40px "IBM Plex Sans Arabic"'; g.textAlign = 'center'; g.fillText(title, x + 320, 245);
        g.fillStyle = '#333'; g.font = '500 30px Inter'; for (let w = 0; w < 4; w++) for (let d = 0; d < 7; d++) { const xx = x + 40 + d * 82, yy = 330 + w * 100; g.strokeStyle = '#e2dccd'; g.strokeRect(xx - 30, yy - 50, 74, 84); g.fillText(String(w * 7 + d + 1), xx + 7, yy); if (d < 5) { g.fillStyle = col; g.fillRect(xx - 24, yy + 12, 62, 10); g.fillStyle = '#333'; } } };
      cal(80, ar('فروع التجربة · عمالة إضافية', 'Test stores · added staff'), '#2f6b4c'); cal(W - 720, ar('فروع المقارنة · بلا تغيير', 'Comparison stores · unchanged'), '#7a6f5d');
      g.fillStyle = '#7a6f5d'; g.font = '500 30px "IBM Plex Sans Arabic"'; g.textAlign = 'right'; g.fillText(badge, W - 70, H - 50);
    });
    await wait(2.4); presentView(); await line('ellis_c_pilot');
  } else {
    MEMO.slide(ar('تجربة خطوة الاستلام', 'Pickup-step test'), [[ar('الوسم', 'Label'), badge], [ar('أين', 'Where'), ar('فرع واحد، رف الاستلام', 'One store, the pickup shelf')]]);
    await wait(2.0); presentView(); await line('noor_c_handoff');
  }
}

// ================================================================= DEBRIEF
async function debrief() {
  S.scene = 5; cineControls(); hud(false);
  await fade(true, 700);
  const cmp = DB.compareScreen();
  await fade(false, 400);
  await line('nar_end');
  cmp.ready(); await cmp.done;
  await DB.quiz();
  for (;;) {
    const r = await DB.scoreScreen();
    if (r === 'again') { clearCommit(); location.href = location.pathname + (EN ? '?lang=en' : ''); return; }
    // practice attempt: build another memo (unscored), compare, then back to the score
    const el = $('card'); show('card', false);
    await fade(false, 200);
    const pm = await scene4({practice: true});
    const box = $('card'); box.className = 'compare'; show('card', true);
    box.innerHTML = `<div class="cmp-col teach"><div class="tagl">${ar('المحاولة المسجلة', 'Recorded attempt')}</div><h3>${ar('مذكرتك الأولى', 'Your first memo')}</h3>${memoList(S.committed)}</div><div class="cmp-col teach"><div class="tagl">${ar('محاولة تدريبية', 'Practice attempt')}</div><h3>${ar('المذكرة الجديدة', 'The new memo')}</h3>${memoList(pm)}</div><div class="cmp-foot"><button id="pmok" class="primary">${ar('عودة إلى النتيجة', 'Back to the score')}</button></div>`;
    await new Promise(res => box.querySelector('#pmok').onclick = () => { show('card', false); res(); });
  }
}
function memoList(m) { return `<dl class="dmemo"><dt>${ar('التوصية', 'Recommendation')}</dt><dd>${EN ? ROUTES[m.route].en : ROUTES[m.route].t}</dd><dt>${ar('شرط المراجعة', 'Review condition')}</dt><dd>${EN ? CONDS[m.cond].en : CONDS[m.cond].t}</dd></dl>`; }

// ================================================================= RUN
export async function run(dev) {
  setHotspotsBusy(false);
  if (!dev && loadCommit()) {          // a confirmed memo is kept across a refresh: show it again
    hud(false); await fade(false, 300); await debrief(); return;
  }
  if (dev === 'debrief') { Object.assign(S, {ev: {rail: 1, peak: 1, off: 1, ben: 1, salma: 1}, tags: {ben: 'speed', salma: 'accuracy'}, hyp: 'peak', beFirst: 20, contribChanged: true, committed: {route: 'pilot', cust: 'peak', cost: 'be', cond: 'pilot', model: {orders: 20, contrib: 3}}}); S.compared.add('20@3'); S.compared.add('12@3'); await debrief(); return; }
  if (!dev || dev === 's0') await scene0();
  if (!dev || ['s0', 's1'].includes(dev)) await scene1();
  else { await setupPeak(); Object.assign(S.ev, {rail: true, peak: true, ben: true, salma: true}); Object.assign(S.tags, {ben: 'speed', salma: 'accuracy'}); }
  if (!dev || ['s0', 's1', 's2'].includes(dev)) await scene2();
  else { S.ev.off = true; S.hyp = S.hyp || 'peak'; }
  if (!dev || ['s0', 's1', 's2', 's3'].includes(dev)) await scene3();
  else { await setupMeeting(); const m = anchors.meet; sit(C.priya, m.priya, {anim: 'f_sit_table_idle_neutral_01'}); sit(C.noor, m.noor, {anim: 'f_sit_table_breathe_01'}); S.beFirst = 20; S.compared.add('20@3'); S.compared.add('26@3'); }
  await scene4();
  await debrief();
}
