async page=>{
 const url=new URL(page.url());if(url.searchParams.get('qa')!=='1'||url.port==='4173')throw Error('Use isolated QA storage');
 const issues=[],layouts=[],branches=[];page.on('pageerror',e=>issues.push(e.message));page.on('console',m=>{if(['error','warning'].includes(m.type()))issues.push(m.text());});page.on('response',r=>{if(r.status()>=400)issues.push(`${r.status()} ${r.url()}`);});
 await page.reload();await page.waitForFunction(()=>window.__mindrealm?.field.realtime?.ready);
 const ids=await page.evaluate(async()=>Object.keys((await import('/web/core/content.js')).events));
 const load=async(id,index=0)=>page.evaluate(async({id,index})=>{const R=await import('/web/core/state.js'),C=await import('/web/core/content.js'),I=await import('/web/core/inventory.js'),s=R.newRun('scene:'+id);R.chooseNexus(s,s.nexus[0].options[0]);s.act=C.events[id].act-1;const n=s.maps[s.act].nodes.find(n=>n.floor===1);n.type='event';n.event=id;s.nextNodes=[n.id];R.enterNode(s,n.id);s.depth=5;s.spirit=s.maxSpirit-20;s.focus=500;for(const u of s.units)u.hp*=.6;I.addItem(s,'clarity');const q=window.__mindrealm;q.getSettings().reducedMotion=true;q.getSettings().tutorial=false;q.getSettings().uiScale=1;q.loadState(s);return C.events[id].choices.length;},{id,index});
 const idle=()=>page.waitForFunction(()=>!window.__mindrealm.dialogs.active&&!window.__mindrealm.transitions.active&&window.__mindrealm.dialogs.animations.size===0);
 const clipped=()=>page.evaluate(()=>[...document.querySelectorAll('.event-story,.event-choice,.event-outcome,.resource.depth')].flatMap(el=>{const r=el.getBoundingClientRect();return r.left<-.5||r.right>innerWidth+.5||r.top<-.5||r.bottom>innerHeight+.5||el.scrollHeight>el.clientHeight+2?[{class:el.className,rect:r.toJSON(),content:el.scrollHeight,client:el.clientHeight}]:[];}));
 for(const id of ids){
  const count=await load(id);await idle();await page.waitForFunction(()=>document.querySelector('.event-cg')?.complete&&document.querySelector('.event-cg')?.naturalWidth>0);
  for(const size of [{width:1920,height:1080},{width:1440,height:900},{width:960,height:540}])for(const scale of[1,1.25,1.5]){
   await page.setViewportSize(size);await page.evaluate(scale=>{window.__mindrealm.getSettings().uiScale=scale;window.__mindrealm.render();},scale);await idle();
   const overflow=await clipped();if(overflow.length)throw Error(JSON.stringify({id,size,scale,overflow}));
   if(await page.locator('[data-action="event-choice"]').count()!==count)throw Error('Choices missing '+id);
   layouts.push({id,width:size.width,scale});
  }
  await page.locator('.event-cg').evaluate(image=>image.decode());await page.screenshot({path:`mindrealm-realtime-art/events/${id}-960.png`});
  for(let index=0;index<count;index++){
   await page.setViewportSize({width:1440,height:900});await load(id,index);await idle();
   const before=await page.evaluate(()=>JSON.stringify(window.__mindrealm.getState()));
   await page.locator(`[data-action="event-choice"][data-index="${index}"]`).click();await idle();await page.locator('.modal-footer button').first().click();await idle();
   if(before!==await page.evaluate(()=>JSON.stringify(window.__mindrealm.getState())))throw Error('Cancel mutated '+id);
   await page.locator(`[data-action="event-choice"][data-index="${index}"]`).click();await idle();await page.locator('.modal-footer .primary').click();await idle();
   if(await page.locator('[data-action="event-choice"]').count())throw Error('Outcome still offers choices '+id);
   if(!(await page.locator('[data-action="event-continue"]').isVisible()))throw Error('Missing continuation '+id);
   if((await clipped()).length)throw Error('Outcome clips '+id);
   const result=await page.evaluate(()=>{const q=window.__mindrealm,state=q.getState(),load=q.store.load();if(!load.ok)throw Error('Result save missing');const before=JSON.stringify(state.currentNode.eventData.outcome);q.loadState(load.state);return {same:before===JSON.stringify(q.getState().currentNode.eventData.outcome),focus:state.focus,outcome:state.currentNode.eventData.outcome.index};});
   if(!result.same||result.outcome!==index)throw Error('Outcome reload mismatch '+id);
   if(id==='noise_market'&&index===0){await page.locator('.event-cg').evaluate(image=>image.decode());await page.screenshot({path:'mindrealm-realtime-art/event-outcome-1440.png'});}
   await page.locator('[data-action="event-continue"]').click();await idle();if(!await page.evaluate(()=>['map','reward'].includes(window.__mindrealm.getState().phase)))throw Error('Event cannot complete '+id);
   branches.push({id,index});
  }
 }
 await page.setViewportSize({width:1440,height:900});await load('noise_market');await idle();await page.locator('.event-cg').evaluate(image=>image.decode());await page.screenshot({path:'mindrealm-realtime-art/event-choice-1440.png'});
 if(issues.length)throw Error(JSON.stringify(issues));return {ok:true,events:ids.length,layouts:layouts.length,branches:branches.length,cancellations:branches.length,issues};
}
