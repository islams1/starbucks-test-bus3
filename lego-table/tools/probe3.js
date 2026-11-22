// QA: drop a model into the running scene at (x, y, z) to look at it
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
export async function add(name, x, y, z, ry = 0, s = 1) {
  const g = await new GLTFLoader().loadAsync(`assets/models/${name}/${name}.gltf`);
  g.scene.position.set(x, y, z); g.scene.rotation.y = ry; g.scene.scale.setScalar(s); window.__scene.add(g.scene);
  return 'ok';
}
