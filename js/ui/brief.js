// Hands-on interactions: the one-page campaign brief (doc node N07) built by dragging evidence cards,
// and the sticky-note ideas board sorted by hand.
import {openDoc} from './docs.js';
import {S, EVIDENCE, CAT, log, MINI} from '../story/state.js';
import {sfx} from '../core/audio.js';
import {coach} from './coach.js';

export const SEGTXT = {A: 'الشريحة أ — مهنيون 18–40 (46% من الزيارات)', B: 'الشريحة ب — الباحثون عن الجودة 40–60', C: 'الشريحة ج — الباحثون عن السهولة (موبايل/درايف ثرو)', D: 'الشريحة د — العائلات', everyone: 'للجميع', none: '— لم تُحدَّد بعد —'};
export const FIELDS = [
  {k: 'insight', t: 'الرؤية عن العميل', opts: () => [
    S.segment === 'A' ? ['strong', 'في أيام العمل يريدوننا سريعين؛ وفي عطلة الأسبوع يريدون مكانًا يقابلون فيه أصدقاءهم.'] :
    S.segment === 'C' ? ['strong', 'يريدون السرعة والاعتمادية فوق كل شيء، ونحن أبطأ ما نكون معهم بالذات.'] :
    S.segment === 'B' ? ['strong', 'يريدون الجودة ومكانًا هادئًا، ومقاعد عطلة الأسبوع نصف فارغة.'] : null,
    ['weak', 'الناس يحبون الأعياد والأكواب الحمراء.'], ['none', 'فكرة مثيرة ستلفت الانتباه.']].filter(Boolean), cards: ['M1', 'M2', 'M3', 'M4']},
  {k: 'idea', t: 'التموضع والفكرة', opts: () => [['third', '«نتقابل في المكان الثالث»: لقاء الأصدقاء في عطلة الأسبوع + مسابقة صور بشروط'], ['contest', 'مسابقة الكوب الأحمر في الفروع الـ24 كلها'], ['discount', 'خصم «اشترِ واحدًا…» كل بعد ظهر'], ['film', 'فيلم قصة السيدة بيل + كاونترات المكتبات']], cards: ['M5', 'M6', 'M7', 'M8', 'M9']},
  {k: 'ops', t: 'ما تحتاجه الفروع', opts: () => [S.ops_checked ? ['sound', 'باريستا إضافي 7–9 صباحًا في 8 فروع + رف استلام واضح (طلب هنا)'] : null, ['ignore', 'سنتعامل مع الضغط عندما يحدث'], ['unknown', 'لم نتحقق من الفروع بعد']].filter(Boolean), cards: ['M3', 'M7']},
  {k: 'measure', t: 'كيف نقيس', opts: () => [['business', 'زيارات الشريحة +8%، انتظار الموبايل 5 دقائق، شكاوى المسابقة أقل من 5%'], ['vanity', 'عدد الإعجابات والمشاركات'], ['none', 'ردود فعل الناس']], cards: ['M10', 'M1', 'M3']},
  {k: 'risk', t: 'الخطر الرئيسي وكيف نتعامل معه', opts: () => [['plan', 'المسابقة قد تُظهر الازدحام: إطلاق في 8 فروع مدعومة، موافقة مكتوبة، قواعد إشراف، متابعة أسبوعية'], ['none', 'لا خطر كبير']], cards: ['M7', 'M8', 'M5']},
];
// pairs that cannot both be true "on a Tuesday at 8 a.m." (doc: coherence interaction)
export function conflicts(b = S.brief || {}) {
  const out = [];
  if ((b.idea === 'contest' || b.idea === 'third') && b.ops !== 'sound') out.push(['idea', 'ops']);
  if (S.segment === 'C' && b.idea === 'contest') out.push(['insight', 'idea']);
  if (b.idea === 'discount') out.push(['idea', 'measure']);
  if (b.idea === 'film' && S.consent !== 'planned') out.push(['idea', 'risk']);
  if (b.measure === 'vanity' && b.idea !== 'discount') out.push(['measure', 'insight']);
  return out;
}

/** first-time walkthrough of the brief: drag a card, pick a wording, read the field state, then approve */
function briefTour(el, b) {
  const filled = () => FIELDS.find(f => (b.cards[f.k] || []).length)?.k;
  const fk = () => filled() || FIELDS[0].k;
  const card0 = () => el.querySelector('.card');
  const dropFor = () => { const id = card0()?.dataset.id; const f = FIELDS.find(x => x.cards.includes(id)) || FIELDS[0]; return el.querySelector(`.drop[data-k="${f.k}"]`); };
  return coach([
    // bubble above/below the card, not over the fields: the ghost card glides there
    {skip: () => !card0(), target: card0, side: ['above', 'below', 'left'], ghost: () => [card0(), dropFor()], done: () => !!filled(),
      text: '<b>هذه أدلتك</b> — كل ما جمعته من مكتبك.<br>اسحب بطاقة إلى الحقل الذي تدعمه.<small>على شاشة اللمس: اضغط البطاقة، ثم اضغط الحقل.</small>'},
    {target: () => el.querySelector(`select[data-k="${fk()}"]`), side: ['above', 'below', 'left', 'right'], done: () => !!b[fk()],
      text: '<b>اختر الصياغة</b> التي يقولها هذا الدليل فعلًا.<small>كل حقل له صياغة قوية وصياغات ضعيفة.</small>'},
    {target: () => el.querySelector(`.bf-f[data-k="${fk()}"]`), side: ['above', 'below', 'left', 'right'], next: 'التالي',
      text: 'الحقل <b style="color:#7fc79a">الأخضر ✓</b> = اخترت صياغة وربطتها بدليل.<br>وإذا ظهر <b style="color:#e0705f">⚠</b> فهناك حقلان لا يمكن أن يكونا صحيحين معًا — عدّل أحدهما.' + (MINI ? '<small>كل تعارض يخصم 3 نقاط.</small>' : '')},
    {target: () => el.querySelector('#bfsave'), side: ['above', 'right', 'left'], next: 'ابدأ',
      text: 'أكمل <b>الحقول الخمسة</b> بالطريقة نفسها، ثم اضغط «اعتمد الموجز».' + (MINI ? '<small>بعد الاعتماد لا يمكن التعديل — هذا ما ستعرضه على نادية.</small>' : '')},
  ]);
}

export function briefDoc() {
  S.brief = S.brief || {cards: {}};
  const b = S.brief;
  const have = Object.keys(EVIDENCE).filter(id => S.ev[id]);
  let tour = null;
  const html = `<div class="paper brief" style="width:min(1150px,95vw)"><div class="hdr"><b>موجز الحملة — صفحة واحدة</b><button class="bf-help" id="bfhelp">؟ كيف أبني الموجز</button><span>BRIEF · N07</span></div>
    <p style="margin:0 0 10px">اسحب <b>بطاقات الأدلة</b> إلى الحقول التي تدعمها، واختر الصياغة المناسبة لكل حقل. هذا ما ستعرضه على الشاشة في الاجتماع.</p>
    <div class="bf-wrap"><div class="bf-tray"><h4>أدلتك (${have.length}/10)</h4>${have.map(id => `<div class="card" draggable="true" data-id="${id}"><span class="cat ${EVIDENCE[id].cat}">${CAT[EVIDENCE[id].cat]}</span> <b>${id}</b> ${EVIDENCE[id].t}</div>`).join('') || '<p>لم تجمع أدلة بعد — افتح الوثائق على مكتبك.</p>'}</div>
    <div class="bf-fields"><div class="bf-f fixed"><div class="bf-t">الشريحة المستهدفة</div><div class="bf-v">${SEGTXT[S.segment] || '—'}</div></div>
    ${FIELDS.map(f => `<div class="bf-f" data-k="${f.k}"><div class="bf-t">${f.t}<span class="bf-ok"></span></div>
      <select data-k="${f.k}"><option value="">— اختر —</option>${f.opts().map(([v, t]) => `<option value="${v}" ${b[f.k] === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
      <div class="drop" data-k="${f.k}">${(b.cards[f.k] || []).map(id => `<span class="chip" data-id="${id}">${id} ✕</span>`).join('') || '<i>اسحب دليلًا هنا</i>'}</div><div class="bf-warn"></div></div>`).join('')}
    </div></div><div class="bf-foot"><span id="bfstat"></span>${MINI ? '<span class="bf-final">بعد الاعتماد لا يمكن التعديل — هذا ما ستعرضه على نادية</span>' : ''}<button class="primary" id="bfsave">اعتمد الموجز</button></div></div>`;
  const shown = openDoc(html, (el, close) => {
    const startTour = () => { if (tour) tour.stop(); tour = briefTour(el, b); };
    el.querySelector('#bfhelp').onclick = startTour;
    if (!S.tutBrief) { S.tutBrief = true; setTimeout(() => el.isConnected && startTour(), 400); }   // first time only
    const refresh = () => {
      const cf = conflicts(b);
      el.querySelectorAll('.bf-f[data-k]').forEach(f => {
        const k = f.dataset.k, sup = (b.cards[k] || []).length > 0, bad = cf.find(p => p.includes(k));
        f.classList.toggle('bad', !!bad); f.classList.toggle('good', !bad && sup && !!b[k]);
        f.querySelector('.bf-ok').textContent = !bad && sup && b[k] ? ' ✓ مدعوم بالدليل' : '';
        f.querySelector('.bf-warn').textContent = bad ? '⚠ هل يمكن أن يكون الاثنان صحيحين يوم ثلاثاء الساعة 8 صباحًا؟' : '';
      });
      const filled = FIELDS.filter(f => b[f.k]).length;
      el.querySelector('#bfstat').textContent = `${filled}/5 حقول · ${cf.length ? cf.length + ' تعارض' : 'بلا تعارض'}`;
    };
    el.querySelectorAll('select').forEach(s => s.onchange = () => { b[s.dataset.k] = s.value; sfx.ui(); refresh(); });
    el.querySelectorAll('.card').forEach(c => c.ondragstart = (e) => { e.dataTransfer.setData('text', c.dataset.id); c.classList.add('drag'); });
    el.querySelectorAll('.card').forEach(c => c.ondragend = () => c.classList.remove('drag'));
    const renderDrop = (d) => { const k = d.dataset.k; d.innerHTML = (b.cards[k] || []).map(id => `<span class="chip" data-id="${id}">${id} ✕</span>`).join('') || '<i>اسحب دليلًا هنا</i>';
      d.querySelectorAll('.chip').forEach(ch => ch.onclick = () => { b.cards[k] = b.cards[k].filter(x => x !== ch.dataset.id); renderDrop(d); refresh(); }); };
    el.querySelectorAll('.drop').forEach(d => {
      d.ondragover = (e) => { e.preventDefault(); d.classList.add('over'); };
      d.ondragleave = () => d.classList.remove('over');
      d.ondrop = (e) => { e.preventDefault(); d.classList.remove('over'); const id = e.dataTransfer.getData('text'); const k = d.dataset.k; b.cards[k] = [...new Set([...(b.cards[k] || []), id])]; sfx.paper(); renderDrop(d); refresh(); };
      renderDrop(d);
      // click-to-add fallback (touch screens / no drag): click a card, then a field
    });
    let picked = null;
    el.querySelectorAll('.card').forEach(c => c.onclick = () => { picked = c.dataset.id; el.querySelectorAll('.card').forEach(x => x.classList.toggle('drag', x === c)); });
    el.querySelectorAll('.drop').forEach(d => d.addEventListener('click', (e) => { if (!picked || e.target.classList.contains('chip')) return; const k = d.dataset.k; b.cards[k] = [...new Set([...(b.cards[k] || []), picked])]; picked = null; el.querySelectorAll('.card').forEach(x => x.classList.remove('drag')); sfx.paper(); renderDrop(d); refresh(); }));
    el.querySelector('#bfsave').onclick = () => {
      if (FIELDS.some(f => !b[f.k])) { el.querySelector('#bfstat').textContent = 'املأ الحقول الخمسة أولًا'; return; }
      S.briefBuilt = true; log('brief_built', JSON.stringify(b)); sfx.evidence(); close();
    };
    refresh();
  });
  shown.then(() => tour && tour.stop());      // closing the brief ends the guide
  return shown;
}

// ---------- sticky-note ideas board: sort the four ideas by hand ----------
export function boardSortDoc() {
  const notes = [['discount', '#ffe27a', 'خصم', 'رايان'], ['contest', '#ff9fb3', 'مسابقة صور', 'مي'], ['film', '#9fe0c8', 'فيلم مجتمعي', 'فريق المحتوى'], ['partner', '#a9cbff', 'شراكة مكتبات', 'جريس']];
  const cols = [['do', 'ننفّذ'], ['test', 'نختبر بشروط'], ['separate', 'قرار منفصل'], ['drop', 'نستبعد']];
  S.boardSort = S.boardSort || {};
  const html = `<div class="board sortb"><h2>لوحة أفكار الفريق — اسحب كل ورقة إلى العمود المناسب</h2>
    <div class="sb-pool">${notes.map(([k, c, t, o]) => `<div class="sticky" draggable="true" data-k="${k}" style="background:${c}"><b>${t}</b><small>— ${o}</small></div>`).join('')}</div>
    <div class="sb-cols">${cols.map(([k, t]) => `<div class="sb-col" data-c="${k}"><h4>${t}</h4></div>`).join('')}</div>
    <div class="bf-foot"><span id="sbstat"></span><button class="primary" id="sbsave">تم</button></div></div>`;
  return openDoc(html, (el, close) => {
    const place = (k, c) => { const n = el.querySelector(`.sticky[data-k="${k}"]`); el.querySelector(`.sb-col[data-c="${c}"]`).appendChild(n); S.boardSort[k] = c; sfx.paper(); el.querySelector('#sbstat').textContent = `${Object.keys(S.boardSort).length}/4`; };
    for (const [k, c] of Object.entries(S.boardSort)) place(k, c);
    let picked = null;
    el.querySelectorAll('.sticky').forEach(n => { n.ondragstart = (e) => e.dataTransfer.setData('text', n.dataset.k); n.onclick = (e) => {
      const col = n.closest('.sb-col');
      if (picked && picked !== n.dataset.k && col) { e.stopPropagation(); place(picked, col.dataset.c); picked = null; el.querySelectorAll('.sticky').forEach(x => x.classList.remove('drag')); return; }   // clicking a note already in a column drops the selected one there
      e.stopPropagation(); picked = n.dataset.k; el.querySelectorAll('.sticky').forEach(x => x.classList.toggle('drag', x === n)); }; });
    el.querySelectorAll('.sb-col').forEach(col => { col.ondragover = (e) => { e.preventDefault(); col.classList.add('over'); }; col.ondragleave = () => col.classList.remove('over');
      col.ondrop = (e) => { e.preventDefault(); col.classList.remove('over'); place(e.dataTransfer.getData('text'), col.dataset.c); };
      col.onclick = () => { if (picked) { place(picked, col.dataset.c); picked = null; el.querySelectorAll('.sticky').forEach(x => x.classList.remove('drag')); } }; });
    el.querySelector('#sbsave').onclick = () => { log('board_sort', JSON.stringify(S.boardSort)); close(); };
  });
}
