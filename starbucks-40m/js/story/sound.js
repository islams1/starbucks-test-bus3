// Café soundscape (synthesised): crowd murmur, ticket printer, steam wand, grinder, cups, door bell, street outside.
import * as THREE from 'three';
import {ctx} from '../core/audio.js';
import {camera, onUpdate} from '../core/engine.js';
import {B} from '../world/building.js';

const bus = ctx.createGain(); bus.gain.value = 0; bus.connect(ctx.destination);
const street = ctx.createGain(); street.gain.value = 0; street.connect(bus);
const room = ctx.createGain(); room.gain.value = 0; room.connect(bus);
let started = false, level = 1, nextT = {}, timers = [];

function noise(sec, brown) {
  const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate), d = b.getChannelData(0);
  let last = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
  return b;
}
const N = {brown: noise(6, true), white: noise(3, false), pink: (() => { const b = ctx.createBuffer(1, ctx.sampleRate * 5, ctx.sampleRate), d = b.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0527; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; } return b; })()};
function loop(buf, type, freq, q, gain, dest) {
  const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.loopStart = Math.random();
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.value = gain; s.connect(f); f.connect(g); g.connect(dest); s.start(); return g;
}
function burst(t, {buf = N.white, type = 'bandpass', freq = 2000, q = 1, gain = 0.05, a = 0.005, d = 0.1, dest = room} = {}) {
  const s = ctx.createBufferSource(); s.buffer = buf; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random() * 2, a + d + 0.05);
}
function ping(t, f0, gain = 0.02, dur = 0.4, dest = room) {
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f0;
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
}

// crowd murmur: several band-limited voices whose loudness wanders (syllable-rate modulation)
const murmurs = [];
function murmur() {
  for (let i = 0; i < 6; i++) {
    const g = loop(N.pink, 'bandpass', 380 + i * 140, 1.6, 0.0, room);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 2.5 + Math.random() * 3; const lg = ctx.createGain(); lg.gain.value = 0.0;
    lfo.connect(lg); lg.connect(g.gain); lfo.start();
    murmurs.push({g, lg, base: 0.05 + Math.random() * 0.03});
  }
}
export function startCafeSound() {
  if (started) return; started = true;
  loop(N.brown, 'lowpass', 140, 0.5, 0.25, room);                          // fridge / HVAC hum
  loop(N.brown, 'lowpass', 260, 0.7, 0.45, street);                        // traffic rumble outside
  murmur();
  bus.gain.setTargetAtTime(0.9, ctx.currentTime, 1.2);
  setCrowd(1);
  const tick = () => {
    const t = ctx.currentTime;
    if (Math.random() < 0.35 * level) cups(t + Math.random());
    if (Math.random() < 0.12 * level) printer(t + Math.random());
    if (Math.random() < 0.06 * level) grinder(t + Math.random());
    if (Math.random() < 0.05 * level) steam(t + Math.random() * 2);
    if (Math.random() < 0.05 * level) knock(t + Math.random());
    timers.push(setTimeout(tick, 1200));
    if (timers.length > 20) timers.shift();
  };
  tick();
}
/** busy (1) or quiet (0.25) */
export function setCrowd(v) {
  level = v;
  for (const m of murmurs) { m.g.gain.setTargetAtTime(m.base * v * 0.6, ctx.currentTime, 1.5); m.lg.gain.setTargetAtTime(m.base * v * 0.5, ctx.currentTime, 1.5); }
}
export function printer(t = ctx.currentTime) {
  for (let i = 0; i < 22; i++) burst(t + i * 0.028, {freq: 3200 + Math.random() * 800, q: 4, gain: 0.03, d: 0.02});
  burst(t, {buf: N.brown, type: 'lowpass', freq: 900, gain: 0.06, a: 0.05, d: 0.6});
  burst(t + 0.7, {freq: 5000, q: 0.7, gain: 0.03, a: 0.01, d: 0.12});     // tear
}
export function cups(t = ctx.currentTime) { ping(t, 2800 + Math.random() * 900, 0.012, 0.25); if (Math.random() < 0.5) ping(t + 0.08, 3600 + Math.random() * 600, 0.008, 0.18); }
export function steam(t = ctx.currentTime) {
  const s = ctx.createBufferSource(); s.buffer = N.white; s.loop = true; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3600; f.Q.value = 0.5;
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.03, t + 0.3); g.gain.setValueAtTime(0.03, t + 2.4); g.gain.linearRampToValueAtTime(0, t + 3.0);
  s.connect(f); f.connect(g); g.connect(room); s.start(t); s.stop(t + 3.1);
}
export function grinder(t = ctx.currentTime) {
  const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 160; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1200;
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.012, t + 0.1); g.gain.setValueAtTime(0.012, t + 2.2); g.gain.linearRampToValueAtTime(0, t + 2.4);
  o.connect(f); f.connect(g); g.connect(room); o.start(t); o.stop(t + 2.5);
  burst(t, {buf: N.white, type: 'bandpass', freq: 1800, q: 0.6, gain: 0.015, a: 0.1, d: 2.3});
}
export function knock(t = ctx.currentTime) { burst(t, {buf: N.brown, type: 'lowpass', freq: 400, gain: 0.12, a: 0.003, d: 0.12}); burst(t + 0.12, {buf: N.brown, type: 'lowpass', freq: 380, gain: 0.08, a: 0.003, d: 0.1}); }
export function doorBell() { const t = ctx.currentTime; ping(t, 1318, 0.03, 1.2); ping(t + 0.14, 1760, 0.025, 1.4); }
export function tick(t = ctx.currentTime, g = 0.02) { burst(t, {freq: 4200, q: 6, gain: g, d: 0.015}); }
export function whoosh() { const t = ctx.currentTime; burst(t, {buf: N.white, type: 'bandpass', freq: 900, q: 0.5, gain: 0.04, a: 0.4, d: 0.8}); }

// inside: the street is muffled; outside: louder street, quieter room
onUpdate(() => {
  if (!started) return;
  const cp = camera.position, inside = cp.x > B.x0 && cp.x < B.x1 && cp.z > B.z0 && cp.z < B.z1 && cp.y < 3.6;
  const up = cp.y > 3.6;
  room.gain.setTargetAtTime(up ? 0.12 : inside ? 1 : 0.25, ctx.currentTime, 0.4);
  street.gain.setTargetAtTime(up ? 0.12 : inside ? 0.18 : 0.9, ctx.currentTime, 0.4);
});
export function muteCafe(on) { bus.gain.setTargetAtTime(on ? 0 : 0.9, ctx.currentTime, 0.6); }
