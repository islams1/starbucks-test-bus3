// The heart: "Realistic Human Heart" by neshallads (Sketchfab, CC BY 4.0) — a textured, wet, anatomically shaped heart
// with its great vessels — placed in the pericardial well the way it lies in the chest (apex forwards and to the
// patient's left). It beats with the monitor's heart rate, stops after cardioplegia, writhes in VF and can be lifted.
// The places the surgeon works on (LAD, aorta, right atrium, paddle spots) are found on the model's own surface.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {onUpdate, clock} from '../core/engine.js';
import {vit} from './monitor.js';
import {CHEST} from './room.js';

export const H = {group: null, state: 'beating', fib: 0, arrest: 0, lift: 0, liftT: 0, decomp: 0, grafts: {}};
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const SCALE = 0.1;                                  // model units → metres (≈16 cm from the arch to the apex)
export const HEART_OFFSET = V(0.004, -0.08, -0.006);     // behind the lower sternum, under the real chest wall (tools/build_thorax.py carves the lungs round it here)
const ray = new THREE.Raycaster();

function animate(mat, U) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'uniform float uTime; uniform float uFib; uniform float uBeat; uniform vec3 uC;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      { vec3 d = transformed - uC;
        float vent = smoothstep(-0.035, 0.02, transformed.x);                   // ventricles (towards the apex) squeeze, the great vessels barely move
        transformed -= d * (0.08 * uBeat * vent);
        vec3 r = normalize(d + vec3(1e-4));
        float w = sin(transformed.x * 260.0 + uTime * 41.0) * sin(transformed.z * 310.0 - uTime * 37.0) + 0.6 * sin(transformed.y * 420.0 + uTime * 53.0);
        transformed += r * w * 0.0012 * uFib * vent; }`);
  };
  mat.customProgramCacheKey = () => 'heartBeatSF';
}

export async function buildHeart(parent) {
  const gltf = await new GLTFLoader().loadAsync('assets/or_models/heart_realistic/model.gltf');
  let src = null; gltf.scene.updateMatrixWorld(true); gltf.scene.traverse(o => { if (o.isMesh) src = o; });
  // bake the model into metres in the body frame: model +Y (up, aorta) → -x (towards the head), +Z (front) → +y, +X (patient's left) → -z
  const geo = src.geometry.clone(); geo.applyMatrix4(src.matrixWorld);
  geo.applyMatrix4(new THREE.Matrix4().makeBasis(V(0, 0, -1), V(-1, 0, 0), V(0, 1, 0)).multiply(new THREE.Matrix4().makeScale(SCALE, SCALE, SCALE)));
  geo.computeBoundingBox(); const c = geo.boundingBox.getCenter(V()); geo.translate(-c.x, -c.y, -c.z); geo.computeBoundingBox();
  H.bbox = geo.boundingBox.clone();
  const G = new THREE.Group(); H.group = G; G.position.copy(CHEST).add(HEART_OFFSET);
  G.rotation.set(0, 0.42, 0.3, 'YXZ');               // apex towards the patient's left and up towards the sternum
  const pivot = new THREE.Group(); pivot.position.set(-0.045, 0, 0); G.add(pivot); H.pivot = pivot;   // lifting turns about the base
  const body = new THREE.Group(); body.position.set(0.045, 0, 0); pivot.add(body); H.body = body;
  const U = {uTime: {value: 0}, uFib: {value: 0}, uBeat: {value: 0}, uC: {value: V(0.04, 0, 0)}};
  H.U = U;
  const mat = src.material.clone(); mat.envMapIntensity = 0.7; if (mat.isMeshStandardMaterial) mat.roughness = Math.min(mat.roughness, 0.5);
  animate(mat, U); H.mat = mat; H.baseColor = mat.color.clone();
  const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; mesh.receiveShadow = true; body.add(mesh); H.mesh = mesh;
  H.pick = [mesh];
  // the closed pericardium: a glistening sac shrink-wrapped round the heart (an inflated copy of its surface),
  // translucent enough to see the heart move inside; field.js fades it out when the pericardium is opened
  {
    let pg = new THREE.BufferGeometry(); pg.setAttribute('position', geo.attributes.position.clone()); pg.setIndex(geo.index ? geo.index.clone() : null);
    pg = mergeVertices(pg, 1e-4); pg.computeVertexNormals();
    const pp = pg.attributes.position, pn = pg.attributes.normal;
    for (let it = 0; it < 2; it++) {                                    // smooth the wrinkles of the vessels away a little
      const acc = new Float32Array(pp.count * 3), cnt = new Uint16Array(pp.count), ix = pg.index.array;
      for (let i = 0; i < ix.length; i += 3) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) if (a !== b) { const u = ix[i + a], v = ix[i + b]; acc[u * 3] += pp.getX(v); acc[u * 3 + 1] += pp.getY(v); acc[u * 3 + 2] += pp.getZ(v); cnt[u]++; }
      for (let i = 0; i < pp.count; i++) if (cnt[i]) pp.setXYZ(i, pp.getX(i) * 0.5 + acc[i * 3] / cnt[i] * 0.5, pp.getY(i) * 0.5 + acc[i * 3 + 1] / cnt[i] * 0.5, pp.getZ(i) * 0.5 + acc[i * 3 + 2] / cnt[i] * 0.5);
      pg.computeVertexNormals();
    }
    for (let i = 0; i < pp.count; i++) pp.setXYZ(i, pp.getX(i) + pn.getX(i) * 0.005, pp.getY(i) + pn.getY(i) * 0.005, pp.getZ(i) + pn.getZ(i) * 0.005);
    pg.computeVertexNormals();
    const pm = new THREE.MeshPhysicalMaterial({color: 0xa06a60, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1, transparent: true, opacity: 0.45, depthWrite: false, envMapIntensity: 0.45});
    H.peri = new THREE.Mesh(pg, pm); H.peri.renderOrder = 2; G.add(H.peri);
  }
  parent.add(G); G.updateMatrixWorld(true);

  // ---- landmarks on the real surface
  const hit = (from, dir) => { ray.set(from, dir.clone().normalize()); const h = ray.intersectObject(mesh, false)[0]; return h ? h.point.clone() : null; };
  const down = (wx, wz) => hit(V(wx, CHEST.y + 0.3, wz), V(0, -1, 0));
  const toBody = (p) => body.worldToLocal(p.clone());
  const w = (bx, by, bz) => body.localToWorld(V(bx, by, bz));           // a body-space point in the world
  const bb = H.bbox;
  // LAD: the anterior interventricular groove runs from the base towards the apex, left of the middle
  const ladW = w(bb.min.x + (bb.max.x - bb.min.x) * 0.66, 0, -0.012);
  const lad = down(ladW.x, ladW.z) || w(0.03, bb.max.y, -0.012);
  const pdaW = w(bb.max.x - 0.02, 0, 0.018), pda = hit(V(pdaW.x, pdaW.y - 0.01, pdaW.z + 0.15), V(0, -0.15, -1)) || w(0.05, 0, 0.03);
  const omW = w(bb.min.x + (bb.max.x - bb.min.x) * 0.6, 0, -0.04), om = hit(V(omW.x, omW.y + 0.02, omW.z - 0.15), V(0, -0.1, 1)) || w(0.03, 0, -0.045);
  H.targets = {LAD: toBody(lad), PDA: toBody(pda), OM: toBody(om)};
  // the ascending aorta: top of the great vessels, a little to the patient's right of the midline
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8, bx = bb.min.x + 0.012 + t * 0.05; let best = null;
    for (let dz = -0.004; dz <= 0.03; dz += 0.004) { const q = w(bx, 0, dz), h = down(q.x, q.z); if (h && (!best || h.y > best.y)) best = h; }
    if (best) pts.push(best);
  }
  pts.reverse();                                      // root (towards the heart) first … towards the arch last
  H.aortaR = 0.013;
  H.aortaCurve = new THREE.CatmullRomCurve3(pts.map(p => G.worldToLocal(p.clone().add(V(0, -H.aortaR, 0)))));
  // right atrium: front of the right side of the base
  const raW = w(bb.min.x + (bb.max.x - bb.min.x) * 0.42, 0, 0.038), raH = down(raW.x, raW.z) || w(0, bb.max.y * 0.6, 0.035);
  H.ra = new THREE.Object3D(); H.ra.position.copy(toBody(raH)); body.add(H.ra);
  // paddle spots: the lateral wall of the left ventricle and the free wall of the right ventricle
  const vx = bb.min.x + (bb.max.x - bb.min.x) * 0.72;
  const pA = hit(w(vx, 0.005, -0.2), V(0, 0, 1)) || w(vx, 0, -0.045), qB = w(vx, 0, 0.022), pB = down(qB.x, qB.z) || w(vx, bb.max.y, 0.02);
  H.paddle = {A: toBody(pA), B: toBody(pB)};
  console.info('[heart] landmarks', JSON.stringify({lad: lad.toArray().map(v => +v.toFixed(3)), aorta: pts.length, ra: raH.toArray().map(v => +v.toFixed(3))}));

  let ph = 0;
  onUpdate((dt) => {
    U.uTime.value = clock.t;
    const beating = vit.rhythm === 'sinus' && H.arrest < 0.5;
    ph = (ph + dt * (beating ? vit.hr / 60 : 0)) % 1;
    const sys = beating ? Math.pow(Math.max(0, Math.sin(Math.min(1, ph / 0.38) * Math.PI)), 1.4) : 0;
    const strength = 1 - H.decomp * 0.6;
    U.uBeat.value = sys * strength;
    H.fib += ((vit.rhythm === 'vf' ? 1 : 0) - H.fib) * Math.min(1, dt * 6); U.uFib.value = H.fib;
    body.rotation.x = 0.035 * sys * strength;             // the slight wringing motion of systole
    mat.color.copy(H.baseColor).multiplyScalar(1 + 0.15 * H.arrest);   // the arrested heart is paler
    body.scale.setScalar(1 + 0.03 * H.decomp);
    H.liftT += (H.lift - H.liftT) * Math.min(1, dt * 2.5);
    pivot.rotation.z = H.liftT * 0.65;
    pivot.position.z = H.liftT * 0.03; pivot.rotation.x = -H.liftT * 0.35;
    G.position.y = CHEST.y + HEART_OFFSET.y + 0.004 * Math.sin(clock.t * 2 * Math.PI / 5) * (vit.ventilating && vit.bypass < 0.5 ? 1 : 0);
  });
  return H;
}
/** world position of a local heart point (body or group space) */
export function worldOf(local, space = 'body') { const v = local.clone(); (space === 'body' ? H.body : H.group).localToWorld(v); return v; }
/** a point on the centre line of the visible ascending aorta (k 0 = root … 1 = towards the arch), world space */
export function aortaPoint(k) { const p = H.aortaCurve.getPointAt(Math.max(0, Math.min(1, k))); H.group.localToWorld(p); return p; }
/** outward direction of the heart surface at a body-space point */
export const outward = (p) => p.clone().sub(V(0.01, -0.01, 0)).normalize();
/** the i-th of n stitch points around the LAD arteriotomy (world) */
export function stitchPoint(i, n = 8) {
  const t = H.targets.LAD, nrm = outward(t), along = V(1, 0, -0.3).normalize(); along.addScaledVector(nrm, -along.dot(nrm)).normalize();
  const side = V().crossVectors(nrm, along), a = i / n * Math.PI * 2;
  return worldOf(t.clone().addScaledVector(along, Math.cos(a) * 0.009).addScaledVector(side, Math.sin(a) * 0.004).addScaledVector(nrm, 0.0015));
}
/** where the two internal paddles go: 'A' the left ventricle's lateral wall, 'B' the right ventricle (world) */
export function paddleSpot(side, lift = 0.006) { const p = H.paddle[side]; return worldOf(p.clone().addScaledVector(outward(p), lift)); }
const vessel = (pts, r, col) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.max(24, pts.length * 10), r, 10, false),
  new THREE.MeshPhysicalMaterial({color: col, roughness: 0.32, clearcoat: 0.9, clearcoatRoughness: 0.2, envMapIntensity: 0.55}));
const above = (p, h) => p.clone().addScaledVector(outward(p), h);
/** add a graft: LIMA from the left chest wall to the LAD, or a vein from the aorta; kinked = with a sharp bend */
export function addGraft(name, kind, kinked = false) {
  const t = H.targets[name], b = H.bbox;
  const aortaBody = (k, side) => { const p = H.aortaCurve.getPointAt(k).clone(); p.y += H.aortaR; p.z += side; return H.body.worldToLocal(H.group.localToWorld(p)); };
  const mid = (a, c, h) => above(a.clone().lerp(c, 0.5), h);
  let pts;
  if (kind === 'lima') { const s = V(b.min.x + 0.01, b.max.y + 0.02, -0.06); pts = [s, mid(s, t, 0.02), above(t, 0.006), t]; }
  else {
    const s = aortaBody(0.45, name === 'PDA' ? 0.008 : -0.008);
    if (kinked) { const m1 = mid(s, t, 0.03), m2 = above(s.clone().lerp(t, 0.68), 0.004), m3 = above(s.clone().lerp(t, 0.78), 0.028); pts = [s, m1, m2, m3, above(t, 0.01), t]; }
    else pts = [s, mid(s, t, 0.02), above(s.clone().lerp(t, 0.8), 0.01), t];
  }
  const mesh = vessel(pts, kind === 'lima' ? 0.0017 : 0.0026, kind === 'lima' ? 0xbf5e5a : 0x8a3a4a);
  mesh.castShadow = true;
  if (H.grafts[name]) H.body.remove(H.grafts[name]);
  H.body.add(mesh); H.grafts[name] = mesh;
  return mesh;
}
