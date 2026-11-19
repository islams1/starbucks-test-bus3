// The café is a photogrammetry scan of a real coffee shop (scan.js); the meeting room upstairs is modelled.
// World: +x east, +z south, y up. The scanned café spans x -9.7..8.3, z -8.9..8.0; the meeting room sits at y = 4 elsewhere.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {scene} from '../core/engine.js';
import {model, modelPart, manager, track} from '../core/assets.js';
import {M, canvasTex, pbr} from './materials.js';
import * as P from './props.js';
import {mergeStatic} from './merge.js';
import {addLightSpec} from './lighting.js';
import {loadVenue, occupancyBoxes, SCAN, blockedAt} from './scan.js';

// ---------------------------------------------------------------- layout
export const B = {x0: -2.4, x1: 10.2, z0: -4.5, z1: 3.6, H: 3.0, floorH: 4.0, floors: 2};
export const UP = 40.0;                        // the boardroom is on a high floor of an office tower (its own level)
export const ROOMS = [
  {id: 'cafe', name: 'المقهى', x0: 2.3, x1: 10.2, z0: -4.5, z1: 3.6},
  {id: 'bar', name: 'خلف الكاونتر', x0: -2.4, x1: 2.3, z0: -4.5, z1: 1.6},
  {id: 'meeting', name: 'غرفة الاجتماعات', x0: 12.8, x1: 25.2, z0: -20.2, z1: -9.5, up: true},
];
export function roomAt(x, z, y = 0) { for (const r of ROOMS) if (!!r.up === y > 2 && x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return r; return null; }

// colliders per level: the player and the walk grid only see the level they are on
const LEVELS = {0: [], 1: []};
export const colliders = [];   // the active level's boxes {x0,x1,z0,z1}
let level = 0, building = 0;
export const col = (x0, x1, z0, z1) => LEVELS[building].push({x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1)});
export function setLevel(lv) { level = lv; colliders.length = 0; colliders.push(...LEVELS[lv]); }
export const currentLevel = () => level;
export const occluders = [];   // meshes that block hotspot line-of-sight
export const anchors = {};     // named positions used by the story
export const screens = {};
export const cafe = {};        // live props the story drives (tickets, cups, door…)

const root = new THREE.Group(); root.name = 'cafe';
export const roofGroup = new THREE.Group(); roofGroup.name = 'roof'; root.add(roofGroup);
const live = new THREE.Group(); live.name = 'cafe-live'; // moving / changing props stay out of the static merge

// ---------------------------------------------------------------- Sketchfab models (CC-BY, see assets/cafe_models/CREDITS.json)
const gltf = new GLTFLoader(manager);
const cache = new Map();
/** café model, scaled so its bounding box has the given height (h) or width (w), standing on y = 0, centred on x/z. */
export async function cafeModel(slug, {h = null, w = null, ry = 0} = {}) {
  if (!cache.has(slug)) cache.set(slug, track(gltf.loadAsync(`assets/cafe_models/${slug}/scene.gltf`), slug).then(g => g.scene));
  const src = (await cache.get(slug)).clone(true);
  src.rotation.y = ry;
  const g = new THREE.Group(); g.add(src); g.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(src), size = bb.getSize(new THREE.Vector3());
  const s = h ? h / size.y : w ? w / Math.max(size.x, size.z) : 1;
  src.scale.multiplyScalar(s); g.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(src), c = b2.getCenter(new THREE.Vector3());
  src.position.x -= c.x; src.position.z -= c.z; src.position.y -= b2.min.y;
  src.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material) o.material.envMapIntensity = 0.7; } });
  return g;
}
const put = (parent, o, x, y, z, ry = 0) => { o.position.set(x, y, z); o.rotation.y = ry; parent.add(o); return o; };

// ---------------------------------------------------------------- materials
let MAT;
function mats() {
  MAT = {
    parquet: pbr('herringbone_parquet', [0.75, 0.75], {color: 0xcdbba8, roughness: 0.7}),
    terrazzo: pbr('terrazzo_tiles', [0.5, 0.5], {color: 0xd6d0c6, roughness: 0.6}),
    subway: pbr('long_white_tiles', [0.9, 0.9], {color: 0xf4f1ea, roughness: 0.3}),
    brick: pbr('red_brick_03', [0.42, 0.42], {color: 0xd9c6b8}),
    plaster: pbr('plastered_wall', [0.5, 0.5], {color: 0xe7ded1}),
    darkWood: pbr('black_oak_veneer', [0.9, 0.9], {roughness: 0.55}),
    oak: pbr('oak_veneer_01', [0.9, 0.9], {roughness: 0.5}),
    marble: pbr('brushed_concrete', [0.6, 0.6], {roughness: 0.42, color: 0xe4ded3}),
    tableTop: pbr('wood_table', [0.8, 0.8], {roughness: 0.55}),
    ceiling: new THREE.MeshStandardMaterial({color: 0x45423e, roughness: 0.92}),
    trim: new THREE.MeshStandardMaterial({color: 0x1e1f20, roughness: 0.4, metalness: 0.6}),
    steel: new THREE.MeshStandardMaterial({color: 0xc9cdd1, roughness: 0.25, metalness: 1.0}),
    black: new THREE.MeshStandardMaterial({color: 0x121212, roughness: 0.5}),
    glass: new THREE.MeshPhysicalMaterial({color: 0xf2f6f6, metalness: 0, roughness: 0.03, transparent: true, opacity: 0.07, envMapIntensity: 0.55, depthWrite: false, side: THREE.DoubleSide}),
    caseGlass: new THREE.MeshPhysicalMaterial({color: 0xffffff, metalness: 0, roughness: 0.02, transparent: true, opacity: 0.1, envMapIntensity: 0.9, depthWrite: false, side: THREE.DoubleSide}),
    facade: pbr('red_brick_03', [0.42, 0.42], {color: 0xb9a596}),
    paper: new THREE.MeshStandardMaterial({color: 0xf7f4ec, roughness: 0.85}),
    green: new THREE.MeshStandardMaterial({color: 0x24392f, roughness: 0.6}),
  };
  for (const k of ['parquet', 'terrazzo', 'subway', 'brick', 'plaster', 'darkWood', 'oak', 'tableTop', 'ceiling']) MAT[k].envMapIntensity = 0.7;
}

// ---------------------------------------------------------------- shell helpers
function wall(x1, z1, x2, z2, mat, {t = 0.2, y0 = 0, h = B.H, openings = [], doorH = 2.3, lv = 0} = {}) {
  const horiz = z1 === z2; const a0 = horiz ? Math.min(x1, x2) : Math.min(z1, z2), a1 = horiz ? Math.max(x1, x2) : Math.max(z1, z2);
  const c = horiz ? z1 : x1;
  const seg = (s0, s1, ya, yb) => {
    if (s1 - s0 < 0.01 || yb - ya < 0.01) return;
    const len = s1 - s0, mid = (s0 + s1) / 2;
    const m = horiz ? P.box(root, len, yb - ya, t, mat, mid, y0 + ya, c) : P.box(root, t, yb - ya, len, mat, c, y0 + ya, mid);
    occluders.push(m);
    if (ya < 0.5) { building = lv; horiz ? col(s0, s1, c - t / 2, c + t / 2) : col(c - t / 2, c + t / 2, s0, s1); building = 0; }
    if (ya < 0.01) horiz ? P.box(root, len, 0.1, t + 0.03, MAT.trim, mid, y0, c, 0, {cast: false}) : P.box(root, t + 0.03, 0.1, len, MAT.trim, c, y0, mid, 0, {cast: false});
  };
  let s = a0;
  for (const [o0, o1] of [...openings].sort((p, q) => p[0] - q[0])) { seg(s, o0, 0, h); seg(o0, o1, doorH, h); s = o1; }
  seg(s, a1, 0, h);
}
/** storefront glass along z = zf between x0..x1 with mullions; door opening [d0, d1] */
function storefront(x0, x1, zf, {y0 = 0, h = B.H, door = null, sill = 0.35, lv = 0} = {}) {
  const pieces = door ? [[x0, door[0]], [door[1], x1]] : [[x0, x1]];
  for (const [a, b] of pieces) {
    const len = b - a, mid = (a + b) / 2;
    const g = P.box(root, len, h - sill - 0.12, 0.02, MAT.glass, mid, y0 + sill, zf, 0, {cast: false, recv: false}); g.renderOrder = 2;
    P.box(root, len, sill, 0.22, MAT.trim, mid, y0, zf);                     // kick plate
    P.box(root, len, 0.08, 0.16, MAT.trim, mid, y0 + h - 0.12, zf);
    for (let x = a; x <= b + 1e-3; x += Math.min(1.6, len)) P.box(root, 0.07, h, 0.14, MAT.trim, Math.min(Math.max(x, a + 0.035), b - 0.035), y0, zf);
    P.box(root, len, 0.05, 0.12, MAT.trim, mid, y0 + 2.35, zf);               // transom bar
    building = lv; col(a, b, zf - 0.12, zf + 0.12); building = 0;
  }
  if (door) P.box(root, door[1] - door[0], h - 2.4, 0.03, MAT.glass, (door[0] + door[1]) / 2, y0 + 2.4, zf, 0, {cast: false, recv: false}).renderOrder = 2;
}

// ---------------------------------------------------------------- the café (a real modelled interior, see scan.js)
// Read off its plan (tools/plan.html?m=misti): the bar counter runs north–south along x ≈ 1.4–2.3 (customers on its east
// side), sofa and armchairs along the north wall, round tables in the middle, glass and a terrace on the east (x ≈ 10),
// the stair from the street in the south-east.
const CNT = {xf: 2.35, z0: -3.9, z1: 0.6, top: 1.05};
async function scanCafe() {
  const venue = await loadVenue(live, {slug: 'misti', probe: [5, -1], region: [-3, 11.5, -5, 5], hide: [[2.45, 3.8, -4.0, 0.9, 0.95]]});
  building = 0;
  for (const b of occupancyBoxes()) LEVELS[0].push(b);
  venue.traverse(o => { if (o.isMesh && !(o.material && o.material.transparent)) occluders.push(o); });
  // the order rail with its tickets, standing on the counter (customers read it from the east side)
  const rx = CNT.xf - 0.2, rz0 = -1.9, rz1 = -0.2, ry = CNT.top;
  P.box(live, 0.26, 0.03, rz1 - rz0 + 0.1, MAT.steel, rx - 0.06, ry + 0.56, (rz0 + rz1) / 2);
  P.box(live, 0.015, 0.015, rz1 - rz0, MAT.steel, rx + 0.07, ry + 0.55, (rz0 + rz1) / 2);
  for (const z of [rz0 - 0.04, rz1 + 0.04]) P.box(live, 0.02, 0.56, 0.02, MAT.steel, rx - 0.06, ry, z);
  cafe.rail = {z0: rz0 + 0.05, z1: rz1 - 0.05, y: ry + 0.545, x: rx + 0.075, axis: 'z'};
  cafe.ticketGroup = P.group(live, 0, 0, 0);
  anchors.rail = new THREE.Vector3(rx + 0.1, ry + 0.45, (rz0 + rz1) / 2);
  // a wall clock on the tiled back wall, above the framed menus (everyone in the line can see it)
  const clock = await model('wall_clock'); const cb = new THREE.Box3().setFromObject(clock), cs = cb.getSize(new THREE.Vector3());
  clock.scale.setScalar(0.4 / Math.max(cs.x, cs.y)); clock.rotation.y = Math.PI / 2; clock.position.set(0.66, 2.32, -2.55); live.add(clock);
  cafe.clockHands = makeClockHands(live, new THREE.Vector3(0.72, 2.32, -2.55), Math.PI / 2);
  anchors.clock = new THREE.Vector3(0.7, 2.32, -2.55);
  // comment-card box on the wall by the stair head
  const cbox = P.group(live, 6.6, 1.0, 1.08, Math.PI);
  P.rbox(cbox, 0.32, 0.36, 0.16, 0.01, MAT.oak, 0, 0, 0); P.box(cbox, 0.2, 0.012, 0.02, MAT.black, 0, 0.3, 0.08);
  const label = canvasTex(256, 64, (g, W, Hh) => { g.fillStyle = '#efe6d2'; g.fillRect(0, 0, W, Hh); g.fillStyle = '#2b2b2b'; g.font = '600 30px "IBM Plex Sans Arabic"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('رأيك يهمنا', W / 2, Hh / 2 + 2); });
  const lb = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.065), new THREE.MeshStandardMaterial({map: label, roughness: 0.8})); lb.position.set(0, 0.24, 0.082); cbox.add(lb);
  anchors.commentBox = new THREE.Vector3(6.6, 1.15, 1.0); anchors.commentStand = {x: 6.6, z: 0.3};
  // where people stand (customers on the east side of the bar, staff in the aisle behind it). The counter's staff
  // face is at x 1.75 and the back counter's at x 0.75 (measured on the model): staff stand in between, not on the edge
  anchors.register = {x: 2.95, z: -3.05}; anchors.cashier = {x: 1.52, z: -3.05, ry: Math.PI / 2};
  anchors.pickupShelf = new THREE.Vector3(2.15, CNT.top + 0.02, -0.6);
  anchors.cupLine = {z0: -1.25, z1: 0.35, y: CNT.top + 0.005, x: 2.18};
  anchors.machine = {x: 1.12, z: -1.95, ry: -Math.PI / 2};
  anchors.noorBar = {x: 1.5, z: -0.45};
  anchors.stairTop = {x: 9.2, z: 1.15}; anchors.stairBottom = {x: 9.2, z: 3.3, y: -1.9};
  anchors.staffDoor = {x: 9.5, z: 0.35};
  anchors.seats = [{x: 4.4, z: -1.0, ry: Math.PI / 2}, {x: 5.65, z: -1.0, ry: -Math.PI / 2}, {x: 9.45, z: -1.0, ry: -Math.PI / 2}, {x: 8.05, z: -0.3, ry: Math.PI * 0.75}];
  anchors.start = {x: 7.3, z: -2.75};          // by the armchairs, clear of the queue
  // the ceiling downlights and the pendants over the bar carry real lights (the nearest few are drawn, see lighting.js)
  for (const [x, z] of [[3.6, -3.4], [6.2, -3.4], [8.6, -3.4], [3.6, -1.0], [6.2, -1.0], [8.6, -1.0], [3.6, 1.0], [6.4, 1.0]]) addLightSpec({x, y: 2.75, z, i: 1.6, d: 6.5, c: 0xfff1de});
  for (const z of [-3.2, -1.6, 0.0]) addLightSpec({x: 1.6, y: 1.9, z, i: 1.4, d: 4.5, c: 0xffc98a});
}

async function pastryCase(cx, cz) {
  const g = P.group(root, cx, 1.02, cz);
  const w = 1.3, d = 0.52, h = 0.5;
  P.box(g, w, 0.08, d, MAT.darkWood, 0, 0, 0);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P.box(g, 0.02, h, 0.02, MAT.steel, sx * (w / 2 - 0.01), 0.08, sz * (d / 2 - 0.01));
  P.box(g, w, 0.02, d, MAT.steel, 0, h + 0.07, 0);
  const gl = (ww, hh, dd, x, y, z) => { const m = P.box(g, ww, hh, dd, MAT.caseGlass, x, y, z, 0, {cast: false, recv: false}); m.renderOrder = 3; };
  gl(w - 0.02, h - 0.02, 0.008, 0, 0.09, d / 2 - 0.01); gl(0.008, h - 0.02, d - 0.02, -w / 2 + 0.01, 0.09, 0); gl(0.008, h - 0.02, d - 0.02, w / 2 - 0.01, 0.09, 0);
  const shelf = 0.31; gl(w - 0.04, 0.008, d - 0.06, 0, shelf, 0);
  P.box(g, w - 0.06, 0.012, 0.02, new THREE.MeshStandardMaterial({color: 0xffffff, emissive: 0xfff1d8, emissiveIntensity: 2}), 0, h + 0.055, d / 2 - 0.06, 0, {cast: false});
  // pastries: scanned cupcakes and cake slices below, croissants and whole cakes above
  const place = async (slug, x, y, z, s, ry = 0) => { const o = await cafeModel(slug, {w: s}); o.position.set(x, y, z); o.rotation.y = ry; g.add(o); };
  const jobs = [];
  for (let i = 0; i < 4; i++) jobs.push(place(i % 2 ? 'cupcake2' : 'cupcake1', -0.5 + i * 0.13, 0.085, 0.08 - (i % 2) * 0.12, 0.075, i));
  for (let i = 0; i < 3; i++) jobs.push(place('cake_piece', 0.12 + i * 0.16, 0.085, 0.02 - (i % 2) * 0.1, 0.11, 0.4 + i));
  const cro = await model('croissant'); { const b = new THREE.Box3().setFromObject(cro), s = b.getSize(new THREE.Vector3()); cro.scale.setScalar(0.13 / Math.max(s.x, s.z)); }
  for (let i = 0; i < 4; i++) { const o = cro.clone(true); o.position.set(-0.52 + i * 0.12, shelf + 0.01, -0.05 + (i % 2) * 0.1); o.rotation.y = i * 1.3; g.add(o); }
  for (const [n, x] of [['carrot_cake', 0.18], ['strawberry_chocolate_cake', 0.45]]) { const o = await model(n); const b = new THREE.Box3().setFromObject(o), s = b.getSize(new THREE.Vector3()); o.scale.setScalar(0.2 / Math.max(s.x, s.z)); o.position.set(x, shelf + 0.01, 0); g.add(o); }
  await Promise.all(jobs);
  occluders.push(g);
}
function grinder(x, z) {
  const g = P.group(root, x, 0.96, z);
  P.rbox(g, 0.19, 0.06, 0.26, 0.015, MAT.black, 0, 0, 0);
  P.rbox(g, 0.15, 0.36, 0.18, 0.03, MAT.black, 0, 0.06, -0.03);
  P.box(g, 0.08, 0.03, 0.06, MAT.steel, 0, 0.17, 0.08);
  const hop = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.045, 0.24, 24, 1, true), new THREE.MeshPhysicalMaterial({color: 0x4a2c16, roughness: 0.15, transparent: true, opacity: 0.65, side: THREE.DoubleSide}));
  hop.position.set(0, 0.54, -0.03); g.add(hop);
  const beans = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.045, 0.14, 20), new THREE.MeshStandardMaterial({color: 0x2a170b, roughness: 0.9})); beans.position.set(0, 0.49, -0.03); g.add(beans);
  P.cyl(g, 0.1, 0.1, 0.02, MAT.black, 0, 0.66, -0.03);
}
/** clock hands (minute/hour) driven by setClockHands(minutes) */
function makeClockHands(parent, c, ry = 0) {
  const g = P.group(parent, c.x, c.y, c.z, ry);
  const mk = (len, w) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.006), MAT.black); m.geometry.translate(0, len / 2 - 0.02, 0); g.add(m); return m; };
  return {g, h: mk(0.11, 0.016), m: mk(0.17, 0.01)};
}
export function setClockHands(min) {
  const h = cafe.clockHands; if (!h) return;
  h.m.rotation.z = -(min % 60) / 60 * Math.PI * 2; h.h.rotation.z = -((min / 60) % 12) / 12 * Math.PI * 2;
}

// ---------------------------------------------------------------- tickets on the order rail
const ticketTex = new Map();
function ticketMat(n, text) {
  const k = n + '|' + text; if (ticketTex.has(k)) return ticketTex.get(k);
  const t = canvasTex(128, 192, (g, W, Hh) => {
    g.fillStyle = '#fbf8f1'; g.fillRect(0, 0, W, Hh); g.fillStyle = '#222'; g.font = '700 34px Inter'; g.textAlign = 'center'; g.fillText('#' + n, W / 2, 44);
    g.font = '500 20px "IBM Plex Sans Arabic"'; g.fillText(text, W / 2, 84); g.fillStyle = 'rgba(0,0,0,.35)'; for (let i = 0; i < 4; i++) g.fillRect(18, 108 + i * 16, W - 36 - (i % 2) * 22, 3);
  });
  const m = new THREE.MeshStandardMaterial({map: t, roughness: 0.9, side: THREE.DoubleSide}); ticketTex.set(k, m); return m;
}
const DRINKS = ['لاتيه', 'كابتشينو', 'أمريكانو', 'موكا', 'إسبريسو', 'لاتيه كبير', 'شاي', 'ماتشا'];
const ticketGeo = new THREE.PlaneGeometry(0.075, 0.11); ticketGeo.translate(0, -0.055, 0);
/** show n tickets hanging on the rail, numbered from `first`; returns the meshes (index 0 = oldest, at the hand-off end) */
export function setTickets(n, first = 39) {
  const g = cafe.ticketGroup; while (g.children.length) g.remove(g.children[0]);
  const r = cafe.rail, out = [];
  for (let i = 0; i < n; i++) {
    const num = first + i;
    const m = new THREE.Mesh(ticketGeo, ticketMat(num, DRINKS[num % DRINKS.length]));
    // the oldest ticket hangs at the hand-off end (south, +z), new ones join at the north end
    const k = i * Math.min(0.12, (r.z1 - r.z0 - 0.1) / Math.max(1, n));
    m.position.set(r.x + 0.005, r.y, r.z1 - 0.05 - k); m.rotation.y = Math.PI / 2; m.rotation.z = (Math.sin(num * 7.1) * 0.06); m.userData.num = num;
    g.add(m); out.push(m);
  }
  cafe.tickets = out;
  return out;
}
export function ticketMesh(num) { return (cafe.tickets || []).find(m => m.userData.num === num); }

// ---------------------------------------------------------------- the boardroom ("Meeting room", Sketchfab, CC BY), y = UP
// Read off a height probe: the table runs north–south at x 18.1–19.0, z -16.9..-12.35, chairs on both long sides at
// x 17.65 (west) and 19.4 (east); the screen wall is north (z ≈ -20), windows east (x ≈ 25), the door west (x ≈ 12.8).
async function boardroom() {
  const y0 = UP;
  const room = await loadVenue(live, {slug: 'meetroom', probe: [16, -15], region: [12.5, 25.5, -20.5, -9.3], y: y0, primary: false, floorY: 0});
  room.traverse(o => { if (!o.isMesh) return; const ms = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of ms) if (/glass|window/i.test(m.name) || (m.color && m.color.r < 0.25 && m.opacity === 1 && !m.map && o.geometry.boundingBox == null)) { /* left as authored */ } });
  // the window panes are opaque black in the model: make them clear glass so the evening city shows
  room.traverse(o => { if (!o.isMesh) return; const ms = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of ms) if (/glass/i.test(m.name)) { m.transparent = true; m.opacity = 0.08; m.color.setHex(0xdfe8ec); m.roughness = 0.03; m.metalness = 0; m.depthWrite = false; o.castShadow = false; } });
  building = 1; for (const bx of occupancyBoxes(room.userData.occ)) LEVELS[1].push(bx); building = 0;
  const seat = (x, z, ry) => ({x, z, ry, y: y0});
  anchors.meet = {
    ellis: seat(17.62, -14.6, Math.PI / 2), noor: seat(17.62, -13.65, Math.PI / 2), priya: seat(19.42, -12.65, -Math.PI / 2),
    player: seat(19.42, -14.6, -Math.PI / 2),
    arrive: {x: 13.7, z: -13.0, ry: Math.PI / 2, y: y0}, door: {x: 13.2, z: -13.0},
    present: {x: 17.3, z: -18.3, ry: Math.PI * 0.9, y: y0},
    presentCam: [17.25, y0 + 1.64, -18.45], presentLook: [18.6, y0 + 1.0, -13.4],
    screenCam: [18.55, y0 + 1.55, -16.6], screenLook: [18.55, y0 + 1.6, -19.9],
  };
  // our screen for the memo slides, on the screen wall
  screens.meet = P.wallScreen(live, 18.55, y0 + 0.98, -19.5, 0, 2.6, 1.46);
  screens.meet.mat.emissiveIntensity = 0.3;
  anchors.screen = new THREE.Vector3(18.55, y0 + 1.7, -19.5);
  cafe.tabletPos = new THREE.Vector3(18.3, y0 + 0.76, -14.6);
  // soft ceiling light over the table
  for (const z of [-16, -14.5, -13]) addLightSpec({x: 18.55, y: y0 + 2.6, z, i: 2.2, d: 7, c: 0xfff0dc});
}

export async function buildBuilding() {
  mats();
  scene.add(root); scene.add(live);
  await scanCafe();
  await boardroom();
  setLevel(0);
  mergeStatic(root, {cell: 8});
  return root;
}
export {live as liveGroup, CNT};
