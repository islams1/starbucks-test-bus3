// What the player has done, saved in the browser on every change (Concept A §7, "Persistence"): opened cards, the
// first tag on the note, the funded proposals, the order, the need chip, the review condition, the committed pitch
// (a frozen copy) and the practice attempts. "Continue where you left off" restores it; only "Start over" clears it.
export const S = {
  stage: 0,                 // 0 opening · 1 proposals · 2 allocate · 3 pitch · 4 archive · 5 final
  opened: {core: false, delivery: false, theme: false, venue: false},
  noteRead: false, tag: null, firstTag: null,          // 'current' | 'untested'
  a: {funded: [], first: null, next: null, need: null, cond: null, condFor: null},   // the allocation being made
  confirmed: false,
  committed: null,          // the frozen first pitch {funded, first, next, need, cond, used, tradeoff, t}
  practice: [],             // later attempts, each frozen
  attempt: 0,               // 0: the first run; 1+: a practice attempt
  said: {},                 // lines that play only once
  refused: false,           // the first refusal has been answered
  checks: {},               // archive checks answered
  archiveSeen: false,
  log: [],
};
export function log(type, a, b) { S.log.push({t: Math.round(performance.now() / 1000), type, a, b}); if (S.log.length > 200) S.log.shift(); }

const KEY = 'lego_table_v1';
export function save() {
  try {
    const {log: _, ...rest} = S;
    localStorage.setItem(KEY, JSON.stringify(rest));
  } catch (e) {}
}
export function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY)); if (!d) return false;
    Object.assign(S, d); S.a = Object.assign({funded: [], first: null, next: null, need: null, cond: null, condFor: null}, d.a || {});
    return true;
  } catch (e) { return false; }
}
const peek = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } };
export const hasProgress = () => { const d = peek(); return !!(d && (d.stage > 0 || Object.values(d.opened || {}).some(Boolean))); };
export const hasCommit = () => { const d = peek(); return !!(d && d.committed); };
export function clearAll() { try { localStorage.removeItem(KEY); } catch (e) {} }
/** a new allocation on the same table (the proposals stay opened, the note stays stamped) */
export function resetAllocation() { S.a = {funded: [], first: null, next: null, need: null, cond: null, condFor: null}; S.confirmed = false; }
