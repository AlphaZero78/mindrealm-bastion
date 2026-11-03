async page => {
  const url = new URL(page.url()), baseline = url.searchParams.get('shadowBaseline') === '1';
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.port === '4173' || url.searchParams.get('qa') !== '1') throw Error('Use an isolated QA server');
  const issues = [], onError = e => issues.push(e.message), onConsole = m => { if (['error', 'warning'].includes(m.type())) issues.push(m.text()); };
  page.on('pageerror', onError); page.on('console', onConsole);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForFunction(() => window.__mindrealm?.field.realtime?.ready);
  await page.evaluate(async () => {
    const q = window.__mindrealm, R = await import('/web/core/state.js'), Rules = await import('/web/core/rules.js');
    const s = R.newRun('terrain-shadow-regression'); R.chooseNexus(s, s.nexus[0].options[0]); R.enterNode(s, s.nextNodes[0]); s.units = [];
    for (const c of s.terrain.cells) { c.h = 0; c.ramp = -1; }
    const paint = (x0, z0, x1, z1, h) => { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) s.terrain.cells[z * s.terrain.size + x].h = h; };
    paint(16, 10, 23, 17, 1); paint(17, 11, 22, 16, 2); paint(18, 14, 20, 14, 3);
    // The narrow edge and a one-level foreground ridge reproduce both supplied screenshots.
    paint(21, 11, 22, 13, 1); paint(17, 11, 17, 13, 1); paint(18, 11, 20, 11, 1);
    const u = R.addUnit(s, 'focus_rail'); const placed = Rules.deploy(s, u.uid, 18, 12); if (!placed.ok) throw Error(placed.reason);
    s.terrain.revision++; q.getSettings().tutorial = false; q.getSettings().reducedMotion = true; q.loadState(s); q.transitions.finish();
    const f = q.field; f.camera.x = 19.5; f.camera.z = 13; f.camera.scale = 95; f.camera.yaw = Math.PI / 4; f.dirty = true; f.render(performance.now());
  });
  const crop = await page.evaluate(() => {
    const f = window.__mindrealm.field, p = f.p(19.5, 13, 2), rect = f.canvas.getBoundingClientRect();
    const width = 570, height = 440;
    return { x: Math.max(rect.left, Math.min(innerWidth - width, rect.left + p.x - width / 2)), y: Math.max(rect.top, Math.min(innerHeight - height, rect.top + p.y - 300)), width, height };
  });
  await page.screenshot({ path: `output/playwright/${baseline ? 'before' : 'after'}-terrain-shadow.jpg`, clip: crop, type: 'jpeg', quality: 85 });
  const result = await page.evaluate(baseline => {
    const q = window.__mindrealm, f = q.field, s = q.getState(), u = s.units[0], cases = [], serialized = JSON.stringify(s);
    if (!baseline && typeof f.drawGroundShadow !== 'function') throw Error('Ground-shadow compositor is missing');
    const rx = f.canvas.width / f.camera.width, ry = f.canvas.height / f.camera.height;
    const surface = () => { const c = document.createElement('canvas'); c.width = f.canvas.width; c.height = f.canvas.height; return c; };
    const shadows = surface(), faceMap = surface(), ctx = shadows.getContext('2d', { willReadFrequently: true }), face = faceMap.getContext('2d', { willReadFrequently: true });
    const poly = (context, points, color) => { context.fillStyle = color; context.beginPath(); context.moveTo(points[0].x, points[0].y); for (let i = 1; i < points.length; i++) context.lineTo(points[i].x, points[i].y); context.closePath(); context.fill(); };
    const capture = (label, entity, enemy = false) => {
      const geometry = f.entityGeometry(entity, enemy), receiver = enemy ? f.heightAt(Math.floor(geometry.x), Math.floor(geometry.z)) : geometry.h;
      f.dirty = true; f.buildTerrain();
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, shadows.width, shadows.height); ctx.setTransform(rx, 0, 0, ry, 0, 0);
      face.setTransform(1, 0, 0, 1, 0, 0); face.clearRect(0, 0, faceMap.width, faceMap.height); face.setTransform(rx, 0, 0, ry, 0, 0);
      // Independent face-ID render: side walls are red, other heights green,
      // and the visible ground surface receiving this shadow is blue.
      for (const tile of f.tiles) { for (const side of tile.sides) poly(face, side.p, '#ff0000'); poly(face, tile.q, tile.h === receiver ? '#0000ff' : '#00ff00'); }
      const saved = { ctx: f.ctx, model: f.drawModel, overlay: f.queueOverlay, boxes: f.entityBoxes };
      const begin = ctx.beginPath.bind(ctx), ellipse = ctx.ellipse.bind(ctx), fill = ctx.fill.bind(ctx), stroke = ctx.stroke.bind(ctx); let ellipsePath = false;
      ctx.beginPath = () => { ellipsePath = false; begin(); }; ctx.ellipse = (...args) => { ellipsePath = true; ellipse(...args); };
      ctx.fill = (...args) => { if (ellipsePath) fill(...args); }; ctx.stroke = () => {};
      f.ctx = ctx; f.drawModel = () => {}; f.queueOverlay = () => {}; f.entityBoxes = [];
      const start = performance.now();
      try { if (enemy) f.drawEnemy(entity, 0); else f.drawUnit(entity, 0); }
      finally { f.ctx = saved.ctx; f.drawModel = saved.model; f.queueOverlay = saved.overlay; f.entityBoxes = saved.boxes; ctx.beginPath = begin; ctx.ellipse = ellipse; ctx.fill = fill; ctx.stroke = stroke; }
      const shadowMs = performance.now() - start, pixels = ctx.getImageData(0, 0, shadows.width, shadows.height).data, faces = face.getImageData(0, 0, faceMap.width, faceMap.height).data;
      let visible = 0, allowed = 0, sideLeak = 0, heightLeak = 0, outsideLeak = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] < 12) continue; visible++;
        if (faces[i + 3] < 12) outsideLeak++;
        else if (faces[i] > 245 && faces[i + 1] < 10 && faces[i + 2] < 10) sideLeak++;
        else if (faces[i + 1] > 245 && faces[i] < 10 && faces[i + 2] < 10) heightLeak++;
        else if (faces[i + 2] > 245 && faces[i] < 10 && faces[i + 1] < 10) allowed++;
      }
      const record = { label, yaw: f.camera.yaw, receiver, visible, allowed, sideLeak, heightLeak, outsideLeak, shadowMs };
      if (!baseline && (sideLeak + heightLeak + outsideLeak > 0 || allowed < 20)) throw Error(JSON.stringify(record));
      cases.push(record);
    };
    for (const type of ['focus_rail', 'resistance_beacon']) {
      u.type = type;
      for (const degrees of [0, 45, 90, 135, 225, 315]) { f.camera.yaw = degrees * Math.PI / 180; capture(type, u); }
    }
    u.type = 'focus_rail'; f.camera.yaw = Math.PI / 4;
    const enemy = { id: 'shadow-enemy', type: 'static_drifter', x: 19, z: 12, h: 2, hp: 100, maxHp: 100, phase: 0, facing: 0 };
    capture('ground enemy', enemy, true);
    capture('flying enemy ground contact', { ...enemy, type: 'floating_noise', air: true }, true);
    const ridge = s.terrain.cells[14 * s.terrain.size + 19]; const oldHeight = ridge.h; ridge.h = 2; s.terrain.revision++;
    capture('terrain height changed', u); ridge.h = oldHeight; s.terrain.revision--; f.dirty = true;
    f.camera.x = 27.5; f.camera.z = 13; capture('unobstructed flat ground', { ...enemy, x: 27, z: 12, h: 0 }, true);
    f.camera.x = .5; f.camera.z = .5; capture('map boundary', { ...enemy, x: 0, z: 0, h: 0 }, true);
    f.camera.x = 19.5; f.camera.z = 13; f.dirty = true;
    const unchanged = JSON.stringify(s) === serialized;
    if (!unchanged) throw Error('Shadow audit changed the authoritative run');
    f.render(performance.now());
    return { cases, unchanged, boundedShadowCanvas: f.shadowLayer ? [f.shadowLayer.width, f.shadowLayer.height] : null, errors: f.errors };
  }, baseline);
  const totalLeak = result.cases.reduce((n, r) => n + r.sideLeak + r.heightLeak + r.outsideLeak, 0);
  if (baseline && totalLeak === 0) throw Error('The supplied shadow defect was not reproduced');
  let fallback = null;
  if (!baseline) {
    await page.waitForFunction(() => [...window.__mindrealm.field.images.values()].every(image => image.complete && image.naturalWidth));
    fallback = await page.evaluate(() => {
      const f = window.__mindrealm.field, draw = f.drawGroundShadow; window.__shadowAuditRenderer = f.realtime;
      f.realtime = null; let privateLayers = 0, calls = 0;
      f.drawGroundShadow = function(...args) { calls++; if (this.ctx !== this.canvas.getContext('2d')) privateLayers++; return draw.apply(this, args); };
      try { f.dirty = true; f.render(performance.now()); }
      finally { f.drawGroundShadow = draw; }
      return { calls, privateLayers, spriteRendered: f.entityFrames.some(frame => frame.type === 'focus_rail' && frame.renderMode !== 'realtime-webgl'), errors: f.errors };
    });
    await page.screenshot({ path: 'output/playwright/after-fallback-shadow.jpg', clip: crop, type: 'jpeg', quality: 85 });
    await page.evaluate(() => { const f = window.__mindrealm.field; f.realtime = window.__shadowAuditRenderer; delete window.__shadowAuditRenderer; f.render(performance.now()); });
    if (!fallback.calls || !fallback.privateLayers || !fallback.spriteRendered || fallback.errors.length) throw Error(JSON.stringify(fallback));
  }
  if (issues.length || result.errors.length) throw Error(JSON.stringify({ issues, errors: result.errors }));
  page.off('pageerror', onError); page.off('console', onConsole);
  return { status: baseline ? 'TERRAIN_SHADOW_DEFECT_REPRODUCED' : 'TERRAIN_SHADOWS_OK', totalLeak, ...result, fallback, issues };
}
