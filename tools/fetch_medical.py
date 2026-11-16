"""Download the Rocketbox medical avatars used in the operating-room situation (MIT licence) and prepare them like the
other avatars (facial FBX -> model.fbx, TGA -> JPG/PNG). Also makes the two scrub-coloured nurse variants for the
anaesthetist and the scrub nurse (the library has no female avatar in theatre scrubs).
Run from the repo root:  python -I tools/fetch_medical.py
"""
import os, sys, shutil, colorsys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fetch_assets as fa
from PIL import Image

BASE = 'Assets/Avatars/Professions/{n}/'
AV = {'Medical_Male_05': 1024, 'Medical_Male_04': 1024, 'Medical_Female_01': 1024}   # surgeon (gowned), scrubs, nurse


def avatar(name, size):
    base = BASE.format(n=name)
    fbx = fa.get(fa.RAW + base + f'Export/{name}_facial.fbx', os.path.join(fa.SRC, 'avatars', name, f'{name}_facial.fbx'))
    for t in fa.listdir(base + 'Textures'):
        if not t.endswith('.tga') or ' ' in t: continue
        kind = t.split('_', 1)[1].rsplit('.', 1)[0]
        if kind.endswith('specular') or 'wrinkle' in kind: continue
        src = fa.get(fa.RAW + base + 'Textures/' + t, os.path.join(fa.SRC, 'avatars', name, t))
        if kind == 'opacity_color': fa.conv(src, os.path.join(fa.OUT, 'avatars', name, kind + '.png'), size, png=True)
        else: fa.conv(src, os.path.join(fa.OUT, 'avatars', name, kind + '.jpg'), size)
    dst = os.path.join(fa.OUT, 'avatars', name, 'model.fbx')
    if not os.path.exists(dst): shutil.copy(fbx, dst)
    print('ok', name, flush=True)


def scrub_variant(src_name, dst_name, rgb):
    """White uniform -> theatre scrubs: low-saturation bright texels are recoloured, skin and hair are kept."""
    s = os.path.join(fa.OUT, 'avatars', src_name); d = os.path.join(fa.OUT, 'avatars', dst_name)
    os.makedirs(d, exist_ok=True)
    for f in os.listdir(s):
        if f != 'body_color.jpg': shutil.copy(os.path.join(s, f), os.path.join(d, f))
    im = Image.open(os.path.join(s, 'body_color.jpg')).convert('RGB'); px = im.load()
    tr, tg, tb = [c / 255 for c in rgb]; th, ts, tv = colorsys.rgb_to_hsv(tr, tg, tb)
    for y in range(im.height):
        for x in range(im.width):
            r, g, b = [c / 255 for c in px[x, y]]
            h, sat, v = colorsys.rgb_to_hsv(r, g, b)
            if sat < 0.16 and v > 0.42:                       # white / light-grey cloth
                k = min(1, (0.16 - sat) / 0.08)                 # soft edge
                nr, ng, nb = colorsys.hsv_to_rgb(th, ts, tv * (0.55 + 0.55 * v))
                px[x, y] = tuple(int(255 * (a * k + o * (1 - k))) for a, o in ((nr, r), (ng, g), (nb, b)))
    im.save(os.path.join(d, 'body_color.jpg'), quality=88, optimize=True)
    print('ok', dst_name, flush=True)


if __name__ == '__main__':
    for n, sz in AV.items(): avatar(n, sz)
    scrub_variant('Medical_Female_01', 'OR_Female_Anaesthesia', (58, 118, 104))   # green scrubs (Dr. Layla)
    scrub_variant('Medical_Female_01', 'OR_Female_Scrub', (52, 96, 150))          # sterile-blue gown (Rania)
