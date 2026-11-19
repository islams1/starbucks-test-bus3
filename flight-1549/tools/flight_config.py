"""Write flight.local.json (git-ignored) for the browser from .env.local: the Cesium ion token (CESIUM_ION_TOKEN; ion
hands out the key for Google Photorealistic 3D Tiles, asset 2275207) and our own Google Maps Platform key (GOOGLE_MAPS_KEY,
Map Tiles API) as the second way in. Run inside flight-1549/ after editing .env.local:
    python -I tools/flight_config.py
"""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env = {}
p = os.path.join(ROOT, '.env.local')
if os.path.exists(p):
    for l in open(p, encoding='utf8'):
        if '=' in l and not l.strip().startswith('#'): k, v = l.strip().split('=', 1); env[k.strip()] = v.strip().strip('"').strip("'")
key = env.get('GOOGLE_MAPS_KEY') or env.get('GOOGLE_API_KEY') or ''
# a Cesium ion access token (free account): Google Photorealistic 3D Tiles through Cesium ion (asset 2275207)
ion = env.get('CESIUM_ION_TOKEN') or env.get('CESIUM_TOKEN') or next((v for k, v in env.items() if 'cesium' in k.lower()), '')
json.dump({'googleKey': key, 'cesiumIonToken': ion}, open(os.path.join(ROOT, 'flight.local.json'), 'w'))
print('flight.local.json written;', 'Google key' if key else 'no Google key', '|', 'Cesium ion' if ion else 'no Cesium ion')
