// "Al-Midan" café — ground floor café + the meeting room upstairs, on the street the traffic module builds.
// World: +x east, +z south (street side), y up. The café front glass is at z = 36 (sidewalk 36..40, road 40..52).
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {scene} from '../core/engine.js';
import {model, modelPart, manager, track} from '../core/assets.js';
import {M, canvasTex, pbr} from './materials.js';
import * as P from './props.js';
import {mergeStatic} from './merge.js';
import {addLightSpec} from './lighting.js';

// ---------------------------------------------------------------- layout
export const B = {x0: -8, x1: 8, z0: 26.4, z1: 36, H: 3.5, floorH: 4.0, floors: 2};
export const UP = 4.0;                         // meeting room floor height
export const ROOMS = [
  {id: 'cafe', name: 'المقهى', x0: -8, x1: 8, z0: 29.3, z1: 36},
  {id: 'bar', name: 'خلف الكاونتر', x0: -3.4, x1: 6.2, z0: 26.4, z1: 29.3},
  {id: 'meeting', name: 'غرفة الاجتماعات', x0: -7.8, x1: -0.6, z0: 30.4, z1: 35.8, up: true},
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

// ---------------------------------------------------------------- ground floor café
async function groundFloor() {
  const {x0, x1, z0, z1, H} = B;
  // floors: parquet for customers, terrazzo behind the counter
  P.floorPlane(root, x1 - x0, z1 - 29.3, MAT.parquet, 0, (29.3 + z1) / 2, 0.005);
  P.floorPlane(root, x1 - x0, 29.3 - z0, MAT.terrazzo, 0, (z0 + 29.3) / 2, 0.005);
  // walls: brick sides, white tile behind the bar, plaster west of it
  wall(x0, z0, x0, z1, MAT.brick);
  wall(x1, z0, x1, z1, MAT.brick);
  wall(x0, z0, -3.4, z0, MAT.plaster);
  wall(-3.4, z0, x1, z0, MAT.subway);
  P.box(root, x1 - x0, 0.5, z1 - z0, MAT.ceiling, 0, H, (z0 + z1) / 2);        // ceiling slab (dark, industrial)
  for (let x = -6; x <= 6; x += 3) P.box(root, 0.18, 0.28, z1 - z0, MAT.trim, x, H - 0.28, (z0 + z1) / 2, 0, {cast: false});   // beams
  // front: glass storefront, door x 2.4..4.0
  storefront(x0 + 0.1, x1 - 0.1, z1, {door: [2.4, 4.0]});
  anchors.door = {x: 3.2, z: 35.6};
  // glass door leaf (opens inwards when someone passes)
  const leaf = P.group(live, 2.42, 0, z1 - 0.02);
  P.box(leaf, 1.56, 2.28, 0.04, MAT.glass, 0.78, 0.02, 0, 0, {cast: false, recv: false}).renderOrder = 2;
  P.box(leaf, 1.6, 0.06, 0.06, MAT.trim, 0.8, 0, 0); P.box(leaf, 1.6, 0.06, 0.06, MAT.trim, 0.8, 2.26, 0);
  P.box(leaf, 0.06, 2.3, 0.06, MAT.trim, 0.03, 0, 0); P.box(leaf, 0.06, 2.3, 0.06, MAT.trim, 1.57, 0, 0);
  P.box(leaf, 0.03, 0.5, 0.04, MAT.steel, 1.4, 0.85, -0.06);
  cafe.door = leaf;

  // ---- counter: x -3.4..6.2, front face z 29.3, top 1.02
  const cz = 29.0;
  P.box(root, 9.6, 0.98, 0.6, MAT.darkWood, 1.4, 0, cz); building = 0; col(-3.4, 6.2, 28.7, 29.32);
  P.box(root, 9.7, 0.045, 0.7, MAT.marble, 1.4, 0.98, cz - 0.02);
  P.box(root, 9.6, 0.08, 0.04, MAT.trim, 1.4, 0, 29.31, 0, {cast: false});
  P.box(root, 0.6, 1.02, 1.6, MAT.darkWood, 6.2, 0, 27.6); col(5.9, 6.5, 26.8, 28.4);   // return at the pickup end
  // pickup shelf: raised wooden shelf on the counter at x 3.6..5.8, with a hanging sign
  P.box(root, 2.2, 0.04, 0.42, MAT.oak, 4.7, 1.24, 29.05);
  for (const x of [3.65, 5.75]) P.box(root, 0.04, 0.22, 0.04, MAT.steel, x, 1.02, 29.05);
  const pickSign = canvasTex(512, 128, (g, W, Hh) => { g.fillStyle = '#1d1f1e'; g.fillRect(0, 0, W, Hh); g.fillStyle = '#efe6d2'; g.font = '600 56px "IBM Plex Sans Arabic"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('استلام الطلبات', W / 2, Hh / 2 + 4); });
  const ps = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), new THREE.MeshStandardMaterial({map: pickSign, roughness: 0.6, emissive: 0xffffff, emissiveMap: pickSign, emissiveIntensity: 0.12}));
  ps.position.set(4.7, 2.35, 29.05); root.add(ps);
  for (const x of [4.2, 5.2]) P.box(root, 0.01, 0.95, 0.01, MAT.steel, x, 2.5, 29.05);
  anchors.pickup = {x: 4.7, z: 29.75}; anchors.pickupShelf = new THREE.Vector3(4.7, 1.28, 29.05);
  // register zone (x = -2.2): POS terminal + cash drawer
  const pos = await cafeModel('pos', {h: 0.36}); put(root, pos, -2.25, 1.02, 29.0, Math.PI);
  P.rbox(root, 0.4, 0.1, 0.42, 0.01, MAT.black, -1.65, 1.02, 28.92);
  anchors.register = {x: -2.2, z: 29.85}; anchors.cashier = {x: -2.2, z: 28.15, ry: 0};
  // pastry display: a glass case on the counter (steel frame, two glass shelves, LED strip), real scanned pastries
  await pastryCase(-0.2, 28.98);
  // cup stacks, napkins, tip jar
  for (let i = 0; i < 3; i++) for (let k = 0; k < 4; k++) P.redCup(root, -2.95 + i * 0.12, 1.025 + k * 0.03, 28.82);
  P.cyl(root, 0.06, 0.06, 0.14, new THREE.MeshPhysicalMaterial({color: 0xffffff, transmission: 0.9, roughness: 0.05, thickness: 0.01, transparent: true, opacity: 0.6}), -1.05, 1.02, 29.15);

  // ---- order rail: tickets hang above the bar between x 0.9 and 3.4 (visible from the customer side)
  P.box(root, 2.8, 0.05, 0.32, MAT.steel, 2.15, 1.58, 28.95);                  // steel shelf over the hand-off
  P.box(root, 2.7, 0.02, 0.02, MAT.steel, 2.15, 1.55, 29.12);
  for (const x of [0.8, 3.5]) P.box(root, 0.025, 0.56, 0.025, MAT.steel, x, 1.02, 28.95);
  cafe.rail = {x0: 1.0, x1: 3.35, y: 1.545, z: 29.135};
  cafe.ticketGroup = P.group(live, 0, 0, 0);
  anchors.rail = new THREE.Vector3(2.15, 1.45, 29.2);

  // ---- back bar (z 26.4..27.0, top 0.95) with the espresso machine, grinder, fridge, syrups
  P.box(root, 9.4, 0.92, 0.62, MAT.darkWood, 1.4, 0, 26.72); col(-3.4, 6.2, 26.4, 27.05);
  P.box(root, 9.5, 0.04, 0.66, MAT.terrazzo, 1.4, 0.92, 26.72);
  for (let i = 0; i < 3; i++) P.box(root, 0.58, 0.82, 0.02, MAT.steel, -2.5 + i * 0.6, 0.06, 27.04);    // under-counter fridges
  const esp = await cafeModel('espresso', {w: 1.0}); put(root, esp, 1.9, 0.96, 26.72, 0); occluders.push(esp);
  grinder(0.85, 26.75); grinder(2.95, 26.75);
  anchors.machine = {x: 1.9, z: 27.55, ry: Math.PI};
  for (let i = 0; i < 8; i++) { const b = P.cyl(root, 0.03, 0.03, 0.28, new THREE.MeshPhysicalMaterial({color: [0x7a3b12, 0x2d1a0e, 0xb06a1a, 0x5a1e1e][i % 4], roughness: 0.1, transmission: 0.3, transparent: true, opacity: 0.85}), 4.0 + i * 0.09, 0.96, 26.62); b.castShadow = false; }
  for (let i = 0; i < 4; i++) P.cyl(root, 0.045, 0.04, 0.12, MAT.steel, 3.0 + i * 0.12, 0.96, 26.95);         // milk pitchers
  // shelves on the tile wall: mugs and bags of beans
  for (const y of [1.55, 1.95]) P.box(root, 3.4, 0.04, 0.26, MAT.oak, -1.6, y, 26.55);
  for (let i = 0; i < 9; i++) P.mug(root, -3.1 + i * 0.34, 1.59, 26.55, [0xf2efe8, 0x2e3a35, 0xd9cbb2][i % 3]);
  for (let i = 0; i < 7; i++) P.box(root, 0.16, 0.26, 0.1, new THREE.MeshStandardMaterial({color: [0x6b4a2d, 0x2f3d33, 0x8c6b43][i % 3], roughness: 0.8}), -3.0 + i * 0.4, 1.99, 26.55);
  // menu boards above the back bar
  const menu = (title, items, x, w) => {
    const t = canvasTex(1024, 640, (g, W, Hh) => {
      g.fillStyle = '#171a19'; g.fillRect(0, 0, W, Hh); g.strokeStyle = '#cbbf9f'; g.lineWidth = 4; g.strokeRect(14, 14, W - 28, Hh - 28);
      g.fillStyle = '#efe6d2'; g.textAlign = 'right'; g.font = '600 64px "IBM Plex Sans Arabic"'; g.fillText(title, W - 60, 100);
      g.font = '40px "IBM Plex Sans Arabic"';
      items.forEach(([n, p], i) => { g.textAlign = 'right'; g.fillText(n, W - 60, 190 + i * 82); g.textAlign = 'left'; g.fillText(p, 60, 190 + i * 82); g.fillStyle = 'rgba(239,230,210,.25)'; g.fillRect(160, 200 + i * 82, W - 420, 2); g.fillStyle = '#efe6d2'; });
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.625), new THREE.MeshStandardMaterial({map: t, roughness: 0.7, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.18}));
    m.position.set(x, 2.75, 26.52); root.add(m);
  };
  menu('القهوة', [['إسبريسو', '1.95'], ['أمريكانو', '2.45'], ['لاتيه', '3.25'], ['كابتشينو', '3.15'], ['موكا', '3.45']], 3.4, 1.6);
  menu('مشروبات أخرى', [['شاي', '1.85'], ['شوكولاتة ساخنة', '2.95'], ['ماتشا لاتيه', '3.65'], ['عصير برتقال', '2.75'], ['ماء', '1.00']], 5.15, 1.6);
  // the wall clock everyone can see (its hands follow the in-game time)
  const clock = await model('wall_clock'); const cb = new THREE.Box3().setFromObject(clock), cs = cb.getSize(new THREE.Vector3());
  clock.scale.setScalar(0.48 / Math.max(cs.x, cs.y)); clock.position.set(1.2, 2.55, 26.47); live.add(clock);
  cafe.clockModel = clock;
  cafe.clockHands = makeClockHands(live, new THREE.Vector3(1.2, 2.55 + 0.24 * 0, 26.53));
  anchors.clock = new THREE.Vector3(1.2, 2.6, 26.5);

  // ---- customer side: tables, chairs, window bar, comment box, plants, stairs
  const chairP = await model('dining_chair_02'); { const b = new THREE.Box3().setFromObject(chairP), s = b.getSize(new THREE.Vector3()); chairP.scale.setScalar(0.88 / s.y); }
  const tableP = await model('round_wooden_table_01'); { const b = new THREE.Box3().setFromObject(tableP), s = b.getSize(new THREE.Vector3()); tableP.scale.setScalar(0.76 / s.y); }
  anchors.seats = [];
  const tableAt = (x, z, chairs) => {
    put(root, tableP.clone(true), x, 0, z); col(x - 0.4, x + 0.4, z - 0.4, z + 0.4);
    for (const a of chairs) { const cx = x + Math.sin(a) * 0.72, cz2 = z + Math.cos(a) * 0.72; put(root, chairP.clone(true), cx, 0, cz2, a + Math.PI); anchors.seats.push({x: cx, z: cz2, ry: a + Math.PI, table: [x, z]}); }
  };
  tableAt(-6.4, 31.0, [Math.PI / 2, -Math.PI / 2]);
  tableAt(-4.3, 32.7, [0, Math.PI]);
  tableAt(-6.4, 34.3, [Math.PI / 2, -Math.PI / 2]);
  for (const s of anchors.seats) col(s.x - 0.22, s.x + 0.22, s.z - 0.22, s.z + 0.22);
  // window bar along the glass (west part) with stools
  P.box(root, 4.0, 0.05, 0.45, MAT.oak, -5.6, 1.05, 35.55); for (const x of [-7.4, -3.8]) P.box(root, 0.05, 1.05, 0.05, MAT.trim, x, 0, 35.55);
  col(-7.6, -3.6, 35.3, 35.8);
  const stool = await model('bar_chair_round_01');
  for (const x of [-7.0, -6.0, -5.0, -4.1]) put(root, stool.clone(true), x, 0, 35.0, Math.PI);
  // a sofa corner on the west wall
  const sofa = await model('sofa_02'); { const b = new THREE.Box3().setFromObject(sofa), s = b.getSize(new THREE.Vector3()); sofa.scale.setScalar(2.0 / Math.max(s.x, s.z)); }
  put(root, sofa, -7.45, 0, 32.65, Math.PI / 2); col(-7.9, -7.0, 31.6, 33.7);
  // comment-card box on the pier right of the door
  const cbox = P.group(root, 7.88, 1.0, 35.0, -Math.PI / 2);
  P.rbox(cbox, 0.32, 0.36, 0.16, 0.01, MAT.oak, 0, 0, 0); P.box(cbox, 0.2, 0.012, 0.02, MAT.black, 0, 0.3, 0.08);
  P.box(cbox, 0.26, 0.03, 0.14, MAT.oak, 0, -0.08, 0.02);
  for (let i = 0; i < 5; i++) P.box(cbox, 0.15, 0.002, 0.1, MAT.paper, 0.02, -0.048 + i * 0.003, 0.03);
  const label = canvasTex(256, 64, (g, W, Hh) => { g.fillStyle = '#efe6d2'; g.fillRect(0, 0, W, Hh); g.fillStyle = '#2b2b2b'; g.font = '600 30px "IBM Plex Sans Arabic"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('رأيك يهمنا', W / 2, Hh / 2 + 2); });
  const lb = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.065), new THREE.MeshStandardMaterial({map: label, roughness: 0.8})); lb.position.set(0, 0.24, 0.082); cbox.add(lb);
  anchors.commentBox = new THREE.Vector3(7.75, 1.15, 35.0); anchors.commentStand = {x: 7.1, z: 35.0};
  // plants
  const plant = await model('potted_plant_01'); { const b = new THREE.Box3().setFromObject(plant), s = b.getSize(new THREE.Vector3()); plant.scale.setScalar(1.3 / s.y); }
  for (const [x, z] of [[7.4, 35.4], [-7.4, 29.9], [1.6, 35.4]]) { put(root, plant.clone(true), x, 0, z); col(x - 0.3, x + 0.3, z - 0.3, z + 0.3); }
  // staircase to the meeting room (west back corner, rising towards the back wall)
  const stairX0 = -7.8, stairX1 = -6.6;
  for (let i = 0; i < 18; i++) P.box(root, stairX1 - stairX0, (i + 1) * (UP / 18), 0.22, MAT.darkWood, (stairX0 + stairX1) / 2, 0, 30.6 - i * 0.22);
  P.box(root, 0.05, 1.0, 4.0, MAT.trim, stairX1, 0.9, 28.6); P.box(root, 0.05, 0.05, 4.4, MAT.oak, stairX1, 1.9, 28.6);
  col(stairX0, stairX1 + 0.05, 26.6, 30.75);
  anchors.stairs = {x: -7.1, z: 31.5}; anchors.stairsLook = new THREE.Vector3(-7.2, 2.2, 28.5);
  const staff = canvasTex(256, 64, (g, W, Hh) => { g.fillStyle = '#1d1f1e'; g.fillRect(0, 0, W, Hh); g.fillStyle = '#efe6d2'; g.font = '500 28px "IBM Plex Sans Arabic"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('غرفة الاجتماعات ↑', W / 2, Hh / 2 + 2); });
  const st = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.15), new THREE.MeshStandardMaterial({map: staff, roughness: 0.7})); st.position.set(-6.55, 2.1, 30.7); st.rotation.y = Math.PI / 2; root.add(st);

  // pendants over the counter and tables (light specs feed the shared point-light pool)
  const lamp = await model('hanging_industrial_lamp', 'hanging_industrial_lamp_lod').catch(() => model('hanging_industrial_lamp'));
  const lb2 = new THREE.Box3().setFromObject(lamp);
  const pend = (x, z, i = 3.0, d = 7) => { const o = lamp.clone(true); o.scale.setScalar(0.7); o.position.set(x, B.H - 0.02 - lb2.max.y * 0.7, z); o.traverse(m => { if (m.isMesh) m.castShadow = false; }); root.add(o); addLightSpec({x, y: B.H - 0.75, z, i, d}); };
  for (const x of [-2.2, 0, 2.2, 4.6]) pend(x, 29.2, 2.6, 7);
  for (const [x, z] of [[-6.4, 31.0], [-4.3, 32.7], [-6.4, 34.3], [0.8, 33.2], [4.2, 33.4]]) pend(x, z, 2.3, 8);
  addLightSpec({x: 1.4, y: 2.4, z: 27.3, i: 2.0, d: 6});      // over the back bar
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
function makeClockHands(parent, c) {
  const g = P.group(parent, c.x, c.y, c.z + 0.012);
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
    const x = r.x1 - 0.05 - i * Math.min(0.12, (r.x1 - r.x0 - 0.1) / Math.max(1, n));
    m.position.set(x, r.y, r.z + 0.005); m.rotation.z = (Math.sin(num * 7.1) * 0.06); m.userData.num = num;
    g.add(m); out.push(m);
  }
  cafe.tickets = out;
  return out;
}
export function ticketMesh(num) { return (cafe.tickets || []).find(m => m.userData.num === num); }

// ---------------------------------------------------------------- upstairs: meeting room (y = 4)
async function upstairs() {
  const y0 = UP, H2 = 2.9;
  // floor slab over the whole ground floor
  P.box(root, B.x1 - B.x0, 0.5, B.z1 - B.z0, M.concrete, 0, B.H, (B.z0 + B.z1) / 2);
  const rx0 = -7.8, rx1 = -0.6, rz0 = 30.4, rz1 = 35.85;
  P.floorPlane(root, rx1 - rx0, rz1 - rz0, pbr('grey_oak_veneer_01', [0.6, 0.6], {color: 0xb7aa98, roughness: 0.6}), (rx0 + rx1) / 2, (rz0 + rz1) / 2, y0 + 0.005);
  wall(rx0, rz0, rx1, rz0, MAT.plaster, {y0, h: H2, lv: 1});
  wall(rx0, rz0, rx0, rz1, MAT.plaster, {y0, h: H2, lv: 1});
  wall(rx1, rz0, rx1, rz1, MAT.plaster, {y0, h: H2, lv: 1, openings: [[30.8, 31.8]], doorH: 2.2});
  P.box(root, rx1 - rx0, 0.12, rz1 - rz0, new THREE.MeshStandardMaterial({color: 0xeeebe5, roughness: 0.9}), (rx0 + rx1) / 2, y0 + H2, (rz0 + rz1) / 2);
  // window wall onto the street (full-height glass between piers)
  storefront(rx0 + 0.2, rx1 - 0.2, 36.2, {y0, h: H2 - 0.15, sill: 0.8, lv: 1});
  // table + chairs
  const tbl = P.group(root, -4.3, y0, 33.0);
  P.rbox(tbl, 2.6, 0.05, 1.15, 0.02, MAT.oak, 0, 0.72, 0); for (const sx of [-1, 1]) P.box(tbl, 0.08, 0.72, 0.9, MAT.trim, sx * 1.05, 0, 0);
  building = 1; col(-5.6, -3.0, 32.42, 33.58); building = 0;
  const chair = await model('modern_arm_chair_01').catch(() => null);
  const seat = (x, z, ry) => { if (chair) { const c = chair.clone(true); const b = new THREE.Box3().setFromObject(c), s = b.getSize(new THREE.Vector3()); c.scale.setScalar(0.85 / s.y); put(root, c, x, y0, z, ry); } return {x, z, ry, y: y0}; };
  anchors.meet = {
    ellis: seat(-3.75, 32.05, 0), noor: seat(-4.85, 32.05, 0), priya: seat(-2.45, 33.0, -Math.PI / 2),
    player: seat(-3.9, 33.95, Math.PI), present: {x: -6.75, z: 33.9, ry: Math.PI / 2 + 0.35, y: y0},
    arrive: {x: -1.25, z: 31.3, ry: -Math.PI / 2, y: y0}, door: {x: -0.4, z: 31.3},
  };
  building = 1; for (const k of ['ellis', 'noor', 'priya', 'player']) { const s = anchors.meet[k]; col(s.x - 0.25, s.x + 0.25, s.z - 0.25, s.z + 0.25); } building = 0;
  // wall screen for the memo slides (west wall)
  screens.meet = P.wallScreen(root, -7.66, y0 + 0.95, 33.0, Math.PI / 2, 2.2, 1.24);   // just in front of the wall face (x -7.7)
  screens.meet.mat.emissiveIntensity = 0.28;
  anchors.screen = new THREE.Vector3(-7.7, y0 + 1.57, 33.0);
  // the cost tablet on the table in front of Ellis
  cafe.tabletPos = new THREE.Vector3(-3.75, y0 + 0.78, 32.75);
  // a credenza with a plant and water jug; ceiling lights
  P.box(root, 1.8, 0.8, 0.45, MAT.darkWood, -2.0, y0, 30.65); building = 1; col(-2.9, -1.1, 30.4, 30.9); building = 0;
  const pl = await model('potted_plant_02').catch(() => null); if (pl) { const b = new THREE.Box3().setFromObject(pl), s = b.getSize(new THREE.Vector3()); pl.scale.setScalar(0.9 / s.y); put(root, pl, -7.3, y0, 35.3); }
  for (let i = 0; i < 4; i++) P.mug(root, -2.6 + i * 0.12, y0 + 0.8, 30.7, 0xf2efe8);
  for (const [n, x, z, ry] of [['hanging_picture_frame_01', -4.9, 30.5, 0], ['hanging_picture_frame_02', -3.2, 30.5, 0]]) {
    const f = await model(n).catch(() => null); if (!f) continue; const b = new THREE.Box3().setFromObject(f), s = b.getSize(new THREE.Vector3()); f.scale.setScalar(0.75 / Math.max(s.x, s.y)); put(root, f, x, y0 + 1.35, z + 0.03, ry); }
  const wb = P.group(root, -0.7, y0 + 0.95, 33.6, -Math.PI / 2); P.box(wb, 1.6, 1.0, 0.03, new THREE.MeshStandardMaterial({color: 0xf7f7f5, roughness: 0.25}), 0, 0, 0); P.box(wb, 1.64, 0.04, 0.06, MAT.trim, 0, -0.02, 0.02);
  const wbt = canvasTex(512, 320, (g, W, Hh) => { g.fillStyle = 'rgba(0,0,0,0)'; g.clearRect(0, 0, W, Hh); g.strokeStyle = '#2d5bb0'; g.lineWidth = 4; g.font = '500 30px "IBM Plex Sans Arabic"'; g.fillStyle = '#2d5bb0'; g.textAlign = 'right'; g.fillText('خطة الربع القادم', W - 30, 50); g.beginPath(); g.moveTo(40, 260); g.lineTo(140, 200); g.lineTo(230, 220); g.lineTo(330, 140); g.lineTo(460, 120); g.stroke(); g.fillStyle = '#b03a2d'; g.fillText('• الذروة؟', W - 30, 110); });
  const wbm = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.94), new THREE.MeshStandardMaterial({map: wbt, transparent: true, roughness: 0.4})); wbm.position.set(0, 0.5, 0.017); wb.add(wbm);
  const ext = await model('korean_fire_extinguisher_01').catch(() => null); if (ext) { const b = new THREE.Box3().setFromObject(ext), s = b.getSize(new THREE.Vector3()); ext.scale.setScalar(0.5 / s.y); put(root, ext, -0.85, y0, 32.4, -Math.PI / 2); }
  for (const [x, z] of [[-5.2, 33.0], [-3.4, 33.0]]) { P.box(root, 1.2, 0.04, 0.3, new THREE.MeshStandardMaterial({color: 0xffffff, emissive: 0xfff2dc, emissiveIntensity: 1.2}), x, y0 + H2 - 0.04, z, 0, {cast: false}); addLightSpec({x, y: y0 + H2 - 0.3, z, i: 2.4, d: 7, c: 0xffe2bd}); }
}

// ---------------------------------------------------------------- exterior: façade above the café, neighbours along the street
function exterior() {
  const {x0, x1, z1} = B, top = 7.6;
  // upper façade (brick): the meeting-room window (x -7.6..-0.8, real glass behind) and two windows with blinds
  const fz = z1 + 0.32, wy0 = UP + 0.8, wy1 = UP + 2.75;
  const fpiece = (xa, xb, ya, yb) => P.box(roofGroup, xb - xa, yb - ya, 0.3, MAT.facade, (xa + xb) / 2, ya, fz);
  fpiece(x0 - 0.2, x1 + 0.2, B.H, wy0); fpiece(x0 - 0.2, x1 + 0.2, wy1, top);
  for (const [xa, xb] of [[x0 - 0.2, -7.6], [-0.8, 0.7], [3.3, 4.3], [6.9, x1 + 0.2]]) fpiece(xa, xb, wy0, wy1);
  const blind = canvasTex(256, 256, (g, W, Hh) => { g.fillStyle = '#d9d2c4'; g.fillRect(0, 0, W, Hh); g.fillStyle = 'rgba(0,0,0,.14)'; for (let y = 0; y < Hh; y += 9) g.fillRect(0, y, W, 2); });
  for (const [xa, xb] of [[0.7, 3.3], [4.3, 6.9]]) { const cx = (xa + xb) / 2, w = xb - xa; const m = new THREE.Mesh(new THREE.PlaneGeometry(w, wy1 - wy0), new THREE.MeshStandardMaterial({map: blind, roughness: 0.7})); m.position.set(cx, (wy0 + wy1) / 2, fz - 0.1); root.add(m); P.box(root, w, wy1 - wy0, 0.02, MAT.glass, cx, wy0, fz + 0.05, 0, {cast: false, recv: false}).renderOrder = 2; P.box(root, 0.06, wy1 - wy0, 0.08, MAT.trim, cx, wy0, fz + 0.05); P.box(root, w, 0.06, 0.12, MAT.trim, cx, wy0 - 0.06, fz + 0.1); }
  P.box(root, 6.8, 0.06, 0.12, MAT.trim, -4.2, wy0 - 0.06, fz + 0.1);
  P.box(roofGroup, x1 - x0 + 0.6, 0.5, B.z1 - B.z0 + 0.6, M.roof, 0, top, (B.z0 + B.z1) / 2);
  // shop sign band over the storefront (fictional name)
  const sign = canvasTex(1024, 160, (g, W, Hh) => { g.fillStyle = '#1c2621'; g.fillRect(0, 0, W, Hh); g.fillStyle = '#efe6d2'; g.font = '700 80px "IBM Plex Sans Arabic"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('مقهى الميدان', W / 2, Hh / 2 + 6); });
  const sm = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 0.85), new THREE.MeshStandardMaterial({map: sign, emissive: 0xffffff, emissiveMap: sign, emissiveIntensity: 0.3, roughness: 0.6}));
  sm.position.set(-2.5, B.H + 0.05, z1 + 0.5); root.add(sm);
  // awning over the door
  const aw = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.05, 1.3), new THREE.MeshStandardMaterial({color: 0x24392f, roughness: 0.9})); aw.position.set(3.2, 2.85, z1 + 0.7); aw.rotation.x = -0.3; aw.castShadow = true; root.add(aw);
  // neighbours: a row of 3-storey buildings with shopfronts left and right of the café
  const fac = [0xc9b79d, 0xb59f86, 0xd4c6b0, 0xa98f78];
  const row = (xa, xb, k0) => { let x = xa, k = k0; while (x < xb - 0.1) { const w = Math.min(7 + (k * 3) % 4, xb - x); neighbour(x + w / 2, w, fac[k % fac.length], k); x += w; k++; } };
  row(-44, x0 - 0.05, 0); row(x1 + 0.05, 44, 2);
  // sidewalk in front (the traffic module paints the far one) + kerb trees
  P.floorPlane(root, 90, 4.2, pbr('herringbone_pavement_03', [0.35, 0.35], {color: 0xb7aa98}), 0, 38.0, 0.025);
}
function neighbour(cx, w, color, k) {
  const z1 = B.z1, h = 3.4 * 3, d = 10;
  const facade = pbr('painted_plaster_wall', [0.4, 0.4], {color});
  P.box(roofGroup, w, h, d, facade, cx, 0, z1 - d / 2 + 0.2);
  const win = new THREE.MeshStandardMaterial({color: 0x1d2328, metalness: 0.4, roughness: 0.1, envMapIntensity: 1.2});
  for (let f = 1; f < 3; f++) for (let i = 0; i < Math.max(1, Math.floor(w / 2.4)); i++) { const wx = cx - w / 2 + 1.2 + i * 2.4; P.box(roofGroup, 1.2, 1.5, 0.06, win, wx, f * 3.4 + 0.9, z1 + 0.22); }
  const shop = canvasTex(512, 256, (c, W, Hh) => { const gr = c.createLinearGradient(0, 0, 0, Hh); gr.addColorStop(0, '#4a3524'); gr.addColorStop(1, '#22180f'); c.fillStyle = gr; c.fillRect(0, 0, W, Hh); for (let i = 0; i < 6; i++) { c.fillStyle = `rgba(255,${200 + i * 5},140,.8)`; c.beginPath(); c.arc(40 + i * 85, 28, 8, 0, 7); c.fill(); } c.fillStyle = ['#8a6a4a', '#5f7a6a', '#7a4a3a', '#6a6a7a'][k % 4]; for (let i = 0; i < 5; i++) c.fillRect(30 + i * 95, 120 + (i % 2) * 12, 70, 80); });
  const sw = new THREE.Mesh(new THREE.PlaneGeometry(w - 1.0, 2.4), new THREE.MeshStandardMaterial({map: shop, emissive: 0xffffff, emissiveMap: shop, emissiveIntensity: 0.4, roughness: 0.15}));
  sw.position.set(cx, 1.5, z1 + 0.23); roofGroup.add(sw);
  P.box(roofGroup, w - 0.8, 0.1, 0.12, MAT.trim, cx, 2.75, z1 + 0.24);
  col(cx - w / 2, cx + w / 2, z1 - d + 0.2, z1 + 0.2);
}

export async function buildBuilding() {
  mats();
  scene.add(root); scene.add(live);
  await groundFloor();
  await upstairs();
  exterior();
  setLevel(0);
  mergeStatic(root, {cell: 8});
  return root;
}
export {live as liveGroup};
