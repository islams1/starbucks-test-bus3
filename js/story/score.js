// Quick version scoring (out of 100): every point comes from something the player did.
// Brief / segment points stay hidden until the slide is shown to Nadia in the meeting (S.revealed).
import {S, EVIDENCE} from './state.js';
import {FIELDS, conflicts} from '../ui/brief.js';

const GOOD = {insight: 'strong', idea: 'third', ops: 'sound', measure: 'business', risk: 'plan'};
const PART = {insight: {weak: 2}, idea: {contest: 1}, ops: {unknown: 1}, measure: {vanity: 2}, risk: {}};
const FIELD_NAME = {insight: 'الرؤية عن العميل', idea: 'الفكرة', ops: 'ما تحتاجه الفروع', measure: 'كيف نقيس', risk: 'الخطر وخطته'};
const FIELD_TIP = {
  insight: 'الرؤية القوية حاجة حقيقية من البيانات عن شريحتك، لا «الناس يحبون الأعياد».',
  idea: '«المكان الثالث» يجمع ما تقوله البيانات؛ الخصم والفيلم بلا موافقة يكسران العلامة.',
  ops: 'اسأل الفرع أولًا (رسالة هنا من اللابتوب) لتظهر خطة الباريستا الإضافي ورف الاستلام.',
  measure: 'قِس ما يثبت الهدف: زيارات الشريحة وزمن الانتظار، لا الإعجابات.',
  risk: 'تقرير الاختبار قال إن 14% من الصور تُظهر الازدحام: سمِّ الخطر وضع خطته.',
};
const SEG_PTS = {A: 10, C: 10, B: 6, D: 4, everyone: 0, none: 0};
export const SLIDES = [
  {key: 's1', fields: ['insight', 'idea'], seg: true},
  {key: 's2', fields: ['ops']},
  {key: 's3', fields: ['measure']},
  {key: 's4', fields: ['risk']},
];

function fieldItem(k) {
  const b = S.brief || {}, v = b[k];
  const opt = v === GOOD[k] ? 4 : (PART[k][v] || 0);
  const f = FIELDS.find(x => x.k === k);
  const sup = opt > 0 && (b.cards && b.cards[k] || []).some(id => f.cards.includes(id)) ? 1 : 0;
  return {id: 'f_' + k, t: FIELD_NAME[k] + (sup ? ' (مدعوم بدليل)' : ''), pts: opt + sup, max: 5, tip: opt < 4 ? FIELD_TIP[k] : sup ? null : 'اسحب إلى كل حقل الدليل الذي يدعمه.'};
}
function budgetPts(b) {
  if (!b) return 0;
  return (b.staff >= 20000 ? 2 : 0) + (b.measure > 0 ? 1 : 0) + (b.discount < 95000 ? 1 : 0) + (b.reserve <= 60000 ? 1 : 0);
}
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
/** play time in seconds (paused time excluded; frozen when the plan is chosen) */
export const elapsed = () => S.miniTime != null ? S.miniTime : S.miniElapsed || 0;
export const clockText = () => fmt(elapsed());

/** all parts with their items; items not revealed yet carry hidden:true and count 0 */
export function scoreParts() {
  const T = S.tasks || {}, rv = S.revealed || {};
  const q = (o, id, t, tip) => ({id, t, pts: o ? (o.ok ? 5 : 0) : 0, max: 5, tip: o && o.ok ? null : tip});
  const nEv = Object.keys(EVIDENCE).filter(k => S.ev[k]).length;
  const nConf = conflicts(S.brief || {}).length;
  const plan = S.miniPlan;
  const planPts = !plan ? 0 : plan.plan !== 4 ? 0 : plan.ending === 'E1' ? (plan.revised ? 8 : 15) : (plan.revised ? 5 : 10);
  const t = elapsed();
  const parts = [
    {k: 'finance', t: 'التحليل المالي', items: [
      q(T.revenue, 'revenue', 'أكبر حصة من الإيراد', 'حصة الإيراد = نسبة الزيارات × متوسط الإنفاق: الشريحة أ ≈ 46%.'),
      q(T.value, 'value', 'أعلى قيمة للعميل الواحد', 'قيمة العميل = الزيارات × الإنفاق: الشريحة ج ≈ 63.8 دولار شهريًا.'),
      q(T.discountShare, 'share', 'نسبة الخصم من الميزانية', '95,000 ÷ 120,000 ≈ 79% من الميزانية في بند واحد.'),
      {id: 'budget', t: 'مسودة الميزانية', pts: budgetPts(T.budget), max: 5, tip: budgetPts(T.budget) >= 4 ? null : 'خصّص للتشغيل في الذروة (باريستا 7–9) وللقياس، ولا تترك الخصم أو الاحتياطي يبتلع الميزانية.'},
    ]},
    {k: 'evidence', t: 'جمع الأدلة', items: [
      {id: 'evidence', t: `الأدلة التي جمعتها (${nEv}/10)`, pts: nEv, max: 10, tip: nEv < 10 ? 'كل وثيقة على مكتبك دليل، وبطاقة القيم في قاعة الاجتماعات أيضًا.' : null},
    ]},
    {k: 'segment', t: 'اختيار الشريحة', items: [
      {id: 'segment', t: 'الشريحة المستهدفة', pts: SEG_PTS[S.segment] || 0, max: 10, hidden: !rv.s1, tip: (SEG_PTS[S.segment] || 0) >= 10 ? null : 'اختر شريحة واحدة تدعمها الأرقام: أ (أكبر إيراد) أو ج (أعلى قيمة للعميل).'},
    ]},
    {k: 'brief', t: 'جودة الموجز', items: [
      ...['insight', 'idea', 'ops', 'measure', 'risk'].map(k => ({...fieldItem(k), hidden: !rv[SLIDES.find(s => s.fields.includes(k)).key]})),
      {id: 'conflicts', t: nConf ? `تعارضات في الموجز (${nConf})` : 'بلا تعارض', pts: -3 * nConf, max: 0, hidden: !rv.conf, tip: nConf ? 'هل يمكن أن يكون الحقلان صحيحين يوم ثلاثاء الساعة 8 صباحًا؟' : null},
    ]},
    {k: 'ops', t: 'التشغيل والأخلاقيات', items: [
      {id: 'ops', t: 'سألت الفرع قبل أن تعد بشيء', pts: S.ops_checked ? 8 : 0, max: 8, tip: S.ops_checked ? null : 'راسل مشرفة الفرع من اللابتوب واسأل ماذا تحتاج الفروع، لا تعدها فقط.'},
      {id: 'consent', t: 'موافقة السيدة بيل على قصتها', pts: S.nodes.N05 === 'call' ? 7 : S.nodes.N05 === 'drop' ? 4 : 0, max: 7, tip: S.nodes.N05 === 'call' ? null : 'قصة إنسان تحتاج موافقته المكتوبة: اطلبها قبل أن يُصنع الفيلم.'},
    ]},
    {k: 'plan', t: 'القرار النهائي', items: [
      {id: 'plan', t: plan ? (plan.plan === 4 ? (plan.revised ? 'الخطة الصحيحة بعد المراجعة' : 'الخطة الصحيحة من أول مرة') : 'أكملت بخطة خاطئة') : 'الخطة', pts: planPts, max: 15, hidden: !plan, tip: planPts >= 15 ? null : plan && plan.plan === 4 ? 'الخطة صحيحة، لكن موجزك لم يكن متماسكًا بالكامل.' : 'الخطة التي تطابق أدلتك وموجزك، لا الأكثر إثارة.'},
    ]},
    {k: 'speed', t: 'السرعة', items: [
      {id: 'speed', t: `الوقت حتى القرار (${fmt(t)})`, pts: S.miniTime == null ? 0 : t <= 420 ? 5 : t <= 600 ? 3 : t <= 840 ? 1 : 0, max: 5, hidden: S.miniTime == null, tip: 'أقل من 7 دقائق = 5 نقاط، أقل من 10 = 3، أقل من 14 = 1.'},
    ]},
  ];
  for (const p of parts) {
    p.max = p.items.reduce((s, i) => s + i.max, 0);
    p.pts = Math.max(0, p.items.reduce((s, i) => s + (i.hidden ? 0 : i.pts), 0));
    p.hidden = p.items.every(i => i.hidden);
  }
  return parts;
}
export const totalScore = (parts = scoreParts()) => parts.reduce((s, p) => s + p.pts, 0);
export function grade(n) {
  return n >= 85 ? {t: 'ممتاز', c: '#2e8b57', stars: 5} : n >= 70 ? {t: 'جيد جدًا', c: '#4f9a68', stars: 4} : n >= 55 ? {t: 'جيد', c: '#b8892f', stars: 3} : n >= 40 ? {t: 'مقبول', c: '#c07a3a', stars: 2} : {t: 'يحتاج مراجعة', c: '#b13a2a', stars: 1};
}
/** points of one slide (for the reveal in the meeting) */
export function slidePoints(slide) {
  const items = slide.fields.map(fieldItem);
  if (slide.seg) items.unshift({id: 'segment', t: 'الشريحة المستهدفة', pts: SEG_PTS[S.segment] || 0, max: 10});
  return {items, pts: items.reduce((s, i) => s + i.pts, 0), max: items.reduce((s, i) => s + i.max, 0)};
}
