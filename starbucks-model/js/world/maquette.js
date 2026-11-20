// The store on the table: a 1:16 architectural model of the illustrative "Al-Midan" store on a birch plinth.
// Everything inside is built at full size (metres) in the model's own frame and the frame is scaled down, so the
// people (the same Rocketbox avatars, 1:16) walk at their real speed in it.
// Café frame: x east (−5.2…5.2), z towards the player = the street side (−3.8 back wall … 3.8 shop window), sidewalk to
// z 6.0. Observed things are real (people, cups, tickets); assumptions are white (the model-maker's plastic figures).
import * as THREE from 'three';
import {scene, onUpdate, damp} from '../core/engine.js';
import {model} from '../core/assets.js';
import {pbr, canvasTex} from './materials.js';
import {mergeStatic} from './merge.js';
import {TABLE} from './room.js';

export const SCALE = 1 / 16;
export const MQ = {root: new THREE.Group(), live: new THREE.Group(), anchors: {}, door: null};
const R = MQ.root; R.name = 'maquette';
const P = (x, y, z) => new THREE.Vector3(x, y, z);
/** a point in the model's frame → world */
export const toWorld = (x, y, z) => R.localToWorld(P(x, y, z));
export const CAFE = {x0: -5.2, x1: 5.2, z0: -3.8, z1: 3.8, walk: 6.0};

// ---------------------------------------------------------------- where people stand (café frame, metres)
export const SPOTS = {
  register: [2.0, -0.72], cashier: [2.0, -2.35],
  barMachine: [-0.9, -2.75], barHand: [-3.35, -2.2],
  queue: [[2.0, -0.72], [2.78, -0.66], [3.52, -0.5], [4.05, 0.05], [4.2, 0.78], [4.22, 1.5], [4.22, 2.22], [4.22, 2.95]],
  pickup: [[-3.35, -0.62], [-2.62, -0.42], [-4.02, -0.28], [-3.05, 0.12], [-2.2, 0.1], [-3.75, 0.38], [-2.6, 0.55]],
  doorIn: [4.2, 3.4], doorOut: [4.2, 4.6], street: [[5.9, 5.0], [-6.2, 5.2]],
  seats: [{x: -3.05, z: 1.05, ry: -Math.PI / 2}, {x: -1.25, z: 2.95, ry: Math.PI / 2}],
};
export const faceAlongQueue = (i) => { const q = SPOTS.queue, a = q[i], b = q[Math.max(0, i - 1)]; return i === 0 ? Math.PI : Math.atan2(b[0] - a[0], b[1] - a[1]); };

function uvMetres(geo, sx, sy) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy); uv.needsUpdate = true; return geo; }
function box(parent, w, h, d, mat, x, y, z, {cast = true, recv = true, uv = null, ry = 0} = {}) {
  const g = new THREE.BoxGeometry(w, h, d); if (uv) uvMetres(g, uv[0], uv[1]);
  const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = cast; m.receiveShadow = recv; parent.add(m); return m;
}
function cyl(parent, r0, r1, h, mat, x, y, z, seg = 18) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; }

const M = {};
function materials() {
  M.foam = new THREE.MeshStandardMaterial({color: 0xf2efe8, roughness: 0.92});            // the model-maker's white board
  M.foamEdge = new THREE.MeshStandardMaterial({color: 0xe4dfd4, roughness: 0.95});
  M.birch = pbr('grey_oak_veneer_01', [1.2, 1.2], {color: 0xe8d2b0, roughness: 0.7});
  M.floor = pbr('terrazzo_tiles', [0.45, 0.45], {color: 0xe3ddd2, roughness: 0.6});
  M.counterFront = pbr('black_oak_veneer', [0.9, 0.9], {roughness: 0.6});
  M.marble = pbr('marble_01', [0.5, 0.5], {roughness: 0.25});
  M.oak = pbr('oak_veneer_01', [0.8, 0.8], {roughness: 0.6});
  M.steel = new THREE.MeshStandardMaterial({color: 0xc9cdd2, roughness: 0.22, metalness: 1});
  M.black = new THREE.MeshStandardMaterial({color: 0x1d1e20, roughness: 0.45, metalness: 0.3});
  M.glass = new THREE.MeshPhysicalMaterial({color: 0xe8f0f2, roughness: 0.02, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.4});
  M.paper = new THREE.MeshStandardMaterial({color: 0xf6f3ea, roughness: 0.85});
  M.cup = new THREE.MeshStandardMaterial({color: 0xf4f1ea, roughness: 0.5});
  M.lid = new THREE.MeshStandardMaterial({color: 0x3b2f28, roughness: 0.5});
  M.sleeve = new THREE.MeshStandardMaterial({color: 0x9c7a52, roughness: 0.8});
  M.green = new THREE.MeshStandardMaterial({color: 0x4f6b43, roughness: 0.85});
  M.pot = new THREE.MeshStandardMaterial({color: 0x8f6a52, roughness: 0.8});
  M.walk = new THREE.MeshStandardMaterial({color: 0xbfbab0, roughness: 0.9, map: canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#c7c2b8'; g.fillRect(0, 0, w, h); g.strokeStyle = '#a9a39a'; g.lineWidth = 3;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * w / 4, 0); g.lineTo(i * w / 4, h); g.stroke(); g.beginPath(); g.moveTo(0, i * h / 4); g.lineTo(w, i * h / 4); g.stroke(); }
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  })});
  M.walk.map.wrapS = M.walk.map.wrapT = THREE.RepeatWrapping;
  M.brass = new THREE.MeshStandardMaterial({color: 0xc39a5b, roughness: 0.3, metalness: 1});
  M.white = new THREE.MeshStandardMaterial({color: 0xf4f2ec, roughness: 0.42});              // assumption figures
  M.lamp = new THREE.MeshStandardMaterial({color: 0x1d1e20, roughness: 0.4, emissive: 0xffc98a, emissiveIntensity: 0});
}

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
export function setModelClock(min) { clockMin = min; if (clockTex) { const c = clockTex.image; drawClock(c.getContext('2d'), c.width, c.height); clockTex.needsUpdate = true; } dial.set(min); }
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

// ---------------------------------------------------------------- the replay dial (brass, at the plinth's front corner)
const dial = {set() {}};
function buildDial() {
  const g = new THREE.Group(); g.position.set(7.1, -0.9, 5.0); R.add(g); MQ.dialGroup = g;   // stands on the table, by the corner
  cyl(g, 0.95, 1.05, 0.3, M.brass, 0, 0.15, 0, 40);
  const face = canvasTex(512, 512, (c, w, h) => {});
  const fm = new THREE.Mesh(new THREE.CircleGeometry(0.82, 48), new THREE.MeshStandardMaterial({map: face, roughness: 0.4}));
  fm.rotation.x = -Math.PI / 2; fm.position.y = 0.305; g.add(fm);
  const knob = cyl(g, 0.16, 0.16, 0.22, M.brass, 0, 0.42, 0, 16);
  const draw = (min) => {
    const c = face.image, x = c.getContext('2d'), w = c.width, h = c.height;
    x.fillStyle = '#efe7d6'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#3b2f28'; x.lineWidth = 6; x.beginPath(); x.arc(w / 2, h / 2, w / 2 - 14, 0, 7); x.stroke();
    // two marks: the morning peak and the quiet afternoon
    const mark = (m, label) => { const a = ((m / 60) % 12) / 12 * Math.PI * 2; x.fillStyle = '#8a5a2b'; x.beginPath(); x.arc(w / 2 + Math.sin(a) * w * 0.36, h / 2 - Math.cos(a) * h * 0.36, 14, 0, 7); x.fill();
      x.font = '600 38px Inter'; x.textAlign = 'center'; x.fillStyle = '#3b2f28'; x.fillText(label, w / 2 + Math.sin(a) * w * 0.25, h / 2 - Math.cos(a) * h * 0.25 + 12); };
    mark(8 * 60 + 10, '8:10'); mark(15 * 60 + 30, '3:30');
    const a = ((min / 60) % 12) / 12 * Math.PI * 2; x.strokeStyle = '#1b1c1e'; x.lineWidth = 14; x.lineCap = 'round'; x.beginPath(); x.moveTo(w / 2, h / 2); x.lineTo(w / 2 + Math.sin(a) * w * 0.4, h / 2 - Math.cos(a) * h * 0.4); x.stroke();
    face.needsUpdate = true;
  };
  let shown = 8 * 60 + 10, target = shown;
  dial.set = (m) => { target = m; };
  onUpdate((dt) => { if (Math.abs(shown - target) < 0.5) { if (shown !== target) { shown = target; draw(shown); } return; } shown = damp(shown, target, 3.5, dt); draw(shown); knob.rotation.y = shown / 60; });
  draw(shown);
  MQ.anchors.dial = P(7.1, -0.3, 5.0);
}

// ---------------------------------------------------------------- the white figures (assumed extra orders a day)
let figs = null; const figK = new Float32Array(40); let figWant = 0;
function buildFigures() {
  // a model-maker's figure (plain white, no face): legs, hips, a tapered body, shoulders, arms, a head — instanced 40×
  const parts = [];
  for (const x of [-0.1, 0.1]) { const g = new THREE.CylinderGeometry(0.072, 0.058, 0.84, 8); g.translate(x, 0.42, 0); parts.push(g); }
  const hips = new THREE.SphereGeometry(0.16, 10, 6); hips.scale(1.2, 0.62, 0.78); hips.translate(0, 0.86, 0); parts.push(hips);
  const torso = new THREE.CylinderGeometry(0.205, 0.16, 0.6, 12); torso.scale(1, 1, 0.68); torso.translate(0, 1.15, 0); parts.push(torso);
  const sh = new THREE.SphereGeometry(0.21, 12, 6); sh.scale(1.12, 0.42, 0.66); sh.translate(0, 1.44, 0); parts.push(sh);
  for (const x of [-0.255, 0.255]) { const g = new THREE.CylinderGeometry(0.052, 0.042, 0.64, 6); g.translate(x, 1.12, 0); parts.push(g); }
  const neck = new THREE.CylinderGeometry(0.05, 0.056, 0.12, 6); neck.translate(0, 1.52, 0); parts.push(neck);
  const head = new THREE.SphereGeometry(0.115, 14, 10); head.scale(0.88, 1.06, 0.95); head.translate(0, 1.66, 0); parts.push(head);
  const geo = mergeGeo(parts);
  figs = new THREE.InstancedMesh(geo, M.white, 40); figs.castShadow = true; figs.receiveShadow = true; figs.count = 40;
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
      const row = Math.floor(i / 10), col = i % 10, s = figK[i];
      const x = -3.9 + col * 0.78 + (row % 2) * 0.3, z = 4.3 + row * 0.42;
      m.compose(P(x, 0, z), new THREE.Quaternion().setFromAxisAngle(P(0, 1, 0), Math.PI + Math.sin(i * 7.1) * 0.5), P(s, s, s));
      figs.setMatrixAt(i, m);
    }
    figs.instanceMatrix.needsUpdate = true;
  });
  MQ.anchors.figures = P(-0.6, 1.2, 4.9);
}
/** show n assumed extra orders a day as white figures on the sidewalk */
export function setFigures(n) { figWant = Math.max(0, Math.min(40, Math.round(n))); }
function mergeGeo(list) {
  const pos = [], nor = [], idx = []; let off = 0;
  for (const g of list) { const p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); } const ix = g.index; for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + off); off += p.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setIndex(idx); return out;
}

// ---------------------------------------------------------------- the hypothesis pin, the handoff test, the ring
const marks = {};
export function showHypothesis(k) {
  for (const m of Object.values(marks)) m.visible = false;
  if (marks[k]) marks[k].visible = true;
}
function buildMarks() {
  const pin = (x, z, h) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.visible = false; R.add(g);
    cyl(g, 0.035, 0.035, h, M.brass, 0, h / 2, 0, 8);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), new THREE.MeshStandardMaterial({color: 0xc8553d, roughness: 0.6, side: THREE.DoubleSide}));
    flag.position.set(0.47, h - 0.28, 0); flag.castShadow = true; g.add(flag);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), M.brass); ball.position.y = h; g.add(ball);
    return g;
  };
  marks.peak = pin(-3.35, -0.95, 3.4);          // the pickup shelf
  marks.acc = pin(-0.9, -2.2, 3.6);             // the bar where drinks are made
  // a storewide problem: a brass ring around the whole store
  const ring = new THREE.Group(); ring.visible = false; R.add(ring);
  const L = [[CAFE.x0 - 0.35, CAFE.z0 - 0.35], [CAFE.x1 + 0.35, CAFE.z0 - 0.35], [CAFE.x1 + 0.35, CAFE.z1 + 0.35], [CAFE.x0 - 0.35, CAFE.z1 + 0.35]];
  for (let i = 0; i < 4; i++) { const [ax, az] = L[i], [bx, bz] = L[(i + 1) % 4]; const len = Math.hypot(bx - ax, bz - az); const b = box(ring, len, 0.08, 0.1, M.brass, (ax + bx) / 2, 0.05, (az + bz) / 2); b.rotation.y = -Math.atan2(bz - az, bx - ax); }
  marks.all = ring;
}
// the pickup-step test (third route): a separate handoff point at the end of the counter, with its own sign
export function showHandoffTest(on) { if (marks.handoff) marks.handoff.visible = on; }
function buildHandoff() {
  const g = new THREE.Group(); g.visible = false; R.add(g); marks.handoff = g;
  box(g, 1.4, 0.06, 0.5, M.oak, -4.55, 1.0, -0.65);
  box(g, 0.06, 1.0, 0.06, M.black, -5.15, 0.5, -0.65);
  const sign = canvasTex(512, 160, (c, w, h) => { c.fillStyle = '#2f4a3f'; c.fillRect(0, 0, w, h); c.fillStyle = '#f2efe6'; c.font = '600 64px "IBM Plex Sans Arabic"'; c.textAlign = 'center'; c.fillText('نقطة تسليم', w / 2, 104); });
  const s = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.38), new THREE.MeshStandardMaterial({map: sign, roughness: 0.6})); s.position.set(-4.55, 1.6, -0.62); g.add(s);
  // a call-out light: the barista calls names here (a small warm lamp)
  const l = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), new THREE.MeshStandardMaterial({color: 0xfff1d6, emissive: 0xffc27a, emissiveIntensity: 2})); l.position.set(-4.55, 2.05, -0.62); g.add(l);
}

// ---------------------------------------------------------------- build
export async function buildMaquette() {
  materials();
  const {x0, x1, z0, z1, walk} = CAFE;
  const PL = {x0: x0 - 0.6, x1: x1 + 0.6, z0: z0 - 0.6, z1: walk, h: 0.9};
  // the plinth (birch), its top is the café floor level (y 0 in the café frame)
  box(R, PL.x1 - PL.x0, PL.h, PL.z1 - PL.z0, M.birch, (PL.x0 + PL.x1) / 2, -PL.h / 2, (PL.z0 + PL.z1) / 2, {uv: [PL.x1 - PL.x0, PL.h]});
  // brass plaque on the front edge
  const plaque = canvasTex(1024, 128, (g, w, h) => {
    g.fillStyle = '#b8925a'; g.fillRect(0, 0, w, h); g.fillStyle = '#3a2a18'; g.font = '600 54px "IBM Plex Sans Arabic"'; g.textAlign = 'center'; g.direction = 'rtl';
    g.fillText('فرع «الميدان» · مقياس 1:16 · سيناريو تعليمي', w / 2, 84);
  });
  const pq = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 0.8), new THREE.MeshStandardMaterial({map: plaque, roughness: 0.35, metalness: 0.7, color: 0xffffff}));
  pq.position.set(0, -PL.h / 2, PL.z1 + 0.012); R.add(pq);
  // floor
  const fl = new THREE.Mesh(uvMetres(new THREE.PlaneGeometry(x1 - x0, z1 - z0), x1 - x0, z1 - z0), M.floor); fl.rotation.x = -Math.PI / 2; fl.position.set((x0 + x1) / 2, 0.005, (z0 + z1) / 2); fl.receiveShadow = true; R.add(fl);
  const sw = new THREE.Mesh(uvMetres(new THREE.PlaneGeometry(PL.x1 - PL.x0, walk - z1), (PL.x1 - PL.x0) / 2, (walk - z1) / 2), M.walk); sw.rotation.x = -Math.PI / 2; sw.position.set((PL.x0 + PL.x1) / 2, 0.004, (z1 + walk) / 2); sw.receiveShadow = true; R.add(sw);
  // walls: the back and the west wall full height, the east wall cut low (so the eye gets in), white board
  const WH = 3.5, WT = 0.2;          // a tall café (it also hides the committee room in the eye-level shots)
  box(R, x1 - x0 + WT * 2, WH, WT, M.foam, (x0 + x1) / 2, WH / 2, z0 - WT / 2);
  box(R, WT, WH, z1 - z0, M.foam, x0 - WT / 2, WH / 2, (z0 + z1) / 2);
  box(R, WT, 1.15, z1 - z0, M.foam, x1 + WT / 2, 0.575, (z0 + z1) / 2);
  // the shop front, cut away like a section model so the eye gets in from the table: a low sill, the corner posts,
  // and the entrance — two posts, a lintel and the glass door (x 3.7–4.7)
  const fz = z1 + 0.05;
  box(R, 3.7 - x0, 0.34, 0.14, M.black, (x0 + 3.7) / 2, 0.17, fz); box(R, x1 - 4.7, 0.34, 0.14, M.black, (4.7 + x1) / 2, 0.17, fz);
  for (const x of [x0, x1]) box(R, 0.1, 1.15, 0.12, M.black, x, 0.575, fz);
  for (const x of [3.66, 4.74]) box(R, 0.09, 2.5, 0.12, M.black, x, 1.25, fz);
  const doorG = new THREE.Group(); doorG.position.set(3.72, 0, fz); R.add(doorG);            // hinge at the west jamb
  box(doorG, 0.96, 0.08, 0.06, M.black, 0.48, 0.04, 0); box(doorG, 0.96, 0.08, 0.06, M.black, 0.48, 2.3, 0); box(doorG, 0.06, 2.3, 0.06, M.black, 0.93, 1.17, 0);
  const dg = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.2), M.glass); dg.position.set(0.48, 1.17, 0); doorG.add(dg);
  MQ.door = doorG;
  box(R, 1.17, 0.12, 0.14, M.black, 4.2, 2.44, fz);
  // ---------------------------------------------------------------- counter, bar, back counter
  const CZ0 = -1.9, CZ1 = -1.2, CX0 = -4.0, CX1 = 2.6;
  box(R, CX1 - CX0, 1.0, CZ1 - CZ0, M.counterFront, (CX0 + CX1) / 2, 0.5, (CZ0 + CZ1) / 2, {uv: [CX1 - CX0, 1]});
  box(R, CX1 - CX0 + 0.06, 0.05, CZ1 - CZ0 + 0.08, M.marble, (CX0 + CX1) / 2, 1.025, (CZ0 + CZ1) / 2 + 0.02, {uv: [CX1 - CX0, 1]});
  box(R, 7.8, 0.92, 0.62, M.foamEdge, -0.8, 0.46, -3.45);
  box(R, 7.8, 0.04, 0.66, M.marble, -0.8, 0.94, -3.45, {uv: [7.8, 0.66]});
  // two espresso machines on the back counter, a grinder, a cup tower, a fridge
  for (const x of [-1.6, -0.2]) { const g = new THREE.Group(); g.position.set(x, 0.96, -3.45); R.add(g); box(g, 0.9, 0.5, 0.55, M.steel, 0, 0.25, 0); box(g, 0.92, 0.06, 0.57, M.black, 0, 0.53, 0); for (const dx of [-0.25, 0.25]) cyl(g, 0.05, 0.05, 0.12, M.black, dx, 0.12, 0.3, 10); }
  cyl(R, 0.12, 0.14, 0.45, M.black, 0.9, 1.18, -3.5, 14); cyl(R, 0.12, 0.08, 0.2, M.steel, 0.9, 1.5, -3.5, 14);
  for (let i = 0; i < 4; i++) { const c = makeCup(R, 1.5 + (i % 2) * 0.12, 0.96 + Math.floor(i / 2) * 0.13, -3.4); }
  box(R, 1.0, 2.0, 0.7, M.steel, 3.6, 1.0, -3.4);
  // the register (a small screen on the counter at the east end) and the menu board
  const reg = new THREE.Group(); reg.position.set(2.0, 1.05, -1.62); R.add(reg); box(reg, 0.08, 0.25, 0.08, M.black, 0, 0.12, 0); const scr = box(reg, 0.42, 0.3, 0.03, M.black, 0, 0.32, 0.03); scr.rotation.x = -0.35;
  const menu = canvasTex(1024, 320, (g, w, h) => {
    g.fillStyle = '#20231f'; g.fillRect(0, 0, w, h); g.fillStyle = '#efe9db'; g.textAlign = 'center'; g.font = '600 56px "IBM Plex Sans Arabic"';
    ['قهوة', 'لاتيه', 'كابتشينو', 'شاي'].forEach((t, i) => g.fillText(t, 140 + i * 250, 130));
    g.font = '500 40px Inter'; g.fillStyle = '#c8b38a'; ['2.50', '3.75', '3.75', '2.25'].forEach((t, i) => g.fillText(t, 140 + i * 250, 220));
  });
  const mb = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.3), new THREE.MeshStandardMaterial({map: menu, roughness: 0.7})); mb.position.set(-0.6, 2.25, z0 + 0.02); R.add(mb);
  // the clock on the back wall
  clockTex = canvasTex(256, 256, () => {});
  const ck = new THREE.Mesh(new THREE.CircleGeometry(0.42, 32), new THREE.MeshStandardMaterial({map: clockTex, roughness: 0.5})); ck.position.set(2.6, 2.35, z0 + 0.02); R.add(ck);
  setModelClock(clockMin);
  // ---------------------------------------------------------------- the order rail (tickets clipped above the bar)
  const RX0 = -2.5, RX1 = 1.3, RY = 1.62, RZ = -1.55;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, RX1 - RX0, 8), M.steel); rod.rotation.z = Math.PI / 2; rod.position.set((RX0 + RX1) / 2, RY, RZ); rod.castShadow = true; R.add(rod);
  for (const x of [RX0, RX1]) box(R, 0.05, RY - 1.05, 0.05, M.steel, x, 1.05 + (RY - 1.05) / 2, RZ);
  for (let i = 0; i < 12; i++) {
    const t = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.3), new THREE.MeshStandardMaterial({color: 0xfbf8f0, roughness: 0.85, side: THREE.DoubleSide, map: ticketTex(i)}));
    t.position.set(RX1 - 0.18 - i * 0.29, RY - 0.17, RZ + 0.03); t.rotation.z = (Math.sin(i * 3.3) * 0.06); t.castShadow = true; R.add(t); tickets.push(t);
  }
  MQ.anchors.rail = P((RX0 + RX1) / 2, RY + 0.3, RZ);
  // ---------------------------------------------------------------- the pickup shelf with its sign
  box(R, 1.3, 0.05, 0.36, M.oak, -3.35, 1.32, -1.25);
  for (const x of [-3.95, -2.75]) box(R, 0.05, 0.27, 0.05, M.steel, x, 1.18, -1.25);
  for (let i = 0; i < 6; i++) { const c = makeCup(R, -3.85 + i * 0.2, 1.345, -1.25); shelfCups.push(c); }
  const ps = canvasTex(512, 160, (g, w, h) => { g.fillStyle = '#2f4a3f'; g.fillRect(0, 0, w, h); g.fillStyle = '#f2efe6'; g.font = '600 72px "IBM Plex Sans Arabic"'; g.textAlign = 'center'; g.fillText('الاستلام', w / 2, 108); });
  const pss = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.34), new THREE.MeshStandardMaterial({map: ps, roughness: 0.6, side: THREE.DoubleSide})); pss.position.set(-3.27, 2.02, -1.28); R.add(pss);
  box(R, 0.05, 1.1, 0.05, M.black, -2.68, 1.6, -1.3);                 // the sign's post, standing on the counter
  MQ.anchors.pickup = P(-3.35, 1.7, -1.25);
  // ---------------------------------------------------------------- seating: round tables, chairs, a sofa, plants
  const [tbl, chair, sofa] = await Promise.all([model('round_wooden_table_01'), model('dining_chair_02'), model('sofa_02')]);
  const tables = [[-3.05, 1.05], [-1.25, 2.95], [-3.4, 2.95], [-0.9, 1.0], [0.75, 2.4]];
  for (const [x, z] of tables) {
    const t = tbl.clone(true); t.scale.set(0.5, 0.75, 0.5); t.position.set(x, 0, z); R.add(t);
  }
  const chairs = [[-3.05, 1.05, -Math.PI / 2, 0.6], [-3.05, 1.05, Math.PI / 2, 0.6], [-1.25, 2.95, Math.PI / 2, 0.6], [-1.25, 2.95, -Math.PI / 2, 0.6], [-3.4, 2.95, Math.PI / 2, 0.6], [-0.9, 1.0, 0, 0.6], [-0.9, 1.0, Math.PI, 0.6], [0.75, 2.4, Math.PI / 2, 0.6], [0.75, 2.4, -Math.PI / 2, 0.6]];
  // (x, z of the table, the way the sitter faces, distance from the table centre)
  for (const [x, z, ry, d] of chairs) { const c = chair.clone(true); c.position.set(x - Math.sin(ry) * d, 0, z - Math.cos(ry) * d); c.rotation.y = ry; R.add(c); }
  const so = sofa.clone(true); so.position.set(-4.62, 0, 2.95); so.rotation.y = Math.PI / 2; so.scale.setScalar(0.95); R.add(so);
  // two real potted plants (the same plant as in the committee room)
  try { const pl = await model('potted_plant_02'); for (const [x, z, s] of [[-4.72, -0.55, 1.5], [-4.65, 3.35, 1.35]]) { const p = pl.clone(true); p.scale.setScalar(s); p.position.set(x, 0.097 * s, z); R.add(p); } } catch (e) { console.warn('plant', e); }
  // ---------------------------------------------------------------- the street: a model-maker's tree at the corner, a lamp post
  cyl(R, 0.05, 0.07, 3.4, M.black, 5.45, 1.7, 5.7, 8);
  const lampHead = box(R, 0.45, 0.1, 0.26, M.lamp, 5.3, 3.4, 5.7); MQ.streetLamp = lampHead;
  // ---------------------------------------------------------------- dial, figures, marks
  buildDial(); buildFigures(); buildMarks(); buildHandoff();
  R.add(MQ.live);
  // anchors (café frame) for hotspots and shots
  Object.assign(MQ.anchors, {center: P(0, 1.0, 0.2), counter: P(0, 1.2, -1.5), door: P(4.2, 1.4, 3.8)});
  // place it on the table: centred, the street side towards the player
  R.scale.setScalar(SCALE);
  R.position.set(TABLE.x - 0.05, TABLE.y + PL.h * SCALE, TABLE.z - 0.02);
  scene.add(R); R.updateMatrixWorld(true);         // (anchors are read before the first render)
  mergeStatic(R, {cell: 30, exclude: [MQ.live, figs, doorG, MQ.dialGroup, ...tickets, ...shelfCups, ...Object.values(marks), mb, ck, pq]});
  setTickets(9); setShelfCups(3);
  return R;
}
function ticketTex(i) {
  return canvasTex(64, 96, (g, w, h) => {
    g.fillStyle = '#fbf8f0'; g.fillRect(0, 0, w, h); g.fillStyle = '#3a3a3a'; g.font = '700 20px Inter'; g.fillText('#' + (41 + i), 6, 22);
    g.fillStyle = '#999'; for (let k = 0; k < 4; k++) g.fillRect(6, 36 + k * 14, 30 + Math.random() * 22, 4);
  });
}
/** world position of a café-frame point (for hotspots / camera shots) */
export function anchor(k) { const a = MQ.anchors[k]; return a ? toWorld(a.x, a.y, a.z) : null; }
