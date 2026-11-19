// Cast: avatars, staff routines, the queue, background customers, small procedural gestures (checking a watch).
import * as THREE from 'three';
import {Character, characters} from '../actors/character.js';
import {onUpdate, camera, damp, clock} from '../core/engine.js';

export const CAST = {
  player: {avatar: 'Male_Adult_03', gender: 'm', height: 1.78},
  noor: {avatar: 'Female_Adult_13', gender: 'f', height: 1.66, normals: false, idle: 'f_idle_neutral_02', talkAnims: ['f_gestic_talk_neutral_01', 'f_gestic_talk_relaxed_01']},
  ben: {avatar: 'Male_Adult_08', gender: 'm', height: 1.81, idle: 'm_idle_neutral_01', talkAnims: ['m_gestic_talk_neutral_02']},
  salma: {avatar: 'Female_Adult_05', gender: 'f', height: 1.64, normals: false, idle: 'f_idle_neutral_01', talkAnims: ['f_gestic_talk_relaxed_01']},
  ellis: {avatar: 'Male_Adult_02', gender: 'm', height: 1.77, normals: false, idle: 'm_idle_neutral_02', talkAnims: ['m_gestic_talk_neutral_01', 'm_gestic_talk_relaxed_01']},
  priya: {avatar: 'Female_Adult_09', gender: 'f', height: 1.69, idle: 'f_idle_neutral_01', talkAnims: ['f_gestic_talk_self-assured_01', 'f_gestic_talk_neutral_02']},
  cashier: {avatar: 'Male_Adult_07', gender: 'm', height: 1.76, talks: false},
  barista: {avatar: 'Female_Adult_11', gender: 'f', height: 1.63, talks: false},
  q1: {avatar: 'Male_Adult_05', gender: 'm', height: 1.77, talks: false, normals: false},
  q2: {avatar: 'Female_Adult_02', gender: 'f', height: 1.63, talks: false, normals: false},
  q3: {avatar: 'Male_Adult_10', gender: 'm', height: 1.81, talks: false, normals: false},
  q4: {avatar: 'Female_Adult_04', gender: 'f', height: 1.66, talks: false, normals: false},
  q5: {avatar: 'Male_Adult_14', gender: 'm', height: 1.74, talks: false, normals: false},
  q6: {avatar: 'Female_Adult_15', gender: 'f', height: 1.62, talks: false, normals: false},
  q7: {avatar: 'Female_Adult_01', gender: 'f', height: 1.65, talks: false, normals: false},
  q8: {avatar: 'Female_Adult_14', gender: 'f', height: 1.70, talks: false, normals: false},
  s1: {avatar: 'Female_Adult_07', gender: 'f', height: 1.66, talks: false, normals: false},
  s2: {avatar: 'Male_Adult_12', gender: 'm', height: 1.80, talks: false, normals: false},
};
export const QUEUE_IDS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'];

export async function loadCast(onEach, ids = Object.keys(CAST)) {
  for (let i = 0; i < ids.length; i += 2) {
    await Promise.all(ids.slice(i, i + 2).map(async id => {
      const c = CAST[id];
      const ch = await Character.create(id, c.avatar, {gender: c.gender, height: c.height, talks: c.talks !== false, normals: c.normals, talkAnims: c.talkAnims});
      ch.o.talkAnims = c.talkAnims; ch.idle = c.idle; ch.hide();
      onEach && onEach(id);
    }));
  }
  return characters;
}

export function sit(ch, seat, {anim = null, back = 0.0} = {}) {
  ch.seated = true; ch.walking = null;
  ch.place(seat.x - Math.sin(seat.ry) * back, seat.z - Math.cos(seat.ry) * back, seat.ry, seat.y || 0);
  ch.setBase(anim || (ch.g === 'm' ? 'm_sit_table_idle_neutral_01' : 'f_sit_table_idle_neutral_01'), {fade: 0.6});
}
export function stand(ch, x, z, ry, anim = null, y = 0) {
  ch.seated = false; ch.walking = null; ch.place(x, z, ry, y); ch.setBase(anim || ch.idle || (ch.g === 'm' ? 'm_idle_neutral_01' : 'f_idle_neutral_01'), {fade: 0.5});
}

// ---------------------------------------------------------------- the queue (register at x -2.2, line runs towards the door)
// slot 0 is ordering at the register; the line goes south along x = -2.2, then turns east towards the door.
export const QSLOTS = [[-2.2, 29.95], [-2.2, 30.8], [-2.2, 31.65], [-2.2, 32.5], [-2.2, 33.35], [-1.45, 34.15], [-0.6, 34.45], [0.3, 34.65], [1.2, 34.8], [2.1, 34.95]];
export const slotFace = (i) => { const a = QSLOTS[i], b = QSLOTS[Math.max(0, i - 1)]; return i === 0 ? Math.PI : Math.atan2(b[0] - a[0], b[1] - a[1]); };
const QIDLE = {q1: 'm_idle_look_around_01', q2: 'f_cell_phone_textmessage', q3: 'm_idle_neutral_03', q4: 'f_idle_neutral_02', q5: 'm_idle_neutral_02', q6: 'f_cell_phone_textmessage', q7: 'f_idle_nervous_03', q8: 'f_idle_neutral_01', s1: 'f_cell_phone_textmessage', s2: 'm_idle_look_around_01', salma: 'f_idle_neutral_01'};
export const qIdle = (id) => QIDLE[id];
export function lineUp(ids, startSlot = 0) {
  ids.forEach((id, i) => { const c = characters[id]; if (!c) return; const s = QSLOTS[startSlot + i]; stand(c, s[0], s[1], slotFace(startSlot + i), QIDLE[id] || null); });
}

// ---------------------------------------------------------------- staff routines
let staffOn = false;
export function startStaff({busy = true} = {}) {
  const C = characters; staffOn = true;
  const cash = C.cashier, bar = C.barista;
  if (cash) stand(cash, -2.2, 28.15, 0, busy ? 'm_work_table' : 'm_idle_neutral_02');
  if (bar && !bar._loop) { bar._loop = true; baristaLoop(bar, busy); }
}
async function baristaLoop(ch, busy) {
  stand(ch, 1.9, 27.55, Math.PI, 'f_work_table');
  for (;;) {
    if (!staffOn) { await sleep(1); continue; }
    // pull shots / steam milk at the machine, then hand the cup off at the pickup shelf
    ch.setBase('f_work_table', {fade: 0.4}); ch.faceTo(1.9, 26.6);
    await sleep(ch._busy === false ? 14 : 6 + Math.random() * 3);
    await ch.walkTo([[4.4, 28.2]], {speed: 1.2, nav: false}); ch.faceTo(4.4, 29.4);
    await sleep(1.2);
    if (onHandoff) onHandoff();
    await ch.walkTo([[1.9, 27.55]], {speed: 1.2, nav: false});
  }
}
let onHandoff = null;
export function setHandoffHook(fn) { onHandoff = fn; }
export function setStaffPace(busy) { const b = characters.barista; if (b) b._busy = busy; }
/** sleep in game time (follows the time-lapse) */
export const sleep = (s) => new Promise(r => { const t0 = clock.t; const off = onUpdate(() => { if (clock.t - t0 >= s) { off(); r(); } }); });

// ---------------------------------------------------------------- seated customers
export function seatCustomers(seats, ids = ['s1', 's2']) {
  ids.forEach((id, i) => { const c = characters[id]; const s = seats[i]; if (c && s) sit(c, s, {anim: c.g === 'm' ? 'm_sit_table_idle_neutral_01' : 'f_sit_table_breathe_01'}); });
}

// ---------------------------------------------------------------- checking a watch (left wrist up in front of the chest, head down)
// Aim the bones in world space (independent of the rig's local axes): the upper arm hangs down and a little forward,
// the forearm comes up across the body to the front of the chest, the head bows towards the wrist.
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _pq = new THREE.Quaternion();
const _S = new THREE.Vector3(), _E = new THREE.Vector3(), _W = new THREE.Vector3(), _R = new THREE.Vector3(), _t = new THREE.Vector3(), _d = new THREE.Vector3(), _f = new THREE.Vector3(), _in = new THREE.Vector3(), _ax = new THREE.Vector3();
const UPV = new THREE.Vector3(0, 1, 0);
function aim(bone, from, to, target, k) {
  // rotate `bone` so the direction from->to turns towards from->target (weight k)
  _d.copy(to).sub(from).normalize(); _t.copy(target).sub(from).normalize();
  _q.setFromUnitVectors(_d, _t); _q2.identity().slerp(_q, k);
  bone.getWorldQuaternion(_pq); _pq.premultiply(_q2);
  bone.parent.getWorldQuaternion(_q); bone.quaternion.copy(_q.invert().multiply(_pq));
  bone.updateWorldMatrix(false, true);
}
export function watchGlance(ch, dur = 1.6) {
  const sk = ch.mesh.skeleton;
  const ua = sk.getBoneByName('Bip01_L_UpperArm'), fa = sk.getBoneByName('Bip01_L_Forearm'), hand = sk.getBoneByName('Bip01_L_Hand'), rua = sk.getBoneByName('Bip01_R_UpperArm'), hd = ch.bones.head;
  if (!ua || !fa || !hand || !rua) return Promise.resolve();
  let t = 0; const prev = ch.postIK; ch.lockLook = true; ch.lookAt(null);
  return new Promise(res => {
    ch.postIK = (dt) => {
      if (prev) prev(dt);
      t += dt; const k = Math.min(1, t / 0.4) * Math.min(1, Math.max(0, (dur - t) / 0.4)); const e = k * k * (3 - 2 * k);
      ch.holder.updateWorldMatrix(true, true);
      const ry = ch.holder.rotation.y; _f.set(Math.sin(ry), 0, Math.cos(ry));
      ua.getWorldPosition(_S); rua.getWorldPosition(_R); _in.copy(_R).sub(_S); _in.y = 0; const sw = _in.length(); _in.normalize();
      // upper arm: down, slightly forward, elbow close to the body
      fa.getWorldPosition(_E);
      const elbowT = _t.copy(_S).addScaledVector(UPV, -0.22).addScaledVector(_f, 0.11).addScaledVector(_in, 0.03).clone();
      aim(ua, _S, _E, elbowT, e);
      // forearm: across to the front of the chest, wrist at about shoulder-width inward
      fa.getWorldPosition(_E); hand.getWorldPosition(_W);
      const wristT = _t.copy(_S).addScaledVector(UPV, -0.12).addScaledVector(_f, 0.31).addScaledVector(_in, sw * 0.58).clone();
      aim(fa, _E, _W, wristT, e);
      // head bows towards the wrist
      if (hd) { _ax.crossVectors(_f, UPV).normalize(); _q.setFromAxisAngle(_ax, -0.42 * e); hd.getWorldQuaternion(_pq); _pq.premultiply(_q); hd.parent.getWorldQuaternion(_q2); hd.quaternion.copy(_q2.invert().multiply(_pq)); }
      if (t >= dur) { ch.postIK = prev; ch.lockLook = false; res(); }
    };
  });
}

/** customers and staff glance at the camera when the player stands close */
const LOOKERS = ['noor', 'cashier', 'barista', 'salma', 'ben', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 's1', 's2', 'ellis', 'priya'];
onUpdate(() => {
  for (const id of LOOKERS) {
    const c = characters[id]; if (!c || !c.holder.visible || c.lockLook) continue;
    const d = c.holder.position.distanceTo(camera.position) - 0.6;
    c.lookAt(d < 2.6 && Math.abs(c.holder.position.y - camera.position.y) < 2.5 ? 'camera' : null);
  }
});
