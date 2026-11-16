// How a surgeon holds each instrument. Every grip says where the instrument lies in the hand (its "socket", in the
// hand's own frame) and how the fingers close on it; the fingers are bent until their pads touch the instrument
// (a small hinge solver per finger), so the grip fits whatever instrument is held.
//
// Hand frame ("canonical", per hand): Y = wrist → middle knuckle (along the fingers), Z = out of the palm,
// X = Y × Z. For grip specs, T = towards the thumb (= ±X, measured), so the same numbers serve both hands.
//
// Grips (as taught in surgical skills courses):
//   pencil  — marking pen, diathermy pencil, forceps, suction, probes: held like a pen, resting in the first web space,
//             thumb and index pads pinch it near the tip, the middle finger supports it from below.
//   knife   — #10 scalpel ("table-knife" grip): handle under the palm, index finger straight along the back of the
//             handle near the blade, thumb and middle finger on its sides, ring and little finger hold the end.
//   palm    — needle holder, clamp: the handles in the palm, index finger along the shank, thumb on the side.
//   power   — sternal saw, paddles, retractor crank: a full fist around a thick handle.
//   steady  — non-dominant hand flat on the skin, fingers apart, stretching it beside the line.
import * as THREE from 'three';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const _v = V(), _w = V(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
const wpos = (b, out = V()) => b.getWorldPosition(out);

/** measure a hand in its rest pose (call once, arms in the rest pose): canonical frame + hinge directions */
export function measureHand(a) {
  a.hand.updateMatrixWorld(true);
  const hq = a.hand.getWorldQuaternion(new THREE.Quaternion()), hqi = hq.clone().invert(), h0 = wpos(a.hand);
  const loc = (b) => wpos(b).sub(h0).applyQuaternion(hqi);
  const F = loc(a.chains.middle[0]).normalize();
  // palm side = where the fingertip goes when the knuckle bends (+X on this rig)
  const flexDir = (j, tip) => { const t0 = wpos(tip), q0 = j.quaternion.clone(); j.rotateX(0.25); j.updateMatrixWorld(true); const t1 = wpos(tip); j.quaternion.copy(q0); j.updateMatrixWorld(true); return t1.sub(t0); };
  const P = flexDir(a.chains.index[0], a.chains.index[3]).add(flexDir(a.chains.middle[0], a.chains.middle[3])).applyQuaternion(hqi);
  P.addScaledVector(F, -P.dot(F)).normalize();
  const X = V().crossVectors(F, P).normalize();
  const thumbSign = Math.sign(loc(a.chains.thumb[1]).dot(X)) || 1;
  a.can = {X, F, P, thumbSign, q: new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(X, F, P))};
  // bone lengths in metres (world), for the finger pads
  a.len = {};
  for (const n in a.chains) { const c = a.chains[n]; a.len[n] = [0, 1, 2].map(i => wpos(c[i]).distanceTo(wpos(c[i + 1]))); }
  // landmarks in the canonical frame (metres), for authoring the grips
  const can = (b) => { const p = wpos(b).sub(h0).applyQuaternion(hqi); return [+p.dot(X).toFixed(3) * thumbSign, +p.dot(F).toFixed(3), +p.dot(P).toFixed(3)]; };
  const sc = a.hand.getWorldScale(V()).x;
  a.marks = Object.fromEntries(Object.entries(a.chains).map(([n, c]) => [n, c.map(b => can(b).map(v => +(v * 1).toFixed(3)))]));
  a.marks.scale = +sc.toFixed(4);
}

/** the hand's canonical frame in the world: quaternion of (X, F, P) */
export function handFrame(a, out = new THREE.Quaternion()) { return a.hand.getWorldQuaternion(out).multiply(a.can.q); }
/** world quaternion the hand bone needs for a canonical world frame Qc */
export function boneQuat(a, Qc, out = new THREE.Quaternion()) { return out.copy(Qc).multiply(_q.copy(a.can.q).invert()); }

// ---------------------------------------------------------------- the grips
// socket: A = where the instrument passes [T, F, P] (m, wrist origin), dir = from A towards the working tip (canonical,
//   T/F/P), edge = which way the instrument's +X faces (the scalpel's cutting edge, the forceps' jaws plane),
//   hold = distance from A to the tip along the instrument is the instrument's own `hold` (m).
// hand: natural orientation of the hand while working: pitch = fingers below horizontal (rad), sup = palm rotated
//   from facing straight down towards the body's midline (rad), yaw = fingers turned from straight ahead (rad, + inward).
// fingers: {name: {s, side, r}} = pad touches the instrument s metres along it from A (towards the tip +), approaching
//   from `side` (canonical); or {curl: [mcp, pip, dip]} fixed bends (rad). thumb also gets `opp` = base turn [x, y, z].
export const GRIPS = {
  pencil: {
    A: [0.036, 0.088, -0.008], dir: [-0.05, 0.73, 0.68], edge: [0, 0, 1],
    hand: {pitch: 0.08, sup: 0.6, yaw: 0.25},
    fingers: {
      thumb: {s: 0.05, side: [1, -0.2, 0.3]},
      index: {s: 0.056, side: [0, 0.3, -1]},
      middle: {s: 0.064, side: [-1, 0.3, 0.5]},
      ring: {curl: [0.75, 0.95, 0.55]},
      pinky: {curl: [0.85, 1.0, 0.55]},
    },
  },
  knife: {
    A: [0.028, 0.15, 0.021], dir: [0.38, 0.92, -0.1], edge: [0, 0, 1],
    hand: {pitch: 0.42, sup: 0.12, yaw: 0.18},
    fingers: {
      index: {s: 0.022, side: [0, 0.05, -1]},
      thumb: {s: -0.034, side: [1, 0, 0.25]},
      middle: {s: -0.02, side: [-1, 0, 0.35]},
      ring: {s: -0.056, side: [-0.3, 0, 1]},
      pinky: {s: -0.074, side: [-0.3, 0, 1]},
    },
  },
  palm: {
    A: [0.008, 0.11, 0.03], dir: [0.08, 1, -0.1], edge: [1, 0, 0],
    hand: {pitch: 0.48, sup: 0.2, yaw: 0.2},
    fingers: {
      index: {s: 0.035, side: [0, 0.05, -1]},
      thumb: {s: -0.005, side: [1, 0, -0.2], opp: [0.15, -0.25, 0.5]},
      middle: {s: -0.03, side: [-0.5, 0, 0.9]},
      ring: {s: -0.05, side: [-0.4, 0, 1]},
      pinky: {s: -0.07, side: [-0.4, 0, 1]},
    },
  },
  power: {
    A: [-0.005, 0.085, 0.03], dir: [0.55, 0.2, 0.0], edge: [0, 0, 1],
    hand: {pitch: 0.3, sup: 0.9, yaw: 0.1},
    fingers: {
      index: {s: 0.022, side: [0, 0.3, 1]},
      middle: {s: 0.0, side: [0, 0.3, 1]},
      ring: {s: -0.02, side: [0, 0.3, 1]},
      pinky: {s: -0.038, side: [0, 0.3, 1]},
      thumb: {s: 0.03, side: [0, -0.2, -1], opp: [0.4, -0.4, 0.8]},
    },
  },
  steady: {
    hand: {pitch: 0.12, sup: 0.0, yaw: 0.3},
    fingers: {index: {curl: [0.12, 0.15, 0.08], splay: 0.12}, middle: {curl: [0.14, 0.18, 0.1]}, ring: {curl: [0.16, 0.2, 0.12], splay: -0.08}, pinky: {curl: [0.18, 0.22, 0.14], splay: -0.16}, thumb: {curl: [0.0, 0.1, 0.1], opp: [-0.1, 0.25, 0.1]}},
  },
  open: {   // waiting for an instrument: palm up, fingers a little open
    hand: {pitch: 0.1, sup: 2.6, yaw: 0.35},
    fingers: {index: {curl: [0.2, 0.25, 0.15]}, middle: {curl: [0.25, 0.3, 0.18]}, ring: {curl: [0.3, 0.35, 0.2]}, pinky: {curl: [0.35, 0.4, 0.22]}, thumb: {curl: [0.0, 0.15, 0.15], opp: [0.1, 0, 0.3]}},
  },
  relaxed: {
    hand: {pitch: 0.5, sup: 0.5, yaw: 0.2},
    fingers: {index: {curl: [0.3, 0.45, 0.25]}, middle: {curl: [0.38, 0.55, 0.3]}, ring: {curl: [0.45, 0.6, 0.32]}, pinky: {curl: [0.5, 0.65, 0.35]}, thumb: {curl: [0.0, 0.25, 0.2], opp: [0.15, -0.1, 0.35]}},
  },
};

const canV = (a, [t, f, p], Qc, out = V()) => out.set(t * a.can.thumbSign, f, p).applyQuaternion(Qc);   // canonical [T,F,P] → world vector
/** the instrument's pose in the hand: {pos: tip position (canonical xyz, m), quat: instrument orientation in the canonical frame} */
export function socket(a, grip, hold) {
  const g = GRIPS[grip]; if (!g || !g.A) return null;
  const s = a.can.thumbSign;
  const A = V(g.A[0] * s, g.A[1], g.A[2]), d = V(g.dir[0] * s, g.dir[1], g.dir[2]).normalize();
  const y = d.clone().negate();                                      // instrument +Y = handle, away from the tip
  const e = V(g.edge[0] * s, g.edge[1], g.edge[2]); e.addScaledVector(y, -e.dot(y)).normalize();   // instrument +X
  const z = V().crossVectors(e, y).normalize();
  return {pos: A.clone().addScaledVector(d, hold), A, dir: d, quat: new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(e, y, z))};
}
/** natural working orientation of the hand (canonical frame, world) for a grip, with the hand at `at`, from `shoulder` */
export function naturalFrame(a, grip, side, shoulder, at, out = new THREE.Quaternion()) {
  const h = (GRIPS[grip] || GRIPS.relaxed).hand, sg = side === 'R' ? 1 : -1;
  const fwd = at.clone().sub(shoulder).setY(0); if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1); fwd.normalize();
  fwd.applyAxisAngle(V(0, 1, 0), sg * h.yaw);                       // fingers turned in towards the midline
  const right = V().crossVectors(fwd, V(0, 1, 0)).normalize();      // the surgeon's right, as seen along the fingers
  const F = fwd.clone().multiplyScalar(Math.cos(h.pitch)).add(V(0, -Math.sin(h.pitch), 0)).normalize();
  // palm straight down, then turned (supinated) towards the midline: the thumb side comes up
  const P0 = V(0, -1, 0).addScaledVector(F, F.y).normalize();
  const med = V().crossVectors(F, P0).normalize().multiplyScalar(-sg); // across the hand, towards the body's midline
  void right;
  const P = P0.multiplyScalar(Math.cos(h.sup)).addScaledVector(med, Math.sin(h.sup)).normalize();
  const X = V().crossVectors(F, P).normalize();
  return out.setFromRotationMatrix(_m.makeBasis(X, F, P));
}

// ---------------------------------------------------------------- fingers
// per joint: [axis, min, max] (rad, local axes; X bends towards the palm, Z spreads)
const J_FINGER = [[['x', -0.25, 1.55], ['z', -0.3, 0.3]], [['x', 0, 1.85]], [['x', 0, 1.4]]];
const J_THUMB = [[['x', -0.5, 1.0], ['z', -0.9, 0.9], ['y', -0.6, 0.6]], [['x', -0.3, 1.1]], [['x', -0.3, 1.3]]];
const AX = {x: V(1, 0, 0), y: V(0, 1, 0), z: V(0, 0, 1)};
function hingeAxis(b, out, k = 'x') { return out.copy(AX[k]).applyQuaternion(b.getWorldQuaternion(_q)); }
/** where the finger pad is: on the palm side of the last phalanx, a little before the tip */
function pad(a, c, out, depth) {
  const j3 = wpos(c[2], V()), e = wpos(c[3], V());
  const ax = hingeAxis(c[2], V()), d = e.clone().sub(j3); const L = d.length(); d.normalize();
  const palmar = V().crossVectors(ax, d).normalize();              // a +X bend moves the tip this way: the pad side
  return out.copy(j3).addScaledVector(d, L * 0.62).addScaledVector(palmar, depth);
}
function bend(b, ang) { b.rotateX(ang); b.updateMatrixWorld(true); }
/** CCD on the finger's joints until its pad reaches `target` (world) */
function reachPad(a, name, target, it = 12) {
  const c = a.chains[name], J = name === 'thumb' ? J_THUMB : J_FINGER;
  const acc = c._acc || (c._acc = J.map(j => j.map(() => 0))); for (const r of acc) r.fill(0);
  const p = V(), piv = V(), ax = V(), v1 = V(), v2 = V(), cr = V();
  const depth = name === 'thumb' ? 0.0075 : 0.0065, ts = a.can.thumbSign;
  for (let k = 0; k < it; k++) {
    for (let j = 2; j >= 0; j--) for (let n = 0; n < J[j].length; n++) {
      const [axis, lo, hi] = J[j][n], sg = axis === 'x' ? 1 : ts;          // spread/swing mirror between the hands
      pad(a, c, p, depth); wpos(c[j], piv); hingeAxis(c[j], ax, axis);
      v1.subVectors(p, piv); v1.addScaledVector(ax, -v1.dot(ax)); v2.subVectors(target, piv); v2.addScaledVector(ax, -v2.dot(ax));
      if (v1.lengthSq() < 1e-10 || v2.lengthSq() < 1e-10) continue;
      let ang = Math.atan2(cr.crossVectors(v1, v2).dot(ax), v1.dot(v2)) * (n ? 0.5 : 1);
      const cur = acc[j][n] * sg, nv = Math.max(lo, Math.min(hi, (cur + ang * sg))) ; ang = (nv - cur) * sg; acc[j][n] = nv * sg;
      if (Math.abs(ang) > 1e-5) { c[j].rotateOnAxis(AX[axis], ang); c[j].updateMatrixWorld(true); }
    }
  }
  return pad(a, c, p, depth).distanceTo(target);
}
/** splay a finger at its knuckle (rotation about the palm normal) */
function splay(a, name, ang) { const b = a.chains[name][0]; b.rotateZ(ang * a.can.thumbSign); b.updateMatrixWorld(true); }

/**
 * Close the hand: fingers of `grip` onto the instrument lying along `tipW` + (-dirW)·s (world), radius r; w = how closed.
 * Call after the hand bone has its final world orientation.
 */
export function closeHand(a, grip, {tipW = null, dirW = null, A = null, r = 0.004, w = 1} = {}) {
  const g = GRIPS[grip] || GRIPS.relaxed; const Qc = handFrame(a);
  const res = {};
  // thumb base: turned to face the fingers (opposition) before anything else
  for (const name of ['thumb', 'index', 'middle', 'ring', 'pinky']) {
    const f = g.fingers[name]; if (!f) continue;
    const c = a.chains[name];
    if (f.opp) { const b = c[0]; b.rotateX(f.opp[0] * w); b.rotateY(f.opp[1] * w * a.can.thumbSign); b.rotateZ(f.opp[2] * w * a.can.thumbSign); b.updateMatrixWorld(true); }
    if (f.splay) splay(a, name, f.splay * w);
    if (f.curl || !tipW) { const cu = f.curl || [0.4, 0.5, 0.3]; for (let j = 0; j < 3; j++) bend(c[j], cu[j] * w); continue; }
    // pad target: the instrument surface, approached from `side`
    const P = A.clone().addScaledVector(dirW, f.s);
    const side = canV(a, f.side, Qc); side.addScaledVector(dirW, -side.dot(dirW)).normalize();
    const target = P.addScaledVector(side, r);
    if (w < 1) { const open = pad(a, c, V(), 0.007); target.lerp(open, 1 - w); }
    res[name] = reachPad(a, name, target);
  }
  return res;
}
