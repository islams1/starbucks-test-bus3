// Web Audio: voice-over with live amplitude for lip-sync, positional panning, and synthesized ambience/SFX.
import * as THREE from 'three';
import {camera} from './engine.js';

export const ctx = new (window.AudioContext || window.webkitAudioContext)();
const master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
const voiceBus = ctx.createGain(); voiceBus.gain.value = 1.0; voiceBus.connect(master);
const ambBus = ctx.createGain(); ambBus.gain.value = 0.0; ambBus.connect(master);
const sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
export function resume() { if (ctx.state !== 'running') ctx.resume(); }
addEventListener('pointerdown', resume); addEventListener('keydown', resume);

const bufCache = new Map();
export function loadBuffer(url) {
  if (!bufCache.has(url)) bufCache.set(url, fetch(url).then(r => { if (!r.ok) throw new Error(url); return r.arrayBuffer(); }).then(a => ctx.decodeAudioData(a)));
  return bufCache.get(url);
}

const _v = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3();
/**
 * Play a voice line. getPos(): world position of the speaker (or null = non-diegetic).
 * Returns {duration, time(), amp(), bands(), done:Promise, stop()}
 */
export async function playVoice(url, getPos = null, {volume = 1, radio = false} = {}) {
  const buffer = await loadBuffer(url);
  const src = ctx.createBufferSource(); src.buffer = buffer;
  const an = ctx.createAnalyser(); an.fftSize = 512; an.smoothingTimeConstant = 0.35;
  const g = ctx.createGain(); g.gain.value = volume;
  const pan = ctx.createStereoPanner();
  let chain = src;
  if (radio) { // phone / video call colouring
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 320;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3400;
    src.connect(hp); hp.connect(lp); chain = lp;
  }
  chain.connect(an); an.connect(g); g.connect(pan); pan.connect(voiceBus);
  const t0 = ctx.currentTime + 0.03;
  src.start(t0);
  const td = new Uint8Array(an.fftSize), fd = new Uint8Array(an.frequencyBinCount);
  let stopped = false, raf = 0;
  const update = () => {
    if (stopped) return;
    if (getPos) {
      const p = getPos(); if (p) {
        camera.getWorldPosition(_f); _v.copy(p).sub(_f);
        const dist = _v.length();
        camera.getWorldDirection(_r); _r.cross(camera.up).normalize();   // camera right
        pan.pan.value = Math.max(-0.6, Math.min(0.6, _v.normalize().dot(_r) * 0.6));
        g.gain.value = volume * Math.min(1, 2.2 / Math.max(1.2, dist)) ** 0.8;
      }
    }
    raf = requestAnimationFrame(update);
  };
  update();
  const done = new Promise(res => { src.onended = () => { stopped = true; cancelAnimationFrame(raf); res(); }; });
  return {
    duration: buffer.duration,
    time: () => Math.max(0, ctx.currentTime - t0),
    amp() { an.getByteTimeDomainData(td); let s = 0; for (let i = 0; i < td.length; i++) { const x = (td[i] - 128) / 128; s += x * x; } return Math.sqrt(s / td.length); },
    bands() { an.getByteFrequencyData(fd); const sr = ctx.sampleRate, bin = sr / an.fftSize; let lo = 0, mid = 0, hi = 0;
      for (let i = 1; i < fd.length; i++) { const f = i * bin, v = fd[i] / 255; if (f < 900) lo += v; else if (f < 2600) mid += v; else if (f < 7000) hi += v; }
      return {lo: lo / (900 / bin), mid: mid / (1700 / bin), hi: hi / (4400 / bin)}; },
    done,
    stop() { if (!stopped) { try { src.stop(); } catch (e) {} } },
  };
}

// ---------- synthesized ambience ----------
function noiseBuffer(sec = 4, brown = true) {
  const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate); const d = b.getChannelData(0);
  let last = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
  return b;
}
const noises = {brown: noiseBuffer(6, true), white: noiseBuffer(3, false)};
function loopNoise(type, filt, freq, q, gain, dest) {
  const s = ctx.createBufferSource(); s.buffer = noises[type]; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = filt; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.value = gain;
  s.connect(f); f.connect(g); g.connect(dest); s.start();
  return {s, f, g};
}
const amb = {};
let ambStarted = false;
export function startAmbience() {
  if (ambStarted) return; ambStarted = true;
  // outdoor: city rumble + wind gusts
  amb.outGain = ctx.createGain(); amb.outGain.gain.value = 0; amb.outGain.connect(ambBus);
  amb.city = loopNoise('brown', 'lowpass', 220, 0.7, 0.55, amb.outGain);
  amb.wind = loopNoise('white', 'bandpass', 520, 0.6, 0.035, amb.outGain);
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09; const lg = ctx.createGain(); lg.gain.value = 0.03; lfo.connect(lg); lg.connect(amb.wind.g.gain); lfo.start();
  // indoor: HVAC room tone
  amb.inGain = ctx.createGain(); amb.inGain.gain.value = 0; amb.inGain.connect(ambBus);
  amb.hvac = loopNoise('brown', 'lowpass', 160, 0.5, 0.35, amb.inGain);
  amb.hvac2 = loopNoise('white', 'lowpass', 900, 0.3, 0.012, amb.inGain);
  ambBus.gain.setTargetAtTime(0.5, ctx.currentTime, 1.5);
  // random office sounds: keyboard clicks, distant chair creaks, notification pings (Mei)
  const tick = () => {
    if (amb.indoor > 0.5 && Math.random() < 0.7) keyboardBurst(amb.officeLevel ?? 0.4);
    setTimeout(tick, 900 + Math.random() * 2600);
  };
  tick();
}
amb.indoor = 0;
export function setEnvironment(indoor, officeLevel = 0.4) {
  if (!ambStarted) return;
  amb.indoor = indoor; amb.officeLevel = officeLevel;
  amb.outGain.gain.setTargetAtTime(indoor ? 0.08 : 1.0, ctx.currentTime, 0.8);
  amb.inGain.gain.setTargetAtTime(indoor ? 1.0 : 0.0, ctx.currentTime, 0.8);
}
export function setAmbienceLevel(v) { ambBus.gain.setTargetAtTime(v, ctx.currentTime, 0.6); }

function keyboardBurst(level) {
  const n = 4 + (Math.random() * 14 | 0); let t = ctx.currentTime;
  for (let i = 0; i < n; i++) { t += 0.06 + Math.random() * 0.12; click(t, 2400 + Math.random() * 1600, 0.012 * level, 0.018); }
}
function click(t, freq, gain, dur) {
  const s = ctx.createBufferSource(); s.buffer = noises.white;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 3;
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(ambBus); s.start(t, Math.random() * 2, dur + 0.02);
}
export function footstep(hard = true, vol = 1) {
  const t = ctx.currentTime;
  const s = ctx.createBufferSource(); s.buffer = noises.white;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = hard ? 1400 : 700;
  const f2 = ctx.createBiquadFilter(); f2.type = 'peaking'; f2.frequency.value = 120; f2.gain.value = 10;
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.07 * vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
  s.connect(f); f.connect(f2); f2.connect(g); g.connect(sfxBus); s.start(t, Math.random() * 2, 0.14);
}
export function tone(freqs, {dur = 0.5, gain = 0.06, type = 'sine', attack = 0.01, delay = 0} = {}) {
  const t = ctx.currentTime + delay;
  for (const fr of [].concat(freqs)) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = fr;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }
}
/** exertion breathing: a continuous inhale/exhale cycle whose rate and loudness follow getEx() (0..1) */
export function startExertionBreathing(getEx) {
  const puff = (dur, freq, gain) => {
    const t = ctx.currentTime; const s = ctx.createBufferSource(); s.buffer = noises.white;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.9;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + dur * 0.35); g.gain.linearRampToValueAtTime(0, t + dur);
    s.connect(f); f.connect(g); g.connect(voiceBus); s.start(t, Math.random() * 2, dur + 0.05);
  };
  const cycle = () => {
    const ex = Math.max(0, Math.min(1, getEx()));
    const period = 3.6 - 2.85 * ex;                  // 3.6 s calm → 0.75 s panting
    if (ex > 0.12) {
      const v = 0.006 + 0.05 * ex * ex;
      puff(period * 0.38, 1350 + 300 * ex, v);                                       // inhale
      setTimeout(() => puff(period * 0.48, 780 + 200 * ex, v * 1.15), period * 420);   // exhale (a little louder)
    }
    setTimeout(cycle, period * 1000);
  };
  cycle();
}
/** soft audible inhale before a line (filtered noise swell) */
export function breath(vol = 1) {
  const t = ctx.currentTime; const s = ctx.createBufferSource(); s.buffer = noises.white;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.8;
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.018 * vol, t + 0.22); g.gain.linearRampToValueAtTime(0, t + 0.38);
  s.connect(f); f.connect(g); g.connect(voiceBus); s.start(t, Math.random(), 0.42);
}
export const sfx = {
  steam: () => { const t = ctx.currentTime; const s = ctx.createBufferSource(); s.buffer = noises.white; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 0.6;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.3); g.gain.setValueAtTime(0.05, t + 2.2); g.gain.linearRampToValueAtTime(0, t + 2.8);
    s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t); s.stop(t + 3);
    tone([90, 120], {dur: 2.6, gain: 0.03, type: 'sawtooth', attack: 0.2}); },
  ui: () => tone(880, {dur: 0.08, gain: 0.03, type: 'triangle'}),
  evidence: () => { tone([660, 990], {dur: 0.5, gain: 0.035}); tone([880, 1320], {dur: 0.6, gain: 0.03, delay: 0.09}); },
  ping: () => { tone(1568, {dur: 0.25, gain: 0.03}); tone(2093, {dur: 0.3, gain: 0.025, delay: 0.07}); },
  paper: () => { const t = ctx.currentTime; const s = ctx.createBufferSource(); s.buffer = noises.white; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500; const g = ctx.createGain(); g.gain.setValueAtTime(0.0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t, 0, 0.35); },
  knock: () => { for (let i = 0; i < 3; i++) { const t = ctx.currentTime + i * 0.17; const o = ctx.createOscillator(); o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.08); const g = ctx.createGain(); g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12); o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.15); } },
  ring: () => { for (let i = 0; i < 2; i++) tone([440, 480], {dur: 0.9, gain: 0.03, delay: i * 1.6}); },
  heartbeat(on) {
    if (on && !this._hb) { const beat = () => { tone(52, {dur: 0.22, gain: 0.22}); tone(46, {dur: 0.25, gain: 0.16, delay: 0.24}); }; beat(); this._hb = setInterval(beat, 1050); }
    if (!on && this._hb) { clearInterval(this._hb); this._hb = null; }
  },
  success: () => { tone([392, 494, 587], {dur: 2.2, gain: 0.03, attack: 0.3}); tone([523, 659, 784], {dur: 2.6, gain: 0.025, attack: 0.4, delay: 0.5}); },
  fail: () => { tone([196, 185], {dur: 2.0, gain: 0.04, attack: 0.2, type: 'sawtooth'}); },
  applause() { // synthesized crowd clap texture
    const t0 = ctx.currentTime;
    for (let i = 0; i < 90; i++) { const t = t0 + Math.random() * 3.2; click(t, 1200 + Math.random() * 1500, 0.05 * (1 - (t - t0) / 3.6), 0.05); }
  },
};
