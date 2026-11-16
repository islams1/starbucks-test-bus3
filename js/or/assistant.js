// The assistant surgeon across the table: gowned and gloved, leaning a little over the sterile field with both hands
// resting on it (sterile hands never drop below the field), breathing, small unhurried hand adjustments, eyes on the
// field and now and then on the surgeon or on whoever is talking. His gown is green so he is never mistaken for
// Dr. Haddad (the same library avatar in blue).
import * as THREE from 'three';
import {CHEST} from './room.js';
import {bodyTop} from './body.js';
import {gloveTexture} from './hands.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const _q = new THREE.Quaternion(), _pq = new THREE.Quaternion();
const wp = (b) => b.getWorldPosition(V());

function aim(bone, from, to) {
  if (from.lengthSq() < 1e-10 || to.lengthSq() < 1e-10) return;
  _q.setFromUnitVectors(from.clone().normalize(), to.clone().normalize());
  bone.parent.getWorldQuaternion(_pq);
  bone.quaternion.premultiply(_pq.clone().invert().multiply(_q).multiply(_pq));
  bone.updateMatrixWorld(true);
}
function rotWorld(bone, axis, ang) {
  _q.setFromAxisAngle(axis, ang); bone.parent.getWorldQuaternion(_pq);
  bone.quaternion.premultiply(_pq.clone().invert().multiply(_q).multiply(_pq)); bone.updateMatrixWorld(true);
}
/** two-bone arm IK: shoulder → elbow → wrist on `t`, the elbow bent towards `pole` */
function twoBone(A, t, pole) {
  const a = wp(A.up), b = wp(A.fore), c = wp(A.hand);
  const l1 = a.distanceTo(b), l2 = b.distanceTo(c);
  const d = t.clone().sub(a), dist = Math.min(Math.max(d.length(), 0.05), l1 + l2 - 0.003), dir = d.normalize();
  const n = V().crossVectors(dir, pole).normalize();
  const cosA = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist);
  aim(A.up, b.clone().sub(a), dir.clone().applyAxisAngle(n, Math.acos(Math.max(-1, Math.min(1, cosA)))));
  aim(A.fore, wp(A.hand).sub(wp(A.fore)), t.clone().sub(wp(A.fore)));
}
/** turn the wrist: fingers along fdir, palm facing `palm` */
function orient(A, side, fdir, palm) {
  const h = wp(A.hand);
  aim(A.hand, wp(A.mid).sub(h), fdir);
  const f = wp(A.mid).sub(h).normalize(), across = wp(A.idx).sub(wp(A.pinky));
  const n = V().crossVectors(f, across).normalize(); if (side === 'R') n.negate();
  const want = palm.clone().addScaledVector(f, -palm.dot(f)); if (want.lengthSq() < 1e-6) return; want.normalize();
  n.addScaledVector(f, -n.dot(f)).normalize();
  rotWorld(A.hand, f, Math.atan2(V().crossVectors(n, want).dot(f), n.dot(want)));
}
/** a sterile gown in another colour: the blue cloth texels of the body texture are turned to theatre green */
async function gownColor(ch, hue = 0.44) {
  const mats = (Array.isArray(ch.mesh.material) ? ch.mesh.material : [ch.mesh.material]);
  const mat = mats.find(m => m.map && /body_color/.test(m.map.image?.src || m.map.source?.data?.src || '')) || mats.find(m => m.map && !m.alphaTest);
  if (!mat) return;
  await new Promise(r => { const ok = () => mat.map.image && mat.map.image.width; if (ok()) return r(); const i = setInterval(() => { if (ok()) { clearInterval(i); r(); } }, 50); });
  const im = mat.map.image, c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0); const px = g.getImageData(0, 0, c.width, c.height), d = px.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), v = mx, s = mx ? (mx - mn) / mx : 0;
    if (s < 0.22 || v < 0.08) continue;
    let h = mx === mn ? 0 : mx === r ? ((gg - b) / (mx - mn)) / 6 : mx === gg ? (2 + (b - r) / (mx - mn)) / 6 : (4 + (r - gg) / (mx - mn)) / 6; if (h < 0) h += 1;
    if (h < 0.5 || h > 0.7) continue;                                                  // blue cloth only
    const k = Math.min(1, (s - 0.22) / 0.1), nh = hue, ns = s * 0.8, nv = v * 0.92;
    const f = (n) => { const kk = (n + nh * 6) % 6; return nv - nv * ns * Math.max(0, Math.min(kk, 4 - kk, 1)); };
    d[i] = d[i] * (1 - k) + f(5) * 255 * k; d[i + 1] = d[i + 1] * (1 - k) + f(3) * 255 * k; d[i + 2] = d[i + 2] * (1 - k) + f(1) * 255 * k;
  }
  g.putImageData(px, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.flipY = mat.map.flipY; t.anisotropy = 8;
  mat.map = t; mat.needsUpdate = true;
}

export async function setupAssistant(a, others) {
  try { await gownColor(a); } catch (e) { console.warn('assistant gown', e); }
  // gloves, and the gown's long sleeves over his forearms (the library avatar wears an apron over short-sleeved scrubs)
  try { await gloveTexture(a, {sleeve: [52, 112, 92]}); } catch (e) { console.warn('assistant gloves', e); }
  const sk = a.mesh.skeleton, B = (n) => sk.getBoneByName(n);
  const F = ['Finger0', 'Finger1', 'Finger2', 'Finger3', 'Finger4'];
  const arms = {};
  for (const s of ['L', 'R']) arms[s] = {up: B(`Bip01_${s}_UpperArm`), fore: B(`Bip01_${s}_Forearm`), hand: B(`Bip01_${s}_Hand`),
    mid: B(`Bip01_${s}_Finger2`), idx: B(`Bip01_${s}_Finger1`), pinky: B(`Bip01_${s}_Finger4`),
    fingers: F.flatMap(f => [B(`Bip01_${s}_${f}`), B(`Bip01_${s}_${f}1`), B(`Bip01_${s}_${f}2`)]).filter(Boolean)};
  if (!arms.R.up || !arms.R.mid) return;
  const spine = B('Bip01_Spine1') || B('Bip01_Spine');
  // the bones this adds to are put back to the pure animation pose every frame (no build-up)
  a._post = [...a._postBones(), spine, ...['L', 'R'].flatMap(s => [arms[s].hand, ...arms[s].fingers])].filter(Boolean).map(b => [b, b.quaternion.clone()]);
  // where his hands rest: on the drape at the far edge of the field, his right hand towards the head
  const rest = {R: [CHEST.x - 0.1, -0.2], L: [CHEST.x + 0.1, -0.21]};
  const base = (s) => V(rest[s][0], bodyTop(rest[s][0], rest[s][1]) + 0.045, rest[s][1]);
  const shift = {R: V(), L: V()}, goal = {R: V(), L: V()};
  let t = Math.random() * 10, nextMove = 4;
  a.postIK = (dt) => {
    if (!a.holder.visible) return;
    t += dt;
    const fwd = V(0, 0, 1).applyQuaternion(a.holder.quaternion), up = V(0, 1, 0);
    if (spine) rotWorld(spine, V().crossVectors(up, fwd).normalize(), 0.3);                 // leaning over the table
    a.fbx.updateMatrixWorld(true);
    // now and then one hand shifts a little on the drape (smoothing it, steadying the field), unhurried
    if ((nextMove -= dt) < 0) { nextMove = 5 + Math.random() * 7; const s = Math.random() < 0.6 ? 'R' : 'L'; goal[s].set((Math.random() - 0.5) * 0.06, 0, (Math.random() - 0.3) * 0.04); }
    for (const s of ['R', 'L']) {
      shift[s].lerp(goal[s], 1 - Math.exp(-1.6 * dt));
      const tgt = base(s).add(shift[s]).add(V(Math.sin(t * 0.37 + (s === 'R' ? 0 : 2)) * 0.004, Math.sin(t * 0.9) * 0.002, 0));
      tgt.y = Math.max(tgt.y, bodyTop(tgt.x, tgt.z) + 0.04);
      const A = arms[s], other = wp(arms[s === 'R' ? 'L' : 'R'].up), out = wp(A.up).sub(other).setY(0).normalize();
      twoBone(A, tgt, V(0, -1, 0).addScaledVector(out, 0.6).addScaledVector(fwd, -0.35).normalize());
      const toMid = V(CHEST.x - wp(A.hand).x, 0, -wp(A.hand).z).normalize().multiplyScalar(0.5).addScaledVector(fwd, 0.6).add(V(0, -0.45, 0)).normalize();
      orient(A, s, toMid, V(0, -1, 0));
      for (const f of A.fingers) { const c = /Finger0/.test(f.name) ? 0.05 : /Finger1/.test(f.name) ? 0.12 : 0.2; f.rotateZ(c); f.updateMatrixWorld(true); }
    }
  };
  // eyes: the field, with glances at the surgeon and the team
  a.lookAt(CHEST.clone());
  let gT = 0, gNext = 3;
  a._life = (dt) => {
    if (!a.holder.visible || a.voice) return;
    if ((gT += dt) < gNext) return;
    gT = 0; gNext = 3 + Math.random() * 5; const r = Math.random();
    const target = r < 0.3 ? 'camera' : r < 0.45 && others.rania ? others.rania : r < 0.55 && others.layla ? others.layla : null;
    if (target) a._lookOv = {target, until: performance.now() + 1100 + Math.random() * 1400};
  };
}
