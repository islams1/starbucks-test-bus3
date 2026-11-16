// Points out of 100 for the operating-room quick version. Every item comes from something the player did with the
// hands or decided; none from speed. During a crisis the "+n" popups are held back until it is over.
const $ = (id) => document.getElementById(id);
export const SC = {items: {}, flags: {}, crisis: false, held: [], notes: []};
export const ITEMS = {
  timeout:   {part: 'safety', max: 8, t: 'التوقف المؤقت قبل الشق'},
  vent:      {part: 'safety', max: 4, t: 'إيقاف التنفس قبل النشر وإعادته'},
  count:     {part: 'safety', max: 8, t: 'العدّ: قطعة الشاش المفقودة'},
  marking:   {part: 'hands', max: 6, t: 'خط الشق'},
  incision:  {part: 'hands', max: 6, t: 'الشق بالمشرط والكيّ'},
  saw:       {part: 'hands', max: 3, t: 'نشر القص'},
  retractor: {part: 'hands', max: 2, t: 'فتح المُبعِد'},
  cannula:   {part: 'hands', max: 3, t: 'القنيات'},
  clamp:     {part: 'hands', max: 2, t: 'مكان الملقط'},
  suture:    {part: 'hands', max: 8, t: 'خياطة المفاغرة'},
  act:       {part: 'decisions', max: 8, t: 'زمن التخثر قبل المضخة'},
  aorta:     {part: 'decisions', max: 8, t: 'فحص الأبهر ومكان القنية'},
  conduit:   {part: 'decisions', max: 3, t: 'القناة إلى الأمامي النازل'},
  dose:      {part: 'decisions', max: 3, t: 'جرعة شلّ القلب في وقتها'},
  protamine: {part: 'decisions', max: 2, t: 'سرعة البروتامين'},
  bleeding:  {part: 'decisions', max: 6, t: 'النزف: المصدر ثم الاختبار'},
  vf:        {part: 'crisis', max: 8, t: 'الرجفان بعد رفع الملقط'},
  graft:     {part: 'crisis', max: 7, t: 'الطُّعم الفاشل'},
  handover:  {part: 'handover', max: 5, t: 'التسليم للعناية المركزة'},
};
export const PARTS = [
  {k: 'safety', t: 'وقفات السلامة', max: 20}, {k: 'hands', t: 'أفعال اليدين', max: 30}, {k: 'decisions', t: 'القرارات', max: 30},
  {k: 'crisis', t: 'الأزمات', max: 15}, {k: 'handover', t: 'التسليم', max: 5},
];
export const TIPS = {
  timeout: 'التوقف المؤقت كاملًا يكشف ما يُنسى: دواء السيولة يعني صفائح ودمًا أكثر قبل الشق.',
  vent: '«أوقفوا التنفس» قبل أن يلمس المنشار العظم، و«أعيدوا التنفس» فور انتهائه.',
  count: 'عدّ غير صحيح = لا إغلاق. ابحث بنظام، وإن لم تجدها فصورة أشعة.',
  marking: 'من الثلمة فوق القص إلى أسفل الناتئ الرهابي، في المنتصف تمامًا وبخط مستقيم.',
  incision: 'على الخط، بسرعة ثابتة وعمق الجلد فقط، ثم أوقف كل نقطة نزف بالكيّ.',
  saw: 'المنشار في المنتصف تمامًا: الانحراف يكسر نصف القص ويُضعف التئامه.',
  retractor: 'افتح المُبعِد ببطء: الفتح السريع يكسر الضلوع والقص.',
  cannula: 'لا قنية والضغط الانقباضي فوق المئة تقريبًا: خطر تسلّخ الأبهر.',
  clamp: 'الملقط على جزء لين من الأبهر، بعيدًا عن اللويحة.',
  suture: 'كل غرزة في مكانها: الغرزة الخاطئة تسرّب أو تضيّق المفاغرة.',
  act: 'لا مضخة وزمن التخثر تحت 480 ثانية: هيبارين إضافي، ثم مضاد الثرومبين إن لزم.',
  aorta: 'افحص الأبهر بالموجات قبل أي قنية أو ملقط، واختر جزءًا لينًا بعيدًا عن اللويحة.',
  conduit: 'الشريان الثديي الداخلي الأيسر إلى الأمامي النازل: الأطول بقاءً مفتوحًا.',
  dose: 'جرعة شلّ القلب كل 20 دقيقة تقريبًا تحمي العضلة.',
  protamine: 'البروتامين ببطء (نحو عشر دقائق): الدفعة السريعة تُسقط الضغط.',
  bleeding: 'المصدر الجراحي أولًا (الشفّاط ثم الغرزة)، ثم العلاج حسب اختبار التخثر لا عشوائيًا.',
  vf: 'الصدر مفتوح: المجاديف الداخلية 10–20 جول، وفورًا.',
  graft: 'ST جديد بعد الفصل = قِس تدفق كل طُعم، وأصلح الفاشل قبل أن ينهار الضغط.',
  handover: 'التسليم: دواء السيولة، والطُّعم الذي عُدّل، ومتى يُتصل بك بالأرقام.',
};
function box() {
  let b = $('scorebox');
  if (!b) { b = document.createElement('div'); b.id = 'scorebox'; b.innerHTML = '<div class="sb-l"><span>النقاط</span><b id="scval">0</b><small>/ 100</small></div>'; document.body.appendChild(b); }
  return b;
}
export const total = () => Object.values(SC.items).reduce((s, i) => s + i.pts, 0);
export function showBox(on = true) { box().classList.toggle('hidden', !on); $('scval').textContent = total(); }
function popup(pts, max, label) {
  const el = document.createElement('div'); el.className = 'ptpop ' + (pts >= max ? 'good' : pts > 0 ? 'mid' : 'bad');
  el.innerHTML = `<b>${pts > 0 ? '+' + pts : pts}</b><span>${label}</span><small>${pts} / ${max}</small>`;
  document.body.appendChild(el); setTimeout(() => el.remove(), 3600);
}
/** record the points of one item (replaces any earlier value) */
export function award(key, pts, note = null) {
  const it = ITEMS[key]; pts = Math.max(0, Math.min(it.max, Math.round(pts)));
  SC.items[key] = {pts, max: it.max, note};
  if (SC.crisis) SC.held.push([pts, it.max, it.t]); else popup(pts, it.max, it.t);
  showBox(true);
}
export function crisis(on) { SC.crisis = on; if (!on) { SC.held.forEach((p, i) => setTimeout(() => popup(...p), 900 * i)); SC.held = []; } }
export function flag(k, v = true) { SC.flags[k] = v; }

/** the ending, from what happened (unsafe errors decide it, then the score) */
export function ending() {
  const f = SC.flags;
  if (f.retained) return 'E4';
  if (f.graftFail || f.bleedClose || f.stroke) return 'E3';
  if (total() >= 85 && !f.unsafe) return 'E1';
  return 'E2';
}
export const ENDINGS = {
  E1: {t: 'أيدٍ آمنة، فريق آمن', c: '#7fd6a0', d: 'اليوم الثالث: يمشي السيد عادل حمدي إلى النافذة. حفيدته سلمى تريه صورة قاعة الزفاف على هاتفها، ويضحك وهو يضغط وسادة على صدره.'},
  E2: {t: 'يدان جيدتان، ووقفات تحقق رقيقة', c: '#ffd166', d: 'تعافى السيد حمدي، لكن مع مضاعفات صغيرة كان يمكن تجنبها: يومان إضافيان في العناية المركزة. سيحضر الزفاف — على كرسي متحرك.'},
  E3: {t: 'العملية التي بدت جيدة', c: '#ff9f6b', d: ''},
  E4: {t: 'العدّ الذي لم يُغلق', c: '#ff7b6b', d: 'صورة الأشعة في العناية المركزة تُظهر العلامة المعدنية لقطعة شاش خلف القلب. يعود السيد حمدي إلى غرفة العمليات، ويُفتح صدره مرة ثانية.'},
};
function e3Text() {
  const f = SC.flags, out = [];
  if (f.graftFail) out.push('في الثالثة فجرًا يرتفع التروبونين ويعود ST: الطُّعم إلى الخلفي النازل لم يُصلح. عودة إلى غرفة العمليات.');
  if (f.bleedClose) out.push('في العناية المركزة: 600 مل في المصارف خلال ساعتين. إعادة فتح الصدر لإيقاف النزف.');
  if (f.stroke) out.push('في اليوم الأول لا يحرك السيد حمدي يده اليسرى: سكتة دماغية من لويحة الأبهر حيث وُضعت القنية أو الملقط.');
  return out.join(' ');
}
export function scoreCard(onRestart) {
  const e = ending(), E = ENDINGS[e], tot = total();
  const grade = tot >= 90 ? 'ممتاز' : tot >= 80 ? 'جيد جدًا' : tot >= 65 ? 'جيد' : tot >= 50 ? 'مقبول' : 'يحتاج إلى تدريب';
  const parts = PARTS.map(P => {
    const keys = Object.keys(ITEMS).filter(k => ITEMS[k].part === P.k);
    const got = keys.reduce((s, k) => s + (SC.items[k] ? SC.items[k].pts : 0), 0);
    const rows = keys.map(k => { const it = SC.items[k], pts = it ? it.pts : 0; return `<li class="${pts >= ITEMS[k].max ? 'ok' : pts > 0 ? 'mid' : 'no'}"><span>${ITEMS[k].t}</span><b>${pts}/${ITEMS[k].max}</b>${pts < ITEMS[k].max ? `<small>${TIPS[k]}</small>` : ''}</li>`; }).join('');
    return `<div class="sc-part"><div class="sc-pt"><b>${P.t}</b><span>${got} / ${P.max}</span></div><div class="sc-bar"><i style="width:${got / P.max * 100}%"></i></div><ul class="sc-items">${rows}</ul></div>`;
  }).join('');
  const el = document.createElement('div'); el.id = 'scorecard';
  el.innerHTML = `<div class="sc-wrap"><div class="sc-head"><div class="sc-ring" style="--c:${E.c}"><b>${tot}</b><small>من 100</small></div>
    <div class="sc-h"><div class="sc-tag">النهاية ${e} · ${grade}</div><h1>${E.t}</h1><p class="sc-end">${E.d || e3Text()}</p>
    <div class="sc-meta">لا نقاط على السرعة. زمن الملقط: ${Math.round((SC.xcMin || 0))} دقيقة · زمن الدورة الخارجية: ${Math.round(SC.cpbMin || 0)} دقيقة</div></div></div>
    <div class="sc-parts">${parts}</div><div class="sc-actions"><button id="screstart" class="primary">أعد العملية</button></div></div>`;
  document.body.appendChild(el);
  $('screstart').onclick = onRestart || (() => location.reload());
}
