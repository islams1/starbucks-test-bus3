// Mapbox satellite imagery (Static Tiles API, the satellite-v9 style), loaded live while the game runs with the public
// token from flight.local.json (Mapbox's terms do not allow storing their tiles with the game). Two layers:
//  · the base: each of the 16 ground tiles of the core gets a 2048 px picture composed from zoom-14 tiles (@2x);
//  · the detail: when the airplane is low, zoom-17 tiles (≈0.45 m a pixel) are draped on the ground around and ahead of
//    the point below it — the river banks, the piers and the streets of the final glide.
// Every tile is turned to mid-January (bare trees, dormant lawns: the same grading as the open-data ground) before use.
// Without a token, or if Mapbox does not answer, the open-data ground (USGS) stays as it is.
import * as THREE from 'three';
import {camera, onUpdate, renderer, scene} from '../core/engine.js';
import {W, heightAt} from './world.js';

export const MB = {on: false, key: null, detail: new Map(), loading: 0};
const url = (z, x, y, hi = false) => `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/512/${z}/${x}/${y}${hi ? '@2x' : ''}?access_token=${MB.key}`;
const lon2x = (lon, z) => (lon + 180) / 360 * 2 ** z;
const lat2y = (lat, z) => { const r = lat * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z; };
const x2lon = (x, z) => x / 2 ** z * 360 - 180;
const y2lat = (y, z) => { const n = Math.PI - 2 * Math.PI * y / 2 ** z; return 180 / Math.PI * Math.atan(Math.sinh(n)); };
const img = (u) => new Promise((res) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => res(null); i.src = u; });

/** the same January grading, on the GPU: injected after the map is sampled (works on the sRGB-decoded colour) */
function winterMaterial(m, on = true) {
  m.userData.winter = {value: on ? 1 : 0};
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uWinter = m.userData.winter;
    sh.fragmentShader = 'uniform float uWinter;'+String.fromCharCode(10) + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      if (uWinter > 0.5) {
        vec3 s = pow(max(diffuseColor.rgb, vec3(0.0)), vec3(1.0 / 2.2));
        float green = clamp((s.g - max(s.r, s.b)) * 6.0, 0.0, 1.0) * 0.85, lum = dot(s, vec3(0.3, 0.59, 0.11));
        s = mix(s, vec3(lum * 1.05 + 0.03, lum * 0.95 + 0.02, lum * 0.85), green);
        s = (s - 0.5) * 0.92 + 0.48;
        diffuseColor.rgb = pow(clamp(s, 0.0, 1.0), vec3(2.2));
      }`);
  };
  m.customProgramCacheKey = () => 'mapboxWinter';
  m.needsUpdate = true;
  return m;
}
const local = (lat, lon) => { const m = W.meta; return [(lon - m.origin[1]) * m.mlon, -(lat - m.origin[0]) * m.mlat]; };

export async function loadMapbox() {
  const cfg = await fetch('flight.local.json', {cache: 'no-store'}).then(r => r.ok ? r.json() : null).catch(() => null);
  MB.key = cfg && cfg.mapboxToken; if (!MB.key || new URLSearchParams(location.search).has('nomapbox')) return null;   // ?nomapbox: the open-data imagery, for comparison
  const probe = await img(url(14, 4825, 6155));
  if (!probe) { console.warn('[mapbox] the satellite tiles did not answer for this token: keeping the open-data imagery'); return null; }
  MB.on = true; attribution();
  // build the graded ground shader now, behind the loading screen (compiling it mid-flight froze a frame for ~1 s)
  for (const m of W.ground || []) winterMaterial(m.material, false);
  try { renderer.compile(scene, camera); } catch (e) {}
  // the 16 base pictures: wait for them while loading (uploading them mid-flight made the motion stutter), at most 15 s
  await Promise.race([baseLayer(), new Promise(r => setTimeout(r, 15000))]);
  onUpdate(detailStep);
  onUpdate(addOneReady);                            // detail patches join the scene one per frame, never in bursts
  return MB;
}

// ---------------------------------------------------------------- the base: 16 ground pictures from zoom 14 @2x
async function baseLayer() {
  const [LAT0, LAT1, LON0, LON1] = W.meta.core, GT = W.meta.tiles, Z = 14, S = 2048;
  for (const m of W.ground || []) {
    const [i, j] = m.userData.ij || [];
    if (i == null) continue;
    const la1 = LAT1 - (LAT1 - LAT0) * j / GT, la0 = LAT1 - (LAT1 - LAT0) * (j + 1) / GT;
    const lo0 = LON0 + (LON1 - LON0) * i / GT, lo1 = LON0 + (LON1 - LON0) * (i + 1) / GT;
    const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
    const jobs = [];
    for (let x = Math.floor(lon2x(lo0, Z)); x <= Math.floor(lon2x(lo1, Z)); x++)
      for (let y = Math.floor(lat2y(la1, Z)); y <= Math.floor(lat2y(la0, Z)); y++) jobs.push([x, y]);
    const ims = await Promise.all(jobs.map(([x, y]) => img(url(Z, x, y, true))));
    if (ims.some(v => !v)) continue;                 // keep the open-data picture for a tile we could not complete
    jobs.forEach(([x, y], k) => {
      const tl = x2lon(x, Z), tr = x2lon(x + 1, Z), tt = y2lat(y, Z), tb = y2lat(y + 1, Z);
      g.drawImage(ims[k], (tl - lo0) / (lo1 - lo0) * S, (la1 - tt) / (la1 - la0) * S, (tr - tl) / (lo1 - lo0) * S + 0.5, (tt - tb) / (la1 - la0) * S + 0.5);
    });
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    try { renderer.initTexture(t); } catch (e) {}                    // upload now, not at the first frame it is seen
    const old = m.material.map; m.material.map = t; m.material.userData.winter.value = 1; m.material.needsUpdate = true; if (old) old.dispose();
    await new Promise(r => setTimeout(r, 30));
  }
}

// ---------------------------------------------------------------- the detail: zoom-17 patches near the airplane
const DZ = 17, MAXP = 56;
let acc = 0;
function detailStep(dt) {
  if ((acc += dt) < 0.5) return; acc = 0;
  const cp = camera.getWorldPosition(new THREE.Vector3()), agl = cp.y - Math.max(0, heightAt(cp.x, cp.z));
  if (agl > 1000) return;
  // the ground the eye is looking at: below, and ahead along the view
  const dir = camera.getWorldDirection(new THREE.Vector3()); dir.y = 0; if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1); dir.normalize();
  const ahead = Math.min(900, Math.max(150, agl * 2.2)), cx = cp.x + dir.x * ahead, cz = cp.z + dir.z * ahead, R = 520 + Math.min(400, agl * 0.5);
  const m = W.meta, lat = m.origin[0] - cz / m.mlat, lon = m.origin[1] + cx / m.mlon;
  const dLat = R / m.mlat, dLon = R / m.mlon;
  const want = [];
  for (let x = Math.floor(lon2x(lon - dLon, DZ)); x <= Math.floor(lon2x(lon + dLon, DZ)); x++)
    for (let y = Math.floor(lat2y(lat + dLat, DZ)); y <= Math.floor(lat2y(lat - dLat, DZ)); y++) {
      const [px, pz] = local((y2lat(y, DZ) + y2lat(y + 1, DZ)) / 2, (x2lon(x, DZ) + x2lon(x + 1, DZ)) / 2);
      want.push([x, y, Math.hypot(px - cx, pz - cz)]);
    }
  want.sort((a, b) => a[2] - b[2]);
  const now = performance.now();
  for (const [x, y] of want) {
    const k = x + ',' + y, p = MB.detail.get(k);
    if (p) { p.used = now; continue; }
    if (MB.loading >= 6) continue;
    MB.detail.set(k, {used: now, mesh: null}); patch(x, y, k);
  }
  // keep the nearest ones: drop the least recently wanted beyond the budget
  if (MB.detail.size > MAXP) {
    const old = [...MB.detail.entries()].filter(([, p]) => p.mesh || p.water).sort((a, b) => a[1].used - b[1].used).slice(0, MB.detail.size - MAXP);
    for (const [k, p] of old) { if (p.mesh && p.mesh.parent) { W.group.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.map.dispose(); p.mesh.material.dispose(); } MB.detail.delete(k); }
  }
}
async function patch(x, y, k) {
  MB.loading++;
  const im = await img(url(DZ, x, y));
  MB.loading--;
  const p = MB.detail.get(k); if (!p) return;
  if (!im) { MB.detail.delete(k); return; }
  const t = new THREE.Texture(im); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true;
  const [x0, z0] = local(y2lat(y, DZ), x2lon(x, DZ)), [x1, z1] = local(y2lat(y + 1, DZ), x2lon(x + 1, DZ));
  const w = x1 - x0, h = z1 - z0, geo = new THREE.PlaneGeometry(w, h, 12, 12); geo.rotateX(-Math.PI / 2);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, pos = geo.attributes.position;
  let land = 0;
  for (let i = 0; i < pos.count; i++) { const hh = heightAt(cx + pos.getX(i), cz + pos.getZ(i)); if (hh > 0.3) land++; pos.setY(i, hh + 0.45); }
  if (!land) { t.dispose(); geo.dispose(); MB.detail.set(k, {used: p.used, mesh: null, water: true}); return; }   // all river: nothing to show
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, winterMaterial(new THREE.MeshLambertMaterial({map: t})));
  mesh.position.set(cx, 0, cz); p.mesh = mesh; ready.push(p);
}
const ready = [];
function addOneReady() {
  const p = ready.shift(); if (!p || !p.mesh) return;
  if (![...MB.detail.values()].includes(p)) { p.mesh.geometry.dispose(); p.mesh.material.map.dispose(); p.mesh.material.dispose(); return; }
  try { renderer.initTexture(p.mesh.material.map); } catch (e) {}
  W.group.add(p.mesh);
}

function attribution() {
  let el = document.getElementById('mbattr');
  if (!el) { el = document.createElement('div'); el.id = 'mbattr'; document.body.appendChild(el); }
  el.style.cssText = 'position:fixed;left:10px;bottom:6px;z-index:70;font:11px Inter,sans-serif;color:#fff;opacity:.85;text-shadow:0 0 3px #000;direction:ltr';
  el.innerHTML = '<b>mapbox</b> · <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener" style="color:#fff">© Mapbox</a> <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener" style="color:#fff">© OpenStreetMap</a> <a href="https://www.mapbox.com/map-feedback/" target="_blank" rel="noopener" style="color:#fff">Improve this map</a> · Maxar';
}
