// Things you can use: a ring + label pinned to the object on screen (click / tap), and the same actions listed in the
// dock at the bottom (keyboard: Tab to a button, Enter; touch: tap). Each is a real <button> with a name.
import * as THREE from 'three';
import {camera, onUpdate} from '../core/engine.js';
import {sfx} from '../core/audio.js';
import {VIEW, mouseLocked, modalOpen} from './view.js';
const EN = new URLSearchParams(location.search).get('lang') === 'en';

const ICONS = {
  card: '<rect x="4" y="6" width="16" height="12" rx="1.5" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M7 10h10M7 14h6" stroke="#fff" stroke-width="1.5"/>',
  comment: '<path d="M4 5h16v11H9l-4 4v-4H4z" fill="none" stroke="#fff" stroke-width="1.6"/>',
  rail: '<path d="M3 6h18" stroke="#fff" stroke-width="1.8"/><rect x="5" y="8" width="4" height="7" fill="#fff"/><rect x="10.5" y="8" width="4" height="7" fill="#fff" opacity=".8"/><rect x="16" y="8" width="3" height="7" fill="#fff" opacity=".6"/>',
  tablet: '<rect x="4" y="5" width="16" height="12" rx="2" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M8 20h8" stroke="#fff" stroke-width="1.6"/>',
  dial: '<circle cx="12" cy="12" r="8" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M12 12V7M12 12l4 2" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/>',
  eye: '<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z" fill="none" stroke="#fff" stroke-width="1.6"/><circle cx="12" cy="12" r="3" fill="#fff"/>',
  memo: '<path d="M6 3h9l4 4v14H6z" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M9 11h7M9 14h7M9 17h5" stroke="#fff" stroke-width="1.4"/>',
  seat: '<path d="M7 4v9h10V4M6 13h12v3H6zM8 16v5M16 16v5" fill="none" stroke="#fff" stroke-width="1.5"/>',
};
const layer = document.getElementById('hotspots'), dock = document.getElementById('dock');
export const hotspots = new Map();
let busy = false;
const _v = new THREE.Vector3();

/** add({id, label, icon, pos: () => Vector3 | null, modes: ['seat','cafe','walk'], when: () => bool, use: async () => {}, dock: true}) */
export function addHotspot(h) {
  const el = document.createElement('button'); el.className = 'hs'; el.type = 'button'; el.setAttribute('aria-label', h.label);
  el.innerHTML = `<span class="hs-ring"><svg viewBox="0 0 24 24">${ICONS[h.icon] || ICONS.card}</svg></span><span class="hs-label">${h.label}</span>`;
  el.style.display = 'none'; layer.appendChild(el);
  const db = document.createElement('button'); db.className = 'dk'; db.type = 'button'; db.innerHTML = `<svg viewBox="0 0 24 24">${ICONS[h.icon] || ICONS.card}</svg><span>${h.label}</span>`; db.style.display = 'none';
  if (h.dock !== false) dock.appendChild(db);
  const rec = Object.assign({modes: ['seat', 'cafe', 'walk'], when: () => true, done: false}, h, {el, db, visible: false});
  const go = (e) => { e.stopPropagation(); trigger(rec); };
  el.addEventListener('click', go); db.addEventListener('click', go);
  hotspots.set(h.id, rec);
  return rec;
}
export function removeHotspot(id) { const h = hotspots.get(id); if (h) { h.el.remove(); h.db.remove(); hotspots.delete(id); } }
export function markDone(id, v = true) { const h = hotspots.get(id); if (h) { h.done = v; h.el.classList.toggle('done', v); h.db.classList.toggle('done', v); } }
export function setLabel(id, label) { const h = hotspots.get(id); if (!h) return; h.label = label; h.el.querySelector('.hs-label').textContent = label; h.el.setAttribute('aria-label', label); h.db.querySelector('span').textContent = label; }
export function setHotspotsBusy(b) { busy = b; document.body.classList.toggle('hs-busy', b); }
export const hotspotsBusy = () => busy;
async function trigger(h) {
  if (busy || !h.when() || !h.modes.includes(VIEW.mode)) return;
  sfx.ui(); setHotspotsBusy(true);
  try { await h.use(h); } catch (e) { console.error(e); } finally { setHotspotsBusy(false); }
}
onUpdate(() => {
  const W = innerWidth, H = innerHeight;
  for (const h of hotspots.values()) {
    const on = !busy && h.when() && h.modes.includes(VIEW.mode);
    let vis = false;
    const p = on && h.pos ? (typeof h.pos === 'function' ? h.pos() : h.pos) : null;
    if (p) {
      _v.copy(p).project(camera);
      if (_v.z < 1 && Math.abs(_v.x) < 0.96 && Math.abs(_v.y) < 0.92) { vis = true; h.sx = (_v.x * 0.5 + 0.5) * W; h.sy = (-_v.y * 0.5 + 0.5) * H; h.el.style.left = h.sx + 'px'; h.el.style.top = h.sy + 'px'; }
    }
    if (vis !== h.visible) { h.visible = vis; h.el.style.display = vis ? 'flex' : 'none'; }
    const dv = on ? '' : 'none'; if (h.db.style.display !== dv) h.db.style.display = dv;
  }
  dock.classList.toggle('empty', ![...hotspots.values()].some(h => h.db.style.display !== 'none' && h.db.isConnected));
  // on foot in the café: the thing nearest the middle of the view (the cross) is the one E or a click acts on
  let best = null, bd = Math.min(W, H) * 0.16;
  if ((VIEW.mode === 'walk' || VIEW.mode === 'seat' && mouseLocked()) && !busy && !modalOpen()) for (const h of hotspots.values()) {
    if (!h.visible) continue;
    const d = Math.hypot(h.sx - W / 2, h.sy - H / 2); if (d < bd) { bd = d; best = h; }
  }
  if (best !== aimed) { if (aimed) aimed.el.classList.remove('aim'); aimed = best; if (aimed) aimed.el.classList.add('aim'); }
  aimTip.classList.toggle('hidden', !aimed);
  if (aimed) aimTip.innerHTML = `<kbd>E</kbd> ${aimed.label}`;
});
let aimed = null;
const aimTip = document.createElement('div'); aimTip.id = 'aimtip'; aimTip.className = 'hidden'; document.body.appendChild(aimTip);
addEventListener('keydown', (e) => { if (e.code === 'KeyE' && !e.repeat && aimed && (VIEW.mode === 'walk' || VIEW.mode === 'seat') && !(e.target.closest && e.target.closest('input,textarea'))) trigger(aimed); });
addEventListener('mousedown', (e) => { if (e.button === 0 && mouseLocked() && aimed) trigger(aimed); });
