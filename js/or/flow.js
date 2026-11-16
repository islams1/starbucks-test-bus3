// The operation, scene by scene (Situation6_OpenHeart_QuickVersion): the awake patient, the time-out, then everything
// the surgeon does with the hands, the team's voices, the monitor, the two wall clocks and the tension in the room.
import * as THREE from 'three';
import {camera, onUpdate, damp, clock, wait, grade, Q} from '../core/engine.js';
import * as cine from '../core/cine.js';
import {startExertionBreathing, playVoice} from '../core/audio.js';
import {fade, show, letterbox, choose} from '../ui/ui.js';
import {OR, CHEST, setClocks, setCount} from './room.js';
import {F, field, setOpen, NOTCH, XIPH} from './field.js';
import {H, aortaPoint, addGraft, worldOf} from './heart.js';
import {vit, setTarget} from './monitor.js';
import {T as TEAM} from './team.js';
import {HANDS, firstPerson} from './hands.js';
import {fpBlood} from './fphands.js';
import {T as TL, putDown, trayHide, makeKit, pose} from './tools.js';
import {setPump, setVentilator} from './sound.js';
import {SC, award, flag, crisis, showBox, scoreCard, ending} from './score.js';
import {initLines, say, ask, orders, ordersHide, panel, panelHide, caption, clearMarks, objective, prompt, lineText, lineSpeaker} from './orui.js';
import * as act from './acts.js';
import {A} from './acts.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- camera: the surgeon's eyes
const EYE = V3(CHEST.x + 0.3, CHEST.y + 0.95, 0.1);     // like the reference footage: close, almost straight down, the incision running top (head) to bottom
const HEAD = V3(CHEST.x + 0.02, 1.69, 0.40);         // natural eye height, for looking at people
const DEEP = V3(CHEST.x + 0.27, CHEST.y + 0.86, 0.08);  // the same camera, a little closer, for work inside the chest
let view = {eye: EYE.clone(), target: CHEST.clone(), fov: 26};
const sway = () => V3(Math.sin(clock.t * 0.31) * 0.004, Math.sin(clock.t * 2 * Math.PI / 4.2) * 0.0025, Math.sin(clock.t * 0.23 + 1) * 0.003);
/** look through the surgeon's eyes at a target (point or function) */
function eyeView(target = CHEST, fov = 26, dur = 0.9, eye = EYE) {
  view = {eye: eye.clone(), target, fov};
  const T = () => typeof target === 'function' ? target() : target;
  return cine.shot(eye, T, dur, {fov}).then(() => { if (view.target === target) cine.hold(() => eye.clone().add(sway()), T, {fov}); });
}
const backToEye = (dur = 0.6) => eyeView(view.target, view.fov, dur, view.eye);
/** short cutaway to a team member's face for a line, then back to the hands */
async function cut(ch, id, {dist = 1.1, fov = 30, yawOff = 0.25} = {}) {
  firstPerson(false);
  await cine.closeup(ch, {dist, yawOff, fov, dur: 0.45});
  await say(id);
  await backToEye(0.5);
  firstPerson(true);
}
const heartView = () => H.group.position.clone().add(V3(0, 0.02, 0));

// ---------------------------------------------------------------- tension: colour, framing, breathing, handheld
const TN = {v: 0, t: 0.1};
function tension(t) { TN.t = t; letterbox(t >= 0.75); }
// ---------------------------------------------------------------- the two wall clocks (surgical time runs ×12)
const CLK = {cpb: null, xc: null, rate: 12, acc: 0};
let started = false;
function setup() {
  if (started) return; started = true;
  onUpdate((dt) => {
    TN.v = damp(TN.v, TN.t, 1.4, dt);
    grade.uniforms.mood.value = TN.v * 0.5;
    cine.handheld(0.35 + TN.v * 1.7);
    if (CLK.cpb != null && !CLK.cpbStop) CLK.cpb += dt * CLK.rate;
    if (CLK.xc != null && !CLK.xcStop) CLK.xc += dt * CLK.rate;
    CLK.acc += dt; if (CLK.acc > 0.25) { CLK.acc = 0; setClocks(CLK.cpb, CLK.xc); }
    // pump flow and bypass glide to their targets
    OR.flow = damp(OR.flow || 0, OR.flowT || 0, 0.6, dt);
    vit.bypass = damp(vit.bypass, OR.flowT || 0, 0.7, dt);
    H.arrest = damp(H.arrest, H.arrestT || 0, 0.9, dt);
  });
  startExertionBreathing(() => Math.max(0, TN.v - 0.15) * 0.8);
  // the team: where they look
  TEAM.rania.lookAt(CHEST.clone()); TEAM.karim.lookAt(V3(0.4, 1.15, -1.5)); TEAM.layla.lookAt(V3(-2.0, 1.65, 0.45));
  // the anaesthetist is never idle: her eyes go round monitor → patient → field → pumps → surgeon, and now and then she
  // shifts her weight or nods along; her base gaze stays on the monitor
  let gT = 0, gNext = 4, aT = 0, aNext = 14;
  onUpdate((dt) => {
    const l = TEAM.layla; if (!l || !l.holder.visible || l.voice) return;
    gT += dt; aT += dt;
    if (gT > gNext) {
      gT = 0; gNext = 2.8 + Math.random() * 4.5; const r = Math.random();
      const target = r < 0.3 ? (TEAM.patient && TEAM.patient.headPos ? TEAM.patient.headPos().clone() : CHEST.clone()) : r < 0.55 ? CHEST.clone() : r < 0.75 ? V3(-1.5, 1.35, -0.75) : 'camera';
      l._lookOv = {target, until: performance.now() + 1300 + Math.random() * 1500};
    }
    if (aT > aNext && !l.walking) { aT = 0; aNext = 12 + Math.random() * 14; l.gesture(['f_idle_breathe_01', 'f_gestic_listen_neutral_01', 'f_idle_neutral_02'][Math.floor(Math.random() * 3)], {fade: 0.6}); }
  });
  // the patient's eyes close with the anaesthetic
  const p = TEAM.patient; p.postIK = () => { if (!p.sleep || !p.morph) return; const inf = p.morph.mesh.morphTargetInfluences, D = p.morph.dict; p._sl = Math.min(1, (p._sl || 0) + 0.012); for (const k of ['AK_09_EyeBlinkLeft', 'AK_10_EyeBlinkRight']) if (D[k] != null) inf[D[k]] = Math.max(inf[D[k]], p._sl); };
  // hands held up in front of the chest when empty (sterile)
  TL.rest = CHEST.clone().add(V3(0.1, 0.12, 0.26)); TL.restW = 1; TL.restL = CHEST.clone().add(V3(-0.08, 0.12, 0.27)); TL.restLW = 1;
}
function startBypass() { OR.flowT = 1; setPump(true); OR.artLine.visible = false; if (CLK.cpb == null) CLK.cpb = 0; }
function stopBypass() { OR.flowT = 0; setPump(false); }
function drape() {
  OR.blanket.visible = false; OR.drapes.visible = true; F.group.visible = true; H.group.visible = true; vit.spont = false;
  TEAM.patient.holder.visible = false;
  vit.ventilating = true; setVentilator(true);
}

// ---------------------------------------------------------------- scenes
async function s0() {
  OR.drapes.visible = false; OR.blanket.visible = true; F.group.visible = false; H.group.visible = false;
  const p = TEAM.patient; p.holder.visible = true; p.lockLook = false; p.lookAt('camera'); p.emote('worried', 0.8);
  vit.ventilating = false; vit.spont = true;          // awake, breathing on his own
  const face = () => p.headPos().clone().add(V3(0, 0.02, 0));
  eyeView(face, 34, 0, HEAD);
  await fade(false, 1400);
  objective('السيد عادل حمدي مستيقظ على الطاولة');
  await say('pt_1');
  const k = await ask([{id: 'pl_0a', key: 'a'}, {id: 'pl_0b', key: 'b'}]);
  SC.opening = k;
  p.emote(k === 'a' ? 'relieved' : 'unsure', 0.7);
  await say(k === 'a' ? 'pt_2a' : 'pt_2b');
  TEAM.layla.lookAt(face());
  await say('ly_0');
  p.sleep = true; p.lookAt(null);
  await wait(2.2);
  await fade(true, 1300);
  drape();
  TEAM.layla.lookAt(V3(-2.0, 1.65, 0.45));
  await caption('بعد أربعين دقيقة: المريض نائم على جهاز التنفس، والصدر معقَّم ومغطّى', 3000);
}
async function s1() {
  // the time-out: everyone stops; the scrub nurse turns from her table and leads it, talking to the team
  const R = TEAM.rania; R.setBase('f_idle_neutral_02'); R.lookAt('camera');
  eyeView(() => R.headPos().clone().add(V3(0, -0.15, 0)), 46, 0, HEAD);
  await fade(false, 900);
  objective('التوقف المؤقت قبل الشق');
  tension(0.15);
  await say('ra_to');
  const items = [
    {id: 'id', t: 'هوية المريض والموافقة', lines: ['ly_id']}, {id: 'proc', t: 'الإجراء', lines: ['pl_proc']},
    {id: 'alg', t: 'الحساسية', lines: ['ly_alg']}, {id: 'abx', t: 'المضاد الحيوي قبل الشق', lines: ['ly_abx']},
    {id: 'blood', t: 'الدم ومشتقاته', lines: ['ra_blood']}, {id: 'events', t: 'الأحداث المتوقعة (التخدير والمضخة)', lines: ['kr_ev', 'ly_ev']},
  ];
  const done = new Set(); let bloodOk = false, short = false, busy = false;
  const el = $('ckl');
  el.innerHTML = `<h3>التوقف المؤقت — قبل الشق</h3><p>المس كل بند ليؤكده صاحبه بصوته.</p>${items.map(i => `<div class="it" data-id="${i.id}"><span class="bx"></span><span>${i.t}</span></div>`).join('')}<div class="acts"><button class="short">النسخة المختصرة</button><span></span></div>`;
  el.classList.remove('hidden');
  await new Promise(res => {
    el.querySelectorAll('.it').forEach(d => d.onclick = async () => {
      const it = items.find(i => i.id === d.dataset.id); if (busy || done.has(it.id)) return;
      busy = true; d.classList.add('warn');
      // the surgeon looks at whoever confirms the item
      for (const l of it.lines) { const sp = lineSpeaker(l), ch = sp && sp !== 'player' && TEAM[sp]; if (ch && ch.holder.visible) eyeView(() => ch.headPos().clone().add(V3(0, -0.1, 0)), 40, 0.8, HEAD); await say(l); }
      eyeView(() => R.headPos().clone().add(V3(0, -0.15, 0)), 46, 0.8, HEAD);
      if (it.id === 'blood') {
        el.classList.add('hidden');
        const k = await ask([{id: 'pl_blood_ok', key: 'ok'}, {id: 'pl_blood_no', key: 'no'}]);
        if (k === 'ok') { bloodOk = true; await say('ra_blood_ok'); }
        el.classList.remove('hidden');
      }
      d.classList.remove('warn'); d.classList.add('done'); d.querySelector('.bx').textContent = '✓'; done.add(it.id); busy = false;
      if (done.size === items.length) res();
    });
    el.querySelector('.short').onclick = async () => { if (busy) return; short = true; el.classList.add('hidden'); await say('pl_short'); await say('ra_short'); res(); };
  });
  el.classList.add('hidden');
  if (!short) await say('ra_to_done');
  SC.bloodOrdered = bloodOk;
  if (!done.has('abx') || !done.has('blood')) flag('unsafe');
  award('timeout', Math.round(5 * done.size / items.length) + (bloodOk ? 3 : 0));
  R.setBase('f_work_table'); R.lookAt(CHEST.clone());
}
async function s2() { TL.restW = 0; TL.restLW = 0; eyeView(CHEST.clone().add(V3(0.0, 0, 0.01)), 19); await act.actMarking(); }   // from here the hands are in view only when they work
async function s3() { await act.actIncision(); putDown(); }
async function s4() {
  await act.actSaw();
  eyeView(CHEST.clone().add(V3(0.03, -0.02, 0.045)), 22, 0.6);
  await act.actRetractor();
  await caption('فُتح التامور وعُلّقت حوافّه: القلب ينبض أمامك', 2200);
  eyeView(heartView, 17, 0.8, DEEP);
  tension(0.2);
}
async function s5() {
  objective('قبل أي قنية: الهيبارين');
  await orders([{id: 'hep', line: 'pl_hep', want: true}]);
  await say('pl_hep'); await say('ly_hep');
  await caption('بعد ثلاث دقائق', 1500);
  tension(0.35);
  await cut(TEAM.karim, 'kr_act1');
  const k = await ask([{id: 'pl_act_a', key: 'a'}, {id: 'pl_act_b', key: 'b'}, {id: 'pl_act_c', key: 'c'}], 'كريم يرفض بدء المضخة. قرارك؟');
  if (k === 'a') { award('act', 8); await caption('هيبارين إضافي… القياس الثاني', 1500); }
  else if (k === 'b') { award('act', 0); flag('unsafe'); await cut(TEAM.karim, 'kr_refuse'); await say('hd_act'); await caption('هيبارين إضافي… القياس الثاني', 1500); }
  else { award('act', 5); await say('hd_wait'); await caption('بعد خمس عشرة دقيقة', 1500); }
  await say('kr_act2');
  tension(0.2);
}
async function s6() {
  const hd = TEAM.haddad; hd.place(2.2, 2.4, Math.PI); hd.setBase('m_idle_neutral_01');
  hd.walkTo([[0.6, 1.6], [-0.95, 0.72]], {nav: false, endFace: Math.PI * 0.95});
  hd.lookAt(CHEST.clone());
  eyeView(() => aortaPoint(0.55), 15, 0.8, DEEP);
  await wait(2.4);
  await say('hd_enter');
  const r = await act.actAortaScan();
  if (r.good) await say('hd_good');
  hd.walkTo([[0.6, 1.6], [2.2, 2.6]], {nav: false}).then(() => hd.hide());
}
async function s7() {
  eyeView(() => aortaPoint(0.6), 15, 0.6, DEEP);
  await act.actCannulate();
  objective('ابدأ الدورة الخارجية');
  await orders([{id: 'cpb', line: 'pl_cpb', want: true}]);
  await say('pl_cpb');
  startBypass();
  await say('kr_flow');
  vit.ventilating = false; setVentilator(false); setTarget({sbp: 70, dbp: 55, hr: 76});
  await say('ly_vent_stop');
}
async function s8() {
  eyeView(() => aortaPoint(0.4), 15, 0.6, DEEP);
  await act.actClamp();
  objective('أوقف القلب: محلول شلّ القلب');
  await orders([{id: 'plegia', line: 'pl_plegia', want: true}]);
  await say('pl_plegia');
  eyeView(heartView, 17, 1.2, DEEP);
  await say('kr_plegia');
  setTarget({hr: 26}, 0.6); await wait(3.5);
  vit.rhythm = 'asystole'; H.arrestT = 1; tension(0.35);
  await wait(1.8);
  await say('ly_arrest');
  CLK.xc = 0; await say('kr_xc');
  tension(0.25);
}
async function s9() {
  objective('أي قناة إلى الشريان الأمامي النازل؟');
  await say('hd_conduit');
  const k = await ask([{id: 'pl_lima', key: 'lima'}, {id: 'pl_svg', key: 'svg'}]);
  award('conduit', k === 'lima' ? 3 : 0);
  await say(k === 'lima' ? 'hd_lima' : 'hd_svg');
  // loupes: lean in close to the LAD
  const lad = () => worldOf(H.targets.LAD);
  await eyeView(lad, 5.5, 1.1, DEEP);
  await act.actSuture();
  eyeView(heartView, 17, 0.9, DEEP);
  await say('kr_dose');
  const d = await ask([{id: 'pl_dose_yes', key: 'yes'}, {id: 'pl_dose_no', key: 'no'}]);
  award('dose', d === 'yes' ? 3 : 0); if (d === 'no') flag('weak');
  if (d === 'yes') await say('kr_dose_go');
  await fade(true, 900);
  A.grafts.OM = addGraft('OM', 'svg'); A.grafts.PDA = addGraft('PDA', 'svg', true);
  CLK.xc = Math.max(CLK.xc, 66 * 60); CLK.cpb = Math.max(CLK.cpb, 84 * 60);
  await caption('بعد خمس وثلاثين دقيقة: طُعمان وريديان إلى الشريان المنعطف (OM) والخلفي النازل (PDA)، والمفاغرتان على الأبهر', 3200);
  await fade(false, 900);
  tension(0.4);
  await say('kr_xc40');
}
async function s10() {
  objective('ارفع الملقط عن الأبهر');
  eyeView(heartView, 17, 0.6, DEEP);
  await orders([{id: 'unclamp', line: 'pl_unclamp', want: true}]);
  await say('pl_unclamp');
  if (A.clamp) { OR.root.remove(A.clamp); A.clamp = null; }
  CLK.xcStop = true; SC.xcMin = CLK.xc / 60;
  H.arrestT = 0; await wait(2.6);
  vit.rhythm = 'vf'; crisis(true); tension(1);
  await wait(0.8);
  await cut(TEAM.layla, 'ly_vf', {dist: 0.9, fov: 34});
  objective('رجفان بطيني!');
  await act.actDefib();
  vit.rhythm = 'sinus'; setTarget({hr: 92}, 1.5); H.decomp = SC.flags.weak ? 0.45 : 0;
  await wait(0.6);
  await say('ly_sinus');
  tension(0.3); crisis(false);
}
async function s11() {
  objective('الفصل عن المضخة');
  await say('kr_wean');
  stopBypass(); vit.ventilating = true; setVentilator(true);
  setTarget({sbp: 112, dbp: 62, hr: 88, spo2: 99}, 0.4);
  await say('ly_vent_back');
  CLK.cpbStop = true;
  await caption('بعد دقيقتين', 1300);
  setTarget({st: 2.6}); tension(0.6);
  await wait(1.5);
  await cut(TEAM.layla, 'ly_st');
  eyeView(heartView, 17, 0.6, DEEP);
  const m = await act.actFlowProbe();
  const measuredAll = ['LAD', 'OM', 'PDA'].every(n => m[n]);
  const k = await ask([{id: 'pl_back_pump', key: 'back'}, {id: 'pl_epi', key: 'epi'}], 'تدفق الطُّعم إلى الخلفي النازل 9 مل/دقيقة. قرارك؟');
  let pts = (m.PDA ? 2 : 0) + (measuredAll ? 1 : 0);
  if (k === 'back') {
    CLK.cpbStop = false; startBypass(); vit.ventilating = false; setVentilator(false);
    await say('kr_back');
    await act.actFixGraft();
    await act.actFlowProbe(['PDA'], {need: 'PDA'});
    stopBypass(); vit.ventilating = true; setVentilator(true); CLK.cpbStop = true;
    setTarget({st: 0}); tension(0.2);
    await wait(1.2); await say('ly_st_ok');
    pts += 4;
  } else {
    flag('graftFail'); await say('ly_epi'); setTarget({st: 1.3, sbp: 104}); tension(0.35);
  }
  SC.cpbMin = CLK.cpb / 60;
  award('graft', pts);
}
async function s12() {
  await fade(true, 700);
  for (const c of A.cannulas) OR.root.remove(c); for (const l of A.lines) OR.root.remove(l); A.cannulas = []; A.lines = []; if (A.purse) A.purse.visible = false;
  OR.flowT = 0; OR.flow = 0; vit.bypass = 0;
  await caption('سُحبت القنيات', 1400);
  await fade(false, 700);
  eyeView(heartView, 17, 0.4, DEEP);
  objective('البروتامين لعكس الهيبارين');
  await say('ly_prot');
  const k = await ask([{id: 'pl_prot_slow', key: 'slow'}, {id: 'pl_prot_fast', key: 'fast'}]);
  award('protamine', k === 'slow' ? 2 : 0);
  if (k === 'fast') {
    setTarget({sbp: 70, dbp: 40, hr: 112}, 1.2); tension(0.85); crisis(true);
    await wait(1.4); await cut(TEAM.layla, 'ly_crash');
    await wait(4); setTarget({sbp: 106, dbp: 60, hr: 94}, 0.6); tension(0.35); crisis(false);
  }
  eyeView(CHEST.clone().add(V3(0, -0.04, 0)), 15, 0.6, DEEP);
  tension(0.45);
  await act.actBleeding();
  await say('ly_teg');
  panel('<canvas id="tegcv" width="280" height="120"></canvas><div class="row"><span>MA (قوة الجلطة)</span><b class="bad">42 مم ↓</b></div><div class="row"><span>R (زمن التخثر)</span><b class="ok">طبيعي</b></div><div class="row"><span>الفيبرينوجين</span><b class="ok">طبيعي</b></div>', {title: 'اختبار التخثر (TEG)'});
  { const g = $('tegcv').getContext('2d'); g.fillStyle = '#020506'; g.fillRect(0, 0, 280, 120); g.strokeStyle = '#5ad1ff'; g.lineWidth = 2; for (const s of [-1, 1]) { g.beginPath(); for (let x = 0; x < 280; x++) { const w = x < 40 ? 0 : Math.min(1, (x - 40) / 90) * 26; x ? g.lineTo(x, 60 + s * w) : g.moveTo(x, 60); } g.stroke(); } g.strokeStyle = 'rgba(127,214,160,.35)'; g.setLineDash([4, 4]); for (const s of [-1, 1]) { g.beginPath(); for (let x = 0; x < 280; x++) { const w = x < 40 ? 0 : Math.min(1, (x - 40) / 90) * 46; x ? g.lineTo(x, 60 + s * w) : g.moveTo(x, 60); } g.stroke(); } }
  const t = await ask([{id: 'pl_plt', key: 'plt'}, {id: 'pl_all', key: 'all'}, {id: 'pl_close', key: 'close'}], 'المصدر الجراحي أُغلق. والآن؟');
  panelHide();
  let pts = 3;
  if (t === 'plt') { pts += 3; await say('ly_plt'); }
  else if (t === 'all') { pts += 1; await say('ly_plt'); }
  else flag('bleedClose');
  award('bleeding', pts);
  if (t !== 'close') { await new Promise(r => { const off = onUpdate(dt => { F.blood = Math.max(0, F.blood - dt * 0.2); if (F.blood <= 0) { off(); r(); } }); }); await say('ra_dry'); }
  tension(0.2);
}
async function s13() {
  objective('قبل الإغلاق: العدّ');
  setCount(39, 40);
  tension(0.55);
  for (const c of [TEAM.rania, TEAM.layla, TEAM.karim]) c.lookAt('camera');
  await cut(TEAM.rania, 'ra_count', {dist: 1.0, fov: 32});
  const k = await ask([{id: 'pl_stop', key: 'stop'}, {id: 'pl_bin', key: 'bin'}], 'العدّ ناقص قطعة شاش. قرارك؟');
  TEAM.rania.lookAt(CHEST.clone()); TEAM.karim.lookAt(V3(0.4, 1.15, -1.5)); TEAM.layla.lookAt(V3(-2.0, 1.65, 0.45));
  if (k === 'bin') { award('count', 0); flag('retained'); tension(0.25); return; }
  eyeView(CHEST.clone().add(V3(0.02, -0.04, -0.01)), 16, 0.6, DEEP);
  await act.actSearch();
  setCount(40, 40); await say('ra_found'); tension(0.15);
}
async function s14() {
  eyeView(CHEST.clone().add(V3(0, -0.01, 0)), 16, 0.6);
  const wires = await act.actWires();
  await fade(true, 800);
  for (const w of wires) OR.root.remove(w);
  field.setStage('skin'); F.closed = true; F.bleeders = []; F.sawn = []; field.redraw();
  H.group.visible = false;
  await caption('المصارف وأسلاك تنظيم القلب في مكانها، والجلد مُغلق', 2200);
  await fade(false, 800);
  // the ICU nurse at the door
  const hu = TEAM.huda; hu.place(2.0, 2.7, Math.PI); hu.setBase('f_idle_neutral_01');
  hu.walkTo([[1.2, 1.7]], {nav: false, endFace: Math.PI * 1.2}); hu.lookAt('camera');
  eyeView(() => hu.headPos().clone().add(V3(0, -0.05, 0)), 40, 1.4, HEAD.clone().add(V3(0.08, 0, 0.1)));
  await wait(2.2);
  objective('سلّم المريض لممرضة العناية المركزة');
  await say('hu_ask');
  const picks = await handoverPick();
  for (const id of picks) await say(id);
  const good = ['pl_ho_drug', 'pl_ho_graft', 'pl_ho_call'].filter(i => picks.includes(i)).length;
  const vague = picks.includes('pl_ho_fine');
  award('handover', vague ? Math.max(0, good * 2 - 2) : [0, 2, 3, 5][good]);
  await say(vague || good < 2 ? 'hu_vague' : 'hu_ok');
}
/** pick three handover sentences */
function handoverPick() {
  const opts = ['pl_ho_drug', 'pl_ho_graft', 'pl_ho_call', 'pl_ho_fine', 'pl_ho_time', 'pl_ho_food'].sort(() => Math.random() - 0.5);
  const el = $('ckl');
  el.innerHTML = `<h3>التسليم لهدى</h3><p>اختر ثلاث جمل تقولها.</p>${opts.map(o => `<div class="it" data-id="${o}"><span class="bx"></span><span>${lineText(o)}</span></div>`).join('')}<div class="acts"><button class="go" disabled>سلّم</button><span id="hon">0 / 3</span></div>`;
  el.classList.remove('hidden');
  const sel = new Set();
  return new Promise(res => {
    el.querySelectorAll('.it').forEach(d => d.onclick = () => { const id = d.dataset.id; if (sel.has(id)) sel.delete(id); else if (sel.size < 3) sel.add(id); d.classList.toggle('done', sel.has(id)); d.querySelector('.bx').textContent = sel.has(id) ? '✓' : ''; $('hon').textContent = `${sel.size} / 3`; el.querySelector('.go').disabled = sel.size !== 3; });
    el.querySelector('.go').onclick = () => { el.classList.add('hidden'); res([...sel]); };
  });
}
async function finale() {
  ordersHide(); trayHide(); panelHide(); clearMarks();
  SC.xcMin = SC.xcMin || (CLK.xc || 0) / 60; SC.cpbMin = SC.cpbMin || (CLK.cpb || 0) / 60;
  await wait(1);
  await fade(true, 1400);
  show('hud', false); show('vitals', false); letterbox(false);
  const e = ending();
  if (e === 'E1') { await caption('اليوم الثالث', 1600); await say('pt_e1'); }
  scoreCard(() => location.reload());
  await fade(false, 800);
  setVentilator(false); setPump(false);
}

// ---------------------------------------------------------------- dev: jump into a later scene with the field ready
function prep(n) {
  drape(); if (n >= 2) { TL.restW = 0; TL.restLW = 0; }
  if (n >= 3) { F.marker = []; for (let i = 0; i <= 30; i++) F.marker.push(NOTCH.clone().lerp(XIPH.clone().add(V3(0.02, 0, 0)), i / 30)); }
  if (n >= 4) F.incision = F.marker.slice();
  if (n >= 5) { field.setStage('open'); setOpen(1); F.pericardium = 0; F.peri.material.opacity = 0; F.retractor.visible = true; }
  if (n >= 7) { A.site = 0.88; }
  if (n >= 8) { startBypass(); OR.flow = 1; vit.bypass = 1; vit.ventilating = false; setVentilator(false); }
  if (n >= 9) { vit.rhythm = 'asystole'; H.arrestT = 1; H.arrest = 1; CLK.xc = 20 * 60; }
  if (n >= 10) { A.grafts.LAD = addGraft('LAD', 'lima'); A.grafts.OM = addGraft('OM', 'svg'); A.grafts.PDA = addGraft('PDA', 'svg', true); }
  if (n === 10) { const c = makeKit('clamp'); c.position.copy(aortaPoint(0.3)); OR.root.add(c); A.clamp = c; }
  if (n >= 11) { vit.rhythm = 'sinus'; H.arrestT = 0; H.arrest = 0; }
  if (n >= 12) { stopBypass(); OR.flow = 0; vit.bypass = 0; vit.ventilating = true; setVentilator(true); }
  field.redraw();
}

export async function runOR(data, start = 0) {
  initLines(data);
  setup();
  show('hud', true); show('vitals', true); showBox(true);
  const scenes = [s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13, s14];
  if (start > 0) { prep(start); eyeView(start >= 5 ? heartView : CHEST, start >= 5 ? 17 : 19, 0, start >= 5 ? DEEP : EYE); await fade(false, 600); }
  window.__orflow = {SC, A, CLK, TN, view, cine, act, F, H, vit};
  const GLOVES = [0, 0, 0, 0.08, 0.22, 0.36, 0.42, 0.5, 0.56, 0.6, 0.64, 0.68, 0.8, 0.86, 0.9];   // blood on the gloves as the operation goes on
  for (let i = start; i < scenes.length; i++) { SC.scene = i; console.info('[scene]', i); fpBlood(GLOVES[i]); await scenes[i](); }
  await finale();
}
