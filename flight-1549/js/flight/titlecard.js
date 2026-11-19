// The opening title: after "start", the screen goes dark and the flight's title comes up — the airline and flight, the
// date, the airport and the time — while the city of the first shot finishes arriving behind it; then it fades into that
// shot. It stays at least long enough to be read, so a quick load and a slow one look the same.
const MIN_MS = 3800;
let el = null, shownAt = 0;

function build() {
  if (el) return el;
  el = document.createElement('div');
  el.id = 'titlecard';
  el.innerHTML = `
    <div class="tc-inner">
      <div class="tc-kicker">US AIRWAYS · FLIGHT 1549</div>
      <div class="tc-date">١٥ يناير ٢٠٠٩</div>
      <div class="tc-place">مطار لاغوارديا، نيويورك</div>
      <div class="tc-time">الساعة ٣:٢٥ عصرًا</div>
      <div class="tc-line"><span></span></div>
      <div class="tc-status"></div>
    </div>`;
  const css = document.createElement('style');
  css.textContent = `
    #titlecard{position:fixed;inset:0;z-index:90;background:#04070a;display:grid;place-items:center;opacity:0;pointer-events:none;
      transition:opacity .7s ease;font-family:'IBM Plex Sans Arabic',Inter,sans-serif;color:#e8edf1;text-align:center}
    #titlecard.on{opacity:1;pointer-events:auto}
    #titlecard .tc-inner{display:grid;gap:10px;transform:translateY(6px);transition:transform 1.6s ease}
    #titlecard.on .tc-inner{transform:none}
    #titlecard .tc-kicker{font:600 12px/1 Inter,sans-serif;letter-spacing:.32em;color:#9fb0bd;direction:ltr}
    #titlecard .tc-date{font-weight:600;font-size:clamp(30px,5vw,52px);line-height:1.15}
    #titlecard .tc-place{font-size:clamp(16px,2.2vw,22px);color:#c9d3da}
    #titlecard .tc-time{font-size:clamp(14px,1.8vw,18px);color:#8fa1ae}
    #titlecard .tc-line{margin:14px auto 0;width:120px;height:2px;background:rgba(255,255,255,.08);overflow:hidden;border-radius:2px}
    #titlecard .tc-line span{display:block;width:40%;height:100%;background:#d8b46a;animation:tcSweep 1.6s ease-in-out infinite}
    #titlecard .tc-status{min-height:18px;font-size:13px;color:#7f8f9b}
    @keyframes tcSweep{0%{transform:translateX(-110%)}100%{transform:translateX(260%)}}
    @media (prefers-reduced-motion: reduce){#titlecard .tc-line span{animation:none;width:100%;opacity:.5}}`;
  document.head.appendChild(css);
  document.body.appendChild(el);
  return el;
}
/** fade to the title (resolves once it covers the screen) */
export function showTitle() {
  build(); shownAt = performance.now();
  requestAnimationFrame(() => el.classList.add('on'));
  return new Promise(r => setTimeout(r, 750));
}
/** a quiet line under the title, only when something is really holding the start up (no connection) */
export function titleStatus(t) { if (el) el.querySelector('.tc-status').textContent = t || ''; }
export const titleOn = () => !!el && el.classList.contains('on');
/** fade the title out onto what is behind it, once it has been on long enough to read */
export async function hideTitle() {
  if (!titleOn()) return;
  const left = MIN_MS - (performance.now() - shownAt);
  if (left > 0) await new Promise(r => setTimeout(r, left));
  el.classList.remove('on');
  await new Promise(r => setTimeout(r, 750));
}
