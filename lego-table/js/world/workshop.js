// The product workshop of "Rukn Toys" (Concept A §2): a large, bright room on a weekday morning. North: a wall of
// industrial windows in black steel frames onto a street; a light polished-concrete floor; white walls. West: open
// shelving with plain boxes and coloured bins. South: a tool pegboard, a sample shelf, a plant, the door. East: the
// meeting wall — a cork board with sticky notes, the archive board (three panels behind two sliding white doors
// marked "الأرشيف · Archive") and a wall clock. The worktable stands west of centre, the review table east.
// No logos and no real products anywhere.
import * as THREE from 'three';
import {model} from '../core/assets.js';
import {onUpdate} from '../core/engine.js';
import {pbr, canvasTex} from './materials.js';
import {mergeStatic} from './merge.js';
import {buildDressing} from './dressing.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const ROOM = {x0: -5.6, x1: 6.4, z0: -4.2, z1: 4.0, h: 3.6};
export const WT = {x: -1.8, y: 0.9, z: -0.7, w: 2.9, d: 1.45};        // the worktable (top centre, top height)
export const RT = {x: 3.3, y: 0.74, z: -0.2, w: 2.6, d: 1.1};         // the review table
// seats at the review table: the three on its north side (the player's left), Victor at its head facing the player
export const SEATS = {
  ina: {x: RT.x - 0.62, z: RT.z - 0.9, ry: 0}, mikael: {x: RT.x + 0.08, z: RT.z - 0.9, ry: 0}, rania: {x: RT.x + 0.78, z: RT.z - 0.9, ry: 0},
  victor: {x: RT.x + 1.72, z: RT.z, ry: -Math.PI / 2}, player: {x: RT.x - 1.72, z: RT.z, ry: Math.PI / 2},
};
// where the three stand at the worktable (Ina behind the new theme, Mikael behind delivery, Rania at the east end)
export const STAND = {
  ina: {x: WT.x - 0.35, z: WT.z - 1.12, ry: 0.05}, mikael: {x: WT.x + 0.35, z: WT.z - 1.12, ry: -0.05},
  rania: {x: WT.x + 1.86, z: WT.z - 0.05, ry: -1.05},
};
export const EYE = {stand: V(WT.x + 0.1, 1.66, WT.z + 1.32), seat: V(SEATS.player.x - 0.12, 1.19, RT.z)};
export const ARCH = {x: ROOM.x1 - 0.035, y: 1.86, z: RT.z, w: 3.0, h: 1.36};   // the archive board on the east wall
export const venue = new THREE.Group(); venue.name = 'venue';            // furniture (hands and bodies keep out of it)
export const room = new THREE.Group(); room.name = 'room';
export const GLOW = [];                                                  // the linear lights' diffusers

// a fixed random sequence (the same shelves every time)
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const boxG = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export function mesh(parent, geo, mat, x = 0, y = 0, z = 0, {cast = true, recv = true} = {}) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = recv; parent.add(m); return m;
}
const box = (p, w, h, d, mat, x, y, z, o) => mesh(p, boxG(w, h, d), mat, x, y, z, o);
const std = (color, roughness = 0.7, extra = {}) => new THREE.MeshStandardMaterial({color, roughness, ...extra});

export const MAT = {};
function materials() {
  // light polished concrete (a scanned floor, one tile per 2.4 m), whitewashed brick on the loft walls
  const {x0, x1, z0, z1, h} = ROOM;
  MAT.floor = pbr('concrete_floor_worn_001', [(x1 - x0) / 2.4, (z1 - z0) / 2.4], {color: 0xe8e8e6, roughness: 0.62, envMapIntensity: 1.1});
  MAT.brickW = pbr('whitewashed_brick', [(z1 - z0) / 1.5, h / 1.5], {color: 0xf6f3ee, roughness: 0.95});
  MAT.brickS = pbr('whitewashed_brick', [(x1 - x0) / 1.5, h / 1.5], {color: 0xf6f3ee, roughness: 0.95});
  MAT.brickN = (w, hh) => pbr('whitewashed_brick', [w / 1.5, hh / 1.5], {color: 0xf6f3ee, roughness: 0.95});
  // white painted walls with a faint roller texture
  const wallTex = canvasTex(512, 512, (g, W, H) => { g.fillStyle = '#f1f0ec'; g.fillRect(0, 0, W, H); for (let i = 0; i < 14000; i++) { const v = rnd(); g.fillStyle = v < 0.5 ? `rgba(0,0,0,${rnd() * 0.035})` : `rgba(255,255,255,${rnd() * 0.05})`; g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 3, 1 + rnd() * 3); } });
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping; wallTex.repeat.set(6, 2);
  MAT.wall = new THREE.MeshStandardMaterial({map: wallTex, color: 0xefeeea, roughness: 0.93});
  MAT.ceiling = std(0xf1f0ec, 0.95);
  MAT.steel = std(0x1c1d1f, 0.42, {metalness: 0.55});              // black steel (windows, legs, uprights)
  MAT.steelGrey = std(0x8d9298, 0.4, {metalness: 0.6});
  MAT.glass = new THREE.MeshPhysicalMaterial({color: 0xe6eef0, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.12, envMapIntensity: 1.2, depthWrite: false, side: THREE.DoubleSide});
  MAT.sill = std(0xe9e7e2, 0.6);
  MAT.ply = pbr('plywood', [WT.w / 1.2, 1], {color: 0xfff6e8, roughness: 0.62});          // birch-ply worktop
  MAT.plyEdge = std(0xd8c4a0, 0.7);
  MAT.shelf = pbr('oak_veneer_01', [1, 1], {color: 0xeadbc0, roughness: 0.66});
  MAT.white = std(0xf3f2ef, 0.42);
  MAT.oak = pbr('oak_veneer_01', [1, 1], {roughness: 0.55});
  MAT.kraft = std(0xbf9567, 0.92);
  MAT.kraftDark = std(0xa87f53, 0.92);
  MAT.tape = std(0xcfb48c, 0.5);
  MAT.skirting = std(0x3a3c3f, 0.6);
  MAT.cork = new THREE.MeshStandardMaterial({roughness: 0.95, map: canvasTex(512, 384, (g, W, H) => {
    g.fillStyle = '#b98a55'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 9000; i++) { const s = rnd(); g.fillStyle = s < 0.5 ? `rgba(90,55,25,${0.08 + rnd() * 0.2})` : `rgba(235,200,150,${0.06 + rnd() * 0.15})`; g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2.5, 1 + rnd() * 2.5); }
  })});
}

// ---------------------------------------------------------------- the room shell
function shell() {
  const {x0, x1, z0, z1, h} = ROOM, W = x1 - x0, D = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const fl = mesh(room, new THREE.PlaneGeometry(W, D), MAT.floor, cx, 0, cz, {cast: false}); fl.rotation.x = -Math.PI / 2;
  const ce = mesh(room, new THREE.PlaneGeometry(W, D), MAT.ceiling, cx, h, cz); ce.rotation.x = Math.PI / 2;     // (casts: the roof keeps the sun out)
  // west, east, south walls (plaster); skirting along them
  const wall = (len, x, z, ry, m = MAT.wall) => { const o = mesh(room, new THREE.PlaneGeometry(len, h), m, x, h / 2, z); o.rotation.y = ry; return o; };
  wall(D, x0, cz, Math.PI / 2, MAT.brickW); wall(D, x1, cz, -Math.PI / 2); wall(W, cx, z1, Math.PI, MAT.brickS);
  box(room, 0.012, 0.08, D, MAT.skirting, x0 + 0.006, 0.04, cz); box(room, 0.012, 0.08, D, MAT.skirting, x1 - 0.006, 0.04, cz);
  box(room, W, 0.08, 0.012, MAT.skirting, cx, 0.04, z1 - 0.006);
  // the north window wall: solid below 0.85 m and above 3.25 m, steel windows between
  const wy0 = 0.85, wy1 = 3.25, wx0 = x0 + 0.35, wx1 = x1 - 0.35;
  const north = (w, hh, x, y) => { const m = mesh(room, new THREE.PlaneGeometry(w, hh), MAT.brickN(w, hh), x, y, z0); return m; };
  north(W, wy0, cx, wy0 / 2); north(W, h - wy1, cx, (h + wy1) / 2);
  north(wx0 - x0, wy1 - wy0, (x0 + wx0) / 2, (wy0 + wy1) / 2); north(x1 - wx1, wy1 - wy0, (x1 + wx1) / 2, (wy0 + wy1) / 2);
  // the wall's thickness at the opening (reveals) and a sill
  box(room, wx1 - wx0, 0.03, 0.26, MAT.sill, (wx0 + wx1) / 2, wy0 - 0.015, z0 + 0.1);
  box(room, wx1 - wx0, 0.02, 0.22, MAT.wall, (wx0 + wx1) / 2, wy1 + 0.01, z0 - 0.08, {cast: false});
  box(room, 0.02, wy1 - wy0, 0.22, MAT.wall, wx0 - 0.01, (wy0 + wy1) / 2, z0 - 0.08, {cast: false});
  box(room, 0.02, wy1 - wy0, 0.22, MAT.wall, wx1 + 0.01, (wy0 + wy1) / 2, z0 - 0.08, {cast: false});
  // steel frames: four big bays, each a grid of small panes (thin glazing bars, heavier mullions between bays)
  const bays = 4, bw = (wx1 - wx0) / bays, cols = 5, rows = 6, fz = z0 - 0.06;
  for (let b = 0; b <= bays; b++) box(room, 0.07, wy1 - wy0, 0.09, MAT.steel, wx0 + b * bw, (wy0 + wy1) / 2, fz);
  box(room, wx1 - wx0 + 0.07, 0.07, 0.09, MAT.steel, (wx0 + wx1) / 2, wy0 + 0.035, fz);
  box(room, wx1 - wx0 + 0.07, 0.07, 0.09, MAT.steel, (wx0 + wx1) / 2, wy1 - 0.035, fz);
  for (let b = 0; b < bays; b++) {
    const bx = wx0 + b * bw;
    for (let c = 1; c < cols; c++) box(room, 0.025, wy1 - wy0, 0.04, MAT.steel, bx + c * bw / cols, (wy0 + wy1) / 2, fz);
    for (let r = 1; r < rows; r++) box(room, bw, r === 2 ? 0.05 : 0.025, r === 2 ? 0.07 : 0.04, MAT.steel, bx + bw / 2, wy0 + r * (wy1 - wy0) / rows, fz);
    // an opening pane (hopper) in each bay, slightly tilted in
    const hp = new THREE.Group(); hp.position.set(bx + bw / 2, wy0 + 2 * (wy1 - wy0) / rows, fz + 0.02); hp.rotation.x = -0.12; room.add(hp);
    box(hp, bw - 0.02, 0.025, 0.035, MAT.steel, 0, (wy1 - wy0) / rows, 0);
  }
  // the glass: a faint film with smudges and grime at the edges of each pane, and on top of it the reflections of the
  // room (added light, so the street stays visible through it); old glass is a little wavy, every pane its own way
  const GW = wx1 - wx0, GH = wy1 - wy0, pc = bays * cols, pr = rows;
  const film = canvasTex(2048, 512, (g, W2, H2) => {
    const cw = W2 / pc, chh = H2 / pr;
    g.fillStyle = '#121212'; g.fillRect(0, 0, W2, H2);
    for (let i = 0; i < pc; i++) for (let j = 0; j < pr; j++) {
      const x = i * cw, y = j * chh;
      const gr = g.createLinearGradient(x, y + chh, x, y); gr.addColorStop(0, 'rgba(70,70,70,1)'); gr.addColorStop(0.22, 'rgba(26,26,26,1)'); gr.addColorStop(1, 'rgba(18,18,18,1)');
      g.fillStyle = gr; g.fillRect(x, y, cw, chh);
      for (let k = 0; k < 3; k++) { const sx = x + rnd() * cw, sy = y + rnd() * chh, r = 6 + rnd() * 16; const rg = g.createRadialGradient(sx, sy, 0, sx, sy, r); rg.addColorStop(0, `rgba(90,90,90,${0.5 + rnd() * 0.4})`); rg.addColorStop(1, 'rgba(18,18,18,0)'); g.fillStyle = rg; g.fillRect(sx - r, sy - r, 2 * r, 2 * r); }
      g.strokeStyle = 'rgba(80,80,80,.9)'; g.lineWidth = 3; g.strokeRect(x + 1.5, y + 1.5, cw - 3, chh - 3);
    }
  });
  film.wrapS = film.wrapT = THREE.ClampToEdgeWrapping;
  const wavy = canvasTex(1024, 256, (g, W2, H2) => {
    const cw = W2 / pc, chh = H2 / pr, img = g.createImageData(W2, H2), d = img.data;
    const tilt = []; for (let i = 0; i < pc * pr; i++) tilt.push([(rnd() - 0.5) * 0.12, (rnd() - 0.5) * 0.12, rnd() * 6]);
    for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) {
      const i = Math.min(pc - 1, Math.floor(x / cw)), j = Math.min(pr - 1, Math.floor(y / chh)), t = tilt[i * pr + j];
      const nx = t[0] + Math.sin(y * 0.21 + t[2]) * 0.03, ny = t[1] + Math.sin(x * 0.17 + t[2] * 1.7) * 0.03, k = (y * W2 + x) * 4;
      d[k] = (nx * 0.5 + 0.5) * 255; d[k + 1] = (ny * 0.5 + 0.5) * 255; d[k + 2] = 255; d[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, {srgb: false});
  const glassFilm = new THREE.MeshStandardMaterial({color: 0xd9e2dd, roughness: 0.35, transparent: true, alphaMap: film, depthWrite: false});
  const glassRefl = new THREE.MeshStandardMaterial({color: 0x000000, roughness: 0.03, metalness: 0, normalMap: wavy, normalScale: new THREE.Vector2(0.8, 0.8), envMapIntensity: 0.45, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false});
  for (const [m, dz] of [[glassFilm, -0.005], [glassRefl, -0.004]]) { const gl = mesh(room, new THREE.PlaneGeometry(GW, GH), m, (wx0 + wx1) / 2, (wy0 + wy1) / 2, fz + dz, {cast: false, recv: false}); gl.renderOrder = 2; }
  // radiators under the windows
  for (const x of [2.0, 4.8]) {
    for (let i = 0; i < 14; i++) box(room, 0.045, 0.5, 0.08, MAT.white, x - 0.35 + i * 0.054, 0.42, z0 + 0.12);
    box(room, 0.03, 0.03, 0.03, MAT.steelGrey, x + 0.42, 0.2, z0 + 0.12);
  }
  // an exposed round duct along the ceiling, on hangers
  const duct = mesh(room, new THREE.CylinderGeometry(0.2, 0.2, W - 0.4, 28, 1, true), new THREE.MeshStandardMaterial({color: 0xb7bbbf, roughness: 0.35, metalness: 0.8, side: THREE.DoubleSide}), cx, h - 0.38, z1 - 1.1, {cast: false});
  duct.rotation.z = Math.PI / 2;
  for (let i = 0; i < 6; i++) box(room, 0.02, 0.2, 0.02, MAT.steelGrey, x0 + 1 + i * 2, h - 0.1, z1 - 1.1, {cast: false});
  // steel beams across the ceiling, a red sprinkler main with heads, saw-cut joints in the floor
  const beam = std(0x3b3e42, 0.5, {metalness: 0.5});
  for (const x of [-4.1, -1.1, 1.9, 4.9]) {
    box(room, 0.012, 0.3, D, beam, x, h - 0.15, cz, {cast: false});
    box(room, 0.16, 0.016, D, beam, x, h - 0.308, cz, {cast: false}); box(room, 0.16, 0.016, D, beam, x, h - 0.008, cz, {cast: false});
  }
  const red = std(0xa8261c, 0.45, {metalness: 0.3});
  const sp = mesh(room, new THREE.CylinderGeometry(0.03, 0.03, W - 0.3, 14), red, cx, h - 0.42, -1.6, {cast: false}); sp.rotation.z = Math.PI / 2;
  for (let x = x0 + 1.0; x < x1 - 0.5; x += 2.4) { mesh(room, new THREE.CylinderGeometry(0.012, 0.012, 0.12, 8), red, x, h - 0.5, -1.6, {cast: false}); mesh(room, new THREE.CylinderGeometry(0.03, 0.01, 0.02, 12), MAT.steelGrey, x, h - 0.57, -1.6, {cast: false}); }
  const joint = std(0x6d7075, 0.9);
  for (const x of [-2.6, 0.4, 3.4]) { const j = mesh(room, new THREE.PlaneGeometry(0.006, D), joint, x, 0.0012, cz, {cast: false}); j.rotation.x = -Math.PI / 2; }
  for (const z of [-1.2, 1.8]) { const j = mesh(room, new THREE.PlaneGeometry(W, 0.006), joint, cx, 0.0012, z, {cast: false}); j.rotation.x = -Math.PI / 2; }
  // the door (south wall, east end): a grey steel door with a push plate
  const dx = 4.7;
  box(room, 1.08, 2.2, 0.05, MAT.steel, dx, 1.1, z1 - 0.02);
  box(room, 0.96, 2.12, 0.04, std(0xb9bec3, 0.45, {metalness: 0.3}), dx, 1.08, z1 - 0.045);
  box(room, 0.03, 0.03, 0.18, MAT.steelGrey, dx - 0.36, 1.02, z1 - 0.1);
  box(room, 0.03, 0.03, 0.03, MAT.steelGrey, dx - 0.36, 1.02, z1 - 0.07);
}

// ---------------------------------------------------------------- the linear lights over the tables
function linearLight(x, y, z, len, ry = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; room.add(g);
  box(g, len, 0.055, 0.075, MAT.steel, 0, 0, 0, {cast: false});
  const dif = std(0xffffff, 1, {emissive: 0xfff1dc, emissiveIntensity: 1.6}); GLOW.push(dif);
  box(g, len - 0.02, 0.006, 0.06, dif, 0, -0.03, 0, {cast: false, recv: false});
  for (const s of [-1, 1]) box(g, 0.004, ROOM.h - y, 0.004, MAT.steelGrey, s * len * 0.4, (ROOM.h - y) / 2, 0, {cast: false});
  return g;
}

let _blockMat = null;
const BLOCK_MAT = () => _blockMat ||= pbr('oak_veneer_01', [0.15, 0.15], {color: 0xf2dcb4, roughness: 0.55});

// ---------------------------------------------------------------- south wall: pegboard, sample shelf, plant, cabinet
function southWall() {
  const z = ROOM.z1 - 0.025, x0 = -4.7, x1 = -2.3, y0 = 1.05, y1 = 2.2;
  const peg = new THREE.MeshStandardMaterial({roughness: 0.85, map: canvasTex(1024, 512, (g, W, H) => {
    g.fillStyle = '#d6bf98'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(120,85,40,${rnd() * 0.06})`; g.fillRect(rnd() * W, rnd() * H, 3 + rnd() * 30, 1); }
    g.fillStyle = '#4a3b2a';
    for (let y = 14; y < H; y += 21) for (let x = 14; x < W; x += 21) { g.beginPath(); g.arc(x, y, 3.2, 0, 7); g.fill(); }
  })});
  const pb = mesh(room, new THREE.PlaneGeometry(x1 - x0, y1 - y0), peg, (x0 + x1) / 2, (y0 + y1) / 2, z, {cast: false}); pb.rotation.y = Math.PI;
  box(room, x1 - x0 + 0.04, 0.03, 0.02, MAT.plyEdge, (x0 + x1) / 2, y1 + 0.015, z - 0.005); box(room, x1 - x0 + 0.04, 0.03, 0.02, MAT.plyEdge, (x0 + x1) / 2, y0 - 0.015, z - 0.005);
}

// ---------------------------------------------------------------- east wall: the cork board, the archive board, the clock
export const ARCHIVE = {doors: [], panels: [], open: 0, want: 0, label: null};
function eastWall() {
  const x = ROOM.x1 - 0.02;
  // the cork board with sticky notes (scribbles, no words)
  const cb = mesh(room, new THREE.PlaneGeometry(1.5, 1.0), MAT.cork, x, 1.62, -3.0, {cast: false}); cb.rotation.y = -Math.PI / 2;
  box(room, 0.03, 1.04, 0.025, MAT.oak, x - 0.01, 1.62, -3.76); box(room, 0.03, 1.04, 0.025, MAT.oak, x - 0.01, 1.62, -2.24);
  box(room, 0.03, 0.025, 1.54, MAT.oak, x - 0.01, 2.13, -3.0); box(room, 0.03, 0.025, 1.54, MAT.oak, x - 0.01, 1.11, -3.0);
  const NOTE = ['#f6e27a', '#f7b6c2', '#a8dcf0', '#bfe3a4', '#f9c98a'];
  for (let i = 0; i < 11; i++) {
    const c = NOTE[i % NOTE.length];
    const m = new THREE.MeshStandardMaterial({roughness: 0.9, map: canvasTex(128, 128, (g, W, H) => { g.fillStyle = c; g.fillRect(0, 0, W, H); g.strokeStyle = 'rgba(40,40,60,.55)'; g.lineWidth = 3; for (let l = 0; l < 3 + (i % 3); l++) { g.beginPath(); let px = 14; g.moveTo(px, 30 + l * 22); while (px < W - 20) { px += 6 + rnd() * 8; g.lineTo(px, 30 + l * 22 + (rnd() - 0.5) * 6); } g.stroke(); } })});
    const n = mesh(room, new THREE.PlaneGeometry(0.1, 0.1), m, x - 0.012, 1.25 + (i % 3) * 0.28 + rnd() * 0.05, -3.6 + Math.floor(i / 3) * 0.36 + rnd() * 0.06, {cast: false});
    n.rotation.set(0, -Math.PI / 2, (rnd() - 0.5) * 0.15);
  }
  // the archive board: a white frame, three panels behind two sliding white doors on a top rail
  const A = ARCH, g = new THREE.Group(); g.position.set(A.x, A.y, A.z); g.rotation.y = -Math.PI / 2; room.add(g);   // local +x = world −z … local +z = world −x (into the room)
  box(g, A.w + 0.1, A.h + 0.1, 0.03, std(0xe8e6e1, 0.5), 0, 0, 0.0, {cast: false});
  box(g, A.w + 0.5, 0.04, 0.06, MAT.steelGrey, 0, A.h / 2 + 0.09, 0.05);                // the rail
  const pw = A.w / 3 - 0.03;
  for (let i = 0; i < 3; i++) {
    const m = new THREE.MeshStandardMaterial({color: 0xc9c5bd, roughness: 0.8, transparent: true, opacity: 0});
    const p = mesh(g, new THREE.PlaneGeometry(pw, A.h - 0.04), m, (i - 1) * (A.w / 3), 0, 0.02, {cast: false});
    p.renderOrder = 1; ARCHIVE.panels.push(p);
  }
  // the doors: one label across both ("الأرشيف · Archive"), each door shows its half
  const label = canvasTex(2048, 1024, (c, W, H) => {
    c.fillStyle = '#f7f6f3'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 2500; i++) { c.fillStyle = `rgba(0,0,0,${rnd() * 0.025})`; c.fillRect(rnd() * W, rnd() * H, 2, 2); }
    c.fillStyle = '#2b2d30'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '600 120px "IBM Plex Sans Arabic", "Noto Sans Arabic", sans-serif'; c.direction = 'rtl'; c.fillText('الأرشيف', W * 0.75, H * 0.47);
    c.direction = 'ltr'; c.font = '500 104px Inter, sans-serif'; c.fillText('Archive', W * 0.25, H * 0.47);
    c.fillStyle = '#9a9ea3'; c.font = '500 40px Inter, sans-serif'; c.fillText('LEGO Group · 2004–2005', W * 0.25, H * 0.62);
    c.direction = 'rtl'; c.font = '500 44px "IBM Plex Sans Arabic", sans-serif'; c.fillText('مجموعة LEGO · 2004–2005', W * 0.75, H * 0.62);
  });
  label.anisotropy = 16; ARCHIVE.label = label;
  for (let s = 0; s < 2; s++) {
    const t = label.clone(); t.repeat.set(0.5, 1); t.offset.set(s * 0.5, 0); t.needsUpdate = true;
    const dg = new THREE.Group(); dg.position.set((s - 0.5) * A.w / 2, 0, 0.055); g.add(dg);
    box(dg, A.w / 2, A.h, 0.022, std(0xf0efeb, 0.5), 0, 0, 0);
    const face = mesh(dg, new THREE.PlaneGeometry(A.w / 2 - 0.004, A.h - 0.004), new THREE.MeshStandardMaterial({map: t, color: 0xd9d7d2, roughness: 0.6}), 0, 0, 0.0115, {cast: false});
    box(dg, 0.02, 0.22, 0.025, MAT.steelGrey, (s ? -1 : 1) * (A.w / 4 - 0.06), 0, 0.022);       // a recessed pull
    box(dg, 0.08, 0.03, 0.03, MAT.steelGrey, 0, A.h / 2 + 0.055, -0.01);                      // the trolley on the rail
    ARCHIVE.doors.push({g: dg, x0: dg.position.x, dir: s ? 1 : -1});
  }
}
/** slide the archive doors open (0..1) */
export function openArchive(k = 1, instant = false) { ARCHIVE.want = k; if (instant) ARCHIVE.open = k; }
onUpdate((dt) => {
  const A = ARCHIVE; if (!A.doors.length) return;
  A.open += (A.want - A.open) * (1 - Math.exp(-2.2 * dt));
  for (const d of A.doors) d.g.position.x = d.x0 + d.dir * A.open * (ARCH.w / 2 + 0.06);
});
/** show panel i (fades in); 'texture' is a CanvasTexture drawn by the archive story module */
export function setPanel(i, texture, visible = true) {
  const p = ARCHIVE.panels[i]; if (!p) return;
  if (texture) { p.material.map = texture; p.material.needsUpdate = true; }
  p.userData.want = visible ? 1 : 0;
}
onUpdate((dt) => { for (const p of ARCHIVE.panels) { const w = p.userData.want || 0; p.material.opacity += (w - p.material.opacity) * (1 - Math.exp(-3 * dt)); p.visible = p.material.opacity > 0.01; } });
export const panelWorld = (i) => ARCHIVE.panels[i] ? ARCHIVE.panels[i].getWorldPosition(new THREE.Vector3()) : V(ARCH.x, ARCH.y, ARCH.z);

// ---------------------------------------------------------------- the clock (a weekday morning, running in real time)
const CLOCKS = [];
function restAngle(mesh) {
  const p = mesh.geometry.attributes.position; let best = 0, a = 0;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), d = x * x + y * y; if (d > best) { best = d; a = Math.atan2(x, y); } }
  return a;
}
const T0 = performance.now();
export const clockMinutes = () => 10 * 60 + 4 + (performance.now() - T0) / 60000;
onUpdate(() => {
  for (const C of CLOCKS) {
    const tot = clockMinutes() * 60, s = Math.floor(tot % 60), m = (tot / 60) % 60, h = (tot / 3600) % 12;
    for (const [hand, ang] of [[C.sec, s / 60], [C.min, m / 60], [C.hour, h / 12]]) if (hand) hand.mesh.rotation.z = -(ang * Math.PI * 2 - hand.rest);
  }
});
async function wallClock(x, y, z, ry, diameter = 0.42) {
  try {
    const ck = (await model('wall_clock')).clone(true);
    const b = new THREE.Box3().setFromObject(ck), s = b.getSize(new THREE.Vector3());
    ck.scale.multiplyScalar(diameter / Math.max(s.x, s.y)); ck.position.set(x, y, z); ck.rotation.y = ry; room.add(ck);
    const hand = (n) => { const m = ck.getObjectByName(n); return m && m.isMesh ? {mesh: m, rest: restAngle(m)} : null; };
    CLOCKS.push({sec: hand('wall_clock_second_hand'), min: hand('wall_clock_minute_hand'), hour: hand('wall_clock_hours_hand')});
  } catch (e) { console.warn('clock', e); }
}

// ---------------------------------------------------------------- the two tables and the chairs
function worktable() {
  const {x, y, z, w, d} = WT, t = 0.04;
  box(venue, w, t, d, MAT.ply, x, y - t / 2, z);
  // plywood laminations on the edge
  box(venue, w + 0.002, 0.012, d + 0.002, MAT.plyEdge, x, y - t + 0.006, z, {cast: false});
  // black steel frame: four legs, aprons, a lower shelf with a few boxes
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(venue, 0.05, y - t, 0.05, MAT.steel, x + sx * (w / 2 - 0.08), (y - t) / 2, z + sz * (d / 2 - 0.08));
  for (const sz of [-1, 1]) box(venue, w - 0.16, 0.06, 0.03, MAT.steel, x, y - t - 0.03, z + sz * (d / 2 - 0.08));
  for (const sx of [-1, 1]) box(venue, 0.03, 0.06, d - 0.16, MAT.steel, x + sx * (w / 2 - 0.08), y - t - 0.03, z);
  box(venue, w - 0.2, 0.02, d - 0.2, MAT.ply, x, 0.2, z);
}
function reviewTable() {
  const {x, y, z, w, d} = RT, t = 0.035;
  box(venue, w, t, d, std(0xf4f3f0, 0.35), x, y - t / 2, z);
  box(venue, w + 0.004, t * 0.55, d + 0.004, MAT.oak, x, y - t * 0.75, z, {cast: false});
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(venue, 0.045, y - t, 0.045, MAT.steel, x + sx * (w / 2 - 0.12), (y - t) / 2, z + sz * (d / 2 - 0.1));
  for (const sz of [-1, 1]) box(venue, w - 0.24, 0.05, 0.025, MAT.steel, x, y - t - 0.025, z + sz * (d / 2 - 0.1));
}
async function chairs() {
  try {
    const chair = await model('dining_chair_02');
    for (const [k, s] of Object.entries(SEATS)) {
      const c = chair.clone(true);
      // the chair's back is towards −z in the file: turn it so a sitter faces s.ry, pulled a little out from the table
      c.position.set(s.x - Math.sin(s.ry) * 0.06, 0, s.z - Math.cos(s.ry) * 0.06); c.rotation.y = s.ry; c.name = 'chair_' + k; venue.add(c);
    }
    // two metal stools by the worktable's far corners
    const stool = await model('metal_stool_02');
    for (const [dx, dz] of [[-1.25, -0.95], [1.3, -0.9]]) { const c = stool.clone(true); c.position.set(WT.x + dx, 0, WT.z + dz); c.rotation.y = dx; venue.add(c); }
  } catch (e) { console.warn('chairs', e); }
}

export async function buildWorkshop(scene) {
  materials();
  shell(); southWall(); eastWall(); worktable(); reviewTable();
  linearLight(WT.x, 2.35, WT.z, 2.2); linearLight(RT.x, 2.25, RT.z, 2.0);
  await Promise.all([
    chairs(),
    wallClock(ROOM.x1 - 0.03, 2.4, 2.4, -Math.PI / 2),
    buildDressing().catch(e => console.error('dressing', e)),
  ]);
  scene.add(room); scene.add(venue);
  const keep = [...ARCHIVE.doors.map(d => d.g), ...ARCHIVE.panels];
  mergeStatic(room, {cell: 4, exclude: keep});
  return {room, venue};
}
