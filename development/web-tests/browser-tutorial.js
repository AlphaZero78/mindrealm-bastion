async page=>{
 const url=new URL(page.url());
 if(!['127.0.0.1','localhost'].includes(url.hostname)||url.port==='4173'||url.searchParams.get('qa')!=='1')throw Error('Use the isolated development server.');
 const errors=[],checks=[];
 const onError=error=>errors.push(error.message);page.on('pageerror',onError);
 const check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
 const idle=()=>page.waitForFunction(()=>window.__mindrealm&&!window.__mindrealm.transitions.active&&!window.__mindrealm.dialogs.active);
 const click=async selector=>{await idle();await page.locator(selector).first().click();await idle();};
 const step=async id=>page.locator(`[data-tutorial-step="${id}"]`).waitFor();
 const point=async()=>{
  await page.waitForFunction(()=>{const dot=document.querySelector('.tutorial-cell-point');return dot&&!dot.hasAttribute('hidden');});
  const at=await page.locator('.tutorial-cell-point').evaluate(dot=>{
   const p=new DOMPoint(Number(dot.getAttribute('cx')),Number(dot.getAttribute('cy'))).matrixTransform(dot.getScreenCTM());return{x:p.x,y:p.y};
  });
  await page.mouse.click(at.x,at.y);await idle();
 };
 try{
  await page.setViewportSize({width:1440,height:900});await page.reload();await idle();
  await page.evaluate(async()=>{
   const q=window.__mindrealm,R=await import('/web/core/state.js'),player=R.newRun('tutorial-preserves-this-run');
   q.store.save(player);q.getProfile().fragments=37;q.store.saveProfile(q.getProfile());q.store.saveSettings(q.getSettings());
   const snapshot=()=>JSON.stringify({run:q.store.load().state,profile:q.store.loadProfile(),settings:q.store.loadSettings()});
   window.__tutorialAudit={before:snapshot(),snapshot,writes:[],original:{}};
   for(const method of ['save','saveProfile','saveSettings','clear']){
    const original=q.store[method];window.__tutorialAudit.original[method]=original;
    q.store[method]=(...args)=>{window.__tutorialAudit.writes.push(method);return original(...args);};
   }
   q.render();
  });
  check(await page.locator('[data-action="tutorial"]').isVisible(),'main menu has a tutorial entry');
  await click('[data-action="tutorial"]');await step('intro');
  const firstMap=await page.evaluate(()=>{const s=window.__mindrealm.getState();return JSON.stringify({terrain:s.terrain,map:s.maps[0],units:s.units});});
  await click('[data-tutorial-action="restart"]');await step('intro');
  check(firstMap===await page.evaluate(()=>{const s=window.__mindrealm.getState();return JSON.stringify({terrain:s.terrain,map:s.maps[0],units:s.units});}),'restart restores the same map, route and units');
  await click('[data-tutorial-action="exit"]');
  check(await page.locator('[data-action="continue"]').isEnabled(),'exit keeps the existing expedition available');
  await click('[data-action="tutorial"]');await step('intro');await click('[data-tutorial-action="next"]');await step('deploy-melee');
  await click('[data-action="select-unit"][data-uid="u1"]');
  const wrong=await page.evaluate(()=>{const f=window.__mindrealm.field,p=f.project(12.5,18.5,0),r=f.canvas.getBoundingClientRect();return{x:r.x+p.x,y:r.y+p.y};});
  await page.mouse.click(wrong.x,wrong.y);
  check(await page.evaluate(()=>window.__mindrealm.getState().units[0].x===null&&window.__mindrealm.getState().focus===40),'wrong deployment leaves resources and the unit unchanged');
  await page.keyboard.press('Escape');
  check(await page.evaluate(()=>window.__mindrealm.getContext().deployUid===null&&window.__mindrealm.getTutorial().step==='deploy-melee'),'deployment cancellation keeps the current lesson');
  await click('[data-action="select-unit"][data-uid="u1"]');await point();await step('deploy-ranged');
  await click('[data-action="select-unit"][data-uid="u2"]');await point();await step('terrain');
  check(await page.evaluate(()=>{const s=window.__mindrealm.getState();return s.units[0].x===20&&s.units[0].z===25&&s.units[1].x===16&&s.units[1].z===24;}),'both highlighted placements use the real deployment rules');
  await page.setViewportSize({width:960,height:540});await point();
  check(await page.evaluate(()=>window.__mindrealm.getState().focus===40&&window.__mindrealm.getContext().terrainBatch?.cost===5),'one-cell terrain preview stays unpaid');
  await click('[data-action="terrain-commit"]');
  check(await page.locator('.modal').isVisible()&&await page.locator('#tutorial-root').evaluate(root=>getComputedStyle(root).visibility==='hidden'),'small-window confirmation remains unobstructed');
  await click('.modal-footer button:first-child');
  check(await page.evaluate(()=>window.__mindrealm.getState().focus===40&&!!window.__mindrealm.getContext().terrainBatch),'cancelled confirmation keeps its editable draft');
  await click('[data-action="terrain-commit"]');await click('.modal-footer .primary');await step('start');
  check(await page.evaluate(()=>{const s=window.__mindrealm.getState();return s.focus===35&&s.terrain.cells[24*41+18].h===1;}),'terrain applies once and costs five focus');
  await page.setViewportSize({width:1440,height:900});
  await click('[data-action="start"]');await click('.modal-footer .primary');await step('battle');
  await click('[data-action="pause"]');
  check(await page.evaluate(()=>window.__mindrealm.getContext().paused&&window.__mindrealm.getTutorial().hasPaused),'pause is available in the guided battle');
  await click('[data-action="speed"][data-speed="2"]');await click('[data-action="pause"]');
  check(await page.evaluate(()=>window.__mindrealm.getContext().speed===2&&window.__mindrealm.getTutorial().hasChangedSpeed),'double speed resumes real-time combat');
  await page.waitForFunction(()=>window.__mindrealm.getState().phase!=='battle',null,{timeout:60000});await step('reward');
  check(await page.evaluate(()=>{const s=window.__mindrealm.getState();return s.battle.total===6&&s.battle.spawned===6&&s.battle.result==='won'&&s.rewardQueue.length===1;}),'six-enemy battle wins and gives one short reward choice');
  await click('[data-action="reward"]');await step('route');
  await page.screenshot({path:'tutorial-route.jpg',type:'jpeg',quality:78});
  await click('[data-action="map-node"][data-id="tutorial-camp"]');await step('camp');
  await click('[data-action="camp-heal"]');await click('.modal-footer .primary');await step('done');
  check(await page.evaluate(()=>window.__mindrealm.getState().spirit===100),'camp recovery completes the tutorial');
  await page.screenshot({path:'tutorial-complete.jpg',type:'jpeg',quality:78});
  await click('[data-tutorial-action="finish"]');
  const preserved=await page.evaluate(()=>{const a=window.__tutorialAudit;return{same:a.before===a.snapshot(),writes:a.writes,session:window.__mindrealm.getTutorial()};});
  check(preserved.same&&preserved.writes.length===0&&preserved.session===null,'all tutorial outcomes leave run, profile and settings untouched');
  await page.evaluate(()=>{const q=window.__mindrealm;for(const [name,fn]of Object.entries(window.__tutorialAudit.original))q.store[name]=fn;});
  await click('[data-action="continue"]');
  check(await page.evaluate(()=>window.__mindrealm.getState().seed==='tutorial-preserves-this-run'),'continue restores the original expedition');
  check(errors.length===0,'guided flow has no page errors');
  return{status:'GUIDED_TUTORIAL_BROWSER_OK',checks,errors,preserved};
 }finally{page.off('pageerror',onError);}
}
