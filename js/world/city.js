// Plaza in front of the HQ + surrounding city blocks.
import * as THREE from 'three';
import {scene, camera, onUpdate} from '../core/engine.js';
import {model, modelPart} from '../core/assets.js';
import {M, canvasTex, addWind} from './materials.js';
import * as P from './props.js';
import {col} from './building.js';
import {onQuality} from '../core/quality.js';
export const trees = [];
import {mergeStatic} from './merge.js';
onQuality((L) => { for (const t of trees) t.traverse(o => { if (o.isMesh) o.castShadow = L.treeShadow && !o.userData.impostor; }); });

const root = new THREE.Group(); root.name = 'city';

function towerMats(seed, hue, cols, floors) {
  // glass curtain wall: map (colour), roughness (glass smooth / spandrel rough), slight emissive for lit offices
  let r = seed * 9973; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  const W = 512, H = 512; const cw = W / cols, fh = H / floors;
  const map = canvasTex(W, H, (g) => {
    g.fillStyle = `hsl(${hue},14%,16%)`; g.fillRect(0, 0, W, H);
    for (let f = 0; f < floors; f++) for (let c = 0; c < cols; c++) {
      const l = 22 + rnd() * 10; g.fillStyle = `hsl(${hue + rnd() * 8 - 4},${16 + rnd() * 8}%,${l}%)`;
      g.fillRect(c * cw + 1.5, f * fh + fh * 0.22, cw - 3, fh * 0.78 - 1.5);
      if (rnd() < 0.12) { g.fillStyle = 'rgba(255,240,215,.22)'; g.fillRect(c * cw + 2, f * fh + fh * 0.25, cw - 4, fh * 0.7); }
    }
    g.fillStyle = `hsl(${hue},6%,${30 + rnd() * 10}%)`; for (let f = 0; f < floors; f++) g.fillRect(0, f * fh, W, fh * 0.2);
  });
  const rough = canvasTex(W, H, (g) => { g.fillStyle = '#111'; g.fillRect(0, 0, W, H); g.fillStyle = '#9a9a9a'; for (let f = 0; f < floors; f++) g.fillRect(0, f * fh, W, fh * 0.2); g.fillStyle = '#777'; for (let c = 0; c <= cols; c++) g.fillRect(c * cw - 1.5, 0, 3, H); }, {srgb: false});
  return {map, rough};
}

export async function buildCity() {
  scene.add(root);
  // ground: plaza pavers in front, herringbone walk, asphalt beyond
  const plane = (w, d, mat, x, z, y = 0) => P.floorPlane(root, w, d, mat, x, z, y);
  plane(600, 600, M.asphalt, 0, 0, -0.02);
  plane(70, 26, M.pavers, 0, 23, 0.0);                 // front plaza z 10..36
  plane(44, 30, M.concrete, 0, -2, -0.01);             // around building
  // kerbs
  // planters with trees (wind)
  const treeSpots = [[-14, 16], [-7, 18], [7, 18], [14, 16], [-24, 22], [24, 22], [-20, 33], [-8, 33], [8, 33], [20, 33], [-30, 37.4], [30, 37.4]];
  // levels of detail: full crown up close, a light crown at mid range, a flat cut-out far away (baked after boot)
  let i = 0;
  for (const [x, z] of treeSpots) {
    P.box(root, 2.6, 0.45, 2.6, M.concrete, x, 0, z);
    const soil = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.02, 2.3), M.soil); soil.position.set(x, 0.45, z); root.add(soil);
    col(x - 1.3, x + 1.3, z - 1.3, z + 1.3);
    const near = await model('island_tree_02', 'island_tree_02_lod0'), mid = await model('island_tree_02', 'island_tree_02_lod1'); i++;
    const bb = new THREE.Box3().setFromObject(near); const h = bb.max.y - bb.min.y;
    const s = (6.5 + (i % 3)) / h;
    // the LOD origin sits in the crown (≈4.2 m up), so detail follows the distance to the leaves, not to the trunk base
    const lift = 4.2 / s;
    const t = new THREE.LOD(); t.scale.setScalar(s); t.position.set(x, 0.45 + 4.2, z); t.rotation.y = i * 1.7; t.userData.lift = lift;
    near.position.y = -lift; mid.position.y = -lift;
    addWind(near, 0.55 / s); addWind(mid, 0.55 / s);
    t.addLevel(near, 0, 0.1); t.addLevel(mid, 10, 0.1);
    root.add(t); trees.push(t);
  }
  // shrubs along the facade
  // (the model file holds four shrubs side by side, ~5 m in all: take one per spot, and give it a body)
  let sh = 0;
  for (let x = -16; x <= 16; x += 4) { if (Math.abs(x) < 10) continue; const s = await modelPart('shrub_02', 'shrub_02_' + 'bdbd'[sh++ % 4], 'shrub_02_lod'); s.position.set(x, 0, 11.2); s.scale.setScalar(1.2); addWind(s, 1.2); root.add(s); col(x - 0.6, x + 0.6, 10.65, 11.75); }
  // benches + lamps
  for (const [x, z] of [[-10.5, 21], [10.5, 21], [-3.5, 27], [3.5, 27]]) {   // concrete + timber benches
    const g = P.group(root, x, 0, z);
    for (const sx of [-0.85, 0.85]) P.box(g, 0.3, 0.42, 0.55, M.concrete, sx, 0, 0);
    for (let i = 0; i < 5; i++) P.box(g, 2.2, 0.035, 0.09, M.walnut, 0, 0.42, -0.22 + i * 0.11);
    col(x - 1.15, x + 1.15, z - 0.35, z + 0.35);
  }
  const lampMat = new THREE.MeshStandardMaterial({color: 0x2f3337, roughness: 0.5, metalness: 0.7});
  for (const x of [-27, -18, -9, 9, 18, 27]) {
    const g = P.group(root, x, 0, 39.3);
    P.cyl(g, 0.07, 0.09, 6.2, lampMat, 0, 0, 0, 12);
    P.box(g, 0.14, 0.12, 1.4, lampMat, 0, 6.1, -0.6);
    const head = P.box(g, 0.28, 0.06, 0.5, new THREE.MeshStandardMaterial({color: 0xffffff, emissive: 0xfff2d8, emissiveIntensity: 0.15}), 0, 6.02, -1.15);
    col(x - 0.15, x + 0.15, 39.15, 39.45);
  }
  const ub = await model('utility_box_01'); ub.position.set(19, 0, 11.5); root.add(ub); { const b = new THREE.Box3().setFromObject(ub); col(b.min.x, b.max.x, b.min.z, b.max.z); }
  // flag poles (wind)
  for (const x of [-5.5, 5.5]) {
    P.cyl(root, 0.05, 0.06, 9, M.steel, x, 0, 13);
    const flagGeo = new THREE.PlaneGeometry(1.8, 1.1, 18, 8);
    const fm = new THREE.MeshStandardMaterial({color: x < 0 ? 0x1f5e47 : 0xf2ece0, side: THREE.DoubleSide, roughness: 0.8});
    fm.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = {value: 0}; fm.userData.sh = sh;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float k = (position.x + 0.9) / 1.8; transformed.z += sin(uTime*5.0 - k*6.0) * 0.12 * k + sin(uTime*7.3 - k*9.0)*0.04*k; transformed.y -= k*k*0.12;`);
    };
    const f = new THREE.Mesh(flagGeo, fm); f.position.set(x + 0.92, 8.3, 13); f.castShadow = true; root.add(f);
    (function tick() { if (fm.userData.sh) fm.userData.sh.uniforms.uTime.value = performance.now() / 1000; requestAnimationFrame(tick); })();
  }
  // surrounding towers (procedural, varied)
  const blocks = [
    [-46, -20, 22, 30, 64], [-44, 18, 18, 20, 38], [64, -18, 24, 28, 72], [66, 16, 18, 22, 44], [0, -48, 60, 24, 58],
    [-40, 100, 30, 22, 52], [0, 104, 26, 20, 34], [40, 100, 28, 22, 80], [-80, 30, 30, 30, 90], [82, 20, 30, 34, 66], [-70, -60, 40, 30, 110], [70, -64, 34, 30, 96],
  ];
  blocks.forEach(([x, z, w, d, h], k) => {
    const hue = [205, 200, 190, 210, 30, 215][k % 6];
    const {map, rough} = towerMats(k + 3, hue, 8, 8);
    for (const t of [map, rough]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(Math.max(1, Math.round(w / 12)), Math.max(1, Math.round(h / 32))); }
    const mat = new THREE.MeshStandardMaterial({map, roughnessMap: rough, roughness: 1, metalness: 0.85, envMapIntensity: 1.25, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.02});
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, h / 2, z); m.castShadow = true; m.receiveShadow = true; root.add(m);
    P.box(root, w + 0.6, 1.2, d + 0.6, M.roof, x, h, z);
    P.box(root, w + 0.4, 4.6, d + 0.4, M.facade, x, 0, z);   // podium
    if (k % 3 === 0) P.box(root, w * 0.4, 3, d * 0.4, M.darkAlu, x, h + 1.2, z);   // rooftop plant
  });
  console.info('city merge', mergeStatic(root, {cell: 40}));
  // world bounds for the player
  col(-36, -35, -30, 41); col(35, 36, -30, 41); col(-36, 36, 39.75, 40.1); col(-36, 36, -30, -29);
  return root;
}

/** Far trees: render the mid-detail tree once into a texture and show it as a camera-facing cut-out (4 triangles). */
export function bakeTreeImpostors(renderer) {
  if (!trees.length) return;
  const src = trees[0].levels[1].object.clone(true);
  src.position.set(0, 0, 0); src.rotation.set(0, 0, 0); src.scale.setScalar(1); src.updateMatrixWorld(true);   // (the level's crown offset is reset here: baked at model origin)
  const box = new THREE.Box3().setFromObject(src), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const W = Math.max(size.x, size.z) * 1.04, H = size.y * 1.04;
  const rh = 512, rw = Math.round(rh * W / H);
  const rt = new THREE.WebGLRenderTarget(rw, rh, {type: THREE.HalfFloatType, samples: 4});
  rt.texture.generateMipmaps = true; rt.texture.minFilter = THREE.LinearMipmapLinearFilter;
  const sc = new THREE.Scene(); sc.environment = scene.environment; sc.add(src);
  sc.add(new THREE.HemisphereLight(0xe8d6bd, 0x6a5440, 0.9));
  const key = new THREE.DirectionalLight(0xfff0dc, 2.6); key.position.set(0.5, 0.9, 0.7); sc.add(key);
  const cam = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, 0.1, size.z * 4 + 10);
  cam.position.set(c.x, c.y, c.z + size.z * 2 + 2); cam.lookAt(c);
  const prevCol = renderer.getClearColor(new THREE.Color()), prevA = renderer.getClearAlpha(), prevRT = renderer.getRenderTarget(), prevSh = renderer.shadowMap.enabled;
  renderer.shadowMap.enabled = false;
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(sc, cam);
  renderer.setRenderTarget(prevRT); renderer.setClearColor(prevCol, prevA); renderer.shadowMap.enabled = prevSh;
  const geo = new THREE.PlaneGeometry(W, H); geo.translate(0, c.y, 0);
  const mat = new THREE.MeshBasicMaterial({map: rt.texture, alphaTest: 0.35, side: THREE.DoubleSide});
  for (const t of trees) {
    const m = new THREE.Mesh(geo, mat); m.userData.impostor = true; m.castShadow = false; m.receiveShadow = false; m.position.y = -t.userData.lift;
    t.addLevel(m, 50, 0.08);
  }
  // keep each cut-out turned towards the camera (only while it is the level in use)
  // seen from the air (opening flight) a vertical cut-out would show edge-on: keep the 3D crown up there
  let aerial = null;
  onUpdate(() => { const air = camera.position.y > 14; if (air !== aerial) { aerial = air; for (const t of trees) t.levels[2].distance = air ? 1e9 : 50; } });
  onUpdate(() => { for (const t of trees) if (t.getCurrentLevel() === 2) { const im = t.levels[2].object; im.rotation.y = Math.atan2(camera.position.x - t.position.x, camera.position.z - t.position.z) - t.rotation.y; } });
}
