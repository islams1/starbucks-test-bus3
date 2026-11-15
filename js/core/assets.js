import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import {renderer, SOFTWARE} from './engine.js';

export const manager = new THREE.LoadingManager();
const bar = document.getElementById('loadbar'), txt = document.getElementById('loadtxt');
let total = 0, done = 0, shown = 0;
export function track(p, label) {
  total++;
  return p.then(v => { done++; shown = Math.max(shown, Math.round(done / Math.max(total, 60) * 100)); bar.style.width = shown + '%'; txt.textContent = `جارٍ التحميل… ${shown}%`; return v; },
                e => { done++; console.error('asset failed', label, e); throw e; });
}

const gltf = new GLTFLoader(manager);
const fbx = new FBXLoader(manager);
const rgbe = new RGBELoader(manager);
const texl = new THREE.TextureLoader(manager);
const aniso = SOFTWARE ? 1 : renderer.capabilities.getMaxAnisotropy();

const modelCache = new Map();
/** Poly Haven glTF model (cached; returns a clone each call). */
export async function model(name) {
  if (!modelCache.has(name)) modelCache.set(name, track(gltf.loadAsync(`assets/models/${name}/${name}.gltf`), name).then(g => g.scene));
  const s = await modelCache.get(name);
  const c = s.clone(true);
  c.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return c;
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
