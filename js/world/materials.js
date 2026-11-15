import * as THREE from 'three';
import {tex} from '../core/assets.js';
import {onUpdate, SOFTWARE} from '../core/engine.js';

const cache = {};
/** Poly Haven PBR set (diff / nor_gl / rough). repeat = [u,v] per 1 unit of UV. */
export function pbr(name, repeat = [1, 1], extra = {}) {
  const key = name + repeat.join(',') + JSON.stringify(extra);
  if (cache[key]) return cache[key];
  const b = `assets/tex/${name}/`;
  const m = new THREE.MeshStandardMaterial({
    map: tex(b + 'diff.jpg', {repeat}),
    normalMap: tex(b + 'nor_gl.jpg', {srgb: false, repeat}),
    roughnessMap: tex(b + 'rough.jpg', {srgb: false, repeat}),
    roughness: 1, metalness: 0, ...extra,
  });
  return cache[key] = m;
}
export const M = {};
export function initMaterials() {
  M.plaster = pbr('painted_plaster_wall', [0.45, 0.45], {color: 0xd8c2a2});
  M.brick = pbr('brick_wall_005', [0.38, 0.38], {color: 0xe6ddd2, normalScale: new THREE.Vector2(1.2, 1.2)});
  M.beam = new THREE.MeshStandardMaterial({color: 0x2a2622, roughness: 0.55});
  M.plasterWarm = pbr('painted_plaster_wall', [0.45, 0.45], {color: 0xc9b08c});
  M.accentWall = new THREE.MeshStandardMaterial({color: 0x2f4a3f, roughness: 0.85});
  M.ceiling = new THREE.MeshStandardMaterial({color: 0x9c8f7c, roughness: 0.95, map: (() => { const t = canvasTex(256, 256, (g, W, H) => { g.fillStyle = '#e9e8e4'; g.fillRect(0, 0, W, H); for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`; g.fillRect(Math.random() * W, Math.random() * H, 2, 2); }  }); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(60, 40); return t; })()});
  M.trim = new THREE.MeshStandardMaterial({color: 0x2b2d2f, roughness: 0.45, metalness: 0.4});
  M.alu = new THREE.MeshStandardMaterial({color: 0x9da3a8, roughness: 0.32, metalness: 0.9});
  M.darkAlu = new THREE.MeshStandardMaterial({color: 0x3a3f44, roughness: 0.38, metalness: 0.85});
  M.steel = new THREE.MeshStandardMaterial({color: 0xc4c9cd, roughness: 0.22, metalness: 1.0});
  M.glass = new THREE.MeshPhysicalMaterial({color: 0x3b4a52, metalness: 0.2, roughness: 0.02, transparent: true, opacity: 0.4, envMapIntensity: 1.3, depthWrite: false, side: THREE.DoubleSide});
  M.glassInt = new THREE.MeshPhysicalMaterial({color: 0xeef4f4, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.10, envMapIntensity: 1.0, depthWrite: false, side: THREE.DoubleSide});
  M.frosted = new THREE.MeshStandardMaterial({color: 0xffffff, roughness: 0.6, transparent: true, opacity: 0.55, depthWrite: false});
  M.whiteTop = new THREE.MeshStandardMaterial({color: 0xf3f2ef, roughness: 0.35});
  M.blackPlastic = new THREE.MeshStandardMaterial({color: 0x161718, roughness: 0.45});
  M.fabricGrey = new THREE.MeshStandardMaterial({color: 0x4b4f54, roughness: 0.95});
  M.fabricGreen = new THREE.MeshStandardMaterial({color: 0x3d5a4c, roughness: 0.95});
  M.fabricSand = new THREE.MeshStandardMaterial({color: 0xb3a58e, roughness: 0.95});
  M.screenOff = new THREE.MeshStandardMaterial({color: 0x08090a, roughness: 0.15, metalness: 0.2});
  M.lightPanel = new THREE.MeshStandardMaterial({color: 0xffffff, emissive: 0xfff3e2, emissiveIntensity: 1.5, roughness: 1});
  M.floorWood = pbr('wood_floor_deck', [0.5, 0.5], {color: 0x8f7a6c, roughness: 0.8});
  M.floorLobby = pbr('large_floor_tiles_02', [0.36, 0.36], {color: 0xb9b6b0, roughness: 0.55, envMapIntensity: 1.3});
  M.floorTiles = pbr('large_floor_tiles_02', [0.35, 0.35]);
  M.walnut = pbr('walnut_veneer', [0.6, 0.6], {roughness: 0.6});
  M.oak = pbr('grey_oak_veneer_01', [1, 1], {roughness: 0.65});
  M.pavers = pbr('concrete_pavers', [0.25, 0.25]);
  M.herring = pbr('herringbone_pavement_03', [0.3, 0.3]);
  M.asphalt = pbr('asphalt_02', [0.12, 0.12]);
  M.concrete = pbr('brushed_concrete', [0.3, 0.3], {color: 0xd9d6d0});
  M.facade = pbr('concrete_tile_facade', [0.25, 0.25]);
  M.roof = pbr('brushed_concrete', [0.15, 0.15], {color: 0x8c9094, roughness: 1});
  M.leather = pbr('fabric_leather_02', [2, 2], {color: 0x6b4a33});
  M.carpet = new THREE.MeshStandardMaterial({color: 0x585d60, roughness: 1});
  M.plant = new THREE.MeshStandardMaterial({color: 0x3d5e2e, roughness: 0.8});
  M.soil = new THREE.MeshStandardMaterial({color: 0x2a1f16, roughness: 1});
  M.redCup = new THREE.MeshStandardMaterial({color: 0xb3171d, roughness: 0.4});
  M.paper = new THREE.MeshStandardMaterial({color: 0xf3f0e8, roughness: 0.9});
  M.blueFolder = new THREE.MeshStandardMaterial({color: 0x234f8c, roughness: 0.6});
  M.greyEnv = new THREE.MeshStandardMaterial({color: 0x8e8e88, roughness: 0.85});
  // interior surfaces should not be lit by the full outdoor sky
  for (const k of ['brick', 'plaster', 'plasterWarm', 'accentWall', 'ceiling', 'floorWood', 'floorLobby', 'whiteTop', 'walnut', 'oak', 'carpet', 'fabricGrey', 'fabricGreen', 'fabricSand', 'leather']) M[k].envMapIntensity = (M[k].envMapIntensity ?? 1) * 0.45;
  return M;
}

/** wind sway for foliage (vertex shader displacement grows with height above object base) */
const windU = {time: {value: 0}};
onUpdate((dt, t) => windU.time.value = t);
export function addWind(obj, strength = 1) {
  obj.traverse(o => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    o.material = mats.map(m0 => {
      const m = m0.clone();
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = windU.time; sh.uniforms.uStr = {value: strength};
        sh.vertexShader = 'uniform float uTime; uniform float uStr;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          { vec4 wp = modelMatrix * vec4(position,1.0);
            float h = max(0.0, position.y) ;
            float k = uStr * 0.012 * h * h;
            float g = 0.6 + 0.4*sin(uTime*0.35 + wp.x*0.05);           // gusts
            transformed.x += k * g * (sin(uTime*1.7 + wp.x*0.4 + wp.z*0.3) + 0.4*sin(uTime*3.9 + wp.z*1.3));
            transformed.z += k * g * 0.6 * sin(uTime*1.3 + wp.x*0.7);
            transformed.y += k * 0.15 * sin(uTime*4.1 + wp.x*2.0 + wp.z*2.0); }`);
      };
      m.customProgramCacheKey = () => 'wind' + strength;
      return m;
    });
    if (o.material.length === 1) o.material = o.material[0];
  });
}

/** Canvas texture helper */
export function canvasTex(w, h, draw, {srgb = true} = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = SOFTWARE ? 1 : 8;
  return t;
}
