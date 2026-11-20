// The replay inside the model: Tuesday at the Al-Midan store as Noor observed it — the 8:10 peak or the 3:30 quiet
// afternoon. Orders reach the register faster than drinks leave the bar: tickets pile on the rail and people wait at
// the pickup shelf. Each period is a loop (cashier → rail → barista → shelf → out of the door, new people in),
// restarted when the period changes. `still` (reduced motion / low power) shows the same moment without movement.
import {characters as C} from '../actors/character.js';
import {onUpdate} from '../core/engine.js';
import {MQ, SPOTS, faceAlongQueue, setTickets, setShelfCups, shelfCupCount, setModelClock, cupForHand} from '../world/maquette.js';
import {setModelTime} from '../world/lighting.js';
import {stand, sitMini, sleep, idleOf, watchGlance} from './cast.js';
import {printer, doorBell, cups as cupSnd, setCrowd, steam} from './sound.js';

export const RP = {period: null, still: false, queue: [], waiting: [], pool: [], gen: 0};
const PERIOD = {
  peak: {clock: 8 * 60 + 10, light: 'morning', crowd: 1, tickets: 9, cups: 2, make: 9.5, order: 10.5,
    queue: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'], waiting: ['salma', 'w1', 'w2'], seated: [['s1', 0], ['s2', 1]]},
  off: {clock: 15 * 60 + 30, light: 'afternoon', crowd: 0.3, tickets: 1, cups: 0, make: 15, order: 32,
    queue: ['q3'], waiting: ['salma'], seated: [['s1', 0], ['s2', 1], ['q2', 2]]},
};
// chairs in the model a person can sit on: [x, z, facing]
const CHAIRS = [[-2.45, 1.05, -Math.PI / 2], [-1.85, 2.95, Math.PI / 2], [0.15, 2.4, Math.PI / 2], [-0.9, 0.4, 0]];
// how people leave without walking through the line: along the counter, between the tables, out of the door
const EXIT = [[-1.5, -0.12], [1.3, -0.05], [3.1, 0.8], [3.42, 2.6], [3.98, 3.45], [4.05, 4.45], [5.55, 5.05]];
const ARRIVE = [[5.55, 4.95], [4.45, 4.45], [4.4, 3.45]];

// ---------------------------------------------------------------- the door swings when someone passes
let doorT = 0, doorOpen = 0;
onUpdate((dt) => { if (!MQ.door) return; doorT = Math.max(0, doorT - dt); doorOpen += ((doorT > 0 ? 1 : 0) - doorOpen) * (1 - Math.exp(-5 * dt)); MQ.door.rotation.y = doorOpen * 1.2; });
function door(sec = 2.4) { if (doorT <= 0 && !RP.quiet) doorBell(); doorT = sec; }
// open the door for anyone near it
onUpdate(() => { for (const c of Object.values(C)) if (c.mini && c.holder.visible && c.walking) { const p = c.holder.position; if (Math.abs(p.x - 4.2) < 0.9 && Math.abs(p.z - 3.85) < 0.9) door(1.2); } });

const walk = (ch, pts, speed = 1.12) => { ch.seated = false; return ch.walkTo(pts, {speed, nav: false}); };
const alive = (g) => g === RP.gen;
function holdCup(ch, on = true) {
  if (ch._cup) { ch._cup.removeFromParent(); ch._cup = null; }
  if (!on) return;
  const hand = ch.mesh.skeleton.getBoneByName('Bip01_R_Hand'); if (!hand) return;
  const g = cupForHand(); hand.add(g); ch._cup = g;
}
function hideAll() {
  for (const c of Object.values(C)) if (c.mini) { c.walking = null; c.hide(); holdCup(c, false); c.lockLook = false; }
}

/** show a period. still: one frozen moment (reduced motion / low power) */
export function setPeriod(key, {still = false} = {}) {
  const P = PERIOD[key]; if (!P) return;
  const g = ++RP.gen; RP.period = key; RP.still = still;
  hideAll();
  setModelClock(P.clock); setModelTime(P.light); setCrowd(P.crowd);
  setTickets(P.tickets); setShelfCups(P.cups);
  // staff
  stand(C.cashier, ...SPOTS.cashier, 0, key === 'peak' ? 'm_work_table' : 'm_idle_neutral_02');
  stand(C.barista, ...SPOTS.barMachine, Math.PI, 'f_work_table');
  // the line, the people waiting for drinks, the seated
  RP.queue = P.queue.slice(); RP.waiting = P.waiting.slice();
  RP.queue.forEach((id, i) => stand(C[id], ...SPOTS.queue[i], faceAlongQueue(i)));
  RP.waiting.forEach((id, i) => stand(C[id], ...SPOTS.pickup[i], Math.PI + (i - 1) * 0.25));
  for (const [id, k] of P.seated) { const [x, z, ry] = CHAIRS[k]; sitMini(C[id], x, z, ry); }
  // who is free to come in later (peak): everyone not placed
  const placed = new Set([...RP.queue, ...RP.waiting, ...P.seated.map(s => s[0]), 'ben', 'cashier', 'barista']);
  RP.pool = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'w1', 'w2'].filter(id => !placed.has(id));
  if (still) return;
  baristaLoop(g, P); registerLoop(g, P); pickupLoop(g);
}
export function stopReplay() { RP.gen++; }

// ---------------------------------------------------------------- the bar: make a drink, put it on the shelf
async function baristaLoop(g, P) {
  const b = C.barista;
  for (;;) {
    await sleep(P.make * (0.85 + Math.random() * 0.3)); if (!alive(g)) return;
    if (Math.random() < 0.5) steam();
    b.setBase('f_idle_neutral_02', {fade: 0.3});
    await walk(b, [SPOTS.barHand], 1.15); if (!alive(g)) return;
    b._turnTo = 0; await sleep(0.9); if (!alive(g)) return;
    setShelfCups(Math.min(6, shelfCupCount() + 1)); cupSnd();
    setTickets(Math.max(0, (MQ.ticketCount || 0) - 1));
    await walk(b, [SPOTS.barMachine], 1.15); if (!alive(g)) return;
    b._turnTo = Math.PI; b.setBase('f_work_table', {fade: 0.4});
  }
}
// ---------------------------------------------------------------- the register: take an order, the line moves up
async function registerLoop(g, P) {
  for (;;) {
    await sleep(P.order * (0.85 + Math.random() * 0.3)); if (!alive(g)) return;
    const id = RP.queue[0]; if (!id) { await arrive(g); continue; }
    printer(); setTickets(Math.min(12, (MQ.ticketCount || 0) + 1));
    RP.queue.shift();
    // to the pickup area (the nearest free spot)
    const spot = SPOTS.pickup[Math.min(RP.waiting.length, SPOTS.pickup.length - 1)];
    RP.waiting.push(id);
    const ch = C[id]; walk(ch, [[1.2, -0.62], spot]).then(() => { if (alive(g)) { ch._turnTo = Math.PI; ch.setBase(idleOf(ch), {fade: 0.4}); } });
    // the line steps forward one place
    RP.queue.forEach((qid, i) => { const q = C[qid]; walk(q, [SPOTS.queue[i]], 0.9).then(() => { if (alive(g)) q._turnTo = faceAlongQueue(i); }); });
    if (RP.period === 'peak' && RP.queue.length < 6) setTimeout(() => arrive(g), 2500 + Math.random() * 3000);
  }
}
async function arrive(g) {
  if (!alive(g) || !RP.pool.length) return;
  const id = RP.pool.shift(), ch = C[id], i = RP.queue.length;
  RP.queue.push(id);
  ch.place(...ARRIVE[0], -Math.PI / 2); ch.setBase(idleOf(ch));
  await walk(ch, [...ARRIVE.slice(1), SPOTS.queue[Math.min(i, SPOTS.queue.length - 1)]]);
  if (alive(g)) { ch._turnTo = faceAlongQueue(Math.min(i, SPOTS.queue.length - 1)); ch.setBase(idleOf(ch), {fade: 0.4}); }
}
// ---------------------------------------------------------------- the shelf: the first in the crowd takes a drink and goes
async function pickupLoop(g) {
  for (;;) {
    await sleep(1.0); if (!alive(g)) return;
    if (!shelfCupCount() || !RP.waiting.length) continue;
    const id = RP.waiting.shift(), ch = C[id];
    if (ch.walking) { RP.waiting.unshift(id); continue; }
    await walk(ch, [[-3.3 + Math.random() * 0.3, -0.98]], 0.9); if (!alive(g)) return;
    ch._turnTo = Math.PI; await sleep(0.7); if (!alive(g)) return;
    setShelfCups(Math.max(0, shelfCupCount() - 1)); holdCup(ch, true); cupSnd();
    // the others in the crowd close up
    RP.waiting.forEach((wid, i) => { const w = C[wid]; if (!w.walking) walk(w, [SPOTS.pickup[Math.min(i, SPOTS.pickup.length - 1)]], 0.8).then(() => { if (alive(g)) w._turnTo = Math.PI; }); });
    leave(ch, g);
  }
}
async function leave(ch, g) {
  await walk(ch, EXIT);
  if (!alive(g)) return;
  ch.hide(); holdCup(ch, false);
  if (ch.id !== 'salma' && ch.id !== 'ben') RP.pool.push(ch.id);
}

// ---------------------------------------------------------------- Ben: in through the door, into the line, a look at
// his watch, another, and out — before he has ordered
export async function benMoment() {
  const g = RP.gen, b = C.ben, i = RP.queue.length;
  const slot = SPOTS.queue[Math.min(i, SPOTS.queue.length - 1)];
  b.place(...ARRIVE[0], -Math.PI / 2); b.setBase('m_idle_neutral_01');
  await walk(b, [...ARRIVE.slice(1), slot]);
  b._turnTo = faceAlongQueue(Math.min(i, SPOTS.queue.length - 1)); b.setBase('m_idle_neutral_01', {fade: 0.4});
  await sleep(2.6); await watchGlance(b, 1.7);
  await sleep(1.8); b.lookAt(null);
  await watchGlance(b, 1.4); await sleep(0.6);
  // quietly out — he never reached the register
  await walk(b, [[3.98, 3.45], [4.05, 4.45], [-1.5, 4.7], [-5.4, 4.8]], 1.3);
  b.hide();
  return g === RP.gen;
}
/** a static summary of what the model shows (captions carry the same) */
export function periodState(key, EN) {
  return key === 'peak'
    ? (EN ? ['8:10 am · peak', '7 people in line', '9 tickets on the rail', '3 waiting at pickup', 'Median wait: 7 min (simulated)'] : ['8:10 صباحًا · الذروة', '7 في الطابور', '9 تذاكر على السكة', '3 ينتظرون عند الاستلام', 'متوسط الانتظار: 7 دقائق (محاكاة)'])
    : (EN ? ['3:30 pm · off-peak', '1 person in line', '1 ticket on the rail', '1 waiting at pickup', 'Median wait: 2 min (simulated)'] : ['3:30 عصرًا · الهدوء', 'شخص واحد في الطابور', 'تذكرة واحدة على السكة', 'واحد ينتظر عند الاستلام', 'متوسط الانتظار: دقيقتان (محاكاة)']);
}
