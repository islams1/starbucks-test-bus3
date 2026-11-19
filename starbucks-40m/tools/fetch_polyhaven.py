"""Download the Poly Haven (CC0) models / textures this game uses into starbucks-40m/assets.
Run inside starbucks-40m/:  python -I tools/fetch_polyhaven.py
"""
import json, os, urllib.request, concurrent.futures as cf
opener = urllib.request.build_opener(); opener.addheaders = [('User-Agent', 'Mozilla/5.0 (asset-fetch)')]; urllib.request.install_opener(opener)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets')
API = 'https://api.polyhaven.com/files/'

MODELS = '''bar_chair_round_01 wall_clock hanging_industrial_lamp carrot_cake strawberry_chocolate_cake croissant dining_chair_02
round_wooden_table_01 potted_plant_01 potted_plant_02 sofa_02 modern_arm_chair_01 hanging_picture_frame_01 hanging_picture_frame_02
korean_fire_extinguisher_01'''.split()
TEXTURES = '''herringbone_parquet terrazzo_tiles square_tiled_wall red_brick_03 wood_table black_oak_veneer marble_01 plastered_wall oak_veneer_01
brick_wall_005 wood_floor_deck concrete_pavers asphalt_02 white_plaster_02 walnut_veneer grey_oak_veneer_01 fabric_leather_02 concrete_tile_facade painted_plaster_wall'''.split()
HDRIS = ['kloofendal_38d_partly_cloudy_puresky']


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


def model(aid):
    f = files(aid)['gltf']['1k']['gltf']
    d = os.path.join(OUT, 'models', aid)
    get(f['url'], os.path.join(d, f'{aid}.gltf'))
    for rel, inc in f.get('include', {}).items():
        get(inc['url'], os.path.join(d, rel))
    return aid


def texture(aid):
    f = files(aid)
    res = '2k' if aid in ('herringbone_parquet', 'marble_01', 'square_tiled_wall', 'red_brick_03', 'concrete_pavers') else '1k'
    keymap = {'diff': ['Diffuse', 'diff'], 'nor_gl': ['nor_gl'], 'rough': ['Rough', 'rough'], 'arm': ['arm']}
    got = []
    for out, keys in keymap.items():
        for k in keys:
            if k in f and res in f[k]:
                get(f[k][res]['jpg']['url'], os.path.join(OUT, 'tex', aid, f'{out}.jpg'))
                got.append(out)
                break
    return aid, got


def hdri(aid):
    f = files(aid)['hdri']['2k']['hdr']
    get(f['url'], os.path.join(OUT, 'hdri', aid + '.hdr'))
    return aid


if __name__ == '__main__':
    with cf.ThreadPoolExecutor(8) as ex:
        futs = [ex.submit(model, m) for m in MODELS] + [ex.submit(texture, t) for t in TEXTURES] + [ex.submit(hdri, h) for h in HDRIS]
        for fu in cf.as_completed(futs):
            try:
                print('ok', fu.result(), flush=True)
            except Exception as e:
                print('FAIL', repr(e), flush=True)
