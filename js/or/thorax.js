// The real chest under the skin (BodyParts3D, CC BY 4.0 — built by tools/build_thorax.py): the sternum split in two by
// the saw, each half with its cut face of red marrow and bone wax, the costal cartilages, ribs 1–8, the internal
// thoracic arteries running behind the sternal edges, the thymic fat, and both lungs carved from the real thoracic
// cavity around the game's heart. The retractor spreads the two hemithoraces apart (each half turns about the
// costovertebral joints and its edge everts a little); the lungs inflate and deflate with the ventilator and fall
// back when it stops on bypass.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {onUpdate, clock} from '../core/engine.js';
import {CHEST} from './room.js';
import {vit} from './monitor.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const TX = {group: null, halves: {}, lungs: {}, openK: 0, infl: 0, collapse: 0, ready: false};

function canvasTex(size, paint, repeat = 1, srgb = true) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); paint(g, size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
}
const rnd = (a, b) => a + Math.random() * (b - a);
/** pleural surface: pink lobules outlined by fine grey-violet septa, carbon dust specks, a few darker congested patches */
function lungTextures() {
  const S = 1024, cells = [];
  for (let i = 0; i < 420; i++) cells.push([Math.random() * S, Math.random() * S]);
  const nearest = (x, y) => { let a = 1e9, b = 1e9; for (const [cx, cy] of cells) { for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { const d = (x - cx - ox) ** 2 + (y - cy - oy) ** 2; if (d < a) { b = a; a = d; } else if (d < b) b = d; } } return Math.sqrt(b) - Math.sqrt(a); };
  // the lobule borders as a small field (voronoi edge distance), computed once at 256² and scaled up
  const F = 256, edge = new Float32Array(F * F);
  for (let y = 0; y < F; y++) for (let x = 0; x < F; x++) edge[y * F + x] = nearest(x * S / F, y * S / F);
  const edgeCanvas = (col, wid) => { const c = document.createElement('canvas'); c.width = c.height = F; const g = c.getContext('2d'); const im = g.createImageData(F, F);
    for (let i = 0; i < F * F; i++) { const k = Math.max(0, 1 - edge[i] / wid); im.data[i * 4] = col[0]; im.data[i * 4 + 1] = col[1]; im.data[i * 4 + 2] = col[2]; im.data[i * 4 + 3] = 255 * k * k; }
    g.putImageData(im, 0, 0); return c; };
  const map = canvasTex(S, (g) => {
    g.fillStyle = '#b4646a'; g.fillRect(0, 0, S, S);
    for (const [x, y] of cells) { const r = rnd(18, 40), q = g.createRadialGradient(x, y, 0, x, y, r); const v = Math.random(); q.addColorStop(0, v < 0.5 ? 'rgba(214,140,136,0.5)' : 'rgba(170,84,98,0.45)'); q.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = q; g.fillRect(x - r, y - r, r * 2, r * 2); }
    for (let i = 0; i < 40; i++) { const x = rnd(0, S), y = rnd(0, S), r = rnd(50, 150), q = g.createRadialGradient(x, y, 0, x, y, r); q.addColorStop(0, 'rgba(110,50,95,0.45)'); q.addColorStop(1, 'rgba(110,50,95,0)'); g.fillStyle = q; g.fillRect(x - r, y - r, r * 2, r * 2); }
    g.imageSmoothingEnabled = true; g.globalAlpha = 0.95; g.drawImage(edgeCanvas([95, 55, 85], 2.6), 0, 0, S, S); g.globalAlpha = 1;
    for (let i = 0; i < 3200; i++) { const x = rnd(0, S), y = rnd(0, S); const e = edge[(y * F / S | 0) * F + (x * F / S | 0)]; if (e > 3 && Math.random() < 0.8) continue; g.fillStyle = `rgba(30,24,30,${rnd(0.25, 0.7)})`; g.beginPath(); g.arc(x, y, rnd(0.8, 2.6), 0, 7); g.fill(); }   // carbon along the septa
    for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(255,225,220,${rnd(0.03, 0.09)})`; g.fillRect(rnd(0, S), rnd(0, S), 2, 2); }
  }, 1);
  const bump = canvasTex(S, (g) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, S, S);
    for (const [x, y] of cells) { const r = rnd(20, 34), q = g.createRadialGradient(x, y, 0, x, y, r); q.addColorStop(0, 'rgba(200,200,200,0.6)'); q.addColorStop(1, 'rgba(128,128,128,0)'); g.fillStyle = q; g.fillRect(x - r, y - r, r * 2, r * 2); }
    g.globalAlpha = 0.9; g.drawImage(edgeCanvas([40, 40, 40], 3), 0, 0, S, S); g.globalAlpha = 1;
  }, 1, false);
  return {map, bump};
}
function marrowTexture() {
  return canvasTex(512, (g, S) => {
    g.fillStyle = '#5c1714'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 12000; i++) { const v = Math.random(); g.fillStyle = v < 0.35 ? `rgba(150,70,50,${rnd(0.3, 0.7)})` : v < 0.85 ? `rgba(45,4,6,${rnd(0.3, 0.8)})` : `rgba(200,160,120,${rnd(0.15, 0.4)})`; g.beginPath(); g.arc(rnd(0, S), rnd(0, S), rnd(0.8, 2.6), 0, 7); g.fill(); }   // trabeculae soaked in blood
    for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(214,196,160,${rnd(0.25, 0.5)})`; g.beginPath(); let x = rnd(0, S), y = rnd(0, S); g.moveTo(x, y); for (let k = 0; k < 7; k++) { x += rnd(-26, 26); y += rnd(-10, 10); g.lineTo(x, y); } g.closePath(); g.fill(); }   // thin smears of bone wax
  }, 1);
}
function fatTexture() {
  return canvasTex(512, (g, S) => {
    g.fillStyle = '#d6aa4c'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 700; i++) { const x = rnd(0, S), y = rnd(0, S), r = rnd(6, 20), q = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r); q.addColorStop(0, 'rgba(250,224,140,0.8)'); q.addColorStop(0.8, 'rgba(200,150,60,0.25)'); q.addColorStop(1, 'rgba(160,80,40,0.5)'); g.fillStyle = q; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
    for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(160,30,30,${rnd(0.3, 0.6)})`; g.lineWidth = rnd(0.8, 2); g.beginPath(); let x = rnd(0, S), y = rnd(0, S); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += rnd(-30, 30); y += rnd(-30, 30); g.lineTo(x, y); } g.stroke(); }   // small vessels
  }, 1);
}
/** planar UVs from the top (z across, x along the body), metres → texture repeats */
function planarUV(geo, scale, axes = ['z', 'x']) {
  const p = geo.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = p['get' + axes[0].toUpperCase()](i) * scale; uv[i * 2 + 1] = p['get' + axes[1].toUpperCase()](i) * scale; }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

export async function buildThorax(parent) {
  const g = await new GLTFLoader().loadAsync('assets/or_models/bp3d_thorax/thorax.glb');
  const G = new THREE.Group(); G.position.copy(CHEST); parent.add(G); TX.group = G; G.visible = false;
  const parts = {}; g.scene.traverse(o => { if (o.isMesh) parts[o.name] = o; });
  const lung = lungTextures();
  const M = {
    bone: new THREE.MeshPhysicalMaterial({color: 0xd8c2a6, roughness: 0.48, clearcoat: 0.35, clearcoatRoughness: 0.4, envMapIntensity: 0.4}),
    marrow: new THREE.MeshPhysicalMaterial({map: marrowTexture(), roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 0.4}),   // wet with blood
    cartilage: new THREE.MeshPhysicalMaterial({color: 0xd9ddd2, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25, sheen: 0.4, sheenColor: new THREE.Color(0xc8d8ff), envMapIntensity: 0.45}),
    artery: new THREE.MeshPhysicalMaterial({color: 0x8c1d1f, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.15, envMapIntensity: 0.5}),
    fat: new THREE.MeshPhysicalMaterial({map: fatTexture(), roughness: 0.36, clearcoat: 0.8, clearcoatRoughness: 0.2, envMapIntensity: 0.45}),
    lung: new THREE.MeshPhysicalMaterial({color: 0xc98c8c, map: lung.map, bumpMap: lung.bump, bumpScale: 2.2, roughness: 0.46, clearcoat: 0.6, clearcoatRoughness: 0.2, envMapIntensity: 0.25}),
  };
  TX.M = M;
  const use = (name, mat, host, uvScale) => { const m = parts[name]; if (!m) return null; m.material = mat; m.castShadow = !/^(ribs|cartilage|ita)_/.test(name); m.receiveShadow = true; if (uvScale) planarUV(m.geometry, uvScale, name.startsWith('sternum_cut') ? ['x', 'y'] : ['z', 'x']); host.add(m); return m; };   // the chest wall under the skin casts no shadow into the field
  // each hemithorax turns about a hinge near the costovertebral joints; its sternal edge also everts about the edge itself
  for (const [side, s] of [['R', 1], ['L', -1]]) {
    const hinge = new THREE.Group(); hinge.position.set(0, -0.2, s * 0.03); G.add(hinge);
    const wall = new THREE.Group(); wall.position.set(0, 0.2, -s * 0.03); hinge.add(wall);                  // back to the thorax frame
    const evert = new THREE.Group(); evert.position.set(0, 0.18, -s * 0.03); hinge.add(evert);              // at the sternal edge
    const body = new THREE.Group(); body.position.set(0, 0.02, 0); evert.add(body);                          // back to the thorax frame
    use('sternum_' + side, M.bone, body); use('sternum_cut_' + side, M.marrow, body, 14);
    use('cartilage_' + side, M.cartilage, wall); use('ribs_' + side, M.bone, wall); use('ita_' + side, M.artery, wall);
    TX.halves[side] = {hinge, evert, s};
  }
  for (const [side, s] of [['R', 1], ['L', -1]]) {
    const m = parts['lung_' + side]; if (!m) continue;
    m.geometry.computeBoundingBox(); const b = m.geometry.boundingBox;
    // the lung swells from the lateral chest wall: its front edge moves up and in with each breath
    const hil = V((b.min.x + b.max.x) / 2, b.min.y + (b.max.y - b.min.y) * 0.35, s > 0 ? b.max.z : b.min.z);   // fixed against the lateral chest wall
    const piv = new THREE.Group(); piv.position.copy(hil); G.add(piv);
    m.geometry.translate(-hil.x, -hil.y, -hil.z);
    use('lung_' + side, M.lung, piv, 7);
    TX.lungs[side] = {piv, base: hil.clone(), s};
  }
  setThoraxOpen(0);
  onUpdate((dt) => {
    if (!G.visible) return;
    const vent = vit.ventilating && vit.bypass < 0.5;
    const br = vent ? Math.sin(clock.t * 2 * Math.PI / 5) * 0.5 + 0.5 : 0;
    G.position.y = CHEST.y + 0.002 * br;                  // the chest wall rises with the breath like the skin
    TX.infl += (br - TX.infl) * Math.min(1, dt * 6);
    TX.collapse += ((vent ? 0 : 1) - TX.collapse) * Math.min(1, dt * 0.6);
    for (const k in TX.lungs) {
      const L = TX.lungs[k], i = TX.infl, c = TX.collapse;
      const sc = 1 + 0.06 * i - 0.08 * c;                 // each breath the lung swells up and in towards the heart
      L.piv.scale.set(1 + 0.025 * i - 0.03 * c, sc, sc);
      L.piv.position.set(L.base.x, L.base.y + 0.006 * i - 0.014 * c, L.base.z + L.s * TX.openK * 0.012);
    }
  });
  TX.ready = true;
  return TX;
}
/** k 0..1: the retractor spreads the sternal edges from the saw kerf to ~11 cm */
export function setThoraxOpen(k) {
  TX.openK = k; const e = 0.0015 + k * 0.053;
  for (const side in TX.halves) {
    const h = TX.halves[side];
    h.hinge.rotation.x = h.s * e / 0.186;                 // the edge moves out by e
    h.evert.rotation.x = h.s * 0.06 * k;                  // and turns its cut face a little up towards the surgeon
  }
}
export function showThorax(on) { if (TX.group) TX.group.visible = on; }
