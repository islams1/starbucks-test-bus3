// After the ditching: the forward left door (L1) opens, its slide-raft inflates down onto the river and the passengers
// come down it into the raft, while others stand on the wings (the scene from the famous photographs) and the commuter
// ferries and the rescue boats close in (the first ferry arrived in under four minutes). The people are loaded in the
// background during the flight so the ending does not wait.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import {Character, loadAnimLib, animClip} from '../actors/character.js';
import {scene, onUpdate} from '../core/engine.js';
import {AC} from './aircraft.js';
import {hiss} from './sound.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const ease = (k) => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const backOut = (k) => { k = Math.min(1, Math.max(0, k)); const s = 1.4; return 1 + (s + 1) * (k - 1) ** 3 + s * (k - 1) ** 2; };
const R = {people: [], boats: [], loading: null, offs: [], parts: [], mixers: []};
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
// One piece, as on the A320: two thick side beams that leave the door sill, run down to the water and bend level along
// it into the raft, a sagging fabric floor between them, a second (upper) buoyancy tube and a lifeline along the raft's
// sides, a cross tube at its end; rubberised fabric with panel seams, wrinkles and a little grime. It comes out of the
// door as a pack and unrolls along its length while each part, once out, fills up (the hiss of the gas bottle).
// Frame: the door sill at the origin, x out from the fuselage along the slide, y up, z across.
const RAMP = 2.0, RAFT = {L: 4.4, W: 1.9, r: 0.23};
let FAB = null;
/** the fabric: colour (weave, seams across every ~0.6 m, grime) and wrinkles (a normal map) */
function fabric() {
  if (FAB) return FAB;
  const S = 256, c = document.createElement('canvas'); c.width = S; c.height = S; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 2200; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${0.03 + Math.random() * 0.05})`; g.fillRect(Math.random() * S, Math.random() * S, 2 + Math.random() * 6, 1 + Math.random() * 2); }
  g.fillStyle = 'rgba(60,45,20,0.28)'; g.fillRect(0, 0, 5, S); g.fillRect(S - 3, 0, 3, S);           // a seam across (u wraps)
  g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(6, 0, 2, S);
  const grime = g.createLinearGradient(0, 0, 0, S); grime.addColorStop(0, 'rgba(70,60,40,0.0)'); grime.addColorStop(0.75, 'rgba(70,60,40,0.0)'); grime.addColorStop(1, 'rgba(70,60,40,0.22)');
  g.fillStyle = grime; g.fillRect(0, 0, S, S);
  const col = new THREE.CanvasTexture(c); col.colorSpace = THREE.SRGBColorSpace; col.wrapS = col.wrapT = THREE.RepeatWrapping;
  // wrinkles: soft ridges mostly around the tube, broken up, plus the seam's ridge
  const h = new Float32Array(S * S);
  const waves = []; for (let k = 0; k < 16; k++) waves.push([Math.floor(Math.random() * 3), 2 + Math.floor(Math.random() * 9), Math.random() * 6.28, 0.5 + Math.random()]);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let v = 0; for (const [kx, ky, ph, a] of waves) v += Math.sin((kx * x + ky * y) / S * Math.PI * 2 + ph + Math.sin(x / S * 6.28 * 2 + ph) * 0.8) * a / ky;
    v += x < 7 ? 1.2 : 0; h[y * S + x] = v;
  }
  const n = document.createElement('canvas'); n.width = n.height = S; const ng = n.getContext('2d'), im = ng.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = h[y * S + (x + 1) % S] - h[y * S + (x + S - 1) % S], dy = h[((y + 1) % S) * S + x] - h[((y + S - 1) % S) * S + x];
    const v = new THREE.Vector3(-dx * 1.2, -dy * 1.2, 1).normalize(), i = (y * S + x) * 4;
    im.data[i] = (v.x * 0.5 + 0.5) * 255; im.data[i + 1] = (v.y * 0.5 + 0.5) * 255; im.data[i + 2] = (v.z * 0.5 + 0.5) * 255; im.data[i + 3] = 255;
  }
  ng.putImageData(im, 0, 0);
  const nor = new THREE.CanvasTexture(n); nor.wrapS = nor.wrapT = THREE.RepeatWrapping;
  return FAB = {col, nor};
}
/** a material that the unrolling and the filling drive (shared uniforms): beyond the unrolled length nothing is drawn,
 *  and each part is fuller the longer it has been out */
function raftMaterial(U, color, rough, repeat) {
  const {col, nor} = fabric();
  const map = col.clone(), nmap = nor.clone(); map.repeat.set(repeat, 1); nmap.repeat.set(repeat, 1); map.needsUpdate = nmap.needsUpdate = true;
  const m = new THREE.MeshStandardMaterial({color, roughness: rough, metalness: 0, map, normalMap: nmap, normalScale: new THREE.Vector2(0.35, 0.35), side: THREE.DoubleSide});
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uProg = U.prog; sh.uniforms.uInfl = U.infl;
    sh.vertexShader = 'attribute float aU; attribute vec3 aC; uniform float uProg; uniform float uInfl; varying float vU;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nfloat fill = uInfl * clamp((uProg - aU) / 0.22 + 0.3, 0.3, 1.0);\ntransformed = aC + (transformed - aC) * fill;\nvU = aU;');
    sh.fragmentShader = 'uniform float uProg; varying float vU;\n' + sh.fragmentShader.replace('void main() {', 'void main() {\nif (vU > uProg) discard;');
  };
  m.customProgramCacheKey = () => 'raftFabric';
  return m;
}
/** per vertex: how far along the slide it is (0 at the sill, 1 at the raft's end) and the centre it fills out from */
function along(g, xS, xE, centres) {
  const P = g.attributes.position, aU = new Float32Array(P.count), aC = new Float32Array(P.count * 3);
  for (let i = 0; i < P.count; i++) {
    aU[i] = Math.min(1, Math.max(0, (P.getX(i) - xS) / (xE - xS)));
    const c = centres ? centres(i) : null;
    aC.set(c ? [c.x, c.y, c.z] : [P.getX(i), P.getY(i), P.getZ(i)], i * 3);
  }
  g.setAttribute('aU', new THREE.BufferAttribute(aU, 1)); g.setAttribute('aC', new THREE.BufferAttribute(aC, 3));
  return g;
}
/** a tube along a curve whose rings fill out from the curve */
function tube(curve, r, segs, radial, xS, xE, mat) {
  const g = new THREE.TubeGeometry(curve, segs, r, radial, false), C = [];
  for (let i = 0; i <= segs; i++) C.push(curve.getPointAt(i / segs));
  along(g, xS, xE, (k) => C[Math.floor(k / (radial + 1))]);
  const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; m.frustumCulled = false; return m;
}
function buildRaft() {
  // at the sill of the doorway, heading straight out from the fuselage; the rest is made once the water's height is known
  const base = new THREE.Group(); base.position.set(skinX(DOOR.y0) + 0.02, DOOR.y0, DOOR.z); AC.group.add(base);
  return {base};
}
/** where the water is under the raft, in the airplane's frame (the airplane floats nose-up and rolls a little) */
function waterAt(x, z) { const p = AC.group.localToWorld(V(x, 0, z)); p.y = 0; return AC.group.worldToLocal(p).y; }
function inflate(F) {
  const dy = Math.min(-0.15, waterAt(F.base.position.x + RAMP + 1, DOOR.z) - 0.05 - F.base.position.y);
  F.dy = dy; F.slope = Math.atan2(dy, RAMP);
  const {L, W, r} = RAFT, fy = dy + 0.1, xS = -0.05, xE = RAMP + L;
  const U = {prog: {value: 0}, infl: {value: 0.3}};
  const yel = raftMaterial(U, 0xd9a42c, 0.62, 5), floorM = raftMaterial(U, 0x8a877c, 0.85, 6), dark = raftMaterial(U, 0x5d6268, 0.8, 1);
  const G = new THREE.Group(); F.base.add(G); F.group = G;
  // the floor's height along the slide: down the ramp, a rounded bend, level on the water
  const floorAt = (x) => x <= RAMP - 0.35 ? dy * (x / RAMP) : x >= RAMP + 0.35 ? fy : (() => { const u = (x - (RAMP - 0.35)) / 0.7, a = dy * ((RAMP - 0.35) / RAMP); return a + (fy - a) * (u * u * (3 - 2 * u)); })();
  const xs = []; for (let x = xS; x <= RAMP + L - r + 1e-6; x += 0.2) xs.push(x);
  for (const s of [-1, 1]) {
    const z = s * (W / 2 - r);
    // the side beam: from beside the doorway, down, bending level along the raft
    G.add(tube(new THREE.CatmullRomCurve3(xs.map(x => V(x, floorAt(x) + r * 0.85, z))), r, 90, 18, xS, xE, yel));
    // the upper buoyancy tube along the raft part, and the lifeline sagging between its points along the outside
    const up = []; for (let x = RAMP + 0.25; x <= RAMP + L - r + 1e-6; x += 0.25) up.push(V(x, fy + r * 1.7 + 0.13, z));
    G.add(tube(new THREE.CatmullRomCurve3(up), 0.15, 40, 14, xS, xE, yel));
    // (closed ends: the tubes are sealed, round chambers)
    for (const e of [up[0], up[up.length - 1], V(xS, floorAt(xS) + r * 0.85, z)]) { const cap = new THREE.Mesh(along(new THREE.SphereGeometry(e === up[0] || e === up[up.length - 1] ? 0.15 : r, 16, 10).translate(e.x, e.y, e.z), xS, xE, () => e), yel); cap.castShadow = true; cap.frustumCulled = false; G.add(cap); }
    // the lifeline: a grey rope hanging in gentle curves between its attachment points along the outside
    const ll = []; for (let x = RAMP + 0.3; x <= RAMP + L - 0.4 + 1e-6; x += 0.1) ll.push(V(x, fy + r * 1.3 - 0.045 * Math.sin(((x - RAMP - 0.3) / 0.6 % 1) * Math.PI), s * (W / 2 + 0.03)));
    G.add(tube(new THREE.CatmullRomCurve3(ll), 0.009, 120, 5, xS, xE, dark));
  }
  // the cross tube closing the raft's end
  G.add(tube(new THREE.LineCurve3(V(RAMP + L - r, fy + r * 0.85, -(W / 2 - r)), V(RAMP + L - r, fy + r * 0.85, W / 2 - r)), r, 12, 18, xS, xE, yel));
  // the floor: fabric between the beams, sagging a little in the middle (it fills out from nothing: aC = itself)
  const nx = xs.length, nz = 9, pos = [], uv = [], idx = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const x = xs[i], t = j / (nz - 1), z = (t - 0.5) * (W - 2 * r * 0.9);
    pos.push(x, floorAt(x) + 0.05 - 0.05 * Math.sin(Math.PI * t), z); uv.push(x / 1.2, t);
  }
  for (let i = 0; i < nx - 1; i++) for (let j = 0; j < nz - 1; j++) { const a = i * nz + j, b = a + nz; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); fg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); fg.setIndex(idx); fg.computeVertexNormals();
  along(fg, xS, xE);
  const floor = new THREE.Mesh(fg, floorM); floor.receiveShadow = true; floor.frustumCulled = false; G.add(floor);
  // the pack at the unrolling front: a rolled bundle across the width, emptying as it goes
  const pack = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, W * 0.92, 18), new THREE.MeshStandardMaterial({color: 0xc99630, roughness: 0.7, map: fabric().col}));
  pack.rotation.x = Math.PI / 2; pack.castShadow = true; F.base.add(pack);
  hiss();
  const t0 = performance.now(), y0 = F.base.position.y;
  return new Promise(res => {
    let done = false;
    const off = onUpdate(() => {
      const k = (performance.now() - t0) / 1000;
      if (k < 0.3) { pack.position.set(0.2, 0.55 - 0.35 * (k / 0.3), 0); U.prog.value = 0; }
      else {
        const p = Math.min(1, ((k - 0.3) / 1.5) ** 1.25), x = xS + p * (xE - xS);
        U.prog.value = p;
        const sc = 1 - p * 0.75; pack.visible = p < 0.995; pack.scale.set(sc, 1, sc); pack.position.set(Math.min(x, RAMP + L - 0.2), floorAt(Math.min(x, RAMP + L - 0.2)) + 0.25 * sc, 0);
      }
      // filling: quick at first, a slight overshoot as the relief valves open, then settled
      const fk = (k - 0.3) / 2.1; U.infl.value = fk <= 0 ? 0.3 : fk < 1 ? 0.3 + 0.74 * (1 - (1 - fk) ** 3) : 1.04 - 0.04 * Math.min(1, (fk - 1) * 3);
      // once full, it rides the chop with the airplane, rocking a little on its own
      if (k > 2.4) { F.base.rotation.x = Math.sin(k * 1.1) * 0.012; F.base.position.y = y0 + Math.sin(k * 0.9) * 0.02; }
      if (!done && k > 2.5) { done = true; F.base.remove(pack); res(); }
    });
    R.offs.push(off);
  });
}

// ---------------------------------------------------------------- the people
const sitAnim = (c) => c.g === 'm' ? 'm_sit_table_idle_neutral_01' : 'f_sit_table_breathe_01';
const standAnim = (c, i) => i % 3 ? (c.g === 'f' ? 'f_idle_neutral_01' : 'm_idle_nervous_01') : (c.g === 'f' ? 'f_idle_breathe_01' : 'm_idle_breathe_01');
/** a sitting person's legs laid out straight along a direction (world space): each thigh turned to it at the hip, each
 *  shin lined up with its thigh at the knee, by w (0..1). The only sitting pose in the library is on a chair (knees at a
 *  right angle); on a slide people sit with their legs out along it, leaning back a little */
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _q = new THREE.Quaternion(), _qw = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _qi = new THREE.Quaternion();
function aim(bone, from, to, dir, w) {               // turn bone (in world space) so that from→to points along dir
  const cur = to.clone().sub(from).normalize();
  _q.setFromUnitVectors(cur, dir); _q.slerp(_qi.identity(), 1 - w);
  bone.getWorldQuaternion(_qw); bone.parent.getWorldQuaternion(_qp);
  bone.quaternion.copy(_qp.invert().multiply(_q.multiply(_qw)));
  bone.updateMatrixWorld(true);
}
function legsOut(c, w, dir) {
  if (w <= 0) return;
  const sk = c.mesh.skeleton;
  c._legs = c._legs || ['L', 'R'].map(s => ['Thigh', 'Calf', 'Foot'].map(n => sk.getBoneByName('Bip01_' + s + '_' + n)));
  c.holder.updateMatrixWorld(true);
  for (const [th, ca, ft] of c._legs) {
    if (!th || !ca || !ft) continue;
    th.getWorldPosition(_a); ca.getWorldPosition(_b); aim(th, _a, _b, dir, w);
    ca.getWorldPosition(_b); ft.getWorldPosition(_c); aim(ca, _b, _c, dir, w);
  }
}
/** one passenger, the way people leave by a slide: sat on the sill with the legs out, a push, faster and faster down the
 *  ramp, sliding on across the raft's floor until friction stops them; then up on their feet, a few steps to a place on
 *  a side tube, and down to sit on it. All in the raft's frame (x out from the sill, along the ramp) */
function deplaneOne(c, F, seat, i) {
  const {W, r} = RAFT, zs = seat[1] * (W / 2 - r), ryIn = seat[1] > 0 ? Math.PI : 0;
  F.base.add(c.holder); c.seated = true; c.lookAt(null);
  const SIT = -0.4;                                   // sitting, the hips are ~0.4 m above the character's origin
  const slope = F.slope, Lr = RAMP / Math.cos(slope), A = 3.0, FR = 5.0;
  const tSlide = Math.sqrt(2 * Lr / A), v0 = A * tSlide, dStop = v0 * v0 / (2 * FR), tStop = v0 / FR;
  const floorY = F.dy + 0.1;                          // the raft's floor
  const T1 = 0.35, T2 = T1 + tSlide, T3 = T2 + tStop, T4 = T3 + 0.45, T5 = T4 + 0.6;
  const stopX = RAMP + dStop, sx = RAMP + seat[0], sz = zs * 0.55;
  const walkD = Math.hypot(sx - stopX, sz), T6 = T5 + walkD / 1.25, T7 = T6 + 0.7;
  const walkYaw = Math.atan2(sx - stopX, sz);         // (a character faces its +z: yaw from +z toward +x)
  c.place(-0.12, 0, Math.PI / 2, SIT); c.setBase(sitAnim(c), {fade: 0}); c.holder.rotation.order = 'YXZ';
  // the two directions the legs lie along: down the ramp, and level across the floor (raft frame → world)
  const downR = new THREE.Vector3(Math.cos(slope), Math.sin(slope), 0), level = new THREE.Vector3(1, 0, 0), dirW = new THREE.Vector3();
  const t0 = performance.now(); let stage = 0;
  const off = onUpdate(() => {
    const k = (performance.now() - t0) / 1000, h = c.holder;
    let legs = 1, along = k < T2 ? downR : level;
    if (k < T1) {                                     // shuffle to the edge of the sill
      h.position.set(-0.12 + 0.27 * ease(k / T1), SIT, 0); h.rotation.set(-0.12, Math.PI / 2, 0);
    } else if (k < T2) {                              // down the ramp, accelerating
      const tt = k - T1, sR = 0.5 * A * tt * tt;
      h.position.set(0.15 + sR * Math.cos(slope), SIT + sR * Math.sin(slope), 0); h.rotation.set(-0.2, Math.PI / 2, 0);
    } else if (k < T3) {                              // across the floor, slowing down
      const tt = k - T2, s = v0 * tt - 0.5 * FR * tt * tt;
      h.position.set(RAMP + s, floorY + SIT, 0); h.rotation.set(-0.2 * (1 - tt / tStop) - 0.08, Math.PI / 2, 0);
    } else if (k < T4) {                              // a moment, still sitting
      h.position.set(stopX, floorY + SIT, 0); h.rotation.set(0, Math.PI / 2, 0);
    } else if (k < T5) {                              // up on the feet
      if (stage < 1) { stage = 1; c.seated = false; c.setBase(standAnim(c, i), {fade: 0.45}); }
      const u = ease((k - T4) / (T5 - T4)); legs = 1 - u;
      h.position.set(stopX, floorY + SIT * (1 - u), 0); h.rotation.set(0, Math.PI / 2 + (walkYaw - Math.PI / 2) * u, 0);
    } else if (k < T6) {                              // a few steps to a place on the side tube
      if (stage < 2) { stage = 2; c.setBase(c.g === 'm' ? 'm_walk_neutral_01' : 'f_walk_neutral_01', {fade: 0.3}); }
      const u = (k - T5) / (T6 - T5); legs = 0;
      h.position.set(stopX + (sx - stopX) * u, floorY, sz * u); h.rotation.set(0, walkYaw, 0);
    } else {                                          // turn, and sit down on the tube
      if (stage < 3) { stage = 3; c.seated = true; c.setBase(sitAnim(c), {fade: 0.5}); }
      const u = ease((k - T6) / (T7 - T6)); legs = 0;
      const d = ((ryIn - walkYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      h.position.set(sx, floorY + (F.dy - floorY) * u, sz + (zs - sz) * u); h.rotation.set(0, walkYaw + d * u, 0);
      if (k > T7) { off(); return; }
    }
    legsOut(c, legs, dirW.copy(along).transformDirection(F.base.matrixWorld));
  });
  R.offs.push(off);
}

/** people who are only seen, not followed: copies of the passengers' figures standing on the wings (the overwing exits
 *  emptied most of the cabin out there), each with its own idle movement */
function extras(src) {
  if (!src.length) return;
  const anims = ['m_idle_nervous_01', 'f_idle_neutral_01', 'm_idle_breathe_01', 'f_idle_breathe_01'];
  let n = 0;
  for (const side of [1, -1]) for (const [ax, dz] of [[3.6, 0.5], [4.5, -0.6], [5.5, 0.3], [6.3, -0.8], [7.3, 0.2], [8.3, -0.5], [9.2, 0.4]]) {
    const c = src[n++ % src.length], x = side * (ax + (Math.random() - 0.5) * 0.3);
    const o = SkeletonUtils.clone(c.fbx); o.traverse(m => { if (m.isMesh) { m.frustumCulled = false; m.castShadow = false; } });
    const g = new THREE.Group(); g.add(o); AC.group.add(g); R.parts.push(g);
    g.position.set(x, -0.35 + Math.abs(x) * 0.05, -3.2 - 0.37 * (Math.abs(x) - 3.2) + dz);
    g.rotation.y = (side > 0 ? 1.4 : -1.4) + (Math.random() - 0.5) * 0.9;
    const mx = new THREE.AnimationMixer(o), clip = animClip(c.g === 'f' ? anims[1 + (n % 2) * 2] : anims[(n % 2) * 2]);
    if (clip) { const a = mx.clipAction(clip); a.time = Math.random() * clip.duration; a.timeScale = 0.85 + Math.random() * 0.3; a.play(); }
    R.mixers.push(mx);
  }
  R.offs.push(onUpdate((dt) => { for (const m of R.mixers) m.update(dt); }));
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
  extras(R.people);
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
      const seats = [[3.7, 1], [3.6, -1], [2.8, 1], [2.7, -1], [1.9, 1], [1.9, -1]];
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
