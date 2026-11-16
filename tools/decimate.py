"""Lighter copy of a glTF model by vertex clustering (for small props seen at a few metres: lamps, frames, shrubs).
Vertices are snapped to a grid (cell = bbox diagonal / resolution); vertices in the same cell with a similar normal
and UV are merged, degenerate triangles dropped. UV seams and hard edges survive because UV/normal are in the key.
Usage (from the repo root):
  python -I tools/decimate.py assets/models/hanging_industrial_lamp/hanging_industrial_lamp.gltf hanging_industrial_lamp_lod 60
  args: <source.gltf> <output name> <resolution (cells along the diagonal)> [uv precision, default 24]
"""
import json, os, sys
import numpy as np

src, out_name, res = sys.argv[1], sys.argv[2], float(sys.argv[3])
UVQ = float(sys.argv[4]) if len(sys.argv) > 4 else 24      # UV precision in the merge key (raise it to keep texture seams intact)
d = os.path.dirname(src)
g = json.load(open(src, encoding='utf8'))
binb = open(os.path.join(d, g['buffers'][0]['uri']), 'rb').read()
CT = {5126: np.float32, 5125: np.uint32, 5123: np.uint16, 5121: np.uint8, 5122: np.int16, 5120: np.int8}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}


def read(ai):
    a = g['accessors'][ai]; bv = g['bufferViews'][a['bufferView']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    n = NC[a['type']]; dt = np.dtype(CT[a['componentType']])
    stride = bv.get('byteStride', 0)
    if stride and stride != n * dt.itemsize:
        raw = np.frombuffer(binb, dtype=np.uint8, count=stride * (a['count'] - 1) + n * dt.itemsize, offset=off)
        arr = np.stack([np.frombuffer(raw[i * stride:i * stride + n * dt.itemsize].tobytes(), dtype=dt) for i in range(a['count'])])
    else:
        arr = np.frombuffer(binb, dtype=dt, count=a['count'] * n, offset=off).reshape(-1, n)
    arr = arr.astype(np.float32)
    if a.get('normalized'):
        arr /= float(np.iinfo(dt).max)
    return arr if n > 1 else arr[:, 0]


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

tot0 = tot1 = 0
for mesh in g['meshes']:
    for p in mesh['primitives']:
        attrs = {k: read(v) for k, v in p['attributes'].items() if k in ('POSITION', 'NORMAL', 'TEXCOORD_0', 'TANGENT')}
        pos = attrs['POSITION']
        tri = read(p['indices']).astype(np.int64).reshape(-1, 3) if 'indices' in p else np.arange(len(pos)).reshape(-1, 3)
        diag = float(np.linalg.norm(pos.max(0) - pos.min(0))) or 1.0
        cell = diag / res
        key = [np.floor((pos - pos.min(0)) / cell).astype(np.int64)]
        if 'NORMAL' in attrs: key.append(np.round(attrs['NORMAL'] * 2).astype(np.int64))          # ~60° normal buckets
        if 'TEXCOORD_0' in attrs: key.append(np.floor(attrs['TEXCOORD_0'] * UVQ).astype(np.int64))  # keep UV islands apart
        k = np.concatenate(key, 1)
        uniq, inv = np.unique(k, axis=0, return_inverse=True); inv = inv.reshape(-1)
        n = len(uniq); cnt = np.bincount(inv, minlength=n)[:, None]
        newattrs = {}
        for name, a in attrs.items():
            acc = np.zeros((n, a.shape[1]), np.float64); np.add.at(acc, inv, a); acc /= np.maximum(cnt, 1)
            if name == 'NORMAL': acc /= np.maximum(np.linalg.norm(acc, axis=1, keepdims=True), 1e-9)
            newattrs[name] = acc.astype(np.float32)
        t2 = inv[tri]
        ok = (t2[:, 0] != t2[:, 1]) & (t2[:, 1] != t2[:, 2]) & (t2[:, 0] != t2[:, 2])
        t2 = t2[ok]
        t2 = np.unique(np.sort(t2, 1), axis=0, return_index=True)[1]
        t2 = inv[tri][ok][np.sort(t2)]
        used = np.unique(t2); remap = -np.ones(n, np.int64); remap[used] = np.arange(len(used))
        p['attributes'] = {name: push(a[used], 34962, minmax=(name == 'POSITION'), atype={2: 'VEC2', 3: 'VEC3', 4: 'VEC4'}[a.shape[1]]) for name, a in newattrs.items()}
        p['indices'] = push(remap[t2].astype(np.uint32).reshape(-1), 34963, atype='SCALAR', ctype=5125)
        tot0 += len(tri); tot1 += len(t2)
        print(mesh.get('name'), 'tris', len(tri), '->', len(t2))

g['accessors'] = new_acc; g['bufferViews'] = new_views
g['buffers'] = [{'uri': out_name + '.bin', 'byteLength': len(out_bin)}]
for m in g['meshes']:
    for p in m['primitives']: p.pop('targets', None)
open(os.path.join(d, out_name + '.bin'), 'wb').write(out_bin)
json.dump(g, open(os.path.join(d, out_name + '.gltf'), 'w', encoding='utf8'))
print('total tris', tot0, '->', tot1)
