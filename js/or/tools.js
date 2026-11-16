// Surgical instruments (built in code, real sizes in metres), the pointer that drives them, and Rania's tray.
// Every instrument is modelled with its working tip at the local origin and the handle along local +Y, so it can
// be posed from "where is the tip" + "which way does the handle point". The gloved hands follow the handle.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {camera, onUpdate, damp} from '../core/engine.js';
import {reach, HANDS} from './hands.js';
import {OR} from './room.js';
import {click as clickSnd} from './sound.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const steel = new THREE.MeshStandardMaterial({color: 0xe4e8ea, roughness: 0.24, metalness: 0.78});
const darkSteel = new THREE.MeshStandardMaterial({color: 0xa9b1b5, roughness: 0.32, metalness: 0.75});
const plastic = (c, r = 0.45) => new THREE.MeshStandardMaterial({color: c, roughness: r});
const clear = new THREE.MeshPhysicalMaterial({color: 0xe8f4f8, roughness: 0.05, transparent: true, opacity: 0.28, depthWrite: false});
function mesh(geo, mat, x = 0, y = 0, z = 0, parent) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent && parent.add(m); return m; }
const cyl = (r1, r2, h, mat, y, parent, x = 0, z = 0, seg = 16) => mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat, x, y + h / 2, z, parent);
const box = (w, h, d, mat, x, y, z, parent) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, parent);
function tube(pts, r, mat, parent, seg = 40) { return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => V3(...p))), seg, r, 8, false), mat, 0, 0, 0, parent); }

// ---------------------------------------------------------------- the instruments
function marker() {
  const g = new THREE.Group();
  mesh(new THREE.ConeGeometry(0.0022, 0.009, 12), plastic(0x3a1a5e, 0.6), 0, 0.0045, 0, g).rotation.x = Math.PI;
  cyl(0.0042, 0.0058, 0.012, plastic(0xe9e6ef), 0.008, g);
  cyl(0.0058, 0.0058, 0.105, plastic(0x6b3fa0, 0.35), 0.02, g);
  cyl(0.0062, 0.0062, 0.03, plastic(0xf2f2f2, 0.4), 0.125, g);
  return g;
}
function scalpel() {
  const g = new THREE.Group();
  // #10 blade: straight back, curved belly, the cutting point at the origin
  const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(0.0105, 0.004, 0.0095, 0.028); s.lineTo(0.0045, 0.04); s.lineTo(0.0, 0.04); s.lineTo(-0.0005, 0.012); s.closePath();
  const bl = mesh(new THREE.ExtrudeGeometry(s, {depth: 0.0004, bevelEnabled: false}), new THREE.MeshStandardMaterial({color: 0xe9eef0, roughness: 0.1, metalness: 1}), -0.004, 0, -0.0002, g);
  // #3 handle with its grip grooves
  box(0.0085, 0.125, 0.0028, steel, 0.0005, 0.04 + 0.0625, 0, g);
  for (let i = 0; i < 9; i++) box(0.0088, 0.0012, 0.0031, darkSteel, 0.0005, 0.11 + i * 0.004, 0, g);
  return g;
}
function cautery() {
  const g = new THREE.Group();
  box(0.0024, 0.014, 0.0006, steel, 0, 0.007, 0, g);
  cyl(0.0035, 0.005, 0.012, plastic(0x2a2d30), 0.012, g);
  cyl(0.0052, 0.0052, 0.12, plastic(0x2f78b8, 0.4), 0.024, g);
  box(0.004, 0.009, 0.004, plastic(0xf2c230), 0, 0.05, 0.0045, g); box(0.004, 0.009, 0.004, plastic(0x3a7fd1), 0, 0.064, 0.0045, g);
  tube([[0, 0.144, 0], [0, 0.18, 0.01], [0.02, 0.24, 0.05], [0.08, 0.3, 0.12]], 0.0022, plastic(0x3c4044), g);
  return g;
}
function saw() {
  const g = new THREE.Group();
  // the foot (guard) that slides under the sternum, and the blade just above it
  const foot = new THREE.Shape(); foot.moveTo(0, 0); foot.lineTo(0.022, 0); foot.quadraticCurveTo(0.03, 0.002, 0.028, 0.008); foot.lineTo(0.004, 0.012); foot.lineTo(0, 0.03); foot.lineTo(-0.004, 0.03); foot.closePath();
  mesh(new THREE.ExtrudeGeometry(foot, {depth: 0.003, bevelEnabled: false}), darkSteel, 0, 0, -0.0015, g).rotation.y = -Math.PI / 2;
  g.userData.blade = box(0.001, 0.032, 0.012, steel, 0, 0.018, -0.008, g);
  box(0.028, 0.05, 0.032, plastic(0xd9d4c4, 0.35), 0, 0.052, -0.02, g);           // head
  cyl(0.017, 0.019, 0.12, plastic(0xd9d4c4, 0.35), 0.075, g, 0, -0.02);              // grip
  box(0.01, 0.03, 0.014, plastic(0x2b2f33), 0, 0.1, 0.0, g);                         // trigger
  tube([[0, 0.195, -0.02], [0, 0.24, -0.03], [0.05, 0.3, 0.02]], 0.004, plastic(0x30343a), g);
  return g;
}
function probe() {
  const g = new THREE.Group();
  box(0.026, 0.012, 0.011, plastic(0x2d3236, 0.4), 0, 0.006, 0, g);
  cyl(0.006, 0.006, 0.09, plastic(0x2d3236, 0.4), 0.012, g);
  mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.16, 16, 1, true), clear, 0, 0.08, 0, g);   // sterile sleeve
  tube([[0, 0.1, 0], [0, 0.16, 0.01], [0.04, 0.24, 0.06]], 0.0025, plastic(0x3c4044), g);
  return g;
}
function cannula(r, col) {
  const g = new THREE.Group();
  tube([[0, 0, 0], [0.004, 0.006, 0], [0.008, 0.018, 0], [0.008, 0.06, 0], [0.008, 0.14, 0]], r, new THREE.MeshPhysicalMaterial({color: col, roughness: 0.2, clearcoat: 1, transparent: true, opacity: 0.85}), g);
  cyl(r * 2.2, r * 2.2, 0.004, plastic(0x2a6fb0), 0.03, g, 0.008);
  return g;
}
function clamp() {
  const g = new THREE.Group();
  // two long jaws closed across the aorta (along local X), shanks rising to ring handles
  for (const s of [-1, 1]) box(0.075, 0.0035, 0.003, darkSteel, 0.0, 0.0, s * 0.0022, g);
  tube([[0.037, 0, 0], [0.05, 0.03, 0], [0.055, 0.09, 0], [0.06, 0.16, 0]], 0.0028, steel, g);
  tube([[0.037, 0, 0.003], [0.05, 0.03, 0.006], [0.055, 0.09, 0.012], [0.06, 0.16, 0.016]], 0.0028, steel, g);
  for (const z of [0, 0.016]) { const r = mesh(new THREE.TorusGeometry(0.011, 0.0022, 8, 20), steel, 0.065, 0.172, z, g); r.rotation.y = Math.PI / 2; }
  box(0.004, 0.012, 0.018, darkSteel, 0.058, 0.13, 0.008, g);                       // ratchet
  return g;
}
function needleDriver() {
  const g = new THREE.Group();
  // curved needle held at the tip, its blue 7-0 thread
  const nd = mesh(new THREE.TorusGeometry(0.004, 0.00035, 6, 16, Math.PI * 1.1), steel, 0, -0.002, 0, g); nd.rotation.y = Math.PI / 2;
  tube([[0, -0.006, 0], [0.004, -0.012, 0.01], [0.02, -0.01, 0.03], [0.05, 0.02, 0.05]], 0.0003, plastic(0x2047a8, 0.5), g, 24);
  box(0.0018, 0.012, 0.0014, darkSteel, 0, 0.006, 0, g);
  for (const s of [-1, 1]) tube([[0, 0.012, 0], [s * 0.0015, 0.06, 0], [s * 0.004, 0.13, 0], [s * 0.0055, 0.16, 0]], 0.0013, steel, g, 16);
  return g;
}
function forceps() {
  const g = new THREE.Group();
  for (const s of [-1, 1]) tube([[s * 0.0006, 0, 0], [s * 0.002, 0.03, 0], [s * 0.005, 0.1, 0], [s * 0.0035, 0.16, 0]], 0.0016, steel, g, 16);
  return g;
}
function paddle() {
  const g = new THREE.Group();
  const d = mesh(new THREE.SphereGeometry(0.026, 24, 10, 0, Math.PI * 2, 0, 0.6), plastic(0xbfc6ca, 0.25), 0, 0.012, 0, g); d.scale.set(1, 0.5, 1);
  mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.003, 24), darkSteel, 0, 0.003, 0, g);
  cyl(0.004, 0.004, 0.18, steel, 0.012, g);
  cyl(0.011, 0.012, 0.11, plastic(0xe6e2d8, 0.4), 0.19, g);
  tube([[0, 0.3, 0], [0, 0.34, 0.02], [0.06, 0.4, 0.08]], 0.003, plastic(0xc0392b, 0.5), g);
  return g;
}
function flowProbe() {
  const g = new THREE.Group();
  // transit-time probe: a small U that sits around the graft
  for (const s of [-1, 1]) box(0.003, 0.012, 0.008, plastic(0x8fd0e8, 0.3), s * 0.004, 0.006, 0, g);
  box(0.011, 0.004, 0.008, plastic(0x8fd0e8, 0.3), 0, 0.013, 0, g);
  cyl(0.0035, 0.0035, 0.09, plastic(0x2d3236), 0.015, g);
  tube([[0, 0.1, 0], [0, 0.15, 0.01], [0.04, 0.22, 0.05]], 0.002, plastic(0x3c4044), g);
  return g;
}
function suction() {
  const g = new THREE.Group();
  mesh(new THREE.SphereGeometry(0.0055, 14, 10), new THREE.MeshPhysicalMaterial({color: 0xf2f5f6, roughness: 0.15, transparent: true, opacity: 0.7}), 0, 0.004, 0, g);
  tube([[0, 0.004, 0], [0.004, 0.03, 0], [0.012, 0.08, 0], [0.014, 0.19, 0]], 0.0045, new THREE.MeshPhysicalMaterial({color: 0xf2f5f6, roughness: 0.1, transparent: true, opacity: 0.55}), g);
  tube([[0.014, 0.19, 0], [0.016, 0.24, 0.02], [0.06, 0.3, 0.08]], 0.004, plastic(0xdfe6e8, 0.3), g);
  g.userData.blood = tube([[0, 0.004, 0], [0.004, 0.03, 0], [0.012, 0.08, 0], [0.014, 0.19, 0]], 0.0028, plastic(0x6a0a0e, 0.2), g);
  g.userData.blood.visible = false;
  return g;
}
function gauze() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#f4f2ec'; x.fillRect(0, 0, 128, 128); x.strokeStyle = 'rgba(0,0,0,.08)'; for (let i = 0; i < 128; i += 4) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(128, i); x.stroke(); }
  x.fillStyle = '#2d6fb0'; x.fillRect(56, 0, 9, 128);
  x.fillStyle = 'rgba(140,20,20,.55)'; x.beginPath(); x.ellipse(40, 80, 34, 24, 0.4, 0, 7); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.PlaneGeometry(0.07, 0.07, 6, 6); const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, (Math.random() - 0.5) * 0.006); geo.computeVertexNormals();
  return mesh(geo, new THREE.MeshStandardMaterial({map: t, roughness: 0.95, side: THREE.DoubleSide}));
}

/** id → {name, make, dir (handle direction from the tip, world), grip (m from the tip along the handle), roll, icon} */
export const KIT = {
  marker:   {name: 'قلم التحديد', make: marker, grip: 0.11, dir: [0.7, 0.6, 0.4], icon: 'M6 18 L18 6 M15 5 l4 4'},
  scalpel:  {name: 'المشرط', make: scalpel, grip: 0.13, dir: [0.82, 0.45, 0.36], icon: 'M4 18 Q8 12 12 12 L20 6 M12 12 l2 2'},
  cautery:  {name: 'الكيّ', make: cautery, grip: 0.12, dir: [0.7, 0.6, 0.4], icon: 'M5 19 L17 7 M17 7 l3 -3 M9 15 l2 2'},
  saw:      {name: 'منشار القص', make: saw, grip: 0.16, dir: [0.0, 0.92, 0.38], icon: 'M6 20 V10 h6 v-6 h4 v6 M6 14 h6'},
  probe:    {name: 'مسبار الموجات', make: probe, grip: 0.12, dir: [0.82, 0.52, 0.22], icon: 'M8 18 h8 M12 18 V6 M9 6 h6'},
  cannulaA: {name: 'القنية الشريانية', make: () => cannula(0.0035, 0xd8e8ee), grip: 0.13, dir: [0.8, 0.55, 0.22], icon: 'M6 18 Q8 10 14 8 L20 4'},
  cannulaV: {name: 'القنية الوريدية', make: () => cannula(0.0075, 0xd8e8ee), grip: 0.13, dir: [0.8, 0.55, 0.25], icon: 'M5 19 Q8 10 14 8 L20 5'},
  clamp:    {name: 'الملقط', make: clamp, grip: 0.21, dir: [0.8, 0.5, 0.33], icon: 'M4 12 h10 M14 12 l4 -4 M14 12 l4 4 M18 8 a2 2 0 1 1 0.1 0 M18 16 a2 2 0 1 1 0.1 0'},
  needle:   {name: 'حامل الإبرة', make: needleDriver, grip: 0.19, dir: [0.75, 0.55, 0.36], icon: 'M5 19 L16 8 M16 8 a3 3 0 1 1 3 -3'},
  paddles:  {name: 'المجاديف الداخلية', make: paddle, grip: 0.3, dir: [0.5, 0.8, 0.3], icon: 'M7 20 V9 M7 9 a3 3 0 1 1 0.1 0 M17 20 V9 M17 9 a3 3 0 1 1 0.1 0'},
  flow:     {name: 'مسبار التدفق', make: flowProbe, grip: 0.12, dir: [0.82, 0.52, 0.22], icon: 'M9 6 v6 h6 v-6 M12 12 V20'},
  suction:  {name: 'الشفّاط', make: suction, grip: 0.17, dir: [0.8, 0.55, 0.25], icon: 'M6 18 Q10 8 18 6 M6 18 a1.5 1.5 0 1 1 0.1 0'},
  retractor:{name: 'المُبعِد', make: () => new THREE.Group(), grip: 0.07, dir: [0.0, 1, 0.2], icon: 'M4 8 h16 M7 8 v9 M17 8 v9 M20 8 a2 2 0 1 1 0.1 0'},
  wire:     {name: 'أسلاك القص', make: needleDriver, grip: 0.19, dir: [0.75, 0.55, 0.36], icon: 'M5 12 c3 -6 11 -6 14 0 c-3 6 -11 6 -14 0'},
};
// ---------------------------------------------------------------- real instrument models (Sketchfab, CC BY 4.0)
const LOADED = {};
/** bake a model's meshes so the working tip sits at the origin and the handle runs along +Y, at a real length (m) */
function bakeInstrument(scene, re, {axis, tip, length, roll = 0}) {
  scene.updateMatrixWorld(true);
  const parts = []; scene.traverse(o => { if (o.isMesh && (!re || re.test(o.name) || re.test(o.parent && o.parent.name || ''))) parts.push(o); });
  if (!parts.length) return null;
  const box = new THREE.Box3(); for (const m of parts) box.expandByObject(m);
  const k = length / box.getSize(V3())[axis];
  const tipPt = box.getCenter(V3()); tipPt[axis] = tip > 0 ? box.max[axis] : box.min[axis];
  const handleDir = V3(); handleDir[axis] = -tip;
  const q = new THREE.Quaternion().setFromUnitVectors(handleDir, V3(0, 1, 0)).premultiply(new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), roll));
  const g = new THREE.Group();
  for (const m of parts) {
    const geo = m.geometry.clone().applyMatrix4(m.matrixWorld); geo.translate(-tipPt.x, -tipPt.y, -tipPt.z); geo.applyQuaternion(q); geo.scale(k, k, k);
    const mat = [].concat(m.material).map(x => { const c = x.clone(); c.envMapIntensity = 1.1; return c; });
    const mesh = new THREE.Mesh(geo, mat.length > 1 ? mat : mat[0]); mesh.castShadow = true; g.add(mesh);
  }
  return g;
}
/** load the real instruments before buildTools (falls back to the built-in ones if a file is missing) */
export async function loadInstrumentModels() {
  const loader = new GLTFLoader();
  const get = (s) => loader.loadAsync(`assets/or_models/${s}/model.gltf`).then(g => g.scene).catch(e => { console.warn('instrument', s, e); return null; });
  const [sc, nh, bi, rt] = await Promise.all(['scalpels', 'needleholder', 'basic_instr', 'retractor_hand'].map(get));
  if (sc) LOADED.scalpel = bakeInstrument(sc, /^Object_4$|SM_Scalpel_low_2/, {axis: 'z', tip: 1, length: 0.16});
  if (nh) LOADED.needle = bakeInstrument(nh, null, {axis: 'x', tip: -1, length: 0.17});
  if (bi) { LOADED.forceps = bakeInstrument(bi, /pinza/, {axis: 'y', tip: -1, length: 0.16}); LOADED.clamp = bakeInstrument(bi, /forceps left/, {axis: 'y', tip: 1, length: 0.18}); }
  if (rt) LOADED.retractor_hand = bakeInstrument(rt, null, {axis: 'y', tip: 1, length: 0.24});
  // the needle holder carries a curved needle with its blue 7-0 thread
  if (LOADED.needle) { const nd = mesh(new THREE.TorusGeometry(0.004, 0.00035, 6, 16, Math.PI * 1.1), steel, 0, -0.002, 0, LOADED.needle); nd.rotation.y = Math.PI / 2; tube([[0, -0.006, 0], [0.004, -0.012, 0.01], [0.02, -0.01, 0.03], [0.05, 0.02, 0.05]], 0.0003, plastic(0x2047a8, 0.5), LOADED.needle, 24); }
  return LOADED;
}
const realOr = (id, make) => () => LOADED[id] ? LOADED[id].clone() : make();
export const T = {held: null, mesh: null, tip: V3(), dir: V3(0, 1, 0), lift: 0.012, contact: 0, left: null, leftTip: V3(), leftDir: V3(0, 1, 0), meshes: {}, steady: null, hide: false};
let parentGroup = null;
export function buildTools(parent) {
  parentGroup = parent;
  for (const id in KIT) { const m = realOr(id, KIT[id].make)(); m.visible = false; m.traverse(o => { if (o.isMesh) o.castShadow = true; }); parent.add(m); T.meshes[id] = m; }
  T.meshes.forceps = realOr('forceps', forceps)(); T.meshes.forceps.visible = false; parent.add(T.meshes.forceps);
  T.meshes.paddleL = paddle(); T.meshes.paddleL.visible = false; parent.add(T.meshes.paddleL);
  T.gauze = gauze(); T.gauze.visible = false; parent.add(T.gauze);
  return T;
}
export const makeKit = (id) => realOr(id, KIT[id].make)();        // a separate copy left in the field (cannulas, clamp)

// ---------------------------------------------------------------- pointer → world
export const ptr = {ndc: new THREE.Vector2(0, 0), x: 0, y: 0, down: false, pressed: false, released: false, moved: false, active: false};
const ray = new THREE.Raycaster();
{
  const cv = document.getElementById('gl');
  const setXY = (e) => { ptr.x = e.clientX; ptr.y = e.clientY; ptr.ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ptr.moved = true; };
  cv.addEventListener('pointermove', setXY);
  cv.addEventListener('pointerdown', (e) => { setXY(e); ptr.down = true; ptr.pressed = true; try { cv.setPointerCapture(e.pointerId); } catch (er) {} });
  addEventListener('pointerup', () => { if (ptr.down) ptr.released = true; ptr.down = false; });
  cv.style.touchAction = 'none';
}
/** call once per frame after reading pressed/released */
export function ptrFrame() { ptr.pressed = false; ptr.released = false; ptr.moved = false; }
export function rayFrom() { ray.setFromCamera(ptr.ndc, camera); return ray; }
/** pointer on a horizontal plane at height y */
export function onPlane(y, out = V3()) {
  rayFrom(); const r = ray.ray; if (Math.abs(r.direction.y) < 1e-4) return null;
  const t = (y - r.origin.y) / r.direction.y; if (t < 0) return null;
  return out.copy(r.origin).addScaledVector(r.direction, t);
}
export function pick(objects) { rayFrom(); const h = ray.intersectObjects(objects, true); return h[0] || null; }
/** screen position (px) of a world point */
export function toScreen(p) { const v = p.clone().project(camera); return {x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, behind: v.z > 1}; }

// ---------------------------------------------------------------- holding
const _m = new THREE.Matrix4(), _x = V3(), _z = V3(), _g = V3();
function pose(obj, tip, dir, roll = 0) {
  const y = dir.clone().normalize();
  _z.set(0, 0, 1); if (Math.abs(y.z) > 0.9) _z.set(1, 0, 0);
  _x.crossVectors(y, _z).normalize(); _z.crossVectors(_x, y).normalize();
  _m.makeBasis(_x, y, _z); obj.quaternion.setFromRotationMatrix(_m); if (roll) obj.rotateY(roll);
  obj.position.copy(tip);
}
let flying = null;
const PALM_R = V3(-0.55, -0.75, -0.2).normalize(), PALM_L = V3(0.55, -0.75, -0.2).normalize(), DOWN = V3(0, -1, 0), STEADY_F = V3(0.35, -0.3, -1).normalize();
/** take an instrument into the right hand (it travels from the Mayo tray) */
export function take(id, {fly = true} = {}) {
  if (T.held === id) return;
  if (T.mesh) T.mesh.visible = false;
  T.held = id; T.mesh = T.meshes[id]; T.mesh.visible = true; T.hide = false;
  T.dir.set(...KIT[id].dir).normalize();
  if (fly && OR.mayo) flying = {t: 0, from: OR.mayo.clone().add(V3(0, 0.05, 0))};
  document.querySelectorAll('#tray .tl').forEach(b => b.classList.toggle('held', b.dataset.id === id));
  clickSnd();
}
export function putDown() { if (T.mesh) T.mesh.visible = false; T.held = null; T.mesh = null; T.steady = null; document.querySelectorAll('#tray .tl').forEach(b => b.classList.remove('held')); }
/** left hand: steady the field at a point, or hold a second instrument */
export function leftHold(id) { if (T.left && T.meshes[T.left]) T.meshes[T.left].visible = false; T.left = id; if (id && T.meshes[id]) T.meshes[id].visible = true; }

onUpdate((dt) => {
  if (T.mesh) {
    let tip = T.tip;
    if (flying) { flying.t += dt / 0.45; const k = Math.min(1, flying.t); const e = 1 - Math.pow(1 - k, 3); tip = _g.lerpVectors(flying.from, T.tip, e).add(V3(0, Math.sin(k * Math.PI) * 0.06, 0)); if (k >= 1) flying = null; }
    const lifted = tip.clone().addScaledVector(V3(0, 1, 0), T.lift * (1 - T.contact));
    pose(T.mesh, lifted, T.dir, KIT[T.held] && KIT[T.held].roll || 0);
    T.mesh.visible = !T.hide;
    const grip = lifted.clone().addScaledVector(T.dir, KIT[T.held] ? KIT[T.held].grip : 0.12).add(V3(0, 0.012, 0));   // the wrist sits behind the grip
    reach('R', grip, T.hide ? 0 : 1, 0.6);
    HANDS.R.fdir = T.dir.clone().negate().add(V3(0, -0.25, 0)).normalize(); HANDS.R.palm = PALM_R;
    HANDS.grip = damp(HANDS.grip, 1, 6, dt);
  } else { reach('R', T.rest || OR.restR || T.tip, T.restW ?? 0, 0.2); HANDS.grip = damp(HANDS.grip, 0.35, 4, dt); }
  // left hand: second instrument, or flat on the drape beside the field
  if (T.left && T.meshes[T.left]) {
    const lm = T.meshes[T.left]; pose(lm, T.leftTip, T.leftDir); lm.visible = true;
    reach('L', T.leftTip.clone().addScaledVector(T.leftDir, T.left === 'forceps' ? 0.17 : 0.3).add(V3(0, 0.012, 0)), 1, 0.6);
    HANDS.L.fdir = T.leftDir.clone().negate().add(V3(0, -0.25, 0)).normalize(); HANDS.L.palm = PALM_L; HANDS.gripL = 1;
  } else if (T.steady) { reach('L', T.steady, 1, 0.25); HANDS.L.fdir = STEADY_F; HANDS.L.palm = DOWN; HANDS.gripL = damp(HANDS.gripL, 0.15, 4, dt); }
  else reach('L', T.restL || T.tip, T.restLW ?? 0, 0.2);
});
export {pose};

// ---------------------------------------------------------------- the tray (bottom of the screen)
const $ = (id) => document.getElementById(id);
let trayResolve = null;
/** show the tray with these instruments; `want` glows. Returns a promise resolved with the id the player picks. */
export function tray(ids, want = null, {label = 'صينية رانيا'} = {}) {
  const el = $('tray'); el.innerHTML = `<span class="lbl">${label}</span>`;
  for (const id of ids) {
    const k = KIT[id] || {name: id, icon: ''};
    const b = document.createElement('button'); b.className = 'tl' + (id === want ? ' want' : '') + (id === T.held ? ' held' : ''); b.dataset.id = id;
    b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${k.icon}"/></svg><span>${k.name}</span>`;
    b.onclick = () => { if (trayResolve) { const r = trayResolve; trayResolve = null; r(id); } };
    el.appendChild(b);
  }
  el.classList.remove('hidden');
  return new Promise(r => { trayResolve = r; });
}
export function trayHide() { $('tray').classList.add('hidden'); trayResolve = null; }
/** wait until the player picks `id` from the tray (other picks are handed over too, with Rania's look) */
export async function pickTool(ids, want) {
  for (;;) { const id = await tray(ids, want); take(id); if (id === want) return id; }
}
