// Cast: avatars, body language, background routines.
import * as THREE from 'three';
import {Character, characters} from '../actors/character.js';
import {anchors} from '../world/building.js';
import {onUpdate, camera} from '../core/engine.js';
import {player} from '../actors/player.js';
import {signal, ROAD} from '../world/traffic.js';

export const CAST = {
  player: {avatar: 'Male_Adult_03', gender: 'm', height: 1.78},
  nadia: {avatar: 'Female_Adult_09', gender: 'f', height: 1.68, idle: 'f_idle_neutral_01', talkAnims: ['f_gestic_talk_self-assured_01', 'f_gestic_talk_neutral_01']},
  ryan: {avatar: 'Male_Adult_08', gender: 'm', height: 1.82, idle: 'm_idle_neutral_03', talkAnims: ['m_gestic_talk_excited_01', 'm_gestic_talk_neutral_02']},
  mei: {avatar: 'Female_Adult_15', gender: 'f', height: 1.62, idle: 'f_idle_neutral_02', talkAnims: ['f_gestic_talk_excited_01']},
  omar: {avatar: 'Male_Adult_07', gender: 'm', height: 1.76, idle: 'm_idle_neutral_01', talkAnims: ['m_gestic_talk_relaxed_01', 'm_gestic_talk_neutral_01']},
  grace: {avatar: 'Female_Adult_14', gender: 'f', height: 1.70, idle: 'f_idle_neutral_01', talkAnims: ['f_gestic_talk_relaxed_01', 'f_gestic_talk_neutral_02']},
  secretary: {avatar: 'Female_Adult_11', gender: 'f', height: 1.66, idle: 'f_idle_neutral_02', talkAnims: ['f_gestic_talk_neutral_02']},
  hana: {avatar: 'Female_Adult_01', gender: 'f', height: 1.65, idle: 'f_idle_neutral_02', talkAnims: ['f_gestic_talk_neutral_01', 'f_gestic_talk_relaxed_01']},
  reception: {avatar: 'Female_Adult_05', gender: 'f', height: 1.67, idle: 'f_idle_neutral_01', talkAnims: ['f_gestic_talk_neutral_02'], normals: false},
  w1: {avatar: 'Male_Adult_02', gender: 'm', height: 1.79, talks: false, normals: false},
  w2: {avatar: 'Female_Adult_04', gender: 'f', height: 1.66, talks: false, normals: false},
  w3: {avatar: 'Male_Adult_14', gender: 'm', height: 1.74, talks: false, normals: false},
  w4: {avatar: 'Male_Adult_12', gender: 'm', height: 1.80, talks: false, normals: false},
  w5: {avatar: 'Female_Adult_13', gender: 'f', height: 1.64, talks: false, normals: false},
  p1: {avatar: 'Female_Adult_02', gender: 'f', height: 1.63, talks: false, normals: false},
  p2: {avatar: 'Male_Adult_05', gender: 'm', height: 1.77, talks: false, normals: false},
  p3: {avatar: 'Male_Adult_10', gender: 'm', height: 1.81, talks: false, normals: false},
  p4: {avatar: 'Female_Adult_07', gender: 'f', height: 1.66, talks: false, normals: false},
};

export async function loadCast(onEach, ids = Object.keys(CAST)) {
  // sequential-ish (2 at a time) to keep peak memory low while FBX morph data is pruned
  for (let i = 0; i < ids.length; i += 2) {
    await Promise.all(ids.slice(i, i + 2).map(async id => {
      const c = CAST[id];
      const ch = await Character.create(id, c.avatar, {gender: c.gender, height: c.height, talks: c.talks !== false, normals: c.normals, talkAnims: c.talkAnims});
      ch.o.talkAnims = c.talkAnims; ch.idle = c.idle;
      onEach && onEach(id);
    }));
  }
  return characters;
}

// seated offsets (Rocketbox sit anims put the pelvis ~0.1 m behind the root)
export function sit(ch, seat, {anim = null, back = 0.0} = {}) {
  ch.seated = true;
  ch.place(seat.x - Math.sin(seat.ry) * back, seat.z - Math.cos(seat.ry) * back, seat.ry, 0);
  ch.setBase(anim || (ch.g === 'm' ? 'm_sit_table_idle_neutral_01' : 'f_sit_table_idle_neutral_01'), {fade: 0.6});
}
export function stand(ch, x, z, ry, anim = null) {
  ch.seated = false; ch.place(x, z, ry); ch.setBase(anim || ch.idle || (ch.g === 'm' ? 'm_idle_neutral_01' : 'f_idle_neutral_01'), {fade: 0.5});
}

/** background life: seated workers, walkers. */
export function startBackground() {
  const C = characters, seats = anchors.workSeats;
  if (C.w1) sit(C.w1, seats[1], {anim: 'm_sit_table_idle_neutral_01'});
  if (C.w2) sit(C.w2, seats[6], {anim: 'f_sit_table_breathe_01'});
  if (!C.w3) return;          // quick version: only the two seated colleagues
  stand(C.w3, anchors.breakNpc.x, anchors.breakNpc.z, anchors.breakNpc.ry, 'm_idle_neutral_03');
  // two walkers: one outdoor loop (plaza), one indoor loop (lobby ↔ corridor ↔ open office)
  loop(C.w4, [[-12, 30], [12, 30], [14, 22], [-14, 22]], 1.3);
  loop(C.w5, [[-3, 7.5], [-3.5, 0.5], [-9, -3.5], [-12, 2], [-6.2, 4.2], [-3, 7.5]], 1.15, 'f_walk_stroll_01');
  // street: two walkers on the sidewalks, two people who cross at the zebra when the walk light is green
  loop(C.p1, [[-34, 38.2], [34, 38.2]], 1.3, 'f_walk_neutral_01');      // grid: goes around the corner planters and the bus stop
  loop(C.p2, [[30, 54.2], [-32, 54.2]], 1.15, 'm_walk_cool_01', false);
  crosser(C.p3, -1, 'm_walk_neutral_01', [-22, 38.4], [18, 54.0]);
  crosser(C.p4, 1, 'f_walk_fast_01', [24, 54.0], [-26, 38.6]);
}
const until = (fn) => new Promise(r => { const t = setInterval(() => { if (fn()) { clearInterval(t); r(); } }, 200); });
async function crosser(ch, side, anim, a, b) {
  ch.seated = false; ch.place(a[0], a[1], 0); ch.setBase(ch.g === 'm' ? 'm_idle_neutral_01' : 'f_idle_neutral_02');
  const zNear = ROAD.z0 - 1.0, zFar = ROAD.z1 + 1.0, x = side * 0.9;
  for (;;) {
    // sidewalk legs use the walk grid (around planters, lamp posts and the bus-stop bench); only the zebra is a fixed line
    await ch.walkTo([[x, a[1] < ROAD.zc ? zNear : zFar]], {speed: 1.2, anim});
    ch.faceTo(x, a[1] < ROAD.zc ? zFar : zNear);
    await until(() => !signal.walk); await until(() => signal.walk);       // wait for the next green man
    await ch.walkTo([[x, a[1] < ROAD.zc ? zFar : zNear]], {speed: 1.45, anim, nav: false});
    await ch.walkTo([b], {speed: 1.2, anim});
    [a, b] = [b, a];
  }
}
async function loop(ch, pts, speed, anim, nav = true) {
  ch.seated = false; ch.place(pts[0][0], pts[0][1], 0); ch.setBase(ch.g === 'm' ? 'm_idle_neutral_01' : 'f_idle_neutral_01');
  for (;;) { await ch.walkTo(pts.slice(1).concat([pts[0]]), {speed, anim, nav}); }
}

/** characters glance at the player when they pass close by (natural awareness) */
onUpdate(() => {
  if (!player.ch) return;
  const pp = player.ch.holder.position;
  for (const id of ['w1', 'w2', 'w3', 'reception', 'ryan', 'mei', 'grace', 'omar', 'secretary']) {
    const c = characters[id]; if (!c || !c.holder.visible || c.lockLook) continue;
    const d = c.holder.position.distanceTo(pp);
    c.lookAt(d < 3.2 ? player.ch : null);
  }
});
