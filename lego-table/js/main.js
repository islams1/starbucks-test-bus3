// "What the Table Can Carry" — Concept A, The Eight-Unit Table (LEGO_Turnaround_Simulation.md).
import * as THREE from 'three';
import {start, clock, onUpdate, Q, scene, camera, stats, renderer, composer, renderOpts, frameCap} from './core/engine.js';
import {json} from './core/assets.js';
import {onKey} from './core/input.js';
import {resume as resumeAudio} from './core/audio.js';
import {initMaterials} from './world/materials.js';
import {buildWorkshop, WT, RT} from './world/workshop.js';
import {buildTable} from './world/props.js';
import {buildLighting, SKY} from './world/lighting.js';
import {buildStreet} from './world/street.js';
import {buildGrid} from './world/collide.js';
import {room, venue, ROOM} from './world/workshop.js';
import {TB} from './world/props.js';
import {detectGPU, applyQuality, startAdaptive, savedQuality, quality, restoreDyn, onQuality} from './core/quality.js';
import {makeGlass, glassGame, GAME_GLASS} from './ui/glass.js';
import {loadAnimLib, characters} from './actors/character.js';
import {loadCast} from './story/cast.js';
import {buildContact} from './actors/contact.js';
import {$, show, fade} from './ui/ui.js';
import {mountSettingsButtons} from './ui/settings.js';
import {VIEW} from './ui/view.js';
import {addHand} from './ui/playerhand.js';
import {S, load, save, hasProgress, hasCommit, clearAll} from './story/state.js';
import {run, initLines} from './story/flow.js';
import {muteAmbience, ambienceMuted} from './story/sound.js';
import {toggleList, closeCard} from './story/cards.js';
import {applyLanguage, EN} from './ui/lang.js';
applyLanguage();

Object.assign(window, {__THREE: THREE, __scene: scene, __camera: camera, __renderer: renderer, __composer: composer, __renderOpts: renderOpts, __frameCap: frameCap, __stats: stats, __S: S, __C: characters, __VIEW: VIEW});
window.__cam = async (p, l, fov = 50) => { VIEW.mode = 'cine'; return (await import('./core/cine.js')).shot(new THREE.Vector3(...p), new THREE.Vector3(...l), 0, {fov}); };

// the cards that are liquid glass (the paper props — the proposal card, the note, the receipt — stay paper)
GAME_GLASS.push(['#ledger', 'card', 1], ['#dock .dk', 'pill', 3], ['#viewbtns button', 'pill', 3], ['#caption', 'floating', 1], ['#prompt.hands', 'floating', 1],
  ['#list .li-in', 'card', 0], ['#pitch .pf-in', 'card', 0], ['#coach .co-in', 'card', 0], ['#archive .ar-in', 'card', 0], ['#checks .qz', 'card', 0], ['#final .fn-in', 'card', 0], ['#tcard .tc-in', 'card', 0], ['#card .cr', 'card', 0]);
if (makeGlass({composer, renderer, camera, on: Q.get('glass') !== '0' && Q.get('q') !== 'low'})) {
  glassGame();
  onQuality((L) => window.__glass.attach(!L.direct));
}

const T0 = performance.now(), mark = (k) => console.info('[boot]', k, ((performance.now() - T0) / 1000).toFixed(1) + 's');
async function fonts() {
  const want = ['600 40px "IBM Plex Sans Arabic"', '700 40px "IBM Plex Sans Arabic"', '500 40px "IBM Plex Sans Arabic"', '600 40px Inter', '700 40px Inter', '800 40px Inter', '500 40px Inter'];
  await Promise.race([Promise.all(want.map(f => document.fonts.load(f).catch(() => {}))), new Promise(r => setTimeout(r, 4000))]);
}
async function boot() {
  quality.auto = detectGPU();
  applyQuality(Q.get('q') || savedQuality() || quality.auto);
  initMaterials();
  start();
  scene.add(camera);
  await fonts(); mark('fonts');
  const [, , , data] = await Promise.all([
    buildLighting().then(v => (mark('sky'), v)),
    buildWorkshop(scene).then(v => { mark('workshop'); buildTable(scene); return v; }),
    loadAnimLib().then(v => (mark('anims'), v)),
    json(`data/lines.${EN ? 'en' : 'ar'}.json`),
  ]);
  addHand(scene);
  await buildStreet(scene, SKY.env).catch(e => console.error('street', e)); mark('street');
  await loadCast(); mark('cast');
  { const t0 = performance.now(), n = buildGrid([room, venue, TB.root], {x0: ROOM.x0, x1: ROOM.x1, z0: ROOM.z0, z1: ROOM.z1}); console.info('[boot] walk map', n, 'tris', Math.round(performance.now() - t0) + 'ms'); }
  { const t0 = performance.now(), n = buildContact(scene); console.info('[boot] contact', n, 'tris', Math.round(performance.now() - t0) + 'ms'); }
  { const lv = Q.get('q') || savedQuality() || quality.auto; restoreDyn(lv === 'custom' ? quality.level : lv); applyQuality(lv); }
  document.querySelectorAll('[data-q]').forEach(b => { if (b.dataset.q === quality.auto) b.querySelector('small').textContent = EN ? 'Auto — suits this device' : 'تلقائي — مناسب لجهازك'; });
  const gi = $('gpuinfo'); if (gi) gi.textContent = (quality.software ? (EN ? '⚠ Hardware acceleration is off in the browser · ' : '⚠ تسريع الرسوميات معطّل في المتصفح — فعّله من الإعدادات لأداء أفضل · ') : '') + (quality.gpu ? (EN ? 'GPU: ' : 'كارت الشاشة: ') + quality.gpu.replace(/ANGLE \(|\)$/g, '').split(',').slice(0, 2).join(' ') : '');
  camera.position.set(-3.5, 1.9, 2.6); camera.lookAt(WT.x, 1.0, WT.z);
  await new Promise(r => setTimeout(r, 200));
  renderOpts.skip = false;
  mark('ready');
  return data;
}

// the subtitles keep clear of the bottom bar, however many rows of buttons it has
{ const dock = document.getElementById('dock'), set = () => document.body.style.setProperty('--dockH', (dock.classList.contains('empty') ? 0 : dock.offsetHeight + 14) + 'px');
  new ResizeObserver(set).observe(dock); new MutationObserver(set).observe(dock, {attributes: true, attributeFilter: ['class']}); }
function setupGlobalKeys() {
  startAdaptive();
  mountSettingsButtons();
  document.querySelectorAll('[data-q]').forEach(b => b.onclick = () => applyQuality(b.dataset.q, {manual: true}));
  onKey('Escape', () => {
    if (!$('pcard').classList.contains('hidden')) { closeCard(); return; }
    if (!$('notecard').classList.contains('hidden')) { show('notecard', false); return; }
    if (!$('list').classList.contains('hidden')) { toggleList(false); return; }
    if (!$('card').classList.contains('hidden')) { show('card', false); return; }
    if ($('hud').classList.contains('hidden')) return;
    const p = $('pause').classList.contains('hidden');
    show('pause', p); clock.paused = p;
  });
  $('resume').onclick = () => { show('pause', false); clock.paused = false; };
  $('tohowto').onclick = () => { show('pause', false); show('howto', true); $('startbtn').textContent = EN ? 'Continue' : 'متابعة'; $('startbtn').onclick = () => { show('howto', false); clock.paused = false; }; };
  $('creditslink').onclick = (e) => { e.preventDefault(); credits(); };
  const amb = $('ambbtn'); amb.onclick = () => { const m = !ambienceMuted(); muteAmbience(m); amb.classList.toggle('off', m); amb.setAttribute('aria-pressed', String(m)); };
}
function credits() {
  const el = $('card'); el.className = 'credits'; show('card', true);
  el.innerHTML = `<div class="cr"><h2>${EN ? 'Sources and credits' : 'المصادر والحقوق'}</h2>
    <h4>${EN ? 'The archive (real)' : 'الأرشيف (حقيقي)'}</h4><ul><li>LEGO Group Annual Report 2004 — "Strategy and Action Plan", pp. 8–9; introduction p. 5</li><li>LEGO Group Annual Report 2005 — "Products" p. 8; "Result of the Action Plan from March 2004" p. 11; Note 23 p. 53; "Financial Highlights" (PDF p. 3)</li></ul>
    <p>${EN ? 'Rukn Toys, its people, its proposals, the retailer note and all its figures are a fictional teaching exercise. The LEGO name appears only in the credited archive. No logos or real products are shown.' : '«ركن للألعاب» وأشخاصها ومقترحاتها وتقرير التاجر وكل أرقامها تمرين تعليمي متخيَّل. اسم LEGO يظهر فقط في الأرشيف الموثَّق. لا شعارات ولا منتجات حقيقية.'}</p>
    <p>Poly Haven (CC0): ${EN ? 'shelving, cartons, crates, desks, lamps, tools, chairs, cabinets, plants, clock, floor, brick and plywood textures, the street sky' : 'الرفوف والكراتين والصناديق والمكاتب والمصابيح والأدوات والكراسي والخزائن والنباتات والساعة وخامات الأرضية والطوب والخشب وسماء الشارع'} · Microsoft Rocketbox avatars (MIT) · ${EN ? 'Voices: Microsoft Edge neural TTS' : 'الأصوات: Microsoft Edge neural TTS'}</p>
    <p>Sketchfab (CC BY 4.0): <a href="https://sketchfab.com/3d-models/675f34f7304e4d92812a41e9750539aa" target="_blank" rel="noopener">Office Chair Modern</a> — thethieme · <a href="https://sketchfab.com/3d-models/dba5c00928cd400796d9f6fffdd724b3" target="_blank" rel="noopener">Wooden Pallets</a> — yadrogames · <a href="https://sketchfab.com/3d-models/f84d24b6df3648d884fd9be9c8007dd4" target="_blank" rel="noopener">Ultrawide Monitor</a> — dylanheyes · <a href="https://sketchfab.com/3d-models/d0b05bd140734a799666f0a29e1fe1bb" target="_blank" rel="noopener">Whiteboard</a> — tboiston</p>
    <button type="button" class="primary" id="crclose">${EN ? 'Close' : 'إغلاق'}</button></div>`;
  el.querySelector('#crclose').onclick = () => show('card', false);
}

(async () => {
  let data;
  try { data = await boot(); }
  catch (e) { console.error(e); window.__showErr && window.__showErr(e && (e.message || e)); return; }
  setupGlobalKeys();
  initLines(data.lines, data.speakers);
  show('loading', false);
  const dev = Q.get('dev');
  if (dev) { if (Q.has('keep')) load(); else clearAll(); resumeAudio(); await run(null); return; }
  // the menu: a slow drift through the workshop
  let ang = 0;
  const orbit = onUpdate((dt) => { ang += dt * 0.035; const c = new THREE.Vector3((WT.x + RT.x) / 2, 1.0, -0.4); camera.position.set(c.x + Math.sin(ang) * 3.4, 2.05, c.z + 2.9 + Math.cos(ang) * 0.8); camera.lookAt(c); });
  await fade(false, 1200);
  if (hasProgress()) $('contbtn').classList.remove('hidden');
  if (hasCommit()) $('reviewbtn').classList.remove('hidden');
  show('menu', true);
  const mode = await new Promise(r => { $('playbtn').onclick = () => r('play'); $('contbtn').onclick = () => r('continue'); $('reviewbtn').onclick = () => r('review'); });
  resumeAudio();
  show('menu', false);
  if (mode === 'review') { load(); await fade(true, 500); orbit(); await run('review'); return; }
  if (mode === 'continue') { load(); await fade(true, 500); orbit(); await run('continue'); return; }
  // a new run: after a committed pitch, any later full run is a practice attempt (only "Start over" clears it)
  const had = hasCommit() && load();
  if (had) { const keep = {committed: S.committed, practice: S.practice, said: {}}; clearAll(); Object.assign(S, {stage: 0, opened: {core: false, delivery: false, theme: false, venue: false}, noteRead: false, tag: null, firstTag: null, a: {funded: [], first: null, next: null, need: null, cond: null, condFor: null}, confirmed: false, checks: {}, archiveSeen: false, refused: false}, keep, {attempt: keep.practice.length + 1}); save(); }
  else clearAll();
  show('howto', true);
  await new Promise(r => $('startbtn').onclick = r);
  show('howto', false);
  await fade(true, 700); orbit();
  await run(null);
})();
