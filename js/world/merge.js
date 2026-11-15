// Merge static meshes by material (and by spatial cell, to keep frustum culling useful).
// Cuts thousands of draw calls to a few hundred without changing how anything looks.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const defaultOBC = THREE.Material.prototype.onBeforeCompile;

export function mergeStatic(root, {cell = 14, exclude = []} = {}) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map(); const victims = [];
  const skip = new Set();
  for (const e of exclude) e.traverse(o => skip.add(o));
  root.traverse(o => {
    if (!o.isMesh || skip.has(o) || o.isSkinnedMesh || o.isInstancedMesh) return;
    const m = o.material;
    if (Array.isArray(m) || m.transparent || m.onBeforeCompile !== defaultOBC || o.renderOrder !== 0 || o.userData.noMerge) return;
    if (o.geometry.morphAttributes && Object.keys(o.geometry.morphAttributes).length) return;
    let vis = true; o.traverseAncestors(a => { if (a.visible === false) vis = false; }); if (!o.visible || !vis) return;
    const p = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
    const key = `${m.uuid}|${o.castShadow ? 1 : 0}${o.receiveShadow ? 1 : 0}|${Math.floor(p.x / cell)},${Math.floor(p.z / cell)}`;
    if (!groups.has(key)) groups.set(key, {mat: m, cast: o.castShadow, recv: o.receiveShadow, list: []});
    groups.get(key).list.push(o);
  });
  let merged = 0, removed = 0;
  const mat4 = new THREE.Matrix4();
  for (const g of groups.values()) {
    if (g.list.length < 2) continue;
    const geos = [];
    for (const o of g.list) {
      const src = o.geometry; const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', src.attributes.position.clone());
      if (src.attributes.normal) geo.setAttribute('normal', src.attributes.normal.clone());
      geo.setAttribute('uv', src.attributes.uv ? src.attributes.uv.clone() : new THREE.BufferAttribute(new Float32Array(src.attributes.position.count * 2), 2));
      if (src.index) geo.setIndex(src.index.clone()); else geo.setIndex([...Array(src.attributes.position.count).keys()]);
      if (!geo.attributes.normal) geo.computeVertexNormals();
      // normalise attribute formats (glTF may use normalized/int types)
      for (const k of ['position', 'normal', 'uv']) { const a = geo.attributes[k]; if (!(a.array instanceof Float32Array) || a.normalized || a.isInterleavedBufferAttribute) { const f = new Float32Array(a.count * a.itemSize); for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) f[i * a.itemSize + c] = a.getComponent ? a.getComponent(i, c) : [a.getX(i), a.getY(i), a.getZ(i), a.getW(i)][c]; geo.setAttribute(k, new THREE.BufferAttribute(f, a.itemSize)); } }
      geo.applyMatrix4(mat4.multiplyMatrices(inv, o.matrixWorld));
      geos.push(geo);
    }
    const mg = mergeGeometries(geos, false);
    geos.forEach(x => x.dispose());
    if (!mg) continue;
    const mesh = new THREE.Mesh(mg, g.mat); mesh.castShadow = g.cast; mesh.receiveShadow = g.recv; mesh.name = 'merged';
    root.add(mesh); merged++;
    for (const o of g.list) { o.parent.remove(o); removed++; }
  }
  return {merged, removed};
}
