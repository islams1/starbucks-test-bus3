// Liquid glass for the UI cards (after glass.md, "AGR-01: the renderer's glass", adapted to this game).
// One full-screen pass, last in the composer: inside each registered DOM element's rounded rectangle it draws a lens —
// a bent, frosted, saturated, slightly brightened and tinted copy of the finished frame, with a bright rim and an inner
// glow. Outside every shape the frame passes through unchanged; the DOM text stays above the canvas, sharp.
// A per-shape dim (measured on the GPU from the glass itself, every frame, no readback) darkens the glass just enough
// for the ink (#F6F4EE) to reach 4.5 : 1. A CSS fallback panel takes over when the pass is off or fails.
//
// Our frame is already in display (sRGB) values when it reaches this pass (OutputPass + grade run before it), so the
// glass works directly in sRGB values — which is what CSS filters do — and decodes to linear only to measure light.
import * as THREE from 'three';
import {Pass, FullScreenQuad} from 'three/addons/postprocessing/Pass.js';

// ---------------------------------------------------------------- constants (glass.md §4–7, colours adapted to ours)
export const FROST_PX = 2.2, SATURATE = 1.4, BRIGHTNESS = 1.04, TINT = 0.07;
export const DIM_INK = [6, 12, 9];                      // the dim darkens towards this
export const PRIMARY = [217, 178, 111];                 // our accent (the source's teal), mixed at 0.8
export const KIND = {card: 0, floating: 1, pill: 2, primary: 3, clock: 4};
export const LENS = {bezel: [30, 22, 14, 14, 14], scale: [52, 38, 26, 26, 26]};
export const MAX_SHAPES = 16, PILL = 999;
const TAPS = 13;
const DIM_CAP = 0.55, DIM_K = 0.1622, G_MARGIN = 1.03, ABOVE = 0.1;
const TAU_RISE = 0.05, TAU_FALL = 0.2, STEP_MAX = 0.019, HOLD = 0.02, RISE_HOLD = 0.75, LOCAL_CUT = 0.1, CUT_MOVE = 0.5, CUT_TURN = 20;

/** n centred Gaussian taps on a golden-angle spiral, variance corrected for bilinear taps (sigma in buffer px) */
export function frostTaps(n, sigma) {
  const turn = Math.PI * (3 - Math.sqrt(5)), pts = [];
  for (let k = 0; k < n; k++) { const r = Math.sqrt(-2 * Math.log(1 - (k + 0.5) / n)), a = k * turn; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
  const mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n;
  for (const p of pts) { p[0] -= mx; p[1] -= my; }
  const v = pts.reduce((s, p) => s + p[0] * p[0] + p[1] * p[1], 0) / (2 * n);
  const k = Math.sqrt(Math.max(0, sigma * sigma - 1 / 6) / Math.max(v, 1e-6));
  return pts.map(([x, y]) => [x * k, y * k, 1 / n]);
}

// ---------------------------------------------------------------- the registry (glass.md §9)
const entries = []; let order = 0;
export function registerGlass(el, {kind = 'card', radius = null, priority = 0} = {}) {
  if (!(kind in KIND)) throw new Error('glass: unknown kind ' + kind);
  const cs = getComputedStyle(el);
  const e = {el, kind, code: KIND[kind], radius: radius ?? (kind === 'pill' ? PILL : parseFloat(cs.borderTopLeftRadius) || 12), priority, order: order++, slot: -1, dropped: false};
  entries.push(e); el.dataset.glass = kind;
  return () => { const i = entries.indexOf(e); if (i >= 0) entries.splice(i, 1); if (!entries.some(x => x.el === el)) { delete el.dataset.glass; delete el.dataset.glassDrop; } };
}
export const glassCount = () => entries.length;
export const slotOf = (el) => { const e = entries.find(x => x.el === el); return e ? e.slot : -1; };
function opacityOf(el) { let o = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const s = getComputedStyle(n); if (s.display === 'none' || s.visibility === 'hidden') return 0; o *= parseFloat(s.opacity); if (o <= 0) return 0; } return o; }
const data = new Float32Array(MAX_SHAPES * 8), inner = new Float32Array(MAX_SHAPES * 4), grid = new Float32Array(MAX_SHAPES * 2), was = new Float32Array(MAX_SHAPES);
/** once a frame: the shapes in buffer px (y up), their content boxes and last frame's slots */
export function rects(dpr, H, W) {
  const list = entries.slice().sort((a, b) => a.priority - b.priority || a.order - b.order);
  let count = 0;
  for (const e of list) {
    const prev = e.slot; e.slot = -1;
    const el = e.el; if (!el.isConnected) continue;
    if (el.checkVisibility && !el.checkVisibility({visibilityProperty: true, opacityProperty: true})) { setDrop(e, false); continue; }
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) { setDrop(e, false); continue; }
    const op = opacityOf(el); if (op <= 0) { setDrop(e, false); continue; }
    if (count >= MAX_SHAPES) { setDrop(e, true); continue; }
    setDrop(e, false);
    const hw = r.width / 2, hh = r.height / 2, rad = Math.min(e.radius === PILL ? Math.min(hw, hh) : e.radius, hw, hh);
    const o = count * 8;
    data[o] = (r.left + hw) * dpr; data[o + 1] = H - (r.top + hh) * dpr; data[o + 2] = hw * dpr; data[o + 3] = hh * dpr;
    const lensK = parseFloat(getComputedStyle(el).getPropertyValue('--lens')) || 1;
    data[o + 4] = rad * dpr; data[o + 5] = e.code; data[o + 6] = op; data[o + 7] = lensK;
    // the content box: the text is judged where it is
    const s = getComputedStyle(el), px = (k) => parseFloat(s[k]) || 0;
    const l = r.left + px('borderLeftWidth') + px('paddingLeft'), rr = r.right - px('borderRightWidth') - px('paddingRight');
    const t = r.top + px('borderTopWidth') + px('paddingTop'), b = r.bottom - px('borderBottomWidth') - px('paddingBottom');
    const iw = Math.max(1, (rr - l) / 2), ih = Math.max(1, (b - t) / 2);
    inner[count * 4] = ((l + rr) / 2) * dpr; inner[count * 4 + 1] = H - ((t + b) / 2) * dpr; inner[count * 4 + 2] = iw * dpr; inner[count * 4 + 3] = ih * dpr;
    const g = gridOf(iw, ih); grid[count * 2] = g[0]; grid[count * 2 + 1] = g[1];
    was[count] = prev; e.slot = count; count++;
  }
  return {count};
}
function setDrop(e, on) { if (e.dropped === on) return; e.dropped = on; if (on) e.el.dataset.glassDrop = ''; else delete e.el.dataset.glassDrop; }
/** sample grid over a text box: nx × ny ≤ 1024, cells near square */
export function gridOf(hw, hh) { const ny = Math.max(1, Math.min(1024, Math.floor(Math.sqrt(1024 * hh / hw)))); return [Math.max(1, Math.floor(1024 / ny)), ny]; }

// ---------------------------------------------------------------- GLSL shared by the glass and the dim's sampler
const f = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v));
const rgb = (c) => `vec3(${c.map(x => f(x / 255)).join(', ')})`;
const LIT = `
uniform sampler2D tDiffuse;
uniform vec4 uShapes[${MAX_SHAPES * 2}];
uniform int uCount;
uniform float uDpr;
uniform vec2 uRes;
uniform vec3 uTaps[${TAPS}];
const float BEZEL[5] = float[5](${LENS.bezel.map(f).join(', ')});
const float SCALE[5] = float[5](${LENS.scale.map(f).join(', ')});
float sdRoundBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
vec3 dec(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 tap(vec2 px) { return textureLod(tDiffuse, px / uRes, 0.0).rgb; }     // no derivatives: it is called in loops that break
float phi(float x) { return 1.0 / (1.0 + exp(-1.702 * x)); }
// lens + frost + saturate + brightness, in sRGB values (as CSS filters work)
vec3 lit(vec2 at, vec2 p, float sd, vec4 a, vec4 b) {
  int kind = int(b.y + 0.5);
  float bz = BEZEL[kind] * uDpr, sc = SCALE[kind] * uDpr * b.w * (127.0 / 255.0);
  vec2 h = a.zw; float r = b.x;
  vec2 q = abs(p) - (h - r);
  vec2 n = (q.x > 0.0 && q.y > 0.0) ? normalize(q) * sign(p) : (q.x > q.y ? vec2(sign(p.x), 0.0) : vec2(0.0, sign(p.y)));
  float t = clamp(1.0 + min(sd, 0.0) / bz, 0.0, 1.0);
  vec2 off = n * t * t * sc;
  vec3 c = vec3(0.0);
  for (int k = 0; k < ${TAPS}; k++) {
    vec2 o = at + uTaps[k].xy;
    if (t > 0.0) { c.r += tap(o + off).r; c.g += tap(o + off * 0.97).g; c.b += tap(o + off * 0.94).b; }   // the colour fringe at the rim
    else c += tap(o);
  }
  c = clamp(c / float(${TAPS}), 0.0, 1.0);
  float s = ${f(SATURATE)};
  mat3 SAT = mat3(0.213 + 0.787 * s, 0.213 - 0.213 * s, 0.213 - 0.213 * s,
                  0.715 - 0.715 * s, 0.715 + 0.285 * s, 0.715 - 0.715 * s,
                  0.072 - 0.072 * s, 0.072 - 0.072 * s, 0.072 + 0.928 * s);
  c = clamp(SAT * c, 0.0, 1.0);
  return clamp(c * ${f(BRIGHTNESS)}, 0.0, 1.0);
}
// inset glows (two layers, the second on top) and the bevel rim, white
vec3 finish(vec3 c, vec2 p, vec2 h, float r) {
  // layer 0: x -1.5, y -2 (CSS, y down), blur 6, spread -3, a 0.35 · layer 1: x 1.5, y 2, a 0.75
  for (int L = 0; L < 2; L++) {
    vec2 o = (L == 0 ? vec2(-1.5, 2.0) : vec2(1.5, -2.0)) * uDpr;      // y flipped into buffer px
    float a = L == 0 ? 0.35 : 0.75, sg = 3.0 * uDpr;
    float hole = sdRoundBox(p - o, h + 3.0 * uDpr, r + 3.0 * uDpr);
    c = mix(c, vec3(1.0), a * phi(hole / sg));
  }
  float sd = sdRoundBox(p, h, r);
  float band = 1.0 - smoothstep(0.0, 1.4 * uDpr, -sd);
  float along = clamp(0.5 + 0.5 * dot(p / h, vec2(0.70711, -0.70711)) / 1.41421, 0.0, 1.0);
  float ra = along < 0.28 ? mix(0.95, 0.18, along / 0.28) : along < 0.55 ? mix(0.18, 0.04, (along - 0.28) / 0.27) : mix(0.04, 0.55, (along - 0.55) / 0.45);
  return mix(c, vec3(1.0), band * ra * 0.85);
}
`;
const VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const GLASS_FRAG = LIT + `
uniform sampler2D uDim;
varying vec2 vUv;
void main() {
  vec2 fc = gl_FragCoord.xy;
  vec3 src = texture(tDiffuse, vUv).rgb, outc = src;
  for (int i = 0; i < ${MAX_SHAPES}; i++) {
    if (i >= uCount) break;
    vec4 a = uShapes[i * 2], b = uShapes[i * 2 + 1];
    vec2 p = fc - a.xy;
    if (any(greaterThan(abs(p), a.zw + 1.0))) continue;
    float sd = sdRoundBox(p, a.zw, b.x);
    if (sd >= 0.5) continue;
    float cover = clamp(0.5 - sd, 0.0, 1.0) * b.z;
    vec3 g = lit(fc, p, sd, a, b);
    if (int(b.y + 0.5) == ${KIND.primary}) g = mix(g, ${rgb(PRIMARY)}, 0.8);
    else { g = mix(g, vec3(1.0), ${f(TINT)}); g = mix(g, ${rgb(DIM_INK)}, texelFetch(uDim, ivec2(i, 0), 0).r); }
    g = finish(g, p, a.zw, b.x);
    outc = mix(src, g, cover);
    break;                                          // the first shape that covers the pixel wins
  }
  gl_FragColor = vec4(outc, 1.0);
}`;

// ---------------------------------------------------------------- the dim (glass.md §10): samples → counts → target → smoothing
const SAMPLE_FRAG = LIT + `
uniform vec4 uInner[${MAX_SHAPES}];
uniform vec2 uGrid[${MAX_SHAPES}];
float sampleAt(int i, int j) {
  vec2 g = uGrid[i]; int nx = int(g.x), ny = int(g.y);
  if (j >= nx * ny) return -1.0;
  vec4 a = uShapes[i * 2], b = uShapes[i * 2 + 1], in4 = uInner[i];
  if (int(b.y + 0.5) == ${KIND.primary}) return -1.0;
  float gx = float(j - (j / nx) * nx), gy = float(j / nx);
  vec2 pos = in4.xy + vec2((gx + 0.5) / g.x * 2.0 - 1.0, (gy + 0.5) / g.y * 2.0 - 1.0) * in4.zw;
  vec2 p = pos - a.xy; float sd = sdRoundBox(p, a.zw, b.x);
  vec3 c = lit(pos, p, sd, a, b);
  c = mix(c, vec3(1.0), ${f(TINT)});
  c = finish(c, p, a.zw, b.x);
  return dot(dec(c), vec3(0.2126, 0.7152, 0.0722));
}
void main() {
  int tx = int(gl_FragCoord.x), i = int(gl_FragCoord.y);
  if (i >= uCount) { gl_FragColor = vec4(-1.0); return; }
  gl_FragColor = vec4(sampleAt(i, tx * 4), sampleAt(i, tx * 4 + 1), sampleAt(i, tx * 4 + 2), sampleAt(i, tx * 4 + 3));
}`;
const COUNT_FRAG = `
uniform sampler2D uSamples;
void main() {
  int k = int(gl_FragCoord.x), i = int(gl_FragCoord.y);
  float level = ${f(DIM_K)} / (1.0 - ${f(DIM_CAP)} * float(k) / 31.0) / ${f(G_MARGIN)};
  float valid = 0.0, above = 0.0;
  for (int t = 0; t < 256; t++) {
    vec4 s = texelFetch(uSamples, ivec2(t, i), 0);
    for (int c = 0; c < 4; c++) { float v = s[c]; if (v >= 0.0) { valid += 1.0; if (v >= level) above += 1.0; } }
  }
  gl_FragColor = vec4(valid > 0.0 ? above / valid : 0.0);
}`;
const TARGET_FRAG = `
uniform sampler2D uCounts;
void main() {
  int i = int(gl_FragCoord.x);
  float dim = ${f(DIM_CAP)}, prev = 1.0;
  for (int k = 0; k < 32; k++) {
    float sh = texelFetch(uCounts, ivec2(k, i), 0).r;
    if (sh < ${f(ABOVE)}) {                         // the 90th percentile of the glass falls between level k-1 and k
      if (k == 0) dim = 0.0;
      else { float a = clamp((prev - ${f(ABOVE)}) / max(prev - sh, 1e-4), 0.0, 1.0); dim = ${f(DIM_CAP)} * (float(k - 1) + a) / 31.0; }
      break;
    }
    prev = sh;
  }
  gl_FragColor = vec4(dim);
}`;
const SMOOTH_FRAG = `
uniform sampler2D uPrev, uTarget;
uniform float uWas[${MAX_SHAPES}];
uniform float uDt, uCut;
void main() {
  int i = int(gl_FragCoord.x);
  float fresh = texelFetch(uTarget, ivec2(i, 0), 0).r;
  int w = int(uWas[i] + 0.5);
  if (uWas[i] < -0.5) { gl_FragColor = vec4(fresh, fresh, 0.0, 0.0); return; }       // a new shape starts at its target
  vec4 pv = texelFetch(uPrev, ivec2(w, 0), 0);
  float dim = pv.r, held = pv.g, since = min(1.0, pv.a + uDt);
  // hold: rise at once; fall only when clearly lower and a while after the last rise
  if (fresh >= held) { held = fresh; since = 0.0; }
  else if (held - fresh > ${f(HOLD)} && since > ${f(RISE_HOLD)}) held = fresh;
  // step: snap on a cut (camera or local), else rise fast, fall slow, capped per frame
  if (uCut > 0.5 || held - dim > ${f(LOCAL_CUT)}) dim = held;
  else { float tau = held > dim ? ${f(TAU_RISE)} : ${f(TAU_FALL)}; float d = (held - dim) * (1.0 - exp(-uDt / tau)); dim += clamp(d, -${f(STEP_MAX)}, ${f(STEP_MAX)}); }
  gl_FragColor = vec4(dim, held, 0.0, since);
}`;

// ---------------------------------------------------------------- the pass
export class GlassPass extends Pass {
  constructor(camera) {
    super();
    this.camera = camera;
    const shapes = Array.from({length: MAX_SHAPES * 2}, () => new THREE.Vector4());
    const taps = Array.from({length: TAPS}, () => new THREE.Vector3());
    const common = {tDiffuse: {value: null}, uShapes: {value: shapes}, uCount: {value: 0}, uDpr: {value: 1}, uRes: {value: new THREE.Vector2(1, 1)}, uTaps: {value: taps}};
    this.u = common;
    const mat = (frag, extra = {}) => new THREE.ShaderMaterial({uniforms: Object.assign({}, common, extra), vertexShader: VERT, fragmentShader: frag, depthTest: false, depthWrite: false, toneMapped: false});
    this.glassMat = mat(GLASS_FRAG, {uDim: {value: null}});
    this.sampleMat = mat(SAMPLE_FRAG, {uInner: {value: Array.from({length: MAX_SHAPES}, () => new THREE.Vector4())}, uGrid: {value: Array.from({length: MAX_SHAPES}, () => new THREE.Vector2())}});
    this.countMat = new THREE.ShaderMaterial({uniforms: {uSamples: {value: null}}, vertexShader: VERT, fragmentShader: COUNT_FRAG, depthTest: false, depthWrite: false});
    this.targetMat = new THREE.ShaderMaterial({uniforms: {uCounts: {value: null}}, vertexShader: VERT, fragmentShader: TARGET_FRAG, depthTest: false, depthWrite: false});
    this.smoothMat = new THREE.ShaderMaterial({uniforms: {uPrev: {value: null}, uTarget: {value: null}, uWas: {value: new Array(MAX_SHAPES).fill(-1)}, uDt: {value: 0}, uCut: {value: 0}}, vertexShader: VERT, fragmentShader: SMOOTH_FRAG, depthTest: false, depthWrite: false});
    const rt = (w, h) => new THREE.WebGLRenderTarget(w, h, {type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false});
    this.rtSamples = rt(256, MAX_SHAPES); this.rtCounts = rt(32, MAX_SHAPES); this.rtTarget = rt(MAX_SHAPES, 1);
    this.rtSmooth = [rt(MAX_SHAPES, 1), rt(MAX_SHAPES, 1)]; this.ping = 0;
    this.quad = new FullScreenQuad(this.glassMat);
    this.tapDpr = -1; this.lastT = performance.now(); this.lastView = null; this.frames = 0;
  }
  setTaps(dpr) {
    if (dpr === this.tapDpr) return; this.tapDpr = dpr;
    frostTaps(TAPS, FROST_PX * dpr).forEach((t, k) => this.u.uTaps.value[k].set(t[0], t[1], t[2]));
  }
  /** camera cut since the last frame (moved 0.5 m or turned 20°) */
  cut() {
    const c = this.camera; if (!c) return false;
    const p = c.getWorldPosition(new THREE.Vector3()), d = c.getWorldDirection(new THREE.Vector3());
    const L = this.lastView; this.lastView = {p, d};
    if (!L) return true;
    return p.distanceTo(L.p) > CUT_MOVE || d.angleTo(L.d) > CUT_TURN * Math.PI / 180;
  }
  render(renderer, writeBuffer, readBuffer) {
    const W = readBuffer.width, H = readBuffer.height, dpr = W / innerWidth;
    this.setTaps(dpr);
    const {count} = rects(dpr, H, W);
    const u = this.u; u.tDiffuse.value = readBuffer.texture; u.uCount.value = count; u.uDpr.value = dpr; u.uRes.value.set(W, H);
    for (let k = 0; k < count * 2; k++) u.uShapes.value[k].fromArray(data, k * 4);
    const now = performance.now(), dt = Math.min(0.1, (now - this.lastT) / 1000); this.lastT = now;
    const cut = this.cut();
    if (count > 0) {
      for (let k = 0; k < count; k++) { this.sampleMat.uniforms.uInner.value[k].fromArray(inner, k * 4); this.sampleMat.uniforms.uGrid.value[k].set(grid[k * 2], grid[k * 2 + 1]); }
      this.quad.material = this.sampleMat; renderer.setRenderTarget(this.rtSamples); this.quad.render(renderer);
      this.countMat.uniforms.uSamples.value = this.rtSamples.texture; this.quad.material = this.countMat; renderer.setRenderTarget(this.rtCounts); this.quad.render(renderer);
      this.targetMat.uniforms.uCounts.value = this.rtCounts.texture; this.quad.material = this.targetMat; renderer.setRenderTarget(this.rtTarget); this.quad.render(renderer);
      const prev = this.rtSmooth[this.ping], next = this.rtSmooth[1 - this.ping]; this.ping = 1 - this.ping;
      const sm = this.smoothMat.uniforms; sm.uPrev.value = prev.texture; sm.uTarget.value = this.rtTarget.texture; sm.uDt.value = dt; sm.uCut.value = cut ? 1 : 0;
      for (let k = 0; k < MAX_SHAPES; k++) sm.uWas.value[k] = k < count ? was[k] : -1;
      this.quad.material = this.smoothMat; renderer.setRenderTarget(next); this.quad.render(renderer);
      this.glassMat.uniforms.uDim.value = next.texture;
    }
    this.input = readBuffer;                         // the frame without glass, for captures
    this.quad.material = this.glassMat;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
    this.frames++;
  }
  /** the last frame as the world saw it, without the glass (a photo taken in the game must not hold empty panels):
   * a JPEG data URL, or null before the first frame. The input is display-sRGB in half floats. */
  capture(renderer, quality = 0.7) {
    const src = this.input; if (!src) return null;
    const w = Math.floor(src.width), h = Math.floor(src.height);       // a dynamic resolution can leave fractions
    // copy into an 8-bit target first: reading RGBA bytes back is allowed everywhere, half floats are not
    if (!this.rtCap || this.rtCap.width !== w || this.rtCap.height !== h) { if (this.rtCap) this.rtCap.dispose(); this.rtCap = new THREE.WebGLRenderTarget(w, h, {depthBuffer: false}); }
    this.copyMat = this.copyMat || new THREE.ShaderMaterial({uniforms: {tDiffuse: {value: null}}, vertexShader: VERT, fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main() { gl_FragColor = vec4(texture2D(tDiffuse, vUv).rgb, 1.0); }', depthTest: false, depthWrite: false});
    this.copyMat.uniforms.tDiffuse.value = src.texture;
    const keep = renderer.getRenderTarget();
    this.quad.material = this.copyMat; renderer.setRenderTarget(this.rtCap); this.quad.render(renderer); renderer.setRenderTarget(keep);
    const px = new Uint8Array(w * h * 4); renderer.readRenderTargetPixels(this.rtCap, 0, 0, w, h, px);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const cx = cv.getContext('2d'), img = cx.createImageData(w, h);
    for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);   // rows come bottom-up
    cx.putImageData(img, 0, 0);
    return cv.toDataURL('image/jpeg', quality);
  }
  /** the smoothed dims (QA only: a readback) */
  dims(renderer) { const out = new Uint16Array(MAX_SHAPES * 4); renderer.readRenderTargetPixels(this.rtSmooth[this.ping], 0, 0, MAX_SHAPES, 1, out); return Array.from({length: MAX_SHAPES}, (_, i) => +THREE.DataUtils.fromHalfFloat(out[i * 4]).toFixed(3)); }
  dispose() { for (const m of [this.glassMat, this.sampleMat, this.countMat, this.targetMat, this.smoothMat]) m.dispose(); for (const r of [this.rtSamples, this.rtCounts, this.rtTarget, ...this.rtSmooth]) r.dispose(); this.quad.dispose(); }
}

// ---------------------------------------------------------------- the game's panels (glass.md §13)
// [selector, kind, priority, radius?]: the dialogs' cards first, then the HUD card and the floating lines (subtitles,
// toasts, choices), the clock, then pills. The paper props (notebook, notepad, comment card, the tablet) stay paper.
export const GAME_GLASS = [
  ['#menu .menu-card', 'card', 0], ['#howto .howto-card', 'card', 0], ['#pause .menu-card', 'card', 0], ['#gfx .gx-card', 'card', 0],
  ['#tray .tray-in', 'card', 0], ['#card .cmp-col', 'card', 0], ['#card .qz', 'card', 0], ['#card .sc', 'card', 0], ['#card .cr', 'card', 0],
  ['#panel .memo-doc', 'card', 0],
  ['#objective', 'card', 1], ['#progress', 'card', 1], ['#subs #subtext', 'floating', 1], ['#toasts .toast', 'floating', 1], ['#choicelist .choice', 'floating', 1],
  ['#panel .mcard', 'floating', 1], ['.coach-tip', 'floating', 1],
  ['#calendar', 'clock', 2],
  ['#scenetag', 'pill', 3], ['#subs .who', 'pill', 3], ['#tasks li', 'pill', 3, 12], ['#clicktolock', 'pill', 3], ['#lockhint', 'pill', 3], ['#aimtip', 'pill', 2], ['.hs .hs-label', 'pill', 4],
];
// the game elements a card can lie over (their text would show through a card sharp: cut holes in them)
const UNDER = '#hud > *, #tasks li, #hotspots .hs, #subs, #choices';
const OVERLAY = '#panel, #card, #tray, #menu, #howto, #pause, #gfx, #list, #coach, #checks, #final, #receipt, #pitch, #archive, #pcard, #notecard';
function holePath(u, holes) {
  if (!holes.length) return '';
  let d = 'M -99999 -99999 H 99999 V 99999 H -99999 Z';
  for (const h of holes) {
    const x = h.left - u.left, y = h.top - u.top, w = h.width, ht = h.height, r = Math.min(h.r, w / 2, ht / 2);
    d += ` M ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} V ${y + ht - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + ht} H ${x + r} A ${r} ${r} 0 0 1 ${x} ${y + ht - r} V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`;
  }
  return `path(evenodd, "${d}")`;
}
/** keep the game's panels registered (on load and on every DOM change) and cut holes under drawn cards */
export function glassGame() {
  const reg = new Map();          // element -> unregister
  const nested = (el) => { for (let p = el.parentElement; p; p = p.parentElement) if (reg.has(p)) return true; return false; };
  const scan = () => {
    const want = new Map();
    for (const [sel, kind, priority, radius = null] of GAME_GLASS) for (const el of document.querySelectorAll(sel)) if (!want.has(el)) want.set(el, {kind, priority, radius});
    for (const [el, off] of reg) if (!want.has(el) || !el.isConnected) { off(); reg.delete(el); }
    for (const [el, o] of want) if (!reg.has(el) && !nested(el)) reg.set(el, registerGlass(el, o));
  };
  scan();
  const mo = new MutationObserver(() => scan()); mo.observe(document.body, {childList: true, subtree: true});
  const clipped = new Map();
  const cut = () => {
    requestAnimationFrame(cut);
    if (!document.documentElement.classList.contains('glass-on')) return;
    const cards = [];
    for (const e of entries) if (e.slot >= 0 && e.code === KIND.card && e.el.closest(OVERLAY)) { const r = e.el.getBoundingClientRect(); cards.push({left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom, r: e.radius}); }
    const seen = new Set();
    if (cards.length) for (const el of document.querySelectorAll(UNDER)) {
      if (el.closest(OVERLAY)) continue;
      const u = el.getBoundingClientRect(); if (u.width < 1) continue;
      const holes = cards.filter(c => c.left < u.right && c.right > u.left && c.top < u.bottom && c.bottom > u.top);
      const cp = holePath(u, holes); seen.add(el);
      if (clipped.get(el) !== cp) { el.style.clipPath = cp; clipped.set(el, cp); }
    }
    for (const [el, cp] of clipped) if (!seen.has(el) && cp) { el.style.clipPath = ''; clipped.set(el, ''); }
  };
  requestAnimationFrame(cut);
  return {stop: () => mo.disconnect(), elements: () => [...reg.keys()]};
}

// ---------------------------------------------------------------- wiring (glass.md §1)
let active = null;
/** the current frame without the glass as a JPEG data URL; null when the glass is not drawing (then the canvas is) */
export function captureWithoutGlass(quality) {
  if (!active || !active.pass.enabled || !active.pass.frames) return null;
  try { return active.pass.capture(active.renderer, quality); } catch (e) { console.warn('glass: capture failed', e); return null; }
}
/** add the pass last to the composer; `on` false (?glass=0, low quality) leaves the CSS fallback */
export function makeGlass({composer, renderer, camera, on = true}) {
  const html = document.documentElement;
  if (!on) { html.classList.add('no-glass'); return null; }
  const pass = new GlassPass(camera);
  let failed = false;
  const prevErr = renderer.debug.onShaderError;
  renderer.debug.onShaderError = (gl, program, vs, fs) => { failed = true; console.error('glass: shader failed', gl.getProgramInfoLog(program), gl.getShaderInfoLog(fs)); if (prevErr) prevErr(gl, program, vs, fs); };
  composer.addPass(pass);
  let want = true;
  // glass-on once the pass has drawn a frame; the first three frames are watched for a shader that failed
  const check = () => {
    if (failed) { pass.enabled = false; html.classList.remove('glass-on'); html.classList.add('no-glass'); return; }
    html.classList.toggle('glass-on', want && pass.frames > 0);
    if (pass.frames < 3) requestAnimationFrame(check);
  };
  requestAnimationFrame(check);
  const attach = (on) => { want = !!on; pass.enabled = want && !failed; html.classList.toggle('glass-on', pass.enabled && pass.frames > 0); };
  window.__glass = {pass, dims: () => pass.dims(renderer), count: glassCount, slotOf, attach, failed: () => failed};
  active = {pass, renderer};
  return pass;
}
