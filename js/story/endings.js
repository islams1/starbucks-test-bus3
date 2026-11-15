// Plans (4 cards), tension, January result with market index, debrief.
import {$, show} from '../ui/ui.js';
import {S, EVIDENCE, CAT} from './state.js';
import {sfx} from '../core/audio.js';

const SEGNAME = {A: 'الشريحة أ', B: 'الشريحة ب', C: 'الشريحة ج', D: 'الشريحة د', everyone: 'للجميع', none: '—'};

export function planDefs() {
  const seg = S.segment;
  const p4 = seg === 'C'
    ? {title: 'حملة تبدأ بالتشغيل: طلبات الموبايل في وقتها', desc: 'للشريحة ج (الأكثر زيارة، تريد السرعة): باريستا إضافي 7–9 صباحًا في الفروع الثمانية الأكثر ازدحامًا ورف استلام واضح قبل الإطلاق، ثم دعوة لتجربة الطلب المسبق. المقياس: وقت الانتظار في الذروة وزيارات الشريحة. لا خصم؛ والشراكة قرار منفصل.'}
    : seg === 'B'
      ? {title: 'حملة هادئة عن «الجودة والراحة»', desc: 'للشريحة ب: مكان هادئ للجلوس وجودة ثابتة في عطلة الأسبوع، مع تشغيل مضمون في الفروع المدعومة. مقاييس أعمال وخطة للخطر. لا خصم؛ والشراكة قرار منفصل.'}
      : {title: '«نتقابل في المكان الثالث»', desc: 'للشريحة أ: حملة لعطلة الأسبوع تدعو الأصدقاء للقاء في فروعنا، ومسابقة صور بالكوب الأحمر تشارك لحظات معًا لا أكوابًا في طابور — في 8 فروع مدعومة بباريستا إضافي 7–9 ورف استلام، بموافقة مكتوبة وقواعد إشراف. لا خصم؛ والشراكة قرار منفصل.'};
  return [
    {n: 1, title: 'خصم «اشترِ واحدًا واحصل على الثاني» كل بعد ظهر في ديسمبر', owner: 'رايان كول — المبيعات', desc: 'حركة مضمونة بعد الظهر. التكلفة نحو 95,000 دولار من الهامش من ميزانية 120,000.'},
    {n: 2, title: 'مسابقة الكوب الأحمر في الفروع الـ24 كلها فورًا', owner: 'مي لين — التواصل الاجتماعي', desc: 'التفاعل في الاختبار 3 أضعاف و1,900 صورة. إطلاق فوري في كل الفروع بلا شروط إضافية.'},
    {n: 3, title: 'فيلم «قصة السيدة روث بيل» + كاونترات المكتبات', owner: 'جريس أوينز وفريق المحتوى', desc: 'قصة عميلة حقيقية مؤثرة، باسمها وصورها من فعالية الفرع، مع شراكة في 6 فروع داخل المولات.'},
    {n: 4, title: p4.title, owner: 'خطتك — من الأدلة التي جمعتها', desc: p4.desc},
  ];
}

export function showPlans(struck = []) {
  const el = $('plans');
  const match = {discount: 1, contest: 2, film: 3, third: 4}[S.brief && S.brief.idea];
  el.innerHTML = `<div class="plans-wrap"><h2>أربع خطط على الطاولة</h2><p class="sub">${struck.length ? 'اختر من الخطط المتبقية.' : 'اختر الخطة التي ستعرضها نادية باسم الفريق.'}</p>
    <div class="plan-grid">${planDefs().map(p => `<button class="plan ${struck.includes(p.n) ? 'struck' : ''}" data-n="${p.n}"><span class="pn">PLAN 0${p.n}${match === p.n ? ' · <span style="color:#2d7a4c">يطابق موجزك</span>' : ''}</span><b>${p.title}</b><span class="owner">${p.owner}</span><span class="desc">${p.desc}</span><span class="go">اختر هذه الخطة</span></button>`).join('')}</div></div>`;
  show('plans', true);
  return new Promise(res => el.querySelectorAll('.plan').forEach(b => b.onclick = () => { sfx.ui(); show('plans', false); res(+b.dataset.n); }));
}

export function tensionButtons() {
  const el = $('tension');
  el.innerHTML = `<div class="tbtns"><button class="cont">أكمل بهذه الخطة</button><button class="rev">راجع الخطة — اختر من الخطط المتبقية</button></div>`;
  show('tension', true);
  return new Promise(res => { el.querySelector('.cont').onclick = () => { show('tension', false); res('continue'); }; el.querySelector('.rev').onclick = () => { show('tension', false); res('revise'); }; });
}

// ---------- January result with market index chart ----------
const CARDS = {
  E1: {name: 'وعد تستطيع الفروع الوفاء به', color: '#2e8b57', text: 'زيارات شريحتك المستهدفة في عطلة الأسبوع ارتفعت 9%. انتظار الموبايل عاد قريبًا من 5 دقائق في الفروع المدعومة بعاملين. 3% فقط من منشورات المسابقة تذكر الانتظار. ترسل هنا صورة فريقها عند رف الاستلام: «هذا العام كنا مستعدين».'},
  E2: {name: 'فكرة جيدة، وخطة ضعيفة', color: '#b8892f', text: 'أعجبت الحملة الناس، وزادت زيارات عطلة الأسبوع قليلًا. لكن لم يستطع أحد أن يقول لماذا بالضبط، وبقي انتظار الصباح طويلًا. في المرة القادمة قرّر كيف ستقيس قبل أن تطلق.'},
  E3: {name: 'ديسمبر المزدحم الفارغ', color: '#b13a2a', text: 'مبيعات ديسمبر +7%. أفضل شهر منذ سنوات. وفي يناير نزلت المبيعات تحت مستوى العام الماضي: تعلّم العملاء انتظار الخصم، أو تذكروا الانتظار عند الكاونتر.'},
  E4: {name: 'القصة التي لم يُسأل صاحبها', color: '#7a2a4a', text: 'نُشر الفيلم يوم الاثنين. ويوم الثلاثاء كتبت ابنة السيدة بيل تحت المنشور: «لم يسأل أحد أمي». حُذف المنشور. والقصة التي يتذكرها الناس ليست القصة التي حكيناها.'},
};
// weekly regional performance index (fictional simulation), Nov → Jan
const SERIES = {
  E1: [100, 100.4, 101.0, 101.6, 102.5, 103.4, 104.1, 105.0, 105.6, 106.4, 107.1, 107.9, 108.6],
  E2: [100, 100.3, 100.9, 101.4, 101.9, 102.2, 102.1, 102.4, 102.2, 102.0, 102.3, 102.1, 102.2],
  E3: [100, 101.5, 103.6, 105.4, 106.8, 107.2, 105.0, 101.8, 98.4, 96.9, 95.6, 95.1, 94.6],
  E4: [100, 100.6, 101.2, 101.0, 97.8, 95.4, 94.6, 94.1, 94.9, 95.2, 95.0, 95.3, 95.1],
};
const WEEKS = ['نوفمبر', '', '', '', 'ديسمبر', '', '', '', 'يناير', '', '', '', ''];

export function showResult(ending, {extra = '', practice = false, plan = 0} = {}) {
  const c = CARDS[ending];
  const el = $('result');
  const up = ending === 'E1' || ending === 'E2';
  const extraLines = (ending === 'E3' && plan === 1 ? '<p>وتكلفة الخصم استهلكت معظم الميزانية.</p>' : '') + (plan === 2 ? '<p>بعض أكثر الصور مشاركة استخدمت الوسم للشكوى من الانتظار.</p>' : '') + extra;
  el.innerHTML = `<div class="mkt"><div class="mkt-head"><b>مؤشر أداء السوق الإقليمي</b><span class="sim">محاكاة تعليمية · بيانات خيالية</span></div>
      <div class="mkt-val ${up ? 'up' : 'down'}" id="mval">100.0</div><canvas id="mchart" width="900" height="420"></canvas>
      <div class="ticker"><span>${tickerText(ending)}</span></div></div>
    <div class="jan"><span class="ending" style="background:${c.color}">BUS3-${ending}</span><div class="jl">بطاقة «يناير»</div><h2>${c.name}</h2><p>${c.text}</p>${extraLines}
      <div class="actions">${practice && ending !== 'E1' ? '<button id="rmeet">أعد من بداية الاجتماع</button>' : ''}<button id="todeb">المراجعة الختامية</button></div></div>`;
  show('result', true);
  animateChart(SERIES[ending]);
  return new Promise(res => {
    el.querySelector('#todeb').onclick = () => { show('result', false); res('debrief'); };
    const r = el.querySelector('#rmeet'); if (r) r.onclick = () => { show('result', false); res('retry'); };
  });
}
function tickerText(e) {
  const t = {E1: 'زيارات عطلة الأسبوع ▲ 9% · انتظار الموبايل ▼ قرب 5 دقائق · شكاوى المسابقة 3% · الفروع الثمانية المدعومة تعمل بكامل طاقتها',
    E2: 'زيارات عطلة الأسبوع ▲ قليلًا · انتظار الصباح ما زال طويلًا · لا مقياس واضح للنجاح',
    E3: 'ديسمبر ▲ 7% · يناير ▼ تحت مستوى العام الماضي · العملاء ينتظرون الخصم · الميزانية مستنزفة',
    E4: 'حذف منشور الفيلم بعد تعليق ابنة السيدة بيل · الثقة في العلامة ▼ · موجة تعليقات سلبية'}[e];
  return t + ' &nbsp;&nbsp;&nbsp; ' + t;
}
function animateChart(series) {
  const cv = $('mchart'), g = cv.getContext('2d'), W = cv.width, H = cv.height;
  const min = 92, max = 110; const X = (i) => 50 + i * (W - 80) / (series.length - 1), Y = (v) => H - 40 - (v - min) / (max - min) * (H - 70);
  const t0 = performance.now(), dur = 6500;
  const up = series[series.length - 1] >= 100;
  const frame = () => {
    const k = Math.min(1, (performance.now() - t0) / dur);
    g.clearRect(0, 0, W, H);
    g.strokeStyle = '#13212a'; g.lineWidth = 1; g.font = '13px Inter'; g.fillStyle = '#5d7480';
    for (let v = min; v <= max; v += 2) { g.beginPath(); g.moveTo(40, Y(v)); g.lineTo(W - 20, Y(v)); g.stroke(); g.fillText(v, 6, Y(v) + 4); }
    g.strokeStyle = '#2a3f4a'; g.setLineDash([5, 5]); g.beginPath(); g.moveTo(40, Y(100)); g.lineTo(W - 20, Y(100)); g.stroke(); g.setLineDash([]);
    g.font = '14px "IBM Plex Sans Arabic"'; WEEKS.forEach((w, i) => { if (w) g.fillText(w, X(i) - 16, H - 12); });
    const n = k * (series.length - 1); const last = Math.floor(n), fr = n - last;
    const pts = series.slice(0, last + 1).map((v, i) => [X(i), Y(v)]);
    if (last < series.length - 1) pts.push([X(last + fr), Y(series[last] + (series[last + 1] - series[last]) * fr)]);
    const grad = g.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, up ? 'rgba(61,220,132,.35)' : 'rgba(255,77,77,.35)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.lineTo(pts[pts.length - 1][0], H - 40); g.lineTo(pts[0][0], H - 40); g.closePath(); g.fillStyle = grad; g.fill();
    // colour by slope: green up, red down
    for (let i = 1; i < pts.length; i++) { g.strokeStyle = pts[i][1] <= pts[i - 1][1] ? '#3ddc84' : '#ff4d4d'; g.lineWidth = 3; g.beginPath(); g.moveTo(...pts[i - 1]); g.lineTo(...pts[i]); g.stroke(); }
    const cur = pts[pts.length - 1]; g.fillStyle = '#fff'; g.beginPath(); g.arc(cur[0], cur[1], 5, 0, 7); g.fill();
    const val = min + (H - 40 - cur[1]) / (H - 70) * (max - min);
    const mv = $('mval'); if (mv) { mv.textContent = val.toFixed(1); mv.className = 'mkt-val ' + (val >= 100 ? 'up' : 'down'); }
    if (k < 1) requestAnimationFrame(frame);
  };
  frame();
}

// ---------- debrief (section 6) ----------
export function showDebrief(ending, onRestart) {
  const chain = [
    {h: 'العميل', v: SEGNAME[S.segment], ok: ['A', 'B', 'C', 'D'].includes(S.segment)},
    {h: 'الرؤية', v: {strong: 'قوية: حاجة حقيقية من البيانات', weak: 'ضعيفة', none: '—'}[S.insight], ok: S.insight === 'strong'},
    {h: 'الملاءمة للعلامة', v: S.price_led ? 'قائمة على السعر' : S.consent === 'missing' ? 'قصة بلا موافقة' : 'متسقة مع التموضع الراقي', ok: !S.price_led && S.consent !== 'missing'},
    {h: 'التشغيل', v: S.ops_checked ? 'تحقق من الطاقة وخطط للحل (باريستا 7–9 + رف استلام)' : 'لم يتحقق من الفروع', ok: S.ops_checked},
    {h: 'المقياس', v: {business: 'مقاييس أعمال', vanity: 'الإعجابات فقط', none: 'بلا مقياس'}[S.measure], ok: S.measure === 'business'},
  ];
  const fb = [];
  if (S.nodes.N01 === 'all' || S.segment === 'everyone') fb.push('رسالة للجميع لا يسمعها أحد. أي نصف من زياراتك يريد شيئًا تستطيع أن تقدّمه بشكل أفضل؟');
  if (S.nodes.N02 === 'accept' || S.plansTried.includes(1)) fb.push('انظر إلى كتيّب الدليل، الصفحة 2، وإلى ميزانيتك. يمكن أن يكون الخصم تكتيكًا. هنا صار الاستراتيجية كلها، وخاطب عملاء لم تخترهم.');
  if (S.nodes.N04 === 'all' || S.plansTried.includes(2)) fb.push('أربعة عشر بالمئة من صور اختبارك كانت تقول لك شيئًا. الحملة تجلب العملاء إلى الكاونتر. وما يحدث عند هذا الكاونتر جزء من الحملة.');
  if (S.nodes.N05 === 'keep' || S.plansTried.includes(3)) fb.push('قصتها جميلة لأنها قصتها. ولهذا بالضبط تحتاج إذنها.');
  const lvl = (good, mid) => good ? 0 : mid ? 1 : 2;
  const rubric = [
    ['فهم العميل', ['شريحة واحدة من البيانات، ورؤية واضحة', 'شريحة بلا رؤية قوية', '«للجميع»، أو رأي فقط'], lvl(['A', 'B', 'C', 'D'].includes(S.segment) && S.insight === 'strong', ['A', 'B', 'C', 'D'].includes(S.segment))],
    ['الملاءمة للعلامة', ['متسقة مع التموضع الراقي والقيم؛ بلا خطة قائمة على السعر', 'متسقة غالبًا، مع تعارض واحد', 'قائمة على السعر، أو نبرة لا تشبه العلامة'], lvl(!S.price_led && S.nodes.N02 !== 'accept', S.nodes.N02 === 'accept' && !S.price_led)],
    ['الواقعية التشغيلية', ['تحقق من الطاقة الاستيعابية وخطط للحل', 'لاحظ المشكلة بلا خطة', 'تجاهل الفروع'], lvl(S.ops_checked, S.ev.M3 || S.ev.M7)],
    ['القياس', ['مقاييس أعمال مرتبطة بالهدف', 'مقاييس تفاعل فقط', 'بلا مقاييس'], lvl(S.measure === 'business', S.measure === 'vanity')],
    ['الأخلاقيات والمخاطر', ['الموافقة والإشراف مخطط لهما؛ والمخاطر مسمّاة', 'فاته خطر واحد', 'استخدم قصة إنسان دون موافقته'], lvl(S.risk && S.consent !== 'missing' && S.moderation !== 'none' || S.risk && S.consent !== 'missing' && S.nodes.N04 !== 'all', S.consent !== 'missing')],
  ];
  const evGot = Object.keys(EVIDENCE).filter(k => S.ev[k]);
  const el = $('debrief');
  el.innerHTML = `<div class="db-wrap"><h1>المراجعة الختامية</h1><div class="db-sub">النهاية: BUS3-${ending} · المحاولات في الاجتماع: ${S.plansTried.length} · الأدلة: ${evGot.length}/10 · الوضع: ${S.mode === 'practice' ? 'تدريب' : 'تقييم'}</div>
    <div class="db-sec"><h3>سلسلة الاستراتيجية</h3><div class="chain">${chain.map(c => `<div class="cbox ${c.ok ? '' : 'broken'}"><h4>${c.h}</h4>${c.v}</div>`).join('')}</div>
      <p style="color:var(--mute);margin:0">الروابط المكسورة بالأحمر. الحملة يمكن أن تكون مثيرة وتفشل إذا انكسر أحد هذه الأجزاء.</p></div>
    ${fb.length ? `<div class="db-sec"><h3>تغذية راجعة على قراراتك</h3>${fb.map(f => `<div class="fbq">${f}</div>`).join('')}</div>` : ''}
    <div class="db-sec"><h3>مقياس تقدير مختصر (للمحاضر)</h3><table><tr><th>المحور</th><th>متمكّن</th><th>في الطريق</th><th>يحتاج دعمًا</th></tr>
      ${rubric.map(([a, cells, i]) => `<tr><td><b>${a}</b></td>${cells.map((c, k) => `<td class="${k === i ? 'me' : ''}">${c}</td>`).join('')}</tr>`).join('')}</table></div>
    <div class="db-sec"><h3>العلامة الحقيقية — من مقال الحالة (MarcomCentral، مصدر ثانوي)</h3>
      <p><b>من أين جاءت العلامة:</b> فُتح الفرع الأول في سوق Pike Place في سياتل عام 1971، وانتقل الشعار من حورية بحر بنية إلى شعار أخضر بحورية البحر وحدها في 2011. <i>(للنقاش: لماذا تستطيع علامة أن تحذف اسمها من شعارها؟)</i></p>
      <p><b>ما الذي غيّرته في الصناعة:</b> نقل القهوة المتخصصة إلى السوق الواسعة، ونشر فكرة «المكان الثالث»، وجعل التخصيص أمرًا عاديًا، إلى جانب التوريد الأخلاقي عبر ممارسات C.A.F.E.</p>
      <p><b>من تستهدف:</b> شريحة أساسية من 18 إلى 40 عامًا، وشريحة ثانوية من 40 إلى 60، ومناطق حضرية وضواحٍ ميسورة، والباحثون عن السهولة عبر الدرايف ثرو وطلب الموبايل، والعائلات.</p>
      <p><b>الحملات والشراكات:</b> مسابقة الكوب الأحمر، و«قابلني في ستاربكس» (2014)، و#WhatsYourName (2020)، والشراكات مع PepsiCo (1994) وApple وBarnes &amp; Noble.</p>
      <p><b>ما لا يُظهره المقال:</b> لا يقدّم تقريبًا أي نتائج مقيسة للحملات، ولا يناقش التحديات. أي ادعاءات المقال تريد التحقق منها، وكيف؟</p></div>
    <div class="db-sec"><h3>أسئلة للنقاش في القاعة</h3><ol>
      <li>فكرة «المكان الثالث» تقول إن فرع القهوة مكان بين البيت والعمل. وطلب الموبايل والدرايف ثرو يقولان «ادخل واخرج بسرعة». هل تستطيع علامة واحدة أن تعد بالاثنين؟</li>
      <li>مسابقة الكوب الأحمر تركت العملاء يصنعون الحملة. ماذا تكسب العلامة، وعلى ماذا تفقد السيطرة؟ ما القواعد التي ستضعها؟</li>
      <li>لو كنت مدير العلامة، ما الأرقام الثلاثة التي ستطلبها قبل أن تسمّي حملة ناجحة؟</li>
      <li>من منظور الإدارة العامة: خدمة عامة (مكتبة، مترو، مركز صحي) تريد حملة «مكان ثالث». من المستهدف، وما الرؤية، وماذا يجب أن يقدّم التشغيل قبل أن تبدأ الحملة؟</li></ol></div>
    <div class="db-sec"><h3>الأدلة التي جمعتها</h3><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${Object.entries(EVIDENCE).map(([id, e]) => `<div class="ev ${S.ev[id] ? '' : 'locked'}"><span class="cat ${e.cat}">${CAT[e.cat]}</span><b>${id}</b> ${e.t}</div>`).join('')}</div></div>
    <p style="color:var(--mute);font-size:.85rem">كل أرقام السوق والبحث والفروع والميزانية والأسماء والحوار خيالية ومختارة للتعليم. كتيّب الدليل نسخة إقليمية خيالية. لا يُستخدم الشعار الحقيقي ولا إعلانات حقيقية ولا صور عملاء حقيقيين.</p>
    <div class="db-actions"><button class="primary" id="dbrestart">العب مرة أخرى</button><button class="ghost" id="dblog">تنزيل سجل اللعب (JSON)</button></div></div>`;
  show('debrief', true);
  el.querySelector('#dbrestart').onclick = onRestart;
  el.querySelector('#dblog').onclick = () => { const b = new Blob([JSON.stringify({situation: 'SYRA-EDU-BUS-03', ending, state: S}, null, 1)], {type: 'application/json'}); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'BUS3_playlog.json'; a.click(); };
}
