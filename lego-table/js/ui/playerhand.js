// The player's own right hand and forearm (Concept A §3, "we see the right hand and forearm, dark blue sleeve"), in the
// style of a VR hand. Over the table it follows the pointer (the fingertips where the pointer is); while something
// is carried it holds it from above; the story can make it reach, pinch, press and come back (reach/press/rest).
// It comes in from the lower right of the view, as a right arm does.
import * as THREE from 'three';
import {camera, onUpdate, clamp} from '../core/engine.js';
import {VIEW, reducedMotion, modalOpen} from './view.js';
import {WT, RT} from '../world/workshop.js';

const canvas = document.getElementById('gl');
const skin = new THREE.MeshStandardMaterial({color: 0xc79a7d, roughness: 0.55});
// the forearm fades out towards the elbow (a VR-style hand and short forearm)
const fadeTex = (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 128; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#000'); gr.addColorStop(0.45, '#fff'); gr.addColorStop(1, '#fff'); g.fillStyle = gr; g.fillRect(0, 0, 4, 128); const t = new THREE.CanvasTexture(c); return t; })();
const sleeveM = new THREE.MeshStandardMaterial({color: 0x22355e, roughness: 0.9, alphaMap: fadeTex, transparent: true, side: THREE.DoubleSide});
const cuffM = new THREE.MeshStandardMaterial({color: 0x24365e, roughness: 0.8});
const nailM = new THREE.MeshStandardMaterial({color: 0xe2c0ae, roughness: 0.35});
const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 4, 10);

export const HAND = {root: new THREE.Group(), wrist: new THREE.Group(), fingers: [], thumb: null, curl: 0.25, curlWant: 0.25, visible: false,
  T: new THREE.Vector3(), want: new THREE.Vector3(), script: null, carry: null, flat: 0};
const R = HAND.root; R.name = 'playerhand';

function build() {
  // the hand (local +z: where the fingers point; palm down)
  const W = HAND.wrist; R.add(W);
  const palm = new THREE.Mesh(new THREE.CapsuleGeometry(0.026, 0.035, 4, 12), skin); palm.rotation.x = Math.PI / 2; palm.scale.set(1.55, 1, 0.55); palm.position.set(0, 0, 0.045); W.add(palm);
  const back = new THREE.Mesh(new THREE.SphereGeometry(0.036, 16, 12), skin); back.scale.set(1.15, 0.5, 1.2); back.position.set(0, 0.004, 0.04); W.add(back);
  // four fingers: index (thumb side, +x) to little (−x)
  const F = [[0.026, 0.044, 0.032, 0.0092], [0.009, 0.049, 0.035, 0.0094], [-0.009, 0.046, 0.033, 0.009], [-0.025, 0.036, 0.027, 0.0082]];
  for (const [x, l1, l2, r] of F) {
    const k1 = new THREE.Group(); k1.position.set(x, -0.002, 0.082); W.add(k1);
    const s1 = new THREE.Mesh(cap(r, l1 - 2 * r), skin); s1.rotation.x = Math.PI / 2; s1.position.z = l1 / 2; k1.add(s1);
    const k2 = new THREE.Group(); k2.position.z = l1; k1.add(k2);
    const s2 = new THREE.Mesh(cap(r * 0.92, l2 - 2 * r), skin); s2.rotation.x = Math.PI / 2; s2.position.z = l2 / 2; k2.add(s2);
    const nail = new THREE.Mesh(new THREE.BoxGeometry(r * 1.3, 0.002, r * 1.4), nailM); nail.position.set(0, r * 0.85, l2 - r * 1.1); k2.add(nail);
    HAND.fingers.push({k1, k2, x});
  }
  // the thumb: from the side of the palm, angled forwards and in
  const t1 = new THREE.Group(); t1.position.set(0.038, -0.008, 0.035); t1.rotation.set(0.25, 0.75, 0.35); W.add(t1);
  const ts1 = new THREE.Mesh(cap(0.011, 0.026), skin); ts1.rotation.x = Math.PI / 2; ts1.position.z = 0.022; t1.add(ts1);
  const t2 = new THREE.Group(); t2.position.z = 0.044; t1.add(t2);
  const ts2 = new THREE.Mesh(cap(0.0102, 0.018), skin); ts2.rotation.x = Math.PI / 2; ts2.position.z = 0.016; t2.add(ts2);
  HAND.thumb = {t1, t2};
  // the wrist, the cuff, the sleeve going back (it leaves the view at the lower right)
  const wr = new THREE.Mesh(cap(0.026, 0.03), skin); wr.rotation.x = Math.PI / 2; wr.scale.set(1.2, 0.85, 1); wr.position.z = 0.0; W.add(wr);
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.039, 0.04, 0.05, 20, 1, true), cuffM); cuff.rotation.x = Math.PI / 2; cuff.scale.set(1.12, 0.92, 1); cuff.position.z = -0.03; W.add(cuff);
  const sg = new THREE.CylinderGeometry(0.045, 0.037, 1, 20, 1, true); sg.rotateX(Math.PI / 2); sg.translate(0, 0, 0.5);
  const slv = new THREE.Mesh(sg, sleeveM); slv.position.z = -0.05; W.add(slv); HAND.sleeve = slv;
  R.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.renderOrder = 4; } });
  R.visible = false;
}
build();
export function addHand(scene) { scene.add(R); }

// ---------------------------------------------------------------- where the pointer is on the table
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let pointer = null, lastMove = -9;
canvas.addEventListener('pointermove', (e) => { const r = canvas.getBoundingClientRect(); pointer = [(e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1]; lastMove = performance.now(); });
canvas.addEventListener('pointerleave', () => { pointer = null; });
function table() { return VIEW.mode === 'seat' ? {x: RT.x, y: RT.y, z: RT.z, w: RT.w, d: RT.d} : {x: WT.x, y: WT.y, z: WT.z, w: WT.w, d: WT.d}; }
function pointerOnTable() {
  const t = table(); if (!pointer) return null;
  ndc.set(pointer[0], pointer[1]); ray.setFromCamera(ndc, camera); plane.constant = -t.y;
  const p = ray.ray.intersectPlane(plane, new THREE.Vector3()); if (!p) return null;
  p.x = clamp(p.x, t.x - t.w / 2 + 0.05, t.x + t.w / 2 - 0.05); p.z = clamp(p.z, t.z - t.d / 2 + 0.03, t.z + t.d / 2 - 0.02);
  return p;
}
/** a resting place: on the near edge of the table, right of centre */
function restPoint() {
  const t = table();
  if (VIEW.mode === 'seat') return new THREE.Vector3(t.x - t.w / 2 + 0.32, t.y, t.z + 0.22);
  return new THREE.Vector3(t.x + 0.42, t.y, t.z + t.d / 2 - 0.16);
}

// ---------------------------------------------------------------- scripted moves
const wait = (s) => new Promise(r => setTimeout(r, s * 1000));
/** move the fingertips to a world point (above it by `lift`), resolves on arrival */
export function reach(p, {dur = 0.45, lift = 0.03, curl = 0.35} = {}) {
  const to = p.clone(); to.y += lift; HAND.curlWant = curl;
  if (reducedMotion()) dur = 0.05;
  return new Promise(res => { HAND.script = {from: HAND.T.clone(), to, t: 0, dur, res}; R.visible = true; });
}
/** press down (flat palm) and come back up */
export async function press(depth = 0.025) {
  HAND.flat = 1; HAND.curlWant = 0.05;
  const p = HAND.want.clone(); await reach(p.clone().add(new THREE.Vector3(0, -depth, 0)), {dur: 0.12, lift: 0, curl: 0.05});
  await wait(0.08); await reach(p, {dur: 0.16, lift: 0, curl: 0.15}); HAND.flat = 0;
}
export function pinch(on = true) { HAND.curlWant = on ? 0.75 : 0.3; }
/** give the hand back to the pointer */
export function rest() { HAND.script = null; HAND.carry = null; HAND.curlWant = 0.25; HAND.flat = 0; }
/** hold a carried object from above (the hand follows it) */
export function carry(obj) { HAND.carry = obj; HAND.curlWant = obj ? 0.7 : 0.25; }
export const handPos = () => HAND.wrist.getWorldPosition(new THREE.Vector3());
export const tipPos = () => HAND.T.clone();

// ---------------------------------------------------------------- every frame
const _f = new THREE.Vector3(), _s = new THREE.Vector3(), _r = new THREE.Vector3(), _d = new THREE.Vector3();
let shown = 0;
onUpdate((dt) => {
  const look = (VIEW.mode === 'stand' || VIEW.mode === 'seat') && document.body.dataset.place !== 'wall' && !modalOpen() && (!VIEW.handsOk || VIEW.handsOk());
  const active = HAND.script || HAND.carry || (look && pointer && performance.now() - lastMove < 9000 && !document.body.classList.contains('looking'));
  // where the fingertips should be
  if (HAND.script) {
    const S = HAND.script; S.t += dt; const k = Math.min(1, S.t / S.dur), e = k * k * (3 - 2 * k);
    HAND.want.lerpVectors(S.from, S.to, e); if (k >= 1 && S.res) { const r = S.res; S.res = null; r(); }
  } else if (HAND.carry) {
    HAND.carry.getWorldPosition(HAND.want); HAND.want.y += 0.045;
  } else if (look) {
    const p = active ? pointerOnTable() : null;
    HAND.want.copy(p ? p.add(new THREE.Vector3(0, document.getElementById('gl').classList.contains('can-grab') ? 0.035 : 0.06, 0)) : restPoint().add(new THREE.Vector3(0, 0.05, 0)));
  }
  const vis = !!(HAND.script || HAND.carry || look);
  shown += ((vis ? 1 : 0) - shown) * (1 - Math.exp(-10 * dt)); R.visible = shown > 0.05 && vis;
  if (!R.visible) { HAND.T.copy(HAND.want); return; }
  HAND.T.lerp(HAND.want, HAND.script ? 1 : 1 - Math.exp(-16 * dt));
  // the forearm comes from the lower right of the view
  camera.getWorldDirection(_f); _r.crossVectors(_f, camera.up).normalize();
  _s.copy(camera.position).addScaledVector(_r, 0.3).add(new THREE.Vector3(0, -0.5, 0)).addScaledVector(_f, -0.05);
  _d.copy(HAND.T).sub(_s); _d.y *= 0.55; _d.normalize();               // the hand points along the arm, flatter than the arm
  // the fingertips are at T: the wrist sits back along the hand's direction
  const W = HAND.wrist, back = 0.15;
  R.position.copy(HAND.T).addScaledVector(_d, -back); R.position.y += 0.018;
  W.position.set(0, 0, 0);
  R.updateMatrixWorld(); const tgt = R.position.clone().add(_d); R.lookAt(tgt);
  R.rotateZ(-0.35 + HAND.flat * 0.3);                                    // a right hand rolls a little outwards
  R.updateMatrixWorld(true);
  const sl = HAND.sleeve, sp = sl.getWorldPosition(new THREE.Vector3()), far = _s.clone().addScaledVector(_r, 0.05).add(new THREE.Vector3(0, -0.15, 0));
  sl.scale.set(1, 1, 1); sl.lookAt(far); sl.scale.z = Math.min(0.3, sp.distanceTo(far));
  // fingers
  HAND.curl += (HAND.curlWant - HAND.curl) * (1 - Math.exp(-12 * dt));
  const c = HAND.curl;
  HAND.fingers.forEach((f, i) => { f.k1.rotation.x = 0.15 + c * (0.9 + i * 0.08); f.k2.rotation.x = 0.1 + c * 1.1; f.k1.rotation.y = -f.x * (1 - c) * 2.2; });
  HAND.thumb.t1.rotation.set(0.25 + c * 0.3, 0.75 - c * 0.45, 0.35); HAND.thumb.t2.rotation.x = 0.2 + c * 0.6;
});
