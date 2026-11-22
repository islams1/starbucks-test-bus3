// The player's eye. 'walk': on foot in the café (stage 1, as the case asks: first person at the counter) — drag to
// look around, W A S D / arrows to walk; the counter, tables, chairs, sofa, plants and people stop you.
// 'seat': in the chair at the committee's table, drag to look around. 'cafe': inside the replay — the player has
// stepped into the hanging screen and stands in the café as it was on Tuesday: drag to go around the place you look
// at, wheel / pinch to come closer. 'cine': the director has the camera (dialogue shots, the moves into the screen).
import * as THREE from 'three';
import {camera, onUpdate, clamp} from '../core/engine.js';
import * as cine from '../core/cine.js';
import {anchor, inCafe, CAFE_POS} from '../world/maquette.js';
import {characters} from '../actors/character.js';
import {HANG} from '../world/room.js';
import {FEED, feedPose} from '../world/screenfeed.js';
import {setNear} from '../story/sound.js';
import {quality} from '../core/quality.js';
import {fade} from './ui.js';
import {footstep} from '../core/audio.js';
const EN = new URLSearchParams(location.search).get('lang') === 'en';

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

// ---------------------------------------------------------------- on foot in the café
export const WALK = {x: 0, z: 0, eye: 1.62, speed: 1.35, run: 2.6, r: 0.26, held: new Set(), v: 0, phase: 0, bob: 0};
// the customers' floor (café frame): in front of the counter (its face is at z −1.2) to the shop window
const FLOOR = {x0: -4.85, x1: 4.85, z0: -1.2 + 0.3, z1: 3.5};
// round obstacles [x, z, r]: the tables with their chairs, the plants; boxes [x0, x1, z0, z1]: the sofa
const ROUND = [[-3.05, 1.05, 0.78], [-1.25, 2.95, 0.78], [-3.4, 2.95, 0.78], [-0.9, 1.0, 0.78], [0.75, 2.4, 0.78], [-4.72, -0.55, 0.32], [-4.65, 1.65, 0.32], [1.9, 3.35, 0.32]];
const RECT = [[-5.3, -3.95, 1.9, 4.0]];
export const walkEye = () => new THREE.Vector3(WALK.x, WALK.eye, WALK.z);
/** keep a café-frame point (x, z) out of the furniture and the people; returns [x, z] */
function settle(x, z) {
  const r = WALK.r;
  for (let it = 0; it < 3; it++) {
    x = clamp(x, FLOOR.x0 + r, FLOOR.x1 - r); z = clamp(z, FLOOR.z0, FLOOR.z1 - r);
    for (const [cx, cz, cr] of ROUND) { const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz), m = cr + r; if (d < m && d > 1e-4) { x = cx + dx / d * m; z = cz + dz / d * m; } }
    for (const [x0, x1, z0, z1] of RECT) if (x > x0 - r && x < x1 + r && z > z0 - r && z < z1 + r) {
      const pen = [[x - (x0 - r), 'x', x0 - r], [(x1 + r) - x, 'x', x1 + r], [z - (z0 - r), 'z', z0 - r], [(z1 + r) - z, 'z', z1 + r]].sort((a, b) => a[0] - b[0])[0];
      if (pen[1] === 'x') x = pen[2]; else z = pen[2];
    }
    for (const c of Object.values(characters)) {
      if (!c.holder.visible || c.id === 'player' || !inCafe(c.holder.position)) continue;
      const px = c.holder.position.x - CAFE_POS.x, pz = c.holder.position.z - CAFE_POS.z, dx = x - px, dz = z - pz, d = Math.hypot(dx, dz), m = 0.28 + r;
      if (d < m && d > 1e-4) { x = px + dx / d * m; z = pz + dz / d * m; }
    }
  }
  return [x, z];
}
/** stand on foot in the café at a world point, looking at a world point */
export function walkMode(pos, look = null) {
  cine.stop();
  [WALK.x, WALK.z] = settle(pos.x - CAFE_POS.x, pos.z - CAFE_POS.z).map((v, i) => v + (i ? CAFE_POS.z : CAFE_POS.x));
  if (look) walkLookAt(look);
  setMode('walk');
}
export function walkLookAt(p) { const d = p.clone().sub(walkEye()); VIEW.yaw = Math.atan2(-d.x, -d.z); VIEW.pitch = Math.asin(clamp(d.y / d.length(), -1, 1)); }
/** walk (smoothly, the director's move) to a world point and turn to look at another */
export async function walkTo(pos, look, dur = 1.2) {
  setMode('cine');
  const [lx, lz] = settle(pos.x - CAFE_POS.x, pos.z - CAFE_POS.z), to = new THREE.Vector3(lx + CAFE_POS.x, WALK.eye, lz + CAFE_POS.z);
  await cine.shot(to, look, reducedMotion() ? 0 : dur, {fov: 60});
  WALK.x = to.x; WALK.z = to.z; walkLookAt(look); cine.stop(); setMode('walk');
}
const KEYS = {KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1], KeyA: [-1, 0], KeyD: [1, 0]};
addEventListener('keydown', (e) => { if (KEYS[e.code] || e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') WALK.held.add(e.code); });
addEventListener('keyup', (e) => WALK.held.delete(e.code));
addEventListener('blur', () => WALK.held.clear());
onUpdate((dt) => {
  if (VIEW.mode !== 'walk' || VIEW.locked || document.activeElement && document.activeElement.closest && document.activeElement.closest('input,textarea')) { WALK.v = 0; return; }
  let f = 0, r = 0;
  for (const k of WALK.held) { if (KEYS[k]) { r += KEYS[k][0]; f += KEYS[k][1]; } if (k === 'ArrowLeft') VIEW.yaw += 1.6 * dt; if (k === 'ArrowRight') VIEW.yaw -= 1.6 * dt; }
  // speed eases in and out (Shift runs); a light head bob and footsteps while moving
  const run = WALK.held.has('ShiftLeft') || WALK.held.has('ShiftRight'), want = f || r ? (run ? WALK.run : WALK.speed) : 0;
  WALK.v += (want - WALK.v) * (1 - Math.exp(-(want > WALK.v ? 9 : 12) * dt));
  if (WALK.v < 0.02) { WALK.v = 0; WALK.bob *= 0.85; return; }
  if (f || r) WALK.dir = [f, r];
  const [df, dr] = WALK.dir || [1, 0], L = Math.hypot(df, dr), sp = WALK.v * dt / L, sy = Math.sin(VIEW.yaw), cy = Math.cos(VIEW.yaw);
  const nx = WALK.x - CAFE_POS.x + (-sy * df + cy * dr) * sp, nz = WALK.z - CAFE_POS.z + (-cy * df - sy * dr) * sp;
  const [x, z] = settle(nx, nz), moved = Math.hypot(x + CAFE_POS.x - WALK.x, z + CAFE_POS.z - WALK.z);
  WALK.x = x + CAFE_POS.x; WALK.z = z + CAFE_POS.z;
  const ph = WALK.phase; WALK.phase += moved * (run ? 2.3 : 2.6);
  WALK.bob = Math.sin(WALK.phase * Math.PI) * (run ? 0.03 : 0.018);
  if (Math.floor(WALK.phase) !== Math.floor(ph)) footstep(true, run ? 0.5 : 0.32);
});

// ---------------------------------------------------------------- mouse look on foot: click in the café, Esc frees the mouse
// (any card, choice or hands-on task frees it too, so the pointer is there to use it)
const xhair = document.createElement('div'); xhair.id = 'xhair'; document.body.appendChild(xhair);
const lockHint = document.createElement('div'); lockHint.id = 'lockhint'; lockHint.className = 'hidden';
const HINT = {
  walk: EN ? 'Click to look around with the mouse · W A S D walk · Shift run · E interact · Esc frees the mouse' : 'انقر لتنظر حولك بالماوس · W A S D للمشي · Shift للجري · E للتفاعل · Esc لتحرير الماوس',
  seat: EN ? 'Click to look around with the mouse · E interact · Esc frees the mouse' : 'انقر لتنظر حولك بالماوس · E للتفاعل · Esc لتحرير الماوس',
};
const looks = () => VIEW.mode === 'walk' || VIEW.mode === 'seat';
document.body.appendChild(lockHint);
export const mouseLocked = () => document.pointerLockElement === canvas;
const MODALS = ['qcard', 'ccard', 'panel', 'card', 'tray', 'tabletp', 'choices'];
export function modalOpen() {
  if (MODALS.some(id => { const e = document.getElementById(id); return e && !e.classList.contains('hidden'); })) return true;
  const pr = document.getElementById('prompt'); return !!(pr && pr.classList.contains('hands') && pr.offsetParent);
}
canvas.addEventListener('click', () => {
  if (!looks() || VIEW.locked || mouseLocked() || modalOpen()) return;
  try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
});
addEventListener('mousemove', (e) => {
  if (!mouseLocked()) return;
  if (VIEW.mode === 'walk') { VIEW.yaw -= e.movementX * 0.0022; VIEW.pitch = clamp(VIEW.pitch - e.movementY * 0.0022, -1.1, 1.0); }
  else if (VIEW.mode === 'seat') { VIEW.yaw = clamp(VIEW.yaw - e.movementX * 0.0022, ...LIM.yaw); VIEW.pitch = clamp(VIEW.pitch - e.movementY * 0.0022, ...LIM.pitch); }
});
onUpdate(() => {
  const look = looks(), modal = look && modalOpen();
  if (mouseLocked() && (!look || modal)) document.exitPointerLock();
  if (look && lockHint.dataset.m !== VIEW.mode) { lockHint.dataset.m = VIEW.mode; lockHint.textContent = HINT[VIEW.mode]; }
  lockHint.classList.toggle('hidden', !look || mouseLocked() || modal || VIEW.locked);
  document.body.classList.toggle('mlock', mouseLocked());
});

function applyLook() {
  if (VIEW.mode === 'walk') { camera.position.copy(walkEye()); camera.position.y += WALK.bob; camera.rotation.set(VIEW.pitch, VIEW.yaw, 0, 'YXZ'); }
  else if (VIEW.mode === 'seat') { camera.position.copy(VIEW.eye); camera.rotation.set(VIEW.pitch, VIEW.yaw, 0, 'YXZ'); }
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
  // drag the way the mouse looks: right turns right, down looks down (as in the mouse-look mode)
  if (VIEW.mode === 'seat' && !mouseLocked()) { VIEW.yaw = clamp(VIEW.yaw - dx * 0.0032, ...LIM.yaw); VIEW.pitch = clamp(VIEW.pitch - dy * 0.0028, ...LIM.pitch); }
  else if (VIEW.mode === 'walk' && !mouseLocked()) { VIEW.yaw -= dx * 0.0032; VIEW.pitch = clamp(VIEW.pitch - dy * 0.0028, -1.1, 1.0); }
  else if (VIEW.mode === 'cafe') { VIEW.orbit.yaw = clamp(VIEW.orbit.yaw - dx * 0.005, ...LIM.oyaw); VIEW.orbit.pitch = clamp(VIEW.orbit.pitch + dy * 0.004, ...LIM.opitch); }
});
addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('wheel', (e) => {
  if (VIEW.locked || VIEW.mode === 'cine') return;
  e.preventDefault();
  if (VIEW.mode === 'walk') return;
  if (VIEW.mode === 'seat') { if (e.deltaY < 0) enterCafe(); return; }
  const o = VIEW.orbit; o.dist = clamp(o.dist * Math.exp(e.deltaY * 0.0012), ...LIM.dist);
}, {passive: false});
const touches = new Map(); let pinch0 = null;
canvas.addEventListener('touchstart', (e) => { for (const t of e.changedTouches) touches.set(t.identifier, [t.clientX, t.clientY]); if (touches.size === 2) { const [a, b] = [...touches.values()]; pinch0 = {d: Math.hypot(a[0] - b[0], a[1] - b[1]), dist: VIEW.orbit.dist}; drag = null; } }, {passive: true});
canvas.addEventListener('touchmove', (e) => { for (const t of e.changedTouches) touches.set(t.identifier, [t.clientX, t.clientY]); if (pinch0 && touches.size === 2 && VIEW.mode === 'cafe') { const [a, b] = [...touches.values()]; VIEW.orbit.dist = clamp(pinch0.dist * pinch0.d / Math.max(20, Math.hypot(a[0] - b[0], a[1] - b[1])), ...LIM.dist); } }, {passive: true});
canvas.addEventListener('touchend', (e) => { for (const t of e.changedTouches) touches.delete(t.identifier); if (touches.size < 2) pinch0 = null; }, {passive: true});
canvas.addEventListener('dblclick', () => { if (VIEW.mode === 'seat') seatLookAt(screenCenter()); });
addEventListener('keydown', (e) => {
  if (VIEW.locked || VIEW.mode === 'cine' || VIEW.mode === 'walk' || e.target.closest('input,textarea')) return;
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
