// The operative field: the prepped skin over the sternum (marker line, incision, bleeders), then the opened chest —
// sternal edges in cross-section (skin, fat, bone), the retractor, the pericardial cradle, lung edges that ventilate,
// and a blood level that rises when it bleeds and falls with suction.
import * as THREE from 'three';
import {onUpdate, clock} from '../core/engine.js';
import {CHEST, OR} from './room.js';
import {bodyTop} from './body.js';
import {vit} from './monitor.js';
import {setThoraxOpen, showThorax} from './thorax.js';

export const F = {stage: 'skin', openK: 0, blood: 0, bleeders: [], marker: [], incision: [], incD: [], incT: [], sawn: [], pericardium: 1};
const PX = 0.36, PZ = 0.33;                         // skin patch size (x along the body, z across): a wide prepped window, like real footage
export const NOTCH = new THREE.Vector3(CHEST.x - 0.105, CHEST.y, 0);     // suprasternal notch (head side)
export const XIPH = new THREE.Vector3(CHEST.x + 0.105, CHEST.y, 0);      // xiphoid process
const W = 1536, Hc = 1408;
let cv, g, tex, bcv, bg, btex;                 // colour canvas and a bump (height) canvas for the cut's depth
/** world (x, z) on the patch → canvas pixels */
export const toPx = (x, z) => [((x - (CHEST.x - PX / 2)) / PX) * W, ((z + PZ / 2) / PZ) * Hc];
const mm = (d) => d / 1000;

function paintSkin() {
  // skin: warm base with soft mottling
  g.fillStyle = '#d7a688'; g.fillRect(0, 0, W, Hc);
  for (let i = 0; i < 260; i++) { const x = Math.random() * W, y = Math.random() * Hc, r = 30 + Math.random() * 90, gr = g.createRadialGradient(x, y, 0, x, y, r); const red = Math.random() < 0.5; gr.addColorStop(0, red ? 'rgba(200,110,95,0.10)' : 'rgba(240,200,170,0.10)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  for (let i = 0; i < 9000; i++) { g.fillStyle = 'rgba(120,70,50,' + (Math.random() * 0.06) + ')'; g.fillRect(Math.random() * W, Math.random() * Hc, 1.5, 1.5); }   // pores
  // chest form: the sternum is a little lighter, the pectorals either side fall away into shadow
  let gr = g.createLinearGradient(0, 0, 0, Hc);
  gr.addColorStop(0, 'rgba(70,30,20,0.32)'); gr.addColorStop(0.3, 'rgba(70,30,20,0.06)'); gr.addColorStop(0.5, 'rgba(255,235,215,0.12)'); gr.addColorStop(0.7, 'rgba(70,30,20,0.06)'); gr.addColorStop(1, 'rgba(70,30,20,0.32)');
  g.fillStyle = gr; g.fillRect(0, 0, W, Hc);
  // povidone-iodine prep: a translucent golden-brown wash, darker where it pooled
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = 'rgba(226,190,120,0.32)'; g.fillRect(0, 0, W, Hc);     // a light, dried prep: pale yellowish skin like real footage
  for (let i = 0; i < 70; i++) { const x = Math.random() * W, y = Math.random() * Hc, r = 60 + Math.random() * 160; const q = g.createRadialGradient(x, y, 0, x, y, r); q.addColorStop(0, 'rgba(170,95,40,' + (0.12 + Math.random() * 0.12) + ')'); q.addColorStop(1, 'rgba(170,95,40,0)'); g.fillStyle = q; g.fillRect(x - r, y - r, r * 2, r * 2); }
  g.globalCompositeOperation = 'source-over';
  // landmarks: a soft hollow at the suprasternal notch, the tip of the xiphoid
  const [nx, ny] = toPx(NOTCH.x, 0), [xx, xy] = toPx(XIPH.x, 0);
  let r = g.createRadialGradient(nx, ny, 0, nx, ny, 46); r.addColorStop(0, 'rgba(60,25,12,0.35)'); r.addColorStop(1, 'rgba(60,25,12,0)'); g.fillStyle = r; g.beginPath(); g.arc(nx, ny, 46, 0, 7); g.fill();
  r = g.createRadialGradient(xx, xy, 0, xx, xy, 30); r.addColorStop(0, 'rgba(255,225,195,0.18)'); r.addColorStop(1, 'rgba(255,225,195,0)'); g.fillStyle = r; g.beginPath(); g.arc(xx, xy, 30, 0, 7); g.fill();
}
let base = null;
const hashI = (i, k = 0) => { const h = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return h - Math.floor(h); };
/** the skin incision, exactly where the blade went: a scratch where it barely touched, a cut through the skin where it
 *  went at the right depth (the edges draw apart over a second or two and show the yellow fat, blood wells along it),
 *  a deeper, bloodier gap where it was pressed too hard */
function drawIncision() {
  const P = F.incision, now = clock.t;
  const segs = [];
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i]; if (a.distanceTo(b) > 0.012) continue;                 // a new stroke
    const d = F.incD[i] ?? 0.5, age = F.incT[i] != null ? now - F.incT[i] : 9;
    const thru = d >= 0.3, deep = d > 0.72, open = thru ? Math.min(1, age / 1.6) : 0;
    const gap = thru ? 5 + 11 * open * open * (3 - 2 * open) + (deep ? 6 : 0) : 2.2;      // px (≈ 0.23 mm each): a fresh cut gapes 3–5 mm
    segs.push([toPx(a.x, a.z), toPx(b.x, b.z), gap, thru, deep, i]);
  }
  const pass = (ctx, wOf, style) => { for (const [A, B, gp, th, dp, i] of segs) { const w = wOf(gp, th, dp); if (w <= 0) continue; ctx.strokeStyle = typeof style === 'function' ? style(th, dp, i) : style; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); } };
  // colour: pink bruised margin → pale cut dermis → yellow fat at the bottom → blood along the depth
  pass(g, (gp, th) => th ? gp + 16 : 7, 'rgba(150,35,32,0.28)');
  pass(g, (gp, th) => th ? gp + 5 : 0, '#6a1a14');                                         // the raw cut dermis
  pass(g, (gp) => gp, (th, dp) => th ? (dp ? '#a8741f' : '#cf9a30') : '#8a2c22');           // yellow fat in the depth
  pass(g, (gp, th) => th ? Math.max(2, gp * 0.78) : 1.2, (th, dp, i) => dp ? '#2a0103' : `rgba(${70 + (hashI(i) * 26 | 0)},2,5,0.98)`);   // blood welling along it
  // beads of blood along the fresh cut (fixed per point: no flicker while redrawing)
  for (const [A, B, gp, th, dp, i] of segs) if (th && hashI(i, 1) < (dp ? 0.45 : 0.28)) { const r = 2.5 + hashI(i, 2) * (dp ? 6 : 4); g.fillStyle = dp ? 'rgba(80,3,5,0.92)' : 'rgba(120,8,12,0.9)'; g.beginPath(); g.arc(B[0] + (hashI(i, 3) - 0.5) * gp, B[1] + (hashI(i, 4) - 0.5) * 3, r, 0, 7); g.fill(); }
  // depth: the gap is low, its edges a little rounded
  pass(bg, (gp, th) => th ? gp + 6 : 3, 'rgb(205,205,205)');
  pass(bg, (gp, th) => th ? gp + 2 : 1.4, 'rgb(150,150,150)');
  pass(bg, (gp, th) => th ? gp : 0, (th, dp) => dp ? 'rgb(30,30,30)' : 'rgb(70,70,70)');
}
function redraw() {
  if (!base) { paintSkin(); base = document.createElement('canvas'); base.width = W; base.height = Hc; base.getContext('2d').drawImage(cv, 0, 0); }
  else g.drawImage(base, 0, 0);
  bg.fillStyle = '#fff'; bg.fillRect(0, 0, W, Hc);
  const line = (pts, style, w) => { if (pts.length < 2) return; g.strokeStyle = style; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); pts.forEach((p, i) => { const [x, y] = toPx(p.x, p.z); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); };
  line(F.marker, 'rgba(86,40,128,0.9)', 5);
  if (F.incision.length > 1 && !F.closed) drawIncision();
  if (F.sawn.length > 1) { line(F.sawn, '#efe3cf', 7); line(F.sawn, 'rgba(150,30,25,0.8)', 2); }
  if (F.closed && F.incision.length > 1) {           // closed wound: fine subcuticular line with a few steri-strip marks
    line(F.incision, '#3b1012', 3);
    const n = F.incision.length; for (let i = 2; i < n - 2; i += Math.max(1, Math.round(n / 14))) { const [x, y] = toPx(F.incision[i].x, F.incision[i].z); g.fillStyle = 'rgba(245,240,230,.85)'; g.fillRect(x - 5, y - 26, 10, 52); }
  }
  for (const b of F.bleeders) { const [x, y] = toPx(b.x, b.z); g.fillStyle = b.done ? 'rgba(60,25,15,0.9)' : '#c1121a'; g.beginPath(); g.arc(x, y, b.done ? 5 : 7, 0, 7); g.fill(); if (!b.done) { g.fillStyle = 'rgba(255,120,120,0.6)'; g.beginPath(); g.arc(x - 2, y - 2, 2, 0, 7); g.fill(); } }
  tex.needsUpdate = true; btex.needsUpdate = true;
}

export function buildField(parent) {
  const G = new THREE.Group(); parent.add(G); F.group = G;
  cv = document.createElement('canvas'); cv.width = W; cv.height = Hc; g = cv.getContext('2d');
  tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  bcv = document.createElement('canvas'); bcv.width = W; bcv.height = Hc; bg = bcv.getContext('2d');
  btex = new THREE.CanvasTexture(bcv); btex.anisotropy = 8;
  // skin patch: gently convex, under the drape window
  const geo = new THREE.PlaneGeometry(PX, PZ, 48, 24); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const z = pos.getZ(i), x = pos.getX(i); pos.setY(i, bodyTop(CHEST.x + x, z) - CHEST.y + 0.002); }   // the chest's own curve
  geo.computeVertexNormals();
  const skin = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({map: tex, bumpMap: btex, bumpScale: 0.7, roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.45, sheen: 0.25, sheenColor: new THREE.Color(0xffd8c0), envMapIntensity: 0.45}));
  skin.position.copy(CHEST); skin.receiveShadow = true; G.add(skin); F.skin = skin;
  redraw();

  // ---- the opened chest: one sculpted surface — drape, sponge-covered sternal edges, and the pericardial well
  const O = new THREE.Group(); O.position.copy(CHEST); O.visible = false; G.add(O); F.open = O;
  const NX = 120, NZ = 110, XS = 0.17, ZS = 0.16;
  const wgeo = new THREE.PlaneGeometry(1, 1, NX, NZ); wgeo.rotateX(-Math.PI / 2);
  const wp = wgeo.attributes.position, nv = wp.count;
  F.wellUV = new Float32Array(nv * 2);
  for (let i = 0; i < nv; i++) {                     // denser rows near the midline, where the opening is
    const u = wp.getX(i) * 2, t = wp.getZ(i) * 2;
    F.wellUV[i * 2] = u * XS; F.wellUV[i * 2 + 1] = Math.sign(t) * ZS * Math.pow(Math.abs(t), 1.7);
  }
  wgeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(nv * 3), 3));
  const nc = document.createElement('canvas'); nc.width = nc.height = 256; const ng = nc.getContext('2d');
  ng.fillStyle = '#e8e8e8'; ng.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5000; i++) { const v = 190 + Math.random() * 65 | 0; ng.fillStyle = `rgb(${v},${v},${v})`; ng.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 3, 1 + Math.random() * 2); }
  const ntex = new THREE.CanvasTexture(nc); ntex.wrapS = ntex.wrapT = THREE.RepeatWrapping; ntex.repeat.set(6, 12);
  const well = new THREE.Mesh(wgeo, new THREE.MeshPhysicalMaterial({vertexColors: true, roughness: 0.5, clearcoat: 0.55, clearcoatRoughness: 0.3, envMapIntensity: 0.35}));   // wet tissue
  well.receiveShadow = true; well.castShadow = false; O.add(well); F.well = well;
  // the closed pericardium over the heart (fades when it is opened)
  const peri = new THREE.Mesh(new THREE.SphereGeometry(0.075, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.45), new THREE.MeshPhysicalMaterial({color: 0xe8c9bc, roughness: 0.35, clearcoat: 0.8, transparent: true, opacity: 0.92})); peri.scale.set(1.35, 0.55, 0.85); peri.position.set(0.0, -0.073, 0); O.add(peri); F.peri = peri;
  // blood level in the well
  const pool = new THREE.Mesh(new THREE.CircleGeometry(0.09, 40), new THREE.MeshPhysicalMaterial({color: 0x2e0204, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0.5})); pool.rotation.x = -Math.PI / 2; pool.scale.set(1.15, 0.55, 1); pool.position.y = -0.09; O.add(pool); F.pool = pool;
  buildRetractor(O);
  buildLaps(O);
  setOpen(0);

  let lastAnim = 0;
  onUpdate((dt) => {
    if (F.incAnimUntil && clock.t < F.incAnimUntil && clock.t - lastAnim > 0.08) { lastAnim = clock.t; redraw(); }
    const vent = vit.ventilating && vit.bypass < 0.5;
    const br = vent ? (Math.sin(clock.t * 2 * Math.PI / 5) * 0.5 + 0.5) : 0;
    if (F.stage !== 'open') skin.position.y = CHEST.y + 0.003 * br;
    else O.position.y = CHEST.y + 0.002 * br;
    F.peri.material.opacity += ((F.pericardium ? 0.45 : 0) - F.peri.material.opacity) * Math.min(1, dt * 1.5); F.peri.visible = F.peri.material.opacity > 0.02;
    pool.position.y = -0.112 + F.blood * 0.05; pool.visible = F.blood > 0.01;
    pool.scale.set(1.15 * (0.55 + 0.45 * F.blood), 0.55 * (0.55 + 0.45 * F.blood) * (0.5 + F.openK * 0.5), 1);
  });
  return F;
}
const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lin = (r, g, b) => { const c = new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace); return [c.r, c.g, c.b]; };   // vertex colours are linear
const C_SKIN = lin(0.68, 0.48, 0.32), C_DERM = lin(0.74, 0.4, 0.36), C_FAT = lin(0.7, 0.47, 0.19), C_BLOODY = lin(0.42, 0.05, 0.05), C_PERI = lin(0.72, 0.42, 0.4), C_DEEP = lin(0.22, 0.03, 0.04);
const hash = (x, z) => { const h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return h - Math.floor(h); };
/** smooth value noise (no stripes on stretched rows of the mesh) */
const vnoise = (x, z) => { const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
const mix = (a, b, t) => a.map((v, j) => v + (b[j] - v) * t);
const WALL = 0.014;                                    // skin edge → fat → bone, across the wound edge
const LX = 0.105;                                      // the wound is an ellipse along the body
// the opening is a rounded rectangle: the rigid sternal halves keep its sides parallel; corners of up to 2 cm
const cornerR = (e) => Math.min(e, 0.035);
const halfAt = (x, e) => { const ax = Math.abs(x), rc = cornerR(e), x0 = LX - rc; if (ax <= x0) return e; if (ax >= LX) return 0; return e - rc + Math.sqrt(Math.max(0, rc * rc - (ax - x0) ** 2)); };
/** signed distance to the opening's outline (negative inside) */
const openDist = (ax, az, e) => { const rc = cornerR(e), qx = ax - (LX - rc), qz = az - (e - rc); return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - rc; };
/** height of the opened field at (x, z) for a half-opening e, and its colour */
function wellAt(x, z, e, k) {
  const ax = Math.abs(x), az = Math.abs(z);
  const d = openDist(ax, az, e);
  const ys = bodyTop(CHEST.x + x, z) - CHEST.y + 0.002;              // the skin
  const yb = -0.012 - 0.006 * k;                                       // the front of the sternum at the edge
  const n = 0.6 * vnoise(x * 90, z * 110) + 0.4 * vnoise(x * 170, z * 230), n2 = vnoise(x * 45 + 3, z * 60);   // ≥ 2 grid cells per wave: no streaks
  let y, c;
  const Wl = WALL + 0.02 * sm(0.06, 0.1, ax);                          // beyond the ends of the sternum the wound slopes gently
  if (d >= Wl) { y = ys; c = C_SKIN; if (d < Wl + 0.006) c = mix(C_SKIN, lin(0.62, 0.2, 0.18), (1 - (d - Wl) / 0.006) * 0.25 * (0.6 + 0.4 * n2)); }   // skin, bruised at the edge
  else if (d >= 0) {
    const t = d / Wl;                                                  // 0 at the bone, 1 at the skin edge
    y = yb + (ys - yb) * Math.pow(sm(0.12, 0.9, t), 0.55);
    c = mix(mix(C_BLOODY, C_FAT, sm(0.08, 0.5, t) * (0.75 + 0.25 * n)), C_DERM, sm(0.78, 0.92, t));   // blood at the bone, yellow fat, the cut dermis
    c = mix(c, C_BLOODY, 0.35 * sm(0.55, 0.9, n2));                     // smears of blood
  } else {
    // inside: the heart sits deep in the middle; at both ends of the wound the floor is mediastinal fat (thymic
    // remnant over the great vessels at the head end, the pericardial fat pad at the diaphragm)
    const q = sm(0, 0.026, -d), deep = 0.105 * (1 - sm(0.05, 0.092, ax)) + 0.012;
    y = yb - 0.012 - deep * Math.pow(q, 0.85);
    const fat = sm(0.055, 0.085, ax) * (0.7 + 0.3 * n);
    c = mix(mix(C_DEEP, C_PERI, sm(-0.075, -0.03, y) * (0.35 + 0.4 * n)), mix(C_FAT, C_BLOODY, 0.3 * n2), fat);
    c = mix(c, C_BLOODY, 0.3 * sm(0.5, 0.9, n2));
  }
  if (ax > 0.16) { y = ys; c = C_SKIN; }
  return [y, c, d];
}
/** shape the well for a half-opening e (m): rewrites positions + colours */
function shapeWell(e, k = 0) {
  const geo = F.well.geometry, wp = geo.attributes.position, col = geo.attributes.color, uv = F.wellUV;
  const n = wp.count, Y = F._wy || (F._wy = new Float32Array(n)), D = F._wd || (F._wd = new Float32Array(n)), T = F._wt || (F._wt = new Float32Array(n));
  for (let i = 0; i < n; i++) {
    const x = uv[i * 2], z = uv[i * 2 + 1];
    const [y, c, d] = wellAt(x, z, e, k);
    Y[i] = y; D[i] = d; col.setXYZ(i, c[0], c[1], c[2]);
  }
  // round off the inside (no steep facets): relax the heights of the vertices within the opening
  const RW = 121;                                       // vertices per row (NX + 1)
  for (let pass = 0; pass < 8; pass++) {
    T.set(Y);
    for (let i = RW; i < n - RW; i++) { if (D[i] >= 0.002) continue; const c = i % RW; if (c === 0 || c === RW - 1) continue; Y[i] = (T[i] * 2 + T[i - 1] + T[i + 1] + T[i - RW] + T[i + RW]) / 6; }
  }
  for (let i = 0; i < n; i++) wp.setXYZ(i, uv[i * 2], Y[i], uv[i * 2 + 1]);
  wp.needsUpdate = true; col.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingSphere();
}

// ---- a sternal retractor (Ankeney type): a toothed rack across the lower end of the wound, two arms, two blades
// that hook the sternal edges, and a winged crank on the moving arm
function buildRetractor(O) {
  const steel = new THREE.MeshStandardMaterial({color: 0x6a7176, roughness: 0.24, metalness: 1, envMapIntensity: 0.6});
  const dark = new THREE.MeshStandardMaterial({color: 0x6d7378, roughness: 0.45, metalness: 1, envMapIntensity: 0.9});
  const R = new THREE.Group(); R.position.set(LX + 0.012, 0.016, 0); O.add(R); F.retractor = R; R.visible = false;
  const rounded = (w, h, r) => { const s = new THREE.Shape(); s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2); return s; };
  const beam = (w, h, len, r = 0.0015) => { const g = new THREE.ExtrudeGeometry(rounded(w, h, r), {depth: len, bevelEnabled: true, bevelSize: 0.0006, bevelThickness: 0.0006, bevelSegments: 2, curveSegments: 4}); g.translate(0, 0, -len / 2); return g; };
  // the rack: a flat bar across the chest (along z), teeth along its head-side edge
  const bar = new THREE.Mesh(beam(0.013, 0.006, 0.25), steel); bar.castShadow = true; R.add(bar);
  const tooth = new THREE.BoxGeometry(0.003, 0.005, 0.0028);
  const teeth = new THREE.InstancedMesh(tooth, steel, 40);
  for (let i = 0; i < 40; i++) { const m = new THREE.Matrix4().makeRotationY(Math.PI / 4); m.setPosition(-0.0068, 0, -0.118 + i * 0.006); teeth.setMatrixAt(i, m); }
  R.add(teeth);
  // two arms (the fixed one on the patient's left, the moving one with the crank on the right) and their blades
  F.blades = [-1, 1].map(s => {
    const b = new THREE.Group(); R.add(b);
    const slide = new THREE.Mesh(beam(0.02, 0.012, 0.024, 0.003), dark); slide.position.set(0, 0.001, 0); b.add(slide);
    const arm = new THREE.Mesh(beam(0.011, 0.008, 0.056, 0.003), steel); arm.rotation.set(0, Math.PI / 2, 0); arm.position.set(-0.028, -0.003, 0); b.add(arm);
    const post = new THREE.Mesh(beam(0.008, 0.008, 0.012, 0.002), steel); post.rotation.set(Math.PI / 2, 0, 0); post.position.set(-0.054, -0.009, 0); b.add(post);
    // the blade: a C in cross-section that grips the sternal edge (flange on the bone, plate inside, lip under it)
    const C = new THREE.Shape(); const o = -s;     // shape x becomes −z: the flange and lip reach out over the bone
    C.moveTo(0, 0.004); C.lineTo(o * 0.014, 0.004); C.lineTo(o * 0.014, 0.0005); C.lineTo(o * 0.0035, 0.0005); C.lineTo(o * 0.0035, -0.024);
    C.lineTo(o * 0.011, -0.027); C.lineTo(o * 0.011, -0.0305); C.lineTo(0, -0.0285); C.lineTo(0, 0.004);
    const bg = new THREE.ExtrudeGeometry(C, {depth: 0.07, bevelEnabled: true, bevelSize: 0.0007, bevelThickness: 0.0007, bevelSegments: 2});
    bg.translate(0, 0, -0.035); bg.rotateY(Math.PI / 2);                // shape x → across (z), extruded along the body (x)
    const blade = new THREE.Mesh(bg, steel); blade.position.set(-(LX + 0.012) + 0.03, -0.02, 0); b.add(blade);
    b.traverse(q => { if (q.isMesh) { q.castShadow = true; q.receiveShadow = true; } });
    return b;
  });
  F.crank = new THREE.Group(); F.blades[1].add(F.crank); F.crank.position.set(0.004, 0.006, 0.012);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.018, 12), steel); shaft.position.y = 0.009; F.crank.add(shaft);
  const wing = new THREE.Mesh(beam(0.05, 0.004, 0.012, 0.004), steel); wing.rotation.x = Math.PI / 2; wing.position.set(0, 0.02, 0); F.crank.add(wing);
  F.crank.traverse(q => { if (q.isMesh) q.castShadow = true; });
}
// ---- laps: wet white gauze towels tucked over both wound edges, stained with blood
function lapTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 1024; const g = c.getContext('2d');
  g.fillStyle = '#d9d5cd'; g.fillRect(0, 0, 256, 1024);
  for (let y = 0; y < 1024; y += 3) { g.fillStyle = `rgba(150,140,130,${0.12 + Math.random() * 0.1})`; g.fillRect(0, y, 256, 1); }
  for (let x = 0; x < 256; x += 3) { g.fillStyle = `rgba(150,140,130,${0.1 + Math.random() * 0.1})`; g.fillRect(x, 0, 1, 1024); }
  for (let i = 0; i < 60; i++) { const x = Math.random() * 256, y = Math.random() * 1024, r = 10 + Math.random() * 40; const q = g.createRadialGradient(x, y, 0, x, y, r); q.addColorStop(0, 'rgba(200,190,180,0.35)'); q.addColorStop(1, 'rgba(200,190,180,0)'); g.fillStyle = q; g.fillRect(x - r, y - r, r * 2, r * 2); }   // folds
  // blood: soaked along the inner (wound) edge = u 0, spatters further out
  for (let i = 0; i < 90; i++) { const y = Math.random() * 1024, x = Math.pow(Math.random(), 2.2) * 150, r = 8 + Math.random() * 46 * (1 - x / 200); const q = g.createRadialGradient(x, y, 0, x, y, r); const a = 0.35 + Math.random() * 0.45; q.addColorStop(0, `rgba(140,10,14,${a})`); q.addColorStop(0.6, `rgba(160,20,22,${a * 0.6})`); q.addColorStop(1, 'rgba(170,40,40,0)'); g.fillStyle = q; g.beginPath(); g.ellipse(x, y, r * 0.8, r * 1.4, 0, 0, 7); g.fill(); }
  const gr = g.createLinearGradient(0, 0, 60, 0); gr.addColorStop(0, 'rgba(110,6,10,0.9)'); gr.addColorStop(1, 'rgba(110,6,10,0)'); g.fillStyle = gr; g.fillRect(0, 0, 60, 1024);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function buildLaps(O) {
  const mat = new THREE.MeshPhysicalMaterial({map: lapTexture(), roughness: 0.85, sheen: 0.6, sheenColor: new THREE.Color(0xffffff), envMapIntensity: 0.3, side: THREE.DoubleSide});
  F.laps = [-1, 1].map(s => {
    const NXl = 40, NW = 10, geo = new THREE.PlaneGeometry(1, 1, NW, NXl);
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; m.castShadow = false; m.userData.s = s; O.add(m); m.visible = false;
    m.userData.seed = Array.from({length: (NW + 1) * (NXl + 1)}, () => Math.random());
    return m;
  });
}
/** lay each lap over its wound edge: from just over the fat (inner edge) to 3 cm out over the skin */
function shapeLaps(e, k) {
  if (!F.laps) return;
  for (const m of F.laps) {
    const s = m.userData.s, p = m.geometry.attributes.position, uv = m.geometry.attributes.uv, NW = 10, NXl = 40;
    for (let j = 0; j <= NXl; j++) for (let i = 0; i <= NW; i++) {
      const idx = j * (NW + 1) + i, u = i / NW, x = -0.088 + 0.176 * (j / NXl);
      const ex = halfAt(x, e) + WALL * 0.45;
      const z = s * (ex + u * 0.034);
      const [y] = wellAt(x, z, e, k);
      const fold = 0.0018 * Math.sin(x * 160 + s * 2 + u * 3) + 0.0012 * (m.userData.seed[idx] - 0.5);
      const ends = sm(0.06, 0.088, Math.abs(x));                       // the ends are tucked down
      const lip = u < 0.08 ? 0.004 * (1 - u / 0.08) : 0;                // the inner edge rolls down over the fat
      p.setXYZ(idx, x, Math.max(y, wellAt(x, s * (ex + 0.004), e, k)[0] - 0.002) + 0.0035 + fold - ends * 0.006 - lip, z);
      uv.setXY(idx, u, j / NXl);
    }
    p.needsUpdate = true; m.geometry.computeVertexNormals(); m.geometry.computeBoundingSphere();
    m.visible = F.stage === 'open' && k > 0.15;
  }
}
/** retractor opening 0..1 (sternal edges spread from 3 mm to ~11 cm) */
export function setOpen(k) {
  F.openK = k; const e = 0.0015 + k * 0.053;
  shapeWell(e, k); shapeLaps(e, k); setThoraxOpen(k);
  F.blades[0].position.z = -e - 0.0005; F.blades[1].position.z = e + 0.0005;
  F.blades.forEach(b => { b.position.y = -0.006 * k; });
  F.crank.rotation.y = k * 40;
}
export function setStage(s) {
  F.stage = s;
  F.skin.visible = s !== 'open';
  F.open.visible = s === 'open';
  showThorax(s === 'open');
  if (OR.setDrapeWindow && F._win !== (s === 'open')) { F._win = s === 'open'; OR.setDrapeWindow(F._win); }
  shapeLaps(0.0015 + F.openK * 0.053, F.openK);
  redraw();
}
export const field = {redraw, setOpen, setStage};
/** project a world point onto the skin plane (y ignored) */
export function onSkin(p) { return new THREE.Vector3(p.x, CHEST.y, p.z); }
export {mm};
