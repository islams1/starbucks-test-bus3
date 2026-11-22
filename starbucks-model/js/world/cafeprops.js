// Small things made to read as real at arm's length: paper cups turned on a lathe (tapered wall, rolled rim, domed lid,
// kraft sleeve), glazed mugs with a handle and a latte surface, a grinder, syrup bottles with pumps, the espresso
// machine (Sketchfab, CC BY), wall clocks that run (Poly Haven, CC0) and printed notices that say something useful.
// The counter, the bakery case, the register, the fridge and the menu of the time are in cafe2002.js.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {onUpdate} from '../core/engine.js';
import {model} from '../core/assets.js';
import {pbr, canvasTex} from './materials.js';
const EN = new URLSearchParams(location.search).get('lang') === 'en';
const F = EN ? 'Inter, "IBM Plex Sans Arabic", sans-serif' : '"IBM Plex Sans Arabic", Inter, sans-serif';

// ---------------------------------------------------------------- materials
let MAT = null;
function mats() {
  if (MAT) return MAT;
  const quartz = canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#ede8e0'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { const s = Math.random() < 0.92 ? 1.4 : 3; const v = 150 + Math.random() * 90; g.fillStyle = `rgba(${v - 20},${v - 28},${v - 40},${0.25 + Math.random() * 0.35})`; g.fillRect(Math.random() * w, Math.random() * h, s, s); }
    g.strokeStyle = 'rgba(150,140,128,.12)'; g.lineWidth = 2.2;
    for (let k = 0; k < 5; k++) { g.beginPath(); let x = Math.random() * w, y = 0; g.moveTo(x, y); while (y < h) { x += (Math.random() - 0.5) * 70; y += 40 + Math.random() * 40; g.lineTo(x, y); } g.stroke(); }
  });
  quartz.wrapS = quartz.wrapT = THREE.RepeatWrapping;
  const kraft = canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = '#a57e55'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(70,45,20,${Math.random() * 0.12})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 1); }
    g.fillStyle = 'rgba(40,28,16,.75)'; g.font = `600 34px ${F}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(EN ? 'AL-MIDAN · CAREFUL, HOT' : 'الميدان · احذر، ساخن', w / 2, h / 2);
  });
  const latte = canvasTex(256, 256, (g, w, h) => {
    const r = w / 2; g.fillStyle = '#6b4126'; g.beginPath(); g.arc(r, r, r, 0, 7); g.fill();
    const gr = g.createRadialGradient(r, r, 4, r, r, r); gr.addColorStop(0, 'rgba(255,240,220,.0)'); gr.addColorStop(0.75, 'rgba(120,72,40,.0)'); gr.addColorStop(1, 'rgba(60,32,16,.6)'); g.fillStyle = gr; g.fill();
    g.fillStyle = '#f2e6d4';                                     // a simple rosetta of foam
    g.beginPath(); g.ellipse(r, r + 18, 46, 54, 0, 0, 7); g.fill();
    g.fillStyle = '#6b4126'; for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(r, r + 50 - k * 16, 40 - k * 6, 5, 0, 0, 7); g.fill(); }
    g.fillStyle = '#f2e6d4'; g.fillRect(r - 2, r - 40, 4, 70);
  });
  MAT = {
    quartz: new THREE.MeshPhysicalMaterial({map: quartz, roughness: 0.16, clearcoat: 0.7, clearcoatRoughness: 0.08, color: 0xffffff}),
    slat: pbr('oak_veneer_01', [0.25, 0.25], {roughness: 0.55, color: 0xd9c6a6}),
    body: new THREE.MeshStandardMaterial({color: 0x2a2622, roughness: 0.7}),
    plinth: new THREE.MeshStandardMaterial({color: 0x111213, roughness: 0.5, metalness: 0.2}),
    paper: new THREE.MeshStandardMaterial({color: 0xf6f3ec, roughness: 0.72, side: THREE.DoubleSide}),
    lid: new THREE.MeshPhysicalMaterial({color: 0x2c221c, roughness: 0.32, clearcoat: 0.4}),
    sleeve: new THREE.MeshStandardMaterial({map: kraft, roughness: 0.85}),
    glaze: new THREE.MeshPhysicalMaterial({color: 0xf3efe7, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1}),
    glazeDark: new THREE.MeshPhysicalMaterial({color: 0x2f3b38, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.12}),
    latte: new THREE.MeshStandardMaterial({map: latte, roughness: 0.4}),
    steel: new THREE.MeshStandardMaterial({color: 0xd3d6da, roughness: 0.18, metalness: 1}),
    brushed: new THREE.MeshStandardMaterial({color: 0xb9bdc2, roughness: 0.38, metalness: 1}),
    black: new THREE.MeshStandardMaterial({color: 0x1a1b1d, roughness: 0.4, metalness: 0.2}),
    glass: new THREE.MeshPhysicalMaterial({color: 0xf4fbfc, roughness: 0.03, transmission: 0, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.6}),
    led: new THREE.MeshStandardMaterial({color: 0xfff3dc, emissive: 0xffe3b0, emissiveIntensity: 2.2}),
    milk: new THREE.MeshPhysicalMaterial({color: 0xfdfdfb, roughness: 0.25, clearcoat: 0.5}),
  };
  return MAT;
}

/** the polished quartz of the counter tops */
export const quartzMaterial = () => mats().quartz;

// ---------------------------------------------------------------- cups and mugs (lathe profiles, metres, base at y 0)
const P2 = (x, y) => new THREE.Vector2(x, y);
let GEO = null;
function geos() {
  if (GEO) return GEO;
  const cup = new THREE.LatheGeometry([P2(0, 0.004), P2(0.0262, 0.004), P2(0.0275, 0.0), P2(0.0408, 0.116)], 28);
  const rim = new THREE.TorusGeometry(0.0412, 0.0024, 8, 32); rim.rotateX(Math.PI / 2); rim.translate(0, 0.117, 0);
  const lid = new THREE.LatheGeometry([P2(0.0432, 0.114), P2(0.0438, 0.121), P2(0.041, 0.124), P2(0.036, 0.1255), P2(0.033, 0.131), P2(0.012, 0.133), P2(0, 0.1332)], 28);
  const sleeve = new THREE.LatheGeometry([P2(0.0326, 0.036), P2(0.0378, 0.088)], 28);
  // a mug: out along the outside, over the rim, down the inside
  const mug = new THREE.LatheGeometry([P2(0, 0.0015), P2(0.031, 0), P2(0.0385, 0.005), P2(0.0405, 0.03), P2(0.041, 0.088), P2(0.0402, 0.0925), P2(0.0368, 0.0915), P2(0.036, 0.03), P2(0.033, 0.013), P2(0, 0.012)], 32);
  const handle = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.038, 0.076, 0), new THREE.Vector3(0.058, 0.074, 0), new THREE.Vector3(0.066, 0.052, 0), new THREE.Vector3(0.059, 0.027, 0), new THREE.Vector3(0.039, 0.024, 0)]), 16, 0.0058, 8);
  const coffee = new THREE.CircleGeometry(0.0362, 28); coffee.rotateX(-Math.PI / 2); coffee.translate(0, 0.078, 0);
  GEO = {cup, rim, lid, sleeve, mug, handle, coffee};
  return GEO;
}
const shade = (o) => { o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };
/** a take-away paper cup with a lid and a sleeve */
export function paperCup({lid = true} = {}) {
  const M = mats(), G = geos(), g = new THREE.Group();
  g.add(new THREE.Mesh(G.cup, M.paper), new THREE.Mesh(G.rim, M.paper), new THREE.Mesh(G.sleeve, M.sleeve));
  if (lid) g.add(new THREE.Mesh(G.lid, M.lid));
  return shade(g);
}
/** a stack of n empty cups (nested: each one 1.4 cm above the last) */
export function cupStack(n = 6) { const g = new THREE.Group(); for (let i = 0; i < n; i++) { const c = paperCup({lid: false}); c.children[2].visible = false; c.position.y = i * 0.014; g.add(c); } return g; }
/** a glazed ceramic mug, with a latte in it or empty */
export function mug({full = true, dark = false} = {}) {
  const M = mats(), G = geos(), g = new THREE.Group(), gl = dark ? M.glazeDark : M.glaze;
  g.add(new THREE.Mesh(G.mug, gl), new THREE.Mesh(G.handle, gl));
  if (full) g.add(new THREE.Mesh(G.coffee, M.latte));
  return shade(g);
}

// ---------------------------------------------------------------- helpers
/** scale a loaded model uniformly so its size along `axis` is `size`, stand it on y 0, centred on x / z */
export function fit(obj, size, axis = 'y') {
  const b = new THREE.Box3().setFromObject(obj), s = b.getSize(new THREE.Vector3());
  obj.scale.multiplyScalar(size / Math.max(1e-6, s[axis]));
  const b2 = new THREE.Box3().setFromObject(obj), c = b2.getCenter(new THREE.Vector3());
  obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= b2.min.y;
  const g = new THREE.Group(); g.add(obj); return shade(g);
}
function mesh(parent, geo, mat, x, y, z) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; }
const boxG = (w, h, d) => new THREE.BoxGeometry(w, h, d);

// ---------------------------------------------------------------- the barista's things on the back counter
/** the espresso machine on the back counter, facing the barista (+z) */
export async function espresso(R, x, y, z, ry = 0) {
  try { const m = fit(await model('espresso'), 0.78, 'x'); m.position.set(x, y, z); m.rotation.y = ry; R.add(m); return m; } catch (e) { console.warn('espresso', e); }
}
/** a grinder: dark body, smoked hopper with beans */
export function grinder(R, x, y, z) {
  const M = mats(), g = new THREE.Group(); g.position.set(x, y, z); R.add(g);
  mesh(g, boxG(0.18, 0.04, 0.24), M.black, 0, 0.02, 0);
  mesh(g, new THREE.CylinderGeometry(0.075, 0.085, 0.3, 24), M.black, 0, 0.19, -0.02);
  mesh(g, new THREE.CylinderGeometry(0.03, 0.03, 0.05, 16), M.steel, 0, 0.12, 0.07).rotation.x = Math.PI / 2;
  const hop = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.05, 0.2, 24, 1, true), new THREE.MeshPhysicalMaterial({color: 0x3a2a20, roughness: 0.1, transparent: true, opacity: 0.45, side: THREE.DoubleSide}));
  hop.position.set(0, 0.44, -0.02); g.add(hop);
  mesh(g, new THREE.CylinderGeometry(0.075, 0.048, 0.13, 20), new THREE.MeshStandardMaterial({color: 0x3b2416, roughness: 0.9}), 0, 0.405, -0.02);
  return shade(g);
}
/** a row of syrup bottles with pumps (labels in the bottle colours) */
export function syrups(R, x, y, z, n = 6) {
  const g = new THREE.Group(); g.position.set(x, y, z); R.add(g);
  const cols = [0xb8732e, 0x6b3b1f, 0xd9b26f, 0x9a2f3a, 0xe8dcc0, 0x4f7a3a];
  const bottle = new THREE.LatheGeometry([P2(0, 0), P2(0.033, 0), P2(0.035, 0.005), P2(0.035, 0.2), P2(0.03, 0.225), P2(0.014, 0.245), P2(0.014, 0.262), P2(0, 0.262)], 20);
  for (let i = 0; i < n; i++) {
    const glass = new THREE.MeshPhysicalMaterial({color: cols[i % cols.length], roughness: 0.08, clearcoat: 1, transparent: true, opacity: 0.85});
    const b = mesh(g, bottle, glass, i * 0.085, 0, 0);
    mesh(g, new THREE.CylinderGeometry(0.0355, 0.0355, 0.08, 20), new THREE.MeshStandardMaterial({color: 0xf3eee2, roughness: 0.7}), i * 0.085, 0.11, 0);
    mesh(g, new THREE.CylinderGeometry(0.018, 0.018, 0.03, 12), mats().black, i * 0.085, 0.277, 0);
    mesh(g, new THREE.CylinderGeometry(0.004, 0.004, 0.05, 6), mats().steel, i * 0.085, 0.315, 0);
    const nz = mesh(g, boxG(0.05, 0.008, 0.012), mats().black, i * 0.085 + 0.02, 0.338, 0); nz.rotation.z = 0.15;
    b.castShadow = true;
  }
  return g;
}

// ---------------------------------------------------------------- wall clocks that run (one second per second)
// The model's hands are drawn at the shop-window pose (about 10:08:30): each hand's rest angle is read from its own
// tip (the vertex farthest from the centre), and the hand is turned from there.
const CLOCKS = [];
const CAFE_CLOCK = {base: 8 * 60 + 10, t: 0};
export function setClockTime(min) { CAFE_CLOCK.base = min; CAFE_CLOCK.t = 0; }
export const clockMinutes = () => CAFE_CLOCK.base + CAFE_CLOCK.t / 60;
function restAngle(mesh) {
  const p = mesh.geometry.attributes.position; let best = 0, a = 0;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), d = x * x + y * y; if (d > best) { best = d; a = Math.atan2(x, y); } }
  return a;                                    // clockwise from 12
}
onUpdate((dt) => {
  CAFE_CLOCK.t += dt;
  for (const C of CLOCKS) {
    const tot = C.time() * 60, s = Math.floor(tot % 60), m = (tot / 60) % 60, h = (tot / 3600) % 12;
    for (const [hand, ang] of [[C.sec, s / 60], [C.min, m / 60], [C.hour, h / 12]]) if (hand) hand.mesh.rotation.z = -(ang * Math.PI * 2 - hand.rest);
  }
});
/** a wall clock at (x, y, z) facing +z turned by ry; time: () => minutes since midnight (the café's clock by default) */
export async function wallClock(R, x, y, z, ry = 0, diameter = 0.55, time = clockMinutes) {
  try {
    const src = await model('wall_clock'), ck = src.clone(true);
    const b = new THREE.Box3().setFromObject(ck), s = b.getSize(new THREE.Vector3());
    ck.scale.multiplyScalar(diameter / Math.max(s.x, s.y)); ck.position.set(x, y, z); ck.rotation.y = ry; R.add(ck); shade(ck);
    const hand = (n) => { const m = ck.getObjectByName(n); return m && m.isMesh ? {mesh: m, rest: restAngle(m)} : null; };
    CLOCKS.push({sec: hand('wall_clock_second_hand'), min: hand('wall_clock_minute_hand'), hour: hand('wall_clock_hours_hand'), time});
    return ck;
  } catch (e) { console.warn('clock', e); }
}

// ---------------------------------------------------------------- the menu board and the notices
/** a printed A4 notice (portrait), pinned or framed */
export function notice(R, x, y, z, ry, lines, {w = 0.3, frame = true, head = '#2f4a3f'} = {}) {
  const t = canvasTex(620, 860, (g, W, H) => {
    g.fillStyle = '#fbf9f4'; g.fillRect(0, 0, W, H);
    g.fillStyle = head; g.fillRect(0, 0, W, 150);
    g.fillStyle = '#f7f3ea'; g.font = `700 54px ${F}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(lines[0], W / 2, 78);
    g.fillStyle = '#2b2a26'; g.font = `500 40px ${F}`;
    let y = 230;
    for (const para of lines.slice(1)) {
      const words = para.split(' '); let ln = '';
      for (const wd of words) { const tt = ln ? ln + ' ' + wd : wd; if (g.measureText(tt).width > W - 90) { g.fillText(ln, W / 2, y); y += 56; ln = wd; } else ln = tt; }
      if (ln) { g.fillText(ln, W / 2, y); y += 56; }
      y += 34;
    }
  });
  const h = w * 860 / 620, g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; R.add(g);
  if (frame) mesh(g, boxG(w + 0.03, h + 0.03, 0.015), mats().black, 0, 0, -0.008);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({map: t, roughness: 0.85})); p.position.z = 0.001; g.add(p);
  return g;
}
