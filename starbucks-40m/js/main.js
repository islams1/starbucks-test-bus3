import * as THREE from 'three';
import {start, clock, onUpdate, Q, scene, camera, stats, renderer, gtao, composer, renderOpts, frameCap} from './core/engine.js';
import {json} from './core/assets.js';
import {onKey, setInput} from './core/input.js';
import {resume as resumeAudio} from './core/audio.js';
import {initMaterials} from './world/materials.js';
import {buildBuilding, colliders, anchors, cafe, setTickets, setLevel, B} from './world/building.js';
import {buildTraffic} from './world/traffic.js';
import {buildNav} from './world/nav.js';
import {buildLighting, setTimeOfDay, exposure} from './world/lighting.js';
import {detectGPU, applyQuality, startAdaptive, savedQuality, quality, LEVELS, dyn, restoreDyn} from './core/quality.js';
import {loadAnimLib, characters} from './actors/character.js';
import {initPlayer, setPlayerMode, teleport, player, lookTowards} from './actors/player.js';
import {loadCast} from './story/cast.js';
import {$, show, fade, hud} from './ui/ui.js';
import {mountSettingsButtons} from './ui/settings.js';
import {initTouch} from './ui/touch.js';
import {S} from './story/state.js';
import {hotspots} from './ui/hotspots.js';
import {run, initLines, toggleTray, panelOpen} from './story/flow.js';
import {applyLanguage, EN} from './ui/lang.js';
applyLanguage();

Object.assign(window, {__THREE: THREE, __scene: scene, __camera: camera, __renderer: renderer, __composer: composer, __renderOpts: renderOpts, __frameCap: frameCap, __stats: stats, __cols: colliders, __anchors: anchors, __cafe: cafe, __S: S, __C: characters});
window.__player = player; window.__hs = hotspots; window.__use = (id) => { const h = hotspots.get(id); if (h) { h.visible = true; h.use(h); return true; } return false; }; window.__teleport = teleport; window.__lookTowards = lookTowards;
window.__quality = () => ({applyQuality, LEVELS, quality, dyn});

async function boot() {
  const T0 = performance.now(), mark = (k) => console.info('[boot]', k, ((performance.now() - T0) / 1000).toFixed(1) + 's');
  quality.auto = detectGPU();
  applyQuality(Q.get('q') || savedQuality() || quality.auto);
  initMaterials();
  start();
  scene.add(camera);                    // things the player holds are children of the camera
  const [, , , , data] = await Promise.all([buildLighting().then(v => (mark('lighting'), v)), buildBuilding().then(v => (mark('cafe'), v)), buildTraffic().then(v => (mark('street'), v)), loadAnimLib().then(v => (mark('anims'), v)), json('data/lines.ar.json')]);
  await loadCast(); mark('cast');
  setLevel(0); buildNav();
  { const lv = Q.get('q') || savedQuality() || quality.auto; restoreDyn(lv === 'custom' ? quality.level : lv); applyQuality(lv); }
  document.querySelectorAll('[data-q]').forEach(b => { if (b.dataset.q === quality.auto) b.querySelector('small').textContent = EN ? 'Auto — suits this device' : 'تلقائي — مناسب لجهازك'; });
  const gi = $('gpuinfo'); if (gi) gi.textContent = (quality.software ? (EN ? '⚠ Hardware acceleration is off in the browser · ' : '⚠ تسريع الرسوميات معطّل في المتصفح — فعّله من الإعدادات لأداء أفضل · ') : '') + (quality.gpu ? (EN ? 'GPU: ' : 'كارت الشاشة: ') + quality.gpu.replace(/ANGLE \(|\)$/g, '').split(',').slice(0, 2).join(' ') : '');
  initPlayer(characters.player);
  setTimeOfDay('morning');
  setTickets(9, 39);
  camera.position.set(3.2, 1.66, 33); camera.lookAt(0, 1.4, 28);
  await new Promise(r => setTimeout(r, 300));
  renderOpts.skip = false;
  mark('ready');
  return data;
}

// eye adaptation: brighter exposure inside the café, darker in the bright street
onUpdate((dt) => {
  const cp = camera.position, inside = cp.x > B.x0 && cp.x < B.x1 && cp.z > B.z0 && cp.z < B.z1 + 0.3 && cp.y < 7.5;
  renderer.toneMappingExposure += ((inside ? exposure.in : exposure.out) - renderer.toneMappingExposure) * (1 - Math.exp(-1.5 * dt));
});
function setupGlobalKeys() {
  startAdaptive();
  mountSettingsButtons(); initTouch();
  document.querySelectorAll('[data-q]').forEach(b => b.onclick = () => applyQuality(b.dataset.q, {manual: true}));
  onKey('Tab', () => { if ($('hud').classList.contains('hidden')) return; toggleTray(); });
  onKey('Escape', () => {
    if (panelOpen()) return;
    if (!$('tray').classList.contains('hidden')) { toggleTray(false); return; }
    if ($('hud').classList.contains('hidden')) return;
    const p = $('pause').classList.contains('hidden');
    show('pause', p); clock.paused = p;
  });
  $('resume').onclick = () => { show('pause', false); clock.paused = false; };
  $('tohowto').onclick = () => { show('pause', false); show('howto', true); $('startbtn').textContent = EN ? 'Continue' : 'متابعة'; $('startbtn').onclick = () => { show('howto', false); clock.paused = false; }; };
  $('creditslink').onclick = (e) => { e.preventDefault(); import('./story/debrief.js').then(m => m.showCredits()); };
}

(async () => {
  let data;
  try { data = await boot(); }
  catch (e) { console.error(e); window.__showErr && window.__showErr(e && (e.message || e)); return; }
  setupGlobalKeys();
  initLines(data.lines, data.speakers);
  show('loading', false);
  const dev = Q.get('dev');
  if (dev === 'walk') {      // free look around the set (no story)
    teleport(3.2, 31.2, Math.PI + 0.6); setPlayerMode('free'); setInput(true, true); hud(true); await fade(false, 300); return;
  }
  if (dev) { resumeAudio(); await run(dev); return; }
  // menu background: slow drift past the café front
  let ang = 0; const orbit = onUpdate((dt) => { ang += dt * 0.05; camera.position.set(-6 + Math.sin(ang) * 3, 2.2, 44 + Math.cos(ang) * 1.5); camera.lookAt(0, 2.2, 32); });
  await fade(false, 1200);
  show('menu', true);
  await new Promise(r => document.querySelectorAll('.mode').forEach(b => b.onclick = () => r(b.dataset.mode)));
  resumeAudio();
  show('menu', false); show('howto', true);
  await new Promise(r => $('startbtn').onclick = r);
  show('howto', false);
  await fade(true, 700); orbit();
  await run(null);
})();
