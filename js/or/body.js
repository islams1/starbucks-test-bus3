// The patient's body under the drapes: an anatomical height map of a supine adult (head towards -x), and the sterile
// drape laid over it — it bridges between chest, arms and legs like cloth, falls over the table edges, and has a
// window cut where the surgery happens (the skin strip before the incision, the wider opening once the chest is open).
import * as THREE from 'three';
import {CHEST} from './room.js';

const M = 0.9;                               // mattress top
const cs = (a, b, t) => { t = Math.max(0, Math.min(1, (t - a) / (b - a))); return t * t * (3 - 2 * t); };
// torso keys along the body: [x, height above the mattress, half width]
const TORSO = [[-0.69, 0.11, 0.15], [-0.63, 0.175, 0.215], [-0.55, 0.205, 0.205], [-0.45, 0.215, 0.195], [-0.35, 0.21, 0.185], [-0.22, 0.192, 0.168], [-0.06, 0.186, 0.162], [0.05, 0.172, 0.18], [0.14, 0.12, 0.18]];
function torsoAt(x) {
  if (x < TORSO[0][0] || x > TORSO[TORSO.length - 1][0]) return null;
  for (let i = 1; i < TORSO.length; i++) if (x <= TORSO[i][0]) {
    const a = TORSO[i - 1], b = TORSO[i], t = (x - a[0]) / (b[0] - a[0]), s = t * t * (3 - 2 * t);
    return [a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s];
  }
  return null;
}
const blob = (dx, dz, rx, rz, h) => { const q = (dx / rx) ** 2 + (dz / rz) ** 2; return q < 1 ? h * Math.sqrt(1 - q) : 0; };
/** skin surface height (world y) of the patient at (x, z); the mattress where there is no body */
export function bodyTop(x, z) {
  let h = 0; const az = Math.abs(z);
  const t = torsoAt(x);
  if (t) { const [ht, w] = t; if (az < w) h = Math.max(h, ht * Math.sqrt(Math.max(0, 1 - (az / w) ** 4))); }
  h = Math.max(h, blob(x + 0.72, z, 0.06, 0.06, 0.1));                         // neck
  h = Math.max(h, blob(x + 0.85, z, 0.11, 0.085, 0.2));                        // head (behind the anaesthesia screen)
  for (const s of [-1, 1]) {
    if (x > -0.62 && x < 0.16) h = Math.max(h, blob(0, z - s * 0.245, 1, 0.045, 0.085) * (1 - cs(0.08, 0.16, x)));   // arms tucked at the sides
    if (x > 0.08 && x < 0.9) { const k = cs(0.12, 0.8, x); h = Math.max(h, blob(0, z - s * 0.1, 1, 0.09 - 0.035 * k, 0.15 - 0.055 * k) * cs(0.06, 0.14, x)); }   // thigh → shin
    h = Math.max(h, blob(x - 0.89, z - s * 0.09, 0.04, 0.05, 0.19));             // feet, toes up
  }
  return M + h;
}
export const STERNUM_Y = () => bodyTop(CHEST.x, 0);

/** the drape: a cloth height field over the body. hole = half widths {x, z} of the window around the chest */
export function buildDrape(material, hole) {
  const X0 = -0.69, X1 = 1.02, ZS = 0.46;
  // grid lines run exactly along both window outlines (skin strip and opened chest), so the cut edges are straight
  const seg = (pts, step) => { const out = []; for (let s = 0; s < pts.length - 1; s++) { const a = pts[s], b = pts[s + 1], n = Math.max(1, Math.round((b - a) / step)); for (let i = 0; i < n; i++) out.push(a + (b - a) * i / n); } out.push(pts[pts.length - 1]); return out; };
  const HX = 0.165, ZA = 0.145, ZB = 0.155;
  const xs = seg([X0, CHEST.x - HX, CHEST.x + HX, X1], 0.009);
  const zs = seg([-ZS, -0.3, -ZB, -ZA, 0, ZA, ZB, 0.3, ZS], 0.0065).map((z, i, a) => z);
  const NX = xs.length - 1, NZ = zs.length - 1;
  const H = new Float32Array((NX + 1) * (NZ + 1));
  // 1) body + mattress, 2) cloth: bridges hollows (blurred) and never cuts into the body, 3) falls over the edges
  for (let i = 0; i <= NX; i++) for (let j = 0; j <= NZ; j++) H[i * (NZ + 1) + j] = bodyTop(xs[i], zs[j]);
  const B = new Float32Array(H.length), R = 4;
  for (let i = 0; i <= NX; i++) for (let j = 0; j <= NZ; j++) {
    let s = 0, n = 0; for (let di = -R; di <= R; di++) for (let dj = -R; dj <= R; dj++) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii > NX || jj > NZ) continue; const w = Math.exp(-(di * di + dj * dj) / (R * R * 0.6)); s += H[ii * (NZ + 1) + jj] * w; n += w; }
    B[i * (NZ + 1) + j] = s / n;
  }
  const pos = [], uv = [], idx = [], vid = new Int32Array((NX + 1) * (NZ + 1));
  let v = 0;
  for (let i = 0; i <= NX; i++) for (let j = 0; j <= NZ; j++) {
    const x = xs[i], z = zs[j], k = i * (NZ + 1) + j, az = Math.abs(z);
    let y = Math.max(H[k] + 0.006, B[k] - 0.004);
    // around the window the adhesive incise drape sits a little proud of the skin (the chest rises under it with each breath)
    const dxw = Math.max(0, Math.abs(x - CHEST.x) - hole.x), dzw = Math.max(0, az - hole.z), dw = Math.hypot(dxw, dzw);
    y += 0.006 * (1 - cs(0.0, 0.035, dw));
    // over the table sides and the foot end the sheet hangs down
    const edge = Math.max(0, az - 0.27), foot = Math.max(0, x - 0.93);
    y -= Math.pow(edge / 0.19, 0.6) * 0.42 + Math.pow(foot / 0.09, 0.6) * 0.38;
    // folds: long soft creases along the body, small wrinkles near the window
    y += 0.004 * Math.sin(z * 38 + Math.sin(x * 7) * 1.5) * cs(0.12, 0.3, az) + 0.0015 * Math.sin(x * 61 + z * 23) * Math.sin(z * 47);
    pos.push(x, y, z); uv.push((x - X0) * 3.2, z * 3.2); vid[k] = v++;
  }
  const inHole = (x, z) => Math.abs(x - CHEST.x) < hole.x && Math.abs(z) < hole.z;
  for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
    const cx = (xs[i] + xs[i + 1]) / 2, cz = (zs[j] + zs[j + 1]) / 2;
    if (inHole(cx, cz)) continue;
    const a = vid[i * (NZ + 1) + j], b = vid[(i + 1) * (NZ + 1) + j], c = vid[(i + 1) * (NZ + 1) + j + 1], d = vid[i * (NZ + 1) + j + 1];
    idx.push(a, d, b, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, material); m.receiveShadow = true; m.castShadow = true;
  return m;
}
