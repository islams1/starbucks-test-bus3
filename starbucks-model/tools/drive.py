"""Drive the game in headless Edge. python -I tools/drive.py <outdir> <script-name>"""
import sys, time, json, os
sys.stdout.reconfigure(encoding="utf-8")
from playwright.sync_api import sync_playwright
out=sys.argv[1]; script=sys.argv[2] if len(sys.argv)>2 else 'menu'
base='http://127.0.0.1:8792/index.html'
logs=[]
def run(pg, steps):
    for st in steps:
        k=st[0]
        if k=='wait': time.sleep(st[1])
        elif k=='shot': pg.screenshot(path=os.path.join(out, st[1])); print('shot', st[1], flush=True)
        elif k=='click': pg.click(st[1], timeout=st[2] if len(st)>2 else 30000, force=True)
        elif k=='key': pg.keyboard.press(st[1])
        elif k=='tap': pg.tap(st[1], timeout=st[2] if len(st)>2 else 30000, force=True)
        elif k=='select': pg.select_option(st[1], st[2])
        elif k=='down': pg.keyboard.down(st[1])
        elif k=='up': pg.keyboard.up(st[1])
        elif k=='eval': print('eval', st[1][:60], '=>', pg.evaluate(st[1]), flush=True)
        elif k=='mmove': pg.mouse.move(st[1], st[2], steps=st[3] if len(st)>3 else 1)
        elif k=='mdown': pg.mouse.down()
        elif k=='mup': pg.mouse.up()
        elif k=='dragjs':
            pts=pg.evaluate(st[1]); per=st[2] if len(st)>2 else 4; dl=st[3] if len(st)>3 else 0.016
            if not pts: continue                  # nothing to drag (e.g. the handle is already gone)
            pg.mouse.move(pts[0][0], pts[0][1]); time.sleep(0.1); pg.mouse.down()
            for q in pts[1:]: pg.mouse.move(q[0], q[1], steps=per); time.sleep(dl)
            if not (len(st)>4 and st[4]=='hold'): pg.mouse.up()
        elif k=='clickjs':
            q=pg.evaluate(st[1]); pg.mouse.move(q[0], q[1], steps=3); time.sleep(0.05); pg.mouse.down(); time.sleep(0.06); pg.mouse.up()
        elif k=='waitjs':
            t0w=time.time()
            def ok():
                try: return pg.evaluate(st[1])
                except Exception: return False
            while not ok():
                if time.time()-t0w > (st[2] if len(st)>2 else 60): raise Exception('waitjs timeout: '+st[1][:80])
                time.sleep(0.2)
        elif k=='waitfor': pg.wait_for_selector(st[1], timeout=st[2] if len(st)>2 else 120000, state=st[3] if len(st)>3 else 'visible')
with sync_playwright() as p:
    b=p.chromium.launch(channel='msedge', headless=True, args=(['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu'] if os.environ.get('CPU') else ['--use-angle=d3d11'])+['--enable-gpu','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']+(['--disable-gpu-vsync','--disable-frame-rate-limit'] if os.environ.get('UNCAP') else []))
    pg=b.new_page(viewport={'width':844,'height':390}, is_mobile=True, has_touch=True, device_scale_factor=3, user_agent='Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36') if os.environ.get('MOBILE') else b.new_page(viewport={'width':1280,'height':720})
    pg.on('console', lambda m: ((m.type in ('error','warning') or '[boot]' in m.text or 'rafFPS' in m.text) and 'TGA' not in m.text and 'PropertyBinding' not in m.text) and print('[console]', m.type, m.text[:400], flush=True))
    pg.on('response', lambda r: r.status>=400 and print('[http]', r.status, r.url, flush=True))
    pg.on('requestfailed', lambda r: print('[reqfail]', r.failure, r.url.split('?')[0], flush=True))
    pg.on('pageerror', lambda e: print('[pageerror]', str(e)[:600], (e.stack or '')[:900], flush=True))
    arg=sys.argv[3] if len(sys.argv)>3 else ''
    url=arg if arg.startswith('http') else base+arg
    pg.goto(url, wait_until='domcontentloaded', timeout=120000)
    steps=json.load(open(os.path.join(os.path.dirname(__file__),'drive_'+script+'.json'),encoding='utf-8-sig'))
    t0=time.time()
    try: run(pg, steps)
    except Exception as e:
        print('FAILED', str(e).split(chr(10))[0], flush=True); pg.screenshot(path=os.path.join(out,'fail.png'))
        print('state', pg.evaluate("JSON.stringify({choices: document.getElementById('choices')?.className, subs: document.getElementById('subtext')?.textContent.slice(0,80), panel: document.getElementById('panel')?.className, card: document.getElementById('card')?.className, view: window.__VIEW && window.__VIEW.mode, S: window.__S && {scene: window.__S.scene, ev: Object.keys(window.__S.ev)}})"), flush=True)
    print('done in', round(time.time()-t0,1), flush=True)
    b.close()



