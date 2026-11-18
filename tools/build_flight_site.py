"""Stand-alone site for the Flight 1549 game (its own Vercel project): copies what flight.html needs into
_build/flight-1549 (gitignored) with the game at the root, and a flight.local.json holding only the browser tokens
the deployed game uses (Cesium ion, Mapbox) — never the Google key.
Deploy:  python -I tools/build_flight_site.py  then, inside _build/flight-1549:  npx vercel@latest deploy --prod --yes"""
import json, os, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, '_build', 'flight-1549')
DIRS = ['js', 'css', 'assets/flight', 'assets/flight_models', 'assets/nyc', 'assets/vo/flight',
        'assets/avatars', 'assets/models', 'assets/tex', 'assets/baked', 'assets/hdri']
FILES = ['flight.html', 'data/lines.flight.json']

def main():
    if os.path.isdir(OUT):                                  # keep the .vercel link, replace the rest
        for n in os.listdir(OUT):
            if n == '.vercel': continue
            p = os.path.join(OUT, n); shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
    os.makedirs(OUT, exist_ok=True)
    for d in DIRS: shutil.copytree(os.path.join(ROOT, d), os.path.join(OUT, d), dirs_exist_ok=True)
    for f in FILES:
        os.makedirs(os.path.dirname(os.path.join(OUT, f)) or OUT, exist_ok=True); shutil.copy2(os.path.join(ROOT, f), os.path.join(OUT, f))
    shutil.copy2(os.path.join(ROOT, 'flight.html'), os.path.join(OUT, 'index.html'))
    src = os.path.join(ROOT, 'flight.local.json')
    cfg = json.load(open(src, encoding='utf8')) if os.path.exists(src) else {}
    pub = {k: cfg[k] for k in ('cesiumIonToken', 'mapboxToken') if cfg.get(k)}
    json.dump(pub, open(os.path.join(OUT, 'flight.local.json'), 'w', encoding='utf8'))
    print('built', OUT, '| tokens:', ', '.join(pub) or 'none (open-data city only)')

if __name__ == '__main__':
    sys.exit(main())
