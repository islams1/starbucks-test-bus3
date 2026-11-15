// First-person hands at the desk: the player's own arms reach (two-bone IK), pick an item up, bring it to the eyes,
// open its cover, and put it back exactly where it was. The laptop opens its lid and boots before showing the dashboard.
import * as THREE from 'three';
import {camera, onUpdate} from '../core/engine.js';
import {tone, sfx} from '../core/audio.js';
import {player} from './player.js';
import {anchors, screens} from '../world/building.js';

const V = () => new THREE.Vector3();
const _a = V(), _b = V(), _c = V(), _d = V(), _n = V(), _p = V(), _t = V();
const _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _id = new THREE.Quaternion();
const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function tween(dur, fn) { return new Promise(res => { let t = 0; const off = onUpdate((dt) => { t += dt; const k = Math.min(1, t / dur); fn(ease(k), k); if (k >= 1) { off(); res(); } }); }); }

/** rotate bone so that its world-space vector `from` points along `to` (weight w) */
function aim(bone, from, to, w) {
  if (from.lengthSq() < 1e-8 || to.lengthSq() < 1e-8) return;
  _q.setFromUnitVectors(from.clone().normalize(), to.clone().normalize());
  if (w < 1) _q.slerpQuaternions(_id, _q, w);
  bone.parent.getWorldQuaternion(_pq);
  const local = _pq.clone().invert().multiply(_q).multiply(_pq);
  bone.quaternion.premultiply(local);
  bone.updateMatrixWorld(true);
}

const arms = {L: null, R: null};
const state = {L: {w: 0, t: V()}, R: {w: 0, t: V()}, active: false, headScale: null};

function bones(ch) {
  const sk = ch.mesh.skeleton, B = (n) => sk.getBoneByName(n);
  for (const s of ['L', 'R']) arms[s] = {up: B(`Bip01_${s}_UpperArm`), fore: B(`Bip01_${s}_Forearm`), hand: B(`Bip01_${s}_Hand`)};
  arms.head = B('Bip01_Head');
}
/** two-bone IK for one arm towards world target t */
function solve(ch, side, t, w) {
  const A = arms[side]; if (!A || w <= 0.001) return;
  A.up.getWorldPosition(_a); A.fore.getWorldPosition(_b); A.hand.getWorldPosition(_c);
  const l1 = _a.distanceTo(_b), l2 = _b.distanceTo(_c);
  _d.subVectors(t, _a); const dist = Math.min(Math.max(_d.length(), 0.05), l1 + l2 - 0.002); const dirT = _d.normalize().clone();
  // pole: elbow points outward and down, a little back
  const other = arms[side === 'R' ? 'L' : 'R'].up.getWorldPosition(V());
  const outward = _a.clone().sub(other).setY(0).normalize();
  const pole = _a.clone().addScaledVector(outward, 0.35).add(new THREE.Vector3(0, -0.45, 0)).sub(_a);
  _n.crossVectors(dirT, pole).normalize();
  const cosA = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist);
  const ang = Math.acos(Math.max(-1, Math.min(1, cosA)));
  const elbowDir = dirT.clone().applyAxisAngle(_n, ang);
  aim(A.up, _b.clone().sub(_a), elbowDir, w);
  A.fore.getWorldPosition(_b); A.hand.getWorldPosition(_c);
  aim(A.fore, _c.clone().sub(_b), t.clone().sub(_b), w);
}

export function initDeskHands(ch) {
  bones(ch);
  ch.postIK = () => {
    if (!state.active) return;
    ch.fbx.updateMatrixWorld(true);
    for (const s of ['L', 'R']) solve(ch, s, state[s].t, state[s].w);
  };
}
/** desk view: show the player's own body (head hidden from the camera), arms resting on the desk */
export function deskBody(on) {
  const ch = player.ch; if (!arms.head) bones(ch);
  state.active = on;
  if (on) { ch.fbx.visible = true; arms.head.scale.setScalar(0.001); }
  else { arms.head.scale.setScalar(1); state.L.w = state.R.w = 0; }
}

// ---------------------------------------------------------------- pick up / put back
const camFwd = () => camera.getWorldDirection(V());
function readPose() {
  const f = camFwd(), up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  return camera.position.clone().addScaledVector(f, 0.42).addScaledVector(up, -0.1);
}
function faceCamera(obj, pos) {
  // object's top (+y) towards the viewer, its far edge up
  const m = new THREE.Matrix4().lookAt(camera.position, pos, new THREE.Vector3(0, 1, 0));
  const q = new THREE.Quaternion().setFromRotationMatrix(m).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
  return q;
}
const busy = {v: false};
/** reach → grab → bring to the eyes → open cover. returns a function that puts it back. */
export async function pick(obj, {open = true} = {}) {
  if (!obj) return async () => {};
  busy.v = true;
  const side = obj.position.z > 4.5 ? 'L' : 'R';
  const H = state[side];
  const home = {p: obj.position.clone(), q: obj.quaternion.clone()};
  const grip = () => obj.getWorldPosition(V()).add(new THREE.Vector3(0.06, 0.05, side === 'L' ? -0.05 : 0.05));
  sfx.paper();
  // 1) reach
  const rest = arms[side].hand.getWorldPosition(V());
  await tween(0.55, (k) => { H.w = k; H.t.lerpVectors(rest, grip(), k); });
  // 2) lift to reading position, turning towards the eyes
  const target = readPose(), q1 = faceCamera(obj, target);
  const p0 = home.p.clone(), q0 = home.q.clone();
  await tween(0.7, (k) => { obj.position.lerpVectors(p0, target, k); obj.quaternion.slerpQuaternions(q0, q1, k); H.t.copy(grip()); });
  // 3) open the cover
  if (open && obj.userData.cover) { sfx.paper(); await tween(0.45, (k) => { obj.userData.cover.rotation.z = Math.PI * 0.92 * k; }); }
  return async () => {
    // close, lower, place, release
    if (open && obj.userData.cover) await tween(0.35, (k) => { obj.userData.cover.rotation.z = Math.PI * 0.92 * (1 - k); });
    const pA = obj.position.clone(), qA = obj.quaternion.clone();
    await tween(0.6, (k) => { obj.position.lerpVectors(pA, home.p, k); obj.quaternion.slerpQuaternions(qA, home.q, k); H.t.copy(grip()); });
    sfx.paper();
    const from = H.t.clone();
    await tween(0.45, (k) => { H.w = 1 - k; H.t.lerpVectors(from, rest, k); });
    busy.v = false;
  };
}

// ---------------------------------------------------------------- laptop: open the lid, power on, boot, desktop
function drawBoot(stage, t) {
  const c = screens.laptopCanvas, g = c.getContext('2d'), W = c.width, H = c.height;
  if (stage === 'black') { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); }
  else if (stage === 'logo') {
    g.fillStyle = '#0d0f10'; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(217,178,111,' + Math.min(1, t * 2) + ')'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(W / 2 - 34, 110); g.lineTo(W / 2 + 34, 110); g.lineTo(W / 2 + 26, 175); g.lineTo(W / 2 - 26, 175); g.closePath(); g.stroke();
    g.beginPath(); g.arc(W / 2 + 40, 140, 14, -1.3, 1.3); g.stroke();
    for (let i = 0; i < 8; i++) { const a = t * 8 + i * Math.PI / 4; g.fillStyle = `rgba(255,255,255,${(i / 8) * 0.9})`; g.beginPath(); g.arc(W / 2 + Math.cos(a) * 16, 240 + Math.sin(a) * 16, 3, 0, 7); g.fill(); }
  } else if (stage === 'desktop') {
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#1f5e47'); gr.addColorStop(1, '#0f2b22'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, H - 26, W, 26);
    for (let i = 0; i < 5; i++) { g.fillStyle = ['#d9b26f', '#7fb59a', '#a9cbff', '#e0705f', '#f1f1f1'][i]; g.fillRect(W / 2 - 70 + i * 30, H - 20, 18, 14); }
    for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(W - 50, 20 + i * 52, 30, 30); }
  } else if (stage === 'dash') {
    const s = Math.min(1, t);
    g.fillStyle = '#1f5e47'; g.fillRect(0, 0, W, H);
    const w = W * (0.6 + 0.4 * s), h = H * (0.6 + 0.4 * s), x = (W - w) / 2, y = (H - h) / 2;
    g.fillStyle = '#f4f6f8'; g.fillRect(x, y, w, h); g.fillStyle = '#1f6f54'; g.fillRect(x, y, w, 30 * s + 4);
    g.fillStyle = '#fff'; g.font = '600 16px Inter'; g.fillText('Store Dashboard — Holiday', x + 12, y + 22);
    const v = ['31%', '9m', '55%', '+4%']; for (let i = 0; i < 4; i++) { g.fillStyle = '#fff'; g.fillRect(x + 12 + i * (w - 24) / 4, y + 44, (w - 24) / 4 - 10, 64); g.fillStyle = i === 1 ? '#c0392b' : '#1d2329'; g.font = '700 24px Inter'; g.fillText(v[i], x + 22 + i * (w - 24) / 4, y + 88); }
    g.strokeStyle = '#c0392b'; g.lineWidth = 3; g.beginPath(); for (let i = 0; i < 6; i++) g.lineTo(x + 40 + i * (w - 80) / 5, y + h - 30 - [5.2, 5.6, 6.1, 6.8, 7.6, 9][i] * 14); g.stroke();
  }
  screens.laptopTex2.needsUpdate = true;
}
export async function openLaptop() {
  const lap = anchors.deskObjs.laptop, lid = lap.userData.lid, scr = lap.userData.screen;
  const H = state.R, rest = arms.R.hand.getWorldPosition(V());
  const lidEdge = () => lid.localToWorld(new THREE.Vector3(0, 0.235, 0.02));
  if (!screens.laptopOn) {
    await tween(0.5, (k) => { H.w = k; H.t.lerpVectors(rest, lidEdge(), k); });
    const a0 = lid.rotation.x;
    await tween(0.9, (k) => { lid.rotation.x = a0 + (-0.32 - a0) * k; H.t.copy(lidEdge()); });
    const from = H.t.clone();
    tween(0.45, (k) => { H.w = 1 - k; H.t.lerpVectors(from, rest, k); });
    // power on → logo + spinner → desktop
    tone([523, 784], {dur: 0.9, gain: 0.03}); tone(1046, {dur: 0.7, gain: 0.02, delay: 0.25});
    drawBoot('black'); await tween(0.35, (k) => { scr.emissiveIntensity = 0.75 * k; });
    await tween(1.6, (k, raw) => drawBoot('logo', raw * 1.6));
    drawBoot('desktop'); await new Promise(r => setTimeout(r, 650));
    screens.laptopOn = true;
  }
  sfx.ui();
  await tween(0.5, (k, raw) => drawBoot('dash', raw));
}
