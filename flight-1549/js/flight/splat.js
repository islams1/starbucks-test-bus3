// The geese hitting the windscreen at the strike: each one leaves a thin, translucent smear of blood and remains on the
// outside of the glass, dragged up the screen by the 200-knot airflow, and a burst of feathers whipped back over the roof.
// The smears stay on the glass for the rest of the flight.
import * as THREE from 'three';
import {DecalGeometry} from 'three/addons/geometries/DecalGeometry.js';
import {onUpdate} from '../core/engine.js';
import {CK} from './cockpit.js';
import {AC} from './aircraft.js';
import {WINDSCREEN} from './glass.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rnd = (a, b) => a + Math.random() * (b - a);

/** a smear seen through the glass: a dark clotted core low down, streaks and droplets dragged upward, a few pale bits */
function smearTexture(seed) {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  let s = seed * 9301 + 49297; const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const cx = S * (0.45 + r() * 0.1), cy = S * 0.74, R = S * (0.14 + r() * 0.04);
  // streaks: tapered, fanning out a little as the air drags them up the glass
  for (let i = 0; i < 16; i++) {
    const a = -Math.PI / 2 + (r() - 0.5) * 0.9, len = R * (1.2 + r() * 3.2), w = R * (0.08 + r() * 0.22);
    const x0 = cx + Math.cos(a + Math.PI / 2) * (r() - 0.5) * R * 1.4, y0 = cy - R * 0.3;
    const x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len, nx = -Math.sin(a), ny = Math.cos(a);
    g.globalAlpha = 0.45 + r() * 0.4; g.fillStyle = r() < 0.5 ? '#6d0f08' : '#841a0e';
    g.beginPath(); g.moveTo(x0 + nx * w, y0 + ny * w); g.lineTo(x1 + nx * w * 0.08, y1 + ny * w * 0.08); g.lineTo(x1 - nx * w * 0.08, y1 - ny * w * 0.08); g.lineTo(x0 - nx * w, y0 - ny * w); g.fill();
    g.beginPath(); g.arc(x1, y1, w * 0.35, 0, Math.PI * 2); g.fill();
  }
  // the core: a ragged blob, darkest where it is thickest
  g.globalAlpha = 1;
  const gr = g.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.15);
  gr.addColorStop(0, '#2c0503'); gr.addColorStop(0.55, '#5c0c07'); gr.addColorStop(1, 'rgba(140,30,16,0.75)');
  g.fillStyle = gr; g.beginPath();
  for (let i = 0; i <= 48; i++) {
    const a = i / 48 * Math.PI * 2, k = R * (0.72 + 0.28 * Math.sin(a * 3 + seed) * Math.sin(a * 5 + seed * 2) + r() * 0.22);
    const x = cx + Math.cos(a) * k * 1.15, y = cy + Math.sin(a) * k * (Math.sin(a) < 0 ? 1.25 : 0.8);
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.fill();
  // droplets thrown out around it, most of them up the glass
  for (let i = 0; i < 38; i++) {
    const a = -Math.PI / 2 + (r() - 0.5) * (r() < 0.75 ? 1.6 : 6), d = R * (1 + r() * 2.6), rr = (1 + r() * (r() < 0.8 ? 3 : 7)) * S / 256;
    g.globalAlpha = 0.6 + r() * 0.4; g.fillStyle = r() < 0.6 ? '#5a0b06' : '#8c1d10';
    g.beginPath(); g.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d, rr, rr * (1.2 + r()), a + Math.PI / 2, 0, Math.PI * 2); g.fill();
  }
  // remains: greyish and pale flecks, and a down feather or two stuck in the mess
  for (let i = 0; i < 10; i++) {
    g.globalAlpha = 0.9; g.fillStyle = ['#4f463f', '#6b6159', '#a99f92', '#3a332e'][i % 4];
    const x = cx + (r() - 0.5) * R * 1.6, y = cy + (r() - 0.6) * R * 1.4, w = (2 + r() * 5) * S / 256;
    g.beginPath(); g.ellipse(x, y, w, w * (0.4 + r() * 0.5), r() * Math.PI, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = '#8f8478'; g.lineWidth = 1.2 * S / 256; g.globalAlpha = 0.8;
  for (let i = 0; i < 2; i++) {
    const x = cx + (r() - 0.5) * R * 1.4, y = cy + (r() - 0.5) * R, a = -Math.PI / 2 + (r() - 0.5) * 1.2, L = R * (0.4 + r() * 0.5);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
    for (let k = 1; k < 7; k++) { const px = x + Math.cos(a) * L * k / 7, py = y + Math.sin(a) * L * k / 7; g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a + 2.4) * 10, py + Math.sin(a + 2.4) * 10); g.moveTo(px, py); g.lineTo(px + Math.cos(a - 2.4) * 10, py + Math.sin(a - 2.4) * 10); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// the captain's windscreen: the plane of its pane (glass.js), in the cockpit frame (+z forward, +x left)
const WS = WINDSCREEN;
/** where a line from the captain's eye meets the windscreen (cockpit frame): point, outward normal, "up the glass" */
function onGlass(dir) {
  const d = dir.clone().normalize(), n = WS.n.clone();
  const p = d.multiplyScalar(WS.c.dot(n) / Math.max(0.2, d.dot(n)));
  const up = V(0, 1, 0).addScaledVector(n, -n.y).normalize();       // the air runs up the raked glass toward the roof
  return {p: p.clone().addScaledVector(n, 0.004), n, up, dist: p.length()};
}

/** what a goose leaves on a windscreen at 200 knots, seen from inside against the sky: not a spray of red but a broad,
 *  thin, translucent smear — brown-red where it is thick, orange-brown where the light comes through — dragged up the glass
 *  by the airflow into soft streaks, with pale bits of tissue, a few feathers and down stuck in it, and fine spatter
 *  around. The core sits low in the picture (the plane is moved so that it lands on the point of impact). */
function windscreenSmear(seed) {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  let s = seed * 9301 + 49297; const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const cx = S * (0.46 + r() * 0.08), cy = S * 0.74, R = S * (0.12 + r() * 0.03);
  const blob = (x, y, rad, col, a) => { const q = g.createRadialGradient(x, y, 0, x, y, rad); q.addColorStop(0, `rgba(${col},${a})`); q.addColorStop(1, `rgba(${col},0)`); g.fillStyle = q; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill(); };
  // the thin film: many faint, soft overlapping stains, spread wide and pushed upward (thinner the further it went)
  g.filter = 'blur(3px)';
  for (let i = 0; i < 90; i++) {
    const up = r() ** 1.4, x = cx + (r() - 0.5) * R * (1.6 + up * 1.8), y = cy - up * R * 3.4 + (r() - 0.5) * R * 0.5;
    blob(x, y, R * (0.25 + r() * 0.5) * (1 - up * 0.4), r() < 0.6 ? '142,62,38' : '118,44,30', 0.08 + (1 - up) * 0.13);
  }
  // streaks: soft, wide, faint drags up the glass, a few thinner and darker inside them
  g.lineCap = 'round';
  for (let i = 0; i < 14; i++) {
    const x0 = cx + (r() - 0.5) * R * 1.3, y0 = cy - R * 0.2, len = R * (1.5 + r() * 2.6), bend = (r() - 0.5) * R * 0.6;
    g.strokeStyle = `rgba(${r() < 0.5 ? '134,56,36' : '106,40,28'},${0.12 + r() * 0.13})`; g.lineWidth = R * (0.08 + r() * 0.22);
    g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + bend, y0 - len * 0.5, x0 + bend * 1.6, y0 - len); g.stroke();
  }
  g.filter = 'blur(1px)';
  for (let i = 0; i < 9; i++) {
    const x0 = cx + (r() - 0.5) * R, y0 = cy - R * 0.1, len = R * (1 + r() * 2), bend = (r() - 0.5) * R * 0.4;
    g.strokeStyle = `rgba(88,30,20,${0.26 + r() * 0.2})`; g.lineWidth = 1.5 + r() * 3;
    g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + bend, y0 - len * 0.5, x0 + bend * 1.5, y0 - len); g.stroke();
  }
  // the core: thicker, darker, uneven — still not opaque
  g.filter = 'blur(2px)';
  for (let i = 0; i < 30; i++) blob(cx + (r() - 0.5) * R * 1.1, cy + (r() - 0.5) * R * 0.7, R * (0.15 + r() * 0.3), r() < 0.5 ? '92,30,20' : '114,40,26', 0.28 + r() * 0.2);
  // pale tissue and fat (not white: pinkish, yellowish grey)
  g.filter = 'blur(0.6px)';
  for (let i = 0; i < 16; i++) {
    g.fillStyle = `rgba(${['196,160,136', '214,196,160', '176,140,120', '160,150,138'][i % 4]},${0.45 + r() * 0.35})`;
    const x = cx + (r() - 0.5) * R * 1.3, y = cy + (r() - 0.6) * R, w = S * (0.004 + r() * 0.012);
    g.beginPath(); g.ellipse(x, y, w, w * (0.4 + r() * 0.6), r() * 3, 0, Math.PI * 2); g.fill();
  }
  // feathers stuck in it (grey-brown vanes with their barbs) and wisps of down
  g.filter = 'none';
  for (let i = 0; i < 3; i++) {
    const x = cx + (r() - 0.5) * R * 1.6, y = cy - r() * R * 1.4, a = -Math.PI / 2 + (r() - 0.5) * 1.4, L = R * (0.5 + r() * 0.6);
    const col = ['92,84,76', '118,108,96', '70,64,58'][i % 3];
    g.strokeStyle = `rgba(${col},0.85)`; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
    g.lineWidth = 1;
    for (let k = 1; k < 16; k++) {
      const t = k / 16, px = x + Math.cos(a) * L * t, py = y + Math.sin(a) * L * t, bw = L * 0.22 * Math.sin(Math.PI * Math.min(1, t * 1.15));
      for (const sd of [1, -1]) { g.strokeStyle = `rgba(${col},${0.35 + r() * 0.3})`; g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a + sd * 2.2) * bw, py + Math.sin(a + sd * 2.2) * bw); g.stroke(); }
    }
  }
  for (let i = 0; i < 5; i++) {
    const x = cx + (r() - 0.5) * R * 2.4, y = cy - r() * R * 2.5;
    g.strokeStyle = `rgba(206,200,192,${0.35 + r() * 0.25})`; g.lineWidth = 0.8;
    for (let k = 0; k < 12; k++) { const a = r() * Math.PI * 2, l = S * (0.008 + r() * 0.018); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  }
  // fine spatter, mostly up the glass
  for (let i = 0; i < 70; i++) {
    const a = -Math.PI / 2 + (r() - 0.5) * (r() < 0.8 ? 1.5 : 5), d = R * (1 + r() * 3), rr = 0.8 + r() * 2.6;
    g.fillStyle = `rgba(${r() < 0.5 ? '110,44,28' : '146,70,44'},${0.3 + r() * 0.35})`;
    g.beginPath(); g.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d, rr, rr * (1.3 + r()), a + Math.PI / 2, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

/** the strike seen from the seat: n geese on the windscreen within half a second */
export function birdSplats(n = 3) {
  if (!CK.group) return;
  // in front of the captain, toward the middle of the screen, and high on the captain's left (the cockpit faces +z, +x is left)
  const dirs = [V(0.06, -0.02, 1), V(-0.42, 0.06, 1), V(0.28, 0.14, 1), V(-0.15, -0.1, 1)].slice(0, n);
  const made = [];
  dirs.forEach((dir, i) => setTimeout(() => {
    const at = onGlass(dir), size = at.dist * rnd(0.32, 0.42);
    // translucent, drawn after the river and before the glass in front of it (transparent surfaces in the cockpit must be)
    const m = new THREE.MeshBasicMaterial({map: windscreenSmear(i * 7 + 3 + Math.floor(Math.random() * 50)), transparent: true, depthWrite: false, side: THREE.DoubleSide});
    const q = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, 0.24, 0), m);   // the core sits low: it grows up the glass
    const right = new THREE.Vector3().crossVectors(at.up, at.n);
    q.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, at.up, at.n));
    q.position.copy(at.p); q.rotateZ(rnd(-0.2, 0.2)); q.scale.set(0.01, 0.01, 1); q.renderOrder = 9;
    CK.group.add(q); made.push(q);
    feathers(at);
    // it lands in a frame or two, then the air drags it a little further up the glass
    const t0 = performance.now();
    const off = onUpdate(() => {
      const k = (performance.now() - t0) / 1000;
      const s = size * Math.min(1, k / 0.06), drag = 1 + Math.min(0.45, k * 0.25);
      q.scale.set(s, s * drag, 1);
      if (k > 2) off();
    });
  }, [40, 230, 470, 620][i]));
  return made;
}

/** feathers and down blown off the impact, whipped up and back over the cockpit roof */
function feathers(at) {
  const N = 70, pos = new Float32Array(N * 3), vel = [];
  for (let i = 0; i < N; i++) {
    pos.set([at.p.x + rnd(-0.06, 0.06), at.p.y + rnd(-0.05, 0.05), at.p.z + rnd(0.0, 0.05)], i * 3);
    const v = at.up.clone().multiplyScalar(rnd(3, 14)).addScaledVector(at.n, rnd(0.5, 3)).add(V(rnd(-2, 2), 0, -rnd(1, 8)));
    vel.push(v);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const c = document.createElement('canvas'); c.width = c.height = 16; const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.beginPath(); x.ellipse(8, 8, 7, 3, 0.6, 0, Math.PI * 2); x.fill();
  const m = new THREE.PointsMaterial({color: 0x6e655c, size: 0.025, map: new THREE.CanvasTexture(c), alphaTest: 0.5, sizeAttenuation: true});
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; CK.group.add(pts);
  let t = 0;
  const off = onUpdate((dt) => {
    t += dt;
    for (let i = 0; i < N; i++) { const v = vel[i]; v.multiplyScalar(1 - dt * 0.5); pos[i * 3] += v.x * dt; pos[i * 3 + 1] += v.y * dt; pos[i * 3 + 2] += v.z * dt; }
    g.attributes.position.needsUpdate = true;
    if (t > 1.5) { off(); CK.group.remove(pts); g.dispose(); m.dispose(); }
  });
}

// ---------------------------------------------------------------- outside: the nose after the strike
/** the point of impact on the radome: a dark crushed patch with blood and remains thrown out all round it */
function craterTexture() {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), m = S / 2;
  for (let i = 0; i < 46; i++) {                               // spatter thrown out in every direction
    const a = Math.random() * Math.PI * 2, d0 = S * 0.12, d1 = S * (0.22 + Math.random() * 0.26), w = S * (0.006 + Math.random() * 0.018);
    g.globalAlpha = 0.6 + Math.random() * 0.4; g.strokeStyle = Math.random() < 0.5 ? '#6a120a' : '#8e2a16'; g.lineWidth = w; g.lineCap = 'round';
    g.beginPath(); g.moveTo(m + Math.cos(a) * d0, m + Math.sin(a) * d0); g.lineTo(m + Math.cos(a) * d1, m + Math.sin(a) * d1); g.stroke();
    g.fillStyle = g.strokeStyle; g.beginPath(); g.arc(m + Math.cos(a) * d1, m + Math.sin(a) * d1, w * 1.3, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
  const gr = g.createRadialGradient(m, m, 0, m, m, S * 0.2);
  gr.addColorStop(0, '#1f0604'); gr.addColorStop(0.45, '#4c0d07'); gr.addColorStop(0.8, '#7d1d10'); gr.addColorStop(1, 'rgba(125,29,16,0.8)');
  g.fillStyle = gr; g.beginPath();
  for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2, r = S * (0.15 + Math.random() * 0.05); i ? g.lineTo(m + Math.cos(a) * r, m + Math.sin(a) * r) : g.moveTo(m + Math.cos(a) * r, m + Math.sin(a) * r); }
  g.fill();
  g.strokeStyle = 'rgba(20,6,4,0.8)'; g.lineWidth = S * 0.006;                       // the crushed skin: a ring and cracks
  g.beginPath(); g.arc(m, m, S * 0.09, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < 9; i++) { const a = Math.random() * Math.PI * 2; g.beginPath(); g.moveTo(m + Math.cos(a) * S * 0.04, m + Math.sin(a) * S * 0.04); g.lineTo(m + Math.cos(a + 0.2) * S * 0.16, m + Math.sin(a + 0.2) * S * 0.16); g.stroke(); }
  for (let i = 0; i < 14; i++) { g.fillStyle = ['#cfc5b6', '#8a7e70', '#5d544b'][i % 3]; g.beginPath(); g.ellipse(m + (Math.random() - 0.5) * S * 0.24, m + (Math.random() - 0.5) * S * 0.24, S * 0.012, S * 0.005, Math.random() * 3, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
let EXT = null;
/** the birds that hit the outside: one crushed patch on the radome, dozens of smears and spots spreading from it over the
 *  nose and the windscreen (each one dragged aft by the airflow), and some on the lips of both engine intakes. Projected
 *  onto the exterior model's skin, a few per frame (the exterior is hidden while the flight is seen from the seat) */
export function noseSplats() {
  if (!AC.ext || EXT) return;
  const mk = (map, tint = [1, 1, 1]) => new THREE.MeshStandardMaterial({map, color: new THREE.Color().setRGB(...tint), alphaTest: 0.3, roughness: 0.35, metalness: 0, polygonOffset: true, polygonOffsetFactor: -4});
  // dried and thinner smears read lighter, between brick red and brown (as on the photographs of struck noses)
  const tints = [[1, 1, 1], [1.45, 1.12, 1.0], [1.6, 1.2, 1.0], [1.25, 1.05, 0.95]];
  EXT = {crater: mk(craterTexture()), smears: tints.map((c, i) => mk(smearTexture(20 + i * 13), c))};
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
  // [aim x, aim y, rays from z, size, material] in the airplane's frame (nose tip at 0, −0.85, 18.8; intakes at ±6.0, −1.8, 7.4)
  const jobs = [[0, -0.75, 30, 0.75, 'crater']];
  for (let i = 0; i < 12; i++) jobs.push([gauss() * 1.1, -0.75 + gauss() * 0.9, 30, 0.24 + Math.random() * 0.2, 's']);
  for (let i = 0; i < 95; i++) jobs.push([gauss() * 1.9, -0.5 + gauss() * 1.45, 30, 0.08 + Math.random() * 0.16, 's']);
  for (const ex of [6.0, -6.0]) for (let i = 0; i < 10; i++) { const a = Math.random() * Math.PI * 2, r = 1.0 + Math.random() * 0.15; jobs.push([ex + Math.cos(a) * r, -1.8 + Math.sin(a) * r, 12, 0.1 + Math.random() * 0.12, 's']); }
  const rc = new THREE.Raycaster(), helper = new THREE.Object3D();
  const off = onUpdate(() => {
    AC.group.updateMatrixWorld(true);
    const inv = AC.ext.matrixWorld.clone().invert(), aft = V(0, 0, -1).transformDirection(AC.group.matrixWorld);
    for (let k = 0; k < 6 && jobs.length; k++) {
      const [x, y, z0, size, kind] = jobs.shift();
      rc.set(AC.group.localToWorld(V(x, y, z0)), aft.clone());
      const hit = rc.intersectObject(AC.ext, true).find(h => h.face && h.object.isMesh);
      if (!hit) continue;
      const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      if (n.dot(aft) > -0.15) continue;                                   // only surfaces facing the birds
      helper.position.copy(hit.point);
      helper.up.copy(Math.abs(n.dot(aft)) > 0.93 ? V(0, 1, 0).transformDirection(AC.group.matrixWorld) : aft);   // streaks run aft
      helper.lookAt(hit.point.clone().add(n));
      if (kind === 'crater') helper.rotateZ(Math.random() * Math.PI * 2);
      const geo = new DecalGeometry(hit.object, hit.point, helper.rotation, V(size, size * (kind === 'crater' ? 1 : 1.5), size * 2));
      const P = geo.attributes.position, N = geo.attributes.normal;
      for (let i = 0; i < P.count; i++) P.setXYZ(i, P.getX(i) + N.getX(i) * 0.004, P.getY(i) + N.getY(i) * 0.004, P.getZ(i) + N.getZ(i) * 0.004);
      geo.applyMatrix4(inv);
      const m = new THREE.Mesh(geo, kind === 'crater' ? EXT.crater : EXT.smears[Math.floor(Math.random() * 4)]);
      m.frustumCulled = false; AC.ext.add(m);
    }
    if (!jobs.length) off();
  });
}
