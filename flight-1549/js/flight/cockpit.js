// The A320 flight deck seen from the captain's (left) seat: the cockpit model ("Cockpit", Sketchfab, CC BY), live
// displays drawn every few frames (primary flight display, navigation display with the reach of the glide, engine/warning
// display showing the rollback after the strike), soft daylight with the sun moving across the panel as the airplane
// turns, and free head movement (drag to look around, like turning your head in the seat).
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {camera, onUpdate, scene} from '../core/engine.js';
import {AC, AIRPORTS, reach} from './aircraft.js';
import {FLY} from './fly.js';
import {W} from './world.js';
import {Character, loadAnimLib} from '../actors/character.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const D2R = Math.PI / 180;
export const CK = {group: new THREE.Group(), head: {yaw: 0, pitch: -0.08, ty: 0, tp: -0.08}, eng: [1, 1], warn: [], screens: {}, on: true};
// "A320 Cockpit 2" (Sketchfab, CC BY): a whole A320 at 1:4.126 scale with a detailed flight deck; tools extract the deck
// and the nose skin (assets/flight_models/cockpit320). In its scene units the nose is at z = 0, forward is −z, the
// captain sits at −x. We scale it to metres and turn it to our cockpit frame (+x left, +y up, +z forward, eye at 0).
const MODEL_SCALE = 37.57 / 9.105;              // the airplane is 9.105 scene units long; an A320 is 37.57 m
const EYE = V(-0.13, 0.212, 0.655);             // the captain's eye in scene units

export async function buildCockpit() {
  AC.group.add(CK.group);
  // (meshopt-compressed: 447k → 322k triangles within ~1.5 mm, 20 MB → 5.5 MB; tools/slim_model.mjs)
  const g = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('assets/flight_models/cockpit320/model.gltf');
  const root = g.scene; root.scale.setScalar(MODEL_SCALE); root.rotation.y = Math.PI;
  root.position.set(EYE.x * MODEL_SCALE, -EYE.y * MODEL_SCALE, EYE.z * MODEL_SCALE);   // −(R·S·eye) with R = 180° about y
  CK.group.add(root); CK.model = root;
  root.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    const m = o.material;
    if (m && m.transparent) {                     // the windscreen and side windows: clear glass with a faint reflection
      o.material = new THREE.MeshBasicMaterial({color: 0xcfdde6, transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide, toneMapped: false});   // unlit: no NaN from degenerate glass facets
      o.renderOrder = 5; o.castShadow = false; CK.glass = (CK.glass || []).concat(o);
    } else if (m && m.isMeshStandardMaterial) { m.envMapIntensity = 0.5; if (!m.map) { m.roughness = Math.max(m.roughness, 0.55); m.metalness = Math.min(m.metalness, 0.2); } }
    // the floor plate the model sits on is not part of the airplane
    o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox; if (b.max.x - b.min.x > 5 && b.max.y - b.min.y < 0.2) o.visible = false;
  });
  // interior light: daylight from the windows and a little panel flood
  const fill = new THREE.PointLight(0xdfe8f2, 1.2, 4, 1.6); fill.position.set(0, 0.25, 0.25); CK.group.add(fill);
  const flood = new THREE.PointLight(0xffe6c8, 0.5, 2.5, 2); flood.position.set(-0.25, -0.2, 0.55); CK.group.add(flood);
  // the sun's shadow inside the cockpit only (frame bars and the glareshield cast moving shadows on the panel)
  const sun = new THREE.DirectionalLight(0xfff0dc, 3.2); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -2.2; sc.right = 2.2; sc.top = 2.2; sc.bottom = -2.2; sc.near = 0.1; sc.far = 12; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
  scene.add(sun); scene.add(sun.target); CK.sun = sun;
  buildScreens(root);
  // camera in the seat
  camera.near = 0.03; camera.far = 120000; camera.fov = 62; camera.updateProjectionMatrix();
  bindLook();
  onUpdate((dt) => {
    // keep the sun's shadow box on the cockpit
    CK.group.getWorldPosition(sun.target.position); sun.position.copy(sun.target.position).addScaledVector(W.sunDir, 6);
    sun.target.updateMatrixWorld();
    const h = CK.head;
    // the view always comes home to the windscreen: after a look at a control (or the river), once its time is up, and a
    // little while after the player stops dragging; never left pointing somewhere else
    if (CK.autoHome && !CK.dragging && performance.now() > (CK.lookUntil || 0)) { h.ty = HOME[0]; h.tp = HOME[1]; }
    // an unhurried turn of the head (it snapped across before), easing in and out
    const k = Math.min(1, dt * 3.2); h.yaw += (h.ty - h.yaw) * k; h.pitch += (h.tp - h.pitch) * k;
    if (CK.on) {
      // small vibration (stronger with the damaged engine rumbling), and the head leaning a little in turns
      const rumble = CK.rumble || 0, t = performance.now() / 1000;
      // a gentle buzz in normal flight, a firmer one with the damaged engine or the impact (lower, smoother frequencies)
      const shake = 0.00015 + Math.min(rumble, 2.5) * 0.0011;
      camera.position.set((Math.sin(t * 13) + 0.5 * Math.sin(t * 7.3)) * shake, (Math.sin(t * 11 + 1) + 0.5 * Math.sin(t * 5.9)) * shake, 0);
      camera.rotation.set(h.pitch + Math.sin(t * 9) * shake * 0.25, Math.PI + h.yaw, -AC.bank * D2R * 0.035, 'YXZ');   // the camera looks down its −z; the cockpit faces +z
      const fv = CK.fovT || 62; if (Math.abs(camera.fov - fv) > 0.05) { camera.fov += (fv - camera.fov) * Math.min(1, dt * 5); camera.updateProjectionMatrix(); }
    }
  });
  let acc = 0; onUpdate((dt) => { acc += dt; if (acc > 1 / 20) { acc = 0; drawScreens(); } });
  return CK;
}
/** first-person view in the seat (camera inside the airplane) */
export function seat(on = true) {
  CK.on = on;
  if (on) { CK.group.add(camera); camera.fov = 62; camera.updateProjectionMatrix(); }
  else if (camera.parent === CK.group) { scene.add(camera); }
}
const HOME = [0, -0.08];
function bindLook() {
  // drag to look around: only a real drag turns the head (a click on a control that moves a few pixels does not), at a
  // gentle rate; on release the view stays a moment, then returns to the windscreen
  let drag = null;
  const el = document.getElementById('gl');
  el.addEventListener('pointerdown', (e) => { drag = {x: e.clientX, y: e.clientY, yaw: CK.head.ty, pitch: CK.head.tp, live: false}; });
  addEventListener('pointerup', () => { if (drag && drag.live) CK.lookUntil = performance.now() + 2500; drag = null; CK.dragging = false; });
  addEventListener('pointermove', (e) => {
    if (!drag || !CK.on) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.live && Math.hypot(dx, dy) < 12) return;
    drag.live = true; CK.dragging = true;
    CK.head.ty = Math.max(-1.6, Math.min(1.3, drag.yaw - dx * 0.0025));
    CK.head.tp = Math.max(-0.8, Math.min(0.5, drag.pitch - dy * 0.0025));
  });
  el.addEventListener('dblclick', () => { CK.head.ty = HOME[0]; CK.head.tp = HOME[1]; CK.lookUntil = 0; });
}
/** look at something in the cockpit or outside (yaw: + left, pitch: + up), e.g. the river on the left, for `hold` ms;
 *  then the view goes back to the windscreen by itself */
export function lookTo(yaw, pitch, hold = 4000) { CK.head.ty = yaw; CK.head.tp = pitch; CK.lookUntil = performance.now() + hold; }
/** straight back to the windscreen */
export function lookHome() { CK.lookUntil = 0; CK.head.ty = HOME[0]; CK.head.tp = HOME[1]; }

// ---------------------------------------------------------------- displays
function screen(name, w, h, px = 512) {
  const c = document.createElement('canvas'); c.width = px; c.height = Math.round(px * h / w);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({map: t, toneMapped: false}));
  CK.screens[name] = {c, g: c.getContext('2d'), t, m};
  return m;
}
function buildScreens(root) {
  // our displays go on the deck's own display units (measured on the model, in the cockpit frame): the captain's PFD and
  // ND, the engine/warning display in the centre; the first officer's PFD and ND repeat them (same pictures, mirrored seat)
  const n = V(0, 0.29, -0.96).normalize();
  const put = (m, x, y, z) => { m.position.set(x, y, z).addScaledVector(n, 0.004); m.lookAt(m.position.clone().add(n)); CK.group.add(m); return m; };
  put(screen('pfd', 0.18, 0.165), 0.018, -0.582, 1.026);
  put(screen('nd', 0.18, 0.165), -0.198, -0.58, 1.027);
  put(screen('ewd', 0.18, 0.15), -0.545, -0.532, 0.919);
  const twin = (name, x) => put(new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.165), CK.screens[name].m.material), x, -0.582, 1.026);
  twin('nd', -0.874); twin('pfd', -1.09);
}
const col = {sky: '#2c6db5', gnd: '#7a4e24', w: '#f2f2f2', g: '#2bd46b', a: '#f2a524', r: '#ff3b30', c: '#2fd3e8', m: '#e24fd4', bg: '#05080a'};
function drawScreens() {
  const S = CK.screens; if (!S.pfd) return;
  // ---- PFD
  { const {c, g, t} = S.pfd, Wd = c.width, H = c.height, cx = Wd * 0.48, cy = H * 0.47;
    g.fillStyle = col.bg; g.fillRect(0, 0, Wd, H);
    g.save(); g.beginPath(); g.rect(cx - 120, cy - 130, 240, 260); g.clip();
    g.translate(cx, cy); g.rotate(-AC.bank * D2R); const pp = AC.pitch * 6;
    g.fillStyle = col.sky; g.fillRect(-300, -600 + pp, 600, 600); g.fillStyle = col.gnd; g.fillRect(-300, pp, 600, 600);
    g.strokeStyle = col.w; g.lineWidth = 2; g.beginPath(); g.moveTo(-300, pp); g.lineTo(300, pp); g.stroke();
    g.fillStyle = col.w; g.font = '14px monospace';
    for (let a = -20; a <= 20; a += 5) { if (!a) continue; const y = pp - a * 6; g.beginPath(); g.moveTo(a % 10 ? -18 : -36, y); g.lineTo(a % 10 ? 18 : 36, y); g.stroke(); if (!(a % 10)) g.fillText(Math.abs(a), 42, y + 5); }
    g.restore();
    g.strokeStyle = '#ffdd00'; g.lineWidth = 5; g.beginPath(); g.moveTo(cx - 80, cy); g.lineTo(cx - 30, cy); g.lineTo(cx - 30, cy + 12); g.moveTo(cx + 80, cy); g.lineTo(cx + 30, cy); g.lineTo(cx + 30, cy + 12); g.stroke();
    g.fillStyle = '#ffdd00'; g.fillRect(cx - 4, cy - 4, 8, 8);
    // speed tape
    const tape = (x, val, step, px, fmt, warnLow) => { g.fillStyle = '#3a4248'; g.fillRect(x, cy - 130, 70, 260); g.save(); g.beginPath(); g.rect(x, cy - 130, 70, 260); g.clip();
      g.fillStyle = col.w; g.strokeStyle = col.w; g.font = '17px monospace';
      const base = Math.floor(val / step) * step;
      for (let k = -6; k <= 6; k++) { const v = base + k * step, y = cy - (v - val) * px; g.beginPath(); g.moveTo(x + (fmt ? 0 : 52), y); g.lineTo(x + (fmt ? 14 : 70), y); g.stroke(); if (v >= 0) g.fillText(fmt ? fmt(v) : String(v), x + (fmt ? 18 : 6), y + 6); }
      if (warnLow) { g.fillStyle = 'rgba(255,40,40,.75)'; const y = cy - (warnLow - val) * px; g.fillRect(x + 56, y, 8, 400); }
      g.restore(); g.fillStyle = '#000'; g.fillRect(x, cy - 15, 70, 30); g.strokeStyle = '#ffdd00'; g.strokeRect(x, cy - 15, 70, 30); g.fillStyle = col.g; g.font = 'bold 20px monospace'; g.fillText(fmt ? fmt(Math.round(val)) : String(Math.round(val)), x + 6, cy + 7); };
    tape(cx - 210, AC.ias, 10, 4, null, 125);
    tape(cx + 140, AC.alt / 0.3048, 100, 0.42, (v) => String(Math.round(v / 10) * 10));
    // vertical speed
    const vs = AC.vs / 0.3048 * 60; g.fillStyle = col.g; g.font = '15px monospace'; g.fillText((vs > 0 ? '+' : '') + Math.round(vs / 100) * 100, cx + 214, cy + (vs < 0 ? 40 : -30));
    // heading
    g.fillStyle = '#3a4248'; g.fillRect(cx - 120, H - 52, 240, 40); g.fillStyle = col.w; g.font = '15px monospace';
    for (let k = -3; k <= 3; k++) { const hd = Math.round(AC.hdg / 10) * 10 + k * 10, x = cx + (hd - AC.hdg) * 5.5; g.fillText(String(((hd % 360) + 360) % 360 / 10 | 0).padStart(2, '0'), x - 9, H - 26); }
    g.fillStyle = '#ffdd00'; g.fillRect(cx - 1, H - 56, 3, 14);
    // flight mode annunciator after the strike
    if (AC.t > 0) { g.fillStyle = col.a; g.font = 'bold 16px monospace'; g.fillText(FLY.on ? 'MAN' : 'F/O', cx - 120, 26); g.fillStyle = col.c; g.fillText(AC.flaps ? `F ${['0', '1', '2', '3', 'FULL'][AC.flaps]}` : 'CLEAN', cx + 60, 26);
      if (FLY.law === 'alternate') { g.fillStyle = col.a; g.fillText('ALTN LAW', cx - 40, 46); }
      // best-glide speed (green dot) and the speed the stall protection holds (amber band)
      if (FLY.stall) { g.fillStyle = col.r; g.font = 'bold 30px monospace'; g.fillText('STALL', cx - 46, cy + 70); } }
    t.needsUpdate = true; }
  // ---- ND: north-up plan of the area with the reach ring
  { const {c, g, t} = S.nd, Wd = c.width, H = c.height, cx = Wd / 2, cy = H * 0.55, sc = 0.011;   // px per m
    g.fillStyle = col.bg; g.fillRect(0, 0, Wd, H);
    g.save(); g.translate(cx, cy); g.rotate(-AC.hdg * D2R);
    const P = (p) => [(p.x - AC.pos.x) * sc, (p.z - AC.pos.z) * sc];
    // the Hudson (a few points down the river) and the track flown so far
    g.strokeStyle = 'rgba(80,140,220,.75)'; g.lineWidth = 14; g.beginPath();
    for (const [lat, lon] of [[40.905, -73.905], [40.875, -73.925], [40.85, -73.95], [40.82, -73.965], [40.79, -73.985], [40.765, -74.007], [40.74, -74.015]]) { const m = W.meta; const q = P(V((lon - m.origin[1]) * m.mlon, 0, -(lat - m.origin[0]) * m.mlat)); g.lineTo(q[0], q[1]); }
    g.stroke();
    if (AC.t > 0) {        // reach of the glide (no thrust): the green ring shrinks with the height
      const r = Math.max(0, (AC.alt - AC.RESERVE) * AC.GLIDE) * sc; g.strokeStyle = 'rgba(43,212,107,.8)'; g.lineWidth = 2; g.setLineDash([8, 6]); g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke(); g.setLineDash([]);
    }
    for (const [k, a] of Object.entries(AIRPORTS)) {
      if (k === 'HUDSON') continue;
      const q = P(a.p); const R = AC.t > 0 ? reach(AC.pos, AC.hdg, AC.alt, a.p) : {margin: 1};
      g.fillStyle = R.margin > 0 ? col.c : col.r; g.beginPath(); g.arc(q[0], q[1], 7, 0, 7); g.fill();
      g.save(); g.translate(q[0], q[1]); g.rotate(AC.hdg * D2R); g.font = 'bold 15px monospace'; g.fillText(k.startsWith('LGA') ? 'LGA' + k.slice(3) : 'TEB', 10, 5); g.restore();
    }
    g.restore();
    g.fillStyle = '#ffdd00'; g.beginPath(); g.moveTo(cx, cy - 12); g.lineTo(cx - 9, cy + 10); g.lineTo(cx + 9, cy + 10); g.fill();
    g.fillStyle = col.g; g.font = 'bold 18px monospace'; g.fillText('GS ' + Math.round(AC.gs / 0.5144), 12, 26); g.fillStyle = col.w; g.fillText('HDG ' + String(Math.round(AC.hdg)).padStart(3, '0'), Wd - 112, 26);
    t.needsUpdate = true; }
  // ---- E/WD: N1 of both engines and the warning list
  { const {c, g, t} = S.ewd, Wd = c.width, H = c.height;
    g.fillStyle = col.bg; g.fillRect(0, 0, Wd, H);
    for (const k of [0, 1]) {
      const n1 = CK.eng[k] * 84 + (1 - CK.eng[k]) * (CK.wind || 18), x = 110 + k * 200, y = 120;
      g.strokeStyle = col.w; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 70, Math.PI * 0.8, Math.PI * 2.2); g.stroke();
      const a = Math.PI * 0.8 + Math.min(1, n1 / 110) * Math.PI * 1.4; g.strokeStyle = n1 < 30 ? col.a : col.g; g.lineWidth = 5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 64, y + Math.sin(a) * 64); g.stroke();
      g.fillStyle = n1 < 30 ? col.a : col.g; g.font = 'bold 26px monospace'; g.fillText(n1.toFixed(1), x - 30, y + 48);
      g.fillStyle = col.w; g.font = '16px monospace'; g.fillText('N1 %', x - 22, y - 80 + 160);
    }
    g.font = 'bold 19px monospace'; let y = 255;
    for (const w of CK.warn) { g.fillStyle = w.c === 'r' ? col.r : w.c === 'a' ? col.a : col.c; g.fillText(w.t, 22, y); y += 26; }
    t.needsUpdate = true; }
}

// ---------------------------------------------------------------- the first officer, in the right seat
/** a pilot's white shirt: the avatar's light-blue shirt texels lose their colour */
async function whiteShirt(ch) {
  const mats = Array.isArray(ch.mesh.material) ? ch.mesh.material : [ch.mesh.material];
  const mat = mats.find(m => m.map && /body_color/.test(m.map.image?.src || m.map.source?.data?.src || '')) || mats.find(m => m.map);
  if (!mat) return;
  await new Promise(r => { const ok = () => mat.map.image && mat.map.image.width; if (ok()) return r(); const i = setInterval(() => { if (ok()) { clearInterval(i); r(); } }, 50); });
  const im = mat.map.image, c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0); const px = g.getImageData(0, 0, c.width, c.height), d = px.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], gg = d[i + 1], b = d[i + 2], mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
    if (b > r + 18 && mx > 120 && mx - mn < 110) { const l = 0.3 * r + 0.59 * gg + 0.11 * b, w = Math.min(255, l * 1.22 + 20); d[i] = w; d[i + 1] = w; d[i + 2] = Math.min(255, w + 4); }
  }
  g.putImageData(px, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.flipY = mat.map.flipY; mat.map = t; mat.needsUpdate = true;
}
export async function loadFO() {
  await loadAnimLib();
  const fo = await Character.create('fo', 'Male_Adult_08', {gender: 'm', height: 1.78, talks: true, talkAnims: []});
  CK.group.add(fo.holder);
  fo.seated = true; fo.place(-1.04, -0.05, 0, -1.22); fo.setBase('m_sit_table_idle_neutral_01', {fade: 0});
  fo.lookAt(null);
  try { await whiteShirt(fo); } catch (e) { console.warn('fo shirt', e); }
  fo.holder.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  CK.fo = fo;
  return fo;
}
