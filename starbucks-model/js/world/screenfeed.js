// The replay on the hanging screen: a camera in the café renders into a texture every frame (or every other frame on
// lighter devices) with the café's own light; the screen in the room shows it. Shots move smoothly from one framing
// to the next, like a director cutting a recorded day. A strip at the bottom says what is being replayed.
import * as THREE from 'three';
import {renderer, scene, camera, onBeforeRender, onUpdate} from '../core/engine.js';
import {quality, onQuality} from '../core/quality.js';
import {applyWorld, worldOf} from './lighting.js';
import {hangScreen} from './room.js';
import {toWorld, MQ} from './maquette.js';
import {canvasTex} from './materials.js';

const EN = new URLSearchParams(location.search).get('lang') === 'en';
export const FEED = {on: false, shot: null, every: 1, n: 0, label: ''};
const cam = new THREE.PerspectiveCamera(46, 16 / 9, 0.05, 120);
let rt = null, strip = null, stripTex = null;
// framings in the café frame: [eye, look, fov]
export const SHOTS = {
  wide: [[1.6, 2.65, 3.45], [-0.8, 0.95, -1.3], 56],          // from the corner by the window: counter, line, pickup
  counter: [[1.5, 1.55, 3.05], [-0.6, 1.15, -1.4], 60],       // eye level
  line: [[0.35, 1.6, 3.55], [3.9, 1.2, 1.0], 58],              // the register, the line and the door
  pickup: [[-1.7, 1.75, 1.3], [-3.4, 1.05, -1.1], 50],
  rail: [[0.2, 1.75, 0.2], [-0.6, 1.4, -1.55], 48],
  front: [[-1.2, 2.2, 10.5], [-0.4, 1.0, 4.3], 52],            // from across the street: the shop and the sidewalk
};
const cur = {eye: new THREE.Vector3(), look: new THREE.Vector3(), fov: 50}, want = {eye: new THREE.Vector3(), look: new THREE.Vector3(), fov: 50};
/** where the replay's camera is now (stepping into the screen lands the player there) */
export const feedPose = () => ({eye: cur.eye.clone(), look: cur.look.clone(), fov: cur.fov});
/** frame the replay: a named shot (smooth move, or a cut) */
export function feedShot(name, {cut = false} = {}) {
  const s = SHOTS[name]; if (!s) return; FEED.shot = name;
  want.eye.copy(toWorld(...s[0])); want.look.copy(toWorld(...s[1])); want.fov = s[2];
  if (cut || !FEED.on) { cur.eye.copy(want.eye); cur.look.copy(want.look); cur.fov = want.fov; }
}
/** the screen on/off; label: what is replayed (the strip under the picture) */
export function feedOn(on, label = null) {
  FEED.on = on; if (label != null) setLabel(label);
  hangScreen.setTexture(on ? rt.texture : null); strip.visible = on;
}
export function setLabel(t) {
  FEED.label = t; if (!stripTex) return;
  const c = stripTex.image, g = c.getContext('2d'), W = c.width, H = c.height;
  g.clearRect(0, 0, W, H); g.fillStyle = 'rgba(8,10,12,.72)'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#e8463b'; g.beginPath(); g.arc(EN ? 34 : W - 34, H / 2, 11, 0, 7); g.fill();
  g.fillStyle = '#f2efe6'; g.font = '600 34px "IBM Plex Sans Arabic", Inter'; g.textAlign = EN ? 'left' : 'right'; g.direction = EN ? 'ltr' : 'rtl';
  g.fillText(t, EN ? 60 : W - 60, H / 2 + 12);
  stripTex.needsUpdate = true;
}
export function buildFeed() {
  const size = () => quality.level === 'high' ? [1280, 720] : quality.level === 'cpu' ? [640, 360] : [960, 540];
  const [w, h] = size();
  rt = new THREE.WebGLRenderTarget(w, h, {type: THREE.HalfFloatType, samples: quality.level === 'high' ? 4 : 0});
  onQuality((L, level) => { const [a, b] = size(); if (rt.width !== a) rt.setSize(a, b); FEED.every = level === 'high' ? 1 : level === 'cpu' ? 4 : 2; });
  // the strip under the picture
  stripTex = canvasTex(1024, 72, () => {});
  strip = new THREE.Mesh(new THREE.PlaneGeometry(1, 72 / 1024), new THREE.MeshBasicMaterial({map: stripTex, transparent: true, toneMapped: false, depthWrite: false}));
  const sw = hangScreen.mesh.geometry.parameters.width, sh = hangScreen.mesh.geometry.parameters.height;
  strip.scale.setScalar(sw); strip.position.set(0, -sh / 2 + sw * 72 / 1024 / 2, 0.003); strip.visible = false; hangScreen.group.add(strip);
  setLabel('');
  feedShot('wide', {cut: true});
  onUpdate((dt) => {
    const k = 1 - Math.exp(-1.6 * dt);
    cur.eye.lerp(want.eye, k); cur.look.lerp(want.look, k); cur.fov += (want.fov - cur.fov) * k;
  });
  onBeforeRender(() => {
    if (!FEED.on || camera.position.distanceTo(hangScreen.group.position) > 14 && worldOf(camera.position) === 'cafe') return;
    if (++FEED.n % FEED.every) return;
    cam.position.copy(cur.eye); cam.lookAt(cur.look); if (cam.fov !== cur.fov) { cam.fov = cur.fov; cam.updateProjectionMatrix(); }
    cam.updateMatrixWorld();
    applyWorld('cafe');
    const sm = renderer.shadowMap.needsUpdate; renderer.shadowMap.needsUpdate = true;
    const prev = renderer.getRenderTarget(); renderer.setRenderTarget(rt); renderer.render(scene, cam); renderer.setRenderTarget(prev);
    renderer.shadowMap.needsUpdate = sm;
    applyWorld(worldOf(camera.position));
  });
}
