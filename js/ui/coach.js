// First-time guide ("coach marks"): dims the screen around one element, points a bouncing arrow at it, explains
// what to do in a small bubble and waits until the player has actually done it (or presses "next").
// Optional ghost: a copy of an element glides from one place to another to show a drag.
//   const tour = coach([{target, text, side, done?, next?, skip?, ghost?}, ...]); tour.stop();
const ARROW = '<svg viewBox="0 0 48 48" width="48" height="48"><path d="M4 24h30M24 10l14 14-14 14" fill="none" stroke="#ffd479" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ROT = {left: 0, right: 180, above: 90, below: -90};             // arrow sits on this side of the target, pointing at it
const BOUNCE = {left: [8, 0], right: [-8, 0], above: [0, 8], below: [0, -8]};

export function coach(steps, {onEnd = null} = {}) {
  const root = document.createElement('div'); root.className = 'coach';
  root.innerHTML = `<div class="coach-hole"></div><div class="coach-ring2"></div><div class="coach-arrow">${ARROW}</div><div class="coach-ghost"></div>
    <div class="coach-tip" role="dialog" aria-live="polite"><div class="coach-n"></div><div class="coach-t"></div>
    <div class="coach-b"><button class="coach-skip">تخطَّ الشرح</button><button class="coach-next primary">التالي</button></div></div>`;
  document.body.appendChild(root);
  const $ = (s) => root.querySelector(s);
  const hole = $('.coach-hole'), ring2 = $('.coach-ring2'), arrow = $('.coach-arrow'), ghost = $('.coach-ghost'), tip = $('.coach-tip'), nextBtn = $('.coach-next');
  let alive = true, cur = null, advance = null, raf = 0;
  const stop = () => { if (!alive) return; alive = false; cancelAnimationFrame(raf); root.remove(); advance && advance(); onEnd && onEnd(); };
  $('.coach-skip').onclick = stop;
  nextBtn.onclick = () => advance && advance();

  const place = () => { raf = requestAnimationFrame(place); try { frame(); } catch (e) { console.error('[coach]', e); stop(); } };
  const frame = () => {
    const el = cur && cur.target(); if (!el || !el.isConnected) { root.classList.add('lost'); return; }
    root.classList.remove('lost');
    const r = el.getBoundingClientRect(), pad = 6, vw = innerWidth, vh = innerHeight;
    Object.assign(hole.style, {left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px'});
    // the arrow + bubble go on the first preferred side with room for them
    const tw = tip.offsetWidth, th = tip.offsetHeight, A = 52, gap = 6;
    const room = {left: r.left - pad - A - gap - tw > 8, right: vw - r.right - pad - A - gap - tw > 8, above: r.top - pad - A - gap - th > 8, below: vh - r.bottom - pad - A - gap - th > 8};
    const side = (cur.side || ['left', 'above', 'below', 'right']).find(s => room[s]) || 'above';
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let ax, ay, tx, ty;
    if (side === 'left') { ax = r.left - pad - A; ay = cy - 24; tx = ax - gap - tw; ty = cy - th / 2; }
    else if (side === 'right') { ax = r.right + pad + 4; ay = cy - 24; tx = ax + A + gap; ty = cy - th / 2; }
    else if (side === 'above') { ax = cx - 24; ay = r.top - pad - A; tx = cx - tw / 2; ty = ay - gap - th; }
    else { ax = cx - 24; ay = r.bottom + pad + 4; tx = cx - tw / 2; ty = ay + A + gap; }
    tx = Math.max(8, Math.min(vw - tw - 8, tx)); ty = Math.max(8, Math.min(vh - th - 8, ty));
    Object.assign(arrow.style, {left: ax + 'px', top: ay + 'px', rotate: ROT[side] + 'deg'});
    arrow.style.setProperty('--bx', BOUNCE[side][0] + 'px'); arrow.style.setProperty('--by', BOUNCE[side][1] + 'px');
    Object.assign(tip.style, {left: tx + 'px', top: ty + 'px'});
    // drag demonstration: the ghost card glides from the source to the destination, over and over
    const g = cur.ghost && cur.ghost();
    if (g && g[0] && g[1]) {
      const a = g[0].getBoundingClientRect(), b = g[1].getBoundingClientRect(), T = 2400, k = (performance.now() % T) / T;
      const m = Math.min(1, Math.max(0, (k - 0.18) / 0.5)), e = m < 0.5 ? 2 * m * m : 1 - (-2 * m + 2) ** 2 / 2;
      const x = a.left + (b.left + b.width / 2 - a.width / 2 - a.left) * e, y = a.top + (b.top + b.height / 2 - a.height / 2 - a.top) * e;
      Object.assign(ghost.style, {display: 'block', left: x + 'px', top: y + 'px', width: a.width + 'px', opacity: k < 0.1 ? k / 0.1 : k > 0.86 ? (1 - k) / 0.14 : 1});
      Object.assign(ring2.style, {display: 'block', left: b.left - 4 + 'px', top: b.top - 4 + 'px', width: b.width + 8 + 'px', height: b.height + 8 + 'px'});
    } else { ghost.style.display = 'none'; ring2.style.display = 'none'; }
    if (cur.done && cur.done()) advance && advance();
  };

  const run = async () => {
    const list = steps.filter(s => !(s.skip && s.skip()));
    for (let i = 0; i < list.length && alive; i++) {
      cur = list[i];
      const el = cur.target(); if (el && el.scrollIntoView) el.scrollIntoView({block: 'nearest', behavior: 'smooth'});
      $('.coach-n').textContent = `${i + 1} / ${list.length}`;
      $('.coach-t').innerHTML = cur.text;
      nextBtn.textContent = cur.next || 'التالي'; nextBtn.style.display = cur.next ? '' : 'none';
      const g = cur.ghost && cur.ghost(); ghost.innerHTML = g && g[0] ? g[0].innerHTML + '<span class="coach-hand">👆</span>' : '';
      tip.classList.remove('pop'); void tip.offsetWidth; tip.classList.add('pop');
      if (!raf) place();
      await new Promise(res => advance = res);
      advance = null;
      if (alive && cur.after) await cur.after();
    }
    stop();
  };
  run();
  return {stop};
}
