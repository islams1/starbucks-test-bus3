// Scene 3: the break-even question (a notepad) and the cost tablet (all figures illustrative).
import {S, log} from './state.js';
import {LABOR, DAYS, breakEven, annual, money} from './score.js';
import {$, show} from '../ui/ui.js';
import {sfx} from '../core/audio.js';
import {setInput} from '../core/input.js';

const EN = new URLSearchParams(location.search).get('lang') === 'en';
const tr = (ar, en) => EN ? en : ar;

/** notepad with a number pad; resolves with the number the player enters */
export function askNumber(title, hint) {
  setInput(false);
  const el = $('panel'); el.className = 'notepad'; show('panel', true);
  let v = '';
  el.innerHTML = `<div class="np-paper"><div class="np-title">${title}</div><div class="np-sum"><span>${EN ? 'orders / day =' : 'طلبات في اليوم ='}</span> <b id="npv">؟</b></div>
    <div class="np-keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '⌫', 0, '✓'].map(k => `<button data-k="${k}">${k}</button>`).join('')}</div><div class="np-hint">${hint || ''}</div></div>`;
  const out = el.querySelector('#npv');
  return new Promise(res => {
    const press = (k) => {
      sfx.ui();
      if (k === '⌫') v = v.slice(0, -1);
      else if (k === '✓') { if (!v) return; const n = parseInt(v, 10); cleanup(); res(n); return; }
      else if (v.length < 4) v += k;
      out.textContent = v || '؟';
    };
    el.querySelectorAll('button').forEach(b => b.onclick = () => press(b.dataset.k));
    const onKey = (e) => { if (/^\d$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('⌫'); else if (e.key === 'Enter') press('✓'); };
    addEventListener('keydown', onKey);
    const cleanup = () => { removeEventListener('keydown', onKey); el.className = 'hidden'; };
  });
}

/** the cost tablet. hooks: onPreset(n), onContrib(c); resolves when the player closes it (after comparing two assumptions) */
export function openTablet({onPreset, onContrib, onDraw} = {}) {
  setInput(false);
  const el = $('panel'); el.className = 'tablet'; show('panel', true);
  const m = S.model; m.contrib = m.contrib || 3; m.orders = m.orders ?? 20;
  const seen = new Set([m.orders]);
  S.compared.add(m.orders + '@' + m.contrib);
  el.innerHTML = `<div class="tab-dev"><div class="tab-scr">
    <div class="tab-head"><b>${tr('نموذج الفرع', 'Store model')}</b><span class="illus">${tr('تعليمي', 'Illustrative')}</span></div>
    <div class="tab-grid">
      <div class="row fixed"><span>${tr('العمالة الإضافية للفرع في السنة', 'Added annual labor per store')}</span><b>$21,600</b><small>${tr('ثابت', 'Fixed')}</small></div>
      <div class="row fixed"><span>${tr('أيام العمل في السنة', 'Operating days per year')}</span><b>360</b><small>${tr('ثابت', 'Fixed')}</small></div>
      <div class="row"><span>${tr('صافي ربح الطلب الإضافي', 'Net contribution per extra order')}</span><b id="tbc"></b><input id="tbcr" type="range" min="2" max="5" step="0.5"></div>
      <div class="row"><span>${tr('الطلبات الإضافية في اليوم', 'Additional orders per day')}</span><b id="tbo"></b><div class="step"><button id="tbm">−</button><input id="tbor" type="range" min="0" max="40" step="1"><button id="tbp">+</button></div></div>
    </div>
    <div class="tab-quick"><span>${tr('افتراضات سريعة:', 'Quick assumptions:')}</span><button data-o="12">${tr('12 طلبًا', '12 orders')}</button><button data-o="20">${tr('20 طلبًا', '20 orders')}</button><button data-o="26">${tr('26 طلبًا', '26 orders')}</button><button id="tbreset" class="ghosty">${tr('إعادة النموذج', 'Reset model')}</button></div>
    <div class="tab-res">
      <div class="res-line"><span>${tr('الربح الإضافي في السنة', 'Yearly added contribution')}</span><b id="tby"></b></div>
      <div class="res-line"><span>${tr('ناقص العمالة', 'Minus labor')}</span><b>−$21,600</b></div>
      <div class="res-big"><span id="tbst"></span><b id="tbe"></b></div>
      <div class="bar"><i id="tbbar"></i><em></em></div>
      <div class="res-be">${tr('الطلبات اللازمة لتغطية العمالة', 'Whole orders/day to cover labor')}: <b id="tbbe"></b></div>
    </div>
    <div class="tab-foot"><span id="tbcmp"></span><button id="tbdone" class="primary" disabled>${tr('تم — إلى اللجنة', 'Done — to the committee')}</button></div>
  </div></div>`;
  const q = (id) => el.querySelector('#' + id);
  const cr = q('tbcr'), or = q('tbor');
  const render = () => {
    cr.value = m.contrib; or.value = m.orders;
    q('tbc').textContent = '$' + m.contrib.toFixed(2); q('tbo').textContent = m.orders;
    const y = Math.round(m.orders * DAYS * m.contrib), e = annual(m.orders, m.contrib);
    q('tby').textContent = '$' + y.toLocaleString('en-US');
    q('tbe').textContent = money(e);
    const st = e > 0 ? ['above', tr('فوق التكلفة', 'Above cost')] : e === 0 ? ['even', tr('يغطي التكلفة بالضبط', 'Covers cost exactly')] : ['below', tr('تحت التكلفة', 'Below cost')];
    q('tbst').textContent = st[1]; el.querySelector('.res-big').className = 'res-big ' + st[0];
    const k = Math.max(-1, Math.min(1, e / LABOR)); const bar = q('tbbar'); bar.style.width = Math.abs(k) * 50 + '%'; bar.style.left = k < 0 ? (50 - Math.abs(k) * 50) + '%' : '50%'; bar.className = st[0];
    q('tbbe').textContent = breakEven(m.contrib) + tr(' طلبًا في اليوم', ' orders a day');
    const n = seen.size; q('tbcmp').textContent = n >= 2 ? tr('قارنت ' + n + ' افتراضات', 'Compared ' + n + ' assumptions') : tr('جرّب افتراضًا آخر للمقارنة', 'Try another assumption to compare');
    q('tbdone').disabled = n < 2;
    onDraw && onDraw(m);
  };
  const commit = (why) => { seen.add(m.orders); S.compared.add(m.orders + '@' + m.contrib); log('model', m.orders, m.contrib); render(); };
  cr.oninput = () => { m.contrib = +cr.value; render(); };
  cr.onchange = () => { m.contrib = +cr.value; if (m.contrib !== 3) S.contribChanged = true; commit(); onContrib && onContrib(m.contrib); };
  or.oninput = () => { m.orders = +or.value; render(); };
  or.onchange = () => { m.orders = +or.value; commit(); };
  q('tbm').onclick = () => { m.orders = Math.max(0, m.orders - 1); sfx.ui(); commit(); };
  q('tbp').onclick = () => { m.orders = Math.min(40, m.orders + 1); sfx.ui(); commit(); };
  el.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { m.orders = +b.dataset.o; sfx.ui(); commit(); onPreset && onPreset(m.orders); });
  q('tbreset').onclick = () => { m.orders = 20; m.contrib = 3; sfx.ui(); render(); };
  render();
  return new Promise(res => { q('tbdone').onclick = () => { sfx.ui(); el.className = 'hidden'; res(); }; });
}

/** small canvas for the 3D tablet on the table (mirrors the model) */
export function drawTabletScreen(g, W, H, m) {
  g.fillStyle = '#f4f2ee'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#1f3a30'; g.fillRect(0, 0, W, H * 0.16);
  g.fillStyle = '#fff'; g.font = `600 ${H * 0.07}px "IBM Plex Sans Arabic"`; g.textAlign = 'center'; g.fillText('نموذج الفرع', W / 2, H * 0.11);
  const e = annual(m.orders, m.contrib);
  g.fillStyle = '#333'; g.font = `500 ${H * 0.06}px Inter`; g.fillText(`${m.orders} × 360 × $${m.contrib.toFixed(2)}`, W / 2, H * 0.36);
  g.fillStyle = e > 0 ? '#2f7d4f' : e === 0 ? '#8a6d1f' : '#b23b2e'; g.font = `700 ${H * 0.12}px Inter`; g.fillText(money(e), W / 2, H * 0.62);
}
