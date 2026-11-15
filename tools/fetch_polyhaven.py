"""Download Poly Haven (CC0) models / textures / HDRIs into game/assets.
Run from game/:  python -I tools/fetch_polyhaven.py
"""
import json, os, urllib.request, concurrent.futures as cf
opener = urllib.request.build_opener(); opener.addheaders = [('User-Agent', 'Mozilla/5.0 (asset-fetch)')]; urllib.request.install_opener(opener)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets')
API = 'https://api.polyhaven.com/files/'

MODELS = '''metal_office_desk mid_century_lounge_chair modern_arm_chair_01 modern_ceiling_lamp_01 modern_coffee_table_01
potted_plant_01 potted_plant_02 potted_plant_04 calathea_orbifolia_01 island_tree_01 island_tree_02 jacaranda_tree tree_small_02
shrub_01 shrub_02 wall_clock office_notepads stationery_supplies binder_notebook clipboard decorative_book_set_01
desk_lamp_arm_01 drawer_cabinet modular_street_seating fire_hydrant classic_laptop planter_box_01 utility_box_01
steel_frame_shelves_01 side_table_01 fir_tree_01'''.split()
TEXTURES = '''marble_tiles large_floor_tiles_02 grey_oak_veneer_01 walnut_veneer concrete_pavers asphalt_02 concrete_tile_facade
white_plaster_02 fabric_leather_02 brushed_concrete herringbone_pavement_03 fabric_pattern_07 painted_plaster_wall'''.split()
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
    res = '2k' if aid in ('marble_tiles', 'grey_oak_veneer_01', 'walnut_veneer', 'concrete_pavers') else '1k'
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
