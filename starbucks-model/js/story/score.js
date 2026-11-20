// The model's arithmetic and the coaching rubric (Starbucks_Service_Investment_Simulation.md): one point each for a
// peak-specific observation, a cost measure tied to contribution, and the review condition that matches the route.
// The route itself earns nothing.
import {S} from './state.js';

export const LABOR = 21600, DAYS = 360;
export const breakEven = (contrib) => Math.ceil(LABOR / (DAYS * contrib));
export const annual = (orders, contrib) => Math.round(orders * DAYS * contrib - LABOR);
export const yearly = (orders, contrib) => Math.round(orders * DAYS * contrib);
export const money = (v) => (v < 0 ? '−' : v > 0 ? '+' : '') + '$' + Math.abs(v).toLocaleString('en-US');
export const status = (v) => v > 0 ? 'above' : v === 0 ? 'even' : 'below';
export const STATUS = {above: {t: 'فوق التكلفة', en: 'Above cost'}, even: {t: 'يغطي التكلفة بالضبط', en: 'Covers cost exactly'}, below: {t: 'تحت التكلفة', en: 'Below cost'}};

export const ROUTES = {
  all: {t: 'زيادة العمالة في كل الفروع الآن', en: 'Add staffing across stores now', badge: 'التزام عالٍ', badgeEn: 'High commitment', line: 'p_rec_all'},
  pilot: {t: 'تجربة في فروع متشابهة أولًا', en: 'Run a matched-store pilot first', badge: 'التزام محدود', badgeEn: 'Limited commitment', line: 'p_rec_pilot'},
  handoff: {t: 'تثبيت العمالة وتجربة خطوة الاستلام', en: 'Keep staffing steady and test the pickup step', badge: 'تكلفة أقل، ودليل أبطأ على العمالة', badgeEn: 'Lower cost and slower evidence on staffing', line: 'p_rec_handoff'},
};
export const CUST_EV = {
  peak: {t: 'انتظار الاستلام في الذروة: 7 دقائق', en: 'Peak wait at pickup: 7 minutes', need: () => S.ev.peak},
  off: {t: 'انتظار الهدوء للمقارنة: دقيقتان', en: 'Off-peak wait as a comparison: 2 minutes', need: () => S.ev.off},
  comment: {t: 'تعليق زبون واحد', en: 'One customer comment', need: () => S.ev.c1 || S.ev.c2},
};
export const COST_EV = {
  be: {t: 'نقطة التعادل بالافتراضات الحالية', en: 'Break-even target with current assumptions', need: () => S.tabletSeen},
  low: {t: 'نتيجة الزيادة المنخفضة في السنة', en: 'Low-lift annual result', need: () => S.seenLow},
  sales: {t: 'إيراد المبيعات وحده', en: 'Sales revenue alone', need: () => S.tabletSeen},
};
export const CONDS = {
  all: {t: 'نشر على مراحل، ويتوقف التوسع إن لم تبلغ الفروع المشابهة زيادة التعادل في الطلبات، أو ساءت دقة الطلبات.', en: 'Stage the rollout and pause expansion if comparable stores miss their break-even order lift or order accuracy worsens.'},
  pilot: {t: 'مقارنة ساعات ذروة متشابهة، والتوسع فقط إن قل الانتظار وثبتت الدقة وغطى الربح الإضافي العمالة.', en: 'Compare comparable peak periods and expand only if wait improves, order accuracy holds, and added contribution covers labor.'},
  handoff: {t: 'إعادة فتح ملف العمالة إن بقي انتظار الذروة مرتفعًا بعد تجربة الاستلام، باختبار العمالة في تجربة منفصلة.', en: 'Reopen staffing if peak waits remain high after the handoff test, using a labor pilot to test the remaining bottleneck.'},
  feel: {t: 'استمر إذا قال الناس إنه يبدو أسرع.', en: 'Roll forward if people say it feels faster.'},
};
const ROUTE_WHY = {
  all: {t: 'يناسب النشر الواسع: يقسّمه على مراحل ويوقفه إن لم تتحقق زيادة التعادل أو ساءت الدقة.', en: 'Fits a wide rollout: it stages it and stops it if the break-even lift fails or accuracy slips.'},
  pilot: {t: 'يناسب التجربة: يقارن ذروات متشابهة، ولا يتوسع إلا إذا تحسن الانتظار وثبتت الدقة وغُطيت العمالة.', en: 'Fits a pilot: it compares like peaks and expands only if wait, accuracy and labor cover all hold.'},
  handoff: {t: 'يناسب تجربة الاستلام: يعيد فتح ملف العمالة بتجربة منفصلة إن بقي الانتظار مرتفعًا.', en: 'Fits the pickup test: it reopens staffing with its own pilot if peak waits stay high.'},
};
/** the one-line explanation recorded with the memo: why this condition fits (or does not) */
export function condWhy(route, cond) {
  if (cond === 'feel') return {t: 'الإحساس ليس قياسًا: لا يقول ماذا نقيس، ولا متى نتراجع.', en: 'A feeling is not a measure: it says neither what to measure nor when to reverse.', fit: false};
  if (cond === route) return {...ROUTE_WHY[route], fit: true};
  return {t: 'شرط معقول، لكنه مكتوب لمسار آخر غير الذي اخترته.', en: 'A sound condition, but written for a different route than the one you chose.', fit: false};
}

/** the coaching rubric for a memo */
export function rubric(memo = S.committed) {
  const m = memo || {};
  return [
    {k: 'peak', t: 'ملاحظة خاصة بالذروة', en: 'A peak-specific observation', ok: m.cust === 'peak',
      why: 'أقوى دليل هو قياس الذروة (7 دقائق). تعليق زبون واحد، أو الهدوء وحده، لا يحدد أين المشكلة.', whyEn: 'The strongest evidence is the peak measure (7 minutes). One comment, or the quiet period alone, does not locate the problem.'},
    {k: 'cost', t: 'مقياس تكلفة مرتبط بربح الطلب', en: 'A cost measure tied to contribution', ok: m.cost === 'be' || m.cost === 'low',
      why: 'الإيراد وحده لا يقول إن كانت العمالة تغطي نفسها. استخدم نقطة التعادل أو نتيجة الزيادة المنخفضة.', whyEn: 'Revenue alone does not tell whether the labor pays for itself. Use the break-even target or the low-lift result.'},
    {k: 'cond', t: 'شرط مراجعة يطابق المسار', en: 'The review condition that matches the route', ok: !!m.cond && m.cond === m.route,
      why: 'الشرط المطابق يقيس القرار الذي اتخذته بالضبط، ويقول متى تتراجع عنه.', whyEn: 'The matching condition measures exactly the decision you made and says when to reverse it.'},
  ];
}
export const total = (parts = rubric()) => parts.filter(p => p.ok).length;
export function grade(n) {
  if (n >= 3) return {t: 'الدليل وشرط المراجعة مكتملان', en: 'Evidence and review condition complete', cls: 'g1'};
  if (n === 2) return {t: 'ينقص المذكرة عنصر واحد', en: 'One element missing', cls: 'g2'};
  if (n === 1) return {t: 'تحتاج دليلًا أقوى', en: 'Needs stronger evidence', cls: 'g3'};
  return {t: 'قرار بلا قياس', en: 'A decision without a measure', cls: 'g4'};
}
