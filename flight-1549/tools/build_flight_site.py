"""The deployable site of Flight 1549 (its own Vercel project): this folder without its tools, sources and secrets, in
_build/site (gitignored; the .vercel link there is kept), with a flight.local.json holding only the Cesium ion token the
deployed game uses for Google's city (never our own Google key).
Deploy, inside flight-1549/:  python -I tools/build_flight_site.py   then, inside _build/site:  npx vercel@latest deploy --prod --yes"""
import json, os, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, '_build', 'site')
LEAVE = {'tools', '_src', '_build', 'flight.local.json'}

def main():
    if os.path.isdir(OUT):                                  # keep the .vercel link, replace the rest
        for n in os.listdir(OUT):
            if n == '.vercel': continue
            p = os.path.join(OUT, n); shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
    os.makedirs(OUT, exist_ok=True)
    for n in os.listdir(ROOT):
        if n in LEAVE or n.startswith('.'): continue
        src, dst = os.path.join(ROOT, n), os.path.join(OUT, n)
        shutil.copytree(src, dst, dirs_exist_ok=True) if os.path.isdir(src) else shutil.copy2(src, dst)
    src = os.path.join(ROOT, 'flight.local.json')
    cfg = json.load(open(src, encoding='utf8')) if os.path.exists(src) else {}
    pub = {k: cfg[k] for k in ('cesiumIonToken',) if cfg.get(k)}
    json.dump(pub, open(os.path.join(OUT, 'flight.local.json'), 'w', encoding='utf8'))
    print('built', OUT, '| tokens:', ', '.join(pub) or 'NONE: the deployed game would have no city')

if __name__ == '__main__':
    sys.exit(main())
