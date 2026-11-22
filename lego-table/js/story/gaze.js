// Who looks at whom (Concept A §3, "Performance rules"). The speaker looks at the one the line is for and holds that
// look to the end of the line; a line with a "glance" (the rack, the note, a model, the wall) gets one glance in the
// middle, then back. Listeners turn to the speaker a moment after the voice starts (0.3–0.55 s) and stay on them until
// the line ends. Between lines: long holds (4–7 s) on the player or on what the player's hand is working on.
import * as THREE from 'three';
import {onUpdate} from '../core/engine.js';
import {characters as C} from '../actors/character.js';
import {VIEW} from '../ui/view.js';
import {EYE, ARCH} from '../world/workshop.js';
import {TB, baseTop, BOARD} from '../world/props.js';
import {HAND} from '../ui/playerhand.js';

export const IDS = ['ina', 'mikael', 'rania', 'victor'];
const st = {speaker: null, to: 'player', glance: null, t0: 0, dur: 4, last: null, lastEnd: -99};
const per = {};                  // id -> {t: target key, until, from}
const now = () => performance.now() / 1000;
const rnd = (a, b) => a + Math.random() * (b - a);

/** a line starts: who (an id, 'player' or 'narrator'), to (an id, 'player' or 'all'), glance (a thing), dur (s) */
export function speaking(who, to = 'player', glance = null, dur = 4) {
  Object.assign(st, {speaker: who, to: to || 'player', glance, t0: now(), dur});
  for (const id of IDS) {
    if (id === who) per[id] = {t: addressee(id), until: Infinity};
    else per[id] = {t: per[id] ? per[id].t : 'player', until: now() + rnd(0.3, 0.55), turn: true};
  }
}
export function silent() { if (st.speaker) { st.last = st.speaker; st.lastEnd = now(); } st.speaker = null; for (const id of IDS) if (per[id]) per[id].until = Math.min(per[id].until, now() + rnd(0.6, 1.4)); }
function addressee(id) {
  if (st.to !== 'all') return st.to === id ? 'player' : st.to;
  // to everyone: the colleagues nearest (in the room) or the player
  const mates = IDS.filter(o => o !== id && C[o] && C[o].holder.visible);
  return mates.length ? mates[Math.floor((st.t0 * 7) % mates.length)] : 'player';
}

// ---------------------------------------------------------------- targets
const playerEye = () => document.body.dataset.place === 'seat' ? EYE.seat : EYE.stand;
function resolve(k, self) {
  if (k === 'player') return VIEW.mode === 'stand' || VIEW.mode === 'seat' ? 'camera' : playerEye();
  if (k === 'rack' && TB.rack) return TB.rack.g.localToWorld(new THREE.Vector3(0, 0.03, 0));
  if (k === 'note' && TB.note) return TB.note.g.getWorldPosition(new THREE.Vector3());
  if (k === 'board') return BOARD.clone().add(new THREE.Vector3(0, 0.1, 0));
  if (k === 'wall') return new THREE.Vector3(ARCH.x, ARCH.y, ARCH.z);
  if (k === 'hand') return HAND.root.visible ? HAND.T.clone() : playerEye().clone().add(new THREE.Vector3(0, -0.6, -0.6));
  if (k === 'report' || k === 'box' || k === 'label' || k === 'point') return 'player';
  if (TB.bases[k]) return baseTop(k);
  if (k === 'down') { const h = C[self].holder; return h.position.clone().add(new THREE.Vector3(Math.sin(h.rotation.y) * 0.7, C[self].seated ? 0.75 : 0.9, Math.cos(h.rotation.y) * 0.7)); }
  if (C[k] && C[k].holder.visible) return C[k];
  return 'camera';
}
/** the next thing to look at, and for how long */
function next(id) {
  const sp = st.speaker;
  if (sp === id) {
    const mid = st.t0 + st.dur * 0.45;
    if (st.glance && Math.abs(now() - mid) < 0.6) return [st.glance, 1.2];
    return [addressee(id), 0.3];
  }
  if (sp === 'player') return ['player', 0.4];
  if (sp && sp !== 'narrator') return [sp, 0.4];
  if (sp === 'narrator') return [document.body.dataset.place === 'wall' ? 'wall' : 'hand', rnd(4, 7)];
  // between lines
  const t = now();
  if (st.last && st.last !== id && st.last !== 'narrator' && t - st.lastEnd < 1.2) return [st.last === 'player' ? 'player' : st.last, st.lastEnd + 1.2 - t];
  const busy = HAND.script || HAND.carry || document.getElementById('gl').classList.contains('can-grab');
  return [busy && Math.random() < 0.6 ? 'hand' : Math.random() < 0.8 ? 'player' : 'down', rnd(4, 7)];
}
window.__gaze = () => JSON.stringify({speaker: st.speaker, to: st.to, per: Object.fromEntries(IDS.map(id => [id, per[id] && per[id].t]))});
let acc = 0;
onUpdate((dt) => {
  acc += dt; if (acc < 0.1) return; acc = 0;
  const t = now();
  for (const id of IDS) {
    const c = C[id]; if (!c || !c.holder.visible || c.lockLook) continue;
    let p = per[id];
    if (c.walking) { if (c.look.target !== null) c.lookAt(null); continue; }
    if (!p || t >= p.until || (st.speaker === id && st.glance)) { const [k, d] = next(id); if (!p || p.t !== k || t >= p.until) p = per[id] = {t: k || 'player', until: t + Math.max(0.3, d)}; }
    const tg = resolve(p.t, id);
    if (c.look.target !== tg && !(tg && tg.isVector3 && c.look.target && c.look.target.isVector3 && tg.distanceToSquared(c.look.target) < 1e-4)) c.lookAt(tg);
  }
});
