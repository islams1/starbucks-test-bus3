// The decision memo: recommendation, one customer-evidence item, one cost-evidence item, one review condition. Only
// evidence already opened can be used; Back keeps the choices; the one-line explanation of the condition is recorded.
import {S} from './state.js';
import {ROUTES, CUST_EV, COST_EV, CONDS, breakEven, annual, money, condWhy} from './score.js';
import {$, show} from '../ui/ui.js';
import {sfx} from '../core/audio.js';

const EN = new URLSearchParams(location.search).get('lang') === 'en';
const tx = (o) => EN ? (o.en || o.t) : o.t;
const shuffle = (a, seed) => a.map((v, i) => [Math.abs(Math.sin(i * 12.9898 + seed) * 43758.5453) % 1, v]).sort((x, y) => x[0] - y[0]).map(x => x[1]);

/** one step: cards to pick from (keys 1..n). opts [{k, t, sub?, off?: reason}]; back: show a Back button */
export function pick(q, opts, {back = false, step = '', sel = null} = {}) {
  const el = $('panel'); el.className = 'memo'; show('panel', true);
  el.innerHTML = `<div class="memo-wrap">${step ? `<div class="memo-step">${step}</div>` : ''}<div class="memo-q">${q}</div><div class="memo-opts">${opts.map((o, i) => `<button type="button" class="mcard${o.off ? ' off' : ''}${sel === o.k ? ' sel' : ''}" data-k="${o.k}" ${o.off ? 'aria-disabled="true"' : ''}><kbd>${i + 1}</kbd><span>${o.t}${o.sub ? `<small>${o.sub}</small>` : ''}${o.off ? `<small class="need">${o.off}</small>` : ''}</span></button>`).join('')}</div>${back ? `<button type="button" class="ghost mback">${EN ? '← Back' : 'رجوع →'}</button>` : ''}</div>`;
  return new Promise(res => {
    const done = (k) => { sfx.ui(); removeEventListener('keydown', onKey); show('panel', false); res(k); };
    el.querySelectorAll('.mcard').forEach(b => b.onclick = () => { if (!b.classList.contains('off')) done(b.dataset.k); });
    const bk = el.querySelector('.mback'); if (bk) bk.onclick = () => done('__back');
    const onKey = (e) => { const n = parseInt(e.key, 10); if (n >= 1 && n <= opts.length && !opts[n - 1].off) done(opts[n - 1].k); else if (e.key === 'Backspace' && back) done('__back'); };
    addEventListener('keydown', onKey);
    setTimeout(() => { const f = el.querySelector('.mcard:not(.off)'); if (f) f.focus({preventScroll: true}); }, 30);
  });
}
export const stepTxt = (n) => EN ? n + ' / 4' : 'الخطوة ' + n + ' من 4';
const notYet = EN ? 'Not opened yet' : 'لم تفتحه بعد';
export const routeOpts = () => Object.entries(ROUTES).map(([k, r]) => ({k, t: tx(r), sub: EN ? r.badgeEn : r.badge}));
export const custOpts = () => Object.entries(CUST_EV).map(([k, r]) => ({k, t: tx(r), off: r.need() ? null : notYet}));
export const costOpts = () => {
  const m = S.model;
  return [
    {k: 'be', t: tx(COST_EV.be), sub: (EN ? 'Break-even: ' : 'التعادل: ') + breakEven(m.contrib) + (EN ? ` orders/day at $${m.contrib.toFixed(2)}` : ` طلبًا في اليوم عند ${m.contrib.toFixed(2)} دولار`), off: COST_EV.be.need() ? null : notYet},
    {k: 'low', t: tx(COST_EV.low), sub: (EN ? '12 orders: ' : '12 طلبًا: ') + money(annual(12, m.contrib)) + (EN ? ' a year per store' : ' في السنة للفرع'), off: COST_EV.low.need() ? null : (EN ? 'Try 12 orders on the tablet' : 'جرّب 12 طلبًا على التابلت')},
    {k: 'sales', t: tx(COST_EV.sales), sub: EN ? 'Revenue from the extra orders, without the labor cost' : 'إيراد الطلبات الإضافية، دون تكلفة العمالة', off: COST_EV.sales.need() ? null : notYet},
  ];
};
export const condOpts = (seed = 3) => shuffle(Object.entries(CONDS).map(([k, r]) => ({k, t: tx(r)})), seed);

/** the three evidence/condition steps with Back; resolves {cust, cost, cond} or null (Back from the first step) */
export async function evidenceSteps(memo, seed) {
  let i = 0;
  const steps = [
    () => pick(EN ? 'Customer evidence: which one supports your recommendation?' : 'دليل الزبائن: أيّه يدعم توصيتك؟', custOpts(), {back: true, step: stepTxt(2), sel: memo.cust}),
    () => pick(EN ? 'Cost evidence: which number goes in the memo?' : 'دليل التكلفة: أي رقم يدخل المذكرة؟', costOpts(), {back: true, step: stepTxt(3), sel: memo.cost}),
    () => pick(EN ? 'Review condition: what would make you keep or reverse it?' : 'شرط المراجعة: ما الذي يجعلك تستمر أو تتراجع؟', condOpts(seed), {back: true, step: stepTxt(4), sel: memo.cond}),
  ];
  const keys = ['cust', 'cost', 'cond'];
  while (i < steps.length) {
    const k = await steps[i]();
    if (k === '__back') { if (i === 0) return null; i--; continue; }
    memo[keys[i]] = k; i++;
  }
  return memo;
}

/** the memo for review: the explanation line, an optional note, confirm / change */
export function review(memo) {
  const el = $('panel'); el.className = 'memo'; show('panel', true);
  const m = S.model, why = condWhy(memo.route, memo.cond);
  memo.whyLine = EN ? why.en : why.t;
  el.innerHTML = `<div class="memo-doc"><div class="md-head"><b>${EN ? 'Decision memo' : 'مذكرة القرار'}</b><span class="illus">${EN ? 'Illustrative scenario' : 'سيناريو تعليمي'}</span></div>
    <dl>
      <dt>${EN ? 'Recommendation' : 'التوصية'}</dt><dd>${tx(ROUTES[memo.route])} <em>${EN ? ROUTES[memo.route].badgeEn : ROUTES[memo.route].badge}</em></dd>
      <dt>${EN ? 'First hypothesis' : 'الفرضية الأولى'}</dt><dd>${{peak: EN ? 'Peak wait at pickup' : 'انتظار الاستلام في الذروة', acc: EN ? 'Order accuracy' : 'دقة الطلبات', all: EN ? 'A storewide service problem' : 'مشكلة خدمة عامة في الفرع'}[S.hyp] || '—'}</dd>
      <dt>${EN ? 'Customer evidence' : 'دليل الزبائن'}</dt><dd>${tx(CUST_EV[memo.cust])}</dd>
      <dt>${EN ? 'Cost evidence' : 'دليل التكلفة'}</dt><dd>${tx(COST_EV[memo.cost])}</dd>
      <dt>${EN ? 'Model (illustrative)' : 'النموذج (تعليمي)'}</dt><dd><span class="ltr">${m.orders} × 360 × $${m.contrib.toFixed(2)} − $21,600 = ${money(annual(m.orders, m.contrib))}</span> · ${EN ? 'break-even' : 'التعادل'} ${breakEven(m.contrib)}</dd>
      <dt>${EN ? 'Review condition' : 'شرط المراجعة'}</dt><dd>${tx(CONDS[memo.cond])}<div class="whyline ${why.fit ? 'fit' : 'nofit'}">${memo.whyLine}</div></dd>
    </dl>
    <label class="why">${EN ? 'Your note (optional):' : 'ملاحظتك (اختياري):'}<input id="mnote" maxlength="140"></label>
    <div class="md-foot"><button type="button" id="mback" class="ghost">${EN ? 'Change' : 'غيّر'}</button><button type="button" id="mroute" class="ghost">${EN ? 'Change the recommendation' : 'غيّر التوصية'}</button><button type="button" id="mok" class="primary">${EN ? 'Confirm the memo' : 'أكّد المذكرة'}</button></div></div>`;
  if (memo.note) el.querySelector('#mnote').value = memo.note;
  return new Promise(res => {
    const out = (v) => { sfx.ui(); memo.note = el.querySelector('#mnote').value.trim(); show('panel', false); res(v); };
    el.querySelector('#mok').onclick = () => out('ok');
    el.querySelector('#mback').onclick = () => out('back');
    el.querySelector('#mroute').onclick = () => out('route');
  });
}
