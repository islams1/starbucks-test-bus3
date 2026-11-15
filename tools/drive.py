"""Drive the game in headless Edge. python -I tools/drive.py <outdir> <script-name>"""
import sys, time, json, os
sys.stdout.reconfigure(encoding="utf-8")
from playwright.sync_api import sync_playwright
out=sys.argv[1]; script=sys.argv[2] if len(sys.argv)>2 else 'menu'
base='http://127.0.0.1:8777/index.html'
logs=[]
def run(pg, steps):
    for st in steps:
        k=st[0]
        if k=='wait': time.sleep(st[1])
        elif k=='shot': pg.screenshot(path=os.path.join(out, st[1])); print('shot', st[1], flush=True)
        elif k=='click': pg.click(st[1], timeout=st[2] if len(st)>2 else 30000, force=True)
        elif k=='key': pg.keyboard.press(st[1])
        elif k=='select': pg.select_option(st[1], st[2])
        elif k=='down': pg.keyboard.down(st[1])
        elif k=='up': pg.keyboard.up(st[1])
        elif k=='eval': print('eval', st[1][:60], '=>', pg.evaluate(st[1]), flush=True)
        elif k=='waitfor': pg.wait_for_selector(st[1], timeout=st[2] if len(st)>2 else 120000, state=st[3] if len(st)>3 else 'visible')
with sync_playwright() as p:
    b=p.chromium.launch(channel='msedge', headless=True, args=(['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu'] if os.environ.get('CPU') else ['--use-angle=d3d11'])+['--enable-gpu','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']+(['--disable-gpu-vsync','--disable-frame-rate-limit'] if os.environ.get('UNCAP') else []))
    pg=b.new_page(viewport={'width':1280,'height':720})
    pg.on('console', lambda m: ((m.type in ('error','warning') or '[boot]' in m.text or 'rafFPS' in m.text) and 'TGA' not in m.text and 'PropertyBinding' not in m.text) and print('[console]', m.type, m.text[:400], flush=True))
    pg.on('response', lambda r: r.status>=400 and print('[http]', r.status, r.url, flush=True))
    pg.on('pageerror', lambda e: print('[pageerror]', str(e)[:600], (e.stack or '')[:900], flush=True))
    arg=sys.argv[3] if len(sys.argv)>3 else ''
    url=arg if arg.startswith('http') else base+arg
    pg.goto(url, wait_until='domcontentloaded', timeout=120000)
    steps=json.load(open(os.path.join(os.path.dirname(__file__),'drive_'+script+'.json'),encoding='utf8'))
    t0=time.time()
    try: run(pg, steps)
    except Exception as e:
        print('FAILED', str(e).split(chr(10))[0], flush=True); pg.screenshot(path=os.path.join(out,'fail.png'))
        print('state', pg.evaluate("JSON.stringify({choices: document.getElementById('choices').className, subs: document.getElementById('subs').className, subtext: document.getElementById('subtext').textContent.slice(0,80), doc: document.getElementById('doc').className, S: window.__S && {nodes: window.__S.nodes, seg: window.__S.segment, ev: Object.keys(window.__S.ev)}})"), flush=True)
    print('done in', round(time.time()-t0,1), flush=True)
    b.close()
