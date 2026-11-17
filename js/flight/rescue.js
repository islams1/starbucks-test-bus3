// After the ditching: the scene from the famous photographs — passengers standing on both wings in the cold river, and
// the commuter ferries turning toward the airplane (the first arrived in under four minutes). The people are loaded in the
// background during the flight so the ending does not wait.
import * as THREE from 'three';
import {Character, loadAnimLib} from '../actors/character.js';
import {scene, onUpdate} from '../core/engine.js';
import {AC} from './aircraft.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const R = {people: [], ferries: [], loading: null};
const AVATARS = [['Male_Adult_02', 'm'], ['Female_Adult_01', 'f'], ['Male_Adult_05', 'm'], ['Female_Adult_04', 'f'], ['Male_Adult_07', 'm'],
  ['Female_Adult_09', 'f'], ['Male_Adult_12', 'm'], ['Female_Adult_13', 'f']];

export function preloadRescue() {
  if (R.loading) return R.loading;
  R.loading = (async () => {
    await loadAnimLib();
    for (const [av, g] of AVATARS) {
      try { const c = await Character.create('pax_' + av, av, {gender: g, height: g === 'm' ? 1.78 : 1.66, talks: false}); c.holder.visible = false; R.people.push(c); }
      catch (e) { console.warn('pax', av, e); }
    }
  })();
  return R.loading;
}

function ferry(color) {
  const G = new THREE.Group();
  const white = new THREE.MeshLambertMaterial({color: 0xeef0f0}), band = new THREE.MeshLambertMaterial({color}), dark = new THREE.MeshLambertMaterial({color: 0x23292e});
  const hull = new THREE.Mesh(new THREE.BoxGeometry(8, 2.2, 24), white); hull.position.y = 0.6; G.add(hull);
  const bow = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 2.2, 3, 1), white); bow.rotation.y = Math.PI / 6; bow.scale.set(1, 1, 1.5); bow.position.set(0, 0.6, 12); G.add(bow);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(8.1, 0.45, 24.1), band); stripe.position.y = 1.2; G.add(stripe);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(7, 2.4, 15), white); cabin.position.set(0, 2.9, -1.5); G.add(cabin);
  const win = new THREE.Mesh(new THREE.BoxGeometry(7.05, 0.8, 13.5), dark); win.position.set(0, 3.2, -1.5); G.add(win);
  const wheel = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.6, 3), white); wheel.position.set(0, 4.9, 3); G.add(wheel);
  G.traverse(o => { if (o.isMesh) { o.castShadow = false; } });
  return G;
}

/** show the airplane afloat with the people on the wings and the ferries coming; returns a stop function */
export function showRescue() {
  // on the wings (airplane frame: +x left wing, −x right wing, +z forward); people face away from the fuselage, toward help
  const spots = [[3.2, -1.2], [5.0, -1.9], [6.8, -2.6], [8.6, -3.3], [-3.2, -1.2], [-5.0, -1.9], [-6.8, -2.6], [-8.6, -3.3]];
  R.people.forEach((c, i) => {
    const [x, z] = spots[i % spots.length];
    AC.group.add(c.holder);
    c.seated = false; c.place(x, z - 2, x > 0 ? 1.4 : -1.4, -0.35 + Math.abs(x) * 0.05);
    c.setBase(i % 3 ? (c.g === 'f' ? 'f_idle_neutral_01' : 'm_idle_nervous_01') : (c.g === 'f' ? 'f_idle_breathe_01' : 'm_idle_breathe_01'), {fade: 0});
    c.holder.visible = true; c.lookAt(null);
  });
  // three ferries turning toward the airplane from the Manhattan side and the New Jersey side
  const p = AC.group.position.clone();
  const starts = [[230, -120, 0xf28b23], [210, 140, 0x1f5fa8], [-260, 40, 0x1f5fa8]];
  for (const [dx, dz, col] of starts) {
    const f = ferry(col); f.position.set(p.x + dx, 0, p.z + dz); scene.add(f);
    const to = p.clone().add(V(dx * 0.16, 0, dz * 0.16)); f.userData.to = to;
    R.ferries.push(f);
  }
  const off = onUpdate((dt) => {
    for (const f of R.ferries) {
      const d = f.userData.to.clone().sub(f.position); d.y = 0; const L = d.length();
      if (L > 2) { const v = Math.min(9, L * 0.09); f.position.addScaledVector(d.normalize(), v * dt); f.rotation.y = Math.atan2(d.x, d.z); }
      f.position.y = Math.sin(performance.now() / 900 + f.position.x) * 0.15;
    }
  });
  return () => { off(); for (const f of R.ferries) scene.remove(f); R.ferries = []; for (const c of R.people) c.holder.visible = false; };
}
