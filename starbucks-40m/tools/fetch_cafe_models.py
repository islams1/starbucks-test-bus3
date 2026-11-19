"""Download the café equipment models (all CC-BY) from Sketchfab as glTF into assets/cafe_models/<slug>/.
Needs SKETCHFAB_TOKEN in this folder's .env.local or the repo root .env.local (git-ignored).
Run inside starbucks-40m/:  python -I tools/fetch_cafe_models.py
Credits are written to assets/cafe_models/CREDITS.json (shown in the game's credits).
"""
import io, json, os, sys, urllib.request, zipfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS = {   # slug: (uid, title)
    'espresso': ('bab05bc7805d4b0dbc2cdcbb48441956', 'Commercial Coffee Machine'),
    'pos': ('91c277a25bc34c5bbd080cd1e74161cb', 'POS terminal'),
    'cupcake1': ('bd65abb34f3d4863838da371d2d9f2c1', 'Cupcake Berry 01 - Photogrammetry 3D Scan'),
    'cupcake2': ('94454f2e2662491882e709f69cfaebb0', 'Cupcake Berry 02 - Photogrammetry 3D Scan'),
    'cake_piece': ('675125a5452d48bab052732fbcca99b7', 'Cake Piece Chocolate 01 - Photogrammetry 3D Scan'),
}


def token():
    t = os.environ.get('SKETCHFAB_TOKEN')
    for p in (os.path.join(ROOT, '.env.local'), os.path.join(os.path.dirname(ROOT), '.env.local')):
        if t: break
        if os.path.exists(p):
            for l in open(p, encoding='utf8'):
                if l.strip().startswith('SKETCHFAB_TOKEN='):
                    t = l.split('=', 1)[1].strip()
    if not t:
        sys.exit('no SKETCHFAB_TOKEN (env or .env.local)')
    return t


def main():
    tok = token(); out = os.path.join(ROOT, 'assets', 'cafe_models'); os.makedirs(out, exist_ok=True)
    cp = os.path.join(out, 'CREDITS.json')
    credits = json.load(open(cp, encoding='utf8')) if os.path.exists(cp) else {}
    only = sys.argv[1:]
    for slug, (uid, title) in MODELS.items():
        if only and slug not in only: continue
        dest = os.path.join(out, slug)
        meta = json.load(urllib.request.urlopen(urllib.request.Request(f'https://api.sketchfab.com/v3/models/{uid}', headers={'User-Agent': 'Mozilla/5.0'}), timeout=30))
        lic = (meta.get('license') or {}).get('label', '')
        if 'Attribution' not in lic and 'CC0' not in lic:
            print('SKIP licence', slug, lic); continue
        credits[slug] = [title, meta['user']['username'], f'https://sketchfab.com/3d-models/{uid}', lic]
        if os.path.exists(os.path.join(dest, 'scene.gltf')):
            print('have', slug); continue
        req = urllib.request.Request(f'https://api.sketchfab.com/v3/models/{uid}/download', headers={'Authorization': f'Token {tok}'})
        try:
            info = json.load(urllib.request.urlopen(req, timeout=60))
        except Exception as e:
            print('FAIL', slug, e); continue
        data = urllib.request.urlopen(info['gltf']['url'], timeout=600).read()
        z = zipfile.ZipFile(io.BytesIO(data)); os.makedirs(dest, exist_ok=True)
        for n in z.namelist():
            if n.endswith('/') or '..' in n or n.startswith('/'):
                continue
            p = os.path.join(dest, n); os.makedirs(os.path.dirname(p), exist_ok=True)
            with open(p, 'wb') as f: f.write(z.read(n))
        print('ok', slug, len(data) // 1024, 'KB', lic, flush=True)
    json.dump(credits, open(cp, 'w', encoding='utf8'), indent=1, ensure_ascii=False)


main()
