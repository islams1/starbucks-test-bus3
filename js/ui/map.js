// Tactical map (M) + rotating minimap. Background = real top-down render of the level.
import * as THREE from 'three';
import {renderer, scene, SOFTWARE} from '../core/engine.js';
import {ROOMS, B} from '../world/building.js';
import {player} from '../actors/player.js';
import {hotspots} from './hotspots.js';
import {characters} from '../actors/character.js';
import {$, show} from './ui.js';

const EXT = {x0: -30, x1: 52, z0: -18, z1: 60};   // mapped area
let img = null;
export const mapState = {target: null, open: false, talkable: new Set()};

/** render orthographic top-down image once (roof & upper floors hidden) */
export function bakeMap(hide = []) {
  const w = EXT.x1 - EXT.x0, h = EXT.z1 - EXT.z0, px = SOFTWARE ? 800 : 1400, py = Math.round(px * h / w);
  const cam = new THREE.OrthographicCamera(EXT.x0, EXT.x1, -EXT.z0, -EXT.z1, 0.1, 200);
  cam.position.set(0, 100, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0);
  // orthographic with up = -z: left=x0, right=x1, top = -z0 ... (screen top = north)
  cam.left = EXT.x0; cam.right = EXT.x1; cam.top = -EXT.z0; cam.bottom = -EXT.z1; cam.updateProjectionMatrix();
  const rt = new THREE.WebGLRenderTarget(px, py, {samples: SOFTWARE ? 0 : 4});
  const vis = hide.map(o => [o, o.visible]); hide.forEach(o => o.visible = false);
  const fog = scene.fog; scene.fog = null; const bg = scene.background; scene.background = new THREE.Color(0x101214);
  renderer.setRenderTarget(rt); renderer.render(scene, cam); renderer.setRenderTarget(null);
  scene.fog = fog; scene.background = bg; vis.forEach(([o, v]) => o.visible = v);
  const buf = new Uint8Array(px * py * 4); renderer.readRenderTargetPixels(rt, 0, 0, px, py, buf);
  const c = document.createElement('canvas'); c.width = px; c.height = py; const g = c.getContext('2d');
  const id = g.createImageData(px, py);
  for (let y = 0; y < py; y++) for (let x = 0; x < px; x++) { const s = ((py - 1 - y) * px + x) * 4, d = (y * px + x) * 4;
    // tactical grade: desaturate + darken + slight teal
    const r = buf[s], gg = buf[s + 1], b = buf[s + 2]; const l = (r * 0.3 + gg * 0.59 + b * 0.11);
    id.data[d] = l * 0.55 + r * 0.15; id.data[d + 1] = l * 0.62 + gg * 0.15; id.data[d + 2] = l * 0.66 + b * 0.15; id.data[d + 3] = 255; }
  g.putImageData(id, 0, 0);
  // grid
  g.strokeStyle = 'rgba(120,200,190,.08)'; g.lineWidth = 1;
  for (let x = EXT.x0; x <= EXT.x1; x += 2) { const X = (x - EXT.x0) / w * px; g.beginPath(); g.moveTo(X, 0); g.lineTo(X, py); g.stroke(); }
  for (let z = EXT.z0; z <= EXT.z1; z += 2) { const Y = (z - EXT.z0) / h * py; g.beginPath(); g.moveTo(0, Y); g.lineTo(px, Y); g.stroke(); }
  // room outlines + labels
  g.font = '600 22px "IBM Plex Sans Arabic"'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const r of ROOMS) {
    const X0 = (r.x0 - EXT.x0) / w * px, X1 = (r.x1 - EXT.x0) / w * px, Y0 = (r.z0 - EXT.z0) / h * py, Y1 = (r.z1 - EXT.z0) / h * py;
    g.strokeStyle = 'rgba(217,178,111,.55)'; g.lineWidth = 2; g.strokeRect(X0, Y0, X1 - X0, Y1 - Y0);
    g.fillStyle = 'rgba(0,0,0,.55)'; const tw = g.measureText(r.name).width + 20; g.fillRect((X0 + X1) / 2 - tw / 2, (Y0 + Y1) / 2 - 17, tw, 34);
    g.fillStyle = '#f3e7cf'; g.fillText(r.name, (X0 + X1) / 2, (Y0 + Y1) / 2 + 1);
  }
  g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(px / 2 - 70, (24 - EXT.z0) / h * py - 17, 140, 34); g.fillStyle = '#cfe0e8'; g.fillText('الساحة', px / 2, (24 - EXT.z0) / h * py);
  g.fillStyle = '#9fd3c7'; g.fillText('المدخل ▲', px / 2, (B.z1 + 1.2 - EXT.z0) / h * py);
  img = c; rt.dispose();
}

const toMap = (x, z, W, H) => [(x - EXT.x0) / (EXT.x1 - EXT.x0) * W, (z - EXT.z0) / (EXT.z1 - EXT.z0) * H];
function markers(g, W, H, scale = 1) {
  // hotspots (items) + talkable people
  for (const h of hotspots.values()) {
    if (!h.when() || h.desk && h.deskOnly) continue;
    const p = typeof h.pos === 'function' ? h.pos() : h.pos; const [x, y] = toMap(p.x, p.z, W, H);
    g.fillStyle = h.kind === 'person' ? '#7cc4ff' : '#b98652'; g.beginPath(); g.arc(x, y, (h.kind === 'person' ? 7 : 5) * scale, 0, 7); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 2 * scale; g.stroke();
  }
  // objective
  const t = mapState.target; if (t) {
    const [x, y] = toMap(t.x, t.z, W, H); const k = (performance.now() / 600) % 1;
    g.strokeStyle = `rgba(255,107,91,${1 - k})`; g.lineWidth = 3 * scale; g.beginPath(); g.arc(x, y, (10 + k * 16) * scale, 0, 7); g.stroke();
    g.fillStyle = '#ff6b5b'; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 9 * scale, y - 20 * scale); g.lineTo(x + 9 * scale, y - 20 * scale); g.fill();
  }
  // player arrow
  if (player.ch) {
    const p = player.ch.holder.position, [x, y] = toMap(p.x, p.z, W, H), r = player.ch.holder.rotation.y;
    g.save(); g.translate(x, y); g.rotate(-r + Math.PI);
    g.fillStyle = '#ffd479'; g.strokeStyle = '#000'; g.lineWidth = 2 * scale;
    g.beginPath(); g.moveTo(0, -13 * scale); g.lineTo(9 * scale, 10 * scale); g.lineTo(0, 5 * scale); g.lineTo(-9 * scale, 10 * scale); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }
}

const mapc = $('mapc'), mmc = $('minimapc');
function drawMap() {
  if (!mapState.open) return;
  const r = mapc.getBoundingClientRect(); if (mapc.width !== r.width * devicePixelRatio) { mapc.width = r.width * devicePixelRatio; mapc.height = r.height * devicePixelRatio; }
  const g = mapc.getContext('2d'); g.fillStyle = '#0c0e0f'; g.fillRect(0, 0, mapc.width, mapc.height);
  if (img) {
    const s = Math.min(mapc.width / img.width, mapc.height / img.height) * 0.94;
    const W = img.width * s, H = img.height * s, ox = (mapc.width - W) / 2, oy = (mapc.height - H) / 2;
    g.save(); g.translate(ox, oy); g.drawImage(img, 0, 0, W, H); markers(g, W, H, s * 1.6); g.restore();
  }
  requestAnimationFrame(drawMap);
}
export function toggleMap(on = !mapState.open) {
  mapState.open = on; show('map', on);
  if (on) drawMap();
}
export function drawMinimap() {
  if (!img || !player.ch) return;
  const g = mmc.getContext('2d'), S = mmc.width;
  const p = player.ch.holder.position; const [px, py] = toMap(p.x, p.z, img.width, img.height);
  const zoom = 1.25; const yaw = player.mode === 'free' ? player.yaw : player.ch.holder.rotation.y;
  g.save(); g.fillStyle = '#0c0e0f'; g.fillRect(0, 0, S, S);
  g.translate(S / 2, S / 2); g.rotate(yaw + Math.PI); g.scale(zoom, zoom); g.translate(-px, -py);
  g.drawImage(img, 0, 0); markers(g, img.width, img.height, 1.2);
  g.restore();
  g.strokeStyle = 'rgba(255,255,255,.15)'; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 2, 0, 7); g.stroke();
}
