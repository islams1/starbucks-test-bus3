// Debrief: the memo beside the published case, three review questions, the score out of 100, credits.
import {S} from './state.js';
import {ROUTES, CUST_EV, COST_EV, CONDS, scoreParts, total, grade, breakEven, annual, money} from './score.js';
import {$, show} from '../ui/ui.js';
import {sfx} from '../core/audio.js';
import {setInput} from '../core/input.js';

const EN = new URLSearchParams(location.search).get('lang') === 'en';
const tx = (o) => EN ? (o.en || o.t) : o.t;
const HBP = 'https://store.hbr.org/product/starbucks-delivering-customer-service/504016';
const TENK = 'https://www.sec.gov/Archives/edgar/data/829224/000089102002002061/v86608e10vk.htm';

function memoHtml(m) {
  const md = m.model || S.model;
  return `<dl class="dmemo">
    <dt>${EN ? 'Recommendation' : 'التوصية'}</dt><dd>${tx(ROUTES[m.route])}</dd>
    <dt>${EN ? 'Customer evidence' : 'دليل الزبائن'}</dt><dd>${tx(CUST_EV[m.cust])}</dd>
    <dt>${EN ? 'Cost evidence' : 'دليل التكلفة'}</dt><dd>${tx(COST_EV[m.cost])}</dd>
    <dt>${EN ? 'Model' : 'النموذج'}</dt><dd><span dir="ltr">${md.orders} × 360 × $${md.contrib.toFixed(2)} − $21,600 = ${money(annual(md.orders, md.contrib))}</span></dd>
    <dt>${EN ? 'Review condition' : 'شرط المراجعة'}</dt><dd>${tx(CONDS[m.cond])}</dd>${m.why ? `<dt>${EN ? 'Why' : 'لماذا'}</dt><dd>${m.why.replace(/</g, '&lt;')}</dd>` : ''}
  </dl>`;
}

/** split screen: learner memo | the published case. Resolves on "next". */
export function compareScreen() {
  setInput(false);
  const el = $('card'); el.className = 'compare'; show('card', true);
  el.innerHTML = `<div class="cmp-col teach"><div class="tagl">${EN ? 'Illustrative scenario' : 'سيناريو تعليمي'}</div><h3>${EN ? 'Your memo' : 'مذكرتك'}</h3>${memoHtml(S.committed)}</div>
    <div class="cmp-col source"><div class="tagl src">${EN ? 'From the published case' : 'من الحالة المنشورة'}</div><h3>Starbucks</h3>
      <p>${EN ? 'Research suggested a service gap. The proposed labor investment cost about <b>$40 million a year</b>; its financial effect was uncertain.' : 'أبحاث الشركة أشارت إلى فجوة في الخدمة. الاستثمار المقترح في العمالة كان بتكلفة نحو <b>40 مليون دولار سنويًا</b>، وأثره المالي غير مؤكد.'}</p>
      <p class="cite">Youngme Moon &amp; John A. Quelch, <a href="${HBP}" target="_blank" rel="noopener">Harvard Business Publishing case 504-016</a></p>
      <div class="scale"><b>5,886</b> ${EN ? 'Starbucks stores as of Sept 29, 2002' : 'متجرًا لـ <bdi>Starbucks</bdi> في 29 سبتمبر 2002'}<div class="cite"><a href="${TENK}" target="_blank" rel="noopener">${EN ? 'FY2002 Form 10-K, Item 2' : 'التقرير السنوي 10-K لعام 2002، البند 2'}</a></div><small>${EN ? 'Real store count, kept apart from the illustrative one-store model.' : 'عدد حقيقي، منفصل عن نموذج الفرع التعليمي.'}</small></div>
      <p class="note">${EN ? 'The case documents the dilemma. This debrief stops there and does not say what Starbucks decided next.' : 'الحالة توثّق المعضلة. الختام يقف عندها ولا يقول ماذا قررت Starbucks بعدها.'}</p></div>
    <div class="cmp-foot"><button id="cmpnext" class="primary hidden">${EN ? 'Review questions' : 'أسئلة المراجعة'}</button></div>`;
  const btn = el.querySelector('#cmpnext');
  const done = new Promise(res => btn.onclick = () => { sfx.ui(); show('card', false); res(); });
  return {done, ready: () => btn.classList.remove('hidden')};
}

const QUIZ = [
  {q: 'ما نقطة التعادل عند 3 دولارات للطلب؟', qe: 'What is the break-even lift at $3.00 per order?', opts: [['12 طلبًا', '12 orders'], ['20 طلبًا', '20 orders'], ['26 طلبًا', '26 orders']], ok: 1,
    fb: '<b>20 طلبًا في اليوم.</b> لأن 21,600 ÷ (360 × 3) = 20.', fbe: '<b>20 orders a day.</b> Because 21,600 ÷ (360 × 3) = 20.'},
  {q: 'هل يثبت الطابور الأقصر وحده أن المال سيعود؟', qe: 'Does a shorter line on its own prove the money comes back?', opts: [['نعم، الزبائن سيعودون', 'Yes, customers will come back'], ['لا، قِس الطلبات الإضافية المكتملة وربحها', 'No — measure the additional completed orders and their contribution']], ok: 1,
    fb: '<b>لا. قِس الطلبات الإضافية المكتملة وربحها.</b> أثر الخدمة والأثر المالي يحتاج كل منهما قياسًا خاصًا به.', fbe: '<b>No. Measure the additional completed orders and their contribution.</b> Service and financial effects each need their own measure.'},
  {q: 'أي مقارنة تقوي التجربة؟', qe: 'Which comparison would strengthen the pilot?', opts: [['كل الفروع قبل التجربة وبعدها', 'All stores before and after'], ['فروع متشابهة في ساعات ذروة متشابهة، والعمالة تتغير في فروع التجربة فقط', 'Similar stores at similar peak periods, staffing changed only in the test stores'], ['آراء الزبائن بعد أسبوع', 'Customer opinions after a week']], ok: 1,
    fb: '<b>فروع متشابهة في ساعات ذروة متشابهة، والعمالة تتغير في فروع التجربة فقط.</b> وتُتابَع الدقة مع الانتظار.', fbe: '<b>Similar stores at similar peak periods, with staffing changed only in the test stores.</b> Track accuracy as well as wait.'},
];
/** three unscored review questions with immediate feedback */
export async function quiz() {
  setInput(false);
  const el = $('card'); el.className = 'quiz'; show('card', true);
  for (let i = 0; i < QUIZ.length; i++) {
    const Q = QUIZ[i];
    el.innerHTML = `<div class="qz"><div class="qz-n">${i + 1} / ${QUIZ.length}</div><h3>${EN ? Q.qe : Q.q}</h3><div class="qz-opts">${Q.opts.map((o, k) => `<button data-k="${k}"><kbd>${k + 1}</kbd>${EN ? o[1] : o[0]}</button>`).join('')}</div><div class="qz-fb hidden"></div><button class="primary hidden" id="qznext">${i < QUIZ.length - 1 ? (EN ? 'Next' : 'التالي') : (EN ? 'Your score' : 'نتيجتك')}</button></div>`;
    await new Promise(res => {
      const pickK = (k) => {
        if (el.querySelector('.qz-opts').classList.contains('done')) return;
        sfx.ui(); el.querySelector('.qz-opts').classList.add('done');
        el.querySelectorAll('.qz-opts button').forEach((b, j) => b.classList.add(j === Q.ok ? 'ok' : j === k ? 'bad' : 'off'));
        const fb = el.querySelector('.qz-fb'); fb.innerHTML = EN ? Q.fbe : Q.fb; fb.classList.remove('hidden');
        const n = el.querySelector('#qznext'); n.classList.remove('hidden'); n.onclick = () => { removeEventListener('keydown', onKey); res(); };
      };
      el.querySelectorAll('.qz-opts button').forEach(b => b.onclick = () => pickK(+b.dataset.k));
      const onKey = (e) => { const n = parseInt(e.key, 10); if (n >= 1 && n <= Q.opts.length) pickK(n - 1); };
      addEventListener('keydown', onKey);
    });
  }
  show('card', false);
}

/** the score screen. returns 'revise' | 'again' */
export function scoreScreen() {
  setInput(false);
  const parts = scoreParts(), n = total(parts), g = grade(n);
  const el = $('card'); el.className = 'score'; show('card', true);
  el.innerHTML = `<div class="sc"><div class="sc-top"><div class="sc-n ${g.cls}"><b>${n}</b><span>/100</span></div><div><h2>${EN ? g.en : g.t}</h2><p>${EN ? 'Points go to evidence, calculation and the review condition. The route itself earns none.' : 'النقاط على الدليل والحساب وشرط المراجعة. المسار نفسه لا يأخذ نقاطًا.'}</p></div></div>
    <table>${parts.map(p => `<tr class="${p.pts >= p.max ? 'full' : p.pts > 0 ? 'part' : 'zero'}"><td>${EN ? p.en : p.t}${p.pts < p.max && p.why ? `<div class="why">${p.why}</div>` : ''}</td><td class="pts">${p.pts}<small>/${p.max}</small></td></tr>`).join('')}</table>
    <div class="sc-foot"><button id="screvise" class="ghost">${EN ? 'Revise recommendation (practice, unscored)' : 'راجع توصيتك (تدريب بلا تقييم)'}</button><button id="scagain" class="primary">${EN ? 'Play again' : 'العب من جديد'}</button></div></div>`;
  sfx.success();
  return new Promise(res => { el.querySelector('#screvise').onclick = () => { show('card', false); res('revise'); }; el.querySelector('#scagain').onclick = () => res('again'); });
}

export function showCredits() {
  const el = $('card'); el.className = 'credits'; show('card', true);
  fetch('assets/cafe_models/CREDITS.json').then(r => r.json()).catch(() => ({})).then(c => {
    el.innerHTML = `<div class="cr"><h2>${EN ? 'Sources and credits' : 'المصادر والحقوق'}</h2>
      <h4>${EN ? 'Case facts' : 'حقائق الحالة'}</h4><ul><li><a href="${HBP}" target="_blank" rel="noopener">Harvard Business Publishing case 504-016</a> — Youngme Moon &amp; John A. Quelch (${EN ? 'premise only, from the public listing' : 'الفكرة فقط من الصفحة العامة'})</li><li><a href="${TENK}" target="_blank" rel="noopener">Starbucks FY2002 Form 10-K, Item 2</a></li></ul>
      <p>${EN ? 'Characters, the café, dialogue and all store figures are illustrative.' : 'الشخصيات والمقهى والحوار وكل أرقام الفرع تعليمية.'}</p>
      <h4>${EN ? '3D models (CC BY)' : 'نماذج ثلاثية الأبعاد (CC BY)'}</h4><ul>${Object.values(c).map(([t, a, u, l]) => `<li><a href="${u}" target="_blank" rel="noopener">${t}</a> — ${a} · ${l}</li>`).join('')}</ul>
      <p>Poly Haven (CC0): furniture, pastries, textures, sky · Microsoft Rocketbox avatars (MIT) · ${EN ? 'Voices: Microsoft Edge neural TTS' : 'الأصوات: Microsoft Edge neural TTS'}</p>
      <button class="primary" id="crclose">${EN ? 'Close' : 'إغلاق'}</button></div>`;
    el.querySelector('#crclose').onclick = () => show('card', false);
  });
}
