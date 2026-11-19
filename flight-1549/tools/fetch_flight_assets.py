"""Download the Flight 1549 models (all CC-BY) from Sketchfab as glTF into _src/flight_raw/<slug>/ (originals, git-ignored);
tools/optimize_or_models.py-style processing then writes the web copies to assets/flight_models/<slug>/.
Needs the Sketchfab API token in .env.local (SKETCHFAB_TOKEN=...). Run from the repo root:
    python -I tools/fetch_flight_assets.py [slug ...]
"""
import io, json, os, sys, urllib.request, zipfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, '_src', 'flight_raw')
MODELS = {   # slug: (uid, title)
    'cockpit_a320': ('a31a149df8f344ca9a688dbc07b9f4df', 'A320 Part Cockpit'),
    'cockpit_a320b': ('5fb0c671a91042c1a9d8f2cf3e2df021', 'A320 Cockpit 2'),
    'cockpit_bus': ('06ca045e131b4cfdac76ddbd55ed3b4a', 'Airbus Cockpit Interior'),
    'a320': ('c078f9af15884a6b820c7e778831b110', 'Airbus A320-200 V2'),
    'manhattan': ('372bc495b3a941308f4a3198bc45e17b', 'New York City. Manhattan'),
    'swan': ('04ac4add046843ee975f6785d24c042e', 'Animated Swan - Rigged & Optimized Game Model'),
    'goose_still': ('50f4ace96846465f85f2e9a9f5c84453', 'Canada Goose'),
}


def token():
    t = os.environ.get('SKETCHFAB_TOKEN')
    p = os.path.join(ROOT, '.env.local')
    if not t and os.path.exists(p):
        for l in open(p, encoding='utf8'):
            if l.strip().startswith('SKETCHFAB_TOKEN='): t = l.split('=', 1)[1].strip()
    if not t: sys.exit('no SKETCHFAB_TOKEN (env or .env.local)')
    return t


def main():
    tok = token(); want = sys.argv[1:] or list(MODELS)
    credits_p = os.path.join(RAW, 'CREDITS.json'); credits = json.load(open(credits_p, encoding='utf8')) if os.path.exists(credits_p) else {}
    for slug in want:
        uid, title = MODELS[slug]; dest = os.path.join(RAW, slug)
        if os.path.exists(os.path.join(dest, 'scene.gltf')): print('have', slug); continue
        req = urllib.request.Request(f'https://api.sketchfab.com/v3/models/{uid}/download', headers={'Authorization': f'Token {tok}'})
        try: info = json.load(urllib.request.urlopen(req, timeout=60))
        except Exception as e: print('FAIL', slug, e); continue
        try: author = json.load(urllib.request.urlopen(f'https://api.sketchfab.com/v3/models/{uid}', timeout=30))['user']['username']
        except Exception: author = '?'
        data = urllib.request.urlopen(info['gltf']['url'], timeout=900).read()
        z = zipfile.ZipFile(io.BytesIO(data)); os.makedirs(dest, exist_ok=True)
        for n in z.namelist():
            if n.endswith('/') or '..' in n or n.startswith('/'): continue
            p = os.path.join(dest, n); os.makedirs(os.path.dirname(p), exist_ok=True)
            with open(p, 'wb') as f: f.write(z.read(n))
        credits[slug] = [title, author, f'https://sketchfab.com/3d-models/{uid}', 'CC BY 4.0']
        print('ok', slug, len(data) // 1024, 'KB', flush=True)
    os.makedirs(RAW, exist_ok=True)
    json.dump(credits, open(credits_p, 'w', encoding='utf8'), indent=1, ensure_ascii=False)


main()
