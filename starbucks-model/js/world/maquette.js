// The Al-Midan store (illustrative), life size, as the replay on the committee's hanging screen shows it — and as the
// player sees it when stepping "into" the screen. It stands apart from the committee room (60 m east, out of its
// sight) with its own daylight (lighting.js switches the light when a camera looks at it).
// Café frame: x east (−5.2…5.2), z towards the street (−3.8 back wall … 3.8 shop window), sidewalk to z 6, road beyond.
// Observed things are real (people, cups, tickets); assumptions are pale, see-through figures on the sidewalk.
import * as THREE from 'three';
import {scene, onUpdate, damp} from '../core/engine.js';
import {model} from '../core/assets.js';
import {pbr, canvasTex} from './materials.js';
import {mergeStatic} from './merge.js';

export const SCALE = 1;
export const CAFE_POS = new THREE.Vector3(60, 0, 0);
export const MQ = {root: new THREE.Group(), live: new THREE.Group(), anchors: {}, door: null};
const R = MQ.root; R.name = 'cafe';
const P = (x, y, z) => new THREE.Vector3(x, y, z);
/** a point in the café's frame → world */
export const toWorld = (x, y, z) => R.localToWorld(P(x, y, z));
export const CAFE = {x0: -5.2, x1: 5.2, z0: -3.8, z1: 3.8, walk: 6.0, h: 3.5};
/** is a world point in or around the café (its own daylight)? */
export const inCafe = (p) => p.x > CAFE_POS.x - 20;

// ---------------------------------------------------------------- where people stand (café frame, metres)
export const SPOTS = {
  register: [2.0, -0.72], cashier: [2.0, -2.35],
  barMachine: [-0.9, -2.75], barHand: [-3.35, -2.2],
  queue: [[2.0, -0.72], [2.78, -0.66], [3.52, -0.5], [4.05, 0.05], [4.2, 0.78], [4.22, 1.5], [4.22, 2.22], [4.22, 2.95]],
  pickup: [[-3.35, -0.62], [-2.62, -0.42], [-4.02, -0.28], [-3.05, 0.12], [-2.2, 0.1], [-3.75, 0.38], [-2.6, 0.55]],
  doorIn: [4.2, 3.4], doorOut: [4.2, 4.6], street: [[5.9, 5.0], [-6.2, 5.2]],
};
export const faceAlongQueue = (i) => { const q = SPOTS.queue, a = q[i], b = q[Math.max(0, i - 1)]; return i === 0 ? Math.PI : Math.atan2(b[0] - a[0], b[1] - a[1]); };

function uvMetres(geo, sx, sy) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy); uv.needsUpdate = true; return geo; }
function box(parent, w, h, d, mat, x, y, z, {cast = true, recv = true, uv = null, ry = 0} = {}) {
  const g = new THREE.BoxGeometry(w, h, d); if (uv) uvMetres(g, uv[0], uv[1]);
  const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = cast; m.receiveShadow = recv; parent.add(m); return m;
}
function cyl(parent, r0, r1, h, mat, x, y, z, seg = 18) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; }
function plane(parent, w, h, mat, x, y, z, rx = 0, ry = 0) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); m.receiveShadow = true; parent.add(m); return m; }

const M = {};
function materials() {
  M.wall = pbr('painted_plaster_wall', [0.5, 0.5], {color: 0xf1ece4, roughness: 0.95});
  M.floor = pbr('terrazzo_tiles', [0.45, 0.45], {color: 0xe3ddd2, roughness: 0.6});
  M.counterFront = pbr('black_oak_veneer', [0.9, 0.9], {roughness: 0.6});
  M.marble = pbr('marble_01', [0.5, 0.5], {roughness: 0.25});
  M.oak = pbr('oak_veneer_01', [0.8, 0.8], {roughness: 0.6});
  M.backCounter = new THREE.MeshStandardMaterial({color: 0xe7e1d6, roughness: 0.8});
  M.ceiling = new THREE.MeshStandardMaterial({color: 0xeeebe6, roughness: 0.95, side: THREE.FrontSide});
  M.steel = new THREE.MeshStandardMaterial({color: 0xc9cdd2, roughness: 0.22, metalness: 1});
  M.black = new THREE.MeshStandardMaterial({color: 0x1d1e20, roughness: 0.45, metalness: 0.3});
  M.glass = new THREE.MeshPhysicalMaterial({color: 0xe8f0f2, roughness: 0.02, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.4});
  M.cup = new THREE.MeshStandardMaterial({color: 0xf4f1ea, roughness: 0.5});
  M.lid = new THREE.MeshStandardMaterial({color: 0x3b2f28, roughness: 0.5});
  M.sleeve = new THREE.MeshStandardMaterial({color: 0x9c7a52, roughness: 0.8});
  M.walk = new THREE.MeshStandardMaterial({color: 0xbfbab0, roughness: 0.9, map: canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#c7c2b8'; g.fillRect(0, 0, w, h); g.strokeStyle = '#a9a39a'; g.lineWidth = 3;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * w / 4, 0); g.lineTo(i * w / 4, h); g.stroke(); g.beginPath(); g.moveTo(0, i * h / 4); g.lineTo(w, i * h / 4); g.stroke(); }
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  })});
  M.walk.map.wrapS = M.walk.map.wrapT = THREE.RepeatWrapping;
  M.road = new THREE.MeshStandardMaterial({color: 0x3c3d3f, roughness: 0.92});
  M.curb = new THREE.MeshStandardMaterial({color: 0x9c9a95, roughness: 0.9});
  M.brass = new THREE.MeshStandardMaterial({color: 0xc39a5b, roughness: 0.3, metalness: 1});
  // assumed customers: pale, see-through — nobody has seen them yet
  M.ghost = new THREE.MeshStandardMaterial({color: 0xeef3f8, roughness: 0.5, transparent: true, opacity: 0.32, emissive: 0xf4f8ff, emissiveIntensity: 0.12, depthWrite: false});
  M.lamp = new THREE.MeshStandardMaterial({color: 0x1d1e20, roughness: 0.4, emissive: 0xffc98a, emissiveIntensity: 0});
  M.mark = new THREE.MeshBasicMaterial({color: 0xf0b45a, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide});
}
export const cafeMaterials = M;

// ---------------------------------------------------------------- live props: tickets on the rail, cups on the shelf, clock
const tickets = [], shelfCups = [];
let clockTex = null, clockMin = 8 * 60 + 10;
function drawClock(g, w, h) {
  g.fillStyle = '#f8f6f1'; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 4, 0, 7); g.fill();
  g.strokeStyle = '#222'; g.lineWidth = 8; g.stroke();
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.lineWidth = 6; g.beginPath(); g.moveTo(w / 2 + Math.sin(a) * w * 0.38, h / 2 - Math.cos(a) * h * 0.38); g.lineTo(w / 2 + Math.sin(a) * w * 0.45, h / 2 - Math.cos(a) * h * 0.45); g.stroke(); }
  const hr = (clockMin / 60) % 12, mi = clockMin % 60;
  const hand = (a, L, wd) => { g.lineWidth = wd; g.lineCap = 'round'; g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 + Math.sin(a) * L, h / 2 - Math.cos(a) * L); g.stroke(); };
  hand(hr / 12 * Math.PI * 2, w * 0.24, 12); hand(mi / 60 * Math.PI * 2, w * 0.36, 8);
}
export function setModelClock(min) { clockMin = min; MQ.clockMin = min; if (clockTex) { const c = clockTex.image; drawClock(c.getContext('2d'), c.width, c.height); clockTex.needsUpdate = true; } }
/** n tickets clipped to the order rail */
export function setTickets(n) { tickets.forEach((t, i) => { t.visible = i < n; }); MQ.ticketCount = n; }
/** n finished drinks waiting on the pickup shelf */
export function setShelfCups(n) { shelfCups.forEach((c, i) => { c.visible = i < n; }); MQ.cupCount = n; }
export const shelfCupCount = () => MQ.cupCount || 0;
function makeCup(parent, x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  cyl(g, 0.045, 0.036, 0.13, M.cup, 0, 0.065, 0, 14); cyl(g, 0.048, 0.048, 0.016, M.lid, 0, 0.138, 0, 14); cyl(g, 0.0465, 0.041, 0.05, M.sleeve, 0, 0.07, 0, 14);
  return g;
}
/** a cup for someone's right hand (in the hand bone's frame: Rocketbox bones are in centimetres) */
export function cupForHand() { const g = new THREE.Group(); makeCup(g, 0, -0.06, 0); g.scale.setScalar(100); g.position.set(8, 3, 4); g.rotation.set(0, 0, Math.PI / 2); return g; }

// ---------------------------------------------------------------- the assumed extra orders a day: pale figures outside
let figs = null; const figK = new Float32Array(40); let figWant = 0;
function buildFigures() {
  const parts = [];
  for (const x of [-0.1, 0.1]) { const g = new THREE.CylinderGeometry(0.072, 0.058, 0.84, 8); g.translate(x, 0.42, 0); parts.push(g); }
  const hips = new THREE.SphereGeometry(0.16, 10, 6); hips.scale(1.2, 0.62, 0.78); hips.translate(0, 0.86, 0); parts.push(hips);
  const torso = new THREE.CylinderGeometry(0.205, 0.16, 0.6, 12); torso.scale(1, 1, 0.68); torso.translate(0, 1.15, 0); parts.push(torso);
  const sh = new THREE.SphereGeometry(0.21, 12, 6); sh.scale(1.12, 0.42, 0.66); sh.translate(0, 1.44, 0); parts.push(sh);
  for (const x of [-0.255, 0.255]) { const g = new THREE.CylinderGeometry(0.052, 0.042, 0.64, 6); g.translate(x, 1.12, 0); parts.push(g); }
  const neck = new THREE.CylinderGeometry(0.05, 0.056, 0.12, 6); neck.translate(0, 1.52, 0); parts.push(neck);
  const head = new THREE.SphereGeometry(0.115, 14, 10); head.scale(0.88, 1.06, 0.95); head.translate(0, 1.66, 0); parts.push(head);
  figs = new THREE.InstancedMesh(mergeGeo(parts), M.ghost, 40); figs.castShadow = false; figs.count = 40; figs.renderOrder = 2;
  R.add(figs);
  const m = new THREE.Matrix4(); for (let i = 0; i < 40; i++) { m.makeScale(0, 0, 0); figs.setMatrixAt(i, m); }
  onUpdate((dt) => {
    let dirty = false;
    for (let i = 0; i < 40; i++) {
      const want = i < figWant ? 1 : 0, k = figK[i];
      if (Math.abs(k - want) < 0.002) { if (k !== want) { figK[i] = want; dirty = true; } continue; }
      figK[i] = damp(k, want, 9 - (i % 10) * 0.4, dt); dirty = true;
    }
    if (!dirty) return;
    for (let i = 0; i < 40; i++) {
      // a waiting line along the sidewalk from the door, westward, then a second row
      const row = Math.floor(i / 13), col = i % 13, s = figK[i];
      const x = 3.6 - col * 0.68 - (row % 2) * 0.3, z = 4.35 + row * 0.55;
      m.compose(P(x, 0, z), new THREE.Quaternion().setFromAxisAngle(P(0, 1, 0), Math.PI / 2 + Math.sin(i * 7.1) * 0.35), P(s, s, s));
      figs.setMatrixAt(i, m);
    }
    figs.instanceMatrix.needsUpdate = true;
  });
  MQ.anchors.figures = P(-0.6, 1.2, 4.9);
}
/** show n assumed extra orders a day as figures waiting on the sidewalk */
export function setFigures(n) { figWant = Math.max(0, Math.min(40, Math.round(n))); }
function mergeGeo(list) {
  const pos = [], nor = [], idx = []; let off = 0;
  for (const g of list) { const p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); } const ix = g.index; for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + off); off += p.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setIndex(idx); return out;
}

// ---------------------------------------------------------------- the first hypothesis (a glowing outline on the floor) and the handoff test
const marks = {};
export function showHypothesis(k) { for (const [n, m] of Object.entries(marks)) if (n !== 'handoff') m.visible = n === k; }
function outline(x0, z0, x1, z1, w = 0.08) {
  const g = new THREE.Group(); g.visible = false; R.add(g);
  const seg = (ax, az, bx, bz) => { const len = Math.hypot(bx - ax, bz - az); const m = plane(g, len, w, M.mark, (ax + bx) / 2, 0.012, (az + bz) / 2, -Math.PI / 2); m.rotation.z = -Math.atan2(bz - az, bx - ax); };
  seg(x0, z0, x1, z0); seg(x1, z0, x1, z1); seg(x1, z1, x0, z1); seg(x0, z1, x0, z0);
  return g;
}
function buildMarks() {
  marks.peak = outline(-4.6, -1.05, -1.9, 0.9);          // the crowd at the pickup shelf
  marks.acc = outline(-2.0, -3.2, 0.6, -1.95);           // where the drinks are made
  marks.all = outline(CAFE.x0 + 0.15, CAFE.z0 + 0.15, CAFE.x1 - 0.15, CAFE.z1 - 0.15, 0.12);
  // the pickup-step test (third route): a separate handoff point at the end of the counter, with its own sign and lamp
  const g = new THREE.Group(); g.visible = false; R.add(g); marks.handoff = g;
  box(g, 1.4, 0.06, 0.5, M.oak, -4.55, 1.0, -0.65);
  box(g, 0.06, 1.0, 0.06, M.black, -5.15, 0.5, -0.65);
  const sign = canvasTex(512, 160, (c, w, h) => { c.fillStyle = '#2f4a3f'; c.fillRect(0, 0, w, h); c.fillStyle = '#f2efe6'; c.font = '600 64px "IBM Plex Sans Arabic"'; c.textAlign = 'center'; c.fillText('نقطة تسليم', w / 2, 104); });
  plane(g, 1.2, 0.38, new THREE.MeshStandardMaterial({map: sign, roughness: 0.6}), -4.55, 1.6, -0.62);
  const l = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), new THREE.MeshStandardMaterial({color: 0xfff1d6, emissive: 0xffc27a, emissiveIntensity: 2})); l.position.set(-4.55, 2.05, -0.62); g.add(l);
}
export function showHandoffTest(on) { if (marks.handoff) marks.handoff.visible = on; }

// ---------------------------------------------------------------- build
export async function buildMaquette() {
  materials();
  const {x0, x1, z0, z1, walk, h: WH} = CAFE, WT = 0.2;
  // ground all around (the road and the far sidewalk), the sidewalk in front
  plane(R, 70, 70, M.road, 0, -0.01, 0, -Math.PI / 2);
  const sw = plane(R, 24, walk - z1 + 0.3, M.walk, 0, 0.004, (z1 + walk) / 2, -Math.PI / 2); uvMetres(sw.geometry, 12, (walk - z1) / 2);
  box(R, 24, 0.15, 0.25, M.curb, 0, 0.07, walk + 0.12);
  const fsw = plane(R, 40, 3, M.walk, 0, 0.004, walk + 9.5, -Math.PI / 2); uvMetres(fsw.geometry, 20, 1.5);
  // floor, ceiling (seen from inside only), walls
  const fl = plane(R, x1 - x0, z1 - z0, M.floor, (x0 + x1) / 2, 0.006, (z0 + z1) / 2, -Math.PI / 2); uvMetres(fl.geometry, x1 - x0, z1 - z0);
  plane(R, x1 - x0, z1 - z0, M.ceiling, (x0 + x1) / 2, WH, (z0 + z1) / 2, Math.PI / 2);
  box(R, x1 - x0 + WT * 2, WH, WT, M.wall, (x0 + x1) / 2, WH / 2, z0 - WT / 2, {uv: [x1 - x0, WH]});
  box(R, WT, WH, z1 - z0, M.wall, x0 - WT / 2, WH / 2, (z0 + z1) / 2, {uv: [z1 - z0, WH]});
  box(R, WT, WH, z1 - z0, M.wall, x1 + WT / 2, WH / 2, (z0 + z1) / 2, {uv: [z1 - z0, WH]});
  box(R, x1 - x0 + WT * 2, 0.5, WT, M.wall, (x0 + x1) / 2, WH - 0.25, z1 + 0.12);       // the lintel over the shop window
  // the shop front: glass between mullions, the door at the east end (x 3.7–4.7)
  const fz = z1 + 0.05, gh = WH - 0.5;
  for (const x of [x0, -2.6, 0, 2.6, 3.66, 4.74, x1]) box(R, 0.08, gh, 0.12, M.black, x, gh / 2, fz);
  box(R, 3.66 - x0, 0.3, 0.14, M.black, (x0 + 3.66) / 2, 0.15, fz); box(R, x1 - 4.74, 0.3, 0.14, M.black, (4.74 + x1) / 2, 0.15, fz);
  box(R, x1 - x0, 0.08, 0.14, M.black, (x0 + x1) / 2, gh - 0.04, fz);
  plane(R, 3.66 - x0, gh - 0.38, M.glass, (x0 + 3.66) / 2, 0.3 + (gh - 0.38) / 2, fz);
  plane(R, x1 - 4.74, gh - 0.38, M.glass, (4.74 + x1) / 2, 0.3 + (gh - 0.38) / 2, fz);
  const doorG = new THREE.Group(); doorG.position.set(3.72, 0, fz); R.add(doorG);            // hinge at the west jamb
  box(doorG, 0.96, 0.08, 0.06, M.black, 0.48, 0.04, 0); box(doorG, 0.96, 0.08, 0.06, M.black, 0.48, 2.3, 0); box(doorG, 0.06, 2.3, 0.06, M.black, 0.93, 1.17, 0);
  plane(doorG, 0.9, 2.2, M.glass, 0.48, 1.17, 0);
  MQ.door = doorG;
  box(R, 1.17, 0.12, 0.14, M.black, 4.2, 2.44, fz);
  // a sign over the door (unbranded)
  const st = canvasTex(1024, 200, (g, w, h) => { g.fillStyle = '#2f4a3f'; g.fillRect(0, 0, w, h); g.fillStyle = '#f2efe6'; g.font = '600 110px "IBM Plex Sans Arabic"'; g.textAlign = 'center'; g.fillText('مقهى الميدان', w / 2, 140); });
  plane(R, 3.2, 0.62, new THREE.MeshStandardMaterial({map: st, roughness: 0.6}), -1.0, WH - 0.25, z1 + 0.23);
  // ---------------------------------------------------------------- counter, bar, back counter
  const CZ0 = -1.9, CZ1 = -1.2, CX0 = -4.0, CX1 = 2.6;
  box(R, CX1 - CX0, 1.0, CZ1 - CZ0, M.counterFront, (CX0 + CX1) / 2, 0.5, (CZ0 + CZ1) / 2, {uv: [CX1 - CX0, 1]});
  box(R, CX1 - CX0 + 0.06, 0.05, CZ1 - CZ0 + 0.08, M.marble, (CX0 + CX1) / 2, 1.025, (CZ0 + CZ1) / 2 + 0.02, {uv: [CX1 - CX0, 1]});
  box(R, 7.8, 0.92, 0.62, M.backCounter, -0.8, 0.46, -3.45);
  box(R, 7.8, 0.04, 0.66, M.marble, -0.8, 0.94, -3.45, {uv: [7.8, 0.66]});
  for (const x of [-1.6, -0.2]) { const g = new THREE.Group(); g.position.set(x, 0.96, -3.45); R.add(g); box(g, 0.9, 0.5, 0.55, M.steel, 0, 0.25, 0); box(g, 0.92, 0.06, 0.57, M.black, 0, 0.53, 0); for (const dx of [-0.25, 0.25]) cyl(g, 0.05, 0.05, 0.12, M.black, dx, 0.12, 0.3, 10); }
  cyl(R, 0.12, 0.14, 0.45, M.black, 0.9, 1.18, -3.5, 14); cyl(R, 0.12, 0.08, 0.2, M.steel, 0.9, 1.5, -3.5, 14);
  for (let i = 0; i < 4; i++) makeCup(R, 1.5 + (i % 2) * 0.12, 0.96 + Math.floor(i / 2) * 0.13, -3.4);
  box(R, 1.0, 2.0, 0.7, M.steel, 3.6, 1.0, -3.4);
  const reg = new THREE.Group(); reg.position.set(2.0, 1.05, -1.62); R.add(reg); box(reg, 0.08, 0.25, 0.08, M.black, 0, 0.12, 0); const scr = box(reg, 0.42, 0.3, 0.03, M.black, 0, 0.32, 0.03); scr.rotation.x = -0.35;
  const menu = canvasTex(1024, 320, (g, w, h) => {
    g.fillStyle = '#20231f'; g.fillRect(0, 0, w, h); g.fillStyle = '#efe9db'; g.textAlign = 'center'; g.font = '600 56px "IBM Plex Sans Arabic"';
    ['قهوة', 'لاتيه', 'كابتشينو', 'شاي'].forEach((t, i) => g.fillText(t, 140 + i * 250, 130));
    g.font = '500 40px Inter'; g.fillStyle = '#c8b38a'; ['2.50', '3.75', '3.75', '2.25'].forEach((t, i) => g.fillText(t, 140 + i * 250, 220));
  });
  const mb = plane(R, 4.2, 1.3, new THREE.MeshStandardMaterial({map: menu, roughness: 0.7}), -0.6, 2.25, z0 + 0.02);
  clockTex = canvasTex(256, 256, () => {});
  const ck = new THREE.Mesh(new THREE.CircleGeometry(0.42, 32), new THREE.MeshStandardMaterial({map: clockTex, roughness: 0.5})); ck.position.set(2.6, 2.35, z0 + 0.02); R.add(ck);
  setModelClock(clockMin);
  // pendant lamps over the counter and the tables
  for (const [x, z] of [[-3.3, -1.55], [-1.3, -1.55], [0.7, -1.55], [2.2, -1.55], [-3.0, 1.6], [-0.9, 1.6], [1.0, 2.4]]) {
    cyl(R, 0.006, 0.006, 0.75, M.black, x, WH - 0.375, z, 4);
    const sh = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.2, 20, 1, true), M.black); sh.material.side = THREE.DoubleSide; sh.position.set(x, WH - 0.85, z); R.add(sh);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), M.lamp); b.position.set(x, WH - 0.92, z); R.add(b);
  }
  // ---------------------------------------------------------------- the order rail (tickets clipped above the bar)
  const RX0 = -2.5, RX1 = 1.3, RY = 1.62, RZ = -1.55;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, RX1 - RX0, 8), M.steel); rod.rotation.z = Math.PI / 2; rod.position.set((RX0 + RX1) / 2, RY, RZ); rod.castShadow = true; R.add(rod);
  for (const x of [RX0, RX1]) box(R, 0.03, RY - 1.05, 0.03, M.steel, x, 1.05 + (RY - 1.05) / 2, RZ);
  for (let i = 0; i < 12; i++) {
    const t = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.16), new THREE.MeshStandardMaterial({color: 0xfbf8f0, roughness: 0.85, side: THREE.DoubleSide, map: ticketTex(i)}));
    t.position.set(RX1 - 0.12 - i * 0.3, RY - 0.09, RZ + 0.02); t.rotation.z = Math.sin(i * 3.3) * 0.06; t.castShadow = true; R.add(t); tickets.push(t);
  }
  MQ.anchors.rail = P((RX0 + RX1) / 2, RY + 0.1, RZ);
  // ---------------------------------------------------------------- the pickup shelf with its sign
  box(R, 1.3, 0.05, 0.36, M.oak, -3.35, 1.32, -1.25);
  for (const x of [-3.95, -2.75]) box(R, 0.04, 0.27, 0.04, M.steel, x, 1.18, -1.25);
  for (let i = 0; i < 6; i++) shelfCups.push(makeCup(R, -3.85 + i * 0.2, 1.345, -1.25));
  const ps = canvasTex(512, 160, (g, w, h) => { g.fillStyle = '#2f4a3f'; g.fillRect(0, 0, w, h); g.fillStyle = '#f2efe6'; g.font = '600 72px "IBM Plex Sans Arabic"'; g.textAlign = 'center'; g.fillText('الاستلام', w / 2, 108); });
  plane(R, 1.1, 0.34, new THREE.MeshStandardMaterial({map: ps, roughness: 0.6, side: THREE.DoubleSide}), -3.27, 2.02, -1.28);
  box(R, 0.04, 1.1, 0.04, M.black, -2.68, 1.6, -1.3);
  MQ.anchors.pickup = P(-3.35, 1.4, -1.0);
  // ---------------------------------------------------------------- seating: round tables, chairs, a sofa, plants
  const [tbl, chair, sofa] = await Promise.all([model('round_wooden_table_01'), model('dining_chair_02'), model('sofa_02')]);
  for (const [x, z] of [[-3.05, 1.05], [-1.25, 2.95], [-3.4, 2.95], [-0.9, 1.0], [0.75, 2.4]]) { const t = tbl.clone(true); t.scale.set(0.5, 0.75, 0.5); t.position.set(x, 0, z); R.add(t); }
  const chairs = [[-3.05, 1.05, -Math.PI / 2, 0.6], [-3.05, 1.05, Math.PI / 2, 0.6], [-1.25, 2.95, Math.PI / 2, 0.6], [-1.25, 2.95, -Math.PI / 2, 0.6], [-3.4, 2.95, Math.PI / 2, 0.6], [-0.9, 1.0, 0, 0.6], [-0.9, 1.0, Math.PI, 0.6], [0.75, 2.4, Math.PI / 2, 0.6], [0.75, 2.4, -Math.PI / 2, 0.6]];
  for (const [x, z, ry, d] of chairs) { const c = chair.clone(true); c.position.set(x - Math.sin(ry) * d, 0, z - Math.cos(ry) * d); c.rotation.y = ry; R.add(c); }
  const so = sofa.clone(true); so.position.set(-4.62, 0, 2.95); so.rotation.y = Math.PI / 2; so.scale.setScalar(0.95); R.add(so);
  try { const pl = await model('potted_plant_02'); for (const [x, z, s] of [[-4.72, -0.55, 1.5], [-4.65, 1.65, 1.35], [1.9, 3.35, 1.3]]) { const p = pl.clone(true); p.scale.setScalar(s); p.position.set(x, 0.097 * s, z); R.add(p); } } catch (e) { console.warn('plant', e); }
  // ---------------------------------------------------------------- the street: a lamp post, a tree in a pit, a bench
  cyl(R, 0.05, 0.07, 3.6, M.black, 5.6, 1.8, 5.65, 8);
  const lampHead = box(R, 0.45, 0.1, 0.26, M.lamp, 5.45, 3.6, 5.65); MQ.streetLamp = lampHead;
  cyl(R, 0.11, 0.15, 3.0, new THREE.MeshStandardMaterial({color: 0x5a4636, roughness: 0.9}), -6.4, 1.5, 5.5, 10);
  const leaf = new THREE.MeshStandardMaterial({color: 0x56703f, roughness: 0.9});
  for (let i = 0; i < 7; i++) { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75 + Math.random() * 0.35, 1), leaf); s.position.set(-6.4 + (Math.random() - 0.5) * 1.4, 3.4 + Math.random() * 1.0, 5.5 + (Math.random() - 0.5) * 1.2); s.castShadow = true; R.add(s); }
  // ---------------------------------------------------------------- figures, marks
  buildFigures(); buildMarks();
  R.add(MQ.live);
  Object.assign(MQ.anchors, {center: P(0, 1.2, 0.0), counter: P(0, 1.2, -1.5), door: P(4.2, 1.4, 3.8)});
  R.position.copy(CAFE_POS);
  scene.add(R); R.updateMatrixWorld(true);
  mergeStatic(R, {cell: 8, exclude: [MQ.live, figs, doorG, ...tickets, ...shelfCups, ...Object.values(marks), mb, ck]});
  setTickets(9); setShelfCups(3);
  return R;
}
function ticketTex(i) {
  return canvasTex(64, 96, (g, w, h) => {
    g.fillStyle = '#fbf8f0'; g.fillRect(0, 0, w, h); g.fillStyle = '#3a3a3a'; g.font = '700 20px Inter'; g.fillText('#' + (41 + i), 6, 22);
    g.fillStyle = '#999'; for (let k = 0; k < 4; k++) g.fillRect(6, 36 + k * 14, 30 + Math.random() * 22, 4);
  });
}
/** world position of a café-frame anchor (for hotspots / camera shots) */
export function anchor(k) { const a = MQ.anchors[k]; return a ? toWorld(a.x, a.y, a.z) : null; }
