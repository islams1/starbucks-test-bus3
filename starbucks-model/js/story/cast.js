// Cast: the committee at the table (life size) and the people in the store model (1:16, the same avatars).
import * as THREE from 'three';
import {Character, characters, animLib} from '../actors/character.js';
import {findSeat, sitPose} from '../actors/contact.js';
import {onUpdate, camera, clock} from '../core/engine.js';
import {MQ} from '../world/maquette.js';

export const CAST = {
  noor: {avatar: 'Female_Adult_13', gender: 'f', height: 1.66, normals: false, talkAnims: ['f_gestic_talk_neutral_01', 'f_gestic_talk_relaxed_01']},
  ellis: {avatar: 'Male_Adult_02', gender: 'm', height: 1.77, normals: false, talkAnims: ['m_gestic_talk_neutral_01', 'm_gestic_talk_relaxed_01']},
  priya: {avatar: 'Female_Adult_09', gender: 'f', height: 1.69, talkAnims: ['f_gestic_talk_self-assured_01', 'f_gestic_talk_neutral_02']},
};
// the store's people on Tuesday morning (observed — the model shows them as they were)
export const MINI = {
  barista: {avatar: 'Female_Adult_11', gender: 'f', height: 1.63},
  cashier: {avatar: 'Male_Adult_07', gender: 'm', height: 1.76},
  ben: {avatar: 'Male_Adult_08', gender: 'm', height: 1.81},
  salma: {avatar: 'Female_Adult_05', gender: 'f', height: 1.64},
  q1: {avatar: 'Male_Adult_05', gender: 'm', height: 1.77}, q2: {avatar: 'Female_Adult_02', gender: 'f', height: 1.63},
  q3: {avatar: 'Male_Adult_10', gender: 'm', height: 1.81}, q4: {avatar: 'Female_Adult_04', gender: 'f', height: 1.66},
  q5: {avatar: 'Male_Adult_14', gender: 'm', height: 1.74}, q6: {avatar: 'Female_Adult_15', gender: 'f', height: 1.62},
  w1: {avatar: 'Female_Adult_01', gender: 'f', height: 1.65}, w2: {avatar: 'Female_Adult_14', gender: 'f', height: 1.70},
  s1: {avatar: 'Female_Adult_07', gender: 'f', height: 1.66}, s2: {avatar: 'Male_Adult_12', gender: 'm', height: 1.80},
};
export const IDLE = {q1: 'm_idle_look_around_01', q2: 'f_cell_phone_textmessage', q3: 'm_idle_neutral_03', q4: 'f_idle_neutral_02', q5: 'm_idle_neutral_02', q6: 'f_cell_phone_textmessage',
  w1: 'f_idle_neutral_01', w2: 'f_idle_nervous_03', salma: 'f_idle_neutral_01', ben: 'm_idle_neutral_01', cashier: 'm_work_table', barista: 'f_work_table'};
export const idleOf = (ch) => IDLE[ch.id] || (ch.g === 'm' ? 'm_idle_neutral_01' : 'f_idle_neutral_01');

/** the committee (first, the menu waits for them) */
export async function loadCommittee() {
  await Promise.all(Object.entries(CAST).map(async ([id, c]) => {
    const ch = await Character.create(id, c.avatar, {gender: c.gender, height: c.height, talks: true, normals: c.normals, talkAnims: c.talkAnims});
    ch.o.talkAnims = c.talkAnims; ch.hide();
  }));
}
/** the store's people, two at a time, into the model's frame */
export async function loadMinis(onEach) {
  const ids = Object.keys(MINI);
  for (let i = 0; i < ids.length; i += 3) {
    await Promise.all(ids.slice(i, i + 3).map(async id => {
      const c = MINI[id];
      const ch = await Character.create(id, c.avatar, {gender: c.gender, height: c.height, talks: false, normals: false, mini: true});
      MQ.live.add(ch.holder); ch.hide(); ch.mini = true;
      onEach && onEach(id);
    }));
  }
}

export function sit(ch, seat, {anim = null} = {}) {
  ch.seated = true; ch.walking = null; seat.taken = ch.id;
  const name = anim || (ch.g === 'm' ? 'm_sit_table_idle_neutral_01' : 'f_sit_table_idle_neutral_01');
  let x = seat.x, z = seat.z, y = 0;
  // sit on the chair that is really there: the pelvis over the seat (a little towards the back rest), the thighs on it
  const chair = findSeat(seat.x - Math.sin(seat.ry) * 0.06, seat.z - Math.cos(seat.ry) * 0.06, 0), clip = animLib[name];
  if (chair && clip) {
    const P = sitPose(ch, clip), s = Math.sin(seat.ry), c = Math.cos(seat.ry);
    const cx = chair.x - s * 0.04, cz = chair.z - c * 0.04;
    x = cx - (P.px * c + P.pz * s); z = cz - (-P.px * s + P.pz * c);
    y = chair.top - P.under;
  }
  ch.place(x, z, seat.ry, y);
  ch.setBase(name, {fade: 0.6});
}
/** a model person sits on a model chair (no furniture BVH in the model: the pose is measured, the seat height known) */
export function sitMini(ch, x, z, ry, {anim = null, seatTop = 0.47} = {}) {
  ch.seated = true; ch.walking = null;
  const name = anim || (ch.g === 'm' ? 'm_sit_table_idle_neutral_01' : 'f_sit_table_breathe_01'), clip = animLib[name];
  let px = 0, pz = 0, under = 0.47;
  if (clip) {
    // measure the clip's pelvis and thigh underside in the holder's own frame
    const bones = ch.mesh.skeleton.bones, saved = bones.map(b => [b.position.clone(), b.quaternion.clone()]);
    const hp = ch.holder.position.clone(), hr = ch.holder.rotation.y;
    ch.holder.position.set(0, 0, 0); ch.holder.rotation.y = 0;
    const mx = new THREE.AnimationMixer(ch.fbx); mx.clipAction(clip).play(); mx.update(0); ch.holder.updateMatrixWorld(true);
    const L = (b) => ch.holder.worldToLocal(b.getWorldPosition(new THREE.Vector3()));
    const sk = ch.mesh.skeleton, B = (n) => sk.getBoneByName('Bip01_' + n), pel = L(ch.bones.pelvis);
    let u = Infinity; for (const s of ['L', 'R']) { const T = L(B(s + '_Thigh')), K = L(B(s + '_Calf')); for (let f = 0.35; f <= 1.001; f += 0.13) u = Math.min(u, T.clone().lerp(K, f).y - 0.075); }
    mx.stopAllAction(); mx.uncacheRoot(ch.fbx);
    bones.forEach((b, i) => { b.position.copy(saved[i][0]); b.quaternion.copy(saved[i][1]); });
    ch.holder.position.copy(hp); ch.holder.rotation.y = hr;
    px = pel.x; pz = pel.z; under = u;
  }
  const s = Math.sin(ry), c = Math.cos(ry);
  ch.place(x - (px * c + pz * s), z - (-px * s + pz * c), ry, seatTop - under);
  ch.setBase(name, {fade: 0.4});
}
export function stand(ch, x, z, ry, anim = null) {
  ch.seated = false; ch.walking = null; ch.place(x, z, ry, 0); ch.setBase(anim || idleOf(ch), {fade: 0.4});
}
/** sleep in game time */
export const sleep = (s) => new Promise(r => { const t0 = clock.t; const off = onUpdate(() => { if (clock.t - t0 >= s) { off(); r(); } }); });

// ---------------------------------------------------------------- checking a watch (left wrist up, head down)
// Bones are aimed in world space; distances are in metres of the person, so they are multiplied by the person's
// world scale (1:16 in the model).
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _pq = new THREE.Quaternion();
const _S = new THREE.Vector3(), _E = new THREE.Vector3(), _W = new THREE.Vector3(), _R = new THREE.Vector3(), _t = new THREE.Vector3(), _d = new THREE.Vector3(), _f = new THREE.Vector3(), _in = new THREE.Vector3(), _ax = new THREE.Vector3(), _sc = new THREE.Vector3();
const UPV = new THREE.Vector3(0, 1, 0);
function aim(bone, from, to, target, k) {
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
      const S = ch.holder.getWorldScale(_sc).x;
      const wq = ch.holder.getWorldQuaternion(_pq); _f.set(0, 0, 1).applyQuaternion(wq); _f.y = 0; _f.normalize();
      ua.getWorldPosition(_S); rua.getWorldPosition(_R); _in.copy(_R).sub(_S); _in.y = 0; const sw = _in.length(); _in.normalize();
      fa.getWorldPosition(_E);
      const elbowT = _t.copy(_S).addScaledVector(UPV, -0.22 * S).addScaledVector(_f, 0.11 * S).addScaledVector(_in, 0.03 * S).clone();
      aim(ua, _S, _E, elbowT, e);
      fa.getWorldPosition(_E); hand.getWorldPosition(_W);
      const wristT = _t.copy(_S).addScaledVector(UPV, -0.12 * S).addScaledVector(_f, 0.31 * S).addScaledVector(_in, sw * 0.58).clone();
      aim(fa, _E, _W, wristT, e);
      if (hd) { _ax.crossVectors(_f, UPV).normalize(); _q.setFromAxisAngle(_ax, -0.42 * e); hd.getWorldQuaternion(_pq); _pq.premultiply(_q); hd.parent.getWorldQuaternion(_q2); hd.quaternion.copy(_q2.invert().multiply(_pq)); }
      if (t >= dur) { ch.postIK = prev; ch.lockLook = false; res(); }
    };
  });
}

// (who looks at whom around the table: story/gaze.js)
