"""Download the operating-room models (all CC-BY) from Sketchfab as glTF and unpack them into assets/or_models/<slug>/.
Sketchfab only serves downloads to a signed-in account: put your API token (sketchfab.com/settings/password → API token)
in .env.local as  SKETCHFAB_TOKEN=xxxx  (the file is git-ignored), then run from the repo root:
    python -I tools/fetch_sketchfab.py
"""
import io, json, os, sys, urllib.request, zipfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS = {   # slug: (uid, author, title)  — every one CC Attribution; credits are written to assets/or_models/CREDITS.json
    'heart_realistic': ('3f8072336ce94d18b3d0d055a1ece089', 'neshallads', 'Realistic Human Heart'),
    'instruments': ('2971a44d334b45ff926792e92a6bcee7', 'ferofluid', 'SURGICAL INSTRUMENT'),
    'anesthesia': ('6b28fafc23244ef9a47e84dbde09b5a4', 'kkso199', 'Anesthesia Machine on a Medical Cart'),
    'heartlung': ('34f7d192bd8d4ca498b5e3d4948101ba', 'kevingille', 'Heartlung Machine'),
    'ivpole': ('76521e2f71704b1986cf5ac54368b14f', 'Mountrise', 'IV Pole'),
    'cart': ('2a0a574f9e374702af8c415fce296f45', 'NicolasVB', 'Medical Cart'),
    'optable': ('e3a4512227d34b098e2ef0d11c8a80fd', 'shashkinv1ad', 'Operating Table'),
    'scalpels': ('219198b5a6a34f87bdc417e2706f9482', 'sousinho', 'Pair of Scalpels'),
    'fphands': ('547a45535f0c4fe787948f7a7a6a88db', '', 'First Person hands rigged'),
    'surgeon': ('79e23af07d1243c789b3372c6ec72c27', '', 'Male surgical doctor working'),
    'nurse': ('0abc982946cf445fa6c0b68a20e1514f', '', 'Nurse Surgical Rigged'),
    'retractor_hand': ('39b64baa59fd4acfb8adf68fec0186de', '', 'Retractor V1'),
    'trolley': ('7a520914b8cd429fb5972b01ee219814', '', 'Laboratory / Hospital Troly'),
    'needleholder': ('24864e4443df42f5b1439eea4631f136', '', 'Surgical_needle Holder'),
    'basic_instr': ('fde4da61ef8041688ae6a7a792260d15', '', 'Basic surgical instruments'),
}


def token():
    t = os.environ.get('SKETCHFAB_TOKEN')
    p = os.path.join(ROOT, '.env.local')
    if not t and os.path.exists(p):
        for l in open(p, encoding='utf8'):
            if l.strip().startswith('SKETCHFAB_TOKEN='):
                t = l.split('=', 1)[1].strip()
    if not t:
        sys.exit('no SKETCHFAB_TOKEN (env or .env.local)')
    return t


def main():
    tok = token(); out = os.path.join(ROOT, 'assets', 'or_models'); credits = {}
    for slug, (uid, author, title) in MODELS.items():
        dest = os.path.join(out, slug)
        if os.path.exists(os.path.join(dest, 'scene.gltf')) or os.path.exists(os.path.join(dest, 'model.gltf')):
            print('have', slug); credits[slug] = [title, author, f'https://sketchfab.com/3d-models/{uid}', 'CC BY 4.0']; continue
        req = urllib.request.Request(f'https://api.sketchfab.com/v3/models/{uid}/download', headers={'Authorization': f'Token {tok}'})
        try:
            info = json.load(urllib.request.urlopen(req, timeout=60))
        except Exception as e:
            print('FAIL', slug, e); continue
        url = info['gltf']['url']
        if not author:
            try: author = json.load(urllib.request.urlopen(f'https://api.sketchfab.com/v3/models/{uid}', timeout=30))['user']['username']
            except Exception: author = '?'
        data = urllib.request.urlopen(url, timeout=600).read()
        z = zipfile.ZipFile(io.BytesIO(data)); os.makedirs(dest, exist_ok=True)
        for n in z.namelist():
            if n.endswith('/') or '..' in n or n.startswith('/'):
                continue
            p = os.path.join(dest, n); os.makedirs(os.path.dirname(p), exist_ok=True)
            with open(p, 'wb') as f: f.write(z.read(n))
        credits[slug] = [title, author, f'https://sketchfab.com/3d-models/{uid}', 'CC BY 4.0']
        print('ok', slug, len(data) // 1024, 'KB', flush=True)
    credits['bp3d_heart'] = ['BodyParts3D heart and great vessels', 'The Database Center for Life Science', 'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/', 'CC BY 4.0']
    json.dump(credits, open(os.path.join(out, 'CREDITS.json'), 'w', encoding='utf8'), indent=1, ensure_ascii=False)


main()
