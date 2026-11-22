// The workshop's real things (photographed / modelled assets, not boxes): steel shelving along the west wall filled
// with cartons and crates, two desks under the windows with monitors, laptops, lamps and office chairs, the tool corner
// under the pegboard (a tool cart, a tool chest, a vice), a display shelf of samples, a pallet of cartons by the door,
// a whiteboard, plants. Shelf levels are found by casting rays down through each unit, so things stand on real shelves.
// Poly Haven (CC0) and Sketchfab (CC BY, credited in the game) — see tools/fetch_assets.py.
import * as THREE from 'three';
import {model, sfModel} from '../core/assets.js';
import {canvasTex} from './materials.js';
import {ROOM, WT, RT, room, venue} from './workshop.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pickR = (a) => a[Math.floor(rnd() * a.length)];

/** scale an object so its largest horizontal size (or 'y') is `size`; returns it, standing on y = 0 at its origin */
function fit(o, size, axis = 'xz') {
  o.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(o), s = b.getSize(V(0, 0, 0));
  const cur = axis === 'y' ? s.y : axis === 'x' ? s.x : axis === 'z' ? s.z : Math.max(s.x, s.z);
  o.scale.multiplyScalar(size / cur);
  o.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(o), c = b2.getCenter(V(0, 0, 0));
  // re-centre the footprint on the origin, base on the floor
  const g = new THREE.Group(); g.add(o); o.position.x -= c.x; o.position.z -= c.z; o.position.y -= b2.min.y;
  return g;
}
function put(parent, o, x, y, z, ry = 0) { o.position.set(x, y, z); o.rotation.y = ry; parent.add(o); o.updateMatrixWorld(true); return o; }
const drop = (o, names) => { const kill = []; o.traverse(m => { if (m.isMesh && names.some(n => m.name.includes(n))) kill.push(m); }); kill.forEach(m => m.removeFromParent()); return o; };

// ---------------------------------------------------------------- shelf levels by ray casting
const ray = new THREE.Raycaster(), _n = new THREE.Vector3();
/** the upward-facing surfaces of `obj` under (x, z), from the bottom: [y, …] */
function surfaces(obj, x, z, top = 3) {
  ray.set(V(x, top, z), V(0, -1, 0)); ray.far = top + 0.1;
  const ys = [];
  for (const h of ray.intersectObject(obj, true)) {
    if (!h.face) continue;
    _n.copy(h.face.normal).transformDirection(h.object.matrixWorld);
    if (_n.y < 0.7) continue;
    if (!ys.some(y => Math.abs(y - h.point.y) < 0.03)) ys.push(h.point.y);
  }
  return ys.sort((a, b) => a - b);
}

// ---------------------------------------------------------------- the goods
let SRC = {};
async function sources() {
  const [box, c1, c2, c3, binder, clip] = await Promise.all(['cardboard_box_01', 'plastic_crate_01', 'plastic_crate_02', 'plastic_crate_03', 'binder_notebook', 'clipboard'].map(n => model(n)));
  SRC = {box, crates: [c1, c2, c3], binder, clip};
}
/** a real clipboard (cloned) */
export const clipboardModel = () => SRC.clip.clone(true);
/** a carton (the real cardboard box) scaled to about w × h × d */
export function carton(w, h, d) {
  const b = SRC.box.clone(true); const g = new THREE.Group(); g.add(b);
  if (!SRC.boxB) { SRC.box.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(SRC.box); SRC.boxB = {s: bb.getSize(V(0, 0, 0)), c: bb.getCenter(V(0, 0, 0)), y0: bb.min.y}; }
  const {s, c, y0} = SRC.boxB;
  b.scale.set(w / s.x, h / s.y, d / s.z); b.position.set(-c.x * w / s.x, -y0 * h / s.y, -c.z * d / s.z);   // centred footprint, base on y = 0
  g.userData.h = h; return g;
}
async function shelving() {
  const unitSrc = await model('steel_frame_shelves_03');
  const x = ROOM.x0 + 0.37, units = [-2.42, 0.0, 2.42];
  for (const zc of units) {
    const u = unitSrc.clone(true); put(room, u, x, 0, zc, Math.PI / 2); u.updateMatrixWorld(true);
    // sample the levels along the unit (the drawers in one bay are skipped: their tops are close together)
    // two passes along the unit; each shelf level keeps the spans already taken
    const occ = new Map();
    const free = (y, z0, z1) => !(occ.get(Math.round(y * 50)) || []).some(([a, b]) => z0 < b && z1 > a);
    const take = (y, z0, z1) => { const k = Math.round(y * 50); if (!occ.has(k)) occ.set(k, []); occ.get(k).push([z0, z1]); };
    for (let pass = 0; pass < 2; pass++) {
      let z = zc - 1.07 + pass * 0.13;
      while (z < zc + 1.02) {
        const lv = surfaces(u, x + 0.05, z, 2.6);
        const r = rnd(), w = r < 0.62 ? 0.24 + rnd() * 0.22 : 0.37;
        if (z + w > zc + 1.06) break;
        for (let i = 0; i < lv.length; i++) {
          const y = lv[i], gap = (lv[i + 1] ?? 2.75) - y - 0.03;
          if (gap < 0.16 || y < 0.05 || !free(y, z, z + w)) continue;
          if (rnd() < 0.05) continue;
          const y2 = surfaces(u, x + 0.05, z + w - 0.02, 2.6).find(v => Math.abs(v - y) < 0.02);
          if (y2 == null) continue;
          let o;
          if (r < 0.62) { const h = Math.min(gap - 0.02, 0.16 + rnd() * 0.18), d = 0.42 + rnd() * 0.18; o = carton(w - 0.02, h, d); }
          else if (r < 0.92) { const c = pickR(SRC.crates).clone(true); o = new THREE.Group(); o.add(c); c.rotation.y = Math.PI / 2; const s = Math.min(0.85, (gap - 0.02) / 0.27); c.scale.setScalar(s); }
          else { const c = SRC.binder.clone(true); o = new THREE.Group(); o.add(c); c.rotation.set(0, Math.PI / 2, 0); }
          put(room, o, x + 0.02 + (rnd() - 0.5) * 0.04, y + 0.002, z + w / 2, Math.PI / 2 + (rnd() - 0.5) * 0.1);
          take(y, z, z + w);
          if (r < 0.62 && rnd() < 0.3) { const h0 = o.children[0].scale.y * SRC.boxB.s.y, h2 = Math.min(gap - h0 - 0.03, 0.12 + rnd() * 0.1); if (h2 > 0.08) put(room, carton(w * 0.8, h2, 0.3), x + 0.03, y + h0 + 0.004, z + w / 2, Math.PI / 2 + (rnd() - 0.5) * 0.3); }
        }
        z += w + 0.02 + rnd() * 0.03;
      }
    }
    // a carton or two on the floor in front of the unit
    if (rnd() < 0.7) put(room, carton(0.46, 0.3, 0.36), x + 0.62, 0, zc + (rnd() - 0.5) * 1.2, Math.PI / 2 + (rnd() - 0.5) * 0.4);
  }
}

// ---------------------------------------------------------------- the desks under the windows
function screenTex(kind) {
  return canvasTex(1024, 440, (g, W, H) => {
    g.fillStyle = '#eef0f2'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#2b2f36'; g.fillRect(0, 0, W, 26);
    if (kind === 0) {           // a product drawing: an exploded set of blocks
      g.fillStyle = '#ffffff'; g.fillRect(200, 40, W - 220, H - 60);
      g.strokeStyle = '#5a6b80'; g.lineWidth = 2;
      for (let i = 0; i < 9; i++) { const x = 280 + (i % 3) * 150 + (i > 5 ? 60 : 0), y = 90 + Math.floor(i / 3) * 95; g.strokeRect(x, y, 110, 60); g.beginPath(); g.moveTo(x, y); g.lineTo(x + 24, y - 18); g.lineTo(x + 134, y - 18); g.lineTo(x + 110, y); g.stroke(); }
      g.fillStyle = '#d7dbe0'; for (let i = 0; i < 12; i++) g.fillRect(16, 50 + i * 30, 160, 16);
    } else {                    // a planning sheet
      g.fillStyle = '#ffffff'; g.fillRect(14, 40, W - 28, H - 54);
      for (let r = 0; r < 12; r++) for (let c = 0; c < 8; c++) { g.fillStyle = r === 0 ? '#c9d3df' : (r + c) % 5 === 0 ? '#f3d9a8' : '#f4f5f7'; g.fillRect(20 + c * 124, 46 + r * 30, 120, 26); }
      g.fillStyle = '#7d8a99'; for (let r = 1; r < 12; r++) for (let c = 0; c < 8; c++) g.fillRect(28 + c * 124, 56 + r * 30, 40 + ((r * 7 + c * 13) % 60), 6);
    }
  });
}
async function desks() {
  const [desk, mon, lap, lamp, chair, clip, plant, tape] = await Promise.all([model('metal_office_desk'), sfModel('monitor'), model('classic_laptop'), model('desk_lamp_arm_01'), sfModel('office_chair'), model('clipboard'), model('potted_plant_04'), model('measuring_tape_01')]);
  const z = ROOM.z0 + 0.62, top = 0.765;
  const spots = [-3.55, -1.35];
  const pend = await model('hanging_industrial_lamp');
  spots.forEach((x, i) => {
    put(room, pend.clone(true), x, ROOM.h, z + 0.2, 0);
    // whoever sits here faces the window: drawers and screen towards the room side
    put(room, desk.clone(true), x, 0, z, 0);
    const m = fit(mon.clone(true), 0.82, 'x'); put(room, m, x - 0.25, top, z - 0.22, 0);
    m.traverse(o => { if (o.isMesh && o.material && o.material.name === 'Screen') { o.material = new THREE.MeshStandardMaterial({map: screenTex(i), emissive: 0xffffff, emissiveMap: screenTex(i), emissiveIntensity: 0.55, roughness: 0.3}); } });
    const l = fit(lap.clone(true), 0.36, 'x'); put(room, l, x + 0.55, top, z - 0.02, -0.25);
    const lp = fit(lamp.clone(true), 0.55, 'y'); put(room, lp, x + 0.85, top, z - 0.3, 0.5);
    put(room, fit(clip.clone(true), 0.3, 'z'), x - 0.75, top, z + 0.12, 0.3);
    if (i === 0) put(room, fit(plant.clone(true), 0.2, 'y'), x - 0.85, top, z - 0.3, 0);
    else put(room, fit(tape.clone(true), 0.07, 'y'), x - 0.6, top, z + 0.1, 0.7);
    const ch = fit(chair.clone(true), 0.95, 'y'); put(room, ch, x + (i ? 0.15 : -0.2), 0, z + 0.62, Math.PI + (i ? 0.25 : -0.35));
  });
}

// ---------------------------------------------------------------- the south wall: tools, samples, the whiteboard, the pallet
async function southSide() {
  const zw = ROOM.z1;
  const [cart, chest, toolbox, vice, spray, hammer, wrench, display, cab, board, pallets, plant1, plant2, can] = await Promise.all([
    model('tool_cart'), model('metal_tool_chest'), model('metal_toolbox'), model('bench_vice_01'), model('spray_paint_bottles'), model('wooden_hammer_01'), model('adjustable_wrench'),
    model('wooden_display_shelves_01'), model('drawer_cabinet'), sfModel('whiteboard'), sfModel('pallets'), model('potted_plant_02'), model('potted_plant_02'), model('metal_trash_can')]);
  // the tool cart under the pegboard, its top as a small bench; the chest beside it
  const tc = put(room, cart, -3.3, 0, zw - 0.42, Math.PI); tc.updateMatrixWorld(true);
  const top = surfaces(tc, -3.1, zw - 0.42, 2).pop() ?? 0.96;
  put(room, toolbox, -3.75, top, zw - 0.45, Math.PI + 0.2);
  put(room, vice, -2.8, top, zw - 0.4, Math.PI);
  put(room, spray, -3.15, top, zw - 0.3, Math.PI - 0.3);
  put(room, chest, -4.45, 0, zw - 0.3, Math.PI + 0.1);
  // tools hung on the pegboard (facing into the room)
  const hang = (o, x, y, rz) => { const g = new THREE.Group(); g.add(o); o.rotation.z = rz; g.position.set(x, y, zw - 0.03); g.rotation.y = Math.PI; room.add(g); };
  hang(hammer, -4.3, 1.75, 0.05); hang(wrench, -3.95, 1.8, -0.1);
  // the display shelf of samples
  const ds = put(room, display, -1.85, 0, zw - 0.24, -Math.PI / 2); ds.updateMatrixWorld(true);
  room.userData.display = ds;
  // the drawer cabinet
  put(room, fit(cab, 1.0, 'x'), -0.55, 0, zw - 0.27, Math.PI);
  // the whiteboard (our own sheet on it: a plan sketched with markers)
  const wb = fit(board, 1.8, 'x'); put(room, wb, 1.45, 0.82, zw - 0.045, Math.PI);
  const sheet = canvasTex(1800, 1100, (g, W, H) => {
    g.fillStyle = '#f7f8f8'; g.fillRect(0, 0, W, H);
    g.lineCap = 'round'; g.lineJoin = 'round';
    const pen = (c, w) => { g.strokeStyle = c; g.lineWidth = w; };
    pen('#1f4fa0', 7); g.beginPath(); g.moveTo(120, 160); g.lineTo(760, 160); g.stroke();
    for (let i = 0; i < 4; i++) { pen(['#c8553d', '#2f6fb0', '#2e8b6e', '#8a63b8'][i], 8); g.strokeRect(140 + i * 160, 240, 120, 90); }
    pen('#333', 5); for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(140, 420 + i * 70); for (let x = 140; x < 700; x += 30) g.lineTo(x, 420 + i * 70 + Math.sin(x * 0.07 + i) * 6); g.stroke(); }
    pen('#c8553d', 6); g.beginPath(); g.arc(1220, 420, 210, 0, 6.2); g.stroke();
    pen('#333', 5); for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(1050, 330 + i * 26); g.lineTo(1380 - (i % 3) * 40, 330 + i * 26); g.stroke(); }
    const notes = ['#f6e27a', '#f7b6c2', '#a8dcf0', '#bfe3a4'];
    for (let i = 0; i < 7; i++) { g.fillStyle = notes[i % 4]; g.fillRect(900 + (i % 4) * 190, 760 + Math.floor(i / 4) * 150, 150, 120); }
  });
  // the writing surface is the biggest part of the model: our sheet goes on its face
  wb.updateMatrixWorld(true); let face = null, fa = 0; wb.traverse(o => { if (o.isMesh) { const s = new THREE.Box3().setFromObject(o).getSize(V(0, 0, 0)); if (s.x * s.y > fa) { fa = s.x * s.y; face = o; } } });
  const fb = new THREE.Box3().setFromObject(face), fc = fb.getCenter(V(0, 0, 0)), fs = fb.getSize(V(0, 0, 0));
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(fs.x * 0.95, fs.y * 0.93), new THREE.MeshStandardMaterial({map: sheet, roughness: 0.35, color: 0xdcdcda}));
  sh.position.set(fc.x, fc.y, fb.min.z - 0.003); sh.rotation.y = Math.PI; room.add(sh);
  // a pallet of cartons by the door
  const p1 = drop(pallets, ['Pallet_2']); const pal = fit(p1, 1.2, 'x'); put(room, pal, 3.25, 0, zw - 0.75, 0.08);
  const ph = new THREE.Box3().setFromObject(pal).max.y;
  for (let l = 0; l < 3; l++) for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    if (l === 2 && i + j > 1) continue;
    put(room, carton(0.52, 0.32, 0.4), 3.25 - 0.28 + i * 0.56 + (rnd() - 0.5) * 0.03, ph + l * 0.325, zw - 0.95 + j * 0.42, 0.08 + (rnd() - 0.5) * 0.06);
  }
  // plants and a bin
  put(room, fit(plant1, 1.15, 'y'), ROOM.x1 - 0.45, 0, zw - 0.45, 0.4);
  put(room, fit(plant2, 0.95, 'y'), ROOM.x1 - 0.5, 0, ROOM.z0 + 0.6, 1.0);
  put(room, fit(drop(can, ['rust']), 0.62, 'y'), 0.35, 0, zw - 0.35, 0.3);
}
/** block-built samples on the display shelf (plain smooth blocks, no studs) */
function samples() {
  const ds = room.userData.display; if (!ds) return;
  const cols = [0xd94a3c, 0xf1c541, 0x3a72c4, 0x3f8f57, 0xf2efe6];
  const mat = (c) => new THREE.MeshPhysicalMaterial({color: c, roughness: 0.28, clearcoat: 0.5, clearcoatRoughness: 0.3});
  const geo = new THREE.BoxGeometry(0.05, 0.035, 0.05);
  const b = new THREE.Box3().setFromObject(ds), x0 = b.min.x + 0.12, x1 = b.max.x - 0.12, zc = (b.min.z + b.max.z) / 2;
  const lv = surfaces(ds, (x0 + x1) / 2, zc, 2.2).filter(y => y > 0.2);
  lv.forEach((y, li) => {
    for (let k = 0; k < 3; k++) {
      const x = x0 + (k + 0.5) * (x1 - x0) / 3, n = 2 + ((li + k) % 3);
      for (let i = 0; i < n; i++) { const m = new THREE.Mesh(geo, mat(cols[(li * 3 + k + i) % 5])); m.position.set(x + (i % 2) * 0.052 - 0.026, y + 0.018 + Math.floor(i / 2) * 0.036, zc + (rnd() - 0.5) * 0.04); m.castShadow = m.receiveShadow = true; room.add(m); }
    }
  });
}

// ---------------------------------------------------------------- the meeting corner: a sideboard under the cork board, binders on the review table
async function meetingSide() {
  const [cab, binder, plant] = await Promise.all([model('modern_wooden_cabinet'), model('binder_notebook'), model('potted_plant_04')]);
  const sb = fit(cab, 1.4, 'x'); put(room, sb, ROOM.x1 - 0.26, 0, -3.0, -Math.PI / 2);
  const top = new THREE.Box3().setFromObject(sb).max.y;
  put(room, fit(plant, 0.24, 'y'), ROOM.x1 - 0.26, top, -3.45, 0.4);
  put(room, fit(SRC.binder.clone(true), 0.32, 'x'), ROOM.x1 - 0.28, top, -2.75, 1.2);
  // two binders and a third lying at Victor's right hand, one more by the north seats
  put(room, fit(binder.clone(true), 0.3, 'x'), RT.x + 1.18, RT.y + 0.001, RT.z + 0.33, 0.25);
  put(room, fit(binder.clone(true), 0.3, 'x'), RT.x + 0.35, RT.y + 0.001, RT.z - 0.36, -0.15);
}

// ---------------------------------------------------------------- build
export async function buildDressing() {
  await sources();
  await Promise.all([shelving(), desks(), southSide(), meetingSide()]);
  samples();
}
