// "Customise graphics" panel: pick a level, then fine-tune each cost on this very device (saved per browser).
import {quality, LEVELS, current, setCustom, applyQuality, dyn, MOBILE} from '../core/quality.js';
import {stats, renderer, clock} from '../core/engine.js';
import {sfx} from '../core/audio.js';

const ROWS = [
  {k: 'resolution', t: 'دقة العرض', hint: 'التلقائي يخفض الدقة قليلًا عند الحاجة بدل إطفاء المؤثرات', opts: [['auto', 'تلقائي'], ['1', '100%'], ['0.85', '85%'], ['0.7', '70%'], ['0.55', '55%']],
    get: () => dyn.fixed == null ? 'auto' : String(dyn.fixed)},
  {k: 'fpsMode', t: 'الإطارات', hint: '30 ثابتة أنعم من 40 متذبذبة على الأجهزة المتوسطة', opts: [['auto', 'تلقائي'], ['30', '30 ثابتة'], ['60', '60']], get: () => String(current().fpsMode || 'auto')},
  {k: 'lights', t: 'إضاءة المصابيح', hint: 'عدد المصابيح الحقيقية حول الكاميرا', opts: [['2', '2'], ['4', '4'], ['6', '6'], ['8', '8']], get: () => String(current().lights), map: (v) => +v},
  {k: 'shadowQ', t: 'الظلال', opts: [['off', 'بدون'], ['mid', 'متوسطة'], ['soft', 'ناعمة'], ['high', 'عالية']],
    get: () => { const L = current(); return !L.shadow ? 'off' : L.shadow >= 4096 ? 'high' : L.soft ? 'soft' : 'mid'; },
    set: (v) => ({off: {shadow: 0}, mid: {shadow: 2048, soft: false}, soft: {shadow: 2048, soft: true}, high: {shadow: 4096, soft: true}}[v])},
  {k: 'ao', t: 'الظل المحيطي (AO)', hint: 'عمق الزوايا وتحت الأثاث', opts: [['off', 'بدون'], ['indoor', 'داخل المبنى'], ['always', 'دائمًا']], get: () => current().ao},
  {k: 'aa', t: 'تنعيم الحواف', opts: [['off', 'بدون'], ['fxaa', 'سريع'], ['msaa2', '×2'], ['msaa4', '×4']], get: () => current().aa},
  {k: 'bloom', t: 'التوهج', opts: [['1', 'تشغيل'], ['0', 'إيقاف']], get: () => current().bloom ? '1' : '0', map: (v) => v === '1'},
];

let el = null, timer = 0;
function render() {
  const L = current();
  const levelBtns = ['high', 'medium', 'low', 'cpu'].map(q => `<button data-lv="${q}" class="${!quality.custom && quality.level === q ? 'on' : ''}"><b>${LEVELS[q].name}</b>${quality.auto === q ? '<small>مناسب لجهازك</small>' : '<small>&nbsp;</small>'}</button>`).join('');
  el.querySelector('.gx-body').innerHTML = `
    <div class="gx-levels">${levelBtns}</div>
    <div class="gx-sub">${quality.custom ? 'إعداداتك الخاصة (مبنية على «' + LEVELS[quality.custom.base || 'medium'].name + '»)' : 'عدّل أي بند لتخصيصه — يُحفظ على هذا الجهاز'}</div>
    ${L.direct ? '<div class="gx-sub">وضع «بدون كارت شاشة» يعرض المشهد بأبسط شكل — اختر مستوى آخر لتظهر خيارات التخصيص.</div>' : ROWS.map(r => `<div class="gx-row"><div class="gx-t">${r.t}${r.hint ? `<small>${r.hint}</small>` : ''}</div>
      <div class="gx-seg">${r.opts.map(([v, t]) => `<button data-k="${r.k}" data-v="${v}" class="${r.get() === v ? 'on' : ''}">${t}</button>`).join('')}</div></div>`).join('')}`;
  el.querySelectorAll('[data-lv]').forEach(b => b.onclick = () => { sfx.ui(); dyn.fixed = null; applyQuality(b.dataset.lv, {manual: true}); render(); });
  el.querySelectorAll('.gx-seg button').forEach(b => b.onclick = () => {
    sfx.ui();
    const r = ROWS.find(x => x.k === b.dataset.k), v = b.dataset.v;
    setCustom(r.set ? r.set(v) : {[r.k]: r.map ? r.map(v) : v});
    render();
  });
}
function live() {
  if (!el || el.classList.contains('hidden')) return;
  const pr = renderer.getPixelRatio(), w = Math.round(innerWidth * pr), h = Math.round(innerHeight * pr);
  el.querySelector('.gx-live').innerHTML = `<b>${stats.fps.toFixed(0)}</b> إطار/ث · العرض الآن ${w}×${h} (${Math.round((dyn.fixed ?? dyn.scale) * 100)}%)${dyn.mode === 30 || current().fpsMode === '30' ? ' · مثبّتة على 30' : ''}${quality.gpu ? ' · ' + quality.gpu.replace(/ANGLE \(|\)$/g, '').split(',').slice(0, 2).join(' ') : ''}`;
}
export function openSettings() {
  if (!el) {
    el = document.createElement('div'); el.id = 'gfx'; el.className = 'screen hidden';
    el.innerHTML = `<div class="gx-card"><div class="gx-head"><h2>تخصيص الرسوميات</h2><button class="gx-x" aria-label="إغلاق">✕</button></div>
      <p class="gx-lead">اللعبة تختار تلقائيًا ما يناسب جهازك، وتخفض الدقة قليلًا عند الحاجة حتى تبقى الإضاءة والظلال كما هي. ${MOBILE ? 'على الموبايل: أغلق التطبيقات الأخرى للحصول على أفضل أداء.' : ''}</p>
      <div class="gx-body"></div><div class="gx-live"></div>
      <div class="gx-foot"><button class="ghost" id="gxreset">استعادة الإعدادات التلقائية</button><button class="primary" id="gxok">تم</button></div></div>`;
    document.body.appendChild(el);
    const close = () => { el.classList.add('hidden'); clearInterval(timer); };
    el.querySelector('.gx-x').onclick = close; el.querySelector('#gxok').onclick = close;
    el.querySelector('#gxreset').onclick = () => { sfx.ui(); dyn.fixed = null; applyQuality(quality.auto, {manual: true}); render(); };
    el.addEventListener('click', (e) => { if (e.target === el) close(); });
  }
  render(); live();
  el.classList.remove('hidden');
  clearInterval(timer); timer = setInterval(live, 500);
}
/** add a «تخصيص» button next to every quality row (menu + pause) */
export function mountSettingsButtons() {
  document.querySelectorAll('.qsel').forEach(row => {
    if (row.querySelector('.gx-open')) return;
    const b = document.createElement('button'); b.className = 'gx-open'; b.innerHTML = '<b>⚙ تخصيص</b><small>تحكم كامل</small>';
    b.onclick = (e) => { e.stopPropagation(); openSettings(); };
    row.appendChild(b);
  });
  quality.onChange = () => { if (el && !el.classList.contains('hidden')) render(); };
}
