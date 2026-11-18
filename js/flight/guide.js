// The keys on the left of the screen: W A S D fly the airplane (push / pull, roll left / right), T talks on the radio,
// P to the passengers, F sets the flaps. The key you should press now is lit green; the others stay dark; a key you are
// pressing turns yellow. Which flight keys are green comes from a simple flight director: roll toward the river ahead
// (or the runway you chose) and keep the best gliding speed, then hold the wings level and the sink small near the water.
import {onUpdate} from '../core/engine.js';
import {AC, sampleReal, AIRPORTS} from './aircraft.js';
import {FLY} from './fly.js';

const KEYS = [
  ['W', 'المقدمة لتحت', 'تزيد السرعة'], ['A', 'ميل يسار', ''], ['S', 'المقدمة لفوق', 'تقل السرعة'], ['D', 'ميل يمين', ''],
  ['T', 'الراديو', ''], ['P', 'الركاب', ''], ['F', 'القلابات', ''],
];
const CODE = {KeyW: 'W', ArrowUp: 'W', KeyS: 'S', ArrowDown: 'S', KeyA: 'A', ArrowLeft: 'A', KeyD: 'D', ArrowRight: 'D', KeyT: 'T', KeyP: 'P', KeyF: 'F'};
const held = new Set(), flash = {};
let el = null, S = null;

function build() {
  el = document.createElement('div'); el.id = 'keys'; el.className = 'hidden';
  const k = (c) => { const [key, a, b] = KEYS.find(x => x[0] === c); return `<div class="key" data-k="${key}"><b>${key}</b><small>${a}${b ? `<br><i>${b}</i>` : ''}</small></div>`; };
  el.innerHTML = `<div class="kt">التحكم بالطيارة</div>
    <div class="krow">${k('W')}</div><div class="krow">${k('A')}${k('S')}${k('D')}</div>
    <div class="kt kt2">أوامر</div><div class="krow">${k('T')}${k('P')}${k('F')}</div>`;
  document.body.appendChild(el);
  addEventListener('keydown', (e) => { const c = CODE[e.code]; if (!c) return; held.add(c); if ('TPF'.includes(c)) flash[c] = performance.now() + 700; });
  addEventListener('keyup', (e) => { const c = CODE[e.code]; if (c) held.delete(c); });
  addEventListener('blur', () => held.clear());
}
/** the flight director: which of W A S D should be pressed right now */
function flightKeys() {
  const out = new Set();
  if (AC.t <= 0 || !S || S.end) return out;
  if (!FLY.on) { 'WASD'.split('').forEach(c => out.add(c)); return out; }          // take the controls: any key
  const tg = S.intent && AIRPORTS[S.intent.key] ? AIRPORTS[S.intent.key].p : sampleReal(Math.min(214, AC.t + 9), {pos: AC.pos.clone()}).pos;
  const brg = (Math.atan2(tg.x - AC.pos.x, -(tg.z - AC.pos.z)) * 180 / Math.PI + 360) % 360;
  const err = ((brg - AC.hdg + 540) % 360) - 180;
  const low = AC.agl < 30;
  const bankCmd = low ? 0 : Math.max(-30, Math.min(30, err * 1.4)), db = bankCmd - AC.bank;
  if (db > (low ? 3 : 6)) out.add('D'); else if (db < -(low ? 3 : 6)) out.add('A');
  const spd = AC.agl > 300 ? 205 : AC.agl > 80 ? 180 : 150;
  const y = low ? (-AC.vs - 1.6) * 0.35 : (AC.ias - spd) * 0.03 - (FLY.gam * 57.3 + 4) * 0.02;
  if (y > 0.18) out.add('S'); else if (y < -0.18) out.add('W');
  return out;
}
let acc = 0;
export function startGuide(state, {want}) {
  S = state; if (!el) build();
  el.classList.remove('hidden');
  onUpdate((dt) => {
    if ((acc += dt) < 0.1) return; acc = 0;
    const cine = document.getElementById('hud')?.classList.contains('cine');
    el.classList.toggle('hidden', !!cine || !!(S.end && !S.afloat));
    const go = flightKeys(); for (const c of want()) go.add(c);
    const now = performance.now();
    for (const d of el.querySelectorAll('.key')) {
      const c = d.dataset.k, on = held.has(c) || (flash[c] || 0) > now;
      d.classList.toggle('on', on); d.classList.toggle('go', !on && go.has(c));
    }
  });
}
