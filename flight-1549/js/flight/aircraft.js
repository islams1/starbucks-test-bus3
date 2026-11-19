// The airplane: where it is at each moment of the real flight (assets/flight/track.json, built from the NTSB report), its
// attitude (heading, bank in the turns, pitch in the glide and the flare), and — when the captain chooses an airport
// instead of the river — a glide toward that runway that keeps the real energy budget: no thrust, about 17 m forward for
// every metre lost, more lost in the turn. The exterior A320 is used for the outside shots; the geese for the strike.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import {scene, onUpdate, renderer} from '../core/engine.js';
import {W, heightAt} from './world.js';
import {FLY, step as flyStep, RUNWAYS} from './fly.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const D2R = Math.PI / 180;
export const AC = {
  track: null, t: -85, group: new THREE.Group(), pos: V(), hdg: 0, bank: 0, pitch: 0, alt: 0, gs: 0, ias: 0, vs: 0,
  branch: null,                // {to, target: {x, z, hdg, name}, x, z, alt, hdg, bank, done}
  GLIDE: 14.5, RESERVE: 280, mixers: [],   // effective glide with windmilling engines; height needed to fly a landing at the end
};
export const AIRPORTS = {}; // filled after the track loads (local coordinates)
const ll = (lat, lon) => { const m = W.meta; return V((lon - m.origin[1]) * m.mlon, 0, -(lat - m.origin[0]) * m.mlat); };

export async function loadTrack() {
  AC.track = await (await fetch('assets/flight/track.json')).json();
  scene.add(AC.group);
  // runway thresholds offered by the controller (measured on the USGS photo; for the reach estimate, the glides and landing)
  AIRPORTS.LGA13 = {name: 'LaGuardia — runway 13', p: ll(40.7828, -73.8797), hdg: 131};
  AIRPORTS.LGA4 = {name: 'LaGuardia — runway 4', p: ll(40.7684, -73.8849), hdg: 40};
  AIRPORTS.TEB1 = {name: 'Teterboro — runway 1', p: ll(40.8373, -74.0603), hdg: 3};
  AIRPORTS.HUDSON = {name: 'the Hudson River', p: V(AC.track.x[AC.track.x.length - 1], 0, AC.track.z[AC.track.z.length - 1]), hdg: 205};
  for (const k of ['LGA13', 'LGA4', 'TEB1']) RUNWAYS.push({key: k, p: AIRPORTS[k].p, hdg: AIRPORTS[k].hdg, len: 2130});
  sampleReal(AC.t);
}
/** state on the real flight at time t (s after the strike) */
export function sampleReal(t, out = AC) {
  const T = AC.track, i0 = T.t[0], k = Math.max(0, Math.min(T.t.length - 1.001, (t - i0) / 0.25)), i = Math.floor(k), f = k - i;
  const L = (a) => a[i] + (a[i + 1] - a[i]) * f;
  let dh = T.hdg[i + 1] - T.hdg[i]; if (dh > 180) dh -= 360; if (dh < -180) dh += 360;
  out.pos.set(L(T.x), L(T.alt), L(T.z)); out.alt = L(T.alt); out.hdg = (T.hdg[i] + dh * f + 360) % 360;
  out.bank = L(T.bank); out.pitch = L(T.pitch); out.gs = L(T.gs);
  out.vs = (T.alt[Math.min(T.alt.length - 1, i + 1)] - T.alt[i]) / 0.25;
  return out;
}
/** indicated airspeed (kt) on the real flight, from the report's values */
export function iasAt(t) {
  if (t < 0) return Math.min(230, 160 + (t + 85) * 0.9);
  const P = [[0, 212], [20, 205], [60, 196], [120, 186], [175, 170], [185, 150], [212, 125]];
  for (let k = 0; k < P.length - 1; k++) if (t <= P[k + 1][0]) return P[k][1] + (P[k + 1][1] - P[k][1]) * (t - P[k][0]) / (P[k + 1][0] - P[k][0]);
  return 125;
}

/** how far the airplane can still glide from (x, alt, z) toward target p, given the turn needed (m of margin; <0 = short) */
export function reach(from, hdg, alt, p) {
  const dx = p.x - from.x, dz = p.z - from.z, dist = Math.hypot(dx, dz);
  const brg = (Math.atan2(dx, -dz) / D2R + 360) % 360; let turn = Math.abs(((brg - hdg + 540) % 360) - 180);
  const turnLoss = turn / 180 * 600;                             // the turn flies away from the target and sinks faster while banked
  // calibrated on the NTSB simulator tests: an immediate turn back reaches LaGuardia, a 35-second delay does not
  const can = Math.max(0, alt - AC.RESERVE) * AC.GLIDE - turnLoss;
  return {dist, can, margin: can - dist, turn, brg};
}

/** leave the real track: glide toward an airport (or back toward the river) from the current state */
export function startBranch(key) {
  const tg = AIRPORTS[key]; if (!tg) return;
  AC.branch = {key, target: tg, x: AC.pos.x, z: AC.pos.z, alt: AC.alt, hdg: AC.hdg, bank: AC.bank, gs: AC.gs, t0: AC.t, done: null};
}
function stepBranch(dt) {
  const B = AC.branch, p = B.target.p;
  const brg = (Math.atan2(p.x - B.x, -(p.z - B.z)) / D2R + 360) % 360;
  let err = ((brg - B.hdg + 540) % 360) - 180;
  const wantBank = Math.max(-28, Math.min(28, err * 1.2));
  B.bank += (wantBank - B.bank) * Math.min(1, dt * 1.2);
  const V = Math.max(68, B.gs - dt * 0.15); B.gs = V;
  B.hdg = (B.hdg + Math.tan(B.bank * D2R) * 9.81 / V / D2R * dt + 360) % 360;
  B.x += Math.sin(B.hdg * D2R) * V * dt; B.z -= Math.cos(B.hdg * D2R) * V * dt;
  const sink = V / AC.GLIDE * (1 / Math.cos(B.bank * D2R)) ** 2;
  B.alt -= sink * dt;
  const ground = Math.max(0, heightAt(B.x, B.z));
  const dist = Math.hypot(p.x - B.x, p.z - B.z);
  if (!B.done && dist < 300 && B.alt - ground > 30) B.done = 'reached';
  if (!B.done && B.alt - ground < 120 && dist > 600) B.done = 'short';
  AC.pos.set(B.x, B.alt, B.z); AC.alt = B.alt; AC.hdg = B.hdg; AC.bank = B.bank; AC.pitch = 2 - sink * 0.3; AC.gs = V; AC.vs = -sink;
}

/** a steady frame for cameras that follow the airplane: forward and right along its heading only (no bank or pitch),
 *  the heading smoothed over about half a second so the camera does not swing with every correction */
const _ch = {h: null, t: 0};
export function chaseFrame() {
  const now = performance.now(), gap = (now - _ch.t) / 1000 || 0, dt = Math.min(0.1, gap); _ch.t = now;
  if (_ch.h == null || gap > 0.6) _ch.h = AC.hdg;           // a new shot starts on the heading; a slow frame does not snap it
  else { const d = ((AC.hdg - _ch.h + 540) % 360) - 180; _ch.h = (_ch.h + d * Math.min(1, dt * 2.2) + 360) % 360; }
  const a = _ch.h * D2R, fwd = V(Math.sin(a), 0, -Math.cos(a));
  return {fwd, side: V(-fwd.z, 0, fwd.x)};
}
export function update(dt) {
  AC.t += dt;
  if (FLY.on) flyStep(dt);                         // the captain is flying
  else if (AC.branch) stepBranch(dt); else sampleReal(AC.t);
  if (!FLY.on) AC.ias = AC.branch ? AC.gs / 0.5144 - 6 : iasAt(AC.t);
  AC.group.position.copy(AC.pos);
  AC.group.rotation.set(-AC.pitch * D2R, Math.PI - AC.hdg * D2R, AC.bank * D2R, 'YXZ');
}

// ---------------------------------------------------------------- exterior model and the geese
/** the light of a hazy winter afternoon over the river, for reflections: pale sky, a bright horizon, the dark water */
function skyEnv() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, '#6f8aa6'); gr.addColorStop(0.38, '#b9c8d4'); gr.addColorStop(0.49, '#e4e9ec'); gr.addColorStop(0.52, '#8e989c');
  gr.addColorStop(0.6, '#566369'); gr.addColorStop(1, '#2c373c');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
  g.fillStyle = 'rgba(70,74,78,0.55)'; for (let x = 0; x < 256; x += 3) g.fillRect(x, 58 + Math.sin(x * 0.3) * 1.5, 3, 4 + (x * 7 % 5));   // the far shore
  const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
  const pm = new THREE.PMREMGenerator(renderer), env = pm.fromEquirectangular(t).texture; pm.dispose(); t.dispose();
  return env;
}
export async function loadExterior() {
  const g = await new GLTFLoader().loadAsync('assets/flight_models/a320/model.gltf').catch(() => null);
  if (!g) return null;
  const root = g.scene; root.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(root), s = b.getSize(V()), c = b.getCenter(V());
  const long = s.x > s.z ? 'x' : 'z', k = 37.57 / Math.max(s.x, s.z);
  const wrap = new THREE.Group(); root.position.sub(c); wrap.add(root); wrap.scale.setScalar(k);
  if (long === 'x') wrap.rotation.y = Math.PI / 2;
  const ext = new THREE.Group(); ext.add(wrap); ext.visible = false; AC.group.add(ext); AC.ext = ext;
  // the painted scheme of N106US in 2009 (US Airways' 2005 colours, no titles): off-white fuselage, light grey belly and
  // wings, grey engine nacelles, a navy fin crossed by a red and white band. Painted by position in the airplane's own
  // frame (nose +z, fin top at z ≈ −17.6, y up), so it needs no texture work on the model.
  AC.group.updateMatrixWorld(true);
  const inv = ext.matrixWorld.clone().invert(), sky = skyEnv();
  root.traverse(o => {
    if (!o.isMesh) return;
    // the model's parts are dropped by frustum culling from some angles (the "cut" airplane): always draw it
    o.castShadow = true; o.frustumCulled = false;
    // the cockpit windows (flat black in the model): dark tinted glass that mirrors the sky and the river
    if (o.name === 'Object_6') {
      o.material = new THREE.MeshPhysicalMaterial({color: 0x0a1218, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, envMap: sky, envMapIntensity: 2.4});
      return;
    }
    const m = o.material = o.material.clone(); m.envMapIntensity = 0.6;
    // the cabin windows are dark ovals in the fuselage's picture: they mirror the sky too (the paint only a little)
    if (m.map) m.envMap = sky;
    const win = m.map ? 'float winMask = 1.0 - smoothstep(0.12, 0.22, dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)));' : 'float winMask = 0.0;';
    const toExt = inv.clone().multiply(o.matrixWorld);
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uToExt = {value: toExt};
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform mat4 uToExt; varying vec3 vExt;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvExt = (uToExt * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vExt;')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.05, winMask);')
        .replace('#include <lights_fragment_maps>', '#include <lights_fragment_maps>\n#ifdef USE_ENVMAP\niblIrradiance *= 0.0; radiance *= mix(0.15, 1.8, winMask);\n#endif')
        .replace('#include <map_fragment>', `#include <map_fragment>
          ${win}
          {
            vec3 P = vExt; vec3 tint = vec3(0.95, 0.94, 0.91);                         // off-white
            float fus = 1.0 - smoothstep(2.0, 2.4, abs(P.x));
            tint = mix(tint, vec3(0.74, 0.77, 0.80), fus * (1.0 - smoothstep(-1.6, -0.9, P.y)));   // belly
            tint = mix(tint, vec3(0.78, 0.80, 0.83), (1.0 - fus) * step(P.y, 1.2));              // wings, stabilisers
            float nac = (1.0 - smoothstep(1.1, 1.5, abs(abs(P.x) - 5.75))) * step(P.y, -1.25) * step(-1.5, P.z) * step(P.z, 8.0);
            tint = mix(tint, vec3(0.55, 0.59, 0.63), nac);                                        // engine nacelles
            float fin = step(P.z, -11.5) * step(1.7, P.y) * (1.0 - step(0.9, abs(P.x)));
            float u = P.y + (P.z + 12.0) * 0.32;
            vec3 finC = vec3(0.07, 0.12, 0.24);                                                   // navy
            finC = mix(finC, vec3(0.93, 0.93, 0.92), step(3.6, u) * step(u, 3.95));               // white
            finC = mix(finC, vec3(0.70, 0.08, 0.12), step(3.95, u) * step(u, 4.45));              // red
            finC = mix(finC, vec3(0.93, 0.93, 0.92), step(4.45, u) * step(u, 4.75));
            tint = mix(tint, finC, fin);
            diffuseColor.rgb *= tint;
          }`);
    };
  });
  return ext;
}
const _bp = new THREE.Vector3();
export async function loadGeese() {
  // a rigged waterfowl with real flight animations ("Animated Swan", GAMICO, CC BY), coloured as a Canada goose by its
  // bones (black neck and head with the white chin strap, black tail, grey-brown back and wings, pale breast) and scaled
  // to a goose (about 1.7 m across the wings). Geese beat their wings about three times a second.
  const g = await new GLTFLoader().loadAsync('assets/flight_models/goose/model.gltf').catch(() => null);
  if (!g) return null;
  const flock = new THREE.Group(); scene.add(flock); flock.visible = false; AC.flock = flock;
  const proto = g.scene; let sk = null; proto.traverse(o => { if (o.isSkinnedMesh) sk = o; });
  if (sk) try { gooseColours(sk); } catch (e) { console.warn('[geese] colours', e); }
  const clips = ['Flap1', 'Flap2', 'GlideForward'].map(n => g.animations.find(a => a.name === n)).filter(Boolean);
  for (let i = 0; i < 26; i++) {
    const o = SkeletonUtils.clone(proto); o.scale.setScalar(0.46);
    o.traverse(m => { if (m.isMesh) { m.frustumCulled = false; m.castShadow = false; } });
    const mx = new THREE.AnimationMixer(o);
    const clip = i % 7 === 3 && clips[2] ? clips[2] : clips[i % 2] || clips[0];
    if (clip) { const a = mx.clipAction(clip); a.time = Math.random() * clip.duration; a.timeScale = 2.4 + Math.random() * 0.5; a.play(); }
    AC.mixers.push(mx);
    flock.add(o);
  }
  onUpdate((dt) => {
    if (!flock.visible) return;
    for (const m of AC.mixers) m.update(dt);
    flock.position.addScaledVector(flock.userData.vel || V(), dt);          // geese cruise at about 20 m/s
    if (flock.userData.live) for (const o of flock.children) if (o.visible && o.getWorldPosition(_bp).distanceTo(AC.pos) < 9) o.visible = false;
  });
  return flock;
}
/** place the flock on the airplane's path: a skein of geese flying head-on toward the airplane, spread across the
 *  windscreen and the engines, so they grow out of the haze and flash past at the strike (closing speed ~130 m/s) */
export function placeFlock(tStrike = 0) {
  if (!AC.flock) return;
  const s = sampleReal(tStrike + 0.15, {pos: V()});
  const hd = s.hdg * Math.PI / 180, fwd = V(Math.sin(hd), 0, -Math.cos(hd)), right = V(-fwd.z, 0, fwd.x);
  const dir = fwd.clone().negate().addScaledVector(right, 0.12).normalize();          // toward the airplane, a little across
  const lead = 6;                                                                    // seconds before the strike
  AC.flock.userData.vel = dir.clone().multiplyScalar(20);
  AC.flock.position.copy(s.pos).add(V(0, 1.2, 0)).addScaledVector(dir, -20 * lead);
  AC.flock.rotation.set(0, Math.atan2(dir.x, dir.z), 0); AC.flock.visible = true;
  // a loose V whose arms straddle the nose: the leader just above the cockpit, the others back along both arms
  AC.flock.children.forEach((o, i) => {
    const arm = i % 2 ? 1 : -1, k = Math.floor((i + 1) / 2);
    o.position.set(arm * k * 1.35 + (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 2.2 - k * 0.12, -k * 2.1 + (Math.random() - 0.5) * 1.2);
    o.rotation.set((Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.2);
    o.visible = true;
  });
  AC.flock.userData.live = true;
}

const comp = (a, v, k) => k === 0 ? a.getX(v) : k === 1 ? a.getY(v) : k === 2 ? a.getZ(v) : a.getW(v);
/** Canada goose colours painted into the swan's vertices by the bones that move them */
function gooseColours(sk) {
  const geo = sk.geometry, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, pos = geo.attributes.position;
  const bones = sk.skeleton.bones.map(b => b.name);
  const C = (h) => new THREE.Color(h);
  const tone = bones.map(n => /^(Neck|Head|Beak|Eye|Lower|Upper|Third|Tongue)/.test(n) ? C(0x151311) : /Tail/.test(n) ? C(0x1c1916)
    : /Pimary|Alula|Phalanx|Metacarpus/.test(n) ? C(0x3f362e) : /Secondary|Tertial|Covert|Ulna|Humerus|Scapular/.test(n) ? C(0x6a5b4b)
    : /Femur|Tibia|Tarsus|Digit/.test(n) ? C(0x2a2622) : C(0x7d6d5b));
  const isHead = bones.map(n => /^(Head|Beak|Eye|Lower|Upper|Third)/.test(n));
  geo.computeBoundingBox(); const bb = geo.boundingBox, midY = (bb.min.y + bb.max.y) / 2;
  const col = new Float32Array(pos.count * 3), c = new THREE.Color(), t = new THREE.Color();
  for (let v = 0; v < pos.count; v++) {
    c.setRGB(0, 0, 0); let head = 0;
    for (let k = 0; k < 4; k++) { const w = comp(sw, v, k); if (!w) continue; const j = comp(si, v, k); t.copy(tone[j] || tone[0]); c.r += t.r * w; c.g += t.g * w; c.b += t.b * w; if (isHead[j]) head += w; }
    const y = pos.getY(v);
    if (head < 0.3 && y < midY) c.lerp(C(0xb9ad9a), 0.55);                       // pale breast and belly
    if (head > 0.6 && pos.getY(v) < midY + (bb.max.y - midY) * 0.2 && (v % 3 === 0)) c.lerp(C(0xe8e4dc), 0.6);   // the white chin strap
    col[v * 3] = c.r; col[v * 3 + 1] = c.g; col[v * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  sk.material = new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.92, metalness: 0, side: THREE.DoubleSide});
}
