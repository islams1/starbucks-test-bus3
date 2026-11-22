// Spread 4 — the real turnaround (Concept A §4 and §8). Three panels on the archive board, in order: the 2004 action
// plan, what changed in 2005, the net result (two bars on one signed scale with a zero line, the sign written as a
// word, not shown by colour alone, and the continuing / discontinuing table). Beside the wall, the readable archive
// card with its own language button (it redraws the wall too); DKK and the source captions stay in both languages.
// Then three review checks with immediate feedback, and the final card (the same for every branch).
import * as THREE from 'three';
import {$, show} from '../ui/ui.js';
import {canvasTex} from '../world/materials.js';
import {setPanel} from '../world/workshop.js';
import {txt, wrap, FA, FE} from '../world/props.js';
import {EN, tr} from './alloc.js';
import {S, save} from './state.js';
import {pitchSummary, coachHtml} from './cards.js';
import {sfx} from '../core/audio.js';

export let AL = EN ? 'en' : 'ar';                 // the archive's own language (its button switches it in place)
const L = (a, e) => AL === 'en' ? e : a;
const M = '−';
const SRC = [
  {ar: 'المصدر: التقرير السنوي لمجموعة LEGO لعام 2004، قسم «الاستراتيجية وخطة العمل»، ص 8–9.', en: 'Source: LEGO Group Annual Report 2004, "Strategy and Action Plan", pp. 8–9.'},
  {ar: 'المصدر: التقرير السنوي لمجموعة LEGO لعام 2005، «المنتجات» ص 8، و«نتيجة خطة العمل منذ مارس 2004» ص 11، والملاحظة 23 ص 53.', en: 'Source: LEGO Group Annual Report 2005, "Products" p. 8, "Result of the Action Plan from March 2004" p. 11, Note 23 p. 53.'},
  {ar: 'المصدر: التقرير السنوي لمجموعة LEGO لعام 2005، «أبرز الأرقام المالية» (ص 3 من ملف PDF): صافي الربح/(الخسارة) للسنة، بالمليون كرونة دنماركية.', en: 'Source: LEGO Group Annual Report 2005, "Financial Highlights" (PDF p. 3): net profit/(loss) for the year, DKK million.'},
];
const PANELS = [
  {tag: '2004', title: () => L('خطة العمل', 'The action plan'), lead: () => L('في مارس 2004 أعلنت المجموعة خطة عمل بثلاثة محاور:', 'In March 2004 the group announced an action plan with three themes:'),
    items: () => [L('تحديد اتجاه واضح، وتغيير طريقة العمل تغييرًا جذريًا', 'Set clear direction and fundamentally change the way it does business'),
      L('استعادة القدرة التنافسية بالتركيز على العملاء، وخاصة ربحيتهم', 'Restore competitiveness by focusing on customers, in particular their profitability'),
      L('تقليل المخاطر بمواءمة الأنشطة وقاعدة التكاليف والأصول مع إيرادات أقل', 'Reduce risk by right-sizing activities, the cost base and assets to a lower revenue base')], line: 'nar_archive1'},
  {tag: '2005', title: () => L('ما الذي تغيّر', 'What changed'), lead: () => '',
    items: () => [L('المنتجات: كان للتركيز المتزايد على المنتجات الأساسية أثر إيجابي في نتائج 2005.', 'Products: the increased focus on core products had a positive effect on the 2005 results.'),
      L('الأصول: بيعت متنزهات LEGOLAND في يوليو 2005 بدمجها في شركة جديدة مع Merlin Entertainments؛ وتحتفظ المجموعة مع KIRKBI بحصة أقلية مشتركة (30%).', 'Assets: the LEGOLAND Parks were sold in July 2005 by merging them into a new company with Merlin Entertainments; the group and KIRKBI keep a joint minority interest (30%).'),
      L('ويصف التقرير أيضًا تغييرات أخرى في الإنتاج والتكاليف والتوريد.', 'The report also describes other changes in production, costs and supply.')], line: 'nar_archive2'},
  {tag: '2004 · 2005', title: () => L('صافي النتيجة', 'Net result'), lead: () => '', items: () => [], line: 'nar_archive3', chart: true},
];
const ROWS = () => [[L('الأنشطة المستمرة', 'Continuing activities'), -1473, 331], [L('الأنشطة المتوقفة', 'Discontinuing activities'), -458, 174], [L('الصافي للسنة', 'Net for the year'), -1931, 505]];
const fmt = (v) => (v < 0 ? M : '+') + Math.abs(v).toLocaleString('en-US');
const NOTE = () => L('النتيجة الإجمالية تعكس تغييرات كثيرة مترابطة، ولا تُنسب إلى أي بطاقة لعبتها في هذا التمرين.', 'The overall result reflects several linked changes and is not attributable to any one card you played in this exercise.');

// ---------------------------------------------------------------- the wall panels (canvas)
const rtl = () => AL !== 'en', F = () => AL === 'en' ? FE : FA;
const sxA = (W, m) => rtl() ? W - m : m;
function drawPanelTex(i) {
  const P = PANELS[i];
  const t = canvasTex(1600, 2176, (c, W0, H0) => {
    c.scale(1.6, 1.6); const W = 1000, H = 1360;
    c.fillStyle = '#f7f6f2'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#25282c'; c.fillRect(0, 0, W, 150);
    txt(c, P.tag, sxA(W, 50), 102, {px: 64, w: 800, col: '#f2efe8', rtl: false, align: rtl() ? 'right' : 'left', font: FE});
    txt(c, P.title(), rtl() ? 50 : W - 50, 102, {px: 56, w: 700, col: '#f2efe8', rtl: rtl(), align: rtl() ? 'left' : 'right', font: F()});
    let y = 240;
    if (P.lead()) y = wrap(c, P.lead(), sxA(W, 50), y, W - 100, 62, {px: 44, w: 700, rtl: rtl(), font: F(), col: '#111315'}) + 20;
    for (const it of P.items()) {
      c.fillStyle = '#c8553d'; c.fillRect(rtl() ? W - 62 : 50, y - 26, 14, 14);
      y = wrap(c, it, sxA(W, 80), y, W - 140, 60, {px: 42, w: 600, rtl: rtl(), font: F(), col: '#141618'}) + 26;
    }
    if (P.chart) y = drawChart(c, W, 200);
    // the source caption (both languages kept)
    const s = SRC[i];
    c.fillStyle = '#d6d1c6'; c.fillRect(50, H - 250, W - 100, 3);
    wrap(c, s.ar, W - 50, H - 190, W - 100, 40, {px: 28, w: 600, rtl: true, font: FA, col: '#3d4046'});
    wrap(c, s.en, 50, H - 95, W - 100, 38, {px: 26, w: 600, rtl: false, font: FE, col: '#3d4046'});
  });
  t.anisotropy = 16; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  return t;
}
/** two bars on one signed scale (−2,000 … +1,000) with a zero line; returns the y below it */
function drawChart(c, W, y0) {
  const top = y0 + 40, h = 400, x0 = 150, x1 = W - 80, v2y = (v) => top + (1000 - v) / 3000 * h;
  c.strokeStyle = '#c9c4ba'; c.lineWidth = 2; c.fillStyle = '#6b6f75'; c.font = `500 26px ${FE}`; c.textAlign = 'right'; c.direction = 'ltr';
  for (const v of [1000, 0, -1000, -2000]) { const y = v2y(v); c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke(); c.fillText((v < 0 ? M : v > 0 ? '+' : '') + Math.abs(v).toLocaleString('en-US'), x0 - 14, y + 9); }
  c.strokeStyle = '#25282c'; c.lineWidth = 5; c.beginPath(); c.moveTo(x0, v2y(0)); c.lineTo(x1, v2y(0)); c.stroke();
  txt(c, L('صفر', 'zero'), rtl() ? x1 : x1, v2y(0) - 12, {px: 26, w: 700, col: '#25282c', rtl: rtl(), font: F(), align: 'right'});
  const bars = [[2004, -1931, L('خسارة', 'Loss')], [2005, 505, L('ربح', 'Profit')]];
  const bw = 170, gap = (x1 - x0 - 2 * bw) / 3;
  bars.forEach(([yr, v, word], k) => {
    const bx = rtl() ? x1 - gap - (k + 1) * bw - k * gap : x0 + gap + k * (bw + gap);
    const ya = v2y(Math.max(0, v)), yb = v2y(Math.min(0, v));
    c.fillStyle = v < 0 ? '#8c4a3e' : '#3f7a5a'; c.fillRect(bx, ya, bw, yb - ya);
    if (v < 0) { c.fillStyle = 'rgba(255,255,255,.25)'; for (let s = ya; s < yb; s += 18) c.fillRect(bx, s, bw, 6); }      // a pattern too: not colour alone
    c.fillStyle = '#25282c'; c.font = `800 34px ${FE}`; c.textAlign = 'center'; c.direction = 'ltr';
    c.fillText(String(yr), bx + bw / 2, v < 0 ? v2y(0) - 16 : v2y(0) + 40);
    const ly = v < 0 ? yb + 46 : ya - 56;
    txt(c, word, bx + bw / 2, ly, {px: 34, w: 700, col: '#25282c', rtl: rtl(), font: F(), align: 'center'});
    c.font = `800 36px ${FE}`; c.textAlign = 'center'; c.direction = 'ltr'; c.fillStyle = '#25282c'; c.fillText(fmt(v), bx + bw / 2, ly + 40);
  });
  let y = top + h + 120;
  txt(c, L('بالمليون كرونة دنماركية (DKK m)', 'DKK million (DKK m)'), sxA(W, 50), y, {px: 28, w: 600, col: '#55595f', rtl: rtl(), font: F()});
  // the table
  y += 50;
  const cols = rtl() ? [W - 50, 330, 140] : [50, W - 330, W - 140];
  c.fillStyle = '#25282c';
  txt(c, '2004', cols[1], y, {px: 28, w: 700, rtl: false, font: FE, align: 'center'}); txt(c, '2005', cols[2], y, {px: 28, w: 700, rtl: false, font: FE, align: 'center'});
  for (const [name, a, b] of ROWS()) {
    y += 46; c.fillStyle = '#e2ddd3'; c.fillRect(50, y - 32, W - 100, 2);
    txt(c, name, cols[0], y, {px: 28, w: 600, rtl: rtl(), font: F(), align: rtl() ? 'right' : 'left'});
    txt(c, fmt(a), cols[1], y, {px: 28, w: 700, rtl: false, font: FE, align: 'center'}); txt(c, fmt(b), cols[2], y, {px: 28, w: 700, rtl: false, font: FE, align: 'center'});
  }
  y += 56;
  return wrap(c, NOTE(), sxA(W, 50), y, W - 100, 34, {px: 26, w: 600, rtl: rtl(), font: F(), col: '#3a3d42'});
}
// in Arabic the panels read right to left: the 2004 plan on the right
const slot = (i) => AL === 'en' ? i : 2 - i;
let shown = 0;
export function showPanels(n) { shown = n; for (let i = 0; i < 3; i++) setPanel(slot(i), i < n ? drawPanelTex(i) : null, i < n); for (let i = 0; i < 3; i++) if (i >= n) setPanel(slot(i), null, false); }
export const panelSlot = slot;

// ---------------------------------------------------------------- the readable archive card
export function archiveCard(i, {onNext, onLang} = {}) {
  const P = PANELS[i], el = $('archive');
  el.className = AL === 'en' ? 'ltr' : 'rtl';
  el.setAttribute('dir', AL === 'en' ? 'ltr' : 'rtl');
  const body = P.chart ? chartHtml() : `${P.lead() ? `<p>${P.lead()}</p>` : ''}<ul>${P.items().map(x => `<li>${x}</li>`).join('')}</ul>`;
  el.innerHTML = `<div class="ar-in" role="region" aria-label="${L('الأرشيف', 'Archive')}">
    <div class="ar-head"><span class="ar-n">${L(`لوحة ${i + 1} من 3`, `Panel ${i + 1} of 3`)}</span><button class="ghost" id="arlang">${AL === 'en' ? 'العربية' : 'English'}</button></div>
    <h2><bdi dir="ltr">${P.tag}</bdi> · ${P.title()}</h2>${body}
    <div class="ar-src"><p dir="rtl">${SRC[i].ar}</p><p dir="ltr">${SRC[i].en}</p></div>
    <div class="pc-btns"><button class="primary" id="arnext">${i < 2 ? L('اللوحة التالية ←', 'Next panel →') : L('أسئلة المراجعة ←', 'Review checks →')}</button></div></div>`;
  $('arlang').onclick = () => { AL = AL === 'en' ? 'ar' : 'en'; showPanels(shown); archiveCard(i, {onNext, onLang}); onLang && onLang(); };
  $('arnext').onclick = () => onNext && onNext();
  show('archive', true);
}
export function chartHtml() {
  const v2y = (v) => 20 + (1000 - v) / 3000 * 220;
  const bar = (x, v, yr, word) => { const ya = v2y(Math.max(0, v)), yb = v2y(Math.min(0, v)); return `<rect x="${x}" y="${ya}" width="70" height="${yb - ya}" class="${v < 0 ? 'neg' : 'pos'}"/><text x="${x + 35}" y="${v < 0 ? v2y(0) - 8 : v2y(0) + 20}" class="yr">${yr}</text><text x="${x + 35}" y="${v < 0 ? yb + 20 : ya - 26}" class="wd">${word}</text><text x="${x + 35}" y="${v < 0 ? yb + 40 : ya - 8}" class="vl">${fmt(v)}</text>`; };
  const rtlX = AL !== 'en';
  const ticks = [1000, 0, -1000, -2000].map(v => `<line x1="60" x2="330" y1="${v2y(v)}" y2="${v2y(v)}" class="${v === 0 ? 'zero' : 'grid'}"/><text x="54" y="${v2y(v) + 4}" class="tk">${v < 0 ? M : v > 0 ? '+' : ''}${Math.abs(v).toLocaleString('en-US')}</text>`).join('');
  return `<figure class="chart"><svg viewBox="0 0 340 290" style="direction:ltr" role="img" aria-label="${L('صافي النتيجة: خسارة 1,931 مليون كرونة في 2004، وربح 505 مليون كرونة في 2005', 'Net result: a loss of DKK 1,931 million in 2004 and a profit of DKK 505 million in 2005')}">${ticks}
    ${bar(rtlX ? 220 : 110, -1931, 2004, L('خسارة', 'Loss'))}${bar(rtlX ? 110 : 220, 505, 2005, L('ربح', 'Profit'))}<text x="335" y="${v2y(0) - 4}" class="zl">${L('صفر', 'zero')}</text></svg>
    <figcaption>${L('بالمليون كرونة دنماركية (DKK m)', 'DKK million (DKK m)')}</figcaption></figure>
    <table class="ar-t"><tr><th></th><th>2004</th><th>2005</th></tr>${ROWS().map(([n, a, b]) => `<tr><td>${n}</td><td><bdi dir="ltr">${fmt(a)}</bdi></td><td><bdi dir="ltr">${fmt(b)}</bdi></td></tr>`).join('')}</table>
    <p class="ar-note">${NOTE()}</p>`;
}

// ---------------------------------------------------------------- the three review checks
const CHECKS = () => [
  {q: tr('لماذا نستخدم سجلّ القدرة؟', 'Why use a capacity ledger?'), ok: 1,
    o: [tr('ليُظهر أي فكرة هي الأكثر إبداعًا.', 'To show which idea is the most creative.'), tr('ليُظهر أي الأولويات يستطيع الفريق أن يوفّر لها أشخاصًا في الوقت نفسه.', 'To show which priorities the team can actually staff at the same time.'), tr('ليجعل المقترحات كلها تبدو متساوية.', 'To make all the proposals look equal.')],
    fb: tr('التكلفة الظاهرة تفرض المفاضلة.', 'A visible cost forces trade-offs.')},
  {q: tr('لماذا نتحقق من توفّر المنتج لدى التاجر قبل التوسّع الواسع؟', 'Why check retailer availability before broad expansion?'), ok: 0,
    o: [tr('لأن الطلب القائم وقدرة التوصيل يؤثران في إمكانية خدمة النمو.', 'Existing demand and delivery capacity affect whether growth can be served.'), tr('لأن التاجر هو من يحدّد الأسعار.', 'Because the retailer sets the prices.'), tr('لأن التوسّع لا يحتاج إلى بيانات.', 'Because expansion does not need data.')],
    fb: tr('قد يكون المنتج مطلوبًا ويظلّ صعب الإيجاد.', 'A product can be wanted and still be hard to find.')},
  {q: tr('هل تقلّب الربح التاريخي دليل على أن خيارًا واحدًا في المحاكاة يضمن الربح؟', 'Is the historical profit swing evidence that one simulated choice guarantees profit?'), ok: 2,
    o: [tr('نعم — تمويل الخط الأساسي وحده أعاد الربح.', 'Yes — funding the core range alone brought the profit back.'), tr('نعم — بيع المتنزهات وحده سبّب الربح.', 'Yes — selling the parks alone caused the profit.'), tr('لا — التقارير السنوية توثّق تغييرات كثيرة مترابطة ونتيجة إجمالية.', 'No — the annual reports document several linked changes and the overall result.')],
    fb: tr('استخدم شرط مراجعة محدّدًا لاختبار أي تغيير مقترح.', 'Use a defined review condition to test a proposed change.')},
];
export function runChecks() {
  const el = $('checks'), Q = CHECKS();
  return new Promise(res => {
    const step = (n) => {
      if (n >= Q.length) { show('checks', false); res(); return; }
      const q = Q[n];
      el.innerHTML = `<div class="qz" role="dialog"><div class="qz-n">${EN ? `Review check ${n + 1} of 3` : `سؤال المراجعة ${n + 1} من 3`}</div><h3>${q.q}</h3>
        <div class="qz-opts">${q.o.map((o, i) => `<button data-i="${i}"><kbd>${i + 1}</kbd> ${o}</button>`).join('')}</div><div class="qz-fb hidden" id="qzfb" aria-live="polite"></div>
        <div class="pc-btns"><button class="primary hidden" id="qznext">${n < 2 ? tr('التالي ←', 'Next →') : tr('إنهاء ←', 'Finish →')}</button></div></div>`;
      show('checks', true);
      const bs = [...el.querySelectorAll('.qz-opts button')];
      const pick = (i) => {
        bs.forEach((b, k) => { b.disabled = true; b.classList.toggle('ok', k === q.ok); b.classList.toggle('bad', k === i && i !== q.ok); });
        const fb = $('qzfb'); fb.classList.remove('hidden'); fb.innerHTML = `<b>${i === q.ok ? tr('صحيح.', 'Right.') : tr('الإجابة الأقرب مظلَّلة.', 'The better answer is highlighted.')}</b> ${q.fb}`;
        (i === q.ok ? sfx.evidence : sfx.ui)();
        S.checks[n] = i === q.ok; save();
        const nx = $('qznext'); nx.classList.remove('hidden'); nx.onclick = () => step(n + 1); nx.focus();
      };
      bs.forEach((b, i) => b.onclick = () => pick(i));
      el.onkeydown = (e) => { const k = +e.key; if (k >= 1 && k <= 3 && !bs[0].disabled) pick(k - 1); };
      setTimeout(() => bs[0].focus(), 30);
    };
    step(0);
  });
}

// ---------------------------------------------------------------- the final card
export function finalCard() {
  const el = $('final'), p = S.committed;
  const prac = S.practice.length ? `<details class="fn-prac"><summary>${tr(`محاولات التدريب (${S.practice.length})`, `Practice attempts (${S.practice.length})`)}</summary>${S.practice.map((x, i) => `<div class="fn-pa"><b>${tr('محاولة', 'Attempt')} ${i + 1}</b>${pitchSummary(x)}</div>`).join('')}</details>` : '';
  el.innerHTML = `<div class="fn-in" role="dialog" aria-label="${tr('البطاقة الأخيرة', 'Final card')}">
    <div class="fn-col"><h3>${tr('عرضك المُلتزَم به', 'Your committed pitch')}</h3>${p ? pitchSummary(p) : ''}<div class="fn-coach">${p ? coachHtml(p, {title: tr('الملاحظات', 'Coaching')}) : ''}</div>${prac}</div>
    <div class="fn-col"><h3>${tr('بطاقة النتائج التاريخية', 'Historical results card')}</h3>${chartHtml()}<div class="ar-src"><p dir="rtl">${SRC[2].ar}</p><p dir="ltr">${SRC[2].en}</p></div></div>
    <div class="fn-btns"><button class="ghost" id="fnarch">${tr('الأرشيف مرة أخرى', 'The archive again')}</button><button class="primary" id="fntry">${tr('جرّب توزيعًا آخر', 'Try another allocation')}</button><button class="ghost" id="fnover">${tr('ابدأ من جديد', 'Start over')}</button></div></div>`;
  show('final', true);
  return new Promise(res => { $('fnarch').onclick = () => { show('final', false); res('archive'); }; $('fntry').onclick = () => { show('final', false); res('try'); }; $('fnover').onclick = () => { show('final', false); res('over'); }; setTimeout(() => $('fntry').focus(), 50); });
}
