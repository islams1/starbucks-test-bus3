// Real equipment models (Sketchfab, CC BY 4.0 — see assets/or_models/CREDITS.json) replacing the simple stand-ins:
// anaesthesia machine, heart-lung machine, IV poles, supply trolley, ceiling surgical lights. Each model is scaled to
// its real size, stood on the floor and turned to face the table; the stand-ins it replaces are hidden.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OR} from './room.js';

const loader = new GLTFLoader();
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
async function load(slug) {
  const g = await loader.loadAsync(`assets/or_models/${slug}/model.gltf`);
  g.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; for (const m of [].concat(o.material)) if (m) m.envMapIntensity = 0.6; } });
  return g.scene;
}
/** wrap a model: uniform scale so its height = h (or its largest side = size), centred on x/z, resting on y = 0 */
function fit(obj, {height = null, size = null, keep = null, dropFlat = false} = {}) {
  if (keep) obj.traverse(o => { if (o.isMesh && !keep.test(o.name)) o.visible = false; });
  if (dropFlat) { obj.updateMatrixWorld(true); obj.traverse(o => { if (!o.isMesh) return; const s = new THREE.Box3().setFromObject(o).getSize(V()); if (s.y < 0.02 * Math.max(s.x, s.z)) o.visible = false; }); }   // a floor plane that came with the model
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3(); obj.traverse(o => { if (o.isMesh && o.visible) box.expandByObject(o); });
  const s = box.getSize(V()), k = height ? height / s.y : size / Math.max(s.x, s.y, s.z);
  const w = new THREE.Group(); w.add(obj);
  obj.scale.multiplyScalar(k); obj.updateMatrixWorld(true);
  const b2 = new THREE.Box3(); obj.traverse(o => { if (o.isMesh && o.visible) b2.expandByObject(o); });
  const c = b2.getCenter(V());
  obj.position.sub(V(c.x, b2.min.y, c.z));
  w.userData.size = b2.getSize(V());
  return w;
}
const hideStandIns = (g, keep = []) => { for (const ch of [...g.children]) if (!keep.includes(ch)) ch.visible = false; };

export async function buildProps() {
  const [anaes, hlm, iv, cart, lamps, trolley, trolley2, surgeon] = await Promise.all(['anesthesia', 'heartlung', 'ivpole', 'cart', 'optable', 'trolley', 'trolley', 'surgeon'].map(s => load(s).catch(e => { console.warn('model', s, e); return null; })));
  if (anaes) {
    const m = fit(anaes, {height: 1.5}); OR.A.add(m); m.rotation.y = 0;
    hideStandIns(OR.A, [m, OR.monA && OR.monA.group]);
    if (OR.monA) OR.monA.group.visible = false;          // the machine has its own screen; the live vitals are on the big wall monitor
    OR.anaesModel = m;
  }
  if (hlm) { const m = fit(hlm, {height: 1.8}); OR.P.add(m); m.rotation.y = 0; hideStandIns(OR.P, [m]); OR.hlmModel = m; }
  if (iv) { const m = fit(iv, {height: 2.05}); OR.iv.add(m); m.rotation.y = Math.PI / 2; hideStandIns(OR.iv, [m]); }
  if (cart) { const m = fit(cart, {height: 0.95}); m.position.set(2.75, 0, -2.6); m.rotation.y = -Math.PI / 2; OR.root.add(m); }
  if (lamps) {
    // the dual surgical light on its ceiling mount (only the lamp part of the model; the table and robot are left out)
    const m = fit(lamps, {height: 1.15, keep: /LAmp/}); m.position.set(-0.35, 3.0 - 1.15, -0.05); OR.root.add(m); OR.lampModel = m;
    for (const L of OR.lights || []) L.head.visible = false;
  }
  // steel instrument tables: the back table behind the scrub nurse, a small one beside the surgeon (instruments come from it)
  if (trolley) {
    for (const o of OR.standIns || []) o.visible = false;
    const m = fit(trolley, {height: 0.92, dropFlat: true}); m.position.set(0.62, 0, -1.08); m.rotation.y = 0; OR.root.add(m);
  }
  if (trolley2) { const m = fit(trolley2, {height: 0.92, dropFlat: true}); m.scale.multiplyScalar(0.75); m.position.set(0.7, 0, 0.78); m.rotation.y = Math.PI / 2; OR.root.add(m); OR.mayo.set(0.7, 0.95, 0.7); }
  // the assistant surgeon across the table (a scanned person, standing still)
  if (surgeon) { const m = fit(surgeon, {height: 1.78}); m.position.set(CHEST_X - 0.2, 0, -0.62); m.rotation.y = 0; OR.root.add(m); OR.assistant = m; }
  return true;
}
const CHEST_X = -0.45;
