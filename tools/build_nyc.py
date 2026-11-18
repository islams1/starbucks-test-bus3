"""Build the New York scenery for the Flight 1549 game from free, open data (no API key):
  * aerial photos: USGS The National Map orthoimagery (NAIP based, public domain) — z16 tiles over the core,
    z12 for a wide outer ring;
  * elevation: USGS 3DEP (public domain) — the Hudson is hydro-flattened (≈ −0.6 m), which also gives the water mask;
  * buildings: OpenStreetMap (© OpenStreetMap contributors, ODbL) footprints with their surveyed heights.
Everything is written in a local frame: metres, origin ORIGIN (lat, lon), x east, y up, z south (−z = north).
Downloads are cached in _src/nyc/. Run from the repo root:  python -I tools/build_nyc.py [fetch|build|all]
"""
import concurrent.futures as cf, io, json, math, os, struct, sys, time, urllib.parse, urllib.request
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, '_src', 'nyc'); OUT = os.path.join(ROOT, 'assets', 'nyc')
ORIGIN = (40.82, -73.955)
LAT0, LAT1, LON0, LON1 = 40.735, 40.905, -74.075, -73.835          # the core: everything the flight passes over
MLAT = 111132.0; MLON = 111320.0 * math.cos(math.radians(ORIGIN[0]))
UA = {'User-Agent': 'edu-flight-scenery-builder/1.0'}
TILE_URL = 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}'
DEM_URL = 'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage'
OVERPASS = 'https://overpass-api.de/api/interpreter'
GT = 4                     # ground tiles per side over the core
GPX = 2048                 # ground texture size
DEM_RES = 20.0             # m
MESH_RES = 40.0            # m


def local(lat, lon):
    return (np.asarray(lon) - ORIGIN[1]) * MLON, -(np.asarray(lat) - ORIGIN[0]) * MLAT


def tile_xy(lat, lon, z):
    n = 2 ** z; x = (lon + 180) / 360 * n
    y = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n
    return x, y


def tile_lat(y, z):
    n = math.pi - 2 * math.pi * y / 2 ** z
    return math.degrees(math.atan(math.sinh(n)))


def get(url, data=None, tries=4, timeout=120):
    for k in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers=UA)
            return urllib.request.urlopen(req, timeout=timeout).read()
        except Exception as e:
            if k == tries - 1: raise
            time.sleep(2 + 3 * k)


# ---------------------------------------------------------------- fetch
def fetch_tiles(z, lat0, lat1, lon0, lon1):
    x0, y0 = tile_xy(lat1, lon0, z); x1, y1 = tile_xy(lat0, lon1, z)
    xs, ys = range(int(x0), int(x1) + 1), range(int(y0), int(y1) + 1)
    d = os.path.join(CACHE, f'tiles{z}'); os.makedirs(d, exist_ok=True)
    jobs = [(x, y) for y in ys for x in xs if not os.path.exists(os.path.join(d, f'{x}_{y}.jpg'))]
    print(f'z{z}: {len(xs)}x{len(ys)} tiles, {len(jobs)} to fetch', flush=True)
    def one(xy):
        x, y = xy; b = get(TILE_URL.format(z=z, x=x, y=y))
        if b[:3] != b'\xff\xd8\xff': b = b''
        open(os.path.join(d, f'{x}_{y}.jpg'), 'wb').write(b)
    with cf.ThreadPoolExecutor(6) as ex: list(ex.map(one, jobs))
    return xs, ys


def fetch_dem():
    p = os.path.join(CACHE, 'dem.npy')
    if os.path.exists(p): return np.load(p)
    W = int((LON1 - LON0) * MLON / DEM_RES); H = int((LAT1 - LAT0) * MLAT / DEM_RES)
    # one request (bands fetched separately came back with slightly different extents: the river jumped at the seams).
    # In EPSG:4326 the server keeps pixels square IN DEGREES and widens the box to fit the requested size: asking for
    # metre-square pixels made it return 40.708-40.932 instead of 40.735-40.905, and the river moved ~500 m. So ask for
    # degree-square pixels (the box comes back exactly), check it, then resample to the metre grid.
    step = DEM_RES / MLAT
    w, h = round((LON1 - LON0) / step), round((LAT1 - LAT0) / step)
    base = {'bbox': f'{LON0},{LAT0},{LON1},{LAT1}', 'bboxSR': 4326, 'imageSR': 4326, 'size': f'{w},{h}', 'format': 'tiff', 'pixelType': 'F32'}
    ext = json.loads(get(DEM_URL + '?' + urllib.parse.urlencode({**base, 'f': 'json'})))['extent']
    assert abs(ext['ymin'] - LAT0) < 1e-4 and abs(ext['ymax'] - LAT1) < 1e-4 and abs(ext['xmin'] - LON0) < 1e-3, ext
    q = urllib.parse.urlencode({**base, 'interpolation': 'RSP_BilinearInterpolation', 'f': 'image'})
    a = np.array(Image.open(io.BytesIO(get(DEM_URL + '?' + q, timeout=600)))).astype(np.float32)
    from scipy import ndimage
    a = ndimage.zoom(a, (H / a.shape[0], W / a.shape[1]), order=1)
    print('dem', a.shape, ext, flush=True)
    np.save(p, a); return a


def fetch_buildings():
    d = os.path.join(CACHE, 'osm'); os.makedirs(d, exist_ok=True)
    step = 0.03; jobs = []
    la = LAT0
    while la < LAT1 - 1e-9:
        lo = LON0
        while lo < LON1 - 1e-9:
            jobs.append((round(la, 4), round(lo, 4), round(min(la + step, LAT1), 4), round(min(lo + step, LON1), 4))); lo += step
        la += step
    for (a, b, c, e) in jobs:
        p = os.path.join(d, f'{a}_{b}.json')
        if os.path.exists(p): continue
        q = f'[out:json][timeout:180];way["building"]({a},{b},{c},{e});out tags geom;'
        for k in range(5):
            try:
                raw = get(OVERPASS, data=urllib.parse.urlencode({'data': q}).encode(), tries=1, timeout=240); json.loads(raw); break
            except Exception as ex:
                print('overpass retry', k, ex, flush=True); time.sleep(20 + 20 * k)
        open(p, 'wb').write(raw); print('osm', a, b, len(raw) // 1024, 'KB', flush=True); time.sleep(2)


# ---------------------------------------------------------------- build
def mosaic(z, xs, ys):
    d = os.path.join(CACHE, f'tiles{z}')
    im = Image.new('RGB', (len(xs) * 256, len(ys) * 256), (70, 80, 85))
    for j, y in enumerate(ys):
        for i, x in enumerate(xs):
            p = os.path.join(d, f'{x}_{y}.jpg')
            if os.path.exists(p) and os.path.getsize(p) > 0:
                try: im.paste(Image.open(p).convert('RGB'), (i * 256, j * 256))
                except Exception: pass
    return im


def winter(a):
    """mid-January: bare trees, dormant lawns — pull the summer greens towards browns and greys"""
    f = a.astype(np.float32) / 255
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    green = np.clip((g - np.maximum(r, b)) * 6, 0, 1)
    lum = 0.3 * r + 0.59 * g + 0.11 * b
    tgt = np.stack([lum * 1.05 + 0.03, lum * 0.95 + 0.02, lum * 0.85], -1)      # dry, greyish brown
    f = f * (1 - green[..., None] * 0.85) + tgt * green[..., None] * 0.85
    f = (f - 0.5) * 0.92 + 0.5 - 0.02                                            # a little hazier, flatter winter light
    return (np.clip(f, 0, 1) * 255).astype(np.uint8)


def reproject(mos, z, xs, ys, lat0, lat1, lon0, lon1, W, H):
    """web-mercator mosaic → an equal-metre grid (row 0 = north)"""
    lats = lat1 - (np.arange(H) + 0.5) / H * (lat1 - lat0)
    lons = lon0 + (np.arange(W) + 0.5) / W * (lon1 - lon0)
    px = ((lons + 180) / 360 * 2 ** z - xs[0]) * 256
    py = ((1 - np.log(np.tan(np.radians(lats)) + 1 / np.cos(np.radians(lats))) / np.pi) / 2 * 2 ** z - ys[0]) * 256
    a = np.asarray(mos)
    X, Y = np.meshgrid(px, py)
    x0 = np.clip(np.floor(X).astype(int), 0, a.shape[1] - 2); y0 = np.clip(np.floor(Y).astype(int), 0, a.shape[0] - 2)
    fx = np.clip(X - x0, 0, 1)[..., None]; fy = np.clip(Y - y0, 0, 1)[..., None]
    o = (a[y0, x0] * (1 - fx) * (1 - fy) + a[y0, x0 + 1] * fx * (1 - fy) + a[y0 + 1, x0] * (1 - fx) * fy + a[y0 + 1, x0 + 1] * fx * fy)
    return o.astype(np.uint8)


def write_bin(path, arrays):
    """tiny container: json header (names, dtypes, shapes) + raw little-endian arrays"""
    head = []; blobs = []; off = 0
    for name, a in arrays:
        a = np.ascontiguousarray(a); b = a.tobytes(); head.append({'name': name, 'dtype': str(a.dtype), 'shape': list(a.shape), 'offset': off, 'bytes': len(b)})
        blobs.append(b); off += len(b); pad = (-off) % 4; blobs.append(b'\0' * pad); off += pad
    hj = json.dumps(head).encode(); hj += b' ' * ((-len(hj)) % 4)
    with open(path, 'wb') as f: f.write(struct.pack('<I', len(hj))); f.write(hj); [f.write(b) for b in blobs]


def build():
    os.makedirs(OUT, exist_ok=True)
    meta = {'origin': ORIGIN, 'mlat': MLAT, 'mlon': MLON, 'core': [LAT0, LAT1, LON0, LON1], 'tiles': GT,
            'credits': ['Imagery: USGS The National Map (USDA NAIP), public domain', 'Elevation: USGS 3DEP, public domain',
                        'Buildings: © OpenStreetMap contributors (ODbL)']}
    cx0, cz1 = local(LAT0, LON0); cx1, cz0 = local(LAT1, LON1)
    meta['coreXZ'] = [float(cx0), float(cz0), float(cx1), float(cz1)]
    # --- ground photo, core
    xs, ys = fetch_tiles(16, LAT0, LAT1, LON0, LON1)
    mos = mosaic(16, xs, ys)
    small = np.zeros((GT * 512, GT * 512, 3), np.uint8)                 # a 4x smaller copy for roof colours
    for j in range(GT):
        for i in range(GT):
            la1 = LAT1 - (LAT1 - LAT0) * j / GT; la0 = LAT1 - (LAT1 - LAT0) * (j + 1) / GT
            lo0 = LON0 + (LON1 - LON0) * i / GT; lo1 = LON0 + (LON1 - LON0) * (i + 1) / GT
            t = winter(reproject(mos, 16, xs, ys, la0, la1, lo0, lo1, GPX, GPX))
            Image.fromarray(t).save(os.path.join(OUT, f'ground_{i}_{j}.jpg'), quality=80, optimize=True)
            small[j * 512:(j + 1) * 512, i * 512:(i + 1) * 512] = np.asarray(Image.fromarray(t).resize((512, 512), Image.BILINEAR))
    full = small; del mos
    print('ground photos written', flush=True)
    # --- outer ring: 90 km square, low resolution
    OL0, OL1, OO0, OO1 = ORIGIN[0] - 0.42, ORIGIN[0] + 0.42, ORIGIN[1] - 0.56, ORIGIN[1] + 0.56
    oxs, oys = fetch_tiles(12, OL0, OL1, OO0, OO1)
    outer = winter(reproject(mosaic(12, oxs, oys), 12, oxs, oys, OL0, OL1, OO0, OO1, 2048, 2048))
    Image.fromarray(outer).save(os.path.join(OUT, 'outer.jpg'), quality=78, optimize=True)
    ox0, oz1 = local(OL0, OO0); ox1, oz0 = local(OL1, OO1); meta['outerXZ'] = [float(ox0), float(oz0), float(ox1), float(oz1)]
    # --- terrain from the DEM: a height grid per ground tile (water hydro-flattened → below the water plane)
    dem = fetch_dem(); H, W = dem.shape
    water = dem < 0.3                                   # hydro-flattened: the Hudson at −0.6 m, the East River, the Harlem and Flushing Bay at 0
    from scipy import ndimage
    # pull the river bed down so the water plane covers it; keep shores at least 1 m above the water
    h = np.where(water, -4.0, np.maximum(dem, 1.0))
    h = np.where(~water & ndimage.binary_dilation(water, iterations=1), np.maximum(dem, 0.6), h)
    nx = int(round((cx1 - cx0) / MESH_RES)) + 1; nz = int(round((cz1 - cz0) / MESH_RES)) + 1
    gx = np.linspace(0, W - 1, nx); gz = np.linspace(0, H - 1, nz)
    hm = ndimage.map_coordinates(h, np.meshgrid(gz, gx, indexing='ij'), order=1).astype(np.float32)   # [nz, nx], row 0 = north
    write_bin(os.path.join(OUT, 'terrain.bin'), [('h', hm)])
    meta['terrain'] = {'nx': nx, 'nz': nz}
    wm = Image.fromarray((ndimage.zoom(water.astype(np.float32), (1024 / H, 1024 / W), order=1) * 255).astype(np.uint8))
    wm.save(os.path.join(OUT, 'water_mask.png'))
    print('terrain', hm.shape, flush=True)
    # --- buildings
    build_buildings(meta, dem, full)
    json.dump(meta, open(os.path.join(OUT, 'meta.json'), 'w'), indent=1)
    print('meta written')


# towers in the area that were finished after January 2009 (most OpenStreetMap entries carry no date)
POST_2009 = ['Central Park Tower', '432 Park', 'One Vanderbilt', 'Hudson Yards', 'The Torch', '53 West 53', 'The Spiral',
             '520 5th Avenue', 'Manhattan West', '220 Central Park South', '425 Park Avenue', '262 Fifth Avenue', 'Sutton 58',
             '343 Madison', '138 East 50th', 'Casoni', '520 Park Avenue', '45 East 22nd', 'Queens Plaza Park', 'Sky', 'Tower 28',
             'Hotel Meta', 'Rose Hill', '601 West 29th', 'One Madison', 'Eventi', '555Ten', 'Gotham Point', 'Monogram',
             'Hawthorn Park', 'Eagle Lofts', '5203 Center', 'The Set', '28-30 Jackson', 'Ritz-Carlton', 'Lyra', 'Turkish House',
             'Summit', 'One57', '111 West 57', 'Steinway Tower', 'One Manhattan Square', 'Brooklyn Tower', '35 Hudson',
             'One World Trade', '3 World Trade', '4 World Trade', '7 World Trade', 'Via 57', 'VIA 57', 'Vessel',
             '15 Hudson', '10 Hudson', '50 Hudson', '55 Hudson', '30 Hudson', 'Waterline Square', 'Riverside Center',
             'The Eugene', 'Nova', 'Halletts Point', 'Skyline Tower', 'Jackson Park', 'Hunters Point South', 'The Bryant',
             'One Wall Street', 'Lantern House', 'One West End', 'Fifteen Hudson', 'Two Waterline', 'One Waterline',
             'Three Waterline', '200 Amsterdam', '50 West 66', 'Park Loggia', '15 West 61']

def build_buildings(meta, dem, photo):
    import shapely.geometry as sg, mapbox_earcut as earcut
    d = os.path.join(CACHE, 'osm'); seen = set(); B = []
    track = json.load(open(os.path.join(ROOT, '_src', 'f1549', 'ntsb', 'track.json')))
    tx, tz = local(np.array(track['lat']), np.array(track['lon']))
    tpts = np.c_[tx, tz]
    H, W = dem.shape; cx0, cz0, cx1, cz1 = meta['coreXZ']
    for fn in sorted(os.listdir(d)):
        for e in json.load(open(os.path.join(d, fn), encoding='utf8')).get('elements', []):
            if e['id'] in seen or 'geometry' not in e: continue
            seen.add(e['id']); t = e.get('tags', {})
            if t.get('building') in ('roof', 'construction', 'ruins') or t.get('location') == 'underground': continue
            # January 2009: leave out what was built later (OpenStreetMap is today's city)
            sd = str(t.get('start_date') or t.get('building:start_date') or t.get('construction_date') or '')
            if sd[:4].isdigit() and int(sd[:4]) > 2009: continue
            nm = t.get('name', '')
            if any(k.lower() in nm.lower() for k in POST_2009): continue
            g = e['geometry']; lat = np.array([p['lat'] for p in g]); lon = np.array([p['lon'] for p in g])
            if len(lat) < 4: continue
            x, z = local(lat, lon)
            try: hgt = float(str(t.get('height', '')).split()[0].replace('m', ''))
            except Exception: hgt = None
            if not hgt:
                try: hgt = float(t.get('building:levels')) * 3.3 + 1
                except Exception: hgt = None
            poly = sg.Polygon(np.c_[x, z])
            if not poly.is_valid: poly = poly.buffer(0)
            if poly.is_empty or poly.geom_type != 'Polygon': continue
            area = poly.area
            if area < 40: continue
            if not hgt: hgt = 9 if area < 300 else 14
            if nm == '270 Park Avenue': hgt = 215.0                  # the Union Carbide building stood there until 2019
            minh = 0.0
            try: minh = float(str(t.get('min_height', '0')).split()[0])
            except Exception: pass
            c = poly.centroid; dist = np.min(np.hypot(tpts[:, 0] - c.x, tpts[:, 1] - c.y))
            # what can be seen from the flight: everything tall; mid-size near the track; small houses only close in
            if not (hgt >= 25 or (area >= 250 and dist < 2500) or (dist < 900 and area >= 80)): continue
            B.append((poly.simplify(1.2, preserve_topology=True), hgt, minh, area, dist, t.get('building', 'yes')))
    print('buildings kept', len(B), 'of', len(seen), flush=True)
    # ground height under each building (DEM), roof colour from the photo
    full = photo; FH, FW = full.shape[:2]
    def ground_at(x, z):
        u = (x - cx0) / (cx1 - cx0) * (W - 1); v = (z - cz0) / (cz1 - cz0) * (H - 1)
        return float(dem[int(np.clip(v, 0, H - 1)), int(np.clip(u, 0, W - 1))])
    def photo_at(x, z):
        u = (x - cx0) / (cx1 - cx0) * (FW - 1); v = (z - cz0) / (cz1 - cz0) * (FH - 1)
        return full[int(np.clip(v, 0, FH - 1)), int(np.clip(u, 0, FW - 1))]
    tiles = {}
    rng = np.random.default_rng(7)

    def ring(poly):
        ext = np.array(poly.exterior.coords)[:-1]
        if len(ext) < 3: return None
        sgn = np.sum(ext[:, 0] * np.roll(ext[:, 1], -1) - np.roll(ext[:, 0], -1) * ext[:, 1])
        return ext[::-1] if sgn > 0 else ext                     # CCW in x/z: walls face outwards

    def prism(T, ext, base, top, style, tint, roof_c, uv0=0.0):
        """walls (textured with a facade style, or plain when style < 0) and a flat roof"""
        per = 0.0; n = len(ext)
        for k in range(n):
            a_, b_ = ext[k], ext[(k + 1) % n]
            L = float(np.hypot(*(b_ - a_)))
            if L < 0.3: continue
            nx_, nz_ = (b_[1] - a_[1]) / L, -(b_[0] - a_[0]) / L
            v0 = len(T['p']) // 3
            for (px, pz), py, uu in (((a_[0], a_[1]), base, per), ((b_[0], b_[1]), base, per + L), ((b_[0], b_[1]), top, per + L), ((a_[0], a_[1]), top, per)):
                T['p'] += [px, py, pz]; T['n'] += [nx_, 0, nz_]
                T['uv'] += ([uu / 12.0 + style * 1000, (py - base) / 3.4 + uv0] if style >= 0 else [-1.0, -1.0]); T['c'] += list(tint)
            T['idx'] += [v0, v0 + 1, v0 + 2, v0, v0 + 2, v0 + 3]
            per += L
        try: tri = earcut.triangulate_float64(ext.astype(np.float64), np.array([len(ext)], dtype=np.uint32))
        except Exception: return
        v0 = len(T['p']) // 3
        for (px, pz) in ext:
            T['p'] += [px, top, pz]; T['n'] += [0, 1, 0]; T['uv'] += [-1.0, -1.0]; T['c'] += list(roof_c)
        T['idx'] += [v0 + int(q) for q in tri]

    def cyl(T, cx, cz, r, base, top, col, sides=8, cone=0.0):
        ext = np.array([[cx + r * np.cos(a), cz + r * np.sin(a)] for a in np.linspace(0, 2 * np.pi, sides, endpoint=False)])
        prism(T, ring(sg.Polygon(ext)), base, top, -1, col, col * 0.85)
        if cone:                                                  # the conical cap of a water tank
            v0 = len(T['p']) // 3; T['p'] += [cx, top + cone, cz]; T['n'] += [0, 1, 0]; T['uv'] += [-1.0, -1.0]; T['c'] += list(col * 0.8)
            for k in range(sides):
                a0 = 2 * np.pi * k / sides; T['p'] += [cx + r * 1.08 * np.cos(a0), top, cz + r * 1.08 * np.sin(a0)]; T['n'] += [np.cos(a0) * 0.6, 0.8, np.sin(a0) * 0.6]; T['uv'] += [-1.0, -1.0]; T['c'] += list(col * 0.75)
            for k in range(sides): T['idx'] += [v0, v0 + 1 + (k + 1) % sides, v0 + 1 + k]

    # New York materials, muted as they read from the air on a hazy winter afternoon
    pal = {0: [(0.45, 0.31, 0.26), (0.40, 0.29, 0.25), (0.52, 0.37, 0.30), (0.66, 0.62, 0.55), (0.58, 0.50, 0.42)],   # brick, brownstone, limestone
           1: [(0.68, 0.65, 0.58), (0.58, 0.58, 0.56), (0.50, 0.38, 0.31), (0.64, 0.61, 0.54), (0.48, 0.48, 0.47)],   # limestone, concrete
           2: [(0.42, 0.48, 0.54), (0.52, 0.56, 0.60), (0.60, 0.58, 0.53), (0.46, 0.52, 0.55)],                       # glass and steel
           3: [(0.24, 0.27, 0.30), (0.30, 0.33, 0.36), (0.36, 0.39, 0.41)]}                                           # dark glass
    for poly, hgt, minh, area, dist, kind in B:
        ext = ring(poly)
        if ext is None: continue
        c = poly.centroid
        g0 = max(ground_at(c.x, c.y), 0.0)
        base = g0 + minh; top = g0 + hgt
        if top - base < 2: continue
        i = int(np.clip((c.x - cx0) / (cx1 - cx0) * GT, 0, GT - 1)); j = int(np.clip((c.y - cz0) / (cz1 - cz0) * GT, 0, GT - 1))
        T = tiles.setdefault((i, j), {'p': [], 'n': [], 'uv': [], 'c': [], 'idx': [], 'n_v': 0})
        style = 2 if hgt > 120 else (int(rng.choice([1, 2, 3, 1])) if hgt > 50 else (int(rng.choice([0, 0, 1])) if hgt > 18 else 0))
        roof = np.clip(photo_at(c.x, c.y).astype(np.float32) / 255 * 0.85 + 0.03, 0, 1)
        tint = np.clip(np.array(pal[style][rng.integers(len(pal[style]))]) * (0.88 + 0.22 * rng.random()), 0, 1)
        # towers step back as they rise (the zoning "wedding cake"); a few mid-rises have one setback
        tiers = [(poly, base, top)]
        side = np.sqrt(area)
        if hgt > 60 and area > 500 and minh == 0:
            t1, t2 = g0 + hgt * rng.uniform(0.45, 0.62), g0 + hgt * rng.uniform(0.75, 0.88)
            p2 = poly.buffer(-min(9.0, side * 0.12), join_style=2); p3 = poly.buffer(-min(16.0, side * 0.22), join_style=2)
            tiers = [(poly, base, t1)]
            if not p2.is_empty and p2.geom_type == 'Polygon' and p2.area > 80: tiers.append((p2, t1, t2))
            if not p3.is_empty and p3.geom_type == 'Polygon' and p3.area > 50: tiers.append((p3, tiers[-1][2], top))
            elif len(tiers) == 2: tiers[-1] = (p2, t1, top)
            else: tiers = [(poly, base, top)]
        elif 25 < hgt <= 60 and area > 300 and rng.random() < 0.35 and minh == 0:
            p2 = poly.buffer(-3.0, join_style=2)
            if not p2.is_empty and p2.geom_type == 'Polygon' and p2.area > 60:
                tm = g0 + hgt * 0.84; tiers = [(poly, base, tm), (p2, tm, top)]
        uv0 = 0.0
        for tp, tb, tt in tiers:
            e2 = ring(tp)
            if e2 is None: continue
            prism(T, e2, tb, tt, style, tint, roof, uv0); uv0 += (tt - tb) / 3.4
        # rooftop: a mechanical penthouse on most mid- and high-rises, and New York's wooden water tanks on the older ones
        rp = tiers[-1][0]; rc = rp.centroid; rtop = tiers[-1][2]
        if hgt > 15 and rp.area > 150 and rng.random() < 0.6:
            mr = rp.minimum_rotated_rectangle; box = sg.Polygon(np.array(mr.exterior.coords)[:-1]).buffer(0)
            pent = sg.Polygon([(rc.x + (x - rc.x) * 0.38, rc.y + (y - rc.y) * 0.38) for x, y in np.array(box.exterior.coords)[:-1]]) if box.geom_type == 'Polygon' else None
            if pent is not None and pent.is_valid and pent.area > 8:
                pc = np.clip(tint * 0.8 + 0.08, 0, 1); prism(T, ring(pent), rtop, rtop + rng.uniform(3.0, 5.5), -1, pc, roof * 0.9)
        if 12 < hgt < 110 and style in (0, 1) and rp.area > 120 and rng.random() < 0.22:
            wx, wz = rc.x + rng.uniform(-0.25, 0.25) * np.sqrt(rp.area), rc.y + rng.uniform(-0.25, 0.25) * np.sqrt(rp.area)
            if rp.contains(sg.Point(wx, wz)):
                wood = np.array([0.36, 0.30, 0.25]) * (0.85 + 0.3 * rng.random())
                cyl(T, wx, wz, 0.4, rtop, rtop + 3.2, np.array([0.25, 0.24, 0.23]), sides=4)            # the steel stand
                cyl(T, wx, wz, rng.uniform(2.2, 3.2), rtop + 3.2, rtop + 3.2 + rng.uniform(4.0, 5.5), wood, sides=10, cone=1.6)
    meta['buildings'] = []
    for (i, j), T in tiles.items():
        P = np.array(T['p'], np.float32).reshape(-1, 3); N = np.array(T['n'], np.float32).reshape(-1, 3)
        UV = np.array(T['uv'], np.float32).reshape(-1, 2); C = (np.array(T['c'], np.float32).reshape(-1, 3) * 255).astype(np.uint8)
        I = np.array(T['idx'], np.uint32)
        fn = f'bld_{i}_{j}.bin'; write_bin(os.path.join(OUT, fn), [('p', P), ('n', N), ('uv', UV), ('c', C), ('i', I)])
        meta['buildings'].append({'file': fn, 'tris': int(len(I) // 3)})
        print('tile', i, j, 'verts', len(P), 'tris', len(I) // 3, flush=True)


if __name__ == '__main__':
    what = sys.argv[1] if len(sys.argv) > 1 else 'all'
    os.makedirs(CACHE, exist_ok=True)
    if what in ('fetch', 'all'):
        fetch_tiles(16, LAT0, LAT1, LON0, LON1)
        fetch_tiles(12, ORIGIN[0] - 0.42, ORIGIN[0] + 0.42, ORIGIN[1] - 0.56, ORIGIN[1] + 0.56)
        fetch_dem(); fetch_buildings()
    if what in ('build', 'all'): build()
