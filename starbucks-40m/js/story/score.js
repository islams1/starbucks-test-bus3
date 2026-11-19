// Scoring out of 100 (Starbucks_Scenario_AR.md §5). The route itself earns nothing; the evidence and the review condition do.
import {S} from './state.js';

export const LABOR = 21600, DAYS = 360;
export const breakEven = (contrib) => Math.ceil(LABOR / (DAYS * contrib));
export const annual = (orders, contrib) => Math.round(orders * DAYS * contrib - LABOR);
export const money = (v) => (v < 0 ? '−' : v > 0 ? '+' : '') + '$' + Math.abs(v).toLocaleString('en-US');

export const ROUTES = {
  all: {t: 'زيادة العمالة في كل الفروع الآن', en: 'Add staffing across all stores now', badge: 'التزام عالٍ', badgeEn: 'High commitment', line: 'p_rec_all'},
  pilot: {t: 'تجربة في فروع متشابهة أولًا', en: 'Run a matched-store pilot first', badge: 'التزام محدود', badgeEn: 'Limited commitment', line: 'p_rec_pilot'},
  handoff: {t: 'تثبيت العمالة وتجربة خطوة الاستلام', en: 'Keep staffing steady and test the pickup step', badge: 'تكلفة أقل، ودليل أبطأ على العمالة', badgeEn: 'Lower cost, slower evidence on staffing', line: 'p_rec_handoff'},
};
export const CUST_EV = {
  peak: {t: 'انتظار الاستلام في الذروة: 7 دقائق', en: 'Peak wait at pickup: 7 minutes', need: 'peak', pts: 15},
  off: {t: 'انتظار الهدوء للمقارنة: دقيقتان', en: 'Off-peak wait as a comparison: 2 minutes', need: 'off', pts: 5},
  comment: {t: 'تعليق زبون واحد', en: 'One customer comment', need: 'comment', pts: 0},
};
export const COST_EV = {
  be: {t: 'نقطة التعادل بالافتراضات الحالية', en: 'Break-even target with current assumptions', pts: 15},
  low: {t: 'نتيجة الزيادة المنخفضة (12 طلبًا)', en: 'Low-lift annual result (12 orders)', pts: 15},
  sales: {t: 'إيراد المبيعات وحده', en: 'Sales revenue alone', pts: 0},
};
export const CONDS = {
  all: {t: 'نشر على مراحل، ويتوقف التوسع إن لم تبلغ الفروع المشابهة زيادة التعادل، أو ساءت دقة الطلبات.', en: 'Stage the rollout and pause expansion if comparable stores miss their break-even order lift or order accuracy worsens.'},
  pilot: {t: 'مقارنة ساعات ذروة متشابهة، والتوسع فقط إن قل الانتظار وثبتت الدقة وغطى الربح الإضافي العمالة.', en: 'Compare comparable peak periods and expand only if wait improves, order accuracy holds and added contribution covers labor.'},
  handoff: {t: 'إعادة فتح ملف العمالة إن بقي انتظار الذروة مرتفعًا بعد التجربة، واختبار العمالة بتجربة منفصلة.', en: 'Reopen staffing if peak waits remain high after the handoff test, using a labor pilot to test the remaining bottleneck.'},
  feel: {t: 'استمر إذا شعر الناس أنه أسرع.', en: 'Roll forward if people say it feels faster.'},
};

/** score items from a committed snapshot (defaults to the live state) */
export function scoreParts(st = S, memo = S.committed) {
  const ev = st.ev || {}, tags = st.tags || {};
  const m = memo || {};
  const hyp = {peak: 15, all: 5, acc: 0}[st.hyp] ?? 0;
  const be = st.beFirst === 20 ? 10 : st.beSecond === 20 ? 5 : 0;
  const tagPts = (tags.ben === 'speed' ? 2.5 : 0) + (tags.salma === 'accuracy' ? 2.5 : 0);
  const cond = !m.cond ? 0 : m.cond === m.route ? 15 : m.cond === 'feel' ? 0 : 5;
  return [
    {k: 'rail', t: 'فحص سكة التذاكر', en: 'Inspect the order rail', pts: ev.rail ? 5 : 0, max: 5, why: 'لم تفحص السكة: الدليل على أن التأخير عند البار وليس عند الكاشير.'},
    {k: 'peak', t: 'قياس انتظار الذروة', en: 'Measure the peak wait', pts: ev.peak ? 5 : 0, max: 5, why: ''},
    {k: 'off', t: 'قياس انتظار الهدوء', en: 'Measure the off-peak wait', pts: ev.off ? 5 : 0, max: 5, why: ''},
    {k: 'tags', t: 'تصنيف التعليقين صحيحًا', en: 'Tag both comments correctly', pts: tagPts, max: 5, why: 'تعليق بن عن السرعة، وتعليق سلمى عن دقة الطلب.'},
    {k: 'hyp', t: 'الفرضية الأولى', en: 'First hypothesis', pts: hyp, max: 15, why: 'أرقامك تقول: الذروة 7 دقائق والهدوء دقيقتان. المشكلة انتظار الاستلام في الذروة.'},
    {k: 'be', t: 'نقطة التعادل في سؤال إليس', en: 'Break-even answer to Ellis', pts: be, max: 10, why: '21,600 ÷ (360 × 3) = 20 طلبًا في اليوم.'},
    {k: 'cmp', t: 'مقارنة افتراضين مختلفين على اللوح', en: 'Compare two distinct assumptions', pts: (st.compared && st.compared.size >= 2) ? 5 : 0, max: 5, why: ''},
    {k: 'contrib', t: 'تغيير ربح الطلب ورؤية نقطة تعادل جديدة', en: 'Change the contribution and see a new break-even', pts: st.contribChanged ? 5 : 0, max: 5, why: 'نقطة التعادل تتحرك مع ربح الطلب: عند 2.50 دولار تصبح 24 طلبًا.'},
    {k: 'mcust', t: 'المذكرة: دليل الزبائن', en: 'Memo: customer evidence', pts: m.cust ? CUST_EV[m.cust].pts : 0, max: 15, why: 'أقوى دليل هو القياس الخاص بالذروة، لا تعليق زبون واحد.'},
    {k: 'mcost', t: 'المذكرة: دليل التكلفة', en: 'Memo: cost evidence', pts: m.cost ? COST_EV[m.cost].pts : 0, max: 15, why: 'الإيراد وحده لا يقول إن كانت العمالة تغطي نفسها. استخدم ربح الطلب.'},
    {k: 'mcond', t: 'المذكرة: شرط المراجعة', en: 'Memo: review condition', pts: cond, max: 15, why: 'الشرط المطابق يقيس القرار الذي اتخذته بالضبط.'},
  ];
}
export const total = (parts = scoreParts()) => parts.reduce((s, p) => s + p.pts, 0);
export function grade(n) {
  if (n >= 90) return {t: 'الدليل وشرط المراجعة مكتملان', en: 'Evidence and review condition complete', cls: 'g1'};
  if (n >= 70) return {t: 'قرار مدعوم بدليل', en: 'Decision backed by evidence', cls: 'g2'};
  if (n >= 50) return {t: 'يحتاج دليلًا أقوى', en: 'Needs stronger evidence', cls: 'g3'};
  return {t: 'قرار بلا قياس', en: 'Decision without measurement', cls: 'g4'};
}
