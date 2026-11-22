import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import {renderer, SOFTWARE} from './engine.js';

export const manager = new THREE.LoadingManager();
const bar = document.getElementById('loadbar'), txt = document.getElementById('loadtxt');
const EN_LOAD = new URLSearchParams(location.search).get('lang') === 'en';
let total = 0, done = 0, shown = 0;
export function track(p, label) {
  total++;
  return p.then(v => { done++; shown = Math.max(shown, Math.round(done / Math.max(total, 60) * 100)); bar.style.width = shown + '%'; txt.textContent = (EN_LOAD ? `Loading… ${shown}%` : `جارٍ التحميل… ${shown}%`); return v; },
                e => { done++; console.error('asset failed', label, e); throw e; });
}

const gltf = new GLTFLoader(manager);
const fbx = new FBXLoader(manager);
const rgbe = new RGBELoader(manager);
const texl = new THREE.TextureLoader(manager);
const aniso = SOFTWARE ? 1 : renderer.capabilities.getMaxAnisotropy();

const modelCache = new Map();
/** Poly Haven glTF model (cached; returns a clone each call). */
/** Poly Haven model (cloned). `file` picks another glTF in the same folder (e.g. a lighter level of detail). */
export async function model(name, file = name) {
  if (!modelCache.has(file)) modelCache.set(file, track(gltf.loadAsync(`assets/models/${name}/${file}.gltf`), file).then(g => g.scene));
  const s = await modelCache.get(file);
  let skinned = false; s.traverse(o => { if (o.isSkinnedMesh) skinned = true; });
  const c = skinned ? SkeletonUtils.clone(s) : s.clone(true);          // a rigged part must follow its own copy's bones
  c.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return c;
}
/** a Sketchfab glTF (assets/models_sf/<slug>/scene.gltf), cached, cloned */
export async function sfModel(slug) {
  const k = 'sf:' + slug;
  if (!modelCache.has(k)) modelCache.set(k, track(gltf.loadAsync(`assets/models_sf/${slug}/scene.gltf`), slug).then(g => g.scene));
  const src = await modelCache.get(k); let skinned = false; src.traverse(o => { if (o.isSkinnedMesh) skinned = true; });
  const c = skinned ? SkeletonUtils.clone(src) : src.clone(true);
  c.traverse(o => { if (!o.isMesh) return; o.castShadow = true; o.receiveShadow = true;
    for (const m of [].concat(o.material)) { const sg = m.userData && m.userData.gltfExtensions && m.userData.gltfExtensions.KHR_materials_pbrSpecularGlossiness;
      if (sg && !m.userData.sgFixed) { m.userData.sgFixed = true; m.metalness = 0; m.roughness = 1 - (sg.glossinessFactor ?? 0.5); if (sg.diffuseFactor) m.color.setRGB(sg.diffuseFactor[0], sg.diffuseFactor[1], sg.diffuseFactor[2]); } } });
  return c;
}
/** One named part of a model file, moved to the origin. Poly Haven plant/shrub files hold several variants side by
 *  side (a, b, c… a metre or more apart); loading the whole file put extra plants around every pot. */
export async function modelPart(name, part, file = name) {
  const s = await model(name, file);
  const o = s.getObjectByName(part); if (!o) return s;
  o.removeFromParent(); o.position.x = 0; o.position.z = 0;
  const g = new THREE.Group(); g.name = part; g.add(o); g.updateMatrixWorld(true);
  const c = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());   // centre its footprint on the origin
  o.position.x -= c.x; o.position.z -= c.z;
  return g;
}
export const loadFBX = (url) => track(fbx.loadAsync(url), url.split('/').slice(-2).join('/'));
export const loadHDR = (url) => track(rgbe.loadAsync(url), 'sky');
export function tex(url, {srgb = true, repeat = null} = {}) {
  const t = texl.load(url);
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
export const json = (url) => track(fetch(url).then(r => r.json()), url);
export const bin = (url) => track(fetch(url).then(r => r.arrayBuffer()), url);

export const gait = {};
/** Decode the baked Rocketbox animation pack (see tools/bake_anims.html). */
export function decodeAnims(buf) {
  const dv = new DataView(buf);
  const hl = dv.getUint32(0, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl)));
  Object.assign(gait, header.gait || {});
  let nt = 0, nv = 0;
  for (const c of header.clips) for (const [, n, k] of c.tracks) { nt += k; nv += k * n; }
  let off = 4 + hl;
  const T = new Uint16Array(buf, off, nt); off += nt * 2; if (off % 4) off += 2;
  const V = new Int16Array(buf, off, nv);
  const clips = {}; let it = 0, iv = 0; const fps = header.fps;
  for (const c of header.clips) {
    const tracks = [];
    for (const [name, n, k] of c.tracks) {
      const times = new Float32Array(k), vals = new Float32Array(k * n);
      for (let i = 0; i < k; i++) times[i] = T[it + i] / fps;
      const s = n === 4 ? 1 / 32767 : 1 / 10;
      for (let i = 0; i < k * n; i++) vals[i] = V[iv + i] * s;
      it += k; iv += k * n;
      tracks.push(n === 4 ? new THREE.QuaternionKeyframeTrack(name, times, vals) : new THREE.VectorKeyframeTrack(name, times, vals));
    }
    clips[c.name] = new THREE.AnimationClip(c.name, c.dur, tracks);
  }
  return clips;
}
