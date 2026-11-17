// Flying the A320 by hand after the bird strike: a glide with no thrust. The stick commands what an Airbus fly-by-wire
// stick commands — load factor in pitch, roll rate in roll — and in NORMAL LAW (electrical power kept by the APU, as the
// real captain did at 15:27:21) the protections hold the flight path and bank when you let go and will not let the
// airplane stall. Without the APU the flight controls fall back to ALTERNATE LAW: no stall protection, no path hold.
// The energy is real: nose down = faster, nose up = slower, best glide ~17:1 near green dot, flaps add drag and lower the
// stall speed. Touching the water: sink rate, pitch, bank and speed decide how well the ditching goes.
import * as THREE from 'three';
import {AC} from './aircraft.js';
import {heightAt} from './world.js';

const D2R = Math.PI / 180, KT = 0.5144, G = 9.81;
export const FLY = {
  on: false, law: 'normal', V: 0, gam: 0, psi: 0, phi: 0, n: 1, alpha: 3, sp: 0, sr: 0, input: {sp: 0, sr: 0},
  wind: new THREE.Vector3(3.56, 0, 2.06),         // 300° at 8 kt (NTSB weather): blowing toward the south-east
  touch: null, stall: false, onTouch: null, onCrash: null, lastInput: 0,
};
/** runways the captain could try for (set by aircraft.js: threshold p, heading, length m). on: over the paved runway;
 *  approach: in the final-approach corridor before the threshold (so a low approach is not counted as hitting the city) */
export const RUNWAYS = [];
function runwayAt(x, z) {
  for (const r of RUNWAYS) {
    const a = r.hdg * D2R, fx = Math.sin(a), fz = -Math.cos(a), dx = x - r.p.x, dz = z - r.p.z;
    const along = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
    if (along > -60 && along < r.len && side < 75) return {on: true, key: r.key};
    if (along > -3500 && along <= -60 && side < 150 + (-along) * 0.08) return {on: false, approach: true, key: r.key};
  }
  return {on: false, approach: false, key: null};
}
const VS1G = [145, 135, 125, 120, 115];            // 1-g stall speed by flap setting (kt), about 68 t
const VMD = [210, 195, 180, 170, 160];             // best-glide speed by flap setting (kt)
const LD = [16.5, 14, 12, 10.5, 9];                // best lift/drag with both engines windmilling, by flap setting

/** the captain takes the controls: start from the current state of the airplane */
export function takeControl() {
  if (FLY.on) return;
  FLY.on = true;
  FLY.V = Math.max(60, (AC.ias || 200) * KT * 1.03);
  FLY.gam = Math.atan2(AC.vs || 0, Math.max(40, AC.gs || 100));
  FLY.psi = AC.hdg * D2R; FLY.phi = AC.bank * D2R;
  FLY.pos = AC.pos.clone();
}
export function setLaw(law) { FLY.law = law; }

// ---------------------------------------------------------------- input: keyboard, gamepad, on-screen stick
const keys = new Set();
addEventListener('keydown', (e) => { if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyS', 'KeyA', 'KeyD'].includes(e.code)) { keys.add(e.code); e.preventDefault(); } });
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
export const STICK = {x: 0, y: 0, active: false};      // on-screen stick: x roll (−1 left), y pitch (+1 pull)
function readInput(dt) {
  let sp = 0, sr = 0;
  if (keys.has('ArrowDown') || keys.has('KeyS')) sp += 1;            // pull back: nose up
  if (keys.has('ArrowUp') || keys.has('KeyW')) sp -= 1;              // push: nose down
  if (keys.has('ArrowLeft') || keys.has('KeyA')) sr -= 1;
  if (keys.has('ArrowRight') || keys.has('KeyD')) sr += 1;
  if (STICK.active) { sp = STICK.y; sr = STICK.x; }
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads) if (p && p.axes && p.axes.length >= 2) { const ax = p.axes[0], ay = p.axes[1]; if (Math.abs(ax) > 0.12) sr = ax; if (Math.abs(ay) > 0.12) sp = ay; }
  // smooth like a spring-loaded sidestick
  FLY.input.sp += (sp - FLY.input.sp) * Math.min(1, dt * 8); FLY.input.sr += (sr - FLY.input.sr) * Math.min(1, dt * 8);
  if (Math.abs(sp) + Math.abs(sr) > 0.05) FLY.lastInput = performance.now();
  return FLY.input;
}
export const anyInput = () => keys.size > 0 || STICK.active || (navigator.getGamepads && [...navigator.getGamepads()].some(p => p && p.axes && (Math.abs(p.axes[0]) > 0.2 || Math.abs(p.axes[1]) > 0.2)));

// ---------------------------------------------------------------- the glide
export function step(dt) {
  if (!FLY.on || FLY.touch) return;
  const {sp, sr} = readInput(dt);
  const f = Math.min(4, AC.flaps || 0), vs1g = VS1G[f] * KT, vmd = VMD[f] * KT, ld = LD[f];
  const V = FLY.V, cg = Math.cos(FLY.gam);
  const normal = FLY.law === 'normal';
  // pitch: load factor demand; neutral stick holds the flight path (normal law) or just 1 g (alternate)
  const nHold = normal ? cg / Math.max(0.3, Math.cos(FLY.phi)) : 1;
  let nCmd = nHold + (sp > 0 ? sp * 1.5 : sp * 1.0);
  const nAero = (V / vs1g) ** 2;                                   // what the wing can give at this speed
  if (normal) {                                                    // alpha protection: never beyond ~ 0.9 of the stall
    const nProt = nAero * 0.82; if (nCmd > nProt) nCmd = nProt;
    if (FLY.gam * 180 / Math.PI > 25 && nCmd > cg) nCmd = cg;       // pitch attitude protection
    if (FLY.gam * 180 / Math.PI < -14 && nCmd < cg) nCmd = cg;
  }
  FLY.stall = !normal && nCmd > nAero;
  let n = Math.min(nCmd, nAero);
  if (FLY.stall) n = nAero * 0.55;                                // stalled: the wing gives up much of its lift
  n = Math.max(-0.8, Math.min(2.5, n));
  FLY.n += (n - FLY.n) * Math.min(1, dt * 3.5);
  // roll: rate command; neutral stick holds bank up to 33° (normal law), steeper bank returns to 33°, max 67°
  let p = sr * 15 * D2R;
  if (normal && Math.abs(sr) < 0.05) { const lim = 33 * D2R; if (Math.abs(FLY.phi) > lim) p = -Math.sign(FLY.phi) * 5 * D2R; else p = 0; }
  if (!normal && Math.abs(sr) < 0.05) p = FLY.phi * 0.03;          // a slow spiral tendency
  FLY.phi = Math.max(-67 * D2R, Math.min(67 * D2R, FLY.phi + p * dt));
  if (FLY.stall) FLY.phi += (Math.random() - 0.5) * 0.04;
  // energy: no thrust; drag from the polar (parasite grows with V², induced with n² / V²); flaps add drag
  const D = G / (2 * ld) * ((V / vmd) ** 2 + FLY.n * FLY.n * (vmd / V) ** 2);
  FLY.V = Math.max(25, V + (-G * Math.sin(FLY.gam) - D) * dt);
  FLY.gam += G / V * (FLY.n * Math.cos(FLY.phi) - cg) * dt;
  FLY.gam = Math.max(-35 * D2R, Math.min(30 * D2R, FLY.gam));
  FLY.psi += G * FLY.n * Math.sin(FLY.phi) / (V * Math.max(0.3, cg)) * dt;
  FLY.alpha = 2.6 * FLY.n * (vmd / V) ** 2 + f * 0.6 + (FLY.stall ? 9 : 0);
  // move (air + wind)
  const vx = Math.sin(FLY.psi) * cg * V + FLY.wind.x, vz = -Math.cos(FLY.psi) * cg * V + FLY.wind.z, vy = Math.sin(FLY.gam) * V;
  FLY.pos.x += vx * dt; FLY.pos.y += vy * dt; FLY.pos.z += vz * dt;
  // hand the state to the airplane (heading 0 = north, clockwise)
  AC.pos.copy(FLY.pos); AC.alt = FLY.pos.y; AC.hdg = ((FLY.psi / D2R) % 360 + 360) % 360; AC.bank = FLY.phi / D2R;
  AC.pitch = (FLY.gam / D2R) + FLY.alpha; AC.gs = Math.hypot(vx, vz); AC.vs = vy; AC.ias = FLY.V / KT / 1.03;
  // the surface below: the river (water level 0) or the ground; near a runway the ground is allowed (a landing)
  // (LaGuardia's runway 13 starts on a pier over Flushing Bay: the runway wins over the water under it)
  const rw = runwayAt(FLY.pos.x, FLY.pos.z), h = heightAt(FLY.pos.x, FLY.pos.z), water = h < 0.3 && !rw.on, ground = water ? 0 : Math.max(0, h);
  AC.agl = FLY.pos.y - ground;
  if (!water && !rw.on && !rw.approach && AC.agl < 60) { FLY.touch = {kind: 'crash'}; FLY.onCrash && FLY.onCrash(); return; }   // into the city
  if (FLY.pos.y - ground < 2.2) {
    const t = {kind: water ? 'water' : rw.on ? 'runway' : 'crash', ias: AC.ias, sink: -vy / 0.3048 * 60, pitch: AC.pitch, bank: Math.abs(AC.bank), runway: rw.key};
    t.grade = t.kind === 'crash' ? 'crash'
      : t.kind === 'runway' ? ((t.sink < 900 && t.bank < 8 && t.ias < 190) ? 'landed' : 'crash')
      : (t.bank < 6 && t.pitch > 5 && t.pitch < 13 && t.sink < 650 && t.ias < 160) ? 'smooth'
      : (t.bank < 12 && t.sink < 1000 && t.pitch > 2) ? 'hard' : 'broken';
    if (t.grade === 'crash') t.kind = 'crash';
    FLY.touch = t; FLY.onTouch && FLY.onTouch(t);
  }
}
