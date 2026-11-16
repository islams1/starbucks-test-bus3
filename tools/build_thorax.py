"""Build assets/or_models/bp3d_thorax/thorax.glb — the real chest wall and lungs around the game's heart.
Bones (sternum, costal cartilages, ribs 1-8) and the internal thoracic arteries come from BodyParts3D (CC BY 4.0,
(c) The Database Center for Life Science). The sternum is split down the midline like a sternotomy: two halves, each
with its cut face (bone marrow) as a separate mesh. BodyParts3D has no lung surface (only the bronchial and vascular
trees), so each lung is carved from the real thoracic cavity: inside the rib cage, above the diaphragm, outside the
mediastinum and the game's own heart (sampled from the running game into _src/bp3d/game_heart.json with
 tools/drive_or_dump.json: python -I tools/drive.py <out> or_dump "http://127.0.0.1:8777/or.html?mute=1&dev=4" and
 save the second eval's output).
Everything is written in the game frame (metres, head towards -x, anterior +y, patient's left -z) relative to CHEST.
Run from the repo root:  python -I tools/build_thorax.py
then thin the heavy parts (ribs, lungs …) with tools/gltf_simplify_parts.mjs (keep the full build in _src/bp3d).
"""
import collections, json, math, os, re, struct, zipfile
import numpy as np
from scipy import ndimage
from scipy.interpolate import griddata
from skimage import measure

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, '_src', 'bp3d')
ZIP = os.path.join(SRC, 'partof_BP3D_4.0_obj_99.zip')
OUT = os.path.join(ROOT, 'assets', 'or_models', 'bp3d_thorax', 'thorax.glb')
S = 1.22                       # the game's heart is ~1.2x the BodyParts3D one: scale the chest to match
SKIN_GAP = 0.012               # skin + fat over the front of the sternum (m)
ORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth']

rows = [l.rstrip('\n').split('\t') for l in open(os.path.join(SRC, 'partof_element_parts.txt'), encoding='utf8')][1:]
BY = collections.defaultdict(set)
for _fma, name, fj in rows: BY[name].add(fj)
Z = zipfile.ZipFile(ZIP)
INFO = {n.split('/')[-1][:-4]: n for n in Z.namelist()}


def load(names):
    """concept names → one (P [n,3] game axes in mm, I [m,3]) mesh; each element stays a closed shell"""
    P, I = [], []
    for nm in names:
        for fj in sorted(BY[nm]):
            if fj not in INFO: continue
            vs, fs = [], []
            for l in Z.read(INFO[fj]).decode('utf8', 'ignore').splitlines():
                if l.startswith('v '):
                    x, y, z = map(float, l.split()[1:4]); vs.append((-z, -y, -x))   # +X left, +Y posterior, +Z up → game axes
                elif l.startswith('f '):
                    q = [int(t.split('/')[0]) - 1 for t in l.split()[1:]]
                    fs += [(q[0], q[k], q[k + 1]) for k in range(1, len(q) - 1)]
            vs = np.array(vs); fs = np.array(fs)
            u, inv = np.unique(vs.round(3), axis=0, return_inverse=True)       # weld the duplicated vertices (OBJ normals split them)
            fs = inv.reshape(-1)[fs]; fs = fs[(fs[:, 0] != fs[:, 1]) & (fs[:, 1] != fs[:, 2]) & (fs[:, 0] != fs[:, 2])]
            o = sum(len(p) for p in P); P.append(u); I.append(fs + o)
    return np.concatenate(P), np.concatenate(I)


# ---------------------------------------------------------------- placement: level the sternum under the skin
game = json.load(open(os.path.join(SRC, 'game_heart.json')))
CHEST = np.array(game['chest'])
BT = np.array(game['bodyTop']); BTX = np.arange(-0.7, -0.2 + 1e-9, 0.01)[:len(BT)]
skin_mid = lambda xw: np.interp(xw, BTX, BT[:, 10]) - CHEST[1]          # skin height over the midline, relative to CHEST

sternum = load(['manubrium', 'body of sternum', 'xiphoid process'])


def rot(P, a):
    c, s = math.cos(a), math.sin(a); Q = P.copy()
    Q[:, 0] = P[:, 0] * c - P[:, 1] * s; Q[:, 1] = P[:, 0] * s + P[:, 1] * c
    return Q


best = None
for deg in np.arange(-40, 40.01, 0.5):
    a = math.radians(deg); Q = rot(sternum[0], a) * S / 1000.0
    cx = (Q[:, 0].min() + Q[:, 0].max()) / 2
    xs = np.linspace(Q[:, 0].min() + 0.004, Q[:, 0].max() - 0.004, 40)
    front = np.array([Q[np.abs(Q[:, 0] - x) < 0.004, 1].max() for x in xs])
    depth = skin_mid(xs - cx + CHEST[0]) - front                            # skin − bone front, before the vertical offset
    off = depth.min() - SKIN_GAP                                            # lift so the closest point is SKIN_GAP under the skin
    score = (depth - depth.min()).mean()                                    # the bone should follow the skin all the way
    if best is None or score < best[0]: best = (score, a, cx, off)
_, ANG, CX, OFF = best
print(f'sternum: tilt {math.degrees(ANG):.1f} deg, mean extra depth {best[0]*1000:.1f} mm')


def place(P):
    """game axes mm → metres relative to CHEST"""
    Q = rot(P, ANG) * S / 1000.0
    Q[:, 0] -= CX; Q[:, 1] += OFF
    return Q


_sq = place(sternum[0]); _bins = np.linspace(_sq[:, 0].min() - 1e-6, _sq[:, 0].max() + 1e-6, 41)
_front = np.array([_sq[(_sq[:, 0] >= a) & (_sq[:, 0] <= b), 1].max() for a, b in zip(_bins[:-1], _bins[1:])])
def place_sternum(P, k=0.72):
    """the scaled-up sternum is too thick: press it to ~72 % of its depth, keeping its front under the skin"""
    Q = place(P); f = np.interp(Q[:, 0], (_bins[:-1] + _bins[1:]) / 2, _front)
    Q[:, 1] = f - (f - Q[:, 1]) * k
    return Q


# ---------------------------------------------------------------- the sternotomy: two halves and their cut faces
def clip_half(P, I, s):
    f = s * P[:, 2]; NP = list(P); emap = {}; T = []
    def ev(a, b):
        k = (min(a, b), max(a, b))
        if k not in emap:
            t = f[a] / (f[a] - f[b]); p = P[a] + (P[b] - P[a]) * t; p = p.copy(); p[2] = 0.0
            emap[k] = len(NP); NP.append(p)
        return emap[k]
    for a, b, c in I:
        inside = [f[v] >= 0 for v in (a, b, c)]
        if all(inside): T.append((a, b, c)); continue
        if not any(inside): continue
        poly = []
        for u, v in ((a, b), (b, c), (c, a)):
            if f[u] >= 0: poly.append(u)
            if (f[u] >= 0) != (f[v] >= 0): poly.append(ev(u, v))
        T += [(poly[0], poly[k], poly[k + 1]) for k in range(1, len(poly) - 1)]
    NP = np.array(NP); T = np.array(T)
    # the cut outline: boundary edges between plane vertices
    cnt = collections.Counter(tuple(sorted(e)) for t in T for e in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])))
    nxt = {}
    for t in T:
        for u, v in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])):
            if cnt[tuple(sorted((u, v)))] == 1 and abs(NP[u, 2]) < 1e-9 and abs(NP[v, 2]) < 1e-9: nxt[u] = v
    loops, seen = [], set()
    for st in list(nxt):
        if st in seen: continue
        lp, u = [], st
        while u in nxt and u not in seen: seen.add(u); lp.append(u); u = nxt[u]
        if u == st and len(lp) >= 3: loops.append(lp)
    cap = []
    for lp in loops: cap += ear_clip(NP, lp[::-1])
    return NP, T, np.array(cap, dtype=int).reshape(-1, 3), len(loops)


def ear_clip(P, loop):
    pts = [(P[i, 0], P[i, 1]) for i in loop]
    area = sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts)))
    ccw = area > 0; idx = list(range(len(loop))); out = []
    cross = lambda o, a, b: (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    def inside(p, a, b, c):
        d1, d2, d3 = cross(a, b, p), cross(b, c, p), cross(c, a, p)
        return (d1 >= 0 and d2 >= 0 and d3 >= 0) if ccw else (d1 <= 0 and d2 <= 0 and d3 <= 0)
    guard = 0
    while len(idx) > 3 and guard < 100000:
        guard += 1; n = len(idx); made = False
        for k in range(n):
            i0, i1, i2 = idx[(k - 1) % n], idx[k], idx[(k + 1) % n]
            a, b, c = pts[i0], pts[i1], pts[i2]
            cr = cross(a, b, c)
            if (cr <= 0) if ccw else (cr >= 0): continue
            if any(inside(pts[j], a, b, c) for j in idx if j not in (i0, i1, i2)): continue
            out.append((loop[i0], loop[i1], loop[i2])); idx.pop(k); made = True; break
        if not made:                                   # degenerate outline: fan the rest
            out += [(loop[idx[0]], loop[idx[k]], loop[idx[k + 1]]) for k in range(1, len(idx) - 1)]; idx = idx[:3]; break
    if len(idx) == 3: out.append(tuple(loop[i] for i in idx))
    return out


def compact(P, I):
    used = np.unique(I); remap = -np.ones(len(P), dtype=int); remap[used] = np.arange(len(used))
    return P[used], remap[I]


meshes = {}
for side, s in (('R', 1), ('L', -1)):                 # +z = the patient's right
    NP, T, C, nl = clip_half(sternum[0], sternum[1], s)
    meshes[f'sternum_{side}'] = compact(place_sternum(NP), T)
    CP, CI = compact(place_sternum(NP), C)
    # the cut face must look towards the midline (−s z)
    n = np.cross(CP[CI[:, 1]] - CP[CI[:, 0]], CP[CI[:, 2]] - CP[CI[:, 0]])
    if (n[:, 2] * -s).sum() < 0: CI = CI[:, ::-1]
    meshes[f'sternum_cut_{side}'] = (CP, CI)
    print(f'sternum {side}: {len(meshes[f"sternum_{side}"][0])} verts, cut face {len(CI)} tris from {nl} outlines')

for side, w in (('L', 'left'), ('R', 'right')):
    meshes[f'cartilage_{side}'] = (lambda m: (place(m[0]), m[1]))(load([f'{w} {o} costal cartilage' for o in ORD[:7]]))
    meshes[f'ribs_{side}'] = (lambda m: (place(m[0]), m[1]))(load([f'{w} {o} rib' for o in ORD[:8]]))
    meshes[f'ita_{side}'] = (lambda m: (place(m[0]), m[1]))(load([f'{w} internal thoracic artery']))

# ---------------------------------------------------------------- the lungs: carve the thoracic cavity
cage = place(load([f'{w} {o} rib' for w in ('left', 'right') for o in ORD] + [f'{w} {o} costal cartilage' for w in ('left', 'right') for o in ORD[:7]]
                  + ['manubrium', 'body of sternum', 'xiphoid process', 'set of thoracic vertebrae'])[0])
dia = place(load(['diaphragm'])[0])
tree = {k: place(load([f'{w} lung'])[0]) for k, w in (('L', 'left'), ('R', 'right'))}
# the heart may have been moved in heart.js since the dump: shift the sampled surface by the difference
_ho = re.search(r'HEART_OFFSET = V\(([-\d.]+), ([-\d.]+), ([-\d.]+)\)', open(os.path.join(ROOT, 'js', 'or', 'heart.js'), encoding='utf8').read())
HEART_SHIFT = np.array([float(v) for v in _ho.groups()]) - np.array(game.get('heartOffset', [float(v) for v in _ho.groups()]))
print('heart shift since the dump', HEART_SHIFT)
heart = np.array(game['heart']).reshape(-1, 3) + HEART_SHIFT - CHEST

V = 0.003
lo = cage.min(0) - 0.01; hi = cage.max(0) + 0.01
lo[0] = min(lo[0], tree['L'][:, 0].min(), tree['R'][:, 0].min()) - 0.01
hi[0] = max(dia[:, 0].max(), tree['L'][:, 0].max(), tree['R'][:, 0].max()) + 0.01
shape = np.ceil((hi - lo) / V).astype(int) + 1
gx, gy, gz = [lo[k] + np.arange(shape[k]) * V for k in range(3)]
print('grid', shape, 'voxels', int(np.prod(shape)))
cav = np.zeros(shape, bool)
NB = 96
YY, ZZ = np.meshgrid(gy, gz, indexing='ij')
for i, x in enumerate(gx):
    sl = cage[np.abs(cage[:, 0] - x) < 0.012]
    if len(sl) < 50: continue
    yc = (sl[:, 1].min() + sl[:, 1].max()) / 2
    th = np.arctan2(sl[:, 1] - yc, sl[:, 2]); r = np.hypot(sl[:, 1] - yc, sl[:, 2])
    b = ((th + np.pi) / (2 * np.pi) * NB).astype(int) % NB
    rin = np.full(NB, np.nan)
    for k in range(NB):
        rk = r[b == k]
        if len(rk): rin[k] = np.percentile(rk, 3)
    if np.isnan(rin).mean() > 0.35: continue
    good = ~np.isnan(rin); ks = np.arange(NB)
    rin = np.interp(ks, np.r_[ks[good] - NB, ks[good], ks[good] + NB], np.r_[rin[good], rin[good], rin[good]])
    rin = np.convolve(np.r_[rin[-3:], rin, rin[:3]], np.ones(7) / 7, 'valid')
    th2 = np.arctan2(YY - yc, ZZ); r2 = np.hypot(YY - yc, ZZ)
    b2 = ((th2 + np.pi) / (2 * np.pi) * NB).astype(int) % NB
    cav[i] = r2 < rin[b2] - 0.004
cav = ndimage.binary_opening(cav, iterations=1)
# above the diaphragm (superior = −x): x < top of the dome in each (y, z) column
dk = {}
for p in dia:
    k = (int((p[1] - lo[1]) / V), int((p[2] - lo[2]) / V)); dk[k] = min(dk.get(k, 9), p[0])
pts = np.array(list(dk.keys())); vals = np.array(list(dk.values()))
J, K = np.meshgrid(np.arange(shape[1]), np.arange(shape[2]), indexing='ij')
dtop = griddata(pts, vals, (J, K), method='linear')
dtop = np.where(np.isnan(dtop), griddata(pts, vals, (J, K), method='nearest'), dtop)
dtop = ndimage.gaussian_filter(dtop, 2)
cav &= gx[:, None, None] < dtop[None] - 0.003
# the mediastinum: a midline band; the heart itself with 6 mm of pericardium and fat; and the space in front of the
# middle of the heart (the bare area behind the sternum) — the lungs' thin front edges overlap only the heart's sides
cav &= np.abs(gz)[None, None, :] > 0.02
hm = np.zeros((shape[0], shape[2]), bool); hb = np.full(hm.shape, 9.0); ht = np.full(hm.shape, -9.0)
for p in heart:
    i, k = int((p[0] - lo[0]) / V), int((p[2] - lo[2]) / V)
    if 0 <= i < shape[0] and 0 <= k < shape[2]: hm[i, k] = True; hb[i, k] = min(hb[i, k], p[1]); ht[i, k] = max(ht[i, k], p[1])
hm = ndimage.binary_fill_holes(ndimage.binary_closing(hm, iterations=3))
hb = ndimage.grey_erosion(hb, size=7); ht = ndimage.grey_dilation(ht, size=7)
sil = ndimage.binary_dilation(hm, iterations=2)
core = ndimage.binary_erosion(hm, iterations=6)
Y = gy[None, :, None]
cav &= ~(sil[:, None, :] & (Y > hb[:, None, :] - 0.006) & (Y < ht[:, None, :] + 0.006))
cav &= ~(core[:, None, :] & (Y > hb[:, None, :] - 0.006))
out_lungs = {}
for side, sgn in (('R', 1), ('L', -1)):
    m = cav & ((gz * sgn) > 0)[None, None, :]
    lab, n = ndimage.label(m)
    if n > 1:
        sizes = ndimage.sum(m, lab, range(1, n + 1)); m = lab == (1 + int(np.argmax(sizes)))
    f = ndimage.gaussian_filter(m.astype(np.float32), 1.3)
    verts, faces, _n, _v = measure.marching_cubes(f, 0.5, spacing=(V, V, V))
    verts += lo
    # Taubin smoothing (no shrinkage)
    nb = [[] for _ in verts]
    for a, b, c in faces: nb[a] += [b, c]; nb[b] += [a, c]; nb[c] += [a, b]
    nb = [np.array(list(set(q))) for q in nb]
    for it in range(8):
        lam = 0.5 if it % 2 == 0 else -0.53
        avg = np.array([verts[q].mean(0) if len(q) else verts[i] for i, q in enumerate(nb)])
        verts = verts + lam * (avg - verts)
    faces = faces[:, ::-1]                                              # outward winding
    meshes[f'lung_{side}'] = (verts, faces)
    print(f'lung {side}: {len(verts)} verts, top y {verts[:,1].max():.3f}, z {verts[:,2].min():.3f}..{verts[:,2].max():.3f}, x {verts[:,0].min():.3f}..{verts[:,0].max():.3f}')


# ---------------------------------------------------------------- write the GLB (positions, normals, indices)
def normals(P, I):
    N = np.zeros_like(P); fn = np.cross(P[I[:, 1]] - P[I[:, 0]], P[I[:, 2]] - P[I[:, 0]])
    for k in range(3): np.add.at(N, I[:, k], fn)
    return N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-12)


buf = bytearray(); views, accs, gm, nodes = [], [], [], []
def blob(data, target):
    global buf
    off = len(buf); buf += data
    views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(data), 'target': target})
    while len(buf) % 4: buf += b'\0'
    return len(views) - 1
for name, (P, I) in [(k, m) for k, m in meshes.items() if len(m[0]) and len(m[1])]:
    P = np.asarray(P, np.float32); I = np.asarray(I, np.uint32); N = normals(P.astype(float), I).astype(np.float32)
    a = len(accs)
    accs.append({'bufferView': blob(P.tobytes(), 34962), 'componentType': 5126, 'count': len(P), 'type': 'VEC3', 'min': P.min(0).tolist(), 'max': P.max(0).tolist()})
    accs.append({'bufferView': blob(N.tobytes(), 34962), 'componentType': 5126, 'count': len(N), 'type': 'VEC3'})
    accs.append({'bufferView': blob(I.tobytes(), 34963), 'componentType': 5125, 'count': I.size, 'type': 'SCALAR'})
    gm.append({'name': name, 'primitives': [{'attributes': {'POSITION': a, 'NORMAL': a + 1}, 'indices': a + 2}]})
    nodes.append({'name': name, 'mesh': len(gm) - 1})
gl = {'asset': {'version': '2.0', 'generator': 'build_thorax.py', 'copyright': 'BodyParts3D, (c) The Database Center for Life Science, CC BY 4.0'},
      'scene': 0, 'scenes': [{'nodes': list(range(len(nodes)))}], 'nodes': nodes, 'meshes': gm,
      'accessors': accs, 'bufferViews': views, 'buffers': [{'byteLength': len(buf)}]}
js = json.dumps(gl, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'wb') as f:
    f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(buf)))
    f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
    f.write(struct.pack('<II', len(buf), 0x004E4942)); f.write(buf)
for name, (P, I) in meshes.items(): print(f'{name:16} {len(P):6} verts {len(I):6} tris  y {np.min(P[:,1]):.3f}..{np.max(P[:,1]):.3f}')
print('wrote', OUT, os.path.getsize(OUT) // 1024, 'KB')
