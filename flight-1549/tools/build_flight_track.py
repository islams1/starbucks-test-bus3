"""The real flight path of US Airways 1549 for the game, in the scenery's local frame (see tools/build_nyc.py).
Ground track: digitised from NTSB AAR-10/03 figure 1 (georeferenced on the touchdown point and the George Washington
Bridge) → _src/f1549/ntsb/track.json. Timing and height come from the report's narrative (CVR/FDR times):
  15:25:51  700 ft, climbing (first call to departure)          15:27:11  bird strike, 2,818 ft agl
  ~15:27:30 highest point after the strike, about 3,060 ft       15:29:11  over the George Washington Bridge (ATC)
  15:29:15  GPWS "one thousand"                                  15:30:03  "two hundred fifty feet in the air"
  15:30:41  GPWS "fifty"                                         15:30:43  touchdown on the Hudson
Output: assets/flight/track.json, sampled every 0.25 s; t = seconds after the bird strike (negative before it).
Run from the repo root:  python -I tools/build_flight_track.py
"""
import json, math, os
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGIN = (40.82, -73.955); MLAT = 111132.0; MLON = 111320.0 * math.cos(math.radians(ORIGIN[0]))
FT = 0.3048
tr = json.load(open(os.path.join(ROOT, '_src', 'f1549', 'ntsb', 'track.json')))
lat, lon = np.array(tr['lat']), np.array(tr['lon'])
x = (lon - ORIGIN[1]) * MLON; z = -(lat - ORIGIN[0]) * MLAT
# the digitised points (one every ~90 m) zigzag a few metres around the true path: drawn as they are, the heading
# jumped at every point and the bank worked out from it rocked between ±15° and ±30° every few seconds. A smoothing
# spline through them (about 20 m from the points at most) keeps the path, its ends and the turns, and is resampled
# every 10 m
from scipy.interpolate import UnivariateSpline
s0 = np.r_[0, np.cumsum(np.hypot(np.diff(x), np.diff(z)))]
NOISE = 5
fx, fz = UnivariateSpline(s0, x, s=len(x) * NOISE ** 2), UnivariateSpline(s0, z, s=len(z) * NOISE ** 2)
sd = np.linspace(0, s0[-1], int(s0[-1] / 10) + 1)
print('track smoothing: largest move', round(float(np.hypot(fx(s0) - x, fz(s0) - z).max()), 1), 'm')
s_strike0 = s0[tr['strike_i']]
x, z = fx(sd), fz(sd)
s = np.r_[0, np.cumsum(np.hypot(np.diff(x), np.diff(z)))]
i_strike = int(np.argmin(np.abs(sd - s_strike0)))
# the river crossing next to the George Washington Bridge: the track point nearest the bridge centre
bx, bz = (-73.9527 - ORIGIN[1]) * MLON, -(40.8517 - ORIGIN[0]) * MLAT
i_gwb = int(np.argmin(np.hypot(x - bx, z - bz)))
T = lambda hms: (lambda h, m, sec: (h * 3600 + m * 60 + sec) - (15 * 3600 + 27 * 60 + 11))(*hms)
# time ↔ distance anchors (piecewise linear: constant ground speed between them)
# after the strike the distance flown follows the airspeed the report gives (≈214 kt at most, 170 kt at 15:30:06,
# 150 kt at 15:30:16, about 125 kt at touchdown), scaled so the track ends at the touchdown at 15:30:43
KT = 0.5144
sp_t = [0, 20, 60, 120, T((15, 30, 6)), T((15, 30, 16)), T((15, 30, 43))]
sp_v = [212, 205, 196, 186, 170, 150, 125]
tt = np.arange(0, T((15, 30, 43)) + 1e-6, 0.25); gs = np.interp(tt, sp_t, sp_v) * KT
cum = np.r_[0, np.cumsum((gs[1:] + gs[:-1]) / 2 * 0.25)]; cum *= (s[-1] - s[i_strike]) / cum[-1]
pre_t = [T((15, 25, 30)), 0.0]; pre_s = [s[0], s[i_strike]]
def dist_at(t):
    t = np.asarray(t, float)
    return np.where(t <= 0, np.interp(t, pre_t, pre_s), s[i_strike] + np.interp(t, tt, cum))
print('mean speed after the strike', round((s[-1] - s[i_strike]) / T((15, 30, 43)), 1), 'm/s; at the bridge t =', round(float(np.interp(s[i_gwb] - s[i_strike], cum, tt)), 1))
# height (ft above the water), smooth monotone through the anchors
h_t = [T((15, 25, 30)), T((15, 25, 51)), 0.0, T((15, 27, 30)), T((15, 28, 20)), T((15, 29, 15)), T((15, 30, 3)), T((15, 30, 30)), T((15, 30, 41)), T((15, 30, 43))]
h_v = [80, 700, 2850, 3060, 2150, 1000, 250, 90, 40, 3]
from scipy.interpolate import PchipInterpolator
hp = PchipInterpolator(h_t, h_v)
ts = np.arange(T((15, 25, 45)), T((15, 30, 43)) + 1e-6, 0.25)
ss = dist_at(ts)
X = np.interp(ss, s, x); Z = np.interp(ss, s, z); A = hp(ts) * FT
# heading (deg true, 0 = north, clockwise) and bank from the turn rate; pitch from the climb/descent angle
dx, dz = np.gradient(X, ts), np.gradient(Z, ts)
hdg = (np.degrees(np.arctan2(dx, -dz)) + 360) % 360
k = np.ones(9) / 9; sm = lambda v: np.convolve(np.r_[[v[0]] * 4, v, [v[-1]] * 4], k, 'valid')
uh = np.unwrap(np.radians(hdg)); w = np.gradient(sm(uh), ts); V = np.hypot(dx, dz)
from scipy.ndimage import gaussian_filter1d
bank = np.degrees(np.arctan(V * w / 9.81)); bank = np.clip(gaussian_filter1d(bank, 8, mode='nearest'), -30, 30)   # σ 2 s: an airliner rolls in and out gently
vs = np.gradient(A, ts); pitch = sm(np.degrees(np.arctan2(vs, np.maximum(V, 1))) + 2.5)
pitch = np.where(ts > T((15, 30, 30)), pitch + np.clip((ts - T((15, 30, 30))) / 13, 0, 1) * 6.5, pitch)   # the flare: nose up
out = {'t': np.round(ts, 2).tolist(), 'x': np.round(X, 2).tolist(), 'z': np.round(Z, 2).tolist(), 'alt': np.round(A, 2).tolist(),
       'hdg': np.round(hdg, 2).tolist(), 'bank': np.round(bank, 2).tolist(), 'pitch': np.round(pitch, 2).tolist(), 'gs': np.round(V, 2).tolist(),
       'events': {'strike': 0, 'gwb': T((15, 29, 11)), 'touchdown': T((15, 30, 43)), 'start': T((15, 25, 45))},
       'gwb': [round(bx, 1), round(bz, 1)], 'source': 'NTSB AAR-10/03 fig. 1 and narrative; see tools/build_flight_track.py'}
os.makedirs(os.path.join(ROOT, 'assets', 'flight'), exist_ok=True)
json.dump(out, open(os.path.join(ROOT, 'assets', 'flight', 'track.json'), 'w'))
print('samples', len(ts), 'strike at', np.round([X[ts == 0][0], A[ts == 0][0], Z[ts == 0][0]], 1), 'touchdown', np.round([X[-1], Z[-1]], 1))
print('max bank', round(float(np.abs(bank).max()), 1), 'speed range m/s', round(float(V[ts > 0].min()), 1), round(float(V[ts > 0].max()), 1))
