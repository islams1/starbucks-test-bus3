// The controls the captain actually works with his hands, as A320 panels on the cockpit's own surfaces: the APU and the
// DITCHING / EVAC buttons on the overhead panel, the ENG MASTER levers, ENG MODE selector, thrust levers, flaps lever and
// the radio / PA keys on the pedestal, the MASTER WARNING light on the glareshield, and the sidestick on the left console.
// Lit pushbuttons change state like the real ones (ON / FAULT / AVAIL). Click (or tap) to operate; hovering shows what
// a control is, in Arabic. Each control reports to flow.js through CTL.on(id, state).
import * as THREE from 'three';
import {camera, onUpdate} from '../core/engine.js';
import {CK, lookTo} from './cockpit.js';
import {AC} from './aircraft.js';
import {STICK} from './fly.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const D2R = Math.PI / 180;
export const CTL = {items: {}, handlers: [], hover: null, enabled: true};
export function onControl(fn) { CTL.handlers.push(fn); }
const emit = (id, st) => { for (const f of CTL.handlers) f(id, st); };

function label(text, w = 256, h = 64, opt = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = opt.bg || 'rgba(0,0,0,0)'; g.fillRect(0, 0, w, h);
  g.fillStyle = opt.color || '#f2f5f7'; g.font = `${opt.weight || 700} ${opt.size || 22}px Inter, Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
  String(text).split('\n').forEach((l, i, a) => g.fillText(l, w / 2, h / 2 + (i - (a.length - 1) / 2) * (opt.size || 22) * 1.15));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
/** a flat legend (white, engraved and back-lit like Airbus panel lettering) of w × h metres */
const legendMat = (map, color = 0xffffff) => new THREE.MeshBasicMaterial({map, color, alphaTest: 0.3, alphaToCoverage: true, toneMapped: false});
const textPlane = (text, w, h, opt = {}) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), legendMat(label(text, Math.max(64, Math.round(w / h * 64) * 2), 128, {size: opt.size || 64, color: opt.color, weight: opt.weight})));
// Airbus panels are a light blue-grey
const panelMat = () => new THREE.MeshStandardMaterial({color: 0x4f5c68, roughness: 0.88, metalness: 0.02, envMapIntensity: 0.15});
const darkMat = (c = 0x1b1f23, r = 0.6) => new THREE.MeshStandardMaterial({color: c, roughness: r, metalness: 0.1, envMapIntensity: 0.15});
/** an Airbus lit pushbutton: a square cap with two legends (upper: ON/AVAIL…, lower: FAULT/OFF…); unlit legends stay faint */
function pushbutton(id, title, up, low, upColor = '#2fb3ff', lowColor = '#ffb21e', S = 0.03) {
  const G = new THREE.Group(); G.userData = {id, title};
  const frame = new THREE.Mesh(new THREE.BoxGeometry(S * 1.18, S * 1.18, 0.004), darkMat(0x2b3036, 0.6)); frame.position.z = 0.002; G.add(frame);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(S, S, 0.012), new THREE.MeshStandardMaterial({color: 0x15181b, roughness: 0.6, envMapIntensity: 0.12, emissive: 0x000000}));
  cap.position.z = 0.008; G.add(cap);
  const face = (t, c, y) => { if (!t) return null; const m = new THREE.Mesh(new THREE.PlaneGeometry(S * 0.86, S * 0.36), legendMat(label(t, 160, 64, {color: c, size: 44}), 0x3a3a3a)); m.position.set(0, y, 0.0145); G.add(m); return m; };
  G.userData.up = face(up, upColor, S * 0.2); G.userData.low = face(low, lowColor, -S * 0.2);
  G.userData.cap = cap;
  if (title) { const t = textPlane(title, S * 2.6, S * 0.42); t.position.set(0, S * 0.92, 0.001); G.add(t); }
  // lit legends glow (and bloom a little); unlit ones are dim engraved letters, as on the real cap
  G.userData.set = (u, l) => { if (G.userData.up) G.userData.up.material.color.setScalar(u ? 1.6 : 0.23); if (G.userData.low) G.userData.low.material.color.setScalar(l ? 1.6 : 0.23); };
  return G;
}
/** a lever that moves along a slot (local +y = first position): thrust levers (two handles), flaps, engine masters */
function lever(id, title, positions, h = 0.05, opt = {}) {
  const G = new THREE.Group(); G.userData = {id, title, positions, idx: 0};
  const n = opt.handles || 1, gap = opt.gap || 0.04, hw = opt.headW || 0.03, stemL = opt.stem || 0.04, hh = opt.headH || 0.016, hd = opt.headD || 0.022;
  for (let k = 0; k < n; k++) { const slot = new THREE.Mesh(new THREE.BoxGeometry(0.01, h + 0.02, 0.004), darkMat(0x0d0f11, 0.7)); slot.position.set((k - (n - 1) / 2) * gap, 0, 0.002); G.add(slot); }
  const knob = new THREE.Group(); G.add(knob);
  for (let k = 0; k < n; k++) {
    const x = (k - (n - 1) / 2) * gap;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.005, stemL, 10), new THREE.MeshStandardMaterial({color: 0xa7adb2, metalness: 0.7, roughness: 0.3}));
    stem.rotation.x = Math.PI / 2; stem.position.set(x, 0, stemL / 2); knob.add(stem);
    const head = new THREE.Mesh(new THREE.BoxGeometry(hw, hh, hd), darkMat(opt.headColor || 0x23282d, 0.45)); head.position.set(x, 0, stemL + 0.008); knob.add(head);
    if (k === 0) G.userData.cap = head;
    if (opt.headLabel) { const hl = textPlane(opt.headLabel[k] || '', hw * 0.5, hh * 0.7, {color: '#e8edf0'}); hl.position.set(x, 0, stemL + 0.008 + hd / 2 + 0.0005); knob.add(hl); }
  }
  G.userData.knob = knob; G.userData.h = h;
  const lx = (n - 1) / 2 * gap + 0.012 + (opt.labelW || 0.034) / 2;
  positions.forEach((p, i) => { const l = textPlane(p, opt.labelW || 0.034, 0.011); l.position.set(lx, h / 2 - (h * i) / Math.max(1, positions.length - 1), 0.001); G.add(l); });
  const t = textPlane(title, Math.max(0.05, title.length * 0.0065), 0.013); t.position.set(0, h / 2 + 0.022, 0.001); G.add(t);
  G.userData.setIdx = (i) => { G.userData.idx = i; knob.position.y = h / 2 - (h * i) / Math.max(1, positions.length - 1); };
  G.userData.setIdx(0);
  return G;
}
/** a rotary selector (ENG MODE): the pointer turns to CRANK / NORM / IGN START */
function rotary(id, title, positions) {
  const G = new THREE.Group(); G.userData = {id, title, positions, idx: 0};
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.019, 0.006, 24), darkMat(0x2b3036)); base.rotation.x = Math.PI / 2; base.position.z = 0.003; G.add(base);
  const knob = new THREE.Group(); knob.position.z = 0.006; G.add(knob);
  const k = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.013, 0.016, 20), new THREE.MeshStandardMaterial({color: 0x1a1d20, roughness: 0.4, emissive: 0x000000})); k.rotation.x = Math.PI / 2; k.position.z = 0.008; knob.add(k);
  const ptr = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.022, 0.017), new THREE.MeshStandardMaterial({color: 0xf0f0f0, emissive: 0x888888})); ptr.position.set(0, 0.006, 0.009); knob.add(ptr);
  const ang = positions.map((_, i) => (1 - i) * 0.8);          // first position to the left, last to the right
  positions.forEach((p, i) => { const l = textPlane(p, 0.036, 0.009); l.position.set(-Math.sin(ang[i]) * 0.036, Math.cos(ang[i]) * 0.03, 0.001); G.add(l); });
  const t = textPlane(title, 0.06, 0.012); t.position.set(0, -0.03, 0.001); G.add(t);
  G.userData.knob = knob; G.userData.cap = k;
  G.userData.setIdx = (i) => { G.userData.idx = i; knob.rotation.z = ang[i]; };
  G.userData.setIdx(0);
  return G;
}
/** a panel module at a known place in the cockpit (metres from the captain's eye: +x left, +y up, +z forward), laid out
 *  in its own plane: xAxis = the direction the legends read along, yAxis = "up" on the legends; its face points to the eye */
function module(center, xAxis, yAxis, w, h, mat = panelMat()) {
  const x = xAxis.clone().normalize(), y = yAxis.clone().normalize(), z = new THREE.Vector3().crossVectors(x, y).normalize();
  const P = new THREE.Group(); P.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)); P.position.copy(center);
  const base = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.01), mat); base.position.z = -0.005; base.receiveShadow = true; P.add(base);
  const bz = new THREE.Mesh(new THREE.BoxGeometry(w + 0.008, h + 0.008, 0.008), darkMat(0x22272c, 0.7)); bz.position.z = -0.008; P.add(bz);   // a thin dark bezel
  CK.group.add(P);
  return P;
}
export function buildControls() {
  // The flight deck model is a real A320 deck: its own thrust levers, engine master switches, engine mode selector and
  // flaps lever are separate parts, so they are made to move (each is wrapped in a pivot in the cockpit frame: metres
  // from the captain's eye, +x left, +y up, +z forward). The lit pushbuttons (APU, DITCHING, EVAC, MASTER WARN/CAUT,
  // the radio and PA keys) are laid flush on the real panels at their places, so their legends can light up.
  CK.group.updateMatrixWorld(true);
  const inv = CK.group.matrixWorld.clone().invert();
  const part = (name) => { let m = null; CK.model.traverse(o => { if (!m && o.isMesh && o.name === name) m = o; }); return m; };
  const local = (o) => new THREE.Box3().setFromObject(o).applyMatrix4(inv);
  function movable(id, title, names, positions, start, pivotOf, pose) {
    const meshes = names.map(part).filter(Boolean); if (!meshes.length) { console.warn('[controls] missing part', id, names); return null; }
    const box = new THREE.Box3(); meshes.forEach(m => box.union(local(m)));
    const pv = new THREE.Group(); pv.position.copy(pivotOf(box)); CK.group.add(pv); pv.updateMatrixWorld(true);
    meshes.forEach(m => pv.attach(m));
    const size = box.getSize(V()), c = box.getCenter(V()).sub(pv.position);
    const cap = new THREE.Object3D(); cap.position.copy(c); pv.add(cap);
    // a generous invisible box to click (the real parts are small)
    const hb = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.04, size.x * 1.25), Math.max(0.04, size.y * 1.25), Math.max(0.04, size.z * 1.25)), new THREE.MeshBasicMaterial({visible: false}));
    hb.position.copy(c); pv.add(hb);
    pv.userData = {id, title, positions, idx: start, cap, ringR: Math.max(0.03, Math.max(size.x, size.z) * 0.6)};
    pv.userData.setIdx = (i) => { pv.userData.idx = i; pose(pv, i); };
    CTL.items[id] = pv;
    return pv;
  }
  const X = V(1, 0, 0), D2 = D2R;
  const pedN = V(0, 0.92, -0.38).normalize(), pedFwd = V(0, 0.38, 0.92).normalize();
  // thrust levers (both, one part): rotate fore/aft about their quadrant; the model is at CL
  const thrA = [18, 12, 0, -24];
  movable('thrust', 'THRUST LEVERS', ['Object_53'], ['TOGA', 'FLX', 'CL', 'IDLE'], 2,
    (b) => V((b.min.x + b.max.x) / 2, b.min.y, (b.min.z + b.max.z) / 2), (pv, i) => pv.quaternion.setFromAxisAngle(X, thrA[i] * D2));
  // engine master switches: ON (as modelled) / OFF (lifted over the detent and down: tilted aft)
  for (const [id, name] of [['eng1', 'Object_54_1'], ['eng2', 'Object_45']])
    movable(id, id === 'eng1' ? 'ENG 1 MASTER' : 'ENG 2 MASTER', [name], ['ON', 'OFF'], 0,
      (b) => V((b.min.x + b.max.x) / 2, b.min.y, (b.min.z + b.max.z) / 2), (pv, i) => { pv.quaternion.setFromAxisAngle(X, i ? -38 * D2 : 0); });
  // engine mode selector: CRANK / NORM / IGN START, turning about the pedestal's normal
  const modeA = [50, 0, -50];
  movable('engmode', 'ENG MODE', ['Object_32_1'], ['CRANK', 'NORM', 'IGN/START'], 1,
    (b) => b.getCenter(V()), (pv, i) => pv.quaternion.setFromAxisAngle(pedN, modeA[i] * D2));
  // flaps lever (and its knob): slides aft along its gate, 0 → FULL
  movable('flaps', 'FLAPS', ['Object_18', 'Object_51'], ['0', '1', '2', '3', 'FULL'], 0,
    (b) => b.getCenter(V()), (pv, i) => { pv.position.copy(pv.userData.home || (pv.userData.home = pv.position.clone())).addScaledVector(pedFwd, -0.021 * i); });
  // ---- lit pushbuttons on the real panels
  const onSurface = (G, p, n, size = 1) => {
    const z = n.clone().normalize(), x = V(-1, 0, 0).addScaledVector(z, z.x).normalize(), y = new THREE.Vector3().crossVectors(z, x).normalize();
    G.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)); G.position.copy(p).addScaledVector(z, 0.0015);
    G.scale.setScalar(size); CK.group.add(G); CTL.items[G.userData.id] = G; return G;
  };
  const ovN = V(0, -0.93, -0.37);
  // the APU panel and CABIN PRESS (DITCHING) on the forward overhead; EVAC COMMAND on its real red-guarded button
  onSurface(pushbutton('apu_master', 'APU MASTER SW', 'ON', 'FAULT', undefined, undefined, 0.028), V(-0.458, 0.2265, 0.3285), ovN);
  onSurface(pushbutton('apu_start', 'APU START', 'ON', 'AVAIL', '#2fb3ff', '#3dff7a', 0.028), V(-0.503, 0.2265, 0.3285), ovN);
  // one target for the two APU switches (4.5 cm apart: their two rings overlapped and a click was easily lost): a click
  // anywhere in its one big ring presses MASTER SW, then START (flow.js)
  { const apu = new THREE.Group(); apu.userData = {id: 'apu', title: 'APU', ringR: 0.072}; onSurface(apu, V(-0.4805, 0.2265, 0.3285), ovN); }
  onSurface(pushbutton('ditching', 'DITCHING', 'ON', '', '#f2f2f2', undefined, 0.028), V(-0.61, 0.2265, 0.3285), ovN);
  onSurface(pushbutton('evac', 'EVAC COMMAND', 'EVAC', 'ON', '#ff3b30', '#ffffff', 0.026), V(-0.27, 0.236, 0.252), V(-0.12, -0.92, -0.36));
  // the glareshield in front of the captain: MASTER WARN over MASTER CAUT
  const gsN = V(0, 0.28, -0.96);
  onSurface(pushbutton('mwarn', null, 'MASTER', 'WARN', '#ff3b30', '#ff3b30', 0.02), V(-0.137, -0.273, 0.738), gsN);
  { const c = pushbutton('mcaut', null, 'MASTER', 'CAUT', '#ffb21e', '#ffb21e', 0.02); onSurface(c, V(-0.138, -0.296, 0.732), gsN); delete CTL.items.mcaut; }
  // the captain's audio control panel on the pedestal: the VHF1 transmit key and the PA key
  const acpN = V(0, 0.99, -0.16);
  onSurface(pushbutton('vhf1', 'VHF1', 'MIC', 'CALL', '#3dff7a', '#ffb21e', 0.022), V(-0.337, -0.849, 0.557), acpN);
  onSurface(pushbutton('pa', 'PA', 'MIC', '', '#3dff7a', undefined, 0.022), V(-0.383, -0.854, 0.53), acpN);
  // the overhead flood light (the panels are lit from above, as in the real cockpit at day)
  const flood = new THREE.PointLight(0xfff1dc, 0.6, 0.9, 1.6); flood.position.set(-0.36, 0.12, 0.2); CK.group.add(flood);
  bindPointer(); sidestickWidget();
  // blinking master warning
  onUpdate(() => { const w = CTL.items.mwarn; if (w && CTL.warnOn) { const on = (performance.now() / 350 | 0) % 2 === 0; w.userData.set(on, on); } });
  return CTL;
}
/** tooltips in Arabic */
const TIPS = {
  apu: 'APU — click to start it (MASTER SW, then START)', apu_master: 'APU master switch — the first step to start it', apu_start: 'APU start — keeps electrical power and the flight-control protections',
  ditching: 'DITCHING — closes the openings in the fuselage', evac: 'EVAC — orders the evacuation, alerts the cabin',
  eng1: 'Engine 1 master (relight attempt: off, then on)', eng2: 'Engine 2 master', engmode: 'Engine mode selector — ignition',
  thrust: 'Thrust levers — click to pull back (Shift or right-click to push forward)', flaps: 'Flaps lever — click to extend (or F) · Shift to retract', vhf1: 'Talk to the controller on the radio', pa: 'Talk to the passengers', mwarn: 'Master warning — click to silence',
};
function bindPointer() {
  const el = document.getElementById('gl'), ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const pick = (e) => {
    const r = el.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const objs = Object.values(CTL.items);
    const eye = camera.getWorldPosition(new THREE.Vector3()), th = Math.tan(camera.fov * D2R / 2);
    const near = (c) => {                     // how close the click is to a control, in units of its clickable radius
      const P = (c.userData.cap || c).getWorldPosition(new THREE.Vector3()), v = P.clone().project(camera); if (v.z > 1) return Infinity;
      const d = Math.hypot((v.x + 1) / 2 * r.width + r.left - e.clientX, (1 - v.y) / 2 * r.height + r.top - e.clientY);
      const R = (c.userData.ringR || 0.03) * c.getWorldScale(new THREE.Vector3()).x, rpx = R / (eye.distanceTo(P) * th) * (r.height / 2);
      return d / (Math.max(34, rpx * 1.5) * (c.userData.ringFocus || c.userData.ringLearn ? 1.8 : 1));
    };
    // the control the game is asking for (its ring is showing) wins any click inside its ring, even over a neighbour
    for (const c of objs) if ((c.userData.ringFocus || c.userData.ringLearn) && near(c) < 1) return c;
    const hits = ray.intersectObjects(objs, true);
    if (hits.length) { let o = hits[0].object; while (o && !(o.userData && o.userData.id)) o = o.parent; if (o) return o; }
    // forgiving: a click near a control (scaled by its size on the screen) counts
    let best = null, bs = 1;
    for (const c of objs) { const k = near(c); if (k < bs) { bs = k; best = c; } }
    return best;
  };
  let tip = document.getElementById('ctltip');
  if (!tip) { tip = document.createElement('div'); tip.id = 'ctltip'; document.body.appendChild(tip); }
  el.addEventListener('pointerdown', (e) => {
    if (!CTL.enabled || !CK.on) return;
    const o = pick(e); if (!o) return;
    e.stopImmediatePropagation(); e.preventDefault();
    press(o, e.shiftKey || e.button === 2);
  }, {capture: true});
  el.addEventListener('contextmenu', (e) => { if (CTL.hover) e.preventDefault(); });
  el.addEventListener('pointermove', (e) => {
    const o = CK.on ? pick(e) : null;
    if (o !== CTL.hover) {
      const em = (o) => o && o.userData.cap && o.userData.cap.material && o.userData.cap.material.emissive;
      if (em(CTL.hover)) em(CTL.hover).setHex(0);
      CTL.hover = o;
      if (em(o)) em(o).setHex(0x223344);
    }
    el.style.cursor = o ? 'pointer' : '';
    if (o) { tip.textContent = TIPS[o.userData.id] || o.userData.title; tip.style.left = e.clientX + 14 + 'px'; tip.style.top = e.clientY + 14 + 'px'; tip.classList.add('on'); }
    else tip.classList.remove('on');
    clearTimeout(CTL.tipT); CTL.tipT = setTimeout(() => tip.classList.remove('on'), 2600);   // the head moves on: do not leave it behind
  });
}
function press(o, back = false) {
  const u = o.userData, id = u.id;
  if (u.ringFocus) hint(id, false, 'focus');
  if (u.positions) {                                // levers: step to the next position (thrust and flaps go down, masters toggle)
    let i = u.idx;                                  // shift-click or right-click moves a lever back
    if (id === 'eng1' || id === 'eng2') i = i ? 0 : 1;
    else if (id === 'engmode') i = i === 2 ? 1 : 2;
    else i = back ? Math.max(0, i - 1) : Math.min(u.positions.length - 1, i + 1);
    u.setIdx(i); emit(id, u.positions[i]); click(); return;
  }
  emit(id, 'press'); click();
}
/** turn the head toward a control and make it pulse for a few seconds (the side list: "where is it?") */
export function focus(id, ms = 3800) {
  if (id === 'stick') { const s = document.getElementById('stick'); if (s) { s.classList.add('flash'); setTimeout(() => s.classList.remove('flash'), ms); } return; }
  const b = CTL.items[id]; if (!b || !CK.on) return;
  CK.group.updateMatrixWorld(true); const p = CK.group.worldToLocal((b.userData.cap || b).getWorldPosition(V()));
  lookTo(Math.atan2(p.x, p.z), Math.atan2(p.y, Math.hypot(p.x, p.z)) * 0.9, ms);   // (then back to the windscreen)
  b.userData.focusOn = true; hint(id, true, 'focus');
  CK.fovT = 44; clearTimeout(CTL.zoomT); CTL.zoomT = setTimeout(() => { CK.fovT = null; }, ms);
  clearTimeout(b.userData.focusT); b.userData.focusT = setTimeout(() => hint(id, false, 'focus'), ms);
}
/** move a lever one step (keyboard): d = +1 down the gate (more flaps), −1 back */
export function nudge(id, d) {
  const o = CTL.items[id]; if (!o || !o.userData.positions) return;
  const u = o.userData, i = Math.max(0, Math.min(u.positions.length - 1, u.idx + d)); if (i === u.idx) return;
  u.setIdx(i); emit(id, u.positions[i]); click();
}
export function setButton(id, up, low) { const b = CTL.items[id]; if (b && b.userData.set) b.userData.set(up, low); }
export function setLever(id, i) { const b = CTL.items[id]; if (b && b.userData.setIdx) b.userData.setIdx(i); }
export function warn(on) { CTL.warnOn = on; if (!on) setButton('mwarn', false, false); }
function click() { try { const a = window.__clickSnd; a && a(); } catch (e) {} }
/** highlight a control (learning mode): it pulses until used */
/** the pulsing ring: on while learning mode asks for this control, or while the view is on it (focus) */
export function hint(id, on = true, src = 'learn') {
  const b = CTL.items[id]; if (!b) return;
  b.userData[src === 'focus' ? 'ringFocus' : 'ringLearn'] = on;
  on = !!(b.userData.ringFocus || b.userData.ringLearn);
  if (!b.userData.ring) {
    const R = b.userData.ringR || 0.029;
    const r = new THREE.Mesh(new THREE.RingGeometry(R * 0.85, R, 40), new THREE.MeshBasicMaterial({color: 0xffd23a, toneMapped: false, side: THREE.DoubleSide}));
    b.add(r); b.userData.ring = r; r.raycast = () => {};
    const cap = b.userData.cap;
    if (cap && !cap.material) {           // a part of the cockpit model: the ring floats just in front of it, facing the eye
      b.updateMatrixWorld(true); const eye = CK.group.localToWorld(V()), eyeL = b.worldToLocal(eye.clone());
      r.position.copy(cap.position).addScaledVector(eyeL.sub(cap.position).normalize(), 0.035); r.lookAt(eye);
    } else r.position.z = 0.03;
  }
  b.userData.ring.visible = on;
}
onUpdate(() => { if (!CK.on) { const t = document.getElementById('ctltip'); if (t) t.classList.remove('on'); } });
onUpdate(() => { const k = 0.35 + 1.4 * Math.abs(Math.sin(performance.now() / 300)); for (const b of Object.values(CTL.items)) if (b.userData.ring && b.userData.ring.visible) b.userData.ring.material.color.setRGB(k, k * 0.82, k * 0.23); });

// ---------------------------------------------------------------- on-screen sidestick (mouse / touch)
function sidestickWidget() {
  const w = document.createElement('div'); w.id = 'stick'; w.className = 'hidden';
  w.innerHTML = '<div class="ring"><i></i></div><span>Sidestick — drag · or arrows / WASD</span>';
  document.body.appendChild(w);
  const knob = w.querySelector('i'), ring = w.querySelector('.ring');
  let id = null;
  const set = (e) => { const r = ring.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width / 2;
    let x = (e.clientX - cx) / R, y = (e.clientY - cy) / R; const L = Math.hypot(x, y); if (L > 1) { x /= L; y /= L; }
    STICK.x = x; STICK.y = y; knob.style.transform = `translate(${x * R * 0.7}px, ${y * R * 0.7}px)`; };
  ring.addEventListener('pointerdown', (e) => { id = e.pointerId; ring.setPointerCapture(id); STICK.active = true; set(e); e.stopPropagation(); });
  ring.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(e); });
  const up = () => { id = null; STICK.active = false; STICK.x = 0; STICK.y = 0; knob.style.transform = ''; };
  ring.addEventListener('pointerup', up); ring.addEventListener('pointercancel', up);
}
export function showStick(on) { const s = document.getElementById('stick'); if (s) s.classList.toggle('hidden', !on); }
