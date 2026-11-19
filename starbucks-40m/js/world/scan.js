// The café is a real modelled interior ("Cafe-Misti", Sketchfab, CC BY). Its floor height, walls and furniture are read
// from the model itself: every triangle that reaches between knee and head height is rasterised into an occupancy grid,
// which gives the player's colliders and the people's walk grid (no hand-placed boxes to drift out of step with the model).
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {manager, track} from '../core/assets.js';

export const SCAN = {root: null, grid: null, cell: 0.15, x0: 0, z0: 0, w: 0, h: 0, bbox: null};
const DROP = new Set(['Custom']);       // the architect's translucent red "scale figures"

/** Older exports use KHR_materials_pbrSpecularGlossiness, which three r160 no longer reads: such a material arrives
 * as a white, fully metallic, fully rough surface (glTF's defaults), so it shows only a grey reflection of the sky.
 * Turn it back into a dielectric with its diffuse colour and gloss. A "baked" surface (its lighting painted into a
 * texture used as both diffuse and emissive) keeps the baked light as its main look, and a little of the scene's
 * light on top so people still cast shadows on it. */
const BAKED_EMIT = 0.62, BAKED_LIT = 0.3;
function specGloss(m) {
  const sg = m.userData.gltfExtensions && m.userData.gltfExtensions.KHR_materials_pbrSpecularGlossiness;
  if (!sg || m.userData.sgDone) return;
  m.userData.sgDone = true;
  const d = sg.diffuseFactor || [1, 1, 1, 1];
  m.metalness = 0; m.roughness = 1 - (sg.glossinessFactor ?? 1);
  m.color.setRGB(d[0], d[1], d[2]);
  if (m.transparent) m.opacity = d[3];
  if (sg.diffuseTexture && m.emissiveMap) {          // baked: the diffuse texture is the emissive one
    m.map = m.emissiveMap;
    m.color.multiplyScalar(BAKED_LIT);
    m.emissive.setRGB(1, 1, 1); m.emissiveIntensity = BAKED_EMIT;
    m.userData.baked = true;
  }
  m.needsUpdate = true;
}

/** load the venue, drop the scale figures, put its café floor at y = 0 */
export async function loadVenue(parent, {slug = 'misti', probe = [5, -1], region = null, hide = [], y = 0, primary = true, floorY = null} = {}) {
  const g = await track(new GLTFLoader(manager).loadAsync(`assets/cafe_models/${slug}/scene.gltf`), 'café');
  const root = g.scene; root.name = 'venue';
  const kill = [];
  root.traverse(o => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.some(m => DROP.has(m.name))) { kill.push(o); return; }
    o.castShadow = true; o.receiveShadow = true;
    for (const m of mats) {
      specGloss(m);
      if (m.map) m.map.anisotropy = 8;
      if (m.transparent) { o.castShadow = false; m.depthWrite = false; }
      m.envMapIntensity = 0.55;
      if (/glass/i.test(m.name)) { m.roughness = 0.05; m.metalness = 0; m.envMapIntensity = 1.2; }
      if (m.name === 'Color_B01') { m.metalness = 0; m.roughness = 0.92; m.color.setHex(0x55524d); m.envMapIntensity = 0.25; }   // the ceiling: was a black mirror-metal
    }
  });
  for (const o of kill) o.removeFromParent();
  parent.add(root); root.updateMatrixWorld(true);
  // café floor: cast down at a point we know is inside the room
  const ray = new THREE.Raycaster(new THREE.Vector3(probe[0], 50, probe[1]), new THREE.Vector3(0, -1, 0));
  const hits = ray.intersectObject(root, true).filter(h => h.face && h.face.normal && Math.abs(h.face.normal.y) > 0.5);
  // the first upward surface under 3 m above the lowest point is the floor (the probe passes the ceiling first)
  const ys = hits.map(h => h.point.y).sort((a, b) => a - b);
  let floor = ys[0] || 0; for (const y of ys) { if (y > floor + 0.3) break; floor = y; }
  if (floorY != null) floor = floorY;
  root.position.y += y - floor; root.updateMatrixWorld(true);
  // furniture that would stand in the queue lane (bar stools by the counter) goes. The model merges objects by material,
  // so whole meshes cannot be hidden: drop the triangles whose centre is inside a hide box (and below its top).
  const A = new THREE.Vector3(), Bv = new THREE.Vector3(), Cv = new THREE.Vector3();
  if (hide.length) root.traverse(o => {
    if (!o.isMesh || !o.geometry.index) return;
    const pos = o.geometry.attributes.position, idx = o.geometry.index, m = o.matrixWorld, keep = [];
    let dropped = 0;
    for (let i = 0; i < idx.count; i += 3) {
      A.fromBufferAttribute(pos, idx.getX(i)).applyMatrix4(m); Bv.fromBufferAttribute(pos, idx.getX(i + 1)).applyMatrix4(m); Cv.fromBufferAttribute(pos, idx.getX(i + 2)).applyMatrix4(m);
      const cx = (A.x + Bv.x + Cv.x) / 3, cz = (A.z + Bv.z + Cv.z) / 3, top = Math.max(A.y, Bv.y, Cv.y);
      if (hide.some(([x0, x1, z0, z1, ymax]) => cx > x0 && cx < x1 && cz > z0 && cz < z1 && top - y < ymax)) { dropped++; continue; }
      keep.push(idx.getX(i), idx.getX(i + 1), idx.getX(i + 2));
    }
    if (dropped) { o.geometry = o.geometry.clone(); o.geometry.setIndex(keep); }
  });
  const occ = buildOccupancy(root, region, y);
  if (primary) { SCAN.root = root; SCAN.bbox = new THREE.Box3().setFromObject(root); Object.assign(SCAN, occ); }
  root.userData.occ = occ;
  return root;
}

/** rasterise triangles between 0.15 m and 1.7 m above the floor into a grid (cell 15 cm) */
function buildOccupancy(root, region, y0 = 0) {
  const c = SCAN.cell, bb = region ? {min: {x: region[0], z: region[2]}, max: {x: region[1], z: region[3]}} : new THREE.Box3().setFromObject(root);
  const O = {cell: c, x0: Math.floor(bb.min.x), z0: Math.floor(bb.min.z)};
  O.w = Math.ceil((bb.max.x - O.x0) / c) + 1; O.h = Math.ceil((bb.max.z - O.z0) / c) + 1;
  const grid = O.grid = new Uint8Array(O.w * O.h);
  const mark = (x, z) => { const ix = Math.floor((x - O.x0) / c), iz = Math.floor((z - O.z0) / c); if (ix >= 0 && iz >= 0 && ix < O.w && iz < O.h) grid[iz * O.w + ix] = 1; };
  const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3();
  const LO = y0 + 0.15, HI = y0 + 1.7;
  root.traverse(o => {
    if (!o.isMesh || !o.visible) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.every(m => m.transparent && m.opacity < 0.5 && !/glass/i.test(m.name))) return;     // see-through bits do not block
    const pos = o.geometry.attributes.position, idx = o.geometry.index, m = o.matrixWorld;
    const n = idx ? idx.count : pos.count;
    for (let i = 0; i < n; i += 3) {
      const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2;
      a.fromBufferAttribute(pos, i0).applyMatrix4(m); b.fromBufferAttribute(pos, i1).applyMatrix4(m); d.fromBufferAttribute(pos, i2).applyMatrix4(m);
      const ylo = Math.min(a.y, b.y, d.y), yhi = Math.max(a.y, b.y, d.y);
      if (yhi < LO || ylo > HI) continue;
      // sample the triangle (edges + interior) every ~half cell
      const L = Math.max(a.distanceTo(b), b.distanceTo(d), d.distanceTo(a));
      const steps = Math.min(400, Math.max(1, Math.ceil(L / (c * 0.5))));
      for (let u = 0; u <= steps; u++) for (let v = 0; v <= steps - u; v++) {
        const s = u / steps, t = v / steps, w = 1 - s - t;
        const y = a.y * w + b.y * s + d.y * t; if (y < LO || y > HI) continue;
        mark(a.x * w + b.x * s + d.x * t, a.z * w + b.z * s + d.z * t);
      }
    }
  });
  return O;
}
/** blocked cells merged into boxes (row runs) for the player's collisions and the walk grid */
export function occupancyBoxes(O = SCAN) {
  const out = [], c = O.cell, g = O.grid, W = O.w;
  for (let iz = 0; iz < O.h; iz++) {
    let run = -1;
    for (let ix = 0; ix <= W; ix++) {
      const b = ix < W && g[iz * W + ix];
      if (b && run < 0) run = ix;
      if (!b && run >= 0) { out.push({x0: O.x0 + run * c, x1: O.x0 + ix * c, z0: O.z0 + iz * c, z1: O.z0 + (iz + 1) * c}); run = -1; }
    }
  }
  return out;
}
export const blockedAt = (x, z) => { const ix = Math.floor((x - SCAN.x0) / SCAN.cell), iz = Math.floor((z - SCAN.z0) / SCAN.cell); return ix < 0 || iz < 0 || ix >= SCAN.w || iz >= SCAN.h ? false : !!SCAN.grid[iz * SCAN.w + ix]; };
