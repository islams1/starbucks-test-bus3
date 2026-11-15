// Street life: roads with markings, traffic lights, moving cars (procedural, clear-coat paint), shops across the road.
// Main road runs east-west in front of the plaza (z 40..52); an avenue runs north-south at x = 42.
import * as THREE from 'three';
import {scene, onUpdate, camera} from '../core/engine.js';
import {M, canvasTex, pbr} from './materials.js';
import * as P from './props.js';
import {tone} from '../core/audio.js';
import {mergeStatic} from './merge.js';
import {col} from './building.js';

export const ROAD = {z0: 40, z1: 52, zc: 46, ax: 42, aw: 8};   // main road band, avenue centre x / width
const root = new THREE.Group(); root.name = 'traffic';

// ---------------------------------------------------------------- traffic signal controller
// phase A: east-west traffic green, pedestrians wait. phase B: north-south traffic + crosswalk pedestrians.
export const signal = {t: 0, phase: 'A', ew: 'green', ns: 'red', walk: false};
const PHASES = [['A', 'green', 'red', false, 14], ['A2', 'yellow', 'red', false, 3], ['R1', 'red', 'red', false, 1.5], ['B', 'red', 'green', true, 11], ['B2', 'red', 'yellow', false, 3], ['R2', 'red', 'red', false, 1.5]];
let pi = 0, pt = 0;
onUpdate((dt) => {
  pt += dt; if (pt > PHASES[pi][4]) { pt = 0; pi = (pi + 1) % PHASES.length; const [ph, ew, ns, walk] = PHASES[pi]; Object.assign(signal, {phase: ph, ew, ns, walk});
    if (ph === 'A' && Math.random() < 0.5 && nearRoad()) honk(); }
});
function nearRoad() { return Math.abs(camera.position.z - ROAD.zc) < 40 && camera.position.y < 30; }
function honk() { const f = 360 + Math.random() * 80; tone([f, f * 1.26], {dur: 0.25, gain: 0.015, type: 'square', delay: 0.6}); }

// ---------------------------------------------------------------- road surface + markings
function buildRoads() {
  const asphalt = pbr('asphalt_02', [0.12, 0.12], {color: 0x6e6e70, roughness: 0.95});
  P.floorPlane(root, 600, ROAD.z1 - ROAD.z0, asphalt, 0, ROAD.zc, 0.01);
  P.floorPlane(root, ROAD.aw, 400, asphalt, ROAD.ax, 30, 0.012);
  // kerbs + sidewalks (near sidewalk z 36..40 joins the plaza; far sidewalk z 52..56)
  const kerb = M.concrete;
  for (const z of [ROAD.z0, ROAD.z1]) { P.box(root, 600, 0.14, 0.3, kerb, 0, 0, z + (z === ROAD.z0 ? -0.15 : 0.15)); }
  P.floorPlane(root, 600, 4, pbr('herringbone_pavement_03', [0.35, 0.35], {color: 0xb7aa98}), 0, 54, 0.12);
  P.floorPlane(root, 600, 4, pbr('herringbone_pavement_03', [0.35, 0.35], {color: 0xb7aa98}), 0, 38, 0.02);
  // markings: centre double yellow, white lane dashes, stop lines, zebra crossings
  const white = new THREE.MeshStandardMaterial({color: 0xe9e7df, roughness: 0.7}), yellow = new THREE.MeshStandardMaterial({color: 0xd9b23a, roughness: 0.7});
  const strip = (w, d, mat, x, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.022, z); m.receiveShadow = true; root.add(m); };
  for (const dz of [-0.12, 0.12]) strip(600, 0.1, yellow, 0, ROAD.zc + dz);
  for (let x = -300; x < 300; x += 9) { if (Math.abs(x - ROAD.ax) < 8 || Math.abs(x) < 4) continue; for (const z of [43, 49]) strip(4, 0.12, white, x + 2, z); }
  for (let z = -170; z < 230; z += 9) { if (Math.abs(z - ROAD.zc) < 9) continue; strip(0.12, 4, white, ROAD.ax, z + 2); }
  for (let z = ROAD.z0 + 0.8; z < ROAD.z1 - 0.5; z += 1.15) strip(3.2, 0.55, white, 0, z);   // zebra crossing in front of the HQ entrance
  // zebra crossings around the intersection
  for (let i = 0; i < 6; i++) { strip(0.5, 2.6, white, ROAD.ax - 2.6 + i * 1.0, ROAD.z0 - 1.6); strip(0.5, 2.6, white, ROAD.ax - 2.6 + i * 1.0, ROAD.z1 + 1.6); }
  // stop lines
  strip(0.35, 5.8, white, ROAD.ax + 6.2, ROAD.zc - 3); strip(0.35, 5.8, white, ROAD.ax - 6.2, ROAD.zc + 3);
  strip(0.35, 5.8, white, 2.2, ROAD.zc - 3); strip(0.35, 5.8, white, -2.2, ROAD.zc + 3);
}

// ---------------------------------------------------------------- traffic lights
const lightMats = [];
function lightHead(parent, pos, facing, which) {
  const g = new THREE.Group(); g.position.copy(pos); parent.add(g); g.lookAt(pos.clone().add(facing));
  P.rbox(g, 0.32, 0.95, 0.28, 0.04, M.darkAlu, 0, 0, 0);
  P.box(g, 0.42, 0.06, 0.24, M.darkAlu, 0, 0.98, 0.1);
  const mk = (c) => new THREE.MeshStandardMaterial({color: 0x111111, emissive: c, emissiveIntensity: 0});
  const r = mk(0xff2a1a), yv = mk(0xffb020), gr = mk(0x30ff7a);
  [[r, 0.77], [yv, 0.47], [gr, 0.17]].forEach(([m, yy]) => { const l = new THREE.Mesh(new THREE.CircleGeometry(0.09, 20), m); l.position.set(0, yy, 0.145); g.add(l); });
  lightMats.push({which, r, y: yv, g: gr});
}
/** pole at (x,z); arm extends along armDir (xz unit) over the lanes; heads face oncoming traffic (facing = direction toward the cars) */
function pole(x, z, armDir, facing, which, armLen = 3.4) {
  const V = (a, b) => new THREE.Vector3(a, 0, b);
  P.cyl(root, 0.09, 0.11, 5.6, M.darkAlu, x, 0, z, 14); col(x - 0.15, x + 0.15, z - 0.15, z + 0.15);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, armLen), M.darkAlu); arm.castShadow = true;
  arm.position.set(x + armDir[0] * armLen / 2, 5.45, z + armDir[1] * armLen / 2); arm.lookAt(x + armDir[0] * armLen, 5.45, z + armDir[1] * armLen); root.add(arm);
  lightHead(root, new THREE.Vector3(x + armDir[0] * (armLen - 0.3), 4.45, z + armDir[1] * (armLen - 0.3)), V(...facing), which);
  lightHead(root, new THREE.Vector3(x + facing[0] * 0.2, 2.3, z + facing[1] * 0.2), V(...facing), which);
}
function buildSignals() {
  // intersection (x = 42, z = 46): one signal per approach
  pole(ROAD.ax + 5.4, ROAD.z0 - 1.2, [0, 1], [1, 0], 'ew');      // westbound traffic arrives from the east
  pole(ROAD.ax - 5.4, ROAD.z1 + 1.2, [0, -1], [-1, 0], 'ew');    // eastbound from the west
  pole(ROAD.ax - 5.4, ROAD.z0 - 1.2, [1, 0], [0, -1], 'ns', 2.6); // southbound from the north
  pole(ROAD.ax + 5.4, ROAD.z1 + 1.2, [-1, 0], [0, 1], 'ns', 2.6); // northbound from the south
  // pedestrian crossing in front of the HQ (x = 0)
  pole(3.0, ROAD.z0 - 1.0, [0, 1], [1, 0], 'ew', 3.0);
  pole(-3.0, ROAD.z1 + 1.0, [0, -1], [-1, 0], 'ew', 3.0);
  // pedestrian signals (walk / don't walk) on both kerbs, facing across the road
  const pedTex = (walk) => canvasTex(64, 64, (c) => { c.fillStyle = '#000'; c.fillRect(0, 0, 64, 64); c.fillStyle = walk ? '#3dff8a' : '#ff3b2a'; c.beginPath(); c.arc(32, 14, 7, 0, 7); c.fill(); c.fillRect(26, 22, 12, 22); if (walk) { c.fillRect(20, 44, 7, 16); c.fillRect(38, 44, 7, 16); } else { c.fillRect(26, 44, 12, 16); } });
  const pedWalk = new THREE.MeshStandardMaterial({map: pedTex(true), emissive: 0xffffff, emissiveMap: pedTex(true), emissiveIntensity: 0});
  const pedStop = new THREE.MeshStandardMaterial({map: pedTex(false), emissive: 0xffffff, emissiveMap: pedTex(false), emissiveIntensity: 1.6});
  for (const [x, z, fz] of [[-1.9, ROAD.z1 + 0.7, -1], [1.9, ROAD.z0 - 0.7, 1]]) {
    P.cyl(root, 0.05, 0.05, 2.6, M.darkAlu, x, 0, z);
    const g = new THREE.Group(); g.position.set(x, 2.45, z); root.add(g); g.lookAt(x, 2.45, z + fz);
    P.box(g, 0.3, 0.6, 0.18, M.darkAlu, 0, -0.3, 0);
    const a2 = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.24), pedStop); a2.position.set(0, 0.13, 0.095); g.add(a2);
    const b2 = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.24), pedWalk); b2.position.set(0, -0.15, 0.095); g.add(b2);
  }
  onUpdate(() => {
    for (const L of lightMats) { const st = signal[L.which]; L.r.emissiveIntensity = st === 'red' ? 3 : 0; L.y.emissiveIntensity = st === 'yellow' ? 3 : 0; L.g.emissiveIntensity = st === 'green' ? 3 : 0; }
    pedWalk.emissiveIntensity = signal.walk ? 1.8 : 0; pedStop.emissiveIntensity = signal.walk ? 0 : 1.6;
  });
}

// ---------------------------------------------------------------- procedural cars
const PAINTS = [0xf2f2f0, 0xc9cbcd, 0x1b1c1e, 0x5a5e63, 0x1d2c4a, 0x7a1414, 0xb9ad94, 0x2f4a3f, 0xe9e6dc, 0x8a8f94];
const glassMat = new THREE.MeshPhysicalMaterial({color: 0x0b0f12, metalness: 0.0, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0.55});
const trimMat = new THREE.MeshStandardMaterial({color: 0x101112, roughness: 0.7});
const tyreMat = new THREE.MeshStandardMaterial({color: 0x161616, roughness: 0.9});
const rimMat = new THREE.MeshStandardMaterial({color: 0xb8bcc0, metalness: 0.9, roughness: 0.3});
const chromeMat = new THREE.MeshStandardMaterial({color: 0x222326, metalness: 0.6, roughness: 0.4});
const paintCache = new Map();
function paint(c) { if (!paintCache.has(c)) paintCache.set(c, new THREE.MeshPhysicalMaterial({color: c, metalness: 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.2})); return paintCache.get(c); }
const TYPES = {
  sedan: {L: 4.6, W: 1.82, prof: [[0, 0.3], [0, 0.62], [0.12, 0.74], [0.95, 0.84], [1.55, 0.98], [2.15, 1.42], [3.25, 1.42], [3.85, 1.02], [4.45, 0.98], [4.6, 0.86], [4.6, 0.3]], belt: 1.0, wb: 2.7},
  hatch: {L: 4.05, W: 1.76, prof: [[0, 0.3], [0, 0.62], [0.12, 0.74], [0.8, 0.86], [1.35, 1.0], [1.95, 1.45], [3.65, 1.45], [3.98, 1.12], [4.05, 0.9], [4.05, 0.3]], belt: 1.0, wb: 2.5},
  suv: {L: 4.75, W: 1.9, prof: [[0, 0.38], [0, 0.78], [0.1, 0.92], [0.85, 1.04], [1.45, 1.16], [1.95, 1.72], [4.35, 1.74], [4.7, 1.3], [4.75, 1.05], [4.75, 0.38]], belt: 1.18, wb: 2.8},
  van: {L: 5.2, W: 1.95, prof: [[0, 0.36], [0, 0.85], [0.15, 1.05], [0.75, 1.3], [1.15, 2.0], [5.15, 2.05], [5.2, 1.9], [5.2, 0.36]], belt: 1.3, wb: 3.2},
  bus: {L: 11.5, W: 2.5, prof: [[0, 0.35], [0, 2.75], [0.15, 3.0], [11.35, 3.0], [11.5, 2.8], [11.5, 0.35]], belt: 1.25, wb: 6.0},
};
const geoCache = new Map();
function profileGeo(pts, w, bevel) {
  const s = new THREE.Shape(); pts.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {depth: w - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 4});
  g.translate(0, 0, -(w - bevel * 2) / 2); g.computeVertexNormals(); return g;
}
function carGeos(type) {
  if (geoCache.has(type)) return geoCache.get(type);
  const T = TYPES[type];
  const lower = T.prof.map(([x, y]) => [x, Math.min(y, T.belt)]);
  const upper = T.prof.filter(([, y]) => y >= T.belt - 0.001);
  // cabin outline: from the profile points above the belt line, closed along the belt
  const cab = [[upper[0][0], T.belt], ...upper, [upper[upper.length - 1][0], T.belt]];
  const res = {lower: profileGeo(dedupe(lower), T.W, 0.07), cabin: profileGeo(cab, T.W * 0.9, 0.05), roof: null, T};
  // shape: plan-view taper at both ends + tumblehome (cabin narrows towards the roof)
  const top = Math.max(...T.prof.map(p => p[1]));
  const shapeIt = (g, tumble) => { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const e = Math.abs(x - T.L / 2) / (T.L / 2); let k = 1 - 0.1 * Math.pow(e, 4);
      if (tumble && y > T.belt) k *= 1 - 0.16 * (y - T.belt) / Math.max(0.1, top - T.belt);
      p.setZ(i, z * k); } p.needsUpdate = true; g.computeVertexNormals(); };
  if (type !== 'bus') { shapeIt(res.lower, false); shapeIt(res.cabin, true); }
  if (type === 'bus') res.cabin = profileGeo([[0.1, T.belt], [0.1, 2.6], [11.4, 2.6], [11.4, T.belt]], T.W * 1.004, 0.03);
  geoCache.set(type, res); return res;
}
function dedupe(p) { return p.filter((q, i) => i === 0 || q[0] !== p[i - 1][0] || q[1] !== p[i - 1][1]); }
const wheelGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 20); wheelGeo.rotateX(Math.PI / 2);
const rimGeo = new THREE.CylinderGeometry(0.21, 0.21, 0.25, 12); rimGeo.rotateX(Math.PI / 2);
const headMat = new THREE.MeshStandardMaterial({color: 0xffffff, emissive: 0xfff2d0, emissiveIntensity: 0.35});
const archGeo = new THREE.TorusGeometry(0.4, 0.05, 6, 16, Math.PI);
export function makeCar(type = 'sedan', color = 0xffffff, taxi = false) {
  const G = carGeos(type), T = G.T;
  const car = new THREE.Group();
  const body = new THREE.Group(); body.position.x = -T.L / 2; car.add(body);   // origin at car centre, +x forward
  const lower = new THREE.Mesh(G.lower, paint(color)); lower.castShadow = true; lower.receiveShadow = true; body.add(lower);
  const cabin = new THREE.Mesh(G.cabin, glassMat); cabin.castShadow = true; body.add(cabin);
  if (type !== 'bus') { const roofP = T.prof.filter(([, y]) => y > T.belt + 0.35); if (roofP.length >= 2) { const x0 = roofP[0][0] + 0.12, x1 = roofP[roofP.length - 1][0] - 0.12, y = Math.max(...roofP.map(p => p[1])); const roof = P.rbox(body, x1 - x0, 0.07, T.W * 0.76, 0.03, paint(color), (x0 + x1) / 2, y - 0.045, 0); roof.castShadow = true; } }
  else { P.box(body, T.L - 0.1, 0.4, T.W * 1.006, paint(color), T.L / 2, 2.6, 0); P.box(body, 1.0, 1.6, T.W * 1.01, glassMat, 0.55, 1.1, 0); }
  // pillars (B-pillar) for cars
  if (type !== 'bus' && type !== 'van') P.box(body, 0.1, 0.4, T.W * 0.905, chromeMat, T.prof[Math.floor(T.prof.length / 2)][0] + 0.2, T.belt + 0.02, 0);
  // lights
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.34), headMat); h.position.set(T.L + 0.01, T.belt - 0.28, s * (T.W / 2 - 0.3)); body.add(h);
  }
  const tail = new THREE.MeshStandardMaterial({color: 0x400000, emissive: 0xff1a0a, emissiveIntensity: 0.6});
  for (const s of [-1, 1]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.32), tail); t.position.set(-0.01, T.belt - 0.22, s * (T.W / 2 - 0.28)); body.add(t); }
  if (taxi) { const sign = P.box(body, 0.5, 0.16, 0.28, new THREE.MeshStandardMaterial({color: 0xffd23a, emissive: 0xffc000, emissiveIntensity: 0.4}), T.L * 0.5, Math.max(...T.prof.map(p => p[1])), 0); sign.castShadow = false; }
  // black wheel arches + side skirts
  for (const xa of [T.L / 2 - T.wb / 2, T.L / 2 + T.wb / 2]) for (const s of [-1, 1]) { const arch = new THREE.Mesh(archGeo, trimMat); arch.position.set(xa, 0.33, s * (T.W / 2 - 0.04)); body.add(arch); }
  for (const s of [-1, 1]) P.box(body, T.L - 0.5, 0.1, 0.04, trimMat, T.L / 2, 0.3, s * (T.W / 2 - 0.02), 0, {cast: false});
  // wheels
  const wheels = [];
  const ax = [T.L / 2 - T.wb / 2, T.L / 2 + T.wb / 2];
  for (const x of ax) for (const s of [-1, 1]) {
    const w = new THREE.Group(); w.position.set(x, 0.33, s * (T.W / 2 - 0.12)); body.add(w);
    const t = new THREE.Mesh(wheelGeo, tyreMat); t.castShadow = true; w.add(t); const r = new THREE.Mesh(rimGeo, rimMat); w.add(r); wheels.push(w);
  }
  car.userData = {wheels, tail, T};
  return car;
}

// ---------------------------------------------------------------- moving traffic
const lanes = [
  {axis: 'x', dir: -1, c: 43.0, from: 230, to: -230, stopLines: [[ROAD.ax + 6.4, 'ew'], [2.4, 'ew']]},       // westbound (north side)
  {axis: 'x', dir: -1, c: 44.9, from: 230, to: -230, stopLines: [[ROAD.ax + 6.4, 'ew'], [2.4, 'ew']]},
  {axis: 'x', dir: 1, c: 47.1, from: -230, to: 230, stopLines: [[ROAD.ax - 6.4, 'ew'], [-2.4, 'ew']]},              // eastbound
  {axis: 'x', dir: 1, c: 49.1, from: -230, to: 230, stopLines: [[ROAD.ax - 6.4, 'ew'], [-2.4, 'ew']]},
  {axis: 'z', dir: 1, c: ROAD.ax - 2, from: -170, to: 230, stopLines: [[ROAD.z0 - 3.2, 'ns']]},                      // southbound
  {axis: 'z', dir: -1, c: ROAD.ax + 2, from: 230, to: -170, stopLines: [[ROAD.z1 + 3.2, 'ns']]},                     // northbound
];
const cars = [];
const carRoot = new THREE.Group(); carRoot.name = 'cars';
function spawnTraffic() {
  let k = 0;
  lanes.forEach((ln, li) => {
    const n = ln.axis === 'x' ? 4 : 3;
    for (let i = 0; i < n; i++) {
      const r = (k * 7919) % 100 / 100; k++;
      const type = li === 2 && i === 0 ? 'bus' : r < 0.45 ? 'sedan' : r < 0.65 ? 'hatch' : r < 0.85 ? 'suv' : 'van';
      const taxi = type === 'sedan' && r > 0.3 && r < 0.4;
      const car = makeCar(type, taxi ? 0xf2f2f0 : PAINTS[k % PAINTS.length], taxi);
      const span = Math.abs(ln.to - ln.from);
      const s = (i / n) * span + r * 20;
      const v = (type === 'bus' ? 9 : 11 + r * 4);
      cars.push({car, ln, s, v, vmax: v, len: car.userData.T.L});
      carRoot.add(car);
    }
  });
  // parked cars along the far kerb
  for (let i = 0; i < 6; i++) { const c = makeCar(['sedan', 'hatch', 'suv'][i % 3], PAINTS[(i * 3 + 1) % PAINTS.length]); c.position.set(-28 + i * 6.2 + (i > 3 ? 14 : 0), 0, 51.0); c.rotation.y = 0; carRoot.add(c); }
}
const _p = new THREE.Vector3();
function updateTraffic(dt) {
  if (dt <= 0) return;
  // per lane order by progress
  for (const ln of lanes) {
    const list = cars.filter(c => c.ln === ln).sort((a, b) => b.s - a.s);
    list.forEach((c, i) => {
      const ahead = i > 0 ? list[i - 1] : null;
      let target = c.vmax;
      const pos = ln.from + ln.dir * c.s;   // coordinate along axis
      // car ahead
      if (ahead) { const gap = ahead.s - c.s - ahead.len / 2 - c.len / 2; if (gap < 30) target = Math.min(target, Math.max(0, (gap - 2.5) * 0.9)); }
      // signals
      for (const [line, which] of ln.stopLines) {
        const dist = (line - pos) * ln.dir - c.len / 2;   // distance from front bumper to stop line
        const st = signal[which];
        if (dist > -0.5 && dist < 45 && (st === 'red' || (st === 'yellow' && dist > 8))) target = Math.min(target, Math.max(0, (dist - 0.6) * 0.8));
      }
      const acc = target > c.v ? 2.2 : 6.5;
      c.v += Math.sign(target - c.v) * Math.min(Math.abs(target - c.v), acc * dt);
      c.s += c.v * dt;
      const span = Math.abs(ln.to - ln.from);
      if (c.s > span) c.s -= span;
      const p = ln.from + ln.dir * c.s;
      if (ln.axis === 'x') { c.car.position.set(p, 0, ln.c); c.car.rotation.y = ln.dir > 0 ? 0 : Math.PI; }
      else { c.car.position.set(ln.c, 0, p); c.car.rotation.y = ln.dir > 0 ? -Math.PI / 2 : Math.PI / 2; }
      for (const w of c.car.userData.wheels) w.rotation.z -= c.v * dt / 0.33;
      c.car.userData.tail.emissiveIntensity = c.v < target - 0.5 || c.v < 0.3 ? 2.4 : 0.6;   // brake lights
    });
  }
}

// ---------------------------------------------------------------- shops across the road (fictional names)
function shopFront(x, w, name, color, kind, floors = 3) {
  const z = 58, d = 10;
  const g = P.group(root, x, 0, z + d / 2);
  const facade = pbr('painted_plaster_wall', [0.4, 0.4], {color});
  P.box(g, w, floors * 3.4, d, facade, 0, 0, 0);
  // upper windows with balconies
  const win = new THREE.MeshStandardMaterial({color: 0x1d2328, metalness: 0.4, roughness: 0.1, envMapIntensity: 1.2});
  for (let f = 1; f < floors; f++) for (let i = 0; i < Math.floor(w / 2.6); i++) {
    const wx = -w / 2 + 1.3 + i * 2.6;
    P.box(g, 1.3, 1.6, 0.06, win, wx, f * 3.4 + 0.9, -d / 2 - 0.02);
    P.box(g, 1.6, 0.08, 0.6, M.concrete, wx, f * 3.4 + 0.75, -d / 2 - 0.3);
    P.box(g, 1.6, 0.6, 0.03, M.darkAlu, wx, f * 3.4 + 0.83, -d / 2 - 0.6);
  }
  // shop window with a warm lit interior
  const inter = canvasTex(512, 256, (c, W, H) => {
    const gr = c.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#5a3b22'); gr.addColorStop(1, '#2a1a10'); c.fillStyle = gr; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 7; i++) { c.fillStyle = `rgba(255,${190 + i * 6},120,.85)`; c.beginPath(); c.arc(40 + i * 70, 30, 9, 0, 7); c.fill(); }
    c.fillStyle = kind === 'bakery' ? '#c48a4a' : kind === 'pharmacy' ? '#e6efe9' : kind === 'books' ? '#7a2d24' : '#8a5a3a';
    for (let i = 0; i < 6; i++) c.fillRect(30 + i * 80, 120 + (i % 2) * 10, 60, 70);
    c.fillStyle = 'rgba(0,0,0,.35)'; for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(120 + i * 150, 200, 14, 34, 0, 0, 7); c.fill(); }
  });
  const sw = new THREE.Mesh(new THREE.PlaneGeometry(w - 1.2, 2.5), new THREE.MeshStandardMaterial({map: inter, emissive: 0xffffff, emissiveMap: inter, emissiveIntensity: 0.55, roughness: 0.2}));
  sw.position.set(0, 1.55, -d / 2 - 0.03); sw.rotation.y = Math.PI; g.add(sw);
  P.box(g, w - 1.0, 0.12, 0.12, M.darkAlu, 0, 2.85, -d / 2 - 0.05);
  // awning
  const aw = new THREE.Mesh(new THREE.BoxGeometry(w - 0.6, 0.06, 1.6), new THREE.MeshStandardMaterial({color: kind === 'pharmacy' ? 0x2f6b4c : kind === 'bakery' ? 0x8a2d24 : kind === 'books' ? 0x23415f : 0x5b3a1e, roughness: 0.9}));
  aw.position.set(0, 3.05, -d / 2 - 0.75); aw.rotation.x = -0.28; aw.castShadow = true; g.add(aw);
  // sign
  const sign = canvasTex(1024, 160, (c, W, H) => { c.fillStyle = '#1b1b1b'; c.fillRect(0, 0, W, H); c.fillStyle = '#f3e7cf'; c.font = '700 84px "IBM Plex Sans Arabic"'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(name, W / 2, H / 2 + 4); });
  const sm = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w - 1.5, 6), 0.9), new THREE.MeshStandardMaterial({map: sign, emissive: 0xffffff, emissiveMap: sign, emissiveIntensity: 0.25}));
  sm.position.set(0, 3.55, -d / 2 - 0.05); sm.rotation.y = Math.PI; g.add(sm);
}
function buildShops() {
  shopFront(-26, 12, 'مخبز النخلة', 0xcdb08a, 'bakery', 3);
  shopFront(-13, 12, 'صيدلية الشفاء', 0xd9cbb2, 'pharmacy', 4);
  shopFront(0, 12, 'مقهى الزاوية', 0xb98f6a, 'cafe', 3);
  shopFront(13, 12, 'مكتبة الحي', 0xc7b79d, 'books', 4);
  shopFront(26, 12, 'بقالة السوق', 0xd3c0a0, 'cafe', 3);
  // café tables on the far sidewalk
  for (let i = 0; i < 3; i++) {
    const x = -2.5 + i * 2.5, z = 55.2;
    P.cyl(root, 0.4, 0.4, 0.03, M.oak, x, 0.74, z, 24); P.cyl(root, 0.04, 0.05, 0.74, M.darkAlu, x, 0, z);
    for (const s of [-1, 1]) P.taskChair(root, x + s * 0.65, z, s > 0 ? -Math.PI / 2 : Math.PI / 2, M.fabricSand);
  }
  // bus stop on the near sidewalk
  const bs = P.group(root, -14, 0, 38.6, Math.PI); col(-15.9, -12.1, 38.0, 39.4);
  P.box(bs, 3.6, 0.08, 1.4, M.darkAlu, 0, 2.5, 0); for (const sx of [-1.7, 1.7]) P.box(bs, 0.08, 2.5, 0.08, M.darkAlu, sx, 0, -0.6);
  const bg = P.box(bs, 3.4, 2.1, 0.03, M.glass, 0, 0.35, -0.65, 0, {cast: false}); bg.renderOrder = 2;
  P.box(bs, 3.0, 0.06, 0.4, M.oak, 0, 0.45, -0.4);
}

// ---------------------------------------------------------------- fill the surrounding blocks so the city never ends in empty ground
function buildFill() {
  const facadeTex = (seed, hue, light) => canvasTex(256, 512, (c, W, H) => {
    let r = seed * 7919; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
    c.fillStyle = `hsl(${hue},${light ? 18 : 10}%,${light ? 62 : 26}%)`; c.fillRect(0, 0, W, H);
    const cols = 5, rows = 12;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const lit = rnd() < 0.12;
      c.fillStyle = lit ? 'rgba(255,226,170,.85)' : `rgba(${20 + rnd() * 30},${30 + rnd() * 30},${40 + rnd() * 30},1)`;
      c.fillRect(x * W / cols + 9, y * H / rows + 8, W / cols - 18, H / rows - 18);
      if (light && rnd() < 0.5) { c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x * W / cols + 5, y * H / rows + H / rows - 10, W / cols - 10, 4); }
    }
  });
  const mats = [];
  for (let i = 0; i < 6; i++) { const light = i % 2 === 0; const t = facadeTex(i + 11, [30, 25, 200, 35, 210, 20][i], light); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    mats.push(new THREE.MeshStandardMaterial({map: t, roughness: light ? 0.85 : 0.3, metalness: light ? 0 : 0.5, envMapIntensity: light ? 0.6 : 1.1, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.03})); }
  const blocked = (x, z, hw, hd) => {
    const boxes = [[-38, 38, -32, 58], [-40, 40, 36, 74], [-400, 400, 36, 57.5], [ROAD.ax - 8, ROAD.ax + 8, -400, 400], [-60, 30, -64, -32], [-60, -32, -36, 36]];
    return boxes.some(([x0, x1, z0, z1]) => x + hw > x0 && x - hw < x1 && z + hd > z0 && z - hd < z1);
  };
  let k = 0;
  for (let gx = -150; gx <= 150; gx += 26) for (let gz = -110; gz <= 170; gz += 26) {
    const w = 16 + ((k * 37) % 8), d = 16 + ((k * 53) % 8); k++;
    if (blocked(gx, gz, w / 2 + 2, d / 2 + 2)) continue;
    const near = Math.hypot(gx, gz - 40) < 90;
    const h = near ? 10 + ((k * 29) % 18) : 18 + ((k * 31) % 50);
    const m = mats[k % mats.length].clone(); m.map = m.map.clone(); m.map.repeat.set(Math.max(1, Math.round(w / 9)), Math.max(1, Math.round(h / 14))); m.map.needsUpdate = true; m.emissiveMap = m.map;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(gx, h / 2, gz); b.castShadow = true; b.receiveShadow = true; root.add(b);
    P.box(root, w + 0.4, 0.8, d + 0.4, M.roof, gx, h, gz);
  }
  // sidewalks along the avenue
  P.floorPlane(root, 3, 500, pbr('herringbone_pavement_03', [0.35, 0.35], {color: 0xb7aa98}), ROAD.ax - ROAD.aw / 2 - 1.5, 30, 0.1);
  P.floorPlane(root, 3, 500, pbr('herringbone_pavement_03', [0.35, 0.35], {color: 0xb7aa98}), ROAD.ax + ROAD.aw / 2 + 1.5, 30, 0.1);
}

export async function buildTraffic() {
  scene.add(root); scene.add(carRoot);
  buildRoads(); buildSignals(); buildShops(); buildFill(); spawnTraffic();
  console.info('street merge', mergeStatic(root, {cell: 60}));
  onUpdate((dt) => updateTraffic(dt));
  return root;
}
