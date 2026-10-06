async page=>{
 const url=new URL(page.url());if(url.searchParams.get('qa')!=='1'||url.port==='4173')throw Error('Use isolated QA storage');
 const issues=[],layouts=[],branches=[];page.on('pageerror',e=>issues.push(e.message));page.on('console',m=>{if(['error','warning'].includes(m.type()))issues.push(m.text());});page.on('response',r=>{if(r.status()>=400)issues.push(`${r.status()} ${r.url()}`);});
 await page.reload();await page.waitForFunction(()=>window.__mindrealm?.field.realtime?.ready);
 const act=url.searchParams.has('qaAct')?Number(url.searchParams.get('qaAct')):0;if(![0,1,2,3].includes(act))throw Error('qaAct must be 1, 2 or 3');
 const ids=await page.evaluate(async act=>Object.values((await import('/web/core/content.js')).events).filter(event=>!act||event.act===act).map(event=>event.id),act);
 const load=async(id,index=0)=>page.evaluate(async({id,index})=>{const R=await import('/web/core/state.js'),C=await import('/web/core/content.js'),I=await import('/web/core/inventory.js'),Rules=await import('/web/core/rules.js'),E=await import('/web/core/event-redesign.js'),s=R.newRun('scene:'+id);s.nexus.forEach(n=>n.skipped=true);s.phase='map';s.act=C.events[id].act-1;s.depth=6;s.spirit=80;s.focus=1000;s.resistance=20;s.eventClues=Object.keys(E.eventClues);R.addUnit(s,'memory_mechanic');R.addUnit(s,'frequency_choir');for(const [i,u]of s.units.entries()){if(i<3){u.tier=2;u.branch='A';}u.hp=Rules.unitStats(s,u).maxHp*.6;}I.addItem(s,'clarity');const n=s.maps[s.act].nodes.find(n=>n.floor===1);n.type='event';n.event=id;s.nextNodes=[n.id];R.enterNode(s,n.id);const q=window.__mindrealm;q.getSettings().reducedMotion=true;q.getSettings().tutorial=false;q.getSettings().uiScale=1;q.loadState(s);return C.events[id].choices.length;},{id,index});
 const idle=()=>page.waitForFunction(()=>!window.__mindrealm.dialogs.active&&!window.__mindrealm.transitions.active&&window.__mindrealm.dialogs.animations.size===0);
 const clipped=()=>page.evaluate(async()=>{const {eventLayoutIssues}=await import('/development/web-tests/helpers/event-ui-layout.mjs');return eventLayoutIssues();});
 for(const id of ids){
  const count=await load(id);await idle();await page.waitForFunction(()=>document.querySelector('.event-cg')?.complete&&document.querySelector('.event-cg')?.naturalWidth>0);
  for(const size of [{width:1920,height:1080},{width:1440,height:900},{width:960,height:540}])for(const scale of[1,1.25,1.5]){
   await page.setViewportSize(size);await page.evaluate(scale=>{window.__mindrealm.getSettings().uiScale=scale;window.__mindrealm.render();},scale);await idle();
   const overflow=await clipped();if(overflow.length)throw Error(JSON.stringify({id,size,scale,overflow}));
   if(await page.locator('[data-action="event-choice"]').count()!==count)throw Error('Choices missing '+id);
   const sizing=await page.evaluate(async()=>(await import('/development/web-tests/helpers/event-ui-layout.mjs')).eventUISizing());
   const first=page.locator('[data-action="event-choice"]:not(:disabled)').first();await first.click();await idle();
   if((await clipped()).length||!await page.evaluate(async before=>{const m=await import('/development/web-tests/helpers/event-ui-layout.mjs');return m.eventUISizingStable(before,m.eventUISizing());},sizing))throw Error('Expanded choice changed UI size '+id);
   await first.press('Escape');await idle();
   layouts.push({id,width:size.width,scale});
  }
  await page.locator('.event-cg').evaluate(image=>image.decode());await page.waitForFunction(()=>getComputedStyle(document.querySelector('#toast')).opacity==='0');await page.screenshot({path:`mindrealm-realtime-art/events/${id}-960.png`});
  for(let index=0;index<count;index++){
   await page.setViewportSize({width:1440,height:900});await load(id,index);await idle();
   const before=await page.evaluate(()=>JSON.stringify(window.__mindrealm.getState()));
   const choice=page.locator(`[data-action="event-choice"][data-index="${index}"]`);
   await choice.click();await idle();
   if(before!==await page.evaluate(()=>JSON.stringify(window.__mindrealm.getState()))||await page.locator('.modal').count()||!await page.locator('.event-confirmation:not([hidden])').isVisible())throw Error('First click must only expand confirmation '+id);
   await choice.press('Escape');await idle();
   if(before!==await page.evaluate(()=>JSON.stringify(window.__mindrealm.getState())))throw Error('Cancel mutated '+id);
   await choice.click();await idle();await choice.click();await idle();
   if(await page.locator('[data-action="event-choice"]').count())throw Error('Outcome still offers choices '+id);
   if(!(await page.locator('[data-action="event-continue"]').isVisible()))throw Error('Missing continuation '+id);
   if((await clipped()).length)throw Error('Outcome clips '+id);
   const result=await page.evaluate(()=>{const q=window.__mindrealm,state=q.getState(),load=q.store.load();if(!load.ok)throw Error('Result save missing');const before=JSON.stringify(state.currentNode.eventData.outcome);q.loadState(load.state);return {same:before===JSON.stringify(q.getState().currentNode.eventData.outcome),focus:state.focus,outcome:state.currentNode.eventData.outcome.index};});
   if(!result.same||result.outcome!==index)throw Error('Outcome reload mismatch '+id);
   if(id==='noise_market'&&index===0){await page.locator('.event-cg').evaluate(image=>image.decode());await page.screenshot({path:'mindrealm-realtime-art/event-outcome-1440.png'});}
   await page.locator('[data-action="event-continue"]').click();await idle();if(!await page.evaluate(()=>['map','reward','prep'].includes(window.__mindrealm.getState().phase)))throw Error('Event cannot complete '+id);
   branches.push({id,index});
  }
 }
 await page.setViewportSize({width:1440,height:900});await load('noise_market');await idle();await page.locator('.event-cg').evaluate(image=>image.decode());await page.screenshot({path:'mindrealm-realtime-art/event-choice-1440.png'});
 if(issues.length)throw Error(JSON.stringify(issues));return {ok:true,events:ids.length,layouts:layouts.length,branches:branches.length,cancellations:branches.length,issues};
}
