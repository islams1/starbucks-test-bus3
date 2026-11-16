"""Make the downloaded Sketchfab models light enough for the web.
assets/or_models/<slug>/scene.gltf (+ an optional decimated <slug>_lod*.gltf) -> assets/or_models/<slug>/model.gltf + model.bin
+ tex/*.jpg (textures resized, PNG→JPG unless they need alpha). Originals are moved to _src/or_models_raw/<slug>/.
Run from the repo root:  python -I tools/optimize_or_models.py
"""
import glob, json, os, shutil
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, RAW = os.path.join(ROOT, 'assets', 'or_models'), os.path.join(ROOT, '_src', 'or_models_raw')
MAXPX = {'heart_realistic': 2048, 'surgeon': 2048, 'nurse': 2048}


def main():
    for slug in sorted(os.listdir(SRC)):
        d = os.path.join(SRC, slug)
        if not os.path.isdir(d) or os.path.exists(os.path.join(d, 'model.gltf')):
            continue
        raw = os.path.join(RAW, slug)
        if os.path.exists(raw): shutil.rmtree(raw)
        shutil.move(d, raw); os.makedirs(os.path.join(d, 'tex'))
        lods = sorted(glob.glob(os.path.join(raw, f'{slug}_lod*.gltf')), key=lambda f: os.path.getsize(f[:-5] + '.bin'))   # the lightest decimated copy
        src = lods[0] if lods else os.path.join(raw, 'scene.gltf')
        g = json.load(open(src, encoding='utf8'))
        binsrc = os.path.join(raw, g['buffers'][0]['uri']); shutil.copy(binsrc, os.path.join(d, 'model.bin'))
        g['buffers'][0]['uri'] = 'model.bin'
        alpha = set()
        for m in g.get('materials', []):
            if m.get('alphaMode', 'OPAQUE') != 'OPAQUE':
                t = m.get('pbrMetallicRoughness', {}).get('baseColorTexture')
                if t: alpha.add(g['textures'][t['index']]['source'])
        mx = MAXPX.get(slug, 1024); before = after = 0
        for i, im in enumerate(g.get('images', [])):
            p = os.path.join(raw, im['uri'].replace('%20', ' ')); before += os.path.getsize(p)
            img = Image.open(p); img.load()
            if max(img.size) > mx: img.thumbnail((mx, mx), Image.LANCZOS)
            name = os.path.splitext(os.path.basename(p))[0]
            if i in alpha and img.mode in ('RGBA', 'LA', 'P'):
                out = f'tex/{name}.png'; img.save(os.path.join(d, out), optimize=True); im['mimeType'] = 'image/png'
            else:
                out = f'tex/{name}.jpg'; img.convert('RGB').save(os.path.join(d, out), quality=90 if 'normal' in name.lower() else 85); im['mimeType'] = 'image/jpeg'
            im['uri'] = out; after += os.path.getsize(os.path.join(d, out))
        json.dump(g, open(os.path.join(d, 'model.gltf'), 'w', encoding='utf8'))
        lic = os.path.join(raw, 'license.txt')
        if os.path.exists(lic): shutil.copy(lic, os.path.join(d, 'license.txt'))
        print(f'{slug:16} {os.path.basename(src):22} textures {before // 1024 // 1024}MB -> {after // 1024}KB  bin {os.path.getsize(os.path.join(d, "model.bin")) // 1024}KB', flush=True)


main()
