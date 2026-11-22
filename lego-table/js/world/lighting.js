// The workshop's light (Concept A §2): daylight through the north windows (a high sun at an angle, the window bars'
// shadows on the floor), the street outside (a photographed street as the background), warm white linear lights over
// both tables, and a key light over the worktable. Reflections indoors come from a soft studio-like room.
import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {scene, renderer, SOFTWARE} from '../core/engine.js';
import {loadHDR} from '../core/assets.js';
import {onQuality} from '../core/quality.js';
import {WT, RT, GLOW} from './workshop.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
// the sun is high in the south: it lights the street and the buildings opposite; the north-facing workshop gets the
// soft light of the sky through its windows (a north-lit workroom), plus its own lamps
export const SUN_DIR = V(-0.38, 0.8, 0.46).normalize();
export const sun = new THREE.DirectionalLight(0xfff1de, 2.4);
export const hemi = new THREE.HemisphereLight(0xe3ebf4, 0x8f877b, 0.26);
export const keyLight = new THREE.SpotLight(0xffe9cf, 1.5, 0, 0.85, 0.8, 0);
export const fills = [new THREE.PointLight(0xffe6c8, 0.85, 0, 1.2), new THREE.PointLight(0xfff2e2, 0.55, 0, 1.2)];
export const windowLight = new THREE.DirectionalLight(0xdfe8f4, 0.75);          // the sky through the north windows
export const SKY = {env: null};

async function loadSky() {
  const hdr = await loadHDR('assets/hdri/kloofendal_38d_partly_cloudy_puresky_2k.hdr');
  rotateHDRToSun(hdr, SUN_DIR);
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  const pm = new THREE.PMREMGenerator(renderer); SKY.env = pm.fromEquirectangular(hdr).texture; pm.dispose();
  return hdr;
}

export async function buildLighting() {
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(renderer), 0.04).texture; pm.dispose();
  scene.environmentIntensity = 0.28;
  try { scene.background = await loadSky(); scene.backgroundIntensity = 0.85; } catch (e) { console.warn('sky', e); scene.background = new THREE.Color(0xcfd8e0); }
  sun.position.copy(SUN_DIR).multiplyScalar(16).add(V(0.4, 0, 0)); sun.target.position.set(0.4, 0, 0);
  const sc = sun.shadow.camera; sc.left = -8; sc.right = 8; sc.top = 7; sc.bottom = -7; sc.near = 2; sc.far = 40; sc.updateProjectionMatrix();
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
  keyLight.position.set(WT.x, 2.3, WT.z + 0.15); keyLight.target.position.set(WT.x, WT.y, WT.z);
  keyLight.castShadow = true; keyLight.shadow.mapSize.set(2048, 2048); keyLight.shadow.bias = -0.0002; keyLight.shadow.normalBias = 0.006; keyLight.shadow.radius = 4;
  keyLight.shadow.camera.near = 0.5; keyLight.shadow.camera.far = 4;
  fills[0].position.set(RT.x, 2.2, RT.z); fills[1].position.set(0.6, 2.7, 2.2);
  scene.add(sun, sun.target, hemi, keyLight, keyLight.target, ...fills);
  sun.target.updateMatrixWorld(); keyLight.target.updateMatrixWorld();
  onQuality((L) => {
    const s = L.shadow || 0;
    sun.castShadow = s > 0; keyLight.castShadow = s >= 2048;
    const ms = Math.min(2048, Math.max(1024, s));
    for (const l of [sun, keyLight]) if (l.shadow.mapSize.x !== ms) { l.shadow.mapSize.set(ms, ms); if (l.shadow.map) { l.shadow.map.dispose(); l.shadow.map = null; } }
    hemi.intensity = L.direct ? 0.9 : 0.2;
  });
}
/** the room lights up or dims a little (the archive is lit from the wall) */
export function setGlow(k) { for (const m of GLOW) m.emissiveIntensity = 2.4 * k; }

/** shift the equirect columns so the brightest pixel (the sun) sits at our sun's azimuth */
function rotateHDRToSun(tex, dir) {
  const img = tex.image; const {width: W, height: H, data} = img;
  const f = data instanceof Uint16Array ? THREE.DataUtils.fromHalfFloat : (x) => x;
  let best = -1, bx = 0;
  for (let y = 0; y < H / 2; y++) for (let x = 0; x < W; x += 2) { const i = (y * W + x) * 4; const l = f(data[i]) + f(data[i + 1]) + f(data[i + 2]); if (l > best) { best = l; bx = x; } }
  const wantU = Math.atan2(dir.z, dir.x) / (Math.PI * 2) + 0.5;
  const shift = Math.round(wantU * W - bx);
  const out = new data.constructor(data.length);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const nx = ((x + shift) % W + W) % W, si = (y * W + x) * 4, di = (y * W + nx) * 4; out[di] = data[si]; out[di + 1] = data[si + 1]; out[di + 2] = data[si + 2]; out[di + 3] = data[si + 3]; }
  img.data = out; tex.needsUpdate = true;
}
