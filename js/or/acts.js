// The things the surgeon does with the hands: mark the line, cut, cauterise, saw, open the retractor, scan the aorta,
// cannulate, clamp, suture, defibrillate, measure graft flow, suck and stitch a bleeder, search for the sponge, wire
// the sternum. Each one is driven by the pointer and scored on how it was done, never on speed.
import * as THREE from 'three';
import {camera, onUpdate, damp, clock, wait} from '../core/engine.js';
import {T as TL, take, putDown, leftHold, ptr, ptrFrame, onPlane, pick, toScreen, pickTool, tray, trayHide, makeKit, pose, KIT} from './tools.js';
import {F, field, NOTCH, XIPH, setOpen} from './field.js';
import {H, worldOf, aortaPoint, addGraft, stitchPoint, paddleSpot} from './heart.js';
import {vit, setTarget} from './monitor.js';
import {OR, CHEST} from './room.js';
import {toolSound, crack, shock, charge, snip, click as clickSnd, setVentilator} from './sound.js';
import {award, flag, SC} from './score.js';
import {say, orders, standingOrders, ordersHide, mark, clearMarks, panel, panelHide, gauge, caption, hint, objective} from './orui.js';
import {HANDS} from './hands.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V3(0, 1, 0);
export const A = {site: null, clampK: null, cannulas: [], lines: [], stitches: [], leaks: 0, grafts: {}};
/** run fn every frame until it returns something other than undefined */
const frame = (fn) => new Promise(res => { const off = onUpdate((dt) => { let r; try { r = fn(dt); } catch (e) { console.error(e); r = null; } ptrFrame(); if (r !== undefined) { off(); res(r); } }); });
const toast = (html) => { const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = html; document.getElementById('toasts').appendChild(t); setTimeout(() => t.remove(), 3000); };
const skinY = () => F.skin.position.y + 0.004;
const scr = (p) => toScreen(p);
const pxDist = (p) => { const s = scr(p); return Math.hypot(s.x - ptr.x, s.y - ptr.y); };
/** tip follows the pointer on a plane; contact while pressed */
function followPlane(y, dt, k = 0.55) { const p = onPlane(y); if (p) TL.tip.lerp(p, TL.tip.lengthSq() ? k : 1); TL.contact = damp(TL.contact, ptr.down ? 1 : 0, 18, dt); return p; }
const inPatch = (p) => p && Math.abs(p.x - CHEST.x) < 0.17 && Math.abs(p.z) < 0.14;

// ---------------------------------------------------------------- small effects: cautery smoke, blood jet
const puffTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(235,235,235,.9)'); r.addColorStop(1, 'rgba(235,235,235,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const puffs = [];
export function puff(pos) {
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({map: puffTex, transparent: true, depthWrite: false, opacity: 0.55}));
    s.position.copy(pos).add(V3((Math.random() - 0.5) * 0.004, 0.002, (Math.random() - 0.5) * 0.004)); s.scale.setScalar(0.006); OR.root.add(s);
    puffs.push({s, t: 0, v: V3((Math.random() - 0.5) * 0.01, 0.03 + Math.random() * 0.02, (Math.random() - 0.5) * 0.01)});
  }
}
onUpdate((dt) => { for (let i = puffs.length - 1; i >= 0; i--) { const p = puffs[i]; p.t += dt; p.s.position.addScaledVector(p.v, dt); p.s.scale.setScalar(0.006 + p.t * 0.03); p.s.material.opacity = 0.55 * (1 - p.t / 1.4); if (p.t > 1.4) { OR.root.remove(p.s); p.s.material.dispose(); puffs.splice(i, 1); } } });

// ---------------------------------------------------------------- scene 2: the incision line
export async function actMarking() {
  objective('حدد خط الشق: من الثلمة فوق القص حتى أسفل الناتئ الرهابي');
  await pickTool(['marker', 'scalpel', 'cautery'], 'marker'); trayHide();
  TL.steady = CHEST.clone().add(V3(-0.13, 0.012, -0.05));
  const found = {n: false, x: false};
  const mN = mark(() => NOTCH, '<i></i><span>الثلمة فوق القص</span>', {cls: 'land hidden'});
  const mX = mark(() => XIPH, '<i></i><span>الناتئ الرهابي</span>', {cls: 'land hidden'});
  hint('مرّر القلم على الصدر لتتحسس العلامتين، ثم اضغط واسحب خطًا مستقيمًا في المنتصف');
  let best = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    F.marker = []; field.redraw();
    let lastDraw = 0;
    const pts = await frame((dt) => {
      const p = followPlane(skinY(), dt);
      if (!p) return;
      if (!found.n && p.distanceTo(NOTCH) < 0.04) { found.n = true; mN.set(true); }
      if (!found.x && p.distanceTo(XIPH) < 0.04) { found.x = true; mX.set(true); }
      if (ptr.down && inPatch(p)) {
        const last = F.marker[F.marker.length - 1];
        if (!last || last.distanceTo(p) > 0.002) { F.marker.push(p.clone()); if (clock.t - lastDraw > 0.05) { lastDraw = clock.t; field.redraw(); } }
      }
      if (ptr.released) { field.redraw(); if (F.marker.length > 12 && F.marker[0].distanceTo(F.marker[F.marker.length - 1]) > 0.08) return F.marker.slice(); F.marker = []; field.redraw(); }
    });
    // score: landmarks, straightness, midline
    const s = pts[0], e = pts[pts.length - 1];
    const [top, bot] = s.x < e.x ? [s, e] : [e, s];
    let land = 0; if (top.distanceTo(NOTCH) < 0.02) land++; if (bot.x > XIPH.x - 0.006 && bot.x < XIPH.x + 0.05 && Math.abs(bot.z) < 0.015) land++;
    const dir = bot.clone().sub(top).normalize(); let maxDev = 0, sumZ = 0;
    for (const p of pts) { const d = p.clone().sub(top); const perp = d.sub(dir.clone().multiplyScalar(d.dot(dir))).length(); maxDev = Math.max(maxDev, perp); sumZ += Math.abs(p.z); }
    const meanZ = sumZ / pts.length;
    const straight = maxDev < 0.005 ? 2 : maxDev < 0.01 ? 1 : 0, mid = meanZ < 0.006 ? 2 : meanZ < 0.012 ? 1 : 0;
    const sc = land + straight + mid;
    best = attempt ? Math.min(sc, 5) : sc;
    console.info('[marking]', {land, maxDev: +maxDev.toFixed(4), meanZ: +meanZ.toFixed(4), sc});
    if (sc >= 4 || attempt === 1) break;
    await say('hd_mid');
    hint('أعِد الرسم: من الثلمة إلى أسفل الناتئ، في المنتصف تمامًا');
  }
  mN.remove(); mX.remove(); hint('');
  award('marking', best);
  if (best >= 5) await say('hd_mark_ok');
  return best;
}

// ---------------------------------------------------------------- scene 3: the skin incision, then cautery
function distToPolyline(p, line) { let best = 1; for (let i = 1; i < line.length; i++) { const a = line[i - 1], b = line[i]; const ab = b.clone().sub(a), t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / ab.lengthSq())); best = Math.min(best, a.clone().addScaledVector(ab, t).distanceTo(p)); } return best; }
export async function actIncision() {
  objective('الشق: اتبع الخط بالمشرط، بسرعة ثابتة وعمق الجلد فقط');
  say('ra_scalpel');
  await pickTool(['scalpel', 'marker', 'cautery'], 'scalpel'); trayHide();
  const line = F.marker.length > 1 ? F.marker.slice() : [NOTCH.clone(), XIPH.clone().add(V3(0.02, 0, 0))];
  const x0 = Math.min(line[0].x, line[line.length - 1].x), x1 = Math.max(line[0].x, line[line.length - 1].x);
  const bins = new Array(24).fill(false);
  const G = gauge('العمق', {band: [0.35, 0.65]});
  hint('اضغط على أول الخط واسحب على طوله. انتبه لمؤشر العمق: الأخضر = الجلد فقط');
  let depth = 0, deepT = 0, deepWarned = 0, last = null, nIn = 0, nAll = 0, sumDev = 0, lastDraw = 0;
  F.incision = [];

  await frame((dt) => {
    TL.steady = TL.tip.clone().add(V3(-0.11, 0.014, -0.05));
    const p = followPlane(skinY(), dt, 0.6); if (!p) return;
    if (ptr.down && inPatch(p)) {
      const v = last ? p.distanceTo(last) / Math.max(dt, 1e-3) : 0; last = p.clone();
      const want = v < 0.006 ? 1.0 : v < 0.14 ? 0.5 : 0.18;      // still = pressing deeper; steady = skin; too fast = shallow
      depth = damp(depth, want, v < 0.006 ? 1.6 : 5, dt);
      const dev = distToPolyline(p, line);
      if (dev < 0.008) {
        const prev = F.incision[F.incision.length - 1];
        if (!prev || prev.distanceTo(p) > 0.0025) { F.incision.push(p.clone()); nAll++; sumDev += dev; if (depth > 0.3 && depth < 0.72) nIn++; const b = Math.floor((p.x - x0) / (x1 - x0) * bins.length); if (b >= 0 && b < bins.length) bins[b] = true; }
      }
      if (depth > 0.8) { deepT += dt; if (deepT > 0.35 && clock.t - deepWarned > 4) { deepWarned = clock.t; say('ra_deep'); setTarget({sbp: vit.target.sbp - 6}); SC.deep = (SC.deep || 0) + 1; } } else deepT = 0;
      if (clock.t - lastDraw > 0.06) { lastDraw = clock.t; field.redraw(); }
    } else { depth = damp(depth, 0, 4, dt); last = null; }
    G.set(depth, depth > 0.72, depth > 0.72 ? 'عميق' : depth > 0.3 ? 'الجلد' : ptr.down ? 'سطحي' : '');
    const cov = bins.filter(Boolean).length / bins.length;
    if (!ptr.down && cov >= 0.85) return cov;
    if (ptr.released && cov < 0.85 && F.incision.length > 3) hint('أكمل الشق على طول الخط كله');
  });
  G.hide(); hint(''); field.redraw();
  const meanDev = nAll ? sumDev / nAll : 1, inBand = nAll ? nIn / nAll : 0;
  const linePts = meanDev < 0.003 ? 2 : meanDev < 0.006 ? 1 : 0, depthPts = inBand >= 0.75 ? 2 : inBand >= 0.5 ? 1 : 0;
  console.info('[incision]', {meanDev: +meanDev.toFixed(4), inBand: +inBand.toFixed(2), deep: SC.deep || 0});
  // bleeders along the cut → cautery
  F.bleeders = []; for (let i = 0; i < 5; i++) { const q = F.incision[Math.floor((i + 0.5) / 5 * F.incision.length)] || NOTCH; F.bleeders.push({x: q.x + (Math.random() - 0.5) * 0.004, z: q.z + (Math.random() - 0.5) * 0.004, done: false}); }
  field.redraw();
  objective('أوقف نقاط النزف بالكيّ');
  say('ra_cautery');
  await pickTool(['cautery', 'scalpel', 'marker'], 'cautery'); trayHide();
  hint('المس كل نقطة نزف بطرف الكيّ واضغط قليلًا');
  const snd = toolSound('cautery'); let hold = 0;
  const bm = F.bleeders.map(b => mark(() => V3(b.x, skinY(), b.z), '<i></i>', {cls: 'bleed'}));
  await frame((dt) => {
    TL.steady = TL.tip.clone().add(V3(-0.11, 0.014, -0.05));
    const p = followPlane(skinY(), dt, 0.6); if (!p) return;
    let on = null; if (ptr.down) for (const b of F.bleeders) if (!b.done && Math.hypot(b.x - p.x, b.z - p.z) < 0.007) on = b;
    snd.set(ptr.down ? (on ? 1 : 0.35) : 0);
    if (on) { hold += dt; if (Math.random() < 0.3) puff(V3(on.x, skinY(), on.z)); if (hold > 0.35) { on.done = true; hold = 0; field.redraw(); bm[F.bleeders.indexOf(on)].remove(); } } else hold = 0;
    if (F.bleeders.every(b => b.done)) return true;
  });
  snd.set(0); setTimeout(() => snd.stop(), 300); hint('');
  award('incision', linePts + depthPts + 2);
  return linePts + depthPts + 2;
}

// ---------------------------------------------------------------- scene 4: sternal saw (ventilation!), retractor
export async function actSaw() {
  objective('افتح القص بالمنشار — ولا تنسَ الرئتين');
  say('ra_saw');
  await pickTool(['saw', 'scalpel', 'cautery'], 'saw'); trayHide();
  let stoppedBefore = null, lungHit = false, resumedPrompted = false, resumed = false;
  const so = standingOrders([{id: 'off', line: 'pl_vent_off'}, {id: 'on', line: 'pl_vent_on', hidden: true}], async (id) => {
    if (id === 'off' && vit.ventilating) { so.show('off', false); await say('pl_vent_off'); vit.ventilating = false; setVentilator(false); await say('ly_vent_off'); }
    if (id === 'on' && !vit.ventilating) { so.show('on', false); resumed = true; await say('pl_vent_on'); vit.ventilating = true; setVentilator(true); setTarget({spo2: 99}); await say('ly_vent_on'); }
  });
  hint('اضغط مع الاستمرار لتشغيل المنشار، واسحب على خط المنتصف من طرف إلى طرف');
  const bins = new Array(20).fill(false), x0 = NOTCH.x - 0.005, x1 = XIPH.x + 0.01;
  const snd = toolSound('saw'); let ventT = 0, nPts = 0, sumZ = 0;
  F.sawn = [];
  const G = gauge('النشر');
  await frame((dt) => {
    TL.steady = TL.tip.clone().add(V3(-0.11, 0.014, -0.05));
    const p = followPlane(skinY(), dt, 0.5); if (!p) return;
    const onBone = ptr.down && Math.abs(p.z) < 0.012 && p.x > x0 - 0.01 && p.x < x1 + 0.01;
    snd.set(ptr.down ? (onBone ? 1 : 0.6) : 0);
    if (TL.mesh && TL.mesh.userData.blade) TL.mesh.userData.blade.position.y = 0.018 + (ptr.down ? Math.sin(clock.t * 90) * 0.002 : 0);
    if (onBone) {
      if (stoppedBefore === null) stoppedBefore = !vit.ventilating;
      if (vit.ventilating) { ventT += dt; if (ventT > 0.25 && !lungHit) { lungHit = true; say('ly_lung'); vit.holdSat = true; setTarget({spo2: 91}); setTimeout(() => { vit.holdSat = false; }, 9000); } }
      const b = Math.floor((p.x - x0) / (x1 - x0) * bins.length); if (b >= 0 && b < bins.length) bins[b] = true;
      const prev = F.sawn[F.sawn.length - 1]; if (!prev || prev.distanceTo(p) > 0.003) { F.sawn.push(p.clone()); nPts++; sumZ += Math.abs(p.z); field.redraw(); }
      HANDS.lean = 0.26 + Math.sin(clock.t * 40) * 0.004;      // the body takes the saw's vibration
    }
    const cov = bins.filter(Boolean).length / bins.length; G.set(cov, false, Math.round(cov * 100) + '%');
    if (cov >= 0.9 && !ptr.down) return true;
  });
  snd.set(0); setTimeout(() => snd.stop(), 300); G.hide(); HANDS.lean = 0.22; crack();
  const meanZ = nPts ? sumZ / nPts : 1;
  award('saw', meanZ < 0.003 ? 3 : meanZ < 0.006 ? 2 : 1);
  // resume ventilation — the button is there, nobody reminds you for a while
  hint('');
  if (!vit.ventilating) {
    so.show('on', true); so.show('off', false);
    const t0 = clock.t;
    await frame(() => { if (resumed || vit.ventilating) return true; if (!resumedPrompted && clock.t - t0 > 7) { resumedPrompted = true; so.want('on'); say('ly_spo2'); } });
    await wait(1.2);
  }
  so.clear();
  const ventPts = (stoppedBefore && !lungHit ? 3 : 0) + (resumed && !resumedPrompted ? 1 : 0);
  award('vent', ventPts); if (lungHit) flag('lung');
  putDown();
  return ventPts;
}
export async function actRetractor() {
  objective('افتح الصدر بالمُبعِد، ببطء');
  field.setStage('open'); setOpen(0); F.retractor.visible = true; F.pericardium = 1;
  say('ra_retr');
  await pickTool(['retractor', 'saw', 'cautery'], 'retractor'); trayHide();
  const knob = () => F.crank.localToWorld(V3(0, 0.022, 0));          // the top of the crank's axis: turn the wings round it
  F.retractor.visible = true;
  const km = mark(knob, '<i></i>', {cls: 'crank'});
  hint('اضغط على مقبض المُبعِد وأدِره بحركة دائرية — ببطء');
  const G = gauge('الفتح'); let k = 0, lastA = null, w = 0, fast = 0, lastFast = -9; const win = [];
  await frame((dt) => {
    TL.tip.copy(knob()); TL.contact = 1;
    TL.steady = CHEST.clone().add(V3(-0.17, 0.02, -0.08));
    const c = scr(knob());
    if (ptr.down) {
      const a = Math.atan2(ptr.y - c.y, ptr.x - c.x);
      if (lastA !== null) { let d = a - lastA; d = Math.atan2(Math.sin(d), Math.cos(d)); win.push([clock.t, Math.abs(d)]); k = Math.min(1, k + Math.abs(d) / (Math.PI * 2) * 0.2); setOpen(k); }
      while (win.length && win[0][0] < clock.t - 0.4) win.shift(); w = win.reduce((s, q) => s + q[1], 0) / 0.4;
      lastA = a;
      if (w > 12 && clock.t - lastFast > 2.5) { lastFast = clock.t; fast++; crack(); say('ra_slow'); setTarget({sbp: vit.target.sbp - 4}); }
    } else { lastA = null; win.length = 0; w = 0; }
    G.set(k, w > 11, w > 11 ? 'سريع!' : Math.round(k * 100) + '%');
    if (k >= 1) return true;
  });
  km.remove(); G.hide(); hint(''); putDown();
  award('retractor', fast ? 0 : 2);
  F.pericardium = 0;                                  // the pericardium is opened and hitched up
  return fast;
}

// ---------------------------------------------------------------- scene 6: epiaortic ultrasound, choose the site
const PLAQUE = [0.5, 0.72];
const onPlaque = (k) => k >= PLAQUE[0] - 0.02 && k <= PLAQUE[1] + 0.02;
/** nearest point of the visible aorta to the pointer (screen space): {k, d(px), p} */
function aortaUnderPointer(kMin = 0.05, kMax = 1) {
  let best = {k: 0, d: 1e9, p: null};
  for (let i = 0; i <= 60; i++) { const k = kMin + (kMax - kMin) * i / 60; const p = aortaPoint(k); const d = pxDist(p); if (d < best.d) best = {k, d, p}; }
  return best;
}
const aortaTop = (k) => aortaPoint(k).add(V3(0, 0.0145, 0));
function drawUS(cv, k, contact) {
  const g = cv.getContext('2d'), W = cv.width, Hh = cv.height;
  g.fillStyle = '#000'; g.fillRect(0, 0, W, Hh);
  // fan-shaped image with speckle
  g.save(); g.beginPath(); g.moveTo(W / 2 - 40, 8); g.lineTo(W / 2 + 40, 8); g.lineTo(W - 6, Hh - 6); g.lineTo(6, Hh - 6); g.closePath(); g.clip();
  if (contact) {
    for (let i = 0; i < 1600; i++) { const v = Math.random() * 90 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(Math.random() * W, Math.random() * Hh, 2, 1); }
    const cx = W / 2, cy = Hh * 0.5, r = Hh * 0.27;
    g.fillStyle = '#050505'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();                  // lumen
    g.strokeStyle = '#bdbdbd'; g.lineWidth = 5; g.beginPath(); g.arc(cx, cy, r + 2, 0, 7); g.stroke();   // wall
    const inP = Math.max(0, 1 - Math.abs(k - (PLAQUE[0] + PLAQUE[1]) / 2) / ((PLAQUE[1] - PLAQUE[0]) / 2 + 0.04));
    if (inP > 0) {                                  // calcified plaque: bright crescent with an acoustic shadow behind it
      g.strokeStyle = `rgba(255,255,255,${0.5 + 0.5 * inP})`; g.lineWidth = 8 + 6 * inP; g.beginPath(); g.arc(cx, cy, r - 3, Math.PI * 0.15, Math.PI * (0.15 + 0.5 * inP)); g.stroke();
      g.fillStyle = `rgba(0,0,0,${0.85 * inP})`; g.beginPath(); g.moveTo(cx + r * 0.6, cy + r * 0.6); g.lineTo(cx + r * 1.7, Hh); g.lineTo(cx + r * 0.1, Hh); g.closePath(); g.fill();
    }
  }
  g.restore();
  g.fillStyle = '#9fd2c6'; g.font = '12px Inter'; g.fillText('EPIAORTIC  7.5 MHz', 8, 16); g.fillText(contact ? `${Math.round(k * 100)}%` : 'NO CONTACT', 8, Hh - 10);
}
export async function actAortaScan() {
  objective('افحص الأبهر الصاعد بالموجات، ثم اختر مكان القنية والملقط');
  say('ra_probe');
  await pickTool(['probe', 'clamp', 'cannulaA'], 'probe'); trayHide();
  const p = panel('<canvas id="uscv" width="280" height="190"></canvas><div class="row"><span>الجزء المفحوص</span><b id="uscov">0%</b></div><button id="usdone" class="pbtn">انتهيت من الفحص — اختر المكان</button>', {title: 'الموجات فوق الصوتية على الأبهر'});
  const cv = document.getElementById('uscv');
  const bins = new Array(20).fill(false); let mode = 'scan', site = null, sawPlaque = false, drawT = 0;
  document.getElementById('usdone').onclick = () => { mode = 'choose'; hint('اضغط على الأبهر حيث ستضع القنية الشريانية'); document.getElementById('usdone').remove(); };
  hint('اضغط مع الاستمرار على الأبهر واسحب المسبار على طوله');
  const sm = mark(() => site == null ? null : aortaTop(site), '<i></i><span>هنا</span>', {cls: 'site hidden'});
  await frame((dt) => {
    const a = aortaUnderPointer();
    const near = a.d < 70;
    if (near) TL.tip.lerp(aortaTop(a.k).add(V3(0, 0.002, 0)), 0.5); else { const q = onPlane(CHEST.y - 0.03); if (q) TL.tip.lerp(q, 0.4); }
    TL.contact = damp(TL.contact, ptr.down && near ? 1 : 0, 14, dt);
    TL.steady = CHEST.clone().add(V3(-0.25, 0.03, 0.18));
    const contact = ptr.down && near;
    if (contact && mode === 'scan') { const b = Math.min(19, Math.floor(a.k * 20)); bins[b] = true; if (onPlaque(a.k)) sawPlaque = true; }
    drawT += dt; if (drawT > 1 / 15) { drawT = 0; drawUS(cv, a.k, contact); document.getElementById('uscov').textContent = Math.round(bins.filter(Boolean).length / 20 * 100) + '%'; }
    if (mode === 'choose' && ptr.pressed && near) { site = a.k; sm.set(true); return true; }
  });
  hint(''); putDown();
  const cov = bins.slice(2).filter(Boolean).length / 18;
  const scanPts = cov >= 0.6 && sawPlaque ? 4 : cov >= 0.3 ? 2 : 0, sitePts = onPlaque(site) ? 0 : 4;
  if (sitePts === 0) flag('stroke');
  A.site = site;
  // purse-string suture at the chosen site
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0065, 0.0006, 6, 24), new THREE.MeshStandardMaterial({color: 0x2047a8, roughness: 0.5}));
  ring.position.copy(aortaTop(site)); ring.rotation.x = Math.PI / 2; OR.root.add(ring); A.purse = ring;
  sm.remove(); panelHide();
  console.info('[aorta]', {cov: +cov.toFixed(2), sawPlaque, site: +site.toFixed(2)});
  award('aorta', scanPts + sitePts);
  return {good: scanPts + sitePts >= 8, scanned: scanPts, soft: !!sitePts};
}

// ---------------------------------------------------------------- scene 7: cannulation
function bloodLine(from, to, col) {
  // up out of the chest, over the drapes towards the foot of the table, then down to the heart-lung machine
  const pts = [from, from.clone().add(V3(0.03, 0.07, 0)), V3(from.x + 0.3, 1.32, from.z * 0.4 - 0.05), V3(0.35, 1.2, -0.75), to];
  const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.0055, 8, false), new THREE.MeshPhysicalMaterial({color: col, roughness: 0.2, clearcoat: 1, transparent: true, opacity: 0.94}));
  m.castShadow = true; OR.root.add(m); A.lines.push(m); return m;
}
function leaveCannula(id, tip, dir) { const c = makeKit(id); pose(c, tip, dir); OR.root.add(c); A.cannulas.push(c); return c; }
export async function actCannulate() {
  objective('القنيات: الشريانية في المكان الذي اخترته، ثم الوريدية في الأذين الأيمن');
  say('ly_bp100'); setTarget({sbp: 100, dbp: 58}, 0.35);
  say('ra_cann');
  await pickTool(['cannulaA', 'cannulaV', 'clamp'], 'cannulaA'); trayHide();
  const sm = mark(() => aortaTop(A.site), '<i></i>', {cls: 'site'});
  hint('انتظر الضغط حول المئة (على الشاشة)، ثم اضغط على علامة الخيط');
  let high = false, lastWarn = -9;
  await frame((dt) => {
    const a = aortaUnderPointer();
    if (a.d < 70) TL.tip.lerp(aortaTop(a.k), 0.5); else { const q = onPlane(CHEST.y - 0.02); if (q) TL.tip.lerp(q, 0.4); }
    TL.contact = damp(TL.contact, a.d < 70 ? 1 : 0, 10, dt);
    TL.steady = CHEST.clone().add(V3(-0.25, 0.03, 0.18));
    if (ptr.pressed && a.d < 70) {
      if (Math.abs(a.k - A.site) > 0.07) { toast('القنية تدخل حيث وضعت الخيط (العلامة)'); return; }
      if (vit.sbp > 108) { high = true; if (clock.t - lastWarn > 3) { lastWarn = clock.t; say('ly_bp_high'); } return; }
      return true;
    }
  });
  sm.remove();
  const top = aortaTop(A.site); leaveCannula('cannulaA', top.clone().add(V3(0, -0.004, 0)), V3(0.45, 0.8, -0.3).normalize());
  bloodLine(top.clone().add(V3(0.06, 0.11, -0.04)), V3(0.3, 1.0, -1.32), 0x8e1414);
  snip();
  say('ra_venous');
  await pickTool(['cannulaV', 'cannulaA', 'clamp'], 'cannulaV'); trayHide();
  const raPos = () => H.ra.getWorldPosition(V3()).add(V3(0, 0.014, 0));
  const rm = mark(raPos, '<i></i><span>الأذين الأيمن</span>', {cls: 'site'});
  hint('اضغط على الأذين الأيمن');
  await frame((dt) => {
    const q = onPlane(CHEST.y - 0.025); if (q) TL.tip.lerp(pxDist(raPos()) < 60 ? raPos() : q, 0.45);
    TL.contact = damp(TL.contact, 1, 10, dt);
    if (ptr.pressed && pxDist(raPos()) < 60) return true;
  });
  rm.remove(); hint('');
  const ra = raPos(); leaveCannula('cannulaV', ra.clone().add(V3(0, -0.006, 0)), V3(0.55, 0.75, 0.3).normalize());
  bloodLine(ra.clone().add(V3(0.05, 0.08, 0.03)), V3(0.7, 0.95, -1.32), 0x3a0e18);
  putDown();
  award('cannula', high ? 1 : 3);
  return !high;
}

// ---------------------------------------------------------------- scene 8: cross-clamp
export async function actClamp() {
  objective('ضع الملقط على الأبهر، بين القنية والقلب، على جزء لين');
  say('ra_clamp');
  await pickTool(['clamp', 'needle', 'probe'], 'clamp'); trayHide();
  hint('اضغط على الأبهر حيث ستضع الملقط');
  const kMax = Math.max(0.12, A.site - 0.06);
  let k = null;
  await frame((dt) => {
    const a = aortaUnderPointer(0.06, kMax);
    if (a.d < 70) TL.tip.lerp(aortaTop(a.k).add(V3(0, 0.004, 0)), 0.5); else { const q = onPlane(CHEST.y); if (q) TL.tip.lerp(q, 0.4); }
    TL.contact = damp(TL.contact, a.d < 70 ? 1 : 0, 10, dt);
    if (ptr.pressed && a.d < 70) { k = a.k; return true; }
  });
  hint('');
  // leave the clamp on the aorta: jaws across it
  const p = aortaPoint(k), tg = H.aortaCurve.getTangentAt(k).transformDirection(H.group.matrixWorld).normalize();
  // the clamp crosses the aorta from the surgeon's side; its jaws (the first few cm from the tip) close over the vessel
  const across = V3().crossVectors(tg, UP).normalize(); if (across.z < 0) across.negate();
  const y = across.clone().addScaledVector(UP, 0.45).normalize(), x = V3().crossVectors(y, tg).normalize(), z = V3().crossVectors(x, y);
  const c = makeKit('clamp'); c.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)); c.position.copy(p).addScaledVector(y, -0.028); OR.root.add(c); A.clamp = c; A.clampK = k;
  clickSnd(); setTimeout(clickSnd, 90); setTimeout(clickSnd, 180);
  putDown();
  const bad = onPlaque(k); if (bad) flag('stroke');
  award('clamp', bad ? 0 : 2);
  return !bad;
}

// ---------------------------------------------------------------- scene 9: the LAD anastomosis
export async function actSuture() {
  objective('خِط المفاغرة: ثماني غرز حول فتحة الشريان');
  say('ra_needle');
  await pickTool(['needle', 'clamp', 'cautery'], 'needle'); trayHide();
  leftHold('forceps'); if (HANDS.arms) HANDS.arms.visible = false; if (HANDS.rig) HANDS.rig.group.visible = false;   // under the loupes only the instrument tips are in view
  const c = H.targets.LAD, P = (i) => stitchPoint(i, 8);
  const pts = Array.from({length: 8}, (_, i) => P(i));
  const ms = pts.map((p, i) => mark(() => p, `<b>${i + 1}</b><s></s>`, {cls: 'stitch'}));
  hint('وجّه الإبرة إلى النقطة المضيئة، واضغط حين تنطبق الحلقة على النقطة');
  let i = 0, good = 0, t0 = clock.t; const PER = 1.5;
  const stitchMat = new THREE.MeshStandardMaterial({color: 0x2047a8, roughness: 0.5});
  ms[0].el.classList.add('on');
  await frame((dt) => {
    const h = pick(H.pick); const tgt = h ? h.point : onPlane(pts[i].y); if (tgt) TL.tip.lerp(tgt, 0.55);
    TL.contact = damp(TL.contact, ptr.down ? 1 : 0.3, 12, dt);
    T_left(worldOf(c).add(V3(-0.012, 0.006, -0.01)));
    const ph = ((clock.t - t0) % PER) / PER, s = 2.4 - 1.8 * ph;
    ms[i].el.style.setProperty('--s', s.toFixed(3));
    if (ptr.pressed) {
      const okPos = Math.hypot(ms[i].sx - ptr.x, ms[i].sy - ptr.y) < 18, okT = Math.abs(s - 1) < 0.28;
      const ok = okPos && okT; if (ok) good++;
      ms[i].el.classList.remove('on'); ms[i].el.classList.add(ok ? 'ok' : 'bad');
      // the stitch: a small loop of blue 7-0 from the graft edge to the point
      const q = pts[i], o = worldOf(c).add(V3(0, 0.004, 0));
      const loop = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([o, o.clone().lerp(q, 0.5).add(V3(0, 0.003, 0)), q]), 8, 0.00025, 4, false), stitchMat); OR.root.add(loop); A.stitches.push(loop);
      snip(); i++; t0 = clock.t;
      if (i >= 8) return true;
      ms[i].el.classList.add('on');
    }
  });
  await wait(0.6); ms.forEach(m => m.remove()); hint('');
  A.leaks = 8 - good;
  award('suture', good);
  await say('pl_tie'); snip();
  A.grafts.LAD = addGraft('LAD', 'lima'); A.stitches.forEach(s => s.visible = false);
  leftHold(null); putDown(); if (HANDS.rig) HANDS.rig.group.visible = HANDS.fp !== false; else if (HANDS.arms) HANDS.arms.visible = HANDS.fp !== false;
  return good;
}
function T_left(p) { TL.leftTip.lerp(p, 0.4); TL.leftDir.set(-0.3, 0.75, 0.55).normalize(); }

// ---------------------------------------------------------------- scene 10: ventricular fibrillation
export async function actDefib() {
  let pts = 8; const t0 = clock.t;
  // what to do: three orders
  for (;;) {
    const o = await orders([{id: 'paddles', line: 'pl_paddles'}, {id: 'pads', line: 'pl_pads'}, {id: 'wait', line: 'pl_wait'}]);
    await say('pl_' + o);
    if (o === 'paddles') break;
    if (o === 'pads') { pts -= 3; await say('ra_open'); }
    if (o === 'wait') { pts -= 3; await wait(3.5); await say('ly_wait'); }
  }
  if (clock.t - t0 > 25) pts -= 1;              // long hesitation in VF costs the heart
  say('ra_paddles');
  // place the two paddles either side of the ventricles
  objective('ضع المجدافين على جانبي القلب');
  hint('اضغط على الدائرة الأولى ثم الثانية');
  const sideA = () => paddleSpot('A'), sideB = () => paddleSpot('B');
  const outA = () => paddleSpot('A', 0.03).sub(paddleSpot('A', 0)).normalize(), outB = () => paddleSpot('B', 0.03).sub(paddleSpot('B', 0)).normalize();
  const mA = mark(sideA, '<i></i>', {cls: 'pad'}), mB = mark(sideB, '<i></i>', {cls: 'pad hidden'});
  take('paddles', {fly: false}); TL.hide = true;
  let step = 0;
  await frame((dt) => {
    const q = onPlane(CHEST.y - 0.02); if (q && step === 0) { T_left(q); }
    if (step === 0) { TL.leftDir.copy(outA().add(UP.clone().multiplyScalar(1.4)).normalize()); leftHold('paddleL'); }
    if (step === 1 && q) { TL.hide = false; TL.tip.lerp(q, 0.5); TL.dir.copy(outB().add(UP.clone().multiplyScalar(1.4)).normalize()); }
    if (ptr.pressed && step === 0 && Math.hypot(mA.sx - ptr.x, mA.sy - ptr.y) < 40) { step = 1; mA.remove(); mB.set(true); TL.leftTip.copy(sideA()); clickSnd(); }
    else if (ptr.pressed && step === 1 && Math.hypot(mB.sx - ptr.x, mB.sy - ptr.y) < 40) { mB.remove(); TL.tip.copy(sideB()); TL.contact = 1; clickSnd(); return true; }
    if (step === 1) TL.leftTip.copy(sideA());
  });
  const hold = onUpdate(() => { TL.leftTip.copy(sideA()); TL.tip.copy(sideB()); TL.contact = 1; });
  hint('');
  // energy, then shock
  for (;;) {
    objective('اختر الطاقة، ثم «ابتعدوا! صدمة!»');
    const J = await new Promise(res => {
      panel(`<div class="joules">${[5, 10, 20, 50, 200].map(j => `<button data-j="${j}">${j} J</button>`).join('')}</div><p class="note">المجاديف الداخلية على القلب مباشرة</p>`, {title: 'مزيل الرجفان — الطاقة'});
      document.querySelectorAll('.joules button').forEach(b => b.onclick = () => res(+b.dataset.j));
    });
    panelHide();
    if (J >= 200) { pts -= 3; await say('ly_200'); continue; }
    await orders([{id: 'clear', line: 'pl_clear', want: true}]);
    say('pl_clear'); charge(); await wait(1.5); shock();
    H.body.scale.multiplyScalar(1.06); TL.contact = 0;
    if (J <= 5) { pts -= 1; await wait(0.8); await say('ly_vf_again'); continue; }
    if (J === 50) pts -= 2;
    break;
  }
  hold(); leftHold(null); putDown();
  award('vf', pts);
  return pts;
}

// ---------------------------------------------------------------- scene 11: graft flow
const READ = {LAD: () => A.leaks >= 3 ? [31, 2.6, 'تسرب صغير'] : [38, 1.9, ''], OM: () => [52, 2.1, ''], PDA: () => A.pdaFixed ? [42, 2.0, ''] : [9, 5.8, 'ملتوٍ']};
const MARK_K = {LAD: 0.84, OM: 0.5, PDA: 0.62};          // where along each graft its probe marker sits (kept apart on screen)
function graftMid(name, k = MARK_K[name] ?? 0.62) { const m = H.grafts[name]; const p = m.geometry.parameters.path.getPointAt(k).clone(); return m.parent.localToWorld(p); }
function drawFlow(cv, q, pi) {
  const g = cv.getContext('2d'), W = cv.width, Hh = cv.height; g.fillStyle = '#020506'; g.fillRect(0, 0, W, Hh);
  g.strokeStyle = '#1d2b30'; g.beginPath(); g.moveTo(0, Hh * 0.75); g.lineTo(W, Hh * 0.75); g.stroke();
  g.strokeStyle = q < 15 ? '#ff7b6b' : '#5ad1ff'; g.lineWidth = 2; g.beginPath();
  for (let x = 0; x < W; x++) { const ph = (x / W * 3 + clock.t * 1.3) % 1; const dia = ph > 0.35 ? Math.sin((ph - 0.35) / 0.65 * Math.PI) : -0.25 * Math.sin(ph / 0.35 * Math.PI); const amp = q / 60 * (pi > 4 ? (ph > 0.35 ? 0.3 : 2.4) : 1); const y = Hh * 0.75 - dia * amp * Hh * 0.55; x ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke();
}
export async function actFlowProbe(names = ['LAD', 'OM', 'PDA'], {need = null} = {}) {
  objective(need ? 'أعد القياس على الطُّعم الذي عدّلته' : 'قِس تدفق كل طُعم بالمسبار');
  say('ra_flow');
  await pickTool(['flow', 'needle', 'suction'], 'flow'); trayHide();
  panel('<canvas id="flcv" width="280" height="110"></canvas><div id="flrows"></div>', {title: 'قياس تدفق الطُّعم (TTFM)'});
  const done = {}, rows = document.getElementById('flrows'), cv = document.getElementById('flcv');
  const render = () => { rows.innerHTML = Object.keys(done).map(n => { const [q, pi, note] = done[n]; const bad = q < 15 || pi > 5; return `<div class="row ${bad ? 'bad' : 'ok'}"><span>${n}${note ? ' · ' + note : ''}</span><b>${q} مل/د · PI ${pi.toFixed(1)}</b></div>`; }).join(''); };
  let busy = null, cur = null;
  const ms = names.map(n => mark(() => graftMid(n), `<i></i><span>${n}</span>`, {cls: 'graft', onClick: () => { if (!busy) busy = {n, t: 0}; }}));
  hint('اضغط على كل طُعم لتضع المسبار عليه');
  await frame((dt) => {
    if (busy) { TL.tip.lerp(graftMid(busy.n).add(V3(0, -0.002, 0)), 0.3); TL.contact = 1; busy.t += dt; if (busy.t > 1.3) { done[busy.n] = READ[busy.n](); cur = busy.n; render(); busy = null; clickSnd(); } }
    else { const q = onPlane(CHEST.y - 0.02); if (q) TL.tip.lerp(q, 0.4); TL.contact = 0; }
    if (cur) { const [q, pi] = done[cur]; drawFlow(cv, q, pi); }
    if (need ? done[need] : names.every(n => done[n])) return true;
  });
  await wait(1.4);
  ms.forEach(m => m.remove()); hint(''); putDown(); panelHide();
  return done;
}
export async function actFixGraft() {
  objective('عدّل الطُّعم: اسحب الجزء الملتوي لتقصيره');
  hint('اضغط على موضع الالتواء واسحب');
  const kink = () => graftMid('PDA', 0.5);
  const m = mark(kink, '<i></i><span>التواء</span>', {cls: 'graft bad'});
  take('needle', {fly: false}); leftHold('forceps');
  let start = null;
  await frame((dt) => {
    const q = onPlane(CHEST.y - 0.01); if (q) TL.tip.lerp(start ? q : (pxDist(kink()) < 50 ? kink() : q), 0.45);
    T_left(kink().add(V3(-0.015, 0.004, 0)));
    if (ptr.pressed && pxDist(kink()) < 50) start = {x: ptr.x, y: ptr.y};
    if (start && ptr.down && Math.hypot(ptr.x - start.x, ptr.y - start.y) > 60) return true;
    if (ptr.released) start = null;
  });
  m.remove(); hint(''); leftHold(null); putDown();
  await caption('بعد اثنتي عشرة دقيقة: قُصّر الطُّعم الوريدي وأُعيدت المفاغرة على الخلفي النازل', 2400);
  A.grafts.PDA = addGraft('PDA', 'svg', false); A.pdaFixed = true;
}

// ---------------------------------------------------------------- scene 12: bleeding — suction, find the source, stitch
export async function actBleeding() {
  objective('المجال يمتلئ بالدم: نظّفه بالشفّاط وابحث عن المصدر');
  const src = aortaTop(A.site).add(V3(0, -0.002, 0));
  const jet = new THREE.Group(); OR.root.add(jet); jet.position.copy(src);
  const jm = new THREE.MeshPhysicalMaterial({color: 0x9a0b10, roughness: 0.1, clearcoat: 1});
  const blob = new THREE.Mesh(new THREE.SphereGeometry(0.0026, 12, 8), jm); jet.add(blob);
  const drops = Array.from({length: 6}, () => { const d = new THREE.Mesh(new THREE.SphereGeometry(0.0011, 6, 4), jm); d.userData = {t: Math.random()}; jet.add(d); return d; });
  let fixed = false, ph = 0;
  const jetUpd = onUpdate((dt) => {
    if (fixed) { jet.visible = false; return; }
    ph = (ph + dt * vit.hr / 60) % 1; const pulse = Math.max(0, Math.sin(ph * Math.PI * 2));
    blob.scale.setScalar(0.7 + pulse * 0.8);
    for (const d of drops) { d.userData.t += dt * 1.6; const t = d.userData.t % 1; d.position.set(Math.sin(d.id) * 0.004 * t, 0.012 * Math.sin(t * Math.PI) * (0.4 + pulse), Math.cos(d.id) * 0.004 * t); }
    F.blood = Math.min(0.95, F.blood + dt * 0.03);
    jet.visible = F.blood < 0.4;
  });
  F.blood = 0.15;
  say('ra_drain');
  await new Promise(r => { const off = onUpdate(dt => { F.blood = Math.min(0.85, F.blood + dt * 0.12); if (F.blood >= 0.85) { off(); r(); } }); });
  say('ra_suction');
  let tool = await tray(['suction', 'needle', 'cautery'], 'suction'); take(tool);
  const snd = toolSound('suction'); let hintT = clock.t;
  const pickRow = () => tray(['suction', 'needle', 'cautery']).then(id => { take(id); tool = id; pickRow(); });
  pickRow();
  hint('اضغط مع الاستمرار بالشفّاط داخل الصدر');
  await frame((dt) => {
    const q = onPlane(CHEST.y - 0.03); if (!q) return;
    TL.tip.lerp(q, 0.5); TL.contact = damp(TL.contact, ptr.down ? 1 : 0, 12, dt);
    TL.steady = CHEST.clone().add(V3(-0.25, 0.03, 0.18));
    const inside = Math.abs(q.x - CHEST.x) < 0.09 && Math.abs(q.z) < 0.07;
    if (tool === 'suction') {
      const on = ptr.down && inside; snd.set(on ? 1 : ptr.down ? 0.4 : 0);
      if (on) F.blood = Math.max(0.05, F.blood - dt * 0.26);
      if (TL.mesh && TL.mesh.userData.blood) TL.mesh.userData.blood.visible = on && F.blood > 0.08;
    } else snd.set(0);
    if (tool === 'needle' && ptr.pressed) {
      if (jet.visible && pxDist(src) < 45) { fixed = true; snip(); return true; }
      toast(F.blood >= 0.4 ? 'لا ترى شيئًا: نظّف المجال أولًا' : 'لا نزف هنا');
    }
    if (clock.t - hintT > 30 && F.blood < 0.4) { hintT = clock.t; hint('ابحث عن نقطة تنبض بالدم، ثم خذ حامل الإبرة وضع غرزة عليها'); }
  });
  snd.set(0); setTimeout(() => snd.stop(), 300); trayHide(); jetUpd(); OR.root.remove(jet);
  await say('pl_site');
  hint(''); putDown();
  return true;
}

// ---------------------------------------------------------------- scene 13: the missing sponge
export async function actSearch() {
  objective('ابحث عن قطعة الشاش المفقودة');
  const spots = [
    {id: 'right', t: 'الحيز الجنبي الأيمن', p: () => CHEST.clone().add(V3(0.0, -0.03, 0.075))},
    {id: 'left', t: 'الحيز الجنبي الأيسر — خلف القلب', p: () => CHEST.clone().add(V3(0.035, -0.03, -0.08))},
    {id: 'peri', t: 'كيس التامور أمام القلب', p: () => CHEST.clone().add(V3(-0.06, -0.02, 0.0))},
    {id: 'drapes', t: 'تحت الأغطية', p: () => CHEST.clone().add(V3(0.17, 0.01, -0.1))},
  ];
  let misses = 0, xray = false, found = false;
  const gauzeMesh = TL.gauze;
  gauzeMesh.position.copy(CHEST).add(V3(0.05, -0.068, -0.038)); gauzeMesh.rotation.set(-Math.PI / 2 + 0.35, 0, 0.5); gauzeMesh.visible = true; gauzeMesh.material.color.setRGB(0.92, 0.9, 0.86);
  let so = null;
  const result = await new Promise(res => {
    const ms = spots.map(s => mark(s.p, `<i></i><span>${s.t}</span>`, {cls: 'search', onClick: () => onSpot(s)}));
    const onSpot = async (s) => {
      if (s.id === 'left') {
        ms.forEach(m => m.remove()); if (so) so.clear();
        H.lift = 1; await wait(1.4);
        const gm = mark(() => gauzeMesh.getWorldPosition(V3()).add(V3(0, 0.01, 0)), '<i></i><span>قطعة شاش</span>', {cls: 'search gauze', onClick: async () => { gm.remove(); res(true); }});
        hint('هناك! اضغط على قطعة الشاش لإخراجها');
        return;
      }
      misses++; toast(`${s.t}: لا شيء`);
      ms[spots.indexOf(s)].el.classList.add('done');
      if (misses >= 2 && !so) so = standingOrders([{id: 'xray', line: 'pl_xray'}], async () => { so.clear(); xray = true; await say('pl_xray'); await caption('صورة الأشعة في الغرفة: علامة معدنية خلف القلب، في الجهة اليسرى', 2600); ms[1].el.classList.add('glow'); });
    };
  });
  hint('');
  // lift it out
  const p0 = gauzeMesh.position.clone();
  await new Promise(r => { let t = 0; const off = onUpdate(dt => { t += dt / 0.9; gauzeMesh.position.lerpVectors(p0, CHEST.clone().add(V3(0.1, 0.18, 0.12)), Math.min(1, t)); if (t >= 1) { off(); r(); } }); });
  gauzeMesh.visible = false; H.lift = 0;
  award('count', xray ? 6 : misses <= 2 ? 8 : 7);
  return {misses, xray};
}

// ---------------------------------------------------------------- scene 14: sternal wires
export async function actWires() {
  objective('أغلق القص: لفّ كل سلك');
  say('ra_wires');
  F.retractor.visible = false; setOpen(0); F.pericardium = 1;
  await pickTool(['wire', 'needle', 'suction'], 'wire'); trayHide();
  const xs = [0, 1, 2, 3].map(i => NOTCH.x + 0.03 + i * (XIPH.x - NOTCH.x - 0.05) / 3);
  const wm = new THREE.MeshStandardMaterial({color: 0xd5dadd, roughness: 0.2, metalness: 1});
  const wires = xs.map(x => { const w = new THREE.Group(); w.position.set(x, CHEST.y + 0.002, 0); OR.root.add(w); const loop = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.0007, 6, 24, Math.PI), wm); loop.rotation.set(0, Math.PI / 2, 0); loop.scale.set(1, 0.4, 1); w.add(loop); const tw = new THREE.Mesh(new THREE.CylinderGeometry(0.0011, 0.0011, 0.001, 6), wm); tw.position.y = 0.004; w.add(tw); w.userData.tw = tw; return w; });
  hint('اضغط على كل سلك وأدِر بحركة دائرية');
  for (const w of wires) {
    const m = mark(() => w.position.clone().add(V3(0, 0.005, 0)), '<i></i>', {cls: 'crank'});
    let turns = 0, lastA = null;
    await frame((dt) => {
      const c = scr(w.position); TL.tip.lerp(w.position.clone().add(V3(0, 0.005, 0)), 0.4); TL.contact = 1;
      if (ptr.down) { const a = Math.atan2(ptr.y - c.y, ptr.x - c.x); if (lastA !== null) { let d = a - lastA; d = Math.atan2(Math.sin(d), Math.cos(d)); turns += Math.abs(d) / (Math.PI * 2); w.userData.tw.scale.y = 1 + turns * 9; w.userData.tw.position.y = 0.004 + turns * 0.0045; } lastA = a; } else lastA = null;
      if (turns >= 1.5) return true;
    });
    m.remove(); clickSnd();
  }
  hint(''); putDown();
  return wires;
}
export {frame, toast};
