// Keyboard / mouse state with pointer lock.
const canvas = document.getElementById('gl');
export const keys = new Set();
export const mouse = {dx: 0, dy: 0, locked: false};
export const input = {enabled: false, look: true};
const handlers = new Map();
export const onKey = (code, fn) => handlers.set(code, fn);

addEventListener('keydown', e => {
  if (e.code === 'Tab') e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  const h = handlers.get(e.code); if (h) h(e);
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
addEventListener('mousemove', e => { if (mouse.locked) { mouse.dx += e.movementX; mouse.dy += e.movementY; } });
document.addEventListener('pointerlockchange', () => {
  mouse.locked = document.pointerLockElement === canvas;
  document.getElementById('clicktolock').classList.toggle('hidden', mouse.locked || !input.enabled || !input.look);
});
canvas.addEventListener('click', () => { if (input.enabled && input.look && !mouse.locked) lock(); });
export function lock() { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
export function unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
export function consumeMouse() { const d = {x: mouse.dx, y: mouse.dy}; mouse.dx = mouse.dy = 0; return d; }
export function setInput(on, look = true) {
  input.enabled = on; input.look = look;
  if (!on) { keys.clear(); }
  if (!on || !look) unlock();
  document.getElementById('clicktolock').classList.toggle('hidden', !on || !look || mouse.locked);
}
