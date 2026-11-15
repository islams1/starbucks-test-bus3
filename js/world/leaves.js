// Falling leaves: detach from the plaza trees, flutter down in the wind, settle, skitter with gusts, recycle.
import * as THREE from 'three';
import {scene, onUpdate, camera} from '../core/engine.js';
import {canvasTex} from './materials.js';
import {trees} from './city.js';
import {quality} from '../core/quality.js';

const N = 260;
let mesh = null;
const L = [];
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
export const wind = {x: 0.9, z: 0.25, gust: 0};

function leafTexture() {
  return canvasTex(128, 128, (g, W, H) => {
    g.clearRect(0, 0, W, H);
    const cols = ['#6f8a3a', '#8a9a3e', '#b0923a', '#a8702c', '#7b5a2a', '#5d7a32'];
    for (let i = 0; i < 4; i++) {        // 2x2 atlas of leaf shapes/colours
      const ox = (i % 2) * 64, oy = Math.floor(i / 2) * 64;
      g.save(); g.translate(ox + 32, oy + 32); g.rotate(0.6);
      g.fillStyle = cols[(i * 2 + 1) % cols.length];
      g.beginPath(); g.moveTo(0, -26); g.bezierCurveTo(18, -14, 16, 14, 0, 26); g.bezierCurveTo(-16, 14, -18, -14, 0, -26); g.fill();
      g.strokeStyle = 'rgba(40,30,10,.55)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, -24); g.lineTo(0, 26); g.stroke();
      g.restore();
    }
  });
}
function spawn(l, fromTree = true) {
  const t = trees.length ? trees[(Math.random() * trees.length) | 0] : null;
  if (fromTree && t) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * 2.6;
    l.p.set(t.position.x + Math.cos(a) * r, 3.2 + Math.random() * 3.5, t.position.z + Math.sin(a) * r);
  } else l.p.set((Math.random() - 0.5) * 60, 0.02, 12 + Math.random() * 26);
  l.v.set(0, -0.6 - Math.random() * 0.5, 0);
  l.ph = Math.random() * 10; l.f = 1.5 + Math.random() * 2.5; l.rest = 0; l.state = fromTree ? 'fall' : 'ground';
  l.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
  l.spin.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
  l.size = 0.1 + Math.random() * 0.08;
}
export function buildLeaves() {
  const tex = leafTexture();
  const geo = new THREE.PlaneGeometry(1, 1);
  const mat = new THREE.MeshStandardMaterial({map: tex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8});
  // pick one of the four atlas cells per instance through a per-instance UV offset
  const cell = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) { cell[i * 2] = (i % 2) * 0.5; cell[i * 2 + 1] = Math.floor((i % 4) / 2) * 0.5; }
  geo.setAttribute('cell', new THREE.InstancedBufferAttribute(cell, 2));
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = 'attribute vec2 cell;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\n vMapUv = uv * 0.5 + cell;\n#endif');
  };
  mesh = new THREE.InstancedMesh(geo, mat, N);
  mesh.castShadow = true; mesh.frustumCulled = false; mesh.name = 'leaves';
  scene.add(mesh);
  for (let i = 0; i < N; i++) { const l = {p: new THREE.Vector3(), v: new THREE.Vector3(), rot: new THREE.Vector3(), spin: new THREE.Vector3()}; spawn(l, i % 3 !== 0); if (l.state === 'fall') l.p.y = Math.random() * 6; L.push(l); }
  let t = 0;
  onUpdate((dt) => {
    if (!mesh || dt <= 0) return;
    t += dt;
    const active = quality.level === 'cpu' ? 60 : N;
    mesh.count = active;
    if (camera.position.z < 4 && camera.position.y < 4) return;   // deep inside the building: nothing to see, skip the work
    wind.gust = Math.max(0, Math.sin(t * 0.23) * Math.sin(t * 0.61 + 1)) * 2.2;
    const wx = wind.x * (1 + wind.gust), wz = wind.z * (1 + wind.gust * 0.5);
    for (let i = 0; i < active; i++) {
      const l = L[i];
      if (l.state === 'fall') {
        l.ph += dt * l.f;
        l.p.x += (wx + Math.sin(l.ph) * 0.7) * dt;
        l.p.z += (wz + Math.cos(l.ph * 0.8) * 0.5) * dt;
        l.p.y += (l.v.y + Math.sin(l.ph * 2) * 0.25) * dt;
        l.rot.x += l.spin.x * dt; l.rot.y += l.spin.y * dt; l.rot.z += l.spin.z * dt;
        if (l.p.y <= 0.02) { l.p.y = 0.02; l.state = 'ground'; l.rest = 6 + Math.random() * 14; l.rot.x = -Math.PI / 2 + (Math.random() - 0.5) * 0.3; }
      } else {
        l.rest -= dt;
        if (wind.gust > 1.2 && Math.random() < 0.02) { l.p.x += wx * dt * 6; l.p.z += wz * dt * 6; l.rot.z += dt * 8; }   // skitter along the ground in a gust
        if (l.rest <= 0) spawn(l, true);
      }
      if (Math.abs(l.p.x) > 70 || l.p.z > 60 || l.p.z < 10.5) spawn(l, true);
      _e.set(l.rot.x, l.rot.y, l.rot.z); _q.setFromEuler(_e); _s.setScalar(l.size); _p.copy(l.p);
      mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
}
