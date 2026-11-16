// Proper mesh simplification (meshoptimizer) for heavy downloaded models. Needs, in some folder: npm i @gltf-transform/core@4 @gltf-transform/functions@4 @gltf-transform/extensions@4 meshoptimizer@0.21
// node simplify.mjs <in.gltf> <out.gltf> <ratio> [error]
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {weld, simplify, dedup, prune} from '@gltf-transform/functions';
import {MeshoptSimplifier} from 'meshoptimizer';
const [, , src, dst, ratio = '0.2', error = '0.002'] = process.argv;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(src);
const count = () => doc.getRoot().listMeshes().reduce((s, m) => s + m.listPrimitives().reduce((a, p) => a + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3, 0), 0);
const before = count();
await MeshoptSimplifier.ready;
await doc.transform(dedup(), weld(), simplify({simplifier: MeshoptSimplifier, ratio: +ratio, error: +error}), prune());
console.log('tris', Math.round(before), '->', Math.round(count()));
await io.write(dst, doc);
