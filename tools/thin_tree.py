"""Thin a Poly Haven tree glTF for web delivery: keep a fraction of leaf clusters (connected components),
scale the kept clusters up slightly to preserve canopy density, compact vertex buffers.
Usage (from game/): python -I tools/thin_tree.py assets/models/island_tree_02/island_tree_02.gltf 0.4
Original files are copied to _src/orig_models/ first.
"""
import json, os, shutil, sys
import numpy as np

path = sys.argv[1]; keep_frac = float(sys.argv[2]) if len(sys.argv) > 2 else 0.4
branch_frac = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
d = os.path.dirname(path); name = os.path.splitext(os.path.basename(path))[0]
bak = os.path.join('_src', 'orig_models', name); os.makedirs(bak, exist_ok=True)
for f in (name + '.gltf', name + '.bin'):
    if not os.path.exists(os.path.join(bak, f)): shutil.copy(os.path.join(d, f), os.path.join(bak, f))
g = json.load(open(os.path.join(bak, name + '.gltf'), encoding='utf8'))
binb = open(os.path.join(bak, name + '.bin'), 'rb').read()
CT = {5126: np.float32, 5125: np.uint32, 5123: np.uint16, 5121: np.uint8}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}


def read(ai):
    a = g['accessors'][ai]; bv = g['bufferViews'][a['bufferView']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    n = NC[a['type']]; dt = CT[a['componentType']]
    arr = np.frombuffer(binb, dtype=dt, count=a['count'] * n, offset=off)
    return arr.reshape(-1, n) if n > 1 else arr


def components(tri, nverts):
    parent = np.arange(nverts)
    def find(x):
        r = x
        while parent[r] != r: r = parent[r]
        while parent[x] != r: parent[x], x = r, parent[x]
        return r
    for a, b, c in tri:
        ra, rb, rc = find(a), find(b), find(c)
        parent[rb] = ra; parent[find(rc)] = ra
    return np.array([find(i) for i in range(nverts)])


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

rng = np.random.default_rng(7)
for mesh in g['meshes']:
    for p in mesh['primitives']:
        mat = g['materials'][p['material']]['name']
        idx = read(p['indices']).astype(np.int64); tri = idx.reshape(-1, 3)
        attrs = {k: read(v).copy() for k, v in p['attributes'].items()}
        nv = attrs['POSITION'].shape[0]
        if 'leaves' in mat:
            comp = components(tri, nv)
            uniq, inv = np.unique(comp, return_inverse=True)
            keep_c = rng.random(len(uniq)) < keep_frac
            keep_v = keep_c[inv]
            # grow kept clusters around their centroid to keep the crown full
            pos = attrs['POSITION']; cen = np.zeros((len(uniq), 3)); cnt = np.bincount(inv, minlength=len(uniq))[:, None]
            np.add.at(cen, inv, pos); cen /= np.maximum(cnt, 1)
            s = 1.0 / np.sqrt(keep_frac) * 0.85
            attrs['POSITION'] = (cen[inv] + (pos - cen[inv]) * s).astype(np.float32)
            tri = tri[keep_v[tri[:, 0]]]
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
        print(mat, 'verts', nv, '->', len(used), 'tris', len(idx) // 3, '->', len(tri2))

g['accessors'] = new_acc; g['bufferViews'] = new_views
g['buffers'] = [{'uri': name + '.bin', 'byteLength': len(out_bin)}]
open(os.path.join(d, name + '.bin'), 'wb').write(out_bin)
json.dump(g, open(os.path.join(d, name + '.gltf'), 'w', encoding='utf8'))
print('bin', len(binb) // 1e6, 'MB ->', len(out_bin) // 1e6, 'MB')
