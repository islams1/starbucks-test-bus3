// Two worlds share one set of lights. The committee room at sunset (a photographed city sky turned so its sun sets in
// the west, the low sun through the window wall, the warm pendant over the table, two fills) — and the café on Tuesday
// (a photographed street, morning or afternoon sun through the shop window, a light over the counter, two lamps).
// The same light objects are moved, recoloured and dimmed between the two (the light count never changes, so nothing
// recompiles): before the frame for the world the camera is in, before the replay screen for the café.
import * as THREE from 'three';
import {scene, camera, onUpdate, onBeforeRender, SOFTWARE} from '../core/engine.js';
import {loadHDR} from '../core/assets.js';
import {onQuality} from '../core/quality.js';
import {TABLE, ROOM_GLOW} from './room.js';
import {CAFE_POS, inCafe} from './maquette.js';

export const sun = new THREE.DirectionalLight(0xffa868, 1.6);
export const hemi = new THREE.HemisphereLight(0xbfc6d6, 0x4a3a2e, 0.18);
export const keyLight = new THREE.SpotLight(0xffd7a6, 2.6, 0, 0.78, 0.75, 0);
export const fills = [new THREE.PointLight(0xffe2c2, 0.9, 0, 1.1), new THREE.PointLight(0xffe2c2, 0.7, 0, 1.1)];
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const ROOM_SUN = V(-1, 0.13, 0.22).normalize();
const C = (x, y, z) => V(x, y, z).add(CAFE_POS);         // café frame → world

// the café's time of day
const MOODS = {
  morning: {dir: V(0.62, 0.42, 0.66).normalize(), sun: 0xffdcb0, si: 2.6, sky: 0.62, lamps: 1.0, key: 1.4, fill: 0.55},
  afternoon: {dir: V(-0.55, 0.62, 0.56).normalize(), sun: 0xfff1e0, si: 2.2, sky: 0.72, lamps: 0.45, key: 0.9, fill: 0.35},
  off: {dir: V(0.2, 0.8, 0.6).normalize(), sun: 0xfff1e0, si: 0.0, sky: 0.15, lamps: 0, key: 0, fill: 0},
};
let mood = MOODS.morning, lampMat = null;
export function setModelLamps(mat) { lampMat = mat; }
/** the café's light: 'morning' | 'afternoon' | 'off' */
export function setModelTime(k) { mood = MOODS[k] || MOODS.off; }
// the room's house lights can go down a little while the replay plays (a screening)
let dimWant = 0, dim = 0;
export function setRoomDim(k) { dimWant = Math.max(0, Math.min(1, k)); }

const sky = {room: null, cafe: null};
let world = null, hemiQ = 1, direct = false;
/** set the lights, sky and shadows up for 'room' or 'cafe' */
export function applyWorld(w) {
  world = w;
  const sc = sun.shadow.camera;
  if (w === 'room') {
    const r = 1 - dim;
    if (sky.room) { scene.environment = sky.room.hdr; scene.background = sky.room.bg; }
    scene.environmentIntensity = 0.34 * (1 - dim * 0.6); scene.backgroundIntensity = 0.85 * (1 - dim * 0.7);
    sun.color.setHex(0xffa868); sun.intensity = 1.6 * r;
    sun.position.copy(ROOM_SUN).multiplyScalar(14).add(V(0, 0.5, 0)); sun.target.position.set(0.4, 0.4, 0);
    sc.left = -6; sc.right = 6; sc.top = 5; sc.bottom = -5; sc.near = 2; sc.far = 30;
    hemi.color.setHex(0xbfc6d6); hemi.groundColor.setHex(0x4a3a2e); hemi.intensity = (direct ? 0.9 : 0.18) * hemiQ * (1 - dim * 0.7);
    keyLight.color.setHex(0xffd7a6); keyLight.intensity = 2.6 * (1 - dim * 0.75); keyLight.angle = 0.78; keyLight.penumbra = 0.75;
    keyLight.position.set(TABLE.x, 2.45, TABLE.z + 0.12); keyLight.target.position.set(TABLE.x, TABLE.y, TABLE.z);
    keyLight.shadow.camera.near = 0.5; keyLight.shadow.camera.far = 4;
    fills[0].position.set(-2.6, 2.6, 1.6); fills[0].color.setHex(0xffe2c2); fills[0].intensity = 0.9 * r;
    fills[1].position.set(2.8, 2.6, -1.8); fills[1].color.setHex(0xffe2c2); fills[1].intensity = 0.7 * r;
    ROOM_GLOW.forEach((m, i) => { if (m.isMeshBasicMaterial) { if (m.userData.dimmable) m.color.setScalar(0.75 * (1 - dim * 0.6)); } else m.emissiveIntensity = (m.userData.glow ?? (m.userData.glow = m.emissiveIntensity)) * r; });
  } else {
    if (sky.cafe) { scene.environment = sky.cafe.hdr; scene.background = sky.cafe.bg; }
    scene.environmentIntensity = mood.sky; scene.backgroundIntensity = 1.0;
    sun.color.setHex(mood.sun); sun.intensity = mood.si;
    const ct = C(0, 1, 0.5); sun.position.copy(mood.dir).multiplyScalar(20).add(ct); sun.target.position.copy(ct);
    sc.left = -9; sc.right = 9; sc.top = 9; sc.bottom = -9; sc.near = 2; sc.far = 50;
    hemi.color.setHex(0xdfe6ef); hemi.groundColor.setHex(0x6a5a48); hemi.intensity = 0.3 * hemiQ;
    keyLight.color.setHex(0xffd2a0); keyLight.intensity = mood.key * 3.2; keyLight.angle = 0.95; keyLight.penumbra = 0.8;
    keyLight.position.copy(C(-0.6, 3.3, -0.6)); keyLight.target.position.copy(C(-0.6, 0, -1.6));
    keyLight.shadow.camera.near = 0.5; keyLight.shadow.camera.far = 6;
    fills[0].position.copy(C(-2.4, 2.9, 1.7)); fills[0].color.setHex(0xffd9b0); fills[0].intensity = mood.fill * 2.2;
    fills[1].position.copy(C(2.6, 2.9, 0.6)); fills[1].color.setHex(0xffd9b0); fills[1].intensity = mood.fill * 2.0;
  }
  sc.updateProjectionMatrix(); keyLight.shadow.camera.updateProjectionMatrix();
  sun.target.updateMatrixWorld(); keyLight.target.updateMatrixWorld();
}
export const worldOf = (p) => inCafe(p) ? 'cafe' : 'room';
export const currentWorld = () => world;

async function loadSky(hdrUrl, bgUrl, dir) {
  const hdr = await loadHDR(hdrUrl);
  const shift = rotateHDRToSun(hdr, dir);
  if (SOFTWARE) downsampleHDR(hdr, 4);
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = bgUrl; });
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d');
  const dx = Math.round(shift.frac * img.width); g.drawImage(img, dx, 0); g.drawImage(img, dx - img.width, 0); g.drawImage(img, dx + img.width, 0);
  const bg = new THREE.CanvasTexture(c); bg.colorSpace = THREE.SRGBColorSpace; bg.mapping = THREE.EquirectangularReflectionMapping;
  return {hdr, bg};
}

export async function buildLighting() {
  [sky.room, sky.cafe] = await Promise.all([
    loadSky('assets/hdri/sunset_jhbcentral_2k.hdr', 'assets/hdri/sunset_jhbcentral_bg.jpg', ROOM_SUN),
    loadSky('assets/hdri/urban_street_04_2k.hdr', 'assets/hdri/urban_street_04_bg.jpg', MOODS.morning.dir),
  ]);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
  keyLight.castShadow = true; keyLight.shadow.mapSize.set(2048, 2048); keyLight.shadow.bias = -0.0002; keyLight.shadow.normalBias = 0.006; keyLight.shadow.radius = 4;
  scene.add(sun, sun.target, hemi, keyLight, keyLight.target, ...fills);
  onQuality((L) => {
    const s = L.shadow || 0;
    sun.castShadow = s > 0; keyLight.castShadow = s >= 2048;
    const ms = Math.min(2048, Math.max(1024, s));
    for (const l of [sun, keyLight]) if (l.shadow.mapSize.x !== ms) { l.shadow.mapSize.set(ms, ms); if (l.shadow.map) { l.shadow.map.dispose(); l.shadow.map = null; } }
    direct = !!L.direct; hemiQ = L.direct ? 1 : 1;
  });
  onUpdate((dt) => { dim += (dimWant - dim) * (1 - Math.exp(-3 * dt)); if (lampMat) lampMat.emissiveIntensity = mood.lamps * 2.4; });
  // the main frame: the world the camera is in
  onBeforeRender(() => applyWorld(worldOf(camera.position)));
  applyWorld('room');
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
