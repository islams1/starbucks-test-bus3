// The readable copies (Concept A §4–5): the capacity ledger at the top of every shot, the proposal card (paper, at the
// side), the retailer note's readable copy with its two stamps, the Table list (L: every prop and action as buttons),
// the paper receipt, the pitch form on the right of the review table, the coaching card and the final card.
import {$, show} from '../ui/ui.js';
import {P, IDS, ROW, CAP, EN, tr, nm, full, T, units, unitsMore, check, refusalText, used, free, tradeoff, missing, CONDS, condText, coaching} from './alloc.js';
import {S} from './state.js';
import {TBL, fund, giveBack, setFirst, swapOrder, placeNeed, stampNote, clipCard, refresh} from './table.js';
import {sfx} from '../core/audio.js';

const esc = (s) => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
export const CB = {};          // callbacks set by the flow: open(id), closeCard(), readNote(), confirm(), toReview(), backToTable(), commit(), ...

// ---------------------------------------------------------------- the capacity ledger (top) and the announcements
export function drawTopLedger() {
  const el = $('ledger'); if (!el) return;
  const u = used(S.a.funded);
  $('lgused').textContent = EN ? `Used ${u} of 8` : `مستخدم ${u} من 8`;
  $('lgfree').textContent = EN ? `Free ${8 - u}` : `حرّ ${8 - u}`;
  const segs = []; for (const id of S.a.funded) for (let j = 0; j < P[id].cost; j++) segs.push(`<i style="background:${P[id].col}" title="${esc(nm(id))}"></i>`);
  while (segs.length < CAP) segs.push('<i class="free"></i>');
  $('lgseg').innerHTML = segs.join('');
  $('lgitems').innerHTML = S.a.funded.length ? S.a.funded.map(id => `<span><b style="background:${P[id].col}"></b>${esc(nm(id))} (${P[id].cost})</span>`).join('') : `<span class="none">${tr('لا شيء مموّل بعد', 'Nothing funded yet')}</span>`;
  const r = TBL.refusal; $('lgref').textContent = r || ''; $('lgref').classList.toggle('on', !!r);
}
let annT = 0;
export function announce(t) {
  const el = $('lgline'); if (!el || !t) return;
  el.textContent = t; el.classList.add('on'); clearTimeout(annT); annT = setTimeout(() => el.classList.remove('on'), 6500);
}

// ---------------------------------------------------------------- the proposal card
let cardId = null;
export function openCard(id, {line = null} = {}) {
  cardId = id; const p = P[id], el = $('pcard');
  el.style.setProperty('--pc', p.col);
  el.innerHTML = `<div class="pc-paper" role="dialog" aria-label="${esc(full(id))}">
    <div class="pc-head"><div class="pc-cost"><b>${p.cost}</b><small>${tr('وحدات', 'units')}</small></div><div><h2>${esc(full(id))}</h2><p class="pc-model">${esc(T(p.model))}</p></div></div>
    <dl>
      <dt>${tr('الدليل', 'Evidence')}</dt><dd>${esc(T(p.evidence))}</dd>
      <dt>${tr('ما يغيّره التمويل', 'What funding changes')}</dt><dd>${esc(T(p.funded))}</dd>
      <dt>${tr('إذا انتظر', 'If it waits')}</dt><dd>${esc(T(p.waits))}</dd>
      ${line ? `<dt>${tr('كلمات صاحبه', 'Its champion')}</dt><dd class="quote">«${esc(line)}»</dd>` : ''}
    </dl>
    <div class="pc-live" id="pclive"></div>
    <div class="pc-btns"><button class="primary" id="pcfund"></button><button class="ghost" id="pcclose">${tr('إغلاق', 'Close')}</button></div>
  </div>`;
  $('pcclose').onclick = () => closeCard();
  $('pcfund').onclick = () => { if (!TBL.allow.fund) return; const f = S.a.funded.includes(id); closeCard(); f ? giveBack(id) : fund(id); };
  liveCard();
  show('pcard', true);
  setTimeout(() => $('pcclose').focus(), 50);
}
export function liveCard() {
  if (!cardId || $('pcard').classList.contains('hidden') && !$('pcard').innerHTML) return;
  const id = cardId, live = $('pclive'), btn = $('pcfund'); if (!live) return;
  const f = S.a.funded.includes(id), c = check(S.a.funded, id);
  live.className = 'pc-live ' + (f ? 'funded' : c.ok ? 'fits' : 'no');
  live.textContent = f ? tr(`مموّل · مستخدم ${used(S.a.funded)} من 8`, `Funded · used ${used(S.a.funded)} of 8`)
    : c.ok ? (EN ? `It fits: ${free(S.a.funded)} of 8 free` : `يتّسع: ${free(S.a.funded)} من 8 حرّة`) : refusalText(c);
  btn.textContent = f ? tr('أعِد الوحدات', 'Return') : tr('موّل', 'Fund');
  btn.disabled = !TBL.allow.fund;
  btn.title = TBL.allow.fund ? '' : tr('التمويل يبدأ بعد فتح المقترحات الأربعة ووسم التقرير', 'Funding starts after all four are opened and the note is tagged');
}
export function closeCard() { if (!cardId) return; cardId = null; show('pcard', false); CB.closeCard && CB.closeCard(); }
export const cardOpen = () => !$('pcard').classList.contains('hidden');

// ---------------------------------------------------------------- the retailer note's readable copy
export function openNote() {
  const el = $('notecard');
  const msg = S.tag === 'untested' ? `<div class="nc-msg bad">${tr('هذا التقرير عن تشكيلة قائمة يشتريها العملاء الآن، لا عن فكرة غير مُختبَرة. وسمها الصحيح «طلب عملاء حالي». صحّحه بالختم الآخر.', "This note concerns an existing range that customers buy now, not an untested idea. Its right label is “Current customer demand”. Correct it with the other stamp.")}</div>`
    : S.tag === 'current' ? `<div class="nc-msg ok">${tr('موسوم: «طلب عملاء حالي».', 'Tagged: "Current customer demand".')}</div>` : '';
  el.innerHTML = `<div class="nc-paper" role="dialog" aria-label="${tr('تقرير التاجر', 'Retailer report')}">
    <div class="nc-head"><b>${tr('تقرير التاجر · المخزون والطلب', 'Retailer report · Stock and demand')}</b><span class="illus">${tr('تقرير توضيحي', 'Illustrative report')}</span></div>
    <p>${tr('يُباع الخط الأساسي بثبات، وطلبات إعادة الشراء متكررة. في 11 من 40 فحصًا للرف كان الرف فارغًا. يسأل العملاء الموظفين عنه بالاسم.', 'The core line sells steadily and reorders are frequent. In 11 of 40 shelf checks the shelf was empty. Customers ask staff for it by name.')}</p>
    <p><b>${tr('الطلب: توريد منتظم لهذا الخط.', 'Request: regular delivery of this line.')}</b></p>
    ${S.tag ? `<div class="nc-frame ${S.tag}">${S.tag === 'current' ? tr('طلب عملاء حالي', 'Current customer demand') : tr('طلب غير مُختبَر', 'Untested demand')}</div>` : ''}
    ${msg}
    <div class="nc-q">${tr('ما وسم هذا التقرير؟ اختر ختمًا:', 'How would you tag this note? Pick a stamp:')}</div>
    <div class="nc-btns"><button class="stampbtn current" data-k="current">${tr('ختم: طلب عملاء حالي', 'Stamp: Current customer demand')}</button><button class="stampbtn untested" data-k="untested">${tr('ختم: طلب غير مُختبَر', 'Stamp: Untested demand')}</button></div>
    <div class="pc-btns"><button class="ghost" id="ncclose">${tr('إغلاق', 'Close')}</button></div></div>`;
  el.querySelectorAll('.stampbtn').forEach(b => { b.disabled = !TBL.allow.stamp || S.tag === 'current'; b.onclick = () => { show('notecard', false); stampNote(b.dataset.k); }; });
  $('ncclose').onclick = () => { show('notecard', false); CB.closeNote && CB.closeNote(); };
  show('notecard', true);
  setTimeout(() => $('ncclose').focus(), 50);
}

// ---------------------------------------------------------------- the Table list (L)
export function toggleList(on = $('list').classList.contains('hidden')) {
  if (!on) { show('list', false); return; }
  drawList(); show('list', true); setTimeout(() => { const b = $('list').querySelector('button:not(:disabled)'); b && b.focus(); }, 30);
}
export function drawList() {
  const el = $('list'); if (!el) return;
  const a = S.a, rows = ROW.slice().sort((x, y) => IDS.indexOf(x) - IDS.indexOf(y)).map(id => {
    const f = a.funded.includes(id), c = check(a.funded, id);
    return `<div class="li-row" style="--pc:${P[id].col}"><div class="li-name"><b>${esc(full(id))}</b><small>${units(P[id].cost)} · ${S.opened[id] ? (f ? tr('مموّل', 'funded') : tr('مفتوح', 'opened')) : tr('لم يُفتح', 'not opened')}</small>
      ${!f && !c.ok && TBL.allow.fund ? `<small class="no">${esc(refusalText(c))}</small>` : ''}</div>
      <div class="li-btns"><button data-a="open" data-id="${id}" ${TBL.allow.open || S.opened[id] ? '' : 'disabled'}>${tr('افتح', 'Open')}</button>
      <button data-a="${f ? 'ret' : 'fund'}" data-id="${id}" ${TBL.allow.fund ? '' : 'disabled'}>${f ? tr('أعِد', 'Return') : tr('موّل', 'Fund')}</button></div></div>`;
  }).join('');
  const order = a.funded.length === 2 ? `<div class="li-sec"><b>${tr('الترتيب', 'Order')}</b>
      <div class="li-order">${a.funded.map(id => `<button data-a="first" data-id="${id}" ${TBL.allow.order ? '' : 'disabled'} class="${a.first === id ? 'on' : ''}">${tr('اجعل «', 'Make “')}${esc(nm(id))}${tr('» الأول', '” first')}</button>`).join('')}
      <button data-a="swap" ${TBL.allow.order && a.first ? '' : 'disabled'}>⇄ ${tr('بدّل الترتيب', 'Swap the order')}</button></div></div>` : a.funded.length === 1 ? `<div class="li-sec"><b>${tr('الترتيب', 'Order')}</b><p>${tr(`«${esc(nm(a.funded[0]))}» هو الأول (مقترح واحد).`, `“${esc(nm(a.funded[0]))}” is First (one proposal).`)}</p></div>` : '';
  const need = `<div class="li-sec"><b>${tr('الحاجة المنتظرة', 'The waiting need')}</b><div class="li-need" role="radiogroup">${IDS.map(id => `<label class="${a.funded.includes(id) ? 'dim' : ''}"><input type="radio" name="need" value="${id}" ${a.need === id ? 'checked' : ''} ${TBL.allow.need && !a.funded.includes(id) ? '' : 'disabled'}><i style="background:${P[id].col}"></i>${esc(T(P[id].need))}</label>`).join('')}</div></div>`;
  const note = `<div class="li-sec"><b>${tr('تقرير التاجر', 'Retailer note')}</b><div class="li-btns"><button data-a="note" ${TBL.allow.note ? '' : 'disabled'}>${tr('اقرأ التقرير', 'Read the note')}</button>
      <button data-a="stamp" data-k="current" ${TBL.allow.stamp && S.tag !== 'current' ? '' : 'disabled'}>${tr('ختم: طلب عملاء حالي', 'Stamp: Current customer demand')}</button><button data-a="stamp" data-k="untested" ${TBL.allow.stamp && S.tag !== 'current' ? '' : 'disabled'}>${tr('ختم: طلب غير مُختبَر', 'Stamp: Untested demand')}</button></div></div>`;
  const miss = missing(a), conf = TBL.allow.fund ? `<div class="li-sec li-conf">${miss.length ? `<ul class="li-miss">${miss.map(m => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}<button class="primary" data-a="confirm" ${miss.length || !allOpened() ? 'disabled' : ''}>${tr('أكّد التوزيع ←', 'Confirm the allocation →')}</button></div>` : '';
  el.innerHTML = `<div class="li-in" role="dialog" aria-label="${tr('قائمة الطاولة', 'Table list')}"><div class="li-head"><b>${tr('قائمة الطاولة', 'Table list')}</b><span>${EN ? `Used ${used(a.funded)} of 8 · Free ${free(a.funded)}` : `مستخدم ${used(a.funded)} من 8 · حرّ ${free(a.funded)}`}</span><button class="ghost" data-a="close" aria-label="${tr('إغلاق', 'Close')}">✕</button></div>${rows}${order}${TBL.allow.need ? need : ''}${TBL.allow.fund ? '' : note}${conf}</div>`;
  el.querySelectorAll('button[data-a]').forEach(b => b.onclick = () => {
    const id = b.dataset.id, A = b.dataset.a;
    if (A === 'close') return toggleList(false);
    if (A === 'open') { toggleList(false); CB.open && CB.open(id); }
    else if (A === 'fund') { fund(id); setTimeout(drawList, 50); }
    else if (A === 'ret') { giveBack(id); setTimeout(drawList, 50); }
    else if (A === 'first') setFirst(id);
    else if (A === 'swap') swapOrder();
    else if (A === 'note') { toggleList(false); CB.readNote && CB.readNote(); }
    else if (A === 'stamp') { toggleList(false); stampNote(b.dataset.k); }
    else if (A === 'confirm') { toggleList(false); CB.confirm && CB.confirm(); }
    sfx.ui(); drawList();
  });
  el.querySelectorAll('input[name=need]').forEach(r => r.onchange = () => { placeNeed(r.value); drawList(); });
}
const allOpened = () => IDS.every(id => S.opened[id]);

// ---------------------------------------------------------------- the receipt
export function receiptHtml(a) {
  const fundedL = a.funded.map(id => `<li style="--pc:${P[id].col}"><b>${esc(full(id))} (${P[id].cost})</b><span>${esc(T(P[id].funded))}</span></li>`).join('');
  const waitsL = IDS.filter(id => !a.funded.includes(id)).map(id => `<li class="w"><b>${esc(full(id))} (${P[id].cost})</b><span>${esc(T(P[id].waits))}</span></li>`).join('');
  const ord = a.funded.length > 1 ? `${tr('الأول', 'First')}: ${esc(nm(a.first))} · ${tr('التالي', 'Next')}: ${esc(nm(a.next))}` : `${tr('الأول', 'First')}: ${esc(nm(a.first))}`;
  return `<div class="rc-sec"><h3>${tr('يُنفَّذ (مموّل)', 'Done (funded)')}</h3><ul>${fundedL}</ul></div>
    <div class="rc-sec"><h3>${tr('ينتظر (مؤجَّل)', 'Waits (deferred)')}</h3><ul>${waitsL}</ul></div>
    <dl class="rc-dl"><dt>${tr('الترتيب', 'Order')}</dt><dd>${ord}</dd>
    <dt>${tr('الحاجة المنتظرة', 'The waiting need')}</dt><dd>${a.need ? esc(T(P[a.need].need)) : '—'}</dd>
    <dt>${tr('المفاضلة', 'Trade-off')}</dt><dd>${esc(tradeoff(a.funded))}</dd>
    <dt>${tr('القدرة', 'Capacity')}</dt><dd>${EN ? `Used ${used(a.funded)} of 8 · Free ${free(a.funded)}` : `مستخدم ${used(a.funded)} من 8 · حرّ ${free(a.funded)}`}</dd></dl>`;
}
export function showReceipt() {
  const el = $('receipt');
  el.innerHTML = `<div class="rc-paper" role="dialog" aria-label="${tr('إيصال التوزيع', 'Allocation receipt')}"><div class="rc-head"><b>${tr('إيصال التوزيع', 'Allocation receipt')}</b><span class="illus">${tr('ركن للألعاب · هذه الدورة', 'Rukn Toys · this cycle')}</span></div>
    ${receiptHtml(S.a)}
    <div class="pc-btns"><button class="ghost" id="rcback">${tr('ارجع وغيّره', 'Go back and change it')}</button><button class="primary" id="rcgo">${tr('إلى طاولة المراجعة ←', 'To the review table →')}</button></div></div>`;
  show('receipt', true);
  return new Promise(res => { $('rcback').onclick = () => { show('receipt', false); res('back'); }; $('rcgo').onclick = () => { show('receipt', false); res('go'); }; setTimeout(() => $('rcgo').focus(), 50); });
}

// ---------------------------------------------------------------- the pitch form (right of the review table)
export function drawPitch() {
  const el = $('pitch'); if (!el || el.classList.contains('hidden')) return;
  const a = S.a, two = a.funded.length > 1;
  const waits = IDS.filter(id => !a.funded.includes(id));
  el.innerHTML = `<div class="pf-in"><div class="pf-head"><b>${tr('ملخص التحوّل بقرارين', 'Two-decision turnaround brief')}</b>${S.committed && S.attempt > 0 ? `<span class="illus">${tr('محاولة تدريب', 'Practice attempt')}</span>` : ''}</div>
    <div class="pf-sec"><span class="pf-l">1 · ${tr('ما يبدأ أولًا', 'What starts first')}</span>
      <div class="pf-order"><div class="pf-slot" style="--pc:${a.first ? P[a.first].col : '#999'}"><small>${tr('الأول', 'First')}</small><b>${a.first ? esc(nm(a.first)) : '…'}</b></div>
      ${two ? `<button id="pfswap" class="ghost">⇄ ${tr('بدّل الترتيب', 'Swap the order')}</button><div class="pf-slot next" style="--pc:${a.next ? P[a.next].col : '#999'}"><small>${tr('التالي', 'Next')}</small><b>${a.next ? esc(nm(a.next)) : '…'}</b></div>` : `<div class="pf-one">${tr('مقترح واحد، فهو الأول.', 'One proposal, so it comes first.')}</div>`}</div></div>
    <div class="pf-sec"><span class="pf-l">2 · ${tr('ما الذي ينتظر؟', 'What waits?')}</span><div class="pf-need" role="radiogroup">${waits.map(id => `<label><input type="radio" name="pfneed" value="${id}" ${a.need === id ? 'checked' : ''}><i style="background:${P[id].col}"></i>${esc(T(P[id].need))} <small>(${esc(nm(id))})</small></label>`).join('')}</div></div>
    <div class="pf-sec"><span class="pf-l">${tr('شرط المراجعة — بجانب المقترح الأول', 'Review condition — beside the first proposal')}</span>
      ${(a.condReset || a.condRed) && !a.cond ? `<div class="pf-red">${tr('تغيّر المقترح الأول: اختر شرطًا جديدًا', 'The first proposal changed: pick a new condition')}</div>` : ''}
      <div class="pf-conds">${CONDS.map((c, i) => `<button class="pf-c ${a.cond === c.k ? 'on' : ''}" data-k="${c.k}"><kbd>${i + 1}</kbd><span>${esc(T(c.t))}</span></button>`).join('')}</div></div>
    ${missing(a, {forPitch: true}).length ? `<ul class="li-miss">${missing(a, {forPitch: true}).map(m => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}
    <div class="pc-btns"><button class="ghost" id="pfback">${tr('ارجع إلى طاولة العمل', 'Back to the worktable')}</button><button class="primary" id="pfcommit" ${missing(a, {forPitch: true}).length ? 'disabled' : ''}>${tr('اعتمد العرض', 'Commit the pitch')}</button></div></div>`;
  const sw = $('pfswap'); if (sw) sw.onclick = () => swapOrder();
  el.querySelectorAll('input[name=pfneed]').forEach(r => r.onchange = () => { S.a.need = r.value; CB.pitchChanged && CB.pitchChanged('need'); });
  el.querySelectorAll('.pf-c').forEach(b => b.onclick = () => clipCard(b.dataset.k));
  $('pfback').onclick = () => CB.backToTable && CB.backToTable();
  $('pfcommit').onclick = () => CB.commit && CB.commit();
}
addEventListener('keydown', (e) => {
  const el = $('pitch'); if (!el || el.classList.contains('hidden') || TBL.busy || !TBL.allow.cond || (e.target.closest && e.target.closest('input,textarea'))) return;
  const n = +e.key; if (n >= 1 && n <= 5) clipCard(CONDS[n - 1].k);
});

// ---------------------------------------------------------------- coaching (3 points + one risk)
export function coachHtml(p, {title = null} = {}) {
  const c = coaching(p);
  return `<div class="co-head"><b>${title || tr('ملاحظات على عرضك', 'Coaching on your pitch')}</b></div>
    <ul class="co-pts">${c.pts.map(x => `<li class="${x.ok ? 'ok' : 'no'}"><i aria-hidden="true">${x.ok ? '✓' : '○'}</i><div><b>${esc(x.t)}</b><span>${esc(x.why)}</span></div><span class="sr">${x.ok ? tr('متحقق', 'met') : tr('غير متحقق', 'not met')}</span></li>`).join('')}</ul>
    <div class="co-risk"><b>${tr('ملاحظة عن الخطر', 'A risk observation')}</b><p>${esc(c.risk)}</p></div>
    <p class="co-disc">${tr('هذه الملاحظات تساعدك على مقارنة الخطط؛ وليست درجة مقابل ما فعلته شركة حقيقية.', 'This feedback helps you compare plans; it is not a grade against what a real company did.')}</p>`;
}
export function showCoach(p, btn) {
  const el = $('coach');
  el.innerHTML = `<div class="co-in" role="dialog">${coachHtml(p)}<div class="pc-btns"><button class="primary" id="cogo">${btn}</button></div></div>`;
  show('coach', true);
  return new Promise(res => { $('cogo').onclick = () => { show('coach', false); res(); }; setTimeout(() => $('cogo').focus(), 50); });
}
/** a pitch as a short summary (the final card) */
export function pitchSummary(p) {
  return `<dl class="rc-dl"><dt>${tr('الأول', 'First')}</dt><dd>${esc(nm(p.first))}${p.next ? ` · ${tr('التالي', 'Next')}: ${esc(nm(p.next))}` : ''}</dd>
    <dt>${tr('مموّل', 'Funded')}</dt><dd>${p.funded.map(id => `${esc(nm(id))} (${P[id].cost})`).join(tr('، ', ', '))} · ${EN ? `${p.used} of 8` : `${p.used} من 8`}</dd>
    <dt>${tr('ينتظر', 'Waits')}</dt><dd>${IDS.filter(id => !p.funded.includes(id)).map(id => esc(nm(id))).join(tr('، ', ', '))}${p.need ? ` · ${tr('الحاجة المسمّاة', 'named need')}: ${esc(T(P[p.need].need))}` : ''}</dd>
    <dt>${tr('شرط المراجعة', 'Review condition')}</dt><dd>${esc(condText(p.cond))}</dd>
    <dt>${tr('المفاضلة', 'Trade-off')}</dt><dd>${esc(p.tradeoff)}</dd></dl>`;
}
