// Isolated QA only. Checks layout and real pointer input for the compact battle dock.
async page=>{
 const url=new URL(page.url());if(!['127.0.0.1','localhost'].includes(url.hostname)||url.port==='4173'||url.searchParams.get('qa')!=='1')throw Error('Use isolated QA storage');
 const errors=[],layouts=[],checks=[],onError=e=>errors.push(e.message);page.on('pageerror',onError);
 const check=(ok,name)=>{if(!ok)throw Error(name);checks.push(name);};
 const idle=()=>page.waitForFunction(()=>{const q=window.__mindrealm;return q&&!q.transitions.active&&!q.dialogs.active&&q.dialogs.animations.size===0;});
 const click=async(action,extra='')=>{await idle();await page.locator(`[data-action="${action}"]${extra}`).first().click();await idle();};
 const geometry=()=>page.evaluate(()=>{
  const rect=el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};},footer=document.querySelector('.battle-dock'),f=rect(footer),canvas=rect(document.querySelector('#battlefield')),viewport=rect(document.querySelector('#battle-viewport'));
  const controls=[...footer.querySelectorAll('button,select')].filter(el=>!el.closest('.warehouse-row')&&el.getBoundingClientRect().width>0).map(el=>({action:el.dataset.action,disabled:el.disabled,rect:rect(el)}));
  const clipped=controls.filter(({rect:r})=>r.x<f.x-.5||r.right>f.right+.5||r.y<f.y-.5||r.bottom>f.bottom+.5);
  const overlaps=[];for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++){const a=controls[i].rect,b=controls[j].rect;if(Math.min(a.right,b.right)-Math.max(a.x,b.x)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1)overlaps.push([controls[i].action,controls[j].action]);}
  return{width:innerWidth,height:innerHeight,scale:window.__mindrealm.getSettings().uiScale,mode:window.__mindrealm.getContext().toolTab,collapsed:window.__mindrealm.getContext().footerCollapsed,footer:f,canvas,viewport,clipped,overlaps,statusCount:document.querySelectorAll('#placement-status').length,overflow:document.documentElement.scrollWidth>innerWidth+1};
 });
 const inspect=async label=>{const data=await geometry();check(!data.clipped.length&&!data.overlaps.length&&!data.overflow&&data.statusCount===1,label+' keeps all controls separate and on screen');check(Math.abs(data.canvas.y-data.viewport.y)<1&&Math.abs(data.canvas.h-data.viewport.h)<1,label+' uses the full unobscured battlefield');layouts.push({label,...data});return data;};
 try{
  await page.reload();await idle();
  await page.evaluate(async()=>{const q=window.__mindrealm,R=await import('/web/core/state.js'),s=R.newRun('compact-dock-acceptance');R.chooseNexus(s,s.nexus[0].options[0]);R.enterNode(s,R.availableNodes(s)[0].id);q.getSettings().reducedMotion=true;q.loadState(s);});await idle();
  for(const {width,height}of [{width:1920,height:1080},{width:1366,height:768},{width:960,height:540}])for(const scale of [1,1.25,1.5]){
   await page.setViewportSize({width,height});await page.evaluate(scale=>{const q=window.__mindrealm;q.getSettings().uiScale=scale;q.render();},scale);await idle();
   await click('tab-units');const expanded=await inspect(`${width}/${scale}/units`);
   await click('tab-terrain');await inspect(`${width}/${scale}/terrain`);
   await click('toggle-footer');const collapsed=await inspect(`${width}/${scale}/collapsed`);
   check(collapsed.footer.h<expanded.footer.h*.5,`${width}/${scale}: collapsed dock occupies less than half the height`);
   check(await page.locator('.battle-sidebar #placement-status').count()===1,`${width}/${scale}: collapsed feedback moves into the sidebar`);
  }
  await page.setViewportSize({width:1280,height:800});
  await page.evaluate(async()=>{const q=window.__mindrealm,F=await import('/development/web-tests/helpers/battle-fixture.mjs'),R=await import('/web/core/state.js'),s=F.fixture('compact-dock-input',{revision:5});s.focus=100;s.bandwidth=40;R.addUnit(s,'anchor_bulwark');R.addUnit(s,'pulse_array');q.getSettings().uiScale=1;q.loadState(s);q.field.camera.x=20;q.field.camera.z=21;q.field.zoomLevel=1.4;q.field.updateScale();q.field.dirty=true;});await idle();
  await click('tab-units');check(await page.locator('#footer-drawer').isVisible(),'selecting a mode opens the collapsed drawer');
  await click('select-unit');const before=await geometry();
  const spot=async(x,z)=>page.evaluate(({x,z})=>{const f=window.__mindrealm.field,r=f.canvas.getBoundingClientRect(),p=f.project(x+.5,z+.5,f.heightAt(x,z));return{x:r.x+p.x,y:r.y+p.y,canvasX:p.x,canvasY:p.y};},{x,z});
  const core=await page.evaluate(()=>window.__mindrealm.getState().terrain.core);
  let p=await spot(core.x,core.z);await page.mouse.move(p.x,p.y);await page.mouse.click(p.x,p.y);await idle();
  check(await page.evaluate(()=>window.__mindrealm.getState().units[0].x===null),'illegal deployment keeps the unit in the warehouse');
  const after=await geometry();check(before.canvas.y===after.canvas.y&&before.canvas.h===after.canvas.h,'placement feedback never changes the picking rectangle');
  await page.keyboard.press('Escape');
  p=await spot(18,18);await page.locator('.unit-card').first().dragTo(page.locator('#battlefield'),{targetPosition:{x:p.canvasX,y:p.canvasY}});await idle();
  check(await page.evaluate(()=>{const u=window.__mindrealm.getState().units[0];return u.x===18&&u.z===18;}),'compact cards still support native drag deployment');
  await click('warehouse-tab','[data-tab="deployed"]');check(await page.locator('.unit-card').count()===1,'deployed filter selects only the placed construct');
  await click('warehouse-tab','[data-tab="all"]');check(await page.locator('.unit-card').count()===2,'all filter restores both constructs');
  await page.screenshot({path:'dock-units-1280.jpg',type:'jpeg',quality:80});
  await click('tab-terrain');await page.locator('[data-action="brush"]').selectOption('single');p=await spot(16,18);await page.mouse.click(p.x,p.y);await idle();
  check(await page.evaluate(()=>window.__mindrealm.getContext().terrainBatch?.cost===5&&window.__mindrealm.getState().focus===100),'terrain draft preserves focus until confirmation');
  await page.screenshot({path:'dock-terrain-1280.jpg',type:'jpeg',quality:80});
  await click('terrain-commit');await page.locator('.modal-footer button:first-child').click();await idle();
  check(await page.evaluate(()=>window.__mindrealm.getContext().terrainCommands.length===1),'cancel confirmation keeps the draft');
  await click('terrain-commit');await page.locator('.modal-footer .primary').click();await idle();
  check(await page.evaluate(()=>window.__mindrealm.getState().focus===95),'terrain confirmation charges the displayed five focus');
  await click('undo');check(await page.evaluate(()=>window.__mindrealm.getState().focus===100),'undo refunds the confirmed terrain change');
  await click('tab-units');await click('start');await page.locator('.modal-footer .primary').click();await idle();await click('pause');
  const battle=await inspect('actual-battle');check(battle.collapsed&&battle.footer.h<55,'actual battle uses one shallow control row');
  await click('speed','[data-speed="3"]');check(await page.evaluate(()=>window.__mindrealm.getContext().speed===3&&window.__mindrealm.getContext().paused),'speed buttons preserve paused combat');
  check(await page.locator('[data-action="tab-terrain"]').isDisabled(),'battle keeps terrain editing locked');
  await page.screenshot({path:'dock-battle-1280.jpg',type:'jpeg',quality:80});
  await click('tab-units');check(await page.locator('#footer-drawer').isVisible(),'battle allows inspection through the expanded unit drawer');
  await click('toggle-footer');await click('log');check(await page.locator('#dialog-title').textContent()==='战斗与精神压力记录','compact log entry opens the same battle records');await page.locator('[data-modal="close"]').click();await idle();
  await click('build');check(await page.locator('#dialog-title').textContent()==='当前心智构筑','compact build entry opens the same build details');await page.locator('[data-modal="close"]').click();await idle();
  check(!errors.length,'compact dock has no page errors');return{status:'COMPACT_BATTLE_DOCK_OK',checks,layouts,errors};
 }finally{page.off('pageerror',onError);}
}
