// QA: measure models (size, min, meshes, materials) — tools/drive.py <out> probe
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
export async function run(list) {
  const L = new GLTFLoader(), out = [];
  for (const n of list) {
    const u = n.startsWith('sf:') ? `assets/models_sf/${n.slice(3)}/scene.gltf` : n === 'island_tree_02' ? 'assets/models/island_tree_02/island_tree_02_lod1.gltf' : `assets/models/${n}/${n}.gltf`;
    try {
      const g = await L.loadAsync(u); g.scene.updateMatrixWorld(true);
      const b = new T.Box3().setFromObject(g.scene), s = b.getSize(new T.Vector3());
      let meshes = 0; const mats = new Set();
      g.scene.traverse(o => { if (o.isMesh) { meshes++; [].concat(o.material).forEach(m => mats.add(m.name)); } });
      out.push(`${n}: size ${s.x.toFixed(3)} ${s.y.toFixed(3)} ${s.z.toFixed(3)} | min ${b.min.x.toFixed(2)} ${b.min.y.toFixed(2)} ${b.min.z.toFixed(2)} | meshes ${meshes} | ${[...mats].join(',').slice(0, 140)}`);
    } catch (e) { out.push(n + ' ERR ' + e.message); }
  }
  return out.join('\n');
}
