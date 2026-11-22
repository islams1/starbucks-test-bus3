// Touch controls (phones / tablets): left thumb = movement stick, right thumb = drag to look, buttons for run,
// interact (E), map (M) and pause. Hotspots, documents and choices are tapped directly.
import {input, mouse, keys} from '../core/input.js';
import {TOUCH} from '../core/quality.js';

export const touch = {on: TOUCH, x: 0, y: 0, run: false};

function key(code) {   // replay a keyboard shortcut for the game's existing handlers
  dispatchEvent(new KeyboardEvent('keydown', {code, key: code}));
  setTimeout(() => dispatchEvent(new KeyboardEvent('keyup', {code, key: code})), 60);
}

const EN = new URLSearchParams(location.search).get('lang') === 'en';
export function initTouch() {
  if (!TOUCH) return;
  document.body.classList.add('touch');
  const hk = document.querySelector('.howto-card .keys');
  if (hk) hk.insertAdjacentHTML('afterend', EN ? '<div class="touchhelp"><b>On a touch screen:</b> the stick on the left to move · drag a finger on the right to look · 🏃 to run · <b>E</b> to interact (or tap the icon)</div>' : '<div class="touchhelp"><b>على شاشة اللمس:</b> العصا يسارًا للحركة · اسحب بإصبعك يمينًا للنظر · 🏃 للجري · <b>E</b> للتفاعل (أو المس الأيقونة نفسها) · 🗺 الخريطة · ☰ المهام · ⏸ إيقاف مؤقت</div>');
  const ui = document.createElement('div'); ui.id = 'touchui'; ui.className = 'hidden';
  ui.innerHTML = `<div id="tstick"><div class="knob"></div></div>
    <div id="tlook"></div>
    <div class="tbtns"><button data-a="run" class="tb">🏃<small>${EN ? 'Run' : 'جري'}</small></button><button data-a="KeyE" class="tb big">E<small>${EN ? 'Interact' : 'تفاعل'}</small></button></div>
    <div class="ttop"><button data-a="KeyM" class="tb sm">🗺</button><button data-a="Tab" class="tb sm">☰</button><button data-a="Escape" class="tb sm">⏸</button></div>`;
  document.body.appendChild(ui);
  const stick = ui.querySelector('#tstick'), knob = stick.querySelector('.knob'), look = ui.querySelector('#tlook');
  let sid = null, sx = 0, sy = 0;
  const R = 52;
  stick.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; sid = t.identifier; const r = stick.getBoundingClientRect(); sx = r.left + r.width / 2; sy = r.top + r.height / 2; move(t); e.preventDefault(); }, {passive: false});
  const move = (t) => { let dx = t.clientX - sx, dy = t.clientY - sy; const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; } knob.style.transform = `translate(${dx}px,${dy}px)`; touch.x = dx / R; touch.y = dy / R; };
  stick.addEventListener('touchmove', (e) => { for (const t of e.changedTouches) if (t.identifier === sid) move(t); e.preventDefault(); }, {passive: false});
  const end = (e) => { for (const t of e.changedTouches) if (t.identifier === sid) { sid = null; touch.x = touch.y = 0; knob.style.transform = ''; } };
  stick.addEventListener('touchend', end); stick.addEventListener('touchcancel', end);
  // look: drag anywhere on the right part of the screen
  let lid = null, lx = 0, ly = 0;
  look.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; lid = t.identifier; lx = t.clientX; ly = t.clientY; e.preventDefault(); }, {passive: false});
  look.addEventListener('touchmove', (e) => { for (const t of e.changedTouches) if (t.identifier === lid) { mouse.dx += (t.clientX - lx) * 2.2; mouse.dy += (t.clientY - ly) * 2.2; lx = t.clientX; ly = t.clientY; } e.preventDefault(); }, {passive: false});
  look.addEventListener('touchend', (e) => { for (const t of e.changedTouches) if (t.identifier === lid) lid = null; });
  ui.querySelectorAll('[data-a]').forEach(b => b.addEventListener('touchstart', (e) => {
    e.preventDefault(); e.stopPropagation();
    const a = b.dataset.a;
    if (a === 'run') { touch.run = !touch.run; b.classList.toggle('on', touch.run); return; }
    key(a);
  }, {passive: false}));
  // show the controls only while the player walks around
  setInterval(() => {
    const hud = document.getElementById('hud');
    const on = input.enabled && hud && !hud.classList.contains('hidden') && document.getElementById('doc').classList.contains('hidden');
    ui.classList.toggle('hidden', !on);
    ui.classList.toggle('nolook', !input.look);
  }, 200);
  // phones: ask for landscape, go full screen on the first tap
  const rot = document.createElement('div'); rot.id = 'rotate'; rot.innerHTML = `<div>📱↻</div><p>${EN ? 'Turn the device sideways for a better view' : 'أدر الجهاز بالعرض لتجربة أفضل'}</p>`; document.body.appendChild(rot);
  const fs = () => { const d = document.documentElement; if (!document.fullscreenElement && d.requestFullscreen && innerWidth < 1100) d.requestFullscreen().catch(() => {}); try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} };
  document.addEventListener('click', fs, {once: true});
  keys;   // (keyboard state untouched: touch input is read by the player directly)
}
