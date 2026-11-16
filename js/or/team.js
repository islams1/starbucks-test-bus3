// The theatre team and the patient: medical Rocketbox avatars placed where they really stand, theatre caps and masks
// fitted to the anaesthetist's and the scrub nurse's heads (the library's female avatars have none), the patient lying supine.
import * as THREE from 'three';
import {Character, characters} from '../actors/character.js';
import {CHEST} from './room.js';
import {onUpdate} from '../core/engine.js';
import {setupAssistant} from './assistant.js';

export const T = {};
export const CAST = {
  player:  {avatar: 'Medical_Male_05', gender: 'm', height: 1.8},
  layla:   {avatar: 'Medical_Female_02', gender: 'f', height: 1.66, idle: 'f_idle_neutral_01', talkAnims: ['f_gestic_talk_neutral_01', 'f_gestic_talk_relaxed_01'], cap: 0x5f97b8},
  karim:   {avatar: 'Medical_Male_04', gender: 'm', height: 1.78, idle: 'm_work_table', talkAnims: ['m_gestic_talk_neutral_01']},
  rania:   {avatar: 'OR_Female_Scrub', gender: 'f', height: 1.64, idle: 'f_work_table', talkAnims: ['f_gestic_talk_neutral_02'], cap: 0x34608f},
  haddad:  {avatar: 'Medical_Male_05', gender: 'm', height: 1.82, idle: 'm_idle_neutral_01', talkAnims: ['m_gestic_talk_neutral_02']},
  patient: {avatar: 'Male_Adult_03', gender: 'm', height: 1.76, idle: 'm_idle_neutral_01', talks: true},
  huda:    {avatar: 'Medical_Female_01', gender: 'f', height: 1.65, idle: 'f_idle_neutral_01', talkAnims: ['f_gestic_talk_neutral_01']},
  assist:  {avatar: 'Medical_Male_05', gender: 'm', height: 1.79, idle: 'm_idle_neutral_01', talkAnims: ['m_gestic_talk_neutral_01']},
};

/** the head's shape, measured on the skin that moves with it (hair cards left out), in the character's frame:
 *  S = side, U = up, F = forward (world, metres, from the head bone) */
function headShape(ch) {
  // measured in the bind pose (the avatar standing straight, facing +z, y up), whatever the animation is doing now;
  // everything built from it lives in the head bone's own space, so it stays on the head
  const mesh = ch.mesh, sk = mesh.skeleton, head = ch.bones.head, geo = mesh.geometry;
  ch.holder.updateMatrixWorld(true);
  const binv = sk.boneInverses[sk.bones.indexOf(head)];
  const hb0 = new THREE.Vector3().setFromMatrixPosition(binv.clone().invert());
  const kS = new THREE.Vector3().setFromMatrixScale(mesh.matrixWorld).x / new THREE.Vector3().setFromMatrixScale(mesh.bindMatrix).x;   // bind units → metres
  const under = (b) => { for (let x = b; x; x = x.parent) if (x === head) return true; return false; };
  const hb = sk.bones.map(under);
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const hairVert = new Uint8Array(geo.attributes.position.count), index = geo.index;
  for (const g of geo.groups) if (mats[g.materialIndex] && mats[g.materialIndex].alphaTest > 0) for (let i = g.start; i < g.start + g.count; i++) hairVert[index ? index.getX(i) : i] = 1;
  const si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, n = geo.attributes.position.count;
  // the bind pose's own axes, from the skeleton: up = neck → head, the right hand side = left → right shoulder
  const bindPos = (b) => new THREE.Vector3().setFromMatrixPosition(sk.boneInverses[sk.bones.indexOf(b)].clone().invert());
  const B = (nm) => sk.getBoneByName(nm);
  const U = hb0.clone().sub(bindPos(B('Bip01_Neck') || head.parent)).normalize();
  const R = bindPos(B('Bip01_R_UpperArm')).sub(bindPos(B('Bip01_L_UpperArm'))); R.addScaledVector(U, -R.dot(U)).normalize();
  const F = new THREE.Vector3().crossVectors(U, R).normalize(), S = new THREE.Vector3().crossVectors(U, F);
  const v = new THREE.Vector3(), pts = [], all = [];
  for (let i = 0; i < n; i++) {
    let w = 0; for (let k = 0; k < 4; k++) if (hb[si.getComponent(i, k)]) w += sw.getComponent(i, k);
    if (w < 0.7 && !hairVert[i]) continue;
    v.fromBufferAttribute(geo.attributes.position, i).applyMatrix4(mesh.bindMatrix).sub(hb0).multiplyScalar(kS);
    const c = [v.dot(S), v.dot(U), v.dot(F), i]; all.push(c); if (!hairVert[i] && w >= 0.7) pts.push(c);
  }
  /** side, up, forward (m, from the head joint) → the head bone's local space */
  const at = (sd, u, f) => S.clone().multiplyScalar(sd).addScaledVector(U, u).addScaledVector(F, f).divideScalar(kS).add(hb0).applyMatrix4(binv);
  const pct = (k, q) => { const a = pts.map(c => c[k]).sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(q * a.length))]; };
  const nose = pts.reduce((m, c) => c[2] > m[2] ? c : m, pts[0]);                      // the most forward skin point
  const front = pts.filter(c => c[2] > nose[2] - 0.05 && Math.abs(c[0] - nose[0]) < 0.04);
  const chinU = front.reduce((m, c) => Math.min(m, c[1]), 9);
  return {at, pts, all, hairVert, top: pct(1, 0.995), back: pct(2, 0.01), sL: pct(0, 0.01), sR: pct(0, 0.99), nose, chinU};
}
/** theatre cap (bouffant, all the hair tucked in) and a pleated surgical mask, fitted to this head and worn on it */
function capAndMask(ch, color, {mask = true} = {}) {
  const H = headShape(ch), at = H.at;
  const head = ch.bones.head;
  const noseU = H.nose[1], noseF = H.nose[2], cs = (H.sL + H.sR) / 2;
  const brow = noseF - 0.03, cf = (H.back + brow) / 2;
  const cu = noseU + 0.035;                                                              // about the level of the ears
  const rs = (H.sR - H.sL) / 2 + 0.016, ru = H.top - cu + 0.016, rf = (brow - H.back) / 2 + 0.02;
  const hairline = noseU + 0.1, nape = noseU - 0.05;
  const tF = Math.acos(Math.max(-1, Math.min(1, (hairline - cu) / ru))), tB = Math.acos(Math.max(-1, Math.min(1, (nape - cu) / ru)));
  // cap: a dome from the crown down to the hairline in front and the nape behind, roomy at the back
  const NI = 48, NJ = 18, pos = [], idx = [];
  for (let i = 0; i <= NI; i++) {
    const ph = (i / NI) * Math.PI * 2, fr = (1 + Math.cos(ph)) / 2;                    // fr = 1 front, 0 back
    const tMax = tB + (tF - tB) * fr * fr;
    for (let j = 0; j <= NJ; j++) {
      const th = (j / NJ) * tMax, edge = j === NJ;
      const puff = 1 + 0.08 * Math.sin(th) * (1 - fr) + 0.01 * Math.sin(ph * 23 + j * 0.7) * Math.sin(th);   // bouffant + soft pleats
      const k = (edge ? 0.955 : 1) * puff;                                               // the elastic hem pulls in
      const p = at(cs + rs * k * Math.sin(th) * Math.sin(ph), cu + ru * k * Math.cos(th), cf + rf * k * Math.sin(th) * Math.cos(ph));
      pos.push(p.x, p.y, p.z);
    }
  }
  for (let i = 0; i < NI; i++) for (let j = 0; j < NJ; j++) { const a = i * (NJ + 1) + j, b = a + NJ + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); cg.setIndex(idx); cg.computeVertexNormals();
  const cloth = (c) => new THREE.MeshStandardMaterial({color: c, roughness: 0.96, side: THREE.DoubleSide});
  const cap = new THREE.Mesh(cg, cloth(color)); cap.castShadow = true; head.add(cap);
  // the hair goes inside the cap: drop the hair cards that would hang out of it (lashes and brows stay)
  {
    const geo = ch.mesh.geometry, ix = geo.index, keep = [], groups = [];
    const out = new Uint8Array(geo.attributes.position.count);
    for (const c of H.all) if (H.hairVert[c[3]] && !(c[2] > noseF - 0.05 && c[1] < hairline - 0.01 && c[1] > noseU - 0.01 && Math.abs(c[0] - cs) < 0.065)) out[c[3]] = 1;   // keep lashes and brows only
    // a solid ponytail / bun is its own island in the head texture (bottom right of the atlas): drop it where it hangs behind the head
    const uv = geo.attributes.uv; for (const c of H.all) if (!H.hairVert[c[3]] && c[2] < cf - 0.02 && uv.getX(c[3]) > 0.47 && uv.getY(c[3]) < 0.36) out[c[3]] = 1;
    for (const g of geo.groups) { const s0 = keep.length; for (let i = g.start; i < g.start + g.count; i += 3) { const a = ix ? ix.getX(i) : i, b = ix ? ix.getX(i + 1) : i + 1, c = ix ? ix.getX(i + 2) : i + 2; if (!(out[a] && out[b] && out[c])) keep.push(a, b, c); } groups.push([s0, keep.length - s0, g.materialIndex]); }
    geo.setIndex(keep); geo.clearGroups(); for (const [s0, c, m] of groups) geo.addGroup(s0, c, m);
  }
  if (!mask) return;
  // mask: from the bridge of the nose to under the chin, cheek to cheek. Each row drapes over the face like the real
  // thing: the convex envelope of the skin at that height (touching the nose and cheekbones, bridging the hollows)
  const uTop = noseU + 0.03, uBot = H.chinU - 0.004;
  const MI = 30, MJ = 20, rows = [];
  for (let j = 0; j <= MJ; j++) {
    const t = j / MJ, u = uTop + (uBot - uTop) * Math.min(1, t / 0.86);
    let P = H.pts.filter(c => Math.abs(c[1] - u) < 0.007 && c[2] > cf + 0.01);
    if (P.length < 6) P = rows.length ? rows[rows.length - 1].P : H.pts.filter(c => c[2] > cf + 0.01);
    P = P.map(c => [c[0], c[2]]).sort((x, y) => x[0] - y[0]);
    const hull = []; for (const p of P) { while (hull.length > 1) { const [o, q] = [hull[hull.length - 2], hull[hull.length - 1]]; if ((q[0] - o[0]) * (p[1] - o[1]) - (q[1] - o[1]) * (p[0] - o[0]) >= 0) hull.pop(); else break; } hull.push(p); }
    const fAt = (x) => { if (x <= hull[0][0]) return hull[0][1]; for (let k = 1; k < hull.length; k++) if (x <= hull[k][0]) { const [a0, b0] = [hull[k - 1], hull[k]]; return a0[1] + (b0[1] - a0[1]) * (x - a0[0]) / (b0[0] - a0[0] || 1); } return hull[hull.length - 1][1]; };
    const sMin = Math.max(P[0][0] + 0.006, cs - 0.078), sMax = Math.min(P[P.length - 1][0] - 0.006, cs + 0.078);
    rows.push({P: P.map(p => [p[0], u, p[1]]), u, t, sMin, sMax, fAt});
  }
  const mp = [], mi = [], grid = [];
  for (let j = 0; j <= MJ; j++) { const r = rows[j]; grid.push([]); for (let i = 0; i <= MI; i++) { const x = r.sMin + (r.sMax - r.sMin) * i / MI; grid[j].push([x, r.u, r.fAt(x) + 0.009]); } }
  for (let pass = 0; pass < 3; pass++) for (let j = 1; j < MJ; j++) for (let i = 0; i <= MI; i++) grid[j][i][2] = Math.max(grid[j][i][2], (grid[j - 1][i][2] + grid[j + 1][i][2]) / 2);   // no dents between rows
  for (let i = 0; i <= MI; i++) for (let j = 0; j <= MJ; j++) {
    const t = j / MJ, [x, u, f0] = grid[j][i], side = Math.abs((i / MI) * 2 - 1);
    let f = f0 + 0.0025 * Math.max(0, Math.sin(t * Math.PI * 3.5)) * (1 - side * 0.6), uu = u;          // three pleats
    if (t > 0.86) { const k = (t - 0.86) / 0.14; f -= 0.04 * k * k; uu -= 0.012 * k; }                  // tucks under the chin
    const p = at(x, uu, f); mp.push(p.x, p.y, p.z);
  }
  for (let i = 0; i < MI; i++) for (let j = 0; j < MJ; j++) { const a = i * (MJ + 1) + j, b = a + MJ + 1; mi.push(a, b, a + 1, b, b + 1, a + 1); }
  const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.Float32BufferAttribute(mp, 3)); mg.setIndex(mi); mg.computeVertexNormals();
  const m = new THREE.Mesh(mg, cloth(0x9fc7da)); m.castShadow = true; head.add(m);
  // ear loops, from the mask's corners round the back of the ears
  for (const sd of [-1, 1]) {
    const iE = sd < 0 ? 0 : MI, top = grid[0][iE], bot = grid[Math.round(MJ * 0.8)][iE];
    const lp = [at(top[0], top[1], top[2]), at(cs + sd * (rs - 0.006), noseU + 0.04, cf - 0.012), at(cs + sd * (rs - 0.012), noseU - 0.01, cf - 0.03), at(bot[0], bot[1], bot[2])];
    const loop = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lp), 16, 0.0011, 5), cloth(0xe9eef0)); head.add(loop);
  }
}

export async function loadTeam() {
  const ids = Object.keys(CAST);
  for (let i = 0; i < ids.length; i += 2) {
    await Promise.all(ids.slice(i, i + 2).map(async id => {
      const c = CAST[id];
      const ch = await Character.create(id, c.avatar, {gender: c.gender, height: c.height, talks: c.talks !== false, talkAnims: c.talkAnims});
      ch.o.talkAnims = c.talkAnims; ch.idle = c.idle; T[id] = ch;
    }));
  }
  // positions
  const place = (id, x, z, ry, anim) => { const ch = T[id]; ch.seated = false; ch.place(x, z, ry); if (anim) ch.setBase(anim, {fade: 0}); ch.holder.visible = true; };
  // at the head of the table, turned so the patient, her monitor and the surgeon are all within a turn of the head
  place('layla', -1.42, -0.42, 0.5, 'f_idle_neutral_01');
  place('karim', 0.5, -2.12, 0, 'm_work_table');
  place('rania', 0.05, -0.62, 0, 'f_work_table');
  place('assist', CHEST.x - 0.2, -0.64, 0, 'm_idle_neutral_01');       // the assistant surgeon, across the table from the player
  await setupAssistant(T.assist, {rania: T.rania, layla: T.layla}); onUpdate((dt) => T.assist._life && T.assist._life(dt));
  place('haddad', 2.2, 2.4, Math.PI, 'm_idle_neutral_01'); T.haddad.holder.visible = false;
  place('huda', 2.0, 2.7, Math.PI, 'f_idle_neutral_01'); T.huda.holder.visible = false;
  place('player', CHEST.x + 0.02, 0.5, Math.PI, 'm_idle_neutral_01');
  // patient: supine on the table, head towards the anaesthetist (-x), behind the anaesthesia screen
  const p = T.patient; place('patient', 0, 0, 0, 'm_idle_neutral_01');
  const basis = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0));
  p.holder.quaternion.setFromRotationMatrix(basis); p.holder.position.set(0.86, 0.985, 0);
  p.place = () => {};                               // the lying body is not moved by the character code
  if (p.cur) p.cur.timeScale = 0.15;
  p.lockLook = true;
  // theatre caps and masks
  capAndMask(T.layla, CAST.layla.cap); capAndMask(T.rania, CAST.rania.cap);
  return T;
}
export {characters};
