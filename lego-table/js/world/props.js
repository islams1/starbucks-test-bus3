// Everything on the two tables (Concept A §2). The worktable's far row: four white bases, each with its model, a row
// of sockets equal to its cost edged in the proposal's colour, a tilted label (cost in large type, name, status) and
// a proposal card lying face down. The near row: the capacity rack (eight pockets, eight plain wooden blocks, a strip
// under each pocket: "free" or the item that took it) with the tilted ledger plate in front; to its right the
// retailer note and two stamps; to its left the need-chip dish and the First / Next priority tray.
// The review table: the pitch board ("Two-decision turnaround brief"), the condition-card holder (5 cards), the clip
// beside the "First" line, and the "Commit the pitch" stamp. Only building and drawing here; the rules are elsewhere.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {onUpdate} from '../core/engine.js';
import {canvasTex} from './materials.js';
import {pbr} from './materials.js';
import {WT, RT, mesh} from './workshop.js';
import {carton, clipboardModel} from './dressing.js';
import {P, ROW, CAP, EN, tr, nm, T, units, unitsMore, CONDS, condText} from '../story/alloc.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const boxG = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const std = (color, roughness = 0.6, extra = {}) => new THREE.MeshStandardMaterial({color, roughness, ...extra});
const box = (p, w, h, d, m, x = 0, y = 0, z = 0, o) => mesh(p, boxG(w, h, d), m, x, y, z, o);
export const FA = '"IBM Plex Sans Arabic", "Noto Sans Arabic", sans-serif', FE = 'Inter, "Segoe UI", Arial, sans-serif';
const FF = () => EN ? FE : FA;
const PAPER = 0xd9d5cc;                // paper under bright light stays below the bloom threshold (sharp text)

// ---------------------------------------------------------------- canvas text helpers (Arabic right-to-left)
export function txt(g, s, x, y, {px = 40, w = 600, col = '#1f2124', align = 'start', max = 0, font = null, rtl = !EN} = {}) {
  let size = px;
  g.direction = rtl ? 'rtl' : 'ltr'; g.textAlign = align; g.fillStyle = col; g.textBaseline = 'alphabetic';
  g.font = `${w} ${size}px ${font || FF()}`;
  if (max) while (g.measureText(s).width > max && size > 10) { size -= 2; g.font = `${w} ${size}px ${font || FF()}`; }
  g.fillText(s, x, y);
  return g.measureText(s).width;
}
export function wrap(g, s, x, y, maxW, lh, o = {}) {
  const words = String(s).split(/\s+/); let line = '';
  g.font = `${o.w || 500} ${o.px || 34}px ${o.font || FF()}`; g.direction = (o.rtl ?? !EN) ? 'rtl' : 'ltr';
  for (const wd of words) {
    const t = line ? line + ' ' + wd : wd;
    if (g.measureText(t).width > maxW && line) { txt(g, line, x, y, o); y += lh; line = wd; } else line = t;
  }
  if (line) { txt(g, line, x, y, o); y += lh; }
  return y;
}
const sx = (W, m) => EN ? m : W - m;          // the start edge for the reading direction
function hiTex(w, h, draw) { const t = canvasTex(w, h, draw); t.anisotropy = 16; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t; }
function redraw(t, draw) { const c = t.image, g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); draw(g, c.width, c.height); t.needsUpdate = true; }

// ---------------------------------------------------------------- layout (world)
export const BASE_Z = WT.z - 0.36;
export const BASE_X = {venue: WT.x - 1.05, theme: WT.x - 0.35, delivery: WT.x + 0.35, core: WT.x + 1.05};
export const RACK = {x: WT.x, z: WT.z + 0.3, pitch: 0.092};
export const SOCKET = 0.088;
export const BLOCK = {w: 0.072, h: 0.045};
export const TB = {bases: {}, rack: null, blocks: [], ledger: null, note: null, stamps: {}, dish: null, chips: {}, tray: null, board: null, holder: null, cards: [], clip: null, commit: null};

let woodMats = null;
let _baseMat = null;
const baseMat = () => _baseMat ||= pbr('plywood', [0.5, 0.4], {color: 0xfff4e4, roughness: 0.6});
export const blockMat = (i = 0) => (woodMats ||= [0xf1d9b0, 0xecd2a6, 0xf4dfbb].map(c => pbr('oak_veneer_01', [0.12, 0.12], {color: c, roughness: 0.52})))[i % 3];
const blockGeo = new RoundedBoxGeometry(BLOCK.w, BLOCK.h, BLOCK.w, 3, 0.006);
export function makeBlock(i = 0, ghost = false) {
  const m = new THREE.Mesh(blockGeo, ghost ? new THREE.MeshStandardMaterial({color: 0xd23a2e, roughness: 0.5, transparent: true, opacity: 0.38, depthWrite: false}) : blockMat(i));
  m.castShadow = !ghost; m.receiveShadow = true; return m;
}

// ---------------------------------------------------------------- the four models (plain shapes, no logos)
const smooth = (c) => new THREE.MeshPhysicalMaterial({color: c, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.25});
function modelCore(g) {
  const tray = std(0xf3f2ee, 0.4);
  box(g, 0.34, 0.012, 0.2, tray, 0, 0.006, 0); for (const s of [-1, 1]) { box(g, 0.34, 0.02, 0.008, tray, 0, 0.016, s * 0.096); box(g, 0.008, 0.02, 0.2, tray, s * 0.166, 0.016, 0); }
  // a little house of smooth blocks
  const R = smooth(0xd9503f), Y = smooth(0xf1c541), W = smooth(0xf2efe6), B = smooth(0x3b6fc0);
  const hb = new RoundedBoxGeometry(0.03, 0.02, 0.03, 2, 0.003);
  for (let l = 0; l < 3; l++) for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { if (l < 2 && i === 1 && j === 1) continue; mesh(g, hb, l === 2 ? W : (i + j + l) % 2 ? R : Y, -0.08 + i * 0.031, 0.022 + l * 0.021, -0.02 + j * 0.031); }
  mesh(g, hb, B, -0.049, 0.022, 0.011);   // the door
  const roof = std(0x2f4f8f, 0.45);
  for (const s of [-1, 1]) { const r = box(g, 0.1, 0.006, 0.042, roof, -0.049, 0.086, -0.0045 + s * 0.016); r.rotation.x = s * 0.62; }
  // a cart: a flat of three blocks on four wheels, with a handle
  const cart = new THREE.Group(); cart.position.set(0.08, 0.012, 0.02); g.add(cart);
  for (let i = 0; i < 3; i++) mesh(cart, new RoundedBoxGeometry(0.03, 0.014, 0.05, 2, 0.003), [R, Y, B][i], -0.031 + i * 0.031, 0.022, 0);
  const wh = std(0x222326, 0.6);
  for (const a of [-1, 1]) for (const b of [-1, 1]) { const w = mesh(cart, new THREE.CylinderGeometry(0.011, 0.011, 0.008, 16), wh, a * 0.035, 0.011, b * 0.028); w.rotation.x = Math.PI / 2; }
  const hd = box(cart, 0.005, 0.05, 0.005, smooth(0x3a3c40), 0.055, 0.045, 0); hd.rotation.z = -0.5;
}
function modelDelivery(g) {
  // the packing list on a real clipboard, leaning on a small stand towards the player
  const stand = new THREE.Group(); stand.position.set(-0.07, 0.0, -0.01); g.add(stand);
  box(stand, 0.08, 0.008, 0.06, std(0x2b2d30, 0.5), 0, 0.004, 0);
  const board = new THREE.Group(); board.position.set(0, 0.008, 0.0); board.rotation.x = -0.32; stand.add(board);
  const list = hiTex(512, 680, (c, W, H) => {
    c.fillStyle = '#f4f1ea'; c.fillRect(0, 0, W, H);
    txt(c, tr('قائمة التعبئة', 'Packing list'), sx(W, 34), 70, {px: 44, w: 700});
    for (let i = 0; i < 7; i++) {
      const y = 140 + i * 74; c.fillStyle = '#c7c2b6'; c.fillRect(30, y + 18, W - 60, 2);
      c.fillStyle = '#5b5f66'; c.fillRect(EN ? 40 : W - 70, y - 18, 30, 30);
      c.fillStyle = '#9aa0a8'; c.fillRect(EN ? 90 : 60, y - 10, (W - 170) * (0.45 + ((i * 37) % 40) / 100), 14);
      if (i % 3 !== 2) { c.strokeStyle = '#2f6fb0'; c.lineWidth = 6; c.beginPath(); const bx = EN ? 40 : W - 70; c.moveTo(bx + 4, y - 4); c.lineTo(bx + 13, y + 8); c.lineTo(bx + 30, y - 22); c.stroke(); }
    }
  });
  const cb = clipboardModel(); cb.scale.setScalar(0.56); cb.rotation.x = Math.PI / 2; cb.position.set(0, 0.095, -0.004); board.add(cb);
  mesh(board, new THREE.PlaneGeometry(0.11, 0.135), new THREE.MeshStandardMaterial({map: list, color: PAPER, roughness: 0.85}), 0, 0.085, 0.02, {cast: false});
  const leg = box(stand, 0.008, 0.12, 0.008, std(0x2b2d30, 0.5), 0, 0.06, -0.035); leg.rotation.x = 0.35;
  // two cartons with supplier labels; the front one's label is a flap that opens
  const lab = (n) => hiTex(256, 160, (c, W, H) => { c.fillStyle = '#f6f4ee'; c.fillRect(0, 0, W, H); c.fillStyle = '#1f2124'; c.font = `600 34px ${FE}`; c.textAlign = 'center'; c.fillText(n, W / 2, 56); for (let i = 0; i < 26; i++) c.fillRect(40 + i * 7, 84, i % 3 ? 3 : 5, 50); });
  const c1 = new THREE.Group(); c1.position.set(0.07, 0, -0.04); g.add(c1);
  c1.add(carton(0.1, 0.075, 0.075));
  mesh(c1, new THREE.PlaneGeometry(0.05, 0.032), new THREE.MeshStandardMaterial({map: lab('SUP-14'), color: PAPER, roughness: 0.8}), 0, 0.045, 0.0381, {cast: false});
  const c2 = new THREE.Group(); c2.position.set(0.075, 0, 0.05); c2.rotation.y = -0.12; g.add(c2);
  c2.add(carton(0.09, 0.065, 0.07));
  // the flap: a folded-over label on top of the front carton, hinged at its back edge
  const flap = new THREE.Group(); flap.position.set(0, 0.0655, 0.012); c2.add(flap);
  const inner = hiTex(256, 160, (c, W, H) => { c.fillStyle = '#fbf3c4'; c.fillRect(0, 0, W, H); txt(c, tr('متوفّر: غير منتظم', 'Stock: irregular'), W / 2, 70, {px: 30, w: 700, align: 'center', col: '#8a2b1f'}); txt(c, tr('آخر 4 أسابيع', 'last 4 weeks'), W / 2, 120, {px: 24, w: 500, align: 'center', col: '#3b3e44'}); });
  const fo = mesh(flap, new THREE.PlaneGeometry(0.05, 0.032), new THREE.MeshStandardMaterial({map: lab('SUP-09'), color: PAPER, roughness: 0.8}), 0, 0.0008, 0.016, {cast: false});
  fo.rotation.x = -Math.PI / 2;
  const fi = mesh(flap, new THREE.PlaneGeometry(0.05, 0.032), new THREE.MeshStandardMaterial({map: inner, color: PAPER, roughness: 0.8}), 0, 0.0004, 0.016, {cast: false});
  fi.rotation.x = Math.PI / 2;
  g.userData.flap = flap;
}
function modelTheme(g) {
  g.add(carton(0.19, 0.12, 0.14));
  const sketch = hiTex(640, 400, (c, W, H) => {
    c.fillStyle = '#efe5d2'; c.fillRect(0, 0, W, H);
    c.strokeStyle = '#3b3a38'; c.lineWidth = 5; c.lineCap = 'round';
    // a pencil sketch: a small building set with a tower and a flag, and a figure
    c.strokeRect(120, 170, 160, 150); c.strokeRect(300, 120, 90, 200); c.beginPath(); c.moveTo(300, 120); c.lineTo(345, 70); c.lineTo(390, 120); c.stroke();
    c.beginPath(); c.moveTo(345, 70); c.lineTo(345, 30); c.lineTo(380, 42); c.lineTo(345, 52); c.stroke();
    c.beginPath(); c.arc(470, 200, 22, 0, 7); c.stroke(); c.beginPath(); c.moveTo(470, 222); c.lineTo(470, 290); c.moveTo(440, 250); c.lineTo(500, 250); c.moveTo(470, 290); c.lineTo(450, 330); c.moveTo(470, 290); c.lineTo(490, 330); c.stroke();
    c.lineWidth = 2; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(140 + i * 22, 300); c.lineTo(150 + i * 22, 190); c.stroke(); }
    txt(c, tr('نموذج أوّلي', 'Prototype'), W / 2, 380, {px: 40, w: 700, align: 'center', col: '#2e8b6e', font: '"Comic Sans MS", ' + FF()});
  });
  mesh(g, new THREE.PlaneGeometry(0.17, 0.106), new THREE.MeshStandardMaterial({map: sketch, color: PAPER, roughness: 0.85}), 0, 0.06, 0.0705, {cast: false});
}
function modelVenue(g) {
  const W = std(0xf4f3ef, 0.55), W2 = std(0xe6e4de, 0.6);
  box(g, 0.4, 0.01, 0.24, W2, 0, 0.005, 0);
  // masses
  box(g, 0.1, 0.06, 0.07, W, -0.13, 0.04, -0.06); box(g, 0.06, 0.1, 0.06, W, -0.06, 0.06, -0.08); box(g, 0.08, 0.04, 0.05, W, 0.0, 0.03, -0.085);
  // the curved hall: a part of a cylinder shell with a roof
  const hall = mesh(g, new THREE.CylinderGeometry(0.09, 0.09, 0.05, 32, 1, true, -0.4, 2.2), new THREE.MeshStandardMaterial({color: 0xf4f3ef, roughness: 0.55, side: THREE.DoubleSide}), 0.09, 0.035, 0.0);
  const roof = mesh(g, new THREE.CylinderGeometry(0.093, 0.093, 0.004, 32, 1, false, -0.4, 2.2), W, 0.09, 0.062, 0.0);
  // a path and small trees
  const path = std(0xcfcac0, 0.8);
  for (let i = 0; i < 7; i++) { const p = box(g, 0.035, 0.002, 0.02, path, -0.15 + i * 0.045, 0.011, 0.075 + Math.sin(i * 0.8) * 0.02); p.rotation.y = Math.cos(i * 0.8) * 0.4; }
  const tree = std(0xdfe6d6, 0.7);
  for (const [x, z] of [[-0.17, 0.02], [-0.1, 0.03], [0.02, 0.06], [0.17, -0.09], [0.16, 0.09]]) { box(g, 0.004, 0.03, 0.004, W2, x, 0.025, z); mesh(g, new THREE.SphereGeometry(0.018, 12, 10), tree, x, 0.05, z); }
}
const MODELS = {core: modelCore, delivery: modelDelivery, theme: modelTheme, venue: modelVenue};

// ---------------------------------------------------------------- the bases
const LABEL_W = 0.34, LABEL_H = 0.12;
function labelDraw(id, st) {
  return (c, W, H) => {
    const p = P[id];
    c.fillStyle = '#f6f4ef'; c.fillRect(0, 0, W, H);
    c.fillStyle = p.col; c.fillRect(0, H - 18, W, 18);
    // the cost in large type, in a square of the proposal's colour
    const bx = EN ? 24 : W - 24 - 220;
    c.fillStyle = p.col; c.fillRect(bx, 24, 220, 220);
    c.fillStyle = '#fff'; c.font = `800 176px ${FE}`; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.direction = 'ltr'; c.fillText(String(p.cost), bx + 110, 200);
    const x = EN ? 272 : W - 272, mw = W - 300;
    txt(c, T(p.short), x, 104, {px: 66, w: 800, col: '#101214', max: mw});
    txt(c, units(p.cost), x, 168, {px: 42, w: 600, col: '#3a3e44', max: mw});
    const s = st || {k: 'closed'};
    const col = s.k === 'refused' ? '#b3261e' : s.k === 'funded' ? p.col : '#2b2d31';
    const msg = s.k === 'closed' ? tr('مغلق · انقر لفتحه', 'Closed · click to open') : s.k === 'open' ? tr('مفتوح', 'Opened') : s.k === 'funded' ? tr('مموّل ✓', 'Funded ✓')
      : s.k === 'refused' ? unitsMore(s.need) : s.k === 'waits' ? tr('ينتظر', 'Waits') : '';
    txt(c, msg, x, 234, {px: 44, w: 800, col, max: mw});
  };
}
export function drawLabel(id, st) { const b = TB.bases[id]; if (b) redraw(b.labelTex, labelDraw(id, st)); }
function cardFront(id) {
  return hiTex(512, 340, (c, W, H) => {
    const p = P[id];
    c.fillStyle = '#f7f5f0'; c.fillRect(0, 0, W, H); c.fillStyle = p.col; c.fillRect(0, 0, W, 16);
    txt(c, T(p.name), sx(W, 26), 82, {px: 38, w: 700, max: W - 52});
    c.fillStyle = p.col; c.font = `800 96px ${FE}`; c.textAlign = EN ? 'right' : 'left'; c.direction = 'ltr'; c.fillText(String(p.cost), EN ? W - 26 : 26, 300);
    wrap(c, T(p.evidence), sx(W, 26), 140, W - 170, 42, {px: 30, w: 500, col: '#3a3d42'});
  });
}
let cardBackTex = null;
const cardBack = () => cardBackTex ||= hiTex(256, 170, (c, W, H) => { c.fillStyle = '#c9b18c'; c.fillRect(0, 0, W, H); c.strokeStyle = 'rgba(80,60,35,.35)'; c.lineWidth = 3; for (let i = -H; i < W; i += 18) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + H, H); c.stroke(); } c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 6; c.strokeRect(12, 12, W - 24, H - 24); });
function pennantTex(id, k) {
  return hiTex(256, 128, (c, W, H) => {
    c.fillStyle = k === 'funded' ? P[id].col : '#8d9196'; c.beginPath(); c.moveTo(0, 0); c.lineTo(W, H * 0.12); c.lineTo(W, H * 0.88); c.lineTo(0, H); c.closePath(); c.fill();
    txt(c, k === 'funded' ? tr('مموّل', 'Funded') : tr('ينتظر', 'Waits'), W * 0.48, H * 0.64, {px: 46, w: 700, col: '#fff', align: 'center'});
  });
}
function buildBase(id) {
  const p = P[id], g = new THREE.Group(); g.position.set(BASE_X[id], WT.y, BASE_Z); g.name = 'base_' + id;
  const slab = mesh(g, new RoundedBoxGeometry(0.62, 0.035, 0.46, 2, 0.004), baseMat(), 0, 0.0175, 0);
  box(g, 0.62, 0.004, 0.012, std(p.hex, 0.5), 0, 0.0355, 0.224, {cast: false});
  // sockets: a dark recess with a frame in the proposal's colour
  const sockets = [], col = std(p.hex, 0.45), hole = std(0x2a2b2d, 0.8);
  for (let i = 0; i < p.cost; i++) {
    const x = (i - (p.cost - 1) / 2) * SOCKET, z = 0.13;
    box(g, 0.08, 0.004, 0.006, col, x, 0.037, z - 0.037, {cast: false}); box(g, 0.08, 0.004, 0.006, col, x, 0.037, z + 0.037, {cast: false});
    box(g, 0.006, 0.004, 0.08, col, x - 0.037, 0.037, z, {cast: false}); box(g, 0.006, 0.004, 0.08, col, x + 0.037, 0.037, z, {cast: false});
    const h = mesh(g, new THREE.PlaneGeometry(0.068, 0.068), hole, x, 0.0357, z, {cast: false}); h.rotation.x = -Math.PI / 2;
    sockets.push(V(x, 0.0355 + BLOCK.h / 2 - 0.008, z));
  }
  // the model at the back of the base
  const mg = new THREE.Group(); mg.position.set(0, 0.035, -0.09); g.add(mg); MODELS[id](mg);
  mg.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  // the tilted label on the table in front of the base (left), the face-down card (right)
  const labelTex = hiTex(1024, 360, labelDraw(id, {k: 'closed'}));
  const lab = new THREE.Group(); lab.position.set(-0.1, 0, 0.33); g.add(lab);
  const wedge = box(lab, LABEL_W + 0.01, 0.06, 0.035, std(0xeeece7, 0.4), 0, 0.03, -0.012); wedge.rotation.x = -0.75;
  const face = mesh(lab, new THREE.PlaneGeometry(LABEL_W, LABEL_H), new THREE.MeshStandardMaterial({map: labelTex, color: 0xb9b5ad, roughness: 0.6}), 0, 0.048, 0.006, {cast: false});
  face.rotation.x = -0.75;
  const card = new THREE.Group(); card.position.set(0.19, 0.001, 0.33); g.add(card);
  const hinge = new THREE.Group(); hinge.position.set(0, 0, -0.05); card.add(hinge);    // the card turns about its back edge
  const cb = mesh(hinge, new THREE.PlaneGeometry(0.15, 0.1), new THREE.MeshStandardMaterial({map: cardBack(), color: 0xd0cbc2, roughness: 0.8}), 0, 0.0012, 0.05, {cast: false}); cb.rotation.x = -Math.PI / 2;
  const cf = mesh(hinge, new THREE.PlaneGeometry(0.15, 0.1), new THREE.MeshStandardMaterial({map: cardFront(id), color: PAPER, roughness: 0.7}), 0, 0.0008, 0.05, {cast: false}); cf.rotation.x = Math.PI / 2;
  box(hinge, 0.15, 0.0015, 0.1, std(0xe8e3d8, 0.8), 0, 0.001, 0.05, {cast: false});
  // the pennant (hidden until the allocation is confirmed)
  const pen = new THREE.Group(); pen.position.set(0.27, 0.035, -0.19); pen.visible = false; g.add(pen);
  box(pen, 0.004, 0.2, 0.004, std(0x2b2d30, 0.4), 0, 0.1, 0);
  const flag = mesh(pen, new THREE.PlaneGeometry(0.1, 0.05), new THREE.MeshStandardMaterial({color: 0xd6d2ca, roughness: 0.7, side: THREE.DoubleSide}), -0.05, 0.17, 0, {cast: false});
  // a red flash over the base (refused)
  const flash = mesh(g, boxG(0.63, 0.037, 0.47), new THREE.MeshBasicMaterial({color: 0xff3b30, transparent: true, opacity: 0, depthWrite: false}), 0, 0.0185, 0, {cast: false, recv: false});
  flash.visible = false; flash.renderOrder = 3;
  // the token card (appears in front of the base when funded; can be moved to the priority tray)
  const token = tokenCard(id); token.position.set(0, 0.0, 0.5); token.visible = false; g.add(token);
  const hitBox = new THREE.Mesh(boxG(0.66, 0.2, 0.62), new THREE.MeshBasicMaterial({visible: false})); hitBox.position.set(0, 0.1, 0.05); g.add(hitBox);
  TB.bases[id] = {id, g, slab, sockets, model: mg, labelTex, label: lab, card, hinge, pennant: pen, flag, flash, token, hit: hitBox, blocks: []};
  return g;
}
function tokenCard(id) {
  const g = new THREE.Group(); g.name = 'token_' + id;
  const t = hiTex(512, 300, (c, W, H) => {
    c.fillStyle = '#f7f5f0'; c.fillRect(0, 0, W, H); c.fillStyle = P[id].col; c.fillRect(0, 0, EN ? 26 : W, EN ? H : 0); c.fillRect(EN ? 0 : W - 26, 0, 26, H);
    txt(c, T(P[id].short), sx(W, 50), 130, {px: 50, w: 700, max: W - 90});
    txt(c, units(P[id].cost), sx(W, 50), 210, {px: 38, w: 500, col: '#555a61'});
  });
  box(g, 0.13, 0.003, 0.078, std(0xe8e3d8, 0.8), 0, 0.0015, 0, {cast: false});
  const f = mesh(g, new THREE.PlaneGeometry(0.125, 0.073), new THREE.MeshStandardMaterial({map: t, color: PAPER, roughness: 0.7}), 0, 0.0032, 0, {cast: false}); f.rotation.x = -Math.PI / 2;
  return g;
}
export const socketWorld = (id, j) => TB.bases[id].g.localToWorld(TB.bases[id].sockets[j].clone());
export const baseTop = (id) => TB.bases[id].g.localToWorld(V(0, 0.12, 0.1));
export const baseHot = (id) => TB.bases[id].g.localToWorld(V(0, 0.26, -0.05));
export const tokenHome = (id) => TB.bases[id].g.localToWorld(V(0, 0.002, 0.5));
/** the card flips over and stands tilted towards the player (k 0..1) */
export function setCardOpen(id, k) { TB.bases[id].hinge.rotation.x = -k * 1.95; TB.bases[id].hinge.position.y = k * 0.0; }
export function setPennant(id, k) {
  const b = TB.bases[id]; if (!k) { b.pennant.visible = false; return; }
  b.flag.material.map = pennantTex(id, k); b.flag.material.color.setHex(0xd6d2ca); b.flag.material.needsUpdate = true; b.pennant.visible = true;
}
const flashes = new Map();
export function flashBase(id) { const f = TB.bases[id].flash; f.visible = true; flashes.set(f, 0); }
onUpdate((dt) => { for (const [f, t] of flashes) { const nt = t + dt; flashes.set(f, nt); f.material.opacity = Math.max(0, Math.sin(Math.min(1, nt / 0.9) * Math.PI * 3)) * 0.45 * (1 - nt / 0.9); if (nt > 0.9) { f.visible = false; flashes.delete(f); } } });

// ---------------------------------------------------------------- the rack, the blocks, the strip, the ledger plate
function buildRack(R) {
  const g = new THREE.Group(); g.position.set(RACK.x, WT.y, RACK.z); g.name = 'rack'; R.add(g);
  const wood = pbr('walnut_veneer', [0.5, 0.5], {roughness: 0.5});
  box(g, 0.8, 0.028, 0.12, wood, 0, 0.014, 0);
  const pockets = [];
  for (let i = 0; i < CAP; i++) {
    const x = (i - 3.5) * RACK.pitch;
    const h = mesh(g, new THREE.PlaneGeometry(0.078, 0.078), std(0x1d1a17, 0.9), x, 0.0283, 0, {cast: false}); h.rotation.x = -Math.PI / 2;
    pockets.push(V(x, 0.0283 + BLOCK.h / 2 - 0.01, 0));
  }
  // the strip under the pockets (towards the player), tilted
  const stripTex = hiTex(2048, 112, () => {});
  const st = mesh(g, new THREE.PlaneGeometry(0.76, 0.0416), new THREE.MeshStandardMaterial({map: stripTex, color: 0xc4c0b8, roughness: 0.6}), 0, 0.022, 0.07, {cast: false});
  st.rotation.x = -1.0;
  box(g, 0.8, 0.026, 0.01, wood, 0, 0.01, 0.058).rotation.x = -0.6;
  TB.rack = {g, pockets, stripTex};
  for (let i = 0; i < CAP; i++) { const b = makeBlock(i); b.name = 'block' + i; b.userData = {i, at: 'rack', slot: i}; b.position.copy(pockets[i]); g.add(b); TB.blocks.push(b); }
  drawStrip(Array(CAP).fill(null));
  // the ledger plate on a wedge in front of the rack
  const lt = hiTex(2048, 512, () => {});
  // the plate leans back on a dark stand: its lower edge on the table, the face towards the player
  const lg = new THREE.Group(); lg.position.set(RACK.x, WT.y + 0.004, RACK.z + 0.25); lg.rotation.x = -1.02; R.add(lg);
  box(lg, 0.645, 0.165, 0.016, std(0x2b2d30, 0.45), 0, 0.0825, -0.009);
  mesh(lg, new THREE.PlaneGeometry(0.62, 0.155), new THREE.MeshStandardMaterial({map: lt, color: 0xb9b5ad, roughness: 0.6}), 0, 0.0825, 0.0005, {cast: false});
  TB.ledger = {g: lg, tex: lt};
  drawLedger({funded: []});
}
export const pocketWorld = (i) => TB.rack.g.localToWorld(TB.rack.pockets[i].clone());
/** owners: 8 entries, null (free) or a proposal id */
export function drawStrip(owners) {
  redraw(TB.rack.stripTex, (c, W, H) => {
    c.fillStyle = '#f3f0ea'; c.fillRect(0, 0, W, H);
    const cw = W / CAP;
    for (let i = 0; i < CAP; i++) {
      const o = owners[i], x = i * cw;
      if (o) { c.fillStyle = P[o].col; c.fillRect(x + 4, 6, cw - 8, H - 12); }
      c.fillStyle = '#c9c4ba'; if (i) c.fillRect(x - 1, 8, 2, H - 16);
      txt(c, o ? T(P[o].short) : tr('حرّ', 'free'), x + cw / 2, H * 0.66, {px: 34, w: o ? 700 : 500, col: o ? '#fff' : '#6b6f75', align: 'center', max: cw - 16});
    }
  });
}
/** the ledger plate: "Used 4 of 8 · Free 4", the items, and the refusal line when there is one */
export function drawLedger({funded, refusal = null}) {
  redraw(TB.ledger.tex, (c, W, H) => {
    c.fillStyle = '#f5f3ee'; c.fillRect(0, 0, W, H);
    const u = funded.reduce((s, id) => s + P[id].cost, 0);
    txt(c, EN ? `Used ${u} of 8 · Free ${8 - u}` : `مستخدم ${u} من 8 · حرّ ${8 - u}`, sx(W, 60), 130, {px: 96, w: 800, col: '#101214'});
    // eight segments in reading order
    const sw = (W - 120) / 8; let k = 0;
    for (const id of funded) for (let j = 0; j < P[id].cost; j++, k++) { const x = EN ? 60 + k * sw : W - 60 - (k + 1) * sw; c.fillStyle = P[id].col; c.fillRect(x + 4, 170, sw - 8, 70); }
    for (; k < 8; k++) { const x = EN ? 60 + k * sw : W - 60 - (k + 1) * sw; c.strokeStyle = '#7d786e'; c.lineWidth = 6; c.strokeRect(x + 6, 172, sw - 12, 66); }
    const items = funded.map(id => `${T(P[id].short)} (${P[id].cost})`).join(tr('  ·  ', '  ·  '));
    txt(c, items || tr('لا شيء مموّل بعد', 'Nothing funded yet'), sx(W, 60), 330, {px: 62, w: 700, col: '#16181b', max: W - 120});
    if (refusal) txt(c, refusal, sx(W, 60), 440, {px: 54, w: 700, col: '#b3261e', max: W - 120});
  });
}

// ---------------------------------------------------------------- the retailer note and the two stamps
export const NOTE_HOME = V(WT.x + 0.66, WT.y + 0.0015, WT.z + 0.3);
function noteDraw(tag) {
  return (c, W, H) => {
    c.fillStyle = '#f8f6f1'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 1500; i++) { c.fillStyle = `rgba(0,0,0,${Math.random() * 0.03})`; c.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
    c.fillStyle = '#2f3237'; c.fillRect(0, 0, W, 16);
    txt(c, tr('تقرير التاجر', 'Retailer report'), sx(W, 70), 130, {px: 74, w: 700});
    txt(c, tr('المخزون والطلب · تقرير توضيحي', 'Stock and demand · Illustrative report'), sx(W, 70), 200, {px: 42, w: 500, col: '#5b5f66'});
    c.fillStyle = '#d5d0c6'; c.fillRect(70, 236, W - 140, 3);
    const body = tr('يُباع الخط الأساسي بثبات، وطلبات إعادة الشراء متكررة. في 11 من 40 فحصًا للرف كان الرف فارغًا. يسأل العملاء الموظفين عنه بالاسم.',
      'The core line sells steadily and reorders are frequent. In 11 of 40 shelf checks the shelf was empty. Customers ask staff for it by name.');
    let y = wrap(c, body, sx(W, 70), 320, W - 140, 66, {px: 46, w: 500, col: '#25282c'});
    y = wrap(c, tr('الطلب: توريد منتظم لهذا الخط.', 'Request: regular delivery of this line.'), sx(W, 70), y + 30, W - 140, 66, {px: 46, w: 700, col: '#25282c'});
    if (tag) {
      const ok = tag === 'current', col = ok ? '#1f7a3f' : '#b3261e';
      c.save(); c.translate(W / 2, H - 230); c.rotate(-0.06);
      c.strokeStyle = col; c.lineWidth = 12; c.strokeRect(-W * 0.4, -90, W * 0.8, 180); c.lineWidth = 4; c.strokeRect(-W * 0.4 + 16, -74, W * 0.8 - 32, 148);
      txt(c, ok ? tr('طلب عملاء حالي', 'Current customer demand') : tr('طلب غير مُختبَر', 'Untested demand'), 0, 24, {px: 62, w: 800, col, align: 'center', max: W * 0.72});
      c.restore();
    }
  };
}
export function drawNote(tag) { redraw(TB.note.tex, noteDraw(tag)); }
function buildNote(R) {
  const tex = hiTex(1024, 1400, noteDraw(null));
  const g = new THREE.Group(); g.name = 'note';
  const m = mesh(g, new THREE.PlaneGeometry(0.15, 0.205), new THREE.MeshStandardMaterial({map: tex, color: PAPER, roughness: 0.85, side: THREE.DoubleSide}), 0, 0, 0, {cast: true});
  m.rotation.x = -Math.PI / 2;
  g.position.copy(NOTE_HOME); g.rotation.y = 0.06; R.add(g);
  TB.note = {g, mesh: m, tex};
  for (const [k, dx, col] of [['current', 0.27, 0x1f7a3f], ['untested', 0.4, 0xb3261e]]) {
    const s = new THREE.Group(); s.position.set(WT.x + 0.66 + dx, WT.y, WT.z + 0.3); s.name = 'stamp_' + k; R.add(s);
    box(s, 0.07, 0.022, 0.045, std(col, 0.5), 0, 0.011, 0);
    box(s, 0.058, 0.03, 0.034, std(0x6b4a2e, 0.6), 0, 0.037, 0);
    mesh(s, new THREE.CylinderGeometry(0.008, 0.012, 0.05, 14), std(0x6b4a2e, 0.55), 0, 0.075, 0);
    mesh(s, new THREE.SphereGeometry(0.022, 16, 12), std(0x2b2018, 0.5), 0, 0.105, 0);
    const lt = hiTex(512, 200, (c, W, H) => { c.fillStyle = '#f4f1ea'; c.fillRect(0, 0, W, H); c.fillStyle = k === 'current' ? '#1f7a3f' : '#b3261e'; c.fillRect(0, 0, W, 14); txt(c, k === 'current' ? tr('طلب عملاء حالي', 'Current customer demand') : tr('طلب غير مُختبَر', 'Untested demand'), W / 2, 128, {px: 52, w: 700, align: 'center', max: W - 30}); });
    const lab = mesh(s, new THREE.PlaneGeometry(0.068, 0.026), new THREE.MeshStandardMaterial({map: lt, color: 0xcfcbc3, roughness: 0.6}), 0, 0.024, 0.0231, {cast: false});
    TB.stamps[k] = {g: s, home: s.position.clone(), col};
  }
}

// ---------------------------------------------------------------- the need-chip dish and the priority tray
export const DISH = V(WT.x - 0.54, WT.y, WT.z + 0.3);
export const TRAY = V(WT.x - 0.87, WT.y, WT.z + 0.33);
const CHIP_OFF = {core: [0.025, -0.025], delivery: [-0.025, -0.025], theme: [0.025, 0.025], venue: [-0.025, 0.025]};
export const chipHome = (id) => V(DISH.x + CHIP_OFF[id][0] * (EN ? -1 : 1), DISH.y + 0.016, DISH.z + CHIP_OFF[id][1]);
export const chipOnBase = (id) => TB.bases[id].g.localToWorld(V(-0.24, 0.042, -0.17));
function buildDish(R) {
  const d = new THREE.Group(); d.position.copy(DISH); R.add(d);
  const pts = [V(0, 0, 0), V(0.075, 0, 0), V(0.082, 0.004, 0), V(0.086, 0.016, 0), V(0.08, 0.017, 0), V(0.07, 0.006, 0), V(0, 0.006, 0)].map(p => new THREE.Vector2(p.x, p.y));
  mesh(d, new THREE.LatheGeometry(pts, 40), std(0xe9e6df, 0.25), 0, 0, 0);
  TB.dish = d;
  for (const id of Object.keys(P)) {
    const c = new THREE.Group(); c.name = 'chip_' + id;
    const t = hiTex(256, 256, (g, W, H) => { g.fillStyle = P[id].col; g.fillRect(0, 0, W, H); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 16; g.beginPath(); g.arc(W / 2, H / 2, W * 0.36, 0, 7); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.arc(W / 2, H / 2, W * 0.1, 0, 7); g.fill(); });
    const mats = [std(P[id].hex, 0.45), new THREE.MeshStandardMaterial({map: t, roughness: 0.45}), std(P[id].hex, 0.45)];
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.008, 28), mats); m.castShadow = true; m.receiveShadow = true; m.position.y = 0.004; c.add(m);
    c.position.copy(chipHome(id)); R.add(c); TB.chips[id] = c;
  }
}
export function setChipDim(id, on) { const m = TB.chips[id].children[0]; for (const mt of m.material) { mt.transparent = on; mt.opacity = on ? 0.35 : 1; mt.needsUpdate = true; } }
export const slotWorld = (k) => V(TRAY.x + (k === 'first' ? 1 : -1) * (EN ? -1 : 1) * 0.085, TRAY.y + 0.012, TRAY.z);
function buildTray(R) {
  const g = new THREE.Group(); g.position.copy(TRAY); R.add(g);
  const wood = pbr('walnut_veneer', [0.5, 0.5], {roughness: 0.5});
  box(g, 0.36, 0.01, 0.14, wood, 0, 0.005, 0);
  for (const s of [-1, 1]) { box(g, 0.36, 0.016, 0.008, wood, 0, 0.012, s * 0.066); box(g, 0.008, 0.016, 0.14, wood, s * 0.176, 0.012, 0); }
  box(g, 0.006, 0.014, 0.13, wood, 0, 0.011, 0);
  const t = hiTex(1024, 128, (c, W, H) => {
    c.fillStyle = '#e9e2d4'; c.fillRect(0, 0, W, H);
    // First is on the side where reading starts: right in Arabic, left in English
    txt(c, EN ? 'First' : 'الأول', EN ? W * 0.25 : W * 0.75, 88, {px: 64, w: 700, align: 'center', col: '#2b2d31'});
    txt(c, EN ? 'Next' : 'التالي', EN ? W * 0.75 : W * 0.25, 88, {px: 64, w: 600, align: 'center', col: '#55595f'});
  });
  const lab = mesh(g, new THREE.PlaneGeometry(0.34, 0.0425), new THREE.MeshStandardMaterial({map: t, color: 0xcfcbc3, roughness: 0.6}), 0, 0.0106, 0.074, {cast: false});
  lab.rotation.x = -Math.PI / 2 + 0.25;
  TB.tray = g;
}

// ---------------------------------------------------------------- the review table: pitch board, condition holder + cards, clip, commit stamp
export const BOARD = V(RT.x - 0.98, RT.y, RT.z - 0.02);
export const HOLDER = V(RT.x - 1.0, RT.y, RT.z + 0.4);
export const COMMIT = V(RT.x - 1.06, RT.y, RT.z - 0.36);
const BOARD_TILT = 0.62;
function boardDraw(a, {committed = false, red = false, practice = false} = {}) {
  return (c, W, H) => {
    c.fillStyle = '#f7f5f0'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#2b2d31'; c.fillRect(0, 0, W, 20);
    txt(c, tr('ملخص التحوّل بقرارين', 'Two-decision turnaround brief'), sx(W, 70), 120, {px: 72, w: 700});
    if (practice) txt(c, tr('محاولة تدريب', 'Practice attempt'), EN ? W - 70 : 70, 120, {px: 40, w: 600, col: '#8a6d1f', align: 'end'});
    const n = (id) => id ? `${T(P[id].short)} (${P[id].cost})` : '…';
    const row = (label, val, y, o = {}) => { txt(c, label, sx(W, 70), y, {px: 46, w: 700, col: o.lc || '#55595f'}); txt(c, val, sx(W, 360), y, {px: 50, w: 600, col: o.col || '#1f2124', max: W - 430}); };
    c.fillStyle = '#d8d3c9'; c.fillRect(70, 160, W - 140, 3);
    row(tr('1 · الأول', '1 · First'), n(a.first), 250);
    row(tr('التالي', 'Next'), a.funded.length > 1 ? n(a.next) : tr('— (مقترح واحد)', '— (one proposal)'), 340);
    const waits = Object.keys(P).filter(id => !a.funded.includes(id));
    row(tr('2 · ينتظر', '2 · Waits'), a.need ? `${T(P[a.need].need)} — ${waits.map(id => T(P[id].short)).join('، ')}` : waits.map(id => T(P[id].short)).join(tr('، ', ', ')), 450);
    c.fillStyle = '#d8d3c9'; c.fillRect(70, 510, W - 140, 3);
    txt(c, tr('شرط المراجعة', 'Review condition'), sx(W, 70), 590, {px: 46, w: 700, col: '#55595f'});
    if ((red || a.condRed) && !a.cond) txt(c, tr('تغيّر المقترح الأول: اختر شرطًا جديدًا', 'The first proposal changed: pick a new condition'), sx(W, 70), 680, {px: 48, w: 700, col: '#b3261e', max: W - 140});
    else wrap(c, a.cond ? condText(a.cond) : '…', sx(W, 70), 680, W - 140, 64, {px: 48, w: 600});
    if (committed) {
      c.save(); c.translate(W * 0.68, H * 0.82); c.rotate(-0.12);
      c.strokeStyle = '#2350a8'; c.lineWidth = 14; c.strokeRect(-260, -80, 520, 160); c.lineWidth = 5; c.strokeRect(-244, -64, 488, 128);
      txt(c, tr('مُلتزَم به', 'Committed'), 0, 28, {px: 84, w: 800, col: '#2350a8', align: 'center'});
      c.restore();
    }
  };
}
export function drawBoard(a, o) { redraw(TB.board.tex, boardDraw(a, o)); }
function condCardTex(i) {
  const k = CONDS[i];
  return hiTex(400, 560, (c, W, H) => {
    c.fillStyle = k.k === 'distractor' ? '#f4efe4' : '#f7f5f0'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#2b2d31'; c.font = `800 120px ${FE}`; c.textAlign = 'center'; c.direction = 'ltr'; c.fillText(String(i + 1), W / 2, 140);
    c.fillStyle = '#d0cbc1'; c.fillRect(30, 170, W - 60, 3);
    wrap(c, T(k.t), sx(W, 30), 236, W - 60, 46, {px: 34, w: 600, col: '#25282c'});
  });
}
// cards stand in the holder facing the player (−x); along z in reading order (Arabic: card 1 on the right, +z)
export const cardSlot = (i) => V(HOLDER.x, HOLDER.y + 0.06, HOLDER.z + (i - 2) * 0.062 * (EN ? 1 : -1));
function buildReview(R) {
  // the board on a low easel, tilted up towards the player's seat (the player faces +x)
  const g = new THREE.Group(); g.position.copy(BOARD); g.rotation.y = -Math.PI / 2; R.add(g);   // local −z = world +x (away from the player)
  const tilt = new THREE.Group(); tilt.position.set(0, 0.012, 0.11); tilt.rotation.x = -(Math.PI / 2 - BOARD_TILT); g.add(tilt);
  box(g, 0.44, 0.012, 0.05, std(0x2b2d30, 0.5), 0, 0.006, 0.11);
  const tex = hiTex(1600, 1140, boardDraw({funded: [], first: null, next: null, need: null, cond: null}));
  box(tilt, 0.44, 0.31, 0.008, std(0x3a3c40, 0.5), 0, 0.155, -0.005);
  mesh(tilt, new THREE.PlaneGeometry(0.42, 0.299), new THREE.MeshStandardMaterial({map: tex, color: 0xcfcbc3, roughness: 0.6}), 0, 0.155, 0.0002, {cast: false});
  TB.board = {g: tilt, root: g, tex};
  // the clip on the board's top edge (the far edge), beside the "First" line
  const clip = new THREE.Group(); clip.position.set(EN ? -0.13 : 0.13, 0.31, 0.004); tilt.add(clip);
  const steel = std(0x9aa0a6, 0.25, {metalness: 0.9});
  box(clip, 0.05, 0.03, 0.006, std(0x1f2023, 0.4), 0, 0, 0.006);
  const jaw = new THREE.Group(); jaw.position.set(0, 0.015, 0.009); clip.add(jaw);
  const j1 = box(jaw, 0.05, 0.028, 0.004, std(0x1f2023, 0.4), 0, -0.014, 0.002);
  for (const s of [-1, 1]) { const w = mesh(clip, new THREE.TorusGeometry(0.009, 0.0016, 6, 14, Math.PI), steel, s * 0.016, 0.022, 0.012); w.rotation.y = Math.PI / 2; }
  TB.clip = {g: clip, jaw};
  // the holder: a wooden block with five slots
  const h = new THREE.Group(); h.position.copy(HOLDER); R.add(h);
  const wood = pbr('oak_veneer_01', [0.5, 0.5], {roughness: 0.5});
  box(h, 0.08, 0.035, 0.34, wood, 0, 0.0175, 0);
  TB.holder = h;
  for (let i = 0; i < 5; i++) {
    const cg = new THREE.Group(); cg.name = 'cond' + i;
    const cm = mesh(cg, new THREE.PlaneGeometry(0.056, 0.078), new THREE.MeshStandardMaterial({map: condCardTex(i), color: PAPER, roughness: 0.7, side: THREE.DoubleSide}), 0, 0, 0, {cast: true});
    cg.position.copy(cardSlot(i)); cg.rotation.y = -Math.PI / 2; cg.rotation.x = 0; cg.userData = {i, k: CONDS[i].k, home: cardSlot(i)};
    R.add(cg); TB.cards.push(cg);
  }
  // the "Commit the pitch" stamp
  const s = new THREE.Group(); s.position.copy(COMMIT); R.add(s);
  box(s, 0.085, 0.024, 0.055, std(0x2350a8, 0.5), 0, 0.012, 0);
  box(s, 0.07, 0.03, 0.042, std(0x6b4a2e, 0.6), 0, 0.039, 0);
  mesh(s, new THREE.CylinderGeometry(0.009, 0.013, 0.055, 14), std(0x6b4a2e, 0.55), 0, 0.08, 0);
  mesh(s, new THREE.SphereGeometry(0.024, 16, 12), std(0x2b2018, 0.5), 0, 0.112, 0);
  const lt = hiTex(512, 200, (c, W, H) => { c.fillStyle = '#f4f1ea'; c.fillRect(0, 0, W, H); c.fillStyle = '#2350a8'; c.fillRect(0, 0, W, 14); txt(c, tr('اعتمد العرض', 'Commit the pitch'), W / 2, 128, {px: 56, w: 700, align: 'center', max: W - 30}); });
  const lab = mesh(s, new THREE.PlaneGeometry(0.082, 0.032), new THREE.MeshStandardMaterial({map: lt, color: 0xcfcbc3, roughness: 0.6}), -0.0281, 0.026, 0, {cast: false}); lab.rotation.y = -Math.PI / 2;
  TB.commit = {g: s, home: s.position.clone()};
}
/** where a clipped card stands: in the clip, upright over the board's top edge */
export function clippedPose() {
  const p = TB.clip.g.localToWorld(V(0, -0.01, 0.012));
  return p;
}
export function setClip(open) { TB.clip.jaw.rotation.x = open ? -0.6 : 0; }

// ---------------------------------------------------------------- build
export function buildTable(scene) {
  const R = new THREE.Group(); R.name = 'tableprops'; scene.add(R);
  for (const id of ROW) R.add(buildBase(id));
  buildRack(R); buildNote(R); buildDish(R); buildTray(R); buildReview(R);
  TB.root = R;
  return R;
}
