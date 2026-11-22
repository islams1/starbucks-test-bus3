// English version (?lang=en): page texts here; voices, subtitles and lip-sync from data/lines.en.json + assets/vo/en,
// the texts on the table and the wall are drawn in English by the modules that draw them.
export const EN = new URLSearchParams(location.search).get('lang') === 'en';
export function applyLanguage() {
  const $ = (s) => document.querySelector(s);
  const swap = () => { const q = new URLSearchParams(location.search); if (EN) q.delete('lang'); else q.set('lang', 'en'); return location.pathname + (q.toString() ? '?' + q : ''); };
  $('#langbtn').onclick = () => { location.href = swap(); };
  const foot = $('#menufoot');
  if (!EN) { foot.insertAdjacentHTML('beforeend', ` · <a href="${swap()}">English</a>`); return; }
  document.documentElement.lang = 'en'; document.documentElement.dir = 'ltr';
  document.title = 'What the Table Can Carry — The Eight-Unit Turnaround';
  $('.load-title').textContent = 'What the Table Can Carry'; $('.load-sub').textContent = 'The eight-unit turnaround · Illustrative scenario';
  $('#loadhint').textContent = 'The product workshop and the worktable';
  $('#menu h1').textContent = 'What the Table Can Carry';
  $('#menu .lead').textContent = 'You lead the turnaround at “Rukn Toys”, a fictional toy company in a hard year. On the worktable are four proposals, and in front of you a rack that holds only eight wooden blocks: all of the execution capacity for this cycle. Fund by hand what fits, order what starts first, name what waits, then show your plan to the board chair. Finally, a real archive opens on the wall.';
  $('#menu .mode b').textContent = 'Step up to the worktable'; $('#menu .mode span').textContent = '13–16 minutes · one workshop · coaching, not a grade';
  $('#contbtn').textContent = 'Continue where you left off';
  $('#reviewbtn').textContent = 'View your committed pitch';
  document.querySelectorAll('.qsel > span').forEach(e => e.textContent = 'Graphics quality:');
  const q = {low: ['Low', 'Weak devices'], medium: ['Medium', 'Laptop / phone'], high: ['High', 'Dedicated GPU'], cpu: ['Very light', 'No GPU']};
  document.querySelectorAll('[data-q]').forEach(b => { const t = q[b.dataset.q]; if (t) { b.querySelector('b').textContent = t[0]; b.querySelector('small').textContent = t[1]; } });
  foot.innerHTML = `Headphones recommended · <a href="#" id="creditslink">Sources and credits</a> · <a href="${swap()}">العربية</a>`;
  $('#howto h2').textContent = 'How to play';
  const k = document.querySelectorAll('#howto .k');
  const T = [['Drag on empty space to look around', 'or the arrow keys'], ['Walk around the workshop', 'or the arrows · Shift to run · “Back to the worktable” takes you back'], ['Press on a block and drag it onto a proposal\'s base', 'or click the base itself to fund it, and click it again to return the units'], ['Click the rings or the buttons below', 'to open the proposals and the note'], ['Table list', 'every prop and action as buttons'], ['Review condition'], ['Pause']];
  k.forEach((el, i) => { const b = el.querySelector('b'), s = el.querySelector('small'); if (b && T[i]) b.textContent = T[i][0]; if (s && T[i] && T[i][1]) s.textContent = T[i][1]; });
  $('#howto .task-card').innerHTML = '<b>Your task:</b> open the four proposals and read the retailer note, then allocate the eight units to what the team can actually deliver, order what starts first, name one need that waits, and pick a condition at which you would review the plan.<br><span class="ok">Coaching:</span> a valid use of capacity, a named deferred need, and a review condition that matches what starts first — with a risk observation. No grade against what a real company did.';
  $('#startbtn').textContent = 'Start';
  $('#pause h2').textContent = 'Paused'; $('#resume').textContent = 'Resume'; $('#tohowto').textContent = 'How to play';
  $('#objective .obj-label').textContent = 'Objective';
  $('#scenetag').textContent = 'Illustrative scenario · a fictional company';
  $('#listbtn').innerHTML = 'Table list <kbd>L</kbd>'; $('#ambbtn').textContent = '♪ Workshop sound'; $('#ambbtn').title = 'Workshop sound'; $('#langbtn').textContent = 'العربية';
  $('#ledger').setAttribute('aria-label', 'Capacity ledger'); $('#lgused').textContent = 'Used 0 of 8'; $('#lgfree').textContent = 'Free 8';
  $('#dock').setAttribute('aria-label', 'What you can use');
  $('#gl').setAttribute('aria-label', 'The 3D scene');
}
