// English page texts (?lang=en). Voices stay Arabic; subtitles and UI switch to English.
export const EN = new URLSearchParams(location.search).get('lang') === 'en';
export function applyLanguage() {
  const $ = (s) => document.querySelector(s);
  const foot = $('#menufoot');
  if (!EN) { foot.insertAdjacentHTML('beforeend', ' · <a href="?lang=en">English</a>'); return; }
  document.documentElement.lang = 'en'; document.documentElement.dir = 'ltr';
  document.title = 'The Store on the Table — The $40 Million Service Decision';
  $('.load-title').textContent = 'The Store on the Table'; $('.load-sub').textContent = 'The $40 million decision · Illustrative scenario';
  $('#loadhint').textContent = 'One place: the committee room and the store model';
  $('#menu h1').textContent = 'The Store on the Table';
  $('#menu .lead').textContent = 'You are the service operations lead. On the investment committee\'s table stands a live model of the Al-Midan store, replaying Tuesday morning. Watch where orders get stuck, work out how many orders would cover extra labor, then recommend a decision — with what would make you keep or reverse it.';
  $('#menu .mode b').textContent = 'Take your seat'; $('#menu .mode span').textContent = '12–15 minutes · one room · coaching score out of 3';
  $('#reviewbtn').textContent = 'View your confirmed memo';
  document.querySelectorAll('.qsel > span').forEach(e => e.textContent = 'Graphics quality:');
  const q = {low: ['Low', 'Weak devices'], medium: ['Medium', 'Laptop / phone'], high: ['High', 'Dedicated GPU'], cpu: ['Very light', 'No GPU']};
  document.querySelectorAll('[data-q]').forEach(b => { const t = q[b.dataset.q]; if (t) { b.querySelector('b').textContent = t[0]; b.querySelector('small').textContent = t[1]; } });
  foot.innerHTML = 'Headphones recommended · <a href="#" id="creditslink">Sources and credits</a> · <a href="?">العربية</a>';
  $('#howto h2').textContent = 'How to play';
  const k = document.querySelectorAll('#howto .k');
  const T = [['Drag: look around / turn around the model'], ['Lean into the model or back', 'or the "Lean in" button · two fingers on touch'], ['Click the rings or the buttons below', 'the card, the comments, the tablet'], ['Evidence tray'], ['Pick a reply'], ['Pause']];
  k.forEach((el, i) => { const b = el.querySelector('b'), s = el.querySelector('small'); if (b && T[i]) b.textContent = T[i][0]; if (s && T[i] && T[i][1]) s.textContent = T[i][1]; });
  const wk = document.querySelector('#howto kbd.wide'); if (wk && wk.textContent.trim() === 'عجلة') wk.textContent = 'Wheel';
  $('#howto .task-card').innerHTML = '<b>Your task:</b> find where orders get stuck in the store, work out how many extra orders would cover the new labor, then recommend a decision to the committee with its evidence and review condition.<br><span class="ok">Score (out of 3):</span> a peak-specific observation, a cost measure tied to contribution, and the review condition that matches your recommendation. The recommendation itself earns nothing.';
  $('#startbtn').textContent = 'Start';
  $('#preparing').textContent = 'Getting the store ready…';
  $('#pause h2').textContent = 'Paused'; $('#resume').textContent = 'Resume'; $('#tohowto').textContent = 'How to play';
  $('#objective .obj-label').textContent = 'Objective';
  $('#scenetag').textContent = 'Illustrative scenario';
  $('#leanbtn').textContent = 'Lean into the model'; $('#trybtn').innerHTML = 'Evidence tray <kbd>Tab</kbd>'; $('#ambbtn').textContent = '♪ Café sound';
  $('#dock').setAttribute('aria-label', 'What you can use');
  $('#gl').setAttribute('aria-label', 'The 3D scene');
}
