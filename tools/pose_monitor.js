// QA (run inside the game page): watch every visible character's pose and log the moments it breaks.
// Checks every 100 ms: total weight of the playing animations (< 0.95 → the rest is the T-pose), how far the head
// leans away from above the pelvis, and how far the hands are from the hips (arms flung out).
(() => {
  if (window.__poseLog) return 'already';
  const log = window.__poseLog = [], V = () => new window.__THREE.Vector3();
  const a = V(), b = V(), c = V(), d = V();
  const t0 = performance.now();
  // keep the last animation commands of every character, to see what led to a broken pose
  for (const ch of Object.values(window.__C || {})) {
    if (ch._playLog) continue; ch._playLog = [];
    for (const fn of ['play', 'gesture', 'setBase']) { const orig = ch[fn].bind(ch); ch[fn] = (...args) => { ch._playLog.push(`${((performance.now() - t0) / 1000).toFixed(1)} ${fn}(${args[0]}${args[1] ? ',' + JSON.stringify(args[1]) : ''}) cur=${ch.curName} ` + (new Error().stack.split('\n')[2] || '').trim().replace(/^at /, '').replace(/https?:\/\/[^/]+\//, '').slice(0, 70)); if (ch._playLog.length > 14) ch._playLog.shift(); return orig(...args); }; }
    const ostop = ch.mixer.stopAllAction.bind(ch.mixer); ch.mixer.stopAllAction = () => { ch._playLog.push('stopAllAction'); return ostop(); };
  }
  setInterval(() => {
    for (const [id, ch] of Object.entries(window.__C || {})) {
      if (!ch.holder.visible || !ch.mixer || !ch.bones || !ch.bones.pelvis) continue;
      const acts = ch.mixer._actions.filter(x => x.isScheduled());          // actually being mixed (a stopped action can still say enabled/weight 1)
      const w = acts.reduce((s, x) => s + (x.enabled ? x.getEffectiveWeight() : 0), 0);
      ch.bones.pelvis.getWorldPosition(a); ch.bones.head.getWorldPosition(b);
      const lean = Math.hypot(b.x - a.x, b.z - a.z) / Math.max(0.1, b.y - a.y);   // 0 = upright
      const sk = ch.mesh.skeleton, L = sk.getBoneByName('Bip01_L_Hand'), R = sk.getBoneByName('Bip01_R_Hand');
      L.getWorldPosition(c); R.getWorldPosition(d);
      const spread = Math.max(Math.hypot(c.x - a.x, c.z - a.z), Math.hypot(d.x - a.x, d.z - a.z));   // hand away from the hips (m)
      const bad = w < 0.95 || lean > 0.45 || (spread > 0.75 && !ch.seated);
      if (bad) log.push({t: +((performance.now() - t0) / 1000).toFixed(1), id, w: +w.toFixed(2), lean: +lean.toFixed(2), spread: +spread.toFixed(2),
        cur: ch.curName, base: ch.baseName, seated: !!ch.seated, walking: !!ch.walking, voice: !!ch.voice, mode: id === 'player' || ch === (window.__player || {}).ch ? window.__player.mode : '',
        acts: acts.map(x => `${x.getClip().name}:${x.getEffectiveWeight().toFixed(2)}${x.isRunning() ? '' : '(paused)'}`).join(' '), scene: window.__S && window.__S.scene, hist: (ch._playLog || []).slice(-8)});
    }
  }, 100);
  window.__poseSummary = () => {
    const by = {};
    for (const e of log) { const k = e.id + ' | ' + e.cur + ' | ' + (e.w < 0.95 ? 'weight' : e.lean > 0.45 ? 'lean' : 'arms'); (by[k] ||= {n: 0, first: e.t, last: e.t, ex: e}).n++; by[k].last = e.t; }
    return JSON.stringify(Object.entries(by).map(([k, v]) => ({k, n: v.n, first: v.first, last: v.last, ex: v.ex})), null, 0);
  };
  return 'on';
})()
