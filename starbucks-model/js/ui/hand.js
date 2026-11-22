// Doing things with your own hands: pick a thing up (a stack of coins, a ticket off the rail, the pen), carry it and
// put it where it belongs. Mouse or finger: press on the thing, drag, let go over the place. A click on a thing that
// has only one place to go puts it there. Pressing anywhere else still looks around. Every hands-on action also has a
// button in the dock (and its ring), so the game can be played without dragging.
import * as THREE from 'three';
import {camera, onUpdate} from '../core/engine.js';
import {VIEW} from './view.js';

const canvas = document.getElementById('gl');
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), _v = new THREE.Vector3();
const items = new Map();
let drag = null, lastHover = 0;
const LOG = window.__handLog = [];                 // QA: the last grabs and drops
const note = (...a) => { LOG.push(a.join(' ')); if (LOG.length > 40) LOG.shift(); };

/**
 * def: {
 *   id, objects: () => [Object3D]           the things you can take hold of
 *   when: () => bool, modes: ['seat']
 *   grab(hit) -> Object3D | null             what moves with the pointer (null: nothing moves)
 *   planeY: number | null                     carry on a horizontal plane at this height (else: facing the camera)
 *   lift: number                              how high above that plane the carried thing floats
 *   targets: () => [{id, pos: Vector3, r?: px}]  where it can go (r: how close the pointer must be, in CSS pixels)
 *   hover(target | null)                      the target under the pointer changed
 *   drop(target | null, carried, info)        let go (info.moved: false for a click)
 *   stroke: bool, move(hit | null, info)      drawing on the thing itself (the pen on the memo) instead of carrying it
 *   end(info)                                 the pointer is released after a stroke
 * }
 */
export function grabbable(def) {
  items.set(def.id, Object.assign({modes: ['seat'], when: () => true, planeY: null, lift: 0.05, targets: () => []}, def));
  return () => items.delete(def.id);
}
export function removeGrabbable(id) { items.delete(id); }
export const dragging = () => !!drag;

const shown = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
function setRay(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  ray.setFromCamera(ndc, camera);
}
function pick(e) {
  setRay(e);
  let best = null;
  for (const it of items.values()) {
    if (!it.modes.includes(VIEW.mode) || !it.when()) continue;
    const hit = ray.intersectObjects(it.objects().filter(Boolean), true).find(h => shown(h.object));
    if (hit && (!best || hit.distance < best.hit.distance)) best = {it, hit};
  }
  return best;
}
/** screen position (CSS px) of a world point */
export function toScreen(p) {
  const r = canvas.getBoundingClientRect(); _v.copy(p).project(camera);
  return [r.left + (_v.x * 0.5 + 0.5) * r.width, r.top + (-_v.y * 0.5 + 0.5) * r.height, _v.z < 1];
}
function pointerPoint(e, d) {
  setRay(e);
  if (d.it.planeY != null) plane.set(new THREE.Vector3(0, 1, 0), -d.it.planeY);
  else plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()).negate(), d.anchor);
  return ray.ray.intersectPlane(plane, new THREE.Vector3());
}
function nearest(d, e) {
  let best = null, bd = Infinity;
  for (const t of d.it.targets()) {
    const [x, y, front] = toScreen(t.pos); if (!front) continue;
    const dd = Math.hypot(x - e.clientX, y - e.clientY);
    if (dd < (t.r || 80) && dd < bd) { bd = dd; best = t; }
  }
  return best;
}
/** put an object at a world position whatever its parent */
export function setWorld(o, p) { o.position.copy(o.parent ? o.parent.worldToLocal(p.clone()) : p); }

addEventListener('pointerdown', (e) => {
  if (e.target !== canvas || VIEW.locked || drag || e.button > 0) return;
  const b = pick(e); if (!b) { note('down-miss', Math.round(e.clientX), Math.round(e.clientY)); return; }
  note('down', b.it.id, Math.round(e.clientX), Math.round(e.clientY));
  e.stopPropagation(); e.preventDefault();
  const it = b.it, info = {moved: false, x: e.clientX, y: e.clientY, hit: b.hit};
  drag = {it, info, anchor: b.hit.point.clone(), target: null, carried: null};
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  document.body.classList.add('grabbing');
  if (it.stroke) { it.move && it.move(b.hit, info); return; }
  drag.carried = it.grab ? it.grab(b.hit) : null;
  if (drag.carried && it.planeY == null) drag.carried.getWorldPosition(drag.anchor);
}, {capture: true});

addEventListener('pointermove', (e) => {
  if (drag) {
    e.stopPropagation();
    const d = drag;
    if (Math.hypot(e.clientX - d.info.x, e.clientY - d.info.y) > 6) d.info.moved = true;
    if (d.it.stroke) { setRay(e); const h = ray.intersectObjects(d.it.objects().filter(Boolean), true)[0] || null; d.it.move && d.it.move(h, d.info); return; }
    const p = pointerPoint(e, d);
    if (p && d.carried) setWorld(d.carried, p.add(new THREE.Vector3(0, d.it.planeY != null ? d.it.lift : 0, 0)));
    const t = nearest(d, e);
    if (t !== d.target) { d.target = t; d.it.hover && d.it.hover(t); }
    return;
  }
  // the hand cursor over things you can take
  if (e.target !== canvas || performance.now() - lastHover < 70) return;
  lastHover = performance.now();
  const b = items.size ? pick(e) : null;
  canvas.classList.toggle('can-grab', !!b);
}, {capture: true});

function release(e, cancel = false) {
  if (!drag) return;
  const d = drag; drag = null;
  e.stopPropagation();
  document.body.classList.remove('grabbing');
  if (d.it.stroke) { d.it.end && d.it.end(d.info); return; }
  let t = cancel ? null : d.target;
  if (!cancel && !d.info.moved) { const ts = d.it.targets(); if (ts.length === 1) t = ts[0]; }   // a click: one place to go → there
  d.it.hover && d.it.hover(null);
  note('drop', d.it.id, t ? t.id : '-', d.info.moved ? 'moved' : 'click', Math.round(e.clientX), Math.round(e.clientY));
  Promise.resolve(d.it.drop && d.it.drop(t, d.carried, d.info)).catch(err => console.error(err));
}
addEventListener('pointerup', (e) => release(e), {capture: true});
addEventListener('pointercancel', (e) => release(e, true), {capture: true});

/** move an object (world space) to a point in `dur` seconds, with an optional arc; resolves on arrival */
export function tweenTo(o, to, dur = 0.35, {arc = 0, scale = null} = {}) {
  const from = o.getWorldPosition(new THREE.Vector3()), s0 = o.scale.clone();
  return new Promise(res => {
    let t = 0;
    const off = onUpdate((dt) => {
      t += dt; const k = Math.min(1, t / Math.max(0.001, dur)), e = k * k * (3 - 2 * k);
      const p = from.clone().lerp(to, e); p.y += Math.sin(k * Math.PI) * arc;
      setWorld(o, p);
      if (scale) o.scale.lerpVectors(s0, scale, e);
      if (k >= 1) { off(); res(); }
    });
  });
}

// QA: screen points of a grabbable thing and of one of its targets (tools/drive.py "dragjs")
window.__handPts = (id, targetId = null, objIndex = 0) => {
  const it = items.get(id); if (!it) return null;
  const o = it.objects().filter(Boolean).filter(shown)[objIndex]; if (!o) return null;
  const a = toScreen(new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()));
  const t = it.targets().find(x => !targetId || x.id === targetId);
  if (!t) return [[a[0], a[1]], [a[0], a[1]]];
  const b = toScreen(t.pos);
  return [[a[0], a[1]], [(a[0] * 2 + b[0]) / 3, (a[1] * 2 + b[1]) / 3 - 20], [b[0], b[1]]];
};
