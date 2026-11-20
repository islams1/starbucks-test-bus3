// The brass balance beside the model: one pan holds the added labor for a year (an iron weight, $21,600), the other
// a coin for every $1,080 the extra orders add in a year (one order a day at $3 for 360 days). The beam tips with the
// annual effect: level when the orders cover the labor exactly.
import * as THREE from 'three';
import {scene, onUpdate, clamp} from '../core/engine.js';
import {canvasTex} from './materials.js';
import {TABLE} from './room.js';

export const BAL = {root: new THREE.Group(), coins: 0, target: -1, angle: -0.3, vel: 0};     // no orders yet: the labor pan is down
const COIN_VALUE = 1080, MAX_COINS = 44;
const brass = () => new THREE.MeshStandardMaterial({color: 0xc39a5b, roughness: 0.28, metalness: 1});

export function buildScale() {
  const R = BAL.root; R.name = 'balance';
  // on the model's west side (left from the player's seat): the tablet will be held on the right
  R.position.set(TABLE.x - 1.15, TABLE.y, TABLE.z + 0.05); R.rotation.y = 0;
  const B = brass(), dark = new THREE.MeshStandardMaterial({color: 0x2a2b2d, roughness: 0.5, metalness: 0.6});
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.018, 40), B); foot.position.y = 0.009; R.add(foot);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.009, 0.27, 12), B); col.position.y = 0.018 + 0.135; R.add(col);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 12), B); cap.position.y = 0.29; R.add(cap);
  // the beam pivots at the top of the column
  const beam = new THREE.Group(); beam.position.y = 0.29; R.add(beam);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.008, 0.008), B); beam.add(bar);
  const pointer = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.07, 0.004), B); pointer.position.y = -0.035; beam.add(pointer);
  // a small scale behind the pointer: level = covers the cost
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.0025, 6, 24, Math.PI / 3), B); arc.rotation.z = -Math.PI / 2 - Math.PI / 6; arc.position.set(0, 0.29, -0.012); R.add(arc);
  const ends = [-0.17, 0.17].map(x => { const o = new THREE.Object3D(); o.position.x = x; beam.add(o); return o; });
  // pans hang from the beam ends and stay level
  const pans = ends.map((end, i) => {
    const g = new THREE.Group(); R.add(g);
    const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.05, 0.012, 32, 1, true), B); pan.material.side = THREE.DoubleSide; g.add(pan);
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.05, 32), B); bottom.rotation.x = -Math.PI / 2; bottom.position.y = -0.006; g.add(bottom);
    for (let k = 0; k < 3; k++) {
      const a = k / 3 * Math.PI * 2, x = Math.cos(a) * 0.052, z = Math.sin(a) * 0.052;
      const len = 0.15, rod = new THREE.Mesh(new THREE.CylinderGeometry(0.0009, 0.0009, len, 4), B);
      rod.position.set(x / 2, len / 2, z / 2); rod.lookAt(new THREE.Vector3(0, len, 0)); rod.rotateX(Math.PI / 2); g.add(rod);
      rod.position.set(x * 0.5, 0.075, z * 0.5);
      rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-x, 0.15, -z).normalize());
    }
    g.userData.end = end; return g;
  });
  BAL.pans = pans;
  // the labor weight (east pan, the right one from the player's seat)
  const lab = canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#2a2b2d'; g.fillRect(0, 0, w, h); g.fillStyle = '#e9dcc0'; g.font = '700 52px Inter'; g.textAlign = 'center'; g.fillText('$21,600', w / 2, 70); g.font = '500 30px "IBM Plex Sans Arabic"'; g.fillText('عمالة / سنة', w / 2, 112); });
  const wt = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.045, 0.045), [dark, dark, dark, dark, new THREE.MeshStandardMaterial({map: lab, roughness: 0.5}), dark]);
  wt.position.y = 0.0225; wt.castShadow = true; pans[1].add(wt);
  // coins (west pan): up to MAX_COINS in four stacks
  const coinGeo = new THREE.CylinderGeometry(0.0125, 0.0125, 0.0028, 20);
  const coins = new THREE.InstancedMesh(coinGeo, brass(), MAX_COINS); coins.castShadow = true; pans[0].add(coins);
  const m = new THREE.Matrix4(), stacks = [[-0.02, -0.015], [0.016, -0.02], [-0.008, 0.02], [0.024, 0.016]];
  let shown = -1;
  const drawCoins = (n) => {
    const full = Math.floor(n), part = n - full;
    for (let i = 0; i < MAX_COINS; i++) {
      const s = stacks[i % 4], lvl = Math.floor(i / 4);
      const k = i < full ? 1 : i === full ? part : 0;
      m.makeScale(k > 0 ? 1 : 0, k > 0 ? Math.max(0.25, k) : 0, k > 0 ? 1 : 0);
      m.setPosition(s[0] + Math.sin(i * 1.7) * 0.001, 0.0015 + lvl * 0.0029, s[1] + Math.cos(i * 2.3) * 0.001);
      coins.setMatrixAt(i, m);
    }
    coins.instanceMatrix.needsUpdate = true;
  };
  drawCoins(0);
  // little brass tags on the hangers
  const tag = (txt) => canvasTex(256, 72, (g, w, h) => { g.fillStyle = '#c39a5b'; g.fillRect(0, 0, w, h); g.fillStyle = '#3a2a18'; g.font = '600 34px "IBM Plex Sans Arabic"'; g.textAlign = 'center'; g.fillText(txt, w / 2, 48); });
  const t0 = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.02), new THREE.MeshStandardMaterial({map: tag('ما تضيفه الطلبات'), metalness: 0.6, roughness: 0.4})); t0.position.set(0, 0.03, 0.06); t0.rotation.x = -0.3; pans[0].add(t0);
  R.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(R);
  const _p = new THREE.Vector3();
  onUpdate((dt) => {
    // a lightly damped spring: the beam settles with a little sway, like a real balance
    const want = clamp(BAL.target, -1, 1) * 0.3;
    BAL.vel += ((want - BAL.angle) * 26 - BAL.vel * 5.5) * Math.min(dt, 0.05);
    BAL.angle += BAL.vel * Math.min(dt, 0.05);
    beam.rotation.z = BAL.angle;
    beam.updateMatrixWorld(true);
    for (const p of pans) { p.userData.end.getWorldPosition(_p); R.worldToLocal(_p); p.position.set(_p.x, _p.y - 0.15, _p.z); }
    if (Math.abs(BAL.coins - shown) > 0.004) { shown += (BAL.coins - shown) * Math.min(1, dt * 7); if (Math.abs(BAL.coins - shown) < 0.01) shown = BAL.coins; drawCoins(shown); }
  });
  return R;
}
/** orders a day × contribution → coins and the tilt (positive = the orders' pan goes down) */
export function setBalance(orders, contrib) {
  const yearly = orders * 360 * contrib;
  BAL.coins = Math.min(MAX_COINS, yearly / COIN_VALUE);
  BAL.target = (yearly - 21600) / 21600;
}
export const balanceAnchor = () => BAL.root.localToWorld(new THREE.Vector3(0, 0.3, 0));
