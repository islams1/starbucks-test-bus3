// Ellis's cost tablet (all figures illustrative). Two inputs can change: the contribution of an extra completed order
// ($2.00–$5.00 in $0.50 steps) and the extra orders a day (0–40); labor and operating days are fixed. The results are
// recomputed on every committed change; the balance and the white figures on the model follow them (onChange).
import {S, log} from './state.js';
import {LABOR, DAYS, breakEven, annual, yearly, money, status, STATUS} from './score.js';
import {$, show} from '../ui/ui.js';
import {sfx} from '../core/audio.js';

const EN = new URLSearchParams(location.search).get('lang') === 'en';
const tr = (ar, en) => EN ? en : ar;
const fmt = (v) => '$' + v.toLocaleString('en-US');

/** resolves when the player closes it (after comparing two distinct purchase assumptions) */
export function openTablet({onChange, onPreset, onContrib} = {}) {
  const el = $('tabletp'); el.className = 'tabletp'; show('tabletp', true);
  const m = S.model; m.contrib = m.contrib || 3; m.orders = m.orders ?? 20;
  S.tabletSeen = true; S.comparedOrders.add(m.orders); if (m.orders === 12) S.seenLow = true;
  el.innerHTML = `<div class="tp-scr" role="group" aria-label="${tr('نموذج الفرع', 'Store model')}">
    <div class="tp-head"><b>${tr('نموذج الفرع', 'Store model')}</b><span class="illus">${tr('تعليمي', 'Illustrative')}</span></div>
    <div class="tp-fixed"><span>${tr('العمالة الإضافية للفرع / سنة', 'Added annual labor per store')} <b>${fmt(LABOR)}</b></span><span>${tr('أيام العمل / سنة', 'Operating days per year')} <b>${DAYS}</b></span></div>
    <label class="tp-row"><span>${tr('صافي ربح الطلب الإضافي المكتمل', 'Net contribution per additional completed order')}</span>
      <span class="tp-ctl"><button type="button" data-d="c-" aria-label="${tr('أقل', 'Less')}">−</button><input id="tpc" type="range" min="2" max="5" step="0.5" aria-label="${tr('ربح الطلب', 'Contribution')}"><button type="button" data-d="c+" aria-label="${tr('أكثر', 'More')}">+</button></span><b id="tpcv" class="num"></b></label>
    <label class="tp-row"><span>${tr('طلبات إضافية مكتملة في اليوم', 'Additional completed orders per day')}</span>
      <span class="tp-ctl"><button type="button" data-d="o-" aria-label="${tr('أقل', 'Fewer')}">−</button><input id="tpo" type="range" min="0" max="40" step="1" aria-label="${tr('طلبات في اليوم', 'Orders per day')}"><button type="button" data-d="o+" aria-label="${tr('أكثر', 'More')}">+</button></span><b id="tpov" class="num"></b></label>
    <div class="tp-quick"><button type="button" data-o="12">${tr('12 طلبًا إضافيًا', '12 more orders')}</button><button type="button" data-o="20">${tr('20 طلبًا إضافيًا', '20 more orders')}</button><button type="button" data-o="26">${tr('26 طلبًا إضافيًا', '26 more orders')}</button><button type="button" id="tpreset" class="ghosty">${tr('إعادة النموذج', 'Reset model')}</button></div>
    <div class="tp-res" aria-live="polite">
      <div><span>${tr('ربح إضافي في السنة', 'Yearly added contribution')}</span><b id="tpy" class="num"></b></div>
      <div class="tp-calc num" id="tpcalc" dir="ltr"></div>
      <div class="tp-big" id="tpbig"><span id="tpst"></span><b id="tpe" class="num"></b></div>
      <div><span>${tr('طلبات كاملة في اليوم لتغطية العمالة', 'Whole orders/day to cover labor')}</span><b id="tpbe" class="num"></b></div>
    </div>
    <div class="tp-foot"><span id="tpcmp"></span><button type="button" id="tpdone" class="primary" disabled>${tr('تم', 'Done')}</button></div>
  </div>`;
  const q = (id) => el.querySelector('#' + id);
  const cr = q('tpc'), or = q('tpo');
  const render = () => {
    cr.value = m.contrib; or.value = m.orders;
    q('tpcv').textContent = '$' + m.contrib.toFixed(2); q('tpov').textContent = m.orders;
    const e = annual(m.orders, m.contrib), st = status(e);
    q('tpy').textContent = fmt(yearly(m.orders, m.contrib));
    q('tpcalc').textContent = `${m.orders} × ${DAYS} × $${m.contrib.toFixed(2)} − $21,600`;
    q('tpst').textContent = EN ? STATUS[st].en : STATUS[st].t; q('tpe').textContent = money(e); q('tpbig').className = 'tp-big ' + st;
    q('tpbe').textContent = breakEven(m.contrib);
    const n = S.comparedOrders.size;
    q('tpcmp').textContent = n >= 2 ? tr(`قارنت ${n} افتراضات للطلبات`, `Compared ${n} order assumptions`) : tr('جرّب افتراضًا ثانيًا للطلبات قبل أن تكمل', 'Try a second order assumption before you go on');
    q('tpdone').disabled = n < 2;
    onChange && onChange(m);
  };
  const commit = () => { S.comparedOrders.add(m.orders); if (m.orders === 12) S.seenLow = true; log('model', m.orders, m.contrib); render(); };
  const setC = (v) => { const c = Math.max(2, Math.min(5, Math.round(v * 2) / 2)); if (c === m.contrib) return; m.contrib = c; if (c !== 3) S.contribChanged = true; commit(); onContrib && onContrib(c); };
  const setO = (v) => { const o = Math.max(0, Math.min(40, Math.round(v))); if (o === m.orders) return; m.orders = o; commit(); };
  cr.oninput = () => { m.contrib = +cr.value; render(); };
  cr.onchange = () => { const c = +cr.value; m.contrib = -1; setC(c); };
  or.oninput = () => { m.orders = +or.value; render(); };
  or.onchange = () => { const o = +or.value; m.orders = -1; setO(o); };
  el.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { sfx.ui(); const d = b.dataset.d; if (d === 'c-') setC(m.contrib - 0.5); else if (d === 'c+') setC(m.contrib + 0.5); else if (d === 'o-') setO(m.orders - 1); else setO(m.orders + 1); });
  el.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { sfx.ui(); const o = +b.dataset.o; m.orders = o; commit(); onPreset && onPreset(o); });
  q('tpreset').onclick = () => { sfx.ui(); m.orders = 20; m.contrib = 3; commit(); };
  render();
  return new Promise(res => { q('tpdone').onclick = () => { sfx.ui(); show('tabletp', false); res(); }; });
}
export const tabletRect = () => { const s = $('tabletp'); return s && !s.classList.contains('hidden') ? s.getBoundingClientRect() : null; };

/** the screen of the tablet lying on the table (mirrors the model) */
export function drawTabletScreen(g, W, H, m) {
  g.fillStyle = '#f4f2ee'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#1f3a30'; g.fillRect(0, 0, W, H * 0.16);
  g.fillStyle = '#fff'; g.font = `600 ${H * 0.08}px "IBM Plex Sans Arabic"`; g.textAlign = 'center'; g.fillText(EN ? 'Store model' : 'نموذج الفرع', W / 2, H * 0.115);
  const e = annual(m.orders, m.contrib);
  g.fillStyle = '#333'; g.font = `500 ${H * 0.07}px Inter`; g.fillText(`${m.orders} × 360 × $${m.contrib.toFixed(2)}`, W / 2, H * 0.38);
  g.fillStyle = e > 0 ? '#2f7d4f' : e === 0 ? '#8a6d1f' : '#b23b2e'; g.font = `700 ${H * 0.14}px Inter`; g.fillText(money(e), W / 2, H * 0.66);
  g.fillStyle = '#7a6f5d'; g.font = `500 ${H * 0.06}px "IBM Plex Sans Arabic"`; g.fillText(EN ? 'Illustrative' : 'تعليمي', W / 2, H * 0.88);
}
