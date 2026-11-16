// Speech, orders to the team, on-screen markers that follow 3D points, the side panel, the gauge, captions.
import * as THREE from 'three';
import {camera, onUpdate, wait, Q} from '../core/engine.js';
import {playVoice} from '../core/audio.js';
import {subtitle, hideSubtitle, choose, show, prompt, objective} from '../ui/ui.js';
import {T as TEAM} from './team.js';
import {toScreen} from './tools.js';
import {buildPerformance} from '../actors/performance.js';
import {OR} from './room.js';

// what each speaker looks at while naming it: the anaesthetist reads her values off her monitor, and looks at the
// patient when she speaks to him
const W = (str) => new Set(str.split(' '));
const monitorPos = () => OR.monA ? OR.monA.mesh.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(-2.0, 1.72, 0.5);
const patientFace = () => TEAM.patient && TEAM.patient.headPos ? TEAM.patient.headPos() : new THREE.Vector3(-0.85, 1.1, 0);
const GLANCES = {
  layla: [
    {words: W('الضغط الأكسجين رجفان رجفانا النبض نبض مقطع ST الصدى التنفس نظم مستقيم توقف الكسر القذفي جول'), target: monitorPos, sec: 1.5},
    {words: W('سيد المريض'), target: patientFace, sec: 1.6},
  ],
};

const $ = (id) => document.getElementById(id);
let LINES = {}, SPK = {};
export function initLines(data) { LINES = data.lines; SPK = data.speakers; }
export const lineText = (id) => LINES[id] ? LINES[id].t : id;
export const lineSpeaker = (id) => LINES[id] ? LINES[id].s : null;
const MUTE = Q.has('mute');

// ---------------------------------------------------------------- one voice at a time
let chain = Promise.resolve();
export function say(id, opt = {}) { const run = chain.then(() => sayImpl(id, opt)); chain = run.catch(() => {}); return run; }
async function sayImpl(id, {gesture = false} = {}) {
  const L0 = LINES[id]; if (L0 && L0.s === 'layla') gesture = true;      // the anaesthetist stands free: she talks with her hands
  const L = LINES[id]; if (!L) { console.warn('line?', id); return; }
  const sp = SPK[L.s], url = `assets/vo/or/${id}`;
  if (MUTE) { subtitle(sp.name, sp.role, L.t); await wait(0.35); hideSubtitle(); return; }
  const words = await fetch(url + '.json').then(r => r.ok ? r.json() : []).catch(() => []);
  const ch = TEAM[L.s];
  if (L.s !== 'player' && ch && ch.holder.visible) {
    let timeFn = () => 0;
    const perf = buildPerformance(L.t, words, {speakerId: L.s, emotion: L.e, seated: false, pointTarget: null, glances: GLANCES[L.s]});
    const p = ch.say(url, {gesture, emotion: L.e, perf});
    await new Promise(r => { const t = () => ch.voice ? (timeFn = ch.voice.time, r()) : requestAnimationFrame(t); t(); setTimeout(r, 1500); });
    subtitle(sp.name, sp.role, L.t, words, () => timeFn());
    await p;
  } else {
    const radio = L.s === 'haddad';
    const v = await playVoice(url + '.mp3', null, {radio, volume: L.s === 'player' ? 0.85 : 1});
    subtitle(sp.name + (radio ? ' · الإنتركم' : ''), sp.role, L.t, words, v.time);
    await v.done;
  }
  await wait(0.12); hideSubtitle();
}
/** a choice where every option is one of the player's voiced lines: [{id, key}] */
export async function ask(opts, q = '', {hint = null} = {}) {
  const o = await choose(q, opts.map(x => ({...x, text: x.text || lineText(x.id)})), {hint});
  if (!o.silent) await say(o.id);
  return o.key || o.id;
}

// ---------------------------------------------------------------- orders to the team (right side)
let cmdResolve = null;
/** show order buttons; resolves with the id clicked. list: [{id, text?, want?}] (text defaults to the voiced line) */
export function orders(list, {keep = false} = {}) {
  const el = $('cmds'); el.innerHTML = '';
  return new Promise(res => {
    cmdResolve = res;
    for (const c of list) {
      const b = document.createElement('button'); b.textContent = c.text || lineText(c.line || c.id); b.dataset.id = c.id; if (c.want) b.classList.add('want');
      b.onclick = () => { if (!keep) { el.classList.add('hidden'); el.innerHTML = ''; } const r = cmdResolve; cmdResolve = null; r && r(c.id); };
      el.appendChild(b);
    }
    el.classList.remove('hidden');
  });
}
/** non-blocking order buttons that stay while an action runs: onClick(id) */
export function standingOrders(list, onClick) {
  const el = $('cmds'); el.innerHTML = '';
  const bs = {};
  for (const c of list) {
    const b = document.createElement('button'); b.textContent = c.text || lineText(c.line || c.id); b.dataset.id = c.id; if (c.hidden) b.classList.add('hidden'); if (c.want) b.classList.add('want');
    b.onclick = () => onClick(c.id, b); el.appendChild(b); bs[c.id] = b;
  }
  el.classList.remove('hidden');
  return {b: bs, show: (id, on = true) => bs[id] && bs[id].classList.toggle('hidden', !on), want: (id, on = true) => bs[id] && bs[id].classList.toggle('want', on), clear: () => { el.classList.add('hidden'); el.innerHTML = ''; }};
}
export function ordersHide() { $('cmds').classList.add('hidden'); $('cmds').innerHTML = ''; cmdResolve = null; }

// ---------------------------------------------------------------- markers that follow a 3D point
const marks = new Set();
/** getPos(): world Vector3. html inside. opts: {cls, onClick, offset:[dx,dy]} */
export function mark(getPos, html = '', {cls = '', onClick = null} = {}) {
  const el = document.createElement('div'); el.className = 'mk ' + cls; el.innerHTML = html;
  if (onClick) { el.classList.add('click'); el.onclick = (e) => { e.stopPropagation(); onClick(); }; }
  $('hotspots').appendChild(el);
  const m = {el, getPos, remove() { el.remove(); marks.delete(m); }, set(on) { el.classList.toggle('hidden', !on); }};
  marks.add(m); place(m); return m;
}
function place(m) { const p = m.getPos(); if (!p) return; const s = toScreen(p); m.el.style.left = s.x + 'px'; m.el.style.top = s.y + 'px'; m.sx = s.x; m.sy = s.y; m.el.style.visibility = s.behind ? 'hidden' : ''; }
onUpdate(() => { for (const m of marks) place(m); });
export function clearMarks() { for (const m of [...marks]) m.remove(); }

// ---------------------------------------------------------------- side panel, gauge, captions
export function panel(html, {title = ''} = {}) { const p = $('orpanel'); p.innerHTML = (title ? `<h4>${title}</h4>` : '') + html; p.classList.remove('hidden'); return p; }
export function panelHide() { $('orpanel').classList.add('hidden'); }
export function gauge(label, {band = null} = {}) {
  let g = $('gauge'); if (!g) { g = document.createElement('div'); g.id = 'gauge'; document.body.appendChild(g); }
  g.innerHTML = `<span>${label}</span><div class="bar">${band ? `<s style="left:${band[0] * 100}%;width:${(band[1] - band[0]) * 100}%"></s>` : ''}<i></i></div><b></b>`;
  g.classList.remove('hidden');
  const i = g.querySelector('i'), b = g.querySelector('b');
  return {set(v, hot = false, txt = '') { i.style.width = Math.max(0, Math.min(1, v)) * 100 + '%'; i.classList.toggle('hot', hot); b.textContent = txt; }, hide() { g.classList.add('hidden'); }};
}
/** time-skip caption over a black fade */
export async function caption(text, ms = 2600) {
  let c = $('orcap'); if (!c) { c = document.createElement('div'); c.id = 'orcap'; document.body.appendChild(c); }
  c.innerHTML = text; c.classList.add('on'); await wait(ms / 1000); c.classList.remove('on'); await wait(0.5);
}
export function hint(text) { prompt(text); }
export {objective, show, prompt};
