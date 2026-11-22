// "Customise graphics" panel: pick a level, then fine-tune each cost on this very device (saved per browser).
import {quality, LEVELS, current, setCustom, applyQuality, dyn, MOBILE} from '../core/quality.js';
import {stats, renderer, clock} from '../core/engine.js';
import {sfx} from '../core/audio.js';

const EN = new URLSearchParams(location.search).get('lang') === 'en';
// English labels for the panel (?lang=en); the Arabic ones are the keys
const DICT = {'دقة العرض': 'Resolution', 'التلقائي يخفض الدقة قليلًا عند الحاجة بدل إطفاء المؤثرات': 'Auto lowers the resolution a little when needed instead of switching effects off', 'تلقائي': 'Auto', 'الإطارات': 'Frame rate', '30 ثابتة أنعم من 40 متذبذبة على الأجهزة المتوسطة': 'A steady 30 looks smoother than an uneven 40 on mid-range devices', '30 ثابتة': 'Steady 30', 'إضاءة المصابيح': 'Lamp lights', 'عدد المصابيح الحقيقية حول الكاميرا': 'How many real lamps light the area around the camera', 'الظلال': 'Shadows', 'بدون': 'Off', 'متوسطة': 'Medium', 'ناعمة': 'Soft', 'عالية': 'High', 'الظل المحيطي (AO)': 'Ambient occlusion (AO)', 'عمق الزوايا وتحت الأثاث': 'Depth in corners and under furniture', 'داخل المبنى': 'Indoors', 'دائمًا': 'Always', 'تنعيم الحواف': 'Anti-aliasing', 'سريع': 'Fast', 'التوهج': 'Bloom', 'تشغيل': 'On', 'إيقاف': 'Off'};
const T = (a) => EN ? (DICT[a] ?? a) : a;
const LV_EN = {high: 'High', medium: 'Medium', low: 'Low', cpu: 'Very light'};
const lvName = (q) => EN ? LV_EN[q] : LEVELS[q].name;

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
  const levelBtns = ['high', 'medium', 'low', 'cpu'].map(q => `<button data-lv="${q}" class="${!quality.custom && quality.level === q ? 'on' : ''}"><b>${lvName(q)}</b>${quality.auto === q ? `<small>${EN ? 'Suits this device' : 'مناسب لجهازك'}</small>` : '<small>&nbsp;</small>'}</button>`).join('');
  el.querySelector('.gx-body').innerHTML = `
    <div class="gx-levels">${levelBtns}</div>
    <div class="gx-sub">${quality.custom ? (EN ? 'Your own settings (based on “' + lvName(quality.custom.base || 'medium') + '”)' : 'إعداداتك الخاصة (مبنية على «' + lvName(quality.custom.base || 'medium') + '»)') : (EN ? 'Change any item to customise it — saved on this device' : 'عدّل أي بند لتخصيصه — يُحفظ على هذا الجهاز')}</div>
    ${L.direct ? `<div class="gx-sub">${EN ? 'The “no GPU” level shows the scene in its simplest form — pick another level to customise it.' : 'وضع «بدون كارت شاشة» يعرض المشهد بأبسط شكل — اختر مستوى آخر لتظهر خيارات التخصيص.'}</div>` : ROWS.map(r => `<div class="gx-row"><div class="gx-t">${T(r.t)}${r.hint ? `<small>${T(r.hint)}</small>` : ''}</div>
      <div class="gx-seg">${r.opts.map(([v, t]) => `<button data-k="${r.k}" data-v="${v}" class="${r.get() === v ? 'on' : ''}">${T(t)}</button>`).join('')}</div></div>`).join('')}`;
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
  el.querySelector('.gx-live').innerHTML = `<b>${stats.fps.toFixed(0)}</b> ${EN ? 'fps · rendering at' : 'إطار/ث · العرض الآن'} ${w}×${h} (${Math.round((dyn.fixed ?? dyn.scale) * 100)}%)${dyn.mode === 30 || current().fpsMode === '30' ? (EN ? ' · locked to 30' : ' · مثبّتة على 30') : ''}${quality.gpu ? ' · ' + quality.gpu.replace(/ANGLE \(|\)$/g, '').split(',').slice(0, 2).join(' ') : ''}`;
}
export function openSettings() {
  if (!el) {
    el = document.createElement('div'); el.id = 'gfx'; el.className = 'screen hidden';
    el.innerHTML = `<div class="gx-card"><div class="gx-head"><h2>${EN ? 'Customise graphics' : 'تخصيص الرسوميات'}</h2><button class="gx-x" aria-label="${EN ? 'Close' : 'إغلاق'}">✕</button></div>
      <p class="gx-lead">${EN ? 'The game picks what suits your device and lowers the resolution a little when needed, so the lighting and shadows stay as they are.' : 'اللعبة تختار تلقائيًا ما يناسب جهازك، وتخفض الدقة قليلًا عند الحاجة حتى تبقى الإضاءة والظلال كما هي.'} ${MOBILE ? (EN ? 'On a phone: close other apps for the best performance.' : 'على الموبايل: أغلق التطبيقات الأخرى للحصول على أفضل أداء.') : ''}</p>
      <div class="gx-body"></div><div class="gx-live"></div>
      <div class="gx-foot"><button class="ghost" id="gxreset">${EN ? 'Restore automatic settings' : 'استعادة الإعدادات التلقائية'}</button><button class="primary" id="gxok">${EN ? 'Done' : 'تم'}</button></div></div>`;
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
    const b = document.createElement('button'); b.className = 'gx-open'; b.innerHTML = EN ? '<b>⚙ Customise</b><small>Full control</small>' : '<b>⚙ تخصيص</b><small>تحكم كامل</small>';
    b.onclick = (e) => { e.stopPropagation(); openSettings(); };
    row.appendChild(b);
  });
  quality.onChange = () => { if (el && !el.classList.contains('hidden')) render(); };
}
