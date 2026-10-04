async page => {
  const url = new URL(page.url());
  if (url.searchParams.get('qa') !== '1' ||
      !['127.0.0.1', 'localhost', 'alphazero78.github.io'].includes(url.hostname) || url.port === '4173') {
    throw Error('Use an isolated ?qa=1 Pages preview or the published game.');
  }
  const base = url.pathname.endsWith('/') ? url.pathname : url.pathname + '/';
  const errors = [], requests = [], checks = [];
  const recordError = error => errors.push(error.message);
  const recordConsole = message => {if (['error', 'warning'].includes(message.type())) errors.push(message.text());};
  const recordResponse = response => {if (response.status() >= 400) requests.push(`${response.status()} ${response.url()}`);};
  page.on('pageerror', recordError); page.on('console', recordConsole); page.on('response', recordResponse);
  const check = (condition, label) => {if (!condition) throw Error(label); checks.push(label);};
  const idle = () => page.waitForFunction(() => window.__mindrealm && !window.__mindrealm.transitions.active &&
    !window.__mindrealm.dialogs.active && !window.__mindrealm.dialogs.animations.size);
  const click = async action => {await page.locator(`[data-action="${action}"]`).first().click(); await idle();};
  try {
    await page.setViewportSize({width:1440,height:900});
    await page.reload(); await idle();
    await page.waitForFunction(() => window.__mindrealm.field.realtime?.ready, undefined, {timeout:60000});
    const manifest = await page.evaluate(async base => (await fetch(base + 'site-manifest.json')).json(), base);
    check(manifest.kind === 'mindrealm-github-pages' && manifest.basePath === base, 'published manifest and repository subpath agree');
    await page.screenshot({path:'pages-menu.png'});
    await click('new'); await page.locator('#seed-input').fill('pages-v0.1.3');
    await page.locator('.modal-footer .primary').click(); await idle();
    check(await page.evaluate(() => window.__mindrealm.getState().phase) === 'nexus', 'new run reaches spirit nexus');
    await click('nexus-gift'); await page.locator('.modal-footer .primary').click(); await idle();
    await page.locator('.map-node.available').first().click(); await idle();
    check(await page.evaluate(() => window.__mindrealm.getState().phase) === 'prep', 'route enters preparation');
    const placement = await page.evaluate(async base => {
      const q = window.__mindrealm, state = q.getState(), R = await import(base + 'web/core/rules.js');
      const unit = state.units.find(u => u.type === 'pulse_array'), core = R.coreOf(state), choices = [];
      for (let z = 0; z < state.terrain.size; z++) for (let x = 0; x < state.terrain.size; x++) {
        if (R.placement(state, unit, x, z).ok) choices.push({x,z,distance:Math.hypot(x-core.x,z-core.z)});
      }
      return {uid:unit.uid, ...choices.sort((a,b) => a.distance-b.distance)[0]};
    }, base);
    await page.locator(`[data-action="select-unit"][data-uid="${placement.uid}"]`).click();
    const point = await page.evaluate(cell => {
      const q=window.__mindrealm, state=q.getState(), rect=document.querySelector('#battlefield').getBoundingClientRect();
      const p=q.field.project(cell.x+.5,cell.z+.5,state.terrain.cells[cell.z*state.terrain.size+cell.x].h);
      return {x:rect.x+p.x,y:rect.y+p.y};
    }, placement);
    await page.mouse.click(point.x, point.y); await idle();
    check(await page.evaluate(uid => window.__mindrealm.getState().units.find(u => u.uid===uid).x!==null, placement.uid), 'model deploys by an actual battlefield click');
    await page.screenshot({path:'pages-preparation.png'});
    await click('menu'); await click('continue');
    check(await page.evaluate(uid => window.__mindrealm.getState().units.find(u => u.uid===uid).x!==null, placement.uid), 'continue restores the deployment in isolated storage');
    await click('start'); await page.locator('.modal-footer .primary').click(); await idle();
    await page.waitForFunction(() => window.__mindrealm.getState().battle?.time > 2);
    await click('pause');
    await page.screenshot({path:'pages-battle.png'});
    const details = await page.evaluate(() => {
      const q=window.__mindrealm;
      return {phase:q.getState().phase, elapsed:q.getState().battle.time, models:q.field.realtime.sources.size,
        graphics:q.field.errors, audio:q.audio.errors};
    });
    check(details.phase==='battle' && details.elapsed>2 && details.models>0, 'hosted game simulates and renders a battle');
    check(details.graphics.length===0 && details.audio.length===0, 'graphics and audio report no loading failures');
    // Read and decode every dynamic event illustration from its deployed URL.
    const illustrations = await page.evaluate(async base => {
      const {events}=await import(base+'web/core/content.js'), ids=Object.keys(events);
      await Promise.all(ids.map(id => new Promise((resolve,reject) => {
        const image=new Image();image.onload=()=>resolve();image.onerror=()=>reject(Error('Event art: '+id));
        image.src=base+'assets/game/events/'+id+'.png';
      })));
      return ids.length;
    }, base);
    check(illustrations===36, 'all 36 event illustrations decode under the hosted prefix');
    check(errors.length===0 && requests.length===0, `no browser or HTTP errors: ${JSON.stringify({errors,requests})}`);
    return {status:'PAGES_BROWSER_OK', version:manifest.version, commit:manifest.commit, checks, details, illustrations, errors, requests};
  } finally {
    page.off('pageerror',recordError);page.off('console',recordConsole);page.off('response',recordResponse);
  }
}
