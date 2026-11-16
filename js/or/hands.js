// The surgeon's own arms in first person: two-bone IK to the instrument grip (right) and to a steadying point (left),
// the wrist turned so the fingers run along the instrument, fingers curled into a grip, the body leaning over the
// table, hands painted as surgical gloves and forearms as gown sleeves (by bone weights, at load).
import * as THREE from 'three';
import {onUpdate} from '../core/engine.js';
import {fpReset, fpFollow} from './fphands.js';
import {closeHand, handFrame, boneQuat} from './grips.js';

const V = () => new THREE.Vector3();
const _a = V(), _b = V(), _c = V(), _d = V(), _n = V();
const _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _id = new THREE.Quaternion();
export const HANDS = {L: {w: 0, t: V(), fdir: null, palm: null}, R: {w: 0, t: V(), fdir: null, palm: null}, grip: 0, gripL: 0.25, lean: 0.22, curl: 1, curlSign: 1, elbowOut: 0.15, elbowBack: 0.7, ch: null, on: false};
let arms = {};                       // the arm set the IK works on (the first-person rig, or the full body in cutaways)
const bodyArms = {};

function aim(bone, from, to, w) {
  if (from.lengthSq() < 1e-10 || to.lengthSq() < 1e-10) return;
  _q.setFromUnitVectors(from.clone().normalize(), to.clone().normalize());
  if (w < 1) _q.slerp(_id, 1 - w);
  bone.parent.getWorldQuaternion(_pq);
  bone.quaternion.premultiply(_pq.clone().invert().multiply(_q).multiply(_pq));
  bone.updateMatrixWorld(true);
}
function rotWorld(bone, axis, ang) {
  _q.setFromAxisAngle(axis, ang);
  bone.parent.getWorldQuaternion(_pq);
  bone.quaternion.premultiply(_pq.clone().invert().multiply(_q).multiply(_pq));
  bone.updateMatrixWorld(true);
}
function solve(side, t, w, set = arms) {
  const A = set[side]; if (!A || w <= 0.001) return;
  const tipB = A.end || A.hand;                 // the chain's end: the forearm's own end bone when the hand hangs elsewhere (fphands)
  A.up.getWorldPosition(_a); A.fore.getWorldPosition(_b); tipB.getWorldPosition(_c);
  const l1 = _a.distanceTo(_b), l2 = _b.distanceTo(_c);
  _d.subVectors(t, _a); const dist = Math.min(Math.max(_d.length(), 0.05), l1 + l2 - 0.002); const dirT = _d.normalize().clone();
  const other = set[side === 'R' ? 'L' : 'R'].up.getWorldPosition(V());
  const outward = _a.clone().sub(other).setY(0).normalize();
  const back = HANDS.ch ? V().set(0, 0, -1).applyQuaternion(HANDS.ch.holder.quaternion) : HANDS.backDir.clone();
  const pole = outward.multiplyScalar(HANDS.elbowOut).add(new THREE.Vector3(0, -0.8, 0)).addScaledVector(back, HANDS.elbowBack);     // elbows down, a little out and back
  _n.crossVectors(dirT, pole).normalize();
  const cosA = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist);
  const elbowDir = dirT.clone().applyAxisAngle(_n, Math.acos(Math.max(-1, Math.min(1, cosA))));
  aim(A.up, _b.clone().sub(_a), elbowDir, w);
  A.fore.getWorldPosition(_b); tipB.getWorldPosition(_c);
  aim(A.fore, _c.clone().sub(_b), t.clone().sub(_b), w);
}
/** turn the wrist: fingers along fdir, palm facing palm (both world directions) */
function orient(side, fdir, palm, w, set = arms) {
  const A = set[side]; if (!A || !A.mid || w <= 0.01) return;
  const h = A.hand.getWorldPosition(V());
  aim(A.hand, A.mid.getWorldPosition(V()).sub(h), fdir, w);
  if (!palm || !A.idx || !A.pinky) return;
  const f = A.mid.getWorldPosition(V()).sub(h).normalize();
  const across = A.idx.getWorldPosition(V()).sub(A.pinky.getWorldPosition(V()));
  const n = V().crossVectors(f, across).normalize(); if (side === 'R') n.negate();      // n = palm normal
  const want = palm.clone().addScaledVector(f, -palm.dot(f)); if (want.lengthSq() < 1e-6) return; want.normalize();
  n.addScaledVector(f, -n.dot(f)).normalize();
  const ang = Math.atan2(V().crossVectors(n, want).dot(f), n.dot(want));
  rotWorld(A.hand, f, ang * w);
}
/** paint gloves (hand + finger bones) and gown sleeves (forearm) into the body texture */
async function gloveTexture(ch) {
  const mesh = ch.mesh, geo = mesh.geometry, sk = mesh.skeleton;
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const mat = mats.find(m => m.map && /body_color/.test(m.map.image?.src || m.map.source?.data?.src || '')) || mats.find(m => m.map) || mats[0];
  if (!mat.map) return;
  await new Promise(r => { const ok = () => mat.map.image && mat.map.image.width; if (ok()) return r(); const i = setInterval(() => { if (ok()) { clearInterval(i); r(); } }, 50); });
  const im = mat.map.image, W = im.width, Hh = im.height;
  const cls = sk.bones.map(b => /Finger|_Hand$/.test(b.name) ? 1 : /Forearm|UpperArm|Clavicle/.test(b.name) ? 2 : 0);
  const si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, uv = geo.attributes.uv, index = geo.index;
  const domClass = (v) => { let best = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = sw.getComponent(v, k); if (w > bw) { bw = w; best = si.getComponent(v, k); } } return cls[best]; };
  const mask = document.createElement('canvas'); mask.width = W; mask.height = Hh; const mg = mask.getContext('2d');
  const vi = index ? (i) => index.getX(i) : (i) => i;
  const groups = geo.groups.length ? geo.groups : [{start: 0, count: index ? index.count : geo.attributes.position.count, materialIndex: 0}];
  for (const gr of groups) {
    if (mats[gr.materialIndex] !== mat) continue;
    for (let i = gr.start; i < gr.start + gr.count; i += 3) {
      const a = vi(i), b = vi(i + 1), c = vi(i + 2);
      const ca = domClass(a), cb = domClass(b), cc = domClass(c);
      const n1 = (ca === 1) + (cb === 1) + (cc === 1), n2 = (ca === 2) + (cb === 2) + (cc === 2);
      const k = n1 >= 2 ? 1 : n2 >= 2 || (n1 === 1 && n2 >= 1) ? 2 : 0;
      if (!k) continue;
      mg.fillStyle = k === 1 ? '#ff0000' : '#00ff00'; mg.strokeStyle = mg.fillStyle; mg.lineWidth = 3;
      mg.beginPath(); [a, b, c].forEach((v, j) => { const x = uv.getX(v) * W, y = (1 - uv.getY(v)) * Hh; j ? mg.lineTo(x, y) : mg.moveTo(x, y); }); mg.closePath(); mg.fill(); mg.stroke();
    }
  }
  const out = document.createElement('canvas'); out.width = W; out.height = Hh; const og = out.getContext('2d'); og.drawImage(im, 0, 0, W, Hh);
  const px = og.getImageData(0, 0, W, Hh), mk = mg.getImageData(0, 0, W, Hh).data, d = px.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!mk[i + 3]) continue;
    const lum = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255;
    const glove = mk[i] > 128, s = glove ? 0.2 + 1.15 * lum : 0.7 + 0.45 * lum;     // keep the knuckles and creases readable
    const col = glove ? [214, 192, 150] : [44, 92, 138];          // latex glove / sterile gown sleeve
    d[i] = Math.min(255, col[0] * s); d[i + 1] = Math.min(255, col[1] * s); d[i + 2] = Math.min(255, col[2] * s);
  }
  og.putImageData(px, 0, 0);
  const t = new THREE.CanvasTexture(out); t.colorSpace = THREE.SRGBColorSpace; t.flipY = mat.map.flipY; t.anisotropy = 8;
  mat.map = t; mat.roughness = 0.5; mat.needsUpdate = true;
}
/** first person: a second skinned mesh with only the arm triangles (upper arm → fingers), on the same skeleton */
function armsMesh(ch) {
  const mesh = ch.mesh, geo = mesh.geometry, sk = mesh.skeleton;
  const arm = sk.bones.map(b => /UpperArm|Forearm|_Hand$|Finger/.test(b.name) ? 1 : 0);
  const si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, n = geo.attributes.position.count;
  const w = new Float32Array(n);
  for (let v = 0; v < n; v++) { let s = 0; for (let k = 0; k < 4; k++) if (arm[si.getComponent(v, k)]) s += sw.getComponent(v, k); w[v] = s; }
  const index = geo.index, vi = index ? (i) => index.getX(i) : (i) => i;
  const src = geo.groups.length ? geo.groups : [{start: 0, count: index ? index.count : n, materialIndex: 0}];
  const idx = [], groups = [];
  for (const gr of src) {
    const s0 = idx.length;
    for (let i = gr.start; i < gr.start + gr.count; i += 3) { const a = vi(i), b = vi(i + 1), c = vi(i + 2); if (w[a] + w[b] + w[c] >= 1.6) idx.push(a, b, c); }
    if (idx.length > s0) groups.push([s0, idx.length - s0, gr.materialIndex]);
  }
  const g2 = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'uv', 'skinIndex', 'skinWeight']) if (geo.attributes[k]) g2.setAttribute(k, geo.attributes[k]);
  g2.setIndex(idx); for (const [s0, c, m] of groups) g2.addGroup(s0, c, m);
  const m2 = new THREE.SkinnedMesh(g2, mesh.material);
  m2.position.copy(mesh.position); m2.quaternion.copy(mesh.quaternion); m2.scale.copy(mesh.scale);
  mesh.parent.add(m2); m2.bind(sk, mesh.bindMatrix);
  m2.castShadow = true; m2.receiveShadow = true; m2.frustumCulled = false; m2.visible = false;
  return m2;
}
const FINGERS = ['Finger0', 'Finger1', 'Finger2', 'Finger3', 'Finger4'];
export async function initHands(ch) {
  HANDS.ch = ch;
  const sk = ch.mesh.skeleton, B = (n) => sk.getBoneByName(n);
  arms = bodyArms;
  for (const s of ['L', 'R']) arms[s] = {up: B(`Bip01_${s}_UpperArm`), fore: B(`Bip01_${s}_Forearm`), hand: B(`Bip01_${s}_Hand`),
    mid: B(`Bip01_${s}_Finger2`), idx: B(`Bip01_${s}_Finger1`), pinky: B(`Bip01_${s}_Finger4`),
    fingers: FINGERS.flatMap(f => [B(`Bip01_${s}_${f}`), B(`Bip01_${s}_${f}1`), B(`Bip01_${s}_${f}2`)]).filter(Boolean)};
  arms.head = B('Bip01_Head'); arms.spine = B('Bip01_Spine1') || B('Bip01_Spine');
  // the bones this module turns are reset to the pure animation pose every frame (no build-up)
  const extra = [arms.spine, ...['L', 'R'].flatMap(s => [arms[s].hand, ...arms[s].fingers])].filter(Boolean);
  ch._post = [...ch._postBones(), ...extra].map(b => [b, b.quaternion.clone()]);
  try { await gloveTexture(ch); } catch (e) { console.warn('glove texture', e); }
  HANDS.arms = armsMesh(ch);
  const up = new THREE.Vector3(0, 1, 0);
  ch.postIK = () => {
    if (!HANDS.on) return;
    if (arms.spine && HANDS.lean) { const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(ch.holder.quaternion); rotWorld(arms.spine, V().crossVectors(up, fwd).normalize(), HANDS.lean); }
    ch.fbx.updateMatrixWorld(true);
    for (const s of ['R', 'L']) {
      const h = HANDS[s];
      solve(s, h.t, h.w, bodyArms);
      if (h.fdir) orient(s, h.fdir, h.palm, h.w, bodyArms);
      const k = (s === 'R' ? HANDS.grip : HANDS.gripL) * HANDS.curl;
      for (const f of bodyArms[s].fingers) { const c = /Finger0/.test(f.name) ? 0.08 : /Finger1/.test(f.name) ? 0.1 : /Finger2/.test(f.name) ? 0.22 : 0.32; f.rotateZ(c * k * HANDS.curlSign); f.updateMatrixWorld(true); }
    }
  };
}
/** use the realistic first-person rig (fphands.js) for the surgeon's own view */
export function useRig(fp) {
  HANDS.rig = fp; arms = fp.arms;
  HANDS.rigCurl = {axis: new THREE.Vector3(1, 0, 0), sign: 1};
  const qb = new THREE.Quaternion(), qc = new THREE.Quaternion(), wr = V();
  onUpdate((dt) => {
    if (!HANDS.on || !HANDS.fp || !HANDS.rig) return;
    fpReset();
    for (const s of ['R', 'L']) {
      const h = HANDS[s], a = fp.arms[s];
      if (h.pose && a.can && h.w > 0.001) {
        // grip-driven: the wrist goes where the grip needs it, the hand turns exactly, the instrument is placed from
        // the hand as it really ended up (so it never floats out of the fingers), then the fingers close on it
        const P = h.pose;
        solve(s, P.wrist, h.w, fp.arms); fpFollow();
        a.hand.parent.getWorldQuaternion(_pq);
        boneQuat(a, P.Qc, qb); qb.premultiply(_pq.clone().invert());
        a.hand.quaternion.slerp(qb, h.w); a.hand.updateMatrixWorld(true);
        handFrame(a, qc); a.hand.getWorldPosition(wr);
        if (P.sock && P.mesh) {
          const tipW = P.sock.pos.clone().applyQuaternion(qc).add(wr);
          const dirW = P.sock.dir.clone().applyQuaternion(qc), AW = P.sock.A.clone().applyQuaternion(qc).add(wr);
          if (P.glue) { P.mesh.position.copy(tipW); P.mesh.quaternion.copy(qc).multiply(P.sock.quat); P.mesh.updateMatrixWorld(true); }
          h.err = closeHand(a, P.grip, {tipW, dirW, A: AW, r: P.r, w: P.close});
        } else closeHand(a, P.grip, {w: P.close});
        continue;
      }
      solve(s, h.t, h.w, fp.arms);
      fpFollow();
      if (h.fdir) orient(s, h.fdir, h.palm, h.w, fp.arms);
      const k = (s === 'R' ? HANDS.grip : HANDS.gripL) * HANDS.curl * HANDS.rigCurl.sign;
      // a pencil/knife grip: index and thumb guide, the other fingers wrap
      for (const f of fp.arms[s].fingers) { const c = /thumb/.test(f.name) ? 0.22 : /index/.test(f.name) ? 0.32 : /middle/.test(f.name) ? 0.52 : 0.66; f.rotateOnAxis(HANDS.rigCurl.axis, c * k); f.updateMatrixWorld(true); }
    }
  });
  firstPerson(HANDS.fp !== false);
}
/** lab page: hands without a surgeon avatar */
export function initLab() { HANDS.on = true; HANDS.fp = true; HANDS.backDir = new THREE.Vector3(0, 0, 1); }
/** first-person body on/off (head hidden so the camera can sit at the eyes) */
export function handsOn(on) { HANDS.on = on; firstPerson(on); }
/** first person = only the arms are drawn; third person (cutaways) = the whole surgeon */
export function firstPerson(on) {
  const ch = HANDS.ch; if (!ch || !HANDS.arms) return;
  ch.mesh.visible = !on; HANDS.fp = on;
  HANDS.arms.visible = on && !HANDS.rig;                     // the old arms only when the realistic rig is missing
  if (HANDS.rig) HANDS.rig.group.visible = on;
}
/** move a hand target smoothly (called every frame by the instrument code) */
export function reach(side, target, w = 1, k = 0.35) { const h = HANDS[side]; if (!target) return; h.t.lerp(target, h.w < 0.05 ? 1 : k); h.w += (w - h.w) * 0.2; }
export function headWorld() { return arms.head ? arms.head.getWorldPosition(V()) : null; }
export {arms};
