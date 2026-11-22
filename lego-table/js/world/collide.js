// Where the player can walk: a floor map (5 cm cells) built from the real geometry — every triangle of the room's
// things between ankle and head height marks the cells under it (tables, shelves, desks, chairs, the pallet, the
// walls). People are added as circles at the moment of the test.
import * as THREE from 'three';
import {characters} from '../actors/character.js';

export const GRID = {x0: 0, z0: 0, cell: 0.05, w: 0, h: 0, data: null};
const LO = 0.12, HI = 1.75;
export function buildGrid(roots, {x0, x1, z0, z1}) {
  const c = GRID.cell; Object.assign(GRID, {x0, z0, w: Math.ceil((x1 - x0) / c), h: Math.ceil((z1 - z0) / c)});
  GRID.data = new Uint8Array(GRID.w * GRID.h);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3();
  let tris = 0;
  for (const r of roots) {
    r.updateMatrixWorld(true);
    r.traverse(o => {
      if (!o.isMesh || o.isSkinnedMesh || !o.visible) return;
      const mats = [].concat(o.material); if (mats.every(m => m.transparent && (m.opacity < 0.5 || m.blending === THREE.AdditiveBlending || m.alphaMap))) return;
      const pos = o.geometry.attributes.position, idx = o.geometry.index, m = o.matrixWorld, n = idx ? idx.count : pos.count;
      for (let i = 0; i < n; i += 3) {
        a.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(m);
        b.fromBufferAttribute(pos, idx ? idx.getX(i + 1) : i + 1).applyMatrix4(m);
        d.fromBufferAttribute(pos, idx ? idx.getX(i + 2) : i + 2).applyMatrix4(m);
        const ylo = Math.min(a.y, b.y, d.y), yhi = Math.max(a.y, b.y, d.y);
        if (yhi < LO || ylo > HI) continue;
        const ix0 = Math.max(0, Math.floor((Math.min(a.x, b.x, d.x) - x0) / c)), ix1 = Math.min(GRID.w - 1, Math.floor((Math.max(a.x, b.x, d.x) - x0) / c));
        const iz0 = Math.max(0, Math.floor((Math.min(a.z, b.z, d.z) - z0) / c)), iz1 = Math.min(GRID.h - 1, Math.floor((Math.max(a.z, b.z, d.z) - z0) / c));
        if (ix1 < ix0 || iz1 < iz0) continue;
        for (let z = iz0; z <= iz1; z++) GRID.data.fill(1, z * GRID.w + ix0, z * GRID.w + ix1 + 1);
        tris++;
      }
    });
  }
  return tris;
}
const cellBlocked = (x, z) => { const ix = Math.floor((x - GRID.x0) / GRID.cell), iz = Math.floor((z - GRID.z0) / GRID.cell); return ix < 0 || iz < 0 || ix >= GRID.w || iz >= GRID.h || GRID.data[iz * GRID.w + ix] === 1; };
/** is a circle of radius r at (x, z) free of things and people? */
export function free(x, z, r = 0.22, ignore = null) {
  if (!GRID.data) return true;
  for (let dz = -r; dz <= r + 1e-6; dz += GRID.cell) for (let dx = -r; dx <= r + 1e-6; dx += GRID.cell) {
    if (dx * dx + dz * dz > r * r) continue;
    if (cellBlocked(x + dx, z + dz)) return false;
  }
  for (const ch of Object.values(characters)) {
    if (!ch.holder.visible || ch === ignore) continue;
    const p = ch.holder.position, q = Math.hypot(p.x - x, p.z - z);
    if (q < r + 0.34) return false;
  }
  return true;
}
