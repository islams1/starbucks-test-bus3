// Flight 1549 — boot: New York, the airplane, the cockpit, voices; then the menu and the flight (flow.js).
import * as THREE from 'three';
import {start, Q, scene, camera, renderer, renderOpts, onUpdate, bloom, grade, gtao, shadowCtl, frameCap} from '../core/engine.js';
import {resume as resumeAudio} from '../core/audio.js';
import {detectGPU, applyQuality, savedQuality, quality, onQuality, dyn} from '../core/quality.js';
import {$, show, fade} from '../ui/ui.js';
import {buildWorld, W, heightAt} from './world.js';
import {AC, loadTrack, loadExterior, loadGeese, update as acUpdate, sampleReal, chaseFrame} from './aircraft.js';
import {buildCockpit, CK, seat, loadFO} from './cockpit.js';
import {loadMapbox} from './mapbox.js';
import {buildControls} from './controls.js';
import {run, STATE} from './flow.js';
import {preloadRescue} from './rescue.js';
import {note} from './freeze.js';
import {debrief} from './debrief.js';
import {loadGoogleTiles, GT, boost, dropTiles} from './gtiles.js';

window.__fl = {THREE, scene, camera, renderer, W, AC, CK, heightAt, sampleReal, STATE};
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
  document.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => { try { localStorage.setItem('flight_quality', b.dataset.q); } catch (e) {} }));
  start();
  prog(0.02, 'جارٍ تجهيز نيويورك…');
  // what the menu needs comes first, side by side (not one after another): the city, the airplane, the cockpit, the voices.
  // The rest (the photographed city of the opening shots, the passengers of the ending) loads behind the menu.
  const side = Promise.all([loadExterior(), loadGeese(),
    fetch('data/lines.flight.json').then(r => r.json()), fetch('assets/flight/atc/clips.json').then(r => r.json())]);
  await buildWorld((k) => prog(0.05 + k * 0.6, k < 0.6 ? 'الأرض والنهر…' : 'المباني…'));
  const track = loadTrack();                       // (the flight path is placed on the city's map)
  const deck = (async () => { await track; await buildCockpit(); buildControls(); try { await loadFO(); } catch (e) { console.warn('[fo]', e); } })();
  prog(0.75, 'الطائرة والقمرة…');
  const [, , lines, clips] = await side;
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

/** the photographed city of the opening shots, fetched behind the menu through a camera of its own placed where each shot
 *  will be (the menu keeps showing the cockpit). Each shot with its own lens (a narrower lens asks for finer tiles) and
 *  its view distance (the horizon is 120 km away from up here); the first shot last, and given the most time. */
let openingP = null;
function preloadOpening() {
  if (openingP || !GT.tiles) return openingP || Promise.resolve();
  return openingP = (async () => {
    const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
    const shots = [[-80, 38, (f, sd) => [AC.pos.clone().addScaledVector(sd, 55).addScaledVector(f, 8).add(V3(0, 4, 0)), AC.pos.clone().addScaledVector(f, 4)]],
                   [-86, 45, (f, sd) => [AC.pos.clone().addScaledVector(f, -70).addScaledVector(sd, 25).add(V3(0, 12, 0)), AC.pos.clone()]]];
    // the airplane's place at each shot, worked out and put back at once (the menu is drawn from the cockpit)
    const poses = shots.map(([t, fov, pose]) => { sampleReal(t); const a = AC.hdg * Math.PI / 180, f = V3(Math.sin(a), 0, -Math.cos(a)), sd = V3(-f.z, 0, f.x); return [fov, ...pose(f, sd)]; });
    sampleReal(-86); acUpdate(0);
    const pcam = new THREE.PerspectiveCamera(45, camera.aspect, 1, 120000), t0 = performance.now(), budget = [9000, 22000];
    GT.frozen = false; GT.viewCam = pcam; GT.tiles.deleteCamera(camera); GT.tiles.setCamera(pcam); boost(true);
    try {
      for (let k = 0; k < poses.length && !started; k++) {
        const [fov, pp, look] = poses[k];
        pcam.fov = fov; pcam.aspect = camera.aspect; pcam.updateProjectionMatrix(); pcam.position.copy(pp); pcam.lookAt(look); pcam.updateMatrixWorld();
        const tk = performance.now(); let calm = 0;
        while (performance.now() - tk < budget[k] && !started) {
          await new Promise(r => setTimeout(r, 250));
          const st = GT.tiles.stats; calm = (st.downloading + st.parsing === 0) ? calm + 1 : 0;
          if (calm >= 4 && performance.now() - tk > 1500) break;
        }
      }
    } finally {
      boost(false); GT.tiles.deleteCamera(pcam); GT.tiles.setCamera(camera); GT.viewCam = null;
      if (!started) GT.frozen = true;              // hold these tiles as they are until the opening (flow.js settle())
      console.log('[boot] photographed city of the opening preloaded behind the menu in', Math.round(performance.now() - t0), 'ms');
    }
  })();
}
/** before the first shot: whatever of the opening's city is still on its way (the player was quicker than the download) */
let cityReady = null, cityState = 'none', started = false;
const until = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
/** before the first shot: the player never waits long. Still connecting to the real city after a few seconds: the flight
 *  goes ahead on the open-data city (the real one, arriving mid-flight, would swap the whole city at once). Connected and
 *  fetching the opening's tiles: a few seconds more, then the opening fetches the rest itself. */
async function openingReady() {
  if (!cityReady) return;
  const t0 = performance.now();
  while (cityState === 'connecting' && performance.now() - t0 < 4000) await new Promise(r => setTimeout(r, 100));
  if (cityState === 'connecting') { cityState = 'late'; console.log('[boot] the real city is late: flying over the open-data city'); }
  else if (openingP) await until(openingP, Math.max(1500, 6000 - (performance.now() - t0)));
  started = true; if (openingP) await openingP;          // (the preload stops within a quarter second)
}

async function showCredits() {
  const fl = await fetch('assets/flight_models/CREDITS.json').then(r => r.json()).catch(() => ({}));
  const esc = (t) => String(t).replace(/[&<>"]/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[ch]));
  $('docbody').innerHTML = `<div class="credits-card" dir="ltr"><h3 dir="rtl">المصادر والتراخيص</h3><ul>
    <li>Flight path, times, heights and cockpit lines: <a href="https://www.ntsb.gov/investigations/AccidentReports/Reports/AAR1003.pdf" target="_blank" rel="noopener">NTSB Aircraft Accident Report AAR-10/03</a> <small>(US Government work, public domain)</small></li>
    <li>Air traffic control audio and transcript: <a href="https://www.faa.gov/data_research/accident_incident/2009-01-15/" target="_blank" rel="noopener">FAA release, February 5, 2009</a> <small>(public domain)</small></li>
    <li>Aerial imagery: USGS The National Map / USDA NAIP <small>(public domain)</small> · Elevation: USGS 3DEP <small>(public domain)</small></li>
    <li>Buildings: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a> <small>(ODbL)</small></li>
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
  // behind the menu: the opening shots' photographed city, then the passengers of the ending
  // (the real city replaces the open-data one in the cockpit windows when it arrives; without a key, or if it does not
  // answer, the satellite imagery dresses the open-data city instead)
  const behind = (async () => {
    let photoreal = null; cityState = 'connecting';
    try { photoreal = await loadGoogleTiles(); } catch (e) { console.warn('[google tiles]', e); }
    if (cityState === 'late') { if (photoreal) dropTiles('arrived after the start'); return; }
    cityState = photoreal ? 'preloading' : 'open';
    if (photoreal) await preloadOpening();
    else try { await loadMapbox(); } catch (e) { console.warn('[mapbox]', e); }
    if (cityState !== 'late') cityState = 'ready';
  })();
  cityReady = behind;
  preloadRescue().catch(e => console.warn('[rescue]', e));
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
  note('تجهيز المدينة…');                           // the live cockpit (never a still or black screen) while the city's last part arrives
  await openingReady(); note('');
  const go = async () => {
    const S = await run(mode, data);
    await debrief(S, {onRetry: () => location.reload()});
  };
  go();
})();
