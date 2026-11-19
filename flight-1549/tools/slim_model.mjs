// Fewer triangles where nobody can see the difference (an error of a fraction of a millimetre to ~1.5 mm at the
// captain's seat), then meshopt-compressed. node slim.mjs <in.gltf> <out.gltf> [error]
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup, prune, weld, simplify, reorder, meshopt} from '@gltf-transform/functions';
import {MeshoptEncoder, MeshoptSimplifier} from 'meshoptimizer';
const [, , src, dst, error = '0.001'] = process.argv;
await Promise.all([MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder': MeshoptEncoder});
const doc = await io.read(src);
const count = () => doc.getRoot().listMeshes().reduce((s, m) => s + m.listPrimitives().reduce((a, p) => a + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3, 0), 0);
const before = count();
await doc.transform(dedup(), weld(), simplify({simplifier: MeshoptSimplifier, ratio: 0, error: +error, lockBorder: true}), prune());
console.log('tris', before, '->', count());
await doc.transform(reorder({encoder: MeshoptEncoder}), meshopt({encoder: MeshoptEncoder, level: 'medium'}));
await io.write(dst, doc);
