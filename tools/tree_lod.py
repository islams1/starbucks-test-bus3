"""Make a lighter level-of-detail copy of a Poly Haven tree glTF (leaf clusters / twigs kept at a fraction,
kept leaf clusters grown so the crown stays full). Textures are shared with the source (same folder).
Usage (from the repo root):
  python -I tools/tree_lod.py assets/models/island_tree_02/island_tree_02.gltf island_tree_02_lod1 0.1 0.12
  args: <source.gltf> <output name> <leaf keep fraction> [<twig keep fraction>] [--inplace-backup]
"""
import json, os, sys
import numpy as np

src, out_name = sys.argv[1], sys.argv[2]
ALL = '--all' in sys.argv; sys.argv = [a for a in sys.argv if a != '--all']
keep_frac = float(sys.argv[3]); branch_frac = float(sys.argv[4]) if len(sys.argv) > 4 else 1.0
d = os.path.dirname(src); name = os.path.splitext(os.path.basename(src))[0]
g = json.load(open(src, encoding='utf8'))
binb = open(os.path.join(d, g['buffers'][0]['uri']), 'rb').read()
CT = {5126: np.float32, 5125: np.uint32, 5123: np.uint16, 5121: np.uint8}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}


def read(ai):
    a = g['accessors'][ai]; bv = g['bufferViews'][a['bufferView']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    n = NC[a['type']]; dt = CT[a['componentType']]
    arr = np.frombuffer(binb, dtype=dt, count=a['count'] * n, offset=off)
    return arr.reshape(-1, n) if n > 1 else arr


def components(tri, nverts):
    """connected components of a triangle mesh (vectorised union-find by repeated min-label propagation)"""
    lab = np.arange(nverts)
    e = np.concatenate([tri[:, [0, 1]], tri[:, [1, 2]], tri[:, [2, 0]]])
    while True:
        m = np.minimum(lab[e[:, 0]], lab[e[:, 1]])
        new = lab.copy(); np.minimum.at(new, e[:, 0], m); np.minimum.at(new, e[:, 1], m)
        new = new[new]
        if np.array_equal(new, lab): return lab
        lab = new


out_bin = bytearray(); new_views = []; new_acc = []
def push(arr, target=None, minmax=False, atype='VEC3', ctype=5126):
    while len(out_bin) % 4: out_bin.append(0)
    off = len(out_bin); raw = np.ascontiguousarray(arr).tobytes(); out_bin.extend(raw)
    bv = {'buffer': 0, 'byteOffset': off, 'byteLength': len(raw)}
    if target: bv['target'] = target
    new_views.append(bv)
    acc = {'bufferView': len(new_views) - 1, 'componentType': ctype, 'count': int(arr.shape[0]), 'type': atype}
    if minmax: acc['min'] = arr.min(0).tolist(); acc['max'] = arr.max(0).tolist()
    new_acc.append(acc); return len(new_acc) - 1

rng = np.random.default_rng(11)
for mesh in g['meshes']:
    for p in mesh['primitives']:
        mat = g['materials'][p['material']]['name']
        idx = read(p['indices']).astype(np.int64); tri = idx.reshape(-1, 3)
        attrs = {k: read(v).copy() for k, v in p['attributes'].items()}
        nv = attrs['POSITION'].shape[0]
        if ('leaves' in mat or ALL) and keep_frac < 1:
            comp = components(tri, nv); uniq, inv = np.unique(comp, return_inverse=True)
            keep_c = rng.random(len(uniq)) < keep_frac
            pos = attrs['POSITION']; cen = np.zeros((len(uniq), 3)); cnt = np.bincount(inv, minlength=len(uniq))[:, None]
            np.add.at(cen, inv, pos); cen /= np.maximum(cnt, 1)
            s = 1.0 / np.sqrt(keep_frac) * 0.8
            attrs['POSITION'] = (cen[inv] + (pos - cen[inv]) * s).astype(np.float32)
            tri = tri[keep_c[inv][tri[:, 0]]]
            print(mat, 'clusters', len(uniq), 'kept', int(keep_c.sum()))
        if 'branches' in mat and branch_frac < 1:
            comp = components(tri, nv); uniq, inv = np.unique(comp, return_inverse=True)
            keep_c = rng.random(len(uniq)) < branch_frac
            tri = tri[keep_c[inv][tri[:, 0]]]
            print(mat, 'twigs', len(uniq), 'kept', int(keep_c.sum()))
        used = np.unique(tri)
        remap = -np.ones(nv, dtype=np.int64); remap[used] = np.arange(len(used))
        tri2 = remap[tri].astype(np.uint32)
        newattrs = {}
        for k, a in attrs.items():
            sub = a[used].astype(np.float32)
            newattrs[k] = push(sub, 34962, minmax=(k == 'POSITION'), atype={1: 'SCALAR', 2: 'VEC2', 3: 'VEC3', 4: 'VEC4'}[sub.shape[1]])
        p['attributes'] = newattrs
        p['indices'] = push(tri2.reshape(-1), 34963, atype='SCALAR', ctype=5125)
        print(mat, 'tris', len(idx) // 3, '->', len(tri2))

g['accessors'] = new_acc; g['bufferViews'] = new_views
g['buffers'] = [{'uri': out_name + '.bin', 'byteLength': len(out_bin)}]
open(os.path.join(d, out_name + '.bin'), 'wb').write(out_bin)
json.dump(g, open(os.path.join(d, out_name + '.gltf'), 'w', encoding='utf8'))
print('bin', round(len(binb) / 1e6, 1), 'MB ->', round(len(out_bin) / 1e6, 1), 'MB')
