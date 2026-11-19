// After the flight: a score out of 100, what you did and when next to what the real crew did and when (NTSB AAR-10/03),
// and the real recording of the radio from 15:25:48 to 15:30:40 played over a replay of the real flight path.
import * as THREE from 'three';
import {camera, onUpdate} from '../core/engine.js';
import {playVoice} from '../core/audio.js';
import * as cine from '../core/cine.js';
import {$, show, fade} from '../ui/ui.js';
import {AC, sampleReal, chaseFrame} from './aircraft.js';
import {CK, seat} from './cockpit.js';
import {fmt} from './flow.js';
import {setDetail} from './gtiles.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export function score(S) {
  const a = S.acts, items = [];
  const timed = (key, label, real, full, half, pts) => { const t = a[key]; const p = t == null ? 0 : t <= full ? pts : t <= half ? Math.round(pts / 2) : Math.round(pts / 4); items.push({label, you: t, real, p, max: pts}); return p; };
  let sc = 0;
  sc += timed('myac', 'Taking control (“my aircraft”)', 12, 15, 30, 10);
  sc += timed('apu', 'Starting the APU (keeps the flight-control protections)', 10, 20, 40, 10);
  sc += timed('qrh', 'Asking the first officer for the QRH', 17, 25, 45, 5);
  { const t = S.maydayT; const p = t == null ? 0 : (t <= 30 ? 10 : t <= 50 ? 6 : 3) - Math.min(3, (S.vague || 0) * 2); items.push({label: 'Mayday call: clear, with your intentions', you: t, real: 22, p: Math.max(0, p), max: 10}); sc += Math.max(0, p); }
  { const ans = S.answers, ok = (k, good) => ans[k] && good.includes(ans[k].k) && ans[k].delay <= 9;
    const p = (ok('rwy13', ['unable']) ? 5 : 0) + ((ok('rwy4', ['teb', 'hudson']) || ok('teb280', ['cant'])) ? 5 : 0);
    items.push({label: 'Answering the controller’s offers quickly and clearly', you: ans.rwy13 ? ans.rwy13.t : null, real: 60, p, max: 10}); sc += p; }
  { const water = S.end === 'ditched' || S.end === 'broken', rw = S.end === 'reached';
    const p = water ? 20 : rw ? 8 : 0, when = S.hudsonT != null ? S.hudsonT : S.intent ? S.intent.t : S.branch ? S.branch.t : null;
    const label = water ? 'Decision: ditch in the Hudson' : rw ? 'Decision: back to an airport (it worked here — the investigation calls it a gamble)' : 'Decision: the airplane reached neither water nor a runway';
    items.push({label, you: when, real: 137, p, max: 20, bad: !water}); sc += p; }
  sc += timed('pa', 'Telling the passengers: “Brace for impact”', 120, 170, 200, 10);
  sc += timed('flaps', 'Flaps down for the ditching', 153, 175, 200, 5);
  const onWater = S.end === 'ditched' || S.end === 'broken';
  if (onWater) { const t = a.ditching; const p = t != null ? 5 : 0; items.push({label: 'DITCHING button (the real crew had no time for it)', you: t, real: null, p, max: 5}); sc += p; }
  { const L = S.landing, water = S.end === 'ditched' || S.end === 'broken';
    const g = !water && S.end !== 'reached' ? null : !L ? 'real' : L.grade;
    const p = {smooth: 10, hard: 6, broken: 2, landed: 8, real: 4}[g] || 0;
    const lbl = {smooth: 'Touchdown on the water: smooth', hard: 'Touchdown on the water: hard (like the real one)', broken: 'Touchdown on the water: violent impact', landed: 'Landing on the runway', real: 'Touchdown on the water: flown by your first officer'}[g] || 'Touchdown on the water';
    items.push({label: lbl + (L && L.sink != null ? ` — ${Math.round(L.sink)} ft/min · bank ${L.bank.toFixed(0)}°` : ''), you: null, real: null, p, max: 10, bad: !g || g === 'broken'}); sc += p; }
  if (onWater) { const t = a.evac; const p = t == null ? 0 : t <= 10 ? 5 : 3;
    items.push({label: 'Evacuation order once the airplane stopped', you: null, youTxt: t == null ? (S.evacWait === false && (S.end === 'ditched' || S.end === 'broken') ? 'the cabin crew started it' : '—') : `after ${Math.round(t)} s`, real: null, realTxt: 'at once', p, max: 5}); sc += p; }
  return {score: Math.min(100, sc), items};
}

export async function debrief(S, {onRetry}) {
  const {score: sc, items} = score(S);
  const title = S.end === 'ditched' ? (sc >= 85 ? 'Ditched — and everyone survived' : 'Ditched — with gaps') : S.end === 'broken' ? 'On the water — but the fuselage broke open' : S.end === 'reached' ? 'Reached the airport — in the simulation only' : 'The airplane did not make it';
  const box = $('debrief');
  box.innerHTML = `<div class="db-card">
    <div class="db-head"><div class="db-score">${sc}</div><div><h2>${title}</h2>
      <div class="lead">From the strike to the water: 208 seconds. The real captain took control after 12 seconds, started the APU after 10, declared the emergency after 22, and said “We’re gonna be in the Hudson” after 137 seconds.</div></div></div>
    <div class="db-grid">
      <div class="db-box"><h3><span>You vs. the real crew</span><span style="font-size:.75rem;color:#8fa3b0">you · real · points</span></h3>
        ${items.map(i => `<div class="db-row"><span class="${i.bad ? 'bad' : ''}">${i.label}</span><span class="you"${i.youTxt ? ' style="font-family:inherit"' : ''}>${i.youTxt || (i.you == null ? '—' : fmt(i.you))}</span><span class="real">${i.realTxt ? `<span>${i.realTxt}</span>` : (i.real == null ? '' : fmt(i.real))} · ${i.p}/${i.max}</span></div>`).join('')}
      </div>
      <div class="db-box db-facts"><h3><span>What the investigation found</span></h3>
        • Both engines ingested large Canada geese (about 4 kg each) at 2,818 ft.<br>
        • In the simulator tests, a return to LaGuardia worked only when the turn began at the moment of the strike. With a 35-second delay — a realistic time to understand what happened — it failed.<br>
        • The investigation found that the decision to ditch in the Hudson gave the highest chance of survival.<br>
        • Everyone survived thanks to the crew’s decisions and teamwork, the cabin crew’s evacuation, and the nearby ferries and rescue teams.<br>
        <small style="color:#8a979e">Source: NTSB report AAR-10/03 · controller audio: the FAA recording released on February 5, 2009.</small>
      </div>
    </div>
    <div class="db-actions"><button class="primary" id="dbreplay">Hear the real recording and see the real track</button><button id="dbretry">Try again</button><button id="dbcredits">Sources and licenses</button></div>
  </div>`;
  show('debrief', true);
  fade(false, 600);                        // every ending fades out; the debrief comes up from black
  $('dbretry').onclick = () => onRetry();
  $('dbreplay').onclick = () => replay();
  $('dbcredits').onclick = () => window.__credits && window.__credits();
}

/** the real flight from 15:25:48 to the ditching, chase camera, with the full FAA recording */
async function replay() {
  show('debrief', false); await fade(true, 400);
  AC.branch = null; seat(false); CK.group.visible = false; if (AC.ext) AC.ext.visible = true;
  setDetail('cinema');
  const meta = await (await fetch('assets/flight/atc/clips.json')).json();
  const t0 = -(meta._replay.strikeAt);           // track time at the start of the recording
  AC.t = t0;
  const v = await playVoice('assets/flight/atc/replay.mp3', null, {volume: 1});
  const start = performance.now();
  const chase = () => { const {fwd, side} = chaseFrame(); return AC.pos.clone().addScaledVector(fwd, -95).add(V(0, 28, 0)).addScaledVector(side, -30); };
  cine.hold(chase, () => AC.pos.clone(), {fov: 42});
  const off = onUpdate(() => {
    const t = t0 + (performance.now() - start) / 1000; sampleReal(Math.min(212, t)); AC.t = t;
    AC.group.position.copy(AC.pos); AC.group.rotation.set(-AC.pitch * Math.PI / 180, Math.PI - AC.hdg * Math.PI / 180, AC.bank * Math.PI / 180, 'YXZ');
    const sub = $('subs'); if (!sub.dataset.replay) { sub.dataset.replay = 1; }
  });
  await fade(false, 700);
  for (const c of meta._transcript || []) setTimeout(() => {
    const el = document.createElement('div'); el.className = 'sub';
    el.innerHTML = `<div class="who ${c.who === 'L116' ? 'atc' : ''}">📻 ${c.who === 'L116' ? 'Departure Control (New York)' : 'Cactus 1549 — the real captain'} · ${'15:' + c.utc.slice(2)} EST</div><div class="en">${c.text}</div>`;
    const box = $('subs'); box.appendChild(el); while (box.children.length > 2) box.firstChild.remove(); setTimeout(() => el.remove(), 6000);
  }, c.at * 1000);
  await v.done; off(); cine.stop();
  await fade(true, 500); show('debrief', true); await fade(false, 400);
}
