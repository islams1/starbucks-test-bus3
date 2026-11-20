// Light: the city at sunset behind the window wall (a photographed sky, Poly Haven, turned so its sun sets in the
// west), its low sun across the room, the warm pendant over the table, a little fill — and the model's own "replay
// sun": a narrow beam that lights the store on the table as it was at 8:10 in the morning or 3:30 in the afternoon.
import * as THREE from 'three';
import {scene, onUpdate, damp, SOFTWARE} from '../core/engine.js';
import {loadHDR} from '../core/assets.js';
import {onQuality} from '../core/quality.js';
import {TABLE, ROOM_GLOW} from './room.js';

const SUN_DIR = new THREE.Vector3(-1, 0.13, 0.22).normalize();      // towards the sun (west, low)
export const sun = new THREE.DirectionalLight(0xffa868, 1.6);
export const hemi = new THREE.HemisphereLight(0xbfc6d6, 0x4a3a2e, 0.18);
export const keyLight = new THREE.SpotLight(0xffd7a6, 2.6, 0, 0.78, 0.75, 0);      // the pendant over the table
export const modelSun = new THREE.SpotLight(0xffe2bc, 0, 0, 0.36, 0.55, 0);        // the replay light on the model
export const fills = [new THREE.PointLight(0xffe2c2, 0.9, 0, 1.1), new THREE.PointLight(0xffe2c2, 0.7, 0, 1.1)];
const MODEL_C = new THREE.Vector3(TABLE.x - 0.05, TABLE.y + 0.1, TABLE.z + 0.02);
const MOODS = {
  morning: {dir: new THREE.Vector3(1.0, 0.62, 0.55), color: 0xffdcb0, i: 3.4, lamps: 1.0},
  afternoon: {dir: new THREE.Vector3(-0.85, 1.05, 0.75), color: 0xfff1e0, i: 2.7, lamps: 0.45},
  off: {dir: new THREE.Vector3(0.2, 1.2, 0.6), color: 0xfff1e0, i: 0, lamps: 0},
};
const cur = {dir: MOODS.off.dir.clone(), color: new THREE.Color(MOODS.off.color), i: 0, lamps: 0};
let want = MOODS.off, lampMat = null;
export function setModelLamps(mat) { lampMat = mat; }
/** 'morning' | 'afternoon' | 'off' */
export function setModelTime(k) { want = MOODS[k] || MOODS.off; }
// the house lights go down when the eye goes into the model (a theatre: the replay is lit, the room around it fades)
let dimWant = 0, dim = 0, hemiBase = 0.18; const base = {};
export function setRoomDim(k) { dimWant = Math.max(0, Math.min(1, k)); }

export async function buildLighting() {
  // the sky: image-based light + the view behind the glass
  const hdr = await loadHDR('assets/hdri/sunset_jhbcentral_2k.hdr');
  const shift = rotateHDRToSun(hdr, SUN_DIR);
  if (SOFTWARE) downsampleHDR(hdr, 4);
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'assets/hdri/sunset_jhbcentral_bg.jpg'; });
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d');
  const dx = Math.round(shift.frac * img.width); g.drawImage(img, dx, 0); g.drawImage(img, dx - img.width, 0); g.drawImage(img, dx + img.width, 0);
  const bg = new THREE.CanvasTexture(c); bg.colorSpace = THREE.SRGBColorSpace; bg.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = hdr; scene.background = bg;
  scene.environmentIntensity = 0.34; scene.backgroundIntensity = 0.85;
  // the low sun through the window wall
  sun.position.copy(SUN_DIR).multiplyScalar(14).add(new THREE.Vector3(0, 0.5, 0)); sun.target.position.set(0.4, 0.4, 0);
  sun.castShadow = true; const sc = sun.shadow.camera; sc.left = -6; sc.right = 6; sc.top = 5; sc.bottom = -5; sc.near = 2; sc.far = 30;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
  // the pendant over the table: one warm beam, soft edges, its shadow keeps hands and cups on the table
  keyLight.position.set(TABLE.x, 2.45, TABLE.z + 0.12); keyLight.target.position.set(TABLE.x, TABLE.y, TABLE.z);
  keyLight.castShadow = true; keyLight.shadow.mapSize.set(2048, 2048); keyLight.shadow.bias = -0.0002; keyLight.shadow.normalBias = 0.006; keyLight.shadow.radius = 4;
  keyLight.shadow.camera.near = 0.5; keyLight.shadow.camera.far = 4;
  // the model's replay light
  modelSun.target.position.copy(MODEL_C); modelSun.castShadow = true; modelSun.shadow.mapSize.set(2048, 2048);
  modelSun.shadow.bias = -0.00012; modelSun.shadow.normalBias = 0.0012; modelSun.shadow.radius = 2.5; modelSun.shadow.camera.near = 0.6; modelSun.shadow.camera.far = 3.2;
  fills[0].position.set(-2.6, 2.6, 1.6); fills[1].position.set(2.8, 2.6, -1.8);
  scene.add(sun, sun.target, hemi, keyLight, keyLight.target, modelSun, modelSun.target, ...fills);
  onQuality((L) => {
    const s = L.shadow || 0;
    modelSun.castShadow = s > 0; keyLight.castShadow = s >= 2048; sun.castShadow = s >= 4096;
    const ms = Math.min(2048, Math.max(1024, s));
    for (const l of [modelSun, keyLight]) if (l.shadow.mapSize.x !== ms) { l.shadow.mapSize.set(ms, ms); if (l.shadow.map) { l.shadow.map.dispose(); l.shadow.map = null; } }
    hemiBase = L.direct ? 0.9 : 0.18; hemi.intensity = hemiBase;
  });
  onUpdate((dt) => {
    const k = 1 - Math.exp(-2.2 * dt);
    cur.dir.lerp(want.dir, k); cur.color.lerp(new THREE.Color(want.color), k); cur.i += (want.i - cur.i) * k; cur.lamps += (want.lamps - cur.lamps) * k;
    modelSun.position.copy(MODEL_C).addScaledVector(cur.dir.clone().normalize(), 1.9);
    modelSun.color.copy(cur.color); modelSun.intensity = cur.i;
    if (lampMat) lampMat.emissiveIntensity = cur.lamps * 2.4;
    // house lights
    if (!base.sun && ROOM_GLOW.length) Object.assign(base, {sun: sun.intensity, key: keyLight.intensity, f0: fills[0].intensity, f1: fills[1].intensity, env: scene.environmentIntensity, bg: scene.backgroundIntensity, glow: ROOM_GLOW.map(m => m.emissiveIntensity ?? 1)});
    if (!base.sun) return;
    dim += (dimWant - dim) * (1 - Math.exp(-3 * dt));
    const r = 1 - dim;
    sun.intensity = base.sun * r; keyLight.intensity = base.key * (1 - dim * 1.05); fills[0].intensity = base.f0 * r; fills[1].intensity = base.f1 * r;
    scene.environmentIntensity = base.env * (1 - dim * 0.95); scene.backgroundIntensity = base.bg * (1 - dim * 0.95);
    hemi.intensity = hemiBase * (1 - dim);
    ROOM_GLOW.forEach((m, i) => { if (m.isMeshBasicMaterial) m.color.setScalar(0.75 * (1 - dim * 0.85)); else m.emissiveIntensity = base.glow[i] * r; });
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
/** shift the equirect columns so the brightest pixel (the sun) sits at our sun's azimuth */
function rotateHDRToSun(tex, dir) {
  const img = tex.image; const {width: W, height: H, data} = img;
  const f = data instanceof Uint16Array ? THREE.DataUtils.fromHalfFloat : (x) => x;
  let best = -1, bx = 0;
  for (let y = 0; y < H / 2; y++) for (let x = 0; x < W; x += 2) { const i = (y * W + x) * 4; const l = f(data[i]) + f(data[i + 1]) + f(data[i + 2]); if (l > best) { best = l; bx = x; } }
  const wantU = Math.atan2(dir.z, dir.x) / (Math.PI * 2) + 0.5;
  const shift = Math.round(wantU * W - bx);
  const out = new data.constructor(data.length);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const nx = ((x + shift) % W + W) % W; const si = (y * W + x) * 4, di = (y * W + nx) * 4; out[di] = data[si]; out[di + 1] = data[si + 1]; out[di + 2] = data[si + 2]; out[di + 3] = data[si + 3]; }
  img.data = out; tex.needsUpdate = true;
  return {frac: ((shift % W) + W) % W / W};
}
