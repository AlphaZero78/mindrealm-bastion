async page=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
 const url=new URL(page.url());if(!['127.0.0.1','localhost'].includes(url.hostname)||url.port==='4173'||url.searchParams.get('qa')!=='1')throw Error('Requires isolated QA port and query');
 await page.reload();await page.waitForFunction(()=>!!window.__mindrealm);
 await page.evaluate(()=>{const q=window.__mindrealm;q.getSettings().reducedMotion=true;q.getSettings().tutorial=false;q.newRun('nexus-live');});
 const opening=await page.evaluate(()=>({phase:window.__mindrealm.getState().phase,items:window.__mindrealm.getState().inventory.items.length,cards:document.querySelectorAll('[data-action="nexus-gift"]').length}));
 if(opening.phase!=='nexus'||opening.items!==0||opening.cards!==3)throw Error(JSON.stringify(opening));
 const original=await page.evaluate(()=>JSON.stringify(window.__mindrealm.getState()));
 await page.locator('[data-action="nexus-gift"]').first().click();await page.locator('.modal-footer button').first().click();
 if(original!==await page.evaluate(()=>JSON.stringify(window.__mindrealm.getState())))throw Error('Cancel changed nexus state');
 await page.locator('[data-action="nexus-gift"]').first().click();await page.locator('.modal-footer .primary').click();
 if(await page.evaluate(()=>window.__mindrealm.getState().phase)!=='map')throw Error('Gift did not open route');
 const chosen=await page.evaluate(()=>window.__mindrealm.getState().nexus[0].choice);
 await page.locator('[data-action="menu"]').click();await page.locator('[data-action="continue"]').click();
 if(await page.evaluate(()=>window.__mindrealm.getState().nexus[0].choice)!==chosen)throw Error('Nexus reload changed choice');
 const reports=[];
 for(const kind of ['nexus','shop','workshop','workshop-40','camp','event','treasure']){
  await page.evaluate(async kind=>{const R=await import('/web/core/state.js'),q=window.__mindrealm,s=R.newRun('node-layout-'+kind);if(kind!=='nexus'){R.chooseNexus(s,s.nexus[0].options[0]);s.focus=800;s.depth=5;const node=s.maps[0].nodes.find(n=>n.floor===1);node.type=kind.startsWith('workshop')?'workshop':kind;s.nextNodes=[node.id];R.enterNode(s,node.id);if(kind==='workshop-40')for(let i=s.units.length;i<40;i++){const u=R.addUnit(s,s.contentPool.towers[i%12]);if(i%2===0){u.x=3+i%30;u.z=4;u.everDeployed=true;}}}q.loadState(s);},kind);
  for(const viewport of [{width:1920,height:1080},{width:1280,height:720},{width:960,height:540}])for(const scale of [1,1.25,1.5]){
   await page.setViewportSize(viewport);await page.evaluate(scale=>{const q=window.__mindrealm;q.getSettings().uiScale=scale;q.render();},scale);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const layout=await page.evaluate(()=>{const sheet=document.querySelector('.node-sheet')||document.querySelector('.event-stage'),room=document.querySelector('.node-screen')||document.querySelector('.event-screen'),r=sheet.getBoundingClientRect();const nodes=[...sheet.querySelectorAll('button,h3,p,select,.event-result')];const outside=nodes.filter(el=>{const b=el.getBoundingClientRect();return b.bottom>innerHeight+1||b.right>innerWidth+1||b.left< -1||b.top<0;}).map(el=>el.textContent);return{fit:Number(sheet.dataset.fitScale),bottom:r.bottom,right:r.right,window:[innerWidth,innerHeight],scroll:room.scrollHeight-room.clientHeight,outside,products:sheet.querySelectorAll('.shop-product').length,units:sheet.querySelectorAll('.service-unit').length};});
   reports.push({kind,...viewport,scale,...layout});if(layout.outside.length||layout.scroll>1)throw Error(JSON.stringify(reports.at(-1)));
   if(scale===1&&(viewport.width===1920||viewport.width===960)){await page.waitForFunction(()=>getComputedStyle(document.querySelector('#toast')).opacity==='0');await page.screenshot({path:`nexus-v012-${kind}-${viewport.width}.png`});}
  }
 }
 const runtime=await page.evaluate(()=>({field:window.__mindrealm.field.errors,audio:window.__mindrealm.audio.errors}));
 if(errors.length||runtime.field.length||runtime.audio.length)throw Error(JSON.stringify({errors,runtime}));
 return{status:'NEXUS_NODE_LAYOUT_OK',opening,chosen,reports,errors,runtime};
}
