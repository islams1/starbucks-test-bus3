// Operating-room sounds, synthesised with WebAudio (no files): monitor beep (pitch follows SpO2), alarms,
// heart-lung machine hum, ventilator, sternal saw, cautery, suction, bone crack, defibrillator shock.
import {ctx} from '../core/audio.js';

const out = ctx.createGain(); out.gain.value = 0.9;
const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
out.connect(comp); comp.connect(ctx.destination);
const noiseBuf = (() => { const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; })();
function noise(gain, {type = 'bandpass', freq = 1000, q = 1, dest = out} = {}) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.value = gain;
  s.connect(f); f.connect(g); g.connect(dest); s.start();
  return {s, f, g, stop: (t = 0.08) => { g.gain.setTargetAtTime(0, ctx.currentTime, t); setTimeout(() => { try { s.stop(); } catch (e) {} }, t * 6000); }};
}
function osc(type, freq, gain, dest = out) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
  const g = ctx.createGain(); g.gain.value = gain; o.connect(g); g.connect(dest); o.start();
  return {o, g, stop: (t = 0.08) => { g.gain.setTargetAtTime(0, ctx.currentTime, t); setTimeout(() => { try { o.stop(); } catch (e) {} }, t * 6000); }};
}
function blip(freq, dur, gain, type = 'sine', delay = 0) {
  const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
}

/** pulse-oximeter beep: pitch falls with saturation (the sound every anaesthetist listens to) */
export function beep(spo2) { blip(440 + Math.max(0, spo2 - 70) * 15.5, 0.085, 0.07, 'sine'); }

// alarms: high priority = 3+2 pulses repeating, medium = 3 pulses
let alarmTimer = 0, alarmLevel = 0;
export function setAlarm(level) {
  if (level === alarmLevel) return;
  alarmLevel = level; clearInterval(alarmTimer);
  if (!level) return;
  const play = () => {
    const f = level >= 2 ? 988 : 660;
    const seq = level >= 2 ? [0, 0.16, 0.32, 0.72, 0.88] : [0, 0.2, 0.4];
    for (const d of seq) blip(f, 0.12, 0.06, 'square', d);
  };
  play(); alarmTimer = setInterval(play, level >= 2 ? 2200 : 3200);
}

// heart-lung machine: low hum + the rhythmic squeeze of the roller heads
let pump = null;
export function setPump(on) {
  if (on && !pump) {
    const hum = osc('sawtooth', 52, 0.0, out); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 240;
    hum.g.disconnect(); hum.g.connect(lp); lp.connect(out); hum.g.gain.setTargetAtTime(0.035, ctx.currentTime, 0.6);
    const roll = noise(0, {freq: 380, q: 2.2}); const lfo = ctx.createOscillator(); lfo.frequency.value = 1.25; const lg = ctx.createGain(); lg.gain.value = 0.018;
    lfo.connect(lg); lg.connect(roll.g.gain); lfo.start(); roll.g.gain.setTargetAtTime(0.02, ctx.currentTime, 0.6);
    pump = {stop: () => { hum.stop(0.5); roll.stop(0.5); try { lfo.stop(ctx.currentTime + 2); } catch (e) {} }};
  } else if (!on && pump) { pump.stop(); pump = null; }
}

// ventilator: a soft inspiratory whoosh every breath
let ventTimer = 0;
export function setVentilator(on) {
  clearInterval(ventTimer);
  if (!on) return;
  const breathe = () => { const n = noise(0, {freq: 700, q: 0.7}); n.g.gain.setTargetAtTime(0.03, ctx.currentTime, 0.35); setTimeout(() => n.stop(0.4), 1300); };
  breathe(); ventTimer = setInterval(breathe, 5000);
}

/** continuous tool sounds: returns {set(intensity 0..1), stop()} */
export function toolSound(kind) {
  if (kind === 'saw') {
    const a = osc('sawtooth', 128, 0.0); const b = noise(0, {freq: 2600, q: 0.8});
    return {set: (k) => { a.g.gain.setTargetAtTime(0.05 * k, ctx.currentTime, 0.03); b.g.gain.setTargetAtTime(0.05 * k, ctx.currentTime, 0.03); a.o.frequency.setTargetAtTime(110 + 40 * k, ctx.currentTime, 0.05); }, stop: () => { a.stop(); b.stop(); }};
  }
  if (kind === 'cautery') {
    const a = osc('square', 470, 0.0); const b = noise(0, {type: 'highpass', freq: 3500, q: 0.5});
    return {set: (k) => { a.g.gain.setTargetAtTime(0.018 * k, ctx.currentTime, 0.02); b.g.gain.setTargetAtTime(0.06 * k * (0.6 + Math.random() * 0.4), ctx.currentTime, 0.01); }, stop: () => { a.stop(); b.stop(); }};
  }
  if (kind === 'suction') {
    const b = noise(0, {freq: 1500, q: 0.6}); const c = noise(0, {freq: 260, q: 3});
    return {set: (k) => { b.g.gain.setTargetAtTime(0.05 * k, ctx.currentTime, 0.05); c.g.gain.setTargetAtTime(0.03 * k * Math.random(), ctx.currentTime, 0.02); }, stop: () => { b.stop(); c.stop(); }};
  }
  return {set() {}, stop() {}};
}
export function crack() { const n = noise(0.14, {freq: 1800, q: 0.9}); setTimeout(() => n.stop(0.03), 70); blip(170, 0.12, 0.08, 'triangle'); }
export function shock() { blip(62, 0.45, 0.22, 'sine'); const n = noise(0.08, {freq: 400, q: 0.5}); setTimeout(() => n.stop(0.05), 90); }
export function charge() { const o = osc('sine', 600, 0.02); o.o.frequency.linearRampToValueAtTime(2200, ctx.currentTime + 1.4); setTimeout(() => o.stop(0.05), 1450); }
export function click() { blip(2400, 0.03, 0.03, 'square'); }
export function snip() { blip(3200, 0.02, 0.025, 'square'); blip(2600, 0.02, 0.02, 'square', 0.03); }
/** distant room tone: air handling + faint equipment fans */
let room = null;
export function startRoomTone() {
  if (room) return;
  const a = noise(0, {type: 'lowpass', freq: 420, q: 0.4}); a.g.gain.setTargetAtTime(0.022, ctx.currentTime, 1.5);
  const b = osc('sine', 120, 0); b.g.gain.setTargetAtTime(0.004, ctx.currentTime, 2);
  room = {a, b};
}
