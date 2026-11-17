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
import {debrief} from './debrief.js';
import {loadGoogleTiles, GT, boost} from './gtiles.js';

window.__fl = {THREE, scene, camera, renderer, W, AC, CK, heightAt, sampleReal, STATE};
const txt = $('loadtxt'), bar = $('loadbar');
const prog = (k, t) => { bar.style.width = Math.round(k * 100) + '%'; if (t) txt.textContent = t; };

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
  await buildWorld((k) => prog(0.05 + k * 0.6, k < 0.6 ? 'الأرض والنهر…' : 'المباني…'));
  let photoreal = null;
  try { photoreal = await loadGoogleTiles(); if (photoreal) prog(0.66, 'نيويورك الحقيقية ثلاثية الأبعاد…'); } catch (e) { console.warn('[google tiles]', e); }
  // satellite imagery for the open-data city only (the photographed 3D city has its own)
  if (!photoreal) try { if (await loadMapbox()) prog(0.67, 'صور الأقمار الصناعية…'); } catch (e) { console.warn('[mapbox]', e); }
  prog(0.68, 'الطائرة…');
  await loadTrack();
  // the photographed city streams in by detail: fetch the start of the flight (LaGuardia, the climb-out) behind the
  // loading screen, so the opening shot is sharp from its first frame (at most 20 s)
  if (photoreal && GT.tiles) {
    prog(0.7, 'نيويورك الحقيقية… تحميل منطقة الإقلاع');
    // the camera where the opening shot will be (out of the cockpit for now: inside it, it was somewhere else entirely)
    const camParent = camera.parent, wasOn = CK.on; CK.on = false; scene.add(camera);   // (the seat's head motion also moves the camera)
    // the three opening shots (behind, alongside, the airplane climbing past), as flow.js frames them
    const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
    const poses = [
      (f, sd) => [AC.pos.clone().addScaledVector(f, -70).addScaledVector(sd, 25).add(V3(0, 12, 0)), AC.pos.clone()],
      (f, sd) => [AC.pos.clone().addScaledVector(sd, 55).addScaledVector(f, 8).add(V3(0, 4, 0)), AC.pos.clone().addScaledVector(f, 4)],
      (f, sd) => [AC.pos.clone().addScaledVector(f, 300).addScaledVector(sd, -45).add(V3(0, 8, 0)), AC.pos.clone()],
    ];
    // each with its own lens (a narrower lens asks for finer tiles: preloading through the cockpit's wide lens fetched a
    // quarter of what the shot needs). The first shot last, and given the most time: its slanting view to the horizon
    // needs ~1300–2000 tiles, fetched level by level; the third shot looks up at the airplane against the sky.
    const t0 = performance.now(), times = [-86, -80, -75], fovs = [45, 38, 34], fov0 = camera.fov, budget = [22000, 9000];
    boost(true);                                   // behind the loading screen: fetch and prepare tiles as fast as they come
    for (const k of [1, 0]) {
      sampleReal(times[k]); const a = AC.hdg * Math.PI / 180, f = V3(Math.sin(a), 0, -Math.cos(a)), sd = V3(-f.z, 0, f.x);
      // the shot's lens, and its view distance: the loading camera saw only 900 m, so the preload fetched just the ground
      // next to the airplane and the opening had to fetch the rest (the horizon is 120 km away from up here)
      camera.fov = fovs[k]; camera.far = 120000; camera.updateProjectionMatrix();
      const [pp, look] = poses[k](f, sd); camera.position.copy(pp); camera.lookAt(look); camera.updateMatrixWorld();
      const tk = performance.now(); let calm = 0;
      while (performance.now() - tk < budget[k]) {
        await new Promise(r => setTimeout(r, 250));
        const st = GT.tiles.stats; calm = (st.downloading + st.parsing === 0) ? calm + 1 : 0;
        prog(0.7 + 0.08 * (1 - k + Math.min(1, (performance.now() - tk) / budget[k])) / 2, 'نيويورك الحقيقية… تحميل مشاهد البداية');
        if (calm >= 4 && performance.now() - tk > 1500) break;
      }
    }
    sampleReal(-86); camera.fov = fov0; camera.updateProjectionMatrix(); boost(false);
    console.log('[boot] photographed city preloaded in', Math.round(performance.now() - t0), 'ms', JSON.stringify(GT.tiles.stats));
    if (camParent && camParent !== scene) camParent.add(camera); CK.on = wasOn;
    GT.frozen = true;                              // hold these tiles as they are until the opening (flow.js settle())
  }
  await Promise.all([buildCockpit(), loadExterior(), loadGeese()]);
  buildControls();
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
  prog(0.8, 'الطاقم…');
  try { await loadFO(); } catch (e) { console.warn('[fo]', e); }
  // the people on the wings after the ditching: their models take ~1 s each to unpack, so behind the loading screen
  prog(0.83, 'الركاب…'); try { await preloadRescue(); } catch (e) { console.warn('[rescue]', e); }
  prog(0.86, 'الأصوات…');
  const [lines, clips] = await Promise.all([fetch('data/lines.flight.json').then(r => r.json()), fetch('assets/flight/atc/clips.json').then(r => r.json())]);
  bloom.strength = 0.12; bloom.threshold = 0.92; renderer.toneMappingExposure = 0.95; grade.uniforms.vig.value = 0.35; grade.uniforms.warm.value = 0.04;
  AC.t = -86; sampleReal(AC.t); acUpdate(0);
  seat(true);
  prog(1, 'جاهز');
  await new Promise(r => setTimeout(r, 200));
  renderOpts.skip = false;
  return {lines: lines.lines, speakers: lines.speakers, clips};
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
  await fade(true, 500);
  const go = async () => {
    const S = await run(mode, data);
    await debrief(S, {onRetry: () => location.reload()});
  };
  go();
})();
