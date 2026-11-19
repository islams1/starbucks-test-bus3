// What the player has done. The score (score.js) is computed from it; the committed memo is a frozen snapshot.
export const S = {
  scene: null,
  ev: {},                 // rail, peak, off, ben (comment heard or read), salma
  tags: {},               // ben: 'speed'|'accuracy', salma: …
  hyp: null,              // 'peak' | 'acc' | 'all'
  beFirst: null, beSecond: null,
  model: {contrib: 3, orders: 20},
  compared: new Set(),    // distinct (orders, contrib) results looked at
  contribChanged: false,
  committed: null,        // {route, cust, cost, cond, why, model, hyp}
  practice: [],
  log: [],
};
export function log(type, a, b) { S.log.push({t: Math.round(performance.now() / 1000), type, a, b}); }

const KEY = 's40_commit';
export function saveCommit() {
  try { localStorage.setItem(KEY, JSON.stringify({ev: S.ev, tags: S.tags, hyp: S.hyp, beFirst: S.beFirst, beSecond: S.beSecond, compared: [...S.compared], contribChanged: S.contribChanged, model: S.model, committed: S.committed})); } catch (e) {}
}
export function loadCommit() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (!d || !d.committed) return false; Object.assign(S, d, {compared: new Set(d.compared || [])}); return true; } catch (e) { return false; }
}
export function clearCommit() { try { localStorage.removeItem(KEY); } catch (e) {} }
