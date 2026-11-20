// The player's eye. 'seat': in the chair at the table, drag to look around. 'model': leaning into the store model —
// drag to go around it, wheel / pinch to come closer; everything not in focus goes soft (tilt-shift), the café's sound
// comes up. 'cine': the director has the camera (dialogue shots, the dive into the model).
import * as THREE from 'three';
import {camera, onUpdate, gtao, tilt, setDepthRange, clamp, renderOpts} from '../core/engine.js';
import * as cine from '../core/cine.js';
import {anchor} from '../world/maquette.js';
import {setNear} from '../story/sound.js';
import {setRoomDim} from '../world/lighting.js';
import {quality} from '../core/quality.js';

export const VIEW = {mode: 'cine', yaw: 0, pitch: -0.3, eye: new THREE.Vector3(0.02, 1.2, 1.02),
  orbit: {yaw: 0.0, pitch: 0.62, dist: 0.62, target: new THREE.Vector3(), want: new THREE.Vector3()}, locked: false, onChange: null};
const canvas = document.getElementById('gl');
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
// reduced motion, ?still, or the no-GPU level: still frames of the model (with captions) instead of pans and queues
export const reducedMotion = () => RM || new URLSearchParams(location.search).has('still') || quality.level === 'cpu';
const LIM = {yaw: [-1.95, 1.95], pitch: [-0.95, 0.4], opitch: [0.1, 1.38], dist: [0.14, 1.05]};

/** look from the seat towards a point (or keep yaw/pitch) */
export function seatLookAt(p) { const d = p.clone().sub(VIEW.eye); VIEW.yaw = Math.atan2(-d.x, -d.z); VIEW.pitch = Math.asin(clamp(d.y / d.length(), -1, 1)); }
function seatPose() { return {pos: VIEW.eye.clone(), look: VIEW.eye.clone().add(new THREE.Vector3(-Math.sin(VIEW.yaw) * Math.cos(VIEW.pitch), Math.sin(VIEW.pitch), -Math.cos(VIEW.yaw) * Math.cos(VIEW.pitch)))}; }
function orbitPos(o = VIEW.orbit, t = o.target) { return t.clone().add(new THREE.Vector3(Math.sin(o.yaw) * Math.cos(o.pitch), Math.sin(o.pitch), Math.cos(o.yaw) * Math.cos(o.pitch)).multiplyScalar(o.dist)); }

function applyLook() {
  if (VIEW.mode === 'seat') {
    camera.position.copy(VIEW.eye); camera.rotation.set(VIEW.pitch, VIEW.yaw, 0, 'YXZ');
  } else if (VIEW.mode === 'model') {
    const o = VIEW.orbit; o.target.lerp(o.want, 0.12);
    camera.position.copy(orbitPos()); camera.lookAt(o.target);
  }
}
onUpdate((dt) => {
  if (VIEW.mode !== 'cine') applyLook();
  // the miniature look: depth range, soft focus, ambient occlusion radius and the café's loudness follow the eye
  const m = modelness();
  setDepthRange(m > 0.5 ? 0.003 : 0.03, m > 0.5 ? 30 : 90);
  const amt = renderOpts.direct ? 0 : m * (VIEW.mode === 'model' ? clamp((1.05 - VIEW.orbit.dist) / 0.8, 0.25, 1) : 1) * 9;
  tilt.enabled = amt > 0.3; tilt.uniforms.amount.value += (amt - tilt.uniforms.amount.value) * Math.min(1, dt * 4);
  tilt.uniforms.band.value = VIEW.mode === 'model' ? 0.07 + VIEW.orbit.dist * 0.08 : 0.1;
  const r = m > 0.5 ? 0.028 : 0.45; if (Math.abs((gtao._r || 0) - r) > 1e-3) { gtao._r = r; gtao.updateGtaoMaterial({radius: r}); }
  setNear(VIEW.mode === 'model' ? clamp(1.1 - VIEW.orbit.dist, 0.2, 1) : m > 0.5 ? 1 : 0.15);
  const s = clamp((m - 0.5) / 0.5, 0, 1); setRoomDim(s * s * (3 - 2 * s) * 0.9);
});
/** 0 at the seat, 1 down in the model (from the camera's distance to the model) */
let _mc = null;
export function modelness() { _mc = _mc || anchor('center'); if (!_mc) return 0; const d = camera.position.distanceTo(_mc); return clamp((0.95 - d) / 0.45, 0, 1); }

// ---------------------------------------------------------------- input: drag to look / orbit, wheel to lean in / zoom
let drag = null;
canvas.addEventListener('pointerdown', (e) => { if (VIEW.locked || VIEW.mode === 'cine') return; drag = {x: e.clientX, y: e.clientY, moved: false, id: e.pointerId, pts: new Map([[e.pointerId, [e.clientX, e.clientY]]])}; });
addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < 6) return;
  drag.moved = true; drag.x = e.clientX; drag.y = e.clientY;
  if (VIEW.mode === 'seat') { VIEW.yaw = clamp(VIEW.yaw + dx * 0.0032, ...LIM.yaw); VIEW.pitch = clamp(VIEW.pitch + dy * 0.0028, ...LIM.pitch); }
  else if (VIEW.mode === 'model') { VIEW.orbit.yaw -= dx * 0.006; VIEW.orbit.pitch = clamp(VIEW.orbit.pitch + dy * 0.004, ...LIM.opitch); }
});
addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('wheel', (e) => {
  if (VIEW.locked || VIEW.mode === 'cine') return;
  e.preventDefault();
  if (VIEW.mode === 'seat') { if (e.deltaY < 0) leanIn(); return; }
  const o = VIEW.orbit; o.dist = clamp(o.dist * Math.exp(e.deltaY * 0.0012), ...LIM.dist);
  if (e.deltaY > 0 && o.dist >= LIM.dist[1] - 0.001) backToSeat();
}, {passive: false});
// pinch (two fingers) in the model
const touches = new Map(); let pinch0 = null;
canvas.addEventListener('touchstart', (e) => { for (const t of e.changedTouches) touches.set(t.identifier, [t.clientX, t.clientY]); if (touches.size === 2) { const [a, b] = [...touches.values()]; pinch0 = {d: Math.hypot(a[0] - b[0], a[1] - b[1]), dist: VIEW.orbit.dist}; drag = null; } }, {passive: true});
canvas.addEventListener('touchmove', (e) => { for (const t of e.changedTouches) touches.set(t.identifier, [t.clientX, t.clientY]); if (pinch0 && touches.size === 2 && VIEW.mode === 'model') { const [a, b] = [...touches.values()]; VIEW.orbit.dist = clamp(pinch0.dist * pinch0.d / Math.max(20, Math.hypot(a[0] - b[0], a[1] - b[1])), ...LIM.dist); } }, {passive: true});
canvas.addEventListener('touchend', (e) => { for (const t of e.changedTouches) touches.delete(t.identifier); if (touches.size < 2) pinch0 = null; }, {passive: true});
canvas.addEventListener('dblclick', () => { if (VIEW.mode === 'seat') seatLookAt(anchor('center')); });
// keyboard: arrows look / orbit, +/- lean in and out
addEventListener('keydown', (e) => {
  if (VIEW.locked || VIEW.mode === 'cine' || e.target.closest('input,textarea')) return;
  const k = e.key, s = 0.08;
  if (VIEW.mode === 'seat') { if (k === 'ArrowLeft') VIEW.yaw = clamp(VIEW.yaw + s, ...LIM.yaw); else if (k === 'ArrowRight') VIEW.yaw = clamp(VIEW.yaw - s, ...LIM.yaw); else if (k === 'ArrowUp') VIEW.pitch = clamp(VIEW.pitch + s, ...LIM.pitch); else if (k === 'ArrowDown') VIEW.pitch = clamp(VIEW.pitch - s, ...LIM.pitch); else if (k === '+' || k === '=') leanIn(); }
  else if (VIEW.mode === 'model') { const o = VIEW.orbit; if (k === 'ArrowLeft') o.yaw += s; else if (k === 'ArrowRight') o.yaw -= s; else if (k === 'ArrowUp') o.pitch = clamp(o.pitch + s, ...LIM.opitch); else if (k === 'ArrowDown') o.pitch = clamp(o.pitch - s, ...LIM.opitch); else if (k === '+' || k === '=') o.dist = clamp(o.dist * 0.88, ...LIM.dist); else if (k === '-') { o.dist = clamp(o.dist * 1.14, ...LIM.dist); if (o.dist >= LIM.dist[1] - 0.001) backToSeat(); } }
});

// ---------------------------------------------------------------- mode changes
function setMode(m) { VIEW.mode = m; document.body.dataset.view = m; VIEW.onChange && VIEW.onChange(m); }
/** hand the camera to the director */
export function cineMode() { setMode('cine'); }
/** sit back in the chair (smoothly from wherever the camera is) */
export async function backToSeat({look = null, dur = 1.1} = {}) {
  if (look) seatLookAt(look);
  setMode('cine');
  const p = seatPose();
  if (reducedMotion()) dur = 0;
  await cine.shot(p.pos, p.look, dur, {fov: 50});
  cine.stop(); setMode('seat');
}
/** lean into the model; focus: a café-frame anchor name ('center', 'rail', 'pickup', 'door') */
export async function leanIn(focus = 'center', {yaw = null, pitch = null, dist = null, dur = 1.2} = {}) {
  const o = VIEW.orbit, t = anchor(focus) || anchor('center');
  o.want.copy(t); o.target.copy(t);
  if (yaw != null) o.yaw = yaw; if (pitch != null) o.pitch = pitch; if (dist != null) o.dist = dist;
  if (VIEW.mode !== 'model') { if (yaw == null) o.yaw = 0.0; if (pitch == null) o.pitch = 0.62; if (dist == null) o.dist = 0.58; }
  setMode('cine');
  if (reducedMotion()) dur = 0;
  await cine.shot(orbitPos(o, t), t, dur, {fov: 42});
  cine.stop(); setMode('model');
}
/** while in the model, move the focus to another part of it */
export function focusModel(focus) { const t = anchor(focus); if (t) VIEW.orbit.want.copy(t); }
export const viewMode = () => VIEW.mode;
