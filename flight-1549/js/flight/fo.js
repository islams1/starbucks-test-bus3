// The first officer's hands. In the real cockpit Jeff Skiles ran the engine restart from the QRH while the captain flew:
// ignition on, thrust levers to idle, the engine master switches off and back on. Here he does it with his own left hand
// on the pedestal (two-bone arm IK over his seated animation), looking at what he touches, and the switch or lever moves
// when his fingers reach it. Between tasks he holds the QRH open on his lap and his hands follow the animation.
import * as THREE from 'three';
import {CK} from './cockpit.js';
import {CTL, setLever} from './controls.js';

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
/** shoulder → elbow → wrist on t, the elbow bent toward `pole` (world space) */
function twoBone(A, t, pole) {
  const a = wp(A.up), b = wp(A.fore), c = wp(A.hand);
  const l1 = a.distanceTo(b), l2 = b.distanceTo(c);
  const d = t.clone().sub(a), dist = Math.min(Math.max(d.length(), 0.05), l1 + l2 - 0.003), dir = d.normalize();
  const n = V().crossVectors(dir, pole).normalize();
  const cosA = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist);
  aim(A.up, b.clone().sub(a), dir.clone().applyAxisAngle(n, Math.acos(Math.max(-1, Math.min(1, cosA)))));
  aim(A.fore, wp(A.hand).sub(wp(A.fore)), t.clone().sub(wp(A.fore)));
}
const ease = (k) => k * k * (3 - 2 * k);

export const FO = {queue: Promise.resolve(), busy: false};
export function setupFO(fo) {
  const sk = fo.mesh && fo.mesh.skeleton; if (!sk) return;
  const B = (n) => sk.getBoneByName(n);
  const arm = (s) => ({up: B(`Bip01_${s}_UpperArm`), fore: B(`Bip01_${s}_Forearm`), hand: B(`Bip01_${s}_Hand`), mid: B(`Bip01_${s}_Finger2`)});
  const L = arm('L'); if (!L.up || !L.hand) return;
  const spine = [B('Bip01_Spine1'), B('Bip01_Spine2')].filter(Boolean);
  let job = null;
  const prev = fo.postIK;
  fo.postIK = (dt) => {
    if (prev) prev(dt);
    if (!job) return;
    job.t += dt;
    const T1 = 0.75, T2 = T1 + job.hold, T3 = T2 + 0.7;
    const w = job.t < T1 ? ease(job.t / T1) : job.t < T2 ? 1 : Math.max(0, 1 - ease((job.t - T2) / (T3 - T2)));
    if (!job.touched && job.t >= T1 - 0.05) { job.touched = true; job.onTouch && job.onTouch(); }
    fo.fbx && fo.fbx.updateMatrixWorld(true);
    // he leans toward it (the pedestal is a long reach from the right seat): the upper body turns and bends over
    if (spine.length) {
      const tw = job.target(), from = wp(spine[0]), to = tw.clone().sub(from); const up = V(0, 1, 0).transformDirection(CK.group.matrixWorld);
      const axis = V().crossVectors(up, to).normalize(), k = w * Math.min(0.55, Math.max(0, to.length() - 0.45) * 1.6) / spine.length;
      for (const b of spine) { _q.setFromAxisAngle(axis, k); b.parent.getWorldQuaternion(_pq); b.quaternion.premultiply(_pq.clone().invert().multiply(_q).multiply(_pq)); b.updateMatrixWorld(true); }
    }
    // the wrist stops a hand's length short of the control, back toward his shoulder, so the fingers land on it
    const ctl = job.target(), sh = wp(L.up), wrist = ctl.clone().addScaledVector(sh.clone().sub(ctl).normalize(), 0.085);
    const goal = wp(L.hand).lerp(wrist, w);
    const pole = V(0.45, -1, -0.35).transformDirection(CK.group.matrixWorld);   // elbow down, out to his left, back
    twoBone(L, goal, pole);
    if (job.t >= T3) { const j = job; job = null; fo.lookAt(null); j.res(); }
  };
  /** reach a control with the left hand; `onTouch` fires when the fingers get there */
  FO.reach = (id, onTouch, hold = 0.7) => {
    FO.queue = FO.queue.then(() => new Promise(res => {
      const o = CTL.items[id]; if (!o) return res();
      fo.lookAt(o);
      job = {t: 0, hold, onTouch, touched: false, res, target: () => (o.userData.cap || o).getWorldPosition(V())};   // the knob, not the base
    }));
    return FO.queue;
  };
}
const click = () => { try { window.__clickSnd && window.__clickSnd(); } catch (e) {} };
/** the first officer sets a lever (thrust, ENG MODE, ENG MASTER) to a position, by hand */
export function foSet(id, idx, hold = 0.9) {
  if (!FO.reach) { setLever(id, idx); return Promise.resolve(); }
  return FO.reach(id, () => { setLever(id, idx); click(); }, hold);
}
