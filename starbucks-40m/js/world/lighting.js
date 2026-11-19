// Sky (Poly Haven HDRI, rotated so its sun matches our sun), sun, interior fill lights.
import * as THREE from 'three';
import {scene, renderer, SOFTWARE, camera, onUpdate, damp} from '../core/engine.js';
import {loadHDR, model} from '../core/assets.js';
import {onQuality} from '../core/quality.js';
import {mergeStatic} from './merge.js';

// Sun positions for the three moments of the day (Cairo-like latitude, mid November). +x east, +z south.
const sunDir = (az, el) => { const A = THREE.MathUtils.degToRad(az), E = THREE.MathUtils.degToRad(el); return new THREE.Vector3(Math.sin(A) * Math.cos(E), Math.sin(E), -Math.cos(A) * Math.cos(E)).normalize(); };
export const TIMES = {
  morning: {exp: [1.45, 0.82], dir: sunDir(126, 25), sun: 0xffe2c0, si: 3.0, hemi: [0xe8d6bd, 0x6a5440, 0.35], env: 0.42, bg: 1.0, fog: 0xcbd6e0, lamps: 1.0},
  afternoon: {exp: [1.35, 0.78], dir: sunDir(222, 31), sun: 0xfff0dc, si: 3.3, hemi: [0xe8dcc8, 0x6a5440, 0.32], env: 0.45, bg: 1.0, fog: 0xd2dbe2, lamps: 0.75},
  dusk: {exp: [1.2, 1.5], dir: sunDir(250, 1.5), sun: 0xff9a5c, si: 0.35, hemi: [0x5d6a8a, 0x2a2220, 0.22], env: 0.12, bg: 0.16, fog: 0x3a4152, lamps: 1.35},
};
export let SUN_DIR = TIMES.morning.dir.clone();
export const exposure = {in: 1.45, out: 0.82};
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
let dim = 1, dimTarget = 1, poolMul = 1, timeMul = 1, hemiBase = 0.35, hemiQ = 1;
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
    l.intensity = u.spec.i * u.k * dim * poolMul * timeMul;
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

let HDR = null;
/** switch the light to a moment of the day: 'morning' | 'afternoon' | 'dusk' */
export function setTimeOfDay(key) {
  const T = TIMES[key]; SUN_DIR = T.dir.clone();
  sun.color.setHex(T.sun); sun.intensity = T.si; hemi.color.setHex(T.hemi[0]); hemi.groundColor.setHex(T.hemi[1]); hemiBase = T.hemi[2]; hemi.intensity = hemiBase * hemiQ;
  scene.environmentIntensity = T.env; scene.backgroundIntensity = T.bg; if (scene.fog) scene.fog.color.setHex(T.fog);
  timeMul = T.lamps; exposure.in = T.exp[0]; exposure.out = T.exp[1];
  sunFollow(new THREE.Vector3(0, 0, 32), 26);
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
  sunFollow(new THREE.Vector3(0, 0, 32), 26);
  scene.add(lamps);
  // quality tiers: fewer interior point lights on weak GPUs (each light costs on every pixel); hemisphere fills in
  onQuality((L) => {
    const n = L.direct ? 0 : L.lights;              // number of real lights near the camera (0 = hemisphere fill only)
    if (n !== pool.length) setPool(n);
    hemiQ = (n >= 6 ? 0.35 : n >= 4 ? 0.45 : 0.95) / 0.35; hemi.intensity = hemiBase * hemiQ;
    poolMul = n >= 6 ? 1 : 1.15;
    sun.castShadow = L.shadow > 0;
    if (L.shadow > 0 && sun.shadow.mapSize.x !== L.shadow) { sun.shadow.mapSize.set(L.shadow, L.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    if (L.direct) hemi.intensity = hemiBase * 3.1;
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
