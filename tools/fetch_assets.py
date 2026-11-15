"""Download Rocketbox avatars (facial FBX + textures) and animations, convert TGA -> JPG.
Run: python -I tools/fetch_assets.py   (from game/)
Source: https://github.com/microsoft/Microsoft-Rocketbox (MIT license)
"""
import json, os, sys, urllib.request, concurrent.futures as cf
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, '_src')
OUT = os.path.join(ROOT, 'assets')
API = 'https://api.github.com/repos/microsoft/Microsoft-Rocketbox/contents/'
RAW = 'https://raw.githubusercontent.com/microsoft/Microsoft-Rocketbox/master/'

# avatar -> texture size (main cast gets 2k heads for close-ups)
AVATARS = {
    'Male_Adult_03': 'main',   # player
    'Female_Adult_09': 'main', # Nadia Farouk
    'Male_Adult_08': 'main',   # Ryan Cole
    'Female_Adult_15': 'main', # Mei Lin
    'Male_Adult_07': 'main',   # Omar Saleh
    'Female_Adult_14': 'main', # Grace Owens
    'Female_Adult_11': 'main', # secretary
    'Female_Adult_01': 'main', # Hana (video call)
    'Female_Adult_05': 'npc', 'Male_Adult_02': 'npc', 'Male_Adult_14': 'npc',
    'Female_Adult_04': 'npc', 'Male_Adult_12': 'npc', 'Female_Adult_13': 'npc',
    'Female_Adult_02': 'npc', 'Male_Adult_05': 'npc', 'Male_Adult_10': 'npc', 'Female_Adult_07': 'npc',
}
ANIMS_STATIC = '''m_idle_neutral_01 m_idle_neutral_02 m_idle_neutral_03 m_gestic_talk_neutral_01 m_gestic_talk_neutral_02
m_gestic_talk_relaxed_01 m_gestic_talk_excited_01 m_gestic_talk_nervous_01 m_gestic_listen_neutral_01 m_gestic_listen_accept_01
m_gestic_listen_deny_01 m_gestic_thoughtful_01 m_cell_phone_talk_01 m_work_table m_sit_chair_idle_neutral_01
m_sit_table_idle_neutral_01 m_sit_table_gestic_thoughtful m_sit_table_idle_nervous_01 m_sit_table_breathe_01 m_claphands_01 m_cheer_03
m_idle_nervous_01 m_knock_door m_documents_idle m_gestic_presentation_right_01 m_gestic_shrug_01 m_idle_look_around_01
m_gestic_listen_nervous_01 m_sit_chair_idle_nervous_01
f_idle_neutral_01 f_idle_neutral_02 f_gestic_talk_neutral_01 f_gestic_talk_neutral_02 f_gestic_talk_excited_01
f_gestic_talk_relaxed_01 f_gestic_listen_neutral_01 f_gestic_listen_accept_01 f_gestic_thoughtful_01 f_sit_table_idle_neutral_01
f_sit_table_gestic_thoughtful f_sit_table_breathe_01 f_sit_chair_idle_neutral_01 f_claphands_01 f_cheer_03 f_idle_nervous_03
f_knock_door f_documents_idle f_cell_phone_textmessage f_work_table f_gestic_presentation_right_01 f_gestic_listen_nervous_01
f_moderate_01 f_gestic_talk_self-assured_01 f_gestic_shrug_01 f_invite_sit
m_gestic_talk_sad_01 m_gestic_talk_cool m_gestic_listen_excited_01 m_gestic_listen_sad_01 m_gestic_listen_angry_01 m_gestic_laugh_low
m_idle_angry_01 m_cell_phone_listen_01 m_documents_take m_documents_check m_documents_note m_drink_drinking m_drink_idle
m_gestic_presentation_left_01 m_wave_01 m_idle_breathe_01 m_idle_scratch_head_01 m_gestic_listen_accept_02 m_gestic_listen_deny_02
f_gestic_talk_angry_01 f_gestic_talk_femalestressed_01 f_gestic_talk_sad_01 f_gestic_talk_nervous_01 f_gestic_talk_excited_02
f_gestic_listen_excited_01 f_gestic_listen_deny_01 f_gestic_listen_sad_01 f_gestic_laugh_low f_idle_breathe_01 f_drink_drinking
f_documents_check f_gestic_presentation_left_01 f_wave_01 f_gestic_listen_accept_02 f_cell_phone_textmessage
m_sit_table_gestic_shrug_01 m_sit_table_gestic_shrug_02 f_sit_table_gestic_shrug_01 f_sit_table_gestic_shrug_02 m_gestic_listen_deny_02 f_gestic_listen_deny_02 m_gestic_shrug_02 f_gestic_shrug_02'''.split()
ANIMS_XY = 'm_walk_neutral_01 m_run_neutral_01 m_walk_stroll_01 f_walk_neutral_01 f_walk_stroll_01 f_walk_self-assured m_walk_fast_01 f_walk_fast_01 m_walk_cool_01 f_walk_cool_01'.split()


def get(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 1000:
        return path
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + '.part'
    with urllib.request.urlopen(url, timeout=300) as r, open(tmp, 'wb') as f:
        while True:
            b = r.read(1 << 20)
            if not b:
                break
            f.write(b)
    os.replace(tmp, path)
    return path


def listdir(p):
    with urllib.request.urlopen(API + p, timeout=60) as r:
        return [x['name'] for x in json.load(r)]


def conv(tga, jpg, size, png=False):
    if os.path.exists(jpg):
        return
    im = Image.open(tga)
    im = im.convert('RGBA' if png else 'RGB')
    im = im.resize((size, size), Image.LANCZOS)
    os.makedirs(os.path.dirname(jpg), exist_ok=True)
    if png:
        im.save(jpg, optimize=True)
    else:
        im.save(jpg, quality=88, optimize=True)


def avatar(name, tier):
    base = f'Assets/Avatars/Adults/{name}/'
    fbx = get(RAW + base + f'Export/{name}_facial.fbx', os.path.join(SRC, 'avatars', name, f'{name}_facial.fbx'))
    texs = [t for t in listdir(base + 'Textures') if t.endswith('.tga') and ' ' not in t]
    out = []
    for t in texs:
        kind = t.split('_', 1)[1].rsplit('.', 1)[0]  # body_color, head_normal ...
        if kind.endswith('specular') or 'wrinkle' in kind:
            continue
        if tier == 'npc' and kind.endswith('normal') and kind.startswith('body'):
            continue
        src = get(RAW + base + 'Textures/' + t, os.path.join(SRC, 'avatars', name, t))
        size = 2048 if (tier == 'main' and kind.startswith('head')) else (1024 if tier == 'main' else 512)
        if kind == 'opacity_color':
            size = 1024 if tier == 'main' else 512
            conv(src, os.path.join(OUT, 'avatars', name, kind + '.png'), size, png=True)
        else:
            conv(src, os.path.join(OUT, 'avatars', name, kind + '.jpg'), size)
        out.append(kind)
    import shutil
    dst = os.path.join(OUT, 'avatars', name, 'model.fbx')
    if not os.path.exists(dst):
        shutil.copy(fbx, dst)
    return name, out


def anim(folder, n):
    return get(RAW + f'Assets/Animations/{folder}/{n}.max.fbx', os.path.join(SRC, 'anims', n + '.fbx'))


if __name__ == '__main__':
    with cf.ThreadPoolExecutor(8) as ex:
        futs = [ex.submit(avatar, n, t) for n, t in AVATARS.items()]
        futs += [ex.submit(anim, 'all_animations_max_motextr_static', n) for n in ANIMS_STATIC]
        futs += [ex.submit(anim, 'all_animations_max_motextr_xy', n) for n in ANIMS_XY]
        for f in cf.as_completed(futs):
            try:
                print('ok', f.result(), flush=True)
            except Exception as e:
                print('FAIL', e, flush=True)
