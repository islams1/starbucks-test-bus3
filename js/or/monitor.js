// Patient physiology (very simplified, for teaching) + the monitor: ECG (sinus / VF / asystole / ST elevation),
// arterial pressure (pulsatile, or flat with a pump ripple on bypass), pleth, numbers, beep and alarms.
import {onUpdate, damp} from '../core/engine.js';
import {beep, setAlarm} from './sound.js';

export const vit = {
  hr: 78, sbp: 128, dbp: 70, spo2: 99, temp: 36.4, etco2: 36,
  rhythm: 'sinus',      // sinus | vf | asystole
  st: 0,                // ST elevation (mm) in the inferior leads
  bypass: 0,            // 0 = heart pumping, 1 = full bypass (arterial line flat)
  ventilating: true,
  target: {hr: 78, sbp: 128, dbp: 70, spo2: 99, temp: 36.4, st: 0},
  silenced: false,
};
/** set physiological targets; values glide towards them (speed k per second) */
export function setTarget(t, k = null) { Object.assign(vit.target, t); if (k) vit._k = k; }
const S = {ph: 0, vfPh: 0, lastBeat: 0, trace: {ecg: [], art: [], pl: []}, t: 0};
const N = 260;    // samples on screen
for (const k in S.trace) S.trace[k] = new Array(N).fill(0);

function ecgSample(p, st) {
  // one beat over phase 0..1: P, QRS, ST segment, T
  const g = (x, m, w, a) => a * Math.exp(-((x - m) * (x - m)) / (2 * w * w));
  let v = g(p, 0.12, 0.022, 0.12) - g(p, 0.235, 0.007, 0.12) + g(p, 0.25, 0.009, 1.05) - g(p, 0.265, 0.008, 0.25);
  const stSeg = p > 0.27 && p < 0.47 ? st * 0.06 : 0;
  v += stSeg + g(p, 0.42, 0.045, 0.28 + st * 0.05);
  return v;
}
function artSample(p) { // dicrotic arterial wave, 0..1
  const up = p < 0.12 ? Math.sin(p / 0.12 * Math.PI / 2) : 1;
  const decay = p < 0.12 ? up : Math.exp(-(p - 0.12) * 3.2);
  const notch = Math.exp(-((p - 0.36) ** 2) / 0.0012) * 0.08;
  return Math.max(0, decay + notch);
}

onUpdate((dt) => {
  if (dt <= 0) return;
  S.t += dt;
  const k = vit._k || 0.6, T = vit.target;
  for (const key of ['hr', 'sbp', 'dbp', 'spo2', 'temp', 'st']) vit[key] = damp(vit[key], T[key], key === 'spo2' ? 0.35 : key === 'st' ? 0.8 : k, dt);
  // apnoea without bypass: saturation falls slowly
  if (!vit.ventilating && !vit.spont && vit.bypass < 0.5) T.spo2 = Math.max(78, T.spo2 - dt * 0.32);
  else if (T.spo2 < 98.5 && !vit.holdSat) T.spo2 = Math.min(99, T.spo2 + dt * 0.6);        // breathing again: saturation recovers
  const beating = vit.rhythm === 'sinus';
  const bpm = beating ? vit.hr : 0;
  const prevPh = S.ph;
  S.ph = (S.ph + dt * bpm / 60) % 1;
  if (beating && prevPh > S.ph && vit.bypass < 0.95 && !vit.silenced) beep(vit.spo2);
  S.vfPh += dt;
  // samples: scroll speed ~ 25 mm/s equivalent
  const steps = Math.max(1, Math.round(dt * 70));
  for (let i = 0; i < steps; i++) {
    const ph = (S.ph - (steps - 1 - i) * (bpm / 60) / 70 + 1) % 1;
    let e, a, pl;
    if (vit.rhythm === 'vf') { const t = S.vfPh + i / 70; e = 0.45 * Math.sin(t * 31) + 0.28 * Math.sin(t * 47 + 1.3) + 0.2 * Math.sin(t * 19 + 0.4) + (Math.random() - 0.5) * 0.08; a = 0.05 * Math.random(); pl = 0.02; }
    else if (vit.rhythm === 'asystole' || !beating) { e = (Math.random() - 0.5) * 0.02; a = 0; pl = 0; }
    else { e = ecgSample(ph, vit.st); a = artSample(ph); pl = artSample((ph + 0.92) % 1) * 0.9; }
    // on bypass the arterial line is the pump's mean pressure with a small ripple
    const by = vit.bypass;
    const artV = (1 - by) * a + by * (0.5 + 0.03 * Math.sin((S.t + i / 70) * 7.8));
    S.trace.ecg.push(e); S.trace.art.push(artV); S.trace.pl.push((1 - by) * pl + by * 0.04);
    for (const kk in S.trace) if (S.trace[kk].length > N) S.trace[kk].shift();
  }
  // alarms: VF = high, low pressure / low saturation = high, ST elevation = medium
  const map = vit.dbp + (vit.sbp - vit.dbp) / 3;
  const high = vit.rhythm === 'vf' || (vit.bypass < 0.5 && (vit.sbp < 82 || vit.spo2 < 90));
  const med = !high && vit.st > 1.2;
  vit.alarm = high ? 2 : med ? 1 : 0;
  setAlarm(vit.silenced ? 0 : vit.alarm);
  const el = document.getElementById('vitals'); if (el) el.classList.toggle('alarm', vit.alarm === 2);
  const tint = document.getElementById('alarmtint'); if (tint) tint.classList.toggle('on', vit.alarm === 2);
  draw(document.getElementById('vitc'));
  if (vit.screen) { vit._sT = (vit._sT || 0) + dt; if (vit._sT > 1 / 24) { vit._sT = 0; vit.screen.draw((g, W, H) => paint(g, W, H, true)); } }
});

/** monitor canvas: three traces with their numbers (shared by the HUD and the 3D monitor) */
function paint(g, W, H, big) {
  g.fillStyle = '#020506'; g.fillRect(0, 0, W, H);
  const rows = [['ecg', '#3fe07a', 'HR', Math.round(vit.rhythm === 'sinus' ? vit.hr : vit.rhythm === 'vf' ? 0 : 0), vit.rhythm === 'vf' ? 'VF' : vit.rhythm === 'asystole' ? '---' : (vit.st > 1 ? 'ST↑ ' + vit.st.toFixed(1) : '')],
    ['art', '#ff5a5a', 'ABP', vit.bypass > 0.6 ? `MAP ${Math.round(55 + 10 * vit.bypass)}` : `${Math.round(vit.sbp)}/${Math.round(vit.dbp)}`, vit.bypass > 0.6 ? 'CPB' : ''],
    ['pl', '#5ad1ff', 'SpO₂', Math.round(vit.spo2) + '%', vit.ventilating ? '' : 'APNEA']];
  const rh = H / 3, nw = big ? W * 0.3 : W * 0.34, tw = W - nw - 8;
  rows.forEach(([k, col, lbl, val, sub], r) => {
    const y0 = r * rh, tr = S.trace[k];
    g.strokeStyle = col; g.lineWidth = big ? 3 : 1.6; g.beginPath();
    const sc = k === 'ecg' ? 0.36 : 0.72, base = k === 'ecg' ? 0.62 : 0.86;
    for (let i = 0; i < tr.length; i++) { const x = 6 + i / (tr.length - 1) * (tw - 12), y = y0 + rh * base - tr[i] * rh * sc; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
    g.fillStyle = col; g.textAlign = 'right';
    g.font = `600 ${Math.round(rh * 0.2)}px Inter, Arial`; g.fillText(lbl, W - 8, y0 + rh * 0.26);
    g.font = `700 ${Math.round(rh * (String(val).length > 4 ? 0.36 : 0.5))}px Inter, Arial`; g.fillText(String(val), W - 8, y0 + rh * 0.78);
    if (sub) { g.font = `700 ${Math.round(rh * 0.2)}px Inter, Arial`; g.fillStyle = sub === 'VF' || sub.startsWith('ST') || sub === 'APNEA' ? '#ffd166' : col; g.textAlign = 'left'; g.fillText(sub, 8, y0 + rh * 0.24); }
  });
  g.fillStyle = '#9fb3b8'; g.textAlign = 'left'; g.font = `600 ${Math.round(H * 0.06)}px Inter, Arial`;
  g.fillText(`T ${vit.temp.toFixed(1)}°C`, 8, H - 6);
}
function draw(cv) {
  if (!cv || cv.offsetParent === null) return;
  paint(cv.getContext('2d'), cv.width, cv.height, false);
}
/** register the 3D monitor's canvas texture ({draw(fn)}) */
export function attachScreen(screen) { vit.screen = screen; }
