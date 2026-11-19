// Cuts without black: the last frame drawn is held on screen while the next shot's photographed tiles arrive behind it,
// then it dissolves into the new view. (A dip to black between shots, waiting for the tiles, read as black frames on a
// slow connection.)
import {renderer, onOverlay} from '../core/engine.js';

let cv = null, lab = null;
function build() {
  if (cv) return;
  cv = document.createElement('canvas');
  Object.assign(cv.style, {position: 'fixed', inset: '0', width: '100%', height: '100%', zIndex: 59, pointerEvents: 'none', opacity: 0, transition: 'opacity 0ms'});
  lab = document.createElement('div');
  Object.assign(lab.style, {position: 'fixed', left: '50%', bottom: '9vh', transform: 'translateX(-50%)', zIndex: 59, pointerEvents: 'none',
    color: '#e9eef2', font: '500 15px/1.6 inherit', letterSpacing: '.02em', padding: '6px 16px', borderRadius: '20px',
    background: 'rgba(8,12,16,.55)', backdropFilter: 'blur(4px)', opacity: 0, transition: 'opacity .4s'});
  document.body.append(cv, lab);
}
/** hold the next frame drawn on screen (it is copied straight after it is rendered, before the browser clears it) */
export function freeze(label = '') {
  build();
  return new Promise(r => {
    let done = false;
    const grab = () => {
      if (done) return; done = true; off();
      const c = renderer.domElement;
      if (c.width && c.height) { cv.width = c.width; cv.height = c.height; cv.getContext('2d').drawImage(c, 0, 0); }
      cv.style.transitionDuration = '0ms'; cv.style.opacity = 1;
      lab.textContent = label; lab.style.opacity = label ? 1 : 0;
      r();
    };
    const off = onOverlay(grab);
    setTimeout(grab, 250);                    // nothing being drawn (loading): hold whatever is on the canvas
  });
}
/** a short note over the live picture (nothing held: the cockpit keeps moving) */
export function note(label = '') { build(); lab.textContent = label; lab.style.opacity = label ? 1 : 0; }
/** dissolve the held frame into the live view */
export function thaw(ms = 500) {
  if (!cv) return Promise.resolve();
  cv.style.transitionDuration = ms + 'ms'; cv.style.opacity = 0; lab.style.opacity = 0;
  return new Promise(r => setTimeout(r, ms));
}
