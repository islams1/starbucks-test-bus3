// The table by hand (Concept A §4–5). Funding: press on a block in the rack and drag — over a base the stack in the
// hand becomes that base's cost (blocks taken from the rack); missing units show as translucent red blocks with the
// hint "Needs X more units". Released on a base that fits: the blocks seat one by one ("clack"), the palm presses
// them down, the rack strip, the ledger plate and the top bar update, the item's token card appears in front of its
// base. Released on a base that does not fit: the base flashes red and the blocks bounce back to their pockets.
// Click alternative: click the base. Return: drag a funded base's blocks off it, or click the funded base.
// Order: drag (or click) the token cards into the First / Next tray. The waiting need: put a chip on its own
// proposal's base (or click it). The note: click to read; a stamp: click or drag it onto the note.
// Review table: take a condition card and clip it beside "First"; press the commit stamp on the board.
import * as THREE from 'three';
import {scene} from '../core/engine.js';
import {grabbable, tweenTo, setWorld, toScreen} from '../ui/hand.js';
import {reach, press, rest, carry, pinch, HAND} from '../ui/playerhand.js';
import {VIEW, reducedMotion} from '../ui/view.js';
import {TB, makeBlock, socketWorld, pocketWorld, baseTop, tokenHome, slotWorld, chipHome, chipOnBase, setChipDim, drawStrip, drawLedger, drawLabel,
  flashBase, setPennant, drawNote, NOTE_HOME, drawBoard, cardSlot, clippedPose, setClip, BLOCK, setCardOpen} from '../world/props.js';
import {WT} from '../world/workshop.js';
import {P, ROW, IDS, CAP, EN, tr, nm, T, check, refusalText, used, free, cleanup} from './alloc.js';
import {S, save, log} from './state.js';
import {S as SND} from './sound.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const wait = (s) => new Promise(r => setTimeout(r, s * 1000 * (reducedMotion() ? 0.2 : 1)));
export const TBL = {allow: {open: false, note: false, stamp: false, fund: false, order: false, need: false, cond: false, commit: false}, busy: false,
  on: {}, refusal: null};
const emit = (k, ...a) => TBL.on[k] && TBL.on[k](...a);
export const say = (t) => emit('announce', t);

// ---------------------------------------------------------------- which pocket gave its unit to which proposal
const OWN = Array(CAP).fill(null);
const order = () => { const a = [...Array(CAP).keys()]; return EN ? a : a.reverse(); };   // units are taken from where reading starts
const freePockets = () => order().filter(i => OWN[i] == null);
/** the free pockets nearest to pocket i (the stack is taken from around the grabbed block) */
const near = (i) => freePockets().filter(k => k !== i).sort((a, b) => Math.abs(a - i) - Math.abs(b - i) || (EN ? a - b : b - a));
const pocketsOf = (id) => OWN.map((o, i) => o === id ? i : -1).filter(i => i >= 0);
/** put the 3D table in line with the saved allocation (no animation) */
export function syncTable() {
  OWN.fill(null);
  for (const id of S.a.funded) for (const i of freePockets().slice(0, P[id].cost)) OWN[i] = id;
  TB.blocks.forEach((b, i) => {
    const o = OWN[i];
    if (!o) { TB.rack.g.attach(b); b.position.copy(TB.rack.pockets[i]); b.quaternion.identity(); }
    else { const k = pocketsOf(o).indexOf(i), base = TB.bases[o]; base.g.attach(b); b.position.copy(base.sockets[k]); b.quaternion.identity(); }
    b.visible = true;
  });
  refresh();
}
/** labels, strip, ledger plate, tokens, chips, pennants, note, board */
export function refresh({refusal = TBL.refusal} = {}) {
  drawStrip(OWN);
  drawLedger({funded: S.a.funded, refusal});
  for (const id of IDS) {
    const f = S.a.funded.includes(id);
    const st = TBL.refusalFor === id && refusal ? {k: 'refused', need: TBL.refusalNeed} : f ? {k: S.confirmed ? 'funded' : 'funded'} : S.confirmed ? {k: 'waits'} : S.opened[id] ? {k: 'open'} : {k: 'closed'};
    drawLabel(id, st);
    setCardOpen(id, S.opened[id] ? 1 : 0);
    setChipDim(id, f);
    setPennant(id, S.confirmed ? (f ? 'funded' : 'waits') : null);
    const tk = TB.bases[id].token;
    if (!tk.userData.moving) {
      tk.visible = f;
      const slot = S.a.first === id && S.a.funded.length > 1 ? 'first' : S.a.next === id ? 'next' : null;
      setWorld(tk, slot ? slotWorld(slot) : tokenHome(id));
    }
    const ch = TB.chips[id];
    if (!ch.userData.moving) setWorld(ch, S.a.need === id ? chipOnBase(id) : chipHome(id));
  }
  drawNote(S.tag);
  emit('changed');
}

// ---------------------------------------------------------------- the stack in the hand
const CG = new THREE.Group(); CG.name = 'carried'; scene.add(CG); CG.visible = false;
function stack(n, avail) {
  CG.clear();
  const cols = Math.min(n, 3), cw = BLOCK.w + 0.006;
  for (let k = 0; k < n; k++) {
    const b = makeBlock(k, k >= avail), col = k % 3, row = Math.floor(k / 3);
    b.position.set((col - (cols - 1) / 2) * cw, row * (BLOCK.h + 0.002) + BLOCK.h / 2, 0); CG.add(b);
  }
}
const stackWorld = () => CG.children.map(c => c.getWorldPosition(new THREE.Vector3()));
const hidden = new Set();
function hideBlocks(idxs) { for (const i of hidden) TB.blocks[i].visible = true; hidden.clear(); for (const i of idxs) { TB.blocks[i].visible = false; hidden.add(i); } }

// ---------------------------------------------------------------- fund / refuse / return
/** fund `id` with blocks now at `from` (world positions in the carried stack, or null: from the rack) */
const seat = (id, from = null) => seatPockets(id, freePockets(), from);
async function refuse(id, c, from, ps = null) {
  flashBase(id); SND.refuse();
  TBL.refusal = refusalText(c); TBL.refusalFor = id; TBL.refusalNeed = c.need;
  refresh();
  say(tr(`لا يتّسع «${nm(id)}»: `, `“${nm(id)}” does not fit: `) + TBL.refusal);
  // the blocks bounce off and slide back into their pockets
  const avail = (ps || freePockets()).filter(i => OWN[i] == null);
  CG.visible = false; hideBlocks([]);
  if (from) await Promise.all(avail.slice(0, from.length).map(async (i, k) => {
    const b = TB.blocks[i]; if (!from[k]) return; scene.attach(b); setWorld(b, from[k]);
    await tweenTo(b, from[k].clone().add(V(0, 0.06, 0.04)), 0.12);
    TB.rack.g.attach(b); await tweenTo(b, pocketWorld(i), reducedMotion() ? 0.01 : 0.32, {arc: 0.05});
  }));
  SND.bounce(); rest();
  log('refuse', id, c.need);
  emit('refused', id, c);
  setTimeout(() => { if (TBL.refusalFor === id) { TBL.refusal = null; TBL.refusalFor = null; refresh(); } }, 6000);
}
/** return a funded proposal's units to the rack (from: world positions of the carried blocks, or null) */
async function unseat(id, from = null) {
  const ps = pocketsOf(id); if (!ps.length) return;
  S.a.funded = S.a.funded.filter(f => f !== id); ps.forEach(i => OWN[i] = null);
  const notes = cleanup(S.a);
  CG.visible = false; hideBlocks([]);
  await Promise.all(ps.map(async (i, k) => {
    const b = TB.blocks[i];
    if (from && from[k]) { scene.attach(b); setWorld(b, from[k]); }
    b.visible = true;
    await wait(k * 0.07);
    TB.rack.g.attach(b);
    await tweenTo(b, pocketWorld(i), reducedMotion() ? 0.01 : 0.36, {arc: 0.08});
    SND.pick();
  }));
  rest();
  TBL.refusal = null; TBL.refusalFor = null;
  log('return', id); save(); refresh();
  say(tr(`أُعيد «${nm(id)}» إلى الرف: ${P[id].cost} وحدات حرّة. مستخدم ${used(S.a.funded)} من 8.`, `Returned “${nm(id)}” to the rack: ${P[id].cost} units free. Used ${used(S.a.funded)} of 8.`));
  notes.forEach(say);
  emit('returned', id, notes);
}
const guard = async (fn) => { if (TBL.busy) return; TBL.busy = true; try { if (TBL.on.ensureAtTable && VIEW.mode === 'stand') await TBL.on.ensureAtTable(); await fn(); } catch (e) { console.error(e); } finally { TBL.busy = false; rest(); emit('changed'); } };
/** click alternative: the hand takes the right number from the rack and presses them in (or is refused) */
export const fund = (id) => guard(async () => {
  if (S.a.funded.includes(id)) return;
  const n = P[id].cost, fp = freePockets(), avail = Math.min(n, fp.length);
  await reach(pocketWorld(fp[0] ?? 0), {dur: 0.35, lift: 0.04, curl: 0.4}); pinch(true); SND.pick();
  stack(n, avail); CG.visible = true; setWorld(CG, pocketWorld(fp[0] ?? 0).add(V(0, 0.03, 0))); hideBlocks(fp.slice(0, avail));
  carry(CG); VIEW.leanWant = Math.abs(TB.bases[id].g.position.x - WT.x) > 0.6 ? 1 : 0.4;
  await tweenTo(CG, baseTop(id).add(V(0, 0.02, 0.06)), reducedMotion() ? 0.01 : 0.55, {arc: 0.08});
  const from = stackWorld();
  carry(null);
  await seat(id, from);
  VIEW.leanWant = 0;
});
/** click a funded base: the hand lifts its blocks back to the rack */
export const giveBack = (id) => guard(async () => {
  if (!S.a.funded.includes(id)) return;
  await reach(baseTop(id), {dur: 0.35, lift: 0.0, curl: 0.5}); pinch(true);
  const ps = pocketsOf(id); stack(ps.length, ps.length); CG.visible = true; setWorld(CG, baseTop(id).add(V(0, -0.06, 0.02))); hideBlocks(ps);
  carry(CG); await tweenTo(CG, TB.rack.g.localToWorld(V(0, 0.08, 0)), reducedMotion() ? 0.01 : 0.5, {arc: 0.06});
  const from = stackWorld(); carry(null);
  await unseat(id, from);
});

// ---------------------------------------------------------------- order (First / Next) and the need chip
export function setFirst(id) {
  if (!S.a.funded.includes(id) || S.a.funded.length < 2) return;
  const other = S.a.funded.find(f => f !== id), was = S.a.first;
  S.a.first = id; S.a.next = other;
  const notes = cleanup(S.a);
  log('order', id); save(); SND.slide();
  moveTokens();
  if (was !== id) say(tr(`الأول: «${nm(id)}» · التالي: «${nm(other)}».`, `First: “${nm(id)}” · Next: “${nm(other)}”.`));
  notes.forEach(say); emit('ordered', id, notes); refresh();
}
export function swapOrder() { if (S.a.first && S.a.next) setFirst(S.a.next); else if (S.a.funded.length === 2) setFirst(S.a.funded[0]); }
function putInSlot(id, slot) {
  const other = S.a.funded.find(f => f !== id);
  if (slot === 'first') setFirst(id); else if (slot === 'next') setFirst(other);
}
function moveTokens() {
  for (const id of S.a.funded) {
    const tk = TB.bases[id].token, slot = S.a.first === id && S.a.funded.length > 1 ? 'first' : S.a.next === id ? 'next' : null;
    tk.userData.moving = true; tweenTo(tk, slot ? slotWorld(slot) : tokenHome(id), reducedMotion() ? 0.01 : 0.35, {arc: 0.04}).then(() => { tk.userData.moving = false; });
  }
}
export function placeNeed(id) {
  if (S.a.funded.includes(id)) { say(tr(`«${T(P[id].need)}» لا يمكن أن تكون الحاجة المنتظرة: مقترحها مموّل.`, `“${T(P[id].need)}” cannot be the waiting need: its proposal is funded.`)); SND.refuse(); emit('needRefused', id); return false; }
  const prev = S.a.need; S.a.need = id;
  log('need', id); save(); SND.slide();
  for (const k of [prev, id]) if (k) { const ch = TB.chips[k]; ch.userData.moving = true; tweenTo(ch, k === id ? chipOnBase(id) : chipHome(k), reducedMotion() ? 0.01 : 0.4, {arc: 0.05}).then(() => { ch.userData.moving = false; }); }
  say(tr(`الحاجة المنتظرة: «${T(P[id].need)}» على «${nm(id)}».`, `The waiting need: “${T(P[id].need)}” on “${nm(id)}”.`));
  emit('need', id); refresh();
  return true;
}

// ---------------------------------------------------------------- grabbables on the worktable
const baseOf = (o) => { for (let p = o; p; p = p.parent) if (p.name && p.name.startsWith('base_')) return p.name.slice(5); return null; };
const baseTargets = () => ROW.map(id => ({id, pos: baseTop(id), r: 120}));
export function setupTable() {
  // the proposals: open (stage 1), fund by click (stage 2), drag a funded base's blocks off (return)
  let drag = null;
  grabbable({id: 'base', modes: ['stand'], when: () => !TBL.busy && (TBL.allow.open || TBL.allow.fund),
    objects: () => ROW.map(id => TB.bases[id].hit), planeY: WT.y + 0.03, lift: 0.05,
    grab: (hit) => {
      const id = baseOf(hit.object); drag = {id};
      if (TBL.allow.fund && S.a.funded.includes(id)) {
        const ps = pocketsOf(id); stack(ps.length, ps.length); CG.visible = true; setWorld(CG, baseTop(id).add(V(0, -0.05, 0))); drag.lifted = ps;
        return CG;
      }
      return null;
    },
    targets: () => drag && drag.lifted ? [{id: drag.id, pos: baseTop(drag.id), r: 90}] : [],
    drop: (t, carried, info) => {
      const d = drag; drag = null; if (!d) return;
      if (d.lifted) {
        if (info.moved && (!t || t.id !== d.id)) { const from = stackWorld(); guard(() => unseat(d.id, from)); return; }
        if (info.moved) { CG.visible = false; hideBlocks([]); SND.clack(); return; }      // put back on its own base
        CG.visible = false; hideBlocks([]); giveBack(d.id); return;                       // a click on a funded base
      }
      if (info.moved) return;
      if (TBL.allow.fund && !S.a.funded.includes(d.id)) { fund(d.id); return; }
      if (TBL.allow.open) emit('open', d.id);
    },
    move: null});
  // blocks in the rack
  let bdrag = null;
  grabbable({id: 'rack', modes: ['stand'], when: () => !TBL.busy && TBL.allow.fund,
    objects: () => TB.blocks.filter((b, i) => OWN[i] == null), planeY: WT.y + 0.03, lift: 0.07,
    grab: (hit) => {
      const i = TB.blocks.indexOf(hit.object); bdrag = {i}; SND.pick();
      stack(1, 1); CG.visible = true; setWorld(CG, pocketWorld(i).add(V(0, 0.03, 0))); hideBlocks([i]); carry(CG);
      return CG;
    },
    targets: baseTargets,
    hover: (t) => {
      if (!bdrag) return;
      const fp = freePockets(), others = near(bdrag.i);
      if (!t) { stack(1, 1); hideBlocks([bdrag.i]); emit('hint', null); VIEW.leanWant = 0; return; }
      const need = P[t.id].cost, avail = Math.min(need, fp.length);
      stack(need, avail); hideBlocks([bdrag.i, ...others.slice(0, avail - 1)]);
      VIEW.leanWant = Math.abs(TB.bases[t.id].g.position.x - WT.x) > 0.6 ? 1 : 0.5;
      const c = check(S.a.funded, t.id);
      emit('hint', S.a.funded.includes(t.id) ? tr(`«${nm(t.id)}» مموّل بالفعل`, `“${nm(t.id)}” is already funded`)
        : c.ok ? tr(`اترك لتموّل «${nm(t.id)}» (${need})`, `Release to fund “${nm(t.id)}” (${need})`) : refusalText(c), !c.ok);
    },
    drop: (t, carried, info) => {
      const d = bdrag; bdrag = null; carry(null); emit('hint', null); VIEW.leanWant = 0;
      if (!d) return;
      if (!t || S.a.funded.includes(t.id) || !info.moved) {
        // back into the pocket
        CG.visible = false; hideBlocks([]); const b = TB.blocks[d.i]; scene.attach(b); setWorld(b, stackWorld()[0] || pocketWorld(d.i));
        TB.rack.g.attach(b); tweenTo(b, pocketWorld(d.i), 0.25, {arc: 0.03}).then(() => SND.pick());
        if (!info.moved) say(tr('اسحب المكعّب إلى قاعدة مقترح، أو انقر القاعدة نفسها.', 'Drag the block onto a proposal\'s base, or click the base itself.'));
        return;
      }
      const from = stackWorld();
      // the real blocks take the places of the carried ones: the grabbed one first
      guard(() => seatPockets(t.id, [d.i, ...near(d.i)], from));
    }});
  // token cards → the priority tray
  let tdrag = null;
  grabbable({id: 'token', modes: ['stand'], when: () => !TBL.busy && TBL.allow.order && S.a.funded.length === 2,
    objects: () => S.a.funded.map(id => TB.bases[id].token), planeY: WT.y + 0.01, lift: 0.04,
    grab: (hit) => { let id = null; for (let p = hit.object; p; p = p.parent) if (p.name && p.name.startsWith('token_')) { id = p.name.slice(6); break; } tdrag = {id}; SND.slide(); TB.bases[id].token.userData.moving = true; carry(TB.bases[id].token); return TB.bases[id].token; },
    targets: () => [{id: 'first', pos: slotWorld('first'), r: 90}, {id: 'next', pos: slotWorld('next'), r: 90}],
    drop: (t, carried, info) => {
      const d = tdrag; tdrag = null; carry(null); if (!d) return; TB.bases[d.id].token.userData.moving = false;
      if (!info.moved) {   // a click: to the empty slot; in the tray: swap
        if (S.a.first === d.id || S.a.next === d.id) swapOrder(); else putInSlot(d.id, !S.a.first ? 'first' : 'next');
        return;
      }
      if (t) putInSlot(d.id, t.id); else moveTokens();
    }});
  // need chips
  let cdrag = null;
  grabbable({id: 'chip', modes: ['stand'], when: () => !TBL.busy && TBL.allow.need,
    objects: () => IDS.filter(id => S.a.need !== id).map(id => TB.chips[id]), planeY: WT.y + 0.02, lift: 0.05,
    grab: (hit) => { let id = null; for (let p = hit.object; p; p = p.parent) if (p.name && p.name.startsWith('chip_')) { id = p.name.slice(5); break; }
      cdrag = {id}; if (S.a.funded.includes(id)) { placeNeed(id); cdrag.refused = true; return null; }
      TB.chips[id].userData.moving = true; carry(TB.chips[id]); return TB.chips[id]; },
    targets: baseTargets,
    drop: (t, carried, info) => {
      const d = cdrag; cdrag = null; carry(null); if (!d || d.refused) return; TB.chips[d.id].userData.moving = false;
      if (!info.moved || (t && t.id === d.id)) { if (!placeNeed(d.id)) refresh(); return; }
      if (t) say(tr(`الشريحة توضع على قاعدة مقترحها: «${nm(d.id)}».`, `A chip goes on its own proposal's base: “${nm(d.id)}”.`));
      const ch = TB.chips[d.id]; ch.userData.moving = true; tweenTo(ch, chipHome(d.id), 0.3, {arc: 0.03}).then(() => { ch.userData.moving = false; });
    }});
  // the note (read) and the stamps (tag)
  grabbable({id: 'note', modes: ['stand'], when: () => !TBL.busy && TBL.allow.note && TB.note.g.parent === TB.root,
    objects: () => [TB.note.g], drop: (t, c, info) => { if (!info.moved) emit('readNote'); }});
  let sdrag = null;
  grabbable({id: 'stamp', modes: ['stand'], when: () => !TBL.busy && TBL.allow.stamp,
    objects: () => [TB.stamps.current.g, TB.stamps.untested.g], planeY: WT.y + 0.06, lift: 0.04,
    grab: (hit) => { let k = null; for (let p = hit.object; p; p = p.parent) if (p.name && p.name.startsWith('stamp_')) { k = p.name.slice(6); break; } sdrag = {k}; carry(TB.stamps[k].g); return TB.stamps[k].g; },
    targets: () => [{id: 'note', pos: TB.note.g.getWorldPosition(new THREE.Vector3()), r: 140}],
    drop: (t, c, info) => { const d = sdrag; sdrag = null; carry(null); if (!d) return; if (t) stampNote(d.k, true); else { tweenTo(TB.stamps[d.k].g, TB.stamps[d.k].home, 0.3, {arc: 0.04}); } }});
}
/** seat `id` using these pockets (in this order: the carried stack's blocks, from the first) */
async function seatPockets(id, ps, from) {
  const c = check(S.a.funded, id);
  if (!c.ok) return refuse(id, c, from, ps);
  const chosen = ps.filter(i => OWN[i] == null).slice(0, P[id].cost);
  chosen.forEach(i => OWN[i] = id);
  S.a.funded.push(id); TBL.refusal = null; TBL.refusalFor = null;
  const notes = cleanup(S.a);
  const base = TB.bases[id], sockets = pocketsOf(id);
  CG.visible = false; hideBlocks([]);
  await Promise.all(chosen.map(async (i, k) => {
    const b = TB.blocks[i];
    if (from && from[k]) { scene.attach(b); setWorld(b, from[k]); }
    b.visible = true;
    await wait(k * 0.09);
    base.g.attach(b);
    await tweenTo(b, socketWorld(id, sockets.indexOf(i)), reducedMotion() ? 0.01 : from ? 0.22 : 0.38, {arc: from ? 0.02 : 0.1});
    SND.clack();
  }));
  // the palm presses them down
  await reach(baseTop(id).add(V(0, -0.03, 0.03)), {dur: 0.2, lift: 0, curl: 0.05}); await press(0.02); SND.press(); rest();
  log('fund', id); save();
  base.token.visible = true; SND.slide();
  refresh();
  say(tr(`مموّل: «${nm(id)}» (${P[id].cost}). مستخدم ${used(S.a.funded)} من 8.`, `Funded: “${nm(id)}” (${P[id].cost}). Used ${used(S.a.funded)} of 8.`));
  notes.forEach(say);
  emit('funded', id, notes);
}
export const returnUnits = (id) => giveBack(id);

// ---------------------------------------------------------------- the note and the stamps
/** the hand picks up the stamp, carries it over the note, presses it, and puts it back */
export const stampNote = (k, carried = false) => guard(async () => {
  const st = TB.stamps[k], over = TB.note.g.getWorldPosition(new THREE.Vector3()).add(V(0, 0.09, 0.03));
  if (!carried) { await reach(st.g.position.clone().add(V(0, 0.12, 0)), {dur: 0.35, lift: 0, curl: 0.7}); }
  carry(st.g);
  await tweenTo(st.g, over, reducedMotion() ? 0.01 : 0.4, {arc: 0.05});
  await tweenTo(st.g, over.clone().add(V(0, -0.075, 0)), 0.1); SND.stamp();
  const first = !S.firstTag; S.tag = k; if (first) S.firstTag = k; log('tag', k); save();
  drawNote(k);
  await tweenTo(st.g, over, 0.12);
  carry(null);
  tweenTo(st.g, st.home, reducedMotion() ? 0.01 : 0.4, {arc: 0.05});
  emit('tagged', k, first);
});
/** the hand lifts the corner of the sheet (then the readable copy opens) */
export async function liftNote() {
  await reach(TB.note.g.getWorldPosition(new THREE.Vector3()).add(V(0.06, 0.0, 0.08)), {dur: 0.35, lift: 0.01, curl: 0.5});
  const m = TB.note.mesh; SND.paper();
  m.rotation.z = 0; const t0 = performance.now();
  await new Promise(r => { const f = () => { const k = Math.min(1, (performance.now() - t0) / 350); m.rotation.y = -Math.sin(k * Math.PI) * 0.35; k < 1 ? requestAnimationFrame(f) : r(); }; f(); });
  rest();
}
/** the hand reaches to a proposal's card and it flips over (a soft cardboard slide) */
export async function flipCard(id) {
  const b = TB.bases[id], p = b.card.getWorldPosition(new THREE.Vector3());
  await reach(p.add(V(0, 0.0, 0.03)), {dur: 0.4, lift: 0.02, curl: 0.4}); SND.slide();
  const t0 = performance.now();
  await new Promise(r => { const f = () => { const k = Math.min(1, (performance.now() - t0) / (reducedMotion() ? 10 : 450)); setCardOpen(id, k * k * (3 - 2 * k)); k < 1 ? requestAnimationFrame(f) : r(); }; f(); });
  rest();
}

// ---------------------------------------------------------------- the review table
const BOARDC = () => TB.board.g.localToWorld(V(0, 0.15, 0.01));
export function setupReview() {
  let cd = null;
  grabbable({id: 'cond', modes: ['seat'], when: () => !TBL.busy && TBL.allow.cond,
    objects: () => TB.cards.filter(c => !c.userData.clipped), planeY: null,
    grab: (hit) => { let g = hit.object; while (g && !g.name.startsWith('cond')) g = g.parent; cd = {g}; carry(g); SND.paper(); return g; },
    targets: () => [{id: 'clip', pos: clippedPose(), r: 150}],
    drop: (t, c, info) => { const d = cd; cd = null; carry(null); if (!d) return; if (t || !info.moved) clipCard(d.g.userData.k); else tweenTo(d.g, d.g.userData.home, 0.3, {arc: 0.03}); }});
  let sd = null;
  grabbable({id: 'commit', modes: ['seat'], when: () => !TBL.busy && TBL.allow.commit,
    objects: () => [TB.commit.g], planeY: null,
    grab: () => { sd = true; carry(TB.commit.g); return TB.commit.g; },
    targets: () => [{id: 'board', pos: BOARDC(), r: 200}],
    drop: (t, c, info) => { const d = sd; sd = null; carry(null); if (!d) return; if (t || !info.moved) commitStamp(true); else tweenTo(TB.commit.g, TB.commit.home, 0.3, {arc: 0.04}); }});
}
/** put the cards where the state says (one may be in the clip) */
export function syncCards() {
  for (const g of TB.cards) {
    const k = g.userData.k, inClip = S.a.cond === k;
    g.userData.clipped = inClip;
    if (inClip) { setWorld(g, clippedPose()); g.rotation.set(0, -Math.PI / 2, 0); }
    else { setWorld(g, g.userData.home); g.rotation.set(0, -Math.PI / 2, 0); }
  }
}
/** the hand carries a condition card and clips it beside "First"; any earlier card goes back to the holder */
export const clipCard = (k) => guard(async () => {
  const g = TB.cards.find(c => c.userData.k === k); if (!g) return;
  const prev = TB.cards.find(c => c.userData.clipped && c !== g);
  if (prev) { prev.userData.clipped = false; tweenTo(prev, prev.userData.home, 0.35, {arc: 0.05}); }
  await reach(g.getWorldPosition(new THREE.Vector3()), {dur: 0.3, lift: 0.0, curl: 0.7});
  carry(g); setClip(true); SND.clip();
  await tweenTo(g, clippedPose(), reducedMotion() ? 0.01 : 0.45, {arc: 0.06});
  g.userData.clipped = true; setClip(false); SND.clip(); carry(null);
  S.a.cond = k; S.a.condFor = S.a.first; S.a.condReset = false; S.a.condRed = false; log('cond', k); save();
  emit('cond', k);
});
/** take the stamp and press it on the board */
export const commitStamp = (carried = false) => guard(async () => {
  const st = TB.commit, over = BOARDC().add(V(-0.04, 0.12, 0.05));
  if (!carried) await reach(st.g.position.clone().add(V(0, 0.13, 0)), {dur: 0.35, lift: 0, curl: 0.7});
  carry(st.g);
  await tweenTo(st.g, over, reducedMotion() ? 0.01 : 0.45, {arc: 0.05});
  await tweenTo(st.g, over.clone().add(V(0.03, -0.07, 0)), 0.1); SND.stamp();
  emit('commit');
  await tweenTo(st.g, over, 0.12); carry(null);
  tweenTo(st.g, st.home, reducedMotion() ? 0.01 : 0.4, {arc: 0.05});
});
window.__table = () => JSON.stringify({own: OWN, a: S.a, busy: TBL.busy, allow: TBL.allow});
