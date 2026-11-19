// Cockpit sound, all synthesized: the two engines (fan whine + roar) that spool down after the bird strike, the rumble of
// the damaged engine (recorded on the CVR from 15:27:18 to 15:28:08), wind noise rising and falling with the airspeed,
// the master warning chime, bird impacts, and the ditching. Voices go through audio.js (playVoice).
import {ctx} from '../core/audio.js';
import {onUpdate} from '../core/engine.js';
import {AC} from './aircraft.js';
import {CK} from './cockpit.js';

export const SND = {master: null, eng: [], started: false};
function noise(sec = 3, brown = false) {
  const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate), d = b.getChannelData(0); let l = 0;
  for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; if (brown) { l = (l + 0.02 * w) / 1.02; d[i] = l * 3.5; } else d[i] = w; }
  return b;
}
function loop(buf, type, f, q, g, dest) {
  const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  const gn = ctx.createGain(); gn.gain.value = g; s.connect(fl); fl.connect(gn); gn.connect(dest); s.start();
  return {s, f: fl, g: gn};
}
export function startSound() {
  if (SND.started) return; SND.started = true;
  const master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination); SND.master = master;
  const white = noise(3), brown = noise(5, true);
  SND.wind = loop(white, 'bandpass', 900, 0.6, 0.0, master);
  SND.roar = loop(brown, 'lowpass', 300, 0.7, 0.0, master);
  SND.rumble = loop(brown, 'lowpass', 60, 2.5, 0.0, master);
  for (let k = 0; k < 2; k++) {                         // fan whine per engine (slightly detuned)
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 2900 + k * 37;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3000; f.Q.value = 6;
    const g = ctx.createGain(); g.gain.value = 0; o.connect(f); f.connect(g); g.connect(master); o.start();
    SND.eng.push({o, f, g});
  }
  onUpdate((dt) => {
    const t = ctx.currentTime, ias = AC.ias || 0;
    const n = (CK.eng[0] + CK.eng[1]) / 2;
    SND.roar.g.gain.setTargetAtTime(0.05 + 0.32 * n, t, 0.2); SND.roar.f.frequency.setTargetAtTime(160 + 260 * n, t, 0.3);
    SND.eng.forEach((e, k) => { const N = CK.eng[k]; e.o.frequency.setTargetAtTime(500 + 2500 * N + (1 - N) * 120, t, 0.4); e.f.frequency.setTargetAtTime(600 + 2500 * N, t, 0.4); e.g.gain.setTargetAtTime(0.004 + 0.02 * N, t, 0.3); });
    SND.wind.g.gain.setTargetAtTime(0.02 + Math.pow(ias / 220, 2) * 0.16, t, 0.3); SND.wind.f.frequency.setTargetAtTime(500 + ias * 4, t, 0.5);
    SND.rumble.g.gain.setTargetAtTime((CK.rumble || 0) * 0.9, t, 0.15);
  });
}
/** a heavy bird strike: several dull impacts with a shudder */
export function thumps(n = 4) {
  for (let i = 0; i < n; i++) {
    const t = ctx.currentTime + i * (0.12 + Math.random() * 0.18);
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(110 + Math.random() * 40, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.25);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    const s = ctx.createBufferSource(); s.buffer = noise(0.3, true); const sg = ctx.createGain(); sg.gain.setValueAtTime(0.7, t); sg.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g); g.connect(SND.master); s.connect(sg); sg.connect(SND.master); o.start(t); o.stop(t + 0.4); s.start(t);
  }
}
let chimeT = null;
/** the master warning: repetitive chime until cancelled */
export function masterWarning(on) {
  clearInterval(chimeT); chimeT = null; if (!on) return;
  const ding = () => { const t = ctx.currentTime; for (const [f, d] of [[1046, 0], [784, 0.16]]) { const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.18, t + d + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.3); o.connect(g); g.connect(SND.master); o.start(t + d); o.stop(t + d + 0.35); } };
  ding(); chimeT = setInterval(ding, 900);
}
export function chime() { const t = ctx.currentTime; const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 880; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.15, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9); o.connect(g); g.connect(SND.master); o.start(t); o.stop(t + 1); }
/** touching the water at about 125 kt: a long tearing roar, a hard jolt, spray */
export function ditch() {
  const t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = noise(5, true);
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(2500, t); f.frequency.exponentialRampToValueAtTime(180, t + 4.5);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1.6, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 4.8);
  s.connect(f); f.connect(g); g.connect(SND.master); s.start(t);
  const w = ctx.createBufferSource(); w.buffer = noise(3); const wf = ctx.createBiquadFilter(); wf.type = 'highpass'; wf.frequency.value = 1800; const wg = ctx.createGain(); wg.gain.setValueAtTime(0.5, t + 0.1); wg.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
  w.connect(wf); wf.connect(wg); wg.connect(SND.master); w.start(t + 0.05);
  thumps(3);
}
/** the clack of a switch or a lever detent */
export function click() { if (!SND.master) return; const t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = noise(0.05); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 2; const g = ctx.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05); s.connect(f); f.connect(g); g.connect(SND.master); s.start(t); }
window.__clickSnd = click;
export function silenceEngines() { CK.eng = [0, 0]; CK.wind = 0; }
/** a slide-raft inflating: the hiss of the gas bottle, loud at once, dying away as the tubes fill */
export function hiss(sec = 2.8) {
  if (!SND.master) return;
  const t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = noise(sec);
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 0.5;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.45, t + 0.06); g.gain.exponentialRampToValueAtTime(0.001, t + sec);
  s.connect(f); f.connect(g); g.connect(SND.master); s.start(t); s.stop(t + sec);
}
