// Google Photorealistic 3D Tiles (Map Tiles API) — the real, photographed New York, through the key in
// flight.local.json (written from .env.local by tools/flight_config.py). The tiles are placed in the scenery's local frame
// (origin ORIGIN, x east, y up, z south) and lifted by the geoid height so the river sits at the water level (y = 0).
// It is the game's only city: without it the game waits (and keeps asking). Google's attribution is always on screen.
import * as THREE from 'three';
import {scene, camera, renderer, onUpdate} from '../core/engine.js';
import {W, waterAt} from './world.js';
const _bb = new THREE.Box3();

const LIB = 'https://cdn.jsdelivr.net/npm/3d-tiles-renderer@0.3.46/src/';
const GEOID_NYC = 32.7;             // the WGS84 ellipsoid lies ~32.7 m below mean sea level in New York
export const GT = {tiles: null, on: false, detail: 'cinema'};
/** how sharp the photographed city is asked to be (lower = more detail, more tiles): the cinematic opening and the
 *  ending get the most, the flight itself (the camera moving at 100 m/s, integrated graphics) a little less */
// (the outside shots ask a little less than they did, 14 rather than 10: the city they show is then complete, real and
// sharp within seconds, where at 10 it took this machine half a minute of unpacking tiles)
export const DETAIL = {cinema: 14, flight: 12};
let detailKind = 'cinema', boosted = 0;
export function setDetail(kind) {
  if (!GT.tiles) return;
  detailKind = GT.detail = kind; GT.tiles.errorTarget = DETAIL[kind] || DETAIL.flight; pace();
}
// preparing a tile is mostly waiting (the geometry is unpacked in a worker, the photo decoded off the main thread), so
// how many are prepared side by side sets the pace: many at once, straight away, while the screen is dark or the
// loading screen is up (boost); on screen, a few at a time in the idle time after each frame, fewer while flying
const idle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, {timeout: 400}) : setTimeout(fn, 8));
const now0 = (fn) => setTimeout(fn, 0);
function pace() {
  const q = GT.tiles && GT.tiles.parseQueue; if (!q) return;
  if (boosted > 0) { q.maxJobs = 16; q.schedulingCallback = now0; GT.tiles.downloadQueue.maxJobs = 24; }
  else { q.maxJobs = detailKind === 'cinema' ? 4 : 5; q.schedulingCallback = idle; GT.tiles.downloadQueue.maxJobs = detailKind === 'cinema' ? 20 : 18; }
  q.scheduleJobRun && q.scheduleJobRun();
}
export function boost(on) { boosted = Math.max(0, boosted + (on ? 1 : -1)); pace(); }
/** a second viewpoint for the tiles, never drawn: the next shot of a cinematic, so its tiles arrive before the cut.
 *  Returns the function that removes it. */
export function addViewpoint(cam, scale = 0.5) {
  const t = GT.tiles; if (!GT.on || !t) return () => {};
  // at half the screen's resolution: a level coarser than the shot will want (the last level comes in the dark of the
  // cut), so the two views together stay well inside the tile cache — a full cache stops all fetching
  const sz = renderer.getDrawingBufferSize(new THREE.Vector2());
  t.setCamera(cam); t.setResolution(cam, sz.x * scale, sz.y * scale);
  return () => t.deleteCamera(cam);
}
/** resolves once the city in view is sharp: no tile within 5 km still waiting for its finer children (a tile whose
 *  error on screen is three times what is wanted), for a moment — or after `max` ms. The outside shots wait for it under
 *  the held frame: the real city, not its first blurred slabs, and not a flat photograph standing in for it. */
/** how many tiles within 5 km of the cameras are still waiting for their finer children (an error on screen three times
 *  what is wanted). Not the big tiles a camera stands inside: their error is endless, and no download changes it. */
export function coarseNear() {
  const T = GT.tiles; if (!T) return Infinity;
  const lim = T.errorTarget * 3; let coarse = 0;
  for (const t of T.visibleTiles) { const d = t.__distanceFromCamera || 0; if (t.children && t.children.length && d > 0 && d < 5000 && t.__error > lim && t.__error < 1e7) coarse++; }
  return coarse;
}
export function sharpen(max = 20000) {
  if (!GT.on || !GT.tiles) return Promise.resolve(true);
  const t0 = performance.now(); let okSince = null;
  GT.frozen = false; boost(true);
  return new Promise(res => {
    const step = () => {
      const coarse = coarseNear();
      const now = performance.now();
      if (coarse === 0) { if (okSince == null) okSince = now; } else okSince = null;
      if ((okSince != null && now - okSince > 300) || now - t0 > max) { boost(false); console.log('[city] sharp in', Math.round(now - t0), 'ms', coarse ? `(${coarse} still coarse)` : ''); return res(coarse === 0); }
      setTimeout(step, 100);
    };
    setTimeout(step, 400);                          // (a few frames first: the camera's own choice of tiles)
  });
}
/** resolves once the tiles in view have all arrived (nothing downloading or being prepared for `quiet` ms), or after
 *  `max` ms whatever the state: the cuts and the first frame wait for it in the dark */
export function settle(max = 4000, quiet = 500) {
  if (!GT.on || !GT.tiles) return Promise.resolve(true);
  const t0 = performance.now(); let calmSince = null;
  GT.frozen = false; boost(true);
  return new Promise(r => {
    const res = (v) => { boost(false); r(v); };
    const step = () => {
      const st = GT.tiles.stats, now = performance.now();
      if (st.downloading + st.parsing === 0) { if (calmSince == null) calmSince = now; } else calmSince = null;
      if (calmSince != null && now - calmSince >= quiet) return res(true);
      if (now - t0 >= max) return res(false);
      setTimeout(step, 50);
    };
    setTimeout(step, 80);                       // let a frame or two pass so the new view has asked for its tiles
  });
}

const riverU = {uMask: {value: null}, uCore: {value: new THREE.Vector4()}};
/** and over the river (the elevation data's water map) the low parts of the photographed surface are not drawn: its
 *  picture of the water is dark at most levels of detail and floats a little above our moving water. Islands, piers
 *  and shores are land on the map and stay. Decided per pixel, so a tile that is half river keeps its half of land. */
// (it is no longer cut at a water line as well: low land by the water — LaGuardia's runways on Flushing Bay — went with it,
// and with no other city under this one, that left white holes)
function riverMaterial(m) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uMask = riverU.uMask; sh.uniforms.uCore = riverU.uCore;
    sh.vertexShader = 'varying vec3 vRiverW;' + String.fromCharCode(10) + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>' + String.fromCharCode(10) + 'vRiverW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'uniform sampler2D uMask; uniform vec4 uCore; varying vec3 vRiverW;' + String.fromCharCode(10) + sh.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      { vec2 mu = vec2((vRiverW.x - uCore.x) / (uCore.z - uCore.x), (vRiverW.z - uCore.y) / (uCore.w - uCore.y));
        if (vRiverW.y < 25.0 && mu.x > 0.0 && mu.y > 0.0 && mu.x < 1.0 && mu.y < 1.0 && texture2D(uMask, vec2(mu.x, 1.0 - mu.y)).r > 0.6) discard; }`);
  };
  m.customProgramCacheKey = () => 'gtilesRiver2';
  return m;
}
/** the connection to the photographed city: state 'connecting' | 'on', how many tries, and why the last one failed */
export const CITY = {state: 'idle', tries: 0, why: ''};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
/** a key that the Map Tiles API answers to: Cesium ion's (a free account; ion serves Google's tiles as asset 2275207
 *  and hands out the key), or our own Google Maps Platform key */
async function tilesKey() {
  const cfg = await fetch('flight.local.json', {cache: 'no-store'}).then(r => r.ok ? r.json() : null).catch(() => null);
  if (!cfg) { CITY.why = 'flight.local.json'; return null; }
  for (const way of ['ion', 'google']) {
    let key = null;
    if (way === 'ion' && cfg.cesiumIonToken) {
      const ep = await fetch(`https://api.cesium.com/v1/assets/2275207/endpoint?access_token=${encodeURIComponent(cfg.cesiumIonToken)}`).then(r => r.json()).catch(() => null);
      const u = ep && ep.options && ep.options.url, m = u && /[?&]key=([^&]+)/.exec(u);
      if (m) key = decodeURIComponent(m[1]); else CITY.why = 'Cesium ion: ' + ((ep && (ep.message || ep.code)) || 'no answer');
      if (ep && ep.attributions) GT.ionAttr = ep.attributions;
    }
    if (way === 'google' && cfg.googleKey) key = cfg.googleKey;
    if (!key) continue;
    const ok = await fetch(`https://tile.googleapis.com/v1/3dtiles/root.json?key=${encodeURIComponent(key)}`).then(r => r.ok).catch(() => false);
    if (ok) return key;
    CITY.why = 'Map Tiles API (' + way + ')';
  }
  return null;
}
/** the connection to Google's city, started the moment the page opens (main.js), side by side with the loading of the
 *  rest: the key is asked for again and again (every few seconds, never given up) until it answers, and the tiles
 *  library is fetched meanwhile */
let linkP = null;
export function connectCity() {
  return linkP || (linkP = (async () => {
    CITY.state = 'connecting';
    const libs = Promise.all([
      import(LIB + 'three/TilesRenderer.js'), import(LIB + 'plugins/three/GoogleCloudAuthPlugin.js'),
      import(LIB + 'plugins/three/GLTFExtensionsPlugin.js'), import('three/addons/loaders/DRACOLoader.js')]);
    let key = null;
    while (!key) {
      CITY.tries++;
      key = await tilesKey();
      if (!key) { console.warn('[google tiles] not yet:', CITY.why, '— trying again'); await sleep(Math.min(8000, 1000 + CITY.tries * 1000)); }
    }
    return {key, libs: await libs};
  })());
}
/** Google's photographed 3D city, the only city of this game (it needs the river's water map: after buildWorld) */
export async function loadGoogleTiles() {
  const {key, libs: [{TilesRenderer}, {GoogleCloudAuthPlugin}, {GLTFExtensionsPlugin}, {DRACOLoader}]} = await connectCity();
  const tiles = new TilesRenderer();
  tiles.registerPlugin(new GoogleCloudAuthPlugin({apiToken: key}));
  tiles.registerPlugin(new GLTFExtensionsPlugin({dracoLoader: new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/').setWorkerLimit(Math.max(4, Math.min(8, (navigator.hardwareConcurrency || 4) - 1)))}));
  tiles.errorTarget = DETAIL.cinema;                    // (see setDetail; the anisotropic filtering keeps the slanted ground sharp)
  tiles.downloadQueue.maxJobs = 14;                    // (downloads start at once: they cost the main thread nothing)
  // replace a coarse tile as soon as the children in view are ready (waiting for every sibling left a 4-km-coarse, dark
  // tile under the airplane at LaGuardia: siblings outside the view could stay unparsed for good)
  tiles.loadSiblings = false;
  // keep what was seen (the flight comes back along the river). The cap must stay well above what one view uses — the
  // opening's slanting view to the horizon uses ~1300–2000 tiles, and a full cache stops all fetching
  tiles.lruCache.minSize = 1600; tiles.lruCache.maxSize = 3000;
  // the photographed surface is one-sided: seen from under the river (the mirror camera) its underside must not hide the sky
  // the photographed tiles carry their own (real) light: draw them unlit, as Google intends — the glTF default metallic
  // material went black on some coarse tiles — and one-sided, so the mirror camera under the river sees the sky
  tiles.addEventListener('load-model', ({scene: sc}) => sc.traverse(o => {
    if (!o.isMesh || !o.material) return;
    const old = o.material; o.material = riverMaterial(new THREE.MeshBasicMaterial({map: old.map || null, color: old.map ? 0xffffff : (old.color || 0x808080), side: THREE.FrontSide}));
    if (old.map) old.map.anisotropy = maxAniso;            // the ground is always seen at a slant from an airplane: keep it sharp
    if (old.map) try { renderer.initTexture(old.map); } catch (e) {}   // upload as it arrives (not hundreds at once on the first frame)
    old.dispose();
  }));
  renderer.localClippingEnabled = true;
  if (W.water) { riverU.uMask.value = W.water.material.uniforms.uMask.value; riverU.uCore.value.copy(W.water.material.uniforms.uCore.value); }
  const [lat, lon] = W.meta.origin;
  tiles.setLatLonToYUp(lat * Math.PI / 180, lon * Math.PI / 180);
  // setLatLonToYUp leaves north along the tiles' +x: turn a quarter so north is −z and east +x, as in our scenery
  const maxAniso = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 8;
  const holder = new THREE.Group(); holder.position.y = GEOID_NYC; holder.rotation.y = Math.PI / 2; holder.add(tiles.group); scene.add(holder);
  // its place in the world now: the tiles are chosen against the city's matrixWorld, which is otherwise only worked out when a
  // frame is drawn — and nothing is drawn behind the loading screen, so the preload fetched the tiles of the wrong place
  holder.updateMatrixWorld(true);
  // the city never moves: leave its thousands of meshes out of the per-frame matrix update (the library works out each
  // tile's matrices once, when it is shown) — that walk was ~8% of the main thread in flight
  tiles.group.matrixWorldAutoUpdate = false;
  tiles.setCamera(camera); tiles.setResolutionFromRenderer(camera, renderer);
  // a tile refused for the moment (429: too many requests) is asked for again a little later, not left as a hole: the
  // library marks it FAILED (−1) and hands it to the cache; we note those and, after a growing wait, take them out of the
  // cache (back to UNLOADED) so they are requested again when needed. Only model tiles (not sub-tilesets).
  const failedSet = new Set(), setLoaded = tiles.lruCache.setLoaded.bind(tiles.lruCache);
  tiles.lruCache.setLoaded = (t, v) => { setLoaded(t, v); if (t.__loadingState === -1 && /\.glb/i.test(t.content && t.content.uri || '')) { t.__failT = performance.now(); failedSet.add(t); } };
  setInterval(() => {
    const now = performance.now();
    for (const t of failedSet) {
      if (t.__loadingState !== -1) { failedSet.delete(t); continue; }
      t.__retries = t.__retries || 0;                     // (never given up: a hole in the city is not an option)
      if (now - t.__failT > Math.min(16000, 2000 * 2 ** t.__retries)) { t.__retries++; failedSet.delete(t); tiles.lruCache.remove(t); tiles.stats.failed = Math.max(0, tiles.stats.failed - 1); }
    }
  }, 1000);
  let frameN = 0;
  onUpdate(() => {
    // in flight the tile choice is refreshed every other frame (3 m of flight at most between two; the traversal of a
    // few thousand tiles was ~10% of the main thread)
    if (detailKind === 'flight' && !boosted && (++frameN & 1)) return;
    // (frozen: between the preload and the opening — the rest of the loading and the menu look from the cockpit, and
    // updating then dropped the opening's tiles from the cache to make room for that view)
    if (!GT.on || GT.frozen) return; const cam = GT.viewCam || camera; cam.updateMatrixWorld(); if (tiles.cameras.includes(cam)) tiles.setResolutionFromRenderer(cam, renderer); tiles.update();
    // In the outside shots the aerial photographs lie 6 m under this city (world.js loadGround), only to fill a hole should
    // a tile be missing; no tile is ever left out for them (a flat photograph beside the real city did not look real).
    // The shots instead wait for the city's sharp tiles before they show (sharpen). In the cockpit they are not drawn.
    const back = detailKind === 'cinema' && W.ground && W.ground.length > 0;
    if (W.ground) for (const m of W.ground) m.visible = back;
  });
  GT.tiles = tiles; GT.holder = holder; GT.on = true; pace();
  GT.frozen = true;                                   // until the airplane is in its place (main.js preloadViews)
  CITY.state = 'on';
  attribution(tiles);
  return tiles;
}
function attribution(tiles) {
  let el = document.getElementById('gattr');
  if (!el) { el = document.createElement('div'); el.id = 'gattr'; el.style.cssText = 'position:fixed;left:10px;bottom:6px;z-index:70;font:11px Inter,sans-serif;color:#fff;opacity:.85;text-shadow:0 0 3px #000;direction:ltr;pointer-events:none'; document.body.appendChild(el); }
  const upd = () => { try { const a = tiles.getAttributions ? tiles.getAttributions() : []; el.innerHTML = '<b>Google</b> · ' + (a.map(x => x.value).filter(Boolean).join(' ') || 'Map data ©Google'); } catch (e) {} };
  setInterval(upd, 3000); upd();
}
