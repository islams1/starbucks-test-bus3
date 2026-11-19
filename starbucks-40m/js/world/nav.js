// Navigation grid + A* so characters walk around furniture and through doors instead of through them.
import {colliders} from './building.js';

const G = {x0: -11, z0: -10, x1: 10, z1: 10, cell: 0.2, w: 0, h: 0, blocked: null};
const R = 0.34;   // body radius kept clear of obstacles

export function buildNav() {
  G.w = Math.ceil((G.x1 - G.x0) / G.cell); G.h = Math.ceil((G.z1 - G.z0) / G.cell);
  G.blocked = new Uint8Array(G.w * G.h);
  for (const c of colliders) {
    const i0 = Math.max(0, Math.floor((c.x0 - R - G.x0) / G.cell)), i1 = Math.min(G.w - 1, Math.floor((c.x1 + R - G.x0) / G.cell));
    const j0 = Math.max(0, Math.floor((c.z0 - R - G.z0) / G.cell)), j1 = Math.min(G.h - 1, Math.floor((c.z1 + R - G.z0) / G.cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) G.blocked[j * G.w + i] = 1;
  }
}
const ci = (x) => Math.floor((x - G.x0) / G.cell), cj = (z) => Math.floor((z - G.z0) / G.cell);
const inside = (i, j) => i >= 0 && j >= 0 && i < G.w && j < G.h;
const free = (i, j) => inside(i, j) && !G.blocked[j * G.w + i];
const cx = (i) => G.x0 + (i + 0.5) * G.cell, cz = (j) => G.z0 + (j + 0.5) * G.cell;

/** is the straight walk from a to b obstructed? */
export function segmentBlocked(ax, az, bx, bz) {
  if (!G.blocked) return false;
  const d = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(d / (G.cell * 0.5)));
  for (let k = 1; k < n; k++) { const t = k / n; if (!free(ci(ax + (bx - ax) * t), cj(az + (bz - az) * t))) return true; }
  return false;
}
function nearestFree(i, j) {
  if (free(i, j)) return [i, j];
  for (let r = 1; r < 24; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
    if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
    if (free(i + di, j + dj)) return [i + di, j + dj];
  }
  return null;
}
// binary heap keyed by f
class Heap { constructor() { this.a = []; } push(n, f) { const a = this.a; a.push([f, n]); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top[1]; } get size() { return this.a.length; } }
/** Distance field to one goal (Dijkstra over the walk grid), built a few milliseconds per frame so it never causes a hitch.
 *  Once done, a route from anywhere is just a walk downhill: no search per update (used by the map's route line). */
export function distanceField(bx, bz) {
  const f = {done: false, failed: false, d: null, goal: [bx, bz]};
  if (!G.blocked) { f.failed = true; return f; }
  const d = f.d = new Float32Array(G.w * G.h).fill(Infinity), heap = new Heap();
  const D = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  // seed every free cell within 1.5 m of the goal (cost = its distance): a goal tucked between furniture is still reached
  const gi = ci(bx), gj = cj(bz), rr = Math.ceil(1.5 / G.cell);
  for (let dj = -rr; dj <= rr; dj++) for (let di = -rr; di <= rr; di++) {
    const i = gi + di, j = gj + dj, r = Math.hypot(di, dj); if (r > rr || !free(i, j)) continue;
    d[j * G.w + i] = r; heap.push(j * G.w + i, r);
  }
  if (!heap.size) { const e = nearestFree(gi, gj); if (!e) { f.failed = true; return f; } d[e[1] * G.w + e[0]] = 0; heap.push(e[1] * G.w + e[0], 0); }
  f.step = (budgetMs = 3) => {
    const t0 = performance.now(); let k = 0;
    while (heap.size) {
      if ((++k & 255) === 0 && performance.now() - t0 > budgetMs) return false;
      const top = heap.a[0][0], cur = heap.pop(); if (top > d[cur]) continue;   // stale entry
      const i = cur % G.w, j = (cur / G.w) | 0;
      for (const [di, dj, c] of D) {
        const ni = i + di, nj = j + dj; if (!free(ni, nj)) continue;
        if (di && dj && (!free(i + di, j) || !free(i, j + dj))) continue;
        const n = nj * G.w + ni, g = d[cur] + c;
        if (g < d[n]) { d[n] = g; heap.push(n, g); }
      }
    }
    f.done = true; return true;
  };
  return f;
}
/** route [[x,z],...] from (ax,az) down a finished distance field, straightened where the way is clear */
export function routeFrom(f, ax, az) {
  if (!f || !f.done) return null;
  const s = nearestFree(ci(ax), cj(az)); if (!s) return null;
  const d = f.d; let i = s[0], j = s[1];
  if (!isFinite(d[j * G.w + i])) return null;                                 // goal not reachable from here
  const raw = [[ax, az]];
  for (let n = 0; n < 4000 && d[j * G.w + i] > 0; n++) {
    let bi = -1, bj = -1, bv = d[j * G.w + i];
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue; const ni = i + di, nj = j + dj; if (!free(ni, nj)) continue;
      if (di && dj && (!free(i + di, j) || !free(i, j + dj))) continue;
      const v = d[nj * G.w + ni]; if (v < bv) { bv = v; bi = ni; bj = nj; }
    }
    if (bi < 0) break; i = bi; j = bj; raw.push([cx(i), cz(j)]);
  }
  raw.push(f.goal);
  // string-pull with a bounded look-ahead (cheap enough to run several times a second)
  const out = [raw[0]]; let k = 0;
  while (k < raw.length - 1) {
    let far = k + 1;
    for (let m = Math.min(raw.length - 1, k + 48); m > k + 1; m--) if (!segmentBlocked(raw[k][0], raw[k][1], raw[m][0], raw[m][1])) { far = m; break; }
    out.push(raw[far]); k = far;
  }
  return out;
}

const cache = new Map();
/** A* path from (ax,az) to (bx,bz) → [[x,z],...] (smoothed) or null */
export function findPath(ax, az, bx, bz, {useCache = true} = {}) {
  if (!G.blocked) return null;
  const key = [ax, az, bx, bz].map(v => Math.round(v * 4)).join(',');
  if (useCache && cache.has(key)) return cache.get(key);
  const s = nearestFree(ci(ax), cj(az)), e = nearestFree(ci(bx), cj(bz));
  if (!s || !e) return null;
  const N = G.w * G.h, gScore = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const si = s[1] * G.w + s[0], ei = e[1] * G.w + e[0];
  const hf = (i, j) => { const dx = Math.abs(i - e[0]), dz = Math.abs(j - e[1]); return (dx + dz) + (Math.SQRT2 - 2) * Math.min(dx, dz); };
  const heap = new Heap(); gScore[si] = 0; heap.push(si, hf(s[0], s[1]));
  const D = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  let found = false, iter = 0;
  while (heap.size && iter++ < 200000) {
    const cur = heap.pop(); if (closed[cur]) continue; closed[cur] = 1;
    if (cur === ei) { found = true; break; }
    const i = cur % G.w, j = (cur / G.w) | 0;
    for (const [di, dj, c] of D) {
      const ni = i + di, nj = j + dj; if (!free(ni, nj)) continue;
      if (di && dj && (!free(i + di, j) || !free(i, j + dj))) continue;   // no corner cutting
      const nIdx = nj * G.w + ni, g = gScore[cur] + c;
      if (g < gScore[nIdx]) { gScore[nIdx] = g; came[nIdx] = cur; heap.push(nIdx, g + hf(ni, nj)); }
    }
  }
  if (!found) { if (useCache) cache.set(key, null); return null; }
  const raw = []; for (let c = ei; c !== -1; c = came[c]) raw.push([cx(c % G.w), cz((c / G.w) | 0)]);
  raw.reverse(); raw[raw.length - 1] = free(ci(bx), cj(bz)) ? [bx, bz] : raw[raw.length - 1];
  // string-pull: keep only the points needed for line of sight
  const out = [raw[0]]; let k = 0;
  while (k < raw.length - 1) { let far = k + 1; for (let m = raw.length - 1; m > k + 1; m--) if (!segmentBlocked(raw[k][0], raw[k][1], raw[m][0], raw[m][1])) { far = m; break; } out.push(raw[far]); k = far; }
  out.shift();
  if (useCache) cache.set(key, out);
  return out;
}
