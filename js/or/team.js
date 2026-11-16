// The theatre team and the patient: medical Rocketbox avatars placed where they really stand, theatre caps and masks
// for the anaesthetist and the scrub nurse (the library's female avatars have none), the patient lying supine.
import * as THREE from 'three';
import {Character, characters} from '../actors/character.js';
import {CHEST} from './room.js';

export const T = {};
export const CAST = {
  player:  {avatar: 'Medical_Male_05', gender: 'm', height: 1.8},
  layla:   {avatar: 'OR_Female_Anaesthesia', gender: 'f', height: 1.66, idle: 'f_idle_neutral_02', talkAnims: ['f_gestic_talk_neutral_01', 'f_gestic_talk_neutral_02'], cap: 0x3a7668},
  karim:   {avatar: 'Medical_Male_04', gender: 'm', height: 1.78, idle: 'm_work_table', talkAnims: ['m_gestic_talk_neutral_01']},
  rania:   {avatar: 'OR_Female_Scrub', gender: 'f', height: 1.64, idle: 'f_work_table', talkAnims: ['f_gestic_talk_neutral_02'], cap: 0x34608f},
  haddad:  {avatar: 'Medical_Male_05', gender: 'm', height: 1.82, idle: 'm_idle_neutral_01', talkAnims: ['m_gestic_talk_neutral_02']},
  patient: {avatar: 'Male_Adult_03', gender: 'm', height: 1.76, idle: 'm_idle_neutral_01', talks: true},
  huda:    {avatar: 'Medical_Female_01', gender: 'f', height: 1.65, idle: 'f_idle_neutral_01', talkAnims: ['f_gestic_talk_neutral_01']},
};

function capAndMask(ch, color, {mask = true} = {}) {
  ch.mixer.update(0); ch.holder.updateMatrixWorld(true);
  const head = ch.bones.head; const hp = head.getWorldPosition(new THREE.Vector3());
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(ch.holder.quaternion), up = new THREE.Vector3(0, 1, 0).applyQuaternion(ch.holder.quaternion);
  const cloth = (c) => new THREE.MeshStandardMaterial({color: c, roughness: 0.95});
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.105, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.58), cloth(color));
  cap.scale.set(0.98, 0.92, 1.12); cap.castShadow = true;
  cap.position.copy(hp).addScaledVector(up, 0.06).addScaledVector(fwd, -0.012);
  cap.quaternion.copy(ch.holder.quaternion); cap.rotateX(-0.18);
  head.attach(cap);
  if (mask) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.085, 24, 1, true, -Math.PI * 0.42, Math.PI * 0.84), new THREE.MeshStandardMaterial({color: 0x9fc7d8, roughness: 0.9, side: THREE.DoubleSide}));
    m.position.copy(hp).addScaledVector(up, 0.045).addScaledVector(fwd, 0.035);
    m.quaternion.copy(ch.holder.quaternion); m.castShadow = true;
    head.attach(m);
  }
}

export async function loadTeam() {
  const ids = Object.keys(CAST);
  for (let i = 0; i < ids.length; i += 2) {
    await Promise.all(ids.slice(i, i + 2).map(async id => {
      const c = CAST[id];
      const ch = await Character.create(id, c.avatar, {gender: c.gender, height: c.height, talks: c.talks !== false, talkAnims: c.talkAnims});
      ch.o.talkAnims = c.talkAnims; ch.idle = c.idle; T[id] = ch;
    }));
  }
  // positions
  const place = (id, x, z, ry, anim) => { const ch = T[id]; ch.seated = false; ch.place(x, z, ry); if (anim) ch.setBase(anim, {fade: 0}); ch.holder.visible = true; };
  place('layla', -1.42, -0.42, Math.PI * 0.42, 'f_idle_neutral_02');
  place('karim', 0.5, -2.12, 0, 'm_work_table');
  place('rania', 0.05, -0.62, 0, 'f_work_table');
  place('haddad', 2.2, 2.4, Math.PI, 'm_idle_neutral_01'); T.haddad.holder.visible = false;
  place('huda', 2.0, 2.7, Math.PI, 'f_idle_neutral_01'); T.huda.holder.visible = false;
  place('player', CHEST.x + 0.02, 0.5, Math.PI, 'm_idle_neutral_01');
  // patient: supine on the table, head towards the anaesthetist (-x), behind the anaesthesia screen
  const p = T.patient; place('patient', 0, 0, 0, 'm_idle_neutral_01');
  const basis = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0));
  p.holder.quaternion.setFromRotationMatrix(basis); p.holder.position.set(0.86, 0.985, 0);
  p.place = () => {};                               // the lying body is not moved by the character code
  if (p.cur) p.cur.timeScale = 0.15;
  p.lockLook = true;
  // theatre caps and masks
  capAndMask(T.layla, CAST.layla.cap); capAndMask(T.rania, CAST.rania.cap);
  return T;
}
export {characters};
