async page=>{
 const checks=[],errors=[];page.on('pageerror',e=>errors.push(e.message));await page.mouse.up();
 const check=(v,m)=>{if(!v)throw Error(m);checks.push(m);};
 const click=a=>page.locator(`[data-action="${a}"]`).first().click();
 for(const viewport of [{width:1920,height:1080},{width:1366,height:768},{width:960,height:540}]){
  await page.setViewportSize(viewport);await page.goto('http://127.0.0.1:4175/?qa=1');await page.waitForFunction(()=>window.__mindrealm);
  await page.evaluate(async()=>{const q=window.__mindrealm,R=await import('/web/core/state.js'),H=await import('/development/web-tests/helpers/reference-strategy.mjs');await document.fonts.ready;q.newRun('reference-0');R.enterNode(q.getState(),R.availableNodes(q.getState())[0].id);H.prepareReference(q.getState());q.render();});
  for(const scale of ['1','1.25','1.5']){
   await click('settings');await page.locator('[data-action="ui-scale"]').selectOption(scale);await click('back');
   await page.locator('[data-action="warehouse-tab"][data-tab="all"]').click();await page.locator('[data-action="select-unit"]').first().click();
   await page.waitForTimeout(100);
   const fit=await page.evaluate(()=>{const q=window.__mindrealm,c=q.field.canvas.getBoundingClientRect(),side=document.querySelector('.battle-sidebar').getBoundingClientRect(),header=document.querySelector('.topbar').getBoundingClientRect(),status=document.querySelector('#placement-status').getBoundingClientRect(),start=document.querySelector('[data-action="start"]').getBoundingClientRect(),fuse=document.querySelector('[data-action="fuse"]');return{ok:side.right<=c.left+1&&c.top>=header.bottom&&status.top>=c.bottom-1&&start.bottom<=innerHeight+1&&start.right<=innerWidth+1&&q.field.canvas.width>=c.width-1&&fuse.getBoundingClientRect().height>0,width:c.width,height:c.height};});
   check(fit.ok,`${viewport.width}x${viewport.height}, UI ${scale}: isolated native canvas and visible unit actions ${JSON.stringify(fit)}`);
   await page.screenshot({path:`clarity-layout-final-${viewport.width}-${scale}.png`});
  }
 }
 check(errors.length===0,`No script errors: ${errors.join(';')}`);return{status:'MINDREALM_CLARITY_LAYOUT_OK',checks,errors};
}
