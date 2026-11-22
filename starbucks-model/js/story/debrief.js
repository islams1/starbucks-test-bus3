// Debrief: the learner's memo beside the published case, three review checks, the coaching rubric (3 points), credits.
import {S} from './state.js';
import {ROUTES, CUST_EV, COST_EV, CONDS, rubric, total, grade, annual, money} from './score.js';
import {$, show} from '../ui/ui.js';
import {sfx} from '../core/audio.js';

const EN = new URLSearchParams(location.search).get('lang') === 'en';
const tx = (o) => EN ? (o.en || o.t) : o.t;
const HBP = 'https://store.hbr.org/product/starbucks-delivering-customer-service/504016';
const TENK = 'https://www.sec.gov/Archives/edgar/data/829224/000089102002002061/v86608e10vk.htm';

export function memoHtml(m) {
  const md = m.model || S.model;
  return `<dl class="dmemo">
    <dt>${EN ? 'Recommendation' : 'التوصية'}</dt><dd>${tx(ROUTES[m.route])}</dd>
    <dt>${EN ? 'Customer evidence' : 'دليل الزبائن'}</dt><dd>${tx(CUST_EV[m.cust])}</dd>
    <dt>${EN ? 'Cost evidence' : 'دليل التكلفة'}</dt><dd>${tx(COST_EV[m.cost])}</dd>
    <dt>${EN ? 'Model' : 'النموذج'} <span class="illus">${EN ? 'Illustrative' : 'تعليمي'}</span></dt><dd><span class="ltr">${md.orders} × 360 × $${md.contrib.toFixed(2)} − $21,600 = ${money(annual(md.orders, md.contrib))}</span></dd>
    <dt>${EN ? 'Review condition' : 'شرط المراجعة'}</dt><dd>${tx(CONDS[m.cond])}${m.whyLine ? `<div class="whyline">${m.whyLine}</div>` : ''}</dd>${m.note ? `<dt>${EN ? 'Note' : 'ملاحظة'}</dt><dd>${m.note.replace(/</g, '&lt;')}</dd>` : ''}
  </dl>`;
}

/** split screen: learner memo | the published case. Resolves on "next" */
export function compareScreen() {
  const el = $('card'); el.className = 'compare'; show('card', true);
  el.innerHTML = `<div class="cmp-col teach"><div class="tagl">${EN ? 'Illustrative scenario' : 'سيناريو تعليمي'}</div><h3>${EN ? 'Your memo' : 'مذكرتك'}</h3>${memoHtml(S.committed)}</div>
    <div class="cmp-col source"><div class="tagl src">${EN ? 'From the published case' : 'من الحالة المنشورة'}</div><h3>Starbucks</h3>
      <p>${EN ? 'Research suggested a service gap. The proposed labor investment cost about <b>$40 million a year</b>; its financial effect was uncertain.' : 'أبحاث الشركة أشارت إلى فجوة في الخدمة. الاستثمار المقترح في العمالة كان بتكلفة نحو <b>40 مليون دولار سنويًا</b>، وأثره المالي غير مؤكد.'}</p>
      <p class="cite">Youngme Moon &amp; John A. Quelch, <a href="${HBP}" target="_blank" rel="noopener">Harvard Business Publishing case 504-016</a></p>
      <div class="scale"><b>5,886</b> ${EN ? 'Starbucks retail stores as of Sept 29, 2002' : 'متجرًا لـ <bdi>Starbucks</bdi> في 29 سبتمبر 2002'}<div class="cite"><a href="${TENK}" target="_blank" rel="noopener">${EN ? 'Starbucks FY2002 Form 10-K, Item 2' : 'التقرير السنوي 10-K لعام 2002، البند 2'}</a></div><small>${EN ? 'The reported store count, kept apart from the illustrative one-store model.' : 'عدد معلن، منفصل عن نموذج الفرع الواحد التعليمي.'}</small></div>
      <p class="note">${EN ? 'The record used here confirms the dilemma. This panel ends at the documented premise and does not say what Starbucks decided.' : 'المصدر المستخدم هنا يؤكد المعضلة فقط. هذه اللوحة تقف عند الفكرة الموثقة ولا تقول ماذا قررت Starbucks.'}</p></div>
    <div class="cmp-foot"><button type="button" id="cmpnext" class="primary hidden">${EN ? 'Review questions' : 'أسئلة المراجعة'}</button></div>`;
  const btn = el.querySelector('#cmpnext');
  const done = new Promise(res => btn.onclick = () => { sfx.ui(); show('card', false); res(); });
  return {done, ready: () => { btn.classList.remove('hidden'); btn.focus({preventScroll: true}); }};
}

const QUIZ = [
  {q: 'ما زيادة التعادل عند 3 دولارات للطلب؟', qe: 'What is the break-even lift at $3.00 per purchase?', opts: [['12 طلبًا في اليوم', '12 a day'], ['20 طلبًا في اليوم', '20 a day'], ['26 طلبًا في اليوم', '26 a day']], ok: 1,
    fb: '<b>20 طلبًا في اليوم.</b> لأن 21,600 ÷ (360 × 3.00) = 20.', fbe: '<b>20 per day.</b> $21,600 ÷ (360 × $3.00) is 20.'},
  {q: 'هل يثبت الطابور الأقصر وحده أن المال سيعود؟', qe: 'Does a shorter line on its own establish financial payback?', opts: [['نعم، الزبائن سيعودون', 'Yes — customers will come back'], ['لا، قِس الطلبات الإضافية المكتملة وربحها', 'No — measure additional completed purchases and their contribution']], ok: 1,
    fb: '<b>قِس الطلبات الإضافية المكتملة وربحها.</b> أثر الخدمة والأثر المالي يحتاج كل منهما قياسًا خاصًا به.', fbe: '<b>Measure additional completed purchases and their contribution.</b> Service and financial effects need their own measures.'},
  {q: 'أي مقارنة تقوّي التجربة؟', qe: 'Which comparison would strengthen the pilot?', opts: [['كل الفروع قبل وبعد', 'All stores, before and after'], ['فروع متشابهة في ساعات ذروة متشابهة، والعمالة تتغير في فروع التجربة فقط', 'Similar stores and peak periods, with staffing changed in the test group'], ['آراء الزبائن بعد أسبوع', 'Customer opinions after a week']], ok: 1,
    fb: '<b>فروع متشابهة وساعات ذروة متشابهة، والعمالة تتغير في مجموعة التجربة.</b> وتُتابَع دقة الطلبات مع الانتظار.', fbe: '<b>Similar stores and peak periods, with staffing changed in the test group.</b> Track accuracy as well as wait.'},
];
/** three unscored review checks with immediate feedback */
export async function quiz() {
  const el = $('card'); el.className = 'quiz'; show('card', true);
  for (let i = 0; i < QUIZ.length; i++) {
    const Q = QUIZ[i];
    el.innerHTML = `<div class="qz"><div class="qz-n">${i + 1} / ${QUIZ.length}</div><h3>${EN ? Q.qe : Q.q}</h3><div class="qz-opts">${Q.opts.map((o, k) => `<button type="button" data-k="${k}"><kbd>${k + 1}</kbd>${EN ? o[1] : o[0]}</button>`).join('')}</div><div class="qz-fb hidden" aria-live="polite"></div><button type="button" class="primary hidden" id="qznext">${i < QUIZ.length - 1 ? (EN ? 'Next' : 'التالي') : (EN ? 'Your result' : 'نتيجتك')}</button></div>`;
    await new Promise(res => {
      const pickK = (k) => {
        if (el.querySelector('.qz-opts').classList.contains('done')) return;
        sfx.ui(); el.querySelector('.qz-opts').classList.add('done');
        el.querySelectorAll('.qz-opts button').forEach((b, j) => b.classList.add(j === Q.ok ? 'ok' : j === k ? 'bad' : 'off'));
        const fb = el.querySelector('.qz-fb'); fb.innerHTML = EN ? Q.fbe : Q.fb; fb.classList.remove('hidden');
        const n = el.querySelector('#qznext'); n.classList.remove('hidden'); n.focus({preventScroll: true}); n.onclick = () => { removeEventListener('keydown', onKey); res(); };
      };
      el.querySelectorAll('.qz-opts button').forEach(b => b.onclick = () => pickK(+b.dataset.k));
      const onKey = (e) => { const n = parseInt(e.key, 10); if (n >= 1 && n <= Q.opts.length) pickK(n - 1); };
      addEventListener('keydown', onKey);
    });
  }
  show('card', false);
}

/** the coaching rubric. returns 'revise' | 'again'. practice: show the latest practice attempt beside the original */
export function scoreScreen() {
  const parts = rubric(S.committed), n = total(parts), g = grade(n);
  const last = S.practice[S.practice.length - 1];
  const el = $('card'); el.className = 'score'; show('card', true);
  el.innerHTML = `<div class="sc"><div class="sc-top"><div class="sc-n ${g.cls}"><b>${n}</b><span>/3</span></div><div><h2>${EN ? g.en : g.t}</h2><p>${EN ? 'One point each for a peak-specific observation, a cost measure tied to contribution, and the matching review condition. The route itself earns nothing.' : 'نقطة لكل من: ملاحظة خاصة بالذروة، ومقياس تكلفة مرتبط بربح الطلب، وشرط المراجعة المطابق. المسار نفسه لا يأخذ نقاطًا.'}</p></div></div>
    <table>${parts.map(p => `<tr class="${p.ok ? 'full' : 'zero'}"><td>${EN ? p.en : p.t}${!p.ok ? `<div class="why">${EN ? p.whyEn : p.why}</div>` : ''}</td><td class="pts">${p.ok ? 1 : 0}<small>/1</small></td></tr>`).join('')}</table>
    ${last ? `<div class="practice"><b>${EN ? 'Latest practice attempt (unscored)' : 'آخر محاولة تدريب (بلا تقييم)'}</b> · ${total(rubric(last))}/3<div>${memoHtml(last)}</div></div>` : ''}
    <div class="sc-foot"><button type="button" id="screvise" class="ghost">${EN ? 'Revise recommendation (practice)' : 'راجع توصيتك (محاولة تدريب)'}</button><button type="button" id="scagain" class="primary">${EN ? 'Play again' : 'العب من جديد'}</button></div></div>`;
  sfx.success();
  return new Promise(res => { el.querySelector('#screvise').onclick = () => { show('card', false); res('revise'); }; el.querySelector('#scagain').onclick = () => res('again'); });
}

export function showCredits() {
  const el = $('card'); el.className = 'credits'; show('card', true);
  el.innerHTML = `<div class="cr"><h2>${EN ? 'Sources and credits' : 'المصادر والحقوق'}</h2>
    <h4>${EN ? 'Case facts' : 'حقائق الحالة'}</h4><ul><li><a href="${HBP}" target="_blank" rel="noopener">Harvard Business Publishing case 504-016</a> — Youngme Moon &amp; John A. Quelch (${EN ? 'premise only, from the public listing' : 'الفكرة فقط من الصفحة العامة'})</li><li><a href="${TENK}" target="_blank" rel="noopener">Starbucks FY2002 Form 10-K, Item 2</a> (${EN ? '5,886 stores' : '5,886 متجرًا'})</li></ul>
    <p>${EN ? 'Characters, the store, its model, dialogue and all store figures are illustrative teaching material.' : 'الشخصيات والفرع ومجسّمه والحوار وكل أرقام الفرع مادة تعليمية توضيحية.'}</p>
    <p>Poly Haven (CC0): ${EN ? 'chairs, tables, sofa, plant, clock, textures, the sunset sky' : 'الكراسي والطاولات والكنبة والنبات والساعة والخامات وسماء الغروب'} · Microsoft Rocketbox avatars (MIT) · ${EN ? 'Voices: Microsoft Edge neural TTS' : 'الأصوات: Microsoft Edge neural TTS'}</p>
    <p>Sketchfab (CC BY 4.0): <a href="https://sketchfab.com/3d-models/bab05bc7805d4b0dbc2cdcbb48441956" target="_blank" rel="noopener">Commercial Coffee Machine</a> — mreslan · <a href="https://sketchfab.com/3d-models/bd65abb34f3d4863838da371d2d9f2c1" target="_blank" rel="noopener">Cupcake Berry 01</a>, <a href="https://sketchfab.com/3d-models/94454f2e2662491882e709f69cfaebb0" target="_blank" rel="noopener">Cupcake Berry 02</a>, <a href="https://sketchfab.com/3d-models/675125a5452d48bab052732fbcca99b7" target="_blank" rel="noopener">Cake Piece Chocolate 01</a> — scanwow</p>
    <button type="button" class="primary" id="crclose">${EN ? 'Close' : 'إغلاق'}</button></div>`;
  el.querySelector('#crclose').onclick = () => show('card', false);
}
