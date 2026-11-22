// The café as it would have looked in 2002–2003 (the time of the case): cherry-stained raised-panel cabinetry under a
// polished tan-brown granite top; a curved-glass bakery case built into the counter; a register of the period (cash
// drawer, a small cashier screen, a green vacuum-fluorescent pole display for the customer, a receipt printer, a card
// swipe reader) and a tip jar; a stainless reach-in fridge behind the bar with gallon milk jugs and cartons on wire
// shelves; a printed menu board in a wooden frame with small / medium / large prices of the time; and a chalkboard of
// the day's offers on the wall by the line.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {model} from '../core/assets.js';
import {pbr, canvasTex} from './materials.js';
import {fit} from './cafeprops.js';
const EN = new URLSearchParams(location.search).get('lang') === 'en';
const SANS = EN ? 'Inter, "IBM Plex Sans Arabic", sans-serif' : '"IBM Plex Sans Arabic", Inter, sans-serif';
const SERIF = EN ? 'Georgia, "Times New Roman", serif' : '"Noto Naskh Arabic", "IBM Plex Sans Arabic", serif';

let MAT = null;
function mats() {
  if (MAT) return MAT;
  // Tan Brown granite (the counter top of the time): a dark brown ground, black and tan grains in clusters, rust flecks
  const granite = canvasTex(2048, 2048, (g, w, h) => {
    // fine, dense grains: dark ground, black crystals, tan and rust feldspar, a little quartz; slightly clustered
    g.fillStyle = '#3a2820'; g.fillRect(0, 0, w, h);
    const grain = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); const n = 5 + (Math.random() * 3 | 0); for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2, rr = r * (0.55 + Math.random() * 0.6); k ? g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); };
    const cluster = (count, rMin, rMax, col) => { for (let i = 0; i < count; i++) { const cx = Math.random() * w, cy = Math.random() * h, m = 2 + (Math.random() * 6 | 0); for (let k = 0; k < m; k++) grain(cx + (Math.random() - 0.5) * 18, cy + (Math.random() - 0.5) * 18, rMin + Math.random() * (rMax - rMin), col()); } };
    cluster(9000, 1.5, 4.5, () => `rgba(${12 + Math.random() * 14},${9 + Math.random() * 10},${8 + Math.random() * 8},${0.75 + Math.random() * 0.25})`);
    cluster(5200, 1.2, 3.8, () => `rgba(${120 + Math.random() * 50},${78 + Math.random() * 35},${48 + Math.random() * 25},${0.6 + Math.random() * 0.35})`);
    cluster(1600, 1.0, 2.6, () => `rgba(${110 + Math.random() * 30},${52 + Math.random() * 18},${30 + Math.random() * 12},0.7)`);
    for (let i = 0; i < 14000; i++) { g.fillStyle = `rgba(225,215,200,${Math.random() * 0.3})`; g.fillRect(Math.random() * w, Math.random() * h, 1.2, 1.2); }
  });
  granite.wrapS = granite.wrapT = THREE.RepeatWrapping;
  const vfd = canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = '#061008'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#5cffa0'; g.shadowColor = '#5cffa0'; g.shadowBlur = 14; g.font = '600 56px "Courier New", monospace'; g.textBaseline = 'middle';
    g.textAlign = 'left'; g.fillText('TOTAL', 26, h / 2 + 2); g.textAlign = 'right'; g.fillText('$3.35', w - 26, h / 2 + 2);
  });
  const lcd = canvasTex(256, 192, (g, w, h) => {
    g.fillStyle = '#9fb59a'; g.fillRect(0, 0, w, h); g.fillStyle = '#223322'; g.font = '600 20px "Courier New", monospace';
    ['1 M LATTE      3.05', '  EXTRA SHOT    .55', '', 'SUBTOTAL      3.60', 'TAX            .29', 'TOTAL         3.89'].forEach((t, i) => g.fillText(t, 12, 30 + i * 26));
  });
  MAT = {
    granite: new THREE.MeshPhysicalMaterial({map: granite, roughness: 0.14, clearcoat: 0.9, clearcoatRoughness: 0.06}),
    cherry: pbr('walnut_veneer', [0.6, 0.6], {roughness: 0.42, color: 0xc77b52}),
    cherryDark: pbr('walnut_veneer', [0.6, 0.6], {roughness: 0.5, color: 0x8a4f33}),
    plinth: new THREE.MeshStandardMaterial({color: 0x161312, roughness: 0.6}),
    steel: new THREE.MeshStandardMaterial({color: 0xd6d9dc, roughness: 0.2, metalness: 1}),
    brushed: new THREE.MeshStandardMaterial({color: 0xbcc0c4, roughness: 0.42, metalness: 1}),
    black: new THREE.MeshStandardMaterial({color: 0x1b1c1e, roughness: 0.45, metalness: 0.15}),
    grey: new THREE.MeshStandardMaterial({color: 0x4a4d50, roughness: 0.5, metalness: 0.2}),
    beige: new THREE.MeshStandardMaterial({color: 0xcfc8b8, roughness: 0.6}),
    glass: new THREE.MeshPhysicalMaterial({color: 0xf2fafb, roughness: 0.03, transparent: true, opacity: 0.15, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.7}),
    led: new THREE.MeshStandardMaterial({color: 0xfff1d8, emissive: 0xffdca8, emissiveIntensity: 2.0}),
    vfd: new THREE.MeshStandardMaterial({map: vfd, emissive: 0xffffff, emissiveMap: vfd, emissiveIntensity: 1.1, roughness: 0.3}),
    lcd: new THREE.MeshStandardMaterial({map: lcd, emissive: 0x9fb59a, emissiveMap: lcd, emissiveIntensity: 0.35, roughness: 0.4}),
    jug: new THREE.MeshPhysicalMaterial({color: 0xfafaf6, roughness: 0.35, transparent: true, opacity: 0.92, clearcoat: 0.3}),
    paper: new THREE.MeshStandardMaterial({color: 0xfbfaf6, roughness: 0.8}),
  };
  return MAT;
}
export const graniteMaterial = () => mats().granite;
export const cherryMaterial = () => mats().cherryDark;
function mesh(parent, geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; }
const B = (w, h, d, x = 0, y = 0, z = 0) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; };
const merged = (parent, parts, mat) => { const m = new THREE.Mesh(mergeGeometries(parts), mat); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };

// ---------------------------------------------------------------- the counter: raised-panel cabinetry, granite top
export function buildCounter2002(R, {x0, x1, zb, zf}) {
  const M = mats(), L = x1 - x0, D = zf - zb, cx = (x0 + x1) / 2, cz = (zb + zf) / 2;
  mesh(R, B(L, 0.86, D - 0.05), M.cherryDark, cx, 0.53, cz - 0.025);                    // carcass
  mesh(R, B(L - 0.02, 0.1, D - 0.1), M.plinth, cx, 0.05, cz - 0.06);                     // toe kick
  // the front, in bays of about 60 cm: stiles and rails proud of the carcass, a sunk panel and its raised field
  const frame = [], field = [], n = Math.max(1, Math.round(L / 0.6)), bw = L / n, fz = zf - 0.025;
  for (let i = 0; i <= n; i++) frame.push(B(0.07, 0.86, 0.03, x0 + i * bw, 0.53, fz));
  for (let i = 0; i < n; i++) {
    const bx = x0 + (i + 0.5) * bw;
    frame.push(B(bw, 0.09, 0.03, bx, 0.915, fz), B(bw, 0.1, 0.03, bx, 0.15, fz));
    field.push(B(bw - 0.07 - 0.06, 0.58, 0.018, bx, 0.535, fz + 0.004), B(bw - 0.07 - 0.15, 0.49, 0.014, bx, 0.535, fz + 0.014));
  }
  // the two ends: one framed panel each
  for (const [ex, s] of [[x0, -1], [x1, 1]]) {
    frame.push(B(0.03, 0.86, 0.07, ex + s * 0.015, 0.53, zb + 0.035), B(0.03, 0.86, 0.07, ex + s * 0.015, 0.53, zf - 0.035), B(0.03, 0.09, D, ex + s * 0.015, 0.915, cz), B(0.03, 0.1, D, ex + s * 0.015, 0.15, cz));
    field.push(B(0.02, 0.58, D - 0.2, ex + s * 0.02, 0.535, cz));
  }
  merged(R, frame, M.cherry); merged(R, field, M.cherry);
  mesh(R, B(L + 0.05, 0.035, 0.045), M.cherryDark, cx, 0.975, zf - 0.005);               // the moulding under the top
  const top = new RoundedBoxGeometry(L + 0.07, 0.032, D + 0.06, 2, 0.008);
  const uv = top.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (L + 0.07) / 1.1, uv.getY(i) * (D + 0.06) / 1.1);
  mesh(R, top, M.granite, cx, 1.034, cz + 0.01);
}

// ---------------------------------------------------------------- the bakery case: curved front glass, set into the counter
function ribbon(pts, xa, xb, mat) {                    // a strip through (z, y) points, from x = xa to xb
  const pos = [], idx = [];
  pts.forEach(([z, y], i) => { pos.push(xa, y, z, xb, y, z); if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); } });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}
export async function bakeryCase(R, {xa, xb, zf, zb, y}) {
  const M = mats(), g = new THREE.Group(); R.add(g);
  const r = 0.3, base = 0.04, yb = y + base, len = xb - xa, cx = (xa + xb) / 2;
  mesh(g, B(len, base, zf - zb), M.brushed, cx, y + base / 2, (zf + zb) / 2);
  const arc = []; for (let i = 0; i <= 16; i++) { const a = i / 16 * Math.PI / 2; arc.push([zf - r + r * Math.cos(a), yb + r * Math.sin(a)]); }
  g.add(ribbon(arc, xa + 0.01, xb - 0.01, M.glass));
  const topY = yb + r, topZ = zf - r;
  g.add(ribbon([[topZ, topY], [zb, topY]], xa + 0.01, xb - 0.01, M.glass));                     // the flat top
  g.add(ribbon([[zb, yb], [zb, topY]], xa + 0.01, xb - 0.01, M.glass));                         // the sliding doors (staff side)
  // the glass ends: the quarter round and the straight back
  const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(r, 0); sh.absarc(0, 0, r, 0, Math.PI / 2, false); sh.lineTo(-(topZ - zb), r); sh.lineTo(-(topZ - zb), 0); sh.lineTo(0, 0);
  for (const ex of [xa, xb]) { const e = new THREE.Mesh(new THREE.ShapeGeometry(sh, 12), M.glass); e.rotation.y = Math.PI / 2; e.position.set(ex, yb, topZ); g.add(e); }
  // steel edges: the curve's two ends, the top front edge, the back frame
  for (const ex of [xa, xb]) { const curve = new THREE.CatmullRomCurve3(arc.map(([z, yy]) => new THREE.Vector3(ex, yy, z))); g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.006, 6), M.steel)); }
  mesh(g, B(len, 0.012, 0.012), M.steel, cx, topY, topZ); mesh(g, B(len, 0.02, 0.02), M.steel, cx, topY, zb);
  mesh(g, B(len - 0.04, 0.008, 0.012), M.led, cx, topY - 0.01, topZ - 0.03);
  const shelfY = yb + 0.15;
  mesh(g, B(len - 0.04, 0.006, zf - zb - 0.18), M.glass, cx, shelfY, (zb + zf) / 2 - 0.08);
  const light = new THREE.PointLight(0xffe0b0, 0.4, 1.2, 2); light.position.set(cx, topY - 0.05, (zb + zf) / 2); g.add(light);
  // muffins and scones on the deck, cake slices on the shelf, each on a doily
  const doily = new THREE.MeshStandardMaterial({color: 0xf8f4ec, roughness: 0.9});
  try {
    const [c1, c2, ck] = await Promise.all([model('cupcake1'), model('cupcake2'), model('cake_piece')]);
    const put = (src, size, px, py, pz, ry) => { mesh(g, new THREE.CylinderGeometry(0.055, 0.055, 0.002, 18), doily, px, py + 0.001, pz); const o = fit(src.clone(true), size); o.position.set(px, py + 0.002, pz); o.rotation.y = ry; g.add(o); };
    const k = Math.max(3, Math.floor(len / 0.17));
    for (let i = 0; i < k; i++) put(i % 2 ? c1 : c2, 0.075, xa + 0.1 + i * (len - 0.2) / (k - 1), yb + 0.002, zf - 0.17, i * 1.3);
    for (let i = 0; i < k - 1; i++) put(ck, 0.06, xa + 0.14 + i * (len - 0.28) / Math.max(1, k - 2), shelfY + 0.004, (zb + zf) / 2 - 0.12, 0.5 + i * 0.7);
  } catch (e) { console.warn('pastries', e); }
  g.traverse(o => { if (o.isMesh) o.castShadow = o.material !== M.glass; });
  return g;
}

// ---------------------------------------------------------------- the register of the time, at x, y (counter top), z
// The cashier stands on the −z side; the customer on +z.
export function register2002(R, x, y, z) {
  const M = mats(), g = new THREE.Group(); g.position.set(x, y, z); R.add(g);
  mesh(g, B(0.44, 0.11, 0.42, 0, 0.055, 0), M.black);                                       // the cash drawer
  mesh(g, B(0.4, 0.004, 0.02, 0, 0.06, -0.211), M.grey);                                     // its seam
  const body = mesh(g, B(0.38, 0.07, 0.24, 0, 0.145, -0.05), M.black); body.rotation.x = -0.18;   // the keyboard, sloped towards the cashier
  const keys = []; for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) keys.push(B(0.03, 0.012, 0.03, -0.13 + c * 0.037, 0, -0.14 + r * 0.04));
  const km = new THREE.Mesh(mergeGeometries(keys), M.beige); km.position.set(0, 0.19, 0); km.rotation.x = -0.18; g.add(km);
  mesh(g, B(0.05, 0.1, 0.05, 0, 0.23, 0.08), M.black);                                       // the neck of the cashier's screen
  const sc = new THREE.Group(); sc.position.set(0, 0.32, 0.08); sc.rotation.x = 0.3; g.add(sc);
  mesh(sc, B(0.24, 0.17, 0.05), M.black); mesh(sc, new THREE.PlaneGeometry(0.2, 0.135), M.lcd, 0, 0, -0.026).rotation.y = Math.PI;
  // the customer's pole display, green digits, and the receipt printer
  mesh(g, new THREE.CylinderGeometry(0.012, 0.012, 0.28, 10), M.grey, 0.16, 0.25, 0.14);
  const pd = new THREE.Group(); pd.position.set(0.16, 0.42, 0.14); g.add(pd);
  mesh(pd, B(0.2, 0.06, 0.05), M.black); mesh(pd, new THREE.PlaneGeometry(0.18, 0.045), M.vfd, 0, 0, 0.026);
  mesh(g, B(0.15, 0.13, 0.19, -0.3, 0.065, -0.02), M.beige);
  mesh(g, B(0.08, 0.002, 0.05, -0.3, 0.131, 0.07), M.paper).rotation.x = -0.6;
  // the card swipe reader, customer side
  const sw = new THREE.Group(); sw.position.set(0.36, 0, 0.17); sw.rotation.y = -0.3; g.add(sw);
  mesh(sw, B(0.09, 0.05, 0.14, 0, 0.025, 0), M.grey); mesh(sw, B(0.004, 0.02, 0.12, 0.03, 0.06, 0), M.black); mesh(sw, B(0.07, 0.012, 0.06, -0.008, 0.052, 0.03), M.beige);
  return g;
}
/** a glass tip jar with a few folded notes and coins */
export function tipJar(R, x, y, z) {
  const M = mats(), g = new THREE.Group(); g.position.set(x, y, z); R.add(g);
  const P = (a, b) => new THREE.Vector2(a, b);
  g.add(new THREE.Mesh(new THREE.LatheGeometry([P(0, 0.003), P(0.05, 0), P(0.055, 0.01), P(0.055, 0.13), P(0.046, 0.15), P(0.046, 0.16)], 24), M.glass));
  const note = new THREE.MeshStandardMaterial({color: 0x9cb38a, roughness: 0.9, side: THREE.DoubleSide});
  for (let i = 0; i < 4; i++) { const n = mesh(g, new THREE.PlaneGeometry(0.06, 0.03), note, (Math.random() - 0.5) * 0.04, 0.02 + i * 0.012, (Math.random() - 0.5) * 0.04); n.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3); }
  for (let i = 0; i < 5; i++) mesh(g, new THREE.CylinderGeometry(0.011, 0.011, 0.002, 14), M.brushed, (Math.random() - 0.5) * 0.05, 0.004 + i * 0.002, (Math.random() - 0.5) * 0.05);
  return g;
}
/** napkins, stirrers and sugar at the end of the bar (where drinks are picked up) */
export function condiments(R, x, y, z) {
  const M = mats(), g = new THREE.Group(); g.position.set(x, y, z); R.add(g);
  mesh(g, B(0.16, 0.12, 0.1, 0, 0.06, 0), M.brushed); mesh(g, B(0.14, 0.004, 0.08, 0, 0.122, 0), M.paper);
  mesh(g, new THREE.CylinderGeometry(0.035, 0.035, 0.11, 16), M.glass, 0.15, 0.055, 0);
  const st = []; for (let i = 0; i < 14; i++) st.push(new THREE.CylinderGeometry(0.0015, 0.0015, 0.17, 4).translate((Math.random() - 0.5) * 0.04, 0.085, (Math.random() - 0.5) * 0.04));
  const sm = new THREE.Mesh(mergeGeometries(st), new THREE.MeshStandardMaterial({color: 0xd8c39a, roughness: 0.8})); sm.position.set(0.15, 0, 0); g.add(sm);
  mesh(g, B(0.12, 0.06, 0.08, 0.3, 0.03, 0), M.black);
  const pk = []; for (let i = 0; i < 10; i++) pk.push(B(0.025, 0.004, 0.035, 0.3 + (Math.random() - 0.5) * 0.07, 0.062 + Math.random() * 0.01, (Math.random() - 0.5) * 0.04));
  g.add(new THREE.Mesh(mergeGeometries(pk), new THREE.MeshStandardMaterial({color: 0xf3efe6, roughness: 0.8})));
  return g;
}

// ---------------------------------------------------------------- the reach-in fridge behind the bar
export function fridge2002(R, x, z, w = 0.78, h = 2.0, d = 0.72) {
  const M = mats(), g = new THREE.Group(); g.position.set(x, 0, z); R.add(g);
  mesh(g, B(w, h - 0.12, 0.03, 0, h / 2 + 0.06, -d / 2 + 0.015), M.brushed);
  for (const s of [-1, 1]) mesh(g, B(0.03, h - 0.12, d, s * (w / 2 - 0.015), h / 2 + 0.06, 0), M.brushed);
  mesh(g, B(w, 0.12, d, 0, 0.06, 0), M.black);                                              // the base, with its louvres
  const lv = []; for (let i = 0; i < 9; i++) lv.push(B(w - 0.1, 0.006, 0.01, 0, 0.03 + i * 0.01, d / 2 + 0.002)); merged(g, lv, M.grey);
  mesh(g, B(w, 0.2, d, 0, h - 0.1, 0), M.brushed);                                          // the top: the cooling unit, a grille, the dial
  const gr = []; for (let i = 0; i < 12; i++) gr.push(B(0.006, 0.12, 0.006, -w / 2 + 0.12 + i * 0.045, h - 0.1, d / 2 + 0.002)); merged(g, gr, M.black);
  const dial = canvasTex(128, 128, (c, W, H) => { c.fillStyle = '#f4f1e8'; c.beginPath(); c.arc(64, 64, 60, 0, 7); c.fill(); c.strokeStyle = '#222'; c.lineWidth = 4; c.stroke(); c.fillStyle = '#222'; c.font = '600 20px Arial'; c.textAlign = 'center'; c.fillText('°F', 64, 98); for (let i = 0; i <= 8; i++) { const a = -2.2 + i * 0.55; c.fillRect(64 + Math.sin(a) * 46 - 1, 64 - Math.cos(a) * 46 - 1, 3, 3); } c.strokeStyle = '#b11'; c.lineWidth = 3; c.beginPath(); c.moveTo(64, 64); c.lineTo(64 + Math.sin(-0.4) * 40, 64 - Math.cos(-0.4) * 40); c.stroke(); });
  const dm = new THREE.Mesh(new THREE.CircleGeometry(0.035, 24), new THREE.MeshStandardMaterial({map: dial, roughness: 0.4})); dm.position.set(w / 2 - 0.1, h - 0.1, d / 2 + 0.004); g.add(dm);
  const inner = new THREE.MeshStandardMaterial({color: 0xeef1f2, roughness: 0.55, emissive: 0xf4f8ff, emissiveIntensity: 0.18});
  mesh(g, B(w - 0.07, h - 0.36, 0.01, 0, h / 2 + 0.02, -d / 2 + 0.04), inner);
  // wire shelves: gallon jugs of milk (whole, 2 %, skim — red, blue, green caps), half-gallon cartons, cream
  const wire = []; const shelves = [0.32, 0.72, 1.12, 1.5];
  for (const sy of shelves) { for (let i = 0; i < 16; i++) wire.push(new THREE.CylinderGeometry(0.0025, 0.0025, d - 0.1, 4).rotateX(Math.PI / 2).translate(-w / 2 + 0.06 + i * (w - 0.12) / 15, sy, 0)); wire.push(new THREE.CylinderGeometry(0.004, 0.004, w - 0.08, 4).rotateZ(Math.PI / 2).translate(0, sy, d / 2 - 0.06)); }
  merged(g, wire, M.steel);
  const jug = new RoundedBoxGeometry(0.15, 0.24, 0.15, 3, 0.03), cap = new THREE.CylinderGeometry(0.02, 0.02, 0.02, 12), handle = new THREE.TorusGeometry(0.035, 0.012, 6, 12, Math.PI);
  const caps = [0xc62f2f, 0x2c66b8, 0x3a8f3e];
  const carton = (sy, cx, col) => {
    const c = new THREE.Group(); c.position.set(cx, sy, 0.02); g.add(c);
    mesh(c, B(0.095, 0.19, 0.095, 0, 0.095, 0), M.paper);
    mesh(c, B(0.097, 0.07, 0.097, 0, 0.06, 0), new THREE.MeshStandardMaterial({color: col, roughness: 0.7}));
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.0001, 0.068, 0.05, 4, 1), M.paper); roof.rotation.y = Math.PI / 4; roof.position.y = 0.215; roof.scale.set(1, 1, 0.5); c.add(roof);
  };
  shelves.slice(0, 2).forEach((sy, si) => { for (let i = 0; i < 4; i++) { const jx = -w / 2 + 0.11 + i * 0.18; mesh(g, jug, M.jug, jx, sy + 0.125, -0.06); mesh(g, cap, new THREE.MeshStandardMaterial({color: caps[(i + si) % 3], roughness: 0.5}), jx - 0.035, sy + 0.255, -0.06); const hd = mesh(g, handle, M.jug, jx + 0.04, sy + 0.2, -0.06); hd.rotation.z = -Math.PI / 2; } });
  for (let i = 0; i < 6; i++) carton(shelves[2] + 0.004, -w / 2 + 0.09 + i * 0.115, [0x7a5a3a, 0x6b8f4e, 0xc9a15b][i % 3]);
  for (let i = 0; i < 7; i++) { const b = mesh(g, new THREE.CylinderGeometry(0.03, 0.03, 0.16, 14), M.paper, -w / 2 + 0.09 + i * 0.1, shelves[3] + 0.084, 0); b.material = new THREE.MeshStandardMaterial({color: i % 2 ? 0xf2efe6 : 0xe7d9b8, roughness: 0.6}); }
  // the door: glass in a stainless frame with a black gasket, misted at the bottom; a long handle
  const mist = canvasTex(64, 256, (c, W, H) => { const gr2 = c.createLinearGradient(0, 0, 0, H); gr2.addColorStop(0, 'rgba(255,255,255,0.05)'); gr2.addColorStop(0.75, 'rgba(255,255,255,0.1)'); gr2.addColorStop(1, 'rgba(255,255,255,0.45)'); c.fillStyle = gr2; c.fillRect(0, 0, W, H); });
  const door = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.1, h - 0.42), new THREE.MeshPhysicalMaterial({color: 0xf4fbfc, map: mist, roughness: 0.05, transparent: true, opacity: 0.35, depthWrite: false}));
  door.position.set(0, h / 2 + 0.02, d / 2 + 0.01); g.add(door);
  const fr = [B(w - 0.02, 0.05, 0.03, 0, 0.17, d / 2 + 0.01), B(w - 0.02, 0.05, 0.03, 0, h - 0.225, d / 2 + 0.01), B(0.05, h - 0.42, 0.03, -w / 2 + 0.035, h / 2 + 0.02, d / 2 + 0.01), B(0.05, h - 0.42, 0.03, w / 2 - 0.035, h / 2 + 0.02, d / 2 + 0.01)];
  merged(g, fr, M.steel);
  mesh(g, B(0.025, 0.9, 0.025, w / 2 - 0.07, h / 2 + 0.05, d / 2 + 0.05), M.steel);
  const lamp = new THREE.PointLight(0xf2f6ff, 0.25, 1.4, 2); lamp.position.set(0, h - 0.3, 0.1); g.add(lamp);
  return g;
}

// ---------------------------------------------------------------- the menu board and the specials chalkboard
/** a printed menu of the time in a wooden frame: three columns with small / medium / large prices, and the way through */
export function menuBoard2002() {
  const t = canvasTex(4096, 1280, (g, W, H) => {
    g.scale(2, 2); const w = W / 2, h = H / 2;          // drawn at 2048 × 640, stored at twice the pixels (sharp up close)
    g.fillStyle = '#efe3c8'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(120,90,50,${Math.random() * 0.05})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.strokeStyle = '#6a3f24'; g.lineWidth = 6; g.strokeRect(18, 18, w - 36, h - 36); g.lineWidth = 2; g.strokeRect(30, 30, w - 60, h - 60);
    const S3 = EN ? ['S', 'M', 'L'] : ['ص', 'و', 'ك'];
    const cols = EN ? [
      ['Espresso Bar', true, [['Caffè latte', '2.65', '3.05', '3.40'], ['Cappuccino', '2.65', '3.05', '3.40'], ['Caffè mocha', '2.95', '3.35', '3.70'], ['Caffè americano', '1.75', '2.05', '2.35'], ['Espresso', '1.45', '1.75', '']]],
      ['Brewed & Tea', true, [['Coffee of the day', '1.40', '1.60', '1.80'], ['Café au lait', '1.85', '2.10', '2.35'], ['Chai tea latte', '2.65', '3.05', '3.40'], ['Hot chocolate', '2.20', '2.50', '2.80'], ['Hot tea', '1.35', '1.55', '1.75']]],
      ['From the Bakery', false, [['Blueberry muffin', '1.75'], ['Butter croissant', '1.65'], ['Cinnamon scone', '1.85'], ['Chocolate cake', '2.75'], ['Cookie', '1.25']]],
    ] : [
      ['بار الإسبريسو', true, [['كافيه لاتيه', '2.65', '3.05', '3.40'], ['كابتشينو', '2.65', '3.05', '3.40'], ['كافيه موكا', '2.95', '3.35', '3.70'], ['أمريكانو', '1.75', '2.05', '2.35'], ['إسبريسو', '1.45', '1.75', '']]],
      ['قهوة مقطّرة وشاي', true, [['قهوة اليوم', '1.40', '1.60', '1.80'], ['قهوة بالحليب', '1.85', '2.10', '2.35'], ['شاي تشاي لاتيه', '2.65', '3.05', '3.40'], ['شوكولاتة ساخنة', '2.20', '2.50', '2.80'], ['شاي', '1.35', '1.55', '1.75']]],
      ['من المخبز', false, [['مافن توت', '1.75'], ['كرواسون بالزبدة', '1.65'], ['سكون بالقرفة', '1.85'], ['كيك شوكولاتة', '2.75'], ['كوكيز', '1.25']]],
    ];
    const colW = (w - 140) / 3;
    cols.forEach(([head, sized, items], ci) => {
      const left = EN ? 70 + ci * colW : w - 70 - (ci + 1) * colW, x0 = left + 30, x1 = left + colW - 30;
      g.fillStyle = '#4a240f'; g.font = `800 54px ${SERIF}`; g.textAlign = 'center'; g.fillText(head, (x0 + x1) / 2, 100);
      g.fillStyle = '#8a5a34'; g.fillRect(x0 + 40, 118, x1 - x0 - 80, 2);
      // three price columns 92 px apart at the outer edge; names get the rest, shrunk to fit if they are long
      const pcol = sized ? (EN ? [x1 - 204, x1 - 112, x1 - 20] : [x0 + 20, x0 + 112, x0 + 204]) : [EN ? x1 - 20 : x0 + 20];
      const nameMax = (x1 - x0) - (sized ? 290 : 110);
      if (sized) { g.fillStyle = '#6a3f20'; g.font = `800 28px ${SANS}`; g.textAlign = 'center'; S3.forEach((t, i) => g.fillText(t, pcol[i] + (EN ? -30 : 30), 160)); }
      items.forEach(([name, ...pr], i) => {
        const y = 212 + i * 58;
        g.fillStyle = '#160c05'; let fs = 40; g.font = `700 ${fs}px ${SERIF}`;
        while (g.measureText(name).width > nameMax && fs > 26) { fs -= 1; g.font = `700 ${fs}px ${SERIF}`; }
        g.textAlign = EN ? 'left' : 'right'; g.fillText(name, EN ? x0 : x1, y);
        g.fillStyle = '#1e1108'; g.font = '700 32px Georgia, serif'; g.textAlign = EN ? 'right' : 'left';
        pr.forEach((p, k) => { if (p) g.fillText(p, pcol[k], y); });
      });
    });
    g.fillStyle = '#5a2f17'; g.fillRect(30, h - 98, w - 60, 68);
    g.fillStyle = '#f3ead6'; g.font = `600 38px ${SANS}`; g.textBaseline = 'middle';
    g.textAlign = 'left'; g.fillText(EN ? '◀  Pick up your drink at the end of the bar' : '◀  استلم مشروبك من آخر البار', 70, h - 64);
    g.textAlign = 'right'; g.fillText(EN ? 'Order & pay here  ▶' : 'اطلب وادفع هنا  ▶', w - 70, h - 64);
  });
  t.anisotropy = 16;                                     // read from the side as well: no smear
  return t;
}
/** the board's wooden frame around a w × h panel (centre at x, y, z, facing +z) */
export function menuFrame(R, x, y, z, w, h) {
  const M = mats(), t = 0.06;
  merged(R, [B(w + 2 * t, t, 0.04, x, y + h / 2 + t / 2, z), B(w + 2 * t, t, 0.04, x, y - h / 2 - t / 2, z), B(t, h, 0.04, x - w / 2 - t / 2, y, z), B(t, h, 0.04, x + w / 2 + t / 2, y, z)], M.cherryDark);
}
/** a chalkboard of the day's offers on a wall (centre x, y, z; facing turned by ry) */
export function specialsBoard(R, x, y, z, ry) {
  const M = mats(), W = 0.9, H = 1.15, g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; R.add(g);
  const chalk = (c, txt, px, py, size, col = '#f2efe6', bold = 600) => {
    c.font = `${bold} ${size}px ${SANS}`; c.fillStyle = col; c.globalAlpha = 0.92;
    for (let k = 0; k < 2; k++) c.fillText(txt, px + (Math.random() - 0.5) * 1.6, py + (Math.random() - 0.5) * 1.6);
    c.globalAlpha = 1;
  };
  const t = canvasTex(720, 920, (c, w, h) => {
    c.fillStyle = '#1f2723'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) { c.fillStyle = `rgba(255,255,255,${Math.random() * 0.035})`; c.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
    c.textAlign = 'center'; c.textBaseline = 'middle';
    chalk(c, EN ? "TODAY'S SPECIALS" : 'عروض اليوم', w / 2, 80, 56, '#f5d66b', 800);
    c.strokeStyle = 'rgba(245,214,107,.7)'; c.lineWidth = 3; c.beginPath(); c.moveTo(130, 120); c.quadraticCurveTo(w / 2, 132, w - 130, 118); c.stroke();
    const rows = EN ? [
      ['Morning pair', 'any medium coffee + a muffin', '$2.95'],
      ['Iced coffee of the day', 'served over ice', '$1.85'],
      ['Bean of the week', 'Sumatra · ask for a taste', ''],
      ['Stay a while', 'free refill on brewed coffee', ''],
    ] : [
      ['ثنائي الصباح', 'أي قهوة وسط + مافن', '2.95$'],
      ['قهوة اليوم المثلجة', 'تقدَّم على الثلج', '1.85$'],
      ['حبوب الأسبوع', 'سومطرة · اطلب تذوقها', ''],
      ['خليك معانا', 'إعادة ملء القهوة المقطّرة مجانًا', ''],
    ];
    rows.forEach(([a, b, p], i) => {
      const y = 215 + i * 165;
      chalk(c, a, w / 2, y, 44, i % 2 ? '#a8dcd1' : '#f4b6c2', 700);
      chalk(c, b, w / 2, y + 52, 32);
      if (p) chalk(c, p, w / 2, y + 100, 40, '#f5d66b', 700);
    });
  });
  mesh(g, B(W + 0.08, H + 0.08, 0.03, 0, 0, -0.015), M.cherryDark);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({map: t, roughness: 0.95})); p.position.z = 0.002; g.add(p);
  mesh(g, B(W, 0.03, 0.05, 0, -H / 2 - 0.02, 0.02), M.cherryDark);                          // the chalk ledge
  for (let i = 0; i < 3; i++) mesh(g, new THREE.CylinderGeometry(0.005, 0.005, 0.07, 6), new THREE.MeshStandardMaterial({color: [0xf2efe6, 0xf4b6c2, 0xf5d66b][i], roughness: 0.9}), -0.25 + i * 0.12, -H / 2 - 0.0, 0.03).rotation.z = Math.PI / 2;
  return g;
}
