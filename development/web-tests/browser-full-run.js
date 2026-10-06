async page=>{
 page.setDefaultTimeout(10000);const errors=[],onPageError=x=>errors.push(x.message),onConsole=x=>{if(x.type()==='error')errors.push(x.text());};page.on('pageerror',onPageError);page.on('console',onConsole);
 const config=await page.evaluate(()=>({hostname:location.hostname,port:location.port,query:Object.fromEntries(new URLSearchParams(location.search))}));if(!['127.0.0.1','localhost'].includes(config.hostname)||config.port==='4173'||config.query.qa!=='1')throw Error('Full-run browser audit requires an isolated loopback ?qa=1 page, never the player server');
 const pressure=Number(config.query.pressure||0),seed=config.query.seed||'reference-0';
 if(![0,10].includes(pressure))throw Error('This full-run audit covers pressure 0 or 10');
 const artifact=name=>`pressure-${pressure}-${name}.png`;
 const capture=async name=>{await page.waitForFunction(()=>!window.__mindrealm.transitions.active&&!window.__mindrealm.dialogs.active&&window.__mindrealm.dialogs.animations.size===0);await page.screenshot({path:artifact(name)});};
 const verifyBossMap=async act=>{
  const original=page.viewportSize(),layouts=[];
  for(const size of [{width:1920,height:1080},{width:960,height:540}]){
   await page.setViewportSize(size);await page.waitForFunction(()=>!window.__mindrealm.transitions.active&&!window.__mindrealm.dialogs.active&&window.__mindrealm.dialogs.animations.size===0);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.mouse.move(5,5);const node=page.locator('.map-node.available').first();await node.hover();await page.waitForFunction(()=>!document.querySelector('#route-tooltip').hidden);
   const layout=await page.evaluate(()=>{const detail=document.querySelector('#route-tooltip'),rect=detail.getBoundingClientRect();return{width:innerWidth,tooltipVisible:!detail.hidden,left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom};});
   if(!layout.tooltipVisible||layout.left<0||layout.right>size.width+1||layout.top<0||layout.bottom>size.height+1)throw Error(`Map tooltip exceeds viewport: ${JSON.stringify(layout)}`);
   await capture(`full-act-${act+1}-boss-map-${size.width}`);
   await page.locator('[data-action="boss-intel"]').click();await page.locator('#modal-root [data-boss-preview="true"]').click();
   const scroll=await page.locator('.modal').evaluate(element=>{element.scrollTop=element.scrollHeight;return{height:element.clientHeight,content:element.scrollHeight,end:element.scrollTop};});
   if(scroll.content>scroll.height+1&&scroll.end<=0)throw Error('Boss intel cannot scroll');
   await page.locator('[data-modal="close"]').click();layouts.push({...layout,modal:scroll});
  }
  await page.setViewportSize(original);await page.evaluate(layouts=>{window.__fullRunAudit.layout??=[];window.__fullRunAudit.layout.push(...layouts);},layouts);
 };
 const click=action=>page.locator(`[data-action="${action}"]`).first().click();
 const approve=()=>page.locator('.modal-footer .primary').click();
 const sampleActualAnimation=async(label,duration)=>{
  const sample=await page.evaluate(({label,duration})=>new Promise(resolve=>{
   const q=window.__mindrealm,start=performance.now(),startTime=q.getState().battle?.time,frames=[],actions={},types=new Set();let maxClockError=0;
   const tick=now=>{const state=q.getState(),battle=state.battle;if(state.phase!=='battle'||!battle){resolve({label,scope:'actual RAF after legal battle start; fixed-step shortcut excluded from this sample',ended:state.phase,wall:(now-start)/1000,frames,actions,types:[...types],maxClockError});return;}
    maxClockError=Math.max(maxClockError,Math.abs(q.field.entityMotion.snapshot().clock-Math.max(0,battle.time-(1-q.field.interpolation)*.05)*1000));
    for(const frame of q.field.entityFrames){actions[frame.action]=(actions[frame.action]||0)+1;types.add(frame.type);if(frame.variant?.startsWith('phase')||['attack','cast','death'].includes(frame.action)){const value={key:frame.key,type:frame.type,action:frame.action,pose:frame.pose,row:frame.row,variant:frame.variant,clock:frame.clock};if(frames.length<80&&!frames.some(f=>f.key===value.key&&f.action===value.action&&f.pose===value.pose&&f.variant===value.variant))frames.push(value);}}
    if(now-start<duration)requestAnimationFrame(tick);else resolve({label,scope:'actual RAF; fixed-step shortcut excluded from this sample',wall:(now-start)/1000,simulation:battle.time-startTime,frames,actions,types:[...types],maxClockError});
   };requestAnimationFrame(tick);
  }),{label,duration});
  if(sample.maxClockError>.001)throw Error(`Animation clock diverged during full run: ${JSON.stringify(sample)}`);
  await page.evaluate(sample=>{(window.__fullRunAudit.liveSamples??=[]).push(sample);},sample);return sample;
 };
 if(!await page.evaluate(()=>!!window.__fullRunAudit)){
  await page.waitForFunction(()=>window.__mindrealm);
  await page.setViewportSize({width:1920,height:1080});
  // Only unlock the isolated QA profile; the run itself starts through the UI.
  if(pressure)await page.evaluate(pressure=>{window.__mindrealm.getProfile().unlockedPressure=pressure;},pressure);
  await click('new');await page.locator('#seed-input').fill(seed);await page.locator('#pressure-input').selectOption(String(pressure));
  await capture('new-run');await approve();
  await page.evaluate(pressure=>{const state=window.__mindrealm.getState();if(state.pressureLevel!==pressure||state.difficultyRevision!==5)throw Error('UI did not create the requested new difficulty');window.__fullRunAudit={nodes:[],battles:[],errors:[]};},pressure);
 }
 const startedAct=await page.evaluate(()=>window.__mindrealm.getState().act);
 for(let steps=0;steps<140;steps++){
  const status=await page.evaluate(()=>{const s=window.__mindrealm.getState();return{phase:s.phase,act:s.act,floor:s.floor,node:s.currentNode?.type};});
  if(['won','lost'].includes(status.phase)||status.act>startedAct)break;
  if(status.phase==='interlude'){await page.locator('.act-passage-art').evaluate(image=>image.decode());const before=await page.evaluate(()=>window.__mindrealm.getState().act);await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,2400)));if(await page.evaluate(()=>window.__mindrealm.getState().phase)!=='interlude')throw Error('Chapter advanced without player entry');await capture(`full-act-${status.act+1}-passage`);await click('act-continue');if(await page.evaluate(()=>window.__mindrealm.getState().act)!==before+1)throw Error('Manual chapter entry failed');}
  else if(status.phase==='nexus'){const id=await page.evaluate(async()=>{const H=await import('/development/web-tests/helpers/reference-strategy.mjs');return H.chooseReferenceNexus(window.__mindrealm.getState());});await capture(`act-${status.act+1}-nexus`);await page.locator(`[data-action="nexus-gift"][data-id="${id}"]`).click();await approve();}
  else if(status.phase==='map'){
   await page.evaluate(async()=>{const q=window.__mindrealm,I=await import('/web/core/inventory.js'),H=await import('/development/web-tests/helpers/reference-strategy.mjs'),R=await import('/web/core/rules.js'),s=q.getState(),bag=I.inventoryStatus(s);if(bag.overflow)I.discardUnits(s,[...bag.all].sort((a,b)=>{const values={pulse_array:100,focus_rail:85,memory_mechanic:62,bandwidth_relay:110,phase_blade:50,frequency_choir:55,drone_loom:75,arc_mortar:70,resistance_beacon:25,anchor_bulwark:40,boundary_riveter:25,resonance_guard:25};const keep=u=>(values[u.type]||0)*u.tier**2*(R.onField(u)?1.5:1)*(u.hp>0?1:.6);return keep(a)-keep(b);}).slice(0,bag.overflow).map(u=>u.uid));H.referenceItems(s);q.render();});
   const id=await page.evaluate(async()=>{const R=await import('/web/core/state.js'),s=window.__mindrealm.getState();const value=n=>({camp:s.spirit<s.maxSpirit*.6?120:75,treasure:100,event:85,unknown:65,shop:s.focus>240?65:15,workshop:15,battle:45,elite:s.act===0?25:40,boss:50}[n.type]||0);return [...R.availableNodes(s)].sort((a,b)=>value(b)-value(a))[0].id;});
   if(await page.evaluate(id=>window.__mindrealm.getState().maps[window.__mindrealm.getState().act].nodes.find(node=>node.id===id)?.type==='boss',id))await verifyBossMap(status.act);
   await page.locator(`[data-action="map-node"][data-id="${id}"]`).click();
   await page.evaluate(()=>{const s=window.__mindrealm.getState();window.__fullRunAudit.nodes.push({act:s.act,floor:s.floor,type:s.currentNode.type,focus:s.focus,spirit:s.spirit});});
  }else if(status.phase==='prep'){
   await page.evaluate(async()=>{const q=window.__mindrealm,H=await import('/development/web-tests/helpers/reference-strategy.mjs');H.prepareReference(q.getState());q.render();});
   if(status.node==='boss')await capture(`full-act-${status.act+1}-boss-prep`);
   await click('start');await approve();
   if(config.query.entityAudit==='full'&&status.node!=='boss'&&!await page.evaluate(act=>window.__fullRunAudit.liveSamples?.some(s=>s.label===`act-${act+1}-ordinary`),status.act)){
    await page.locator('[data-action="speed"][data-speed="3"]').click();await sampleActualAnimation(`act-${status.act+1}-ordinary`,1500);if(await page.evaluate(()=>window.__mindrealm.getState().phase==='battle')){await click('pause');await capture(`full-act-${status.act+1}-live-animation`);await page.setViewportSize({width:960,height:540});await capture(`full-act-${status.act+1}-live-animation-960`);await page.setViewportSize({width:1920,height:1080});await click('pause');}
   }
   if(status.node==='boss'){
    await page.evaluate(async()=>{const q=window.__mindrealm,C=await import('/web/core/content.js');for(let i=0;i<1800&&q.getState().phase==='battle';i++){q.advance(.05);if(q.getState().battle?.enemies.some(e=>!e.dead&&C.enemies[e.type].kind==='boss'))break;}});
    if(config.query.entityAudit==='full'&&await page.evaluate(()=>window.__mindrealm.getState().phase==='battle')){await page.locator('[data-action="speed"][data-speed="3"]').click();await sampleActualAnimation(`act-${status.act+1}-boss`,1900);}
    if(await page.evaluate(()=>window.__mindrealm.getState().phase==='battle')){await click('pause');await capture(`full-act-${status.act+1}-boss-battle`);}
   }
   const result=await page.evaluate(async()=>{const q=window.__mindrealm,H=await import('/development/web-tests/helpers/reference-strategy.mjs');for(let i=0;i<720&&q.getState().phase==='battle';i++){H.referenceItems(q.getState());q.advance(.5);}q.render();const s=q.getState();return{phase:s.phase,act:s.act,floor:s.floor,completed:s.stats.completedNodes,spirit:s.spirit,focus:s.focus};});
   if(result.phase==='battle')throw Error(`Battle never ended: ${JSON.stringify(result)}`);
   await page.evaluate(result=>window.__fullRunAudit.battles.push(result),result);
  }else if(status.phase==='reward'){
   const id=await page.evaluate(async()=>{const H=await import('/development/web-tests/helpers/reference-strategy.mjs');return H.chooseReferenceReward(window.__mindrealm.getState());});
   if(id==='skip'){await click('item-skip');await approve();}else await page.locator(`[data-action="reward"][data-id="${id}"]`).click();
  }else if(status.phase==='node'){
   const decision=await page.evaluate(async()=>{
    const q=window.__mindrealm,s=q.getState(),R=await import('/web/core/rules.js'),Run=await import('/web/core/state.js'),node=s.currentNode,D=await import('/web/core/difficulty.js');
    const values={pulse_array:100,focus_rail:85,memory_mechanic:62,bandwidth_relay:110,phase_blade:50,frequency_choir:55,drone_loom:75,arc_mortar:70,resistance_beacon:25,anchor_bulwark:40,boundary_riveter:25,resonance_guard:25};
    const grow=u=>(values[u.type]||0)*(R.onField(u)?1.5:1)/(u.tier||1);
    const branch=u=>u.branch||(['pulse_array','focus_rail','phase_blade','bandwidth_relay','memory_mechanic','frequency_choir','resistance_beacon'].includes(u.type)?'A':'B');
    if(node.type==='camp'){
     if(s.spirit<s.maxSpirit*.65)return{action:'camp-heal'};
     const u=s.units.filter(u=>D.upgradeRequirement(s,u).ok&&u.hp>0).sort((a,b)=>grow(b)-grow(a))[0];
     if(u)return{action:'camp-upgrade',uid:u.uid,branch:branch(u)};
     const w=s.units.filter(u=>u.hp<R.unitStats(s,u).hp).sort((a,b)=>R.repairCost(s,b)-R.repairCost(s,a))[0];return w?{action:'camp-repair',uid:w.uid}:{action:'camp-heal'};
    }
    if(node.type==='workshop'){const u=s.units.find(u=>u.everDeployed&&u.hp<R.unitStats(s,u).hp*.65&&s.focus>R.repairCost(s,u)+20);return u?{action:'repair',uid:u.uid}:{action:'node-leave'};}
    if(node.type==='shop'){const u=node.stock.units.find(u=>!u.sold&&u.id==='bandwidth_relay');if(u&&s.units.filter(u=>u.type==='bandwidth_relay').length<1&&s.focus>=Run.servicePrice(s,80))return{action:'buy-unit',id:u.key};const relic=node.stock.relics.find(x=>!x.sold);if(s.focus>220&&relic)return{action:'buy-relic',id:relic.key};return{action:'node-leave'};}
    if(node.type==='treasure')return node.options.length?{action:'treasure',id:node.options[0]}:{action:'empty-treasure'};
    if(node.type==='event'){if(node.eventData.outcome)return{action:'event-continue'};const value=p=>!p?.canChoose?-Infinity:(p.effects.focus||0)+(p.effects.spirit||0)*(s.spirit<s.maxSpirit*.7?4:1)+(p.effects.bandwidth||0)*25+(p.effects.relic?80:0)+(p.effects.free_upgrade?80:0)+(p.effects.free_upgrades||0)*80+(p.effects.resistance||0)*5;const C=await import('/web/core/content.js');const choices=C.events[node.eventData.id].choices.map((_,index)=>({index,value:value(Run.eventPreview(s,index))}));return{action:'event-choice',index:choices.sort((a,b)=>b.value-a.value)[0].index};}
    throw Error(`Unknown service ${node.type}`);
   });
   const attrs=['uid','id','index'].filter(k=>decision[k]!==undefined).map(k=>`[data-${k}="${decision[k]}"]`).join('');
   await page.locator(`[data-action="${decision.action}"]${['camp-upgrade','camp-repair'].includes(decision.action)?'':attrs}`).first().click();
   if(['camp-upgrade','camp-repair'].includes(decision.action))await page.locator(`[data-camp-uid="${decision.uid}"]`).click();
   if(decision.action==='camp-upgrade')await page.locator(`[data-dialog-upgrade="${decision.branch}"]`).click();
   else if(decision.action==='event-choice')await page.locator(`[data-action="event-choice"]${attrs}`).click();
   else if(!['node-leave','empty-treasure','event-continue'].includes(decision.action))await approve();
  }else throw Error(`Unexpected phase ${status.phase}`);
 }
 await capture(`full-act-${startedAct+1}-end`);
 const result=await page.evaluate(errors=>{const q=window.__mindrealm,s=q.getState(),a=window.__fullRunAudit;a.errors.push(...errors);return{seed:s.seed,pressure:s.pressureLevel,difficultyRevision:s.difficultyRevision,phase:s.phase,act:s.act,floor:s.floor,completed:s.stats.completedNodes,bosses:s.stats.bosses,profile:q.getProfile(),audit:a,renderErrors:q.field.errors,audioErrors:q.audio.errors};},errors);
 page.off('pageerror',onPageError);page.off('console',onConsole);
 if(result.phase==='won'&&(result.completed!==48||result.bosses.length!==3))throw Error(`Incomplete winning route: ${JSON.stringify(result)}`);
 if(result.phase==='lost'||errors.length||result.renderErrors?.length||result.audioErrors?.length)throw Error(JSON.stringify(result));
 return{status:result.phase==='won'?'MINDREALM_BROWSER_48_NODES_WIN':'MINDREALM_BROWSER_ACT_OK',...result};
}
