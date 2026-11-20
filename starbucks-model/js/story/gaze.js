// Who looks at whom around the table. The one who speaks looks at the person the line is for (data/lines.ar.json
// "to": player | noor | ellis | priya | all | model) and now and then at the others; the listeners turn to the
// speaker a beat after the voice starts and glance away at the one being spoken to, at the model, at each other.
// Between lines they keep on the last speaker for a moment, then look at the model, at the player, at a colleague —
// at the model while the player leans into it, at the player while an answer is awaited.
import * as THREE from 'three';
import {onUpdate} from '../core/engine.js';
import {characters as C} from '../actors/character.js';
import {anchor} from '../world/maquette.js';
import {SEATS, TABLE} from '../world/room.js';
import {balanceAnchor} from '../world/scale.js';
import {VIEW} from '../ui/view.js';

export const IDS = ['noor', 'ellis', 'priya'];
const st = {speaker: null, to: 'player', glance: null, last: null, lastEnd: -99};
const per = {};                   // id -> {t: target key, until}
const now = () => performance.now() / 1000;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
function weighted(list) { let s = 0; for (const [, w] of list) s += w; let r = Math.random() * s; for (const [k, w] of list) { if ((r -= w) <= 0) return k; } return list[0][0]; }

/** a line starts. who: a committee id, 'player' or 'narrator'; to: the addressee; glance: something to look at too */
export function speaking(who, to = 'player', glance = null) {
  st.speaker = who; st.to = to || 'player'; st.glance = glance;
  const t = now();
  for (const id of IDS) {
    if (id === who) per[id] = null;                                   // the speaker looks at once
    else per[id] = {t: per[id] ? per[id].t : 'player', until: t + rnd(0.15, 0.5)};   // a listener a beat later
  }
}
export function silent() { if (st.speaker) { st.last = st.speaker; st.lastEnd = now(); } st.speaker = null; }

// ---------------------------------------------------------------- targets
const _p = new THREE.Vector3();
const OFF = {noor: [-0.06, 0.02], ellis: [0.07, -0.02], priya: [0.0, 0.05]};
const PLAYER_EYE = new THREE.Vector3(0.02, 1.2, 1.02);
function resolve(k, self) {
  // the player is in the chair: from the seat (or leaning into the model) that is the camera; in a director's shot
  // the camera is elsewhere and they must not look into it
  if (k === 'player') return VIEW.mode === 'cine' ? PLAYER_EYE : 'camera';
  if (k === 'model') { const c = anchor('center'); if (!c) return 'camera'; const o = OFF[self] || [0, 0]; return c.clone().add(new THREE.Vector3(o[0], -0.04, o[1])); }
  if (k === 'down') { const s = SEATS[self]; return new THREE.Vector3(s.x - Math.sin(s.ry) * -0.5, TABLE.y + 0.02, s.z - Math.cos(s.ry) * -0.5); }
  if (k === 'balance') return balanceAnchor().add(new THREE.Vector3(0, -0.12, 0));
  if (C[k] && C[k].holder.visible) return C[k];
  return 'camera';
}
const others = (self) => IDS.filter(id => id !== self && C[id] && C[id].holder.visible);
const waiting = () => !document.getElementById('choices').classList.contains('hidden') || document.getElementById('panel').classList.contains('memo') && !document.getElementById('panel').classList.contains('hidden');

/** the next thing to look at and for how long */
function next(id) {
  const sp = st.speaker;
  if (sp === id) {                                            // speaking
    let base = st.to;
    if (base === 'all') base = pick(['player', ...others(id)]);
    if (st.glance && Math.random() < 0.35) return [st.glance, rnd(1.0, 1.8)];
    if (Math.random() < 0.28 && others(id).length) return [pick(base === 'player' ? others(id) : ['player', ...others(id).filter(o => o !== base)]), rnd(0.8, 1.4)];
    return [base, rnd(1.8, 3.4)];
  }
  if (sp === 'player') return Math.random() < 0.88 ? ['player', rnd(2, 4)] : [pick(others(id)), rnd(0.6, 1.0)];
  if (sp === 'narrator') return [weighted([['model', 6], ['down', 3], ['player', 1]]), rnd(2.5, 5)];
  if (sp) {                                                   // someone else speaks
    const r = Math.random();
    if (r < 0.8) return [sp, rnd(2, 4)];
    if (r < 0.92 && st.to !== id && st.to !== 'all' && st.to !== sp) return [st.to, rnd(0.8, 1.3)];
    return [st.glance || 'model', rnd(0.8, 1.3)];
  }
  // nobody speaks
  const t = now();
  if (st.last && st.last !== id && t - st.lastEnd < 1.6) return [st.last, st.lastEnd + 1.6 - t];
  if (VIEW.mode === 'model') return [weighted([['model', 8], ['player', 1], [pick(others(id)), 1]]), rnd(2, 5)];
  if (waiting()) return [weighted([['player', 7], [pick(others(id)), 3]]), rnd(1.5, 3.5)];
  return [weighted([['model', 4], ['player', 3], [pick(others(id)) || 'model', 2.5], ['down', 1]]), rnd(2.5, 6)];
}

window.__gaze = () => JSON.stringify({speaker: st.speaker, to: st.to, per: Object.fromEntries(IDS.map(id => [id, per[id] && per[id].t]))});
let acc = 0;
onUpdate((dt) => {
  acc += dt; if (acc < 0.1) return; acc = 0;
  const t = now();
  for (const id of IDS) {
    const c = C[id]; if (!c || !c.holder.visible || c.lockLook) continue;
    let p = per[id];
    if (!p || t >= p.until) { const [k, d] = next(id); p = per[id] = {t: k || 'player', until: t + Math.max(0.3, d)}; }
    const tg = resolve(p.t, id);
    if (c.look.target !== tg && !(tg && tg.isVector3 && c.look.target && c.look.target.isVector3 && tg.distanceToSquared(c.look.target) < 1e-6)) c.lookAt(tg);
  }
});
