// Procedural office props (kept simple in shape but with real materials and bevels).
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {M, canvasTex} from './materials.js';

const matCache = new Map();
/** shared material per colour/roughness (lets the static merger batch repeated items) */
export function solid(color, roughness = 0.6, extra = {}) { const k = color + '|' + roughness + JSON.stringify(extra); if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({color, roughness, ...extra})); return matCache.get(k); }
export function mesh(geo, mat, parent, x = 0, y = 0, z = 0, ry = 0, {cast = true, recv = true} = {}) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = cast; m.receiveShadow = recv;
  parent.add(m); return m;
}
/** scale BoxGeometry UVs to metres so tiling textures keep a constant texel density */
export function worldUV(geo, w, h, d) {
  const uv = geo.attributes.uv; const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0], uv.getY(k) * dims[f][1]); }
  uv.needsUpdate = true; return geo;
}
/** horizontal plane (floor) with UVs in metres */
export function floorPlane(parent, w, d, mat, x, z, y = 0) {
  const g = new THREE.PlaneGeometry(w, d); const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * d);
  const m = new THREE.Mesh(g, mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; parent.add(m); return m;
}
/** box with bottom at y */
export const box = (p, w, h, d, mat, x, y, z, ry = 0, o) => mesh(worldUV(new THREE.BoxGeometry(w, h, d), w, h, d), mat, p, x, y + h / 2, z, ry, o);
export const rbox = (p, w, h, d, r, mat, x, y, z, ry = 0, o) => mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat, p, x, y + h / 2, z, ry, o);
export const cyl = (p, rt, rb, h, mat, x, y, z, seg = 20, o) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, p, x, y + h / 2, z, 0, o);

export function group(parent, x = 0, y = 0, z = 0, ry = 0) { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g); return g; }

// ---------- desk (open office): white top, dark steel frame ----------
export function desk(p, x, z, ry, {w = 1.5, d = 0.78, top = M.whiteTop} = {}) {
  const g = group(p, x, 0, z, ry);
  rbox(g, w, 0.03, d, 0.008, top, 0, 0.72, 0);
  for (const sx of [-1, 1]) {
    box(g, 0.05, 0.72, d - 0.08, M.darkAlu, sx * (w / 2 - 0.06), 0, 0);
    box(g, 0.08, 0.02, d - 0.04, M.darkAlu, sx * (w / 2 - 0.06), 0, 0);
  }
  box(g, w - 0.12, 0.3, 0.02, M.fabricGrey, 0, 0.38, -d / 2 + 0.05);   // modesty panel
  return g;
}
export function monitor(p, x, y, z, ry, screenTex = null, {w = 0.6, h = 0.36} = {}) {
  const g = group(p, x, y, z, ry);
  box(g, 0.22, 0.012, 0.16, M.darkAlu, 0, 0, 0);
  box(g, 0.035, 0.24, 0.025, M.darkAlu, 0, 0.012, -0.03);
  rbox(g, w, h, 0.025, 0.006, M.blackPlastic, 0, 0.17, -0.01);
  const scr = new THREE.MeshStandardMaterial({color: 0xffffff, map: screenTex, emissive: 0xffffff, emissiveMap: screenTex, emissiveIntensity: screenTex ? 0.55 : 0, roughness: 0.25});
  if (!screenTex) scr.color.set(0x0a0b0c);
  mesh(new THREE.PlaneGeometry(w - 0.025, h - 0.025), scr, g, 0, 0.17 + h / 2, 0.004, 0, {cast: false});
  return g;
}
export function keyboard(p, x, y, z, ry) { const g = group(p, x, y, z, ry); rbox(g, 0.42, 0.018, 0.14, 0.004, M.blackPlastic, 0, 0, 0); rbox(g, 0.07, 0.025, 0.11, 0.01, M.blackPlastic, 0.3, 0, 0.01); return g; }
export function laptop(p, x, y, z, ry, screenTex) {
  const g = group(p, x, y, z, ry);
  rbox(g, 0.34, 0.016, 0.24, 0.006, M.alu, 0, 0, 0);
  box(g, 0.29, 0.002, 0.1, M.blackPlastic, 0, 0.016, 0.02);
  const lid = group(g, 0, 0.016, -0.12); lid.rotation.x = -0.32;
  rbox(lid, 0.34, 0.235, 0.008, 0.005, M.alu, 0, 0, 0);
  const scr = new THREE.MeshStandardMaterial({map: screenTex, emissive: 0xffffff, emissiveMap: screenTex, emissiveIntensity: 0.75, roughness: 0.2});
  mesh(new THREE.PlaneGeometry(0.31, 0.2), scr, lid, 0, 0.118, 0.0045, 0, {cast: false});
  g.userData.screen = scr; g.userData.lid = lid;
  return g;
}
// ---------- task chair ----------
export function taskChair(p, x, z, ry, mat = M.fabricGrey) {
  const g = group(p, x, 0, z, ry);
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2;
    const leg = box(g, 0.035, 0.03, 0.3, M.darkAlu, Math.sin(a) * 0.15, 0.04, Math.cos(a) * 0.15, a);
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), M.blackPlastic); w.position.set(Math.sin(a) * 0.3, 0.03, Math.cos(a) * 0.3); g.add(w);
  }
  cyl(g, 0.025, 0.03, 0.36, M.steel, 0, 0.06, 0);
  rbox(g, 0.5, 0.08, 0.48, 0.03, mat, 0, 0.42, 0.02);
  rbox(g, 0.46, 0.55, 0.07, 0.03, mat, 0, 0.56, -0.24);
  box(g, 0.04, 0.2, 0.04, M.darkAlu, 0, 0.45, -0.24);
  for (const sx of [-1, 1]) { box(g, 0.03, 0.2, 0.03, M.darkAlu, sx * 0.25, 0.48, -0.02); rbox(g, 0.06, 0.03, 0.26, 0.01, M.blackPlastic, sx * 0.25, 0.68, 0.0); }
  return g;
}

// ---------- loft conference chair: black leather shell on a slim black-steel frame ----------
let _leather = null, _steel = null;
function chairMats() {
  if (!_leather) {
    _leather = new THREE.MeshPhysicalMaterial({color: 0x241f1c, roughness: 0.42, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.4, sheen: 0.3, sheenColor: new THREE.Color(0x4a3a30)});
    _steel = new THREE.MeshStandardMaterial({color: 0x161718, roughness: 0.38, metalness: 0.75});
  }
  return [_leather, _steel];
}
export function confChair(p, x, z, ry, {high = false} = {}) {
  const [lea, st] = chairMats();
  const g = group(p, x, 0, z, ry);
  const seatY = 0.44, bh = high ? 0.68 : 0.46;
  rbox(g, 0.52, 0.08, 0.5, 0.035, lea, 0, seatY, 0.02);                    // seat cushion
  const back = new THREE.Group(); back.position.set(0, seatY + 0.06, -0.22); back.rotation.x = -0.14; g.add(back);
  rbox(back, 0.5, bh, 0.07, 0.035, lea, 0, 0, 0);                          // backrest
  rbox(back, 0.44, bh - 0.08, 0.02, 0.01, st, 0, 0.04, -0.045);           // steel back plate
  // frame: two side sleds (front leg, back leg, floor runner) + seat rails
  for (const sx of [-0.25, 0.25]) {
    box(g, 0.025, seatY, 0.025, st, sx, 0, 0.2);
    box(g, 0.025, seatY + 0.05, 0.025, st, sx, 0, -0.2);
    box(g, 0.025, 0.02, 0.44, st, sx, 0, 0);
    box(g, 0.025, 0.025, 0.46, st, sx, seatY - 0.03, 0);
    box(g, 0.02, 0.2, 0.02, st, sx, seatY + 0.08, 0.05);                   // arm post
    rbox(g, 0.05, 0.025, 0.36, 0.01, lea, sx, seatY + 0.27, 0.02);        // leather arm pad
  }
  box(g, 0.5, 0.02, 0.02, st, 0, 0.12, -0.2);
  return g;
}
// ---------- plant (simple potted fallback) ----------
export function planter(p, x, z, h = 0.6, r = 0.28) {
  const g = group(p, x, 0, z);
  cyl(g, r, r * 0.85, h, solid(0xe8e4dc, 0.5), 0, 0, 0, 28);
  cyl(g, r * 0.92, r * 0.92, 0.02, M.soil, 0, h - 0.03, 0, 24);
  return g;
}
// ---------- documents ----------
export function folder(p, x, y, z, ry, mat = M.blueFolder) {
  const g = group(p, x, y, z, ry);
  rbox(g, 0.235, 0.004, 0.31, 0.002, mat, 0, 0, 0);                       // back cover
  for (let i = 0; i < 4; i++) box(g, 0.215, 0.0018, 0.29, M.paper, 0.004, 0.004 + i * 0.002, 0.004);
  const hinge = group(g, -0.1175, 0.013, 0);                              // front cover opens on the spine (left edge)
  rbox(hinge, 0.235, 0.004, 0.31, 0.002, mat, 0.1175, 0, 0);
  g.userData.cover = hinge; return g;
}
export function papers(p, x, y, z, ry, n = 3) { const g = group(p, x, y, z, ry); for (let i = 0; i < n; i++) { const s = box(g, 0.21, 0.0015, 0.297, M.paper, (Math.random() - .5) * 0.01, i * 0.0016, (Math.random() - .5) * 0.01); s.rotation.y = (Math.random() - .5) * 0.08; } return g; }
export function booklet(p, x, y, z, ry, coverTex) {
  const g = group(p, x, y, z, ry);
  const cover = new THREE.MeshStandardMaterial({color: 0xffffff, map: coverTex, roughness: 0.5});
  box(g, 0.15, 0.011, 0.21, M.paper, 0, 0, 0);
  const hinge = group(g, -0.075, 0.0115, 0);
  const cv = mesh(new THREE.BoxGeometry(0.15, 0.0015, 0.21), [M.paper, M.paper, cover, M.paper, M.paper, M.paper], hinge, 0.075, 0.0008, 0);
  g.userData.cover = hinge; return g;
}
export function envelope(p, x, y, z, ry) { const g = group(p, x, y, z, ry); rbox(g, 0.24, 0.008, 0.33, 0.003, M.greyEnv, 0, 0, 0); return g; }
export function tablet(p, x, y, z, ry, screenTex) {
  const g = group(p, x, y, z, ry); rbox(g, 0.18, 0.008, 0.25, 0.008, M.blackPlastic, 0, 0, 0);
  const scr = new THREE.MeshStandardMaterial({map: screenTex, emissive: 0xffffff, emissiveMap: screenTex, emissiveIntensity: 0.6, roughness: 0.2});
  const s = mesh(new THREE.PlaneGeometry(0.165, 0.235), scr, g, 0, 0.0085, 0, 0, {cast: false}); s.rotation.x = -Math.PI / 2; return g;
}
const cupGeo = new THREE.LatheGeometry([[0, 0], [0.032, 0], [0.034, 0.004], [0.044, 0.12], [0.046, 0.122], [0, 0.122]].map(v => new THREE.Vector2(v[0], v[1])), 28);
const lidGeo = new THREE.CylinderGeometry(0.046, 0.047, 0.012, 28);
export function redCup(p, x, y, z) {
  const g = group(p, x, y, z);
  mesh(cupGeo, M.redCup, g); const l = mesh(lidGeo, solid(0xf4f1ea, 0.45), g, 0, 0.126, 0);
  mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.045, 28, 1, true), solid(0x9b7653, 0.9), g, 0, 0.05, 0);
  return g;
}
export function mug(p, x, y, z, color = 0xf2efe8) {
  const g = group(p, x, y, z);
  const mat = solid(color, 0.25);
  mesh(new THREE.CylinderGeometry(0.04, 0.036, 0.095, 24), mat, g, 0, 0.048, 0);
  const h = mesh(new THREE.TorusGeometry(0.026, 0.007, 8, 16, Math.PI), mat, g, 0.04, 0.05, 0); h.rotation.z = -Math.PI / 2;
  return g;
}

// ---------- big wall screen ----------
export function wallScreen(p, x, y, z, ry, w, h) {
  const c = document.createElement('canvas'); c.width = 1600; c.height = Math.round(1600 * h / w);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const g = group(p, x, y, z, ry);
  rbox(g, w + 0.05, h + 0.05, 0.05, 0.01, M.blackPlastic, 0, -0.025, 0);
  const mat = new THREE.MeshStandardMaterial({map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.5, roughness: 0.35});
  mesh(new THREE.PlaneGeometry(w, h), mat, g, 0, h / 2, 0.027, 0, {cast: false});
  return {group: g, canvas: c, ctx: c.getContext('2d'), tex: t, mat, draw(fn) { fn(this.ctx, c.width, c.height); t.needsUpdate = true; }};
}

// ---------- screen textures ----------
export function spreadsheetTex(seed = 1, accent = '#1f6f54') {
  return canvasTex(512, 320, (g, w, h) => {
    let r = seed * 7919; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
    g.fillStyle = '#f5f7f9'; g.fillRect(0, 0, w, h);
    g.fillStyle = accent; g.fillRect(0, 0, w, 26);
    g.fillStyle = '#e3e8ec'; g.fillRect(0, 26, 46, h);
    g.strokeStyle = '#d5dbe0'; g.lineWidth = 1;
    for (let y = 26; y < h; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    for (let x = 46; x < w; x += 70) { g.beginPath(); g.moveTo(x, 26); g.lineTo(x, h); g.stroke(); }
    g.fillStyle = '#4b5660';
    for (let y = 30; y < h; y += 16) for (let x = 52; x < w; x += 70) if (rnd() > 0.25) g.fillRect(x, y + 4, 20 + rnd() * 40, 6);
    if (rnd() > 0.4) { g.fillStyle = '#fff'; g.fillRect(w * 0.55, h * 0.4, w * 0.4, h * 0.5); g.strokeStyle = accent; g.lineWidth = 3; g.beginPath(); let yy = h * 0.8; g.moveTo(w * 0.57, yy); for (let i = 1; i < 9; i++) { yy -= (rnd() - 0.35) * 18; g.lineTo(w * 0.57 + i * w * 0.045, yy); } g.stroke(); }
  });
}
export function photoWallTex() {
  // Mei's wall of colourful cup photos (fictional, no real people)
  return canvasTex(1024, 512, (g, w, h) => {
    g.fillStyle = '#d9d2c4'; g.fillRect(0, 0, w, h);
    let r = 77; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
    const bg = ['#f2d0a7', '#a7c7e7', '#f6e3b4', '#c9e4c5', '#e8b4bc', '#d7c9f0', '#b8d8d8', '#f0c8a0'];
    for (let i = 0; i < 46; i++) {
      const x = 20 + (i % 10) * 99 + rnd() * 10, y = 16 + Math.floor(i / 10) * 98 + rnd() * 8, s = 84;
      g.save(); g.translate(x + s / 2, y + s / 2); g.rotate((rnd() - 0.5) * 0.12);
      g.fillStyle = '#fff'; g.fillRect(-s / 2 - 4, -s / 2 - 4, s + 8, s + 18);
      g.fillStyle = bg[i % bg.length]; g.fillRect(-s / 2, -s / 2, s, s);
      g.fillStyle = '#b3171d'; g.beginPath(); g.moveTo(-14, -18); g.lineTo(14, -18); g.lineTo(10, 26); g.lineTo(-10, 26); g.closePath(); g.fill();
      g.fillStyle = '#f4f1ea'; g.fillRect(-15, -22, 30, 5);
      if (rnd() > 0.5) { g.fillStyle = '#c9a27a'; g.beginPath(); g.ellipse(-28, 20, 12, 18, 0.4, 0, 7); g.fill(); }
      g.fillStyle = '#d33'; g.beginPath(); g.arc(s / 2 - 6, -s / 2 + 6, 4, 0, 7); g.fill();
      g.restore();
    }
  });
}
export function coverTex(title, color = '#1f5e47') {
  return canvasTex(300, 420, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.9)'; g.font = '600 30px "IBM Plex Sans Arabic"'; g.textAlign = 'center'; g.direction = 'rtl';
    g.fillText(title, w / 2, h * 0.45);
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 3; g.beginPath(); g.arc(w / 2, h * 0.25, 30, 0, 7); g.stroke();
  });
}
