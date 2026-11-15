// Mission tracker: progress bar + checklist of every step the player has to do (current step highlighted).
import {S} from '../story/state.js';
import {hotspots} from './hotspots.js';
import {toast} from './ui.js';
import {sfx} from '../core/audio.js';

const STEPS = [
  {id: 'lobby', t: 'ادخل المبنى وتحدث مع عمر صالح في الاستقبال', done: () => !!S.nodes.LOBBY},
  {id: 'office', t: 'اذهب إلى مكتبك واستمع لتكليف نادية', done: () => !!S.briefed},
  {id: 'research', t: 'افتح «ملف الأبحاث» وأكمل مهمة القيمة', done: () => !!S.tasks.research, hs: 'desk_folder'},
  {id: 'n01', t: 'أجب نادية: لمن هذه الحملة؟', done: () => !!S.nodes.N01},
  {id: 'budget', t: 'افتح «ورقة الميزانية» وأكمل المهام المالية', done: () => !!S.ev.M10, hs: 'desk_budget'},
  {id: 'booklet', t: 'اقرأ «دليل العلامة»', done: () => !!S.ev.M5, hs: 'desk_booklet'},
  {id: 'n02', t: 'رد على اقتراح رايان (الخصم)', done: () => !!S.nodes.N02},
  {id: 'dash', t: 'افتح «اللابتوب» واتصل بالفرع (هنا)', done: () => !!S.nodes.N03, hs: 'desk_laptop'},
  {id: 'script', t: 'اقرأ «سيناريو الفيلم» وقرّر', done: () => !!S.nodes.N05, hs: 'desk_script'},
  {id: 'partner', t: 'افتح «الظرف الرمادي» وتحدث مع جريس', done: () => !!S.ev.M9 && !!S.nodes.N06, opt: true, hs: () => S.ev.M9 ? 'grace' : 'desk_envelope'},
  {id: 'brief', t: 'ابنِ موجز الحملة على «التابلت» (اسحب الأدلة)', done: () => !!S.briefBuilt, hs: 'desk_tablet'},
  {id: 'board', t: 'رتّب لوحة الأفكار في قاعة الاجتماعات', done: () => Object.keys(S.boardSort || {}).length === 4, opt: true, hs: 'board'},
  {id: 'coffee', t: 'اعمل قهوة في ركن القهوة', done: () => !!S.coffee, opt: true, hs: 'coffee'},
  {id: 'meeting', t: 'اذهب إلى قاعة الاجتماعات', done: () => !!S.meetingStarted},
  {id: 'answers', t: 'قم واعرض موجزك على الشاشة وأجب نادية', done: () => !!S.briefAnswered},
  {id: 'plan', t: 'اختر الخطة', done: () => !!S.ending},
];

const el = document.createElement('div'); el.id = 'tracker';
el.innerHTML = `<div class="tr-head"><b>خطوات المهمة</b><span id="trpct">0%</span></div><div class="tr-bar"><i id="trbar"></i></div><ol id="trlist"></ol>`;
document.getElementById('hud').appendChild(el);
const list = el.querySelector('#trlist');
const seen = new Set();
let first = true;

export function currentStep() { return STEPS.find(s => !s.opt && !s.done()); }

function render() {
  const req = STEPS.filter(s => !s.opt);
  const n = req.filter(s => s.done()).length;
  const pct = Math.round(n / req.length * 100);
  el.querySelector('#trpct').textContent = pct + '%';
  el.querySelector('#trbar').style.width = pct + '%';
  const cur = currentStep();
  const doneN = STEPS.filter(s => s.done()).length;
  const visible = STEPS.filter(s => !s.done()).slice(0, 7);
  list.innerHTML = (doneN ? `<li class="done"><span class="ck">✓</span>${doneN} خطوات مكتملة</li>` : '') + visible.map(s => {
    const d = s.done(), c = s === cur;
    return `<li class="${d ? 'done' : ''} ${c ? 'cur' : ''} ${s.opt ? 'optl' : ''}"><span class="ck">${d ? '✓' : ''}</span>${s.t}${s.opt ? ' <small>(اختياري)</small>' : ''}</li>`;
  }).join('');
  // completion toasts
  for (const s of STEPS) if (s.done() && !seen.has(s.id)) { seen.add(s.id); if (!first) { toast(`<b>✓ تم</b> — ${s.t}`); sfx.ping(); } }
  first = false;
  // highlight the hotspot that belongs to the current / remaining desk steps
  const want = new Set();
  for (const s of STEPS) if (!s.done() && s.hs) want.add(typeof s.hs === 'function' ? s.hs() : s.hs);
  for (const [id, h] of hotspots) h.el.classList.toggle('next', want.has(id) && !h.done);
}
setInterval(render, 400);
// keep the scene clear while people are talking or a choice is on screen
setInterval(() => { const talk = !document.getElementById('subs').classList.contains('hidden') || !document.getElementById('choices').classList.contains('hidden'); el.style.opacity = talk ? 0 : 1; }, 150);
render();
