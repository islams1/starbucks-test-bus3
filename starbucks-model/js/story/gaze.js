// Who looks at whom around the table. The one who speaks looks at the person the line is for (data/lines.ar.json
// "to": player | noor | ellis | priya | all) and glances at the others or at what is talked about ("glance": screen,
// balance, a name); the listeners turn to the speaker a beat after the voice starts and glance at the one addressed,
// at the screen, at each other. While the replay plays they watch the hanging screen together; between lines they
// look at each other, at the screen, at their notes — and at the player when an answer is awaited.
import * as THREE from 'three';
import {onUpdate} from '../core/engine.js';
import {characters as C} from '../actors/character.js';
import {SEATS, TABLE, HANG} from '../world/room.js';
import {balanceAnchor} from '../world/scale.js';
import {FEED} from '../world/screenfeed.js';
import {VIEW} from '../ui/view.js';
import {inCafe, toWorld} from '../world/maquette.js';

export const IDS = ['noor', 'ellis', 'priya'];
const st = {speaker: null, to: 'player', glance: null, last: null, lastEnd: -99, watching: false};
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
    if (id === who) per[id] = {t: speakerBase(id), until: t + rnd(2.6, 4.0)};   // the speaker opens on the one addressed
    else per[id] = {t: per[id] ? per[id].t : 'player', until: t + rnd(0.15, 0.5)};   // a listener a beat later
  }
}
export function silent() { if (st.speaker) { st.last = st.speaker; st.lastEnd = now(); } st.speaker = null; }
/** the replay is being watched: between lines all eyes go to the screen */
export function watching(on) { st.watching = on; if (on) for (const id of IDS) if (st.speaker !== id) per[id] = {t: per[id] ? per[id].t : 'screen', until: now() + rnd(0.1, 0.6)}; }

// ---------------------------------------------------------------- targets
const PLAYER_EYE = new THREE.Vector3(0.02, 1.2, 1.02);
const SCREEN = new THREE.Vector3(HANG.x, HANG.y - 0.05, HANG.z);
const OFF = {noor: [0, 0.06, -0.25], ellis: [0, -0.04, 0.2], priya: [0, 0.1, 0.05]};
// stage 1 happens in the café itself: whoever stands there (Noor) looks at the player there, at the line and the
// counter instead of the hanging screen, and at nobody who is back in the committee room
const where = (c) => inCafe(c.holder.position) ? 'cafe' : 'room';
function resolve(k, self) {
  // the player is in the chair (or on foot in the café): the camera is their eyes; in a director's shot, or while the
  // player is inside the replay, they look at the chair
  if (k === 'player') return VIEW.mode === 'seat' || VIEW.mode === 'walk' ? 'camera' : PLAYER_EYE;
  if (C[self] && where(C[self]) === 'cafe') {
    if (k === 'screen') return toWorld(2.9, 1.35, 0.2);                  // the line at the register
    if (k === 'balance') return toWorld(0.6, 1.05, -1.5);                 // the counter
    if (k === 'down') { const h = C[self].holder; return h.position.clone().add(new THREE.Vector3(Math.sin(h.rotation.y) * 0.9, 0.3, Math.cos(h.rotation.y) * 0.9)); }
    return C[k] && C[k].holder.visible && where(C[k]) === 'cafe' ? C[k] : 'camera';
  }
  if (k === 'screen') { const o = OFF[self] || [0, 0, 0]; return SCREEN.clone().add(new THREE.Vector3(...o)); }
  if (k === 'down') { const s = SEATS[self]; return new THREE.Vector3(s.x - Math.sin(s.ry) * -0.45, TABLE.y + 0.02, s.z - Math.cos(s.ry) * -0.45); }
  if (k === 'balance') return balanceAnchor().add(new THREE.Vector3(0, -0.12, 0));
  if (C[k] && C[k].holder.visible) return C[k];
  return 'camera';
}
const others = (self) => IDS.filter(id => id !== self && C[id] && C[id].holder.visible && (!C[self] || where(C[id]) === where(C[self])));
const screenOn = () => FEED.on;
const waiting = () => !document.getElementById('choices').classList.contains('hidden') || document.getElementById('panel').classList.contains('memo') && !document.getElementById('panel').classList.contains('hidden');
const look = (k) => k === 'screen' && !screenOn() ? 'down' : k;     // only for idle choices: a line that names the screen still looks at it
/** whom the speaker talks to now ('all' = anyone at the table, colleagues a little more than the player) */
function speakerBase(id) {
  if (st.to !== 'all') return st.to;
  return weighted([['player', 1], ...others(id).map(m => [m, 1.4])]);
}

/** the next thing to look at and for how long */
function next(id) {
  const sp = st.speaker, mates = others(id);
  if (sp === id) {                                            // speaking
    const base = speakerBase(id);
    // steady: mostly on the one addressed; now and then one glance at what is talked about or at another listener
    const prev = per[id] && per[id].t;
    const away = prev && prev !== base;                          // just looked away: come back
    if (!away && st.glance && Math.random() < 0.22) return [st.glance, rnd(1.2, 1.8)];
    if (!away && Math.random() < 0.14 && mates.length) return [pick(base === 'player' ? mates : ['player', ...mates.filter(o => o !== base)]), rnd(1.0, 1.5)];
    return [base, rnd(3.0, 5.0)];
  }
  if (sp === 'player') return Math.random() < 0.9 ? ['player', rnd(3, 5)] : [pick(mates), rnd(0.9, 1.3)];
  if (sp === 'narrator') return [look(weighted([['screen', 6], ['down', 3], [pick(mates) || 'down', 1]])), rnd(2.5, 5)];
  if (sp) {                                                   // a colleague speaks
    const r = Math.random();
    // over the playing replay, a line about the screen splits the eyes between the one speaking and the screen
    if (st.watching && st.glance === 'screen' && screenOn()) return r < 0.5 ? [sp, rnd(2.5, 4)] : ['screen', rnd(2.5, 4)];
    const prev = per[id] && per[id].t;
    if (prev && prev !== sp) return [sp, rnd(3, 5)];            // after a glance, back to the one speaking
    if (r < 0.88) return [sp, rnd(3, 5)];
    if (st.to !== id && st.to !== 'all' && st.to !== sp) return [st.to, rnd(1.0, 1.4)];
    return [st.glance || look(Math.random() < 0.5 ? 'screen' : pick(mates) || 'down'), rnd(1.0, 1.4)];
  }
  // nobody speaks
  const t = now();
  if (st.last && st.last !== id && t - st.lastEnd < 1.6) return [st.last, st.lastEnd + 1.6 - t];
  if ((st.watching || VIEW.mode === 'cafe') && screenOn()) return [weighted([['screen', 9], [pick(mates), 1]]), rnd(4, 7)];
  if (waiting()) return [weighted([['player', 7], [pick(mates), 3]]), rnd(3, 5)];
  return [look(weighted([['screen', 3], [pick(mates) || 'down', 3], ['player', 2], ['down', 1.5]])), rnd(4, 8)];
}

window.__gaze = () => JSON.stringify({speaker: st.speaker, to: st.to, watching: st.watching, per: Object.fromEntries(IDS.map(id => [id, per[id] && per[id].t]))});
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
