// The street outside the north windows: a real space with depth (it moves correctly as you walk), not a photo at
// infinity. Our pavement (concrete pavers), a granite-like curb, an asphalt road with its markings and a manhole, the
// far pavement, and a row of buildings opposite with real openings — reveals, sills, frames and glass that reflects
// the sky — over a ground floor of shopfronts and roller shutters. Street trees, lamps, a hydrant, a bench, planters,
// a utility box and a parked car under its cover are scanned models (Poly Haven, CC0). Outside, the materials are lit
// by the open sky (their own environment), so the street reads as daylight seen from a softer interior.
import * as THREE from 'three';
import {model} from '../core/assets.js';
import {pbr} from './materials.js';
import {ROOM} from './workshop.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
let seed = 23; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
export const street = new THREE.Group(); street.name = 'street';
const Z = {wall: ROOM.z0 - 0.3, kerb: -8.0, road: -16.0, far: -19.6};      // our facade, kerb line, far kerb, far facades

// ---------------------------------------------------------------- a geometry builder (one mesh per material)
class Builder {
  constructor() { this.p = []; this.n = []; this.uv = []; }
  /** a quad from 4 corners (counter-clockwise seen from the front), UVs from the given 2D coords */
  quad(a, b, c, d, ua, ub, uc, ud) {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a)).normalize();
    for (const [p, u] of [[a, ua], [b, ub], [c, uc], [a, ua], [c, uc], [d, ud]]) { this.p.push(p.x, p.y, p.z); this.n.push(n.x, n.y, n.z); this.uv.push(u[0], u[1]); }
  }
  /** a rectangle in the plane z = const facing +z (x0..x1, y0..y1); UVs in metres / tile */
  front(x0, x1, y0, y1, z, t = 1, ox = 0) { this.quad(V(x0, y0, z), V(x1, y0, z), V(x1, y1, z), V(x0, y1, z), [(x0 + ox) / t, y0 / t], [(x1 + ox) / t, y0 / t], [(x1 + ox) / t, y1 / t], [(x0 + ox) / t, y1 / t]); }
  /** an axis-aligned box (all six faces), UVs in metres / tile */
  box(cx, cy, cz, w, h, d, t = 1, noFront = false) {
    const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    if (!noFront) this.quad(V(x0, y0, z1), V(x1, y0, z1), V(x1, y1, z1), V(x0, y1, z1), [x0 / t, y0 / t], [x1 / t, y0 / t], [x1 / t, y1 / t], [x0 / t, y1 / t]);   // +z
    this.quad(V(x1, y0, z0), V(x0, y0, z0), V(x0, y1, z0), V(x1, y1, z0), [x1 / t, y0 / t], [x0 / t, y0 / t], [x0 / t, y1 / t], [x1 / t, y1 / t]);   // −z
    this.quad(V(x1, y0, z1), V(x1, y0, z0), V(x1, y1, z0), V(x1, y1, z1), [z1 / t, y0 / t], [z0 / t, y0 / t], [z0 / t, y1 / t], [z1 / t, y1 / t]);   // +x
    this.quad(V(x0, y0, z0), V(x0, y0, z1), V(x0, y1, z1), V(x0, y1, z0), [z0 / t, y0 / t], [z1 / t, y0 / t], [z1 / t, y1 / t], [z0 / t, y1 / t]);   // −x
    this.quad(V(x0, y1, z1), V(x1, y1, z1), V(x1, y1, z0), V(x0, y1, z0), [x0 / t, z1 / t], [x1 / t, z1 / t], [x1 / t, z0 / t], [x0 / t, z0 / t]);   // +y
    this.quad(V(x0, y0, z0), V(x1, y0, z0), V(x1, y0, z1), V(x0, y0, z1), [x0 / t, z0 / t], [x1 / t, z0 / t], [x1 / t, z1 / t], [x0 / t, z1 / t]);   // −y
  }
  /** a horizontal rectangle (facing up) at height y */
  flat(x0, x1, z0, z1, y, t = 1) { this.quad(V(x0, y, z1), V(x1, y, z1), V(x1, y, z0), V(x0, y, z0), [x0 / t, -z1 / t], [x1 / t, -z1 / t], [x1 / t, -z0 / t], [x0 / t, -z0 / t]); }
  mesh(mat, {cast = true, recv = true} = {}) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    const m = new THREE.Mesh(g, mat); m.castShadow = cast; m.receiveShadow = recv; street.add(m); return m;
  }
}

// ---------------------------------------------------------------- materials (lit by the sky outside)
let SKY = null;
const outside = (m) => { if (SKY) { m.envMap = SKY; m.envMapIntensity = 1.0; } return m; };
const tile = (name, extra) => outside(pbr(name, [1, 1], extra));
const std = (c, r = 0.8, extra = {}) => outside(new THREE.MeshStandardMaterial({color: c, roughness: r, ...extra}));

// ---------------------------------------------------------------- the buildings opposite
const FACADES = [
  {tex: 'red_brick_03', t: 2.2, col: 0xffffff}, {tex: 'brick_wall_005', t: 2.0, col: 0xf0e6dc}, {tex: 'plastered_wall', t: 3.0, col: 0xe8dcc6},
  {tex: 'concrete_tile_facade', t: 3.2, col: 0xd9d9d6}, {tex: 'plastered_wall', t: 3.0, col: 0xc9cdd1}, {tex: 'red_brick_03', t: 2.2, col: 0xe6cfc0},
];
const ROW = [   // x0, x1, floors, facade, kind
  [-62, -47, 5, 0, 'flats'], [-47, -37, 3, 2, 'flats'], [-37, -23, 6, 3, 'office'], [-23, -11, 4, 1, 'flats'], [-11, 2, 5, 4, 'flats'],
  [2, 15, 3, 5, 'works'], [15, 27, 6, 3, 'office'], [27, 40, 4, 0, 'flats'], [40, 62, 5, 2, 'flats'],
];
function buildings(B) {
  const z = Z.far, fh = 3.3, g0 = 4.0;
  const walls = FACADES.map(() => new Builder()), reveal = new Builder(), frames = new Builder(), sills = new Builder(), roof = new Builder(), glassA = new Builder(), glassB = new Builder(), shop = new Builder();
  const shutters = [];
  for (const [x0, x1, floors, fi, kind] of ROW) {
    const W = walls[fi], F = FACADES[fi], top = g0 + (floors - 1) * fh, w = x1 - x0;
    // the body behind the face (sides and back seen between buildings of different heights) and the roof
    W.box((x0 + x1) / 2, top / 2, z - 7, w - 0.02, top, 14, F.t, true);
    roof.flat(x0, x1, z - 14, z, top + 0.002, 4);
    // a parapet and a cornice line
    sills.box((x0 + x1) / 2, top + 0.35, z + 0.1, w, 0.7, 0.35, 1);
    sills.box((x0 + x1) / 2, top - 0.12, z + 0.14, w, 0.14, 0.3, 1);
    // windows: columns across the bay, rows per floor
    const ww = kind === 'works' ? 2.4 : kind === 'office' ? 1.8 : 1.25, wh = kind === 'works' ? 2.0 : kind === 'office' ? 1.9 : 1.55;
    const pitch = kind === 'works' ? 3.2 : kind === 'office' ? 2.4 : 2.1, n = Math.max(1, Math.floor((w - 1.2) / pitch)), m0 = x0 + (w - n * pitch) / 2;
    const xs = Array.from({length: n}, (_, i) => m0 + pitch * (i + 0.5));
    const f = 0.004;                                   // the face stands just in front of the body
    for (let fl = 0; fl < floors; fl++) {
      const yb = fl === 0 ? 0 : g0 + (fl - 1) * fh, yt = fl === 0 ? g0 : yb + fh;
      if (fl === 0) {
        // the ground floor: shopfronts (a big window and a door) or roller shutters
        const sw = Math.min(w - 1.2, 3.4), cells = Math.max(1, Math.floor((w - 0.8) / (sw + 0.8)));
        const c0 = x0 + (w - cells * (sw + 0.8)) / 2 + 0.4;
        let cur = x0;
        for (let c = 0; c < cells; c++) {
          const a = c0 + c * (sw + 0.8), b = a + sw;
          W.front(cur, a, yb, yt, z + f, F.t); W.front(a, b, 3.0, yt, z + f, F.t); cur = b;
          if ((c + Math.round(x0)) % 3 === 0) { shutters.push([(a + b) / 2, z - 0.05, sw]); W.front(a, b, yb, 3.0, z - 0.2, F.t); }
          else {
            for (const [q0, q1, r0, r1] of [[a, b, 2.95, 3.0], [a, a + 0.06, yb, 3.0], [b - 0.06, b, yb, 3.0], [a, b, yb, 0.45]]) frames.front(q0, q1, r0, r1, z - 0.15, 1);
            frames.front(a + sw * 0.62, a + sw * 0.62 + 0.06, yb, 3.0, z - 0.15, 1);
            shop.front(a + 0.06, b - 0.06, 0.45, 2.95, z - 0.16, 1);
          }
          for (const [q0, q1, r0, r1, s] of [[a, a, yb, 3.0, 1], [b, b, yb, 3.0, -1]]) reveal.quad(V(q0, r0, z + f), V(q0, r0, z - 0.2), V(q0, r1, z - 0.2), V(q0, r1, z + f), [0, r0], [0.2, r0], [0.2, r1], [0, r1]);
          reveal.quad(V(a, 3.0, z + f), V(b, 3.0, z + f), V(b, 3.0, z - 0.2), V(a, 3.0, z - 0.2), [a, 0], [b, 0], [b, 0.2], [a, 0.2]);
        }
        W.front(cur, x1, yb, yt, z + f, F.t);
        continue;
      }
      const sy = yb + 0.85, ty = sy + wh;
      W.front(x0, x1, yb, sy, z + f, F.t); W.front(x0, x1, ty, yt, z + f, F.t);
      let cur = x0;
      for (const cx of xs) {
        const a = cx - ww / 2, b = cx + ww / 2;
        W.front(cur, a, sy, ty, z + f, F.t); cur = b;
        // the reveal (wall thickness), the sill, the frame and a mullion, the glass set back
        const d = 0.22;
        reveal.quad(V(a, sy, z + f), V(a, sy, z - d), V(a, ty, z - d), V(a, ty, z + f), [0, sy], [d, sy], [d, ty], [0, ty]);
        reveal.quad(V(b, sy, z - d), V(b, sy, z + f), V(b, ty, z + f), V(b, ty, z - d), [d, sy], [0, sy], [0, ty], [d, ty]);
        reveal.quad(V(a, ty, z + f), V(b, ty, z + f), V(b, ty, z - d), V(a, ty, z - d), [a, 0], [b, 0], [b, d], [a, d]);
        sills.box(cx, sy - 0.03, z + 0.03, ww + 0.12, 0.06, 0.32, 1);
        const fz = z - d + 0.02, fw = 0.055;
        frames.front(a, b, ty - fw, ty, fz, 1); frames.front(a, b, sy, sy + fw, fz, 1); frames.front(a, a + fw, sy, ty, fz, 1); frames.front(b - fw, b, sy, ty, fz, 1);
        frames.front(cx - fw / 2, cx + fw / 2, sy, ty, fz, 1);
        if (kind !== 'office') frames.front(a, b, sy + wh * 0.68, sy + wh * 0.68 + fw * 0.8, fz, 1);
        (rnd() < 0.35 ? glassB : glassA).front(a + fw, b - fw, sy + fw, ty - fw, fz - 0.01, 1);
      }
      W.front(cur, x1, sy, ty, z + f, F.t);
    }
  }
  FACADES.forEach((F, i) => walls[i].mesh(tile(F.tex, {color: F.col, roughness: 0.92})));
  reveal.mesh(std(0xcfc8bc, 0.9, {side: THREE.DoubleSide})); sills.mesh(tile('brushed_concrete', {color: 0xd9d6cf, roughness: 0.8})); roof.mesh(std(0x5b5e62, 0.9), {cast: false});
  frames.mesh(std(0x2c2f33, 0.45, {metalness: 0.4}));
  // glass that reflects the sky: dark, and some with light curtains behind
  glassA.mesh(outside(new THREE.MeshStandardMaterial({color: 0x0f1418, roughness: 0.04, metalness: 0.2, envMapIntensity: 1.7})), {cast: false});
  glassB.mesh(outside(new THREE.MeshStandardMaterial({color: 0x4a443b, roughness: 0.08, metalness: 0.1, envMapIntensity: 1.2})), {cast: false});
  shop.mesh(outside(new THREE.MeshStandardMaterial({color: 0x1b2024, roughness: 0.05, metalness: 0.2, envMapIntensity: 1.5})), {cast: false});
  return shutters;
}

// ---------------------------------------------------------------- the ground: pavements, kerbs, the road
function ground() {
  const X0 = -70, X1 = 70;
  const pav = new Builder(); pav.flat(X0, X1, Z.kerb, Z.wall, -0.02, 1); pav.flat(X0, X1, Z.far, Z.road, -0.02, 1);
  pav.mesh(tile('concrete_pavers', {color: 0xdedbd5, roughness: 0.9}), {cast: false});
  const kerb = new Builder();
  for (const [z, s] of [[Z.kerb, -1], [Z.road, 1]]) { kerb.box(0, -0.08, z + s * 0.12, X1 - X0, 0.15, 0.24, 1); }
  kerb.mesh(tile('brushed_concrete', {color: 0xc9c6bf, roughness: 0.75}));
  const road = new Builder(); road.flat(X0, X1, Z.road + 0.24, Z.kerb - 0.24, -0.15, 1);
  road.mesh(tile('asphalt_02', {color: 0x9a9a9a, roughness: 0.95}), {cast: false});
  // the markings: a dashed centre line, two edge lines (worn paint)
  const paint = new Builder(), zc = (Z.kerb + Z.road) / 2;
  for (let x = X0; x < X1; x += 6) paint.flat(x, x + 3, zc - 0.06, zc + 0.06, -0.147, 1);
  paint.flat(X0, X1, Z.kerb - 0.62, Z.kerb - 0.5, -0.147, 1); paint.flat(X0, X1, Z.road + 0.5, Z.road + 0.62, -0.147, 1);
  paint.mesh(std(0xd8d6cf, 0.85, {transparent: true, opacity: 0.85}), {cast: false});
  // the base of our own building, outside the windows
  const plinth = new Builder(); plinth.front(ROOM.x0 - 3, ROOM.x1 + 3, -0.02, 0.6, Z.wall, 1);
  plinth.mesh(tile('brushed_concrete', {color: 0xb8b5ae, roughness: 0.85}));
}

// ---------------------------------------------------------------- the street furniture (scanned models)
const drop = (o, names) => { const kill = []; o.traverse(m => { if (m.isMesh && names.some(n => m.name.includes(n))) kill.push(m); }); kill.forEach(m => m.removeFromParent()); return o; };
const put = (o, x, y, z, ry = 0, s = 1) => { o.position.set(x, y, z); o.rotation.y = ry; o.scale.multiplyScalar(s); street.add(o); return o; };
async function furniture(shutters) {
  const [lamp, tree, hydrant, car, box, cover, bench, planter, ac, shutter] = await Promise.all([
    model('street_lamp_01'), model('island_tree_02', 'island_tree_02_lod1'), model('fire_hydrant'), model('covered_car'), model('utility_box_02'),
    model('water_manhole_cover'), model('modular_street_seating'), model('planter_box_01'), model('exterior_aircon_unit'), model('rollershutter_door')]);
  const lit = (o) => { o.traverse(m => { if (m.isMesh) for (const mt of [].concat(m.material)) { mt.envMap = SKY; mt.envMapIntensity = 1.0; } }); return o; };
  // trees and lamps along both pavements
  for (const x of [-15, -8.2, 10.5, 18]) put(lit(tree.clone(true)), x, -0.02, Z.kerb + 1.0, rnd() * 6, 1.3 + rnd() * 0.2);
  for (const x of [-21, -3, 12]) put(lit(tree.clone(true)), x, -0.02, Z.road - 1.2, rnd() * 6, 1.6);
  for (const x of [-11, 4.5, 20]) put(lit(lamp.clone(true)), x, -0.02, Z.kerb + 0.45, -Math.PI / 2, 1.2);
  for (const x of [-26, -2, 22]) put(lit(lamp.clone(true)), x, -0.02, Z.road - 0.45, Math.PI / 2, 1.2);
  put(lit(drop(hydrant, ['aged'])), 6.6, -0.02, Z.kerb + 0.55, -Math.PI / 2);
  put(lit(car), -3.4, -0.15, Z.kerb - 1.15, Math.PI / 2 + 0.02);
  put(lit(car.clone(true)), 17, -0.15, Z.road + 1.15, -Math.PI / 2);
  put(lit(box), ROOM.x1 + 1.6, -0.02, Z.wall - 0.3, Math.PI);
  put(lit(cover), 1.8, -0.13, (Z.kerb + Z.road) / 2 + 1.6, 0.3);
  put(lit(drop(bench, ['connector', 'suspended_support_02', 'seat_bench', 'arm_rest_02'])), 2.4, -0.02, Z.wall - 1.0, Math.PI);
  for (const x of [-7.8, -1.2]) put(lit(planter.clone(true)), x, -0.02, Z.wall - 0.5, 0, 1.2);
  // air-conditioning units on the facades opposite, roller shutters on some shops
  const acOne = drop(ac, ['_02', 'rusted']);
  for (const [x, y] of [[-30, 8.2], [-17, 5.0], [8, 4.6], [33, 7.8], [-44, 8.0]]) put(lit(acOne.clone(true)), x, y, Z.far + 0.25, Math.PI);
  const sh = drop(shutter, ['graffiti']);
  for (const [x, z, w] of shutters) { const o = lit(sh.clone(true)); o.scale.set(w / 1.08, 3.0 / 2.4, 1); o.position.set(x, -0.02, z); o.rotation.y = Math.PI; street.add(o); }
}

export async function buildStreet(scene, skyEnv) {
  SKY = skyEnv;
  ground();
  const shutters = buildings();
  await furniture(shutters).catch(e => console.warn('street furniture', e));
  scene.add(street);
  return street;
}
