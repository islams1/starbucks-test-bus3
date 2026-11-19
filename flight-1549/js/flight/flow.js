// The flight, second by second. The clock is the real one (AC.t = seconds after the bird strike at 15:27:11 EST); the
// controller's lines are the real recording, played when they happened (or, if you have not yet declared the emergency,
// when he would have learned of it); the first officer, the warnings and the cabin follow the cockpit voice recorder
// timeline in the NTSB report. Everything the captain does is yours: the buttons on the side and the radio replies.
import * as THREE from 'three';
import {camera, clock, onUpdate, wait} from '../core/engine.js';
import {playVoice} from '../core/audio.js';
import * as cine from '../core/cine.js';
import {$, show, fade} from '../ui/ui.js';
import {AC, update as acUpdate, startBranch, reach, AIRPORTS, placeFlock, sampleReal, chaseFrame} from './aircraft.js';
import {CK, seat, lookTo, lookHome} from './cockpit.js';
import {W} from './world.js';
import {startSound, thumps, masterWarning, ditch, chime} from './sound.js';
import {preloadRescue, showRescue} from './rescue.js';
import {FLY, takeControl, setLaw, anyInput} from './fly.js';
import {GT, setDetail, sharpen, addViewpoint, coarseNear} from './gtiles.js';
import {hideTitle} from './titlecard.js';
import {freeze, thaw} from './freeze.js';
import {CTL, onControl, setButton, setLever, warn, hint, showStick, focus, nudge} from './controls.js';
import {setupFO, foSet} from './fo.js';
import {startGuide} from './guide.js';
import {birdSplats, noseSplats} from './splat.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
let LINES, SPK, CLIPS, MODE = 'real';
const S = {acts: {}, answers: {}, events: [], fired: new Set(), branch: null, end: null, notes: [], reminded: new Set()};
const fmt = (t) => (t >= 0 ? 'T+' : 'T−') + Math.abs(Math.round(t)) + 's';
const hhmmss = (t) => { const s = Math.round(15 * 3600 + 27 * 60 + 11 + t); return [s / 3600 | 0, (s % 3600) / 60 | 0, s % 60].map(v => String(v).padStart(2, '0')).join(':'); };
// the controller's calls in Arabic, under the English in the subtitles
const AR_ATC = {
  atc_radar: 'كاكتس ١٥٤٩، مراقبة الإقلاع في نيويورك، تمّ التقاطكم على الرادار. اصعدوا وحافظوا على خمسة عشر ألفًا.',
  bg_jl1: 'نيويورك، جِتلينك ٢٧٦٠ على خمسة آلاف، ننعطف يمينًا إلى ١٥٠.', bg_jl2: 'جِتلينك ٢٧٦٠، اصعد وحافظ على عشرة آلاف.', bg_jl3: 'عشرة آلاف، جِتلينك ٢٧٦٠.',
  atc_270: 'كاكتس ١٥٤٩، انعطف يسارًا إلى الاتجاه ٢٧٠.',
  atc_220: 'حسنًا، تحتاجون العودة إلى لاغوارديا. انعطف يسارًا إلى الاتجاه ٢٢٠.',
  atc_rwy13: 'كاكتس، إن استطعنا تجهيزه لكم، هل تريدون محاولة الهبوط على المدرج ١٣؟',
  bg_jl4: 'جِتلينك ٢٧٦٠، انعطف يسارًا إلى ٠٧٠.', bg_jl5: 'يسارًا إلى ٠٧٠، جِتلينك ٢٧٦٠.',
  atc_31: 'حسنًا كاكتس ١٥٤٩، سيكون الدوران يسارًا إلى المدرج ٣١.',
  atc_land: 'حسنًا، ماذا تحتاج لتهبط؟',
  atc_rwy4: 'كاكتس ١٥٤٩، المدرج ٤ متاح إن أردت الدوران يسارًا إليه.',
  atc_teb_right: 'حسنًا، على يمينك مطار تيتربورو.',
  atc_teb_q: 'هل تريد محاولة الذهاب إلى تيتربورو؟',
  atc_teb_280: 'كاكتس، انعطف يمينًا إلى ٢٨٠، يمكنك الهبوط على المدرج ١ في تيتربورو.',
  atc_teb_which: 'حسنًا، أي مدرج تريد في تيتربورو؟',
  atc_sayagain: 'آسف، كرّر يا كاكتس.',
  bg_jl6: 'جِتلينك ٢٧٦٠، اتصل بنيويورك على ١٢٦٫٨.', bg_jl7: '٢٦٫٨، جِتلينك ٢٧٦٠.',
  atc_lost: 'كاكتس ١٥٤٩، فقدنا الاتصال الراداري. لديك أيضًا مطار نيوارك على الساعة الثانية، على بُعد نحو سبعة أميال.',
  bg_eg1: 'إيجل ٤٧١٨، انعطف يسارًا إلى ٢١٠.', bg_eg2: '٢١٠… لا أعرف، أظنه قال إنه سيدخل الهدسون.',
  atc_still: 'كاكتس، هل ما زلت على التردد؟',
  atc_newark: 'كاكتس، إن استطعت: المدرج ٢٩ متاح في نيوارك، على الساعة الثانية وسبعة أميال.',
};

// ---------------------------------------------------------------- voices and subtitles
const chans = {radio: Promise.resolve(), deck: Promise.resolve(), cabin: Promise.resolve()};
function subtitle(whoCls, who, en, ar, dur) {
  const el = document.createElement('div'); el.className = 'sub';
  el.innerHTML = `<div class="who ${whoCls}">${who}</div><div class="en">${en}</div><div class="ar">${ar || ''}</div>`;   // (and the Arabic under it)
  const box = $('subs'); box.appendChild(el); while (box.children.length > 2) box.firstChild.remove();
  setTimeout(() => el.remove(), Math.max(1800, dur * 1000 + 700));
}
/** a synthetic line (captain, first officer, cabin, GPWS); radio = goes out on the frequency */
function say(id, {radio = false, pa = false} = {}) {
  const L = LINES[id]; if (!L) return Promise.resolve();
  // three voice channels that never talk over themselves: the radio, the flight deck, the cabin (heard through the door)
  const ch = radio ? 'radio' : L.s.startsWith('fa') ? 'cabin' : 'deck';
  const queued = performance.now();
  const run = chans[ch].then(async () => {
    // a callout that had to wait too long is no longer true ("one hundred and seventy knots" half a minute later): drop it
    if (ch !== 'radio' && L.s !== 'player' && performance.now() - queued > 6000) return;
    const sp = SPK[L.s];
    if (L.s === 'fo' && CK.fo) {                    // the first officer speaks with his own lips (and turns to the captain)
      CK.fo.lookAt('camera');
      const p = CK.fo.say(`assets/vo/flight/${id}`, {gesture: false, emotion: L.e === 'tense' ? 'tense' : null});
      await new Promise(r => { const t = () => CK.fo.voice ? r() : requestAnimationFrame(t); t(); setTimeout(r, 1500); });
      const dur = CK.fo.voice ? CK.fo.voice.duration : 2;
      subtitle('fo', sp.name + ` · ${sp.role}`, L.t, L.ar, dur);
      await p; setTimeout(() => { if (!CK.fo.voice) CK.fo.lookAt(null); }, 900);
      return;
    }
    const v = await playVoice(`assets/vo/flight/${id}.mp3`, null, {radio: radio || pa || L.s === 'gpws' || L.s.startsWith('fa'), volume: L.s.startsWith('fa') ? 0.55 : L.s === 'gpws' ? 0.8 : 1});
    subtitle(L.s === 'player' ? '' : L.s === 'fo' ? 'fo' : L.s === 'gpws' ? 'gpws' : '', (radio ? '📻 ' : pa ? '📢 ' : '') + sp.name + (sp.role ? ` · ${sp.role}` : ''), L.t, L.ar, v.duration);
    await v.done;
  });
  if (L.s !== 'gpws') chans[ch] = run.catch(() => {});
  return run;
}
/** a real controller transmission (or other traffic on the frequency) from the FAA recording */
function atc(id) {
  const c = CLIPS[id]; if (!c) return Promise.resolve();
  const run = chans.radio.then(async () => {
    const v = await playVoice(`assets/flight/atc/${id}.mp3`, null, {volume: id.startsWith('bg') ? 0.55 : 0.95});
    const txt = c.text.replace(/\b(cactus|laguardia|teterboro|hudson|george washington|new york|jetlink|newark|eagle)\b/g, (m) => m.replace(/\b\w/g, x => x.toUpperCase()));
    subtitle('atc', '📻 ' + (id.startsWith('bg') ? 'another airplane on the frequency' : 'Departure Control — real recording'), txt.charAt(0).toUpperCase() + txt.slice(1) + '.', AR_ATC[id] || '', v.duration);
    await v.done;
  });
  chans.radio = run.catch(() => {});
  return run;
}

// ---------------------------------------------------------------- timeline
function at(t, fn, key) { S.events.push({t, fn, key: key || ('e' + S.events.length)}); }
function tick() {
  for (const e of S.events) if (!S.fired.has(e.key) && AC.t >= e.t) { S.fired.add(e.key); try { e.fn(); } catch (err) { console.error(err); } }
}
function objective(t) { $('objtext').textContent = t; }
function toast(html, ms = 4200) { const d = document.createElement('div'); d.className = 'toast'; d.innerHTML = html; $('toasts').appendChild(d); setTimeout(() => d.remove(), ms); }

// ---------------------------------------------------------------- the captain's actions (side buttons)
const ACTS = [   // phys: done with a control in the cockpit (shown as a checklist in learning mode); else a spoken order
  {id: 'myac', from: 2, turn: 1, label: 'Take control: move the stick', en: 'Take the sidestick — arrows / WASD / the stick bottom-left', phys: 'stick', real: 12},
  {id: 'apu', from: 2, turn: 4, label: 'Start the APU', en: 'Overhead: click inside the yellow circle (APU MASTER SW + START)', phys: 'apu', real: 10},
  {id: 'qrh', from: 2, turn: 9, label: 'Ask your first officer for the QRH', en: '"Get the QRH — loss of thrust on both engines"', line: 'cp_qrh', real: 17},
  {id: 'mayday', from: 2, turn: 13, label: 'Mayday on the radio', en: 'Radio: VHF1 key or press T', phys: 'vhf1', real: 22},
  {id: 'pa', from: 25, turn: 100, label: 'Tell the passengers: brace for impact', en: 'PA key or press P', phys: 'pa', real: 120},
  {id: 'ditching', from: 60, turn: 118, label: 'Press DITCHING', en: 'Overhead: DITCHING (the real crew had no time for it)', phys: 'ditching', real: null},
  {id: 'flaps', from: 60, turn: 148, label: 'Lower the flaps', en: 'Pedestal: FLAPS lever (or F)', phys: 'flaps', real: 153},
];
function renderActs() {
  // buttons are kept and updated in place (rebuilding them every few frames swallowed clicks)
  const box = $('actions'); let fresh = 0;
  for (const a of ACTS) {
    const visible = !(AC.t < a.from || S.end);
    let b = box.querySelector(`[data-act="${a.id}"]`);
    if (!visible) { if (b) b.remove(); continue; }
    if (!b) {
      b = document.createElement('button'); b.dataset.act = a.id; b.className = 'act';
      b.innerHTML = `<b></b><i></i><small>${a.en}</small>`;
      if (!a.phys) b.addEventListener('click', () => doAct(a));
      else { b.classList.add('todo', 'phys'); b.title = 'Click to see where it is in the cockpit'; b.addEventListener('click', () => focus(a.phys)); }
      const order = ACTS.indexOf(a), next = [...box.children].find(c => ACTS.findIndex(x => x.id === c.dataset.act) > order);
      box.insertBefore(b, next || null);
      // a new task slides in with a flash and a chime (on the side of the screen, while flying, a quiet new card was missed)
      b.classList.add('enter'); setTimeout(() => b.classList.remove('enter'), 1700); fresh++;
    }
    const done = S.acts[a.id] != null;
    b.querySelector('b').textContent = a.label;
    b.querySelector('i').textContent = done ? '✓ ' + fmt(S.acts[a.id]) : '';
    b.classList.toggle('done', done); b.classList.toggle('hot', !done && AC.t > 0 && a.real != null && AC.t > a.real + 6);
    b.classList.toggle('now', S.guided === a);
    if (a.phys && a.phys !== 'stick' && MODE === 'learn') hint(a.phys, !done && AC.t >= a.from);
  }
  if (fresh && AC.t > 0) try { chime(); } catch (e) {}
}
/** an action comes due: it is announced where the eye is — a banner at the top of the screen with a soft chime — and
 *  its card glows in the list until it is done (in the middle of flying, a new card on the side went unnoticed). A
 *  reminder comes once if it is still not done a few seconds later. */
function alertAct(a, again = false) {
  let el = document.getElementById('actalert');
  if (!el) { el = document.createElement('div'); el.id = 'actalert'; el.innerHTML = '<span></span><b></b><small></small>'; $('hud').appendChild(el); }
  el.querySelector('span').textContent = again ? 'Reminder — not done yet' : 'Your action now';
  el.querySelector('b').textContent = a.label; el.querySelector('small').textContent = a.en;
  el.classList.remove('show', 'again'); void el.offsetWidth; el.classList.add('show'); el.classList.toggle('again', again);
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), again ? 4200 : 5200);
  try { chime(); if (!again) setTimeout(chime, 180); } catch (e) {}
}
/** when an action comes due, the view goes to its control (and comes back to the windscreen once it is done) */
function guideActs() {
  if (S.end || AC.t <= 0) return;
  if (S.guided && S.acts[S.guided.id] != null) {
    const was = S.guided; S.guided = null; S.guideBack = performance.now() + 2500;
    if (was.phys && was.phys !== 'stick') { CK.fovT = null; setTimeout(() => { if (!S.guided) lookHome(); }, 350); }
  }
  if (S.guided && !S.reminded.has(S.guided.id) && performance.now() - S.guidedAt > 7000) { S.reminded.add(S.guided.id); alertAct(S.guided, true); }
  // not done after 12 s: leave it marked in the list and move on to the next one
  if (S.guided && performance.now() - S.guidedAt > 12000) { (S.skipGuide = S.skipGuide || new Set()).add(S.guided.id); S.guided = null; CK.fovT = null; lookHome(); S.guideBack = performance.now() + 1500; }
  if (S.guided || performance.now() < (S.guideBack || 0)) return;
  const due = ACTS.find(a => S.acts[a.id] == null && AC.t >= a.turn && AC.t >= a.from && !(S.skipGuide && S.skipGuide.has(a.id)));
  if (!due) return;
  S.guided = due; S.guidedAt = performance.now(); renderActs(); alertAct(due);
  if (due.phys) focus(due.phys, 7000);
  else { const b = $('actions').querySelector(`[data-act="${due.id}"]`); if (b) { b.classList.add('pulse'); setTimeout(() => b.classList.remove('pulse'), 4000); } }
}
async function doAct(a) {
  if (S.acts[a.id] != null || S.end) return;
  if (a.id === 'mayday') return askMayday();
  S.acts[a.id] = AC.t; renderActs();
  if (a.line) say(a.line, {pa: a.id === 'pa'});
  if (a.id === 'myac') { setTimeout(() => say('fo_yourac'), 900); }
  if (a.id === 'apu') { CK.warn.push({t: 'APU AVAIL', c: 'g'}); }
  if (a.id === 'qrh') qrhSequence(AC.t);
  if (a.id === 'pa') cabinBrace();
  if (a.id === 'flaps') flapsSequence(AC.t);
  if (a.id === 'turnback') { branchTo('LGA13', 'turnback'); }
}
function qrhSequence(t0) {
  const k = Math.max(t0 + 20, 39);
  at(k, () => say('fo_qrh1'));
  at(k + 2.5, () => { say('cp_ignition'); if (CTL.items.engmode && CTL.items.engmode.userData.idx !== 2) foSet('engmode', 2); });
  at(k + 4, () => say('fo_qrh2'));
  at(k + 6, () => { say('cp_idle'); if (CTL.items.thrust && CTL.items.thrust.userData.idx !== 3) foSet('thrust', 3); });
  at(k + 9, () => say('fo_qrh3')); at(k + 12, () => say('cp_wedont'));
  at(Math.max(t0 + 70, 94), () => say('fo_fac')); at(Math.max(t0 + 85, 109), () => say('fo_norelight'));
  at(Math.max(t0 + 100, 125), () => { say('fo_master2'); setTimeout(() => say('cp_backon'), 1500);
    foSet('eng1', 1, 0.4); foSet('eng2', 1, 0.4); foSet('eng1', 0, 0.4); foSet('eng2', 0, 0.4); });
  at(Math.max(t0 + 105, 130), () => { say('fo_power'); setTimeout(() => say('cp_tryone'), 3600); CK.eng[0] = 0.12; });
  at(Math.max(t0 + 120, 145), () => say('fo_backon'));
  at(Math.max(t0 + 128, 153), () => { say('fo_norelight2'); CK.eng[0] = 0; });
}
function flapsSequence(t0) {
  setTimeout(() => say('fo_flapsout'), 5000);
}
// callouts by the real height and speed (they follow whoever is flying)
const CALLS = [
  {k: 'gp_1000', when: () => AC.t > 0 && AC.agl < 305, run: () => say('gp_1000')},
  {k: 'gp_toolow', when: () => AC.t > 0 && AC.agl < 180 && AC.vs < -3, run: () => say('gp_toolow')},
  {k: 'fo_250', when: () => AC.t > 0 && AC.agl < 78, run: () => say('fo_250')},
  {k: 'fo_170', when: () => AC.t > 60 && AC.ias < 172, run: () => { say('fo_170'); setTimeout(() => say('cp_other'), 4200); }},
  {k: 'fo_150', when: () => AC.t > 60 && AC.ias < 152, run: () => say('fo_150')},
  {k: 'gp_50', when: () => AC.t > 0 && AC.agl < 16, run: () => say('gp_50')},
];
let pullT = 0;
onUpdate(() => {
  if (S.end || AC.t <= 0) return;
  AC.agl = AC.agl != null && FLY.on ? AC.agl : AC.alt;
  for (const c of CALLS) if (!S.fired.has(c.k) && c.when()) { S.fired.add(c.k); c.run(); }
  if (AC.agl < 120 && AC.vs < -4 && performance.now() - pullT > 3400) { pullT = performance.now(); say('gp_pullup'); }
  if (FLY.on && FLY.stall && performance.now() - (S.stallT || 0) > 2600) { S.stallT = performance.now(); say('gp_stall'); }
});
let braceLoop = null;
function cabinBrace() {
  setTimeout(() => say('fa_brace'), 3200);
  braceLoop = setInterval(() => { if (S.end) { clearInterval(braceLoop); return; } say(Math.random() < 0.5 ? 'fa_brace' : 'fa_brace2'); }, 7000);
}

// ---------------------------------------------------------------- radio replies
let askState = null;
let pending = null;
/** a reply on the radio: in real time it waits for the push-to-talk (VHF1 key or T); in learning mode it opens at once */
function radioAsk(q, opts, sec, key) {
  if (S.end) return;
  if (MODE === 'learn') return ask(q, opts, sec, key);
  pending = {q, opts, sec, key, t0: AC.t}; S.radioWaiting = true;
  setButton('vhf1', false, true); $('radiohint').classList.remove('hidden');
}
function ptt() {
  if (S.end) return;
  if (pending) { const p = pending; pending = null; S.radioWaiting = false; $('radiohint').classList.add('hidden'); setButton('vhf1', true, false); setTimeout(() => setButton('vhf1', false, false), 2500); ask(p.q, p.opts, Math.max(4, p.sec - (AC.t - p.t0)), p.key); return; }
  if (!S.maydayT && AC.t > 0) { setButton('vhf1', true, false); setTimeout(() => setButton('vhf1', false, false), 2500); return askMayday(); }
  toast('Nobody is waiting for your answer on the radio right now.', 2500);
}
function ask(q, opts, sec, key) {
  if (S.end) return;
  if (askState) closeAsk();
  const box = $('ask'); $('askq').innerHTML = q + (MODE === 'learn' ? ' <em>(time is stopped)</em>' : '');
  const list = $('asklist'); list.innerHTML = '';
  const t0 = AC.t;
  askState = {key, t0, sec, opts};
  for (const o of opts) {
    const L = LINES[o.line];
    const b = document.createElement('button'); b.className = 'ans';
    b.innerHTML = `<b>${L ? '“' + L.t + '”' : o.label}</b>`;    // (what you will say, in English: the game is in English)
    b.onclick = () => answer(o);
    list.appendChild(b);
  }
  box.classList.remove('hidden');
  if (MODE === 'learn') clock.paused = true;
}
function closeAsk() { $('ask').classList.add('hidden'); askState = null; clock.paused = false; }
function answer(o) {
  if (!askState) return;
  const st = askState; closeAsk();
  S.answers[st.key] = {k: o.k, t: AC.t, delay: AC.t - st.t0};
  if (o.line) say(o.line, {radio: o.radio !== false && st.key !== 'flaps'});
  if (o.act) o.act();
  if (MODE === 'learn' && o.note) toast(o.note, 6500);
}
onUpdate(() => {
  if (pending && AC.t - pending.t0 > pending.sec) { S.answers[pending.key] = {k: 'none', t: AC.t, delay: pending.sec}; pending = null; S.radioWaiting = false; $('radiohint').classList.add('hidden'); setButton('vhf1', false, false); }
  if (!askState || MODE === 'learn') return;
  const f = Math.max(0, 1 - (AC.t - askState.t0) / askState.sec); $('askbar').style.transform = `scaleX(${f})`;
  if (f <= 0) { S.answers[askState.key] = {k: 'none', t: AC.t, delay: askState.sec}; closeAsk(); }
});
function askMayday() {
  ask('Call on the departure frequency:', [
    {k: 'clear', line: 'cp_mayday', act: () => maydayDone('clear'), note: 'Clear and short: what happened, and what you intend.'},
    {k: 'vague', line: 'cp_vague', act: () => maydayDone('vague'), note: 'The controller does not yet know you have no engines — he cannot help you.'},
  ], 12, 'mayday');
}
function maydayDone(kind) {
  S.acts.mayday = AC.t; S.mayday = kind; renderActs();
  if (kind === 'vague') { setTimeout(() => toast('The controller has not understood the emergency. Call again, clearly.'), 2500); S.acts.mayday = null; S.vague = (S.vague || 0) + 1; ACTS.find(a => a.id === 'mayday').label = 'Call again, clearly'; renderActs(); return; }
  S.maydayT = AC.t;
  const k = AC.t + 9;
  at(k, () => { atc('atc_220'); setTimeout(() => say('cp_220', {radio: true}), 5600); }, 'atc_220');
  // the controller's offers, at their real times (or after he learned of the emergency)
  const off = (t) => Math.max(t, k + 10 + (t - 54) * 0.3);
  at(off(54), () => { atc('atc_rwy13').then(() => radioAsk('The controller offers runway 13 at LaGuardia. Your answer:', [
    {k: 'unable', line: 'cp_unable_hudson', note: 'Look at the green circle on the navigation display: LaGuardia is outside it.'},
    {k: 'accept', line: 'cp_accept13', act: () => branchTo('LGA13', 'rwy13'), note: 'The airplane will turn toward the airport…'},
  ], 9, 'rwy13')); }, 'atc_rwy13');
  at(off(66), () => { atc('bg_jl4'); atc('bg_jl5'); }, 'bg_jl45');
  at(off(80), () => { if (S.branch) return; atc('atc_31').then(() => radioAsk('Controller: “It’s gonna be left traffic for runway 31.” Your answer:', [
    {k: 'unable', line: 'cp_unable'}, {k: 'accept', line: 'cp_accept13', act: () => branchTo('LGA13', 'rwy31')},
  ], 6, 'rwy31')); }, 'atc_31');
  at(off(85), () => { if (!S.branch) atc('atc_land'); }, 'atc_land');
  at(off(95), () => { if (S.branch) return; atc('atc_rwy4').then(() => radioAsk('Controller: runway 4 is available. Your answer:', [
    {k: 'teb', line: 'cp_teb_q', note: 'Asking about the alternatives — as the real captain did.'},
    {k: 'accept', line: 'cp_accept4', act: () => branchTo('LGA4', 'rwy4')},
    {k: 'hudson', line: 'cp_hudson', act: () => { S.hudsonT = AC.t; }, note: 'An early, clear decision: the river.'},
  ], 9, 'rwy4')); }, 'atc_rwy4');
  at(off(104), () => { if (S.branch || (S.answers.rwy4 && S.answers.rwy4.k !== 'teb')) return; atc('atc_teb_right'); }, 'atc_teb_right');
  at(off(111), () => { if (S.branch) return; atc('atc_teb_q').then(() => radioAsk('Controller: do you want to try to go to Teterboro?', [
    {k: 'yes', line: 'cp_yes', note: 'The real captain said “yes” — then worked it out again seconds later.'},
    {k: 'hudson', line: 'cp_hudson', act: () => { S.hudsonT = S.hudsonT || AC.t; }},
  ], 6, 'tebq')); }, 'atc_teb_q');
  at(off(130), () => { if (S.branch) return; atc('atc_teb_280').then(() => radioAsk('Controller: turn right 280, runway 1 at Teterboro. Your answer:', [
    {k: 'cant', line: 'cp_cant', note: 'Teterboro is outside the green circle.'},
    {k: 'go', line: 'cp_teb_go', act: () => branchTo('TEB1', 'teb'), note: 'The airplane will turn west toward New Jersey…'},
  ], 6, 'teb280')); }, 'atc_teb_280');
  at(off(135), () => { if (S.branch || S.hudsonT) return; atc('atc_teb_which').then(() => { if (!S.hudsonT && !S.branch) radioAsk('Controller: which runway would you like at Teterboro?', [
    {k: 'hudson', line: 'cp_hudson', act: () => { S.hudsonT = AC.t; }, note: '“We’re gonna be in the Hudson” — what the real captain said.'},
  ], 6, 'tebwhich'); }); }, 'atc_teb_which');
  at(off(142), () => { if (!S.branch) atc('atc_sayagain'); }, 'atc_sayagain');
}
function branchTo(key, why) {
  if (FLY.on) { S.intent = {key, why, t: AC.t}; objective('You are flying: head for ' + AIRPORTS[key].name + ' yourself — watch the green circle.'); return; }
  if (S.branch) return; S.branch = {key, why, t: AC.t};
  startBranch(key);
  objective('Turning toward ' + AIRPORTS[key].name);
}

// ---------------------------------------------------------------- the script
function onCtl(id, st) {
  if (S.end && !(S.afloat && ['evac', 'pa', 'mwarn'].includes(id))) return;
  if (id === 'mwarn') { masterWarning(false); warn(false); return; }
  if (id === 'vhf1') return ptt();
  if (id === 'pa') {
    if (S.afloat) { evacOrder('pa'); return; }
    if (AC.t > 0 && S.acts.pa == null) { S.acts.pa = AC.t; say('cp_pa', {pa: true}); cabinBrace(); setButton('pa', true, false); renderActs(); }
    return;
  }
  if (AC.t <= 0) { toast('Everything is normal now — no need for this.', 2200); return; }
  // the APU's one big ring: MASTER SW, then START a moment later, from a single click
  if (id === 'apu') {
    if (S.acts.apu != null) return;
    hint('apu', false, 'focus'); hint('apu', false, 'learn');
    if (S.apuMaster == null) onCtl('apu_master');
    setTimeout(() => onCtl('apu_start'), 700);
    return;
  }
  if (id === 'apu_master') { if (S.apuMaster == null) { S.apuMaster = AC.t; setButton('apu_master', true, false); } return; }
  if (id === 'apu_start') {
    if (!S.apuMaster) { toast('First: APU MASTER SW', 2600); return; }
    if (S.acts.apu != null) return;
    S.acts.apu = AC.t; say('cp_apu'); setButton('apu_start', true, false); renderActs();
    setTimeout(() => { setButton('apu_start', false, true); CK.warn.push({t: 'APU AVAIL', c: 'g'}); setLaw('normal'); S.law = 'normal'; }, 22000);
    return;
  }
  if (id === 'engmode' && st === 'IGN/START' && S.acts.ign == null) { S.acts.ign = AC.t; say('cp_ign'); renderActs(); return; }
  if (id === 'thrust' && st === 'IDLE') { S.thrIdle = AC.t; return; }
  if (id === 'eng1' || id === 'eng2') { S.masters = (S.masters || 0) + 1; if (st === 'ON') setTimeout(() => say('fo_norelight2'), 6000); return; }
  if (id === 'flaps') {
    const idx = ['0', '1', '2', '3', 'FULL'].indexOf(st); AC.flaps = idx;
    if (S.acts.flaps == null) { S.acts.flaps = AC.t; say('cp_flaps'); flapsSequence(AC.t); renderActs(); }
    const vfe = [999, 230, 200, 185, 177][idx]; if (AC.ias > vfe + 5) { toast('Too fast for the flaps (' + vfe + ' kt)', 2600); CK.warn.unshift({t: 'OVERSPEED', c: 'r'}); }
    return;
  }
  if (id === 'ditching' && S.acts.ditching == null) { S.acts.ditching = AC.t; setButton('ditching', true, false); renderActs(); return; }
  if (id === 'evac') { if (S.afloat) evacOrder('evac'); else toast('Evacuation — once the airplane has stopped.', 2200); return; }
}
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'KeyT') onCtl('vhf1');
  if (e.code === 'KeyP') onCtl('pa');
  if (e.code === 'KeyF') nudge('flaps', e.shiftKey ? -1 : 1);
});
export function buildScript(mode) {
  MODE = mode;
  onControl(onCtl);
  // before the strike: a normal climb out of LaGuardia
  // the departure calls (T−80, −73, −66 on the tape) follow one another over the outside shots: the cut into the cockpit
  // skips to T_COCKPIT, and calls left for later would talk over "what a view of the Hudson"
  at(T_START + 1, () => say('cp_dep', {radio: true}));
  at(T_START + 1.5, () => atc('atc_radar'));
  at(T_START + 2, () => say('cp_maint', {radio: true}));
  at(T_START, () => { objective('Climbing to 5,000 ft. Clear weather, the Hudson on your left.'); });   // (the rescue people load with the game: loading them here froze the climb)
  at(-34, () => { say('cp_view'); setTimeout(() => say('fo_yeah'), 2200); lookTo(0.55, -0.12, 5000); });
  at(-24, () => lookHome());
  at(-9, () => { atc('bg_jl1'); atc('bg_jl2'); });
  at(-6, () => { placeFlock(0); lookTo(0, 0, 6000); });
  at(-1.2, () => say('cp_birds'));
  // the strike
  at(0, () => strike());
  at(0.5, () => atc('bg_jl3'));
  at(3, () => say('fo_uhoh'));
  at(4.5, () => { say('cp_rollback'); renderActs(); objective('Both engines have stopped. You are at 3,000 ft over the Bronx. Decide.'); });
  at(21, () => { if (!S.maydayT) atc('atc_270'); });
  at(74, () => { CK.eng[0] = 0.18; });       // "the left one's coming back up a little bit"
  at(80, () => { CK.eng[0] = 0.06; });
  at(160, () => { if (!S.branch) atc('atc_lost'); });
  at(166, () => say('gp_gear'));
  at(175, () => { atc('bg_eg1'); atc('bg_eg2'); });
  at(183, () => { if (!S.branch) atc('atc_still'); });
  at(190, () => { if (!S.branch) { say('cp_ideas'); setTimeout(() => say('fo_actually'), 1600); } });
  at(191, () => { if (!S.branch) atc('atc_newark'); });
  at(205, () => { if (!S.branch) { say('fo_switch'); setTimeout(() => say('cp_yes2'), 900); } });
  at(210.6, () => { if (!S.branch) say('cp_brace'); });
  at(212, () => { if (!S.branch && !FLY.on) touchdown(); });
  // the objective follows the flight
  at(60, () => { if (!S.branch) objective('Gliding west with no engines. The green circle shrinks every second.'); });
  at(105, () => { if (!S.branch) objective('Over the George Washington Bridge. The Hudson runs straight south ahead of you.'); });
  at(160, () => { if (!S.branch) objective('Low over the river. Prepare the airplane and the passengers for the water.'); });
}
function strike() {
  thumps(5); CK.rumble = 1; birdSplats(3); noseSplats(); masterWarning(true); warn(true); showStick(true);
  // electrical power after a dual engine failure: without the APU the flight controls lose their protections
  setTimeout(() => { if (S.acts.apu == null && !S.end) { setLaw('alternate'); S.law = 'alternate'; CK.warn.unshift({t: 'F/CTL ALTN LAW', c: 'a'}); if (MODE === 'learn') toast('Without the APU the flight controls have lost their protections (ALTN LAW). The airplane can stall if you raise the nose too far.', 7000); } }, 20000);
  CK.warn = [{t: 'ENG 1 STALL', c: 'a'}, {t: 'ENG 2 STALL', c: 'a'}];
  const t0 = performance.now();
  const off = onUpdate(() => { const k = Math.min(1, (performance.now() - t0) / 6000); CK.eng = [Math.max(0, 1 - k * 1.05), Math.max(0, 1 - k)]; if (k >= 1) off(); });
  setTimeout(() => { CK.warn.unshift({t: 'ENG DUAL FAILURE', c: 'r'}); }, 5000);
  setTimeout(() => masterWarning(false), 9000);
  setTimeout(() => { if (AC.flock) AC.flock.visible = false; }, 1800);
  const r0 = performance.now(); const offR = onUpdate(() => { if (AC.t > 57) { CK.rumble = Math.max(0, CK.rumble - 0.02); if (CK.rumble <= 0) offR(); } });
  void r0;
}

// ---------------------------------------------------------------- run and endings
// the quiet climb before the strike is shortened: one camera move outside, ORBIT seconds (the departure calls play
// over them), and the cut into the cockpit skips the clock ahead to T_COCKPIT, just before the real "what a view of the
// Hudson today" (T−34) — the birds come about 50 s after the start instead of about 90
export const ORBIT = 10, T_COCKPIT = -37;   // the outside camera move (s); the clock at the cut into the cockpit
// the clock at the start of the opening: the camera move outside ends where the view from the cockpit begins
export const T_START = T_COCKPIT - ORBIT - 2;
export async function run(mode, {lines, clips, speakers}) {
  GT.opening = true;
  LINES = lines; CLIPS = clips; SPK = speakers;
  buildScript(mode);
  startSound();
  if (CK.fo) setupFO(CK.fo);
  startGuide(S, {want: () => {
    const k = [];
    if (S.radioWaiting || (AC.t >= 13 && S.maydayT == null && !S.end)) k.push('T');
    if ((AC.t >= 100 && S.acts.pa == null && !S.end) || (S.evacWait && S.acts.evac == null)) k.push('P');
    if (AC.t >= 148 && !S.end && CTL.items.flaps && CTL.items.flaps.userData.idx < 2) k.push('F');
    return k;
  }});
  await freeze();                                   // (under the opening title, main.js)
  show('hud', true);
  AC.t = T_START;
  // opening shot: outside, climbing away from LaGuardia
  seat(false); CK.group.visible = false; if (AC.ext) AC.ext.visible = true;
  // the outside of the airplane is one continuous camera move, not shots cut together (each cut held the picture while
  // the new view's city arrived, and the switch from one side to the other read as a stutter): from behind, round its
  // left side, to ahead of it, travelling with it. Keyed in the airplane's heading frame as [angle from the nose toward
  // the left, distance, height]; it waits at its first pose until the title lifts
  const D2 = Math.PI / 180;
  const orbit = new THREE.CatmullRomCurve3([V(160 * D2, 74, 12), V(82 * D2, 56, 4), V(25 * D2, 95, 9)], false, 'centripetal');
  let orbitT0 = null;
  const orbitU = () => { if (orbitT0 == null) return 0; const u = Math.min(1, (performance.now() - orbitT0) / 1000 / ORBIT); return u * u * (3 - 2 * u); };
  const orbitPos = () => { const q = orbit.getPoint(orbitU()), {fwd, side} = chaseFrame(); return AC.pos.clone().addScaledVector(fwd, q.y * Math.cos(q.x)).addScaledVector(side, q.y * Math.sin(q.x)).add(V(0, q.z, 0)); };
  cine.hold(orbitPos, () => AC.pos.clone(), {fov: 42});
  // the first frame shows the real city, not its first coarse tiles: under the held frame, the tiles in view are waited for
  // (the photographed city is the only one: a coarse tile close to the camera is a torn slab)
  // from now on only what this camera sees is fetched (the menu's and the other shots' requests would stand before it)
  if (GT.shotShown) GT.shotShown(0);
  await sharpen(12000);                             // (its tiles have been loading since the site opened)
  const off = onUpdate((dt) => {
    if (S.end) return;
    if (AC.t > 0 && !FLY.on && !S.branch && anyInput()) { takeControl(); S.acts.myac = AC.t; say('cp_myac'); setTimeout(() => say('fo_yourac'), 900); objective('You are flying now. Keep your speed up and head for the place you chose.'); renderActs(); }
    acUpdate(dt); tick();
    $('clk').textContent = hhmmss(AC.t) + ' EST'; $('tplus').textContent = AC.t >= 0 ? `after the strike: ${Math.floor(AC.t)} s` : '';
    if (AC.t >= 0) renderActsThrottled();
    if (S.branch && AC.branch && AC.branch.done && !S.end) branchEnd(AC.branch.done);
  });
  // about 12 seconds outside before the cockpit: from behind, then alongside, then the airplane climbing past the camera
  // (no viewpoint fetches other views' tiles while the camera moves in the open: the tiles chosen for any viewpoint are
  //  drawn too, and another view's coarse ones stood as blurred slabs in this one)
  $('hud').classList.add('cine');
  orbitT0 = performance.now();                      // the camera starts moving as the title lifts
  await thaw(); await hideTitle();
  await wait(ORBIT * 0.55 - 0.75);
  // the cut into the cockpit skips ahead along the real track. Its view starts loading during the last part of the move:
  // the camera is then ahead of the airplane looking back at it, the windscreen's view looks ahead, kilometres on, so
  // those tiles are not in this picture (and fewer arrive all at once after the cut)
  const inCam = new THREE.PerspectiveCamera(62, camera.aspect, 1, 120000), there = sampleReal(T_COCKPIT, {pos: V()}), ha = there.hdg * Math.PI / 180;
  inCam.position.copy(there.pos).add(V(0, 1.5, 0)); inCam.lookAt(there.pos.clone().add(V(Math.sin(ha) * 1000, -150, -Math.cos(ha) * 1000))); inCam.updateMatrixWorld();
  const dropIn = addViewpoint(inCam, 1);
  await wait(ORBIT * 0.45);
  // at the end of its move the camera keeps travelling with the airplane until the cockpit's view, loading through its
  // own viewpoint, is sharp too: then a straight cut, with nothing held on screen (a held frame read as a hang)
  { const t0 = performance.now(); let ok = 0; while (performance.now() - t0 < 3500 && ok < 3) { await wait(0.1); ok = coarseNear() === 0 ? ok + 1 : 0; } }
  await freeze();
  $('hud').classList.remove('cine');
  cine.stop(); if (AC.ext) AC.ext.visible = false; CK.group.visible = true; seat(true);
  if (AC.t < T_COCKPIT) { AC.t = T_COCKPIT; acUpdate(0); }   // the radio calls skipped over still play, the objective is set
  dropIn();
  lookHome(); CK.autoHome = true;                   // from now on the view always finds its way back to the windscreen
  setDetail('flight');                              // into the cockpit: the flight's level of detail
  await sharpen(1200, 100, 120);                    // (its city is here already: a frame or two)
  await thaw();
  FLY.onTouch = (t) => { if (t.kind === 'water') touchdown(t); else if (t.kind === 'runway') runwayEnd(t); else crashEnd(); };
  FLY.onCrash = () => crashEnd();
  return new Promise(res => { S.done = res; void off; });
}
let rT = 0; function renderActsThrottled() { const n = performance.now(); if (n - rT > 400) { rT = n; renderActs(); guideActs(); } }

const GRADE = {
  smooth: 'Smooth touchdown: wings level, nose up, a slow descent — the fuselage stayed whole.',
  hard: 'Hard touchdown: the tail was damaged and water came in at the back — as it really happened.',
  broken: 'Violent impact: a fast descent or a banked wing — the fuselage broke open and water rushed in. The evacuation became a race against time.',
};
async function touchdown(t = null) {
  S.end = t && t.grade === 'broken' ? 'broken' : 'ditched'; S.afloat = true; S.landing = t; closeAsk(); masterWarning(false); warn(false); showStick(false);
  if (pending) { pending = null; $('radiohint').classList.add('hidden'); }
  ditch(); CK.rumble = t && t.grade !== 'smooth' ? 4 : 2.5; setTimeout(() => { CK.rumble = 0.25; }, 2500);
  spray(t ? t.ias * 0.5144 : 64, t && t.grade !== 'smooth' ? 1.6 : 1);
  if (braceLoop) clearInterval(braceLoop);
  if (!FLY.on) sampleReal(212);
  // the airplane slides to a stop and floats: the order to evacuate is the captain's (the EVAC button or the PA)
  const t0 = performance.now(); S.touchT = t0; S.evacWait = true;
  // it slides about 300 m, settles nose-up with the tail lower (water coming in at the back), and rocks on the chop
  const fwd = V(Math.sin(AC.hdg * Math.PI / 180), 0, -Math.cos(AC.hdg * Math.PI / 180)), v0 = (t ? t.ias : 125) * 0.5144;
  // the river answers: foam along the hull, the wake of the slide, rings running out from where it hit (water shader)
  const wu = W.water && W.water.material.uniforms;
  if (wu) { wu.uTouch.value.set(AC.pos.x, AC.pos.z, 1); }
  const bob = onUpdate((dt) => {
    if (!S.afloat) return bob();
    const k = (performance.now() - t0) / 1000, v = v0 * Math.exp(-k * 0.55);
    AC.pos.addScaledVector(fwd, v * dt); AC.pos.y = 1.2 - Math.min(0.5, k * 0.02);
    AC.pitch = (t && t.grade !== 'smooth' ? 4 : 2) * Math.exp(-k * 0.6) + 1.5 * (1 - Math.exp(-k * 0.2)) + Math.sin(k * 1.3) * 0.5; AC.bank = Math.sin(k * 0.9) * 0.8;
    AC.group.position.copy(AC.pos); AC.group.rotation.set(-AC.pitch * Math.PI / 180, Math.PI - AC.hdg * Math.PI / 180, AC.bank * Math.PI / 180, 'YXZ');
    if (wu) wu.uWake.value.set(AC.pos.x, AC.pos.z, AC.hdg * Math.PI / 180, k);
  });
  await wait(2.4);
  // the ending's first two views, where the airplane will come to rest (it still slides on: about v/0.55 m more), fetched
  // during the wait for the evacuation order, so the ending does not open on a long black screen
  const rest = fwd.clone().multiplyScalar(v0 * Math.exp(-2.4 * 0.55) / 0.55);
  const P0 = (x, y, z) => AC.group.localToWorld(V(x, y, z)).add(rest);
  const endViews = [[P0(10.5, 1.3, 21.5), P0(2.8, 0.1, 13.3), 36], [P0(17, 2.4, 21), P0(5.5, 0.1, 12.5), 40]].map(([p, l, fov]) => {
    const c = new THREE.PerspectiveCamera(fov, camera.aspect, 0.5, 120000); c.position.copy(p); c.lookAt(l); c.updateMatrixWorld(); return addViewpoint(c, 1);
  });
  $('actions').innerHTML = '';
  objective('The airplane has stopped and is floating. Water is coming in at the back — order the evacuation: EVAC on the overhead panel, or P.');
  if (MODE === 'learn') hint('evac', true); else setButton('evac', true, false);
  focus('evac', 12000);
  const tEnd = performance.now() + 15000;
  while (!S.acts.evac && performance.now() < tEnd) await wait(0.2);
  if (!S.acts.evac) { S.evacLate = true; say('fa_evac'); }          // the flight attendants start it themselves
  hint('evac', false); S.evacWait = false;
  await wait(S.acts.evac ? 2.6 : 3.2);
  await fade(true, 300);
  // outside: the airplane on the river, nose a little high, Manhattan's west side behind it, the low sun
  seat(false); CK.group.visible = false; if (AC.ext) AC.ext.visible = true;
  if (t && t.grade === 'broken') AC.pos.y = 0.2;
  let ev = null;
  try { await Promise.race([preloadRescue(), wait(4)]); ev = showRescue(); } catch (e) { console.warn('rescue', e); }
  $('hud').classList.add('cine');                // only the subtitles stay on screen
  setDetail('cinema');
  const L = (x, y, z) => AC.group.localToWorld(V(x, y, z));   // the airplane's frame: +x the left wing, +z the nose
  // the forward left door, from a boat's height: it opens, and its slide-raft inflates down onto the river
  cine.fly([L(10.5, 1.3, 21.5), L(9.2, 1.1, 19.5)], () => L(2.8, 0.1, 13.3), 9, {fov: 36});
  endViews.forEach(d => d());                       // (their tiles are in the cache: only this camera chooses now)
  await sharpen(2500, 200, 200);
  await fade(false, 800);
  setTimeout(() => say('fa_vests'), 600);
  caption((t ? hhmmss(AC.t) : '15:30:43') + ' — the airplane is on the Hudson River.<br>' + (t ? GRADE[t.grade] + `<br><small>speed ${Math.round(t.ias)} kt · sink ${Math.round(t.sink)} ft/min · pitch ${t.pitch.toFixed(1)}° · bank ${t.bank.toFixed(1)}°</small>` : 'Your first officer set it down as on the real flight. Water at 5 °C, air below freezing.'), 6500);
  if (ev) { await wait(0.6); await ev.openDoor(); await ev.inflate(); } else await wait(5);
  // the passengers come down the slide into the raft while the boats close in
  await freeze();
  cine.fly([L(17, 2.4, 21), L(14.5, 2.0, 17)], () => L(5.5, 0.1, 12.5), 10, {fov: 40});
  await wait(0.15); await sharpen(5000); await thaw();
  if (ev) ev.deplane();
  await wait(8.5);
  // from above: the people on the wings and in the raft, the ferries alongside
  await freeze();
  cine.fly([L(75, 28, 48), L(58, 21, 28)], () => L(6, 0, 3), 10, {fov: 44, fov1: 38});
  await wait(0.15); await sharpen(5000); await thaw();
  caption('The first ferry arrived in under four minutes.<br>Everyone was rescued: 150 passengers and 5 crew.', 6500);
  await wait(8);
  S.afloat = false;
  finish();
}
/** the river thrown up by the engines and the hull as they dig in: thousands of droplets, out to the sides and up past the
 *  windows, falling back over three seconds (opaque round points: they must draw through the cockpit glass) */
function spray(v0, k = 1) {
  const N = Math.round(11000 * k), pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), born = new Float32Array(N);
  const hd = AC.hdg * Math.PI / 180, F = V(Math.sin(hd), 0, -Math.cos(hd)), R = V(-F.z, 0, F.x);
  const src = [[5.75, 3], [-5.75, 3], [1.8, 8], [-1.8, 8], [0, -4], [8.5, -2], [-8.5, -2]];
  for (let i = 0; i < N; i++) {
    const [sx, sz] = src[i % src.length], side = Math.sign(sx || (Math.random() - 0.5));
    const p = AC.pos.clone().addScaledVector(R, sx * -1 + (Math.random() - 0.5) * 2).addScaledVector(F, sz + (Math.random() - 0.5) * 3); p.y = 0.2;
    pos.set([p.x, p.y, p.z], i * 3);
    const out = (4 + Math.random() * 10) * k, up = (3 + Math.random() * 11) * k, fw = v0 * (0.35 + Math.random() * 0.4);
    const d = F.clone().multiplyScalar(fw).addScaledVector(R, -side * out); d.y = up;
    vel.set([d.x, d.y, d.z], i * 3); born[i] = Math.random() * 1.6;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); const gr = x.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, '#fff'); gr.addColorStop(0.6, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 32, 32);
  const m = new THREE.PointsMaterial({color: 0xe6edf0, size: 0.26, map: new THREE.CanvasTexture(c), alphaTest: 0.4, sizeAttenuation: true});
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; W.group.add(pts);
  let t = 0;
  const off = onUpdate((dt) => {
    t += dt;
    for (let i = 0; i < N; i++) {
      if (t < born[i]) continue;
      const j = i * 3; vel[j + 1] -= 9.81 * dt; vel[j] *= 1 - dt * 0.6; vel[j + 2] *= 1 - dt * 0.6;
      pos[j] += vel[j] * dt; pos[j + 1] += vel[j + 1] * dt; pos[j + 2] += vel[j + 2] * dt;
      if (pos[j + 1] < 0) pos[j + 1] = -50;                    // back in the river
    }
    g.attributes.position.needsUpdate = true;
    if (t > 5) { off(); W.group.remove(pts); g.dispose(); m.dispose(); }
  });
}
/** the evacuation order (EVAC button or PA), once the airplane has stopped */
function evacOrder(how) {
  if (S.acts.evac || !S.evacWait) return;
  S.acts.evac = (performance.now() - S.touchT) / 1000; S.evacHow = how;
  setButton('evac', true, true); hint('evac', false);
  say('cp_evac', {pa: true}); setTimeout(() => say('fa_evac'), 1400);
}
/** landed on a runway (hand flown) */
async function runwayEnd(t) {
  if (S.end) return; S.end = 'reached'; S.landing = t; closeAsk(); masterWarning(false); warn(false); showStick(false);
  CK.rumble = 1.5; setTimeout(() => { CK.rumble = 0; }, 1800);
  await wait(3); await fade(true, 600); silence();
  caption('You landed on ' + (AIRPORTS[t.runway] ? AIRPORTS[t.runway].name : 'the runway') + ' — in this simulation.<br>The investigation’s tests showed a return was possible only if the turn began at the moment of the strike, with no time at all to understand what happened — which no real pilot has.', 9500);
  await wait(10);
  finish();
}
/** flown into the ground (short of a runway, or not to the river) */
async function crashEnd() {
  if (S.end) return; S.end = 'short'; closeAsk(); masterWarning(false); warn(false); showStick(false);
  say('gp_pullup'); await wait(1.6); await fade(true, 200); silence();
  const nearLGA = AC.pos.distanceTo(AIRPORTS.LGA13.p) < 6000 || AC.pos.distanceTo(AIRPORTS.LGA4.p) < 6000, nearTEB = AC.pos.distanceTo(AIRPORTS.TEB1.p) < 6000;
  caption((nearLGA || nearTEB ? 'The airplane did not reach the runway.' : 'The height ran out over the city before the water.') + '<br>In the investigation’s tests, a return to LaGuardia worked only when the turn began at the very moment of the strike —<br>with a 35-second delay (time to understand and decide) it failed. Teterboro was out of reach.', 9500);
  await wait(10);
  finish();
}
async function branchEnd(kind) {
  S.end = kind === 'reached' ? 'reached' : 'short'; closeAsk(); masterWarning(false);
  if (kind === 'short') {
    say('gp_pullup'); await wait(2.4); await fade(true, 250); silence();
    caption('The airplane did not reach the runway.<br>In the investigation’s tests, a return to the airport worked only when the turn began at the very moment of the strike —<br>with a delay of just 35 seconds (time to understand and decide) it failed.', 9000);
    await wait(9.5);
  } else {
    await fade(true, 600); silence();
    caption('The airplane reached the runway — in this simulation.<br>The investigation’s tests showed this is possible in theory only if the decision is made at the moment of the strike, with no time to understand what happened. That is not realistic.', 9000);
    await wait(9.5);
  }
  finish();
}
function silence() { CK.eng = [0, 0]; CK.rumble = 0; }
function caption(html, ms) { const c = $('caption'); c.innerHTML = `<span class="cap">${html}</span>`; c.classList.add('on'); setTimeout(() => c.classList.remove('on'), ms); }
function finish() { show('hud', false); S.done && S.done(S); }
export {S as STATE, fmt, hhmmss};
