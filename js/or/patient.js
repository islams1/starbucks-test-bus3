// The awake patient on the table, dressed as he would really be: a hospital gown instead of his own clothes (the
// library avatar wears a shirt and jacket), and a warm cotton blanket that lies over his real body shape from the
// upper chest to the feet, its top edge folded back, falling over the table edges. (The theatre cap is fitted in
// team.js like everyone else's.)
import * as THREE from 'three';
import {OR} from './room.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** hospital gown: every clothing texel of the body texture becomes light-blue gown print (folds kept); skin stays */
export async function gownTexture(ch) {
  const mesh = ch.mesh, geo = mesh.geometry, sk = mesh.skeleton;
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const mat = mats.find(m => m.map && /body_color/.test(m.map.image?.src || m.map.source?.data?.src || ''));
  if (!mat) return;
  await new Promise(r => { const ok = () => mat.map.image && mat.map.image.width; if (ok()) return r(); const i = setInterval(() => { if (ok()) { clearInterval(i); r(); } }, 50); });
  const im = mat.map.image, W = im.width, H = im.height;
  // per triangle: 2 = clothes (torso, arms, legs), 1 = head and neck (skin or collar: decided per texel), 0 = hands
  const cls = sk.bones.map(b => /Finger|_Hand$/.test(b.name) ? 0 : /Head|Neck|Jaw|Eye/.test(b.name) ? 1 : 2);
  const si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, uv = geo.attributes.uv, index = geo.index;
  const dom = (v) => { let best = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = sw.getComponent(v, k); if (w > bw) { bw = w; best = si.getComponent(v, k); } } return cls[best]; };
  const vi = index ? (i) => index.getX(i) : (i) => i;
  const mask = document.createElement('canvas'); mask.width = W; mask.height = H; const mg = mask.getContext('2d');
  const groups = geo.groups.length ? geo.groups : [{start: 0, count: index ? index.count : geo.attributes.position.count, materialIndex: 0}];
  for (const gr of groups) {
    if (mats[gr.materialIndex] !== mat) continue;
    for (let i = gr.start; i < gr.start + gr.count; i += 3) {
      const a = vi(i), b = vi(i + 1), c = vi(i + 2), k = Math.max(dom(a), dom(b), dom(c));
      if (!k) continue;
      mg.fillStyle = mg.strokeStyle = k === 2 ? '#ff0000' : '#00ff00'; mg.lineWidth = 3;
      mg.beginPath(); [a, b, c].forEach((v, j) => { const x = uv.getX(v) * W, y = (1 - uv.getY(v)) * H; j ? mg.lineTo(x, y) : mg.moveTo(x, y); }); mg.closePath(); mg.fill(); mg.stroke();
    }
  }
  const out = document.createElement('canvas'); out.width = W; out.height = H; const og = out.getContext('2d'); og.drawImage(im, 0, 0, W, H);
  const soft = document.createElement('canvas'); soft.width = W; soft.height = H; const sg = soft.getContext('2d'); sg.filter = `blur(${Math.round(W / 170)}px)`; sg.drawImage(im, 0, 0, W, H);
  const px = og.getImageData(0, 0, W, H), d = px.data, mk = mg.getImageData(0, 0, W, H).data, sd = sg.getImageData(0, 0, W, H).data;
  const cell = Math.round(W / 64);
  for (let i = 0; i < d.length; i += 4) {
    if (!mk[i + 3]) continue;
    const r = d[i], g = d[i + 1], b = d[i + 2];
    if (mk[i + 1] > 128) {                                                          // head/neck: keep what looks like skin
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), s = mx ? (mx - mn) / mx : 0;
      if (r > g && g >= b * 0.85 && r > 95 && s > 0.12 && s < 0.65) continue;
    }
    const p = i / 4, x = p % W, y = (p / W) | 0;
    // gown print: pale blue cotton with a small navy diamond every few centimetres
    const u = (x % cell) / cell - 0.5, v = (y % cell) / cell - 0.5, dia = Math.abs(u) + Math.abs(v) < 0.16;
    const lum = (sd[i] * 0.3 + sd[i + 1] * 0.59 + sd[i + 2] * 0.11) / 255, sh = 0.62 + 0.75 * lum;   // the clothes' folds and shading, softened
    const base = dia ? [62, 92, 140] : [178, 202, 218];
    d[i] = Math.min(255, base[0] * sh); d[i + 1] = Math.min(255, base[1] * sh); d[i + 2] = Math.min(255, base[2] * sh);
  }
  og.putImageData(px, 0, 0);
  const t = new THREE.CanvasTexture(out); t.colorSpace = THREE.SRGBColorSpace; t.flipY = mat.map.flipY; t.anisotropy = 8;
  mat.map = t; mat.roughness = 0.9; mat.needsUpdate = true;
}

/** a warm cotton blanket laid over the patient's real body (sampled from his mesh), upper chest to feet */
export function buildBlanket(ch, {x0 = -0.6, x1 = 1.04, half = 0.27, top = null} = {}) {
  const BL = OR.blanket; if (!BL) return;
  for (const c of [...BL.children]) { BL.remove(c); c.geometry && c.geometry.dispose(); }   // the old box blanket and pillow
  ch.mixer.update(0); ch.holder.updateMatrixWorld(true);
  const mesh = ch.mesh, pos = mesh.geometry.attributes.position, v = V();
  const ZS = 0.44, STEP = 0.0125, NX = Math.round((x1 - x0) / STEP), NZ = Math.round(2 * ZS / STEP);
  const Hgt = new Float32Array((NX + 1) * (NZ + 1)).fill(-1);
  // his body's top surface, triangle by triangle (vertices alone leave holes on a low-poly body)
  const n = pos.count, W = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { v.fromBufferAttribute(pos, i); mesh.applyBoneTransform(i, v); v.applyMatrix4(mesh.matrixWorld); W[i * 3] = v.x; W[i * 3 + 1] = v.y; W[i * 3 + 2] = v.z; }
  const ix = mesh.geometry.index, nt = (ix ? ix.count : n) / 3;
  for (let t = 0; t < nt; t++) {
    const a = ix ? ix.getX(t * 3) : t * 3, b = ix ? ix.getX(t * 3 + 1) : t * 3 + 1, c = ix ? ix.getX(t * 3 + 2) : t * 3 + 2;
    const xs = [W[a * 3], W[b * 3], W[c * 3]], zs = [W[a * 3 + 2], W[b * 3 + 2], W[c * 3 + 2]], ym = Math.max(W[a * 3 + 1], W[b * 3 + 1], W[c * 3 + 1]);
    const i0 = Math.max(0, Math.floor((Math.min(...xs) - x0) / STEP)), i1 = Math.min(NX, Math.ceil((Math.max(...xs) - x0) / STEP));
    const j0 = Math.max(0, Math.floor((Math.min(...zs) + ZS) / STEP)), j1 = Math.min(NZ, Math.ceil((Math.max(...zs) + ZS) / STEP));
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = i * (NZ + 1) + j; if (ym > Hgt[k]) Hgt[k] = ym; }
  }
  // the mattress is where his back lies
  if (top == null) { let lo = 9; for (let i = 0; i < n; i++) if (W[i * 3] > x0 + 0.1 && W[i * 3] < 0.4 && Math.abs(W[i * 3 + 2]) < 0.15) lo = Math.min(lo, W[i * 3 + 1]); top = lo < 9 ? lo : 0.9; }
  // empty cells: the mattress on the table, nothing beyond its edges
  for (let i = 0; i <= NX; i++) for (let j = 0; j <= NZ; j++) { const k = i * (NZ + 1) + j, z = -ZS + j * STEP; if (Hgt[k] < 0) Hgt[k] = Math.abs(z) < half ? top : 0; }
  // cloth: it rests on the high points and bridges the hollows between them (blurred), never cuts into the body
  const B = new Float32Array(Hgt.length), R = 4;
  for (let i = 0; i <= NX; i++) for (let j = 0; j <= NZ; j++) {
    let s = 0, n = 0;
    for (let di = -R; di <= R; di++) for (let dj = -R; dj <= R; dj++) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii > NX || jj > NZ) continue; const w = Math.exp(-(di * di + dj * dj) / (R * R * 0.5)); s += Math.max(Hgt[ii * (NZ + 1) + jj], top) * w; n += w; }
    B[i * (NZ + 1) + j] = s / n;
  }
  const P = [], UV = [], idx = [];
  for (let i = 0; i <= NX; i++) for (let j = 0; j <= NZ; j++) {
    const k = i * (NZ + 1) + j, x = x0 + i * STEP, z = -ZS + j * STEP, az = Math.abs(z);
    let y = Math.max(Math.max(Hgt[k], top) + 0.012, B[k] + 0.006);
    // over the table edges the blanket falls, a little wavy
    if (az > half) { const o = az - half; y = Math.min(y, top + 0.01) - o * 2.6 - 0.02 * Math.sin(o * 40); }
    y += 0.003 * Math.sin(x * 23 + z * 7) * Math.sin(z * 9 + 1.3);                          // soft folds
    // the top edge is turned back on itself: a thicker rolled hem across the upper chest
    const hem = Math.max(0, 1 - (x - x0) / 0.06); y += 0.012 * Math.sin(hem * Math.PI);
    P.push(x, y, z); UV.push(x / 0.3, z / 0.3);
  }
  for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) { const a = i * (NZ + 1) + j, b = a + NZ + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(idx); g.computeVertexNormals();
  // cotton weave with the blanket's woven blue stripes
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#e8edf0'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) { const s = 205 + Math.random() * 45 | 0; x.fillStyle = `rgba(${s},${s + 4},${s + 8},0.35)`; x.fillRect(Math.random() * 256, Math.random() * 256, 2, 1); }
  x.strokeStyle = 'rgba(80,120,165,.32)'; x.lineWidth = 5; for (const yy of [40, 52]) { x.beginPath(); x.moveTo(0, yy); x.lineTo(256, yy); x.stroke(); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 8;
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({map: tex, roughness: 0.95, side: THREE.DoubleSide, envMapIntensity: 0.5}));
  m.castShadow = true; m.receiveShadow = true;
  OR.root.add(m); BL.attach(m);
  // a soft pillow under the head
  const pg = new THREE.SphereGeometry(1, 28, 14); pg.scale(0.13, 0.04, 0.22);
  const pl = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({color: 0xf1f3f4, roughness: 0.9})); pl.position.set(-0.86, top + 0.03, 0); pl.castShadow = pl.receiveShadow = true;
  OR.root.add(pl); BL.attach(pl);
}
