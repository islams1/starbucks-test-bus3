// English page texts (?lang=en). Voices stay Arabic; subtitles and UI switch to English.
export const EN = new URLSearchParams(location.search).get('lang') === 'en';
export function applyLanguage() {
  const $ = (s) => document.querySelector(s);
  const foot = $('#menufoot');
  if (!EN) { foot.insertAdjacentHTML('beforeend', ' · <a href="?lang=en">English</a>'); return; }
  document.documentElement.lang = 'en'; document.documentElement.dir = 'ltr';
  document.title = 'Seven Minutes — The $40 Million Service Decision';
  $('.load-title').textContent = 'Seven Minutes'; $('.load-sub').textContent = 'The $40 million decision · Illustrative scenario';
  $('#menu h1').textContent = 'Seven Minutes';
  $('#menu .lead').textContent = 'You are the service operations lead of a coffee chain. Spend one day at the Al-Midan store: measure the wait yourself, work out how many orders would cover extra labor, then recommend a decision to the investment committee.';
  $('#menu .mode b').textContent = 'Start the day'; $('#menu .mode span').textContent = '12–15 minutes · first person · scored out of 100';
  document.querySelectorAll('.qsel > span').forEach(e => e.textContent = 'Graphics quality:');
  const q = {low: ['Low', 'Weak devices'], medium: ['Medium', 'Laptop / phone'], high: ['High', 'Dedicated GPU'], cpu: ['Very light', 'No GPU']};
  document.querySelectorAll('[data-q]').forEach(b => { const t = q[b.dataset.q]; if (t) { b.querySelector('b').textContent = t[0]; b.querySelector('small').textContent = t[1]; } });
  foot.innerHTML = 'Headphones recommended · <a href="#" id="creditslink">Sources and credits</a> · <a href="?">العربية</a>';
  $('#howto h2').textContent = 'How to play';
  const k = document.querySelectorAll('#howto .k b'); ['Walk', 'Mouse: look', 'Interact', 'Evidence tray', 'Pick a reply', 'Pause'].forEach((t, i) => k[i] && (k[i].textContent = t));
  const sm = document.querySelector('#howto .k small'); if (sm) sm.textContent = 'or click the icon';
  $('#howto .task-card').innerHTML = '<b>Your task today:</b> find where orders get stuck in the store, work out what extra labor costs, then recommend a decision to the investment committee — with the evidence that would make you keep it or reverse it.<br><span class="ok">Points (out of 100):</span> for the evidence you gather, the calculation and the review condition. The decision itself earns none.';
  $('#startbtn').textContent = 'Start';
  $('#pause h2').textContent = 'Paused'; $('#resume').textContent = 'Resume'; $('#tohowto').textContent = 'How to play';
  $('#clicktolock').textContent = 'Click to look around';
  $('#objective .obj-label').textContent = 'Objective';
  $('#scenetag').textContent = 'Illustrative scenario';
}
