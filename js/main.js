import * as THREE from 'three';
import {start, clock, onUpdate, Q, scene, camera, stats, renderer, gtao, composer, renderOpts, frameCap} from './core/engine.js';
import {colliders as __cols} from './world/building.js';
window.__cols = __cols;
window.__stats = stats; window.__quality = () => ({applyQuality, LEVELS, quality, dyn}); window.__renderOpts = renderOpts; window.__THREE = THREE; window.__frameCap = frameCap; window.__renderer = renderer; window.__scene = scene; window.__composer = composer; window.__camera = camera;
import {json} from './core/assets.js';
import {onKey, setInput, input} from './core/input.js';
import {resume as resumeAudio} from './core/audio.js';
import {initMaterials} from './world/materials.js';
import {buildBuilding, roofGroup} from './world/building.js';
import {buildCity, trees, bakeTreeImpostors} from './world/city.js';
import {buildTraffic} from './world/traffic.js';
import {buildLeaves} from './world/leaves.js';
import {buildNav} from './world/nav.js';
import {insideBuilding} from './actors/player.js';
import {buildLighting, sun} from './world/lighting.js';
import {detectGPU, applyQuality, startAdaptive, savedQuality, quality, LEVELS, dyn, restoreDyn} from './core/quality.js';
import {buildCafe, attachHana} from './world/cafe.js';
import {loadAnimLib, characters} from './actors/character.js';
import {initPlayer} from './actors/player.js';
import {loadCast} from './story/cast.js';
import {S, EVIDENCE, CAT, MINI, FULL_URL} from './story/state.js';
import {runMini} from './story/mini.js';
import {getSteps} from './ui/tracker.js';
import {run, restartFromCheckpoint} from './story/flow.js';
import {bakeMap, toggleMap, drawMinimap, mapState} from './ui/map.js';
import {$, show, fade} from './ui/ui.js';
import {docOpen, closeDoc} from './ui/docs.js';
import {choosing} from './ui/ui.js';
import './ui/tracker.js';
import {mountSettingsButtons} from './ui/settings.js';
import {initTouch} from './ui/touch.js';

const txt = $('loadtxt');
async function boot() {
  const T0 = performance.now(), mark = (k) => console.info('[boot]', k, ((performance.now() - T0) / 1000).toFixed(1) + 's');
  const auto = detectGPU();
  quality.auto = auto;
  applyQuality(Q.get('q') || savedQuality() || quality.auto);   // early: renderer settings before any upload
  initMaterials();
  start();
  const [hdr, , , , , data] = await Promise.all([buildLighting().then(v => (mark('lighting'), v)), buildBuilding().then(v => (mark('building'), v)), buildCity().then(v => (mark('city'), v)), buildTraffic(), loadAnimLib().then(v => (mark('anims'), v)), json('data/lines.ar.json')]);
  bakeTreeImpostors(renderer);
  await loadCast(null, MINI ? ['player', 'nadia', 'w1', 'w2'] : undefined); mark('cast');   // quick version: fewer people
  if (!MINI) await buildCafe(hdr);
  buildLeaves();
  buildNav();
  { const lv = Q.get('q') || savedQuality() || quality.auto; restoreDyn(lv === 'custom' ? quality.level : lv); applyQuality(lv); }
  document.querySelectorAll('[data-q]').forEach(b => { if (b.dataset.q === quality.auto) b.querySelector('small').textContent = 'تلقائي — مناسب لجهازك'; });
  const gi = document.getElementById('gpuinfo'); if (gi) gi.textContent = (quality.software ? '⚠ تسريع الرسوميات معطّل في المتصفح — فعّله من الإعدادات لأداء أفضل · ' : '') + (quality.gpu ? 'كارت الشاشة: ' + quality.gpu.replace(/ANGLE \(|\)$/g, '').split(',').slice(0, 2).join(' ') : '');
  if (characters.hana) attachHana(characters.hana);
  initPlayer(characters.player);
  // let shaders compile on a neutral frame, then bake the map from above
  camera.position.set(0, 1.7, 30); camera.lookAt(0, 1.5, 0);
  await new Promise(r => setTimeout(r, 300));
  renderOpts.skip = false;
  bakeMap([roofGroup]); mark('map');
  return data;
}

function setupGlobalKeys() {
  startAdaptive();
  mountSettingsButtons(); initTouch();
  document.querySelectorAll('[data-q]').forEach(b => b.onclick = () => applyQuality(b.dataset.q, {manual: true}));
  onKey('KeyM', () => { if (!$('hud').classList.contains('hidden') && !docOpen()) toggleMap(); });
  onKey('Tab', () => { if ($('hud').classList.contains('hidden')) return; const on = $('tabpanel').classList.contains('hidden'); if (on) fillTab(); show('tabpanel', on); });
  onKey('Escape', () => {
    if (docOpen()) return;                 // the doc viewer handles Esc itself
    if (mapState.open) { toggleMap(false); return; }
    if (!$('tabpanel').classList.contains('hidden')) { show('tabpanel', false); return; }
    if ($('hud').classList.contains('hidden')) return;
    const p = $('pause').classList.contains('hidden');
    show('pause', p); clock.paused = p;
  });
  $('resume').onclick = () => { show('pause', false); clock.paused = false; };
  $('restartnode').onclick = () => restartFromCheckpoint();
  $('tohowto').onclick = () => { show('pause', false); show('howto', true); $('startbtn').textContent = 'متابعة'; $('startbtn').onclick = () => { show('howto', false); clock.paused = false; }; };
  // only the front-row trees can be seen from inside the building: skip the rest (big triangle saving)
  let wasIn = null;
  onUpdate(() => {
    const camIn = insideBuilding(camera.position.x, camera.position.z) && camera.position.y < 3.3;
    const key = camIn + quality.level + quality.aoMode + quality.ver;
    if (key !== wasIn) { wasIn = key; for (const t of trees) t.visible = quality.level !== 'cpu' && (!camIn || t.position.z < 19);
      gtao.enabled = quality.aoMode === 'always' || quality.aoMode === 'indoor' && camIn;     // AO matters most in the rooms
      for (const id of ['w1', 'w2', 'w3', 'w4', 'w5', 'p1', 'p2', 'p3', 'p4']) { const c = characters[id]; if (c) c.fbx.visible = quality.level !== 'cpu'; } }
  });
  let mmT = 0; onUpdate((dt) => { mmT += dt; if (mmT > 1 / 30 && !$('hud').classList.contains('hidden')) { mmT = 0; drawMinimap(); } });
}
function fillTab() {
  if (MINI) { $('tasklist').innerHTML = getSteps().map(s => `<li class="${s.done() ? 'done' : ''} ${s.opt ? 'opt' : ''}">${s.t}</li>`).join(''); }
  const t = MINI ? [] : [
    ['تحدث مع عمر صالح في الاستقبال', S.nodes.LOBBY], ['اقرأ بحث الشرائح وأكمل مهمة القيمة', S.tasks.research], ['افحص ورقة الميزانية (مهمة مالية)', S.ev.M10],
    ['أجب نادية: لمن هذه الحملة؟', S.nodes.N01], ['رد على اقتراح رايان', S.nodes.N02], ['اذهب إلى الاجتماع', S.ending],
  ];
  const opt = [['لوحة بيانات الفروع + مكالمة الفرع', S.nodes.N03], ['دليل العلامة', S.ev.M5], ['مقترح الشراكة + جريس', S.nodes.N06], ['سيناريو الفيلم', S.nodes.N05], ['بطاقة القيم (قاعة الاجتماعات)', S.ev.M6]];
  if (!MINI) $('tasklist').innerHTML = t.map(([n, d]) => `<li class="${d ? 'done' : ''}">${n}</li>`).join('') + opt.map(([n, d]) => `<li class="opt ${d ? 'done' : ''}">${n}</li>`).join('');
  const n = Object.keys(S.ev).length; $('evcount').textContent = `(${n}/10)`;
  $('evlist').innerHTML = Object.entries(EVIDENCE).map(([id, e]) => `<div class="ev ${S.ev[id] ? '' : 'locked'}"><span class="cat ${e.cat}">${CAT[e.cat]}</span><b>${id}</b> ${S.ev[id] ? e.t : '— لم يُجمع بعد · ' + e.src}</div>`).join('');
}

(async () => {
  let data;
  try { data = await boot(); }
  catch (e) { console.error(e); window.__showErr && window.__showErr(e && (e.message || e)); return; }
  setupGlobalKeys();
  show('loading', false);
  let resume = null;
  if (Q.has('resume')) { try { const cp = JSON.parse(sessionStorage.getItem('bus3_cp')); if (cp) { Object.assign(S, cp.S); resume = cp.scene; } } catch (e) {} }
  if (Q.get('dev') && !MINI) { S.mode = 'practice'; resume = Q.get('dev'); }
  if (Q.get('preset') === 'good') Object.assign(S, {segment: 'A', ops_checked: true, ev: {M1: true, M2: true, M3: true, M4: true, M5: true, M10: true}, nodes: {N01: 'A', N02: 'sound', N03: 'ask'}, briefBuilt: true, brief: {insight: 'strong', idea: 'third', ops: 'sound', measure: 'business', risk: 'plan', cards: {insight: ['M1', 'M4'], ops: ['M3'], measure: ['M10'], risk: ['M7']}}});
  if (MINI && Q.get('dev')) { await runMini(data.lines, data.speakers); return; }
  if (resume && !MINI) { await run(data.lines, data.speakers, resume); return; }
  if (MINI) setupMiniMenu(); else $('menufoot').insertAdjacentHTML('afterbegin', `<a href="?mini=1" class="quicklink">⚡ النسخة السريعة (7–10 دقائق)</a> · `);
  // scenic menu background: slow orbit around the HQ
  let ang = 0.6; const orbit = onUpdate((dt) => { ang += dt * 0.03; camera.position.set(Math.sin(ang) * 70, 26, 10 + Math.cos(ang) * 70); camera.lookAt(0, 8, 0); });
  await fade(false, 1200);
  show('menu', true);
  const mode = await new Promise(r => document.querySelectorAll('.mode').forEach(b => b.onclick = () => r(b.dataset.mode)));
  S.mode = mode; resumeAudio();
  show('menu', false); show('howto', true);
  await new Promise(r => $('startbtn').onclick = r);
  show('howto', false);
  await fade(true, 700); orbit();
  if (MINI) await runMini(data.lines, data.speakers); else await run(data.lines, data.speakers, null);
})();

/** quick version: menu and instructions texts */
function setupMiniMenu() {
  document.title = 'اختبار ستاربكس — النسخة السريعة';
  const m = $('menu');
  m.querySelector('.tag').textContent = 'SYRA-EDU-BUS-03 · النسخة السريعة';
  m.querySelector('.lead').textContent = 'أنت مسؤول تسويق في سلسلة قهوة، ومعك 120,000 دولار لحملة الأعياد. ادخل مكتبك، حلّ المهام، اجمع الأدلة، ابنِ الموجز واعرضه على نادية، ثم اختر الخطة. كل ما تفعله يُحسب بالنقاط من 100.';
  m.querySelector('.modes').innerHTML = '<button class="mode" data-mode="mini" style="grid-column:1/-1"><b>ابدأ النسخة السريعة</b><span>7–10 دقائق · شخصيات وحوار أقل · نقاط على كل ما تفعله</span></button>';
  $('menufoot').innerHTML = `يُفضَّل استخدام سماعات · <a href="${FULL_URL || './'}" class="quicklink">النسخة الكاملة (25–30 دقيقة)</a>`;
  $('howto').querySelector('.task-card').innerHTML = '<b>المهمة:</b> حملة الأعياد في صفحة واحدة: لمن، ولماذا سيهتمون، وهل تستطيع فروعنا تقديمها.<br><span class="ok">النقاط (من 100):</span> المهام المالية 20 · الأدلة 10 · الشريحة 10 · الموجز 25 · التشغيل والأخلاقيات 15 · الخطة 15 · السرعة 5.<br><span class="no">غير مسموح:</span> الوعد بخصومات، أو استخدام قصة عميل أو صورته دون موافقة مكتوبة.';
}
