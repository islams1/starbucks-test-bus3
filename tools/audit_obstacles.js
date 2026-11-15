// QA (run inside the game page): find solid things at body height that have no collider, i.e. places where a person
// can walk into / stand inside an object. Renders a top-down slab of the scene (y 0.25–1.8 m, characters hidden),
// compares it with the collider boxes and returns the uncovered blobs; also draws a debug overlay (#auditc).
(async () => {
  const T = window.__THREE, sc = window.__scene, r = window.__renderer, cols = window.__cols;
  const X0 = -38, X1 = 40, Z0 = -32, Z1 = 58, RES = 0.1, W = Math.round((X1 - X0) / RES), H = Math.round((Z1 - Z0) / RES);
  const cam = new T.OrthographicCamera(X0, X1, -Z0, -Z1, 0, 1.55);
  cam.position.set(0, 1.8, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0);
  cam.left = X0; cam.right = X1; cam.top = -Z0; cam.bottom = -Z1; cam.updateProjectionMatrix(); cam.position.y = 1.8; cam.updateMatrixWorld();
  const hidden = [];
  sc.traverse(o => { if ((o.isSkinnedMesh || o.isSprite || o.isPoints || o.isLine) && o.visible) { hidden.push(o); o.visible = false; } });
  const rt = new T.WebGLRenderTarget(W, H);
  const om = sc.overrideMaterial, bg = sc.background, fog = sc.fog;
  sc.overrideMaterial = new T.MeshBasicMaterial({color: 0xffffff, side: T.DoubleSide}); sc.background = new T.Color(0); sc.fog = null;
  const at = r.autoClear; r.autoClear = true;
  r.setRenderTarget(rt); r.clear(); r.render(sc, cam); r.setRenderTarget(null);
  r.autoClear = at; sc.overrideMaterial = om; sc.background = bg; sc.fog = fog; hidden.forEach(o => o.visible = true);
  const buf = new Uint8Array(W * H * 4); r.readRenderTargetPixels(rt, 0, 0, W, H, buf); rt.dispose();
  // pixel (i, j): i along +x, j along +z (render target rows are bottom-up: row 0 = z1)
  const solid = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const s = ((H - 1 - j) * W + i) * 4; solid[j * W + i] = buf[s] > 100 ? 1 : 0; }
  const covered = new Uint8Array(W * H), pad = 0.12;
  for (const c of cols) {
    const i0 = Math.max(0, Math.floor((c.x0 - pad - X0) / RES)), i1 = Math.min(W - 1, Math.floor((c.x1 + pad - X0) / RES));
    const j0 = Math.max(0, Math.floor((c.z0 - pad - Z0) / RES)), j1 = Math.min(H - 1, Math.floor((c.z1 + pad - Z0) / RES));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) covered[j * W + i] = 1;
  }
  // connected blobs of solid-but-not-covered
  const seen = new Uint8Array(W * H), blobs = [];
  for (let p = 0; p < W * H; p++) {
    if (!solid[p] || covered[p] || seen[p]) continue;
    const st = [p]; seen[p] = 1; let n = 0, ix0 = 1e9, ix1 = -1, jz0 = 1e9, jz1 = -1, sx = 0, sz = 0;
    while (st.length) { const q = st.pop(), i = q % W, j = (q / W) | 0; n++; sx += i; sz += j; ix0 = Math.min(ix0, i); ix1 = Math.max(ix1, i); jz0 = Math.min(jz0, j); jz1 = Math.max(jz1, j);
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= W || b >= H) continue; const k = b * W + a; if (solid[k] && !covered[k] && !seen[k]) { seen[k] = 1; st.push(k); } } }
    const area = n * RES * RES; if (area < 0.04) continue;
    // what is it? cast a ray straight down through one of its pixels
    const pi = p % W, pj = (p / W) | 0, rc = new T.Raycaster(new T.Vector3(X0 + (pi + 0.5) * RES, 1.8, Z0 + (pj + 0.5) * RES), new T.Vector3(0, -1, 0), 0, 1.6);
    const hit = rc.intersectObject(sc, true).find(h => h.object.visible && !h.object.isSkinnedMesh);
    const chain = []; for (let o = hit && hit.object; o && chain.length < 4; o = o.parent) chain.push(o.name || o.type);
    const what = hit ? `${chain.join(' < ')} [${[].concat(hit.object.material).map(m => m && (m.name || m.type)).join(',')}] y=${hit.point.y.toFixed(2)}` : '?';
    blobs.push({what, x: +(X0 + (sx / n + 0.5) * RES).toFixed(2), z: +(Z0 + (sz / n + 0.5) * RES).toFixed(2), area: +area.toFixed(2),
      box: [+(X0 + ix0 * RES).toFixed(1), +(X0 + (ix1 + 1) * RES).toFixed(1), +(Z0 + jz0 * RES).toFixed(1), +(Z0 + (jz1 + 1) * RES).toFixed(1)]});
  }
  blobs.sort((a, b) => b.area - a.area);
  // characters standing (not seated) whose body overlaps something solid; and every named standing spot (anchors)
  const bodyHit = (x, z) => { let hit = 0, tot = 0; for (let a = 0; a < 16; a++) for (const rr of [0.05, 0.15]) { const i = Math.floor((x + Math.cos(a) * rr - X0) / RES), j = Math.floor((z + Math.sin(a) * rr - Z0) / RES); tot++; if (solid[j * W + i]) hit++; } return hit / tot; };
  const spots = [];
  try {
    const {anchors} = await import('/js/world/building.js');
    for (const [k, v] of Object.entries(anchors)) for (const [kk, a] of Array.isArray(v) ? v.map((a, i) => [k + '[' + i + ']', a]) : [[k, v]])
      if (a && typeof a.x === 'number' && typeof a.z === 'number' && !/seat|desk|card|screen|cups|board|item|obj/i.test(kk)) { const o = bodyHit(a.x, a.z); if (o > 0.25) spots.push({spot: kk, x: a.x, z: a.z, overlap: +o.toFixed(2)}); }
  } catch (e) { spots.push({error: String(e)}); }
  const inside = [];
  for (const [id, ch] of Object.entries(window.__C || {})) {
    if (!ch.holder.visible || ch.seated) continue;
    const p = ch.holder.position; let hit = 0, tot = 0;
    for (let a = 0; a < 16; a++) for (const rr of [0.05, 0.15]) { const i = Math.floor((p.x + Math.cos(a) * rr - X0) / RES), j = Math.floor((p.z + Math.sin(a) * rr - Z0) / RES); tot++; if (solid[j * W + i]) hit++; }
    if (hit / tot > 0.25) inside.push({id, x: +p.x.toFixed(2), z: +p.z.toFixed(2), overlap: +(hit / tot).toFixed(2)});
  }
  // overlay: grey = solid & covered, red = solid & NOT covered, green tint = collider
  const cv = document.getElementById('auditc') || Object.assign(document.createElement('canvas'), {id: 'auditc'});
  cv.width = W; cv.height = H; Object.assign(cv.style, {position: 'fixed', inset: '0', width: '100vw', height: '100vh', objectFit: 'contain', zIndex: 99, background: '#000'});
  const g = cv.getContext('2d'), img = g.createImageData(W, H);
  for (let p = 0; p < W * H; p++) { const d = p * 4; const s = solid[p], c = covered[p];
    img.data[d] = s && !c ? 255 : s ? 120 : c ? 20 : 0; img.data[d + 1] = s && !c ? 40 : s ? 120 : c ? 70 : 0; img.data[d + 2] = s && !c ? 40 : s ? 120 : c ? 30 : 0; img.data[d + 3] = 255; }
  g.putImageData(img, 0, 0);
  window.__auditView = (x0, x1, z0, z1) => { cv.style.objectFit = 'contain'; const sx = (x0 - X0) / RES, sy = (z0 - Z0) / RES, w = (x1 - x0) / RES, h = (z1 - z0) / RES;
    const c2 = document.getElementById('auditc2') || Object.assign(document.createElement('canvas'), {id: 'auditc2'}); c2.width = w * 4; c2.height = h * 4;
    Object.assign(c2.style, {position: 'fixed', inset: '0', width: '100vw', height: '100vh', objectFit: 'contain', zIndex: 100, background: '#000', imageRendering: 'pixelated'});
    const g2 = c2.getContext('2d'); g2.imageSmoothingEnabled = false; g2.drawImage(cv, sx, sy, w, h, 0, 0, w * 4, h * 4);
    g2.fillStyle = '#fff'; g2.font = '20px sans-serif'; for (let x = Math.ceil(x0); x <= x1; x++) g2.fillText(x, (x - x0) * 40 + 2, 18); for (let z = Math.ceil(z0); z <= z1; z++) g2.fillText(z, 2, (z - z0) * 40 + 18);
    document.body.appendChild(c2); return 1; };
  document.body.appendChild(cv);
  const reach = blobs.filter(b => b.z < 39.7 && Math.abs(b.x) < 35);   // the street beyond z 39.75 is fenced off
  return JSON.stringify({blobs: reach.slice(0, 60), count: reach.length, inside, spots});
})()
