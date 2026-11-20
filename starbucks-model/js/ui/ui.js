// HUD, subtitles, choices, toasts, objective, calendar.
import {sfx} from '../core/audio.js';
import {onKey} from '../core/input.js';

const $ = (id) => document.getElementById(id);
export {$};
export const show = (id, on = true) => $(id).classList.toggle('hidden', !on);

// ---------- subtitles (word-by-word highlight following the voice timing) ----------
let subTimer = 0;
export function subtitle(who, role, text, words = null, timeFn = null) {
  const el = $('subtext');
  $('subwho').textContent = who; $('subrole').textContent = role || '';
  cancelAnimationFrame(subTimer);
  if (words && words.length && timeFn) {
    // map voice word boundaries onto text tokens (same order)
    const toks = text.split(/(\s+)/);
    el.innerHTML = '';
    const spans = [];
    for (const t of toks) { if (/^\s+$/.test(t)) { el.appendChild(document.createTextNode(t)); continue; } const s = document.createElement('span'); s.className = 'w'; s.textContent = t; el.appendChild(s); spans.push(s); }
    const ratio = spans.length / words.length;
    const tick = () => {
      const tt = timeFn();
      let n = 0; for (const w of words) if (tt >= w[0] / 1000 - 0.05) n++;
      const lit = Math.min(spans.length, Math.round(n * ratio));
      spans.forEach((s, i) => s.classList.toggle('on', i < lit));
      subTimer = requestAnimationFrame(tick);
    };
    tick();
  } else el.textContent = text;
  show('subs', true);
}
export function hideSubtitle() { cancelAnimationFrame(subTimer); show('subs', false); }

// ---------- choices ----------
let choiceResolve = null;
/**
 * options: [{id, text, tagline?, need?: string (disabled reason), disabled?: bool}]
 * returns chosen option
 */
export function choose(question, options, {hint = null} = {}) {
  const list = $('choicelist'); list.innerHTML = '';
  $('choiceq').innerHTML = (hint ? `<div class="hint">${hint}</div>` : '') + (question || '');
  return new Promise(res => {
    choiceResolve = (o) => { show('choices', false); choiceResolve = null; sfx.ui(); res(o); };
    options.forEach((o, i) => {
      const b = document.createElement('button'); b.className = 'choice';
      b.innerHTML = `<kbd>${i + 1}</kbd><span>${o.text}${o.tagline ? `<span class="tagline">${o.tagline}</span>` : ''}${o.need ? `<span class="need">${o.need}</span>` : ''}</span>`;
      b.disabled = !!o.disabled;
      b.onclick = () => choiceResolve && choiceResolve(o);
      b.dataset.idx = i; if (o.key) b.dataset.key = o.key; list.appendChild(b);
    });
    show('choices', true);
  });
}
for (let i = 1; i <= 5; i++) onKey('Digit' + i, () => {
  if (!choiceResolve) return;
  const b = $('choicelist').children[i - 1];
  if (b && !b.disabled) b.click();
});
export const choosing = () => !!choiceResolve;

// ---------- toasts / prompt / objective ----------
export function toast(html, cls = '') {
  const t = document.createElement('div'); t.className = 'toast ' + cls; t.innerHTML = html; $('toasts').appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity .6s'; t.style.opacity = 0; setTimeout(() => t.remove(), 700); }, 4200);
}
export function prompt(text) { const p = $('prompt'); if (text) { p.innerHTML = text; p.classList.add('on'); } else p.classList.remove('on'); }
export function objective(text) {
  const o = $('objtext');
  if (o.textContent === text) return;
  o.textContent = text;
  $('objective').animate([{transform: 'translateY(-6px)', opacity: 0.3}, {transform: 'none', opacity: 1}], {duration: 400});
}

// ---------- calendar strip ----------
const DAY_START = 8 * 60 + 45, DAY_END = 14 * 60;
export function setClock(min, day = 'الاثنين') {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  $('calendar').querySelector('.time').textContent = `${h}:${String(m).padStart(2, '0')}`;
  $('calendar').querySelector('.day').textContent = day;
  let bar = $('calstrip').querySelector('i'); if (!bar) { bar = document.createElement('i'); $('calstrip').appendChild(bar); }
  bar.style.width = Math.max(0, Math.min(100, (min - DAY_START) / (DAY_END - DAY_START) * 100)) + '%';
}

// ---------- fades / letterbox ----------
export function fade(on, ms = 800) { const f = $('fade'); f.style.transitionDuration = ms + 'ms'; f.classList.toggle('on', on); return new Promise(r => setTimeout(r, ms)); }
export function letterbox(on) { $('letterbox').classList.toggle('on', on); }
export function hud(on) { show('hud', on); }
