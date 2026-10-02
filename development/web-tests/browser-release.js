async page=>{
 page.setDefaultTimeout(10000);const checks=[],errors=[],badRequests=[];const check=(v,m)=>{if(!v)throw Error(m);checks.push(m);};
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)badRequests.push(`${r.status()} ${r.url()}`);});
 await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:4186/')?route.continue():route.abort());
 await page.setViewportSize({width:1366,height:768});await page.goto('http://127.0.0.1:4186/?qa=1');await page.waitForFunction(()=>window.__mindrealm);
 const click=a=>page.locator(`[data-action="${a}"]`).first().click(),approve=()=>page.locator('.modal-footer .primary').click();
 await click('new');await page.locator('#seed-input').fill('release-ui');await approve();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(100);
 const target=await page.evaluate(async()=>{const R=await import('/web/core/rules.js'),q=window.__mindrealm,s=q.getState(),u=s.units[0],choices=[];for(let z=15;z<24;z++)for(let x=15;x<27;x++)if(R.placement(s,u,x,z).ok)choices.push({x,z,d:Math.hypot(x-20,z-18)});choices.sort((a,b)=>a.d-b.d);return choices[0];});
 async function point(cell){return page.evaluate(c=>{const q=window.__mindrealm,r=document.querySelector('canvas').getBoundingClientRect(),s=q.getState(),p=q.field.project(c.x+.5,c.z+.5,s.terrain.cells[c.z*41+c.x].h);return{x:r.x+p.x,y:r.y+p.y};},cell);}
 const card=await page.locator('[data-action="select-unit"][data-uid="u1"]').boundingBox();
 await page.mouse.move(card.x+card.width/2,card.y+card.height/2);await page.mouse.down();await page.mouse.move(card.x+card.width/2,card.y-12,{steps:3});
 const p=await point(target);await page.mouse.move(p.x,p.y,{steps:20});await page.mouse.up();
 check(await page.evaluate(c=>{const s=window.__mindrealm.getState();return s.units[0].x===c.x&&s.units[0].z===c.z&&s.focus===99;},target),`真实HTML拖拽部署成功且首次免费 ${JSON.stringify({target,p,actual:await page.evaluate(()=>({unit:window.__mindrealm.getState().units[0],hover:window.__mindrealm.field.hover}))})}`);
 await page.screenshot({path:'release-drag-deploy.png'});
 await page.locator('[data-action="warehouse-tab"][data-tab="deployed"]').click();await page.locator('[data-action="select-unit"][data-uid="u1"]').click();await click('move');
 const newTarget=await page.evaluate(async()=>{const R=await import('/web/core/rules.js'),s=window.__mindrealm.getState(),u=s.units[0];for(let x=u.x-3;x<u.x+4;x++)if(x!==u.x&&R.placement(s,u,x,u.z).ok)return{x,z:u.z};});
 const moved=await point(newTarget);await page.mouse.move(moved.x,moved.y);await page.mouse.click(moved.x,moved.y);
 check(await page.evaluate(()=>{const f=window.__mindrealm.field;return !f.interactive&&!!f.selection.previewOrigin&&!!f.selection.preview;}),'搬迁确认保留冻结预览且禁用战场输入');
 await page.waitForTimeout(200);
 check(await page.evaluate(()=>{const b=document.querySelector('.modal-footer .primary').getBoundingClientRect();return!!document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.closest('.modal');}),'缩放确认窗口位于检查器上方，可直接点击');
 await page.screenshot({path:'release-move-confirm.png'});await page.keyboard.press('Escape');
 check(await page.evaluate(c=>{const s=window.__mindrealm.getState();return s.units[0].x===c.x&&s.units[0].z===c.z&&s.focus===99;},target),'取消付费搬迁保留原部署');
 await page.keyboard.press('Escape');
 for(const viewport of [{width:1920,height:1080},{width:1366,height:768},{width:960,height:540}]){
  await page.setViewportSize(viewport);
  for(const scale of ['1','1.25','1.5']){
   await click('settings');await page.locator('[data-action="ui-scale"]').selectOption(scale);await click('back');
   await page.waitForTimeout(60);
   const fit=await page.evaluate(()=>{const a=document.querySelector('.topbar').getBoundingClientRect(),b=document.querySelector('.battle-footer').getBoundingClientRect(),c=document.querySelector('canvas').getBoundingClientRect(),start=document.querySelector('[data-action="start"]').getBoundingClientRect();return{ok:a.top>=-1&&b.bottom<=innerHeight+2&&c.top>=a.bottom-2&&c.bottom<=b.top+2&&start.bottom<=innerHeight+2&&start.right<=innerWidth+2,a:a.toJSON(),b:b.toJSON(),c:c.toJSON()};});
   check(fit.ok,`布局${viewport.width}x${viewport.height}缩放${scale}: ${fit.ok?'可见':JSON.stringify(fit)}`);
   await page.screenshot({path:`release-layout-${viewport.width}-${scale}.png`});
  }
 }
 await page.setViewportSize({width:1366,height:768});await click('settings');await page.locator('[data-action="ui-scale"]').selectOption('1');await click('back');
 await click('menu');await click('new');await page.locator('#seed-input').fill('empty-0');await approve();
 for(let i=0;i<40;i++){
  const phase=await page.evaluate(()=>window.__mindrealm.getState().phase);if(phase==='lost')break;
  if(phase==='map'){const id=await page.evaluate(async()=>{const R=await import('/web/core/state.js'),s=window.__mindrealm.getState();return[...R.availableNodes(s)].sort((a,b)=>(b.type==='battle')-(a.type==='battle'))[0].id;});await page.locator(`[data-action="map-node"][data-id="${id}"]`).click();}
  else if(phase==='prep'){await click('start');await approve();for(const speed of ['2','3','1'])await page.locator(`[data-action="speed"][data-speed="${speed}"]`).click();await page.evaluate(()=>window.__mindrealm.advance(360));}
  else if(phase==='reward')await click('reward');
  else if(phase==='node'){
   const type=await page.evaluate(()=>window.__mindrealm.getState().currentNode.type);
   if(['shop','workshop'].includes(type))await click('node-leave');
   else if(type==='camp'){await click('camp-heal');await approve();}
   else if(type==='treasure'){await click('treasure');await approve();}
   else if(type==='event'){await page.locator('[data-action="event-choice"]:not(:disabled)').first().click();await approve();}
  }
  else throw Error(`Unexpected empty-run phase ${phase}`);
 }
 check(await page.evaluate(()=>window.__mindrealm.getState().phase==='lost'),'未部署防线实际突破导致失败结算');
 await page.screenshot({path:'release-loss-summary.png'});
 const profile=await page.evaluate(()=>window.__mindrealm.getProfile());check(profile.runs===1,'失败结算记忆碎片只结算一次');await click('menu');await click('continue');check(await page.evaluate(p=>window.__mindrealm.getProfile().runs===p.runs,profile),'继续失败结算不会重复发奖');
 check(errors.length===0,'发布版无脚本错误');check(badRequests.length===0,`离线资源完整 ${badRequests.join(';')}`);
 return{status:'MINDREALM_PORTABLE_BROWSER_OK',checks,errors,badRequests};
}
