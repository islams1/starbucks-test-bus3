// The investment committee room, top floor, 5:30 pm: a long walnut table with the store model in the middle, a window
// wall onto the city at sunset (west), the screen on the north wall, the door and a print on the east wall.
// Units are metres; floor at y 0; the table top at TABLE.y. The table and the chairs form the 'venue' (contact.js
// keeps hands out of the table top and fits people to the chairs that are really there).
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {scene} from '../core/engine.js';
import {model} from '../core/assets.js';
import {pbr, canvasTex} from './materials.js';
import {mergeStatic} from './merge.js';

export const ROOM = {x0: -4.6, x1: 4.6, z0: -3.6, z1: 3.4, h: 2.95};
export const TABLE = {x: 0, z: 0, w: 3.7, d: 1.56, y: 0.76};
// seats: where people sit (the chair is placed from these), ry = the way they face
export const SEATS = {
  player: {x: 0.02, z: 1.16, ry: Math.PI},
  noor: {x: -0.86, z: -1.16, ry: 0},
  ellis: {x: 0.86, z: -1.16, ry: 0},
  priya: {x: 2.44, z: 0.0, ry: -Math.PI / 2},
  e1: {x: -1.18, z: 1.16, ry: Math.PI}, e2: {x: 1.2, z: 1.16, ry: Math.PI},
};
// the replay screen: hung from the ceiling at the west end of the table, in front of the window wall, facing the table
export const HANG = {x: -2.7, y: 1.6, z: 0.0, w: 2.1, h: 2.1 * 9 / 16};
export let hangScreen = null;          // {mesh, setTexture(tex), on(bool)}
export const room = new THREE.Group(); room.name = 'room';
export const ROOM_GLOW = [];          // the room's glowing materials (downlights, the pendant, the screen): dimmed with its lights
export const venue = new THREE.Group(); venue.name = 'venue';
export let screen = null;            // the wall display: {mesh, draw(fn)}
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const steel0 = () => new THREE.MeshStandardMaterial({color: 0xb9bec4, roughness: 0.3, metalness: 1});
/** planar UVs in metres so a texture repeat means "per metre" */
function uvMetres(geo, sx, sy) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy); uv.needsUpdate = true; return geo; }
function box(w, h, d, mat, x, y, z, {cast = true, recv = true, parent = room, uv = null} = {}) {
  const g = new THREE.BoxGeometry(w, h, d); if (uv) uvMetres(g, uv[0], uv[1]);
  const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = recv; parent.add(m); return m;
}

export async function buildRoom() {
  const {x0, x1, z0, z1, h} = ROOM, W = x1 - x0, D = z1 - z0;
  // ---------------------------------------------------------------- materials
  const floorM = pbr('herringbone_parquet', [0.42, 0.42], {color: 0xb08f72, roughness: 0.62});
  const plaster = pbr('painted_plaster_wall', [0.5, 0.5], {color: 0xe6e1d8, roughness: 0.95});
  const walnut = pbr('walnut_veneer', [0.55, 0.55], {roughness: 0.42});
  const walnutDark = pbr('walnut_veneer', [0.8, 0.8], {color: 0x8a6d58, roughness: 0.55});
  const ceilM = new THREE.MeshStandardMaterial({color: 0xe9e6e0, roughness: 0.95});
  const black = new THREE.MeshStandardMaterial({color: 0x1b1c1e, roughness: 0.38, metalness: 0.6});
  const brass = new THREE.MeshStandardMaterial({color: 0xb8925a, roughness: 0.32, metalness: 1});
  const glass = new THREE.MeshPhysicalMaterial({color: 0xdfe8ee, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.12, envMapIntensity: 1.2, depthWrite: false, side: THREE.DoubleSide});
  for (const m of [floorM, plaster, walnut, walnutDark, ceilM]) m.envMapIntensity = 0.5;

  // ---------------------------------------------------------------- shell
  const floor = new THREE.Mesh(uvMetres(new THREE.PlaneGeometry(W, D), W, D), floorM);
  floor.rotation.x = -Math.PI / 2; floor.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2); floor.receiveShadow = true; room.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), ceilM); ceil.rotation.x = Math.PI / 2; ceil.position.set((x0 + x1) / 2, h, (z0 + z1) / 2); room.add(ceil);
  // north, east, south walls: plaster above a walnut wainscot (0–0.95 m)
  const wall = (len, x, z, ry) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; room.add(g);
    box(len, h - 0.95, 0.12, plaster, 0, 0.95 + (h - 0.95) / 2, 0, {parent: g, uv: [len, h], cast: false});
    box(len, 0.95, 0.14, walnutDark, 0, 0.475, 0.01, {parent: g, uv: [len, 1], cast: false});
    box(len, 0.025, 0.03, brass, 0, 0.955, 0.08, {parent: g, cast: false});
    return g;
  };
  wall(W, (x0 + x1) / 2, z0 - 0.06, 0);                 // north
  wall(D, x1 + 0.06, (z0 + z1) / 2, -Math.PI / 2);      // east
  wall(W, (x0 + x1) / 2, z1 + 0.06, Math.PI);           // south
  // west: the window wall (glass between black mullions, a low sill), the city behind it
  const wx = x0 - 0.04;
  box(0.16, 0.32, D, walnutDark, wx + 0.04, 0.16, (z0 + z1) / 2, {cast: false});
  for (let i = 0; i <= 5; i++) { const z = z0 + D * i / 5; box(0.07, h, 0.07, black, wx, h / 2, z); }
  box(0.08, 0.08, D, black, wx, h - 0.04, (z0 + z1) / 2); box(0.08, 0.05, D, black, wx, 0.34, (z0 + z1) / 2);
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(D, h - 0.4), glass); pane.rotation.y = Math.PI / 2; pane.position.set(wx, 0.34 + (h - 0.4) / 2, (z0 + z1) / 2); room.add(pane);
  // ceiling: a recessed slot over the table and a ring of downlights (their glow; the light itself is in lighting.js)
  box(4.2, 0.02, 0.5, new THREE.MeshStandardMaterial({color: 0x0f0f10, roughness: 1}), 0, h - 0.005, 0, {cast: false});
  const dl = new THREE.MeshStandardMaterial({color: 0xffffff, emissive: 0xffe6c4, emissiveIntensity: 2.2}); ROOM_GLOW.push(dl);
  for (const [x, z] of [[-3.2, -2.4], [3.2, -2.4], [-3.2, 2.3], [3.2, 2.3], [0, -2.6], [0, 2.5], [-3.4, 0], [3.4, 0]]) {
    const d = new THREE.Mesh(new THREE.CircleGeometry(0.07, 24), dl); d.rotation.x = Math.PI / 2; d.position.set(x, h - 0.004, z); room.add(d);
  }
  // the linear pendant over the table: a black bar on two cables, a warm diffuser underneath
  const pend = new THREE.Group(); pend.position.set(0, 1.92, 0.0); room.add(pend);
  box(2.6, 0.05, 0.09, black, 0, 0, 0, {parent: pend});
  const diff = new THREE.Mesh(new THREE.PlaneGeometry(2.56, 0.06), new THREE.MeshStandardMaterial({color: 0xffffff, emissive: 0xffd9a8, emissiveIntensity: 3.0}));
  diff.rotation.x = Math.PI / 2; diff.position.y = -0.026; pend.add(diff); ROOM_GLOW.push(diff.material);
  for (const x of [-1.1, 1.1]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, h - 1.92, 6), black); c.position.set(x, (h - 1.92) / 2, 0); pend.add(c); }

  // ---------------------------------------------------------------- the table
  const T = TABLE, top = new THREE.Mesh(new RoundedBoxGeometry(T.w, 0.05, T.d, 4, 0.02), walnut);
  uvMetres(top.geometry, 1, 1);
  top.position.set(T.x, T.y - 0.025, T.z); top.castShadow = top.receiveShadow = true; venue.add(top);
  for (const x of [-1.05, 1.05]) {                       // two slab pedestals
    box(0.08, T.y - 0.05, T.d * 0.62, black, x, (T.y - 0.05) / 2, T.z, {parent: venue});
    box(0.5, 0.02, T.d * 0.7, black, x, 0.01, T.z, {parent: venue});
  }
  // a thin brass inlay along the edge (catches the light)
  box(T.w - 0.06, 0.006, 0.012, brass, T.x, T.y + 0.001, T.z + T.d / 2 - 0.05, {parent: venue, cast: false});
  box(T.w - 0.06, 0.006, 0.012, brass, T.x, T.y + 0.001, T.z - T.d / 2 + 0.05, {parent: venue, cast: false});

  // ---------------------------------------------------------------- chairs (the same chair as in the café model)
  const chair = await model('dining_chair_02');
  for (const [k, s] of Object.entries(SEATS)) {
    const c = chair.clone(true);
    // the chair's back is towards -z in the file: turn it so a sitter faces s.ry; pull it 8 cm out from the table
    c.position.set(s.x - Math.sin(s.ry) * 0.06, 0, s.z - Math.cos(s.ry) * 0.06); c.rotation.y = s.ry;
    c.name = 'chair_' + k; venue.add(c);
  }
  room.add(venue);

  // ---------------------------------------------------------------- north wall: credenza + the display screen
  box(3.0, 0.72, 0.5, walnutDark, 0, 0.36, z0 + 0.28);
  box(3.02, 0.03, 0.52, walnut, 0, 0.735, z0 + 0.28);
  const sw = 2.3, sh = sw * 9 / 16;
  box(sw + 0.06, sh + 0.06, 0.04, black, 0, 1.68, z0 + 0.03);
  const scrTex = canvasTex(1280, 720, (g, w, hh) => { g.fillStyle = '#0b0c0e'; g.fillRect(0, 0, w, hh); });
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshBasicMaterial({map: scrTex, toneMapped: false, color: 0xbfbfbf}));
  scr.position.set(0, 1.68, z0 + 0.052); room.add(scr); ROOM_GLOW.push(scr.material);
  screen = {mesh: scr, tex: scrTex, draw(fn) { const c = scrTex.image, g = c.getContext('2d'); fn(g, c.width, c.height); scrTex.needsUpdate = true; }, off() { this.draw((g, w, hh) => { g.fillStyle = '#0b0c0e'; g.fillRect(0, 0, w, hh); }); }};
  // ---------------------------------------------------------------- the replay screen, hanging at the west end of the table
  {
    const {x, y, z, w, h: hh} = HANG, g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = Math.PI / 2; room.add(g);
    box(w + 0.07, hh + 0.07, 0.06, black, 0, 0, -0.035, {parent: g});                     // the body and bezel
    box(w * 0.5, 0.04, 0.04, black, 0, hh / 2 + 0.09, -0.04, {parent: g});                // the hanging bar
    for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, h - y - hh / 2 - 0.1, 6), steel0()); c.position.set(s * w * 0.22, (h - y - hh / 2 - 0.1) / 2 + hh / 2 + 0.1, -0.04); g.add(c); }
    const mat = new THREE.MeshBasicMaterial({color: 0x050607});
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), mat); face.position.z = 0.0; g.add(face);
    // a thin strip under the picture: what is being replayed (drawn by the screen feed)
    hangScreen = {group: g, mesh: face, mat, setTexture(tex) { mat.map = tex; mat.color.setHex(tex ? 0xffffff : 0x050607); mat.needsUpdate = true; }};
  }
  // ---------------------------------------------------------------- east wall: the door and a framed print
  const door = box(1.0, 2.2, 0.06, walnut, x1 - 0.05, 1.1, 1.9); door.rotation.y = Math.PI / 2;
  box(0.03, 0.3, 0.03, brass, x1 - 0.1, 1.05, 1.52);
  const print = canvasTex(600, 800, (g, w, hh) => {
    g.fillStyle = '#efe9dd'; g.fillRect(0, 0, w, hh);
    // an abstract print: warm horizontal bands (a coffee field at dusk, loosely)
    const cols = ['#6b4a33', '#a9784c', '#d9b26f', '#3f4a3d', '#8e9a7a'];
    for (let i = 0; i < 9; i++) { g.fillStyle = cols[i % cols.length]; g.globalAlpha = 0.55 + 0.4 * Math.random(); g.fillRect(70, 110 + i * 64, w - 140, 40 + Math.random() * 20); }
    g.globalAlpha = 1;
  });
  const pr = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.0), new THREE.MeshStandardMaterial({map: print, roughness: 0.9})); pr.rotation.y = -Math.PI / 2; pr.position.set(x1 - 0.026, 1.55, -1.3); room.add(pr);
  box(0.03, 1.06, 0.81, black, x1 - 0.005, 1.55, -1.3, {cast: false});
  // ---------------------------------------------------------------- south wall: a sideboard with coffee
  box(2.2, 0.82, 0.48, walnutDark, -1.6, 0.41, z1 - 0.28);
  box(2.22, 0.03, 0.5, walnut, -1.6, 0.835, z1 - 0.28);
  const steel = new THREE.MeshStandardMaterial({color: 0xc9cdd2, roughness: 0.25, metalness: 1});
  const jug = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.28, 24), steel); jug.position.set(-2.1, 0.99, z1 - 0.3); jug.castShadow = true; room.add(jug);
  const cupM = new THREE.MeshStandardMaterial({color: 0xf3f0ea, roughness: 0.35});
  for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.032, 0.08, 18), cupM); c.position.set(-1.8 + (i % 3) * 0.12, 0.89, z1 - 0.36 + Math.floor(i / 3) * 0.12); c.castShadow = true; room.add(c); }
  try { const pl = await model('potted_plant_02'); pl.scale.setScalar(1.6); pl.position.set(x1 - 0.55, 0.16, z1 - 0.55); room.add(pl); } catch (e) { console.warn('plant', e); }
  try { const ck = await model('wall_clock'); ck.position.set(x1 - 0.03, 2.2, 0.2); ck.rotation.y = -Math.PI / 2; ck.scale.setScalar(1.3); room.add(ck);
    const mh = ck.getObjectByName('wall_clock_minute_hand'), hh = ck.getObjectByName('wall_clock_hours_hand');
    if (mh) mh.rotation.z = -Math.PI;                  // 5:30
    if (hh) hh.rotation.z = -(5.5 / 12) * Math.PI * 2;
  } catch (e) { console.warn('clock', e); }

  scene.add(room);
  mergeStatic(room, {cell: 4, exclude: [venue, scr, pend, hangScreen.group]});
  return room;
}
