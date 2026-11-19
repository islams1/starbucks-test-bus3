// Interaction hotspots styled like the reference (white ring + round thumbnail + dark label chip).
import * as THREE from 'three';
import {camera, onUpdate} from '../core/engine.js';
import {onKey, mouse} from '../core/input.js';
import {occluders} from '../world/building.js';
import {player} from '../actors/player.js';
import {sfx} from '../core/audio.js';

const ICONS = {
  doc: '<path d="M6 3h9l4 4v14H6z" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M9 11h7M9 14h7M9 17h5" stroke="#fff" stroke-width="1.4"/>',
  folder: '<path d="M3 7h7l2 2h9v10H3z" fill="none" stroke="#fff" stroke-width="1.6"/>',
  laptop: '<rect x="5" y="5" width="14" height="10" rx="1" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M3 18h18" stroke="#fff" stroke-width="1.8"/>',
  book: '<path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v14c-3-1-6-1-8 1-2-2-5-2-8-1z" fill="none" stroke="#fff" stroke-width="1.5"/><path d="M12 6v14" stroke="#fff" stroke-width="1.3"/>',
  envelope: '<rect x="3" y="6" width="18" height="12" rx="1" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M3 7l9 6 9-6" fill="none" stroke="#fff" stroke-width="1.5"/>',
  cup: '<path d="M7 7h9l-1 13H8z" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M6.5 5h10" stroke="#fff" stroke-width="1.8"/>',
  person: '<circle cx="12" cy="8" r="3.6" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M5 20c1-4 4-6 7-6s6 2 7 6" fill="none" stroke="#fff" stroke-width="1.6"/>',
  call: '<rect x="3" y="7" width="12" height="10" rx="2" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M15 11l6-3v8l-6-3" fill="none" stroke="#fff" stroke-width="1.6"/>',
  board: '<rect x="4" y="4" width="16" height="13" fill="none" stroke="#fff" stroke-width="1.5"/><rect x="6.5" y="6.5" width="4" height="4" fill="#fff"/><rect x="13" y="7.5" width="4" height="4" fill="#fff" opacity=".7"/><path d="M9 17l-2 4M15 17l2 4" stroke="#fff" stroke-width="1.4"/>',
  frame: '<rect x="5" y="3" width="14" height="18" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M8 8h8M8 11h8M8 14h8M8 17h5" stroke="#fff" stroke-width="1.2"/>',
  tablet: '<rect x="6" y="3" width="12" height="18" rx="2" fill="none" stroke="#fff" stroke-width="1.6"/><circle cx="12" cy="18" r=".9" fill="#fff"/>',
  chart: '<path d="M4 20V4M4 20h16" stroke="#fff" stroke-width="1.6"/><path d="M7 15l4-4 3 3 5-6" fill="none" stroke="#fff" stroke-width="1.7"/>',
  money: '<rect x="3" y="7" width="18" height="10" rx="1" fill="none" stroke="#fff" stroke-width="1.6"/><circle cx="12" cy="12" r="2.6" fill="none" stroke="#fff" stroke-width="1.4"/>',
  door: '<path d="M6 3h11v18H6z" fill="none" stroke="#fff" stroke-width="1.6"/><circle cx="14" cy="12" r="1" fill="#fff"/>',
  chair: '<path d="M7 4v9h10V4M6 13h12v3H6zM8 16v5M16 16v5" fill="none" stroke="#fff" stroke-width="1.5"/>',
};
const layer = document.getElementById('hotspots');
export const hotspots = new Map();
let focus = null, deskMode = false;
const ray = new THREE.Raycaster(), _p = new THREE.Vector3(), _v = new THREE.Vector3();

/**
 * add({id, label, icon, pos:Vector3|fn, range=2.2, kind:'item'|'person'|'call', when:()=>bool, use:()=>void, desk:false})
 */
export function addHotspot(h) {
  const el = document.createElement('div'); el.className = 'hs';
  el.innerHTML = `<div class="hs-ring ${h.kind || 'item'}"><svg viewBox="0 0 24 24">${ICONS[h.icon] || ICONS.doc}</svg></div><div class="hs-label">${h.label}<kbd class="hs-key">E</kbd></div>`;
  el.style.opacity = 0; el.style.display = 'none';
  layer.appendChild(el);
  const rec = Object.assign({range: 2.4, kind: 'item', when: () => true, done: false}, h, {el, visible: false});
  el.addEventListener('click', (e) => { e.stopPropagation(); trigger(rec); });
  hotspots.set(h.id, rec);
  return rec;
}
export function removeHotspot(id) { const h = hotspots.get(id); if (h) { h.el.remove(); hotspots.delete(id); } }
export function markDone(id, v = true) { const h = hotspots.get(id); if (h) { h.done = v; h.el.classList.toggle('done', v); } }
export function setDeskMode(on) { deskMode = on; }
let busy = false;
export function setHotspotsBusy(b) { busy = b; if (b) for (const h of hotspots.values()) { h.el.style.opacity = 0; h.el.style.display = 'none'; h.visible = false; } }
async function trigger(h) {
  if (busy || !h.visible) return;
  sfx.ui();
  busy = true;
  for (const x of hotspots.values()) { x.el.style.opacity = 0; x.el.style.display = 'none'; x.visible = false; }
  try { await h.use(h); } finally { busy = false; }
}
onKey('KeyE', () => { if (focus && !busy) trigger(focus); });

onUpdate(() => {
  if (busy) return;
  const pp = player.ch ? player.ch.holder.position : camera.position;
  let best = null, bestD = 1e9;
  const W = innerWidth, H = innerHeight;
  for (const h of hotspots.values()) {
    let vis = false;
    if ((deskMode ? h.desk : !h.deskOnly) && h.when() && (player.mode === 'free' || (deskMode && h.desk))) {
      const p = typeof h.pos === 'function' ? h.pos() : h.pos;
      _p.copy(p);
      const dist = deskMode ? 0 : Math.hypot(p.x - pp.x, p.z - pp.z);
      if (dist < h.range) {
        _v.copy(_p).project(camera);
        if (_v.z < 1 && Math.abs(_v.x) < 1.05 && Math.abs(_v.y) < 1.05) {
          // line of sight from camera
          const cd = camera.position.distanceTo(_p);
          ray.set(camera.position, _p.clone().sub(camera.position).normalize()); ray.far = cd - 0.15;
          const blocked = !deskMode && ray.intersectObjects(occluders, false).length > 0;
          if (!blocked) {
            vis = true;
            const sx = (_v.x * 0.5 + 0.5) * W, sy = (-_v.y * 0.5 + 0.5) * H;
            h.el.style.left = sx + 'px'; h.el.style.top = sy + 'px';
            const scr = Math.hypot(sx - W / 2, sy - H / 2) + dist * 60;
            if (scr < bestD) { bestD = scr; best = h; }
          }
        }
      }
    }
    if (vis !== h.visible) { h.visible = vis; h.el.style.display = vis ? 'flex' : 'none'; requestAnimationFrame(() => h.el.style.opacity = vis ? 1 : 0); }
  }
  if (deskMode) best = null;
  if (best !== focus) { if (focus) focus.el.classList.remove('focus'); focus = best; if (focus) focus.el.classList.add('focus'); }
});
