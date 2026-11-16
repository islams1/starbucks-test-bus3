// Operating-room quick version: boot, menu, then the operation (flow.js).
import * as THREE from 'three';
import {start, Q, scene, camera, renderer, renderOpts, onUpdate, clock, bloom, grade} from '../core/engine.js';
import {json} from '../core/assets.js';
import {resume as resumeAudio} from '../core/audio.js';
import {detectGPU, applyQuality, startAdaptive, savedQuality, quality, restoreDyn} from '../core/quality.js';
import {loadAnimLib} from '../actors/character.js';
import {mountSettingsButtons} from '../ui/settings.js';
import {$, show, fade} from '../ui/ui.js';
import {buildRoom, OR, CHEST} from './room.js';
import {buildField, F} from './field.js';
import {buildHeart, H} from './heart.js';
import {buildThorax} from './thorax.js';
import {buildProps} from './props.js';
import {loadTeam, T as TEAM} from './team.js';
import {initHands, handsOn, HANDS, useRig} from './hands.js';
import {loadFPHands} from './fphands.js';
import {buildTools, T as TOOLS, take, loadInstrumentModels} from './tools.js';
import {vit, setTarget} from './monitor.js';
import {startRoomTone, setVentilator} from './sound.js';

window.__or = {THREE, scene, camera, OR, F, H, TEAM, HANDS, TOOLS, vit, setTarget, take, CHEST, clock, renderer, scr: (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }};
const txt = $('loadtxt');
async function boot() {
  quality.auto = detectGPU();
  applyQuality(Q.get('q') || savedQuality() || quality.auto);
  start();
  txt.textContent = 'جارٍ تجهيز غرفة العمليات…';
  buildRoom();
  buildField(OR.root);
  await Promise.all([buildHeart(OR.root), buildProps(), buildThorax(OR.root).catch(e => console.warn('[thorax]', e))]);
  if (H.peri) { F.peri.parent.remove(F.peri); F.peri = H.peri; }          // the pericardium wraps the real heart
  await loadInstrumentModels();
  buildTools(scene);
  const [, data] = await Promise.all([loadAnimLib(), json('data/lines.or.json')]);
  txt.textContent = 'الفريق يدخل…';
  await loadTeam();
  await initHands(TEAM.player);
  handsOn(true);
  // realistic first-person arms at the surgeon's shoulders (falls back to the avatar's own arms)
  try {
    const sk = TEAM.player.mesh.skeleton; TEAM.player.fbx.updateMatrixWorld(true);
    const sR = sk.getBoneByName('Bip01_R_UpperArm').getWorldPosition(new THREE.Vector3()), sL = sk.getBoneByName('Bip01_L_UpperArm').getWorldPosition(new THREE.Vector3());
    useRig(await loadFPHands(sR.add(new THREE.Vector3(0, -0.03, -0.1)), sL.add(new THREE.Vector3(0, -0.03, -0.1))));
  } catch (e) { console.warn('fp hands', e); }
  { const lv = Q.get('q') || savedQuality() || quality.auto; restoreDyn(lv === 'custom' ? quality.level : lv); applyQuality(lv); }
  document.querySelectorAll('[data-q]').forEach(b => { if (b.dataset.q === quality.auto) b.querySelector('small').textContent = 'تلقائي — مناسب لجهازك'; });
  bloom.strength = 0.08; bloom.threshold = 0.97; renderer.toneMappingExposure = 0.82;
  grade.uniforms.vig.value = 0.75;                  // darker edges around the lit wound, like surgical footage          // the theatre is bright: keep glow for the lamps and screens only
  camera.position.set(-0.42, 1.66, 0.4); camera.lookAt(CHEST);
  await new Promise(r => setTimeout(r, 300));
  renderOpts.skip = false;
  return data;
}

(async () => {
  let data;
  try { data = await boot(); }
  catch (e) { console.error(e); window.__showErr && window.__showErr(e && (e.message || e)); return; }
  startAdaptive(); try { mountSettingsButtons(); } catch (e) {}
  document.querySelectorAll('[data-q]').forEach(b => b.onclick = () => applyQuality(b.dataset.q, {manual: true}));
  show('loading', false);
  if (Q.get('view')) { show('vitals', true); return; }                 // dev: just the room
  const {runOR} = await import('./flow.js');
  if (Q.get('dev')) { resumeAudio(); startRoomTone(); await runOR(data, +Q.get('dev')); return; }
  // menu background: a slow look around the theatre
  let ang = 0; const orbit = onUpdate((dt) => { ang += dt * 0.05; camera.position.set(-0.3 + Math.sin(ang) * 2.4, 1.9, Math.cos(ang) * 2.4); camera.lookAt(-0.2, 1.1, 0); });
  setVentilator(false);
  show('menu', true);
  $('creditsbtn').onclick = (e) => { e.preventDefault(); showCredits(); };
  await new Promise(r => document.querySelectorAll('.mode').forEach(b => b.onclick = r));
  resumeAudio(); startRoomTone();
  show('menu', false); show('howto', true);
  await new Promise(r => $('startbtn').onclick = r);
  show('howto', false);
  await fade(true, 600); orbit();
  await runOR(data, 0);
})();

/** the 3D models' authors and licences (CC BY 4.0 requires the credit) */
async function showCredits() {
  const c = await fetch('assets/or_models/CREDITS.json').then(r => r.json()).catch(() => ({}));
  const used = Object.entries(c).filter(([k]) => !['nurse', 'retractor_hand', 'bp3d_heart', 'surgeon'].includes(k));
  const esc = (t) => String(t).replace(/[&<>"]/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[ch]));
  $('docbody').innerHTML = `<div class="credits-card" dir="ltr"><h3 dir="rtl">المصادر والتراخيص</h3><ul>${used.map(([, [t, a, u, l]]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a> — ${esc(a)} <small>(${esc(l)})</small></li>`).join('')}
    <li>Textures: <a href="https://polyhaven.com" target="_blank" rel="noopener">Poly Haven</a> <small>(CC0)</small></li>
    <li>Characters: <a href="https://github.com/microsoft/Microsoft-Rocketbox" target="_blank" rel="noopener">Microsoft Rocketbox</a> <small>(MIT)</small></li></ul>
    <p dir="rtl"><small>بعض النماذج عُدّلت (تبسيط، ألوان، تقطيع) لتناسب اللعبة.</small></p></div>`;
  show('doc', true);
  $('docclose').onclick = () => { show('doc', false); $('docbody').innerHTML = ''; };
}
