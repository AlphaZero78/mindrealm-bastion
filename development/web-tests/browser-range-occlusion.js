async page => {
  const url = new URL(page.url()), baseline = url.hash === '#baseline';
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.port === '4173' || url.searchParams.get('qa') !== '1') throw Error('Use an isolated QA server');
  const issues = [], onError = e => issues.push(e.message);
  page.on('pageerror', onError);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForFunction(() => window.__mindrealm?.field.realtime?.ready);
  await page.evaluate(async () => {
    const q = window.__mindrealm, R = await import('/web/core/state.js'), Rules = await import('/web/core/rules.js');
    const s = R.newRun('range-occlusion'); R.chooseNexus(s, s.nexus[0].options[0]); R.enterNode(s, s.nextNodes[0]); s.units = [];
    for (const c of s.terrain.cells) { c.h = 0; c.ramp = -1; }
    const paint = (x0, z0, x1, z1, h) => { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) s.terrain.cells[z * s.terrain.size + x].h = h; };
    paint(15, 10, 25, 19, 1); paint(16, 11, 24, 18, 2); paint(17, 14, 23, 16, 3);
    const unit = R.addUnit(s, 'focus_rail'); if (!Rules.deploy(s, unit.uid, 18, 11).ok) throw Error('Fixture deployment failed');
    s.terrain.revision++; q.getSettings().tutorial = false; q.getSettings().reducedMotion = true; q.loadState(s); q.transitions.finish();
    const f = q.field; f.camera.x = 20; f.camera.z = 14; f.camera.scale = 50; f.camera.yaw = Math.PI / 4;
    f.setSelection({ selectedUid: unit.uid, reducedMotion: true }); f.dirty = true; f.render(performance.now());
  });
  await page.screenshot({ path: `output/playwright/${baseline ? 'before' : 'after'}-range.jpg`, type: 'jpeg', quality: 82 });
  const result = await page.evaluate(async baseline => {
    const q = window.__mindrealm, f = q.field, state = q.getState(), serialized = JSON.stringify(state), { rangeBoundary } = await import('/web/view/battlefield.js');
    const saved = { ctx: f.ctx, updateRange: f.updateRange, selection: f.selection, hover: f.hover, camera: { ...f.camera } }, cases = [];
    const surface = () => { const c = document.createElement('canvas'); c.width = f.canvas.width; c.height = f.canvas.height; return c; };
    const painted = surface(), faceMap = surface(), ctx = painted.getContext('2d', { willReadFrequently: true }), faces = faceMap.getContext('2d', { willReadFrequently: true });
    let rx = f.canvas.width / f.camera.width, ry = f.canvas.height / f.camera.height;
    const poly = (c, points, color) => { c.fillStyle = color; c.beginPath(); c.moveTo(points[0].x, points[0].y); for (const p of points.slice(1)) c.lineTo(p.x, p.y); c.closePath(); c.fill(); };
    const capture = (kind, height, yaw, boundary = false) => {
      for (const surface of [painted,faceMap]) { surface.width=f.canvas.width;surface.height=f.canvas.height; }
      rx=f.canvas.width/f.camera.width;ry=f.canvas.height/f.camera.height;
      f.camera.yaw = yaw * Math.PI / 180; f.buildTerrain();
      f.clearRange(); f.rangeSource = state; f.selection = {}; f.hover = null; f.updateRange = () => {};
      const cells = f.tiles.filter(t => t.h === height && (boundary ? t.x <= 6 && t.z <= 6 : t.x >= 14 && t.x <= 26 && t.z >= 9 && t.z <= 20)).map(t => ({ x: t.x, z: t.z }));
      if (kind === 'attack') { f.range = cells; f.rangeEdges = rangeBoundary(cells); }
      if (kind === 'blocked') { f.rangeBlocked = cells; f.rangeBlockedEdges = rangeBoundary(cells); }
      if (kind === 'aura') f.rangeAuras = [{ cells, edges: rangeBoundary(cells), color: '#ead28c' }];
      for (const c of [ctx, faces]) { c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, painted.width, painted.height); c.setTransform(rx, 0, 0, ry, 0, 0); }
      // Independent face-ID oracle: only blue top faces can receive this layer.
      for (const tile of f.tiles) { for (const side of tile.sides) poly(faces, side.p, '#ff0000'); poly(faces, tile.q, tile.h === height ? '#0000ff' : '#00ff00'); }
      f.ctx = ctx;
      const start = performance.now(); f.drawRangeFill(); f.drawSelection(); const buildMs = performance.now() - start;
      if (kind === 'aura' && baseline) f.drawRangeEdges(f.rangeAuras[0].edges, '#ead28c', true);
      const pixels = ctx.getImageData(0, 0, painted.width, painted.height).data, face = faces.getImageData(0, 0, painted.width, painted.height).data;
      let visible = 0, leak = 0, edgeSamples = 0;
      const faceID = i => face[i + 3] === 0 ? 0 : face[i] > 245 && face[i + 1] < 10 && face[i + 2] < 10 ? 1 : face[i + 1] > 245 && face[i] < 10 && face[i + 2] < 10 ? 2 : 3;
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3] >= 18) {
        if (face[i + 2] > 245 && face[i] < 10 && face[i + 1] < 10) visible++;
        else if (faceID(i) < 3) {
          // GPU and CPU canvas paths can disagree by one antialiased pixel.
          // Reject paint inside an occluder, while excluding that shared edge.
          const x = i / 4 % painted.width, y = Math.floor(i / 4 / painted.width), id = faceID(i);
          if (x > 0 && y > 0 && x < painted.width - 1 && y < painted.height - 1 && [-1,0,1].every(dy => [-1,0,1].every(dx => faceID(i + 4 * (dy * painted.width + dx)) === id))) leak++;
          else edgeSamples++;
        }
      }
      const record = { kind, height, yaw, boundary, resolution:f.resolution, visible, leak, edgeSamples, buildMs }; cases.push(record);
      if (!baseline && (leak || !visible)) throw Error(JSON.stringify(record));
    };
    let cacheStable = false, cancelled = false;
    try {
      for (const yaw of [0, 45, 90, 135, 225, 315]) for (const height of [0, 1, 2, 3]) capture('attack', height, yaw);
      for (const kind of ['blocked', 'aura']) for (const height of [0, 1, 2, 3]) capture(kind, height, 45);
      f.camera.x=1;f.camera.z=1;capture('attack',0,45,true);f.camera.x=saved.camera.x;f.camera.z=saved.camera.z;
      const resolution=f.resolution;f.setResolution('1920x1080');f.camera.scale=50;capture('attack',1,45);f.setResolution(resolution);f.camera.scale=50;capture('blocked',2,135);
      if (!baseline) { const cache = f.rangeLayerState; f.drawRangeFill(); cacheStable = f.rangeLayerState === cache; if (!cacheStable) throw Error('Unchanged range must reuse its surface'); }
      f.updateRange = saved.updateRange; f.setSelection({}); f.updateRange(); cancelled = !f.range.length && !f.rangeAuras.length && !f.rangeBlocked.length;
    } finally { f.ctx = saved.ctx; f.updateRange = saved.updateRange; f.camera = saved.camera; f.hover = saved.hover; f.setSelection(saved.selection); f.rangeKey = ''; f.dirty = true; f.render(performance.now()); }
    const unchanged = JSON.stringify(state) === serialized;
    if (!unchanged || !cancelled) throw Error('Range rendering changed the run or left a cancelled selection');
    return { cases, cacheStable, cancelled, unchanged, errors: f.errors };
  }, baseline);
  const totalLeak = result.cases.reduce((sum, c) => sum + c.leak, 0);
  if (baseline && !totalLeak) throw Error('Range defect not reproduced');
  if (issues.length || result.errors.length) throw Error(JSON.stringify({ issues, errors: result.errors }));
  let fallback = null;
  if (!baseline) {
    await page.waitForFunction(() => [...__mindrealm.field.images.values()].every(image => image.complete && image.naturalWidth));
    fallback = await page.evaluate(() => {
      const f=__mindrealm.field,renderer=f.realtime,order=[],fill=f.drawRangeFill,draw=f.drawUnit;
      f.realtime=null;f.drawRangeFill=function(){order.push('range');return fill.call(this);};f.drawUnit=function(...args){order.push('unit');return draw.apply(this,args);};
      try { f.render(performance.now());return {order,sprite:f.entityFrames.some(e=>e.type==='focus_rail'&&e.renderMode!=='realtime-webgl'),errors:f.errors}; }
      finally {f.realtime=renderer;f.drawRangeFill=fill;f.drawUnit=draw;}
    });
    if (!fallback.sprite || fallback.order.indexOf('range')>=fallback.order.indexOf('unit') || fallback.errors.length) throw Error(JSON.stringify(fallback));
    await page.evaluate(() => __mindrealm.field.render(performance.now()));
  }
  page.off('pageerror', onError);
  return { status: baseline ? 'RANGE_DEFECT_REPRODUCED' : 'RANGE_OCCLUSION_OK', totalLeak, ...result, fallback, issues };
}
