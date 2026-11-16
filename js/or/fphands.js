// First-person surgeon's arms: "First Person hands rigged" (Sketchfab, CC BY 4.0) — realistic arms and hands with
// full finger bones — dressed by skin weights: the hand and fingers as latex gloves, the forearm and upper arm as the
// sterile gown sleeve. The rig is set at the surgeon's shoulders; hands.js drives it with the same IK as before.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {scene} from '../core/engine.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const GLOVE = new THREE.Color(0xe6d6b4), SLEEVE = new THREE.Color(0x2a5570);
export const FP = {group: null, arms: null, meshes: []};

export async function loadFPHands(shoulderR, shoulderL) {
  const g = await new GLTFLoader().loadAsync('assets/or_models/fphands/model.gltf');
  const root = g.scene; const meshes = []; let skel = null;
  root.traverse(o => { if (o.isSkinnedMesh) { meshes.push(o); skel = o.skeleton; } });
  if (!skel) throw new Error('fphands: no skeleton');
  const B = (re) => skel.bones.find(b => re.test(b.name));
  // three.js turns the dots in bone names into underscores: accept either
  const side = (s) => ({up: B(new RegExp(`^upper_arm[._]?${s}`)), fore: B(new RegExp(`^forearm[._]?${s}_\\d`)), hand: B(new RegExp(`^hand[._]?${s}`)),
    mid: B(new RegExp(`^f_middle[._]?01[._]?${s}`)), idx: B(new RegExp(`^f_index[._]?01[._]?${s}`)), pinky: B(new RegExp(`^f_pinky[._]?01[._]?${s}`)),
    fingers: skel.bones.filter(b => new RegExp(`^(f_(index|middle|ring|pinky)[._]?0[123]|thumb[._]?0[123])[._]?${s}_\\d`).test(b.name))});
  console.warn('[fphands] bones', JSON.stringify(Object.fromEntries(['R', 'L'].map(k => [k, {up: arms0(k).up, fore: arms0(k).fore, hand: arms0(k).hand, fingers: side(k).fingers.length}]))));
  function arms0(k) { const a = side(k); return {up: a.up && a.up.name, fore: a.fore && a.fore.name, hand: a.hand && a.hand.name}; }
  const arms = {R: side('R'), L: side('L')};
  // dress: glove from just above the wrist to the fingertips, gown sleeve above it (decided in the rest pose, by position)
  root.updateMatrixWorld(true);
  const wp = (b) => b.getWorldPosition(V());
  for (const m of meshes) {
    const geo = m.geometry, pos = geo.attributes.position, n = pos.count, col = new Float32Array(n * 3), q = V();
    const sides = ['R', 'L'].map(k => { const a = arms[k], w = wp(a.hand), e = wp(a.fore); return {w, dir: w.clone().sub(e).normalize(), L: w.distanceTo(e) || 1}; });
    const bw = new Float32Array(n);                                                          // where blood will stain the glove first
    let span = 0; for (const s of sides) span = Math.max(span, s.L);
    for (let v = 0; v < n; v++) {
      q.fromBufferAttribute(pos, v); m.applyBoneTransform(v, q); q.applyMatrix4(m.matrixWorld);      // where the vertex really is in the rest pose
      const s = sides[0].w.distanceToSquared(q) < sides[1].w.distanceToSquared(q) ? sides[0] : sides[1];
      const d = q.clone().sub(s.w).dot(s.dir), L = s.L;                                        // >0 past the wrist
      const t = Math.min(1, Math.max(0, (d / L + 0.02) / 0.05));                              // the glove cuff just over the wrist
      const c = SLEEVE.clone().lerp(GLOVE, t); col[v * 3] = c.r; col[v * 3 + 1] = c.g; col[v * 3 + 2] = c.b;
      const f = q.clone().multiplyScalar(9 / span);                                          // ~9 blotches along a forearm
      const nz = 0.55 * noise3(f.x, f.y, f.z) + 0.3 * noise3(f.x * 2.7, f.y * 2.7, f.z * 2.7) + 0.15 * noise3(f.x * 7, f.y * 7, f.z * 7);
      bw[v] = t * Math.min(1, nz * 0.8 + Math.max(0, d / L) * 0.55);                           // the fingers and the palm first
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    m.userData.base = col.slice(); m.userData.bw = bw;
    m.material = new THREE.MeshPhysicalMaterial({vertexColors: true, roughness: 0.42, clearcoat: 0.25, clearcoatRoughness: 0.4, sheen: 0.4, sheenColor: new THREE.Color(0xfff2dc), envMapIntensity: 0.6});
    m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
  }
  // scale and place the rig at the surgeon's shoulders, arms pointing towards the table
  const wrap = new THREE.Group(); wrap.add(root); scene.add(wrap);
  root.updateMatrixWorld(true);
  const p = (b) => b.getWorldPosition(V());
  const armLen = p(arms.R.up).distanceTo(p(arms.R.fore)) + p(arms.R.fore).distanceTo(p(arms.R.hand));
  root.scale.multiplyScalar(0.6 / armLen); root.updateMatrixWorld(true);
  // rig frame: right = L→R shoulders, forward = from the shoulders towards the hands
  const sR = p(arms.R.up), sL = p(arms.L.up), mid = sR.clone().add(sL).multiplyScalar(0.5);
  const handsMid = p(arms.R.hand).add(p(arms.L.hand)).multiplyScalar(0.5);
  const right = sR.clone().sub(sL).normalize(), fwd = handsMid.sub(mid); fwd.addScaledVector(right, -fwd.dot(right)).normalize();
  const up = V().crossVectors(right, fwd).negate().normalize();   // right × up = forward  ⇒  up = forward × right
  const rigM = new THREE.Matrix4().makeBasis(right, V().crossVectors(right, fwd).normalize(), fwd.clone().negate());   // right-handed: x × y = z
  // target frame: the surgeon faces -z (the table), right hand towards +x
  const tRight = shoulderR.clone().sub(shoulderL).normalize(), tFwd = V(0, -0.25, -1).normalize(); tFwd.addScaledVector(tRight, -tFwd.dot(tRight)).normalize();
  const tM = new THREE.Matrix4().makeBasis(tRight, V().crossVectors(tRight, tFwd).normalize(), tFwd.clone().negate());
  const q = new THREE.Quaternion().setFromRotationMatrix(tM).multiply(new THREE.Quaternion().setFromRotationMatrix(rigM).invert());
  wrap.quaternion.copy(q); wrap.updateMatrixWorld(true);
  const nowMid = p(arms.R.up).add(p(arms.L.up)).multiplyScalar(0.5), want = shoulderR.clone().add(shoulderL).multiplyScalar(0.5);
  wrap.position.add(want.sub(nowMid)); wrap.updateMatrixWorld(true);
  void up;
  FP.group = wrap; FP.arms = arms; FP.meshes = meshes;
  // in this rig the hand hangs from a separate bone (forearm.001) under the root: it must follow the forearm
  for (const k of ['R', 'L']) {
    const a = arms[k]; a.carrier = B(new RegExp(`^forearm[._]?${k}[._]?001`)); a.end = B(new RegExp(`^forearm[._]?${k}[._]?end`));
    if (a.carrier) { a.fore.updateMatrixWorld(true); a.carrier.updateMatrixWorld(true); a.offset = a.fore.matrixWorld.clone().invert().multiply(a.carrier.matrixWorld); }
  }
  // the bones these arms move are reset to their rest pose every frame (no build-up)
  FP.rest = skel.bones.map(b => [b, b.quaternion.clone(), b.position.clone()]);
  return FP;
}
/** put each hand carrier back on the end of its forearm (call after the arm IK, before orienting the wrist) */
export function fpFollow() {
  if (!FP.arms) return;
  const m = new THREE.Matrix4(), inv = new THREE.Matrix4();
  for (const k of ['R', 'L']) {
    const a = FP.arms[k]; if (!a.carrier || !a.offset) continue;
    a.fore.updateMatrixWorld(true); m.multiplyMatrices(a.fore.matrixWorld, a.offset);
    inv.copy(a.carrier.parent.matrixWorld).invert(); m.premultiply(inv);
    m.decompose(a.carrier.position, a.carrier.quaternion, a.carrier.scale); a.carrier.updateMatrixWorld(true);
  }
}
/** blood on the gloves, 0 (clean) … 1 (heavily stained), grows as the operation goes on */
const BLOOD = new THREE.Color(0x6e0c0e), BLOOD_FRESH = new THREE.Color(0xa3161a);
export function fpBlood(level) {
  if (!FP.meshes) return; FP.blood = level;
  for (const m of FP.meshes) {
    const b = m.userData.base, w = m.userData.bw; if (!b) continue;
    const col = m.geometry.attributes.color, th = 1 - level * 0.62;
    for (let v = 0; v < w.length; v++) {
      const k = Math.max(0, Math.min(1, (w[v] - th) * 7));
      const c = k > 0 ? BLOOD.clone().lerp(BLOOD_FRESH, Math.min(1, (w[v] - th) * 3)) : null;
      col.setXYZ(v, b[v * 3] + (k ? (c.r - b[v * 3]) * k * 0.92 : 0), b[v * 3 + 1] + (k ? (c.g - b[v * 3 + 1]) * k * 0.92 : 0), b[v * 3 + 2] + (k ? (c.b - b[v * 3 + 2]) * k * 0.92 : 0));
    }
    col.needsUpdate = true;
  }
}
const hash3 = (x, y, z) => { const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); };
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), fx = x - xi, fy = y - yi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t, h = (i, j, k) => hash3(xi + i, yi + j, zi + k);
  return l(l(l(h(0, 0, 0), h(1, 0, 0), u), l(h(0, 1, 0), h(1, 1, 0), u), v), l(l(h(0, 0, 1), h(1, 0, 1), u), l(h(0, 1, 1), h(1, 1, 1), u), v), w);
}
export function fpReset() { if (FP.rest) for (const [b, q, p] of FP.rest) { b.quaternion.copy(q); b.position.copy(p); } if (FP.group) FP.group.updateMatrixWorld(true); }
