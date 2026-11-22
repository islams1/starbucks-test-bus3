// Scene director. 0: the published premise, the committee sits down, Noor starts the replay on the hanging screen.
// 1: watch the counter (the eye goes into the screen: eye level in the café, Ben leaves) → the queue card's two
// periods and the comments, the order rail inside the replay →
// the first hypothesis. 2: Ellis's tablet and the balance: what extra orders cover the added labor (compare two).
// 3: Priya asks for the recommendation → route, its consequence on the table → the memo (evidence + condition).
// 4: the memo beside the published case, three checks, the coaching rubric; practice attempts after.
import * as THREE from 'three';
import {camera, onUpdate, wait, clock, Q} from '../core/engine.js';
import {playVoice, sfx} from '../core/audio.js';
import * as cine from '../core/cine.js';
import {characters as C} from '../actors/character.js';
import {buildPerformance} from '../actors/performance.js';
import {MQ, anchor, toWorld, setFigures, showHypothesis, showHandoffTest, inCafe} from '../world/maquette.js';
import {feedOn, feedShot, setLabel, FEED} from '../world/screenfeed.js';
import {screen, SEATS, TABLE} from '../world/room.js';
import {setBalance, balanceAnchor} from '../world/scale.js';
import {TP, setQueueCard, holdTablet, fitHeld, showCalendars, drawMemoPad, anchorOf, drawTablet} from '../world/tableprops.js';
import {setModelTime} from '../world/lighting.js';
import {subtitle, hideSubtitle, choose, toast, objective, fade, hud, $, show} from '../ui/ui.js';
import {addHotspot, markDone, setHotspotsBusy} from '../ui/hotspots.js';
import {VIEW, backToSeat, enterCafe, focusCafe, cineMode, seatMode, seatLookAt, reducedMotion, screenCenter} from '../ui/view.js';
import {S, log, saveCommit, loadCommit, clearCommit} from './state.js';
import {sit, sleep} from './cast.js';
import {speaking, silent, watching} from './gaze.js';
import {setPeriod, benMoment, periodState, RP} from './replay.js';
import {startSound, muteAmbience, coin, slide, whoosh} from './sound.js';
import {openTablet, tabletRect, drawTabletScreen} from './tablet.js';
import * as MEMO from './memo.js';
import * as DB from './debrief.js';
import {balanceByHand, ticketHunt, signMemo, trayCenter, sortComments, commentsCenter} from './handson.js';
import {ROUTES, annual, money} from './score.js';

const EN = Q.get('lang') === 'en';
const ar = (a, e) => EN ? e : a;
let LINES = null, SPK = null;
export function initLines(lines, speakers) { LINES = lines; SPK = speakers; }
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
export const panelOpen = () => ['panel', 'card', 'qcard', 'ccard', 'tabletp'].some(id => $(id) && !$(id).classList.contains('hidden'));

// ---------------------------------------------------------------- HUD: scene tag, tasks, the model's state list, captions
let TASKS = [];
function setTasks(list) { TASKS = list; renderTasks(); }
function renderTasks() { const el = $('tasks'); if (!el) return; el.innerHTML = TASKS.map(x => `<li class="${x.done() ? 'done' : ''}">${x.t}</li>`).join(''); }
let taskT = 0; onUpdate((dt) => { taskT += dt; if (taskT > 0.4) { taskT = 0; renderTasks(); } });
function sceneTag(t) { $('scenetag').textContent = t; }
function stateList(key) {
  const el = $('statelist'); if (!key) { el.classList.add('hidden'); return; }
  const L = periodState(key, EN);
  el.innerHTML = `<b>${L[0]}</b><ul>${L.slice(1).map(x => `<li>${x}</li>`).join('')}</ul><span class="illus">${ar('تعليمي', 'Illustrative')}</span>`;
  el.classList.remove('hidden');
}
/** the strip under the replay: what is being shown */
const periodLabel = (k) => k === 'peak' ? ar('إعادة · الثلاثاء 8:10 صباحًا · فرع الميدان · سيناريو تعليمي', 'Replay · Tuesday 8:10 am · Al-Midan store · Illustrative') : ar('إعادة · الثلاثاء 3:30 عصرًا · فرع الميدان · سيناريو تعليمي', 'Replay · Tuesday 3:30 pm · Al-Midan store · Illustrative');
let capT = 0;
function caption(text, sec = 4) { const el = $('caption'); el.textContent = text; el.classList.add('on'); clearTimeout(capT); capT = setTimeout(() => el.classList.remove('on'), sec * 1000); }

// ---------------------------------------------------------------- dialogue
const REACTION = {shocked: 'surprise', worried: 'worry', tense: 'worry', excited: 'smile', pleased: 'smile', warm: 'smile', confident: 'nod', firm: 'nod', skeptical: 'skeptical', unsure: 'skeptical', calm: 'nod'};
const COMMITTEE = ['noor', 'ellis', 'priya'];
// (where they look is story/gaze.js; here only the faces: a nod, a smile, a worried look)
function listenersReact(speaker, emo) {
  const r = REACTION[emo];
  for (const id of COMMITTEE) {
    const c = C[id]; if (!c || c === speaker || !c.holder.visible) continue;
    if (r) setTimeout(() => c.react(Math.random() < 0.4 && r !== 'surprise' ? 'nod' : r), 700 + Math.random() * 1100);
  }
}
/** from the seat, turn the eyes towards someone who speaks (only if they are out of view) */
let lookTw = null;
onUpdate((dt) => {
  if (!lookTw || VIEW.mode !== 'seat') { lookTw = null; return; }
  const L = lookTw; L.t += dt; const k = Math.min(1, L.t / L.dur), e = k * k * (3 - 2 * k);
  VIEW.yaw = L.y0 + (L.y1 - L.y0) * e; VIEW.pitch = L.p0 + (L.p1 - L.p0) * e; if (k >= 1) lookTw = null;
});
const _fw = new THREE.Vector3(), _to = new THREE.Vector3();
function inView(p, deg = 30) { camera.getWorldDirection(_fw); _to.copy(p).sub(camera.position).normalize(); return _fw.dot(_to) > Math.cos(deg * Math.PI / 180); }
function glanceAt(p, dur = 0.8) { const y0 = VIEW.yaw, p0 = VIEW.pitch; seatLookAt(p); lookTw = {t: 0, dur, y0, p0, y1: VIEW.yaw, p1: VIEW.pitch}; VIEW.yaw = y0; VIEW.pitch = p0; }
function glanceDir(yaw, pitch, dur = 0.8) { lookTw = {t: 0, dur, y0: VIEW.yaw, p0: VIEW.pitch, y1: yaw, p1: pitch}; }

let chain = Promise.resolve();
export function line(id, opt = {}) { const r = chain.then(() => lineImpl(id, opt)); chain = r.catch(() => {}); return r; }
async function lineImpl(id, {look = true} = {}) {
  const L = LINES[id]; if (!L) { console.warn('line?', id); return; }
  const sp = SPK[L.s], url = `assets/vo/ar/${id}`;
  const text = EN ? L.en : (L.sub || L.t), name = EN ? sp.en[0] : sp.name, role = EN ? sp.en[1] : sp.role;
  const words = await fetch(url + '.json').then(r => r.ok ? r.json() : []).catch(() => []);
  const who = L.s === 'player' || L.s === 'narrator' ? null : C[L.s];
  if (who && who.holder.visible) {
    speaking(L.s, L.to || 'player', L.glance || null);
    if (look && VIEW.mode === 'seat') { const hp = who.headPos().clone(); hp.y -= 0.08; if (!inView(hp)) glanceAt(hp); }
    listenersReact(who, L.e);
    let timeFn = () => 0;
    const perf = buildPerformance(L.t, words, {speakerId: L.s, emotion: L.e, seated: !!who.seated, pointTarget: L.glance === 'balance' ? balanceAnchor() : screenCenter()});
    const p = who.say(url, {emotion: L.e, perf, getPos: () => inCafe(camera.position) ? null : who.headPos()});
    await new Promise(r => { const t = () => who.voice ? (timeFn = who.voice.time, r()) : requestAnimationFrame(t); t(); setTimeout(r, 1500); });
    subtitle(name, role, text, EN ? null : words, () => timeFn());
    await p;
  } else {
    speaking(L.s === 'player' ? 'player' : 'narrator');
    if (L.s === 'player') listenersReact(null, L.e);
    const v = await playVoice(url + '.mp3', null, {});
    subtitle(name, role, text, EN ? null : words, v.time); await v.done;
  }
  silent();
  await wait(0.15); hideSubtitle();
}
/** player reply: choose a line, then say it. opts [{id, key, text?}] */
async function ask(q, opts) {
  const o = await choose(q, opts.map(x => ({...x, text: x.text || (EN ? LINES[x.id].en : LINES[x.id].t)})));
  if (o.id) await line(o.id);
  return o.key || o.id;
}

// ---------------------------------------------------------------- evidence
const EVT = {
  rail: () => ar('سكة التذاكر: الطلبات تصل من الكاشير أسرع مما تخرج المشروبات من البار. 9 تذاكر تنتظر، والزحام عند رف الاستلام.', 'Order rail: orders arrive from the register faster than drinks leave the bar. 9 tickets wait; the crowd is at the pickup shelf.'),
  peak: () => ar('الذروة، 8:10 ص: متوسط الانتظار من الطلب للاستلام 7 دقائق (محاكاة).', 'Peak, 8:10 am: median wait from order to pickup 7 minutes (simulated).'),
  off: () => ar('الهدوء، 3:30 م: متوسط الانتظار دقيقتان (محاكاة).', 'Off-peak, 3:30 pm: median wait 2 minutes (simulated).'),
  c1: () => ar('«خرجت لأنني كنت سأتأخر.»', '"I left because I was running late."'),
  c2: () => ar('«مشروبي يخرج صحيحًا في العادة.»', '"My drink usually comes out right."'),
};
function gain(k) { if (S.ev[k]) return; S.ev[k] = true; log('ev', k); sfx.evidence(); toast(`<b>${ar('في درج الأدلة', 'Pinned to the evidence tray')}</b> · ${EVT[k]()}`, 'ev'); }
const HYP = {peak: () => ar('انتظار الاستلام في الذروة', 'Peak wait at pickup'), acc: () => ar('دقة الطلبات', 'Order accuracy'), all: () => ar('مشكلة خدمة عامة في الفرع', 'A storewide service problem')};
export function toggleTray(on = $('tray').classList.contains('hidden')) {
  if (!on) { show('tray', false); return; }
  const el = $('tray');
  const tagTxt = (k) => S.tags[k] ? `<span class="tag ${S.tags[k]}">${S.tags[k] === 'speed' ? ar('سرعة', 'Speed') : ar('دقة الطلب', 'Order accuracy')}</span>` : '';
  const rows = [];
  if (S.ev.rail) rows.push(`<div class="evc"><b>${ar('سكة التذاكر', 'Order rail')}</b><p>${EVT.rail()}</p></div>`);
  if (S.ev.peak || S.ev.off) rows.push(`<div class="evc wait"><b>${ar('بطاقة الانتظار', 'Queue observation card')}</b> <span class="illus">${ar('تعليمي', 'Illustrative')}</span>
    <table><tr><th>${ar('الفترة', 'Period')}</th><th>${ar('متوسط الانتظار', 'Median wait')}</th></tr>
    <tr class="${S.ev.peak ? '' : 'locked'}"><td>${ar('الذروة، 8:10 ص', 'Peak, 8:10 am')}</td><td>${S.ev.peak ? ar('7 دقائق', '7 minutes') : '—'}</td></tr>
    <tr class="${S.ev.off ? '' : 'locked'}"><td>${ar('الهدوء، 3:30 م', 'Off-peak, 3:30 pm')}</td><td>${S.ev.off ? ar('دقيقتان', '2 minutes') : '—'}</td></tr></table></div>`);
  for (const k of ['c1', 'c2']) if (S.ev[k]) rows.push(`<div class="evc"><b>${ar('تعليق زبون', 'Customer comment')}</b><p>${EVT[k]()}</p>${tagTxt(k)}</div>`);
  if (S.hyp) rows.push(`<div class="evc"><b>${ar('فرضيتك الأولى', 'Your first hypothesis')}</b><p>${HYP[S.hyp]()}</p></div>`);
  if (S.tabletSeen) { const m = S.model; rows.push(`<div class="evc"><b>${ar('نموذج الفرع', 'Store model')}</b> <span class="illus">${ar('تعليمي', 'Illustrative')}</span><p class="ltr num">${m.orders} × 360 × $${m.contrib.toFixed(2)} − $21,600 = ${money(annual(m.orders, m.contrib))}</p></div>`); }
  el.innerHTML = `<div class="tray-in"><div class="tray-head"><b>${ar('درج الأدلة', 'Evidence tray')}</b><kbd>Tab</kbd></div>${rows.join('') || `<p class="empty">${ar('لم تجمع أدلة بعد.', 'No evidence yet.')}</p>`}<button type="button" class="ghost" id="trayclose">${ar('إغلاق', 'Close')}</button></div>`;
  el.querySelector('#trayclose').onclick = () => toggleTray(false);
  show('tray', true);
}

// ---------------------------------------------------------------- the committee sits down
const SEAT_EYE = V3(0.02, 1.2, 1.02);
function seatCommittee() {
  sit(C.noor, SEATS.noor); sit(C.ellis, SEATS.ellis); sit(C.priya, SEATS.priya);
  for (const id of COMMITTEE) C[id].lookAt('camera');
}
const headOf = (id) => C[id].headPos().clone().add(V3(0, -0.06, 0));
// when the committee talk among themselves the camera steps back to show the three of them (and who looks at whom)
const GROUP = {pos: V3(-1.62, 1.42, 1.6), look: V3(0.5, 1.0, -0.78), fov: 44};
async function groupShot(fn, {back = null} = {}) {
  cineMode();
  await cine.shot(GROUP.pos, GROUP.look, reducedMotion() ? 0 : 1.3, {fov: GROUP.fov});
  await fn();
  if (back !== false) await backToSeat({look: back || headOf('priya')});
}
// the wall screen: the reported store count (kept apart from the one-store model) / the rollout board
function screenFact() {
  screen.draw((g, W, H) => {
    g.fillStyle = '#101214'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#d9b26f'; g.font = '600 34px "IBM Plex Sans Arabic"'; g.textAlign = 'center'; g.fillText(ar('من التقرير السنوي 10-K لعام 2002', 'From the FY2002 Form 10-K'), W / 2, 120);
    g.fillStyle = '#f2efe6'; g.font = '700 200px Inter'; g.fillText('5,886', W / 2, 360);
    g.font = '500 44px "IBM Plex Sans Arabic"'; g.fillText(ar('متجرًا لـ Starbucks في 29 سبتمبر 2002', 'Starbucks retail stores, Sept 29, 2002'), W / 2, 450);
    g.fillStyle = '#8e9a8f'; g.font = '500 30px "IBM Plex Sans Arabic"'; g.fillText(ar('الرقم المعلن — منفصل عن إعادة الفرع الواحد على الشاشة', 'The reported count — separate from the one-store replay on the screen'), W / 2, 560);
  });
}
function screenRollout(k = 1) {
  screen.draw((g, W, H) => {
    g.fillStyle = '#101214'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#e59b7a'; g.font = '600 40px "IBM Plex Sans Arabic"'; g.textAlign = 'center'; g.fillText(ar('زيادة العمالة في كل الفروع الآن · التزام عالٍ', 'Add staffing across stores now · High commitment'), W / 2, 70);
    const cols = 24, rows = 9, cw = 44, ch = 44, x0 = (W - cols * cw) / 2 + 6, y0 = 110;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const lit = (r * cols + c) / (cols * rows) < k; g.fillStyle = lit ? '#d9b26f' : '#2a2d30'; g.fillRect(x0 + c * cw, y0 + r * ch, cw - 10, ch - 10); }
    g.fillStyle = '#f2efe6'; g.font = '500 34px "IBM Plex Sans Arabic"';
    g.fillText(ar('كل فرع: 21,600$ عمالة إضافية في السنة · عند 12 طلبًا: ', 'Every store: $21,600 added labor a year · at 12 orders: ') + money(annual(12, S.model.contrib)) + ar(' للفرع', ' per store'), W / 2, H - 70);
    g.fillStyle = '#8e9a8f'; g.font = '500 26px "IBM Plex Sans Arabic"'; g.fillText(ar('رسم توضيحي — ليس عدد الفروع الحقيقي', 'Illustration — not the real store count'), W / 2, H - 26);
  });
}

// ================================================================= SCENE 0 — the premise, the committee, the replay starts
async function scene0() {
  S.scene = 0; hud(false); cineMode();
  setPeriod('peak', {still: true}); setModelTime('morning'); feedShot('wide', {cut: true}); feedOn(false);
  screenFact();
  // the hanging screen, still dark, against the window wall at sunset; a slow drift along the table
  const c = screenCenter();
  cine.shot(V3(0.6, 1.45, 1.55), c, 0, {fov: 40});
  cine.fly([V3(0.6, 1.45, 1.55), V3(0.1, 1.42, 1.4), V3(-0.4, 1.4, 1.2)], () => c, 16, {fov: 40});
  const el = $('card'); el.className = 'source0'; show('card', true);
  el.innerHTML = `<div class="src0"><div class="tagl src">${ar('من الحالة المنشورة', 'From the published case')}</div><p>${ar('تشير أبحاث الشركة إلى فجوة في الخدمة. المقترح: ساعات عمل إضافية في الفروع، بتكلفة نحو <b>40 مليون دولار</b> في السنة. هل ستعود هذه الأموال؟ لا أحد يعرف بعد.', 'The company\'s research points to a service gap. The proposal: extra labor hours in the stores, at a cost of about <b>$40 million</b> a year. Will that money come back? Nobody knows yet.')}</p><small>Harvard Business Publishing, case 504-016 (Moon &amp; Quelch)</small></div>`;
  await fade(false, 900);
  await line('nar_open');
  await wait(0.4); el.classList.add('out'); await wait(0.6); show('card', false); el.classList.remove('out');
  // the committee: from the seat, Priya at the head of the table
  sceneTag(ar('سيناريو تعليمي', 'Illustrative scenario')); hud(true);
  await cine.shot(GROUP.pos, GROUP.look, reducedMotion() ? 0 : 2.2, {fov: GROUP.fov});
  await line('priya_hello');
  await backToSeat({look: headOf('noor'), dur: 1.2});
  // Noor starts the replay on the screen: Tuesday, 8:10, the store as it was; all eyes go to it
  setPeriod('peak', {still: reducedMotion()}); feedOn(true, periodLabel('peak')); whoosh(); watching(true);
  stateList('peak');
  setTimeout(() => { if (VIEW.mode === 'seat') glanceAt(screenCenter(), 1.2); }, 2600);
  await line('noor_model');
  await wait(1.2);
}

// ================================================================= SCENE 1 — watch the counter
async function scene1() {
  S.scene = 1; sceneTag(ar('سيناريو تعليمي · راقب الكاونتر', 'Illustrative scenario · Watch the counter'));
  setHotspotsBusy(true); cineMode(); watching(true);
  // into the screen: the eye moves up to it until the picture fills the view, then stands in the café at eye level
  feedShot('counter');
  const sc = screenCenter();
  if (!reducedMotion()) { await cine.shot(V3(0.2, 1.5, 0.9), sc, 1.4, {fov: 46}); await cine.shot(sc.clone().add(V3(0.95, 0, 0)), sc, 1.3, {fov: 58}); }
  await fade(true, 160);
  const eye = toWorld(1.5, 1.55, 3.05), at = toWorld(-0.6, 1.15, -1.4);
  cine.hold(eye, at, {fov: 60});
  await fade(false, 300);
  caption(ar('[صوت المقهى: طابعة التذاكر، أحاديث خافتة]', '[Café sounds: ticket printer, low chatter]'), 5);
  // ten seconds of the morning: Ben comes in, looks at his watch, leaves before he orders; a drink goes out
  await wait(4.5);
  // a second angle from the seating side: the register on the left, the line and the door on the right
  const eye2 = toWorld(0.35, 1.6, 3.55), at2 = toWorld(3.9, 1.2, 1.0);
  cine.hold(eye2, at2, {fov: 60});
  const ben = benMoment();
  setTimeout(() => caption(ar('زبون يدخل وينضم إلى آخر الطابور.', 'A customer comes in and joins the end of the line.'), 4), 2200);
  setTimeout(() => caption(ar('ينظر إلى ساعته… مرة أخرى.', 'He checks the time… again.'), 4), 9000);
  await Promise.race([ben, wait(24)]);
  caption(ar('خرج قبل أن يطلب. وزبونة أخرى تستلم مشروبها من الرف.', 'He left before ordering. Another customer collects her drink at the shelf.'), 5);
  await wait(2.5);
  // out of the screen, back in the chair (the screen goes on replaying the line)
  feedShot('line', {cut: true});
  await fade(true, 200);
  seatLookAt(screenCenter()); cine.shot(SEAT_EYE, screenCenter(), 0, {fov: 50});
  await fade(false, 300);
  await wait(0.8);
  seatMode(); watching(false);
  glanceAt(headOf('noor'), 0.9);
  await line('noor_spec');
  // the interactive part: the queue card's two periods, the comments, the rail, the model
  objective(ar('افحص الفرع: افتح فترتي بطاقة الانتظار، واقرأ تعليقًا واحدًا على الأقل.', 'Examine the store: open both periods on the queue card and read at least one comment.'));
  setTasks([
    {t: ar('بطاقة الانتظار: الذروة', 'Queue card: peak'), done: () => !!S.ev.peak},
    {t: ar('بطاقة الانتظار: الهدوء', 'Queue card: off-peak'), done: () => !!S.ev.off},
    {t: ar('تعليق زبون واحد على الأقل', 'At least one customer comment'), done: () => !!(S.ev.c1 || S.ev.c2)},
    {t: ar('(اختياري) افحص سكة التذاكر', '(Optional) Inspect the order rail'), done: () => !!S.ev.rail},
  ]);
  hotspotsScene1();
  setHotspotsBusy(false);
  // when the required pieces are in, the learner says when to move on (the rail and the model stay open till then)
  let ready = false;
  const need = () => S.ev.peak && S.ev.off && (S.ev.c1 || S.ev.c2);
  addHotspot({id: 'cont1', label: ar('تابع: الفرضية الأولى ←', 'Continue: first hypothesis →'), icon: 'eye', pos: null, when: () => S.scene === 1 && need() && !ready, use: async () => { ready = true; }});
  await until(() => ready && !panelOpen() && !busyScene);
  setHotspotsBusy(true);
  if (VIEW.mode !== 'seat') await backToSeat({look: headOf('noor')});
  // the first hypothesis
  await line('noor_q');
  const k = await ask(ar('ما مشكلة الخدمة التي ستحقق فيها أولًا؟', 'Which service problem would you investigate first?'), [
    {id: 'p_h_peak', key: 'peak', text: ar('انتظار الاستلام في الذروة', 'Peak wait at pickup')},
    {id: 'p_h_acc', key: 'acc', text: ar('دقة الطلبات', 'Order accuracy')},
    {id: 'p_h_all', key: 'all', text: ar('مشكلة خدمة عامة في الفرع', 'A storewide service problem')},
  ]);
  S.hyp = k; log('hyp', k);
  showHypothesis(k); coin();
  await line({peak: 'noor_h_peak', acc: 'noor_h_acc', all: 'noor_h_all'}[k]);
  toast(`<b>${ar('فرضيتك الأولى', 'Your first hypothesis')}</b> · ${HYP[k]()} — ${ar('ستبقى ظاهرة في المذكرة', 'it stays visible in the memo')}`, 'ev');
  objective(''); setTasks([]);
}
let busyScene = false;
const until = (fn) => new Promise(r => { const off = onUpdate(() => { if (fn()) { off(); r(); } }); });

// ---------------------------------------------------------------- scene 1 interactions
let s1Hotspots = false;
function hotspotsScene1() {
  if (s1Hotspots) return; s1Hotspots = true;
  const s1 = () => S.scene === 1;
  addHotspot({id: 'qcard', label: ar('بطاقة الانتظار', 'Queue observation card'), icon: 'card', pos: () => anchorOf(TP.queueCard, 0.02), when: s1, use: openQueueCard});
  addHotspot({id: 'comments', label: ar('تعليقات الزبائن', 'Customer comments'), icon: 'comment', pos: () => anchorOf(TP.commentBox, 0.08), when: s1, use: openComments});
  addHotspot({id: 'rail', label: ar('سكة التذاكر · افحص تدفق الطلبات', 'Order rail · Inspect order flow'), icon: 'rail', pos: () => VIEW.mode === 'cafe' ? anchor('rail') : null, when: s1, use: inspectRail});
  addHotspot({id: 'screen', label: ar('ادخل الإعادة', 'Step into the replay'), icon: 'eye', pos: () => screenCenter().add(V3(0.1, -0.35, 0)), modes: ['seat'], when: () => S.scene >= 1 && FEED.on && !busyScene, use: () => enterCafe(), dock: false});
}
async function showPeriod(key) {
  setPeriod(key, {still: reducedMotion()}); setQueueCard(key, {[key]: true}); stateList(key); whoosh();
  const first = !S.ev[key]; gain(key); markDone('qcard', S.ev.peak && S.ev.off);
  feedOn(true, periodLabel(key)); feedShot('wide', {cut: true}); watching(true); setTimeout(() => watching(false), 9000);
  if (key === 'off' && first) line('noor_s2');
  if (VIEW.mode === 'seat') glanceAt(screenCenter(), 0.9);
}
function openQueueCard() {
  return new Promise(res => {
    const el = $('qcard'); show('qcard', true);
    const draw = () => {
      el.innerHTML = `<div class="qc"><div class="qc-head"><b>${ar('بطاقة الانتظار', 'Queue observation card')}</b><span class="illus">${ar('تعليمي', 'Illustrative')}</span></div>
        <p class="qc-hint">${ar('اختر فترة لتُعاد على الشاشة:', 'Pick a period to replay it on the screen:')}</p>
        <button type="button" class="qc-row ${RP.period === 'peak' ? 'on' : ''}" data-k="peak"><span>${ar('الذروة', 'Peak')}<small>${ar('8:10 صباحًا', '8:10 am')}</small></span><b class="num">${S.ev.peak ? ar('7 دقائق', '7 min') : '?'}</b></button>
        <button type="button" class="qc-row ${RP.period === 'off' ? 'on' : ''}" data-k="off"><span>${ar('الهدوء', 'Off-peak')}<small>${ar('3:30 عصرًا', '3:30 pm')}</small></span><b class="num">${S.ev.off ? ar('دقيقتان', '2 min') : '?'}</b></button>
        <p class="qc-note">${ar('متوسط الانتظار من الطلب للاستلام، بيانات محاكاة. نفس الفرع ونفس العاملين.', 'Median wait from order to pickup, simulated data. Same store, same staff.')}</p>
        <button type="button" class="ghost" id="qcclose">${ar('تم', 'Done')}</button></div>`;
      el.querySelectorAll('.qc-row').forEach(b => b.onclick = async () => { sfx.ui(); await showPeriod(b.dataset.k); draw(); });
      el.querySelector('#qcclose').onclick = () => { sfx.ui(); show('qcard', false); res(); };
      setTimeout(() => { const f = el.querySelector('.qc-row:not(.on)') || el.querySelector('.qc-row'); f && f.focus({preventScroll: true}); }, 30);
    };
    draw();
  });
}
// the comment cards: taken out of the box by hand, turned over, sorted onto two mats (the list is the other way)
const CMS = [{k: 'c1', ok: 'speed'}, {k: 'c2', ok: 'accuracy'}];
const fbText = (c, t) => (t === c.ok ? '✓ ' : '') + ar('ملاحظة نوعية من زبون واحد: تصف تجربته، ولا تقيس ' + (c.ok === 'speed' ? 'زمن الانتظار.' : 'دقة الطلبات.'), 'A qualitative observation from one customer: it describes an experience, it does not measure ' + (c.ok === 'speed' ? 'the wait.' : 'order accuracy.'));
async function openComments() {
  const first = !S.ev.c1 && !S.ev.c2;
  if (first) line('noor_cards', {look: false});
  if (VIEW.mode === 'seat') glanceAt(commentsCenter(), 0.8);
  const how = await sortComments({cards: CMS.map(c => ({k: c.k, ok: c.ok, text: EVT[c.k]()})), tags: S.tags,
    onOpen: (k) => gain(k),
    onTag: (k, t) => { S.tags[k] = t; log('tag', k, t); return fbText(CMS.find(x => x.k === k), t); }});
  if (how === 'list') await openCommentsList(false);
  markDone('comments', S.ev.c1 && S.ev.c2);
}
function openCommentsList(sayLine = true) {
  return new Promise(async res => {
    const first = sayLine && !S.ev.c1 && !S.ev.c2;
    const el = $('ccard'); show('ccard', true);
    const CM = CMS;
    const draw = () => {
      el.innerHTML = `<div class="cm"><div class="cm-head"><b>${ar('صندوق الرأي — ذلك الثلاثاء', 'Comment box — that Tuesday')}</b></div><div class="cm-cards">${CM.map(c => `
        <div class="cm-card ${S.ev[c.k] ? 'open' : ''}" data-k="${c.k}">${S.ev[c.k]
          ? `<div class="hand">${EVT[c.k]()}</div><div class="cm-tags"><span>${ar('صنّفه:', 'Tag it:')}</span><button type="button" data-t="speed" class="${S.tags[c.k] === 'speed' ? 'on' : ''}">${ar('سرعة', 'Speed')}</button><button type="button" data-t="accuracy" class="${S.tags[c.k] === 'accuracy' ? 'on' : ''}">${ar('دقة الطلب', 'Order accuracy')}</button></div><div class="cm-fb">${S.tags[c.k] ? fbText(c, S.tags[c.k]) : ''}</div>`
          : `<button type="button" class="cm-open" data-o="${c.k}">${ar('افتح البطاقة', 'Open the card')}</button>`}</div>`).join('')}</div>
        <button type="button" class="ghost" id="cmclose">${ar('تم', 'Done')}</button></div>`;
      el.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { sfx.paper(); gain(b.dataset.o); draw(); });
      el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { sfx.ui(); const k = b.closest('.cm-card').dataset.k; S.tags[k] = b.dataset.t; log('tag', k, b.dataset.t); draw(); });
      el.querySelector('#cmclose').onclick = () => { sfx.ui(); show('ccard', false); markDone('comments', S.ev.c1 && S.ev.c2); res(); };
    };
    draw();
    if (first) line('noor_cards');
  });
}
async function inspectRail() {
  busyScene = true;
  setHotspotsBusy(true);
  if (RP.period !== 'peak') setPeriod('peak', {still: reducedMotion()}), stateList('peak'), setQueueCard('peak');
  feedShot('rail');
  await enterCafe('rail', {yaw: -0.15, pitch: 0.32, dist: 2.2});
  caption(ar('تذكرة تُضاف عند الكاشير… والمشروبات تخرج من البار أبطأ.', 'A ticket goes up at the register… drinks leave the bar more slowly.'), 5);
  // by hand: pull the tickets off the rail and read their times until the order that has waited longest turns up
  await ticketHunt();
  focusCafe('pickup'); await wait(reducedMotion() ? 0.5 : 2.5);
  gain('rail'); markDone('rail');
  await line('noor_rail');
  busyScene = false;
}

// ================================================================= SCENE 2 — price the improvement
async function scene2() {
  S.scene = 2; sceneTag(ar('سيناريو تعليمي · احسب التحسين', 'Illustrative scenario · Price the improvement'));
  if (VIEW.mode !== 'seat') await backToSeat({look: headOf('ellis')});
  else glanceAt(headOf('ellis'));
  // the question is about the peak: the replay goes back to 8:10, seen from across the street (where the assumed extra
  // customers will stand)
  if (RP.period !== 'peak') { setPeriod('peak', {still: reducedMotion()}); setQueueCard('peak'); }
  stateList('peak'); feedOn(true, periodLabel('peak')); feedShot('front'); watching(false);
  await line('ellis_open');
  glanceAt(balanceAnchor(), 1.0);
  await line('ellis_scale');
  // by hand first: a coin in the orders' pan for every extra order a day, until the beam is level
  glanceAt(trayCenter().lerp(balanceAnchor(), 0.55).add(V3(0, 0.02, 0)), 0.9);
  objective(ar('وازن الكفتين بيدك: عملة في كفة الطلبات لكل طلب إضافي مكتمل في اليوم.', 'Balance the pans by hand: a coin in the orders’ pan for each extra completed order a day.'));
  line('ellis_coins', {look: false});
  await balanceByHand({onOrders: (n) => { setFigures(n); drawTablet((g, W, H) => drawTabletScreen(g, W, H, S.model)); }});
  await chain;
  await line('ellis_level', {look: false});
  // the tablet slides across the table into the player's hands
  slide();
  const tp = TP.tablet.position, from = tp.clone(), to = V3(0.04, TABLE.y + 0.004, 0.52);   // (left of the memo pad: it stays there after use)
  await new Promise(r => { let t = 0; const off = onUpdate((dt) => { t += dt; const k = Math.min(1, t / 0.9), e = k * k * (3 - 2 * k); tp.lerpVectors(from, to, e); TP.tablet.rotation.y = 0.25 * (1 - e); if (k >= 1) { off(); r(); } }); });
  holdTablet(true); document.body.classList.add('tablet-open');
  // look so that the screen (the street, the assumed customers) and the balance stay clear of the tablet in the hands
  glanceDir(EN ? 1.27 : 0.84, -0.02, 1.0);
  objective(ar('اعثر على عدد الطلبات الإضافية التي تغطي العمالة، وقارن افتراضين مختلفين.', 'Find the extra orders that cover the labor, and compare two different assumptions.'));
  const fit = onUpdate(() => fitHeld(tabletRect()));
  const said = {};
  const draw = (m) => { setBalance(m.orders, m.contrib); setFigures(m.orders); drawTablet((g, W, H) => drawTabletScreen(g, W, H, m)); };
  draw(S.model);
  const NL = {look: false};      // the eyes stay on the balance while Ellis talks
  line('ellis_play', NL);
  await openTablet({
    onChange: draw,
    onPreset: (o) => { if (o === 12 && !said[12]) { said[12] = 1; line('ellis_12', NL); } else if (o === 26 && !said[26]) { said[26] = 1; line('ellis_26', NL); } coin(); },
    onContrib: (c) => { if (c === 2.5 && !said.c25) { said.c25 = 1; line('ellis_25', NL); } else if (!said.c && c !== 3) { said.c = 1; line('ellis_contrib', NL); } },
  });
  fit(); holdTablet(false); objective(''); document.body.classList.remove('tablet-open');
  await chain;
  await line('ellis_done');
}

// ================================================================= SCENE 3 — the recommendation
async function scene3() {
  S.scene = 3; sceneTag(ar('سيناريو تعليمي · التوصية', 'Illustrative scenario · Make a recommendation'));
  // a three-quarter view of Priya, Noor and Ellis
  cineMode();
  await cine.shot(V3(-1.55, 1.42, 1.55), V3(0.85, 1.0, -0.55), reducedMotion() ? 0 : 2.0, {fov: 44});
  await line('priya_open');
  await backToSeat({look: headOf('priya'), dur: 1.2});
  const memo = S.draft;
  for (;;) {
    if (!memo.route) {
      const r = await MEMO.pick(ar('توصيتك للجنة:', 'Your recommendation to the committee:'), MEMO.routeOpts(), {step: MEMO.stepTxt(1)});
      memo.route = r; log('route', r);
      drawMemoPad([ar('التوصية: ', 'Rec: ') + (EN ? ROUTES[r].en : ROUTES[r].t)]);
      await line(ROUTES[r].line);
      await consequence(r);
    }
    const ev = await MEMO.evidenceSteps(memo, 5);
    if (!ev) { clearConsequence(); memo.route = null; continue; }
    const v = await MEMO.review(memo);
    if (v === 'ok') break;
    if (v === 'route') { clearConsequence(); memo.route = null; memo.cust = memo.cost = memo.cond = null; }
  }
  // the memo on the pad: the player signs it with the pen (a close look at the pad)
  cineMode();
  const pad = anchorOf(TP.memo, 0);
  await cine.shot(pad.clone().add(V3(-0.02, 0.36, 0.24)), pad, reducedMotion() ? 0 : 1.0, {fov: 46});
  await signMemo([ar('التوصية: ', 'Rec: ') + (EN ? ROUTES[memo.route].en : ROUTES[memo.route].t), ar('دليل الزبائن ✓', 'Customer evidence ✓'), ar('دليل التكلفة ✓', 'Cost evidence ✓'), ar('شرط المراجعة ✓', 'Review condition ✓')]);
  await backToSeat({look: headOf('priya'), dur: 1.0});
  // Priya on the condition
  await line(memo.cond === 'feel' ? 'priya_feel' : memo.cond === memo.route ? 'priya_match' : 'priya_other');
  S.committed = {route: memo.route, cust: memo.cust, cost: memo.cost, cond: memo.cond, whyLine: memo.whyLine, note: memo.note || '', model: {...S.model}, hyp: S.hyp, at: Date.now()};
  saveCommit(); log('commit', memo.route);
  toast(`<b>${ar('المذكرة مؤكدة', 'Memo confirmed')}</b> · ${ar('نسخة محفوظة للمراجعة', 'a copy is locked for the debrief')}`, 'ev');
  await line('priya_close');
}
async function consequence(r) {
  if (r === 'all') {
    glanceAt(screen.mesh.position.clone().add(V3(0, 0, 0.3)), 1.0);
    let k = 0; const off = onUpdate((dt) => { k = Math.min(1, k + dt * 0.6); screenRollout(k); if (k >= 1) off(); });
    toast(`<b>${ar('التزام عالٍ', 'High commitment')}</b>`, 'warn');
    await groupShot(async () => { await line('noor_c_all'); await line('ellis_c_all'); }, {back: screen.mesh.position.clone()});
  } else if (r === 'pilot') {
    showCalendars(true); slide();
    glanceAt(anchorOf(TP.calendars[0], 0.05), 0.9);
    toast(`<b>${ar('التزام محدود', 'Limited commitment')}</b>`, 'ok');
    await wait(1.2);
    await groupShot(async () => { await line('ellis_c_pilot'); }, {back: anchorOf(TP.calendars[0], 0.05)});
  } else {
    showHandoffTest(true); feedShot('pickup'); watching(true);
    glanceAt(screenCenter(), 1.0);
    toast(`<b>${ar('تكلفة أقل، ودليل أبطأ على العمالة', 'Lower cost and slower evidence on staffing')}</b>`, 'ok');
    await wait(1.5);
    await line('noor_c_handoff');
    watching(false); feedShot('wide');
  }
}
function clearConsequence() { showCalendars(false); showHandoffTest(false); screenFact(); feedShot('wide'); }

// ================================================================= SCENE 4 — compare the decisions
async function debrief() {
  S.scene = 4; hud(false); setHotspotsBusy(true);
  cineMode();
  feedShot('wide'); cine.shot(V3(1.4, 1.38, 1.5), V3(-1.4, 1.2, -0.1), reducedMotion() ? 0 : 2.5, {fov: 44});
  const c = DB.compareScreen();
  await line('nar_end');
  c.ready(); await c.done;
  await DB.quiz();
  for (;;) {
    const r = await DB.scoreScreen();
    if (r === 'again') { clearCommit(); location.href = location.pathname + (EN ? '?lang=en' : ''); return; }
    if (r === 'revise') await practice();
  }
}
/** a separate practice attempt: the same memo steps, unscored; the committed memo stays as it was */
async function practice() {
  const memo = {};
  for (;;) {
    if (!memo.route) memo.route = await MEMO.pick(ar('محاولة تدريب — توصيتك:', 'Practice attempt — your recommendation:'), MEMO.routeOpts(), {step: MEMO.stepTxt(1)});
    const ev = await MEMO.evidenceSteps(memo, 9);
    if (!ev) { memo.route = null; continue; }
    const v = await MEMO.review(memo);
    if (v === 'ok') break;
    if (v === 'route') { memo.route = null; }
  }
  S.practice.push({...memo, model: {...S.model}, practice: true, at: Date.now()}); saveCommit();
}

// ================================================================= RUN
export async function run(dev) {
  startSound();
  seatCommittee();
  $('ambbtn').onclick = () => { const m = muteAmbience(); $('ambbtn').classList.toggle('off', m); $('ambbtn').setAttribute('aria-pressed', m ? 'true' : 'false'); };
  $('trybtn').onclick = () => toggleTray();
  $('leanbtn').onclick = () => { if (VIEW.mode === 'seat') { if (FEED.on) enterCafe(); } else if (VIEW.mode === 'cafe') backToSeat({look: screenCenter()}); };
  if (dev === 'view') {          // look at the set with the replay running, no story (QA: __cam([...],[...],fov))
    const k = Q.get('t') === 'off' ? 'off' : 'peak';
    setPeriod(k); stateList(k); feedOn(true, periodLabel(k)); feedShot(Q.get('shot') || 'wide', {cut: true});
    seatLookAt(screenCenter()); seatMode(); hud(true); await fade(false, 300);
    window.__enter = (f, o) => enterCafe(f, o); window.__seat = () => backToSeat({look: screenCenter()}); window.__ben = () => benMoment(); window.__period = (p) => { setPeriod(p); feedOn(true, periodLabel(p)); };
    window.__shot = (n, cut) => feedShot(n, {cut}); window.__watch = (on) => watching(on);
    window.__line = (id) => line(id, {look: false});
    window.__sitAs = (fa, ma) => { for (const id of COMMITTEE) sit(C[id], SEATS[id], {anim: C[id].g === 'm' ? ma : fa}); };
    return;
  }
  if (dev === 'debrief' || dev === 'review') {
    if (!loadCommit()) { Object.assign(S.ev, {peak: true, off: true, c1: true, rail: true}); S.hyp = 'peak'; S.tabletSeen = true; S.seenLow = true; S.committed = {route: 'pilot', cust: 'peak', cost: 'be', cond: 'pilot', model: {...S.model}}; }
    setPeriod('peak', {still: true}); feedOn(true, periodLabel('peak'));
    await fade(false, 400); await debrief(); return;
  }
  if (dev === 's1') { setPeriod('peak'); stateList('peak'); feedOn(true, periodLabel('peak')); cine.shot(SEAT_EYE, screenCenter(), 0, {fov: 50}); hud(true); await fade(false, 400); await scene1(); await scene2(); await scene3(); await debrief(); return; }
  if (dev === 's2') { setPeriod('peak'); stateList('peak'); feedOn(true, periodLabel('peak')); Object.assign(S.ev, {peak: true, off: true, c1: true}); S.hyp = 'peak'; showHypothesis('peak'); seatLookAt(headOf('ellis')); seatMode(); hud(true); await fade(false, 400); await scene2(); await scene3(); await debrief(); return; }
  if (dev === 's3') { setPeriod('peak'); stateList('peak'); feedOn(true, periodLabel('peak')); Object.assign(S.ev, {peak: true, off: true, c1: true}); S.hyp = 'peak'; S.tabletSeen = true; S.seenLow = true; S.comparedOrders = new Set([20, 12]); showHypothesis('peak'); seatLookAt(headOf('priya')); seatMode(); hud(true); await fade(false, 400); await scene3(); await debrief(); return; }
  await scene0(); await scene1(); await scene2(); await scene3(); await debrief();
}
