async page=>{
 const url=new URL(page.url());if(!['localhost','127.0.0.1'].includes(url.hostname)||url.port==='4173'||url.searchParams.get('qa')!=='1')throw Error('Use isolated QA storage');
 const issues=[],checks=[];page.on('pageerror',e=>issues.push(e.message));await page.waitForFunction(()=>window.__mindrealm);
 const load=async id=>page.evaluate(async id=>{
  const R=await import('/web/core/state.js'),C=await import('/web/core/content.js'),Rules=await import('/web/core/rules.js'),I=await import('/web/core/inventory.js'),s=R.newRun(`event-ui:${id}`);
  R.chooseNexus(s,s.nexus[0].options[0]);s.act=C.events[id].act-1;s.nexus.forEach(n=>n.skipped=!n.choice);s.depth=6;s.focus=1000;s.bandwidth=30;s.resistance=20;s.spirit=60;s.inventory.capacity=14;s.contentPool.events=Object.keys(C.events);
  s.eventClues=C.events[id].choices.flatMap(c=>c.effects.consume_clue?[c.effects.consume_clue]:[]);s.units.slice(0,3).forEach(u=>{u.tier=2;u.branch='A';});for(const u of s.units)u.hp=Rules.unitStats(s,u).maxHp*.4;I.addItem(s,'clarity');
  const node=s.maps[s.act].nodes.find(n=>n.floor===1);Object.assign(node,{type:'unknown',revealType:'event',event:id});s.nextNodes=[node.id];R.enterNode(s,node.id);if(s.currentNode.eventData?.id!==id)throw Error('Event filtered: '+id);
  __mindrealm.getSettings().reducedMotion=true;__mindrealm.getSettings().tutorial=false;__mindrealm.loadState(s);__mindrealm.transitions.finish();return id;
 },id);
 const idle=async()=>{await page.waitForFunction(()=>!__mindrealm.transitions.active&&!__mindrealm.dialogs.active);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));};
 const ids=await page.evaluate(async()=>Object.keys((await import('/web/core/content.js')).events));
 await page.setViewportSize({width:1440,height:900});
 for(const id of ids){await load(id);await idle();const check=await page.evaluate(async()=>{
  const {eventLayoutIssues}=await import('/development/web-tests/helpers/event-ui-layout.mjs');const buttons=[...document.querySelectorAll('[data-action="event-choice"]')],exit=document.querySelector('[data-action="event-decline"]'),r=exit?.getBoundingClientRect();
  return {choices:buttons.length,enabled:buttons.every(b=>!b.disabled),exitVisible:r&&r.top>=0&&r.bottom<=innerHeight,layout:eventLayoutIssues()};
 });if(check.choices!==2||!check.enabled||!check.exitVisible||check.layout.length)throw Error(JSON.stringify({id,check}));checks.push({id,viewport:1440});}
 for(const id of ['noise_market','defense_clinic','control_key']){
  await page.setViewportSize({width:960,height:540});await load(id);await idle();
  const layout=await page.evaluate(async()=>{const {eventLayoutIssues}=await import('/development/web-tests/helpers/event-ui-layout.mjs');return eventLayoutIssues();});if(layout.length)throw Error(JSON.stringify({id,layout}));checks.push({id,viewport:960});
 }
 await page.setViewportSize({width:1280,height:800});await load('defense_clinic');await idle();await page.screenshot({path:'output/playwright/event-clinic.jpg',type:'jpeg',quality:82});
 const before=await page.evaluate(()=>JSON.stringify(__mindrealm.getState()));
 const choice=page.locator('[data-action="event-choice"][data-index="1"]');await choice.click();await page.keyboard.press('Escape');
 if(await page.evaluate(()=>JSON.stringify(__mindrealm.getState()))!==before)throw Error('Cancelling event confirmation changed state');
 await choice.click();await choice.click();await page.locator('[data-action="event-continue"]').waitFor();
 const chosen=await page.evaluate(()=>({id:__mindrealm.getState().currentNode.eventData.id,outcome:__mindrealm.getState().currentNode.eventData.outcome,loaded:__mindrealm.store.load().state?.currentNode.eventData.outcome}));if(JSON.stringify(chosen.outcome)!==JSON.stringify(chosen.loaded))throw Error('Event outcome was not saved');
 await page.locator('[data-action="event-continue"]').click();await idle();
 await load('control_key');await idle();const resources=await page.evaluate(()=>{const s=__mindrealm.getState();return JSON.stringify([s.focus,s.spirit,s.maxSpirit,s.units,s.inventory,s.relics]);});await page.locator('[data-action="event-decline"]').click();await idle();
 if(await page.evaluate(()=>{const s=__mindrealm.getState();return JSON.stringify([s.focus,s.spirit,s.maxSpirit,s.units,s.inventory,s.relics]);})!==resources)throw Error('Declining consumed resources');
 const declined=await page.evaluate(()=>__mindrealm.store.load().state.currentNode.eventData.outcome.declined);if(!declined)throw Error('Decline was not saved');
 await page.locator('[data-action="event-continue"]').click();await idle();if(await page.evaluate(()=>__mindrealm.getState().phase)!=='map')throw Error('Decline did not return to route');
 if(issues.length)throw Error(JSON.stringify(issues));return {status:'EVENT_VARIETY_BROWSER_OK',checks,confirmationCancel:true,chosen,declineSaved:true,issues};
}
