"""Build assets/or_models/bp3d_heart.glb from BodyParts3D (CC BY 4.0, © The Database Center for Life Science):
the real anatomy of the heart and great vessels, one mesh per group, in the game's frame (metres, patient supine,
head towards -x, anterior +y, patient's left -z), centred on the heart.
Source zip: _src/bp3d/partof_BP3D_4.0_obj_99.zip (download from dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/).
Run from the repo root:  python -I tools/build_heart.py
"""
import json, os, struct, zipfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ZIP = os.path.join(ROOT, '_src', 'bp3d', 'partof_BP3D_4.0_obj_99.zip')
OUT = os.path.join(ROOT, '_src', 'bp3d', 'bp3d_heart.glb')   # an alternative heart; the game uses the Sketchfab one
R = lambda a, b: ['FJ%d' % i for i in range(a, b + 1)]
GROUPS = {
    # heart muscle (atria, ventricles) and the blood-pool casts that fill its outline where the walls are thin
    # the outer surface of the heart = the four chamber casts pushed outwards by each wall's thickness
    'lv': ['FJ2422'], 'rv': ['FJ2423'], 'ra': ['FJ2424'], 'la': ['FJ2425'],
    'lad': ['FJ2631', 'FJ2632', 'FJ2641', 'FJ2643', 'FJ2644', 'FJ2645', 'FJ2646', 'FJ2647', 'FJ2737'],
    'diagonal': ['FJ2633', 'FJ2634', 'FJ2635', 'FJ2636', 'FJ2637', 'FJ2638', 'FJ2639', 'FJ2640', 'FJ2642', 'FJ2648'],
    'circumflex': R(2649, 2654),
    'rca': ['FJ2723', 'FJ2670', 'FJ2671', 'FJ2673', 'FJ2676', 'FJ2677'] + R(2714, 2722),
    'marginal': ['FJ2667', 'FJ2668', 'FJ2672', 'FJ2674', 'FJ2675'],
    'pda': R(2692, 2700),
    'veins': ['FJ2655', 'FJ2656', 'FJ2724', 'FJ2727', 'FJ2728', 'FJ2729', 'FJ2731'] + R(2701, 2713),
    'aorta': ['FJ3413', 'FJ3411'],
    'pulmonary_trunk': ['FJ2966'],
    'svc': ['FJ3645'],
    'lima': ['FJ1971', 'FJ1972', 'FJ1979'],
}


def read_obj(z, fj):
    try:
        t = z.read(f'partof_BP3D_4.0_obj_99/{fj}.obj').decode('utf8', 'ignore')
    except KeyError:
        return [], []
    vs, fs = [], []
    for l in t.splitlines():
        if l.startswith('v '):
            p = l.split(); vs.append((float(p[1]), float(p[2]), float(p[3])))
        elif l.startswith('f '):
            idx = [int(q.split('/')[0]) - 1 for q in l.split()[1:]]
            for k in range(1, len(idx) - 1):
                fs.append((idx[0], idx[k], idx[k + 1]))
    return vs, fs


def to_world(v):
    x, y, z = v   # BP3D: +X patient's left, +Y posterior, +Z superior, millimetres
    return (-z / 1000.0, -y / 1000.0, -x / 1000.0)


def main():
    z = zipfile.ZipFile(ZIP)
    meshes = {}
    for g, ids in GROUPS.items():
        P, I = [], []
        for fj in ids:
            vs, fs = read_obj(z, fj)
            o = len(P)
            P += [to_world(v) for v in vs]
            I += [(a + o, b + o, c + o) for a, b, c in fs]
        meshes[g] = (P, I)
        print(g, len(P), 'verts', len(I), 'tris')
    # inflate the chambers (vertex normals, area weighted)
    WALL = {'lv': 0.0068, 'rv': 0.004, 'ra': 0.0024, 'la': 0.0024}
    for g, t in WALL.items():
        P, I = meshes[g]; N = [[0.0, 0.0, 0.0] for _ in P]
        for a, b, c2 in I:
            ax, ay, az = P[a]; bx, by, bz = P[b]; cx, cy, cz = P[c2]
            ux, uy, uz = bx - ax, by - ay, bz - az; vx, vy, vz = cx - ax, cy - ay, cz - az
            n = (uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx)
            for k in (a, b, c2):
                N[k][0] += n[0]; N[k][1] += n[1]; N[k][2] += n[2]
        out = []
        for p, n in zip(P, N):
            l = (n[0] ** 2 + n[1] ** 2 + n[2] ** 2) ** 0.5 or 1
            out.append((p[0] + n[0] / l * t, p[1] + n[1] / l * t, p[2] + n[2] / l * t))
        meshes[g] = (out, I)
    # one epicardium mesh, subdivided once and smoothed (Taubin: no shrinking)
    P, I = [], []
    for g in ('lv', 'rv', 'ra', 'la'):
        o = len(P); P += meshes[g][0]; I += [(a + o, b + o, c2 + o) for a, b, c2 in meshes[g][1]]
    P = [list(p) for p in P]; mids = {}; NI = []
    def midp(a, b):
        k = (a, b) if a < b else (b, a)
        if k not in mids: mids[k] = len(P); P.append([(P[a][j] + P[b][j]) / 2 for j in range(3)])
        return mids[k]
    for a, b, c2 in I:
        ab, bc, ca = midp(a, b), midp(b, c2), midp(c2, a)
        NI += [(a, ab, ca), (ab, b, bc), (ca, bc, c2), (ab, bc, ca)]
    I = NI
    nb = [set() for _ in P]
    for a, b, c2 in I: nb[a] |= {b, c2}; nb[b] |= {a, c2}; nb[c2] |= {a, b}
    for it in range(6):
        lam = 0.5 if it % 2 == 0 else -0.53
        Q = []
        for i, p in enumerate(P):
            if not nb[i]: Q.append(p); continue
            m = [sum(P[j][k] for j in nb[i]) / len(nb[i]) for k in range(3)]
            Q.append([p[k] + lam * (m[k] - p[k]) for k in range(3)])
        P = Q
    P = [tuple(p) for p in P]
    ra_pts = meshes['ra'][0]
    for g in ('lv', 'rv', 'ra', 'la'): del meshes[g]
    meshes = {'epicardium': (P, I), **meshes}
    # centre on the ventricles (myocardium bounding box)
    mp = meshes['epicardium'][0]
    c = [sum(p[k] for p in mp) / len(mp) for k in range(3)]
    print('centre (world, before recentring):', [round(v, 4) for v in c])
    # epicardial fat: yellow where the muscle surface lies within a few mm of a coronary vessel (the grooves)
    import math, random
    vessels = [p for g in ('lad', 'circumflex', 'rca', 'pda') for p in meshes[g][0]]      # the big grooves only
    cell = 0.005; grid = {}
    for p in vessels: grid.setdefault(tuple(int(math.floor(v / cell)) for v in p), []).append(p)
    def near(p):
        k = [int(math.floor(v / cell)) for v in p]; best = 1.0
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for dz in (-1, 0, 1):
                    for q in grid.get((k[0] + dx, k[1] + dy, k[2] + dz), ()):
                        d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2
                        if d < best: best = d
        return math.sqrt(best)
    random.seed(7)
    colours = {}
    lin = lambda c: tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c)   # glTF vertex colours are linear
    MUSCLE, FAT = lin((0.46, 0.09, 0.1)), lin((0.84, 0.64, 0.3))
    cs = []
    for p in meshes['epicardium'][0]:
        d = near(p); f = max(0.0, min(1.0, (0.0072 - d) / 0.005)); f = f * f * (3 - 2 * f)
        n = 0.5 + 0.25 * math.sin(p[0] * 190 + 1.3) * math.sin(p[2] * 170) + 0.25 * math.sin(p[1] * 230 + p[0] * 90)   # patchy fat over the right ventricle
        f = max(f, max(0.0, n - 0.72) * 2.2 * (1 if p[2] > -0.02 else 0.4))
        f = min(1.0, f * (0.85 + 0.3 * random.random()))
        cs.append(tuple(MUSCLE[k] + (FAT[k] - MUSCLE[k]) * f for k in range(3)))
    colours['epicardium'] = cs
    # reference points (world, before recentring) printed for the game code
    def mid(g, frac=0.5):
        P = sorted(meshes[g][0], key=lambda p: p[0]); return P[int(len(P) * frac)]
    print('LAD mid', [round(v - c[i], 4) for i, v in enumerate(mid('lad', 0.55))])
    print('PDA mid', [round(v - c[i], 4) for i, v in enumerate(mid('pda', 0.5))])
    print('CX  dist', [round(v - c[i], 4) for i, v in enumerate(mid('circumflex', 0.8))])
    ra = max(ra_pts, key=lambda p: p[1] + 0.3 * p[2]); print('RA front', [round(v - c[i], 4) for i, v in enumerate(ra)])
    for g in meshes:
        P = meshes[g][0]
        if P: print('bounds', g, [round(min(p[k] for p in P) - c[k], 3) for k in range(3)], [round(max(p[k] for p in P) - c[k], 3) for k in range(3)])
    buf = bytearray(); views, accs, gmeshes, nodes = [], [], [], []
    for g, (P, I) in meshes.items():
        if not P:
            continue
        P = [(p[0] - c[0], p[1] - c[1], p[2] - c[2]) for p in P]
        mn = [min(p[k] for p in P) for k in range(3)]; mx = [max(p[k] for p in P) for k in range(3)]
        off = len(buf); buf += b''.join(struct.pack('<3f', *p) for p in P)
        views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(buf) - off, 'target': 34962})
        accs.append({'bufferView': len(views) - 1, 'componentType': 5126, 'count': len(P), 'type': 'VEC3', 'min': mn, 'max': mx})
        while len(buf) % 4: buf += b'\0'
        off = len(buf); buf += b''.join(struct.pack('<3I', *t) for t in I)
        views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(buf) - off, 'target': 34963})
        accs.append({'bufferView': len(views) - 1, 'componentType': 5125, 'count': len(I) * 3, 'type': 'SCALAR'})
        while len(buf) % 4: buf += b'\0'
        attrs = {'POSITION': len(accs) - 2}
        if g in colours:
            off = len(buf); buf += b''.join(struct.pack('<3f', *q) for q in colours[g])
            views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(buf) - off, 'target': 34962})
            accs.append({'bufferView': len(views) - 1, 'componentType': 5126, 'count': len(colours[g]), 'type': 'VEC3'})
            attrs['COLOR_0'] = len(accs) - 1
            gmeshes.append({'name': g, 'primitives': [{'attributes': attrs, 'indices': len(accs) - 2}]})
        else:
            gmeshes.append({'name': g, 'primitives': [{'attributes': attrs, 'indices': len(accs) - 1}]})
        nodes.append({'name': g, 'mesh': len(gmeshes) - 1})
    gl = {'asset': {'version': '2.0', 'generator': 'build_heart.py', 'copyright': 'BodyParts3D, (c) The Database Center for Life Science, CC BY 4.0'},
          'scene': 0, 'scenes': [{'nodes': list(range(len(nodes)))}], 'nodes': nodes, 'meshes': gmeshes,
          'accessors': accs, 'bufferViews': views, 'buffers': [{'byteLength': len(buf)}],
          'extras': {'centre_world': c}}
    js = json.dumps(gl, separators=(',', ':')).encode()
    while len(js) % 4: js += b' '
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(buf)))
        f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack('<II', len(buf), 0x004E4942)); f.write(buf)
    print('wrote', OUT, os.path.getsize(OUT) // 1024, 'KB')


main()
