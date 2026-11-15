// QA (in page): sample every baked clip on the player's skeleton and report frames that look like the bind pose
// (both hands out at shoulder height) or a strong lean. Restores the player's own pose afterwards.
(async () => {
  const T = window.__THREE, a = await import('/js/core/assets.js'), ch = window.__C.player, root = ch.fbx;
  const lib = a.decodeAnims(await a.bin('assets/baked/anims_m.bin'));
  const sk = ch.mesh.skeleton, B = (n) => sk.getBoneByName(n);
  const pel = B('Bip01_Pelvis'), head = B('Bip01_Head'), LH = B('Bip01_L_Hand'), RH = B('Bip01_R_Hand'), LU = B('Bip01_L_UpperArm'), RU = B('Bip01_R_UpperArm');
  const v = () => new T.Vector3(), p = v(), h = v(), l = v(), r = v(), lu = v(), ru = v();
  const m2 = new T.AnimationMixer(root), out = {};
  const inv = new T.Matrix4();
  for (const [name, clip] of Object.entries(lib)) {
    const act = m2.clipAction(clip); act.play();
    const bad = [];
    for (let k = 0; k <= 40; k++) {
      act.time = clip.duration * k / 40; m2.update(0); root.updateMatrixWorld(true);
      inv.copy(ch.holder.matrixWorld).invert();
      for (const [bn, vv] of [[pel, p], [head, h], [LH, l], [RH, r], [LU, lu], [RU, ru]]) bn.getWorldPosition(vv).applyMatrix4(inv);
      const outL = Math.hypot(l.x - p.x, l.z - p.z), outR = Math.hypot(r.x - p.x, r.z - p.z);
      const tpose = outL > 0.55 && outR > 0.55 && l.y > lu.y - 0.2 && r.y > ru.y - 0.2;
      const lean = Math.hypot(h.x - p.x, h.z - p.z) / Math.max(0.1, h.y - p.y);
      if (tpose || lean > 0.5) bad.push(`${(act.time).toFixed(2)}s${tpose ? ' T' : ''}${lean > 0.5 ? ' lean' + lean.toFixed(2) : ''}`);
    }
    act.stop(); m2.uncacheAction(clip);
    if (bad.length) out[name] = `dur ${clip.duration.toFixed(2)}: ` + bad.slice(0, 6).join(', ') + (bad.length > 6 ? ` …(${bad.length})` : '');
  }
  m2.uncacheRoot(root); ch.mixer.update(0);
  return JSON.stringify(out);
})()
