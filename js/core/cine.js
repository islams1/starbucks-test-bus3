// Cinematic camera: tweened shots, spline flights, dialogue framing, gentle handheld noise.
import * as THREE from 'three';
import {camera, onUpdate, clamp} from './engine.js';

const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
let active = null;      // {update(dt)}
let shake = 0.0, shakeT = 0;
export const cine = {fovBase: 50};
const _look = new THREE.Vector3();

onUpdate((dt, t) => {
  if (active) active.update(dt);
  if (active && shake > 0) {  // subtle handheld breathing
    shakeT += dt;
    camera.rotation.x += Math.sin(shakeT * 0.9) * 0.0018 * shake + Math.sin(shakeT * 2.3) * 0.0007 * shake;
    camera.rotation.y += Math.sin(shakeT * 0.7 + 1) * 0.0022 * shake;
  }
});
export function stop() { active = null; }
export function handheld(v) { shake = v; }
function setFov(f) { if (Math.abs(camera.fov - f) > 0.01) { camera.fov = f; camera.updateProjectionMatrix(); } }

/** move from current camera to (pos, look) in dur seconds */
export function shot(pos, look, dur = 0, {fov = cine.fovBase, ez = ease} = {}) {
  const p0 = camera.position.clone(); const l0 = new THREE.Vector3(); camera.getWorldDirection(l0); l0.multiplyScalar(4).add(p0);
  const f0 = camera.fov;
  const P = () => typeof pos === 'function' ? pos() : pos, L = () => typeof look === 'function' ? look() : look;
  return new Promise(res => {
    let t = 0;
    active = {update(dt) {
      t += dt; const k = dur > 0 ? ez(clamp(t / dur, 0, 1)) : 1;
      camera.position.lerpVectors(p0, P(), k);
      _look.lerpVectors(l0, L(), k);
      camera.up.set(0, 1, 0); camera.lookAt(_look); setFov(f0 + (fov - f0) * k);
      if (t >= dur && res) { const r = res; res = null; r(); }
    }};
  });
}
/** keep framing (follows moving targets) until replaced */
export function hold(pos, look, {fov = cine.fovBase, drift = null} = {}) {
  let t = 0;
  active = {update(dt) {
    t += dt;
    const p = typeof pos === 'function' ? pos() : pos; const l = typeof look === 'function' ? look() : look;
    camera.position.copy(p); if (drift) camera.position.addScaledVector(drift, t);
    camera.lookAt(l); setFov(fov);
  }};
}
/** fly along a Catmull-Rom path of positions while looking at a (possibly moving) target */
export function fly(points, look, dur, {fov = cine.fovBase, fov1 = null, ez = ease} = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => p.isVector3 ? p : new THREE.Vector3(...p)), false, 'centripetal');
  const f0 = fov, f1 = fov1 ?? fov;
  return new Promise(res => {
    let t = 0;
    active = {update(dt) {
      t += dt; const k = ez(clamp(t / dur, 0, 1));
      curve.getPointAt(k, camera.position);
      const L = typeof look === 'function' ? look(k) : look; camera.lookAt(L);
      setFov(f0 + (f1 - f0) * k);
      if (t >= dur && res) { const r = res; res = null; r(); }
    }};
  });
}
/** over-the-shoulder framing on a speaker, from behind a listener */
export function ots(speaker, listener, {side = 1, dist = 0.9, height = 0.06, fov = 34, dur = 0.0} = {}) {
  const sp = () => speaker.headPos().clone();
  const pos = () => {
    const s = sp(), l = listener.headPos().clone();
    const dir = s.clone().sub(l); dir.y = 0; dir.normalize();
    const right = new THREE.Vector3(dir.z, 0, -dir.x).multiplyScalar(side);
    return l.clone().addScaledVector(dir, -dist).addScaledVector(right, 0.42).add(new THREE.Vector3(0, height, 0));
  };
  const look = () => sp().add(new THREE.Vector3(0, -0.06, 0));
  if (dur > 0) return shot(pos, look, dur, {fov}).then(() => hold(pos, look, {fov}));
  hold(pos, look, {fov}); return Promise.resolve();
}
/** medium close-up from the front of a character */
export function closeup(ch, {dist = 1.25, yawOff = 0.35, height = 0.0, fov = 30, dur = 0} = {}) {
  const pos = () => { const h = ch.headPos(); const r = ch.holder.rotation.y + yawOff; return new THREE.Vector3(h.x + Math.sin(r) * dist, h.y + height, h.z + Math.cos(r) * dist); };
  const look = () => ch.headPos().clone().add(new THREE.Vector3(0, -0.08, 0));
  if (dur > 0) return shot(pos, look, dur, {fov}).then(() => hold(pos, look, {fov}));
  hold(pos, look, {fov}); return Promise.resolve();
}
export {ease, easeOut};
