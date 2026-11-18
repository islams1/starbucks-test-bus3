"""Cut the real FAA air-traffic-control audio for Flight 1549 (public domain, FAA release of Feb 5, 2009) into clips.
Source: _src/f1549/N90_AWE1546_1-15-09_L116.mp3 — New York TRACON LaGuardia departure position, 2020–2040 UTC.
Alignment: file time = transcript time − 20:20:00 UTC + OFFSET (found by correlating the FAA transcript's transmission
pattern with the recording's voice activity). Clips are cut on MP3 frame boundaries (no re-encoding) and trimmed to the
transmission using the voice-activity envelope. Only the controller (and other aircraft, as background chatter) are cut
for play; the full exchange is kept as one file for the debrief replay.
Run from the repo root:  python -I tools/build_flight_audio.py
"""
import json, os
import numpy as np
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, '_src', 'f1549', 'N90_AWE1546_1-15-09_L116.mp3')
OUT = os.path.join(ROOT, 'assets', 'flight', 'atc'); os.makedirs(OUT, exist_ok=True)
OFFSET = 24.3
CLIPS = {   # id: (transcript time UTC, who, text)
    'atc_radar': ('2026:00', 'L116', 'cactus fifteen forty nine new york departure radar contact climb and maintain one five thousand'),
    'bg_jl1': ('2027:03', 'BTA2750', 'new york jetlink twenty seven sixty is five thousand turning right to one five zero'),
    'bg_jl2': ('2027:07', 'L116', 'jetlink twenty seven sixty climb maintain one zero thousand'),
    'bg_jl3': ('2027:11', 'BTA2760', 'one zero thousand jetlink twenty seven sixty'),
    'atc_270': ('2027:32', 'L116', 'cactus fifteen forty nine turn left heading two seven zero'),
    'atc_220': ('2027:42', 'L116', 'okay yea you need to return to laguardia turn left heading of uh two two zero'),
    'atc_rwy13': ('2028:05', 'L116', 'cactus fifteen twenty nine if we can get it to you do you want to try to land runway one three'),
    'bg_jl4': ('2028:17', 'L116', 'jetlink twenty seven sixty turn left zero seven zero'),
    'bg_jl5': ('2028:19', 'BTA2760', 'left turn zero seven zero jetlink twenty seven sixty'),
    'atc_31': ('2028:31', 'L116', "alright cactus fifteen forty nine it's going to be left traffic to runway three one"),
    'atc_land': ('2028:36', 'L116', 'okay what do you need to land'),
    'atc_rwy4': ('2028:46', 'L116', 'cactus fifteen forty nine runway four is available if you want to make left traffic to runway four'),
    'atc_teb_right': ('2028:55', 'L116', 'okay yea off to your right side is teterboro airport'),
    'atc_teb_q': ('2029:02', 'L116', 'do you want to try and go to teterboro'),
    'atc_teb_280': ('2029:21', 'L116', 'cactus fifteen twenty nine turn right two eight zero you can land runway one at teterboro'),
    'atc_teb_which': ('2029:26', 'L116', 'okay which runway would you like at teterboro'),
    'atc_sayagain': ('2029:33', 'L116', "i'm sorry say again cactus"),
    'bg_jl6': ('2029:41', 'L116', 'jetlink twenty seven sixty contact new york one two six point eight'),
    'bg_jl7': ('2029:45', 'BTA2760', 'twenty six eight jetlink twenty seven sixty'),
    'atc_lost': ('2029:51', 'L116', "cactus ah cactus fifteen forty nine radar contact is lost you also got newark airport off your two o'clock and about seven miles"),
    'bg_eg1': ('2030:06', 'L116', 'eagle flight forty seven eighteen turn left heading two one zero'),
    'bg_eg2': ('2030:09', 'EGF4718', "two one zero un forty seven eighteen i don't know i think he said he was going in the hudson"),
    'atc_still': ('2030:14', 'L116', 'cactus fifteen twenty nine uh you still on'),
    'atc_newark': ('2030:22', 'L116', 'cactus fifteen twenty nine if you can ah you got ah runway two nine available at newark off your two o\'clock and seven miles'),
}
REPLAY = ('2025:48', '2030:40')
# every transmission of the exchange (FAA transcript, New York TRACON L116), for the debrief replay subtitles
TRANSCRIPT = [
    ('2025:51', 'AWE1549', "Cactus fifteen forty-nine, seven hundred, climbing five thousand."),
    ('2026:00', 'L116', "Cactus fifteen forty-nine, New York departure, radar contact, climb and maintain one five thousand."),
    ('2026:04', 'AWE1549', "Maintain one five thousand, Cactus fifteen forty-nine."),
    ('2027:32', 'L116', "Cactus fifteen forty-nine, turn left heading two seven zero."),
    ('2027:36', 'AWE1549', "Ah, this is uh, Cactus fifteen thirty-nine. Hit birds. We lost thrust in both engines. We're turning back towards LaGuardia."),
    ('2027:42', 'L116', "Okay, yeah, you need to return to LaGuardia? Turn left heading of uh, two two zero."),
    ('2027:46', 'AWE1549', "Two two zero."),
    ('2028:05', 'L116', "Cactus fifteen twenty-nine, if we can get it to you, do you want to try to land runway one three?"),
    ('2028:11', 'AWE1549', "We're unable. We may end up in the Hudson."),
    ('2028:31', 'L116', "Alright Cactus fifteen forty-nine, it's going to be left traffic to runway three one."),
    ('2028:34', 'AWE1549', "Unable."),
    ('2028:36', 'L116', "Okay, what do you need to land?"),
    ('2028:46', 'L116', "Cactus fifteen forty-nine, runway four is available if you want to make left traffic to runway four."),
    ('2028:50', 'AWE1549', "I am not sure if we can make any runway. Oh, what's over to our right? Anything in New Jersey? Maybe Teterboro?"),
    ('2028:55', 'L116', "Okay yeah, off to your right side is Teterboro Airport."),
    ('2029:02', 'L116', "Do you want to try and go to Teterboro?"),
    ('2029:03', 'AWE1549', "Yes."),
    ('2029:21', 'L116', "Cactus fifteen twenty-nine, turn right two eight zero, you can land runway one at Teterboro."),
    ('2029:25', 'AWE1549', "We can't do it."),
    ('2029:26', 'L116', "Okay, which runway would you like at Teterboro?"),
    ('2029:28', 'AWE1549', "We're gonna be in the Hudson."),
    ('2029:33', 'L116', "I'm sorry, say again, Cactus?"),
    ('2029:51', 'L116', "Cactus, ah, Cactus fifteen forty-nine, radar contact is lost. You also got Newark airport off your two o'clock and about seven miles."),
    ('2030:14', 'L116', "Cactus fifteen twenty-nine, uh, you still on?"),
    ('2030:22', 'L116', "Cactus fifteen twenty-nine, if you can, ah, you got ah, runway two nine available at Newark, off your two o'clock and seven miles."),
]
# start times of every transmission on the frequency (FAA transcript), to stop each clip before the next one begins
ALL = ['2025:51', '2026:00', '2026:04', '2026:57', '2026:59', '2027:03', '2027:07', '2027:11', '2027:32', '2027:36', '2027:42', '2027:46',
       '2027:49', '2027:53', '2027:54', '2027:59', '2028:01', '2028:03', '2028:05', '2028:11', '2028:17', '2028:19', '2028:31', '2028:34',
       '2028:36', '2028:46', '2028:50', '2028:55', '2029:02', '2029:03', '2029:05', '2029:10', '2029:11', '2029:14', '2029:17', '2029:19',
       '2029:21', '2029:25', '2029:26', '2029:28', '2029:33', '2029:41', '2029:45', '2029:51', '2030:06', '2030:09', '2030:14', '2030:22', '2030:32', '2030:40']


def ft(s):
    m, x = s.split(':'); return (int(m[:2]) * 60 + int(m[2:4])) * 60 + int(x) - (20 * 3600 + 20 * 60)


def frames(b):
    """MPEG-1 layer III frame offsets of a CBR/VBR stream (after an optional ID3v2 tag)"""
    i = 0
    if b[:3] == b'ID3': i = 10 + ((b[6] & 0x7f) << 21 | (b[7] & 0x7f) << 14 | (b[8] & 0x7f) << 7 | (b[9] & 0x7f))
    BR = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0]; SR = [44100, 48000, 32000, 0]
    out = []
    while i + 4 <= len(b):
        if b[i] == 0xFF and (b[i + 1] & 0xE0) == 0xE0:
            br = BR[b[i + 2] >> 4] * 1000; sr = SR[(b[i + 2] >> 2) & 3]; pad = (b[i + 2] >> 1) & 1
            if br and sr:
                L = 144 * br // sr + pad; out.append((i, L, sr)); i += L; continue
        i += 1
    return out


def main():
    b = open(SRC, 'rb').read(); F = frames(b); sr = F[0][2]; fdur = 1152 / sr
    d, rate = sf.read(SRC); env = np.sqrt(np.convolve(d ** 2, np.ones(rate // 20) / (rate // 20), 'same'))[::rate // 20]   # 20 Hz envelope
    act = env > 0.006
    def cut(t0, t1, name):
        a, z = int(t0 / fdur), int(t1 / fdur) + 1
        with open(os.path.join(OUT, name + '.mp3'), 'wb') as f:
            for off, L, _ in F[max(0, a):min(len(F), z)]: f.write(b[off:off + L])
    meta = {}
    for cid, (t, who, txt) in CLIPS.items():
        s = ft(t) + OFFSET
        k = int(s * 20); lo = max(0, k - 30)
        while lo < k + 40 and not act[lo]: lo += 1                     # first voice after (expected − 1.5 s)
        hi = lo
        gap = 0
        while hi < len(act) and gap < 14:                             # until 0.7 s of silence
            gap = 0 if act[hi] else gap + 1; hi += 1
        t0, t1 = lo / 20 - 0.12, (hi - 14) / 20 + 0.25
        nxt = min([ft(x) + OFFSET for x in ALL if ft(x) > ft(t)] or [t1 + 1])
        t1 = min(t1, nxt - 0.1, t0 + 12)
        cut(t0, t1, cid)
        meta[cid] = {'utc': t, 'who': who, 'text': txt, 'start': round(t0, 2), 'dur': round(t1 - t0, 2), 'game': round(ft(t) - ft('2027:11'), 2)}
        print(f'{cid:14} {t} {t1 - t0:5.2f}s  {txt[:60]}')
    r0, r1 = ft(REPLAY[0]) + OFFSET, ft(REPLAY[1]) + OFFSET
    cut(r0, r1, 'replay')
    meta['_replay'] = {'utc0': REPLAY[0], 'start': r0, 'dur': r1 - r0, 'strikeAt': ft('2027:11') - ft(REPLAY[0])}
    meta['_transcript'] = [{'utc': t, 'who': w, 'text': x, 'at': round(ft(t) - ft(REPLAY[0]), 1)} for t, w, x in TRANSCRIPT]
    json.dump(meta, open(os.path.join(OUT, 'clips.json'), 'w', encoding='utf8'), indent=1)
    print('replay', round(r1 - r0, 1), 's;', os.path.getsize(os.path.join(OUT, 'replay.mp3')) // 1024, 'KB')


main()
