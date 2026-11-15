// Regional HQ — ground floor interior + exterior shell.  +x = east, +z = south (front/entrance), y up.
import * as THREE from 'three';
import {scene} from '../core/engine.js';
import {model} from '../core/assets.js';
import {M, canvasTex, addWind, pbr} from './materials.js';
import * as P from './props.js';

export const B = {x0: -18, x1: 18, z0: -14, z1: 10, H: 3.2, floorH: 4.0, floors: 4};
export const ROOMS = [
  {id: 'open', name: 'المكتب المفتوح', x0: -18, x1: -5, z0: -14, z1: 10},
  {id: 'meeting', name: 'قاعة الاجتماعات', x0: -5, x1: 5, z0: -14, z1: -5},
  {id: 'break', name: 'ركن القهوة', x0: 5, x1: 18, z0: -14, z1: -5},
  {id: 'corridor', name: 'الممر', x0: -5, x1: 18, z0: -5, z1: -1},
  {id: 'lobby', name: 'الاستقبال', x0: -5, x1: 5, z0: -1, z1: 10},
  {id: 'secretary', name: 'السكرتارية', x0: 5, x1: 11, z0: -1, z1: 10},
  {id: 'office', name: 'مكتبك', x0: 11, x1: 18, z0: -1, z1: 10},
];
export function roomAt(x, z) { for (const r of ROOMS) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return r; return null; }

export const colliders = [];   // {x0,x1,z0,z1}
export const col = (x0, x1, z0, z1) => colliders.push({x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1)});
export const occluders = [];   // meshes that block hotspot line-of-sight
export const anchors = {};     // named positions used by the story
export const screens = {};

const root = new THREE.Group(); root.name = 'building';
export const roofGroup = new THREE.Group(); roofGroup.name = 'roof'; root.add(roofGroup);

/** solid wall from (x1,z1) to (x2,z2) (axis aligned), with door openings [from,to] along its length */
function wall(x1, z1, x2, z2, openings = [], mat = M.plaster, {t = 0.16, h = B.H, doorH = 2.35} = {}) {
  const horiz = z1 === z2; const a0 = horiz ? Math.min(x1, x2) : Math.min(z1, z2), a1 = horiz ? Math.max(x1, x2) : Math.max(z1, z2);
  const c = horiz ? z1 : x1;
  const seg = (s0, s1, y0, y1) => {
    if (s1 - s0 < 0.01) return;
    const len = s1 - s0, mid = (s0 + s1) / 2;
    const m = horiz ? P.box(root, len, y1 - y0, t, mat, mid, y0, c) : P.box(root, t, y1 - y0, len, mat, c, y0, mid);
    occluders.push(m);
    if (y0 < 0.5) horiz ? col(s0, s1, c - t / 2, c + t / 2) : col(c - t / 2, c + t / 2, s0, s1);
    // skirting
    if (y0 < 0.01) horiz ? P.box(root, len, 0.08, t + 0.02, M.trim, mid, 0, c, 0, {cast: false}) : P.box(root, t + 0.02, 0.08, len, M.trim, c, 0, mid, 0, {cast: false});
  };
  let s = a0; const ops = [...openings].sort((p, q) => p[0] - q[0]);
  for (const [o0, o1] of ops) { seg(s, o0, 0, h); seg(o0, o1, doorH, h); s = o1; }
  seg(s, a1, 0, h);
}
/** glass partition with aluminium mullions; openings as for wall() */
function glassWall(x1, z1, x2, z2, openings = [], {h = B.H, step = 1.2, frosted = true} = {}) {
  const horiz = z1 === z2; const a0 = horiz ? Math.min(x1, x2) : Math.min(z1, z2), a1 = horiz ? Math.max(x1, x2) : Math.max(z1, z2);
  const c = horiz ? z1 : x1;
  const put = (w, hh, d, mat, a, y, o) => horiz ? P.box(root, w, hh, d, mat, a, y, c, 0, o) : P.box(root, d, hh, w, mat, c, y, a, 0, o);
  let s = a0; const ops = [...openings].sort((p, q) => p[0] - q[0]);
  const run = (s0, s1, y0, y1) => {
    if (s1 - s0 < 0.01) return;
    const len = s1 - s0, mid = (s0 + s1) / 2;
    const g = put(len, y1 - y0, 0.02, M.glassInt, mid, y0, {cast: false}); g.renderOrder = 2;
    if (frosted && y0 < 1) { const f = put(len, 0.45, 0.022, M.frosted, mid, 0.95, {cast: false}); f.renderOrder = 3; }
    put(len, 0.05, 0.07, M.darkAlu, mid, y0, {cast: false}); put(len, 0.05, 0.07, M.darkAlu, mid, y1 - 0.05);
    for (let a = s0; a <= s1 + 1e-3; a += Math.min(step, Math.max(0.2, len))) put(0.05, y1 - y0, 0.07, M.darkAlu, Math.min(a, s1 - 0.025) + (a === s0 ? 0.025 : 0), y0);
    if (y0 < 0.5) horiz ? col(s0, s1, c - 0.06, c + 0.06) : col(c - 0.06, c + 0.06, s0, s1);
  };
  for (const [o0, o1] of ops) { run(s, o0, 0, h); run(o0, o1, 2.35, h); s = o1; }
  run(s, a1, 0, h);
}
/** exterior curtain wall (ground floor visible from inside; transparent) */
function curtain(x1, z1, x2, z2, openings = []) {
  const horiz = z1 === z2; const a0 = horiz ? Math.min(x1, x2) : Math.min(z1, z2), a1 = horiz ? Math.max(x1, x2) : Math.max(z1, z2);
  const c = horiz ? z1 : x1;
  const put = (w, hh, d, mat, a, y, o) => horiz ? P.box(root, w, hh, d, mat, a, y, c, 0, o) : P.box(root, d, hh, w, mat, c, y, a, 0, o);
  const len = a1 - a0;
  { let g0 = a0; for (const [o0, o1] of [...openings, [a1, a1]]) { if (o0 - g0 > 0.01) { const gl = put(o0 - g0, B.H, 0.03, M.glass, (g0 + o0) / 2, 0, {cast: false, recv: false}); gl.renderOrder = 2; } if (o1 > o0) put(o1 - o0, B.H - 2.6, 0.03, M.glass, (o0 + o1) / 2, 2.6, {cast: false, recv: false}).renderOrder = 2; g0 = o1; } }
  for (let a = a0; a <= a1 + 1e-3; a += 1.5) put(0.07, B.floorH, 0.16, M.darkAlu, Math.min(Math.max(a, a0 + 0.035), a1 - 0.035), 0);
  put(len, 0.08, 0.18, M.darkAlu, (a0 + a1) / 2, 0); put(len, 0.1, 0.18, M.darkAlu, (a0 + a1) / 2, B.H - 0.05);
  // spandrel between ground and first floor
  put(len, B.floorH - B.H, 0.2, M.darkAlu, (a0 + a1) / 2, B.H);
  let s = a0; for (const [o0, o1] of openings) { horiz ? col(s, o0, c - 0.1, c + 0.1) : col(c - 0.1, c + 0.1, s, o0); s = o1; }
  horiz ? col(s, a1, c - 0.1, c + 0.1) : col(c - 0.1, c + 0.1, s, a1);
}

function upperFloors() {
  // opaque reflective curtain wall above ground floor, lit-window texture for life
  const w = B.x1 - B.x0, d = B.z1 - B.z0, y0 = B.floorH, h = B.floorH * (B.floors - 1);
  const winTex = canvasTex(512, 256, (g, W, H) => {
    g.fillStyle = '#1b2329'; g.fillRect(0, 0, W, H);
    for (let fy = 0; fy < 3; fy++) for (let i = 0; i < 24; i++) {
      const lit = Math.random() < 0.35; g.fillStyle = lit ? `rgba(255,${230 + Math.random() * 20 | 0},${190 + Math.random() * 40 | 0},${0.35 + Math.random() * 0.3})` : `rgba(60,75,85,${0.3 + Math.random() * 0.3})`;
      g.fillRect(i * W / 24 + 2, fy * H / 3 + 6, W / 24 - 4, H / 3 - 22);
      g.fillStyle = '#0d1216'; g.fillRect(i * W / 24 - 1, fy * H / 3, 3, H / 3);
    }
    g.fillStyle = '#2a3238'; for (let fy = 0; fy < 3; fy++) g.fillRect(0, fy * H / 3 + H / 3 - 16, W, 16);
  });
  const facadeMat = (rep) => { const t = winTex.clone(); t.needsUpdate = true; t.wrapS = THREE.RepeatWrapping; t.repeat.set(rep, 1);
    return new THREE.MeshStandardMaterial({color: 0x9fb2bd, map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.12, metalness: 0.65, roughness: 0.08, envMapIntensity: 1.4}); };
  const sides = [[w, 0.3, 0, B.z1, 0], [w, 0.3, 0, B.z0, Math.PI], [d, 0.3, B.x1, (B.z0 + B.z1) / 2, Math.PI / 2], [d, 0.3, B.x0, (B.z0 + B.z1) / 2, -Math.PI / 2]];
  for (const [len, , x, z, ry] of sides) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, h), facadeMat(len / 18));
    m.position.set(x === 0 ? 0 : x, y0 + h / 2, z); m.rotation.y = ry; m.receiveShadow = true; roofGroup.add(m);
    // floor slab edges / fins
    for (let f = 0; f < B.floors; f++) { const yy = B.floorH * (f + 1) - 0.25; const s = new THREE.Mesh(new THREE.BoxGeometry(len + 0.4, 0.35, 0.5), M.concrete); s.position.copy(m.position); s.position.y = yy; s.rotation.y = ry; s.castShadow = true; roofGroup.add(s); }
    for (let a = -len / 2; a <= len / 2; a += 3) { const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, h, 0.35), M.darkAlu); fin.position.set(x === 0 ? a : x, y0 + h / 2, x === 0 ? z : z + a); if (x !== 0) fin.position.set(x, y0 + h / 2, z + a); fin.rotation.y = ry; fin.castShadow = true; roofGroup.add(fin); }
  }
  // solid core (blocks sun from above / casts building shadow)
  const core = new THREE.Mesh(new THREE.BoxGeometry(w - 0.6, h + 0.6, d - 0.6), new THREE.MeshStandardMaterial({color: 0x222629}));
  core.position.set(0, y0 + h / 2 - 0.3, (B.z0 + B.z1) / 2); core.castShadow = true; roofGroup.add(core);
  // roof parapet + plant
  P.box(roofGroup, w + 0.4, 1.1, d + 0.4, M.roof, 0, B.floorH * B.floors, (B.z0 + B.z1) / 2);
  P.box(roofGroup, 6, 2.2, 4, M.darkAlu, 8, B.floorH * B.floors + 1.1, -6);
  // building name band (fictional brand — neutral coffee cup mark)
  const sign = canvasTex(1024, 160, (g, W, H) => {
    g.clearRect(0, 0, W, H); g.fillStyle = '#f4efe6'; g.font = '700 74px "IBM Plex Sans Arabic"'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('المكتب الإقليمي', W / 2 + 60, H / 2 + 4);
    g.strokeStyle = '#f4efe6'; g.lineWidth = 7; g.beginPath(); g.moveTo(170, 50); g.lineTo(230, 50); g.lineTo(222, 120); g.lineTo(178, 120); g.closePath(); g.stroke();
    g.beginPath(); g.arc(234, 80, 16, -1.3, 1.3); g.stroke();
  });
  const sm = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.4), new THREE.MeshStandardMaterial({map: sign, transparent: true, emissive: 0xffffff, emissiveMap: sign, emissiveIntensity: 0.3, roughness: 0.4}));
  sm.position.set(0, B.floorH + 0.2, B.z1 + 0.3); roofGroup.add(sm);
  // entrance canopy
  P.box(roofGroup, 7, 0.22, 3.2, M.darkAlu, 0, 3.4, B.z1 + 1.6);
  for (const sx of [-3.2, 3.2]) P.cyl(roofGroup, 0.08, 0.08, 3.4, M.steel, sx, 0, B.z1 + 2.9);
}

function shell() {
  // floor
  const floor = (x0, x1, z0, z1, mat) => P.floorPlane(root, x1 - x0, z1 - z0, mat, (x0 + x1) / 2, (z0 + z1) / 2, 0.005);
  floor(-5, 5, -1, 10, M.floorWood);
  floor(-18, -5, -14, 10, M.floorWood);
  floor(-5, 18, -14, -1, M.floorWood);
  floor(5, 18, -1, 10, M.floorWood);
  // ceiling (+ slab that blocks the sun)
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(B.x1 - B.x0, B.z1 - B.z0), M.ceiling);
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, B.H, (B.z0 + B.z1) / 2); ceil.receiveShadow = true; roofGroup.add(ceil);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(B.x1 - B.x0, B.floorH - B.H - 0.05, B.z1 - B.z0), M.concrete);
  slab.position.set(0, (B.H + B.floorH) / 2 + 0.02, (B.z0 + B.z1) / 2); slab.castShadow = true; roofGroup.add(slab);
  // dark timber ceiling beams (loft style, like the cafe demo)
  for (let z = -12.5; z < 10; z += 3.5) P.box(roofGroup, B.x1 - B.x0 - 0.4, 0.24, 0.22, M.beam, 0, B.H - 0.24, z, 0, {cast: false});
  for (const x of [-11.5, 0, 11.5]) P.box(roofGroup, 0.2, 0.14, B.z1 - B.z0 - 0.4, M.beam, x, B.H - 0.38, (B.z0 + B.z1) / 2, 0, {cast: false});
  // exterior curtain walls
  curtain(B.x0, B.z1, B.x1, B.z1, [[-1.6, 1.6]]);  // south, entrance
  curtain(B.x1, B.z0, B.x1, B.z1);                 // east
  curtain(B.x0, B.z0, B.x0, B.z1);                 // west
  wall(B.x0, B.z0, B.x1, B.z0, [], M.brick, {t: 0.3, h: B.floorH});   // north: exposed brick (loft style)
  // entrance sliding doors (open) + mat
  for (const sx of [-1, 1]) P.box(root, 1.5, 2.6, 0.04, M.glass, sx * 2.35, 0, B.z1 - 0.1, 0, {cast: false}).renderOrder = 2;
  P.box(root, 3.0, 0.01, 1.6, M.carpet, 0, 0, B.z1 - 1.0, 0, {cast: false});
}

function interior() {
  // --- open office / east zones boundary x = -5 ---
  glassWall(-5, -14, -5, -5);                       // meeting room west (glass, view of open office)
  wall(-5, -1, -5, 10, [[3, 5.4]], M.plaster);      // lobby west wall, door to open office
  // --- corridor north side z = -5 ---
  glassWall(-5, -5, 5, -5, [[1.0, 2.6]]);           // meeting room south (glass + door)
  wall(5, -5, 18, -5, [[9, 14]], M.plaster);         // break room opening
  wall(5, -14, 5, -5, [], M.plaster);               // meeting | break
  // --- corridor south side z = -1 ---
  wall(-5, -1, 5, -1, [[-2.2, 2.2]], M.brick);      // lobby north (lift wall, brick)
  wall(5, -1, 11, -1, [[7, 8.6]], M.plaster);       // secretary door
  wall(11, -1, 18, -1, [], M.brick);
  wall(5, -1, 5, 10, [], M.accentWall);             // lobby | secretary
  wall(11, -1, 11, 10, [[1.0, 2.6]], M.plaster);    // secretary | your office
  // door frames
  const frame = (x, z, w, vertical) => { for (const s of [-1, 1]) vertical ? P.box(root, 0.2, 2.35, 0.06, M.trim, x, 0, z + s * w / 2) : P.box(root, 0.06, 2.35, 0.2, M.trim, x + s * w / 2, 0, z); vertical ? P.box(root, 0.2, 0.06, w + 0.06, M.trim, x, 2.32, z) : P.box(root, w + 0.06, 0.06, 0.2, M.trim, x, 2.32, z); };
  frame(7.8, -1, 1.6, false); frame(11, 1.8, 1.6, true); frame(-5, 4.2, 2.4, true);
  // name plates
  const plate = (txt, x, y, z, ry) => { const t = canvasTex(256, 64, (g, W, H) => { g.fillStyle = '#2b2d2f'; g.fillRect(0, 0, W, H); g.fillStyle = '#e8e2d6'; g.font = '600 26px "IBM Plex Sans Arabic"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, W / 2, H / 2 + 2); }); const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.105), new THREE.MeshStandardMaterial({map: t, roughness: 0.4})); m.position.set(x, y, z); m.rotation.y = ry; root.add(m); };
  plate('السكرتارية', 9.1, 1.6, -0.91, 0);
  plate('مسؤول التسويق', 10.9, 1.6, 0.6, -Math.PI / 2);
  plate('قاعة الاجتماعات', 3.0, 1.6, -4.97, 0);
}

async function lobby() {
  // reception desk (curved front in walnut + white top)
  const g = P.group(root, 0, 0, 5.0);
  const front = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 1.05, 48, 1, true, -0.62, 1.24), M.walnut);
  front.position.set(0, 0.525, -2.0); front.castShadow = front.receiveShadow = true; front.material.side = THREE.DoubleSide; g.add(front);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(2.72, 2.72, 0.04, 48, 1, false, -0.64, 1.28), M.whiteTop); top.position.set(0, 1.07, -2.0); top.castShadow = true; g.add(top);
  P.box(g, 2.8, 0.75, 0.6, M.whiteTop, 0, 0, -0.45);
  P.monitor(g, 0.5, 0.75, -0.5, Math.PI, P.spreadsheetTex(3));
  col(-1.6, 1.6, 4.2, 5.7);
  anchors.reception = {x: 0, z: 4.05, ry: 0};
  // brand wall (wood slats) on west wall of lobby
  for (let i = 0; i < 22; i++) P.box(root, 0.05, 2.9, 0.12, M.walnut, -4.88, 0.15, 5.9 + i * 0.17);
  const mark = canvasTex(512, 512, (c, W, H) => { c.clearRect(0, 0, W, H); c.strokeStyle = '#efe7d8'; c.lineWidth = 16; c.beginPath(); c.moveTo(150, 170); c.lineTo(330, 170); c.lineTo(310, 380); c.lineTo(170, 380); c.closePath(); c.stroke(); c.beginPath(); c.arc(340, 260, 46, -1.3, 1.3); c.stroke(); for (const x of [200, 240, 280]) { c.beginPath(); c.moveTo(x, 140); c.bezierCurveTo(x - 18, 110, x + 18, 90, x, 60); c.stroke(); } });
  const mm = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshStandardMaterial({map: mark, transparent: true, roughness: 0.5, emissive: 0xffffff, emissiveMap: mark, emissiveIntensity: 0.15}));
  mm.position.set(-4.7, 1.75, 7.7); mm.rotation.y = Math.PI / 2; root.add(mm);
  // elevators on lobby north wall
  for (const ex of [-3.7, 3.7]) {
    P.box(root, 1.5, 2.4, 0.05, M.steel, ex, 0, -0.9);
    P.box(root, 0.02, 2.4, 0.06, M.trim, ex, 0, -0.88);
    P.box(root, 1.7, 0.12, 0.08, M.trim, ex, 2.4, -0.88);
    const ind = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.08), new THREE.MeshStandardMaterial({color: 0x000000, emissive: 0xffa040, emissiveIntensity: 1.4})); ind.position.set(ex, 2.62, -0.86); root.add(ind);
  }
  // seating
  const chairs = [[3.2, 7.4, -Math.PI / 2], [3.2, 8.8, -Math.PI / 2], [1.6, 8.1, Math.PI / 2]];
  for (const [x, z, r] of chairs) { const c = await model('modern_arm_chair_01'); c.position.set(x, 0, z); c.rotation.y = r; root.add(c); }
  col(1.2, 3.8, 7.0, 9.4);
  for (const [x, z] of [[4.4, 0.0], [-4.4, 0.0]]) { P.planter(root, x, z, 0.55, 0.3); const p = await model('calathea_orbifolia_01'); p.position.set(x, 0.53, z); p.scale.setScalar(2.4); root.add(p); col(x - 0.3, x + 0.3, z - 0.3, z + 0.3); }
  anchors.lobbyOmar = {x: -3.0, z: 6.6};
  anchors.lobbyEnter = {x: 0, z: 9.0};
}

async function openOffice() {
  const shot = [];
  const clusters = [[-14, -9.5], [-9.5, -9.5], [-14, -2], [-9.5, -2], [-14, 5.5], [-9.5, 5.5]];
  let seed = 1;
  anchors.workSeats = [];
  for (const [cx, cz] of clusters) {
    for (const [dx, dz, ry] of [[-0.78, -0.42, 0], [0.78, -0.42, 0], [-0.78, 0.42, Math.PI], [0.78, 0.42, Math.PI]]) {
      const x = cx + dx, z = cz + dz;
      P.desk(root, x, z, ry);
      const fz = ry === 0 ? 1 : -1;   // desk "front" (where the person sits) is +z for ry=0
      P.monitor(root, x, 0.75, z - fz * 0.2, ry, P.spreadsheetTex(seed++, ['#1f6f54', '#2d5d8a', '#7a4b2a'][seed % 3]));
      P.keyboard(root, x, 0.75, z + fz * 0.08, ry);
      if (seed % 3 === 0) P.mug(root, x + 0.45, 0.75, z, [0xf2efe8, 0x2d5d8a, 0xb3171d][seed % 3]);
      if (seed % 2) P.papers(root, x - 0.5, 0.75, z + fz * 0.05, ry + 0.2, 2);
      P.taskChair(root, x, z + fz * 0.62, ry + Math.PI);
      anchors.workSeats.push({x, z: z + fz * 0.58, ry: ry + Math.PI});
    }
    // low partition between facing desks
    P.box(root, 3.1, 0.38, 0.04, M.fabricGreen, cx, 0.74, cz);
    col(cx - 1.6, cx + 1.6, cz - 1.35, cz + 1.35);   // desks + the chairs in front of them
  }
  // Mei's spot: two monitors + photo wall pin board
  anchors.meiSeat = anchors.workSeats[17];   // cluster 5 (-9.5,-2) seat
  const pb = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshStandardMaterial({map: P.photoWallTex(), roughness: 0.8}));
  pb.position.set(-17.82 + 0.0, 1.55, -2.6); pb.rotation.y = Math.PI / 2; root.add(pb);
  P.box(root, 0.04, 1.3, 2.5, M.oak, -17.86, 0.9, -2.6);
  // storage + plants along north wall
  for (let x = -17; x < -6; x += 2.2) { P.box(root, 2.0, 1.1, 0.45, M.whiteTop, x + 1.0, 0, -13.6); col(x, x + 2, -13.9, -13.3); }
  for (const [x, z] of [[-17.3, 9.2], [-6, 9.3], [-17.3, -13.2], [-6.1, -13.4]]) { P.planter(root, x, z, 0.5, 0.28); const p = await model('calathea_orbifolia_01'); p.position.set(x, 0.48, z); p.scale.setScalar(2.2); root.add(p); col(x - 0.3, x + 0.3, z - 0.3, z + 0.3); }
  anchors.ryanPhone = {x: -16.9, z: 1.2, ry: -Math.PI / 2};
  anchors.graceStand = {x: -7.2, z: 3.6, ry: -Math.PI / 2};
  // values card copy (as in many offices) on open office west wall? keep the real one in meeting room
  return shot;
}

function pbrTop() {   // one solid walnut slab with a soft lacquer, not planks
  const m = pbr('walnut_veneer', [0.35, 0.35], {color: 0x7a5038, roughness: 0.55});
  const ph = new THREE.MeshPhysicalMaterial({map: m.map, normalMap: m.normalMap, roughnessMap: m.roughnessMap, color: 0x7a5038, roughness: 0.55, clearcoat: 0.6, clearcoatRoughness: 0.25, envMapIntensity: 0.6});
  return ph;
}
async function meetingRoom() {
  const tz = -9.5;
  // long walnut table
  const tableWood = P.pbrWood ? P.pbrWood : M.walnut;
  const top = pbrTop();
  P.rbox(root, 5.2, 0.07, 1.6, 0.02, top, 0, 0.675, tz);
  P.box(root, 4.6, 0.06, 1.2, new THREE.MeshStandardMaterial({color: 0x161718, roughness: 0.4, metalness: 0.75}), 0, 0.615, tz);   // steel apron
  const steel = new THREE.MeshStandardMaterial({color: 0x1c1d1f, roughness: 0.45, metalness: 0.7});
  for (const sx of [-2.05, 2.05]) {                       // black steel trestle frames
    for (const sz of [-0.66, 0.66]) P.box(root, 0.07, 0.655, 0.07, steel, sx, 0, tz + sz);
    P.box(root, 0.07, 0.06, 1.42, steel, sx, 0.6, tz); P.box(root, 0.1, 0.04, 1.55, steel, sx, 0, tz);
  }
  P.box(root, 4.1, 0.05, 0.06, steel, 0, 0.2, tz);       // stretcher
  const rug = canvasTex(512, 256, (g, W, H) => { g.fillStyle = '#3a2a22'; g.fillRect(0, 0, W, H); g.strokeStyle = '#6b4a35'; g.lineWidth = 10; g.strokeRect(14, 14, W - 28, H - 28); g.strokeStyle = 'rgba(160,120,80,.35)'; g.lineWidth = 3; for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(40 + i * 37, 40); g.lineTo(40 + i * 37, H - 40); g.stroke(); } for (let i = 0; i < 8000; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`; g.fillRect(Math.random() * W, Math.random() * H, 2, 2); } });
  const rugM = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 3.9), new THREE.MeshStandardMaterial({map: rug, roughness: 1}));
  rugM.rotation.x = -Math.PI / 2; rugM.position.set(0, 0.012, tz); rugM.receiveShadow = true; root.add(rugM);
  col(-2.6, 2.6, tz - 0.85, tz + 0.85);
  anchors.meetSeats = [];
  const seatX = [-1.6, 0, 1.6];
  for (const side of [-1, 1]) for (const x of seatX) {
    const z = tz + side * 1.12, ry = side < 0 ? 0 : Math.PI;   // face the table
    P.confChair(root, x, z, ry); col(x - 0.3, x + 0.3, z - 0.3, z + 0.3);
    anchors.meetSeats.push({x, z: z + (side < 0 ? 0.08 : -0.08), ry});
  }
  // screen on east wall
  screens.meeting = P.wallScreen(root, 4.9, 1.05, tz, -Math.PI / 2, 2.6, 1.46);
  anchors.meetScreen = {x: 4.85, z: tz};
  anchors.nadiaMeet = {x: 3.55, z: tz - 1.15, ry: -Math.PI / 2 - 0.5};
  // values card (framed) + brand poster on north wall
  const vt = canvasTex(600, 800, (g, W, H) => {
    g.fillStyle = '#f6f2ea'; g.fillRect(0, 0, W, H); g.fillStyle = '#1f5e47'; g.fillRect(0, 0, W, 120);
    g.fillStyle = '#fff'; g.font = '700 48px "IBM Plex Sans Arabic"'; g.textAlign = 'center'; g.fillText('قيمنا', W / 2, 80);
    g.fillStyle = '#26332d'; g.font = '600 46px "IBM Plex Sans Arabic"';
    ['الإتقان', 'النتائج', 'الشجاعة', 'الانتماء', 'البهجة'].forEach((v, i) => g.fillText(v, W / 2, 230 + i * 118));
  });
  const fr = P.group(root, -2.4, 1.15, -13.82);
  P.box(fr, 0.66, 0.86, 0.04, M.walnut, 0, 0, 0);
  const vm = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.77), new THREE.MeshStandardMaterial({map: vt, roughness: 0.6})); vm.position.set(0, 0.43, 0.025); fr.add(vm);
  anchors.valuesCard = {x: -2.4, y: 1.58, z: -13.7};
  const poster = canvasTex(800, 800, (g, W, H) => { g.fillStyle = '#1f5e47'; g.fillRect(0, 0, W, H); g.strokeStyle = '#f2ece0'; g.lineWidth = 20; g.beginPath(); g.moveTo(260, 270); g.lineTo(540, 270); g.lineTo(505, 600); g.lineTo(295, 600); g.closePath(); g.stroke(); g.beginPath(); g.arc(555, 410, 70, -1.3, 1.3); g.stroke(); });
  const pm = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshStandardMaterial({map: poster, roughness: 0.7})); pm.position.set(1.4, 1.75, -13.83); root.add(pm);
  // sticky-note ideas board (standing whiteboard)
  const sb = canvasTex(1000, 600, (g, W, H) => {
    g.fillStyle = '#f7f7f4'; g.fillRect(0, 0, W, H);
    const notes = [['#ffe27a', 'خصم'], ['#ff9fb3', 'مسابقة صور'], ['#9fe0c8', 'فيلم مجتمعي'], ['#a9cbff', 'شراكة مكتبات']];
    notes.forEach(([c, t], i) => { const x = 60 + i * 230, y = 150 + (i % 2) * 40; g.save(); g.translate(x + 90, y + 90); g.rotate((i % 2 ? 1 : -1) * 0.05); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(-86, -82, 180, 180); g.fillStyle = c; g.fillRect(-90, -90, 180, 180); g.fillStyle = '#2b2618'; g.font = '600 30px "IBM Plex Sans Arabic"'; g.textAlign = 'center'; g.fillText(t, 0, 10); g.restore(); });
    g.fillStyle = '#3a3a3a'; g.font = '600 34px "IBM Plex Sans Arabic"'; g.textAlign = 'center'; g.fillText('حملة الأعياد — الأفكار', W / 2, 70);
  });
  const wb = P.group(root, -3.9, 0, -12.4, Math.PI / 4);
  P.box(wb, 1.7, 1.05, 0.03, new THREE.MeshStandardMaterial({map: sb, roughness: 0.5}), 0, 0.85, 0);
  for (const sx of [-0.8, 0.8]) { P.box(wb, 0.04, 1.9, 0.04, M.alu, sx, 0, 0); P.box(wb, 0.05, 0.03, 0.6, M.alu, sx, 0, 0); }
  col(-4.8, -3.0, -13.2, -11.6);
  anchors.ideasBoard = {x: -3.9, y: 1.4, z: -12.3};
  // items on the table (doc: blue folder, laptop dashboard, booklet, tray of red cups, grey envelope)
  P.folder(root, -1.2, 0.745, tz + 0.15, 0.2);
  P.booklet(root, -0.4, 0.745, tz - 0.2, -0.15, P.coverTex('دليل العلامة'));
  const tray = P.group(root, 0.6, 0.745, tz);
  P.rbox(tray, 0.5, 0.02, 0.32, 0.01, M.walnut, 0, 0, 0);
  for (let i = 0; i < 6; i++) P.redCup(tray, -0.16 + (i % 3) * 0.16, 0.02, -0.07 + Math.floor(i / 3) * 0.14);
  P.envelope(root, 1.55, 0.745, tz + 0.25, 0.4);
  anchors.redCups = {x: 0.6, y: 0.95, z: tz};
  // plants
  for (const [x, z] of [[4.4, -13.4], [-4.4, -5.7]]) { const p = await model('calathea_orbifolia_01'); p.position.set(x, 0, z); p.scale.setScalar(2.2); root.add(p); }
}

async function breakRoom() {
  // kitchen counter along north wall
  P.box(root, 5.5, 0.9, 0.62, M.whiteTop, 11.5, 0, -13.6); P.box(root, 5.6, 0.04, 0.66, M.concrete, 11.5, 0.9, -13.6);
  P.box(root, 5.5, 0.8, 0.36, M.whiteTop, 11.5, 1.55, -13.75);
  col(8.7, 14.3, -14, -13.2);
  // espresso machine
  const em = P.group(root, 10.2, 0.94, -13.55);
  P.rbox(em, 0.62, 0.42, 0.45, 0.03, M.steel, 0, 0, 0); P.box(em, 0.55, 0.05, 0.4, M.blackPlastic, 0, 0.42, 0);
  for (const dx of [-0.15, 0.15]) P.cyl(em, 0.03, 0.03, 0.08, M.blackPlastic, dx, 0.12, 0.25);
  P.mug(root, 10.9, 0.94, -13.5, 0xffffff); P.mug(root, 11.1, 0.94, -13.45, 0x2d5d8a);
  // fridge
  P.rbox(root, 0.75, 1.9, 0.7, 0.02, M.steel, 15.0, 0, -13.5); col(14.6, 15.4, -13.9, -13.1);
  // tables
  for (const [x, z] of [[9, -9], [13, -9.5]]) {
    P.cyl(root, 0.55, 0.55, 0.03, M.oak, x, 0.73, z, 40); P.cyl(root, 0.05, 0.05, 0.73, M.darkAlu, x, 0, z); P.cyl(root, 0.3, 0.3, 0.02, M.darkAlu, x, 0, z);
    for (let i = 0; i < 3; i++) { const a = i * 2.1; P.taskChair(root, x + Math.sin(a) * 0.85, z + Math.cos(a) * 0.85, a + Math.PI, M.fabricSand); }
    col(x - 1.15, x + 1.15, z - 1.15, z + 1.15);    // table + chairs around it
  }
  P.planter(root, 17.2, -5.8, 0.5, 0.28); const sofaPl = await model('calathea_orbifolia_01'); sofaPl.position.set(17.2, 0.48, -5.8); sofaPl.scale.setScalar(2.2); root.add(sofaPl);
  anchors.breakNpc = {x: 11.5, z: -12.6, ry: Math.PI};
}

async function secretary() {
  P.desk(root, 8, 1.6, Math.PI, {w: 1.8, d: 0.8, top: M.walnut});
  P.monitor(root, 8.2, 0.75, 1.85, Math.PI, P.spreadsheetTex(11, '#2d5d8a'));
  P.keyboard(root, 8.2, 0.75, 1.5, Math.PI);
  P.papers(root, 7.5, 0.75, 1.55, 0.3, 4);
  P.taskChair(root, 8.2, 2.25, 0);
  col(7.0, 9.0, 1.15, 2.6);
  anchors.secretarySeat = {x: 8.2, z: 2.2, ry: Math.PI};
  for (const z of [6.5, 7.6, 8.7]) { const c = await model('modern_arm_chair_01'); c.position.set(10.3, 0, z); c.rotation.y = -Math.PI / 2; root.add(c); col(9.8, 10.8, z - 0.45, z + 0.45); }
  P.planter(root, 5.6, 9.3, 0.5, 0.28); const pl = await model('calathea_orbifolia_01'); pl.position.set(5.6, 0.48, 9.3); pl.scale.setScalar(2.2); root.add(pl);
  const cab = await model('drawer_cabinet'); cab.position.set(5.5, 0, 3.5); cab.rotation.y = Math.PI / 2; root.add(cab); col(5.1, 5.9, 3.0, 4.0);
}

async function office() {
  // executive desk (Poly Haven metal_office_desk) facing west (door side); window behind (east)
  const d = await model('metal_office_desk');
  const bb = new THREE.Box3().setFromObject(d); const sz = bb.getSize(new THREE.Vector3());
  d.rotation.y = Math.PI / 2; d.position.set(15.3, 0, 4.5); root.add(d);
  const topY = sz.y; anchors.deskTopY = topY;
  col(15.3 - sz.z / 2, 15.3 + sz.z / 2, 4.5 - sz.x / 2, 4.5 + sz.x / 2);
  P.confChair(root, 16.45, 4.5, -Math.PI / 2, {high: true}); col(16.15, 16.8, 4.2, 4.8);
  anchors.officeSeat = {x: 16.38, z: 4.5, ry: -Math.PI / 2};
  anchors.officeDesk = {x: 15.3, z: 4.5, y: topY};
  anchors.officeDoorIn = {x: 12.0, z: 1.8};
  // desk items (positions are relative to the seated player: player faces -x)
  const y = topY + 0.002;
  anchors.deskItems = {
    folder: {x: 15.08, y, z: 4.78}, laptop: {x: 15.58, y, z: 4.5}, booklet: {x: 15.05, y, z: 4.18}, budget: {x: 15.1, y, z: 3.72},
    envelope: {x: 15.02, y, z: 5.25}, script: {x: 15.55, y, z: 5.12}, tablet: {x: 15.6, y, z: 3.86}, report: {x: 14.9, y, z: 4.55},
  };
  const it = anchors.deskItems;
  const objs = anchors.deskObjs = {};
  objs.folder = P.folder(root, it.folder.x, y, it.folder.z, Math.PI / 2 + 0.12);
  screens.laptopTex = canvasTex(512, 330, (g, W, H) => { g.fillStyle = '#f4f6f8'; g.fillRect(0, 0, W, H); g.fillStyle = '#1f6f54'; g.fillRect(0, 0, W, 34); g.fillStyle = '#fff'; g.font = '600 18px Inter'; g.fillText('Store Dashboard — Holiday', 14, 23); for (let i = 0; i < 4; i++) { g.fillStyle = '#fff'; g.fillRect(14 + i * 124, 48, 112, 70); g.fillStyle = i === 1 ? '#c0392b' : '#1d2329'; g.font = '700 26px Inter'; g.fillText(['31%', '9m', '55%', '+4%'][i], 24 + i * 124, 96); } g.strokeStyle = '#1f6f54'; g.lineWidth = 3; g.beginPath(); for (let i = 0; i < 12; i++) g.lineTo(30 + i * 40, 280 - Math.sin(i * 0.7) * 30 - i * 6); g.stroke(); });
  // laptop screen is a live canvas (boot sequence, desktop, dashboard); starts closed and off
  const lc = document.createElement('canvas'); lc.width = 512; lc.height = 330;
  const ltex = new THREE.CanvasTexture(lc); ltex.colorSpace = THREE.SRGBColorSpace;
  const lg = lc.getContext('2d'); lg.fillStyle = '#000'; lg.fillRect(0, 0, 512, 330); ltex.needsUpdate = true;
  const lap = P.laptop(root, it.laptop.x, y, it.laptop.z, Math.PI / 2, ltex);
  screens.laptop = lap.userData.screen; screens.laptopCanvas = lc; screens.laptopTex2 = ltex; screens.laptopOn = false;
  lap.userData.screen.emissiveIntensity = 0;
  lap.userData.lid.rotation.x = Math.PI / 2 - 0.035;      // closed
  objs.laptop = lap;
  objs.booklet = P.booklet(root, it.booklet.x, y, it.booklet.z, Math.PI / 2 - 0.1, P.coverTex('دليل العلامة'));
  objs.budget = P.papers(root, it.budget.x, y, it.budget.z, Math.PI / 2 + 0.25, 2);
  objs.envelope = P.envelope(root, it.envelope.x, y, it.envelope.z, Math.PI / 2 - 0.3);
  objs.script = P.papers(root, it.script.x, y, it.script.z, Math.PI / 2 - 0.15, 5);
  objs.tablet = P.tablet(root, it.tablet.x, y, it.tablet.z, Math.PI / 2 + 0.3, P.spreadsheetTex(21, '#5b3f6b'));
  for (const o of Object.values(objs)) o.traverse(m => { m.userData.noMerge = true; });
  P.mug(root, 15.72, y, 5.5, 0xf2efe8);
  const lamp = await model('desk_lamp_arm_01'); lamp.position.set(15.65, topY, 5.95); lamp.rotation.y = -2.2; root.add(lamp);
  // shelves, plant, sofa, clock
  // bookcase (walnut) with binders and books along the north wall
  const bc = P.group(root, 14.6, 0, -0.62);
  P.box(bc, 2.6, 2.1, 0.04, M.walnut, 0, 0, -0.17);
  for (const sx of [-1.28, 1.28]) P.box(bc, 0.04, 2.1, 0.38, M.walnut, sx, 0, 0);
  for (let i = 0; i < 5; i++) P.box(bc, 2.56, 0.03, 0.36, M.walnut, 0, 0.05 + i * 0.5, 0);
  const bookCols = [0x234f8c, 0x8a2d24, 0xd9cfba, 0x2f4a3f, 0x5b3f6b, 0x1f1f1f, 0xb98652];
  for (let sh = 0; sh < 4; sh++) { let x = -1.2; while (x < 1.15) { const w = 0.03 + Math.random() * 0.05, h = 0.26 + Math.random() * 0.14; if (Math.random() < 0.12) { x += 0.15; continue; }
    P.box(bc, w, h, 0.24, P.solid(bookCols[(Math.random() * bookCols.length) | 0], 0.8), x + w / 2, 0.08 + sh * 0.5, 0.02); x += w + 0.004; } }
  col(13.25, 15.95, -0.98, -0.4);
  // framed photo prints (city skyline, coffee farm) on the office south-west wall
  const art = (t, x, z, ry, w, h) => { const g = P.group(root, x, 1.45, z, ry); P.box(g, w + 0.06, h + 0.06, 0.03, M.trim, 0, 0, 0); const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({map: t, roughness: 0.5})); m.position.set(0, (h + 0.06) / 2, 0.017); g.add(m); };
  art(canvasTex(600, 400, (g, W, H) => { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#9fb8c9'); gr.addColorStop(0.6, '#e8d2b0'); gr.addColorStop(1, '#5a4636'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.fillStyle = '#2f3b33'; for (let i = 0; i < 12; i++) { g.beginPath(); g.ellipse(50 * i, H * 0.75, 60, 40, 0, 0, 7); g.fill(); } g.fillStyle = '#b3171d'; for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(Math.random() * W, H * 0.68 + Math.random() * 60, 4, 0, 7); g.fill(); } }), 11.1, 3.7, Math.PI / 2, 1.1, 0.75);
  P.planter(root, 17.4, 9.4, 0.55, 0.3); const pl = await model('calathea_orbifolia_01'); pl.position.set(17.4, 0.53, 9.4); pl.scale.setScalar(2.4); root.add(pl);
  for (const z of [7.6, 9.0]) { const c = await model('modern_arm_chair_01'); c.position.set(12.0, 0, z); c.rotation.y = Math.PI / 2; root.add(c); col(11.5, 12.5, z - 0.45, z + 0.45); }
  const clock = await model('wall_clock'); clock.position.set(11.1, 2.3, 5.5); clock.rotation.y = Math.PI / 2; root.add(clock);
  P.box(root, 0.02, 1.0, 1.6, M.whiteTop, 11.1, 1.0, 7.5);   // whiteboard
}

import {mergeStatic} from './merge.js';
async function decor() {
  // red neon glow strip on the lobby brick wall (as in the demo cafe) + its light
  const neon = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.05, 0.05), new THREE.MeshStandardMaterial({color: 0x330000, emissive: 0xff2414, emissiveIntensity: 4}));
  neon.position.set(0, 2.72, -0.86); neon.userData.noMerge = true; root.add(neon);
  const red = new THREE.PointLight(0xff3020, 2.2, 4.5, 1.8); red.position.set(0, 2.55, -0.55); root.add(red);
  // green exit signs
  const exitTex = canvasTex(256, 96, (g, W, H) => { g.fillStyle = '#0d3b1c'; g.fillRect(0, 0, W, H); g.fillStyle = '#c8ffd8'; g.font = '700 46px "IBM Plex Sans Arabic"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('\u0645\u062e\u0631\u062c', W / 2, H / 2 + 2); });
  const exitMat = new THREE.MeshStandardMaterial({map: exitTex, emissive: 0x40ff80, emissiveMap: exitTex, emissiveIntensity: 2.2});
  for (const [x, y, z, ry] of [[0, 2.85, B.z1 - 0.12, Math.PI], [2.0, 2.55, -5.08, Math.PI], [-17.85, 2.6, -8, Math.PI / 2]]) {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.04), exitMat); e.position.set(x, y, z); e.rotation.y = ry; e.userData.noMerge = true; root.add(e);
    const gl = new THREE.PointLight(0x30ff70, 0.5, 2.2, 2); gl.position.set(x + (ry === Math.PI / 2 ? 0.25 : 0), y - 0.1, z + (ry === Math.PI ? -0.2 : 0)); root.add(gl);
  }
  // framed pictures on the warm walls + extinguishers + cabinet (Poly Haven, from the demo set)
  const put = async (name, x, y, z, ry, s = 1) => { const o = await model(name); o.position.set(x, y, z); o.rotation.y = ry; o.scale.setScalar(s); root.add(o); return o; };
  await Promise.all([
    put('hanging_picture_frame_01', -4.9, 1.45, 2.0, Math.PI / 2),
    put('hanging_picture_frame_02', 4.9, 1.5, 3.2, -Math.PI / 2),
    put('hanging_picture_frame_03', 6.0, 1.5, -1.1, Math.PI),
    put('hanging_picture_frame_01', 10.0, 1.5, -4.92, 0),
    put('hanging_picture_frame_02', -10.0, 1.6, -13.82, 0),
    put('hanging_picture_frame_03', 17.88, 1.5, -10.5, -Math.PI / 2),
    put('korean_fire_extinguisher_01', 4.4, 0, -5.4, Math.PI),
    put('korean_fire_extinguisher_01', -17.6, 0, 9.0, Math.PI / 2),
    put('modern_wooden_cabinet', 12.0, 0, 4.3, Math.PI / 2),
    put('coffee_table_round_01', 2.4, 0, 8.1, 0),
  ]);
  col(11.6, 12.4, 3.5, 5.1);
  col(4.2, 4.6, -5.6, -5.2); col(-17.8, -17.4, 8.8, 9.2);   // extinguishers
}
export async function buildBuilding() {
  scene.add(root);
  shell(); interior(); upperFloors();
  await Promise.all([lobby(), openOffice(), meetingRoom(), breakRoom(), secretary(), office(), decor()]);
  root.traverse(o => { if (o.isMesh && o.material && o.material.transparent) o.castShadow = false; });
  root.updateMatrixWorld(true);
  const a = mergeStatic(root, {exclude: [roofGroup]}), b = mergeStatic(roofGroup);
  console.info('building merge', a, b);
  return root;
}
