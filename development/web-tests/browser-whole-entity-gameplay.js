async page => {
  const url = new URL(page.url());
  if (url.port === '4173' || !['127.0.0.1', 'localhost'].includes(url.hostname) || url.searchParams.get('qa') !== '1') throw Error('Use isolated QA storage');
  page.setDefaultTimeout(15000);
  const issues = [], checks = [], onError = error => issues.push(error.message), onConsole = message => {
    if (['warning', 'error'].includes(message.type())) issues.push(message.text());
  };
  page.on('pageerror', onError); page.on('console', onConsole);
  const check = (name, ok, detail) => { checks.push({ name, ok: !!ok, detail }); if (!ok) throw Error(JSON.stringify(checks.at(-1))); };
  const idle = () => page.waitForFunction(() => window.__mindrealm && !window.__mindrealm.transitions.active && !window.__mindrealm.dialogs.active && !window.__mindrealm.dialogs.animations.size);
  const click = async action => { await page.locator(`[data-action="${action}"]`).first().click(); await idle(); };
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForFunction(() => window.__mindrealm?.field.realtime?.ready);
  await page.evaluate(async () => {
    const q = window.__mindrealm, R = await import('/web/core/state.js'), H = await import('/development/web-tests/helpers/reference-strategy.mjs');
    const s = R.newRun('reference-0'); R.chooseNexus(s, s.nexus[0].options[0]); R.enterNode(s, s.nextNodes[0]); H.prepareReference(s);
    s.depth = 5; s.focus = 1000;
    q.getSettings().tutorial = false; q.getSettings().uiScale = 1; q.getSettings().reducedMotion = false;
    q.loadState(s); await q.field.realtime.prepareState(q.getState());
  }); await idle();
  const uid = await page.evaluate(() => window.__mindrealm.getState().units.find(u => u.x !== null && u.tier === 1).uid);
  if (await page.locator('#footer-drawer').isHidden()) await click('toggle-footer');
  await page.locator('[data-action="warehouse-tab"][data-tab="deployed"]').click();
  await page.locator(`[data-action="select-unit"][data-uid="${uid}"]`).click();
  const before = await page.evaluate(() => JSON.stringify(window.__mindrealm.getState()));
  await click('upgrade');
  const previews = await page.locator('.choice-card .sprite').evaluateAll(items => items.map(e => ({ variant: e.dataset.artVariant, y: e.querySelector('image')?.getAttribute('y'), path: e.querySelector('image')?.getAttribute('href') })));
  check('future branches use distinct current portraits', previews.length === 2 && previews[0].variant === 'T2A' && previews[1].variant === 'T2B' && previews[0].y !== previews[1].y && previews.every(p => p.path.includes('/portraits/')), previews);
  await page.getByRole('button', { name: '取消', exact: true }).click(); await idle();
  check('cancel preserves the entire run', await page.evaluate(() => JSON.stringify(window.__mindrealm.getState())) === before);
  await click('upgrade'); await page.locator('[data-dialog-upgrade="B"]').click(); await idle();
  await page.waitForFunction(uid => window.__mindrealm.field.entityFrames.some(f => f.key === `unit:${uid}` && f.variant === 'T2B' && f.renderMode === 'realtime-webgl'), uid);
  const upgraded = await page.evaluate(uid => ({ ...window.__mindrealm.getState().units.find(u => u.uid === uid) }), uid);
  const old = JSON.parse(before).units.find(u => u.uid === uid);
  check('confirmed upgrade keeps deployment and loads branch GLB', upgraded.tier === 2 && upgraded.branch === 'B' && upgraded.x === old.x && upgraded.z === old.z, upgraded);
  await click('upgrade');
  const terminal = await page.locator('.choice-card .sprite').evaluateAll(items => items.map(e => e.dataset.artVariant));
  check('next upgrade follows branch B', terminal.length === 1 && terminal[0] === 'T3B', terminal);
  await page.getByRole('button', { name: '取消', exact: true }).click(); await idle();
  await click('menu'); await click('continue');
  check('continue restores the same unit', await page.evaluate(uid => JSON.stringify(window.__mindrealm.getState().units.find(u => u.uid === uid)), uid) === JSON.stringify(upgraded));
  await page.screenshot({ path: 'output/playwright/final-preparation.jpg', type: 'jpeg', quality: 80 });
  await click('start'); await page.locator('.modal-footer .primary').click(); await idle();
  for (const speed of [1, 2, 3]) {
    await page.locator(`[data-action="speed"][data-speed="${speed}"]`).click();
    const sample = await page.evaluate(() => new Promise(resolve => {
      const q = window.__mindrealm, start = performance.now(), initial = q.getState().battle.time;
      let frames = 0, clockError = 0, fallbackFrames = 0;
      const tick = now => {
        frames++; const battle = q.getState().battle;
        clockError = Math.max(clockError, Math.abs(q.field.entityMotion.clock - Math.max(0, battle.time - (1 - q.field.interpolation) * .05) * 1000));
        fallbackFrames += q.field.entityFrames.filter(f => f.renderMode !== 'realtime-webgl').length;
        if (now - start < 1000) requestAnimationFrame(tick);
        else resolve({ wall: (now - start) / 1000, simulation: battle.time - initial, frames, clockError, fallbackFrames });
      }; requestAnimationFrame(tick);
    }));
    check(`${speed}x uses the simulation clock`, Math.abs(sample.simulation / sample.wall - speed) < .45 && sample.clockError < .001 && sample.fallbackFrames === 0, sample);
  }
  await click('pause');
  const freeze = () => page.evaluate(() => {
    const q = window.__mindrealm, values = [q.getState().battle.time, q.field.entityMotion.clock];
    for (const instance of q.field.realtime.instances.values()) instance.root.traverse(n => values.push(...n.position.toArray(), ...n.quaternion.toArray(), ...n.scale.toArray()));
    return JSON.stringify(values);
  });
  const frozen = await freeze(); await page.waitForTimeout(350);
  check('pause freezes model and simulation transforms', frozen === await freeze());
  await page.evaluate(() => { const f = window.__mindrealm.field; f.changeZoom(1.65); f.render(performance.now()); });
  await page.screenshot({ path: 'output/playwright/final-live-battle.jpg', type: 'jpeg', quality: 82 });
  await click('settings'); await page.locator('#motion-setting').check(); await click('back');
  check('reduce-motion setting controls real entity poses', await page.evaluate(() => window.__mindrealm.field.entityFrames.every(f => (!['move', 'hover'].includes(f.action) || f.progress === 0) && f.hit === 0 && f.spawn === 0)));

  const fixtures = await page.evaluate(async () => {
    const q = window.__mindrealm, R = await import('/web/core/state.js'), C = await import('/web/core/content.js');
    const s = R.newRun('whole-entity-integration'); R.chooseNexus(s, s.nexus[0].options[0]); R.enterNode(s, s.nextNodes[0]); s.units = [];
    const types = ['archive_warden', 'ordered_sentinel', 'shield_conductor', 'armored_worm', 'bandwidth_requisitioner'];
    s.battle = { time: 10, enemies: types.map((type, i) => ({ ...C.enemies[type], type, id: `fixture-${i}`, x: 15 + i * 2.2, z: 19, h: 0, hp: C.enemies[type].hp, maxHp: C.enemies[type].hp, phase: 0, facing: 0, motion: { dx: .04, dz: .02, distance: .4, dt: .05 }, castUntil: 10.5 })), drones: [{ id: 'fixture-drone', x: 17, z: 17, h: 2, facing: .2, motion: { dx: .02, dz: 0, dh: 0 } }], disabled: [], events: [] };
    q.getSettings().reducedMotion = false; q.loadState(s); await q.field.realtime.prepareState(q.getState());
    q.transitions.finish(); const field = q.field, state = q.getState(); field.frameBoard(); field.changeZoom(1.7); field.render(performance.now());
    const mixed = field.entityFrames.filter(f => f.key?.startsWith('enemy:')).map(f => {
      const instance = field.realtime.instances.get(`${f.type}:${f.key}`);
      return { type: f.type, action: f.action, moving: f.moving, clip: instance?.animation.current?.name, locomotion: !!instance?.animation.current?.locomotionKey };
    });
    const drone = field.realtime.frames.find(f => f.type === 'tracking_drone');
    const boss = state.battle.enemies.at(-1), phases = [];
    for (let phase = 0; phase < 3; phase++) {
      boss.phase = phase; state.battle.time += .1; await field.realtime.prepareState(state); field.render(performance.now());
      const frame = field.entityFrames.find(f => f.key === `enemy:${boss.id}`);
      const instance = field.realtime.instances.get(`${boss.type}:${frame.key}`);
      phases.push({ phase, variant: frame.variant, model: instance?.asset.url, renderMode: frame.renderMode });
    }
    const frozenState = JSON.stringify(state); field.render(performance.now() + 20); const unchanged = frozenState === JSON.stringify(state);
    return { mixed, drone, phases, unchanged, errors: field.errors, stats: field.realtime.snapshot() };
  });
  check('moving casts combine locomotion and connected ability mechanisms', fixtures.mixed.length === 5 && fixtures.mixed.every(f => f.moving && f.action === 'cast' && f.clip === 'windup' && f.locomotion), fixtures.mixed);
  check('tracking drone uses its separate GLB', fixtures.drone?.type === 'tracking_drone', fixtures.drone);
  check('boss phases replace the actual GLB', fixtures.phases.every(p => p.variant === `phase${p.phase + 1}` && p.model.endsWith(`/phase${p.phase + 1}.glb`) && p.renderMode === 'realtime-webgl'), fixtures.phases);
  check('renderer preserves authoritative state', fixtures.unchanged);
  await idle(); await page.screenshot({ path: 'output/playwright/final-moving-casts.jpg', type: 'jpeg', quality: 82 });
  const diagnostics = await page.evaluate(() => ({ render: window.__mindrealm.field.errors, audio: window.__mindrealm.audio.errors }));
  check('gameplay diagnostics are clear', !issues.length && !diagnostics.render.length && !diagnostics.audio.length, { issues, diagnostics });
  page.off('pageerror', onError); page.off('console', onConsole);
  return { status: 'WHOLE_ENTITY_GAMEPLAY_OK', checks, fixtures, issues, diagnostics };
}
