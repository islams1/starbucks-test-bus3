// The director — Concept A "The Eight-Unit Table", scene by scene (§4).
// Opening: a slow drift through the workshop with the premise card and the narrator; the capacity ledger appears and
// stays in every shot. A wide shot with both tables: Victor asks for a clear order, a named risk and a review
// condition. The player's eye at the worktable: Rania holds the report out (it lands on the table), Ina sets the
// prototype box on its base, Mikael names the eight units pointing at the rack; a wide shot of the three; Mikael asks
// to open the proposals. Spread 1: open the four proposals, read the note and tag it. Spread 2: allocate by hand,
// order First / Next, name what waits, confirm (receipt). Spread 3: the one camera move to the review table, the
// pitch board, the condition clipped beside "First", the commit stamp, the coaching. Spread 4: the archive on the
// wall, three checks, the final card; "Try another allocation" is a practice attempt.
import * as THREE from 'three';
import {camera, onUpdate, wait, Q} from '../core/engine.js';
import {playVoice} from '../core/audio.js';
import * as cine from '../core/cine.js';
import {characters as C} from '../actors/character.js';
import {buildPerformance} from '../actors/performance.js';
import {WT, RT, EYE, SEATS, STAND, ARCH, openArchive, panelWorld} from '../world/workshop.js';
import {TB, baseHot, NOTE_HOME, drawBoard, setCardOpen} from '../world/props.js';
import {subtitle, hideSubtitle, toast, objective, fade, hud, $, show, prompt, letterbox} from '../ui/ui.js';
import {addHotspot, removeHotspot, markDone} from '../ui/hotspots.js';
import {VIEW, eyeAt, cineMode, glanceTo, glanceBack, inView, reducedMotion, allowWalk, nearTable, WALK} from '../ui/view.js';
import {HAND} from '../ui/playerhand.js';
import {setWorld, tweenTo} from '../ui/hand.js';
import {S, save, log, resetAllocation, clearAll} from './state.js';
import {P, IDS, EN, tr, nm, full, T, missing, used, condLine, snapshot, CONDS} from './alloc.js';
import {placeOpening, placeReview, walkToReview, armsTo, front, sit, stand, sleep} from './cast.js';
import {speaking, silent} from './gaze.js';
import {startSound, S as SND} from './sound.js';
import {TBL, setupTable, setupReview, syncTable, syncCards, refresh, flipCard, liftNote, stampNote, fund} from './table.js';
import {CB, openCard, closeCard, liveCard, openNote, toggleList, drawList, drawTopLedger, announce, showReceipt, drawPitch, showCoach} from './cards.js';
import {showPanels, archiveCard, runChecks, finalCard, panelSlot} from './archive.js';

let LINES = null, SPK = null;
export function initLines(lines, speakers) { LINES = lines; SPK = speakers; }
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const RM = () => reducedMotion();
const place = (p) => { document.body.dataset.place = p; };

// ---------------------------------------------------------------- the four spreads and their checklists
const PLAN = [
  {name: () => tr('استمع إلى المقترحات المتنافسة', 'Hear the competing proposals'), tasks: [
    ...IDS.map(id => ({t: () => tr(`افتح «${full(id)}»`, `Open “${full(id)}”`), done: () => !!S.opened[id]})),
    {t: () => tr('اقرأ تقرير التاجر', 'Read the retailer note'), done: () => !!S.noteRead},
    {t: () => tr('ضع الختم الصحيح على التقرير', 'Tag the note with the right stamp'), done: () => S.tag === 'current'},
  ]},
  {name: () => tr('وزّع ما يستطيع الفريق تنفيذه', 'Allocate what the team can deliver'), tasks: [
    {t: () => tr('موّل مقترحًا واحدًا على الأقل', 'Fund at least one proposal'), done: () => S.a.funded.length > 0},
    {t: () => tr('رتّب الأول والتالي (إن موّلت اثنين)', 'Order First / Next (if you fund two)'), done: () => S.a.funded.length === 1 || !!(S.a.first && S.a.next)},
    {t: () => tr('ضع شريحة الحاجة على مقترح ينتظر', 'Put the need chip on a deferred proposal'), done: () => !!S.a.need},
    {t: () => tr('أكّد التوزيع', 'Confirm the allocation'), done: () => !!S.confirmed},
  ]},
  {name: () => tr('اشرح التسلسل', 'Explain the sequence'), tasks: [
    {t: () => tr('شرط مراجعة بجانب «الأول»', 'A review condition beside “First”'), done: () => !!S.a.cond},
    {t: () => tr('اعتمد العرض', 'Commit the pitch'), done: () => S.stage > 3},
  ]},
  {name: () => tr('افتح التحوّل الحقيقي', 'Open the real turnaround'), tasks: [
    {t: () => tr('اللوحات الثلاث في الأرشيف', 'The three archive panels'), done: () => !!S.archiveSeen},
    {t: () => tr('أسئلة المراجعة الثلاثة', 'The three review checks'), done: () => Object.keys(S.checks).length >= 3},
  ]},
];
let STAGE = -1;
function setStage(i) { STAGE = i; renderTasks(); }
const required = () => PLAN.flatMap(p => p.tasks);
function renderTasks() {
  const el = $('tasks'), pg = $('progress'); if (!el || !pg) return;
  if (STAGE < 0) { el.innerHTML = ''; pg.classList.add('hidden'); return; }
  const Pl = PLAN[STAGE], req = required(), done = req.filter(t => t.done()).length, pct = Math.round(done / req.length * 100);
  el.innerHTML = Pl.tasks.map(x => `<li class="${x.done() ? 'done' : ''}">${x.t()}</li>`).join('');
  $('pgstage').textContent = tr(`الجزء ${STAGE + 1} من 4 · `, `Part ${STAGE + 1} of 4 · `) + Pl.name();
  $('pgpct').textContent = pct + '%'; $('pgfill').style.width = pct + '%';
  $('pgsteps').innerHTML = PLAN.map((p, i) => `<i class="${i < STAGE || p.tasks.every(t => t.done()) ? 'done' : i === STAGE ? 'on' : ''}"></i>`).join('');
  pg.classList.remove('hidden');
}
let taskT = 0; onUpdate((dt) => { taskT += dt; if (taskT > 0.4) { taskT = 0; renderTasks(); } });
let capT = 0;
function caption(text, sec = 3.5) { const el = $('caption'); el.textContent = text; el.classList.add('on'); clearTimeout(capT); capT = setTimeout(() => el.classList.remove('on'), sec * 1000); }

// ---------------------------------------------------------------- dialogue
const REACTION = {pleased: 'nod', confident: 'nod', firm: 'nod', calm: 'nod', worried: 'worry', skeptical: 'skeptical', tense: 'worry', hopeful: 'smile', excited: 'smile', warm: 'smile'};
function listenersReact(speaker, emo) {
  const r = REACTION[emo]; if (!r) return;
  for (const id of ['ina', 'mikael', 'rania', 'victor']) { const c = C[id]; if (!c || c === speaker || !c.holder.visible || Math.random() < 0.55) continue; setTimeout(() => c.react(r), 900 + Math.random() * 1200); }
}
let chain = Promise.resolve(), pending = 0;
const chainDepth = () => pending - 1;
/** play a line (queued). cues: [[seconds | (words, dur) => seconds, fn]] fired from the start of the voice */
export function line(id, opt = {}) { pending++; const r = chain.then(() => lineImpl(id, opt)).finally(() => pending--); chain = r.catch(() => {}); return r; }
const said = (id) => !!S.said[id];
async function once(id, opt = {}, key = id) { if (said(key)) return; S.said[key] = true; save(); await line(id, opt); }
async function lineImpl(id, {cues = [], look = true} = {}) {
  const L = LINES[id]; if (!L) { console.warn('line?', id); return; }
  const sp = SPK[L.s], url = `assets/vo/${EN ? 'en' : 'ar'}/${id}`;
  const text = EN ? L.en : (L.sub || L.t);
  const words = await fetch(url + '.json').then(r => r.ok ? r.json() : []).catch(() => []);
  const dur = words.length ? (words[words.length - 1][0] + words[words.length - 1][1]) / 1000 + 0.3 : Math.max(2, text.length * 0.065);
  const fire = () => { for (const [at, fn] of cues) { const t = typeof at === 'function' ? at(words, dur) : at; setTimeout(() => { try { fn(); } catch (e) { console.error(e); } }, Math.max(0, t) * 1000); } };
  const who = C[L.s] && C[L.s].holder.visible ? C[L.s] : null;
  log('line', id);
  let turned = null;
  if (who) {
    speaking(L.s, L.to || 'player', L.glance || null, dur);
    if (look && VIEW.autoTurn && !HAND.carry && !HAND.script && (VIEW.mode === 'stand' || VIEW.mode === 'seat') && document.body.dataset.place !== 'wall') { const hp = who.headPos().clone(); hp.y -= 0.1; if (!inView(hp, 32)) turned = glanceTo(hp, 0.9); }
    listenersReact(who, L.e);
    const perf = buildPerformance(L.t, words, {speakerId: L.s, emotion: L.e, seated: true, pointTarget: null});
    perf.events = perf.events.filter(e => e.type !== 'point' && e.type !== 'shrug'); perf.loop = 'none';
    let timeFn = () => 0;
    const p = who.say(url, {emotion: L.e, perf, gesture: false}).catch(() => {});
    await new Promise(r => { const t = () => who.voice ? (timeFn = who.voice.time, r()) : requestAnimationFrame(t); t(); setTimeout(r, 1800); });
    fire(); subtitle(sp.name, sp.role, text, words, () => timeFn());
    await p;
  } else {
    speaking(L.s === 'player' ? 'player' : 'narrator', L.to || null, null, dur);
    const v = await playVoice(url + '.mp3', null, {}).catch(() => null);
    fire();
    if (v) { subtitle(sp.name, sp.role, text, words, v.time); await v.done; }
    else { subtitle(sp.name, sp.role, text); await wait(dur); }
  }
  silent();
  await wait(0.15); hideSubtitle();
  if (turned && chainDepth() === 0) glanceBack(turned);
}
/** the time a word is spoken (first word matching) */
const wordAt = (re, frac = 0.5) => (words, dur) => { const w = words.find(x => re.test(x[2])); return w ? w[0] / 1000 - 0.15 : dur * frac; };

// ---------------------------------------------------------------- shots
const SHOT = {
  wideBoth: () => [V(1.55, 2.3, 3.75), V(1.55, 0.95, -0.85), 62],
  wideThree: () => [V(WT.x + 1.75, 1.62, WT.z + 1.55), V(WT.x - 0.1, 1.38, WT.z - 0.95), 44],
  wideReview: () => [V(1.2, 2.0, 2.55), V(RT.x + 0.2, 0.95, RT.z - 0.45), 50],
};
async function shot(k, dur = 1.4) { const [p, l, fov] = SHOT[k](); cineMode(); await cine.shot(p, l, RM() ? 0 : dur, {fov}); }
const tableLook = () => V(WT.x + 0.14, WT.y, WT.z - 0.2);
async function toEye(dur = 1.2) { place('stand'); VIEW.leanWant = 0; await eyeAt('stand', EYE.stand, tableLook(), {dur, fov: 60, yawRange: 1.35, pitch: [-1.2, 0.35]}); }
async function toSeat(dur = 1.4) { place('seat'); await eyeAt('seat', EYE.seat, V(SEATS.victor.x, 1.12, RT.z - 0.05), {dur, fov: 52, yawRange: 1.3, pitch: [-1.0, 0.5]}); }
async function toWall(dur = 1.6) {
  place('wall');
  const eye = V(RT.x + 0.25, 2.0, RT.z + (EN ? -0.75 : 0.75)), look = V(ARCH.x, ARCH.y - 0.08, ARCH.z + (EN ? 0.55 : -0.55));
  await eyeAt('seat', eye, look, {dur, fov: 56, yawRange: 0.7, pitch: [-0.5, 0.4]});
}

// ---------------------------------------------------------------- the props in the cast's hands
const followers = new Map();
onUpdate(() => { for (const [o, f] of followers) f(o); });
function holdNote() {           // Rania holds the report at her side, then out to the player
  const bone = C.rania.mesh.skeleton.getBoneByName('Bip01_R_Hand'); if (!bone) return;
  const q = new THREE.Quaternion();
  followers.set(TB.note.g, (o) => {
    const p = bone.getWorldPosition(new THREE.Vector3()), f = new THREE.Vector3(0, 0, 1).applyQuaternion(C.rania.holder.quaternion);
    setWorld(o, p.addScaledVector(f, 0.06).add(V(0, -0.05, 0)));
    o.rotation.set(1.25, C.rania.holder.rotation.y, 0, 'YXZ');
  });
}
async function noteLands() {
  followers.delete(TB.note.g);
  const g = TB.note.g, r0 = g.rotation.clone(), t0 = performance.now(), dur = RM() ? 10 : 650;
  const rot = onUpdate(() => { const k = Math.min(1, (performance.now() - t0) / dur); g.rotation.set(r0.x * (1 - k), r0.y + (0.06 - r0.y) * k, 0, 'YXZ'); if (k >= 1) rot(); });
  await tweenTo(g, NOTE_HOME, dur / 1000, {arc: 0.12}); SND.paper();
}
let inaArms = null;
function holdBox() {            // Ina holds the prototype box in both hands
  const m = TB.bases.theme.model, ch = C.ina;
  const at = () => front(ch, 0.34, 1.02, 0);
  inaArms = armsTo(ch, [{side: 'R', target: () => front(ch, 0.3, 1.0, 0.115), bend: 0.4}, {side: 'L', target: () => front(ch, 0.3, 1.0, -0.115), bend: 0.4}], {rise: 0.01});
  followers.set(m, (o) => { setWorld(o, at().add(V(0, -0.06, 0))); o.rotation.y = ch.holder.rotation.y; });
}
async function boxLands() {
  const m = TB.bases.theme.model; followers.delete(m);
  const to = TB.bases.theme.g.localToWorld(V(0, 0.035, -0.09));
  inaArms && setTimeout(() => inaArms.release(), 450);
  const r0 = m.rotation.y, t0 = performance.now(), dur = RM() ? 10 : 800;
  const rot = onUpdate(() => { const k = Math.min(1, (performance.now() - t0) / dur); m.rotation.y = r0 + (0 - r0) * k; if (k >= 1) rot(); });
  await tweenTo(m, to, dur / 1000, {arc: 0.05}); SND.slide();
}
function setTableProps({held = false} = {}) {
  // where the note and the box are when the game resumes past the opening
  followers.clear();
  const m = TB.bases.theme.model; m.position.set(0, 0.035, -0.09); m.rotation.set(0, 0, 0);
  if (!held) { setWorld(TB.note.g, NOTE_HOME); TB.note.g.rotation.set(0, 0.06, 0); }
}
function pointAtRack() { return armsTo(C.mikael, [{side: 'R', target: () => TB.rack.g.localToWorld(V(0, 0.15, 0)), bend: 0.1}], {rise: 0.45, hold: 1.4}); }
function openLabel() {
  const flap = TB.bases.delivery.model.userData.flap;
  const tgt = () => TB.bases.delivery.model.localToWorld(V(0.075, 0.09, 0.05));
  const a = armsTo(C.mikael, [{side: 'R', target: tgt, bend: 0.5}], {rise: 0.55, hold: 1.5});
  setTimeout(() => { const t0 = performance.now(); const off = onUpdate(() => { const k = Math.min(1, (performance.now() - t0) / 500); flap.rotation.x = -2.1 * k * k * (3 - 2 * k); if (k >= 1) off(); }); SND.paper(); }, 600);
  return a;
}

// ---------------------------------------------------------------- the capacity ledger and the HUD
function ledgerOn(on) { show('ledger', on); drawTopLedger(); }
TBL.on.announce = (t) => announce(t);
TBL.on.changed = () => { drawTopLedger(); liveCard(); if (!$('list').classList.contains('hidden')) drawList(); drawPitch(); };
TBL.on.hint = (t, bad) => { const p = $('prompt'); if (!t) { prompt(null); p.classList.remove('hands', 'bad'); return; } prompt(t); p.classList.add('hands'); p.classList.toggle('bad', !!bad); };

// ---------------------------------------------------------------- opening
async function opening() {
  setStage(-1); ledgerOn(false); VIEW.autoTurn = true;
  placeOpening(); holdNote(); holdBox();
  place('cine'); cineMode(); letterbox(true);
  camera.position.set(-4.2, 1.95, 2.9); camera.lookAt(WT.x, 1.0, WT.z);
  $('tcard').innerHTML = `<div class="tc-in"><div class="tc-k">${tr('ركن للألعاب · هذه الدورة', 'Rukn Toys · this cycle')}</div><p>${tr('شركة ركن للألعاب تمرّ بعامٍ صعب. على الطاولة مقترحات أكثر مما يستطيع الفريق تنفيذه.', 'Rukn Toy Company is having a hard year. There are more proposals on the table than the team can deliver.')}</p><p class="tc-b">${tr('معك 8 وحدات فقط من قدرة التنفيذ.', 'You have only 8 units of execution capacity.')}</p><small>${tr('سيناريو تعليمي · شركة متخيَّلة', 'Illustrative scenario · a fictional company')}</small></div>`;
  await fade(false, 900);
  show('tcard', true);
  const drift = cine.shot(V(0.2, 1.75, 2.7), V(RT.x - 0.4, 1.0, RT.z - 0.6), RM() ? 0 : 13, {fov: 55, ez: (t) => t});
  await line('nar_open');
  show('tcard', false); letterbox(false);
  await drift;
  hud(true); ledgerOn(true);
  await shot('wideBoth', 1.6);
  await line('victor_hello');
  await fade(true, 220); await toEye(0); await fade(false, 260);
  await line('rania_open');
  let reportArm = null;
  await line('rania_note', {cues: [[0.15, () => { reportArm = armsTo(C.rania, [{side: 'R', target: () => front(C.rania, 0.55, 1.12, 0.05), bend: 0.2}], {rise: 0.6}); }],
    [(w, d) => Math.min(d * 0.55, 2.2), () => { noteLands().then(() => reportArm && reportArm.release()); }]]});
  await line('ina_open', {cues: [[(w, d) => d * 0.35, () => boxLands()]]});
  await line('mikael_open', {cues: [[wordAt(/ثماني|eight|8/i, 0.7), () => pointAtRack()]]});
  await shot('wideThree', 1.4);
  await line('ina_to_mikael'); await line('mikael_to_ina'); await line('rania_to_both');
  await toEye(1.3);
  await line('mikael_task');
  VIEW.autoTurn = false;
  S.stage = 1; save();
}

// ---------------------------------------------------------------- spread 1 · hear the competing proposals
let s1done = null;
/** before a table action: back in front of the worktable if the player has walked away */
async function atTable() { if (VIEW.mode === 'stand' && WALK.on && !nearTable()) await toEye(0.9); }
TBL.on.ensureAtTable = atTable;
async function openProposal(id) {
  await atTable();
  if (TBL.busy || $('pcard').innerHTML && !$('pcard').classList.contains('hidden')) return;
  TBL.busy = true;
  try {
    const first = !S.opened[id];
    if (first) { await flipCard(id); S.opened[id] = true; log('open', id); save(); markDone('open_' + id); refresh(); }
    const p = P[id], L = LINES[p.open];
    openCard(id, {line: L ? (EN ? L.en : (L.sub || L.t)) : null});
    if (first) {
      const n = IDS.filter(k => S.opened[k]).length;
      announce(tr(`فُتح «${full(id)}». المقترحات المفتوحة: ${n} من 4.`, `Opened “${full(id)}”. Proposals opened: ${n} of 4.`));
      TBL.busy = false;
      await once(p.open, id === 'delivery' ? {cues: [[(w, d) => d * 0.28, () => openLabel()]]} : {});
    }
  } finally { TBL.busy = false; }
}
CB.closeCard = async () => {
  // for the venue concept, Mikael answers Ina in a wide shot
  if (S.opened.venue && !said('q_venue2') && STAGE === 0) {
    S.said.q_venue2 = true; save();
    const back = VIEW.mode === 'stand';
    await shot('wideThree', 1.0); await line('q_venue2'); if (back) await toEye(0.9);
  }
  checkS1();
};
async function readNote() {
  await atTable();
  if (TBL.busy) return; TBL.busy = true;
  try { await liftNote(); S.noteRead = true; TBL.allow.stamp = true; log('read', 'note'); save(); markDone('note'); } finally { TBL.busy = false; }
  openNote();
}
CB.readNote = readNote; CB.open = (id) => openProposal(id); CB.closeNote = () => checkS1();
TBL.on.open = (id) => openProposal(id);
TBL.on.readNote = () => readNote();
TBL.on.tagged = async (k, first) => {
  refresh();
  if (k === 'untested') {
    caption(tr('[ختم أحمر: طلب غير مُختبَر]', '[a red stamp: Untested demand]'));
    toast(`<b>${tr('وسم يحتاج تصحيحًا', 'A tag to correct')}</b> · ${tr('هذا التقرير عن تشكيلة قائمة يشتريها العملاء الآن، لا عن فكرة غير مُختبَرة. وسمها الصحيح «طلب عملاء حالي». صحّحه بالختم الآخر.', "This note concerns an existing range that customers buy now, not an untested idea. Its right label is “Current customer demand”. Correct it with the other stamp.")}`, 'warn');
    await line('rania_tag_wrong');
  } else {
    caption(tr('[ختم أخضر: طلب عملاء حالي]', '[a green stamp: Current customer demand]'));
    await line('rania_tag_ok');
  }
  checkS1();
};
function checkS1() { if (s1done && IDS.every(id => S.opened[id]) && S.tag === 'current' && !TBL.busy && $('pcard').classList.contains('hidden')) { const r = s1done; s1done = null; r(); } }
async function spread1() {
  setStage(0); allowWalk(true);
  objective(tr('افتح المقترحات الأربعة، ثم اقرأ تقرير التاجر وضع عليه ختمًا.', 'Open all four proposals, then read the retailer note and tag it with a stamp.'));
  Object.assign(TBL.allow, {open: true, note: true, stamp: S.noteRead, fund: false, order: false, need: false});
  refresh();
  for (const id of IDS) addHotspot({id: 'open_' + id, label: tr(`افتح «${nm(id)}»`, `Open “${nm(id)}”`), icon: 'card', pos: () => baseHot(id), modes: ['stand'], when: () => !S.opened[id] && !TBL.busy, use: () => openProposal(id)});
  addHotspot({id: 'note', label: tr('اقرأ التقرير', 'Read the note'), icon: 'memo', pos: () => TB.note.g.getWorldPosition(V(0, 0, 0)).add(V(0, 0.1, 0)), modes: ['stand'], when: () => S.tag !== 'current' && !TBL.busy, use: () => readNote()});
  for (const k of ['current', 'untested']) addHotspot({id: 'stamp_' + k, label: k === 'current' ? tr('ختم: طلب عملاء حالي', 'Stamp: Current customer demand') : tr('ختم: طلب غير مُختبَر', 'Stamp: Untested demand'), icon: 'eye', pos: () => TB.stamps[k].g.position.clone().add(V(0, k === 'current' ? 0.14 : 0.3, 0)), modes: ['stand'], when: () => S.noteRead && S.tag !== 'current' && !TBL.busy, use: () => stampNote(k), dock: true});
  await new Promise(r => { s1done = r; checkS1(); });
  for (const id of IDS) removeHotspot('open_' + id); removeHotspot('note'); removeHotspot('stamp_current'); removeHotspot('stamp_untested');
  S.stage = 2; save();
}

// ---------------------------------------------------------------- spread 2 · allocate what the team can deliver
let s2res = null;
TBL.on.funded = async (id) => {
  caption(tr('[تستقر المكعّبات في مكانها]', '[blocks click into place]'), 2.5);
  await onceAttempt(P[id].fund);
  if (S.a.funded.length === 2 && !(S.a.first && S.a.next)) await onceAttempt('mikael_order');
  needPrompt();
};
TBL.on.refused = async () => { if (!S.refused) { S.refused = true; save(); await line('mikael_refuse'); } };
async function needPrompt() { if (S.a.funded.length && (S.a.funded.length === 1 || (S.a.first && S.a.next)) && !S.a.need) await onceAttempt('ina_need'); }
const onceAttempt = (id) => once(id, {}, S.attempt ? id + '#' + S.attempt : id).catch(() => {});
async function confirmAlloc() {
  if (missing(S.a).length || S.confirmed || TBL.busy) return;
  S.confirmed = true; log('confirm'); save(); refresh();
  announce(tr('أُكّد التوزيع. الرايات مرفوعة على القواعد.', 'Allocation confirmed. Pennants are up on the bases.'));
  const r = showReceipt();
  line('mikael_receipt');
  const v = await r;
  if (v === 'back') { S.confirmed = false; save(); refresh(); announce(tr('عدت إلى الطاولة: التوزيع قابل للتغيير.', 'Back to the table: the allocation can change.')); return; }
  if (s2res) { const f = s2res; s2res = null; f(); }
}
CB.confirm = confirmAlloc;
async function spread2() {
  setStage(1); VIEW.autoTurn = false; allowWalk(true);
  objective(tr('وزّع الوحدات الثماني: اضغطها على قواعد ما ستموّله، ورتّبها، وسمِّ ما ينتظر.', 'Allocate the 8 units: press them onto the bases you fund, order them, and name what waits.'));
  Object.assign(TBL.allow, {open: true, note: true, stamp: false, fund: true, order: true, need: true, cond: false, commit: false});
  S.confirmed = false; refresh();
  addHotspot({id: 'confirm', label: tr('أكّد التوزيع ←', 'Confirm the allocation →'), icon: 'memo', pos: null, modes: ['stand'], when: () => !missing(S.a).length && !S.confirmed && !TBL.busy, use: () => confirmAlloc()});
  await onceAttempt('mikael_alloc');
  await new Promise(r => { s2res = r; });
  removeHotspot('confirm');
  allowWalk(false);
  Object.assign(TBL.allow, {open: false, note: false, fund: false, order: false, need: false});
  S.stage = 3; save();
}

// ---------------------------------------------------------------- spread 3 · explain the sequence
let s3res = null, seatedOnce = false;
TBL.on.cond = async (k) => {
  drawBoard(S.a, {practice: !!S.committed}); drawPitch();
  announce(tr(`شرط المراجعة: ${CONDS.find(c => c.k === k) ? T(CONDS.find(c => c.k === k).t) : ''}`, `Review condition: ${CONDS.find(c => c.k === k) ? T(CONDS.find(c => c.k === k).t) : ''}`));
  await line(condLine(S.a.first, k));
};
CB.pitchChanged = async (what) => {
  if (S.a.condReset && !S.a.cond) { S.a.condReset = false; S.a.condRed = true; syncCards(); drawBoard(S.a, {red: true, practice: !!S.committed}); drawPitch(); save(); await line('victor_first_changed'); return; }
  drawBoard(S.a, {practice: !!S.committed}); drawPitch(); save();
};
TBL.on.ordered = () => { if (STAGE === 2) CB.pitchChanged('order'); else needPrompt(); };
TBL.on.commit = () => commitPitch(true);
CB.commit = () => import('./table.js').then(m => m.commitStamp());
CB.backToTable = () => { if (s3res) { const f = s3res; s3res = null; f('back'); } };
async function commitPitch() {
  if (missing(S.a, {forPitch: true}).length) { announce(missing(S.a, {forPitch: true})[0]); return; }
  const snap = snapshot(S.a);
  const practice = !!S.committed;
  if (practice) S.practice.push(snap); else S.committed = snap;
  log('commit', practice ? 'practice' : 'first'); save();
  drawBoard(S.a, {committed: true, practice});
  caption(tr('[ختم أزرق: مُلتزَم به]', '[a blue stamp: Committed]'));
  show('pitch', false);
  if (s3res) { const f = s3res; s3res = null; f({snap, practice}); }
}
async function spread3() {
  setStage(2);
  objective(tr('اشرح التسلسل لفيكتور: ما يبدأ أولًا، وما ينتظر، وشرط المراجعة.', 'Explain the sequence to Victor: what starts first, what waits, and the review condition.'));
  if (!C.ina.seated) {
    // the one camera move: from the eye to a wide shot of the review table while the three walk over and sit
    const walk = walkToReview(RM());
    await shot('wideReview', 1.8);
    await walk;
  }
  await toSeat(1.4); VIEW.autoTurn = true;
  syncCards(); drawBoard(S.a, {practice: !!S.committed});
  show('pitch', true); drawPitch();
  Object.assign(TBL.allow, {cond: true, commit: true, order: true});
  await line(S.a.funded.length === 1 ? 'victor_single' : 'victor_q');
  const r = await new Promise(res => { s3res = res; });
  Object.assign(TBL.allow, {cond: false, commit: false, order: false});
  if (r === 'back') { show('pitch', false); S.stage = 2; S.confirmed = false; save(); return 'back'; }
  await line('player_pitch');
  await line('victor_commit');
  await showCoach(r.snap, r.practice ? tr('إلى البطاقة الأخيرة ←', 'To the final card →') : tr('إلى الأرشيف ←', 'To the archive →'));
  S.stage = r.practice ? 5 : 4; save();
  return r.practice ? 'practice' : 'first';
}

// ---------------------------------------------------------------- spread 4 · open the real turnaround
/** close to one archive panel: it fills the side of the screen the reading card leaves free */
async function toPanel(i, dur = 1.3) {
  place('wall');
  const p = panelWorld(panelSlot(i)), side = EN ? -1 : 1;          // Arabic: the card is on the left, so the panel sits right of centre
  const eye = V(ARCH.x - 2.05, p.y + 0.02, p.z - side * 0.22), look = V(ARCH.x, p.y + 0.03, p.z - side * 0.72);
  await eyeAt('seat', eye, look, {dur: RM() ? 0 : dur, fov: 50, yawRange: 0.45, pitch: [-0.35, 0.3]});
}
async function spread4({again = false} = {}) {
  setStage(3); show('pitch', false);
  objective(tr('افتح الأرشيف الحقيقي على الحائط وقارن.', 'Open the real archive on the wall and compare.'));
  await toWall(RM() ? 0 : 1.8);
  openArchive(1); SND.doors(); caption(tr('[تنفتح أبواب الأرشيف]', '[the archive doors roll open]'));
  await wait(RM() ? 0.2 : 1.6);
  for (let i = 0; i < 3; i++) {
    showPanels(i + 1);
    toPanel(i, i ? 1.1 : 1.4);
    let next; const go = new Promise(r => next = r);
    archiveCard(i, {onNext: () => next()});
    if (!again || !S.archiveSeen) line(['nar_archive1', 'nar_archive2', 'nar_archive3'][i]);
    await go; await chain;
  }
  show('archive', false);
  S.archiveSeen = true; save();
  if (!again) { await runChecks(); await line('victor_end'); }
  S.stage = 5; save();
}

// ---------------------------------------------------------------- the final card and after
async function finalLoop() {
  for (;;) {
    if (document.body.dataset.place !== 'wall') await toWall(RM() ? 0 : 1.2);
    showPanels(3); openArchive(1);
    setStage(3);
    const v = await finalCard();
    if (v === 'archive') { await spread4({again: true}); continue; }
    if (v === 'over') { clearAll(); location.href = location.pathname + location.search; return; }
    // a practice attempt: back to the worktable with the bases emptied (the proposals stay opened, the note stamped)
    resetAllocation(); S.attempt += 1; S.stage = 2; save();
    await fade(true, 300); syncTable(); syncCards(); openArchive(0, true); showPanels(0); await toEye(0); await fade(false, 400);
    let r;
    do { await spread2(); r = await spread3(); if (r === 'back') { await toEye(1.2); } } while (r === 'back');
  }
}

// ---------------------------------------------------------------- run
export async function run(mode = null) {
  startSound();
  setupTable(); setupReview();
  addHotspot({id: 'backtable', label: tr('عُد إلى طاولة العمل', 'Back to the worktable'), icon: 'seat', pos: () => V(WT.x, WT.y + 0.35, WT.z + WT.d / 2), modes: ['stand'], when: () => WALK.on && !nearTable() && !TBL.busy, use: () => toEye(1.0)});
  addEventListener('keydown', (e) => { if (e.code === 'KeyL' && !e.repeat && !(e.target.closest && e.target.closest('input,textarea')) && (STAGE === 0 || STAGE === 1)) toggleList(); });
  $('listbtn').onclick = () => { if (STAGE === 0 || STAGE === 1) toggleList(); };
  syncTable();
  const dev = Q.get('dev');
  if (dev) applyDev(dev);
  if (mode === 'review' && S.committed) {
    placeReview(); setTableProps(); hud(true); ledgerOn(true); await fade(false, 500);
    S.stage = 5; await finalLoop(); return;
  }
  if (S.stage === 0) { await opening(); }
  else {
    setTableProps();
    if (S.stage >= 3) placeReview(); else placeOpening();
    hud(true); ledgerOn(true);
    if (S.stage >= 4) { await toWall(0); } else if (S.stage === 3) { await toSeat(0); } else await toEye(0);
    await fade(false, 600);
  }
  if (S.stage === 1) await spread1();
  for (;;) {
    if (S.stage === 2) { if (VIEW.mode !== 'stand') await toEye(1.2); await spread2(); }
    if (S.stage === 3) { const r = await spread3(); if (r === 'back') { await toEye(1.3); continue; } if (r === 'practice') break; }
    if (S.stage === 4) await spread4();
    break;
  }
  await finalLoop();
}
/** ?dev=s1 | s2 | s3 | s4 | final — jump to a spread with a made-up state (QA) */
function applyDev(d) {
  const all = () => { for (const id of IDS) S.opened[id] = true; S.noteRead = true; S.tag = 'current'; S.firstTag = 'untested'; Object.keys(LINES).forEach(k => { if (/^q_|^mikael_task|^mikael_alloc$/.test(k)) S.said[k] = true; }); };
  if (d === 's1') { S.stage = 1; }
  if (d === 's2') { all(); S.stage = 2; }
  if (d === 's3' || d === 's4' || d === 'final') { all(); S.a = {funded: ['core', 'delivery'], first: 'core', next: 'delivery', need: 'theme', cond: null, condFor: null}; S.confirmed = true; S.stage = 3; }
  if (d === 's4' || d === 'final') { S.a.cond = 'core'; S.a.condFor = 'core'; S.committed = snapshot(S.a); S.stage = d === 's4' ? 4 : 5; S.archiveSeen = d === 'final'; }
  syncTable();
}
