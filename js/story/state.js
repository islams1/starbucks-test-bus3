// State variables, evidence and ending logic — exactly as specified in section 4–5 of the situation file.
import {toast} from '../ui/ui.js';
import {sfx} from '../core/audio.js';

export const S = {
  mode: 'practice',
  clock: 8 * 60 + 45,
  ev: {},                         // M1..M10 -> true
  segment: 'none',                // none / A / B / C / D / everyone
  segmentTries: 0,
  insight: 'none',                // none / weak / strong
  idea: 'none',                   // none / discount / contest / film / partnership / combined
  ops_checked: false,
  consent: 'not_needed',          // not_needed / missing / planned   (film / customer story)
  consent_contest: 'not_needed',  // contest photos (user generated content)
  moderation: 'none',
  price_led: false,
  measure: 'none',                // none / vanity / business
  risk: false,
  brief_q: 0,
  nodes: {},                      // node id -> chosen option id
  log: [],                        // play log for the assessor
  plansTried: [],
  ending: null,
  tasks: {},
};

export const EVIDENCE = {
  M1: {cat: 'c', t: 'الشريحة أ: 46% من الزيارات، تريد السرعة في أيام العمل ومكانًا للقاء في عطلة الأسبوع', src: 'ملف البحث'},
  M2: {cat: 'c', t: 'الشريحة ج تزور أكثر (11 مرة شهريًا) وتريد السرعة فوق كل شيء', src: 'ملف البحث'},
  M3: {cat: 'o', t: 'طلبات الموبايل 31% من المعاملات؛ انتظار 9 دقائق 8–9 صباحًا مقابل هدف 5 دقائق', src: 'لوحة البيانات، أو هنا'},
  M4: {cat: 'o', t: 'استخدام مقاعد بعد ظهر عطلة الأسبوع 55%', src: 'لوحة البيانات'},
  M5: {cat: 'b', t: 'الدليل: تموضع راقٍ، ولا حملة قائمة على السعر دون موافقة؛ موافقة مكتوبة لأي محتوى من المستخدمين', src: 'كتيّب الدليل'},
  M6: {cat: 'b', t: 'القيم الخمس: الإتقان، النتائج، الشجاعة، الانتماء، البهجة', src: 'البطاقة على الحائط'},
  M7: {cat: 'o', t: 'اختبار التواصل: تفاعل 3 أضعاف، لكن 14% من الصور تُظهر ازدحامًا أو شكاوى', src: 'تقرير الاختبار'},
  M8: {cat: 'b', t: 'السيدة بيل لم تعطِ موافقتها على قصتها', src: 'السيناريو، أو مكالمة مع السيدة بيل'},
  M9: {cat: 'm', t: 'مولات المكتبات أكثر ازدحامًا بعد الظهر، حين تكون الشريحة أ في العمل', src: 'المقترح، أو سؤال جريس'},
  M10: {cat: 'm', t: 'الميزانية 120,000 دولار؛ وخصم كل بعد ظهر في ديسمبر سيكلّف نحو 95,000 دولار من الهامش', src: 'ورقة الميزانية، أو سؤال رايان'},
};
export const CAT = {c: 'العميل', b: 'العلامة', o: 'التشغيل', m: 'المال'};

export function gain(id) {
  if (S.ev[id]) return;
  S.ev[id] = true;
  log('evidence', id);
  sfx.evidence();
  toast(`<b>دليل جديد · ${CAT[EVIDENCE[id].cat]}</b><br>${EVIDENCE[id].t}`, 'ev');
}
export const has = (...ids) => ids.every(i => S.ev[i]);
export function log(type, a, b) { S.log.push({t: S.clock, type, a, b}); }
export function setNode(node, opt) { S.nodes[node] = opt; log('node', node, opt); }

// ----- clock (doc: reading 20 min, conversation 30, store call 30) -----
let clockCb = null;
export const onClock = (fn) => clockCb = fn;
export function advance(min) { S.clock = Math.min(S.clock + min, 13 * 60 + 40); clockCb && clockCb(S.clock); }

// ----- brief quality (node N07, delivered verbally in the meeting) -----
export function computeBrief() {
  const oneSeg = ['A', 'B', 'C', 'D'].includes(S.segment);
  if (!oneSeg) S.brief_q = 1;
  else if (S.insight === 'strong' && S.ops_checked && S.measure === 'business' && S.risk) S.brief_q = 3;
  else S.brief_q = 2;
  return S.brief_q;
}

/**
 * Endings are evaluated in order (doc §5): E4, E3, E1, E2.
 * plan: 1 discount · 2 contest everywhere · 3 film with real name + partnership · 4 coherent brief
 */
export function evaluateEnding(plan) {
  // The meeting choice is the campaign that gets launched; earlier decisions decide how good plan 4 is.
  if (plan === 3) { S.idea = 'film'; S.consent = 'missing'; return 'E4'; }          // a customer's real name/story without consent
  if (plan === 1) { S.idea = 'discount'; S.price_led = true; return 'E3'; }       // price-led
  if (plan === 2) { S.idea = 'contest'; S.moderation = 'none'; S.consent_contest = 'missing'; S.ops_checked_launch = false; return 'E3'; } // contest scaled without ops
  S.idea = 'combined'; S.price_led = false;
  computeBrief();
  return S.brief_q === 3 ? 'E1' : 'E2';
}
