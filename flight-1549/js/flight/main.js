// Flight 1549 — boot: New York, the airplane, the cockpit, voices; then the menu and the flight (flow.js).
import * as THREE from 'three';
import {start, Q, scene, camera, renderer, renderOpts, onUpdate, bloom, grade, gtao, shadowCtl, frameCap, stats} from '../core/engine.js';
import {resume as resumeAudio} from '../core/audio.js';
import {detectGPU, applyQuality, savedQuality, quality, onQuality, dyn} from '../core/quality.js';
import {$, show, fade} from '../ui/ui.js';
import {buildWorld, loadGround, W, heightAt} from './world.js';
import {AC, loadTrack, loadExterior, loadGeese, update as acUpdate, sampleReal, chaseFrame} from './aircraft.js';
import {buildCockpit, CK, seat, loadFO} from './cockpit.js';
import {buildGlass} from './glass.js';
import {buildControls} from './controls.js';
import {run, STATE} from './flow.js';
import {preloadRescue} from './rescue.js';
import {showTitle, titleStatus} from './titlecard.js';
import {debrief} from './debrief.js';
import {connectCity, loadGoogleTiles, GT, boost, CITY, addViewpoint, coarseNear} from './gtiles.js';

window.__fl = {THREE, scene, camera, renderer, W, AC, CK, GT, heightAt, sampleReal, STATE, quality, stats, frameCap};
const txt = $('loadtxt'), bar = $('loadbar');
const T0 = performance.now();
const prog = (k, t) => { bar.style.width = Math.round(k * 100) + '%'; if (t) { if (t !== txt.textContent) console.log('[boot]', Math.round(performance.now() - T0), 'ms', t); txt.textContent = t; } };

async function boot() {
  quality.auto = detectGPU();
  // checking each new shader program for errors forces the driver to finish compiling it on the spot (a stall in the
  // frame it first appears); only when asked
  renderer.debug.checkShaderErrors = Q.has('glcheck');
  // the flight never needs screen-space ambient occlusion (and it does not work with the logarithmic depth buffer)
  onQuality((L, level) => {
    gtao.enabled = false;
    // lighter on integrated graphics: the cockpit's sun shadow every third frame, the river's mirror at half size and
    // every other frame (the ripples blur it anyway)
    const light = level !== 'high';
    // a steady 30 frames a second on integrated graphics (here, after the level's own setting: picking a level resets
    // the shared cap to "free", and the frame rate then swung between 30 and 60 — the motion looked jerky)
    frameCap.fps = light ? 30 : 0;
    shadowCtl.every = light ? 3 : 1;
    W.reflectEvery = light ? 2 : 1;
    W.reflectRes = light ? 512 : 1024;                    // (used when the river is built, after this first call)
    if (W.reflectRT) { const R = light ? 512 : 1024; if (W.reflectRT.width !== R) W.reflectRT.setSize(R, R / 2); }
  });
  // the flight always renders at full resolution: the shared adaptive system lowered it step by step (a blurrier picture,
  // a hitch at every step, and remembered for the next time, even from the other games on this site)
  dyn.enabled = false; dyn.scale = 1; dyn.fixed = null; dyn.mode = quality.auto === 'high' ? 60 : 30;   // integrated GPUs: a steady 30
  let fq = null; try { fq = localStorage.getItem('flight_quality'); } catch (e) {}
  applyQuality(Q.get('q') || fq || quality.auto, {manual: true});
  if (quality.level !== 'high') dyn.mode = 30;
  // the menu's buttons: the level takes effect at once (and is remembered for the next visit); the one that suits this
  // device is marked
  document.querySelectorAll('[data-q]').forEach(b => {
    if (b.dataset.q === quality.auto) b.querySelector('small').textContent = 'تلقائي — مناسب لجهازك';
    b.addEventListener('click', () => {
      try { localStorage.setItem('flight_quality', b.dataset.q); } catch (e) {}
      applyQuality(b.dataset.q, {manual: true});
      dyn.enabled = false; dyn.scale = 1; dyn.fixed = null; dyn.mode = quality.level === 'high' ? 60 : 30;
    });
  });
  start();
  connectCity();                                   // Google's city: its connection starts the moment the page opens
  prog(0.02, 'جارٍ تجهيز نيويورك…');
  // what the menu needs comes first, side by side (not one after another): the airplane, the cockpit, the voices.
  // The rest loads behind the menu: the first officer (in the right seat, out of the menu's view), the geese (needed six
  // seconds before the strike), the passengers of the ending.
  const side = Promise.all([loadExterior(),
    fetch('data/lines.flight.json').then(r => r.json()), fetch('assets/flight/atc/clips.json').then(r => r.json())]);
  await buildWorld((k) => prog(0.05 + k * 0.4, 'النهر والسماء…'));
  // the photographed city (the only city): its connection starts now, while the airplane and the cockpit load
  cityP = loadGoogleTiles();
  const track = loadTrack();                       // (the flight path is placed on the city's map)
  // the opening's shots know where they will be as soon as the flight path is here: their city starts loading now
  Promise.all([cityP, track]).then(preloadViews).catch(e => console.warn('[google tiles]', e));
  const deck = (async () => { await track; await buildCockpit(); buildGlass(); buildControls(); })();
  prog(0.75, 'الطائرة والقمرة…');
  const [, lines, clips] = await side;
  await deck;
  W.hideInReflection = [CK.group];
  // the airplane's reflection only when it is low over the river (high up, its smeared image read as a dark shadow)
  W.hideInReflectionNow = () => {
    const h = AC.ext && AC.pos.y > 45 ? [AC.ext] : [];
    // and in flight on integrated graphics, the photographed city too: drawing its thousand tiles a second time for the
    // mirror made every other frame twice as heavy (the stutter while flying); the choppy river still mirrors the sky,
    // the light and the airplane. The outside shots and the high level keep the full reflection.
    if (GT.holder && GT.detail === 'flight' && quality.level !== 'high') h.push(GT.holder);
    return h;
  };
  bloom.strength = 0.12; bloom.threshold = 0.92; renderer.toneMappingExposure = 0.95; grade.uniforms.vig.value = 0.35; grade.uniforms.warm.value = 0.04;
  AC.t = -86; sampleReal(AC.t); acUpdate(0);
  seat(true);
  prog(1, 'جاهز');
  await new Promise(r => setTimeout(r, 200));
  renderOpts.skip = false;
  return {lines: lines.lines, speakers: lines.speakers, clips};
}

/** the photographed city of the opening shots, fetched while the site loads and the menu shows, through cameras of their
 *  own placed where those shots will be (at the screen's full resolution); the cockpit's own view behind the menu fetches
 *  nothing meanwhile. Each shot with its own lens (a narrower lens asks for finer tiles) and its view distance (the
 *  horizon is 120 km away from up here). They go when the first shot is on screen. */
function preloadViews() {
  if (GT.opening) return;                          // (the flight has already started: its camera fetches for itself)
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const shots = [[-86, 45, (f, sd) => [AC.pos.clone().addScaledVector(f, -70).addScaledVector(sd, 25).add(V3(0, 12, 0)), AC.pos.clone()]],
                 [-83, 38, (f, sd) => [AC.pos.clone().addScaledVector(sd, 55).addScaledVector(f, 8).add(V3(0, 4, 0)), AC.pos.clone().addScaledVector(f, 4)]]];
  // the airplane's place at each shot, worked out and put back at once (the menu is drawn from the cockpit)
  // the shots' cameras, worked out where the airplane will be for each
  const cams = shots.map(([t, fov, pose]) => {
    sampleReal(t); const a = AC.hdg * Math.PI / 180, f = V3(Math.sin(a), 0, -Math.cos(a)), sd = V3(-f.z, 0, f.x);
    const [pp, look] = pose(f, sd), cam = new THREE.PerspectiveCamera(fov, camera.aspect, 1, 120000);
    cam.position.copy(pp); cam.lookAt(look); cam.updateMatrixWorld();
    return cam;
  });
  // one after the other: the city comes in level by level (a tile's finer children are only asked for once it is here),
  // so the first shot's close ground is a long chain of downloads; it gets the machine to itself until it is sharp,
  // then the second shot is added
  const drops = [addViewpoint(cams[0], 1)];
  (async () => {
    const t0 = performance.now(); let ok = 0;
    while (!GT.opening && performance.now() - t0 < 30000 && ok < 3) { await new Promise(r => setTimeout(r, 250)); ok = coarseNear() === 0 && performance.now() - t0 > 1500 ? ok + 1 : 0; }
    if (!GT.opening) { drops.push(addViewpoint(cams[1], 1)); console.log('[boot] first shot ready behind the menu in', Math.round(performance.now() - t0), 'ms'); }
  })();
  sampleReal(-86); acUpdate(0);
  // the cockpit's own view behind the menu fetches nothing: the menu covers it, and every tile the machine prepares
  // goes to the opening's shots, so they are ready sooner after "start" (the camera joins again at the first shot)
  GT.tiles.deleteCamera(camera);
  // at full pace for as long as the menu shows (the menu is still: the work costs it nothing that can be seen)
  GT.frozen = false; boost(true);
  // they go when the first shot is on screen (flow.js): from then on only what the camera sees is chosen and drawn (the
  // tiles chosen for any viewpoint are drawn too — another shot's coarse tiles stood in this one as blurred slabs)
  GT.shotShown = () => { drops.forEach(d => d && d()); drops.length = 0; GT.tiles.setCamera(camera); boost(false); };
  console.log('[boot] the city loads for the menu and the opening from', Math.round(performance.now() - T0), 'ms');
}
/** before the first shot: the photographed city must be connected (there is no other city: the flight waits for it,
 *  saying so, however long it takes); what is still arriving, the first shot waits for under the held frame */
let cityP = null, foP = null;
async function openingReady() {
  while (CITY.state !== 'on') {
    if (CITY.tries > 2) titleStatus('في انتظار الاتصال بالإنترنت…');
    await new Promise(r => setTimeout(r, 250));
  }
  titleStatus('');
  // the first officer must be in his seat when the flight starts (he speaks in the climb); usually long since there
  if (foP) await Promise.race([foP, new Promise(r => setTimeout(r, 20000))]);
}

async function showCredits() {
  const fl = await fetch('assets/flight_models/CREDITS.json').then(r => r.json()).catch(() => ({}));
  const esc = (t) => String(t).replace(/[&<>"]/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[ch]));
  $('docbody').innerHTML = `<div class="credits-card" dir="ltr"><h3 dir="rtl">المصادر والتراخيص</h3><ul>
    <li>Flight path, times, heights and cockpit lines: <a href="https://www.ntsb.gov/investigations/AccidentReports/Reports/AAR1003.pdf" target="_blank" rel="noopener">NTSB Aircraft Accident Report AAR-10/03</a> <small>(US Government work, public domain)</small></li>
    <li>Air traffic control audio and transcript: <a href="https://www.faa.gov/data_research/accident_incident/2009-01-15/" target="_blank" rel="noopener">FAA release, February 5, 2009</a> <small>(public domain)</small></li>
    <li>New York: Google Photorealistic 3D Tiles <small>(© Google, via Cesium ion; attribution shown on screen)</small> · Ground heights and the rivers' outline: USGS 3DEP <small>(public domain)</small> · Aerial photographs under the city: USGS The National Map / USDA NAIP <small>(public domain)</small></li>
    ${Object.values(fl).map(([t, a, u, l]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a> — ${esc(a)} <small>(${esc(l)})</small></li>`).join('')}
    <li>Voices of the crew, cabin and warnings: synthesized (Microsoft neural voices)</li></ul>
    <p dir="rtl"><small>الأشخاص الحقيقيون يُذكرون في الختام فقط. الكلام في القمرة مأخوذ من نص مسجّل قمرة القيادة في تقرير التحقيق، بأصوات مُركّبة.</small></p></div>`;
  show('doc', true);
  $('docclose').onclick = () => { show('doc', false); $('docbody').innerHTML = ''; };
}
window.__credits = showCredits;

(async () => {
  let data;
  try { data = await boot(); }
  catch (e) { console.error(e); window.__showErr && window.__showErr(e && (e.message || e)); return; }
  show('loading', false);
  // behind the menu: the aerial photographs under the city (sharp ground in the outside shots while Google's finer
  // tiles arrive), the first officer, then the geese
  loadGround().catch(e => console.warn('[ground]', e));
  foP = loadFO().catch(e => console.warn('[fo]', e)).then(() => loadGeese()).catch(e => console.warn('[geese]', e));
  // and the passengers of the ending — once the city in view has arrived (their models are heavy to unpack:
  // loaded at once, they held the menu at two or three frames a second for seconds, and the city's loading with it), or
  // after 12 s at most
  (async () => {
    const t0 = performance.now(); let calm = 0;
    while (performance.now() - t0 < 12000 && calm < 4) {
      await new Promise(r => setTimeout(r, 250));
      const st = GT.tiles && GT.tiles.stats; calm = st && !GT.frozen && st.downloading + st.parsing === 0 && GT.tiles.lruCache.itemSet.size > 50 ? calm + 1 : 0;
    }
    preloadRescue().catch(e => console.warn('[rescue]', e));
  })();
  // menu background: the airplane over Queens, seen from the cockpit
  CK.head.ty = 0.35; CK.head.tp = -0.12;
  const dev = Q.get('dev');
  let mode = Q.get('mode') || 'real';
  if (!dev) {
    show('menu', true);
    $('creditsbtn').onclick = (e) => { e.preventDefault(); showCredits(); };
    mode = await new Promise(r => document.querySelectorAll('.mode').forEach(b => b.onclick = () => r(b.dataset.mode)));
    resumeAudio();
    show('menu', false); show('howto', true);
    await new Promise(r => $('startbtn').onclick = r);
    show('howto', false);
  } else resumeAudio();
  // the opening title covers what is still arriving (the city of the first shot, the first officer): flow.js fades it out
  await showTitle();
  await openingReady();
  const go = async () => {
    const S = await run(mode, data);
    await debrief(S, {onRetry: () => location.reload()});
  };
  go();
})();
