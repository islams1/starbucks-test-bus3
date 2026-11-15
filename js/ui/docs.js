// 2D document screens (paper / laptop / booklet / board). Content = fictional training data from the situation file.
import {$, show} from './ui.js';
import {sfx} from '../core/audio.js';
import {S, gain, log, setNode, EVIDENCE, CAT, MINI} from '../story/state.js';

let closeCb = null;
export function openDoc(html, mount = null) {
  sfx.paper();
  $('docbody').innerHTML = html;
  show('doc', true);
  return new Promise(res => {
    closeCb = () => { show('doc', false); $('docbody').innerHTML = ''; closeCb = null; res(); };
    if (mount) mount($('docbody'), () => closeCb && closeCb());
  });
}
export const closeDoc = () => closeCb && closeCb();
export const docOpen = () => !!closeCb;
$('docclose').onclick = () => closeDoc();
addEventListener('keydown', e => { if ((e.code === 'Escape' || e.code === 'KeyE' && !e.repeat && false) && closeCb) { e.stopPropagation(); closeDoc(); } }, true);

const num = (s) => `<span class="num">${s}</span>`;
const SEG = [
  {k: 'A', n: 'أ. الأعمار 18–40، مهنيون في المدينة', share: 46, spend: 6.10, visits: 9, want: 'السرعة في أيام العمل، ومكان للقاء في عطلة الأسبوع، والتخصيص'},
  {k: 'B', n: 'ب. الأعمار 40–60، الباحثون عن الجودة الراقية', share: 24, spend: 5.40, visits: 6, want: 'الجودة، ومكان هادئ للجلوس، والثبات'},
  {k: 'C', n: 'ج. الباحثون عن السهولة (الدرايف ثرو والموبايل)', share: 22, spend: 5.80, visits: 11, want: 'السرعة والاعتمادية فوق كل شيء'},
  {k: 'D', n: 'د. العائلات', share: 8, spend: 9.20, visits: 3, want: 'مأكولات للأطفال، ومكان مرحّب في عطلة الأسبوع'},
];
const revTotal = SEG.reduce((s, x) => s + x.share * x.spend, 0);
export const segRevShare = (k) => { const x = SEG.find(s => s.k === k); return x.share * x.spend / revTotal * 100; };

function quiz(el, sel, correct, onAnswer, fbRight, fbWrong, prev = null) {
  el.querySelectorAll(sel).forEach(b => b.onclick = () => {
    if (b.parentElement.dataset.done) return;
    b.parentElement.dataset.done = 1;
    const ok = b.dataset.v === correct;
    b.classList.add(ok ? 'right' : 'wrong');
    if (!ok) b.parentElement.querySelector(`[data-v="${correct}"]`).classList.add('right');
    b.parentElement.nextElementSibling.innerHTML = ok ? fbRight : fbWrong;
    onAnswer(ok, b.dataset.v);
  });
  if (prev != null) { const b = el.querySelector(`${sel}[data-v="${prev}"]`); if (b) b.click(); }
}

// ---------- 1. segment research (blue folder) ----------
export function researchDoc() {
  gain('M1'); gain('M2');
  const rows = SEG.map(s => `<tr data-k="${s.k}"><td>${s.n}</td><td>${num(s.share + '%')}</td><td>${num(s.spend.toFixed(2) + ' $')}</td><td>${num(s.visits)}</td><td>${s.want}</td><td class="rev"></td></tr>`).join('');
  const html = `<div class="paper"><div class="hdr"><b>بحث الشرائح — سوق المدينة</b><span>SURVEY · N=1,200</span></div>
    <p>استبيان ${num('1,200')} عميل في السوق. (بيانات تدريبية خيالية)</p>
    <table><tr><th>الشريحة</th><th>نسبة الزيارات</th><th>متوسط الإنفاق</th><th>الزيارات شهريًا</th><th>ما يقولون إنهم يريدونه</th><th>حصة الإيراد</th></tr>${rows}</table>
    <div class="task"><b>مهمة مالية ① — فرز الشرائح حسب القيمة</b>
      <button class="opt" id="calcrev" style="margin-bottom:10px">احسب حصة الإيراد التقديرية = نسبة الزيارات × متوسط الإنفاق</button>
      <div id="q1" class="hidden">أي شريحة تجلب أكبر حصة من إيراد السوق؟
        <div class="opts q1"><button class="opt" data-v="A">الشريحة أ</button><button class="opt" data-v="B">الشريحة ب</button><button class="opt" data-v="C">الشريحة ج</button><button class="opt" data-v="D">الشريحة د</button></div><div class="fb"></div></div>
      <div id="q2" class="hidden" style="margin-top:14px">وأي شريحة أعلى قيمة <u>للعميل الواحد</u> شهريًا (الزيارات × الإنفاق)؟
        <div class="opts q2"><button class="opt" data-v="A">أ: ${num('9 × 6.10')}</button><button class="opt" data-v="B">ب: ${num('6 × 5.40')}</button><button class="opt" data-v="C">ج: ${num('11 × 5.80')}</button><button class="opt" data-v="D">د: ${num('3 × 9.20')}</button></div><div class="fb"></div></div>
      ${MINI ? `<div id="qseg" class="hidden" style="margin-top:16px"><b>③ قرارك: لمن ستكون حملة الأعياد؟</b> <small>(قرار واحد — لا يمكن تغييره)</small>
        <div class="opts qs"><button class="opt" data-v="A">الشريحة أ</button><button class="opt" data-v="B">الشريحة ب</button><button class="opt" data-v="C">الشريحة ج</button><button class="opt" data-v="D">الشريحة د</button><button class="opt" data-v="everyone">للجميع</button></div><div class="fb"></div></div>` : ''}
    </div></div>`;
  return openDoc(html, (el) => {
    const T = S.tasks;
    const calc = () => {
      const btn = el.querySelector('#calcrev'); btn.disabled = true; btn.textContent = 'تم الحساب ✓';
      el.querySelectorAll('tr[data-k]').forEach(tr => { const k = tr.dataset.k; tr.querySelector('.rev').innerHTML = num(segRevShare(k).toFixed(1) + '%'); });
      // sort rows by revenue share
      const tb = el.querySelector('table'); [...el.querySelectorAll('tr[data-k]')].sort((a, b) => segRevShare(b.dataset.k) - segRevShare(a.dataset.k)).forEach(r => tb.appendChild(r));
      el.querySelector('#q1').classList.remove('hidden');
    };
    el.querySelector('#calcrev').onclick = () => { calc(); log('task', 'segments_sorted'); };
    if (T.revenue) calc();
    quiz(el, '.q1 .opt', 'A', (ok, v) => { if (!T.revenue) { T.revenue = {ok, v}; log('task', 'revenue_q', v); } el.querySelector('#q2').classList.remove('hidden'); el.querySelector(`tr[data-k="A"]`).classList.add('sel'); },
      'صحيح: الشريحة أ وحدها نحو <b>46%</b> من الإيراد.', 'ليس تمامًا: الشريحة أ وحدها نحو <b>46%</b> من الإيراد.', T.revenue && T.revenue.v);
    quiz(el, '.q2 .opt', 'C', (ok, v) => { if (!T.value) { T.value = {ok, v}; log('task', 'value_q', v); } T.research = true; const qs = el.querySelector('#qseg'); if (qs) qs.classList.remove('hidden'); },
      'صحيح: العميل في الشريحة ج يساوي نحو <b>63.8 دولار</b> شهريًا، لكن الفروع أبطأ ما تكون معه.', 'العميل في الشريحة ج يساوي نحو <b>63.8 دولار</b> شهريًا (11 × 5.80).', T.value && T.value.v);
    // quick version: the target segment is decided here (no conversation with Nadia)
    const qs = el.querySelector('#qseg');
    if (qs) {
      const mark = (v) => { qs.querySelector('.opts').dataset.done = 1; qs.querySelectorAll('.opt').forEach(b => b.classList.toggle('sel', b.dataset.v === v)); qs.querySelector('.fb').innerHTML = `سُجّل قرارك: <b>${v === 'everyone' ? 'للجميع' : 'الشريحة ' + {A: 'أ', B: 'ب', C: 'ج', D: 'د'}[v]}</b>. ستعرضه على نادية في الاجتماع.`; };
      qs.querySelectorAll('.opt').forEach(b => b.onclick = () => { if (S.segment !== 'none') return; S.segment = b.dataset.v; S.segmentTries = 1; setNode('N01', b.dataset.v); sfx.ui(); mark(b.dataset.v); });
      if (S.segment !== 'none') mark(S.segment);
    }
  });
}

// ---------- 2. store dashboard (laptop) ----------
export function dashboardDoc({onCall, callLabel = '📹 مكالمة فيديو مع الفرع (هنا — مشرفة وردية)', extra = []}) {
  gain('M3'); gain('M4');
  const months = ['يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const html = `<div class="laptop"><div class="screen-in">
    <div class="dash-top"><b>لوحة بيانات الفروع — موسم الأعياد الماضي</b><span>24 STORES · REGION</span></div>
    <div class="kpis">
      <div class="kpi"><div class="l">طلبات الموبايل من المعاملات</div><div class="v">31%</div><div class="s">بعد أن كانت <span class="num">22%</span></div></div>
      <div class="kpi"><div class="l">متوسط انتظار طلب الموبايل 8–9 صباحًا</div><div class="v bad">9 min</div><div class="s bad">الهدف <span class="num">5 min</span></div></div>
      <div class="kpi"><div class="l">استخدام مقاعد بعد ظهر عطلة الأسبوع</div><div class="v">55%</div><div class="s">نصف المقاعد تقريبًا فارغة</div></div>
      <div class="kpi"><div class="l">مبيعات ديسمبر</div><div class="v">+4%</div><div class="s bad">الهدف على مستوى البلاد <span class="num">+6%</span></div></div>
    </div>
    <div class="chartbox"><canvas id="dch" width="900" height="230" style="width:100%"></canvas></div>
    <div class="dash-actions"><button id="vcbtn">${callLabel}</button>${extra.map((x, i) => `<button data-x="${i}">${x.label}</button>`).join('')}<button class="alt" id="dclose">إغلاق</button></div>
  </div></div>`;
  return openDoc(html, (el, close) => {
    const c = el.querySelector('#dch').getContext('2d');
    const W = 900, H = 230; c.fillStyle = '#fff'; c.fillRect(0, 0, W, H);
    c.font = '14px "IBM Plex Sans Arabic"'; c.fillStyle = '#5f6b77';
    c.fillText('انتظار طلب الموبايل في الذروة (دقائق)', W - 260, 22);
    const data = [5.2, 5.6, 6.1, 6.8, 7.6, 9.0];
    c.strokeStyle = '#e1e6eb'; for (let i = 0; i <= 10; i += 2) { const y = H - 30 - i * 17; c.beginPath(); c.moveTo(40, y); c.lineTo(W - 20, y); c.stroke(); c.fillText(i, 18, y + 4); }
    c.strokeStyle = '#1e8e5a'; c.setLineDash([6, 5]); c.beginPath(); c.moveTo(40, H - 30 - 5 * 17); c.lineTo(W - 20, H - 30 - 5 * 17); c.stroke(); c.setLineDash([]);
    c.fillStyle = '#1e8e5a'; c.fillText('الهدف 5', 50, H - 30 - 5 * 17 - 6);
    c.strokeStyle = '#c0392b'; c.lineWidth = 3; c.beginPath();
    data.forEach((v, i) => { const x = 80 + i * ((W - 140) / 5), y = H - 30 - v * 17; i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke();
    data.forEach((v, i) => { const x = 80 + i * ((W - 140) / 5), y = H - 30 - v * 17; c.fillStyle = '#c0392b'; c.beginPath(); c.arc(x, y, 4, 0, 7); c.fill(); c.fillStyle = '#5f6b77'; c.fillText(months[i], x - 18, H - 8); });
    el.querySelector('#dclose').onclick = close;
    el.querySelector('#vcbtn').onclick = () => { close(); onCall(); };
    el.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { close(); extra[+b.dataset.x].fn(); });
  });
}

// ---------- 3. brand guideline booklet ----------
export function bookletDoc() {
  gain('M5');
  const html = `<div class="booklet">
    <div class="pg"><h2>دليل العلامة — النسخة الإقليمية</h2><p>(نسخة إقليمية خيالية لأغراض التدريب)</p>
      <h3>التموضع</h3><div class="rule">تموضع راقٍ. «المكان الثالث» بين البيت والعمل.</div>
      <h3>الشعار</h3><p>الشعار بالرمز وحده، دون اسم.</p>
      <h3>النبرة</h3><div class="rule">دافئة، وإنسانية، وشاملة.</div><span class="pgn">1</span></div>
    <div class="pg"><h2>قواعد الحملات</h2>
      <div class="rule"><b>لا حملات قائمة على السعر</b> دون موافقة المديرة.</div>
      <div class="rule">أي <b>محتوى من صنع المستخدمين</b> يحتاج <b>موافقة مكتوبة</b> من الشخص الظاهر فيه، و<b>عملية إشراف</b>.</div>
      <div class="rule">لا يُستخدم اسم عميل أو صورته أو قصته دون موافقة مكتوبة.</div><span class="pgn">2</span></div>
  </div>`;
  return openDoc(html);
}
// ---------- 4. values card ----------
export function valuesDoc() {
  gain('M6');
  const v = ['الإتقان', 'النتائج', 'الشجاعة', 'الانتماء', 'البهجة'];
  return openDoc(`<div class="paper" style="width:min(520px,90vw);text-align:center"><div class="hdr"><b>قيمنا</b><span>VALUES</span></div>${v.map(x => `<p style="font-size:1.6rem;margin:.4em 0;font-family:var(--ar);font-weight:600">${x}</p>`).join('')}</div>`);
}
// ---------- 5. budget sheet ----------
export function budgetDoc() {
  gain('M10');
  const lines = [['staff', 'عاملون إضافيون في الذروة (باريستا 7–9)', 0], ['contest', 'مسابقة الصور + الإشراف', 0], ['film', 'إنتاج فيلم', 0], ['discount', 'خصم «اشترِ واحدًا…» (هامش)', 0], ['measure', 'القياس والبحث', 0], ['reserve', 'احتياطي', 120000]];
  const html = `<div class="paper"><div class="hdr"><b>ورقة الميزانية — موسم الأعياد</b><span>BUDGET · USD</span></div>
    <table><tr><th>البند</th><th>القيمة</th></tr>
      <tr><td>ميزانية الحملة للموسم</td><td>${num('120,000 $')}</td></tr>
      <tr class="sel"><td>تقدير تكلفة خصم «اشترِ واحدًا واحصل على الثاني» كل بعد ظهر في ديسمبر (هامش ضائع)</td><td>${num('≈ 95,000 $')}</td></tr></table>
    <div class="task"><b>مهمة مالية ② — ما نسبة الميزانية التي يستهلكها الخصم وحده؟</b>
      <div class="opts q3"><button class="opt" data-v="39">${num('39%')}</button><button class="opt" data-v="59">${num('59%')}</button><button class="opt" data-v="79">${num('79%')}</button><button class="opt" data-v="95">${num('95%')}</button></div><div class="fb"></div></div>
    <div class="task"><b>مهمة مالية ③ — وزّع مسودة الميزانية (المجموع ${num('120,000 $')})</b>
      <div class="sliders">${lines.map(([k, n, v]) => `<div class="sl"><span>${n}</span><input type="range" min="0" max="120000" step="5000" value="${v}" data-k="${k}"><span class="num" id="v_${k}">${v.toLocaleString('en')}</span></div>`).join('')}</div>
      <div class="total" id="btotal"></div><button class="opt" id="bsave" style="margin-top:8px">اعتمد المسودة</button><div class="fb" id="bfb"></div></div></div>`;
  return openDoc(html, (el) => {
    quiz(el, '.q3 .opt', '79', (ok, v) => { if (!S.tasks.discountShare) { S.tasks.discountShare = {ok, v}; log('task', 'discount_share', v); } },
      'صحيح: 95,000 ÷ 120,000 ≈ <b>79%</b> — معظم الميزانية في بند واحد.', 'الحساب: 95,000 ÷ 120,000 ≈ <b>79%</b> — معظم الميزانية في بند واحد.', S.tasks.discountShare && S.tasks.discountShare.v);
    const sl = [...el.querySelectorAll('input[type=range]')];
    if (S.tasks.budget) sl.forEach(s => { s.value = S.tasks.budget[s.dataset.k] || 0; });
    const upd = () => { let t = 0; sl.forEach(s => { t += +s.value; el.querySelector('#v_' + s.dataset.k).textContent = (+s.value).toLocaleString('en'); });
      const tot = el.querySelector('#btotal'); tot.textContent = `المجموع: ${t.toLocaleString('en')} $`; tot.classList.toggle('over', t !== 120000); return t; };
    sl.forEach(s => s.oninput = upd); upd();
    el.querySelector('#bsave').onclick = () => {
      const t = upd(); const fb = el.querySelector('#bfb');
      if (t !== 120000) { fb.textContent = 'المجموع يجب أن يساوي 120,000 دولار بالضبط.'; return; }
      const alloc = Object.fromEntries(sl.map(s => [s.dataset.k, +s.value]));
      S.tasks.budget = alloc; log('task', 'budget', JSON.stringify(alloc));
      fb.innerHTML = alloc.discount >= 95000 ? 'سُجّلت المسودة. لاحظ: الخصم يستهلك معظمها.' : alloc.staff > 0 ? 'سُجّلت المسودة. خصصت مالًا للتشغيل في الذروة.' : 'سُجّلت المسودة.';
    };
  });
}
// ---------- 6. partnership proposal ----------
export function proposalDoc() {
  gain('M9');
  return openDoc(`<div class="paper"><div class="hdr"><b>مقترح شراكة — سلسلة مكتبات</b><span>PROPOSAL</span></div>
    <p>تعرض سلسلة مكتبات كاونترات قهوة في ${num('6')} فروع داخل المولات، مع <b>تقاسم الإيرادات</b>، والإطلاق في ديسمبر.</p>
    <table><tr><th>الفرع</th><th>الموقع</th><th>ساعات الذروة</th></tr>
      ${[1, 2, 3, 4, 5, 6].map(i => `<tr><td>${num('B-0' + i)}</td><td>مول — المدينة</td><td>${num('14:00 – 19:00')} (بعد الظهر)</td></tr>`).join('')}</table>
    <div class="note">ملاحظة الشريك: «مولاتنا أكثر ازدحامًا بعد الظهر.»</div>
    <p style="font-size:.9rem;color:#666">التوقيع يحتاج اعتماد مديرة التسويق الإقليمية.</p></div>`);
}
// ---------- 7. social test report ----------
export function reportDoc() {
  gain('M7');
  const posts = [['@coffee.morning', 'أجمل كوب أحمر هذا الموسم ☕❤️', false], ['@lina_walks', 'لقاء الأصدقاء المعتاد #كوب_أحمر', false], ['@k.photo', 'انتظرت 15 دقيقة من أجل هذا الكوب الأحمر… #كوب_أحمر', true], ['@urban_day', 'الطابور عند الكاونتر لا ينتهي 😩 #كوب_أحمر', true]];
  return openDoc(`<div class="paper"><div class="hdr"><b>تقرير اختبار التواصل الاجتماعي</b><span>1 STORE · 1 WEEK</span></div>
    <p>أسبوع واحد، فرع واحد، منشورات اعتمدتها المديرة.</p>
    <table><tr><th>المؤشر</th><th>النتيجة</th></tr><tr><td>صور مُشاركة</td><td>${num('1,900')}</td></tr><tr><td>التفاعل مقارنة بالمعتاد</td><td>${num('×3')}</td></tr><tr class="sel"><td>صور تُظهر كاونترات مزدحمة أو الوسم مع شكاوى من الانتظار</td><td>${num('14%')}</td></tr></table>
    <h3>عينة منشورات (حسابات خيالية)</h3>${posts.map(([h, t, bad]) => `<div class="note" style="${bad ? 'border-right-color:#c0574a;background:#fbe9e6' : ''}"><b class="num">${h}</b> — ${t}</div>`).join('')}</div>`);
}
// ---------- 8. film script ----------
export function scriptDoc() {
  gain('M8');
  return `<div class="paper"><div class="hdr"><b>مسودة سيناريو — فيلم «المجتمع»</b><span>DRAFT v2</span></div><div class="stamp">لا يوجد نموذج موافقة مرفق</div>
    <p><b>المشهد 1 — صباحًا، الفرع.</b> السيدة <b>روث بيل</b> (اسمها الكامل)، أرملة، تقابل صديقاتها كل صباح في الفرع نفسه منذ عشرين عامًا.</p>
    <p><b>المشهد 2.</b> صور حقيقية من فعالية في الفرع تظهر فيها السيدة بيل.</p>
    <p><b>المشهد 3.</b> صوت الراوي: «هنا… لا أحد غريب.»</p>
    <div class="note">مرفقات: 6 صور من فعالية الفرع. نموذج الموافقة: — </div></div>`;
}
// ---------- 9. ideas board ----------
export function boardDoc() {
  return openDoc(`<div class="board"><h2>لوحة أفكار الفريق — حملة الأعياد</h2>
    <div class="sticky" style="background:#ffe27a"><b>خصم</b>«اشترِ واحدًا واحصل على الثاني» كل بعد ظهر في ديسمبر<small>— رايان</small></div>
    <div class="sticky" style="background:#ff9fb3"><b>مسابقة صور</b>مسابقة الكوب الأحمر بوسم على وسائل التواصل<small>— مي</small></div>
    <div class="sticky" style="background:#9fe0c8"><b>فيلم مجتمعي</b>قصة عميلة محلية حقيقية<small>— فريق المحتوى</small></div>
    <div class="sticky" style="background:#a9cbff"><b>شراكة مكتبات</b>كاونترات قهوة في 6 مولات، تقاسم إيرادات<small>— جريس</small></div></div>`);
}
// ---------- 10. last year's cups ----------
export function cupsDoc() {
  return openDoc(`<div class="paper" style="width:min(560px,90vw)"><div class="hdr"><b>أكواب أعياد العام الماضي</b><span>2023</span></div>
    <p>أكواب حمراء، مع بطاقة وسم (هاشتاج) من مسابقة الصور الإقليمية.</p><div class="note" style="text-align:center;font-size:1.3rem">#كوب_أحمر</div></div>`);
}
// ---------- 11. tablet: strategy board ----------
export function strategyDoc() {
  const cols = ['c', 'b', 'o', 'm'].map(cat => `<div style="flex:1;background:#fff;border:1px solid #ddd;border-radius:8px;padding:10px"><h3 style="margin:0 0 8px">${CAT[cat]}</h3>${Object.entries(EVIDENCE).filter(([, e]) => e.cat === cat).map(([id, e]) => `<div class="note" style="${S.ev[id] ? '' : 'opacity:.35'}"><b>${id}</b> ${S.ev[id] ? e.t : '— لم يُجمع بعد · ' + e.src}</div>`).join('')}</div>`).join('');
  const seg = {none: '—', A: 'الشريحة أ', B: 'الشريحة ب', C: 'الشريحة ج', D: 'الشريحة د', everyone: 'للجميع'}[S.segment];
  return openDoc(`<div class="paper" style="width:min(1100px,94vw)"><div class="hdr"><b>التابلت — لوحة الاستراتيجية</b><span>STRATEGY BOARD</span></div>
    <p>الشريحة المختارة: <b>${seg}</b>. أسئلة نادية الثلاثة: <b>لمن؟ ولماذا سيهتمون؟ وهل تستطيع فروعنا تقديمه؟</b></p>
    <div style="display:flex;gap:10px">${cols}</div></div>`);
}
