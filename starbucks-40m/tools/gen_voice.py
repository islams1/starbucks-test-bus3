"""Generate neural Arabic voice-over for every line in data/lines.<lang>.json using edge-tts.
Writes assets/vo/<lang>/<id>.mp3 (skips existing unless text changed: hash stored in manifest).
Run inside starbucks-40m/:  python -I tools/gen_voice.py ar
"""
import asyncio, hashlib, json, os, sys
import edge_tts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
lang = sys.argv[1] if len(sys.argv) > 1 else 'ar'
data = json.load(open(os.path.join(ROOT, 'data', f'lines.{lang}.json'), encoding='utf8'))
out = os.path.join(ROOT, 'assets', 'vo', lang)
os.makedirs(out, exist_ok=True)
man_p = os.path.join(out, 'manifest.json')
man = json.load(open(man_p, encoding='utf8')) if os.path.exists(man_p) else {}
sem = asyncio.Semaphore(6)
# emotion -> (rate %, pitch Hz, volume %) added to the speaker's base voice settings
EMO = {'calm': (0, 0, 0), 'warm': (-3, 2, 0), 'tired': (-10, -4, -6), 'worried': (-4, 3, -3), 'curious': (2, 4, 0), 'pushy': (8, 2, 6),
       'excited': (10, 8, 6), 'persuasive': (3, 3, 2), 'firm': (-3, -3, 2), 'confident': (0, -1, 3), 'unsure': (-6, 2, -6), 'pleased': (0, 4, 0),
       'skeptical': (-5, -2, 0), 'disappointed': (-8, -5, -4), 'shocked': (6, 10, 6), 'grudging': (-6, -3, -3), 'happy': (5, 6, 4), 'annoyed': (5, -3, 6),
       'casual': (4, 2, 0), 'hopeful': (-2, 4, 0), 'gentle': (-6, 0, -4), 'hurt': (-12, -4, -8), 'accepting': (-3, 1, 0), 'relieved': (-2, 3, 0),
       'proud': (-2, 4, 4), 'sad': (-10, -6, -6), 'tense': (-4, -2, -2), 'news': (0, 0, 0), 'news_good': (2, 2, 0), 'news_bad': (-4, -3, 0)}
def pct(s): return int(s.replace('%', '').replace('+', ''))
def hz(s): return int(s.replace('Hz', '').replace('+', ''))
def fmt(v, u): return ('+' if v >= 0 else '') + str(v) + u


async def one(lid, line):
    sp = data['speakers'][line['s']]
    er, ep, ev = EMO.get(line.get('e', 'calm'), (0, 0, 0))
    rate, pitch, vol = fmt(pct(sp['rate']) + er, '%'), fmt(hz(sp['pitch']) + ep, 'Hz'), fmt(ev, '%')
    h = hashlib.md5(('wb3' + line['t'] + sp['voice'] + rate + pitch + vol).encode()).hexdigest()
    path = os.path.join(out, lid + '.mp3')
    if man.get(lid) == h and os.path.exists(path):
        return
    async with sem:
        for attempt in range(4):
            try:
                c = edge_tts.Communicate(line['t'], sp['voice'], rate=rate, pitch=pitch, volume=vol, boundary='WordBoundary')
                words = []
                with open(path, 'wb') as f:
                    async for ch in c.stream():
                        if ch['type'] == 'audio':
                            f.write(ch['data'])
                        elif ch['type'] == 'WordBoundary':
                            words.append([round(ch['offset'] / 1e4), round(ch['duration'] / 1e4), ch['text']])
                json.dump(words, open(path[:-4] + '.json', 'w', encoding='utf8'), ensure_ascii=False)
                man[lid] = h
                json.dump(man, open(man_p, 'w', encoding='utf8'), indent=0)
                print('ok', lid, flush=True)
                return
            except Exception as e:
                print('retry', lid, e, flush=True)
                await asyncio.sleep(2 + attempt * 3)
        print('FAIL', lid, flush=True)


async def main():
    await asyncio.gather(*[one(k, v) for k, v in data['lines'].items()])
    json.dump(man, open(man_p, 'w', encoding='utf8'), indent=0)

asyncio.run(main())
