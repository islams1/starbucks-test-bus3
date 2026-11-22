// QA: list the parts of a few models (name, centre, size) to pick single variants
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
export async function run(list) {
  const L = new GLTFLoader(), out = [];
  for (const n of list) {
    const u = n.startsWith('sf:') ? `assets/models_sf/${n.slice(3)}/scene.gltf` : `assets/models/${n}/${n}.gltf`;
    const g = await L.loadAsync(u); g.scene.updateMatrixWorld(true);
    out.push('## ' + n);
    g.scene.traverse(o => { if (o.isMesh) { const b = new T.Box3().setFromObject(o), c = b.getCenter(new T.Vector3()), s = b.getSize(new T.Vector3()); out.push(`  ${o.name} [${[].concat(o.material).map(m => m.name + (m.map ? '+map' : '')).join(',')}] c ${c.x.toFixed(2)} ${c.y.toFixed(2)} ${c.z.toFixed(2)} s ${s.x.toFixed(2)} ${s.y.toFixed(2)} ${s.z.toFixed(2)}`); } });
  }
  return out.join('\n');
}
