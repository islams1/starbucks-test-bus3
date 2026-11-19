// After the flight: a score out of 100, what you did and when next to what the real crew did and when (NTSB AAR-10/03),
// and the real recording of the radio from 15:25:48 to 15:30:40 played over a replay of the real flight path.
import * as THREE from 'three';
import {camera, onUpdate} from '../core/engine.js';
import {playVoice} from '../core/audio.js';
import * as cine from '../core/cine.js';
import {$, show, fade} from '../ui/ui.js';
import {AC, sampleReal, chaseFrame} from './aircraft.js';
import {CK, seat} from './cockpit.js';
import {fmt} from './flow.js';
import {setDetail} from './gtiles.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export function score(S) {
  const a = S.acts, items = [];
  const timed = (key, label, real, full, half, pts) => { const t = a[key]; const p = t == null ? 0 : t <= full ? pts : t <= half ? Math.round(pts / 2) : Math.round(pts / 4); items.push({label, you: t, real, p, max: pts}); return p; };
  let sc = 0;
  sc += timed('myac', 'استلام القيادة («الطائرة معي»)', 12, 15, 30, 10);
  sc += timed('apu', 'تشغيل وحدة الطاقة المساعدة (تُبقي حماية التحكم)', 10, 20, 40, 10);
  sc += timed('qrh', 'طلب قائمة الطوارئ من المساعد', 17, 25, 45, 5);
  { const t = S.maydayT; const p = t == null ? 0 : (t <= 30 ? 10 : t <= 50 ? 6 : 3) - Math.min(3, (S.vague || 0) * 2); items.push({label: 'نداء الاستغاثة: واضح ومع النية', you: t, real: 22, p: Math.max(0, p), max: 10}); sc += Math.max(0, p); }
  { const ans = S.answers, ok = (k, good) => ans[k] && good.includes(ans[k].k) && ans[k].delay <= 9;
    const p = (ok('rwy13', ['unable']) ? 5 : 0) + ((ok('rwy4', ['teb', 'hudson']) || ok('teb280', ['cant'])) ? 5 : 0);
    items.push({label: 'الرد على عروض المراقب بسرعة ووضوح', you: ans.rwy13 ? ans.rwy13.t : null, real: 60, p, max: 10}); sc += p; }
  { const water = S.end === 'ditched' || S.end === 'broken', rw = S.end === 'reached';
    const p = water ? 20 : rw ? 8 : 0, when = S.hudsonT != null ? S.hudsonT : S.intent ? S.intent.t : S.branch ? S.branch.t : null;
    const label = water ? 'القرار: الهبوط على الهدسون' : rw ? 'القرار: العودة إلى مطار (نجحت هنا — والتحقيق يقول إنها كانت مقامرة)' : 'القرار: لم تصل الطائرة إلى ماء أو مدرج';
    items.push({label, you: when, real: 137, p, max: 20, bad: !water}); sc += p; }
  sc += timed('pa', 'الإعلان للركاب: «استعدوا للارتطام»', 120, 170, 200, 10);
  sc += timed('flaps', 'إنزال القلابات للهبوط على الماء', 153, 175, 200, 5);
  const onWater = S.end === 'ditched' || S.end === 'broken';
  if (onWater) { const t = a.ditching; const p = t != null ? 5 : 0; items.push({label: 'زر الهبوط على الماء (الطاقم الحقيقي لم يجد وقتًا له)', you: t, real: null, p, max: 5}); sc += p; }
  { const L = S.landing, water = S.end === 'ditched' || S.end === 'broken';
    const g = !water && S.end !== 'reached' ? null : !L ? 'real' : L.grade;
    const p = {smooth: 10, hard: 6, broken: 2, landed: 8, real: 4}[g] || 0;
    const lbl = {smooth: 'لمسة الماء: ناعمة', hard: 'لمسة الماء: قاسية (مثل الحقيقية)', broken: 'لمسة الماء: ارتطام قوي', landed: 'الهبوط على المدرج', real: 'لمسة الماء: هبط بها مساعدك'}[g] || 'لمسة الماء';
    items.push({label: lbl + (L && L.sink != null ? ` — ${Math.round(L.sink)} قدم/د · ميل ${L.bank.toFixed(0)}°` : ''), you: null, real: null, p, max: 10, bad: !g || g === 'broken'}); sc += p; }
  if (onWater) { const t = a.evac; const p = t == null ? 0 : t <= 10 ? 5 : 3;
    items.push({label: 'أمر الإخلاء بعد توقف الطائرة', you: null, youTxt: t == null ? (S.evacWait === false && (S.end === 'ditched' || S.end === 'broken') ? 'المضيفون بدأوه' : '—') : `بعد ${Math.round(t)} ث`, real: null, realTxt: 'فورًا', p, max: 5}); sc += p; }
  return {score: Math.min(100, sc), items};
}

export async function debrief(S, {onRetry}) {
  const {score: sc, items} = score(S);
  const title = S.end === 'ditched' ? (sc >= 85 ? 'هبوط على الماء — والجميع نجوا' : 'هبوط على الماء — مع ثغرات') : S.end === 'broken' ? 'على الماء — لكن الجسم تشقّق' : S.end === 'reached' ? 'وصلت المطار — في المحاكاة فقط' : 'لم تصل الطائرة';
  const box = $('debrief');
  box.innerHTML = `<div class="db-card">
    <div class="db-head"><div class="db-score">${sc}</div><div><h2>${title}</h2>
      <div class="lead">من الاصطدام إلى الماء: ٢٠٨ ثوانٍ. الكابتن الحقيقي استلم القيادة بعد ١٢ ثانية، وشغّل وحدة الطاقة المساعدة بعد ١٠، وأعلن الاستغاثة بعد ٢٢، وقال «سنكون في الهدسون» بعد ١٣٧ ثانية.</div></div></div>
    <div class="db-grid">
      <div class="db-box"><h3><span>أنت مقابل الطاقم الحقيقي</span><span style="font-size:.75rem;color:#8fa3b0">أنت · الحقيقي · النقاط</span></h3>
        ${items.map(i => `<div class="db-row"><span class="${i.bad ? 'bad' : ''}">${i.label}</span><span class="you"${i.youTxt ? ' style="font-family:inherit;direction:rtl"' : ''}>${i.youTxt || (i.you == null ? '—' : fmt(i.you))}</span><span class="real">${i.realTxt ? `<span style="font-family:'IBM Plex Sans Arabic',sans-serif;direction:rtl;unicode-bidi:isolate">${i.realTxt}</span>` : (i.real == null ? '' : fmt(i.real))} · ${i.p}/${i.max}</span></div>`).join('')}
      </div>
      <div class="db-box db-facts"><h3><span>ما قاله التحقيق</span></h3>
        • المحركان امتصّا إوزًا كنديًا كبيرًا (نحو ٤ كغ للطائر) على ارتفاع ٢٨١٨ قدمًا.<br>
        • في اختبارات المحاكي، نجحت العودة إلى لاغوارديا فقط حين بدأ الدوران فور الاصطدام. مع تأخير ٣٥ ثانية — زمن واقعي لفهم ما حدث — فشلت.<br>
        • قال التحقيق إن قرار الهبوط على الهدسون أعطى أعلى احتمال للنجاة.<br>
        • من أسباب النجاة: قرارات الطاقم وتعاونهم، أداء طاقم الكابينة في الإخلاء، وقرب العبّارات وفرق الإنقاذ.<br>
        <small style="color:#8a979e">المصدر: تقرير NTSB AAR-10/03 · صوت المراقب: تسجيل هيئة الطيران الأمريكية (FAA) المنشور في ٥ فبراير ٢٠٠٩.</small>
      </div>
    </div>
    <div class="db-actions"><button class="primary" id="dbreplay">اسمع التسجيل الحقيقي وشاهد المسار الحقيقي</button><button id="dbretry">أعد المحاولة</button><button id="dbcredits">المصادر والتراخيص</button></div>
  </div>`;
  show('debrief', true);
  fade(false, 600);                        // every ending fades out; the debrief comes up from black
  $('dbretry').onclick = () => onRetry();
  $('dbreplay').onclick = () => replay();
  $('dbcredits').onclick = () => window.__credits && window.__credits();
}

/** the real flight from 15:25:48 to the ditching, chase camera, with the full FAA recording */
async function replay() {
  show('debrief', false); await fade(true, 400);
  AC.branch = null; seat(false); CK.group.visible = false; if (AC.ext) AC.ext.visible = true;
  setDetail('cinema');
  const meta = await (await fetch('assets/flight/atc/clips.json')).json();
  const t0 = -(meta._replay.strikeAt);           // track time at the start of the recording
  AC.t = t0;
  const v = await playVoice('assets/flight/atc/replay.mp3', null, {volume: 1});
  const start = performance.now();
  const chase = () => { const {fwd, side} = chaseFrame(); return AC.pos.clone().addScaledVector(fwd, -95).add(V(0, 28, 0)).addScaledVector(side, -30); };
  cine.hold(chase, () => AC.pos.clone(), {fov: 42});
  const off = onUpdate(() => {
    const t = t0 + (performance.now() - start) / 1000; sampleReal(Math.min(212, t)); AC.t = t;
    AC.group.position.copy(AC.pos); AC.group.rotation.set(-AC.pitch * Math.PI / 180, Math.PI - AC.hdg * Math.PI / 180, AC.bank * Math.PI / 180, 'YXZ');
    const sub = $('subs'); if (!sub.dataset.replay) { sub.dataset.replay = 1; }
  });
  await fade(false, 700);
  for (const c of meta._transcript || []) setTimeout(() => {
    const el = document.createElement('div'); el.className = 'sub';
    el.innerHTML = `<div class="who ${c.who === 'L116' ? 'atc' : ''}">📻 ${c.who === 'L116' ? 'مراقب الإقلاع (نيويورك)' : 'كاكتس ١٥٤٩ — الكابتن الحقيقي'} · ${'15:' + c.utc.slice(2)} EST</div><div class="en">${c.text}</div>`;
    const box = $('subs'); box.appendChild(el); while (box.children.length > 2) box.firstChild.remove(); setTimeout(() => el.remove(), 6000);
  }, c.at * 1000);
  await v.done; off(); cine.stop();
  await fade(true, 500); show('debrief', true); await fade(false, 400);
}
