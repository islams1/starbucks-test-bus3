"""Build the deployable site of "What the Table Can Carry" into ../_build/lego-table (gitignored).
Arabic at the root, English at /en (and /en.html, ?lang=en). Tools, docs and local secrets are left out.
Then deploy from that folder:  npx --yes vercel@latest deploy --prod --yes
Run inside lego-table/:  python -I tools/build_site.py
"""
import os, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(os.path.dirname(ROOT), '_build', 'starbucks-model')
SKIP_DIRS = {'tools', 'docs', '__pycache__', '.vercel', 'node_modules'}
SKIP_FILES = ('.env', '.py', '.log', '.part')

os.makedirs(OUT, exist_ok=True)
# keep the .vercel link of an earlier deploy; refresh everything else
for name in os.listdir(OUT):
    if name == '.vercel':
        continue
    p = os.path.join(OUT, name)
    shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
n = 0
for dirpath, dirnames, filenames in os.walk(ROOT):
    dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith('.')]
    rel = os.path.relpath(dirpath, ROOT)
    for f in filenames:
        if f.startswith('.env') or f.endswith(SKIP_FILES):
            continue
        dst = os.path.join(OUT, rel, f)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(os.path.join(dirpath, f), dst)
        n += 1
# the English version at /en
os.makedirs(os.path.join(OUT, 'en'), exist_ok=True)
with open(os.path.join(OUT, 'en', 'index.html'), 'w', encoding='utf8') as fh:
    fh.write('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>The Store on the Table</title>'
             '<script>location.replace("../index.html?lang=en");</script></head>'
             '<body><a href="../index.html?lang=en">The Store on the Table (English)</a></body></html>')
size = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(OUT) for f in fs) / 1e6
print(f'{n} files, {size:.0f} MB -> {OUT}')
