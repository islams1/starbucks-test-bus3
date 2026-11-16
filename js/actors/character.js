// Rocketbox avatar: mocap animation, facial blendshapes (visemes + expressions), gaze, blinking, lip-sync, walking.
import * as THREE from 'three';
import {scene, camera, onUpdate, damp, angleDamp, clamp} from '../core/engine.js';
import {loadFBX, tex, bin, decodeAnims, gait} from '../core/assets.js';
import {playVoice, footstep, breath} from '../core/audio.js';
import {findPath, segmentBlocked} from '../world/nav.js';

// ---- animation library (decoded once per gender) ----
const animLib = {};
export async function loadAnimLib() {
  const [m, f] = await Promise.all([bin('assets/baked/anims_m.bin'), bin('assets/baked/anims_f.bin')]);
  Object.assign(animLib, decodeAnims(m), decodeAnims(f));
  for (const k in animLib) {             // root (Bip01) translation would slide characters around: keep only its height
    const c = animLib[k];
    const tr = c.tracks.find(t => t.name === 'Bip01.position');
    if (tr) {
      // y is up (FBXLoader converts to Y-up). Some "in-place" clips still carry forward root motion (run: 2.1 m per cycle):
      // measure it as the true ground speed, then remove it so the body stays on the character's position.
      const v = tr.values, n = v.length / 3;
      const dx = v[(n - 1) * 3] - v[0], dz = v[(n - 1) * 3 + 2] - v[2];
      const dist = Math.hypot(dx, dz) / 100;                  // cm -> m
      if (dist > 0.2 && c.duration > 0) gait[k] = dist / c.duration;
      for (let i = 0; i < v.length; i += 3) { v[i] = v[0]; v[i + 2] = v[2]; }
    }
  }
  return animLib;
}

// ---- viseme mapping for Arabic script (Oculus viseme set) ----
const V = {sil: 0, PP: 1, FF: 2, TH: 3, DD: 4, kk: 5, CH: 6, SS: 7, nn: 8, RR: 9, aa: 10, E: 11, I: 12, O: 13, U: 14};
const AR = {};
'بم'.split('').forEach(c => AR[c] = V.PP); AR['ف'] = V.FF; 'ثذظ'.split('').forEach(c => AR[c] = V.TH);
'تدطض'.split('').forEach(c => AR[c] = V.DD); 'كقخغ'.split('').forEach(c => AR[c] = V.kk); 'شج'.split('').forEach(c => AR[c] = V.CH);
'سصز'.split('').forEach(c => AR[c] = V.SS); 'نل'.split('').forEach(c => AR[c] = V.nn); AR['ر'] = V.RR;
'اآأإىةعحهء'.split('').forEach(c => AR[c] = V.aa); 'يئ'.split('').forEach(c => AR[c] = V.I); 'وؤ'.split('').forEach(c => AR[c] = V.U);
const LONG = new Set([V.aa, V.I, V.U]);
function visemeSeq(word) {
  const out = [];
  const letters = word.replace(/[ً-ْٰ«»"'،.؟!:؛…\-]/g, '').split('');
  letters.forEach((ch, i) => {
    const v = AR[ch] ?? (/[a-z]/i.test(ch) ? V.E : null);
    if (v == null) return;
    out.push(v);
    const nx = AR[letters[i + 1]];
    if (!LONG.has(v) && nx != null && !LONG.has(nx) && i < letters.length - 1) out.push(i % 2 ? V.E : V.aa); // unwritten short vowel
  });
  return out.length ? out : [V.aa];
}

const KEEP_MORPHS = ['AA_VI_00_Sil', 'AA_VI_01_PP', 'AA_VI_02_FF', 'AA_VI_03_TH', 'AA_VI_04_DD', 'AA_VI_05_KK', 'AA_VI_06_CH', 'AA_VI_07_SS',
  'AA_VI_08_nn', 'AA_VI_09_RR', 'AA_VI_10_aa', 'AA_VI_11_E', 'AA_VI_12_I', 'AA_VI_13_O', 'AA_VI_14_U',
  'AK_09_EyeBlinkLeft', 'AK_10_EyeBlinkRight', 'AK_25_JawOpen', 'AK_44_MouthSmileLeft', 'AK_45_MouthSmileRight',
  'AK_30_MouthFrownLeft', 'AK_31_MouthFrownRight', 'AK_03_BrowInnerUp', 'AK_01_BrowDownLeft', 'AK_02_BrowDownRight',
  'AK_19_EyeSquintLeft', 'AK_20_EyeSquintRight', 'AK_36_MouthPressLeft', 'AK_37_MouthPressRight', 'AK_21_EyeWideLeft', 'AK_22_EyeWideRight'];

function pruneMorphs(mesh, keep) {
  const g = mesh.geometry, dict = mesh.morphTargetDictionary || {};
  const names = Object.keys(dict);
  const newPos = [], newDict = {};
  if (keep) for (const k of KEEP_MORPHS) {
    const full = names.find(n => n.endsWith('.' + k) || n === k);
    if (full == null) continue;
    newDict[k] = newPos.length; newPos.push(g.morphAttributes.position[dict[full]]);
  }
  g.morphAttributes = {};
  if (newPos.length) { g.morphAttributes.position = newPos; g.morphTargetsRelative = g.morphTargetsRelative ?? false; }
  mesh.morphTargetDictionary = undefined; mesh.morphTargetInfluences = undefined;
  mesh.updateMorphTargets();
  mesh.morphTargetDictionary = newDict;
  return newDict;
}

const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
function rotBoneWorld(bone, axis, ang) {
  bone.parent.updateWorldMatrix(true, false);
  bone.parent.getWorldQuaternion(_q1);
  _q2.copy(_q1).multiply(bone.quaternion);
  _q3.setFromAxisAngle(axis, ang).multiply(_q2);
  bone.quaternion.copy(_q1.invert().multiply(_q3));
}

export const characters = {};

// ---- emotions: face targets + body language ----
export const EMO_FACE = {
  calm: {}, warm: {smile: 0.35}, tired: {squint: 0.45, worry: 0.3, frown: 0.15}, worried: {worry: 0.85, frown: 0.15}, curious: {brow: 0.5, smile: 0.1},
  pushy: {brow: 0.35, smile: 0.2, frown: 0.1}, excited: {smile: 0.65, brow: 0.75}, persuasive: {smile: 0.45, brow: 0.3}, firm: {frown: 0.25, squint: 0.15},
  confident: {smile: 0.2, brow: 0.1}, unsure: {worry: 0.55, frown: 0.1}, pleased: {smile: 0.55}, skeptical: {frown: 0.35, squint: 0.35, brow: 0.15},
  disappointed: {frown: 0.5, worry: 0.45}, shocked: {brow: 1, worry: 0.5}, grudging: {frown: 0.35, squint: 0.2}, happy: {smile: 0.85, squint: 0.2},
  annoyed: {frown: 0.8, squint: 0.4}, casual: {smile: 0.25}, hopeful: {smile: 0.3, brow: 0.45}, gentle: {smile: 0.3, worry: 0.25},
  hurt: {worry: 0.95, frown: 0.45}, accepting: {smile: 0.25}, relieved: {smile: 0.5, brow: 0.2}, proud: {smile: 0.75, brow: 0.2},
  sad: {worry: 0.9, frown: 0.4}, tense: {frown: 0.4, worry: 0.5, squint: 0.2},
};
const TALK = {
  m: {excited: ['m_gestic_talk_excited_01'], pushy: ['m_gestic_talk_excited_01'], happy: ['m_gestic_talk_excited_01'], worried: ['m_gestic_talk_nervous_01'], unsure: ['m_gestic_talk_nervous_01'], tense: ['m_gestic_talk_nervous_01'],
      sad: ['m_gestic_talk_sad_01'], disappointed: ['m_gestic_talk_sad_01'], tired: ['m_gestic_talk_sad_01', 'm_gestic_talk_relaxed_01'], casual: ['m_gestic_talk_cool'], confident: ['m_gestic_talk_cool', 'm_gestic_talk_neutral_01'], annoyed: ['m_gestic_talk_excited_01']},
  f: {excited: ['f_gestic_talk_excited_01', 'f_gestic_talk_excited_02'], happy: ['f_gestic_talk_excited_02'], annoyed: ['f_gestic_talk_angry_01'], worried: ['f_gestic_talk_femalestressed_01', 'f_gestic_talk_nervous_01'],
      tense: ['f_gestic_talk_nervous_01'], unsure: ['f_gestic_talk_nervous_01'], sad: ['f_gestic_talk_sad_01'], disappointed: ['f_gestic_talk_sad_01'], hurt: ['f_gestic_talk_sad_01'], firm: ['f_gestic_talk_self-assured_01'],
      confident: ['f_gestic_talk_self-assured_01'], proud: ['f_gestic_talk_self-assured_01'], persuasive: ['f_gestic_talk_relaxed_01', 'f_gestic_talk_self-assured_01']},
};

export class Character {
  /**
   * @param id      logical id (nadia, ryan…)
   * @param avatar  Rocketbox folder
   * @param opt     {gender:'m'|'f', height, talks:true, idle:'m_idle_neutral_01', talk:[...], listen:'...'}
   */
  static async create(id, avatar, opt) {
    const c = new Character(id, avatar, opt);
    await c.load();
    characters[id] = c;
    return c;
  }
  constructor(id, avatar, opt) {
    this.id = id; this.avatar = avatar; this.o = Object.assign({gender: 'm', height: 1.75, talks: true}, opt);
    this.g = this.o.gender;
    this.holder = new THREE.Group(); this.holder.name = 'char_' + id;
    this.state = 'idle'; this.cur = null; this.base = null;
    this.look = {target: null, yaw: 0, pitch: 0, weight: 1};
    this.mood = {smile: 0, frown: 0, brow: 0, worry: 0, squint: 0};
    this._mood = {smile: 0, frown: 0, brow: 0, worry: 0, squint: 0};
    this.blink = {t: 0, next: 1 + Math.random() * 3};
    this.voice = null; this.words = null;
    this.vis = new Float32Array(15);
    this.walking = null; this.speed = 0;
    this.headWorld = new THREE.Vector3();
  }
  async load() {
    const root = await loadFBX(`assets/avatars/${this.avatar}/model.fbx`);
    const p = `assets/avatars/${this.avatar}/`;
    const mats = {};
    const mk = (kind) => {
      if (kind === 'opacity') return new THREE.MeshStandardMaterial({map: tex(p + 'opacity_color.png'), alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.62, alphaToCoverage: true});
      const m = new THREE.MeshStandardMaterial({map: tex(p + kind + '_color.jpg'), roughness: kind === 'head' ? 0.52 : 0.78, metalness: 0});
      if (this.o.normals !== false) { const n = tex(p + kind + '_normal.jpg', {srgb: false}); n.onError = () => {}; m.normalMap = n; m.normalScale.set(0.9, 0.9); }
      if (kind === 'head') { m.envMapIntensity = 0.8; }
      if (kind === 'stetoskop') { m.roughness = 0.35; m.metalness = 0.4; }
      return m;
    };
    root.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      o.material = (Array.isArray(o.material) ? o.material : [o.material]).map(m => {
        const n = (m.name || '').toLowerCase();
        const kind = n.includes('opacity') ? 'opacity' : n.includes('protection') ? 'protection' : n.includes('stetoskop') ? 'stetoskop' : n.includes('head') ? 'head' : 'body';   // protection = theatre cap/mask/gown, stetoskop = the doctor's stethoscope (medical avatars)
        return mats[kind] ||= mk(kind);
      });
      if (o.morphTargetDictionary) this.morph = {mesh: o, dict: pruneMorphs(o, this.o.talks)};
      this.mesh = o;
    });
    root.scale.setScalar(0.01 * this.o.height / 1.75);
    this.fbx = root;
    this.holder.add(root);
    scene.add(this.holder);
    const sk = this.mesh.skeleton; const B = n => sk.getBoneByName(n);
    this.bones = {head: B('Bip01_Head'), neck: B('Bip01_Neck'), spine2: B('Bip01_Spine2'), le: B('Bip01_LEye'), re: B('Bip01_REye'), pelvis: B('Bip01_Pelvis')};
    this.mixer = new THREE.AnimationMixer(root);
    this.actions = {};
    this.off = onUpdate((dt, t) => this.update(dt, t));
    this.holder.visible = false;
  }
  action(name) {
    if (!this.actions[name]) {
      const clip = animLib[name];
      if (!clip) { console.warn('missing anim', name); return null; }
      this.actions[name] = this.mixer.clipAction(clip);
    }
    return this.actions[name];
  }
  /** crossfade to a looping (or one-shot) animation */
  play(name, {fade = 0.45, once = false, speed = 1, offset = null} = {}) {
    const a = this.action(name); if (!a) return;
    if (this.cur === a && !once) { a.timeScale = speed; return a; }
    a.reset(); a.enabled = true; a.timeScale = speed;
    a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = once;
    a.time = offset != null ? offset : (once ? 0 : Math.random() * a.getClip().duration);
    a.play();
    if (this.cur && this.cur !== a) a.crossFadeFrom(this.cur, fade, true);
    else { a.setEffectiveWeight(1); this.mixer.update(0); }   // first pose: no fade-in from the T-pose
    this.cur = a; this.curName = name;
    return a;
  }
  /** play a one-shot gesture and return to base pose */
  async gesture(name, {fade = 0.35, hold = 0} = {}) {
    const back = this.baseName;
    const a = this.play(name, {fade, once: true}); if (!a) return;
    const d = a.getClip().duration;
    await new Promise(r => setTimeout(r, Math.max(300, (d - fade) * 1000 + hold * 1000)));
    if (this.curName === name && back) this.play(back, {fade: 0.5});
  }
  setBase(name, opt) { this.baseName = name; return this.play(name, opt); }

  place(x, z, ry = 0, y = 0) { this.holder.position.set(x, y, z); this.holder.rotation.y = ry; this.holder.visible = true; return this; }
  hide() { this.holder.visible = false; }
  faceTo(x, z) { this.holder.rotation.y = Math.atan2(x - this.holder.position.x, z - this.holder.position.z); }
  lookAt(target) { this.look.target = target; }  // Object3D | Vector3 | 'camera' | null

  /** walk along XZ waypoints. Resolves on arrival. */
  walkTo(points, {speed = 1.25, anim = null, endFace = null, nav = true} = {}) {
    const walkAnim = anim || (this.g === 'm' ? 'm_walk_neutral_01' : 'f_walk_neutral_01');
    if (nav) {   // replace any blocked straight leg by a path around the obstacles
      const route = []; let px = this.holder.position.x, pz = this.holder.position.z;
      for (const [x, z] of points) {
        if (segmentBlocked(px, pz, x, z)) { const p = findPath(px, pz, x, z); if (p && p.length) route.push(...p); else route.push([x, z]); }
        else route.push([x, z]);
        [px, pz] = route[route.length - 1];
      }
      points = route;
    }
    return new Promise(res => { this.walking = {pts: points.map(p => new THREE.Vector2(p[0], p[1])), i: 0, speed, anim: walkAnim, res, endFace}; this.holder.visible = true; });
  }

  /** speak a voice line. url without extension. */
  /** set a facial emotion (targets blend smoothly) */
  emote(e, intensity = 1) {
    const f = EMO_FACE[e] || {};
    for (const k of ['smile', 'frown', 'brow', 'worry', 'squint']) this.mood[k] = (f[k] || 0) * intensity;
    this.emotion = e;
  }
  /** fire the meaning-driven beats whose time has come (called while the voice plays) */
  _fireEvents() {
    if (!this.voice || !this._events || !this._events.length) return;
    const t = this.voice.time();
    while (this._events.length && this._events[0].t <= t) {
      const e = this._events.shift();
      const glance = (target, sec) => { this._lookOv = {target, until: performance.now() + sec * 1000}; };
      if (e.type === 'nod') this._nod = {t: 0, dur: 0.55, amp: 0.075, axis: 'p'};
      else if (e.type === 'shake') this._nod = {t: 0, dur: 0.85, amp: 0.1, axis: 'y'};
      else if (e.type === 'tilt') { this._tiltK = 1.2; this._tiltSide = Math.random() < 0.5 ? -1 : 1; this._browKick = 1; }
      else if (e.type === 'emph') { this._accent = 1; this._browKick = 0.8; }
      else if (e.type === 'look') { const c = characters[e.who]; if (c && c.holder.visible) glance(c, 1.4); }
      else if (e.type === 'glance') glance(typeof e.target === 'function' ? e.target() : e.target, e.sec || 1.3);
      else if (e.type === 'point') { if (this._pointTarget) glance(this._pointTarget, 1.8); if (!this.seated && !this.walking) this.gesture(this.o.presentAnims ? this.o.presentAnims[0] : (this.g === 'm' ? 'm_gestic_presentation_right_01' : 'f_gestic_presentation_left_01'), {fade: 0.3}); }
      else if (e.type === 'shrug') { if (this.walking) continue; const a = this.seated ? (this.g === 'm' ? 'm_sit_table_gestic_shrug_01' : 'f_sit_table_gestic_shrug_01') : (this.g === 'm' ? 'm_gestic_shrug_01' : 'f_gestic_shrug_01'); this.gesture(a, {fade: 0.25}); this._browKick = 1; }
      else if (e.type === 'think') { const h = this.headPos(), q = this.holder.quaternion; const f = new THREE.Vector3(0, 0, 1).applyQuaternion(q), r = new THREE.Vector3(1, 0, 0).applyQuaternion(q); glance(h.clone().addScaledVector(f, 1.2).addScaledVector(r, 0.45).add(new THREE.Vector3(0, -0.55, 0)), 0.9); }
    }
  }
  /** short reactions while listening: 'nod' | 'shake' | 'worry' | 'smile' | 'surprise' | 'skeptical' */
  react(type) {
    if (type === 'nod') this._nod = {t: 0, dur: 0.9, amp: 0.09, axis: 'p'};
    else if (type === 'shake') this._nod = {t: 0, dur: 1.0, amp: 0.1, axis: 'y'};
    else if (type === 'worry') this.emote('worried', 0.8);
    else if (type === 'smile') this.emote('pleased', 0.8);
    else if (type === 'surprise') { this.emote('shocked', 0.8); this.blink.next = 0.05; }
    else if (type === 'skeptical') this.emote('skeptical', 0.9);
  }
  async say(url, {getPos = null, radio = false, gesture = true, emotion = null, perf = null} = {}) {
    if (emotion) this.emote(emotion);
    // a breath before speaking: chest rises, lips part slightly, audible inhale
    if (!radio) { this._inhale = 0.42; breath(0.6); await new Promise(r => setTimeout(r, 300)); }
    const [voice, words] = await Promise.all([playVoice(url + '.mp3', getPos || (() => this.headPos()), {radio}), fetch(url + '.json').then(r => r.ok ? r.json() : []).catch(() => [])]);
    this.voice = voice;
    this.words = words.map(([o, d, w]) => ({o: o / 1000, d: d / 1000, seq: visemeSeq(w)}));
    const loop = perf ? perf.loop : 'auto';
    const standingTalk = gesture && this.o.talkAnims && !this.seated && !this.walking && loop !== 'none';
    let prev = null;
    const presentPool = this.o.presentAnims || [this.g === 'm' ? 'm_gestic_presentation_right_01' : 'f_gestic_presentation_left_01'];
    const pool = this.presenting || loop === 'present' ? presentPool : (emotion && TALK[this.g][emotion]) || this.o.talkAnims;
    // the same line always gets the same gesture loop (stable, not random each time)
    let h = 0; for (let i = 0; i < url.length; i++) h = (h * 31 + url.charCodeAt(i)) | 0;
    if (standingTalk) { prev = this.curName; this.play(pool[Math.abs(h) % pool.length], {fade: 0.6}); }
    this._events = perf ? perf.events.slice() : []; this._pointTarget = perf ? perf.pointTarget : null;
    await voice.done;
    this.voice = null; this.words = null; this._events = [];
    if (standingTalk && this.baseName && !this.walking) this.play(this.baseName, {fade: 0.8});
    // the expression lingers a moment, then relaxes towards a softer version of it
    setTimeout(() => { if (!this.voice) for (const k in this.mood) this.mood[k] *= 0.45; }, 1400);
  }
  headPos() { return this.bones.head ? this.bones.head.getWorldPosition(this.headWorld) : this.holder.position; }

  update(dt, t) {
    if (!this.holder.visible) return;
    // ---- walking ----
    const w = this.walking;
    if (w) {
      const p = this.holder.position, tgt = w.pts[w.i];
      const dx = tgt.x - p.x, dz = tgt.y - p.z, L = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      const diff = Math.abs(((want - this.holder.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      let yieldK = 1;
      const pl = Character.player;
      if (pl && pl !== this && pl.holder.visible) { const ox = pl.holder.position.x - p.x, oz = pl.holder.position.z - p.z, od = Math.hypot(ox, oz);
        if (!tgt.detour && od < 0.95 && (ox * dx + oz * dz) / (od * L + 1e-6) > 0.3) yieldK = 0;
        // the player keeps standing in the way: after a short pause, step around them (side without an obstacle)
        this._yieldT = yieldK ? 0 : (this._yieldT || 0) + dt;
        if (this._yieldT > 1.2 && od > 1e-3) {
          this._yieldT = 0;
          const px = -oz / od, pz = ox / od, P = pl.holder.position;
          for (const s of [1, -1]) {
            const wx = P.x + px * s * 0.95, wz = P.z + pz * s * 0.95;
            if (!segmentBlocked(p.x, p.z, wx, wz) && !segmentBlocked(wx, wz, tgt.x, tgt.y)) { const v = new THREE.Vector2(wx, wz); v.detour = true; w.pts.splice(w.i, 0, v); break; }
          }
        } }
      this.speed = damp(this.speed, yieldK * w.speed * (1 - Math.min(0.7, diff * 0.6)), yieldK ? 4 : 10, dt);
      if (this.curName !== w.anim) this.play(w.anim, {fade: 0.35});
      this.cur.timeScale = this.speed / ((gait[w.anim] || 1.25) * this.o.height / 1.75);
      const step = this.speed * dt;
      if (L < Math.max(0.12, step)) {
        w.i++;
        if (w.i >= w.pts.length) {
          this.walking = null; this.speed = 0;
          if (w.endFace != null) this._turnTo = w.endFace;
          if (this.baseName) this.play(this.baseName, {fade: 0.5});
          w.res();
        }
      } else {
        p.x += dx / L * step; p.z += dz / L * step;
        this.holder.rotation.y = angleDamp(this.holder.rotation.y, want, 6, dt);
        // footsteps
        const ph = (this.cur.time / this.cur.getClip().duration) * 2 % 1;
        if (this._lastPh != null && ph < this._lastPh) { const d = camera.position.distanceTo(p); if (d < 9) footstep(true, 0.6 / Math.max(1, d)); }
        this._lastPh = ph;
      }
    } else if (this._turnTo != null) {
      this.holder.rotation.y = angleDamp(this.holder.rotation.y, this._turnTo, 5, dt);
      if (Math.abs(((this._turnTo - this.holder.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.02) this._turnTo = null;
    }
    // Gaze, breathing and the desk IK turn some bones a little on top of the animation every frame. Put those bones
    // back to last frame's pure animation pose first: if no clip happens to write them this frame, the offsets would
    // otherwise pile up frame after frame (upper body bending and twisting further and further).
    const post = this._post || (this._post = this._postBones().map(b => [b, b.quaternion.clone()]));
    for (const [b, q] of post) b.quaternion.copy(q);
    this.mixer.update(dt);
    for (const [b, q] of post) q.copy(b.quaternion);
    this._guardPose(dt);
    this.updateFace(dt, t);
    this.updateGaze(dt);
    if (this.postIK) this.postIK(dt);
  }
  _postBones() {
    const sk = this.mesh.skeleton, b = this.bones;
    return [b.spine2, b.neck, b.head, b.le, b.re, ...['L', 'R'].flatMap(s => [sk.getBoneByName(`Bip01_${s}_UpperArm`), sk.getBoneByName(`Bip01_${s}_Forearm`)])].filter(Boolean);
  }
  /** safety net: the body must always be driven by a full-weight animation; anything less shows the bind (T) pose */
  _guardPose(dt) {
    let w = 0;
    for (const k in this.actions) { const a = this.actions[k]; if (a.enabled && a.isScheduled()) w += a.getEffectiveWeight(); }
    if (w >= 0.9 || !this.cur) { this._lowW = 0; return; }
    this._lowW = (this._lowW || 0) + dt;
    if (this._lowW < 0.9) return;                        // normal cross-fades are over well before this
    this._lowW = 0;
    const name = this.curName || this.baseName;
    console.warn('[pose] no full animation on', this.id, {cur: this.curName, base: this.baseName, weight: +w.toFixed(2)});
    this.cur = null; this.play(name, {fade: 0});
  }

  updateGaze(dt) {
    const b = this.bones; if (!b.head) return;
    let yaw = 0, pitch = 0;
    const tg = this._lookOv && performance.now() < this._lookOv.until ? this._lookOv.target : this.look.target;
    if (tg) {
      const tp = tg === 'camera' ? camera.position : (tg.isVector3 ? tg : (tg.headPos ? tg.headPos() : tg.getWorldPosition(new THREE.Vector3())));
      const hp = this.headPos();
      const local = this.holder.worldToLocal(tp.clone()); const hl = this.holder.worldToLocal(hp.clone());
      const d = local.sub(hl);
      yaw = clamp(Math.atan2(d.x, d.z), -1.15, 1.15);
      pitch = clamp(Math.atan2(-d.y, Math.hypot(d.x, d.z)), -0.45, 0.45);
      if (Math.abs(Math.atan2(d.x, d.z)) > 1.9) { yaw = 0; pitch = 0; }  // target behind: don't break the neck
    }
    // speech-driven motion: small nods on stressed syllables, slow head sway while talking
    let sp = 0, sy = 0, roll = 0;
    if (this.voice) {
      const a = this.voice.amp(); this._ampAvg = damp(this._ampAvg || 0, a, 3, dt);
      if (a > this._ampAvg * 2.0 + 0.04 && (this._lastAccent || 0) < this.voice.time() - 0.6) { this._lastAccent = this.voice.time(); this._accent = 0.5; this._browKick = Math.max(this._browKick || 0, 0.4); }
      this._phase = (this._phase || 0) + dt;
      sy = Math.sin(this._phase * 0.9) * 0.025; roll = Math.sin(this._phase * 0.7) * 0.015;
      this._fireEvents();
    }
    this._accent = Math.max(0, (this._accent || 0) - dt * 4); sp += this._accent * 0.06;
    this._tiltK = Math.max(0, (this._tiltK || 0) - dt * 1.4); roll += (this._tiltSide || 1) * 0.1 * Math.sin(Math.min(1, this._tiltK) * Math.PI / 2); sp -= 0.05 * this._tiltK;
    if (this._nod) { const n = this._nod; n.t += dt; const k = Math.sin(n.t / n.dur * Math.PI * 4) * n.amp * (1 - n.t / n.dur); if (n.axis === 'p') sp += k; else sy += k; if (n.t >= n.dur) this._nod = null; }
    yaw += sy; pitch += sp;
    this.look.yaw = damp(this.look.yaw, yaw, 4, dt); this.look.pitch = damp(this.look.pitch, pitch, 4, dt);
    this._roll = damp(this._roll || 0, roll, 3, dt);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.holder.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.holder.getWorldQuaternion(new THREE.Quaternion()));
    const wgt = this.look.weight;
    if (b.spine2) rotBoneWorld(b.spine2, up, this.look.yaw * 0.15 * wgt);
    if (b.neck) { rotBoneWorld(b.neck, up, this.look.yaw * 0.35 * wgt); rotBoneWorld(b.neck, right, this.look.pitch * 0.4 * wgt); }
    rotBoneWorld(b.head, up, this.look.yaw * 0.4 * wgt); rotBoneWorld(b.head, right, this.look.pitch * 0.5 * wgt);
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.holder.quaternion); rotBoneWorld(b.head, fwd, this._roll);
    // breathing: slow chest rise (deeper on the inhale before a line)
    const ex = this.exertion || 0;
    this._br = (this._br || 0) + dt * ((this.emotion === 'tense' || this.emotion === 'worried' ? 1.6 : 1.0) + 3.4 * ex);
    this._inhale = Math.max(0, (this._inhale || 0) - dt);
    if (b.spine2) rotBoneWorld(b.spine2, right, -(Math.sin(this._br * 1.6) * (0.012 + 0.05 * ex) + (this._inhale > 0 ? Math.sin(Math.min(1, (0.42 - this._inhale) / 0.42) * Math.PI) * 0.03 : 0)));
    if (ex > 0.05 && b.neck) rotBoneWorld(b.neck, right, Math.sin(this._br * 1.6 + 0.6) * 0.02 * ex);   // head lifts slightly with each breath
    // eyes: remaining angle + micro saccades
    if (b.le && b.re) {
      if (!this._sac || this._sac.t <= 0) this._sac = {t: 0.4 + Math.random() * 1.6, y: (Math.random() - 0.5) * 0.06, p: (Math.random() - 0.5) * 0.04};
      this._sac.t -= dt;
      for (const e of [b.le, b.re]) { rotBoneWorld(e, up, this.look.yaw * 0.25 + this._sac.y); rotBoneWorld(e, right, this.look.pitch * 0.3 + this._sac.p); }
    }
  }

  updateFace(dt, t) {
    if (!this.morph) return;
    const inf = this.morph.mesh.morphTargetInfluences, D = this.morph.dict;
    const set = (k, v) => { const i = D[k]; if (i != null) inf[i] = v; };
    // ---- blink ----
    const bl = this.blink; bl.next -= dt;
    if (bl.next <= 0) { bl.t = 0.17; const nerv = ['worried', 'tense', 'unsure'].includes(this.emotion); bl.next = (nerv ? 0.9 : 1.8) + Math.random() * (nerv ? 1.8 : 3.8); if (Math.random() < 0.15) bl.next = 0.25; }
    let blinkV = 0; if (bl.t > 0) { bl.t -= dt; blinkV = Math.sin(clamp(1 - bl.t / 0.17, 0, 1) * Math.PI); }
    // ---- mood ----
    for (const k in this._mood) this._mood[k] = damp(this._mood[k], this.mood[k], 2.5, dt);
    const m = this._mood;
    set('AK_09_EyeBlinkLeft', Math.max(blinkV, m.squint * 0.25)); set('AK_10_EyeBlinkRight', Math.max(blinkV, m.squint * 0.25));
    set('AK_44_MouthSmileLeft', m.smile * 0.7); set('AK_45_MouthSmileRight', m.smile * 0.7);
    set('AK_30_MouthFrownLeft', m.frown * 0.6); set('AK_31_MouthFrownRight', m.frown * 0.6);
    this._browKick = Math.max(0, (this._browKick || 0) - dt * 3);
    const exF = this.exertion || 0;
    set('AK_03_BrowInnerUp', Math.min(1, m.worry * 0.8 + m.brow * 0.5 + this._browKick * 0.35 + 0.35 * exF));
    set('AK_01_BrowDownLeft', m.frown * 0.55); set('AK_02_BrowDownRight', m.frown * 0.55);
    set('AK_19_EyeSquintLeft', m.smile * 0.35 + m.squint * 0.4 + 0.25 * exF); set('AK_20_EyeSquintRight', m.smile * 0.35 + m.squint * 0.4 + 0.25 * exF);
    set('AK_21_EyeWideLeft', m.brow * 0.3); set('AK_22_EyeWideRight', m.brow * 0.3);
    // ---- visemes ----
    const target = new Float32Array(15);
    let jaw = 0;
    if (this.voice) {
      const tt = this.voice.time();
      const amp = clamp(this.voice.amp() * 5.5, 0, 1);
      let wd = null; for (const x of this.words) { if (tt >= x.o && tt <= x.o + x.d + 0.04) { wd = x; break; } }
      if (wd && amp > 0.04) {
        const f = clamp((tt - wd.o) / wd.d, 0, 0.999);
        const fi = f * wd.seq.length, i = fi | 0, fr = fi - i;
        const a = wd.seq[i], b = wd.seq[Math.min(wd.seq.length - 1, i + 1)];
        const g = 0.55 + 0.6 * amp;
        target[a] += (1 - fr * 0.6) * g; target[b] += fr * 0.6 * g;
        jaw = amp * 0.22;
      } else if (amp > 0.08) { target[V.aa] = amp * 0.6; jaw = amp * 0.2; }  // no timing data: amplitude only
    }
    for (let i = 0; i < 15; i++) this.vis[i] = damp(this.vis[i], Math.min(1, target[i]), 22, dt);
    const names = KEEP_MORPHS;
    for (let i = 0; i < 15; i++) set(names[i], this.vis[i] * (i === 0 ? 0 : 0.95));
    if (!this.voice && this._inhale > 0) jaw = Math.max(jaw, 0.08);
    if (!this.voice && exF > 0.15) jaw = Math.max(jaw, (0.05 + 0.2 * exF) * (0.55 + 0.45 * Math.sin((this._br || 0) * 1.6)));   // breathing through the mouth
    this._jaw = damp(this._jaw || 0, jaw, 18, dt);
    set('AK_25_JawOpen', this._jaw);
  }
}
