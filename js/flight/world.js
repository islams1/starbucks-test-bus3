// New York for Flight 1549, built from open data by tools/build_nyc.py: the ground as aerial photos (USGS/NAIP) draped
// on USGS 3DEP elevation (the Palisades cliffs, Manhattan's ridge), the rivers as a moving water surface cut out by the
// elevation's water mask, every building tall enough to be seen from the flight (OpenStreetMap footprints with their
// surveyed heights), the George Washington Bridge, a mid-January afternoon sky with the low sun in the south-west, and
// the broken cloud layer reported at 3,700 ft.
import * as THREE from 'three';
import {Sky} from 'three/addons/objects/Sky.js';
import {scene, renderer, onUpdate, camera} from '../core/engine.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const W = {meta: null, group: new THREE.Group(), sunDir: V(), heights: null};
const BASE = 'assets/nyc/';

async function readBin(url) {
  const b = await (await fetch(url)).arrayBuffer();
  const hl = new DataView(b).getUint32(0, true), head = JSON.parse(new TextDecoder().decode(new Uint8Array(b, 4, hl)));
  const base = 4 + hl, out = {}, T = {float32: Float32Array, uint8: Uint8Array, uint32: Uint32Array};
  for (const h of head) out[h.name] = new T[h.dtype](b, base + h.offset, h.bytes / T[h.dtype].BYTES_PER_ELEMENT);
  out._head = head; return out;
}
const tex = (url, srgb = true) => new Promise(r => new THREE.TextureLoader().load(url, t => { if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; r(t); }, undefined, () => r(null)));

/** 0..1: how much the place at local x, z is river (the elevation data's water map; image row 0 = north) */
export function waterAt(x, z) {
  const M = W.maskData, m = W.meta; if (!M || !m) return 0;
  const [x0, z0, x1, z1] = m.coreXZ, u = Math.floor((x - x0) / (x1 - x0) * M.w), v = Math.floor((z - z0) / (z1 - z0) * M.h);
  if (u < 0 || v < 0 || u >= M.w || v >= M.h) return 0;
  return M.d[(v * M.w + u) * 4] / 255;
}
/** height of the ground (m) at local x, z — water reads as its bed (negative) */
export function heightAt(x, z) {
  const m = W.meta, H = W.heights; if (!H) return 0;
  const [x0, z0, x1, z1] = m.coreXZ, nx = m.terrain.nx, nz = m.terrain.nz;
  const u = (x - x0) / (x1 - x0) * (nx - 1), v = (z - z0) / (z1 - z0) * (nz - 1);
  if (u < 0 || v < 0 || u > nx - 1 || v > nz - 1) return 0;
  const i = Math.min(nx - 2, Math.floor(u)), j = Math.min(nz - 2, Math.floor(v)), fu = u - i, fv = v - j;
  const h = (a, b) => H[b * nx + a];
  return (h(i, j) * (1 - fu) + h(i + 1, j) * fu) * (1 - fv) + (h(i, j + 1) * (1 - fu) + h(i + 1, j + 1) * fu) * fv;
}

function facadeAtlas() {
  // four facade patterns side by side, each 12 m wide x one 3.4 m storey, repeating. Not colours but masks the shader
  // reads: R = wall brightness (weathering, the floor band), G = glass, B = a window lit inside. The building's own colour
  // (vertex colour) is the material: brick, limestone, concrete, metal.
  //   0 walk-up: four tall punched windows, a cornice line      1 office: five wide punched windows, a spandrel band
  //   2 curtain wall: glass across, thin mullions, spandrels    3 dark glass: as 2, almost no frame
  const S = 256, c = document.createElement('canvas'); c.width = S * 4; c.height = S; const g = c.getContext('2d');
  const styles = [{cols: 4, w: 0.36, y0: 0.2, y1: 0.78}, {cols: 5, w: 0.58, y0: 0.24, y1: 0.8}, {cols: 8, w: 0.9, y0: 0.1, y1: 0.86}, {cols: 6, w: 0.96, y0: 0.06, y1: 0.95}];
  styles.forEach((s, k) => {
    const ox = k * S;
    for (let y = 0; y < S; y += 4) for (let x = 0; x < S; x += 4) { const v = 196 + (Math.random() - 0.5) * 34; g.fillStyle = `rgb(${v | 0},0,0)`; g.fillRect(ox + x, y, 4, 4); }
    g.fillStyle = 'rgb(150,0,0)'; g.fillRect(ox, 0, S, S * 0.05);                        // the floor line / spandrel edge
    if (k === 0) { g.fillStyle = 'rgb(225,0,0)'; g.fillRect(ox, S * 0.94, S, S * 0.06); }   // lintels
    const cw = S / s.cols;
    for (let i = 0; i < s.cols; i++) {
      const x = ox + i * cw + cw * (1 - s.w) / 2, w = cw * s.w, y = S * (1 - s.y1), h = S * (s.y1 - s.y0);
      const lit = Math.random() < (k >= 2 ? 0.05 : 0.08) ? 255 : 0;
      g.fillStyle = `rgb(60,255,${lit})`; g.fillRect(x, y, w, h);
      if (k <= 1) { g.fillStyle = 'rgb(90,40,0)'; g.fillRect(x + w / 2 - 1.5, y, 3, h); g.fillRect(x, y + h * 0.45, w, 3); }   // sashes
    }
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}
function buildingMaterial() {
  const m = new THREE.MeshLambertMaterial({vertexColors: true, map: facadeAtlas()});
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSkyGlass = {value: new THREE.Color(0xa9b8c8)};
    sh.fragmentShader = 'uniform vec3 uSkyGlass;\n' + sh.fragmentShader.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        if (vMapUv.x >= 0.0) {                       // walls: uv.x = style*1000 + metres/12, uv.y = storeys from the base
          float st = floor(vMapUv.x / 1000.0);
          vec2 q = vec2((st + fract(vMapUv.x - st * 1000.0)) / 4.0, fract(vMapUv.y));
          vec3 f = texture2D(map, q).rgb;
          vec3 wall = diffuseColor.rgb * (0.7 + 0.55 * f.r);
          // glass: dark for the old punched windows, the bright winter sky reflected in the curtain walls
          vec3 glass = st >= 2.0 ? mix(vec3(0.2, 0.24, 0.28), uSkyGlass, st >= 3.0 ? 0.45 : 0.66) : vec3(0.11, 0.12, 0.13);
          vec3 col = mix(wall, glass, f.g);
          col += vec3(1.0, 0.82, 0.55) * f.b * 0.35;                  // a few lights on inside
          col *= mix(0.6, 1.0, smoothstep(0.0, 4.0, vMapUv.y));     // the street's shadow on the lowest floors
          diffuseColor.rgb = col;
        } else {
          diffuseColor.rgb *= 0.95;                  // roofs keep the photo's colour; penthouses and tanks their own
        }
      #endif`);
  };
  m.customProgramCacheKey = () => 'nycBuildings2';
  return m;
}

/** the river: a real planar reflection (the sky, the skyline, the bridge, the airplane) broken up by moving wind ripples;
 *  only where the elevation data says there is water (mask) */
function waterShader(mask, normals) {
  return {
    uniforms: {color: {value: new THREE.Color(0xffffff)}, tDiffuse: {value: null}, textureMatrix: {value: null},
      uTime: {value: 0}, uSun: {value: W.sunDir}, uMask: {value: mask}, uNorm: {value: normals}, uCore: {value: new THREE.Vector4()},
      uDebug: {value: 0}, uDeep: {value: new THREE.Color(0x26383a)},
      // the airplane on the water: uWake = (x, z, heading rad, seconds since touchdown), uTouch = touchdown point (x, z, on)
      uWake: {value: new THREE.Vector4(0, 0, 0, -1)}, uTouch: {value: new THREE.Vector3(0, 0, 0)}, uFogC: {value: new THREE.Color(0xb4c0cc)}, uFogD: {value: 0.000055}},
    vertexShader: `#include <common>
      #include <logdepthbuf_pars_vertex>
      uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vW;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vUv = textureMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewMatrix * w;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `#include <common>
      #include <logdepthbuf_pars_fragment>
      uniform sampler2D tDiffuse, uMask, uNorm; uniform float uTime, uFogD, uDebug; uniform vec3 uSun, uFogC, uDeep; uniform vec4 uCore;
      uniform vec4 uWake; uniform vec3 uTouch;
      varying vec4 vUv; varying vec3 vW;
      float h21(vec2 q){ return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 q){ vec2 i = floor(q), f = fract(q); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
      void main(){
        #include <logdepthbuf_fragment>
        vec2 mu = vec2((vW.x - uCore.x) / (uCore.z - uCore.x), (vW.z - uCore.y) / (uCore.w - uCore.y));
        float m = (mu.x < 0.0 || mu.y < 0.0 || mu.x > 1.0 || mu.y > 1.0) ? 0.0 : texture2D(uMask, vec2(mu.x, 1.0 - mu.y)).r;   // image row 0 = north; textures are flipped
        if (m < 0.45) discard;
        vec2 p = vW.xz;
        vec2 wd = vec2(0.866, 0.5), wd2 = vec2(0.643, 0.766), wd3 = vec2(0.966, 0.259);   // downwind (120°) and either side
        vec3 n1 = texture2D(uNorm, (p - wd * uTime * 0.75) / 38.0).rgb * 2.0 - 1.0;
        vec3 n2 = texture2D(uNorm, (p - wd2 * uTime * 0.45) / 11.0).rgb * 2.0 - 1.0;
        vec3 n3 = texture2D(uNorm, (p - wd3 * uTime * 1.1) / 140.0).rgb * 2.0 - 1.0;
        vec3 n = normalize(vec3(n1.x + n2.x * 0.6 + n3.x * 1.4, 2.4, n1.y + n2.y * 0.6 + n3.y * 1.4));   // an 8-kt breeze: choppy, not glassy
        // ---- the airplane in the water: rings of waves running out from where it hit, a bow wave and churned foam along the
        // hull, and the white wake of its slide back to the touchdown point (fading over a minute)
        float foam = 0.0;
        if (uWake.w >= 0.0) {
          float t = uWake.w;
          vec2 rel = p - uWake.xy, fw = vec2(sin(uWake.z), -cos(uWake.z)), rt = vec2(-fw.y, fw.x);
          float u = dot(rel, fw), w = dot(rel, rt);
          // rings from the touchdown point
          vec2 rp = p - uTouch.xy; float r = length(rp), front = 7.5 * t, ring = r - front;
          float amp = exp(-abs(ring) * 0.12) * exp(-t * 0.05) * smoothstep(0.0, 20.0, r);
          float wave = sin(ring * 0.55) * amp;
          n = normalize(n + vec3(rp.x / max(r, 0.1), 0.0, rp.y / max(r, 0.1)) * wave * 0.9);
          // churned water along the waterline (a thin band just outside the fuselage) and round the two engines
          float hd = length(vec2(max(abs(u) - 18.5, 0.0), max(abs(w) - 1.95, 0.0)));
          float hullF = (1.0 - smoothstep(0.0, 1.6 + 0.8 * exp(-t * 0.1), hd)) * step(0.001, hd);
          float eng = max(1.0 - smoothstep(1.4, 3.2, length(vec2(u - 3.0, abs(w) - 5.75))), 0.0) * exp(-t * 0.06);
          float bow = (1.0 - smoothstep(0.0, 3.5, length(vec2(max(u - 18.5, 0.0), abs(w) * 0.6)))) * step(18.0, u) * exp(-t * 0.12);
          // the wake of the slide: a narrow churned trail behind the tail and the two arms of a V (about 19.5° each side)
          float back = -u - 18.5, slid = length(uWake.xy - uTouch.xy) + 6.0;
          float behind = step(0.0, back) * (1.0 - smoothstep(slid * 0.8, slid, back)) * step(0.5, uTouch.z);
          float trail = (1.0 - smoothstep(2.5, 5.5 + back * 0.04, abs(w))) * exp(-back * 0.008) * behind;
          float arm = abs(abs(w) - back * 0.354);
          float vee = (1.0 - smoothstep(0.6, 2.8 + back * 0.02, arm)) * exp(-back * 0.012) * behind;
          float fade = exp(-t * 0.025);
          // foam is streaky (stretched along the flow) and broken into flecks
          vec2 fq = vec2(u * 0.12, w * 0.7);
          float nz = vnoise(fq + uTime * 0.15) * 0.55 + vnoise(p * 1.3 + uTime * 0.4) * 0.3 + vnoise(p * 4.0) * 0.15;
          float body = hullF * 0.95 + eng * 0.8 + bow * 0.9 + (trail * 0.75 + vee * 0.55) * fade;
          foam = clamp(body * smoothstep(0.32, 0.7, nz + body * 0.25), 0.0, 1.0);
        }
        vec3 v = normalize(cameraPosition - vW); float d = length(cameraPosition - vW);
        float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
        // the reflection, broken by the ripples and smeared vertically (a rough surface stretches reflections into
        // streaks); a few taps blur it the way chop does. Less displacement far away, where the waves blend together.
        float k = mix(0.022, 0.006, clamp(d / 3000.0, 0.0, 1.0));
        vec2 dist = vec2(n.x * k, n.z * k * 1.5);
        vec3 refl = vec3(0.0);
        for (int i = 0; i < 5; i++) {
          float o = (float(i) - 2.0) * 0.4;
          refl += texture2DProj(tDiffuse, vec4(vUv.xy + (dist + vec2(o * k * 0.12, o * k * 0.22)) * vUv.w, vUv.zw)).rgb;
        }
        refl *= 0.2 * vec3(0.74, 0.82, 0.86);                       // cold river water: darker, a little green-blue
        vec3 r = reflect(-v, n);
        float sd = max(dot(r, normalize(uSun)), 0.0);
        float spec = pow(sd, 300.0) * 5.0 + pow(sd, 40.0) * 0.25 + pow(sd, 8.0) * 0.05;   // the low sun glitters on the chop
        // the body of the water: murky Hudson green-grey, lighter where the sky light falls into the wave faces
        vec3 body = uDeep * (0.8 + 0.5 * clamp(n.y * 1.2 - 0.6, 0.0, 1.0));
        vec3 col = mix(body, refl, clamp(fres * 0.95 + 0.05, 0.0, 1.0)) + vec3(1.0, 0.9, 0.74) * spec;
        col = mix(col, vec3(0.82, 0.87, 0.88), foam * 0.75);                                 // white water
        col = mix(col, uFogC, 1.0 - exp(-d * uFogD));
        if (uDebug > 0.5) col = uDebug > 1.5 ? vec3(fres) : refl;
        gl_FragColor = vec4(col, smoothstep(0.45, 0.6, m));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  };
}
/** a tiling normal map of small wind-driven ripples (sum of random sine waves, so it wraps seamlessly) */
function waterNormals() {
  const S = 256, h = new Float32Array(S * S), waves = [];
  for (let k = 0; k < 28; k++) { const a = Math.random() * Math.PI * 2, f = 1 + Math.floor(Math.random() * 9); waves.push([Math.round(Math.cos(a) * f), Math.round(Math.sin(a) * f), Math.random() * 6.28, 1 / f]); }
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { let v = 0; for (const [kx, ky, ph, a] of waves) v += Math.sin((kx * x + ky * y) / S * Math.PI * 2 + ph) * a; h[y * S + x] = v; }
  const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), im = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = h[y * S + (x + 1) % S] - h[y * S + (x + S - 1) % S], dy = h[((y + 1) % S) * S + x] - h[((y + S - 1) % S) * S + x];
    const n = new THREE.Vector3(-dx * 3, -dy * 3, 1).normalize(), i = (y * S + x) * 4;
    im.data[i] = (n.x * 0.5 + 0.5) * 255; im.data[i + 1] = (n.y * 0.5 + 0.5) * 255; im.data[i + 2] = (n.z * 0.5 + 0.5) * 255; im.data[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function cloudTexture() {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  g.clearRect(0, 0, S, S);
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * S, y = Math.random() * S, r = 30 + Math.random() * 130, a = 0.12 + Math.random() * 0.22;
    for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
      const q = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); q.addColorStop(0, `rgba(255,255,255,${a})`); q.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = q; g.beginPath(); g.arc(x + ox, y + oy, r, 0, 7); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

/** the George Washington Bridge: two lattice steel towers (184 m), the upper deck at about 65 m, main cables and suspenders */
function buildGWB(meta) {
  const G = new THREE.Group();
  const lat = 40.8517, lon = -73.9527, cx = (lon - meta.origin[1]) * meta.mlon, cz = -(lat - meta.origin[0]) * meta.mlat;
  const bearing = THREE.MathUtils.degToRad(106);                 // from the New Jersey tower towards Manhattan
  const dir = V(Math.sin(bearing), 0, -Math.cos(bearing)), side = V(dir.z, 0, -dir.x);
  G.position.set(cx, 0, cz); G.rotation.set(0, Math.atan2(-dir.z, dir.x), 0);   // local +x along the bridge
  const steel = new THREE.MeshLambertMaterial({color: 0x9aa2a6});
  const half = 533, towerH = 184, deckY = 65;
  for (const s of [-1, 1]) {
    const T = new THREE.Group(); T.position.set(s * half, 0, 0); G.add(T);
    for (const w of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(9, towerH, 11), steel); leg.position.set(0, towerH / 2, w * 17); T.add(leg);
    }
    for (const y of [70, 120, 176]) { const b = new THREE.Mesh(new THREE.BoxGeometry(7, 9, 34), steel); b.position.set(0, y, 0); T.add(b); }
    for (let y = 12; y < 170; y += 26) {                        // cross bracing (the unclad steel lattice)
      const x = new THREE.Mesh(new THREE.BoxGeometry(2, 30, 2), steel); x.position.set(0, y + 13, 0); x.rotation.x = 0.75; T.add(x);
      const x2 = x.clone(); x2.rotation.x = -0.75; T.add(x2);
    }
  }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(half * 2 + 900, 9, 36), new THREE.MeshLambertMaterial({color: 0x7f8589})); deck.position.y = deckY; G.add(deck);
  const cableM = new THREE.MeshLambertMaterial({color: 0x8d9498});
  for (const w of [-15, 15]) {
    const pts = [];
    for (let k = 0; k <= 40; k++) { const x = -half + 2 * half * k / 40, y = deckY + 6 + (towerH - deckY - 10) * Math.pow(x / half, 2); pts.push(V(x, y, w)); }
    const side1 = []; for (let k = 0; k <= 10; k++) { const x = -half - 330 * (1 - k / 10); side1.push(V(x, deckY + 4 + (towerH - deckY - 8) * (k / 10) ** 1.5, w)); }
    const side2 = side1.map(p => V(-p.x, p.y, w)).reverse();
    for (const P of [pts, side1, side2]) G.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(P), 60, 0.9, 6), cableM));
    for (let k = 1; k < 40; k++) { const x = -half + 2 * half * k / 40, y = deckY + 6 + (towerH - deckY - 10) * Math.pow(x / half, 2); const s = new THREE.Mesh(new THREE.BoxGeometry(0.25, y - deckY, 0.25), cableM); s.position.set(x, (y + deckY) / 2, w); G.add(s); }
  }
  G.traverse(o => { if (o.isMesh) { o.matrixAutoUpdate = false; o.updateMatrix(); } });
  return G;
}

export async function buildWorld(onProgress = () => {}) {
  const meta = W.meta = await (await fetch(BASE + 'meta.json')).json();
  scene.add(W.group);
  // ---- sky and sun: 15 January 2009, 15:27 EST, New York — the sun about 14° up, in the south-west
  const sky = new Sky(); sky.scale.setScalar(450000); scene.add(sky); W.sky = sky;
  const su = sky.material.uniforms; su.turbidity.value = 6; su.rayleigh.value = 1.4; su.mieCoefficient.value = 0.006; su.mieDirectionalG.value = 0.85;
  const el = THREE.MathUtils.degToRad(14), az = THREE.MathUtils.degToRad(226);
  W.sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
  su.sunPosition.value.copy(W.sunDir);
  const sun = new THREE.DirectionalLight(0xffe8cc, 2.4); sun.position.copy(W.sunDir).multiplyScalar(1000); scene.add(sun); scene.add(sun.target); W.sun = sun;
  const hemi = new THREE.HemisphereLight(0xb8c8da, 0x5a5650, 1.15); scene.add(hemi); W.hemi = hemi;
  scene.fog = new THREE.FogExp2(0xb4c0cc, 0.000055); W.fog = scene.fog;
  // ---- terrain heights
  const T = await readBin(BASE + 'terrain.bin'); W.heights = T.h; onProgress(0.1);
  const [x0, z0, x1, z1] = meta.coreXZ, GT = meta.tiles, tw = (x1 - x0) / GT, th = (z1 - z0) / GT;
  // ---- outer ring (flat, low resolution) under the core
  const outerT = await tex(BASE + 'outer.jpg');
  const [ox0, oz0, ox1, oz1] = meta.outerXZ;
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(ox1 - ox0, oz1 - oz0), new THREE.MeshLambertMaterial({map: outerT}));
  outer.rotation.x = -Math.PI / 2; outer.position.set((ox0 + ox1) / 2, -2.5, (oz0 + oz1) / 2); W.group.add(outer); W.outer = outer;
  // ---- core ground: one draped photo per tile
  const SEG = 128; let done = 0;
  const jobs = [];
  for (let j = 0; j < GT; j++) for (let i = 0; i < GT; i++) jobs.push((async () => {
    const t = await tex(`${BASE}ground_${i}_${j}.jpg`);
    const g = new THREE.PlaneGeometry(tw, th, SEG, SEG); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, cx = x0 + (i + 0.5) * tw, cz = z0 + (j + 0.5) * th;
    for (let k = 0; k < p.count; k++) p.setY(k, heightAt(cx + p.getX(k), cz + p.getZ(k)));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({map: t}));
    m.position.set(cx, 0, cz); m.receiveShadow = false; m.userData.ij = [i, j]; W.group.add(m); (W.ground = W.ground || []).push(m);
    onProgress(0.1 + 0.5 * (++done / jobs.length));
  })());
  await Promise.all(jobs);
  // ---- water
  const mask = await tex(BASE + 'water_mask.png', false);
  const normals = (await tex('assets/flight/waternormals.jpg', false)) || waterNormals();
  normals.wrapS = normals.wrapT = THREE.RepeatWrapping;
  if (mask) { mask.minFilter = THREE.LinearFilter; mask.generateMipmaps = false; }
  // the same water map readable from code (which places are river): the photographed city's tiles over the river are
  // replaced by our moving water where they are coarse
  if (mask && mask.image) try { const c = document.createElement('canvas'); c.width = mask.image.width; c.height = mask.image.height; const g = c.getContext('2d', {willReadFrequently: true}); g.drawImage(mask.image, 0, 0); W.maskData = {w: c.width, h: c.height, d: g.getImageData(0, 0, c.width, c.height).data}; } catch (e) {}
  const RES = W.reflectRes || 1024;
  // a planar mirror of our own (three's Reflector clips with an oblique projection, which the logarithmic depth buffer
  // breaks): a camera mirrored below the river renders the scene into a texture the water samples with the ripples
  const sh = waterShader(mask, normals);
  const rt = new THREE.WebGLRenderTarget(RES, RES / 2, {type: THREE.HalfFloatType}); rt.texture.colorSpace = THREE.LinearSRGBColorSpace;
  const textureMatrix = new THREE.Matrix4();
  W.reflectRT = rt;
  sh.uniforms.tDiffuse.value = rt.texture; sh.uniforms.textureMatrix.value = textureMatrix;
  const wm = new THREE.ShaderMaterial({uniforms: sh.uniforms, vertexShader: sh.vertexShader, fragmentShader: sh.fragmentShader, transparent: true, depthWrite: false});
  const water = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), wm);
  const vcam = new THREE.PerspectiveCamera(), cp = new THREE.Vector3(), cd = new THREE.Vector3(), cq = new THREE.Quaternion(), up = new THREE.Vector3();
  const bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  water.onBeforeRender = (renderer, scene, camera) => {
    camera.getWorldPosition(cp); if (cp.y < 0.5 || W.reflect === false) return;
    if ((W.reflectEvery || 1) > 1 && (W._rf = ((W._rf || 0) + 1) % W.reflectEvery) !== 0 && renderer.getRenderTarget() !== rt) return;   // light: every other frame
    camera.getWorldDirection(cd); camera.getWorldQuaternion(cq); up.set(0, 1, 0).applyQuaternion(cq);
    vcam.position.set(cp.x, -cp.y, cp.z); vcam.up.set(up.x, -up.y, up.z);
    vcam.lookAt(cp.x + cd.x, -(cp.y + cd.y), cp.z + cd.z);
    vcam.fov = camera.fov; vcam.aspect = camera.aspect; vcam.near = Math.max(0.5, camera.near); vcam.far = camera.far; vcam.updateProjectionMatrix(); vcam.updateMatrixWorld();
    textureMatrix.copy(bias).multiply(vcam.projectionMatrix).multiply(vcam.matrixWorldInverse).multiply(water.matrixWorld);
    const hide = [water, ...(W.hideInReflection || []), ...(W.hideInReflectionNow ? W.hideInReflectionNow() : [])], vis = hide.map(o => o.visible); hide.forEach(o => { o.visible = false; });
    const cur = renderer.getRenderTarget(), sm = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false;
    // (no clipping plane: toggling it re-resolved every material's shader twice a frame; the river bed and the
    //  photographed ground are one-sided, so from under the water they are culled anyway)
    // the material drawn just before the water (the cloud layer: depthWrite off) leaves the depth mask off, and then the
    // clear below would not clear depth: last frame's depths stayed and drew dark ghost streaks across the reflection
    renderer.state.buffers.depth.setMask(true); renderer.state.buffers.color.setMask(true);
    // the world matrices were just updated for this frame's main render: do not walk the whole scene a second time
    const mwa = scene.matrixWorldAutoUpdate; scene.matrixWorldAutoUpdate = false;
    renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, vcam); renderer.setRenderTarget(cur);
    scene.matrixWorldAutoUpdate = mwa;
    renderer.shadowMap.autoUpdate = sm; hide.forEach((o, i) => { o.visible = vis[i]; });
  };
  wm.uniforms.uCore.value.set(x0, z0, x1, z1); wm.uniforms.uMask.value = mask; wm.uniforms.uNorm.value = normals; wm.uniforms.uSun.value = W.sunDir;
  water.rotation.x = -Math.PI / 2; water.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
  water.renderOrder = 1; W.group.add(water); W.water = water;
  onUpdate((dt, t) => { wm.uniforms.uTime.value = t; });
  // ---- buildings
  const bm = buildingMaterial(); let bd = 0;
  await Promise.all((meta.buildings || []).map(async (b) => {
    // one block of the city that fails to arrive (or arrives broken) is left out; it never stops the game
    let B; try { B = await readBin(BASE + b.file); if (!B.p || !B.i) throw new Error('incomplete'); } catch (e) { console.warn('[city] skipped', b.file, e.message); onProgress(0.6 + 0.3 * (++bd / meta.buildings.length)); return; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(B.p, 3)); g.setAttribute('normal', new THREE.BufferAttribute(B.n, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(B.uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(B.c, 3, true));
    g.setIndex(new THREE.BufferAttribute(B.i, 1)); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, bm); W.group.add(m); (W.buildingMeshes = W.buildingMeshes || []).push(m);
    onProgress(0.6 + 0.3 * (++bd / meta.buildings.length));
  }));
  // ---- the George Washington Bridge and the cloud layer (broken at 3,700 ft)
  W.gwb = buildGWB(meta); W.group.add(W.gwb);
  const ct = cloudTexture(); ct.repeat.set(5, 5);
  const clouds = new THREE.Mesh(new THREE.PlaneGeometry(90000, 90000), new THREE.MeshBasicMaterial({map: ct, transparent: true, depthWrite: false, opacity: 0.85, fog: false}));
  clouds.rotation.x = Math.PI / 2; clouds.position.y = 1130; W.group.add(clouds); W.clouds = clouds;
  onUpdate((dt) => { ct.offset.x += dt * 0.0008; ct.offset.y += dt * 0.0003; });
  W.group.traverse(o => { if (o.isMesh && o !== water) o.frustumCulled = true; });
  onProgress(1);
  return W;
}
