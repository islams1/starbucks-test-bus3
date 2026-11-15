"""Headless Edge helper: python -I tools/shot.py URL [out.png] [wait_s] [w] [h]  -> prints console, saves screenshot"""
import sys, time
from playwright.sync_api import sync_playwright
url=sys.argv[1]; out=sys.argv[2] if len(sys.argv)>2 else None; wait=float(sys.argv[3]) if len(sys.argv)>3 else 5
W=int(sys.argv[4]) if len(sys.argv)>4 else 1280; H=int(sys.argv[5]) if len(sys.argv)>5 else 720
with sync_playwright() as p:
    b=p.chromium.launch(channel='msedge', headless=True, args=['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required'])
    pg=b.new_page(viewport={'width':W,'height':H})
    pg.on('console', lambda m: print('[console]', m.type, m.text[:3000], flush=True))
    pg.on('pageerror', lambda e: print('[pageerror]', e, flush=True))
    pg.goto(url)
    t0=time.time()
    while time.time()-t0<wait:
        if pg.title()=='DONE': break
        time.sleep(0.25)
    if out: pg.screenshot(path=out)
    b.close()
