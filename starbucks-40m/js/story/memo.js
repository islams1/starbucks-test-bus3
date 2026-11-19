// Scene 4: the decision memo, built step by step on the meeting-room screen (one slide per step).
import {S} from './state.js';
import {ROUTES, CUST_EV, COST_EV, CONDS, breakEven, annual, money} from './score.js';
import {$, show} from '../ui/ui.js';
import {sfx} from '../core/audio.js';
import {setInput} from '../core/input.js';

const EN = new URLSearchParams(location.search).get('lang') === 'en';
const tx = (o) => EN ? (o.en || o.t) : o.t;
const shuffle = (a, seed) => a.map((v, i) => [Math.sin(i * 12.9898 + seed) * 43758.5453 % 1, v]).sort((x, y) => x[0] - y[0]).map(x => x[1]);

let screen = null;
export function bindScreen(s) { screen = s; }
export function slide(title, lines = [], foot = '') {
  if (!screen) return;
  screen.draw((g, W, H) => {
    g.fillStyle = '#f3efe7'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#1f3a30'; g.fillRect(0, 0, W, 120);
    g.fillStyle = '#f3efe7'; g.font = '600 54px "IBM Plex Sans Arabic"'; g.textAlign = 'right'; g.fillText(title, W - 70, 80);
    g.fillStyle = '#9b8a6a'; g.font = '500 30px "IBM Plex Sans Arabic"'; g.textAlign = 'left'; g.fillText('سيناريو تعليمي', 60, 78);
    g.textAlign = 'right'; let y = 210;
    for (const [k, v] of lines) {
      g.fillStyle = '#7a6f5d'; g.font = '500 32px "IBM Plex Sans Arabic"'; g.fillText(k, W - 70, y);
      g.fillStyle = '#1d1d1b'; g.font = '600 40px "IBM Plex Sans Arabic"';
      // wrap long text
      const words = String(v).split(' '); let line = '', yy = y + 56;
      for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > W - 160) { g.fillText(line, W - 70, yy); yy += 52; line = w; } else line = t; }
      if (line) g.fillText(line, W - 70, yy);
      y = yy + 78;
    }
    if (foot) { g.fillStyle = '#7a6f5d'; g.font = '500 30px "IBM Plex Sans Arabic"'; g.fillText(foot, W - 70, H - 50); }
  });
}

/** one step: cards to pick from (keys 1..n work too) */
export function pick(q, opts) {
  setInput(false);
  const el = $('panel'); el.className = 'memo'; show('panel', true);
  el.innerHTML = `<div class="memo-wrap"><div class="memo-q">${q}</div><div class="memo-opts">${opts.map((o, i) => `<button class="mcard" data-k="${o.k}"><kbd>${i + 1}</kbd><span>${o.t}${o.sub ? `<small>${o.sub}</small>` : ''}</span></button>`).join('')}</div></div>`;
  return new Promise(res => {
    const done = (k) => { sfx.ui(); removeEventListener('keydown', onKey); el.className = 'hidden'; res(k); };
    el.querySelectorAll('.mcard').forEach(b => b.onclick = () => done(b.dataset.k));
    const onKey = (e) => { const n = parseInt(e.key, 10); if (n >= 1 && n <= opts.length) done(opts[n - 1].k); };
    addEventListener('keydown', onKey);
  });
}
export const routeOpts = () => Object.entries(ROUTES).map(([k, r]) => ({k, t: tx(r)}));
export const custOpts = () => Object.entries(CUST_EV).map(([k, r]) => ({k, t: tx(r)}));
export const costOpts = () => {
  const m = S.model; return [
    {k: 'be', t: tx(COST_EV.be), sub: (EN ? 'Break-even: ' : 'التعادل: ') + breakEven(m.contrib) + (EN ? ' orders/day at $' : ' طلبًا في اليوم عند ') + m.contrib.toFixed(2) + (EN ? '' : ' دولار')},
    {k: 'low', t: tx(COST_EV.low), sub: money(annual(12, 3)) + (EN ? ' a year per store' : ' في السنة للفرع')},
    {k: 'sales', t: tx(COST_EV.sales), sub: EN ? 'Revenue from the extra orders, without the labor cost' : 'إيراد الطلبات الإضافية، دون تكلفة العمالة'},
  ];
};
export const condOpts = (seed = 3) => shuffle(Object.entries(CONDS).map(([k, r]) => ({k, t: tx(r)})), seed);

/** final review: shows the memo, optional one-line reason, confirm */
export function review(memo) {
  setInput(false);
  const el = $('panel'); el.className = 'memo'; show('panel', true);
  const m = S.model;
  el.innerHTML = `<div class="memo-doc"><div class="md-head"><b>${EN ? 'Decision memo' : 'مذكرة القرار'}</b><span class="illus">${EN ? 'Illustrative scenario' : 'سيناريو تعليمي'}</span></div>
    <dl>
      <dt>${EN ? 'Recommendation' : 'التوصية'}</dt><dd>${tx(ROUTES[memo.route])} <em>${EN ? ROUTES[memo.route].badgeEn : ROUTES[memo.route].badge}</em></dd>
      <dt>${EN ? 'First hypothesis' : 'الفرضية الأولى'}</dt><dd>${{peak: EN ? 'Peak wait at pickup' : 'انتظار الاستلام في الذروة', acc: EN ? 'Order accuracy' : 'دقة الطلبات', all: EN ? 'A storewide problem' : 'مشكلة عامة في الفرع'}[S.hyp] || '—'}</dd>
      <dt>${EN ? 'Customer evidence' : 'دليل الزبائن'}</dt><dd>${tx(CUST_EV[memo.cust])}</dd>
      <dt>${EN ? 'Cost evidence' : 'دليل التكلفة'}</dt><dd>${tx(COST_EV[memo.cost])}</dd>
      <dt>${EN ? 'Model (illustrative)' : 'النموذج (تعليمي)'}</dt><dd><span dir="ltr">${m.orders} × 360 × $${m.contrib.toFixed(2)} − $21,600 = ${money(annual(m.orders, m.contrib))}</span> · ${EN ? 'break-even' : 'التعادل'} ${breakEven(m.contrib)}</dd>
      <dt>${EN ? 'Review condition' : 'شرط المراجعة'}</dt><dd>${tx(CONDS[memo.cond])}</dd>
    </dl>
    <label class="why">${EN ? 'Why this condition fits (optional):' : 'لماذا يناسب هذا الشرط (اختياري):'}<input id="mwhy" maxlength="140"></label>
    <div class="md-foot"><button id="mback" class="ghost">${EN ? 'Change' : 'غيّر'}</button><button id="mok" class="primary">${EN ? 'Confirm the memo' : 'أكّد المذكرة'}</button></div></div>`;
  return new Promise(res => {
    el.querySelector('#mok').onclick = () => { sfx.ui(); memo.why = el.querySelector('#mwhy').value.trim(); el.className = 'hidden'; res(true); };
    el.querySelector('#mback').onclick = () => { sfx.ui(); el.className = 'hidden'; res(false); };
  });
}
