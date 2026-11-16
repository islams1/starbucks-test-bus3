// Per-mesh simplification (meshoptimizer), e.g. for tools/build_thorax.py output. Needs the same npm packages as tools/gltf_simplify.mjs.
// node gltf_simplify_parts.mjs in.glb out.glb '{"ribs_":0.18,"ita_":0.25,"cartilage_":0.45,"lung_":0.4}'  (mesh-name prefix → ratio; others untouched)
import {NodeIO} from '@gltf-transform/core';
import {weld, simplifyPrimitive} from '@gltf-transform/functions';
import {MeshoptSimplifier} from 'meshoptimizer';
const [, , src, dst, map] = process.argv; const R = JSON.parse(map);
const io = new NodeIO(); const doc = await io.read(src); await MeshoptSimplifier.ready;
for (const m of doc.getRoot().listMeshes()) {
  const k = Object.keys(R).find(p => m.getName().startsWith(p)); if (!k) continue;
  for (const p of m.listPrimitives()) {
    const before = p.getIndices().getCount() / 3;
    simplifyPrimitive(p, {simplifier: MeshoptSimplifier, ratio: R[k], error: 0.004, lockBorder: true});
    console.log(m.getName(), before, '->', p.getIndices().getCount() / 3);
  }
}
await io.write(dst, doc);
