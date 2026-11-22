// Contact: hands, arms and bodies must not pass through the furniture or through each other.
// The furniture is the scanned venues' own geometry (tables, counters, chairs, shelves) between knee and head height,
// merged into one world-space BVH (three-mesh-bvh), so a limb can be tested against the real surfaces in microseconds.
//
// solveArms(ch) runs every frame after the animation: it walks each arm's chain shoulder → elbow → wrist → finger tip,
// finds where the chain (or the skin around it) goes into a surface, and lifts the elbow and then the wrist out of it
// (two-bone IK, the elbow kept on its own side). The correction is smoothed — quick to rise, slow to let go — so a hand
// slides along a table top instead of popping.
// clipReport() is the QA side: it measures every visible limb against the furniture and every pair of bodies
// against each other, and keeps the worst depth per person.
import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';

let bvh = null, geo = null;
const LEVEL_Y = [0, 40];                 // floor heights: the café and the boardroom
const LO = 0.22, HI = 1.95;              // keep surfaces between knee and head height (not the floor or the ceiling)

/** merge the venues' furniture-height triangles into one BVH */
export function buildContact(scene) {
  const roots = []; scene.traverse(o => { if (o.name === 'venue') roots.push(o); });
  const out = []; const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const keepY = (lo, hi) => LEVEL_Y.some(f => hi > f + LO && lo < f + HI);
  for (const r of roots) {
    r.updateMatrixWorld(true);
    r.traverse(o => {
      if (!o.isMesh || !o.visible || o.isSkinnedMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (mats.every(m => m.transparent && m.opacity < 0.5)) return;          // see-through glass does not stop a hand
      const pos = o.geometry.attributes.position, idx = o.geometry.index, m = o.matrixWorld;
      const n = idx ? idx.count : pos.count;
      for (let i = 0; i < n; i += 3) {
        a.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(m);
        b.fromBufferAttribute(pos, idx ? idx.getX(i + 1) : i + 1).applyMatrix4(m);
        c.fromBufferAttribute(pos, idx ? idx.getX(i + 2) : i + 2).applyMatrix4(m);
        if (!keepY(Math.min(a.y, b.y, c.y), Math.max(a.y, b.y, c.y))) continue;
        out.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      }
    });
  }
  geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  bvh = new MeshBVH(geo, {maxLeafTris: 8});
  return out.length / 9;
}
export const contactReady = () => !!bvh;

// ---------------------------------------------------------------- queries
const _cp = {point: new THREE.Vector3(), distance: 0, faceIndex: 0};
const _na = new THREE.Vector3(), _nb = new THREE.Vector3(), _nc = new THREE.Vector3();
function faceNormal(fi, out) {
  const idx = geo.index, pos = geo.attributes.position;
  _na.fromBufferAttribute(pos, idx.getX(fi * 3)); _nb.fromBufferAttribute(pos, idx.getX(fi * 3 + 1)); _nc.fromBufferAttribute(pos, idx.getX(fi * 3 + 2));
  return out.subVectors(_nc, _nb).cross(_nb.clone().sub(_na)).normalize().negate();
}
/** how far point p (a limb of radius r) is inside the nearest surface, pushing towards the side `from` is on.
 *  Returns {push, normal} or null when it is clear. */
function clearance(p, r, from) {
  const h = bvh.closestPointToPoint(p, _cp, 0, r + 0.02); if (!h) return null;
  const n = faceNormal(h.faceIndex, new THREE.Vector3());
  if (n.dot(_nc.subVectors(from, h.point)) < 0) n.negate();
  const s = n.dot(_nc.subVectors(p, h.point));
  return s < r ? {push: r - s, normal: n, point: h.point.clone()} : null;
}

// ---------------------------------------------------------------- the arms
const R = {elbow: 0.045, fore: 0.04, wrist: 0.03, hand: 0.022, tip: 0.012};
function armBones(ch, s) {
  const sk = ch.mesh.skeleton, B = (n) => sk.getBoneByName(`Bip01_${s}_${n}`);
  const arm = {up: B('UpperArm'), fore: B('Forearm'), hand: B('Hand'), f1: B('Finger2'), f2: B('Finger21') || B('Finger2'), f3: B('Finger22') || B('Finger21') || B('Finger2')};
  return arm.up && arm.fore && arm.hand ? arm : null;
}
const W = (o) => o.getWorldPosition(new THREE.Vector3());
function armPoints(arm) {
  const S = W(arm.up), E = W(arm.fore), H = W(arm.hand), F1 = arm.f1 ? W(arm.f1) : H.clone(), F3 = arm.f3 ? W(arm.f3) : F1.clone();
  const F2 = arm.f2 ? W(arm.f2) : F1.clone();
  const tip = F3.clone().add(F3.clone().sub(F2).setLength(0.022));
  return {S, E, H, F1, tip, foreMid: E.clone().lerp(H, 0.5)};
}
/** Samples along the chain, each with the limb radius there. The shoulder is the reference for "outside": whatever
 *  the arm goes into, the side the shoulder is on is where it must come back to. */
function samples(a, b, n, r0, r1) { const out = []; for (let i = 1; i <= n; i++) { const f = i / n; out.push({p: a.clone().lerp(b, f), r: r0 + (r1 - r0) * f, f}); } return out; }
const take = (acc, n, d) => { if (d > acc.d) { acc.d = d; acc.v = n.clone().multiplyScalar(d); } };
/** the push the elbow needs: the end of the upper arm, the elbow, and the start of the forearm (the shoulder turns) */
function elbowNeed(P) {
  const acc = {d: 0, v: null};
  for (const q of samples(P.S, P.E, 4, R.fore + 0.01, R.elbow)) { if (q.f < 0.5) continue; const c = clearance(q.p, q.r, P.S); if (c) take(acc, c.normal, c.push / q.f); }
  for (const q of samples(P.E, P.H, 6, R.elbow, R.wrist)) { if (q.f > 0.34) break; const c = clearance(q.p, q.r, P.S); if (c) take(acc, c.normal, c.push); }
  return acc.v;
}
/** the push the wrist needs: the outer forearm (a sample at a fraction f of it needs 1/f at the wrist), the wrist,
 *  the hand and the finger tip */
function wristNeed(P) {
  const acc = {d: 0, v: null};
  for (const q of samples(P.E, P.H, 6, R.elbow, R.wrist)) { if (q.f < 0.45) continue; const c = clearance(q.p, q.r, P.S); if (c) take(acc, c.normal, c.push / Math.max(q.f, 0.6)); }
  for (const [p, r] of [[P.F1, R.hand], [P.tip, R.tip]]) { const c = clearance(p, r, P.S); if (c) take(acc, c.normal, c.push); }
  return acc.v;
}
/** how deep the arm goes in at worst (cm of skin), for QA */
function armDepth(P) {
  let d = 0;
  for (const q of [...samples(P.S, P.E, 3, R.fore + 0.01, R.elbow), ...samples(P.E, P.H, 5, R.elbow, R.wrist), {p: P.F1, r: R.hand}, {p: P.tip, r: R.tip}]) {
    const c = clearance(q.p, q.r, P.S); if (c && c.push > d) d = c.push;
  }
  return d;
}
const _q0 = new THREE.Quaternion(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
/** turn `bone` (in world space) so the direction from its origin towards `from` points towards `to` */
function aim(bone, from, to) {
  const o = W(bone), u = from.clone().sub(o), v = to.clone().sub(o);
  if (u.lengthSq() < 1e-8 || v.lengthSq() < 1e-8) return;
  _q0.setFromUnitVectors(u.normalize(), v.normalize());
  bone.parent.getWorldQuaternion(_q1); bone.getWorldQuaternion(_q2);
  bone.quaternion.copy(_q1.invert().multiply(_q0).multiply(_q2));
  bone.updateMatrixWorld(true);
}
/** two-bone IK: wrist to T, the elbow staying in the arm's own bend plane */
function reach(arm, P, T) {
  const S = P.S, l1 = S.distanceTo(P.E), l2 = P.E.distanceTo(P.H);
  const st = T.clone().sub(S), d = THREE.MathUtils.clamp(st.length(), Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
  const u = st.normalize();
  const bend = P.E.clone().sub(S); bend.addScaledVector(u, -bend.dot(u));
  if (bend.lengthSq() < 1e-8) return;
  bend.normalize();
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const E2 = S.clone().addScaledVector(u, a).addScaledVector(bend, h);
  aim(arm.up, P.E, E2);
  aim(arm.fore, W(arm.hand), S.clone().addScaledVector(u, d));
}
const damp3 = (cur, want, kUp, kDown, dt) => {
  const k = want.lengthSq() >= cur.lengthSq() ? kUp : kDown;
  return cur.lerp(want, 1 - Math.exp(-k * dt));
};
/** keep both arms of `ch` out of the furniture (after the animation and the procedural poses of this frame) */
export function solveArms(ch, dt, on = true) {
  if (!bvh || !ch.mesh) return;
  const st = ch._contact || (ch._contact = {arms: ['L', 'R'].map(s => armBones(ch, s)).filter(Boolean).map(arm => ({arm, e: new THREE.Vector3(), w: new THREE.Vector3()}))});
  const Z = new THREE.Vector3();
  for (const A of st.arms) {
    let P = armPoints(A.arm);
    const ne = on ? elbowNeed(P) : null;
    damp3(A.e, ne ? ne.clampLength(0, 0.2) : Z, 30, 6, dt);
    if (A.e.lengthSq() > 1e-7) { aim(A.arm.up, P.E, P.E.clone().add(A.e)); P = armPoints(A.arm); }
    const nw = on ? wristNeed(P) : null;
    damp3(A.w, nw ? nw.clampLength(0, 0.25) : Z, 30, 6, dt);
    if (A.w.lengthSq() > 1e-7) reach(A.arm, P, P.H.clone().add(A.w));
  }
}

// ---------------------------------------------------------------- QA: limbs in furniture, bodies in each other
const worst = {};
function note(id, what, cm, at) { const k = id + ' ' + what; if (!worst[k] || worst[k].cm < cm) worst[k] = {cm, at: at ? [+at.x.toFixed(2), +at.y.toFixed(2), +at.z.toFixed(2)] : null, t: +(performance.now() / 1000).toFixed(1)}; }
function segDist(p1, q1, p2, q2) {         // closest distance between two segments
  const d1 = q1.clone().sub(p1), d2 = q2.clone().sub(p2), r = p1.clone().sub(p2);
  const a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r);
  let s, t;
  if (a <= 1e-9 && e <= 1e-9) return p1.distanceTo(p2);
  if (a <= 1e-9) { s = 0; t = THREE.MathUtils.clamp(f / e, 0, 1); }
  else { const c = d1.dot(r); if (e <= 1e-9) { t = 0; s = THREE.MathUtils.clamp(-c / a, 0, 1); } else {
    const b = d1.dot(d2), den = a * e - b * b; s = den !== 0 ? THREE.MathUtils.clamp((b * f - c * e) / den, 0, 1) : 0;
    t = (b * s + f) / e; if (t < 0) { t = 0; s = THREE.MathUtils.clamp(-c / a, 0, 1); } else if (t > 1) { t = 1; s = THREE.MathUtils.clamp((b - c) / a, 0, 1); } } }
  return p1.clone().addScaledVector(d1, s).distanceTo(p2.clone().addScaledVector(d2, t));
}
/** measure this frame (people within 10 m in front of the camera); depths in cm, the worst per person and limb */
export function clipSample(chars, camera) {
  if (!bvh) return;
  const cp = camera.getWorldPosition(new THREE.Vector3()), cd = camera.getWorldDirection(new THREE.Vector3());
  const seen = (p) => { const v = p.clone().sub(cp); return v.length() < 10 && v.dot(cd) > 0; };
  const live = chars.filter(c => c.holder.visible && c.mesh && c.id !== 'player' && seen(c.holder.position.clone().add(new THREE.Vector3(0, 1, 0))));
  const bodies = [];
  for (const ch of live) {
    const sk = ch.mesh.skeleton, B = (n) => sk.getBoneByName('Bip01_' + n);
    for (const s of ['L', 'R']) {
      const arm = armBones(ch, s); if (!arm) continue;
      const P = armPoints(arm), d = armDepth(P); if (d > 0) note(ch.id, s + ' arm', d * 100, P.H);
      const th = B(s + '_Thigh'), ca = B(s + '_Calf'), fo = B(s + '_Foot'), pel = B('Pelvis');
      if (th && ca && fo && pel) {
        const T = W(th), K = W(ca), F = W(fo), ref = W(pel).add(new THREE.Vector3(0, 0.25, 0));
        let dl = 0, at = null;
        for (const q of [...samples(T, K, 4, 0.075, 0.055), ...samples(K, F, 4, 0.055, 0.04)]) { const c = clearance(q.p, q.r, ref); if (c && c.push > dl) { dl = c.push; at = q.p; } }
        if (dl > 0) note(ch.id, s + ' leg', dl * 100, at);
      }
    }
    const pel = B('Pelvis'), neck = B('Neck');
    if (pel && neck) bodies.push({id: ch.id, a: W(pel), b: W(neck), r: ch.g === 'f' ? 0.15 : 0.17});
  }
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
    const A = bodies[i], Bb = bodies[j];
    if (A.a.distanceTo(Bb.a) > 1.5) continue;
    const d = segDist(A.a, A.b, Bb.a, Bb.b), over = A.r + Bb.r - d;
    if (over > 0.01) { note(A.id, 'body×' + Bb.id, over * 100, A.a); note(Bb.id, 'body×' + A.id, over * 100, Bb.a); }
  }
}
export function clipReport(reset = true) {
  const r = Object.entries(worst).filter(([, v]) => v.cm >= 1).sort((a, b) => b[1].cm - a[1].cm).map(([k, v]) => `${k} ${v.cm.toFixed(1)}cm @${v.at ? v.at.join(',') : ''} t${v.t}`);
  if (reset) for (const k in worst) delete worst[k];
  return r;
}

// ---------------------------------------------------------------- probes (QA / placement)
/** a horizontal slice through the furniture at height y: one character per cell, '#' where a surface passes within
 *  half a cell of the cell centre */
export function slice(x0, x1, z0, z1, step, y) {
  const rows = [], p = new THREE.Vector3(), t = {point: new THREE.Vector3(), distance: 0, faceIndex: 0};
  for (let z = z0; z <= z1 + 1e-6; z += step) {
    let row = '';
    for (let x = x0; x <= x1 + 1e-6; x += step) row += bvh.closestPointToPoint(p.set(x, y, z), t, 0, step * 0.5) ? '#' : '.';
    rows.push(z.toFixed(2).padStart(6) + ' ' + row);
  }
  return rows;
}
/** the top surface under each cell (cast down from `top`): heights in cm above `base`, '..' for nothing */
export function heights(x0, x1, z0, z1, step, base, top) {
  const rows = [], ray = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));
  for (let z = z0; z <= z1 + 1e-6; z += step) {
    let row = '';
    for (let x = x0; x <= x1 + 1e-6; x += step) { ray.origin.set(x, top, z); const h = bvh.raycastFirst(ray, THREE.DoubleSide); row += h && h.point.y > base + 0.2 ? String(Math.round((h.point.y - base) * 100)).padStart(4) : '  ..'; }
    rows.push(z.toFixed(2).padStart(6) + ' ' + row);
  }
  return rows;
}

// ---------------------------------------------------------------- bodies: out of the furniture, out of each other
const BODY = [[0.45, 0.12], [0.85, 0.16], [1.1, 0.17], [1.35, 0.17]];      // [height above the feet, radius]
const _bp = new THREE.Vector3(), _bt = {point: new THREE.Vector3(), distance: 0, faceIndex: 0};
/** the horizontal push that takes a standing body out of the furniture it is in (null when clear) */
export function bodyPush(ch) {
  if (!bvh || !ch.bones || !ch.bones.pelvis) return null;
  const pel = W(ch.bones.pelvis), y0 = ch.holder.position.y;
  let best = null, depth = 0;
  for (const [h, r] of BODY) {
    _bp.set(pel.x, y0 + h, pel.z);
    const c = bvh.closestPointToPoint(_bp, _bt, 0, r); if (!c) continue;
    const dx = _bp.x - c.point.x, dz = _bp.z - c.point.z, d = Math.hypot(dx, dz);
    if (d < 1e-4) continue;                                   // directly above or below a surface: not a side contact
    const need = r - d;
    if (need > depth) { depth = need; best = new THREE.Vector3(dx / d * need, 0, dz / d * need); }
  }
  return best;
}
/** people do not stand inside each other: standing pairs closer than their radii step apart (half each); a seated
 *  person and the player's (invisible) body are fixed and push the other one away */
export function separate(chars, playerPos, dt) {
  const live = chars.filter(c => c.holder.visible && c.mesh && c.id !== 'player');
  const k = Math.min(1, dt * 10);
  const pos = (c) => c.bones && c.bones.pelvis ? W(c.bones.pelvis) : c.holder.position;
  const items = live.map(c => ({c, p: pos(c), r: c.g === 'f' ? 0.19 : 0.21, fixed: !!c.seated}));
  if (playerPos) items.push({c: null, p: playerPos, r: 0.24, fixed: true});
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const A = items[i], B = items[j]; if (A.fixed && B.fixed) continue;
    if (Math.abs(A.p.y - B.p.y) > 1.2) continue;                     // different floors
    const dx = B.p.x - A.p.x, dz = B.p.z - A.p.z, d = Math.hypot(dx, dz), need = A.r + B.r - d;
    if (need <= 0 || d < 1e-4) continue;
    const ux = dx / d, uz = dz / d, sa = A.fixed ? 0 : B.fixed ? 1 : 0.5, sb = 1 - sa;
    if (!A.fixed) { A.c.holder.position.x -= ux * need * sa * k; A.c.holder.position.z -= uz * need * sa * k; }
    if (!B.fixed) { B.c.holder.position.x += ux * need * sb * k; B.c.holder.position.z += uz * need * sb * k; }
  }
}

// ---------------------------------------------------------------- seats: sit on the chair that is really there
/** the seat under a seat anchor: the centre and the height of the surface 0.38–0.62 m above the floor within 0.45 m */
export function findSeat(x, z, y0) {
  if (!bvh) return null;
  const ray = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(0, -1, 0)), hs = [];
  let sx = 0, sz = 0;
  for (let ix = -9; ix <= 9; ix++) for (let iz = -9; iz <= 9; iz++) {
    const px = x + ix * 0.05, pz = z + iz * 0.05;
    ray.origin.set(px, y0 + 0.66, pz);
    const h = bvh.raycastFirst(ray, THREE.DoubleSide);
    if (!h) continue;
    const hy = h.point.y - y0; if (hy < 0.38 || hy > 0.62) continue;
    hs.push(hy); sx += px; sz += pz;
  }
  if (hs.length < 6) return null;
  hs.sort((a, b) => a - b);
  return {x: sx / hs.length, z: sz / hs.length, top: hs[Math.floor(hs.length * 0.75)], n: hs.length};
}
/** where the sitting clip puts the pelvis and the underside of the thighs, in the holder's frame (measured on the
 *  character itself with a throw-away mixer; the pose it had is put back afterwards) */
export function sitPose(ch, clip) {
  const bones = ch.mesh.skeleton.bones, saved = bones.map(b => [b.position.clone(), b.quaternion.clone(), b.scale.clone()]);
  const hp = ch.holder.position.clone(), hr = ch.holder.rotation.y;
  ch.holder.position.set(0, 0, 0); ch.holder.rotation.y = 0;
  const mx = new THREE.AnimationMixer(ch.fbx); mx.clipAction(clip).play(); mx.update(0);
  ch.holder.updateMatrixWorld(true);
  const sk = ch.mesh.skeleton, B = (n) => sk.getBoneByName('Bip01_' + n);
  const pel = W(ch.bones.pelvis);
  let under = Infinity;
  for (const s of ['L', 'R']) { const T = W(B(s + '_Thigh')), K = W(B(s + '_Calf')); for (let f = 0.35; f <= 1.001; f += 0.13) under = Math.min(under, T.clone().lerp(K, f).y - 0.075); }
  mx.stopAllAction(); mx.uncacheRoot(ch.fbx);
  bones.forEach((b, i) => { b.position.copy(saved[i][0]); b.quaternion.copy(saved[i][1]); b.scale.copy(saved[i][2]); });
  ch.holder.position.copy(hp); ch.holder.rotation.y = hr; ch.holder.updateMatrixWorld(true);
  return {px: pel.x, pz: pel.z, under};
}
