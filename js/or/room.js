// The cardiac operating room: tiled walls, epoxy floor, laminar-flow ceiling, two surgical lights aimed at the chest,
// the table and drapes, the anaesthesia machine (bellows), the heart-lung machine (turning roller heads, blood lines),
// the wall monitor, two clocks (bypass / cross-clamp), the count board, the instrument trays.
import * as THREE from 'three';
import {scene, renderer, onUpdate} from '../core/engine.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {vit, attachScreen} from './monitor.js';
import {tex} from '../core/assets.js';
import {buildDrape} from './body.js';

export const OR = {};               // anchors and handles used by the other modules
export const CHEST = new THREE.Vector3(-0.45, 1.115, 0);     // centre of the operative field (sternum)
const std = (color, roughness = 0.6, extra = {}) => new THREE.MeshStandardMaterial({color, roughness, ...extra});
const add = (geo, mat, x, y, z, parent = OR.root, {cast = true, recv = true} = {}) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = recv; parent.add(m); return m; };
const boxM = (w, h, d, mat, x, y, z, parent, o) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, parent, o);
const cylM = (r1, r2, h, mat, x, y, z, parent, seg = 24, o) => add(new THREE.CylinderGeometry(r1, r2, h, seg), mat, x, y, z, parent, o);
function canvas(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
/** emissive canvas screen that can be redrawn: {draw(fn), mesh} */
export function screen(w, h, px, x, y, z, ry, parent = OR.root, intensity = 0.9) {
  const c = document.createElement('canvas'); c.width = px; c.height = Math.round(px * h / w);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g);
  boxM(w + 0.04, h + 0.04, 0.035, std(0x15181a, 0.4), 0, 0, -0.02, g);
  const m = add(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: intensity, roughness: 0.3, color: 0x000000}), 0, 0, 0.0, g, {cast: false});
  return {mesh: m, group: g, draw(fn) { fn(c.getContext('2d'), c.width, c.height); t.needsUpdate = true; }};
}

export function buildRoom() {
  OR.root = new THREE.Group(); scene.add(OR.root);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.background = new THREE.Color(0x0d1112);
  scene.fog = null;
  const W = 7.2, D = 6.4, H = 3.0;
  // floor: seamless sheet vinyl (light grey-green, fine speckle), real surface relief from a concrete scan
  const pbr = (id, rep, {srgb = true} = {}) => ({map: srgb ? tex(`assets/tex/${id}/diff.jpg`, {repeat: rep}) : null, normalMap: tex(`assets/tex/${id}/nor_gl.jpg`, {srgb: false, repeat: rep}), roughnessMap: tex(`assets/tex/${id}/rough.jpg`, {srgb: false, repeat: rep})});
  const floorT = canvas(512, 512, (g, w, h) => { g.fillStyle = '#93a39f'; g.fillRect(0, 0, w, h); for (let i = 0; i < 16000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '40,50,48'},${Math.random() * 0.09})`; g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); } });
  floorT.wrapS = floorT.wrapT = THREE.RepeatWrapping; floorT.repeat.set(6, 6);
  const fp = pbr('smooth_concrete_floor', [3, 3], {srgb: false});
  const floor = add(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({map: floorT, normalMap: fp.normalMap, normalScale: new THREE.Vector2(0.35, 0.35), roughnessMap: fp.roughnessMap, roughness: 0.55, envMapIntensity: 0.6}), 0, 0, 0, OR.root, {cast: false}); floor.rotation.x = -Math.PI / 2;
  // walls: glazed white ceramic tiles up to the ceiling, a stainless bumper rail, coved skirting
  const wallMat = (len) => { const m = pbr('long_white_tiles', [len / 1.0, H / 1.0]); return new THREE.MeshStandardMaterial({...m, color: 0xe6efec, roughness: 1, envMapIntensity: 0.55}); };
  const steelRail = std(0xc9cfd1, 0.3, {metalness: 0.8});
  for (const [w, x, z, ry] of [[W, 0, -D / 2, 0], [W, 0, D / 2, Math.PI], [D, -W / 2, 0, Math.PI / 2], [D, W / 2, 0, -Math.PI / 2]]) {
    const m = add(new THREE.PlaneGeometry(w, H), wallMat(w), x, H / 2, z, OR.root, {cast: false}); m.rotation.y = ry;
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; OR.root.add(g);
    boxM(w, 0.12, 0.03, steelRail, 0, 0.95, 0.015, g, {cast: false});                 // bumper rail
    boxM(w, 0.1, 0.02, std(0x7f908c, 0.6), 0, 0.05, 0.01, g, {cast: false});          // coved skirting
  }
  // ceiling with the laminar-flow canopy over the table
  const cp = pbr('white_plaster_02', [4, 4]);
  const ceil = add(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({...cp, color: 0xf2f4f3, roughness: 1}), 0, H, 0, OR.root, {cast: false}); ceil.rotation.x = Math.PI / 2;
  const perf = canvas(512, 512, (g, w, h) => { g.fillStyle = '#eef2f1'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(60,70,70,.55)'; for (let y = 4; y < h; y += 9) for (let x = (y / 9 % 2) * 4.5 + 4; x < w; x += 9) { g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill(); } g.strokeStyle = '#c3cbca'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6); });
  perf.wrapS = perf.wrapT = THREE.RepeatWrapping; perf.repeat.set(4, 3);
  add(new THREE.BoxGeometry(2.6, 0.04, 2.0), std(0xffffff, 0.6, {map: perf, emissive: 0xe8f0f0, emissiveIntensity: 0.12}), -0.3, H - 0.02, 0, OR.root, {cast: false});
  boxM(2.7, 0.1, 0.05, std(0xdfe4e3, 0.4, {metalness: 0.3}), -0.3, H - 0.05, 1.02, OR.root, {cast: false}); boxM(2.7, 0.1, 0.05, std(0xdfe4e3, 0.4, {metalness: 0.3}), -0.3, H - 0.05, -1.02, OR.root, {cast: false});
  for (const [x, z] of [[-2.6, -2.2], [2.4, -2.2], [-2.6, 2.2], [2.4, 2.2]]) add(new THREE.BoxGeometry(1.2, 0.03, 0.6), std(0xffffff, 0.4, {emissive: 0xf2f7ff, emissiveIntensity: 1.0}), x, H - 0.015, z, OR.root, {cast: false});
  // lights: soft room light + two surgical lights focused on the sternum
  scene.add(new THREE.HemisphereLight(0xeaf3f4, 0x55605c, 0.38));
  const amb = new THREE.PointLight(0xf2f6ff, 6, 9, 1.4); amb.position.set(0, 2.7, 0); scene.add(amb);
  OR.lights = [];
  for (const [x, y, z, inten, sh] of [[-0.62, 2.38, 0.18, 11, true], [-0.22, 2.32, -0.48, 7, false]]) {
    const head = new THREE.Group(); head.position.set(x, y, z); OR.root.add(head);
    const tgt = CHEST.clone().add(new THREE.Vector3(0, -0.02, 0));
    head.lookAt(tgt); head.rotateX(Math.PI / 2);
    cylM(0.33, 0.36, 0.11, std(0xdfe4e3, 0.35, {metalness: 0.3}), 0, 0, 0, head, 40).castShadow = false;     // the lamp's own housing must not shadow its beam
    add(new THREE.CircleGeometry(0.29, 40), std(0xffffff, 0.2, {emissive: 0xfffbf0, emissiveIntensity: 2.4}), 0, -0.058, 0, head, {cast: false}).rotation.x = Math.PI / 2;
    cylM(0.025, 0.025, Math.max(0.1, 3.0 - y), std(0xc8cecd, 0.4, {metalness: 0.6}), 0, 0.06 + (3.0 - y) / 2, 0, head, 10).castShadow = false;
    const sp = new THREE.SpotLight(0xfff7ea, inten * 1.25, 4, 0.3, 0.6, 1.2);       // a tight bright pool on the wound, the room falls off around it
    sp.position.set(x, y - 0.06, z); sp.target.position.copy(tgt); scene.add(sp, sp.target);
    if (sh) { sp.castShadow = true; sp.shadow.mapSize.set(2048, 2048); sp.shadow.bias = -0.0004; sp.shadow.normalBias = 0.01; sp.shadow.camera.near = 0.3; sp.shadow.camera.far = 3.5; }
    OR.lights.push({head, sp});
  }

  // ---- the table, the patient's body under the drapes
  const T = new THREE.Group(); OR.root.add(T); OR.table = T;
  cylM(0.12, 0.16, 0.7, std(0x9aa3a6, 0.35, {metalness: 0.6}), -0.2, 0.35, 0, T);
  boxM(1.0, 0.08, 0.5, std(0x6d7679, 0.4, {metalness: 0.5}), -0.2, 0.06, 0, T);
  boxM(2.1, 0.07, 0.54, std(0x30363a, 0.5, {metalness: 0.4}), -0.15, 0.78, 0, T);
  boxM(2.05, 0.08, 0.5, std(0x1c2124, 0.7), -0.15, 0.86, 0, T);
  // sterile drape: non-woven blue cloth laid over the patient's body, a window over the sternum
  const dp = pbr('terry_cloth', [1, 1], {srgb: false});
  const drape = new THREE.MeshStandardMaterial({color: 0x2b6a62, normalMap: dp.normalMap, normalScale: new THREE.Vector2(0.45, 0.45), roughness: 0.96, envMapIntensity: 0.4, side: THREE.DoubleSide}); OR.drapeMat = drape;
  const top = 1.124;
  const DR = new THREE.Group(); T.add(DR); OR.drapes = DR;
  OR.drape = buildDrape(drape, {x: 0.165, z: 0.145}); DR.add(OR.drape);
  /** widen the window when the chest is opened (the field mesh covers it) */
  OR.setDrapeWindow = (open) => { const m = buildDrape(drape, {x: 0.165, z: open ? 0.155 : 0.145}); DR.remove(OR.drape); OR.drape.geometry.dispose(); OR.drape = m; DR.add(m); };
  // the anaesthesia screen ("ether screen") separating the head
  { const sc = new THREE.PlaneGeometry(0.9, 0.62, 30, 12); const sp = sc.attributes.position; for (let i = 0; i < sp.count; i++) sp.setZ(i, 0.012 * Math.sin(sp.getX(i) * 22) * (0.5 - sp.getY(i) / 0.62)); sc.computeVertexNormals(); const m = add(sc, drape, -0.69, top + 0.13, 0, DR); m.rotation.y = Math.PI / 2; }
  cylM(0.008, 0.008, 0.9, std(0xc8cecd, 0.3, {metalness: 0.8}), -0.69, top + 0.44, 0, DR, 8).rotation.x = Math.PI / 2;
  // before draping: a warm blanket over the awake patient (shoulders to feet) and a pillow
  const BL = new THREE.Group(); T.add(BL); OR.blanket = BL; BL.visible = false;
  const blanketT = canvas(256, 256, (g, w, h) => { g.fillStyle = '#dfe6ea'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(70,110,150,.35)'; g.lineWidth = 6; for (let i = 0; i < w; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); } });
  const bgeo = new THREE.BoxGeometry(1.56, 0.3, 0.64, 24, 4, 8); const bp = bgeo.attributes.position;
  for (let i = 0; i < bp.count; i++) { const z = bp.getZ(i), y = bp.getY(i); if (y > 0) bp.setY(i, y - 0.1 * (z / 0.32) ** 2 + 0.01 * Math.sin(bp.getX(i) * 9)); }
  bgeo.computeVertexNormals();
  add(bgeo, std(0xffffff, 0.95, {map: blanketT}), 0.18, 1.04, 0, BL);
  add(new THREE.BoxGeometry(0.26, 0.07, 0.42), std(0xf1f3f4, 0.9), -0.8, 0.93, 0, BL);
  // ---- instrument trays: Mayo stand over the legs, back table behind the scrub nurse
  const steel = std(0xc9ced1, 0.22, {metalness: 0.95});
  OR.standIns = [boxM(0.55, 0.02, 0.38, steel, 0.55, 1.32, 0.02, T), cylM(0.015, 0.015, 0.5, steel, 0.55, 1.07, 0.24, T, 8), boxM(0.52, 0.004, 0.35, std(0x2f6f95, 0.9), 0.55, 1.333, 0.02, T),
    boxM(1.2, 0.03, 0.6, steel, 0.6, 0.92, -1.05, OR.root), boxM(1.16, 0.004, 0.56, std(0x2f6f95, 0.9), 0.6, 0.94, -1.05, OR.root)];
  for (const [x, z] of [[0.05, -0.8], [1.15, -0.8], [0.05, -1.3], [1.15, -1.3]]) OR.standIns.push(cylM(0.015, 0.015, 0.9, steel, x, 0.45, z, OR.root, 8));
  OR.mayo = new THREE.Vector3(0.55, 1.34, 0.02);

  // ---- anaesthesia machine with a moving bellows, and the monitor on its arm
  const A = new THREE.Group(); A.position.set(-1.95, 0, 0.55); A.rotation.y = Math.PI / 2 - 0.5; OR.root.add(A); OR.A = A;
  boxM(0.75, 1.0, 0.6, std(0xd9dedd, 0.45), 0, 0.5, 0, A); boxM(0.78, 0.04, 0.62, std(0x5f676a, 0.4), 0, 1.02, 0, A);
  boxM(0.6, 0.28, 0.06, std(0x22282b, 0.4), 0, 1.25, 0.25, A);
  const bellowsBox = add(new THREE.CylinderGeometry(0.09, 0.09, 0.28, 24), new THREE.MeshPhysicalMaterial({color: 0xbfd8e6, transparent: true, opacity: 0.35, roughness: 0.05, transmission: 0.5}), 0.25, 1.18, 0.12, A);
  OR.bellows = add(new THREE.CylinderGeometry(0.075, 0.075, 0.2, 20), std(0x4d6f86, 0.6), 0.25, 1.12, 0.12, A);
  for (const [x, c] of [[-0.22, 0xd9a92b], [-0.1, 0x7b3f99]]) cylM(0.035, 0.035, 0.14, std(c, 0.4), x, 1.12, 0.22, A, 14);
  const mon = screen(0.62, 0.42, 900, -0.05, 1.72, 0.05, 0.25, A, 1.1); OR.monA = mon;
  attachScreen(mon);
  // big wall monitor facing the surgeon, and the two clocks
  const wallMon = screen(1.1, 0.64, 1100, -0.4, 2.05, -D / 2 + 0.06, 0, OR.root, 1.0);
  OR.wallMon = wallMon;
  const prevScreen = vit.screen; vit.screen = {draw: (fn) => { prevScreen.draw(fn); wallMon.draw(fn); }};
  OR.clockCPB = screen(0.42, 0.16, 420, 0.65, 2.32, -D / 2 + 0.06, 0, OR.root, 1.3);
  OR.clockXC = screen(0.42, 0.16, 420, 0.65, 2.1, -D / 2 + 0.06, 0, OR.root, 1.3);
  setClocks(null, null);
  // count board (whiteboard) on the side wall
  OR.countBoard = screen(1.0, 0.7, 900, W / 2 - 0.06, 1.65, -0.9, -Math.PI / 2, OR.root, 0.35);
  setCount(40, 40);

  // ---- heart-lung machine: base, roller pump heads (they turn on bypass), reservoir, oxygenator, blood lines
  const P = new THREE.Group(); P.position.set(0.55, 0, -1.55); OR.root.add(P); OR.P = P;
  boxM(1.25, 0.8, 0.62, std(0xd7dcdd, 0.45), 0, 0.4, 0, P);
  boxM(1.3, 0.05, 0.66, std(0x4a5154, 0.4), 0, 0.82, 0, P);
  OR.rollers = [];
  for (let i = 0; i < 4; i++) {
    const x = -0.45 + i * 0.3, g = new THREE.Group(); g.position.set(x, 0.97, 0.05); P.add(g);
    cylM(0.12, 0.12, 0.2, std(0xe9eceb, 0.35), 0, 0, 0, g, 30);
    const rotor = new THREE.Group(); rotor.position.y = 0.11; g.add(rotor);
    boxM(0.2, 0.025, 0.035, std(0x8f989b, 0.3, {metalness: 0.8}), 0, 0, 0, rotor);
    for (const s of [-1, 1]) cylM(0.022, 0.022, 0.04, std(0x2b3134, 0.4), s * 0.09, 0, 0, rotor, 12);
    const disp = screen(0.16, 0.06, 200, 0, -0.03, 0.125, 0, g, 1.2); disp.draw((c, w, h) => { c.fillStyle = '#05140c'; c.fillRect(0, 0, w, h); c.fillStyle = '#3fe07a'; c.font = '700 40px Inter'; c.fillText(i === 0 ? '0.0 L' : '0', 10, 52); });
    OR.rollers.push({rotor, disp, i});
  }
  const reservoir = cylM(0.11, 0.09, 0.42, new THREE.MeshPhysicalMaterial({color: 0xe8eef0, transparent: true, opacity: 0.35, roughness: 0.1}), 0.45, 1.25, -0.15, P, 24);
  OR.reservoirBlood = cylM(0.1, 0.085, 0.18, std(0x6e0f10, 0.3, {metalness: 0.1}), 0.45, 1.13, -0.15, P, 24);
  cylM(0.08, 0.08, 0.2, std(0xd8dcdd, 0.3), -0.5, 1.2, -0.2, P, 20);
  // blood lines from the machine to the field (red arterial, dark venous)
  const line = (pts, col) => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), 60, 0.0065, 8, false), std(col, 0.25, {metalness: 0.05, transparent: true, opacity: 0.92}), 0, 0, 0, OR.root, {cast: false});
  OR.artLine = line([[0.3, 1.0, -1.45], [0.1, 1.15, -0.9], [-0.15, 1.2, -0.4], [-0.38, 1.16, -0.18], [-0.5, 1.12, -0.05]], 0x8e1414);
  OR.venLine = line([[0.7, 0.95, -1.45], [0.4, 1.12, -0.85], [0.05, 1.17, -0.35], [-0.32, 1.14, -0.12], [-0.42, 1.1, -0.03]], 0x3a0e18);
  OR.artLine.visible = OR.venLine.visible = false;
  // IV pole with infusion pumps near the anaesthetist
  const iv = new THREE.Group(); iv.position.set(-1.5, 0, -0.75); OR.root.add(iv); OR.iv = iv;
  cylM(0.012, 0.012, 2.0, steel, 0, 1.0, 0, iv, 8); boxM(0.16, 0.2, 0.1, std(0xe1e5e4, 0.4), 0, 1.25, 0.05, iv); boxM(0.16, 0.2, 0.1, std(0xe1e5e4, 0.4), 0, 1.0, 0.05, iv);
  // the door to the corridor
  boxM(1.4, 2.2, 0.08, std(0xa7b6b2, 0.5, {metalness: 0.2}), 2.2, 1.1, D / 2 - 0.05, OR.root);
  boxM(0.4, 0.4, 0.09, new THREE.MeshPhysicalMaterial({color: 0x9fb8c0, roughness: 0.05, transparent: true, opacity: 0.5}), 2.2, 1.55, D / 2 - 0.05, OR.root);

  // the room environment is bright: keep its reflections from washing out the field
  OR.root.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) if (m.isMeshStandardMaterial && m.emissiveIntensity < 0.5) m.envMapIntensity = 0.45; });
  onUpdate((dt, t) => {
    // ventilator bellows rise and fall while the lungs are ventilated
    const vent = vit.ventilating && vit.bypass < 0.5;
    OR.bellows.scale.y = vent ? 0.75 + 0.25 * Math.sin(t * 2 * Math.PI / 5) : OR.bellows.scale.y + (0.6 - OR.bellows.scale.y) * Math.min(1, dt * 2);
    // roller heads turn with the pump flow
    for (const r of OR.rollers) r.rotor.rotation.y += dt * (OR.flow || 0) * (r.i === 0 ? 3.2 : 1.1);
    OR.reservoirBlood.scale.y = 0.7 + 0.5 * (OR.flow || 0) / 1;
  });
  return OR;
}

const fmt = (s) => s == null ? '--:--' : `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
/** the two wall clocks (and the HUD copies) */
export function setClocks(cpbSec, xcSec) {
  for (const [scr, lbl, v, col] of [[OR.clockCPB, 'CPB', cpbSec, '#ffcf6b'], [OR.clockXC, 'X-CLAMP', xcSec, '#ff7b6b']]) {
    if (!scr) continue;
    scr.draw((g, w, h) => { g.fillStyle = '#060808'; g.fillRect(0, 0, w, h); g.fillStyle = '#7f8c8d'; g.font = '600 34px Inter'; g.fillText(lbl, 14, 52); g.fillStyle = v == null ? '#3a4446' : col; g.font = '700 92px Inter'; g.textAlign = 'right'; g.fillText(fmt(v), w - 14, h - 26); g.textAlign = 'left'; });
  }
  const a = document.getElementById('clkcpb'), b = document.getElementById('clkxc');
  if (a) a.textContent = fmt(cpbSec); if (b) b.textContent = fmt(xcSec);
}
/** the scrub nurse's count board */
export function setCount(counted, total) {
  OR.countBoard && OR.countBoard.draw((g, w, h) => {
    g.fillStyle = '#f3f4f2'; g.fillRect(0, 0, w, h); g.fillStyle = '#1f2a2e'; g.font = '700 54px "IBM Plex Sans Arabic", Arial'; g.textAlign = 'right';
    g.fillText('لوحة العدّ', w - 40, 80);
    g.font = '600 46px "IBM Plex Sans Arabic", Arial';
    const rows = [['شاش', `${counted} / ${total}`, counted !== total], ['إبر', '24 / 24', false], ['أدوات', '62 / 62', false]];
    rows.forEach(([n, v, bad], i) => { g.fillStyle = '#1f2a2e'; g.textAlign = 'right'; g.fillText(n, w - 40, 190 + i * 110); g.textAlign = 'left'; g.font = '700 60px Inter'; g.fillStyle = bad ? '#c0392b' : '#1f6f54'; g.fillText(v, 60, 195 + i * 110); g.font = '600 46px "IBM Plex Sans Arabic", Arial'; });
    g.strokeStyle = '#c6ccc9'; g.lineWidth = 4; g.strokeRect(10, 10, w - 20, h - 20);
  });
}
