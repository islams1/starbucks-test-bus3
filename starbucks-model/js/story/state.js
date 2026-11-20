// What the player has done. The rubric (score.js) is computed from the committed memo, a frozen snapshot that a
// page refresh restores; "Revise recommendation" makes practice attempts beside it.
export const S = {
  scene: null,
  ev: {},                 // rail, peak, off, c1, c2 (opened)
  tags: {},               // c1, c2: 'speed' | 'accuracy'
  hyp: null,              // 'peak' | 'acc' | 'all'
  model: {contrib: 3, orders: 20},
  comparedOrders: new Set(),   // distinct purchase assumptions committed on the tablet
  contribChanged: false, seenLow: false, tabletSeen: false,
  draft: {},              // the memo being written (Back keeps it)
  committed: null,        // {route, cust, cost, cond, why, note, model, hyp}
  practice: [],
  log: [],
};
export function log(type, a, b) { S.log.push({t: Math.round(performance.now() / 1000), type, a, b}); }

const KEY = 'sbm_commit_v1';
export function saveCommit() {
  try { localStorage.setItem(KEY, JSON.stringify({ev: S.ev, tags: S.tags, hyp: S.hyp, comparedOrders: [...S.comparedOrders], contribChanged: S.contribChanged, seenLow: S.seenLow, tabletSeen: S.tabletSeen, model: S.model, committed: S.committed, practice: S.practice})); } catch (e) {}
}
export function loadCommit() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (!d || !d.committed) return false; Object.assign(S, d, {comparedOrders: new Set(d.comparedOrders || [])}); return true; } catch (e) { return false; }
}
export const hasCommit = () => { try { const d = JSON.parse(localStorage.getItem(KEY)); return !!(d && d.committed); } catch (e) { return false; } };
export function clearCommit() { try { localStorage.removeItem(KEY); } catch (e) {} }
