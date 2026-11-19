// The cockpit's windows from the inside. The cockpit model has open window frames; each opening gets a pane of glass:
// a faint blue-green tint, fine dust and the arcs of the wipers that show against the bright sky, the glareshield's dark
// reflection low on the windscreen, and glass that greys as it is seen more edge-on (thick laminated panes). The openings
// were found with rays from the captain's eye (every 2° of yaw and pitch: which directions see out) and each pane lies
// on the plane fitted to its frame. Drawn after the river (whose mirror pass is drawn late too), without writing depth.
import * as THREE from 'three';
import {CK} from './cockpit.js';

// per pane, in the cockpit frame (+z forward, +x left, eye at the origin): a point and the normal of its plane, and the
// openings as rows of [pitch°, from yaw°, to yaw°] (yaw + to the left)
const PANES = [
  {c: [-1.418, -0.082, -0.185], n: [-0.764, 0.543, 0.347], rows: [[-10, -96, -92], [-8, -94, -92], [-6, -94, -92], [-4, -96, -92], [-2, -106, -102], [-2, -98, -92], [0, -106, -92], [2, -104, -92]]},
  {c: [-1.467, -0.169, 0.307], n: [-0.746, 0.521, 0.414], rows: [[-12, -86, -78], [-10, -86, -66], [-8, -86, -68], [-6, -86, -70], [-4, -86, -72], [-2, -86, -72], [0, -86, -76], [2, -86, -76]]},
  {c: [-0.919, -0.058, 0.722], n: [-0.369, 0.44, 0.819], rows: [[-12, -42, -28], [-10, -60, -28], [-8, -62, -30], [-6, -62, -30], [-4, -64, -32], [-2, -66, -32], [0, -66, -34], [2, -68, -34]]},
  {c: [-0.035, -0.04, 0.688], n: [0.403, 0.657, 0.637], rows: [[-18, 8, 20], [-16, -8, 20], [-14, -18, 20], [-12, -20, 22], [-10, -22, 22], [-8, -22, 22], [-6, -24, 22], [-4, -24, 22], [-2, -26, 22], [0, -26, 22], [2, -26, 24], [4, -22, 24], [6, -10, 24], [8, 6, 22]]},
  {c: [0.402, -0.113, 0.335], n: [0.693, 0.645, 0.322], rows: [[-26, 54, 74], [-24, 44, 74], [-22, 36, 74], [-20, 32, 74], [-18, 30, 74], [-16, 32, 74], [-14, 32, 78], [-12, 32, 76], [-10, 34, 76], [-8, 34, 78], [-6, 34, 80], [-4, 34, 80], [-2, 38, 80], [0, 38, 80], [2, 38, 80], [4, 38, 80], [6, 38, 80], [8, 38, 80], [10, 38, 78], [12, 54, 62]]},
  {c: [0.663, -0.123, -0.197], n: [0.764, 0.543, 0.347], rows: [[-24, 96, 100], [-22, 98, 108], [-20, 100, 114], [-18, 98, 116], [-16, 98, 118], [-14, 98, 118], [-12, 98, 120], [-10, 98, 120], [-8, 96, 120], [-6, 96, 120], [-4, 96, 120], [-2, 96, 120], [0, 96, 120], [2, 96, 120], [4, 96, 120], [6, 96, 120], [8, 96, 118], [10, 96, 106]]},
];
/** the captain's windscreen plane (the smears of the bird strike sit just outside it) */
export const WINDSCREEN = {c: new THREE.Vector3(...PANES[3].c), n: new THREE.Vector3(...PANES[3].n).normalize()};

const D2R = Math.PI / 180;
const dirOf = (a, e) => new THREE.Vector3(Math.sin(a * D2R) * Math.cos(e * D2R), Math.sin(e * D2R), Math.cos(a * D2R) * Math.cos(e * D2R));

/** one pane: a strip of small quads per row of the opening, reaching 1° above and below it and 3° to the sides (under
 *  the frame: a thin post seen between two sample directions left a strip of untinted sky beside it) */
function paneGeometry(P) {
  const c = new THREE.Vector3(...P.c), n = new THREE.Vector3(...P.n).normalize(), cn = c.dot(n);
  const a0 = Math.min(...P.rows.map(r => r[1])) - 3, a1 = Math.max(...P.rows.map(r => r[2])) + 3;
  const e0 = Math.min(...P.rows.map(r => r[0])) - 1, e1 = Math.max(...P.rows.map(r => r[0])) + 1;
  const pos = [], uv = [], nor = [], idx = [];
  const at = (a, e) => {
    const d = dirOf(a, e), dn = d.dot(n), t = dn > 0.05 ? Math.min(2.2, Math.max(0.25, cn / dn)) : 2.2;
    pos.push(d.x * t, d.y * t, d.z * t); nor.push(n.x, n.y, n.z);
    uv.push(1 - (a - a0) / (a1 - a0), (e - e0) / (e1 - e0));         // u across from the left edge, v up from the bottom
    return pos.length / 3 - 1;
  };
  for (const [e, ra, rb] of P.rows) {
    const lo = [], hi = [];
    for (let a = ra - 3; a <= rb + 3 + 1e-6; a += 2) { lo.push(at(a, e - 1)); hi.push(at(a, e + 1)); }
    for (let i = 0; i < lo.length - 1; i++) idx.push(lo[i], lo[i + 1], hi[i], hi[i], lo[i + 1], hi[i + 1]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}

/** what is on and in the glass: dust, the wipers' arcs, a few dried drops, the glareshield's reflection at the bottom */
function dirtTexture(seed) {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  let s = seed * 7919 + 13; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const refl = g.createLinearGradient(0, S, 0, S * 0.5);                        // canvas bottom = bottom of the pane
  refl.addColorStop(0, 'rgba(16,19,22,0.5)'); refl.addColorStop(0.3, 'rgba(22,25,28,0.26)'); refl.addColorStop(1, 'rgba(22,25,28,0)');
  g.fillStyle = refl; g.fillRect(0, 0, S, S);
  for (const [x0, y0, x1, y1] of [[0, 0, S * 0.07, 0], [S * 0.93, 0, S, 0]]) {       // the edges of thick glass: a little darker
    const e = g.createLinearGradient(x0, 0, x1, 0); e.addColorStop(x0 ? 0 : 1, 'rgba(30,40,40,0)'); e.addColorStop(x0 ? 1 : 0, 'rgba(30,40,40,0.12)');
    g.fillStyle = e; g.fillRect(x0, y0, x1 - x0, S);
  }
  // the light of the side windows caught in the glass: a broad, soft, slanting sheen
  g.save(); g.translate(S * 0.55, S * 0.45); g.rotate(-0.5);
  const sh = g.createLinearGradient(-S * 0.25, 0, S * 0.25, 0); sh.addColorStop(0, 'rgba(235,240,242,0)'); sh.addColorStop(0.5, 'rgba(235,240,242,0.07)'); sh.addColorStop(1, 'rgba(235,240,242,0)');
  g.fillStyle = sh; g.fillRect(-S * 0.25, -S, S * 0.5, S * 2); g.restore();
  g.lineCap = 'round';
  for (let i = 0; i < 7; i++) {                                                  // the wipers' arcs, pivoting below the pane
    g.strokeStyle = `rgba(226,222,212,${0.05 + r() * 0.05})`; g.lineWidth = 1.5 + r() * 4;
    const R = S * (0.55 + r() * 0.4); g.beginPath(); g.arc(S * (0.35 + r() * 0.3), S * 1.08, R, Math.PI * (1.1 + r() * 0.1), Math.PI * (1.8 + r() * 0.1)); g.stroke();
  }
  for (let i = 0; i < 4200; i++) {                                               // dust
    g.fillStyle = `rgba(232,228,218,${0.06 + r() * 0.12})`; g.beginPath(); g.arc(r() * S, r() * S, 0.5 + r() * 1.3, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 26; i++) {                                                 // dried drops
    g.strokeStyle = `rgba(225,222,214,${0.08 + r() * 0.08})`; g.lineWidth = 1.2; const x = r() * S, y = r() * S * 0.8, rr = 2 + r() * 5;
    g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

const VERT = `#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main() {
  vUv = uv; vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}`;
const FRAG = `#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D tDirt; uniform vec3 uTint; uniform float uBase; uniform vec3 uEdge; uniform float uEdgeK;
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main() {
  #include <logdepthbuf_fragment>
  vec4 d = texture2D(tDirt, vUv);
  float c = abs(dot(normalize(vN), normalize(vV)));
  float fr = pow(1.0 - c, 4.0);                         // seen edge-on, the thick glass mirrors the dim cockpit
  vec3 P = uTint * uBase; float A = uBase;
  P = d.rgb * d.a + P * (1.0 - d.a); A = d.a + A * (1.0 - d.a);
  float k = fr * uEdgeK; P = uEdge * k + P * (1.0 - k); A = k + A * (1.0 - k);
  gl_FragColor = vec4(P / max(A, 1e-4), clamp(A, 0.0, 0.9));
}`;

export function buildGlass() {
  if (!CK.group || CK.panes) return;
  CK.panes = PANES.map((P, i) => {
    const m = new THREE.ShaderMaterial({
      uniforms: {tDirt: {value: dirtTexture(i + 1)}, uTint: {value: new THREE.Color(0x7ea4a6)}, uBase: {value: 0.11},
        uEdge: {value: new THREE.Color(0x1d2526)}, uEdgeK: {value: 0.55}},
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide});
    const mesh = new THREE.Mesh(paneGeometry(P), m);
    mesh.renderOrder = 10;                     // after the river (renderOrder 1), which would otherwise cover it
    mesh.frustumCulled = false; CK.group.add(mesh);
    return mesh;
  });
}
