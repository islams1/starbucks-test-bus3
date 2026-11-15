// Third-person player controller (WASD + mouse), collisions against axis-aligned boxes, camera collision.
import * as THREE from 'three';
import {camera, onUpdate, damp, angleDamp, clamp} from '../core/engine.js';
import {keys, consumeMouse, input} from '../core/input.js';
import {colliders, B} from '../world/building.js';
import {footstep, startExertionBreathing} from '../core/audio.js';
import {gait} from '../core/assets.js';
import {characters, Character} from './character.js';

export const player = {
  ch: null, mode: 'cine',            // 'free' | 'cine' | 'desk'
  yaw: Math.PI, pitch: 0.12, camDist: 2.5, speed: 0, radius: 0.32, exert: 0, bob: 0,
  onMove: null,
};
const R = 0.32;

function collidePeople(p) {
  for (const id in characters) { const c = characters[id]; if (c === player.ch || !c.holder.visible || c.holder.parent !== player.ch.holder.parent) continue;
    const dx = p.x - c.holder.position.x, dz = p.z - c.holder.position.z, d = Math.hypot(dx, dz), min = 0.58;
    if (d < min && d > 1e-4) { p.x += dx / d * (min - d); p.z += dz / d * (min - d); } }
}
function collide(p) {
  for (let it = 0; it < 2; it++) for (const c of colliders) {
    const cx = clamp(p.x, c.x0, c.x1), cz = clamp(p.z, c.z0, c.z1);
    const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 < R * R) {
      if (d2 > 1e-8) { const d = Math.sqrt(d2), push = (R - d); p.x += dx / d * push; p.z += dz / d * push; }
      else { // centre inside box: push out along smallest axis
        const l = p.x - c.x0, r = c.x1 - p.x, f = p.z - c.z0, b = c.z1 - p.z, m = Math.min(l, r, f, b);
        if (m === l) p.x = c.x0 - R; else if (m === r) p.x = c.x1 + R; else if (m === f) p.z = c.z0 - R; else p.z = c.z1 + R;
      }
    }
  }
}
/** distance along segment a->b (XZ) before hitting a collider box (expanded by pad) */
function rayHit(ax, az, bx, bz, pad = 0.18) {
  let best = 1;
  const dx = bx - ax, dz = bz - az;
  for (const c of colliders) {
    const x0 = c.x0 - pad, x1 = c.x1 + pad, z0 = c.z0 - pad, z1 = c.z1 + pad;
    if (ax > x0 && ax < x1 && az > z0 && az < z1) continue;   // start inside: ignore
    let t0 = 0, t1 = 1;
    for (const [o, d, lo, hi] of [[ax, dx, x0, x1], [az, dz, z0, z1]]) {
      if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) { t0 = 2; break; } continue; }
      let ta = (lo - o) / d, tb = (hi - o) / d; if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) break;
    }
    if (t0 <= t1 && t0 < best && t0 >= 0) best = t0;
  }
  return best;
}
export const insideBuilding = (x, z) => x > B.x0 && x < B.x1 && z > B.z0 && z < B.z1;

const _t = new THREE.Vector3(), _c = new THREE.Vector3();
let stepPh = 0;
export function initPlayer(ch) {
  player.ch = ch; Character.player = ch;
  ch.o.talkAnims = ['m_gestic_talk_neutral_01', 'm_gestic_talk_relaxed_01'];
  ch.o.presentAnims = ['m_gestic_presentation_right_01', 'm_gestic_presentation_left_01'];
  ch.setBase('m_idle_neutral_02');
  startExertionBreathing(() => player.ch && player.ch.holder.visible ? player.exert : 0);
  onUpdate((dt) => {
    // exertion: ~7 s of running to be out of breath; recovers in ~10 s walking, faster standing still
    if (player.speed > 2.2) player.exert = Math.min(1, player.exert + dt / 7);
    else player.exert = Math.max(0, player.exert - dt / (player.speed > 0.3 ? 10 : 6));
    ch.exertion = player.exert;
    if (player.mode !== 'free') { player.speed = 0; return; }
    const h = ch.holder;
    const m = consumeMouse();
    if (input.look) { player.yaw -= m.x * 0.0022; player.pitch = clamp(player.pitch + m.y * 0.0018, -0.55, 0.75); }
    let fx = 0, fz = 0;
    if (input.enabled) {
      if (keys.has('KeyW') || keys.has('ArrowUp')) fz += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) fz -= 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) fx += 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) fx -= 1;
    }
    const run = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const len = Math.hypot(fx, fz);
    const tired = Math.max(0, (player.exert - 0.7) / 0.3);          // out of breath: can't keep sprinting
    const want = len > 0 ? (run ? 3.3 * (1 - 0.25 * tired) : 1.25) : 0;
    player.speed = damp(player.speed, want, len > 0 ? 6 : 9, dt);
    if (len > 0) {
      const ang = player.yaw + Math.atan2(fx, fz);
      h.rotation.y = angleDamp(h.rotation.y, ang, 10, dt);
    }
    const sp = player.speed;
    if (sp > 0.02) {
      h.position.x += Math.sin(h.rotation.y) * sp * dt;
      h.position.z += Math.cos(h.rotation.y) * sp * dt;
      collidePeople(h.position); collide(h.position);
    }
    // animation blend
    const restAnim = player.exert > 0.45 ? 'm_idle_breathe_01' : ch.baseName;   // catching breath after a run
    const anim = sp > 2.1 ? 'm_run_neutral_01' : sp > 0.2 ? 'm_walk_neutral_01' : restAnim;
    if (ch.curName !== anim && !ch.voice) ch.play(anim, {fade: anim === ch.baseName || anim === restAnim ? 0.5 : 0.25});
    const hs = ch.o.height / 1.75;   // stride scales with body height; cadence follows ground speed (no foot sliding)
    if (anim === 'm_walk_neutral_01') ch.cur.timeScale = clamp(sp / ((gait.m_walk_neutral_01 || 1.01) * hs), 0.5, 1.6);
    if (anim === 'm_run_neutral_01') ch.cur.timeScale = clamp(sp / ((gait.m_run_neutral_01 || 2.88) * hs), 0.6, 1.5);
    if (anim !== ch.baseName && anim !== restAnim && ch.cur) {
      const ph = (ch.cur.time / ch.cur.getClip().duration) * 2 % 1;
      if (ph < stepPh) footstep(!run || true, run ? 1.2 : 0.9);
      stepPh = ph;
    }
    // camera
    const inside = insideBuilding(h.position.x, h.position.z);
    _t.set(h.position.x, h.position.y + 1.58, h.position.z);
    const dist = inside ? 2.25 : 2.9;
    const cy = Math.cos(player.pitch);
    const sh = 0.38;   // over-the-shoulder offset (right)
    const bx = -Math.sin(player.yaw) * cy * dist + Math.cos(player.yaw) * -sh, bz = -Math.cos(player.yaw) * cy * dist - Math.sin(player.yaw) * -sh;
    const hit = rayHit(_t.x, _t.z, _t.x + bx, _t.z + bz);
    const f = Math.max(0.15, hit);
    player.camDist = f < player.camDist ? f : damp(player.camDist, f, 3, dt);
    _c.set(_t.x + bx * player.camDist, _t.y + Math.sin(player.pitch) * dist * player.camDist, _t.z + bz * player.camDist);
    if (inside) _c.y = Math.min(_c.y, B.H - 0.25);
    _c.y = Math.max(0.4, _c.y);
    player.bob += dt * (sp > 2.1 ? 11 : sp > 0.2 ? 6.5 : 1.6 + 2.5 * player.exert);
    const bobAmp = sp > 2.1 ? 0.04 : sp > 0.2 ? 0.012 : 0.01 * player.exert;
    _c.y += Math.abs(Math.sin(player.bob)) * bobAmp; _c.x += Math.cos(player.bob) * bobAmp * 0.4 * Math.cos(player.yaw); _c.z -= Math.cos(player.bob) * bobAmp * 0.4 * Math.sin(player.yaw);
    camera.position.copy(_c);
    camera.rotation.set(-player.pitch * 0.85, player.yaw + Math.PI, Math.sin(player.bob) * bobAmp * 0.35, 'YXZ');
    // character fades when camera is very close (avoid clipping into the head)
    ch.fbx.visible = player.camDist > 0.3;
    if (player.onMove) player.onMove(h.position);
  });
}
export function setPlayerMode(m) {
  player.mode = m;
  if (m === 'free') { player.ch.fbx.visible = true; player.yaw = player.ch.holder.rotation.y; }
}
export function teleport(x, z, ry) { const h = player.ch.holder; h.position.set(x, 0, z); h.rotation.y = ry; player.yaw = ry; h.visible = true; }
