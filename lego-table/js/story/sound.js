// Sound (synthesised, Concept A §2): a quiet workroom — soft air handling, a distant street behind the glass, now and
// then tape pulled across a box or a cart rolling far off. The table's own sounds: the "clack" of a block seating in
// its socket, a palm pressing down, cardboard and cards sliding, paper, a rubber stamp. The ambience can be switched
// off on its own; the voices and the table sounds stay.
import {ctx} from '../core/audio.js';

const out = ctx.createGain(); out.gain.value = 0.9; out.connect(ctx.destination);
const amb = ctx.createGain(); amb.gain.value = 0; amb.connect(out);
const fx = ctx.createGain(); fx.gain.value = 0.7; fx.connect(out);
let started = false, muted = false;

function noise(sec, brown) {
  const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate), d = b.getChannelData(0);
  let last = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
  return b;
}
const N = {brown: noise(6, true), white: noise(3, false)};
function loop(buf, type, freq, q, gain, dest) {
  const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.value = gain; s.connect(f); f.connect(g); g.connect(dest); s.start(); return g;
}
function burst(t, {buf = N.white, type = 'bandpass', freq = 2000, q = 1, gain = 0.05, a = 0.004, d = 0.1, dest = fx, rate = 1} = {}) {
  const s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random() * 2, a + d + 0.05);
}
function knock(t, f0, gain, dur, dest = fx) {
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.55, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
}
export function startSound() {
  if (started) return; started = true;
  loop(N.brown, 'lowpass', 130, 0.5, 0.2, amb);                // air handling
  loop(N.white, 'lowpass', 700, 0.3, 0.006, amb);              // the vent's hiss
  const street = loop(N.brown, 'bandpass', 320, 0.7, 0.07, amb);   // the street behind the glass
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05; const lg = ctx.createGain(); lg.gain.value = 0.035; lfo.connect(lg); lg.connect(street.gain); lfo.start();
  const tick = () => {
    const t = ctx.currentTime, r = Math.random();
    if (r < 0.35) { for (let i = 0; i < 14; i++) burst(t + i * 0.035, {freq: 1800 + Math.random() * 900, q: 2, gain: 0.006, d: 0.05, dest: amb}); }   // tape pulled off a roll, far away
    else if (r < 0.6) { for (let i = 0; i < 24; i++) burst(t + i * 0.09, {type: 'lowpass', freq: 380, q: 0.7, gain: 0.012, d: 0.12, dest: amb}); }      // a cart rolling far off
    else if (r < 0.75) burst(t, {type: 'lowpass', freq: 600, gain: 0.02, d: 0.5, dest: amb});                                                         // a car passing outside
    setTimeout(tick, 7000 + Math.random() * 9000);
  };
  setTimeout(tick, 4000);
  amb.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 1.2);
}
export function muteAmbience(m) { muted = m; amb.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.4); }
export const ambienceMuted = () => muted;

// ---------------------------------------------------------------- the table's sounds
export const S = {
  /** a wooden block seating in its socket */
  clack() { const t = ctx.currentTime; knock(t, 1250 + Math.random() * 200, 0.12, 0.05); burst(t, {freq: 3200, q: 1.5, gain: 0.05, d: 0.03}); knock(t + 0.004, 420, 0.06, 0.07); },
  /** a palm pressing down on the blocks */
  press() { const t = ctx.currentTime; knock(t, 180, 0.12, 0.12); burst(t, {type: 'lowpass', freq: 500, gain: 0.05, d: 0.1}); },
  /** blocks bouncing back to the rack */
  bounce() { const t = ctx.currentTime; for (let i = 0; i < 5; i++) knock(t + i * 0.07 + Math.random() * 0.02, 900 + Math.random() * 500, 0.05, 0.04); },
  /** a block picked up */
  pick() { const t = ctx.currentTime; knock(t, 980, 0.05, 0.04); },
  /** cardboard sliding (a card flips, a token card moves) */
  slide() { const t = ctx.currentTime; burst(t, {type: 'bandpass', freq: 1400, q: 0.6, gain: 0.05, a: 0.05, d: 0.28}); },
  /** paper */
  paper() { const t = ctx.currentTime; burst(t, {type: 'highpass', freq: 2600, gain: 0.06, a: 0.03, d: 0.3}); burst(t + 0.12, {type: 'highpass', freq: 3200, gain: 0.03, a: 0.02, d: 0.2}); },
  /** a rubber stamp */
  stamp() { const t = ctx.currentTime; knock(t, 150, 0.2, 0.14); burst(t, {type: 'lowpass', freq: 900, gain: 0.08, d: 0.08}); burst(t + 0.01, {freq: 2400, q: 1, gain: 0.02, d: 0.06}); },
  /** a metal clip opening / closing */
  clip() { const t = ctx.currentTime; knock(t, 2600, 0.04, 0.03); knock(t + 0.08, 3100, 0.05, 0.03); },
  /** a refusal: a low soft buzz */
  refuse() { const t = ctx.currentTime; const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 150; const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35); o.connect(g); g.connect(fx); o.start(t); o.stop(t + 0.4); },
  /** the archive doors rolling */
  doors() { const t = ctx.currentTime; for (let i = 0; i < 30; i++) burst(t + i * 0.045, {type: 'lowpass', freq: 520, gain: 0.018, d: 0.07}); knock(t + 1.4, 210, 0.08, 0.12); },
};
