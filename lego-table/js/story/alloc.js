// The rules of the table (LEGO_Turnaround_Simulation.md, Concept A §4): eight units of execution capacity, four
// proposals with visible costs (core 4, delivery 2, theme 3, venue 5), at most 8 funded, the trade-off lines from the
// spec's table, the review conditions and the coaching (three points + one risk). Pure logic and texts — no 3D here.
import {Q} from '../core/engine.js';

export const EN = Q.get('lang') === 'en';
export const tr = (a, e) => EN ? e : a;
export const CAP = 8;
// the far row, west to east (the player's left to right); Arabic reading starts from the right (core)
export const ROW = ['venue', 'theme', 'delivery', 'core'];
export const IDS = ['core', 'delivery', 'theme', 'venue'];
export const P = {
  core: {cost: 4, col: '#c8553d', hex: 0xc8553d, champ: 'rania', open: 'q_core', fund: 'f_core',
    name: ['حماية الخط الأساسي', 'Protect core range'], short: ['الخط الأساسي', 'Core range'],
    model: ['صينية بيضاء عليها بيت صغير وعربة من مكعبات ملساء ملوّنة', 'A white tray with a small house and a cart of smooth coloured blocks'],
    evidence: ['طلب حالي قوي، وقطع مألوفة لعملائنا.', 'Strong current demand and familiar components.'],
    funded: ['يُبقي فريق المنتج الأساسي مكتملًا.', 'Keeps the core product team staffed.'],
    waits: ['فريق المنتج الأساسي غير مكتمل في هذه الدورة؛ والطلب الحالي يعتمد على ما هو قائم فقط.', 'The core product team is not fully staffed this cycle; current demand relies on what is already in place.'],
    need: ['طلب الخط الأساسي', 'Core demand']},
  delivery: {cost: 2, col: '#2f6fb0', hex: 0x2f6fb0, champ: 'mikael', open: 'q_delivery', fund: 'f_delivery',
    name: ['تحسين موثوقية التوصيل', 'Improve delivery reliability'], short: ['موثوقية التوصيل', 'Delivery reliability'],
    model: ['لوحة قائمة تعبئة على حامل، وكرتونتان عليهما ملصقات المورّد', 'A packing-list board on a stand and two cartons with supplier labels'],
    evidence: ['التاجر يبلّغ عن توفّر غير منتظم.', 'Retailer reports inconsistent availability.'],
    funded: ['يضيف مسار عمل للتوفّر بفريق ومسؤول.', 'Adds a staffed availability workstream and an owner.'],
    waits: ['لا مسؤول عن التوفّر؛ ويبقى عدم انتظام التوفّر لدى التاجر ظاهرًا دون معالجة.', "No availability owner; the retailer's inconsistent availability stays visible and unaddressed."],
    need: ['موثوقية التوصيل', 'Delivery reliability']},
  theme: {cost: 3, col: '#2e8b6e', hex: 0x2e8b6e, champ: 'ina', open: 'q_theme', fund: 'f_theme',
    name: ['تجربة موضوع جديد', 'Pilot a new theme'], short: ['تجربة الموضوع الجديد', 'New theme pilot'],
    model: ['علبة كرتون عليها رسم «نموذج أوّلي»', 'A cardboard box with a "Prototype" sketch'],
    evidence: ['فكرة واعدة. طلب العملاء عليها غير مُختبَر.', 'Promising idea. Customer demand is untested.'],
    funded: ['ينشئ قائمة تجربة صغيرة وقرارًا لاحقًا.', 'Creates a small pilot queue and a follow-up decision.'],
    waits: ['لا قائمة تجربة؛ ويبقى طلب العملاء على الموضوع الجديد غير مُختبَر.', 'No pilot queue; customer demand for the new theme stays untested.'],
    need: ['دليل على الموضوع الجديد', 'New theme evidence']},
  venue: {cost: 5, col: '#8a63b8', hex: 0x8a63b8, champ: 'ina', open: 'q_venue', fund: 'f_venue',
    name: ['بناء مفهوم المكان', 'Build the venue concept'], short: ['مفهوم المكان', 'Venue concept'],
    model: ['مجسّم أبيض لمكان: كتل، وقاعة منحنية، وأشجار صغيرة، وممر', 'A blank white venue mockup: masses, a curved hall, small trees, a path'],
    evidence: ['وصول محتمل إلى ما بعد تجار التجزئة، مع وقت تنفيذ أطول ونموذج تشغيل جديد.', 'Possible reach beyond retailers, with a longer lead time and a new operating model.'],
    funded: ['ينشئ مسار عمل كبيرًا والتزامًا تشغيليًا مستقبليًا.', 'Creates a large workstream and a future operating commitment.'],
    waits: ['لا مسار عمل كبير ولا التزام تشغيلي جديد؛ ولا يُستكشف الوصول إلى ما بعد التجار في هذه الدورة.', 'No large workstream or new operating commitment; reach beyond retailers is not explored this cycle.'],
    need: ['نمو المكان', 'Venue growth']},
};
export const T = (pair) => EN ? pair[1] : pair[0];
export const nm = (id) => T(P[id].short);
export const full = (id) => T(P[id].name);
export const units = (n) => EN ? (n === 1 ? '1 unit' : n + ' units') : (n === 1 ? 'وحدة واحدة' : n === 2 ? 'وحدتان' : n + (n <= 10 ? ' وحدات' : ' وحدة'));
export const unitsMore = (n) => EN ? `Needs ${n} more unit${n === 1 ? '' : 's'}` : (n === 1 ? 'يحتاج وحدة واحدة أخرى' : n === 2 ? 'يحتاج وحدتين أخريين' : `يحتاج ${n} وحدات أخرى`);

// ---------------------------------------------------------------- capacity
export const used = (funded) => funded.reduce((s, id) => s + P[id].cost, 0);
export const free = (funded) => CAP - used(funded);
/** can `id` be added to `funded`? → {ok, need, couldReturn: [ids whose return would make room]} */
export function check(funded, id) {
  if (funded.includes(id)) return {ok: true, need: 0, couldReturn: []};
  const need = P[id].cost - free(funded);
  if (need <= 0) return {ok: true, need: 0, couldReturn: []};
  return {ok: false, need, couldReturn: funded.filter(f => P[f].cost >= need)};
}
export function refusalText(c) {
  const ret = c.couldReturn.map(f => `${nm(f)} (${P[f].cost})`).join(tr(' أو ', ' or '));
  return unitsMore(c.need) + (ret ? tr(' · يمكنك إعادة: ', ' · You could return: ') + ret : '');
}
/** the trade-off line for an allocation (the spec's table) */
export function tradeoff(funded) {
  const k = [...funded].sort().join('+');
  const L = {
    'core+delivery': ['يحمي منتجًا مطلوبًا ويعالج مشكلة توريده، مع قدرة متبقية غير مستخدمة. والفكرتان غير المؤكدتين تنتظران.', 'Protects a demanded product and addresses its supply issue, with capacity left unused. Both speculative ideas wait.'],
    'core+theme': ['يحمي المنتج الحالي ويشتري بعض الدليل على موضوع جديد. وموثوقية التوصيل تحتاج إلى مراجعة صريحة.', 'Protects the current product and buys some evidence on a new theme. Delivery reliability needs an explicit review.'],
    'theme+venue': ['يلتزم بعمل غير مُثبت أو طويل الأجل. وتبقى مشكلة توفّر المنتج لدى العميل الحالي ظاهرة.', "Commits to unproven or longer-term work. The current customer's availability issue remains visible."],
    'delivery+theme': ['يثبّت التوريد ويختبر الموضوع الجديد، بينما يبقى فريق الخط الأساسي ناقصًا.', 'Steadies supply and tests the new theme, while the core team stays short.'],
    'delivery+venue': ['يثبّت التوريد ويبدأ التزامًا كبيرًا طويل الأجل؛ والخط الأساسي والتجربة ينتظران.', 'Steadies supply and starts a large long-term commitment; the core line and the pilot wait.'],
  }[k];
  if (L) return T(L);
  if (funded.length === 1) { const c = P[funded[0]].cost; return EN ? `One proposal takes ${c} of 8 units; the rest stay free.` : `مقترح واحد يأخذ ${c} من 8 وحدات؛ والباقي يبقى حرًّا.`; }
  return '';
}

// ---------------------------------------------------------------- review conditions (holder order: 1 venue · 2 core · 3 distractor · 4 pilot · 5 delivery)
export const CONDS = [
  {k: 'venue', t: ['اطلب دليلًا على الطلب وعلى اقتصاديات التشغيل قبل زيادة الالتزام', 'Require demand and operating-economics evidence before increasing the commitment'], line: 'victor_m_venue'},
  {k: 'core', t: ['راجع طلبات إعادة الشراء لدى التاجر وتوفّر الخط الأساسي قبل توسيع التشكيلة', 'Review retailer reorder demand and core availability before expanding the range'], line: 'victor_m_core'},
  {k: 'distractor', t: ['اصرف الوحدات المتبقية فورًا', 'Spend the remaining units immediately'], line: 'victor_spend'},
  {k: 'theme', t: ['راجع الطلب في التجربة قبل الإذن بإطلاق أوسع', 'Review pilot demand before authorizing a wider launch'], line: 'victor_m_theme'},
  {k: 'delivery', t: ['أعد فحص الطلبات المسلّمة في موعدها وكاملة قبل إضافة تعقيد آخر', 'Recheck on-time and in-full orders before adding more complexity'], line: 'victor_m_delivery'},
];
export const condOf = (k) => CONDS.find(c => c.k === k);
export const condText = (k) => k ? T(condOf(k).t) : '';
/** Victor's answer to a condition clipped beside First */
export function condLine(first, k) { if (k === 'distractor') return 'victor_spend'; return k === first ? condOf(k).line : 'victor_other'; }

// ---------------------------------------------------------------- the allocation's completeness and the clean-up after every edit
/** a = {funded, first, next, need, cond} → what is still missing (texts) */
export function missing(a, {forPitch = false} = {}) {
  const m = [];
  if (!a.funded.length) m.push(tr('موّل مقترحًا واحدًا على الأقل', 'Fund at least one proposal'));
  if (a.funded.length === 2 && (!a.first || !a.next)) m.push(tr('رتّب المقترحين: الأول والتالي', 'Order the two: First and Next'));
  if (!a.need) m.push(tr('ضع شريحة الحاجة على مقترح ينتظر', 'Put the need chip on a proposal that waits'));
  if (forPitch && !a.cond) m.push(tr('اختر شرط المراجعة بجانب «الأول»', 'Pick the review condition beside “First”'));
  return m;
}
/** apply the rules after any edit; returns the announcements (and fixes `a` in place) */
export function cleanup(a) {
  const say = [];
  if (a.first && !a.funded.includes(a.first)) { say.push(tr(`أُزيل «${nm(a.first)}» من خانة «الأول»: لم يعد مموّلًا.`, `“${nm(a.first)}” left the First slot: it is no longer funded.`)); a.first = null; }
  if (a.next && !a.funded.includes(a.next)) { say.push(tr(`أُزيل «${nm(a.next)}» من خانة «التالي»: لم يعد مموّلًا.`, `“${nm(a.next)}” left the Next slot: it is no longer funded.`)); a.next = null; }
  if (a.funded.length === 1) {
    const only = a.funded[0];
    if (a.first !== only) { a.first = only; say.push(tr(`«${nm(only)}» في خانة «الأول» تلقائيًا (مقترح واحد).`, `“${nm(only)}” goes to First on its own (one proposal).`)); }
    a.next = null;
  }
  if (a.funded.length === 0) { a.first = null; a.next = null; }
  if (a.need && a.funded.includes(a.need)) { say.push(tr(`عادت شريحة «${T(P[a.need].need)}» إلى الطبق: مقترحها صار مموّلًا.`, `The “${T(P[a.need].need)}” chip went back to the dish: its proposal is now funded.`)); a.need = null; }
  if (a.cond && a.condFor && a.condFor !== a.first) { say.push(tr('تغيّر المقترح الأول: اختر شرطًا جديدًا.', 'The first proposal changed: pick a new condition.')); a.cond = null; a.condFor = null; a.condReset = true; }
  return say;
}

// ---------------------------------------------------------------- coaching (3 points + a risk observation; not a grade against history)
export function coaching(p) {
  const u = used(p.funded), fr = CAP - u;
  const pts = [
    {ok: u <= CAP && p.funded.length > 0, t: tr('استخدام صحيح للقدرة', 'Valid use of capacity'),
      why: u <= CAP && p.funded.length ? tr(`استخدمت ${u} من 8 وحدات دون تجاوز السعة.`, `You used ${u} of 8 units without going over capacity.`) : tr('لا مقترح مموّل.', 'Nothing was funded.')},
    {ok: !!p.need && !p.funded.includes(p.need), t: tr('حاجة منتظرة مسمّاة ومرتبطة بمقترح غير مموّل', 'Named deferred need tied to an unfunded proposal'),
      why: p.need ? tr(`سمّيت «${T(P[p.need].need)}»، ومقترحها ينتظر.`, `You named “${T(P[p.need].need)}”, and its proposal waits.`) : tr('لم تُسمَّ حاجة منتظرة.', 'No deferred need was named.')},
    {ok: !!p.cond && p.cond === p.first, t: tr('شرط مراجعة يطابق المقترح الأول', 'Review condition matched to the first proposal'),
      why: !p.cond ? tr('لا شرط مراجعة.', 'No review condition.') : p.cond === 'distractor' ? tr('صرف الوحدات الباقية ليس شرطًا للمراجعة: لا يقول ما الذي ستراقبه.', 'Spending the remaining units is not a review condition: it does not say what you will watch.')
        : p.cond === p.first ? tr(`الشرط يختبر «${nm(p.first)}»، وهو ما يبدأ أولًا.`, `The condition tests “${nm(p.first)}”, which starts first.`)
        : tr(`الشرط يختبر «${nm(p.cond)}»، لكن ما يبدأ أولًا هو «${nm(p.first)}».`, `The condition tests “${nm(p.cond)}”, but what starts first is “${nm(p.first)}”.`)},
  ];
  let risk;
  if (!p.funded.includes('delivery')) risk = tr('مشكلة التوفّر لدى التاجر الحالي تبقى بلا تمويل: قد يجد العملاء رفًّا فارغًا لمنتج يريدونه.', "The current retailer's availability issue remains unfunded: customers may still find an empty shelf for a product they want.");
  else if (!p.funded.includes('core')) risk = tr('الخط الذي يشتريه العملاء اليوم ليس له فريق مكتمل في هذه الدورة.', 'The line customers buy today has no fully staffed team this cycle.');
  else if (p.funded.includes('venue')) risk = tr('المكان ينشئ التزامًا تشغيليًا يمتد إلى ما بعد هذه الدورة.', 'The venue creates an operating commitment that runs beyond this cycle.');
  else risk = EN ? `${fr} unit${fr === 1 ? '' : 's'} stay unused: a buffer, or capacity the team could have staffed.` : `${units(fr)} ${fr === 1 ? 'تبقى' : 'تبقى'} غير مستخدمة: هامش أمان، أو قدرة كان يمكن للفريق أن يشغّلها.`;
  return {pts, risk, n: pts.filter(x => x.ok).length};
}
/** a frozen copy of a pitch */
export function snapshot(a) {
  return {funded: [...a.funded], first: a.first, next: a.next, need: a.need, cond: a.cond, used: used(a.funded), tradeoff: tradeoff(a.funded), t: Date.now()};
}
