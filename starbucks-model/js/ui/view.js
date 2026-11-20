// The player's eye. 'seat': in the chair at the table, drag to look around. 'cafe': inside the replay — the player has
// stepped into the hanging screen and stands in the café as it was on Tuesday: drag to go around the place you look
// at, wheel / pinch to come closer. 'cine': the director has the camera (dialogue shots, the moves into the screen).
import * as THREE from 'three';
import {camera, onUpdate, clamp} from '../core/engine.js';
import * as cine from '../core/cine.js';
import {anchor, inCafe} from '../world/maquette.js';
import {HANG} from '../world/room.js';
import {FEED, feedPose} from '../world/screenfeed.js';
import {setNear} from '../story/sound.js';
import {quality} from '../core/quality.js';
import {fade} from './ui.js';

export const VIEW = {mode: 'cine', yaw: 0, pitch: -0.3, eye: new THREE.Vector3(0.02, 1.2, 1.02),
  orbit: {yaw: 0.0, pitch: 0.35, dist: 4.5, target: new THREE.Vector3(), want: new THREE.Vector3()}, locked: false, onChange: null};
const canvas = document.getElementById('gl');
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
// reduced motion, ?still, or the no-GPU level: still frames of the replay (with captions) instead of moves and queues
export const reducedMotion = () => RM || new URLSearchParams(location.search).has('still') || quality.level === 'cpu';
const LIM = {yaw: [-1.95, 1.95], pitch: [-0.95, 0.5], oyaw: [-1.3, 1.3], opitch: [0.04, 1.2], dist: [1.2, 8]};
export const screenCenter = () => new THREE.Vector3(HANG.x, HANG.y, HANG.z);

/** look from the seat towards a point */
export function seatLookAt(p) { const d = p.clone().sub(VIEW.eye); VIEW.yaw = Math.atan2(-d.x, -d.z); VIEW.pitch = Math.asin(clamp(d.y / d.length(), -1, 1)); }
function seatPose() { return {pos: VIEW.eye.clone(), look: VIEW.eye.clone().add(new THREE.Vector3(-Math.sin(VIEW.yaw) * Math.cos(VIEW.pitch), Math.sin(VIEW.pitch), -Math.cos(VIEW.yaw) * Math.cos(VIEW.pitch)))}; }
function orbitPos(o = VIEW.orbit, t = o.target) { return t.clone().add(new THREE.Vector3(Math.sin(o.yaw) * Math.cos(o.pitch), Math.sin(o.pitch), Math.cos(o.yaw) * Math.cos(o.pitch)).multiplyScalar(o.dist)); }
/** orbit parameters that reproduce a camera pose around a target */
function orbitFrom(eye, target) { const d = eye.clone().sub(target), L = d.length(); VIEW.orbit.dist = clamp(L, ...LIM.dist); VIEW.orbit.pitch = clamp(Math.asin(d.y / L), ...LIM.opitch); VIEW.orbit.yaw = clamp(Math.atan2(d.x, d.z), ...LIM.oyaw); VIEW.orbit.target.copy(target); VIEW.orbit.want.copy(target); }

function applyLook() {
  if (VIEW.mode === 'seat') { camera.position.copy(VIEW.eye); camera.rotation.set(VIEW.pitch, VIEW.yaw, 0, 'YXZ'); }
  else if (VIEW.mode === 'cafe') { const o = VIEW.orbit; o.target.lerp(o.want, 0.1); camera.position.copy(orbitPos()); camera.lookAt(o.target); }
}
onUpdate(() => {
  if (VIEW.mode !== 'cine') applyLook();
  // the café's sound: all around when the eye is in it, the screen's sound from the seat
  setNear(inCafe(camera.position) ? 1 : FEED.on ? 0.3 : 0.08);
});

// ---------------------------------------------------------------- input: drag to look / go around, wheel to come closer
let drag = null;
canvas.addEventListener('pointerdown', (e) => { if (VIEW.locked || VIEW.mode === 'cine') return; drag = {x: e.clientX, y: e.clientY, moved: false}; });
addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < 6) return;
  drag.moved = true; drag.x = e.clientX; drag.y = e.clientY;
  if (VIEW.mode === 'seat') { VIEW.yaw = clamp(VIEW.yaw + dx * 0.0032, ...LIM.yaw); VIEW.pitch = clamp(VIEW.pitch + dy * 0.0028, ...LIM.pitch); }
  else if (VIEW.mode === 'cafe') { VIEW.orbit.yaw = clamp(VIEW.orbit.yaw - dx * 0.005, ...LIM.oyaw); VIEW.orbit.pitch = clamp(VIEW.orbit.pitch + dy * 0.004, ...LIM.opitch); }
});
addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('wheel', (e) => {
  if (VIEW.locked || VIEW.mode === 'cine') return;
  e.preventDefault();
  if (VIEW.mode === 'seat') { if (e.deltaY < 0) enterCafe(); return; }
  const o = VIEW.orbit; o.dist = clamp(o.dist * Math.exp(e.deltaY * 0.0012), ...LIM.dist);
}, {passive: false});
const touches = new Map(); let pinch0 = null;
canvas.addEventListener('touchstart', (e) => { for (const t of e.changedTouches) touches.set(t.identifier, [t.clientX, t.clientY]); if (touches.size === 2) { const [a, b] = [...touches.values()]; pinch0 = {d: Math.hypot(a[0] - b[0], a[1] - b[1]), dist: VIEW.orbit.dist}; drag = null; } }, {passive: true});
canvas.addEventListener('touchmove', (e) => { for (const t of e.changedTouches) touches.set(t.identifier, [t.clientX, t.clientY]); if (pinch0 && touches.size === 2 && VIEW.mode === 'cafe') { const [a, b] = [...touches.values()]; VIEW.orbit.dist = clamp(pinch0.dist * pinch0.d / Math.max(20, Math.hypot(a[0] - b[0], a[1] - b[1])), ...LIM.dist); } }, {passive: true});
canvas.addEventListener('touchend', (e) => { for (const t of e.changedTouches) touches.delete(t.identifier); if (touches.size < 2) pinch0 = null; }, {passive: true});
canvas.addEventListener('dblclick', () => { if (VIEW.mode === 'seat') seatLookAt(screenCenter()); });
addEventListener('keydown', (e) => {
  if (VIEW.locked || VIEW.mode === 'cine' || e.target.closest('input,textarea')) return;
  const k = e.key, s = 0.08;
  if (VIEW.mode === 'seat') { if (k === 'ArrowLeft') VIEW.yaw = clamp(VIEW.yaw + s, ...LIM.yaw); else if (k === 'ArrowRight') VIEW.yaw = clamp(VIEW.yaw - s, ...LIM.yaw); else if (k === 'ArrowUp') VIEW.pitch = clamp(VIEW.pitch + s, ...LIM.pitch); else if (k === 'ArrowDown') VIEW.pitch = clamp(VIEW.pitch - s, ...LIM.pitch); else if (k === '+' || k === '=') enterCafe(); }
  else if (VIEW.mode === 'cafe') { const o = VIEW.orbit; if (k === 'ArrowLeft') o.yaw = clamp(o.yaw + s, ...LIM.oyaw); else if (k === 'ArrowRight') o.yaw = clamp(o.yaw - s, ...LIM.oyaw); else if (k === 'ArrowUp') o.pitch = clamp(o.pitch + s, ...LIM.opitch); else if (k === 'ArrowDown') o.pitch = clamp(o.pitch - s, ...LIM.opitch); else if (k === '+' || k === '=') o.dist = clamp(o.dist * 0.88, ...LIM.dist); else if (k === '-') o.dist = clamp(o.dist * 1.14, ...LIM.dist); }
});

// ---------------------------------------------------------------- mode changes
function setMode(m) { VIEW.mode = m; document.body.dataset.view = m; VIEW.onChange && VIEW.onChange(m); }
export function cineMode() { setMode('cine'); }
export function seatMode() { cine.stop(); setMode('seat'); }
/** back in the chair: out of the screen if the eye is in the café (a short dip), then a smooth turn */
export async function backToSeat({look = null, dur = 1.0} = {}) {
  if (look) seatLookAt(look);
  setMode('cine');
  const p = seatPose();
  if (inCafe(camera.position)) {
    await fade(true, 220);
    cine.shot(p.pos, p.look, 0, {fov: 50});
    await fade(false, 300);
  } else await cine.shot(p.pos, p.look, reducedMotion() ? 0 : dur, {fov: 50});
  seatMode();
}
/** step into the replay: the eye moves up to the hanging screen until the picture fills it, then stands in the café
 *  exactly where the screen's camera was. focus: a café anchor ('rail', 'pickup', 'center', 'door') */
export async function enterCafe(focus = null, {yaw = null, pitch = null, dist = null, dur = 1.1} = {}) {
  setMode('cine');
  if (!inCafe(camera.position)) {
    const c = screenCenter();
    if (!reducedMotion()) await cine.shot(c.clone().add(new THREE.Vector3(0.95, 0, 0)), c, 1.0, {fov: 58});
    await fade(true, 160);
    const f = feedPose(); cine.shot(f.eye, f.look, 0, {fov: f.fov});
    await fade(false, 260);
  }
  const t = focus ? anchor(focus) : feedPose().look;
  orbitFrom(camera.position, t);
  if (yaw != null) VIEW.orbit.yaw = yaw; if (pitch != null) VIEW.orbit.pitch = pitch; if (dist != null) VIEW.orbit.dist = dist;
  if (focus || yaw != null || pitch != null || dist != null) await cine.shot(orbitPos(), t, reducedMotion() ? 0 : dur, {fov: 52});
  cine.stop(); setMode('cafe');
}
/** inside the café, move the focus to another part of it */
export function focusCafe(focus) { const t = anchor(focus); if (t) VIEW.orbit.want.copy(t); }
export const viewMode = () => VIEW.mode;
