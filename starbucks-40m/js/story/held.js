// Things the player holds in first person: a stopwatch (camera child, lower right of the view).
import * as THREE from 'three';
import {camera, onUpdate} from '../core/engine.js';
import {canvasTex} from '../world/materials.js';

const g = new THREE.Group(); g.visible = false; g.renderOrder = 10;
const face = document.createElement('canvas'); face.width = 256; face.height = 256;
const faceTex = new THREE.CanvasTexture(face); faceTex.colorSpace = THREE.SRGBColorSpace;
let built = false, secs = 0, running = false;

function build() {
  built = true; camera.add(g);
  const steel = new THREE.MeshStandardMaterial({color: 0xc9cdd2, metalness: 1, roughness: 0.25});
  const black = new THREE.MeshStandardMaterial({color: 0x15171a, roughness: 0.5});
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.014, 40), steel); body.rotation.x = Math.PI / 2; g.add(body);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.033, 0.0035, 10, 40), black); rim.position.z = 0.007; g.add(rim);
  const fm = new THREE.Mesh(new THREE.CircleGeometry(0.03, 40), new THREE.MeshBasicMaterial({map: faceTex, toneMapped: false})); fm.position.z = 0.0076; g.add(fm);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.012, 16), steel); crown.position.y = 0.04; g.add(crown);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.008, 0.002, 8, 20), steel); ring.position.y = 0.05; g.add(ring);
  // a hand: thumb on the crown, fingers wrapped around (simple, softly lit skin shapes)
  const skin = new THREE.MeshStandardMaterial({color: 0xc99a7a, roughness: 0.65});
  const palm = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.05, 6, 12), skin); palm.rotation.z = 1.2; palm.position.set(0.035, -0.035, -0.02); g.add(palm);
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.035, 6, 10), skin); thumb.rotation.z = 0.35; thumb.position.set(0.012, 0.03, 0.004); g.add(thumb);
  for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.0085, 0.03, 6, 10), skin); f.rotation.z = Math.PI / 2 + 0.2; f.position.set(-0.02 - i * 0.0, -0.012 - i * 0.017, -0.008); g.add(f); }
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.042, 0.12, 20), new THREE.MeshStandardMaterial({color: 0x4b3a30, roughness: 0.9})); cuff.rotation.z = 1.2; cuff.position.set(0.1, -0.075, -0.035); g.add(cuff);
  g.position.set(0.17, -0.15, -0.36); g.rotation.set(0.25, -0.35, 0.12);
  g.traverse(o => { if (o.isMesh) { o.renderOrder = 10; o.frustumCulled = false; } });
  draw();
}
function draw() {
  const c = face.getContext('2d'), W = 256;
  c.fillStyle = '#e9ecef'; c.fillRect(0, 0, W, W);
  c.strokeStyle = '#333'; for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2; const r0 = i % 5 ? 112 : 102; c.lineWidth = i % 5 ? 2 : 4; c.beginPath(); c.moveTo(128 + Math.sin(a) * r0, 128 - Math.cos(a) * r0); c.lineTo(128 + Math.sin(a) * 122, 128 - Math.cos(a) * 122); c.stroke(); }
  // LCD window
  c.fillStyle = '#b9c7a8'; c.fillRect(48, 140, 160, 56); c.fillStyle = '#1b2414'; c.font = '700 44px "Courier New", monospace'; c.textAlign = 'center';
  const m = Math.floor(secs / 60), s = Math.floor(secs % 60); c.fillText(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`, 128, 184);
  // sweep hand (seconds)
  const a = (secs % 60) / 60 * Math.PI * 2; c.strokeStyle = '#c0392b'; c.lineWidth = 4; c.beginPath(); c.moveTo(128, 128); c.lineTo(128 + Math.sin(a) * 100, 128 - Math.cos(a) * 100); c.stroke();
  c.fillStyle = '#c0392b'; c.beginPath(); c.arc(128, 128, 7, 0, 7); c.fill();
  faceTex.needsUpdate = true;
}
export function showStopwatch(on) { if (!built) build(); g.visible = on; if (on) { secs = 0; draw(); } }
export function setStopwatch(s) { secs = s; draw(); }
export const stopwatchShown = () => g.visible;
let bobT = 0;
onUpdate((dt) => { if (!g.visible) return; bobT += dt; g.position.y = -0.15 + Math.sin(bobT * 1.3) * 0.002; });
