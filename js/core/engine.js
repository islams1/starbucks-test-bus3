import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';

export const Q = new URLSearchParams(location.search);


// ---------- software-rendering detection (no GPU / acceleration off) — decided before the renderer exists ----------
export const SOFTWARE = (() => { try { const gl = document.createElement('canvas').getContext('webgl2'); const e = gl && gl.getExtension('WEBGL_debug_renderer_info'); const r = gl ? String(gl.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : gl.RENDERER)) : ''; return /swiftshader|llvmpipe|basic render|software|microsoft basic/i.test(r) || Q.get('q') === 'cpu'; } catch (e) { return false; } })();
// ---------- renderer ----------
export const renderer = new THREE.WebGLRenderer({canvas: document.getElementById('gl'), antialias: !SOFTWARE, powerPreference: 'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.88;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.05, 900);
camera.rotation.order = 'YXZ';
scene.add(camera);   // so camera-attached audio listener works

// ---------- post ----------
export const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio(), {type: THREE.HalfFloatType, samples: 4}));
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
export const gtao = new GTAOPass(scene, camera, innerWidth, innerHeight);
gtao.output = GTAOPass.OUTPUT.Default;
gtao.blendIntensity = 0.85;
gtao.updateGtaoMaterial({radius: 0.45, distanceExponent: 1.2, thickness: 1.0, scale: 1.0, samples: 16});
gtao.updatePdMaterial({lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12});
composer.addPass(gtao);
export const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.18, 0.5, 0.92);
composer.addPass(bloom);
// colour grade: slight warmth, contrast, vignette, film grain, "mood" (tension) desaturation
export const grade = new ShaderPass({
  uniforms: {tDiffuse: {value: null}, time: {value: 0}, mood: {value: 0}, warm: {value: 0.06}, vig: {value: 0.42}},
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time, mood, warm, vig; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec4 c=texture2D(tDiffuse,vUv);
      vec3 col=c.rgb;
      col.r+=warm*.6; col.b-=warm*.5;
      float l=dot(col,vec3(.299,.587,.114));
      col=mix(col, vec3(l)*vec3(1.0,.93,.9), mood*.55);           // tension: drain colour, slightly red-grey
      col=mix(col, col*col*(3.-2.*col), .18+mood*.2);              // gentle S-curve
      vec2 d=vUv-.5; float v=1.-dot(d,d)*(vig+mood*.9)*1.6; col*=clamp(v,0.,1.);
      col+= (h(vUv*vec2(1920.,1080.)+time)-.5)*.018;                // grain
      gl_FragColor=vec4(col,c.a);
    }`
});
composer.addPass(new OutputPass());
// grade runs after OutputPass so it works in display space
composer.addPass(grade);

function onResize() {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', onResize);

// ---------- update loop ----------
const updaters = new Set();
export const onUpdate = (fn) => { updaters.add(fn); return () => updaters.delete(fn); };
const overlays = new Set();          // extra viewport renders (video call)
export const onOverlay = (fn) => { overlays.add(fn); return () => overlays.delete(fn); };
export const clock = {t: 0, dt: 0, paused: false, scale: 1};
export const renderOpts = {direct: false, skip: true};   // direct = skip post-processing (CPU mode); skip = don't draw (hidden behind the loading screen)
let last = performance.now();
let fpsAcc = 0, fpsN = 0; export const stats = {fps: 60, upd: 0, rend: 0, gap: 16};

function frame(now) {
  requestAnimationFrame(frame);
  const raw = (now - last) / 1000; let dt = Math.min(0.05, raw); last = now;
  fpsAcc += raw; fpsN++; if (fpsAcc > 1) { stats.fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
  if (clock.paused) dt = 0;
  dt *= clock.scale;
  clock.dt = dt; clock.t += dt;
  const t0 = performance.now();
  for (const f of updaters) f(dt, clock.t);
  const t1 = performance.now();
  grade.uniforms.time.value = clock.t * 60 % 1000;
  if (renderOpts.skip) { /* loading: keep the CPU/GPU free for decoding */ } else if (renderOpts.direct) renderer.render(scene, camera); else composer.render();
  for (const f of overlays) f();
  const t2 = performance.now();
  stats.upd = stats.upd * 0.9 + (t1 - t0) * 0.1; stats.rend = stats.rend * 0.9 + (t2 - t1) * 0.1; stats.gap = stats.gap * 0.9 + (now - (stats.lastNow || now)) * 0.1; stats.lastNow = now;
}
export function start() { requestAnimationFrame(frame); }

// small helpers
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
export const wait = (s) => new Promise(r => setTimeout(r, s * 1000));
export function angleDamp(a, b, k, dt) {
  let d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + d * (1 - Math.exp(-k * dt));
}
