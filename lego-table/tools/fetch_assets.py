"""Download the real models and textures of the workshop into lego-table/assets.
Poly Haven (CC0): models (1k glTF) and textures. Sketchfab (CC BY): a few pieces Poly Haven does not have — needs
SKETCHFAB_TOKEN in lego-table/.env.local or the repo root .env.local (git-ignored). Credits go to
assets/models_sf/CREDITS.json (shown in the game's credits).
Run inside lego-table/:  python -I tools/fetch_assets.py
"""
import io, json, os, sys, urllib.request, zipfile, concurrent.futures as cf
opener = urllib.request.build_opener(); opener.addheaders = [('User-Agent', 'Mozilla/5.0 (asset-fetch)')]; urllib.request.install_opener(opener)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets')
API = 'https://api.polyhaven.com/files/'

PH_MODELS = '''steel_frame_shelves_03 cardboard_box_01 plastic_crate_01 plastic_crate_02
plastic_crate_03 metal_office_desk desk_lamp_arm_01 hanging_industrial_lamp tool_cart metal_tool_chest metal_toolbox
bench_vice_01 measuring_tape_01 clipboard binder_notebook classic_laptop potted_plant_04
metal_trash_can wooden_display_shelves_01 adjustable_wrench
wooden_hammer_01 metal_stool_02 spray_paint_bottles modern_wooden_cabinet
drawer_cabinet potted_plant_02 dining_chair_02 wall_clock
rollershutter_door street_lamp_01 fire_hydrant covered_car utility_box_02 water_manhole_cover
modular_street_seating planter_box_01 exterior_aircon_unit'''.split()
PH_TEX = {'concrete_floor_worn_001': '2k', 'whitewashed_brick': '2k', 'plywood': '2k', 'asphalt_02': '2k', 'concrete_pavers': '2k', 'brushed_concrete': '1k', 'brick_wall_005': '1k', 'concrete_tile_facade': '1k', 'red_brick_03': '2k', 'plastered_wall': '1k'}
SF = {   # slug: (uid, title)
    'office_chair': ('675f34f7304e4d92812a41e9750539aa', 'Office Chair Modern'),
    'pallets': ('dba5c00928cd400796d9f6fffdd724b3', 'Wooden Pallets'),
    'monitor': ('f84d24b6df3648d884fd9be9c8007dd4', 'Ultrawide Monitor'),
    'whiteboard': ('d0b05bd140734a799666f0a29e1fe1bb', 'Whiteboard'),
}


def get(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 100:
        return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with urllib.request.urlopen(url, timeout=300) as r:
        data = r.read()
    with open(path, 'wb') as f:
        f.write(data)


def files(aid):
    with urllib.request.urlopen(API + aid, timeout=60) as r:
        return json.load(r)


def ph_model(aid):
    fs = files(aid)
    if 'gltf' not in fs:
        print('no glTF:', aid); return None
    f = fs['gltf']['1k']['gltf']
    d = os.path.join(OUT, 'models', aid)
    get(f['url'], os.path.join(d, f'{aid}.gltf'))
    for rel, inc in f.get('include', {}).items():
        get(inc['url'], os.path.join(d, rel))
    return aid


def hdri(aid):
    f = files(aid)['hdri']['2k']['hdr']
    get(f['url'], os.path.join(OUT, 'hdri', aid + '_2k.hdr'))
    return aid


def ph_texture(aid):
    f, res = files(aid), PH_TEX[aid]
    keymap = {'diff': ['Diffuse', 'diff'], 'nor_gl': ['nor_gl'], 'rough': ['Rough', 'rough']}
    for out, keys in keymap.items():
        for k in keys:
            if k in f and res in f[k]:
                get(f[k][res]['jpg']['url'], os.path.join(OUT, 'tex', aid, f'{out}.jpg'))
                break
    return aid


def token():
    t = os.environ.get('SKETCHFAB_TOKEN')
    for p in (os.path.join(ROOT, '.env.local'), os.path.join(os.path.dirname(ROOT), '.env.local')):
        if t: break
        if os.path.exists(p):
            for l in open(p, encoding='utf8'):
                if l.strip().startswith('SKETCHFAB_TOKEN='):
                    t = l.split('=', 1)[1].strip()
    return t


def sketchfab():
    tok = token()
    if not tok:
        print('no SKETCHFAB_TOKEN: skipping the Sketchfab pieces'); return
    out = os.path.join(OUT, 'models_sf'); os.makedirs(out, exist_ok=True)
    cp = os.path.join(out, 'CREDITS.json')
    credits = json.load(open(cp, encoding='utf8')) if os.path.exists(cp) else {}
    for slug, (uid, title) in SF.items():
        dest = os.path.join(out, slug)
        meta = json.load(urllib.request.urlopen(f'https://api.sketchfab.com/v3/models/{uid}', timeout=30))
        lic = (meta.get('license') or {}).get('label', '')
        if 'Attribution' not in lic and 'CC0' not in lic:
            print('SKIP licence', slug, lic); continue
        credits[slug] = [title, meta['user']['username'], f'https://sketchfab.com/3d-models/{uid}', lic]
        if os.path.exists(os.path.join(dest, 'scene.gltf')):
            print('have', slug); continue
        req = urllib.request.Request(f'https://api.sketchfab.com/v3/models/{uid}/download', headers={'Authorization': f'Token {tok}'})
        info = json.load(urllib.request.urlopen(req, timeout=60))
        data = urllib.request.urlopen(info['gltf']['url'], timeout=600).read()
        z = zipfile.ZipFile(io.BytesIO(data)); os.makedirs(dest, exist_ok=True)
        for n in z.namelist():
            if n.endswith('/') or '..' in n or n.startswith('/'):
                continue
            p = os.path.join(dest, n); os.makedirs(os.path.dirname(p), exist_ok=True)
            with open(p, 'wb') as f: f.write(z.read(n))
        print('ok', slug, len(data) // 1024, 'KB', lic, flush=True)
    json.dump(credits, open(cp, 'w', encoding='utf8'), indent=1, ensure_ascii=False)


if __name__ == '__main__':
    with cf.ThreadPoolExecutor(6) as ex:
        for r in ex.map(lambda a: (a, ph_model(a)), PH_MODELS): print('model', r[0], flush=True)
        for r in ex.map(ph_texture, PH_TEX): print('tex', r, flush=True)
        print('hdri', hdri('kloofendal_38d_partly_cloudy_puresky'), flush=True)
    sketchfab()
