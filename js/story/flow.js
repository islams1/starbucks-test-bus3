// Scene director: S1 arrival → S2 lobby → S3 office → S4 secretary → S5 meeting → S6 plans → S7 result → S8 debrief.
import * as THREE from 'three';
import {camera, onUpdate, wait, grade, clock, damp, renderer} from '../core/engine.js';
import {setInput, onKey} from '../core/input.js';
import {playVoice, sfx, setEnvironment, startAmbience, setAmbienceLevel} from '../core/audio.js';
import * as cine from '../core/cine.js';
import {characters} from '../actors/character.js';
import {player, setPlayerMode, teleport, insideBuilding} from '../actors/player.js';
import {anchors, roomAt, screens} from '../world/building.js';
import {sunFollow, interior} from '../world/lighting.js';
import {callOn} from '../world/cafe.js';
import {subtitle, hideSubtitle, choose, toast, objective, setClock, fade, letterbox, hud, $, show, prompt} from '../ui/ui.js';
import {addHotspot, markDone, setDeskMode, setHotspotsBusy, hotspots} from '../ui/hotspots.js';
import * as D from '../ui/docs.js';
import {briefDoc, boardSortDoc, FIELDS as BRIEF_FIELDS} from '../ui/brief.js';
import {initDeskHands, deskBody, pick, openLaptop} from '../actors/deskhands.js';
import {buildPerformance} from '../actors/performance.js';
import {mapState} from '../ui/map.js';
import {S, gain, has, log, setNode, advance, onClock, evaluateEnding, computeBrief} from './state.js';
import {sit, stand, startBackground} from './cast.js';
import {showPlans, tensionButtons, showResult, showDebrief} from './endings.js';

let LINES = null, SPK = null;
const C = characters;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const practice = () => S.mode === 'practice';

// ---------------------------------------------------------------- dialogue helpers
// listeners react to what they hear (face + head), so a conversation never looks like a recording
const REACTION = {shocked: 'surprise', disappointed: 'worry', sad: 'worry', hurt: 'worry', worried: 'worry', annoyed: 'worry', tense: 'worry',
  excited: 'smile', happy: 'smile', proud: 'smile', pleased: 'smile', relieved: 'smile', warm: 'smile', confident: 'nod', firm: 'nod', pushy: 'skeptical', casual: 'skeptical', unsure: 'skeptical'};
function listenersReact(speaker, emo) {
  const r = REACTION[emo]; if (!r || !speaker) return;
  const sp = speaker.holder.position;
  for (const c of [player.ch, ...Object.values(C)]) {
    if (!c || c === speaker || !c.holder.visible || c.holder.position.distanceTo(sp) > 7) continue;
    setTimeout(() => c.react(Math.random() < 0.35 && r !== 'surprise' ? 'nod' : r), 400 + Math.random() * 900);
  }
}
// one voice at a time: every line waits for the previous one to finish (no two people talking over each other)
let lineChain = Promise.resolve(); let lineActive = 0;
function line(id, opt = {}) {
  const run = lineChain.then(() => { lineActive++; return lineImpl(id, opt); }).finally(() => { lineActive--; });
  lineChain = run.catch(() => {});
  return run;
}
async function lineImpl(id, {cam = null, gesture = true} = {}) {
  const L = LINES[id]; if (!L) { console.warn('line?', id); return; }
  const sp = SPK[L.s]; const url = `assets/vo/ar/${id}`;
  const words = await fetch(url + '.json').then(r => r.ok ? r.json() : []).catch(() => []);
  const who = L.s === 'player' ? player.ch : C[L.s];
  if (cam) await cam(who);
  let timeFn = () => 0;
  if (who && who !== C.hana) {
    listenersReact(who, L.e);
    // what is being referred to when someone says "look at this…"
    const near = (x, z, r) => who.holder.position.distanceTo(new THREE.Vector3(x, 0, z)) < r;
    const pointTarget = S.scene === 'meeting' ? V3(4.85, 1.6, -9.5) : near(-17.8, -2.6, 6) ? V3(-17.8, 1.5, -2.6) : null;
    const perf = buildPerformance(L.t, words, {speakerId: L.s, emotion: L.e, seated: !!who.seated, pointTarget});
    perf.pointTarget = pointTarget;
    const p = who.say(url, {gesture, emotion: L.e, perf});
    await new Promise(r => { const t = () => who.voice ? (timeFn = who.voice.time, r()) : requestAnimationFrame(t); t(); setTimeout(r, 1500); });
    subtitle(sp.name, sp.role, L.t, words, () => timeFn());
    await p;
  } else {
    const radio = L.s === 'hana' || L.s === 'ruth';
    if (who === C.hana) { const perfH = buildPerformance(L.t, words, {speakerId: 'hana', emotion: L.e, seated: false, pointTarget: null}); const p = who.say(url, {getPos: () => null, radio: true, emotion: L.e, perf: perfH}); await new Promise(r => { const t = () => who.voice ? (timeFn = who.voice.time, r()) : requestAnimationFrame(t); t(); setTimeout(r, 1500); }); subtitle(sp.name, sp.role, L.t, words, () => timeFn()); await p; }
    else { const v = await playVoice(url + '.mp3', null, {radio}); subtitle(sp.name, sp.role, L.t, words, v.time); await v.done; }
  }
  await wait(0.25);
  hideSubtitle();
}
/** choice where each option is a player voice line. opts: [{id(line), key, disabled?, need?}] */
async function ask(opts, {q = '', hint = null} = {}) {
  const o = await choose(q, opts.map(x => ({...x, text: x.text || LINES[x.id].t})), {hint: practice() ? hint : null});
  if (!o.silent) await line(o.id, {cam: o.cam});
  return o.key || o.id;
}
// framing presets
const camOTS = (other) => (who) => who === player.ch ? cine.ots(player.ch, other, {side: -1, dur: 0.6}) : cine.ots(who, player.ch, {side: 1, dur: 0.6});
const camClose = (who) => cine.closeup(who, {dist: 1.35, yawOff: (Math.random() - 0.5) * 0.7, fov: 30, dur: 0.7});
// meeting: speakers are framed over the player's shoulder so they face the lens; the player is framed from across the table
let otsSide = 1;
const camMeet = (who) => {
  if (who === player.ch) return cine.closeup(player.ch, {dist: 1.45, yawOff: 0.22, fov: 30, dur: 0.7});
  otsSide = -otsSide;
  const far = who.holder.position.distanceTo(player.ch.holder.position);
  return cine.ots(who, player.ch, {side: otsSide, dist: 0.5, height: 0.05, fov: far > 3.5 ? 24 : 30, dur: 0.7});
};

function waitUntil(fn) { return new Promise(res => { const off = onUpdate(() => { if (fn()) { off(); res(); } }); }); }
function lockControls() { setInput(false); setPlayerMode('cine'); hud(true); }
function freeControls() { setPlayerMode('free'); setInput(true, true); cine.stop(); }

// ---------------------------------------------------------------- checkpoints (restart from node)
function checkpoint(scene) { try { sessionStorage.setItem('bus3_cp', JSON.stringify({scene, S})); } catch (e) {} }
export function restartFromCheckpoint() { location.href = location.pathname + location.search.replace(/[?&]resume=1/, '') + (location.search ? '&' : '?') + 'resume=1'; }

// ---------------------------------------------------------------- environment tracking
let lastRoom = null, inside = false;
onUpdate(() => {
  if (!player.ch || !player.ch.holder.visible) return;
  const p = player.ch.holder.position;
  const ins = insideBuilding(p.x, p.z);
  if (ins !== inside) { inside = ins; setEnvironment(ins, 0.5); sunFollow(ins ? V3(0, 0, -2) : V3(p.x, 0, p.z - 6), ins ? 30 : 45); }
  if (!ins && player.mode === 'free') sunFollow(V3(p.x, 0, p.z - 6), 45);
  lastRoom = roomAt(p.x, p.z);
});
// eye adaptation: daylight outside is far brighter than the office interior
const _fogIn = new THREE.Color(0x9a8064), _fogOut = new THREE.Color(0xcbd6e0);
onUpdate((dt) => {
  const camIn = insideBuilding(camera.position.x, camera.position.z) && camera.position.y < 3.2;
  renderer.toneMappingExposure = damp(renderer.toneMappingExposure, camIn ? 1.0 : 0.62, 1.2, dt);
  const f = camera.parent && camera.parent.fog;
  if (f && f.isFogExp2) { f.density = damp(f.density, camIn ? 0.0075 : 0.0028, 2, dt); f.color.lerp(camIn ? _fogIn : _fogOut, 1 - Math.exp(-2 * dt)); }
});
onClock(m => setClock(m));

// ================================================================= S1 — arrival
async function sceneArrival() {
  checkpoint('arrival');
  lockControls(); letterbox(true); hud(false);
  teleport(1.2, 31, Math.PI); player.ch.setBase('m_idle_neutral_02');
  objective('ادخل مبنى المكتب الإقليمي');
  sunFollow(V3(0, 0, 10), 60);
  let skip = false; const sk = () => skip = true; onKey('Space', sk);
  camera.position.set(-70, 150, 140); camera.lookAt(0, 0, 0);
  await fade(false, 1500);
  const flight = cine.fly([[-70, 150, 140], [10, 110, 120], [55, 60, 80], [40, 22, 52], [18, 7, 40], [5.5, 2.4, 35.2]],
    (k) => k < 0.75 ? V3(0, 10 - k * 8, 0) : V3(1.5, 1.5, 22).lerp(V3(0.5, 1.7, 10), (k - 0.75) * 2), 17, {fov: 46, fov1: 52});
  setTimeout(() => !skip && player.ch.walkTo([[0.4, 24.5]], {speed: 1.3}), 11500);
  await Promise.race([flight, waitUntil(() => skip)]);
  onKey('Space', () => {});
  if (skip) { player.ch.walking = null; teleport(0.4, 24.5, Math.PI); }
  player.ch.walking = null; player.ch.play(player.ch.baseName);
  letterbox(false); hud(true);
  player.yaw = Math.PI; player.pitch = 0.12;
  freeControls();
  toast('<b>تلميح</b> — استخدم <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> للحركة و<kbd>M</kbd> للخريطة', '');
  mapState.target = {x: 0, z: 9};
}

// ================================================================= S2 — lobby: Omar
async function sceneLobby() {
  checkpoint('lobby');
  objective('ادخل المبنى — عمر صالح بانتظارك في الاستقبال');
  mapState.target = {x: anchors.lobbyOmar.x, z: anchors.lobbyOmar.z};
  const pp = () => player.ch.holder.position;
  await waitUntil(() => pp().z < 9.6 && insideBuilding(pp().x, pp().z));
  // receptionist greets
  C.reception.lockLook = true; C.reception.lookAt(player.ch);
  const greet = line('reception_1', {gesture: true});
  await waitUntil(() => pp().distanceTo(C.omar.holder.position) < 6.2 || pp().z < 6.5 && insideBuilding(pp().x, pp().z));
  await greet;            // let the receptionist finish before Omar starts talking
  await wait(0.4);
  // Omar walks up to the player
  lockControls(); C.omar.lockLook = true;
  const p = pp(), o = C.omar.holder.position; const dir = p.clone().sub(o).setY(0).normalize();
  const meet = p.clone().addScaledVector(dir, -1.15);
  { // side-on two-shot from inside the lobby
    const mid = p.clone().add(o).multiplyScalar(0.5); const perp = V3(-(p.z - o.z), 0, p.x - o.x).normalize(); if (perp.z > 0) perp.negate();
    const cp = mid.clone().addScaledVector(perp, 3.0); cp.y = 1.65; cp.z = Math.min(cp.z, 8.8); cp.x = Math.max(-4.4, Math.min(4.4, cp.x));
    cine.shot(cp, () => C.omar.headPos().clone().lerp(player.ch.headPos(), 0.5), 1.4, {fov: 40});
  }
  player.ch.faceTo(o.x, o.z); player.ch.play(player.ch.baseName);
  await C.omar.walkTo([[meet.x, meet.z]], {speed: 1.2});
  C.omar.faceTo(p.x, p.z); player.ch.faceTo(C.omar.holder.position.x, C.omar.holder.position.z);
  C.omar.lookAt(player.ch); player.ch.lookAt(C.omar);
  C.omar.mood.frown = 0.25; C.omar.mood.worry = 0.3;
  const cam = camOTS(C.omar);
  await line('omar_l1', {cam});
  const a = await ask([{id: 'p_lobby_a', cam}, {id: 'p_lobby_b', cam}]);
  setNode('LOBBY', a);
  await line('omar_l2', {cam});
  await line('omar_l3', {cam});
  await line('omar_l4', {cam});
  advance(30);
  C.omar.mood.frown = 0.1; C.omar.lockLook = false; player.ch.lookAt(null);
  // Omar heads to the break room (on his way to the 24 stores' schedules)
  C.omar.walkTo([[-1, -2.5], [7, -3], [11.5, -10.5]], {speed: 1.15}).then(() => { C.omar.faceTo(11.5, -14); });
  freeControls();
  objective('اذهب إلى مكتبك في الجناح الشرقي (عبر السكرتارية)');
  mapState.target = {x: 15, z: 4.5};
  toast('مكتبك: الممر ← السكرتارية ← مكتب «مسؤول التسويق». اضغط <kbd>M</kbd> لرؤية الخريطة.');
}

// ================================================================= S3 — office (desk mode, docs, N01–N03, N05, N06)
let seated = false;
function deskCam() {
  // fixed, steady view over the desk (no mouse drift)
  cine.hold(V3(16.2, 1.32, 4.5), V3(14.9, 0.66, 4.5), {fov: 58});
  return () => {};
}
let offDeskCam = null;
async function sitAtDesk() {
  lockControls();
  const st = anchors.officeSeat;
  await player.ch.walkTo([[st.x - 0.75, st.z - 0.55], [st.x - 0.2, st.z]], {speed: 1.2});
  sit(player.ch, st, {anim: 'm_sit_table_idle_neutral_01'});
  await cine.shot(V3(16.2, 1.32, 4.5), V3(14.9, 0.66, 4.5), 1.1, {fov: 58});
  deskBody(true);
  offDeskCam = deskCam();
  seated = true; setDeskMode(true); setInput(true, false);
  objective(officeObjective());
}
async function standFromDesk() {
  if (offDeskCam) offDeskCam(); offDeskCam = null;
  seated = false; setDeskMode(false); deskBody(false);
  player.ch.fbx.visible = true; player.ch.seated = false;
  stand(player.ch, anchors.officeSeat.x - 0.55, anchors.officeSeat.z - 0.6, -Math.PI / 2, 'm_idle_neutral_02');
  player.yaw = -Math.PI / 2;
  freeControls();
}
function officeObjective() {
  const left = [];
  if (!S.tasks.research) left.push('بحث الشرائح');
  if (!S.ev.M10) left.push('ورقة الميزانية');
  if (!left.length && S.nodes.N02 && !S.briefBuilt) return 'ابنِ موجز الحملة على التابلت: اسحب الأدلة إلى الحقول';
  return left.length ? `مهام مالية على مكتبك: ${left.join(' + ')}` : 'استكمل ما تحتاجه قبل الاجتماع (اختياري: لوحة البيانات، الدليل، الشراكة، السيناريو، جريس)';
}
function deskItem(id, label, icon, fn, minutes = 20, {manual = false} = {}) {
  const it = anchors.deskItems[id];
  addHotspot({id: 'desk_' + id, label, icon, desk: true, deskOnly: true, pos: V3(it.x, it.y + 0.06, it.z), use: async () => {
    if (id === 'laptop' || manual) await fn(); else { const putBack = await pick(anchors.deskObjs[id], {open: id === 'folder' || id === 'booklet'}); await fn(); await putBack(); }
    docsRead++; advance(minutes); markDone('desk_' + id); objective(officeObjective()); await officeEvents(); }});
}

async function hanaCall() {
  if (S.nodes.N03) { toast('تحدثت مع هنا بالفعل.'); return; }
  sfx.ring(); await wait(2.4);
  callOn(true);
  const h = C.hana; h.setBase('f_idle_neutral_02'); h.lookAt(V3(0.15, 1.58, 1.55));
  await line('hana_n03');
  const k = await ask([{id: 'p_n03_ask', key: 'ask'}, {id: 'p_n03_promise', key: 'promise'}, {key: 'skip', text: '(إنهاء المكالمة)', silent: true}], {hint: 'ماذا تحتاج الفروع لتفي بوعد الحملة الساعة الثامنة صباحًا؟'});
  setNode('N03', k);
  if (k === 'ask') { await line('hana_n03_ask'); S.ops_checked = true; gain('M3'); }
  else if (k === 'promise') { await line('hana_n03_promise'); S.ops_checked = false; }
  await wait(0.4); callOn(false); advance(30);
}

async function scriptWithChoices(putBack = null) {
  const html = D.scriptDoc();
  let pick = null;
  await D.openDoc(html + `<div style="display:flex;gap:10px;margin-top:12px;justify-content:center;flex-wrap:wrap" class="n05">
      <button class="primary" data-k="call">📞 اتصل بالسيدة بيل واطلب موافقتها</button><button class="ghost" data-k="keep">أبقِ السيناريو كما هو</button><button class="ghost" data-k="drop">ألغِ فكرة الفيلم</button></div>`,
    (el, close) => el.querySelectorAll('.n05 button').forEach(b => b.onclick = () => { pick = b.dataset.k; close(); }));
  if (putBack) await putBack();
  if (!pick || S.nodes.N05) return;
  setNode('N05', pick);
  if (pick === 'call') { await phoneCall(); S.consent = 'planned'; toast('<b>تم</b> — الفيلم يمكن أن يستمر بممثلين، مع نموذج موافقة مكتوب.'); advance(30); }
  else if (pick === 'keep') { await line('p_n05_keep'); S.consent = 'missing'; S.idea = 'film'; }
  else { await line('p_n05_drop'); S.consent = 'not_needed'; }
}

async function nadiaVisit(lines) {
  setHotspotsBusy(true);
  const n = C.nadia; n.seated = false;
  n.place(10.4, 1.8, Math.PI / 2); n.setBase('f_idle_neutral_01');
  sfx.knock();
  await n.walkTo([[12.4, 2.4], [13.75, 4.2]], {speed: 1.15});
  n.faceTo(16.4, 4.5); n.lookAt(player.ch); n.lockLook = true;
  const look = () => n.headPos();
  cine.shot(V3(16.4, 1.24, 4.6), look, 0.9, {fov: 33});
  await wait(0.6);
  await lines();
  await n.walkTo([[12.3, 2.3], [10.0, 1.8]], {speed: 1.2}); n.hide(); n.lockLook = false;
  if (seated) { offDeskCam && offDeskCam(); offDeskCam = deskCam(); }
  setHotspotsBusy(false);
}

async function nodeN01() {
  await nadiaVisit(async () => {
    const cam = null;
    await line('nadia_n01');
    for (;;) {
      const segOk = S.ev.M1 && S.ev.M2;
      const k = await ask([
        {id: 'p_n01_a', key: 'A'}, {id: 'p_n01_c', key: 'C'}, {id: 'p_n01_b', key: 'B'}, {id: 'p_n01_d', key: 'D'}, {id: 'p_n01_all', key: 'all'},
      ], {hint: 'من يزور أكثر، ومن ماذا يشكو؟' + (segOk ? '' : ' (الأرقام في ملف البحث الأزرق)')});
      S.segmentTries++;
      if (k === 'A') { S.segment = 'A'; await line('nadia_n01_a'); const f = await ask([{id: 'nadia_n01_a_first_weekday', key: 'weekday'}, {id: 'nadia_n01_a_first_weekend', key: 'weekend'}]); S.firstJob = f; await line('nadia_n01_a_end'); }
      else if (k === 'C') { S.segment = 'C'; await line('nadia_n01_c'); }
      else if (k === 'B' || k === 'D') {
        S.segment = k; await line('nadia_n01_bd');
        const v = await ask([{id: k === 'B' ? 'p_n01_val_ok_b' : 'p_n01_val_ok_d', key: 'ok'}, {id: 'p_n01_val_bad', key: 'bad'}], {hint: 'القيمة ≈ نسبة الزيارات × متوسط الإنفاق'});
        await line(v === 'ok' ? 'nadia_n01_val_ok' : 'nadia_n01_val_bad');
      } else {
        S.segment = 'everyone'; await line('nadia_n01_all');
        if (S.segmentTries < 2) continue;      // "Try again" — one more chance, then it stays (QA-07)
      }
      setNode('N01', k === 'all' ? 'all' : k);
      break;
    }
    advance(30);
    await line('nadia_leave');
  });
}

async function nodeN02() {
  setHotspotsBusy(true);
  const r = C.ryan; r.seated = false;
  r.place(10.4, 1.8, Math.PI / 2); r.setBase('m_idle_neutral_03');
  sfx.knock();
  await r.walkTo([[12.4, 2.4], [13.6, 3.7]], {speed: 1.3});
  r.faceTo(16.4, 4.5); r.lookAt(player.ch); r.lockLook = true;
  cine.shot(V3(16.4, 1.24, 4.6), () => r.headPos(), 0.9, {fov: 33});
  await line('ryan_n02');
  const ready = S.ev.M5 && S.ev.M10;
  const k = await ask([
    {id: 'p_n02_sound', key: 'sound', disabled: !ready, need: ready ? null : 'تحتاج: كتيّب الدليل + ورقة الميزانية'},
    {id: 'p_n02_accept', key: 'accept'}, {id: 'p_n02_weak', key: 'weak'}, {id: 'p_n02_later', key: 'later'},
  ], {hint: 'ماذا يقول الدليل عن الحملات القائمة على السعر؟ وكم تستهلك من الميزانية؟'});
  if (k === 'sound') { gain('M5'); gain('M10'); await line('ryan_n02_sound1'); await line('p_n02_sound2'); await line('ryan_n02_sound2'); S.measureRequired = true; r.mood.frown = 0.2; }
  else if (k === 'accept') { S.price_led = true; S.idea = 'discount'; await line('ryan_n02_accept'); r.mood.smile = 0.6; }
  else if (k === 'weak') { await line('ryan_n02_weak'); r.mood.frown = 0.4; }
  else { await line('ryan_n02_later'); n02LaterAt = docsRead; }
  if (k !== 'later') { setNode('N02', k); advance(30); }
  await r.walkTo([[12.3, 2.3], [10.0, 1.8]], {speed: 1.3}); r.lockLook = false;
  stagedRyan();
  if (seated) { offDeskCam && offDeskCam(); offDeskCam = deskCam(); }
  setHotspotsBusy(false);
}
function stagedRyan() { const r = C.ryan, a = anchors.ryanPhone; r.mood.smile = 0; r.mood.frown = 0; stand(r, a.x, a.z, a.ry, 'm_cell_phone_talk_01'); }


// ---------------------------------------------------------------- physical actions (the player does things, not only talks)
/** turn toward a target and play a short hands/eyes action before opening something */
async function look(target, anim = 'm_documents_check') {
  if (seated || player.mode !== 'free') return;
  lockControls();
  const ch = player.ch; ch.faceTo(target.x, target.z); ch.lookAt(target);
  ch.gesture(anim, {fade: 0.25});
  await wait(1.1);
  ch.lookAt(null); freeControls();
}
/** Mrs Bell: stand at the window, call from the mobile, listen to the voicemail, sit back down */
async function phoneCall() {
  setHotspotsBusy(true); lockControls();
  if (offDeskCam) offDeskCam(); offDeskCam = null; setDeskMode(false); seated = false; deskBody(false);
  const ch = player.ch; ch.fbx.visible = true; ch.seated = false;
  stand(ch, 16.6, 5.4, Math.PI * 0.2, 'm_idle_neutral_02');
  cine.shot(V3(14.2, 1.5, 7.3), () => ch.headPos(), 0.8, {fov: 40});
  await ch.walkTo([[17.25, 6.9]], {speed: 1.0});
  ch.faceTo(18.5, 7.4);
  await line('p_n05_call');
  ch.setBase('m_cell_phone_listen_01', {fade: 0.5});
  cine.hold(() => V3(15.9, 1.62, 8.2), () => ch.headPos(), {fov: 34});
  sfx.ring(); await wait(2.4);
  toast('رسالة صوتية من السيدة روث بيل');
  ch.emote('gentle');
  await line('ruth_n05');
  await wait(0.4);
  ch.setBase('m_idle_neutral_02', {fade: 0.5});
  await ch.walkTo([[anchors.officeSeat.x - 0.2, anchors.officeSeat.z]], {speed: 1.1});
  sit(ch, anchors.officeSeat, {anim: 'm_sit_table_idle_neutral_01'});
  await cine.shot(V3(16.2, 1.32, 4.5), V3(14.9, 0.66, 4.5), 0.9, {fov: 58});
  deskBody(true); seated = true; setDeskMode(true); setInput(true, false);
  offDeskCam = deskCam(); setHotspotsBusy(false);
}
/** break room: make an espresso and drink it (optional, small life moment) */
async function makeCoffee() {
  lockControls(); setHotspotsBusy(true);
  const ch = player.ch;
  cine.shot(V3(12.4, 1.65, -11.0), () => ch.headPos(), 1.0, {fov: 40});
  await ch.walkTo([[10.25, -12.55]], {speed: 1.1});
  ch.faceTo(10.2, -14); ch.lookAt(V3(10.2, 1.1, -13.5));
  ch.gesture('m_documents_take', {fade: 0.3}); sfx.steam();
  await wait(3.0);
  ch.lookAt(null); ch.faceTo(12, -10);
  ch.setBase('m_drink_idle', {fade: 0.5}); await wait(1.2);
  await ch.gesture('m_drink_drinking', {fade: 0.3});
  S.coffee = true; advance(10); markDone('coffee');
  toast('☕ استراحة قصيرة — قهوة من آلة المكتب');
  await wait(0.5); ch.setBase('m_idle_neutral_02', {fade: 0.6});
  setHotspotsBusy(false); freeControls();
}
// ---------------------------------------------------------------- meeting presentation (clicker + slides)
function wrapRTL(g, text, x, y, maxW, lh) { const words = text.split(' '); let lineTxt = ''; for (const w of words) { const t = lineTxt ? lineTxt + ' ' + w : w; if (g.measureText(t).width > maxW && lineTxt) { g.fillText(lineTxt, x, y); y += lh; lineTxt = w; } else lineTxt = t; } if (lineTxt) g.fillText(lineTxt, x, y); }
function drawSlide(n, title, body, evid) {
  screens.meeting.draw((g, W, H) => {
    g.fillStyle = '#f4efe6'; g.fillRect(0, 0, W, H); g.fillStyle = '#1f5e47'; g.fillRect(0, 0, W, 120);
    g.fillStyle = '#fff'; g.font = '700 56px "IBM Plex Sans Arabic"'; g.textAlign = 'right'; g.direction = 'rtl'; g.fillText(title, W - 60, 80);
    g.direction = 'ltr'; g.font = '600 30px Inter'; g.textAlign = 'left'; g.fillText(n + ' / 4', 50, 75); g.direction = 'rtl';
    g.fillStyle = '#26332d'; g.font = '500 44px "IBM Plex Sans Arabic"'; g.textAlign = 'right'; wrapRTL(g, body || '—', W - 70, 230, W - 160, 64);
    if (evid && evid.length) { g.font = '600 30px "IBM Plex Sans Arabic"'; g.fillStyle = '#8a6d2e'; g.fillText('الأدلة: ' + evid.join(' · '), W - 70, H - 60); }
  });
}
function briefText(k) { const f = {insight: 0, idea: 1, ops: 2, measure: 3, risk: 4}[k]; const b = S.brief || {}; const opts = BRIEF_FIELDS[f].opts(); const o = opts.find(x => x[0] === b[k]); return o ? o[1] : 'لم تُكتب في الموجز'; }
async function clicker(label) {
  const el = document.createElement('div'); el.id = 'clicker'; el.innerHTML = `<kbd>E</kbd> اعرض الشريحة: ${label}`; document.body.appendChild(el);
  await new Promise(res => { const go = () => { removeEventListener('keydown', kd); el.remove(); res(); }; const kd = (e) => { if (e.code === 'KeyE' || e.code === 'Space') go(); }; addEventListener('keydown', kd); el.onclick = go; });
  sfx.ui();
}
/** frame the presenter beside the screen so the new slide is readable */
async function slideShot() { player.ch.gesture('m_gestic_presentation_right_01', {fade: 0.3}); await cine.shot(V3(-0.6, 1.55, -8.2), V3(4.5, 1.55, -9.35), 0.9, {fov: 44}); await wait(2.2); }
const presCam = () => cine.closeup(player.ch, {dist: 2.2, yawOff: 0.35, height: -0.1, fov: 34, dur: 0.8});
async function presentStart() {
  const ch = player.ch, N = C.nadia, seat = anchors.meetSeats[SEAT.player];
  cine.shot(V3(-3.2, 2.0, -6.4), V3(1.5, 1.0, -9.2), 1.2, {fov: 48});
  ch.seated = false; stand(ch, seat.x, seat.z + 0.55, Math.PI, 'm_idle_neutral_01');
  N.walkTo([[3.9, -12.1]], {speed: 1.0}).then(() => N.faceTo(0, -9.5));
  await ch.walkTo([[seat.x + 0.2, -7.55], [2.9, -7.6], [3.35, -8.9]], {speed: 1.15});
  ch.faceTo(-2, -9.3); ch.presenting = true;
  for (const id of ['ryan', 'mei', 'omar', 'grace']) C[id].lookAt(ch);
  N.lookAt(ch); ch.lookAt(C.nadia);
}
async function presentEnd() {
  const ch = player.ch, N = C.nadia, seat = anchors.meetSeats[SEAT.player];
  ch.presenting = false;
  cine.shot(V3(-3.2, 2.0, -6.4), V3(1.5, 1.0, -9.2), 1.0, {fov: 48});
  await ch.walkTo([[2.9, -7.6], [seat.x + 0.2, -7.55], [seat.x, seat.z + 0.5]], {speed: 1.15});
  sit(ch, seat);
  await N.walkTo([[anchors.nadiaMeet.x, anchors.nadiaMeet.z]], {speed: 1.0}); N.holder.rotation.y = anchors.nadiaMeet.ry;
}
/** put the option chosen in the brief first, tagged */
function fromBrief(opts, k) {
  const b = S.brief && S.brief[k]; if (!b) return opts;
  const o = opts.map(x => x.key === b ? {...x, tagline: 'من موجزك ✓'} : x);
  return [...o.filter(x => x.key === b), ...o.filter(x => x.key !== b)];
}

let n01Done = false, n02Busy = false, secretaryCalled = false, standCount = 0, docsRead = 0, n02LaterAt = -1;
async function officeEvents() {
  if (seated && !n01Done && S.tasks.research) { n01Done = true; await nodeN01(); }
  if (seated && n01Done && !S.nodes.N02 && !n02Busy && docsRead > n02LaterAt && (S.ev.M5 && S.ev.M10 || standCount > 0 && S.ev.M10)) { n02Busy = true; await nodeN02(); n02Busy = false; }
  if (seated && !secretaryCalled && S.tasks.research && S.ev.M10 && S.nodes.N01 && S.nodes.N02 && S.briefBuilt) { secretaryCalled = true; setTimeout(() => secretaryScene(), 9000); }
}

async function nodeN06() {
  if (S.nodes.N06) return;
  lockControls();
  const g = C.grace; g.lockLook = true; g.faceTo(player.ch.holder.position.x, player.ch.holder.position.z); g.lookAt(player.ch);
  player.ch.faceTo(g.holder.position.x, g.holder.position.z); player.ch.lookAt(g);
  const cam = camOTS(g);
  await line('grace_n06', {cam});
  const ready = S.ev.M9;
  const k = await ask([{id: 'p_n06_sep', key: 'sep', disabled: !ready, need: ready ? null : 'تحتاج: مقترح الشراكة (الظرف الرمادي على مكتبك)'}, {id: 'p_n06_center', key: 'center'}, {id: 'p_n06_no', key: 'no'}],
    {hint: 'متى تكون الشريحة المستهدفة في المول؟'});
  setNode('N06', k); advance(30);
  if (k === 'sep') { gain('M9'); await line('grace_n06_sep', {cam}); g.mood.smile = 0.3; }
  else if (k === 'center') { S.idea = 'partnership'; await line('grace_n06_center', {cam}); g.mood.smile = 0.7; }
  else { await line('grace_n06_no', {cam}); g.mood.frown = 0.4; }
  g.lockLook = false; player.ch.lookAt(null);
  markDone('grace');
  freeControls();
}

function setupOfficeHotspots() {
  deskItem('folder', 'ملف الأبحاث', 'folder', () => D.researchDoc());
  deskItem('laptop', 'اللابتوب — لوحة البيانات', 'laptop', async () => { await openLaptop(); let call = false; await D.dashboardDoc({onCall: () => call = true}); if (call) await hanaCall(); });
  deskItem('booklet', 'دليل العلامة', 'book', () => D.bookletDoc());
  deskItem('budget', 'ورقة الميزانية', 'money', () => D.budgetDoc());
  deskItem('envelope', 'الظرف الرمادي', 'envelope', () => D.proposalDoc());
  deskItem('script', 'سيناريو الفيلم', 'doc', async () => { const putBack = await pick(anchors.deskObjs.script, {open: false}); await scriptWithChoices(putBack); }, 20, {manual: true});
  deskItem('tablet', 'التابلت — موجز الحملة', 'tablet', () => briefDoc(), 40);
  const doStand = async () => { if (!seated || n02Busy || D.docOpen() || !$('choices').classList.contains('hidden') || !$('subs').classList.contains('hidden')) return; standCount++; await standFromDesk(); officeEvents(); };
  $('standbtn').onclick = doStand; onKey('Space', doStand);
  onUpdate(() => { const on = seated && !$('hud').classList.contains('hidden') && $('subs').classList.contains('hidden') && $('choices').classList.contains('hidden') && !D.docOpen(); $('standbtn').classList.toggle('hidden', !on); });
  addHotspot({id: 'sit', label: 'اجلس إلى مكتبك', icon: 'chair', range: 2.6, pos: V3(anchors.officeSeat.x, 1.1, anchors.officeSeat.z), when: () => !seated && S.scene === 'office' && !S.secretaryDone, use: async () => { await sitAtDesk(); objective(officeObjective()); await officeEvents(); }});
  addHotspot({id: 'grace', label: 'جريس أوينز', icon: 'person', kind: 'person', range: 3.0, pos: () => C.grace.headPos().clone().add(V3(0, 0.32, 0)), when: () => !S.nodes.N06 && C.grace.holder.visible && S.scene !== 'meeting', use: () => nodeN06()});
  addHotspot({id: 'values', label: 'بطاقة القيم', icon: 'frame', range: 3.2, pos: V3(anchors.valuesCard.x, anchors.valuesCard.y, anchors.valuesCard.z + 0.1), when: () => S.scene !== 'meeting', use: async () => { await look(V3(anchors.valuesCard.x, 1.5, anchors.valuesCard.z)); await D.valuesDoc(); advance(20); markDone('values'); }});
  addHotspot({id: 'board', label: 'لوحة أفكار الفريق — رتّب الأوراق', icon: 'board', range: 3.2, pos: V3(anchors.ideasBoard.x, anchors.ideasBoard.y, anchors.ideasBoard.z), when: () => S.scene !== 'meeting', use: async () => { await look(V3(anchors.ideasBoard.x, 1.4, anchors.ideasBoard.z), 'm_documents_note'); await boardSortDoc(); advance(15); if (Object.keys(S.boardSort || {}).length === 4) markDone('board'); }});
  addHotspot({id: 'cups', label: 'أكواب العام الماضي', icon: 'cup', range: 2.6, pos: V3(anchors.redCups.x, anchors.redCups.y, anchors.redCups.z), when: () => S.scene !== 'meeting', use: async () => { await look(V3(anchors.redCups.x, 0.9, anchors.redCups.z), 'm_documents_take'); await D.cupsDoc(); markDone('cups'); }});
  addHotspot({id: 'photowall', label: 'جدار صور مي', icon: 'frame', range: 3.2, pos: V3(-17.7, 1.6, -2.6), use: async () => { await look(V3(-17.8, 1.5, -2.6)); await D.cupsDoc(); }});
  addHotspot({id: 'coffee', label: 'آلة القهوة — اعمل قهوة', icon: 'cup', range: 2.4, pos: V3(10.2, 1.45, -13.3), when: () => !S.coffee && S.scene !== 'meeting', use: () => makeCoffee()});
}

// proximity barks (once each)
const barked = new Set();
function bark(id, ch, dist = 4) {
  onUpdate(() => {
    if (barked.has(id) || !player.ch || player.mode !== 'free' || !ch.holder.visible || ch.voice || lineActive || Object.values(C).some(c => c.voice)) return;
    if (ch.holder.position.distanceTo(player.ch.holder.position) < dist) { barked.add(id); ch.say(`assets/vo/ar/${id}`, {gesture: false}); }
  });
}

async function sceneOffice() {
  S.scene = 'office'; checkpoint('office');
  setupOfficeHotspots();
  const pp = () => player.ch.holder.position;
  await waitUntil(() => roomAt(pp().x, pp().z)?.id === 'office');
  advance(10);
  await sitAtDesk();
  // Nadia's briefing (EV01), face to face
  await nadiaVisit(async () => { await line('nadia_brief'); });
  S.briefed = true;
  toast('<b>المهمة</b> — اقتراح حملة الأعياد في اجتماع اليوم. مسموح: قراءة البيانات، الحديث مع الفريق والفروع، التوصية. غير مسموح: النشر العلني، الوعد بخصومات أو جوائز، استخدام صورة عميل أو اسمه أو قصته دون موافقة مكتوبة، التوقيع مع شريك.');
  objective(officeObjective());
  mapState.target = {x: 15.2, z: 4.5};
  await waitUntil(() => secretaryCalled && S.secretaryDone);
}

// ================================================================= S4 — secretary
async function secretaryScene() {
  while (D.docOpen() || n02Busy || $('choices').classList.contains('hidden') === false) await wait(0.5);
  setHotspotsBusy(true);
  const s = C.secretary; s.lockLook = true;
  stand(s, 9.8, 1.9, Math.PI / 2, 'f_idle_neutral_02');
  sfx.knock(); await wait(0.6);
  await s.walkTo([[12.2, 2.3]], {speed: 1.2}); s.faceTo(16.4, 4.5); s.lookAt(player.ch);
  if (seated) cine.shot(V3(16.4, 1.24, 4.6), () => s.headPos(), 0.9, {fov: 33}); else { lockControls(); await camOTS(s)(s); }
  S.clock = 13 * 60 + 50; setClock(S.clock);
  await line('secretary_call');
  await line('p_secretary', {gesture: false});
  s.walkTo([[10.0, 1.8], [8.2, 2.6]], {speed: 1.2}).then(() => sit(s, anchors.secretarySeat, {anim: 'f_sit_table_idle_neutral_01'}));
  setHotspotsBusy(false);
  stageMeeting();
  if (seated) await standFromDesk(); else freeControls();
  objective('اذهب إلى قاعة الاجتماعات');
  mapState.target = {x: 1.8, z: -5.5};
  S.secretaryDone = true;
}

// ================================================================= S5 — meeting
const SEAT = {player: 3, ryan: 0, mei: 1, omar: 2, grace: 4};
function stageMeeting() {
  const seats = anchors.meetSeats;
  for (const id of ['ryan', 'mei', 'omar', 'grace']) { const c = C[id]; c.walking = null; c.mood = {smile: 0, frown: 0, brow: 0, worry: 0, squint: 0}; sit(c, seats[SEAT[id]]); c.lockLook = true; c.lookAt(null); }
  const n = C.nadia; n.seated = false; n.place(anchors.nadiaMeet.x, anchors.nadiaMeet.z, anchors.nadiaMeet.ry); n.setBase('f_idle_neutral_01');
  drawScreen('sales');
}
function drawScreen(kind) {
  screens.meeting.draw((g, W, H) => {
    g.fillStyle = '#0f1417'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#e8e2d6'; g.font = '600 56px "IBM Plex Sans Arabic"'; g.textAlign = 'right';
    if (kind === 'sales') {
      g.fillText('مبيعات ديسمبر: الهدف مقابل الفعلي', W - 60, 100);
      const bars = [['الهدف الوطني', 6, '#5d7480'], ['سوقنا', 4, '#d9b26f']];
      bars.forEach(([n, v, c], i) => { g.fillStyle = c; const h = v * 90; g.fillRect(260 + i * 520, H - 120 - h, 300, h); g.fillStyle = '#e8e2d6'; g.font = '600 44px "IBM Plex Sans Arabic"'; g.textAlign = 'center'; g.fillText(n, 410 + i * 520, H - 60); g.font = '700 64px Inter'; g.fillText('+' + v + '%', 410 + i * 520, H - 140 - h); });
    } else if (kind === 'report') {
      g.fillText('اختبار التواصل — فرع واحد، أسبوع واحد', W - 60, 100);
      g.textAlign = 'center'; g.font = '700 120px Inter'; g.fillStyle = '#7fc79a'; g.fillText('×3', 360, 380); g.fillStyle = '#e8e2d6'; g.fillText('1,900', 800, 380); g.fillStyle = '#e0705f'; g.fillText('14%', 1260, 380);
      g.font = '500 40px "IBM Plex Sans Arabic"'; g.fillStyle = '#c9c2b4'; g.fillText('التفاعل', 360, 460); g.fillText('صورة مُشاركة', 800, 460); g.fillText('ازدحام أو شكاوى', 1260, 460);
      g.fillStyle = '#2a1715'; g.fillRect(200, 560, 1200, 150); g.fillStyle = '#ffb4a8'; g.font = '500 42px "IBM Plex Sans Arabic"'; g.fillText('«انتظرت 15 دقيقة من أجل هذا الكوب الأحمر.» #كوب_أحمر', 800, 650);
    } else if (kind === 'plans') {
      g.fillText('حملة الأعياد — القرار', W - 60, 100);
      g.textAlign = 'center'; g.font = '600 48px "IBM Plex Sans Arabic"'; ['لمن؟', 'لماذا سيهتمون؟', 'هل تشبهنا؟', 'هل تستطيع فروعنا تقديمه؟'].forEach((q, i) => { g.fillStyle = ['#d9b26f', '#7fb59a', '#a9cbff', '#e0705f'][i]; g.fillText(q, W / 2, 260 + i * 120); });
    }
  });
}

async function sceneMeeting() {
  S.scene = 'meeting';
  const pp = () => player.ch.holder.position;
  await waitUntil(() => roomAt(pp().x, pp().z)?.id === 'meeting');
  checkpoint('meeting');
  await runMeeting();
}
async function runMeeting() {
  S.meetingStarted = true;
  lockControls(); setHotspotsBusy(true); mapState.target = null;
  setAmbienceLevel(0.35); objective('الاجتماع: أجب عن أسئلة نادية، ثم اختر الخطة');
  setTimeout(() => { hud(false); letterbox(true); }, 2500);
  const seat = anchors.meetSeats[SEAT.player];
  cine.shot(V3(4.3, 2.55, -5.7), V3(-0.5, 0.8, -9.8), 1.5, {fov: 52});
  await player.ch.walkTo([[1.8, -6.0], [seat.x + 0.1, seat.z + 0.7]], {speed: 1.2});
  sit(player.ch, seat);
  const N = C.nadia;
  for (const id of ['ryan', 'mei', 'omar', 'grace']) C[id].lookAt(N);
  player.ch.lookAt(N);
  N.lookAt(player.ch); N.lockLook = true;
  await wait(0.6);
  // EV02 ideas board + opening
  await line('nadia_meet_open', {cam: camMeet});
  for (const [id, who] of [['ryan_meet', 'ryan'], ['mei_meet', 'mei'], ['grace_meet', 'grace']]) {
    for (const o of ['ryan', 'mei', 'omar', 'grace', 'nadia']) if (o !== who) C[o].lookAt(C[who]);
    player.ch.lookAt(C[who]);
    await line(id, {cam: camMeet});
  }
  // N04 — the social test twist
  drawScreen('report'); gain('M7');
  for (const o of ['ryan', 'omar', 'grace', 'nadia']) C[o].lookAt(V3(4.85, 1.6, -9.5));
  player.ch.lookAt(V3(4.85, 1.6, -9.5));
  await cine.shot(V3(-2.6, 1.55, -8.0), V3(4.85, 1.6, -9.5), 1.2, {fov: 45});
  C.mei.mood.smile = 0.8; C.mei.mood.brow = 0.6;
  await line('mei_n04', {cam: camMeet});
  sfx.ping();
  C.mei.mood.smile = 0.2; C.mei.mood.worry = 0.6;
  await line('mei_n04_beat', {cam: camMeet});
  C.omar.mood.frown = 0.7;
  await line('omar_n04_beat', {cam: camMeet});
  for (const o of ['ryan', 'mei', 'omar', 'grace', 'nadia']) C[o].lookAt(player.ch);
  const pcam = (who) => cine.closeup(player.ch, {dist: 1.4, yawOff: 0.25, fov: 30, dur: 0.7});
  const k4 = await ask([{id: 'p_n04_sound', key: 'sound', cam: pcam}, {id: 'p_n04_all', key: 'all', cam: pcam}, {id: 'p_n04_drop', key: 'drop', cam: pcam}], {hint: 'ماذا تقول لك الـ14%؟ وما الذي يشترطه الدليل لأي صورة من المستخدمين؟'});
  setNode('N04', k4);
  if (k4 === 'sound') { S.moderation = 'planned'; S.consent_contest = 'planned'; S.idea = 'contest'; C.mei.mood.worry = 0; C.mei.mood.smile = 0.4; await line('mei_n04_sound', {cam: camMeet}); C.omar.mood.frown = 0; await line('omar_n04_sound', {cam: camMeet}); }
  else if (k4 === 'all') { S.idea = 'contest'; S.moderation = 'none'; S.consent_contest = 'missing'; C.mei.mood.smile = 0.9; C.omar.mood.frown = 0.9; await line('mei_n04_all', {cam: camMeet}); }
  else { C.mei.mood.worry = 0.8; C.mei.mood.smile = 0; await line('mei_n04_drop', {cam: camMeet}); }
  drawScreen('plans');
  // the player stands up and presents the brief at the screen (clicker + slides), Nadia asks her questions
  await presentStart();
  N.lookAt(player.ch);
  await line('nadia_q_insight', {cam: camMeet});
  await clicker('الرؤية عن العميل'); drawSlide(1, 'لمن؟ ولماذا سيهتمون؟', briefText('insight'), (S.brief && S.brief.cards.insight) || []); await slideShot();
  const pcamP = presCam;
  const insOpts = [];
  const seg = S.segment;
  if (seg === 'A') insOpts.push({id: 'p_ins_a_strong', key: 'strong', disabled: !(S.ev.M3 && S.ev.M4), need: S.ev.M3 && S.ev.M4 ? null : 'تحتاج: لوحة بيانات الفروع (الانتظار والمقاعد)'});
  if (seg === 'C') insOpts.push({id: 'p_ins_c_strong', key: 'strong', disabled: !S.ev.M3, need: S.ev.M3 ? null : 'تحتاج: لوحة بيانات الفروع'});
  if (seg === 'B') insOpts.push({id: 'p_ins_b_strong', key: 'strong', disabled: !S.ev.M4, need: S.ev.M4 ? null : 'تحتاج: لوحة بيانات الفروع'});
  insOpts.push({id: 'p_ins_weak', key: 'weak'}, {id: 'p_ins_none', key: 'none'});
  S.insight = await ask(fromBrief(insOpts, 'insight').map(o => ({...o, cam: pcamP})), {hint: 'ما الحاجة أو التوتر الحقيقي الذي تقوله البيانات عن شريحتك؟'});
  await line('nadia_q_ops', {cam: camMeet});
  await clicker('ما تحتاجه الفروع'); drawSlide(2, 'هل تستطيع فروعنا تقديمه؟', briefText('ops'), (S.brief && S.brief.cards.ops) || []); await slideShot();
  const ops = await ask(fromBrief([{id: 'p_ops_sound', key: 'sound', cam: pcamP, disabled: !S.ops_checked, need: S.ops_checked ? null : 'تحتاج: أن تسأل الفرع (مكالمة هنا من اللابتوب)'}, {id: 'p_ops_ignore', key: 'ignore', cam: pcamP}, {id: 'p_ops_unknown', key: 'unknown', cam: pcamP}], 'ops'), {hint: 'ماذا قالت لك هنا عن الساعة الثامنة؟'});
  S.opsAnswer = ops;
  if (ops === 'sound') { C.omar.mood.frown = 0; C.omar.mood.smile = 0.35; await line('omar_ops_sound', {cam: camMeet}); }
  else { C.omar.mood.frown = 0.8; C.omar.lookAt(V3(0, 0.7, -9.5)); await line('omar_l3', {cam: camMeet}); }
  await line('nadia_q_measure', {cam: camMeet});
  await clicker('كيف نقيس'); drawSlide(3, 'كيف سنعرف أنها نجحت؟', briefText('measure'), (S.brief && S.brief.cards.measure) || []); await slideShot();
  S.measure = await ask(fromBrief([{id: 'p_meas_business', key: 'business', cam: pcamP}, {id: 'p_meas_vanity', key: 'vanity', cam: pcamP}, {id: 'p_meas_none', key: 'none', cam: pcamP}], 'measure'), {hint: 'أي رقم يثبت أن الحملة حققت هدفها، لا أنها أعجبت الناس فقط؟'});
  if (S.measure === 'business') { C.ryan.mood.smile = 0.4; await line('ryan_meas_business', {cam: camMeet}); }
  await line('nadia_q_risk', {cam: camMeet});
  await clicker('الخطر وكيف نتعامل معه'); drawSlide(4, 'ما الخطر الرئيسي؟', briefText('risk'), (S.brief && S.brief.cards.risk) || []); await slideShot();
  const rk = await ask(fromBrief([{id: 'p_risk_plan', key: 'plan', cam: pcamP}, {id: 'p_risk_none', key: 'none', cam: pcamP}], 'risk'), {hint: 'ما الذي أظهره اختبار المسابقة؟ ومن يملك الإذن بالصور؟'});
  S.risk = rk === 'plan'; S.briefAnswered = true;
  await presentEnd();
  computeBrief(); log('brief', S.brief_q);
  advance(60);
  await line('nadia_plans', {cam: camMeet});
  await decision([]);
}

// ================================================================= S6/S7 — decision, tension, result
async function decision(struck) {
  cine.shot(V3(0.2, 2.9, -6.6), V3(0, 0.6, -9.6), 1.0, {fov: 55});
  const plan = await showPlans(struck);
  S.plansTried.push(plan); log('plan', plan);
  const ending = evaluateEnding(plan);
  const N = C.nadia;
  if (ending === 'E1' || ending === 'E2') {
    if (ending === 'E1') {
      await line('nadia_e1', {cam: camMeet});
      sfx.success(); sfx.applause();
      for (const id of ['ryan', 'mei', 'omar', 'grace']) { C[id].mood.smile = 0.85; C[id].lookAt(player.ch); }
      N.mood.smile = 0.8;
      N.gesture('f_claphands_01');
      cine.shot(V3(3.2, 1.7, -7.4), V3(-1, 0.95, -9.3), 1.4, {fov: 44});
      await wait(4.2);
    } else {
      const q = S.segment === 'everyone' || S.segment === 'none' ? 'nadia_e2_who' : !S.ops_checked || S.opsAnswer !== 'sound' ? 'nadia_e2_ops' : 'nadia_e2_meas';
      N.mood.worry = 0.4; await line(q, {cam: camMeet});
    }
    return result(ending, plan);
  }
  // ---- wrong plan: tension ----
  S.tension = (S.tension || 0) + 1;
  setTension(true);
  const fb = plan === 1 ? 'nadia_fb_discount' : plan === 2 ? 'nadia_fb_contest' : 'nadia_fb_film';
  N.mood.worry = 0.7; N.mood.frown = 0.3;
  await line(fb, {cam: camMeet});
  await line('nadia_tension', {cam: camMeet});
  cine.shot(V3(-3.0, 1.35, -7.6), () => player.ch.headPos(), 1.2, {fov: 36});
  const d = await tensionButtons();
  log('tension', plan, d);
  if (d === 'revise') {
    await line('p_revise', {cam: (w) => cine.closeup(player.ch, {dist: 1.3, yawOff: 0.3, fov: 30, dur: 0.6})});
    setTension(false);
    return decision([...new Set([...struck, plan])]);
  }
  await line('p_continue', {cam: (w) => cine.closeup(player.ch, {dist: 1.3, yawOff: 0.3, fov: 30, dur: 0.6})});
  return result(ending, plan);
}
let tensionOn = false;
function setTension(on) {
  tensionOn = on; sfx.heartbeat(on);
  document.querySelector('.vignette')?.classList.toggle('on', on);
  for (const id of ['ryan', 'mei', 'omar', 'grace']) {
    const c = C[id];
    if (on) { c.mood.worry = 0.7; c.mood.smile = 0; c.setBase(c.g === 'm' ? 'm_sit_table_idle_nervous_01' : 'f_sit_table_breathe_01', {fade: 0.8}); if (id === 'omar') c.lookAt(V3(0, 0.75, -9.5)); }
    else { c.mood.worry = 0; c.setBase(c.g === 'm' ? 'm_sit_table_idle_neutral_01' : 'f_sit_table_idle_neutral_01', {fade: 0.8}); c.lookAt(C.nadia); }
  }
  if (!on) { C.nadia.mood.worry = 0; C.nadia.mood.frown = 0; }
}
onUpdate((dt) => {
  grade.uniforms.mood.value = damp(grade.uniforms.mood.value, tensionOn ? 1 : 0, 1.5, dt);
  for (const l of interior.children) { l.userData.base ??= l.intensity; l.intensity = damp(l.intensity, l.userData.base * (tensionOn ? 0.55 : 1), 1.5, dt); }
});

async function result(ending, plan) {
  S.ending = ending; log('ending', ending); letterbox(false);
  setTension(false);
  await fade(true, 900);
  hud(false); setHotspotsBusy(true);
  await fade(false, 600);
  const up = ending === 'E1' || ending === 'E2';
  up ? sfx.success() : sfx.fail();
  const res = showResult(ending, {practice: practice(), plan});
  // narration of the January card
  await wait(1.0);
  await line({E1: 'anchor_e1', E2: 'anchor_e2', E3: 'anchor_e3', E4: 'anchor_e4'}[ending]);
  if (ending === 'E3' && plan === 1) await line('anchor_e3_cost');
  if (plan === 2) await line('anchor_mod');
  if (ending === 'E4') await line('ruth_e4');
  if (ending === 'E1') await line('hana_e1');
  const r = await res;
  if (r === 'retry') { restartFromCheckpoint(); return; }
  showDebrief(ending, () => { sessionStorage.removeItem('bus3_cp'); location.href = location.pathname + location.search.replace(/[?&]resume=1/, ''); });
}

// ================================================================= entry
export async function run(lines, speakers, resumeScene = null) {
  window.__S = S; window.__C = C; window.__player = player; window.__teleport = teleport;
  initDeskHands(player.ch);
  LINES = lines; SPK = speakers;
  const v = document.createElement('div'); v.className = 'vignette'; document.body.appendChild(v);
  startAmbience();
  startBackground();
  // initial staging
  const a = anchors;
  stand(C.reception, a.reception.x, a.reception.z, a.reception.ry);
  stand(C.omar, a.lobbyOmar.x, a.lobbyOmar.z, 0.5, 'm_idle_neutral_01');
  stagedRyan();
  sit(C.mei, a.meiSeat, {anim: 'f_sit_table_gestic_thoughtful'});
  stand(C.grace, a.graceStand.x, a.graceStand.z, a.graceStand.ry);
  sit(C.secretary, a.secretarySeat, {anim: 'f_sit_table_idle_neutral_01'});
  C.nadia.hide();
  bark('bark_ryan_phone', C.ryan, 4.5); bark('bark_mei', C.mei, 3.2); bark('grace_bark_n06', C.grace, 3.4);
  setClock(S.clock);
  if (resumeScene === 'meeting') {
    setupOfficeHotspots(); stageMeeting(); teleport(1.8, -4.2, Math.PI); S.secretaryDone = true; secretaryCalled = true; n01Done = true;
    hud(true); await fade(false, 800); await runMeeting(); return;
  }
  if (resumeScene === 'office') { teleport(12.2, 2.0, Math.PI / 2); hud(true); await fade(false, 800); freeControls(); await sceneOffice(); await sceneMeeting(); return; }
  if (resumeScene !== 'lobby') await sceneArrival(); else { teleport(0.5, 12, Math.PI); hud(true); await fade(false, 800); freeControls(); }
  window.__S = S;
  await sceneLobby();
  await sceneOffice();
  await sceneMeeting();
}
