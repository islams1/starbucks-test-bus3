// Quick version (?mini=1): only the player, Nadia and two seated colleagues. One short brief, then the desk tasks
// (finance, evidence, branch chat, consent, brief), a short meeting where each slide reveals its points, the plan
// decision and a score out of 100 built only from what the player did.
import * as THREE from 'three';
import {onUpdate, wait, clock, Q} from '../core/engine.js';
import {onKey} from '../core/input.js';
import {sfx, startAmbience, setAmbienceLevel, playVoice} from '../core/audio.js';
import * as cine from '../core/cine.js';
import {characters as C} from '../actors/character.js';
import {player, teleport} from '../actors/player.js';
import {anchors, roomAt} from '../world/building.js';
import {objective, toast, fade, letterbox, hud, $} from '../ui/ui.js';
import {addHotspot, markDone, setHotspotsBusy, hotspots} from '../ui/hotspots.js';
import * as D from '../ui/docs.js';
import {briefDoc, SEGTXT, conflicts} from '../ui/brief.js';
import {initDeskHands, pick, openLaptop} from '../actors/deskhands.js';
import {setSteps} from '../ui/tracker.js';
import {mapState} from '../ui/map.js';
import {S, gain, log, setNode, evaluateEnding, EVIDENCE, FULL_URL} from './state.js';
import {sit, stand, startBackground} from './cast.js';
import {showPlans, tensionButtons, showResult} from './endings.js';
import * as F from './flow.js';
import {scoreParts, totalScore, grade, slidePoints, SLIDES, elapsed, clockText} from './score.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
let LINES = null;
const NADIA_SEAT = 1;                       // far side of the table, facing the screen end
const MEET_DOOR = {x: 1.8, z: -5.5};
/** signed number kept left-to-right inside Arabic text (+10, −3) */
const num = (n) => `<bdi dir="ltr">${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}</bdi>`;

const STEPS = [
  {id: 'sit', t: 'اجلس إلى مكتبك', done: () => !!S.sat, hs: 'sit'},
  {id: 'research', t: '«ملف الأبحاث»: حل المهمتين واختر الشريحة', done: () => S.segment !== 'none', hs: 'desk_folder'},
  {id: 'budget', t: '«ورقة الميزانية»: احسب، ثم وزّع واعتمد', done: () => !!S.tasks.discountShare && !!S.tasks.budget, hs: 'desk_budget'},
  {id: 'laptop', t: '«اللابتوب»: راسل الفرع واقرأ تقرير الاختبار', done: () => !!S.nodes.N03 && !!S.ev.M7, opt: true, hs: 'desk_laptop'},
  {id: 'booklet', t: 'اقرأ «دليل العلامة»', done: () => !!S.ev.M5, opt: true, hs: 'desk_booklet'},
  {id: 'script', t: '«سيناريو الفيلم»: اقرأ وقرّر', done: () => !!S.nodes.N05, opt: true, hs: 'desk_script'},
  {id: 'envelope', t: 'افتح «الظرف الرمادي»', done: () => !!S.ev.M9, opt: true, hs: 'desk_envelope'},
  {id: 'brief', t: '«التابلت»: ابنِ الموجز واعتمده', done: () => !!S.briefBuilt, hs: 'desk_tablet'},
  {id: 'meeting', t: 'اعرض موجزك على نادية في قاعة الاجتماعات', done: () => !!S.briefAnswered, hs: 'present'},
  {id: 'plan', t: 'اختر الخطة', done: () => !!S.ending},
];
function miniObjective() {
  if (!S.sat) return 'اجلس إلى مكتبك — كل ما تحتاجه عليه';
  if (S.segment === 'none') return 'افتح «ملف الأبحاث»: حل المهمتين واختر الشريحة المستهدفة';
  if (!S.briefBuilt) return 'اجمع الأدلة من مكتبك، ثم ابنِ الموجز على «التابلت»';
  return 'اذهب إلى قاعة الاجتماعات واضغط E عند الشاشة لتبدأ العرض';
}

// ---------------------------------------------------------------- live score (top centre) + timer
function scoreHud() {
  const box = document.createElement('div'); box.id = 'scorebox'; box.className = 'hidden';
  box.innerHTML = `<div class="sb-l"><span>النقاط</span><b id="scval">0</b><small>من 100</small></div><div class="sb-t">⏱ <span id="sctime">0:00</span></div><div id="scpops"></div>`;
  document.body.appendChild(box);
  const prev = new Map(); let shown = 0, last = performance.now();
  setInterval(() => {
    const now = performance.now();
    if (S.miniT0 && S.miniTime == null && !clock.paused) S.miniElapsed = (S.miniElapsed || 0) + (now - last) / 1000;
    last = now;
    box.classList.toggle('hidden', !S.miniT0 || !!S.ending);
    $('sctime').textContent = clockText();
    const parts = scoreParts();
    for (const p of parts) for (const it of p.items) {
      if (it.hidden) continue;
      const was = prev.has(it.id) ? prev.get(it.id) : 0;
      if (it.pts !== was && !S.meetingStarted) pop(it.pts - was, it.t);
      prev.set(it.id, it.pts);
    }
    const tot = totalScore(parts);
    if (tot !== shown) { shown = tot; $('scval').textContent = tot; box.animate([{transform: 'translateX(-50%) scale(1.12)'}, {transform: 'translateX(-50%) scale(1)'}], {duration: 350}); }
  }, 250);
}
function pop(d, label) {
  const p = document.createElement('div'); p.className = 'scpop ' + (d > 0 ? 'up' : 'down');
  p.innerHTML = `<b>${num(d)}</b>${label}`;
  $('scpops').appendChild(p); setTimeout(() => p.remove(), 2700);
}

// ---------------------------------------------------------------- desk
function deskItem(id, label, icon, fn, {manual = false, done = () => true} = {}) {
  const it = anchors.deskItems[id];
  addHotspot({id: 'desk_' + id, label, icon, desk: true, deskOnly: true, pos: V3(it.x, it.y + 0.06, it.z), use: async () => {
    if (id === 'laptop' || manual) await fn(); else { const putBack = await pick(anchors.deskObjs[id], {open: id === 'folder' || id === 'booklet'}); await fn(); await putBack(); }
    if (done()) markDone('desk_' + id);
    objective(miniObjective());
  }});
}
/** the branch supervisor, by chat instead of a video call: she answers with voice notes (transcript shown under each) */
async function branchChat() {
  const T = (id) => LINES[id].t;
  const vn = (id) => `<div class="msg them vn" data-vo="${id}"><div class="vn-row"><button class="vn-play" aria-label="تشغيل">▶</button><span class="vn-bar"><i></i></span><small class="vn-len">🎙</small></div><div class="vn-t">${T(id)}</div></div>`;
  const reply = (k) => `<div class="msg me">${T(k === 'ask' ? 'p_n03_ask' : 'p_n03_promise')}</div>${vn(k === 'ask' ? 'hana_n03_ask' : 'hana_n03_promise')}`;
  const done = S.nodes.N03;
  const html = `<div class="chat"><div class="chat-top"><span class="vc-dot"></span><b>هنا — مشرفة وردية</b><span>فرع وسط المدينة · محادثة</span></div>
    <div class="chat-log">${vn('hana_n03')}${done ? reply(done) : ''}</div>
    ${done ? '' : `<div class="chat-opts"><small>اختر ردّك (رد واحد):</small><button data-k="ask">${T('p_n03_ask')}</button><button data-k="promise">${T('p_n03_promise')}</button></div>`}
    <div class="chat-foot"><button id="chclose">إغلاق</button></div></div>`;
  let cur = null, req = 0, closed = false;         // the voice note playing now (one at a time)
  const play = async (bubble) => {
    if (cur) cur.stop();
    const my = ++req;
    const id = bubble.dataset.vo, bar = bubble.querySelector('.vn-bar i'), btn = bubble.querySelector('.vn-play');
    const v = await playVoice(`assets/vo/ar/${id}.mp3`, null, {radio: true});
    if (my !== req || closed) { v.stop(); return; }   // another note was asked for (or the chat closed) while this one loaded
    cur = v;
    const len = bubble.querySelector('.vn-len'), s = Math.round(v.duration); len.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    btn.textContent = '❚❚'; bubble.classList.add('on');
    const tick = () => { if (cur !== v) return; bar.style.width = Math.min(100, v.time() / v.duration * 100) + '%'; requestAnimationFrame(tick); };
    tick();
    await v.done;
    btn.textContent = '▶'; bubble.classList.remove('on'); bar.style.width = '100%';
    if (cur === v) cur = null;
  };
  const wire = (bubble) => bubble.querySelector('.vn-play').onclick = () => { if (cur && bubble.classList.contains('on')) { cur.stop(); return; } play(bubble); };
  await D.openDoc(html, (el, close) => {
    el.querySelector('#chclose').onclick = close;
    el.querySelectorAll('.vn').forEach(wire);
    if (!done) play(el.querySelector('.vn'));       // her first message plays as soon as the chat opens
    el.querySelectorAll('.chat-opts button').forEach(b => b.onclick = async () => {
      if (S.nodes.N03) return;
      const k = b.dataset.k; setNode('N03', k); el.querySelector('.chat-opts').remove(); sfx.ui();
      if (cur) cur.stop();
      const lg = el.querySelector('.chat-log');
      lg.insertAdjacentHTML('beforeend', `<div class="msg me">${T(k === 'ask' ? 'p_n03_ask' : 'p_n03_promise')}</div><div class="msg them typing">🎙 تسجّل رسالة صوتية…</div>`);
      if (k === 'ask') { S.ops_checked = true; gain('M3'); } else S.ops_checked = false;
      await wait(1.3);
      lg.querySelector('.typing').remove();
      lg.insertAdjacentHTML('beforeend', vn(k === 'ask' ? 'hana_n03_ask' : 'hana_n03_promise')); sfx.ping();
      const bubble = lg.lastElementChild; wire(bubble); play(bubble);
    });
  });
  closed = true; if (cur) cur.stop();              // closing the chat stops her voice
}
const N05TXT = {call: 'اتصلت بالسيدة بيل وطلبت موافقتها', keep: 'أبقيت السيناريو كما هو', drop: 'ألغيت فكرة الفيلم'};
async function scriptDesk() {
  const putBack = await pick(anchors.deskObjs.script, {open: false});
  let k = null;
  const tail = S.nodes.N05 ? `<div class="n05-done">قرارك: ${N05TXT[S.nodes.N05]}</div>`
    : `<div class="n05"><button class="primary" data-k="call">📞 اتصل بالسيدة بيل واطلب موافقتها</button><button class="ghost" data-k="keep">أبقِ السيناريو كما هو</button><button class="ghost" data-k="drop">ألغِ فكرة الفيلم</button></div>`;
  await D.openDoc(D.scriptDoc() + tail, (el, close) => el.querySelectorAll('.n05 button').forEach(b => b.onclick = () => { k = b.dataset.k; close(); }));
  await putBack();
  if (!k || S.nodes.N05) return;
  setNode('N05', k);
  if (k === 'call') {                              // you say what you'll do, the phone rings, her voice message plays
    S.consent = 'planned';                         // (desk hotspots stay hidden while this runs: it is inside the hotspot's use)
    await F.line('p_n05_call');
    sfx.ring(); await wait(2.0);
    toast('رسالة صوتية من السيدة روث بيل');
    await F.line('ruth_n05');
    toast('<b>تم</b> — الفيلم ممكن بممثلين، مع نموذج موافقة مكتوب.');
  }
  else if (k === 'keep') { S.consent = 'missing'; S.idea = 'film'; await F.line('p_n05_keep'); toast('أبقيت السيناريو كما هو — بلا نموذج موافقة.'); }
  else { S.consent = 'not_needed'; await F.line('p_n05_drop'); toast('ألغيت فكرة الفيلم.'); }
}
function setupHotspots() {
  deskItem('folder', 'ملف الأبحاث', 'folder', () => D.researchDoc(), {done: () => S.segment !== 'none'});
  deskItem('budget', 'ورقة الميزانية', 'money', () => D.budgetDoc(), {done: () => !!S.tasks.discountShare && !!S.tasks.budget});
  deskItem('booklet', 'دليل العلامة', 'book', () => D.bookletDoc());
  deskItem('envelope', 'الظرف الرمادي', 'envelope', () => D.proposalDoc());
  deskItem('laptop', 'اللابتوب — لوحة البيانات', 'laptop', async () => {
    await openLaptop();
    for (;;) {                      // dashboard ↔ chat / report until closed
      let act = null;
      await D.dashboardDoc({onCall: () => act = 'chat', callLabel: '💬 راسل مشرفة الفرع (هنا)', extra: [{label: '📊 تقرير اختبار التواصل', fn: () => act = 'report'}]});
      if (!act) break;
      if (act === 'chat') await branchChat(); else await D.reportDoc();
    }
  }, {done: () => !!S.nodes.N03 && !!S.ev.M7});
  deskItem('script', 'سيناريو الفيلم', 'doc', scriptDesk, {manual: true, done: () => !!S.nodes.N05});
  deskItem('tablet', 'التابلت — موجز الحملة', 'tablet', async () => {
    if (S.briefBuilt) { toast('الموجز معتمد — اذهب إلى قاعة الاجتماعات.'); return; }
    if (S.segment === 'none') { toast('<b>اختر الشريحة أولًا</b> — من «ملف الأبحاث».'); return; }
    const putBack = await pick(anchors.deskObjs.tablet, {open: false}); await briefDoc(); await putBack();
    if (S.briefBuilt) { toast('<b>الموجز معتمد</b> — قم من المكتب (<kbd>Space</kbd>) واذهب إلى قاعة الاجتماعات.'); mapState.target = MEET_DOOR; }
  }, {manual: true, done: () => !!S.briefBuilt});
  addHotspot({id: 'sit', label: 'اجلس إلى مكتبك', icon: 'chair', range: 2.6, pos: V3(anchors.officeSeat.x, 1.1, anchors.officeSeat.z), when: () => !F.isSeated() && !S.meetingStarted,
    use: async () => { await F.sitAtDesk(); S.sat = true; mapState.target = null; objective(miniObjective()); }});
  addHotspot({id: 'values', label: 'بطاقة القيم', icon: 'frame', range: 3.2, pos: V3(anchors.valuesCard.x, anchors.valuesCard.y, anchors.valuesCard.z + 0.1), when: () => !S.meetingStarted,
    use: async () => { await F.look(V3(anchors.valuesCard.x, 1.5, anchors.valuesCard.z)); await D.valuesDoc(); markDone('values'); }});
  addHotspot({id: 'present', label: 'ابدأ عرض موجزك', icon: 'board', range: 4.6, pos: V3(4.75, 1.75, -9.5), when: () => S.briefBuilt && !S.meetingStarted,
    use: () => { meetReq && meetReq(); }});
  const doStand = async () => {
    if (!F.isSeated() || D.docOpen() || !$('choices').classList.contains('hidden') || !$('subs').classList.contains('hidden')) return;
    await F.standFromDesk(); objective(miniObjective()); if (S.briefBuilt) mapState.target = MEET_DOOR;
  };
  $('standbtn').onclick = doStand; onKey('Space', doStand);
  onUpdate(() => { const on = F.isSeated() && !$('hud').classList.contains('hidden') && $('subs').classList.contains('hidden') && $('choices').classList.contains('hidden') && !D.docOpen(); $('standbtn').classList.toggle('hidden', !on); });
}

// ---------------------------------------------------------------- meeting
let meetReq = null;
const inMeeting = () => { const p = player.ch.holder.position; return roomAt(p.x, p.z)?.id === 'meeting'; };
/** entering early: Nadia sends you back; with the brief ready, the screen hotspot starts the presentation */
async function meetingGate() {
  const start = new Promise(r => meetReq = r);
  (async () => {
    for (;;) {
      await F.waitUntil(() => S.meetingStarted || inMeeting() && player.mode === 'free');
      if (S.meetingStarted) return;
      if (!S.briefBuilt) {
        const N = C.nadia, np = N.holder.position;
        if (roomAt(np.x, np.z)?.id === 'meeting' && np.distanceTo(player.ch.holder.position) < 7) {   // only if she is really here
          F.lockControls(); N.lookAt(player.ch);
          await F.line('nadia_mini_early', {cam: F.camMeet});
          F.freeControls();
        }
        toast('<b>الموجز أولًا</b> — «التابلت» على مكتبك.');
      } else { objective(miniObjective()); mapState.target = {x: 4.0, z: -9.5}; }
      await F.waitUntil(() => S.meetingStarted || !inMeeting());
      if (S.meetingStarted) return;
    }
  })();
  await start;
}
const SLIDE_DEF = [
  {q: 'nadia_q_insight', label: 'لمن؟ ولماذا سيهتمون؟', title: 'لمن؟ ولماذا سيهتمون؟', body: () => `لمن: ${SEGTXT[S.segment]} · لماذا: ${F.briefText('insight')} · الفكرة: ${F.briefText('idea')}`, cards: ['insight', 'idea']},
  {q: 'nadia_q_ops', label: 'ما تحتاجه الفروع', title: 'هل تستطيع فروعنا تقديمه؟', body: () => F.briefText('ops'), cards: ['ops']},
  {q: 'nadia_q_measure', label: 'كيف نقيس', title: 'كيف سنعرف أنها نجحت؟', body: () => F.briefText('measure'), cards: ['measure']},
  {q: 'nadia_q_risk', label: 'الخطر وكيف نتعامل معه', title: 'ما الخطر الرئيسي؟', body: () => F.briefText('risk'), cards: ['risk']},
];
function showSlidePoints(title, r) {
  const el = document.createElement('div'); el.className = 'slidepts';
  el.innerHTML = `<div class="sp-h">${title}</div>${r.items.map(i => `<div class="sp-i ${i.max ? (i.pts >= i.max ? 'ok' : i.pts > 0 ? 'mid' : 'no') : 'no'}"><span>${i.t}</span><b>${num(i.pts)}${i.max ? `<small> من ${i.max}</small>` : ''}</b></div>`).join('')}<div class="sp-tot">${num(r.pts)}<small> نقطة</small></div>`;
  document.body.appendChild(el);
  (r.max && r.pts >= r.max * 0.7 ? sfx.ping : sfx.ui)();
  return wait(3.0).then(() => { el.classList.add('out'); setTimeout(() => el.remove(), 500); });
}
async function meeting() {
  S.scene = 'meeting'; S.meetingStarted = true;
  setHotspotsBusy(true); F.lockControls(); mapState.target = null;
  setAmbienceLevel(0.35); objective('اعرض موجزك على نادية، ثم اختر الخطة');
  const ch = player.ch, N = C.nadia, seat = anchors.meetSeats[NADIA_SEAT];
  if (!N.seated) { N.walking = null; sit(N, seat); }
  cine.shot(V3(-3.2, 2.0, -6.4), V3(1.5, 1.0, -9.2), 1.2, {fov: 48});
  await ch.walkTo([[3.35, -8.9]], {speed: 1.15});
  ch.faceTo(-2, -9.3); ch.presenting = true;
  N.lookAt(ch); N.lockLook = true; ch.lookAt(N);
  F.drawScreen('plans');
  hud(false); letterbox(true);
  await F.line('nadia_mini_open', {cam: F.camMeet});
  let good = 0, weak = 0;
  for (let i = 0; i < SLIDES.length; i++) {
    const sl = SLIDES[i], def = SLIDE_DEF[i];
    N.mood.smile = 0; N.mood.frown = 0;
    await F.line(def.q, {cam: F.camMeet});
    await F.clicker(def.label);
    F.drawSlide(i + 1, def.title, def.body(), def.cards.flatMap(k => (S.brief && S.brief.cards[k]) || []));
    await F.slideShot();
    S.revealed[sl.key] = true;
    const r = slidePoints(sl);
    const ok = r.pts >= r.max * 0.7;
    N.mood.smile = ok ? 0.5 : 0; N.mood.frown = ok ? 0 : 0.35; N.react(ok ? 'nod' : 'skeptical');
    const shown = showSlidePoints(def.title, r);
    await F.line(ok ? (good++ % 2 ? 'nadia_r_good2' : 'nadia_r_good1') : (weak++ % 2 ? 'nadia_r_weak2' : 'nadia_r_weak1'), {cam: F.camMeet});
    await shown;
  }
  const nc = conflicts(S.brief || {}).length;
  S.revealed.conf = true;
  if (nc) {
    N.mood.frown = 0.4;
    const shown = showSlidePoints('تعارضات في الموجز', {items: [{t: `${nc} تعارض بين الحقول`, pts: -3 * nc, max: 0}], pts: -3 * nc, max: 0});
    await F.line('nadia_r_conflict', {cam: F.camMeet}); await shown;
  }
  N.mood.smile = 0; N.mood.frown = 0;
  ch.presenting = false; S.briefAnswered = true;
  // the brief stands in for the spoken answers of the full version (used by the endings)
  const b = S.brief || {};
  S.insight = b.insight || 'none'; S.measure = b.measure || 'none'; S.risk = b.risk === 'plan'; S.opsAnswer = b.ops;
  await F.line('nadia_plans', {cam: F.camMeet});
  await decision([]);
}
async function decision(struck) {
  cine.shot(V3(0.2, 2.9, -6.6), V3(0, 0.6, -9.6), 1.0, {fov: 55});
  const plan = await showPlans(struck);
  if (S.miniTime == null) S.miniTime = elapsed();
  S.plansTried.push(plan); log('plan', plan);
  const ending = evaluateEnding(plan);
  const N = C.nadia;
  if (ending === 'E1' || ending === 'E2') {
    if (ending === 'E1') { N.mood.smile = 0.8; await F.line('nadia_e1', {cam: F.camMeet}); sfx.success(); N.react('smile'); await wait(1.4); }
    else { const q = S.segment === 'everyone' ? 'nadia_e2_who' : !S.ops_checked || S.opsAnswer !== 'sound' ? 'nadia_e2_ops' : 'nadia_e2_meas'; N.mood.worry = 0.4; await F.line(q, {cam: F.camMeet}); }
    return finish(ending, plan, struck.length > 0);
  }
  F.setTension(true);
  N.mood.worry = 0.7; N.mood.frown = 0.3;
  await F.line(plan === 1 ? 'nadia_fb_discount' : plan === 2 ? 'nadia_fb_contest' : 'nadia_fb_film', {cam: F.camMeet});
  await F.line('nadia_tension', {cam: F.camMeet});
  cine.shot(V3(1.5, 1.55, -8.3), () => player.ch.headPos(), 1.2, {fov: 36});
  const d = await tensionButtons(); log('tension', plan, d);
  const pc = () => cine.closeup(player.ch, {dist: 1.3, yawOff: 0.3, fov: 30, dur: 0.6});
  if (d === 'revise') { await F.line('p_revise', {cam: pc}); F.setTension(false); N.mood.worry = 0; return decision([...new Set([...struck, plan])]); }
  await F.line('p_continue', {cam: pc});
  return finish(ending, plan, struck.length > 0);
}
async function finish(ending, plan, revised) {
  S.ending = ending; S.miniPlan = {plan, revised, ending}; log('ending', ending);
  letterbox(false); F.setTension(false);
  await fade(true, 900); hud(false); setHotspotsBusy(true); await fade(false, 600);
  (ending === 'E1' || ending === 'E2') ? sfx.success() : sfx.fail();
  const res = showResult(ending, {plan, next: 'نقاطك ←'});
  await wait(1.0);
  F.line({E1: 'anchor_e1', E2: 'anchor_e2', E3: 'anchor_e3', E4: 'anchor_e4'}[ending]);
  await res;
  showScoreCard();
}

// ---------------------------------------------------------------- score card
function fullVersionUrl() { if (FULL_URL) return FULL_URL; const u = new URL(location.href); u.searchParams.delete('mini'); u.searchParams.delete('dev'); u.searchParams.delete('preset'); u.pathname = u.pathname.replace(/mini\/?$/, ''); return u.pathname + u.search; }
function showScoreCard() {
  const parts = scoreParts(), total = totalScore(parts), g = grade(total);
  const nEv = Object.keys(EVIDENCE).filter(k => S.ev[k]).length;
  const lost = parts.flatMap(p => p.items).filter(i => i.tip && (i.max ? i.pts < i.max : i.pts < 0)).sort((a, b) => (b.max - b.pts) - (a.max - a.pts)).slice(0, 4);
  const el = document.createElement('div'); el.id = 'scorecard';
  el.innerHTML = `<div class="sc-wrap">
    <div class="sc-head"><div class="sc-ring" style="--c:${g.c}"><b id="sctot">0</b><small>من 100</small></div>
      <div class="sc-h"><div class="sc-tag">اختبار ستاربكس — النسخة السريعة</div><h1 style="color:${g.c}">${g.t}</h1>
        <div class="sc-stars">${'★'.repeat(g.stars)}<span>${'★'.repeat(5 - g.stars)}</span></div>
        <div class="sc-meta">الوقت ${clockText()} · النهاية BUS3-${S.ending} · الأدلة ${nEv}/10 · محاولات الخطة ${S.plansTried.length}</div></div></div>
    <div class="sc-parts">${parts.map(p => `<div class="sc-part"><div class="sc-pt"><b>${p.t}</b><span>${p.pts} من ${p.max}</span></div><div class="sc-bar"><i style="width:${p.max ? p.pts / p.max * 100 : 0}%"></i></div>
      <ul>${p.items.map(i => `<li class="${i.max ? (i.pts >= i.max ? 'ok' : i.pts > 0 ? 'mid' : 'no') : (i.pts < 0 ? 'no' : 'ok')}"><span>${i.t}</span><b>${num(i.pts)}</b></li>`).join('')}</ul></div>`).join('')}</div>
    ${lost.length ? `<div class="sc-lost"><h3>أين ضاعت النقاط</h3>${lost.map(i => `<div class="fbq"><b>${i.t}:</b> ${i.tip}</div>`).join('')}</div>` : ''}
    <div class="sc-actions"><button class="primary" id="scagain">العب مرة أخرى</button><a class="ghost" href="${fullVersionUrl()}">النسخة الكاملة</a><button class="ghost" id="sclog">تنزيل سجل النقاط (JSON)</button></div></div>`;
  document.body.appendChild(el);
  const t0 = performance.now();
  const count = () => { const k = Math.min(1, (performance.now() - t0) / 1400); $('sctot').textContent = Math.round(total * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(count); };
  count();
  el.querySelector('#scagain').onclick = () => location.reload();
  el.querySelector('#sclog').onclick = () => {
    const data = {situation: 'SYRA-EDU-BUS-03', version: 'mini', score: total, grade: g.t, time_s: Math.round(elapsed()), ending: S.ending,
      parts: parts.map(p => ({part: p.t, pts: p.pts, max: p.max, items: p.items.map(i => ({item: i.t, pts: i.pts, max: i.max}))})), state: S};
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], {type: 'application/json'})); a.download = 'BUS3_quick_score.json'; a.click();
  };
}

// ---------------------------------------------------------------- entry
export async function runMini(lines, speakers) {
  LINES = lines; F.initLines(lines, speakers);
  window.__S = S; window.__C = C; window.__player = player; window.__teleport = teleport; window.__hs = hotspots;
  S.mode = 'mini';
  initDeskHands(player.ch);
  const vg = document.createElement('div'); vg.className = 'vignette'; document.body.appendChild(vg);
  startAmbience(); startBackground();
  $('calendar').classList.add('hidden');
  setSteps(STEPS, {label: '+نقاط'});
  setupHotspots(); scoreHud();
  S.scene = 'office';
  const N = C.nadia, seat = anchors.meetSeats[NADIA_SEAT];
  if (Q.get('dev') === 'meeting') {            // QA shortcut: brief ready, start at the meeting room door
    S.sat = true; S.briefBuilt = true; if (S.segment === 'none') S.segment = 'A';
    sit(N, seat); teleport(MEET_DOOR.x, -4.2, Math.PI); hud(true); await fade(false, 600); F.freeControls();
    S.miniT0 = performance.now();
    await meetingGate(); await meeting(); return;
  }
  // opening: you walk into your office, Nadia is waiting by the desk with a short brief
  // (you stand clear of her way out, so she can leave without walking through you)
  stand(N, 14.0, 3.6, 0, 'f_idle_neutral_01');
  teleport(13.4, 5.0, Math.PI / 2);
  player.ch.faceTo(14.0, 3.6); N.faceTo(13.4, 5.0);
  N.lookAt(player.ch); N.lockLook = true; player.ch.lookAt(N);
  F.lockControls(); hud(false); letterbox(true);
  await F.camOTS(N)(N);
  await fade(false, 900);
  await F.line('nadia_mini_brief', {cam: F.camOTS(N)});
  N.lockLook = false; player.ch.lookAt(null);
  letterbox(false); hud(true);
  // Nadia goes to the meeting room and waits there
  N.walkTo([[11.2, 2.3], [7.5, -2.8], [MEET_DOOR.x, -3.4], [MEET_DOOR.x, -6.3], [3.3, -11.3], [seat.x, -11.4]], {speed: 1.15}).then(() => { if (!S.meetingStarted) sit(N, seat); });
  player.yaw = Math.atan2(15.3 - 13.4, 4.5 - 5.0); player.pitch = 0.12;   // looking at the desk
  F.freeControls();
  S.miniT0 = performance.now();
  objective(miniObjective()); mapState.target = {x: anchors.officeSeat.x, z: anchors.officeSeat.z};
  toast('<b>النسخة السريعة</b> — كل ما تفعله يُحسب: المهام المالية، الأدلة، القرارات، الموجز، والخطة. والوقت أيضًا.');
  await meetingGate();
  await meeting();
}
