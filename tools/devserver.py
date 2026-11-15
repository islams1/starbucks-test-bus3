"""Static server + POST /save/<relpath> (writes inside game/assets/baked only). Run from game/: python -I tools/devserver.py 8777"""
import http.server, os, sys
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAVE=os.path.join(ROOT,'assets','baked')
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s,*a,**k): super().__init__(*a,directory=ROOT,**k)
    def end_headers(s):
        s.send_header('Cache-Control','no-store'); super().end_headers()
    def do_POST(s):
        rel=s.path.split('/save/',1)[-1]
        dst=os.path.normpath(os.path.join(SAVE,rel))
        if not dst.startswith(SAVE): s.send_response(403); s.end_headers(); return
        n=int(s.headers.get('Content-Length',0)); data=s.rfile.read(n)
        os.makedirs(os.path.dirname(dst),exist_ok=True); open(dst,'wb').write(data)
        s.send_response(200); s.end_headers(); s.wfile.write(b'ok')
    def log_message(s,*a): pass
http.server.ThreadingHTTPServer(('127.0.0.1',int(sys.argv[1]) if len(sys.argv)>1 else 8777),H).serve_forever()
