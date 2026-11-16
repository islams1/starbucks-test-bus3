"""Operating-room materials: Poly Haven (CC0) PBR textures -> assets/tex/<id>/{diff,nor_gl,rough}.jpg
Run from the repo root:  python -I tools/fetch_or_assets.py
"""
import json, os, urllib.request
opener = urllib.request.build_opener(); opener.addheaders = [('User-Agent', 'Mozilla/5.0 (asset-fetch)')]; urllib.request.install_opener(opener)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'tex')
TEX = {'long_white_tiles': '2k', 'smooth_concrete_floor': '1k', 'white_plaster_02': '1k', 'terry_cloth': '1k', 'metal_plate': '1k', 'denim_fabric': '1k'}


def get(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 100:
        return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with urllib.request.urlopen(url, timeout=300) as r:
        data = r.read()
    with open(path, 'wb') as f:
        f.write(data)


for aid, res in TEX.items():
    with urllib.request.urlopen('https://api.polyhaven.com/files/' + aid, timeout=60) as r:
        f = json.load(r)
    got = []
    for out, keys in {'diff': ['Diffuse', 'diff'], 'nor_gl': ['nor_gl'], 'rough': ['Rough', 'rough']}.items():
        for k in keys:
            if k in f and res in f[k]:
                get(f[k][res]['jpg']['url'], os.path.join(OUT, aid, out + '.jpg')); got.append(out); break
    print(aid, res, got, flush=True)
