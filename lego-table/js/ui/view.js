// The player's eye (Concept A §4–5). 'stand': at the worktable, looking down at it — drag on empty space (or the
// arrow keys) to look around; the view leans in a little over the table when the hand reaches the far bases.
// 'seat': in the chair at the west end of the review table, facing Victor (and the archive wall behind him).
// 'cine': the director has the camera (the opening drift, the wide shots when the team talk among themselves, the
// one move to the review table, the move to the meeting wall). Dragging turns the way the mouse moves: right turns
// right, down looks down. Reduced motion (or ?still): cuts instead of moves.
import * as THREE from 'three';
import {camera, onUpdate, clamp} from '../core/engine.js';
import * as cine from '../core/cine.js';
import {quality} from '../core/quality.js';
import {footstep} from '../core/audio.js';
import {free} from '../world/collide.js';
import {WT} from '../world/workshop.js';
const EN = new URLSearchParams(location.search).get('lang') === 'en';

export const VIEW = {mode: 'cine', yaw: 0, pitch: -0.5, eye: new THREE.Vector3(), base: new THREE.Vector3(), lim: {yaw: [-1.4, 1.4], pitch: [-1.25, 0.45]},
  lean: 0, leanWant: 0, locked: false, onChange: null, fov: 55};
const canvas = document.getElementById('gl');
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const reducedMotion = () => RM || new URLSearchParams(location.search).has('still') || quality.level === 'cpu';
export const mouseLocked = () => false;          // (no pointer lock here: the hand needs the pointer)
const MODALS = ['pcard', 'notecard', 'list', 'receipt', 'coach', 'archive', 'final', 'checks', 'tcard', 'pause', 'howto', 'menu'];
export function modalOpen() { return MODALS.some(id => { const e = document.getElementById(id); return e && !e.classList.contains('hidden'); }); }

const dirOf = (yaw, pitch) => new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
/** yaw/pitch that look from the eye towards a point */
export function lookAtPoint(p, from = VIEW.eye) { const d = p.clone().sub(from); VIEW.yaw = Math.atan2(-d.x, -d.z); VIEW.pitch = Math.asin(clamp(d.y / d.length(), -1, 1)); }
function pose() { return {pos: eyeNow(), look: eyeNow().add(dirOf(VIEW.yaw, VIEW.pitch))}; }
/** the eye with the lean applied (towards where the player faces, a little lower) */
function eyeNow() {
  const e = VIEW.base.clone();
  if (VIEW.mode === 'stand') e.y += WALK.bob;
  if (VIEW.mode === 'stand' && VIEW.lean > 0.001) { const f = new THREE.Vector3(-Math.sin(VIEW.yaw), 0, -Math.cos(VIEW.yaw)); e.addScaledVector(f, VIEW.lean * 0.2); e.y -= VIEW.lean * 0.07; }
  return e;
}

// ---------------------------------------------------------------- walking around the workshop (parts 1 and 2)
export const WALK = {on: false, held: new Set(), v: 0, phase: 0, bob: 0, dir: [1, 0], moved: 0};
/** may the player walk now? (the yaw is free while walking) */
export function allowWalk(on) { WALK.on = on; if (on) VIEW.lim.yaw = [-1e9, 1e9]; else WALK.held.clear(); }
/** standing in front of the worktable, within reach: the hand and the table's things work from here */
export function nearTable(p = VIEW.base) { return p.x > WT.x - WT.w / 2 - 0.35 && p.x < WT.x + WT.w / 2 + 0.35 && p.z > WT.z + WT.d / 2 - 0.05 && p.z < WT.z + WT.d / 2 + 1.05; }
VIEW.handsOk = () => VIEW.mode !== 'stand' || !WALK.on || nearTable();
const MOVE = {KeyW: [1, 0], ArrowUp: [1, 0], KeyS: [-1, 0], ArrowDown: [-1, 0], KeyA: [0, -1], KeyD: [0, 1]};
const typing = (e) => e.target && e.target.closest && e.target.closest('input,textarea,select');
addEventListener('keydown', (e) => { if (typing(e)) return; if (MOVE[e.code] || e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code.startsWith('Shift')) WALK.held.add(e.code); });
addEventListener('keyup', (e) => WALK.held.delete(e.code));
addEventListener('blur', () => WALK.held.clear());
onUpdate((dt) => {
  if (!WALK.on || VIEW.mode !== 'stand' || VIEW.locked) { WALK.v = 0; WALK.bob *= 0.85; return; }
  let f = 0, r = 0;
  for (const k of WALK.held) { if (MOVE[k]) { f += MOVE[k][0]; r += MOVE[k][1]; } if (k === 'ArrowLeft') VIEW.yaw += 1.7 * dt; if (k === 'ArrowRight') VIEW.yaw -= 1.7 * dt; }
  const run = WALK.held.has('ShiftLeft') || WALK.held.has('ShiftRight'), want = f || r ? (run ? 2.4 : 1.3) : 0;
  WALK.v += (want - WALK.v) * (1 - Math.exp(-(want > WALK.v ? 9 : 12) * dt));
  if (WALK.v < 0.02) { WALK.v = 0; WALK.bob *= 0.85; return; }
  if (f || r) WALK.dir = [f, r];
  turn = null; VIEW.leanWant = 0;
  const [df, dr] = WALK.dir, L = Math.hypot(df, dr) || 1, sp = WALK.v * dt / L, sy = Math.sin(VIEW.yaw), cy = Math.cos(VIEW.yaw);
  const dx = (-sy * df + cy * dr) * sp, dz = (-cy * df - sy * dr) * sp, p = VIEW.base;
  const x0 = p.x, z0 = p.z;
  if (free(p.x + dx, p.z + dz)) { p.x += dx; p.z += dz; }
  else if (free(p.x + dx, p.z)) p.x += dx;
  else if (free(p.x, p.z + dz)) p.z += dz;
  const moved = Math.hypot(p.x - x0, p.z - z0); WALK.moved += moved;
  const ph = WALK.phase; WALK.phase += moved * (run ? 2.3 : 2.6);
  WALK.bob = Math.sin(WALK.phase * Math.PI) * (run ? 0.028 : 0.016);
  if (Math.floor(WALK.phase) !== Math.floor(ph)) footstep(true, run ? 0.5 : 0.32);
});
// a hint the first times walking is possible
const hint = document.createElement('div'); hint.id = 'lockhint'; hint.className = 'hidden'; document.body.appendChild(hint);
hint.textContent = EN ? 'W A S D or the arrows to walk · Shift to run · drag to look around' : 'W A S D أو الأسهم للمشي · Shift للجري · اسحب لتنظر حولك';
let hintT = 0;
onUpdate((dt) => { const on = WALK.on && VIEW.mode === 'stand' && WALK.moved < 3 && hintT < 14; if (on) hintT += dt; hint.classList.toggle('hidden', !on); });

function setMode(m) { VIEW.mode = m; document.body.dataset.view = m; VIEW.onChange && VIEW.onChange(m); }
export const viewMode = () => VIEW.mode;
export function cineMode() { setMode('cine'); }
/**
 * take the player's eye at `eye`, looking at `look` (a director's move there first unless dur = 0)
 * mode: 'stand' | 'seat'; lim: yaw/pitch limits around the look direction
 */
export async function eyeAt(mode, eye, look, {dur = 1.2, fov = 55, yawRange = 1.4, pitch = [-1.25, 0.45]} = {}) {
  VIEW.base.copy(eye); VIEW.eye.copy(eye); lookAtPoint(look, eye);
  VIEW.lim.yaw = mode === 'stand' && WALK.on ? [-1e9, 1e9] : [VIEW.yaw - yawRange, VIEW.yaw + yawRange]; VIEW.lim.pitch = pitch; VIEW.fov = fov;
  setMode('cine');
  const p = pose();
  await cine.shot(p.pos, p.look, reducedMotion() ? 0 : dur, {fov});
  cine.stop(); setMode(mode);
}
/** turn the eyes (in look mode) towards a point, smoothly */
let turn = null;
export function glanceTo(p, dur = 0.8) {
  const y0 = VIEW.yaw, p0 = VIEW.pitch; VIEW.userTurned = false; lookAtPoint(p, eyeNow()); const y1 = clamp(VIEW.yaw, ...VIEW.lim.yaw), p1 = clamp(VIEW.pitch, ...VIEW.lim.pitch);
  VIEW.yaw = y0; VIEW.pitch = p0; turn = {t: 0, dur: reducedMotion() ? 0.01 : dur, y0, p0, y1, p1};
  return {yaw: y0, pitch: p0};
}
/** turn back to a saved direction (unless the player has looked somewhere themselves since) */
export function glanceBack(prev, dur = 0.9) { if (!prev || VIEW.userTurned || VIEW.mode === 'cine') return; turn = {t: 0, dur: reducedMotion() ? 0.01 : dur, y0: VIEW.yaw, p0: VIEW.pitch, y1: prev.yaw, p1: prev.pitch}; }
export function inView(p, deg = 28) { const f = camera.getWorldDirection(new THREE.Vector3()), d = p.clone().sub(camera.position).normalize(); return f.dot(d) > Math.cos(deg * Math.PI / 180); }

onUpdate((dt) => {
  if (turn && VIEW.mode !== 'cine') { turn.t += dt; const k = Math.min(1, turn.t / turn.dur), e = k * k * (3 - 2 * k); VIEW.yaw = turn.y0 + (turn.y1 - turn.y0) * e; VIEW.pitch = turn.p0 + (turn.p1 - turn.p0) * e; if (k >= 1) turn = null; }
  VIEW.lean += (VIEW.leanWant - VIEW.lean) * (1 - Math.exp(-(reducedMotion() ? 40 : 4) * dt));
  if (VIEW.mode === 'stand' || VIEW.mode === 'seat') {
    camera.position.copy(eyeNow()); camera.rotation.set(VIEW.pitch, VIEW.yaw, 0, 'YXZ');
    if (Math.abs(camera.fov - VIEW.fov) > 0.01) { camera.fov += (VIEW.fov - camera.fov) * (1 - Math.exp(-6 * dt)); camera.updateProjectionMatrix(); }
  }
});

// ---------------------------------------------------------------- drag on empty space to look around; arrow keys
let drag = null;
const looks = () => (VIEW.mode === 'stand' || VIEW.mode === 'seat') && !VIEW.locked;
canvas.addEventListener('pointerdown', (e) => { if (!looks() || e.button > 0) return; drag = {x: e.clientX, y: e.clientY, moved: false}; });
addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < 5) return;
  drag.moved = true; drag.x = e.clientX; drag.y = e.clientY; turn = null; VIEW.userTurned = true;
  document.body.classList.add('looking');
  VIEW.yaw = clamp(VIEW.yaw - dx * 0.0032, ...VIEW.lim.yaw); VIEW.pitch = clamp(VIEW.pitch - dy * 0.0028, ...VIEW.lim.pitch);
});
addEventListener('pointerup', () => { drag = null; document.body.classList.remove('looking'); });
export const lookDragging = () => !!(drag && drag.moved);
addEventListener('keydown', (e) => {
  if (!looks() || (e.target.closest && e.target.closest('input,textarea,select'))) return;
  const s = 0.07, k = e.key;
  if (WALK.on && VIEW.mode === 'stand' && /^Arrow/.test(k)) { e.preventDefault(); return; }      // (walking: the arrows move and turn)
  if (k === 'ArrowLeft') VIEW.yaw = clamp(VIEW.yaw + s, ...VIEW.lim.yaw);
  else if (k === 'ArrowRight') VIEW.yaw = clamp(VIEW.yaw - s, ...VIEW.lim.yaw);
  else if (k === 'ArrowUp') VIEW.pitch = clamp(VIEW.pitch + s, ...VIEW.lim.pitch);
  else if (k === 'ArrowDown') VIEW.pitch = clamp(VIEW.pitch - s, ...VIEW.lim.pitch);
  else return;
  turn = null; VIEW.userTurned = true; e.preventDefault();
});
