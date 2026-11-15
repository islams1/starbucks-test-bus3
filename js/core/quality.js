// Graphics quality tiers. Auto-picked from the GPU name, adjustable by the player, and lowered automatically if FPS drops.
import * as THREE from 'three';
import {renderer, composer, gtao, bloom, stats, clock, renderOpts, SOFTWARE} from './engine.js';

export const LEVELS = {
  high:   {name: 'عالية', pr: Math.min(devicePixelRatio, 1.5), msaa: 4, ao: true,  bloom: true,  shadow: 4096, soft: true,  lights: 'all', treeShadow: true},
  medium: {name: 'متوسطة', pr: 1,    msaa: 2, ao: false, bloom: true,  shadow: 2048, soft: false, lights: 'key', treeShadow: true},
  low:    {name: 'منخفضة', pr: 0.75, msaa: 0, ao: false, bloom: false, shadow: 1024, soft: false, lights: 'none', treeShadow: false},
  cpu:    {name: 'بدون كارت شاشة', pr: 0.5, msaa: 0, ao: false, bloom: false, shadow: 0, soft: false, lights: 'none', treeShadow: false, direct: true, noTrees: true, noCrowd: true},
};
export const quality = {level: 'high', gpu: '', software: false, hooks: []};
export const onQuality = (fn) => quality.hooks.push(fn);

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
  if (/intel|uhd|iris|hd graphics|radeon\(tm\)|radeon graphics|vega|mali|adreno|powervr|apple gpu/.test(r)) return 'low';
  return 'medium';
}

export function applyQuality(level) {
  const L = LEVELS[level]; if (!L) return;
  quality.level = level;
  renderer.setPixelRatio(L.pr);
  renderer.setSize(innerWidth, innerHeight);
  for (const rt of [composer.renderTarget1, composer.renderTarget2]) { if (rt.samples !== L.msaa) { rt.samples = L.msaa; rt.dispose(); } }
  composer.setPixelRatio(L.pr);
  composer.setSize(innerWidth, innerHeight);
  gtao.enabled = L.ao; bloom.enabled = L.bloom;
  renderOpts.direct = !!L.direct;
  renderer.shadowMap.enabled = L.shadow > 0;
  const newType = L.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  if (renderer.shadowMap.type !== newType) { renderer.shadowMap.type = newType; renderer.shadowMap.needsUpdate = true; }
  for (const fn of quality.hooks) fn(L, level);
  try { localStorage.setItem('bus3_quality', level); } catch (e) {}
  document.querySelectorAll('[data-q]').forEach(b => b.classList.toggle('on', b.dataset.q === level));
}

/** step down one level when the frame rate stays low (never steps up on its own) */
export function startAdaptive() {
  let low = 0;
  setInterval(() => {
    if (document.hidden || clock.paused) return;
    low = stats.fps < 28 ? low + 1 : 0;
    if (low >= 5) {
      low = 0;
      const next = quality.level === 'high' ? 'medium' : quality.level === 'medium' ? 'low' : quality.level === 'low' && stats.fps < 20 ? 'cpu' : null;
      if (next) { applyQuality(next); console.info('quality →', next); }
    }
  }, 1000);
}
export function savedQuality() { try { return localStorage.getItem('bus3_quality'); } catch (e) { return null; } }
