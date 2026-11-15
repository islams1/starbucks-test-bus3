// Store set for the video call with Hana (rendered into the call window via scissor viewport).
import * as THREE from 'three';
import {renderer, onOverlay, scene as mainScene} from '../core/engine.js';
import {model} from '../core/assets.js';
import {pbr, M, canvasTex} from './materials.js';
import * as P from './props.js';

export const cafe = {scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(38, 16 / 9, 0.05, 50), on: false, hana: null};
const S = cafe.scene;

export async function buildCafe(envMap) {
  S.environment = envMap; S.environmentIntensity = 0.25;
  S.background = new THREE.Color(0x1a1410);
  const brick = pbr('brick_wall_005', [1, 1], {color: 0xd8c8bc});
  const wall = P.box(S, 10, 4, 0.1, brick, 0, 0, -1.65);
  P.floorPlane(S, 10, 8, pbr('wood_floor_deck', [0.5, 0.5], {color: 0x8f8279, roughness: 0.8}), 0, 0);
  // demo cafe props: bar stools in front of the counter, cakes on the counter, industrial pendants
  const put = async (n, x, y, z, ry = 0, s = 1) => { const o = await model(n); o.position.set(x, y, z); o.rotation.y = ry; o.scale.setScalar(s); S.add(o); return o; };
  await Promise.all([put('bar_chair_round_01', -0.9, 0, 1.15, 0.4), put('bar_chair_round_01', 1.2, 0, 1.2, -0.3), put('carrot_cake', 1.0, 1.04, 0.5), put('strawberry_chocolate_cake', 1.45, 1.04, 0.6), put('tea_set_01', -1.75, 0.94, -1.25, 0.6)]);
  const lampP = await model('hanging_industrial_lamp'); const lb = new THREE.Box3().setFromObject(lampP);
  for (const x of [-1.4, 0.6, 2.2]) { const o = lampP.clone(true); o.scale.setScalar(0.75); o.position.set(x, 3.0 - lb.max.y * 0.75, 0.2); S.add(o); }
  // back counter, shelves, espresso machine, pick-up shelf with mobile orders
  P.box(S, 4.5, 0.9, 0.55, M.walnut, 0, 0, -1.25); P.box(S, 4.6, 0.04, 0.6, M.concrete, 0, 0.9, -1.25);
  for (const y of [1.5, 1.9]) P.box(S, 2.4, 0.03, 0.25, M.oak, -1.2, y, -1.45);
  const em = P.group(S, 0.9, 0.94, -1.25); P.rbox(em, 0.8, 0.45, 0.5, 0.03, M.steel, 0, 0, 0);
  for (let i = 0; i < 7; i++) P.redCup(S, -1.9 + i * 0.22, 1.53, -1.45);
  const menu = canvasTex(1024, 420, (g, W, H) => { g.fillStyle = '#16201b'; g.fillRect(0, 0, W, H); g.strokeStyle = '#d8d0bd'; g.lineWidth = 5; g.strokeRect(12, 12, W - 24, H - 24); g.fillStyle = '#e9e2cf'; g.font = '600 46px "IBM Plex Sans Arabic"'; g.textAlign = 'right'; g.fillText('قائمة الأعياد', W - 50, 85); g.font = '32px "IBM Plex Sans Arabic"'; ['قهوة اليوم', 'لاتيه', 'كابتشينو', 'إسبريسو'].forEach((t, i) => { g.fillText(t, W - 50, 160 + i * 60); g.fillText(['1.65', '3.25', '3.15', '1.95'][i] + ' $', 200, 160 + i * 60); }); });
  const mm = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.82), new THREE.MeshStandardMaterial({map: menu, roughness: 0.7, emissive: 0xffffff, emissiveMap: menu, emissiveIntensity: 0.15})); mm.position.set(1.1, 2.2, -1.58); S.add(mm);
  // front counter (Hana stands behind it)
  P.box(S, 3.6, 1.0, 0.6, pbr('wood_floor_deck', [2.2, 0.35], {color: 0x8a6b52}), 0.2, 0, 0.55); P.box(S, 3.7, 0.05, 0.7, new THREE.MeshStandardMaterial({color: 0xe9e6df, roughness: 0.18}), 0.2, 1.0, 0.55);
  // pick-up shelf crowded with orders
  const shelf = P.group(S, -1.2, 1.04, 0.5);
  for (let i = 0; i < 9; i++) P.redCup(shelf, -0.5 + (i % 5) * 0.2, 0, -0.1 + Math.floor(i / 5) * 0.16);
  // warm pendants
  for (const x of [-1.4, 0.6, 2.2]) { const l = new THREE.PointLight(0xff9a45, 6, 6, 1.6); l.position.set(x, 2.3, 0.2); S.add(l); }
  const neon = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.04, 0.04), new THREE.MeshStandardMaterial({color: 0x330000, emissive: 0xff2414, emissiveIntensity: 4})); neon.position.set(-1.2, 2.25, -1.55); S.add(neon);
  const rl = new THREE.PointLight(0xff3020, 1.6, 3, 1.8); rl.position.set(-1.2, 2.1, -1.2); S.add(rl);
  const key = new THREE.DirectionalLight(0xfff0e0, 1.1); key.position.set(-1.5, 2.5, 3); S.add(key); const rim = new THREE.PointLight(0xffd2a0, 3, 4); rim.position.set(1.2, 2.0, -0.9); S.add(rim);
  S.add(new THREE.HemisphereLight(0xffe2c4, 0x2a1d14, 0.35));
  cafe.camera.position.set(0.1, 1.52, 1.25); cafe.camera.lookAt(0.0, 1.45, -0.3);
}
export function attachHana(ch) {
  cafe.hana = ch;
  mainScene.remove(ch.holder); S.add(ch.holder);
  ch.place(0.0, -0.35, 0, 0); ch.holder.visible = false;
}
let start = 0;
onOverlay(() => {
  if (!cafe.on) return;
  const el = document.getElementById('vcview'); const r = el.getBoundingClientRect();
  if (r.width < 2) return;
  const x = r.left, y = innerHeight - r.bottom, w = r.width, h = r.height;
  cafe.camera.aspect = w / h; cafe.camera.updateProjectionMatrix();
  // gentle handheld phone-camera motion
  const t = performance.now() / 1000;
  cafe.camera.position.x = 0.1 + Math.sin(t * 0.6) * 0.01; cafe.camera.position.y = 1.52 + Math.sin(t * 0.9) * 0.006;
  renderer.setScissorTest(true); renderer.setScissor(x, y, w, h); renderer.setViewport(x, y, w, h);
  renderer.autoClear = true;
  renderer.render(S, cafe.camera);
  renderer.setScissorTest(false); renderer.setViewport(0, 0, innerWidth, innerHeight);
  const s = Math.floor((performance.now() - start) / 1000); document.getElementById('vctime').textContent = `00:${String(s).padStart(2, '0')}`;
});
export function callOn(on) { cafe.on = on; document.getElementById('toasts').style.visibility = on ? 'hidden' : ''; start = performance.now(); document.getElementById('vcall').classList.toggle('hidden', !on); if (cafe.hana) cafe.hana.holder.visible = on; }
