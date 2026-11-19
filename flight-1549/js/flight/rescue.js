// After the ditching: the forward left door (L1) opens, its slide-raft inflates down onto the river and the passengers
// come down it into the raft, while others stand on the wings (the scene from the famous photographs) and the commuter
// ferries and the rescue boats close in (the first ferry arrived in under four minutes). The people are loaded in the
// background during the flight so the ending does not wait.
import * as THREE from 'three';
import {Character, loadAnimLib} from '../actors/character.js';
import {scene, onUpdate} from '../core/engine.js';
import {AC} from './aircraft.js';
import {hiss} from './sound.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const ease = (k) => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const backOut = (k) => { k = Math.min(1, Math.max(0, k)); const s = 1.4; return 1 + (s + 1) * (k - 1) ** 3 + s * (k - 1) ** 2; };
const R = {people: [], boats: [], loading: null, offs: [], parts: []};
const AVATARS = [['Male_Adult_02', 'm'], ['Female_Adult_01', 'f'], ['Male_Adult_05', 'm'], ['Female_Adult_04', 'f'], ['Male_Adult_07', 'm'],
  ['Female_Adult_09', 'f'], ['Male_Adult_12', 'm'], ['Female_Adult_13', 'f']];

// these avatars come without a normal map (asking for one only fills the console with 404s)
const FLAT = new Set(['Male_Adult_02', 'Male_Adult_05', 'Female_Adult_04', 'Male_Adult_12', 'Female_Adult_13']);
export function preloadRescue() {
  if (R.loading) return R.loading;
  R.loading = (async () => {
    await loadAnimLib();
    for (const [av, g] of AVATARS) {
      try { const c = await Character.create('pax_' + av, av, {gender: g, height: g === 'm' ? 1.78 : 1.66, talks: false, normals: !FLAT.has(av)}); c.holder.visible = false; R.people.push(c); }
      catch (e) { console.warn('pax', av, e); }
    }
  })();
  return R.loading;
}

// ---------------------------------------------------------------- the forward door
// the airplane's frame: +x the left wing, +y up, +z the nose. Around the forward door the fuselage is a circle about its
// axis (measured on the exterior model with rays), and the door is the outline painted on the model there
const FUS = {yc: -0.19, r: 2.03};
const DOOR = {z: 13.94, w: 1.24, y0: -0.52, y1: 1.32};
const skinX = (y) => Math.sqrt(Math.max(0, FUS.r * FUS.r - (y - FUS.yc) ** 2));

/** a piece of the skin between z0 and z1 and heights y0..y1, raised dr off it (in the airplane's frame) */
function skinPatch(z0, z1, y0, y1, dr, nv = 14) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) {
    const a = Math.asin(Math.max(-1, Math.min(1, (y0 + (y1 - y0) * j / nv - FUS.yc) / FUS.r)));
    const x = Math.cos(a) * (FUS.r + dr), y = FUS.yc + Math.sin(a) * (FUS.r + dr);
    for (let i = 0; i <= 1; i++) { pos.push(x, y, i ? z1 : z0); uv.push(i, j / nv); }
  }
  for (let j = 0; j < nv; j++) { const a = j * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
/** the door's outer skin (white, its seam, the small window, the handle) or the dark doorway with the cabin's light in it */
function doorTexture(kind) {
  const W = 128, H = 192, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  roundRect(g, 2, 2, W - 4, H - 4, 22); g.save(); g.clip();
  if (kind === 'door') {
    g.fillStyle = '#ecebe7'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#8f8b84'; g.lineWidth = 3; roundRect(g, 3, 3, W - 6, H - 6, 21); g.stroke();
    g.fillStyle = '#1d232a'; g.beginPath(); g.arc(W * 0.5, H * 0.3, 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#6f6c66'; g.fillRect(W * 0.62, H * 0.52, 22, 8);
  } else {
    const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, '#101215'); gr.addColorStop(0.45, '#3b3a37'); gr.addColorStop(0.7, '#57544e'); gr.addColorStop(1, '#16181b');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,236,200,0.22)'; g.fillRect(W * 0.35, H * 0.08, W * 0.3, H * 0.1);   // the cabin's ceiling light
    g.fillStyle = '#26282b'; g.fillRect(0, H * 0.86, W, H * 0.14);                          // the sill
  }
  g.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function buildDoor() {
  const z0 = DOOR.z + DOOR.w / 2, z1 = DOOR.z - DOOR.w / 2;
  const hole = new THREE.Mesh(skinPatch(z0 + 0.02, z1 - 0.02, DOOR.y0 - 0.02, DOOR.y1 + 0.02, 0.006),
    new THREE.MeshBasicMaterial({map: doorTexture('hole'), alphaTest: 0.5, side: THREE.DoubleSide}));
  hole.visible = false;
  const door = new THREE.Mesh(skinPatch(z0, z1, DOOR.y0, DOOR.y1, 0.014),
    new THREE.MeshStandardMaterial({map: doorTexture('door'), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.45}));
  const g = new THREE.Group(); g.add(hole, door); AC.group.add(g);
  return {g, hole, door};
}
/** the door lifts, comes out on its arm and swings forward along the fuselage, staying parallel to it (Airbus doors) */
function openDoor(D) {
  D.hole.visible = true;
  const t0 = performance.now();
  return new Promise(res => {
    const off = onUpdate(() => {
      const k = (performance.now() - t0) / 1000;
      const lift = ease(k / 0.5), f = ease((k - 0.45) / 1.7) * Math.PI;
      D.door.position.set(0.1 * lift + 0.18 * (1 - Math.cos(f)) / 2 + 0.55 * Math.sin(f), 0.05 * lift, (DOOR.w + 0.06) * (1 - Math.cos(f)) / 2);
      if (k > 2.2) { off(); res(); }
    });
    R.offs.push(off);
  });
}

// ---------------------------------------------------------------- the slide-raft
const RAMP = 2.0, RAFT = {L: 4.4, W: 1.9, r: 0.23};
function capsule(r, len, mat) { return new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.01, len - 2 * r), 6, 16), mat); }
function buildRaft() {
  const yel = new THREE.MeshStandardMaterial({color: 0xe0b52e, roughness: 0.5}), grey = new THREE.MeshStandardMaterial({color: 0x9c9888, roughness: 0.75});
  const dark = new THREE.MeshStandardMaterial({color: 0x2b2a27, roughness: 0.9});
  // the ramp: from the door sill down to the water (two tubes and the sliding surface between)
  const ramp = new THREE.Group();
  for (const s of [-1, 1]) { const t = capsule(0.2, RAMP + 0.4, yel); t.rotation.z = Math.PI / 2; t.position.set(RAMP / 2, 0.2, s * 0.72); ramp.add(t); }
  const bed = new THREE.Mesh(new THREE.BoxGeometry(RAMP + 0.3, 0.05, 1.3), grey); bed.position.set(RAMP / 2, 0.06, 0); ramp.add(bed);
  // the raft floating on the river: tubes all round, the floor, a lifeline along the sides
  const raft = new THREE.Group(), {L, W, r} = RAFT;
  for (const s of [-1, 1]) {
    const t = capsule(r, L, yel); t.rotation.z = Math.PI / 2; t.position.set(L / 2, r, s * (W / 2 - r)); raft.add(t);
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, L - 0.6, 5), dark); line.rotation.z = Math.PI / 2; line.position.set(L / 2, r * 1.55, s * (W / 2 - r + 0.12)); raft.add(line);
  }
  const end = capsule(r, W, yel); end.rotation.x = Math.PI / 2; end.position.set(L - r, r, 0); raft.add(end);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(L - r, 0.05, W - 2 * r), grey); floor.position.set((L - r) / 2, 0.07, 0); raft.add(floor);
  for (const o of [...ramp.children, ...raft.children]) o.castShadow = o.receiveShadow = true;
  // at the sill of the doorway, the raft's ramp heading straight out from the fuselage
  const base = new THREE.Group(); base.position.set(skinX(DOOR.y0) + 0.02, DOOR.y0, DOOR.z); base.add(ramp, raft); AC.group.add(base);
  ramp.visible = raft.visible = false;
  return {base, ramp, raft};
}
/** where the water is under the raft, in the airplane's frame (the airplane floats nose-up and rolls a little) */
function waterAt(x, z) { const p = AC.group.localToWorld(V(x, 0, z)); p.y = 0; return AC.group.worldToLocal(p).y; }
function inflate(F) {
  const dy = Math.min(-0.15, waterAt(F.base.position.x + RAMP + 1, DOOR.z) - 0.05 - F.base.position.y);
  F.dy = dy; F.slope = Math.atan2(dy, RAMP);
  F.ramp.rotation.z = F.slope; F.ramp.scale.set(1 / Math.cos(F.slope), 1, 1);
  F.raft.position.set(RAMP, dy, 0);
  F.ramp.visible = F.raft.visible = true; hiss();
  const t0 = performance.now();
  return new Promise(res => {
    const off = onUpdate(() => {
      const k = (performance.now() - t0) / 1000;
      const a = backOut(k / 0.7), b = backOut((k - 0.45) / 1.5), g = ease((k - 0.45) / 1.2);
      F.ramp.scale.set(Math.max(0.02, a) / Math.cos(F.slope), 0.3 + 0.7 * ease(k / 0.7), 0.5 + 0.5 * ease(k / 0.7));
      F.raft.scale.set(Math.max(0.02, b), 0.3 + 0.7 * g, 0.45 + 0.55 * g);
      F.raft.visible = k > 0.4;
      if (k > 2.2) { off(); res(); }
    });
    R.offs.push(off);
  });
}

// ---------------------------------------------------------------- the people
const sitAnim = (c) => c.g === 'm' ? 'm_sit_table_idle_neutral_01' : 'f_sit_table_breathe_01';
const standAnim = (c, i) => i % 3 ? (c.g === 'f' ? 'f_idle_neutral_01' : 'm_idle_nervous_01') : (c.g === 'f' ? 'f_idle_breathe_01' : 'm_idle_breathe_01');
/** one passenger: out of the doorway, sat down at the top of the slide, down it, and across to a place on a side tube */
function deplaneOne(c, F, seat, i) {
  const {L, W, r} = RAFT, zs = seat[1] * (W / 2 - r);
  // (the doorway is a dark picture on the skin, not a hole: they come out of it already sitting at the top of the slide)
  F.base.add(c.holder); c.seated = true; c.lookAt(null);
  const sit = -0.4, ry = seat[1] > 0 ? Math.PI : 0;              // sitting, the hips are ~0.45 m above the character's origin
  c.place(-0.25, 0, Math.PI / 2, sit + 0.05); c.setBase(sitAnim(c), {fade: 0});
  // key points in the raft's frame: [time, x, y, z, facing]
  const K = [[0, -0.25, sit + 0.05, 0, Math.PI / 2], [0.4, 0.15, sit + 0.05, 0, Math.PI / 2], [1.1, RAMP, F.dy + sit + 0.1, 0, Math.PI / 2],
    [2.4, RAMP + seat[0], F.dy + sit + 0.1, zs * 0.6, ry], [2.9, RAMP + seat[0], F.dy, zs, ry]];
  const t0 = performance.now();
  const off = onUpdate(() => {
    const k = (performance.now() - t0) / 1000;
    let j = 0; while (j < K.length - 2 && k > K[j + 1][0]) j++;
    const A = K[j], B = K[j + 1], u = j === 1 ? Math.min(1, Math.max(0, (k - A[0]) / (B[0] - A[0])) ** 1.6) : ease((k - A[0]) / (B[0] - A[0]));
    c.holder.position.set(A[1] + (B[1] - A[1]) * u, A[2] + (B[2] - A[2]) * u, A[3] + (B[3] - A[3]) * u);
    let d = B[4] - A[4]; c.holder.rotation.y = A[4] + d * ease((k - A[0]) / Math.max(0.3, B[0] - A[0]));
    if (k > K[K.length - 1][0]) off();
  });
  R.offs.push(off);
}

// ---------------------------------------------------------------- the boats
/** a hull outline seen from above: square stern at z = −L/2, the bow coming to a rounded point at z = +L/2 */
function hullShape(L, W, bow = 0.3) {
  const s = new THREE.Shape(), h = W / 2, zb = L / 2 - L * bow;
  s.moveTo(-h, -L / 2); s.lineTo(h, -L / 2); s.lineTo(h, zb); s.quadraticCurveTo(h * 0.95, L / 2 - L * 0.05, 0, L / 2); s.quadraticCurveTo(-h * 0.95, L / 2 - L * 0.05, -h, zb); s.closePath();
  return s;
}
/** that outline as a solid between heights y0 and y1, its centre moved dz along the boat */
function slab(L, W, y0, y1, mat, dz = 0, bow = 0.3) {
  const g = new THREE.ExtrudeGeometry(hullShape(L, W, bow), {depth: y1 - y0, bevelEnabled: false, curveSegments: 10});
  g.rotateX(Math.PI / 2); g.translate(0, y1, dz);
  const m = new THREE.Mesh(g, mat); m.castShadow = true; return m;
}
const MAT = {};
function mats() {
  if (MAT.white) return MAT;
  const S = (color, roughness = 0.5, metalness = 0) => new THREE.MeshStandardMaterial({color, roughness, metalness});
  Object.assign(MAT, {white: S(0xf1f1ee, 0.45), navy: S(0x1d2b45, 0.6), blue: S(0x2a64b4, 0.5), grey: S(0x3a3e44, 0.7), glass: S(0x16202b, 0.15, 0.4),
    orange: S(0xd9561e, 0.55), red: S(0xb3241f, 0.5), skin: S(0xc99c80, 0.7), crew: S(0x1f2a3c, 0.8), steel: S(0x9aa3ab, 0.35, 0.6)});
  return MAT;
}
/** a commuter ferry: white, a blue band, two decks of windows and a wheelhouse */
function ferry() {
  const M = mats(), G = new THREE.Group(), L = 27, W = 8.4;
  G.add(slab(L, W, -0.9, 0.55, M.navy), slab(L, W, 0.55, 1.6, M.white), slab(L * 1.004, W * 1.01, 0.95, 1.2, M.blue), slab(L * 1.008, W * 1.015, 1.55, 1.7, M.grey));
  G.add(slab(L * 0.8, W * 0.9, 1.6, 3.7, M.white, -1.4, 0.22), slab(L * 0.805, W * 0.905, 2.35, 3.25, M.glass, -1.4, 0.22), slab(L * 0.82, W * 0.93, 3.7, 3.85, M.white, -1.4, 0.22));
  G.add(slab(L * 0.42, W * 0.72, 3.85, 5.7, M.white, 1.6, 0.25), slab(L * 0.425, W * 0.725, 4.55, 5.35, M.glass, 1.6, 0.25), slab(L * 0.44, W * 0.75, 5.7, 5.85, M.white, 1.6, 0.25));
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.4, 6), M.steel); mast.position.set(0, 7, 2.5); G.add(mast);
  return G;
}
/** a rescue boat: a rigid hull with an orange inflatable collar, a console, two outboards and a crew of three */
function rib() {
  const M = mats(), G = new THREE.Group(), L = 7.6, W = 2.7;
  G.add(slab(L * 0.92, W * 0.86, -0.45, 0.3, M.grey));
  const pts = hullShape(L, W * 0.98, 0.32).getPoints(14).map(p => V(p.x, 0.38, p.y)).filter((p, i, a) => i === 0 || p.distanceTo(a[i - 1]) > 1e-3);
  if (pts.length > 2 && pts[0].distanceTo(pts[pts.length - 1]) < 1e-3) pts.pop();
  const collar = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 80, 0.3, 10, true), M.orange); collar.castShadow = true; G.add(collar);
  const con = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.0, 0.9), M.white); con.position.set(0, 0.8, 0.4); G.add(con);
  const ws = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.05), M.glass); ws.position.set(0, 1.45, 0.82); ws.rotation.x = -0.4; G.add(ws);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.15), M.red); bar.position.set(0, 2.29, 0.1); G.add(bar);
  for (const s of [-0.7, 0.7]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.9, 6), M.steel); post.position.set(s, 1.25, 0.1); G.add(post); }
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.4, 6), M.steel); top.rotation.z = Math.PI / 2; top.position.set(0, 2.2, 0.1); G.add(top);
  for (const s of [-0.45, 0.45]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.0, 0.5), M.grey); e.position.set(s, 0.55, -L / 2 + 0.05); G.add(e); }
  for (const [x, z] of [[0.15, -0.35], [-0.5, 1.6], [0.6, -1.6]]) {
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.75, 4, 8), M.crew); body.position.set(x, 1.05, z); G.add(body);
    const vest = new THREE.Mesh(new THREE.CapsuleGeometry(0.23, 0.35, 4, 8), M.orange); vest.position.set(x, 1.3, z); G.add(vest);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), M.skin); head.position.set(x, 1.82, z); G.add(head);
  }
  return G;
}
/** white water thrown back from a moving boat (fades with its speed) */
function wake(W, L) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.strokeStyle = gr; g.lineWidth = 7; g.beginPath(); g.moveTo(32, 2); g.lineTo(4, 126); g.moveTo(32, 2); g.lineTo(60, 126); g.stroke();
  g.fillStyle = gr; g.globalAlpha = 0.5; g.fillRect(22, 0, 20, 128);
  const tx = new THREE.CanvasTexture(c); tx.flipY = false;                     // the point of the V at the stern
  const m = new THREE.MeshBasicMaterial({map: tx, transparent: true, depthWrite: false, opacity: 0});
  const p = new THREE.Mesh(new THREE.PlaneGeometry(W * 3, L * 2.2), m); p.rotation.x = -Math.PI / 2; p.position.set(0, 0.08, -L * 1.6); p.renderOrder = 2;
  return p;
}
function boat(kind, from, to, face, vmax) {
  const g = kind === 'ferry' ? ferry() : rib(), L = kind === 'ferry' ? 27 : 7.6, W = kind === 'ferry' ? 8.4 : 2.7;
  const w = wake(W, L); g.add(w);
  const holder = new THREE.Group(); holder.add(g); scene.add(holder);
  holder.position.copy(from); holder.position.y = 0;
  const d = to.clone().sub(from); holder.rotation.y = Math.atan2(d.x, d.z);
  return {holder, g, wake: w, to, face, vmax, v: vmax * 0.8, ph: Math.random() * 6, rib: kind !== 'ferry'};
}
function moveBoats(dt) {
  const t = performance.now() / 1000;
  for (const b of R.boats) {
    const d = b.to.clone().sub(b.holder.position); d.y = 0; const L = d.length();
    const want = L > 2 ? Math.min(b.vmax, 0.35 + L * 0.13) : 0;
    b.v += (want - b.v) * Math.min(1, dt * 0.8);
    const goal = L > 12 ? Math.atan2(d.x, d.z) : b.face;
    let dh = ((goal - b.holder.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    b.holder.rotation.y += dh * Math.min(1, dt * 0.5);
    if (L > 0.5) b.holder.position.addScaledVector(d.normalize(), b.v * dt);
    b.g.position.y = Math.sin(t * (b.rib ? 1.6 : 0.8) + b.ph) * (b.rib ? 0.1 : 0.07);
    b.g.rotation.x = -b.v * (b.rib ? 0.012 : 0.003) + Math.sin(t * 1.1 + b.ph) * 0.012;
    b.g.rotation.z = Math.sin(t * 0.9 + b.ph * 2) * (b.rib ? 0.03 : 0.01);
    b.wake.material.opacity = Math.min(0.75, b.v / b.vmax * 0.8);
  }
}

/** set the scene on the river: people on the wings, the door still closed, the boats on their way. Returns the steps of
 *  the evacuation through the forward door, and a function that clears everything */
export function showRescue() {
  // on the wings (the overwing exits were open first): people face away from the fuselage, toward help
  const spots = [[5.0, -1.9], [6.8, -2.6], [-5.0, -1.9], [-6.8, -2.6], [3.2, -1.2], [-3.2, -1.2]];
  const onWing = R.people.slice(0, 4), viaDoor = R.people.slice(4);
  onWing.forEach((c, i) => {
    const [x, z] = spots[i];
    AC.group.add(c.holder);
    c.seated = false; c.place(x, z - 2, x > 0 ? 1.4 : -1.4, -0.35 + Math.abs(x) * 0.05);
    c.setBase(standAnim(c, i), {fade: 0});
    c.holder.visible = true; c.lookAt(null);
  });
  const D = buildDoor(), F = buildRaft(); R.parts.push(D.g, F.base);
  // a ferry to the left wing and one to the right, two rescue boats to just behind the raft, bows to the fuselage
  // (positions in the airplane's frame; clear of the cameras of the ending)
  const W = (x, z) => { const p = AC.group.localToWorld(V(x, 0, z)); p.y = 0; return p; };
  const hd = Math.PI - AC.hdg * Math.PI / 180;              // the airplane's nose in the world (the frame's +z)
  R.boats.push(boat('ferry', W(150, -60), W(27, -4), hd + Math.PI, 8.5), boat('ferry', W(-190, 40), W(-29, 2), hd, 8.5),
    boat('rib', W(110, -20), W(10, 8.6), hd - Math.PI / 2, 9), boat('rib', W(130, 12), W(12.5, 1.8), hd - Math.PI / 2, 9));
  R.offs.push(onUpdate(moveBoats));
  return {
    openDoor: () => openDoor(D),
    inflate: () => inflate(F),
    /** the people come down the slide one after another */
    deplane: async (gap = 1.25) => {
      const seats = [[3.4, 1], [3.3, -1], [2.4, 1], [2.3, -1], [1.4, 1], [1.4, -1]];
      for (let i = 0; i < viaDoor.length; i++) { deplaneOne(viaDoor[i], F, seats[i], i); await new Promise(r => setTimeout(r, gap * 1000)); }
    },
    stop: () => {
      for (const o of R.offs) o(); R.offs = [];
      for (const b of R.boats) scene.remove(b.holder); R.boats = [];
      for (const p of R.parts) p.parent && p.parent.remove(p); R.parts = [];
      for (const c of R.people) { c.holder.visible = false; scene.add(c.holder); }
    },
  };
}
