import * as THREE from 'three';
import {start, clock, onUpdate, Q, scene, camera, stats, renderer, composer, renderOpts, frameCap, gtao} from './core/engine.js';
import {json} from './core/assets.js';
import {onKey} from './core/input.js';
import {resume as resumeAudio} from './core/audio.js';
import {initMaterials} from './world/materials.js';
import {buildRoom, TABLE} from './world/room.js';
import {buildMaquette, MQ, anchor} from './world/maquette.js';
import {buildScale} from './world/scale.js';
import {buildTableProps} from './world/tableprops.js';
import {buildLighting, setModelLamps} from './world/lighting.js';
import {buildFeed} from './world/screenfeed.js';
import {detectGPU, applyQuality, startAdaptive, savedQuality, quality, LEVELS, dyn, restoreDyn, onQuality} from './core/quality.js';
import {makeGlass, glassGame, GAME_GLASS} from './ui/glass.js';
import {loadAnimLib, characters} from './actors/character.js';
import {loadCommittee, loadMinis} from './story/cast.js';
import {buildContact} from './actors/contact.js';
import {$, show, fade, hud} from './ui/ui.js';
import {mountSettingsButtons} from './ui/settings.js';
import {VIEW} from './ui/view.js';
import {S, hasCommit} from './story/state.js';
import {run, initLines, toggleTray, panelOpen} from './story/flow.js';
import {applyLanguage, EN} from './ui/lang.js';
applyLanguage();

Object.assign(window, {__THREE: THREE, __scene: scene, __camera: camera, __renderer: renderer, __composer: composer, __renderOpts: renderOpts, __frameCap: frameCap, __stats: stats, __S: S, __C: characters, __MQ: MQ, __VIEW: VIEW, __anchor: anchor});
window.__quality = () => ({applyQuality, LEVELS, quality, dyn});
window.__cam = async (p, l, fov = 50) => (await import('./core/cine.js')).shot(new THREE.Vector3(...p), new THREE.Vector3(...l), 0, {fov});

// the cards that are liquid glass in this game (the paper props — queue card, comments, tablet, memo — stay paper)
GAME_GLASS.push(['#statelist', 'card', 1], ['#dock .dk', 'pill', 3], ['#viewbtns button', 'pill', 3], ['#caption', 'floating', 1], ['#prompt.hands', 'floating', 1]);
if (makeGlass({composer, renderer, camera, on: Q.get('glass') !== '0' && Q.get('q') !== 'low'})) {
  glassGame();
  onQuality((L) => window.__glass.attach(!L.direct));
}

const T0 = performance.now(), mark = (k) => console.info('[boot]', k, ((performance.now() - T0) / 1000).toFixed(1) + 's');
let minis = null;
async function boot() {
  quality.auto = detectGPU();
  applyQuality(Q.get('q') || savedQuality() || quality.auto);
  initMaterials();
  start();
  scene.add(camera);
  const [, , , data] = await Promise.all([
    buildLighting().then(v => (mark('sky'), v)),
    buildRoom().then(async v => { mark('room'); await buildMaquette(); mark('model'); buildScale(); buildTableProps(); return v; }),
    loadAnimLib().then(v => (mark('anims'), v)),
    json(`data/lines.${EN ? 'en' : 'ar'}.json`),
  ]);
  buildFeed();
  await loadCommittee(); mark('committee');
  { const t0 = performance.now(), n = buildContact(scene); console.info('[boot] contact', n, 'tris', Math.round(performance.now() - t0) + 'ms'); }
  // the store's people come in behind the menu
  minis = loadMinis().then(() => mark('model people'));
  // the café model's own little lamps follow its time of day
  MQ.root.traverse(o => { if (o.material && o.material.emissive && o.material.emissive.getHex() === 0xffc98a) setModelLamps(o.material); });
  { const lv = Q.get('q') || savedQuality() || quality.auto; restoreDyn(lv === 'custom' ? quality.level : lv); applyQuality(lv); }
  document.querySelectorAll('[data-q]').forEach(b => { if (b.dataset.q === quality.auto) b.querySelector('small').textContent = EN ? 'Auto — suits this device' : 'تلقائي — مناسب لجهازك'; });
  const gi = $('gpuinfo'); if (gi) gi.textContent = (quality.software ? (EN ? '⚠ Hardware acceleration is off in the browser · ' : '⚠ تسريع الرسوميات معطّل في المتصفح — فعّله من الإعدادات لأداء أفضل · ') : '') + (quality.gpu ? (EN ? 'GPU: ' : 'كارت الشاشة: ') + quality.gpu.replace(/ANGLE \(|\)$/g, '').split(',').slice(0, 2).join(' ') : '');
  camera.position.set(1.6, 1.5, 2.3); camera.lookAt(-1.0, 1.0, 0);
  await new Promise(r => setTimeout(r, 200));
  renderOpts.skip = false;
  mark('ready');
  return data;
}

function setupGlobalKeys() {
  startAdaptive();
  mountSettingsButtons();
  document.querySelectorAll('[data-q]').forEach(b => b.onclick = () => applyQuality(b.dataset.q, {manual: true}));
  onKey('Tab', (e) => { if ($('hud').classList.contains('hidden') || e.target.closest && e.target.closest('#dock,#hotspots,#panel,#card,#qcard,#ccard,#tabletp')) return; toggleTray(); });
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
  // the lean-in button follows the view
  VIEW.onChange = (m) => { const b = $('leanbtn'); b.textContent = m === 'cafe' ? (EN ? 'Back to your seat' : 'ارجع لمقعدك') : (EN ? 'Step into the replay' : 'ادخل الإعادة'); b.disabled = m === 'cine'; b.style.display = m === 'walk' ? 'none' : ''; };   // on foot in the café (stage 1) there is no replay to step into
  VIEW.onChange('seat');
}

(async () => {
  let data;
  try { data = await boot(); }
  catch (e) { console.error(e); window.__showErr && window.__showErr(e && (e.message || e)); return; }
  setupGlobalKeys();
  initLines(data.lines, data.speakers);
  show('loading', false);
  const dev = Q.get('dev');
  if (dev) { await minis; resumeAudio(); await run(dev); return; }
  // menu background: a slow drift around the table and the sleeping model
  let ang = 0; const c = new THREE.Vector3(-0.6, 1.05, 0);
  const orbit = onUpdate((dt) => { ang += dt * 0.04; camera.position.set(c.x + 0.6 + Math.sin(ang) * 1.9, 1.5, c.z + Math.cos(ang) * 1.6 + 0.3); camera.lookAt(c.x, c.y, c.z); });
  await fade(false, 1200);
  if (hasCommit()) $('reviewbtn').classList.remove('hidden');
  show('menu', true);
  const mode = await new Promise(r => { document.querySelectorAll('.mode').forEach(b => b.onclick = () => r(b.dataset.mode)); $('reviewbtn').onclick = () => r('review'); });
  resumeAudio();
  show('menu', false);
  if (mode === 'review') { await fade(true, 500); orbit(); await minis; await run('review'); return; }
  show('howto', true);
  await new Promise(r => $('startbtn').onclick = r);
  show('howto', false);
  await fade(true, 700); orbit();
  if (!(await Promise.race([minis.then(() => true), new Promise(r => setTimeout(() => r(false), 50))]))) {
    $('preparing').classList.remove('hidden'); await minis; $('preparing').classList.add('hidden');
  }
  await run(null);
})();
