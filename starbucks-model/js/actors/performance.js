// Meaning-driven performance: read each Arabic line word by word (with the voice's word timings) and derive
// head/body beats that match what is being said — nods on agreement and sentence ends, shakes on negation,
// head tilt + raised brows on questions, emphasis on numbers, looking at people who are named, pointing at
// things referred to ("انظر إلى هذا…"), shrugs on uncertainty, a thoughtful glance when weighing options.

const strip = (w) => w.replace(/[ً-ْٰـ]/g, '').replace(/[«»"'’،,.؟?!:;؛…\-()—]/g, '').trim().toLowerCase();   // Arabic or English
const base = (w) => { const s = strip(w); return s.length > 2 && /^[وف]/.test(s) ? [s, s.slice(1)] : [s]; };
const set = (str) => new Set(str.split(' '));
const NEG = set('لا لم لن ليس ليست لست ليسوا ممنوع no not never dont doesnt didnt isnt arent wasnt wont cant cannot nobody nothing');   // (دون/بلا mean "without": not a refusal)
const AFF = set('نعم جيد تمام صحيح حسنا أكيد بالضبط ماشي عادل رائع ممتاز موافق طبعا فعلا شكرا yes right good fine sure exactly okay great thanks thank correct absolutely agreed level');
const QW = set('لماذا لمن هل كيف ماذا متى أين كم أي أيهما why who whom how what when where which whose');
const NUM = set('ثلاثة ثلاث أربعة أربع خمسة خمس ستة ست سبعة سبع ثمانية ثماني تسعة تسع عشرة عشر عشرين مئة مائة ألف ألفا بالمئة أضعاف نصف ربع خمسين وتسعين وعشرين مليون الثامنة السابعة التاسعة الخامسة العاشرة الأولى الثانية one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand million percent half twice');
const POINT = set('انظر هذا هذه الجدار الشاشة اللوحة look this these here screen board wall');
const THINK = set('أفضل دعني ربما أعتقد أظن لعل maybe perhaps probably think guess suppose');
const NAMES = {'نور': 'noor', 'إليس': 'ellis', 'بريا': 'priya', 'سلمى': 'salma', noor: 'noor', ellis: 'ellis', priya: 'priya', salma: 'salma'};

/**
 * @param text   line text
 * @param words  [[offset_ms, dur_ms, word], ...] from the voice
 * @param ctx    {speakerId, emotion, seated, pointTarget: Vector3|null}
 * @returns {events: [{t, type, who?}], loop: 'auto'|'none'|'present'}
 */
export function buildPerformance(text, words, ctx) {
  const toks = text.split(/\s+/).filter(Boolean);
  const W = words.length, T = toks.length;
  const at = (i) => { if (!W) return 0.4 + i * 0.35; const k = Math.min(W - 1, Math.round(i * (W - 1) / Math.max(1, T - 1))); return words[k][0] / 1000; };
  const endAt = (i) => { if (!W) return 0.7 + i * 0.35; const k = Math.min(W - 1, Math.round(i * (W - 1) / Math.max(1, T - 1))); return (words[k][0] + words[k][1]) / 1000; };
  const ev = [];
  // spacing: never two head beats closer than 0.6 s; the same beat type needs more room (nod 0.9 s, tilt 1.8 s, point 2.5 s)
  const GAP = {nod: 0.9, tilt: 1.8, point: 2.5, shake: 1.2, shrug: 2.5, emph: 0.7, think: 1.5};
  const push = (t, type, extra = {}) => {
    if (ev.some(e => e.type !== 'look' && Math.abs(e.t - t) < 0.6)) return;
    if (ev.some(e => e.type === type && Math.abs(e.t - t) < (GAP[type] || 0.6))) return;
    ev.push({t, type, ...extra}); };
  let lastNeg = -9;
  const isQuestion = /[؟?]\s*[»"]?\s*$/.test(text);
  let negSeen = false;
  toks.forEach((tok, i) => {
    const forms = base(tok), has = (S) => forms.some(f => S.has(f));
    const t = at(i);
    // names: glance at the person while saying the name
    for (const f of forms) if (NAMES[f] && NAMES[f] !== ctx.speakerId) ev.push({t: t - 0.1, type: 'look', who: NAMES[f]});
    // things the speaker checks while naming them (an anaesthetist glances at her monitor when she reads a value)
    if (ctx.glances) for (const g of ctx.glances) if (forms.some(f => g.words.has(f)) && !ev.some(e => e.type === 'glance' && Math.abs(e.t - t) < 2.2)) ev.push({t: t - 0.15, type: 'glance', target: g.target, sec: g.sec || 1.3});
    if (has(NEG)) {
      negSeen = true; lastNeg = i;
      const next = toks[i + 1] ? strip(toks[i + 1]) : '';
      if (next === 'أعرف' || next === 'أدري' || next === 'know' || next === 'sure') { push(t, 'shrug'); const e = ev[ev.length - 1]; if (e && e.type === 'shrug') e.words = true; }
      else push(t, 'shake');
    } else if (has(AFF) && i - lastNeg > 2) push(t, 'nod');   // "لا أعرف بالضبط" is not agreement
    else if (has(QW) && (isQuestion || i < 2)) push(t, 'tilt');
    else if (has(NUM) || /\d/.test(tok)) push(t, 'emph');
    else if (has(POINT) && ctx.pointTarget) push(t, 'point');
    else if (has(THINK) && !ctx.seated) push(t, 'think');
    // clause ends: a small nod on statements, a lift + tilt on questions
    if (/[.!]$/.test(tok) && i < T - 1) push(endAt(i) - 0.05, 'nod');
    if (/[؟?]$/.test(tok)) push(endAt(i) - 0.15, 'tilt');
  });
  // last beat of the line
  const last = endAt(T - 1);
  if (isQuestion) push(last - 0.25, 'tilt');
  else if (!negSeen && !['sad', 'hurt', 'disappointed', 'annoyed'].includes(ctx.emotion)) push(last - 0.2, 'nod');
  // short disappointed / sceptical remarks: a slow disapproving shake
  if (['disappointed', 'skeptical'].includes(ctx.emotion) && T <= 7 && !ev.some(e => e.type === 'shake' || e.type === 'tilt')) push(Math.max(0.3, at(0) + 0.2), 'shake');
  ev.sort((a, b) => a.t - b.t);
  // body: short reactions get no gesturing loop (a beat is enough); pointing lines use a presentation gesture
  let loop = 'auto';
  if (T <= 5) loop = 'none';
  if (ev.some(e => e.type === 'point') && !ctx.seated) loop = 'present';
  if (!ctx.seated && ['unsure', 'skeptical', 'annoyed'].includes(ctx.emotion) && T <= 6 && !ev.some(e => e.type === 'shrug')) ev.unshift({t: Math.max(0.2, at(0)), type: 'shrug'});
  // seated at the table the hands stay where they are: only the head carries the beats (a shrug only when the words say "I don't know")
  if (ctx.seated) return {events: ev.filter(e => e.type !== 'point' && (e.type !== 'shrug' || e.words)), loop: 'none'};
  return {events: ev, loop};
}
