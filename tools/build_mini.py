"""Build the stand-alone quick-version site (its own Vercel project, opens straight into the quick version).
Copies what the full site deploys (same exclusions as .vercelignore) into _build/third-place-bus3-mini and marks
index.html with <meta name="bus3-mode" content="mini"> plus the full version's address for the "full version" links.
Run from the repo root:  python -I tools/build_mini.py
Then:  npx vercel deploy --prod --yes --cwd _build/third-place-bus3-mini
"""
import fnmatch, os, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, '_build', 'third-place-bus3-mini')
FULL = sys.argv[1] if len(sys.argv) > 1 else 'https://third-place-bus3.vercel.app/'
SKIP_TOP = {'.git', '_build', '_src', 'tools', '.vercel', 'node_modules', 'mini'}


def ignored():
    pats = []
    for ln in open(os.path.join(ROOT, '.vercelignore'), encoding='utf8'):
        ln = ln.strip()
        if ln and not ln.startswith('#'):
            pats.append(ln.rstrip('/'))
    return pats


def main():
    pats = ignored()
    keep_link = os.path.join(OUT, '.vercel')           # keep the project link between builds
    saved = None
    if os.path.isdir(keep_link):
        saved = os.path.join(ROOT, '_build', '.vercel_mini_link')
        shutil.rmtree(saved, ignore_errors=True); shutil.copytree(keep_link, saved)
    shutil.rmtree(OUT, ignore_errors=True)
    n = size = 0
    for d, dirs, files in os.walk(ROOT):
        rel_d = os.path.relpath(d, ROOT).replace('\\', '/')
        if rel_d == '.':
            dirs[:] = [x for x in dirs if x not in SKIP_TOP]
        for f in files:
            rel = (f if rel_d == '.' else rel_d + '/' + f)
            if any(fnmatch.fnmatch(rel, p) or fnmatch.fnmatch(f, p) for p in pats) or f.startswith('.'):
                continue
            dst = os.path.join(OUT, rel)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copy2(os.path.join(d, f), dst)
            n += 1; size += os.path.getsize(dst)
    if saved:
        shutil.copytree(saved, keep_link); shutil.rmtree(saved, ignore_errors=True)
    open(os.path.join(OUT, '.vercelignore'), 'w').write('.env*\n.gitignore\n')   # `vercel link` drops a token in .env.local
    idx = os.path.join(OUT, 'index.html')
    html = open(idx, encoding='utf8').read()
    tag = f'<meta name="bus3-mode" content="mini"><meta name="bus3-full" content="{FULL}">'
    assert '<meta charset="utf-8">' in html, 'index.html: charset meta not found'
    html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">' + tag, 1)
    open(idx, 'w', encoding='utf8').write(html)
    print(f'{n} files, {size / 1e6:.1f} MB -> {OUT}')


main()
