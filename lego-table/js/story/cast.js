// The cast (Concept A §3): Ina (design head), Mikael (operations head), Rania (channel lead) stand at the worktable and
// later sit on the north side of the review table; Victor (board chair) sits at its head throughout. Calm breathing
// poses only — standing: hands at the sides; seated: hands on the table. The only hand movements are four deliberate
// ones tied to lines: Rania holds the report out (it lands on the table), Ina sets the prototype box on its base,
// Mikael points at the rack on "eight units", Mikael opens the supplier label on a carton.
import * as THREE from 'three';
import {Character, characters, animLib} from '../actors/character.js';
import {findSeat, sitPose} from '../actors/contact.js';
import {onUpdate, clock} from '../core/engine.js';
import {SEATS, STAND, WT} from '../world/workshop.js';

export const CAST = {
  ina: {avatar: 'Female_Adult_04', gender: 'f', height: 1.68},
  mikael: {avatar: 'Male_Adult_05', gender: 'm', height: 1.79},
  rania: {avatar: 'Female_Adult_07', gender: 'f', height: 1.66},
  victor: {avatar: 'Male_Adult_03', gender: 'm', height: 1.77},
};
export async function loadCast() {
  await Promise.all(Object.entries(CAST).map(async ([id, c]) => {
    const ch = await Character.create(id, c.avatar, {gender: c.gender, height: c.height, talks: true, normals: c.avatar === 'Male_Adult_03', talkAnims: []});
    ch.hide();
  }));
}
const breathe = (ch, seated) => seated ? (ch.g === 'm' ? 'm_sit_table_breathe_01' : 'f_sit_table_breathe_01') : (ch.g === 'm' ? 'm_idle_breathe_01' : 'f_idle_breathe_01');
export function sit(ch, seat) {
  ch.seated = true; ch.walking = null; seat.taken = ch.id;
  const name = breathe(ch, true);
  let x = seat.x, z = seat.z, y = 0;
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
export function stand(ch, x, z, ry) { ch.seated = false; ch.walking = null; ch.place(x, z, ry, 0); ch.setBase(breathe(ch, false), {fade: 0.5}); }
export const sleep = (s) => new Promise(r => { const t0 = clock.t; const off = onUpdate(() => { if (clock.t - t0 >= s) { off(); r(); } }); });

/** the opening places: Victor at the head of the review table, the three at the worktable */
export function placeOpening() {
  const C = characters;
  sit(C.victor, SEATS.victor);
  for (const id of ['ina', 'mikael', 'rania']) { const s = STAND[id]; stand(C[id], s.x, s.z, s.ry); }
}
export function placeReview() {
  const C = characters;
  sit(C.victor, SEATS.victor);
  for (const id of ['ina', 'mikael', 'rania']) sit(C[id], SEATS[id]);
}
/** the three walk over to the review table and sit down (the camera's one move happens meanwhile) */
export async function walkToReview(instant = false) {
  const C = characters;
  if (instant) { placeReview(); return; }
  const route = {
    ina: [[WT.x - 0.2, WT.z - 1.5], [0.9, -1.75], [SEATS.ina.x, SEATS.ina.z - 0.55]],
    mikael: [[WT.x + 0.6, WT.z - 1.45], [1.3, -1.6], [SEATS.mikael.x, SEATS.mikael.z - 0.55]],
    rania: [[0.6, -1.25], [1.8, -1.45], [SEATS.rania.x, SEATS.rania.z - 0.55]],
  };
  await Promise.all(['ina', 'mikael', 'rania'].map(async (id, i) => {
    await sleep(i * 0.35);
    C[id].seated = false;
    await C[id].walkTo(route[id], {nav: false, speed: 1.15});
    sit(C[id], SEATS[id]);
  }));
}

// ---------------------------------------------------------------- the deliberate gestures (an arm aimed at a point, blended in and out)
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _pq = new THREE.Quaternion();
const _S = new THREE.Vector3(), _E = new THREE.Vector3(), _W = new THREE.Vector3(), _t = new THREE.Vector3(), _d = new THREE.Vector3();
function aim(bone, from, to, target, k) {
  _d.copy(to).sub(from).normalize(); _t.copy(target).sub(from).normalize();
  _q.setFromUnitVectors(_d, _t); _q2.identity().slerp(_q, k);
  bone.getWorldQuaternion(_pq); _pq.premultiply(_q2);
  bone.parent.getWorldQuaternion(_q); bone.quaternion.copy(_q.invert().multiply(_pq));
  bone.updateWorldMatrix(false, true);
}
/**
 * aim one or both arms at world points. arms: [{side: 'R'|'L', target: () => Vector3, bend: 0..1}]
 * k rises over `rise` s, holds until `release()` is called (or `hold` s), then falls; returns {release, done}
 */
export function armsTo(ch, arms, {rise = 0.45, hold = null, fall = 0.55} = {}) {
  const sk = ch.mesh.skeleton, B = (n) => sk.getBoneByName('Bip01_' + n);
  const chains = arms.map(a => ({...a, ua: B(a.side + '_UpperArm'), fa: B(a.side + '_Forearm'), hd: B(a.side + '_Hand')})).filter(a => a.ua && a.fa && a.hd);
  let t = 0, out = -1, resDone; const done = new Promise(r => resDone = r);
  const prev = ch.postIK;
  const release = () => { if (out < 0) out = t; };
  ch.postIK = (dt) => {
    if (prev) prev(dt);
    t += dt;
    if (hold != null && t > rise + hold) release();
    const up = Math.min(1, t / rise), dn = out < 0 ? 1 : Math.max(0, 1 - (t - out) / fall);
    const k = Math.min(up, dn), e = k * k * (3 - 2 * k);
    ch.holder.updateWorldMatrix(true, true);
    for (const a of chains) {
      const T = a.target(); if (!T) continue;
      a.ua.getWorldPosition(_S); a.fa.getWorldPosition(_E);
      // the elbow goes between the shoulder and the target, a little down and out
      const side = new THREE.Vector3(1, 0, 0).applyQuaternion(ch.holder.quaternion).multiplyScalar(a.side === 'R' ? -1 : 1);
      const elbowT = _S.clone().lerp(T, 0.5).add(new THREE.Vector3(0, -0.12 * (a.bend ?? 0.6), 0)).addScaledVector(side, 0.06);
      aim(a.ua, _S, _E, elbowT, e);
      a.fa.getWorldPosition(_E); a.hd.getWorldPosition(_W);
      aim(a.fa, _E, _W, T, e);
    }
    if (out >= 0 && dn <= 0) { ch.postIK = prev; resDone(); }
  };
  return {release, done, hand: (side = 'R') => B(side + '_Hand')};
}
/** a world point in front of a character (forward f, up y, right r: metres) */
export function front(ch, f, y, r = 0) {
  const q = ch.holder.quaternion, p = ch.holder.position.clone();
  return p.add(new THREE.Vector3(0, 0, f).applyQuaternion(q)).add(new THREE.Vector3(-r, 0, 0).applyQuaternion(q)).setY(y);
}
