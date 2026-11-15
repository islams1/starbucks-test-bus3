// Sky (Poly Haven HDRI, rotated so its sun matches our sun), sun, interior fill lights.
import * as THREE from 'three';
import {scene, renderer, SOFTWARE, camera, onUpdate, damp} from '../core/engine.js';
import {loadHDR, model} from '../core/assets.js';
import {onQuality} from '../core/quality.js';
import {mergeStatic} from './merge.js';

// Morning, early November (~9:00, lat ~30°N): sun in the south-east, ~30° high.
// world: +x east, +z south  →  az 130° from north ⇒ dir (sin az, , -cos az)
const EL = THREE.MathUtils.degToRad(31), AZ = THREE.MathUtils.degToRad(132);
export const SUN_DIR = new THREE.Vector3(Math.sin(AZ) * Math.cos(EL), Math.sin(EL), -Math.cos(AZ) * Math.cos(EL)).normalize();

export const sun = new THREE.DirectionalLight(0xfff0dc, 3.2);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.bias = -0.00025; sun.shadow.normalBias = 0.025; sun.shadow.radius = 2.5;
const sc = sun.shadow.camera; sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 1; sc.far = 260;
export const hemi = new THREE.HemisphereLight(0xe8d6bd, 0x6a5440, 0.35);
export const interior = new THREE.Group();     // the pool of point lights actually rendered
export const lamps = new THREE.Group();
// Interior lamps: 20 pendants are defined, but only the N nearest to the camera carry a real light (each light costs on
// every pixel). Lights fade in/out as the camera moves, so the rooms you look at are always fully lit; N never changes
// while playing (a different light count would recompile every shader).
const SPECS = [];
const pool = [];
let dim = 1, dimTarget = 1, poolMul = 1;
/** an extra light source handled by the pool (only rendered when it is among the nearest) */
export function addLightSpec({x, y = 2.35, z, i, d = 8, c = 0xffa456}) { SPECS.push({x, y, z, i, d, c, light: null}); }
/** dim all interior lamps (tension moment in the meeting) */
export function setInteriorDim(v) { dimTarget = v; }
function setPool(n) {
  while (pool.length < n) { const l = new THREE.PointLight(0xffa456, 0, 9, 1.6); l.position.set(0, -40, 0); l.userData = {spec: null, k: 0, out: false}; pool.push(l); interior.add(l); }
  while (pool.length > n) { const l = pool.pop(); if (l.userData.spec) l.userData.spec.light = null; interior.remove(l); }
}
onUpdate((dt) => {
  dim = damp(dim, dimTarget, 1.5, dt);
  if (!pool.length) return;
  const cp = camera.position;
  const ranked = SPECS.map(s => [s, Math.hypot(s.x - cp.x, s.z - cp.z) - (s.light ? 1.5 : 0)]).sort((a, b) => a[1] - b[1]).slice(0, pool.length).map(a => a[0]);
  const want = new Set(ranked);
  for (const l of pool) { const u = l.userData; if (u.spec) u.out = !want.has(u.spec); }
  for (const s of ranked) if (!s.light) {
    const l = pool.find(q => !q.userData.spec); if (!l) break;
    Object.assign(l.userData, {spec: s, k: 0, out: false}); s.light = l;
    l.position.set(s.x, s.y ?? 2.35, s.z); l.distance = s.d; l.color.setHex(s.c);
  }
  for (const l of pool) {
    const u = l.userData; if (!u.spec) { l.intensity = 0; continue; }
    u.k = Math.max(0, Math.min(1, u.k + (u.out ? -dt : dt) * 2.5));
    if (u.out && u.k === 0) { u.spec.light = null; u.spec = null; l.intensity = 0; continue; }
    l.intensity = u.spec.i * u.k * dim * poolMul;
  }
});

/** keep the shadow frustum centred around the area of interest (texel snapping avoids shimmer) */
export function sunFollow(target, radius = 45) {
  sc.left = -radius; sc.right = radius; sc.top = radius; sc.bottom = -radius; sc.updateProjectionMatrix();
  const texel = (radius * 2) / sun.shadow.mapSize.x;
  const t = target.clone(); t.x = Math.round(t.x / texel) * texel; t.z = Math.round(t.z / texel) * texel;
  sun.target.position.copy(t);
  sun.position.copy(t).addScaledVector(SUN_DIR, 120);
}

export async function buildLighting() {
  const hdr = await loadHDR('assets/hdri/kloofendal_38d_partly_cloudy_puresky.hdr');
  rotateHDRToSun(hdr, SUN_DIR);
  if (SOFTWARE) downsampleHDR(hdr, 4);   // CPU rendering: much cheaper environment pre-filtering
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = hdr;
  scene.environment = hdr;
  scene.backgroundIntensity = 1.0;
  scene.environmentIntensity = 0.42;
  scene.fog = new THREE.FogExp2(0xcbd6e0, 0.0028);   // density/colour blended indoors/outdoors in flow.js
  scene.add(sun, sun.target, hemi, interior);
  sunFollow(new THREE.Vector3(0, 0, 4));
  // interior fill: soft warm points under the ceiling panels (no shadows → cheap), stronger in key rooms
  const KEY = new Set(['0,7', '-9,-2', '-14,5.5', '-1.8,-9.5', '1.8,-9.5', '14.5,3', '8,3', '8,-3']);
  const lampSpots = [];
  // warm industrial pendants (demo cafe look): light sits just under each shade
  const pt = (x, z, i, d = 9, c = 0xffa456) => { SPECS.push({x, z, i: i * 1.35, d, c, key: KEY.has(x + ',' + z), light: null}); lampSpots.push([x, z]); };
  for (const [x, z] of [[-14, -9], [-9, -9], [-14, -2], [-9, -2], [-14, 5.5], [-9, 5.5]]) pt(x, z, 3.2, 10);
  for (const [x, z] of [[-2, 2], [2, 2], [0, 7]]) pt(x, z, 3.0, 9);
  pt(-1.8, -9.5, 3.6, 8); pt(1.8, -9.5, 3.6, 8);
  pt(9, -9, 3, 9); pt(14, -9, 3, 9);
  for (const x of [0, 8, 14]) pt(x, -3, 2.4, 8);
  pt(8, 3, 3, 8); pt(8, 7.5, 2.4, 8);
  pt(14.5, 3, 3, 8); pt(14.5, 7.5, 2.6, 8);
  scene.add(lamps);
  const proto = await model('hanging_industrial_lamp', 'hanging_industrial_lamp_lod');
  const bb = new THREE.Box3().setFromObject(proto);
  for (const [x, z] of lampSpots) { const o = proto.clone(true); o.scale.setScalar(0.8); o.position.set(x, 3.2 - 0.02 - bb.max.y * 0.8, z); o.traverse(m => { if (m.isMesh) m.castShadow = false; }); lamps.add(o); }
  mergeStatic(lamps, {cell: 100});
  // quality tiers: fewer interior point lights on weak GPUs (each light costs on every pixel); hemisphere fills in
  onQuality((L) => {
    const n = L.direct ? 0 : L.lights;              // number of real lights near the camera (0 = hemisphere fill only)
    if (n !== pool.length) setPool(n);
    hemi.intensity = n >= 6 ? 0.35 : n >= 4 ? 0.45 : 0.95;
    poolMul = n >= 6 ? 1 : 1.15;
    sun.castShadow = L.shadow > 0;
    if (L.shadow > 0 && sun.shadow.mapSize.x !== L.shadow) { sun.shadow.mapSize.set(L.shadow, L.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    if (L.direct) hemi.intensity = 1.1;
  });
  return hdr;
}

/** box-filter an equirect DataTexture down by factor f (keeps the same data type) */
function downsampleHDR(tex, f) {
  const img = tex.image, {width: W, height: H, data} = img, w = W / f | 0, h = H / f | 0;
  const half = data instanceof Uint16Array, toF = half ? THREE.DataUtils.fromHalfFloat : (x) => x, fromF = half ? THREE.DataUtils.toHalfFloat : (x) => x;
  const out = new data.constructor(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, g = 0, b = 0;
    for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) { const k = ((y * f + j) * W + x * f + i) * 4; r += toF(data[k]); g += toF(data[k + 1]); b += toF(data[k + 2]); }
    const n = f * f, o = (y * w + x) * 4; out[o] = fromF(r / n); out[o + 1] = fromF(g / n); out[o + 2] = fromF(b / n); out[o + 3] = fromF(1);
  }
  img.data = out; img.width = w; img.height = h; tex.needsUpdate = true;
}
/** Shift the equirect columns so the brightest pixel (the sun) sits at our sun azimuth. */
function rotateHDRToSun(tex, dir) {
  const img = tex.image; const {width: W, height: H, data} = img;
  const half = data instanceof Uint16Array;
  const f = half ? THREE.DataUtils.fromHalfFloat : (x) => x;
  let best = -1, bx = 0;
  for (let y = 0; y < H / 2; y++) for (let x = 0; x < W; x += 2) {   // sun is in the upper half
    const i = (y * W + x) * 4; const l = f(data[i]) + f(data[i + 1]) + f(data[i + 2]);
    if (l > best) { best = l; bx = x; }
  }
  // three.js equirectUv: u = atan(dir.z, dir.x)/(2π) + 0.5
  const wantU = Math.atan2(dir.z, dir.x) / (Math.PI * 2) + 0.5;
  const shift = Math.round(wantU * W - bx);
  const out = new data.constructor(data.length);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const nx = ((x + shift) % W + W) % W; const si = (y * W + x) * 4, di = (y * W + nx) * 4;
    out[di] = data[si]; out[di + 1] = data[si + 1]; out[di + 2] = data[si + 2]; out[di + 3] = data[si + 3];
  }
  img.data = out; tex.needsUpdate = true;
}
