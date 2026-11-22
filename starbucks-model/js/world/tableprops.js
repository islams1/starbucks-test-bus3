// Things on the committee table: the queue observation card, the comment box and its two cards, Ellis's tablet (held
// in the player's hands while it is used), the memo pad, coffee, and the two calendar cards of the pilot route.
import * as THREE from 'three';
import {scene, camera, onUpdate} from '../core/engine.js';
import {canvasTex} from './materials.js';
import {TABLE} from './room.js';

const Y = TABLE.y;
export const TP = {};
const paperM = (map) => new THREE.MeshStandardMaterial({map, roughness: 0.88, color: 0xffffff});
function flat(w, d, mat, x, z, ry = 0, y = Y + 0.0015) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.rotation.z = ry; m.position.set(x, y, z); m.receiveShadow = true; scene.add(m); return m; }
const EN = new URLSearchParams(location.search).get('lang') === 'en';

// ---------------------------------------------------------------- the queue observation card (in front of the player)
let qcTex = null, qcActive = null, qcSeen = {peak: false, off: false};
function drawQueueCard() {
  const c = qcTex.image, g = c.getContext('2d'), W = c.width, H = c.height;
  g.fillStyle = '#f7f3ea'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#2f4a3f'; g.fillRect(0, 0, W, 64);
  g.fillStyle = '#f7f3ea'; g.font = '600 34px "IBM Plex Sans Arabic"'; g.textAlign = 'right'; g.fillText(EN ? 'Queue observation' : 'بطاقة الانتظار', W - 24, 44);
  g.textAlign = 'left'; g.font = '500 22px "IBM Plex Sans Arabic"'; g.fillStyle = '#cfe0d6'; g.fillText(EN ? 'Illustrative' : 'تعليمي', 22, 42);
  const row = (y, key, label, val) => {
    if (qcActive === key) { g.fillStyle = 'rgba(217,178,111,.28)'; g.fillRect(10, y - 46, W - 20, 64); }
    g.textAlign = 'right'; g.fillStyle = '#2b2a26'; g.font = '600 32px "IBM Plex Sans Arabic"'; g.fillText(label, W - 24, y);
    g.textAlign = 'left'; g.font = '700 36px Inter'; g.fillStyle = qcSeen[key] ? '#1f3a30' : '#a59d8c'; g.fillText(val, 24, y);
  };
  row(140, 'peak', EN ? 'Peak · 8:10 am' : 'الذروة · 8:10 ص', EN ? '7 min' : '7 د');
  row(222, 'off', EN ? 'Off-peak · 3:30 pm' : 'الهدوء · 3:30 م', EN ? '2 min' : '2 د');
  g.strokeStyle = '#d8cfbb'; g.lineWidth = 2; g.beginPath(); g.moveTo(20, 172); g.lineTo(W - 20, 172); g.stroke();
  g.fillStyle = '#7a6f5d'; g.font = '500 20px "IBM Plex Sans Arabic"'; g.textAlign = 'right'; g.fillText(EN ? 'median wait, order to pickup (simulated)' : 'متوسط الانتظار من الطلب للاستلام (محاكاة)', W - 24, 280);
  qcTex.needsUpdate = true;
}
export function setQueueCard(active, seen) { qcActive = active; if (seen) Object.assign(qcSeen, seen); if (qcTex) drawQueueCard(); }

// ---------------------------------------------------------------- the tablet (on the table; in the hands while used)
let tabTex = null, tabletOnTable = null, held = null, hands = null;
export function drawTablet(fn) { const c = tabTex.image; fn(c.getContext('2d'), c.width, c.height); tabTex.needsUpdate = true; }

export function buildTableProps() {
  // queue card
  qcTex = canvasTex(512, 300, () => {}); drawQueueCard();
  TP.queueCard = flat(0.17, 0.1, paperM(qcTex), -0.34, 0.5, 0.08);
  TP.queueCard.castShadow = false;
  // comment box (by Noor) and two cards beside it
  const wood = new THREE.MeshStandardMaterial({color: 0x6b4a33, roughness: 0.6});
  const bx = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.09), wood); bx.position.set(-0.98, Y + 0.045, -0.4); bx.castShadow = bx.receiveShadow = true; scene.add(bx);
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.002, 0.008), new THREE.MeshStandardMaterial({color: 0x111111})); slot.position.set(-0.98, Y + 0.091, -0.4); scene.add(slot);
  const lab = canvasTex(256, 96, (g, w, h) => { g.fillStyle = '#e9dcc0'; g.fillRect(0, 0, w, h); g.fillStyle = '#3a2a18'; g.font = '600 40px "IBM Plex Sans Arabic"'; g.textAlign = 'center'; g.fillText(EN ? 'Comments' : 'صندوق الرأي', w / 2, 62); });
  const lb = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.03), paperM(lab)); lb.position.set(-0.98, Y + 0.05, -0.354); scene.add(lb);
  const card = (txt, x, z, r) => { const t = canvasTex(320, 200, (g, w, h) => { g.fillStyle = '#fbf7ee'; g.fillRect(0, 0, w, h); g.fillStyle = '#1f2a44'; g.font = '500 30px "Noto Naskh Arabic"'; g.textAlign = 'center'; g.fillText(txt, w / 2, 110); }); return flat(0.09, 0.056, paperM(t), x, z, r, Y + 0.002); };
  TP.cards = [card('…', -0.84, -0.3, 0.3), card('…', -0.78, -0.36, -0.2)];
  TP.commentBox = bx;
  // the tablet near Ellis
  tabTex = canvasTex(800, 520, (g, w, h) => { g.fillStyle = '#0d0e10'; g.fillRect(0, 0, w, h); });
  const tg = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.008, 0.17), new THREE.MeshStandardMaterial({color: 0x1a1b1d, roughness: 0.3, metalness: 0.5})); body.castShadow = true; tg.add(body);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.232, 0.152), new THREE.MeshBasicMaterial({map: tabTex, toneMapped: false})); scr.rotation.x = -Math.PI / 2; scr.position.y = 0.0045; tg.add(scr);
  tg.position.set(0.6, Y + 0.004, -0.5); tg.rotation.y = 0.25; scene.add(tg);
  tabletOnTable = tg; TP.tablet = tg;
  // the memo pad and a pen (in front of the player, right)
  const memoT = canvasTex(360, 480, (g, w, h) => { g.fillStyle = '#fbf8f0'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d9d0bc'; for (let y = 90; y < h; y += 34) { g.beginPath(); g.moveTo(20, y); g.lineTo(w - 20, y); g.stroke(); } g.fillStyle = '#2f4a3f'; g.font = '600 30px "IBM Plex Sans Arabic"'; g.textAlign = 'right'; g.fillText(EN ? 'Decision memo' : 'مذكرة القرار', w - 24, 56); });
  TP.memoTex = memoT;
  TP.memo = flat(0.15, 0.2, paperM(memoT), 0.36, 0.52, -0.12, Y + 0.004);
  const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.14, 10), new THREE.MeshStandardMaterial({color: 0x1d1e20, roughness: 0.3, metalness: 0.6})); pen.rotation.z = Math.PI / 2; pen.rotation.y = 0.5; pen.position.set(0.48, Y + 0.0045, 0.5); pen.castShadow = true; scene.add(pen); TP.pen = pen;
  // coffee at each place
  const mugM = new THREE.MeshStandardMaterial({color: 0xf1ede5, roughness: 0.35}), coffeeM = new THREE.MeshStandardMaterial({color: 0x2b1a10, roughness: 0.15});
  for (const [x, z] of [[0.66, 0.4], [-0.7, -0.55], [1.12, -0.6], [1.95, 0.3]]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.036, 0.09, 20), mugM); m.position.set(x, Y + 0.045, z); m.castShadow = true; scene.add(m);
    const c = new THREE.Mesh(new THREE.CircleGeometry(0.036, 20), coffeeM); c.rotation.x = -Math.PI / 2; c.position.set(x, Y + 0.08, z); scene.add(c);
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 8, 16, Math.PI), mugM); h.position.set(x + 0.04, Y + 0.05, z); h.rotation.z = -Math.PI / 2; scene.add(h);
  }
  // the pilot route's two calendar cards (hidden until then): test store and comparison store, the same weeks
  TP.calendars = [0, 1].map(i => {
    const t = canvasTex(400, 300, (g, w, h) => {
      g.fillStyle = '#fbf8f0'; g.fillRect(0, 0, w, h); g.fillStyle = i ? '#6b604c' : '#2f4a3f'; g.fillRect(0, 0, w, 70);
      g.fillStyle = '#fff'; g.font = '600 34px "IBM Plex Sans Arabic"'; g.textAlign = 'center'; g.fillText(EN ? (i ? 'Comparison store' : 'Test store') : (i ? 'فرع المقارنة' : 'فرع التجربة'), w / 2, 48);
      g.fillStyle = '#2b2a26'; g.font = '500 24px "IBM Plex Sans Arabic"'; g.fillText(EN ? (i ? 'staffing unchanged' : '+ added labor at peak') : (i ? 'العمالة كما هي' : '+ عمالة في الذروة'), w / 2, 108);
      g.strokeStyle = '#cfc4ab'; g.lineWidth = 2;
      for (let r = 0; r < 4; r++) for (let d = 0; d < 7; d++) { const x = 40 + d * 46, y = 130 + r * 38; g.strokeRect(x, y, 40, 32); if (d < 5) { g.fillStyle = i ? 'rgba(107,96,76,.25)' : 'rgba(47,74,63,.3)'; g.fillRect(x + 2, y + 2, 36, 28); } }
      g.fillStyle = '#6b604c'; g.font = '500 20px "IBM Plex Sans Arabic"'; g.fillText(EN ? 'the same 4 weeks · peak hours' : 'نفس الأسابيع الأربعة · ساعات الذروة', w / 2, h - 10);
    });
    const tent = new THREE.Group(); tent.visible = false; scene.add(tent);
    const a = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.09), new THREE.MeshStandardMaterial({map: t, roughness: 0.8, side: THREE.DoubleSide}));
    a.position.set(0, 0.04, 0.012); a.rotation.x = -0.28; a.castShadow = true; tent.add(a);
    tent.position.set(-0.62 + i * 0.15, Y, 0.34); tent.rotation.y = 0.05;
    return tent;
  });
  // the player's hands holding the tablet (camera children; shown only while the tablet is used)
  held = new THREE.Group(); held.visible = false; camera.add(held);
  const hb = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.012), new THREE.MeshStandardMaterial({color: 0x17181a, roughness: 0.3, metalness: 0.5})); held.add(hb); held.userData.body = hb;
  const skin = new THREE.MeshStandardMaterial({color: 0xc39274, roughness: 0.62});
  const cuffM = new THREE.MeshStandardMaterial({color: 0x2e3440, roughness: 0.85});
  hands = [-1, 1].map(s => {
    const h = new THREE.Group(); held.add(h);
    const palm = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, 0.05, 6, 12), skin); palm.rotation.z = s * 0.35; palm.position.set(s * 0.012, -0.03, -0.022); h.add(palm);
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.0085, 0.032, 6, 10), skin); thumb.rotation.z = s * -0.9; thumb.position.set(s * -0.012, 0.004, 0.009); h.add(thumb);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.04, 0.16, 18), cuffM); cuff.rotation.z = s * 0.5; cuff.position.set(s * 0.05, -0.1, -0.04); h.add(cuff);
    h.traverse(o => { if (o.isMesh) { o.renderOrder = 10; o.frustumCulled = false; } });
    return h;
  });
  hb.renderOrder = 10;
}
/** hold the tablet: it fits itself behind a screen rectangle (CSS pixels) at 0.5 m from the eye */
export function holdTablet(on) {
  tabletOnTable.visible = !on; held.visible = !!on;
  for (const h of hands) h.visible = false;       // (simple capsule hands read as blobs at the screen edge: the device alone)
}
const _v = new THREE.Vector3();
export function fitHeld(rect) {
  if (!held || !held.visible || !rect) return;
  const d = 0.5, vh = 2 * d * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2), vw = vh * camera.aspect;
  const px = (x) => (x / innerWidth - 0.5) * vw, py = (y) => -(y / innerHeight - 0.5) * vh;
  const pad = 0.012, x0 = px(rect.left) - pad, x1 = px(rect.right) + pad, y0 = py(rect.bottom) - pad, y1 = py(rect.top) + pad;
  const b = held.userData.body; b.scale.set(x1 - x0, y1 - y0, 1); b.position.set((x0 + x1) / 2, (y0 + y1) / 2, -d - 0.008);
  hands[0].position.set(x0 + 0.006, y0 + (y1 - y0) * 0.28, -d + 0.004); hands[1].position.set(x1 - 0.006, y0 + (y1 - y0) * 0.28, -d + 0.004);
}
/** the calendar cards of the pilot route */
export function showCalendars(on) { for (const c of TP.calendars) c.visible = on; }
/** write on the memo pad (the 3D one mirrors the steps taken) */
export function drawMemoPad(lines) {
  const c = TP.memoTex.image, g = c.getContext('2d'), W = c.width, H = c.height;
  g.fillStyle = '#fbf8f0'; g.fillRect(0, 0, W, H); g.strokeStyle = '#d9d0bc'; for (let y = 90; y < H; y += 34) { g.beginPath(); g.moveTo(20, y); g.lineTo(W - 20, y); g.stroke(); }
  g.fillStyle = '#2f4a3f'; g.font = '600 30px "IBM Plex Sans Arabic"'; g.textAlign = 'right'; g.fillText(EN ? 'Decision memo' : 'مذكرة القرار', W - 24, 56);
  g.fillStyle = '#1f2a44'; g.font = '500 22px "Noto Naskh Arabic"';
  lines.slice(0, 11).forEach((t, i) => g.fillText(String(t).slice(0, 34), W - 24, 118 + i * 34));
  TP.memoTex.needsUpdate = true;
}
export const anchorOf = (o, dy = 0.03) => { o.updateMatrixWorld(true); return o.getWorldPosition(_v).clone().add(new THREE.Vector3(0, dy, 0)); };
