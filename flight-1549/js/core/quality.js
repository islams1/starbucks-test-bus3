// Graphics quality: device profiles + dynamic resolution + player customisation.
// Idea: keep the look (lights, soft shadows, AO, bloom) on every device that can run WebGL2 and pay for it with the
// cheapest currency first: render resolution (sharpened), then shadow refresh rate, and only at the very end features.
import * as THREE from 'three';
import {renderer, composer, gtao, bloom, stats, clock, renderOpts, SOFTWARE, shadowCtl, fxaa, grade, syncPostSize, frameCap} from './engine.js';

const DPR = window.devicePixelRatio || 1;
export const MOBILE = /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));
export const TOUCH = MOBILE || matchMedia('(pointer: coarse)').matches;

// lights = real point lights near the camera; ao: 'always' | 'indoor' | 'off'; aa: 'msaa4' | 'msaa2' | 'fxaa' | 'off'
// shadowEvery = refresh the sun shadow map every N frames (1: a moving person's shadow must not lag behind the feet)
// medium → low changes only passes / buffer sizes (same light count, same shadow filter) so the automatic step
// down never recompiles shaders (that was a visible freeze while walking)
export const LEVELS = {
  high:   {name: 'High',  pr: Math.min(DPR, 1.5),  aa: 'msaa4', ao: 'always', bloom: true,  shadow: 4096, soft: true,  lights: 8, treeShadow: true,  shadowEvery: 1},
  medium: {name: 'Medium', pr: Math.min(DPR, 1.25), aa: 'fxaa',  ao: 'indoor', bloom: true,  shadow: 2048, soft: true,  lights: 6, treeShadow: true,  shadowEvery: 1},
  low:    {name: 'Low', pr: Math.min(DPR, 1),    aa: 'fxaa',  ao: 'off',    bloom: true,  shadow: 1024, soft: true,  lights: 6, treeShadow: false, shadowEvery: 1},
  cpu:    {name: 'No graphics card', pr: 0.5, aa: 'off', ao: 'off', bloom: false, shadow: 0, soft: false, lights: 0, treeShadow: false, shadowEvery: 1, direct: true, noTrees: true, noCrowd: true},
};
const MSAA = {msaa4: 4, msaa2: 2, fxaa: 0, off: 0};
export const quality = {level: 'high', auto: 'high', gpu: '', software: false, hooks: [], custom: null};
export const onQuality = (fn) => quality.hooks.push(fn);
/** dynamic resolution: fraction of the level's pixel ratio actually rendered; mode 60 = free, 30 = steady 30 fps cap */
export const dyn = {scale: 1, min: MOBILE ? 0.65 : 0.75, enabled: true, fixed: null, cool: 0, mode: 60};
const DYN_KEY = 'bus3_dyn';
function saveDyn() { try { localStorage.setItem(DYN_KEY, JSON.stringify({gpu: quality.gpu, level: quality.level, scale: dyn.scale, mode: dyn.mode})); } catch (e) {} }
/** start where this device ended last time (no visible adjusting at the start of every session) */
export function restoreDyn(level) {
  try { const d = JSON.parse(localStorage.getItem(DYN_KEY) || 'null'); if (d && d.gpu === quality.gpu && d.level === level) { dyn.scale = d.scale; dyn.mode = d.mode; return true; } } catch (e) {}
  if (level === 'medium' && !MOBILE) { dyn.scale = 1; dyn.mode = 30; }     // integrated graphics: start a little lower, adjust from there
  return false;
}

export function detectGPU() {
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    quality.gpu = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
  } catch (e) { quality.gpu = ''; }
  const r = quality.gpu.toLowerCase();
  quality.software = SOFTWARE || /swiftshader|llvmpipe|basic render|software|microsoft basic/.test(r);
  if (quality.software) return 'cpu';
  if (/nvidia|geforce|rtx|gtx|quadro|radeon rx|radeon pro|apple m[1-9] (pro|max|ultra)/.test(r)) return 'high';
  // phones / tablets: recent GPUs get the full look at a capped resolution, older ones the light profile
  if (/adreno.*(5\d\d|4\d\d|3\d\d)|mali-[t4]|mali-g(31|51|52|57)|powervr|sgx/.test(r)) return 'low';
  if (MOBILE) return 'medium';
  // integrated laptop graphics (Intel / AMD APU / Apple M1 base): full look with dynamic resolution
  return 'medium';
}

/** the settings actually in force: the level, plus the player's own adjustments if they made any */
export function current() { return quality.custom ? Object.assign({}, LEVELS[quality.custom.base] || LEVELS.medium, quality.custom) : LEVELS[quality.level]; }
function applyCap() { const L = current(); const m = L.fpsMode && L.fpsMode !== 'auto' ? +L.fpsMode : dyn.mode; frameCap.fps = L.direct ? 0 : m === 30 ? 30 : 0; }

function applyResolution() {
  const L = current();
  const pr = Math.max(0.35, L.pr * (dyn.fixed != null ? dyn.fixed : dyn.scale));
  renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight);
  composer.setPixelRatio(pr); composer.setSize(innerWidth, innerHeight);
  syncPostSize();
  const s = dyn.fixed != null ? dyn.fixed : dyn.scale;
  grade.uniforms.sharp.value = s < 0.97 && !L.direct ? Math.min(0.45, (1 - s) * 1.1) : 0;
}

export function applyQuality(level, {keepCustom = false, auto = false, manual = false} = {}) {
  if (manual) { dyn.scale = 1; dyn.mode = 60; }      // the player picked a level: adapt again from full resolution
  if (level === 'custom') { if (!quality.custom) return; } else { const Lv = LEVELS[level]; if (!Lv) return; quality.level = level; if (!keepCustom) quality.custom = null; }
  const L = current();
  const samples = MSAA[L.aa] || 0;
  for (const rt of [composer.renderTarget1, composer.renderTarget2]) { if (rt.samples !== samples) { rt.samples = samples; rt.dispose(); } }
  if (!auto) { dyn.cool = 3; }       // an automatic step down keeps the current resolution (no climb back = no extra hitches)
  applyResolution(); applyCap();
  fxaa.enabled = L.aa === 'fxaa';
  gtao.enabled = L.ao === 'always'; quality.aoMode = L.ao;
  bloom.enabled = !!L.bloom;
  renderOpts.direct = !!L.direct;
  renderer.shadowMap.enabled = L.shadow > 0;
  shadowCtl.every = L.shadowEvery || 1;
  const newType = L.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  if (renderer.shadowMap.type !== newType) { renderer.shadowMap.type = newType; renderer.shadowMap.needsUpdate = true; }
  for (const fn of quality.hooks) fn(L, quality.level);
  try { localStorage.setItem('bus3_quality', quality.custom ? 'custom' : quality.level); localStorage.setItem('bus3_custom', quality.custom ? JSON.stringify(quality.custom) : ''); } catch (e) {}
  document.querySelectorAll('[data-q]').forEach(b => b.classList.toggle('on', !quality.custom && b.dataset.q === quality.level));
  quality.ver = (quality.ver || 0) + 1;
  quality.onChange && quality.onChange();
}
/** player adjustments on top of a level (settings panel) */
export function setCustom(changes) {
  quality.custom = Object.assign({base: quality.custom ? quality.custom.base : quality.level}, quality.custom || {}, changes);
  if ('resolution' in changes) dyn.fixed = changes.resolution === 'auto' ? null : +changes.resolution;
  applyQuality('custom');
}

/** Adapt in few, early steps: resolution first, then a steady 30 fps cap, then (rarely) a lower level.
 * Every change reallocates buffers (a small hitch), so changes are spaced out and the result is remembered. */
export function startAdaptive() {
  let low = 0, high = 0, changes = 0;
  setInterval(() => {
    if (document.hidden || clock.paused || renderOpts.skip) return;
    if (dyn.cool > 0) { dyn.cool--; return; }
    const L = current();
    if (!dyn.enabled || dyn.fixed != null || L.direct) return;
    const forced = L.fpsMode && L.fpsMode !== 'auto' ? +L.fpsMode : 0;
    const mode = forced || dyn.mode, fps = stats.fps;
    const lowT = mode === 30 ? 27 : 50, highT = mode === 30 ? 29.3 : 58;
    low = fps < lowT ? low + 1 : 0;
    high = fps >= highT ? high + 1 : 0;
    const step = (fn) => { fn(); low = high = 0; dyn.cool = 2; changes++; applyResolution(); applyCap(); saveDyn(); };
    if (low >= 2) {
      // sharpness first: lock a steady 30 at full resolution before giving up any pixels
      if (mode === 60 && !forced) return step(() => { dyn.mode = 30; dyn.scale = 1; });
      if (dyn.scale > dyn.min + 0.01) return step(() => { dyn.scale = Math.max(dyn.min, dyn.scale - 0.05); });
      if (low >= 6 && !quality.custom) {
        low = 0;
        const next = quality.level === 'high' ? 'medium' : quality.level === 'medium' ? 'low' : quality.level === 'low' && fps < 15 ? 'cpu' : null;
        if (next) { applyQuality(next, {auto: true}); saveDyn(); console.info('quality →', next); }
      }
      return;
    }
    // headroom: give resolution back slowly (needs ~8 s of steady frames, so it does not ping-pong)
    if (high >= 8 && dyn.scale < 1) step(() => { dyn.scale = Math.min(1, dyn.scale + 0.05); });
  }, 1000);
}
export function savedQuality() {
  try {
    const q = localStorage.getItem('bus3_quality');
    if (q === 'custom') { const c = JSON.parse(localStorage.getItem('bus3_custom') || 'null'); if (c) { quality.custom = c; if (c.resolution && c.resolution !== 'auto') dyn.fixed = +c.resolution; quality.level = c.base || 'medium'; return 'custom'; } return null; }
    return q && LEVELS[q] ? q : null;
  } catch (e) { return null; }
}
