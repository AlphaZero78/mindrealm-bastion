async page=>{
 const url=new URL(page.url());if(url.searchParams.get('qa')!=='1'||url.port==='4173')throw Error('Use isolated QA storage');
 await page.reload();await page.waitForFunction(()=>window.__mindrealm?.field.realtime?.ready);
 const records=[];
 for(const size of [{width:1440,height:900},{width:960,height:540},{width:2548,height:1464}]){
  await page.setViewportSize(size);
  await page.evaluate(async()=>{const R=await import('/web/core/state.js'),s=R.newRun('scene-visual');R.chooseNexus(s,s.nexus[0].options[0]);const n=s.maps[0].nodes.find(n=>n.floor===1);n.type='event';n.event='noise_market';s.nextNodes=[n.id];R.enterNode(s,n.id);s.focus=120;const q=window.__mindrealm;q.getSettings().reducedMotion=true;q.getSettings().uiScale=1;q.getSettings().tutorial=false;q.loadState(s);});
  const ready=()=>page.evaluate(async()=>{await document.querySelector('.event-cg').decode();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
  await ready();
  const geometry=await page.evaluate(()=>{const i=document.querySelector('.event-cg'),s=document.querySelector('.event-stage');return{image:i.getBoundingClientRect().toJSON(),stage:s.getBoundingClientRect().toJSON(),natural:[i.naturalWidth,i.naturalHeight],height:getComputedStyle(i).height};});
  if(Math.abs(geometry.image.width/geometry.stage.width-.8)>.003||Math.abs(geometry.image.height/geometry.stage.height-.8)>.003||Math.abs(geometry.image.x+geometry.image.width/2-geometry.stage.x-geometry.stage.width/2)>1||Math.abs(geometry.image.y+geometry.image.height/2-geometry.stage.y-geometry.stage.height/2)>1)throw Error('CG must remain at 80% and centered '+JSON.stringify(geometry));
  await page.screenshot({path:`mindrealm-realtime-art/event-choice-${size.width}.png`});
  await page.locator('[data-action="event-choice"][data-index="0"]').click();await ready();
  await page.screenshot({path:`mindrealm-realtime-art/event-confirmation-${size.width}.png`});
  await page.locator('[data-action="event-choice"][data-index="0"]').click();await ready();
  await page.screenshot({path:`mindrealm-realtime-art/event-outcome-${size.width}.png`});records.push({size,...geometry});
  if(size.width===2548){await page.setViewportSize({width:2551,height:1458});await ready();await page.screenshot({path:'mindrealm-realtime-art/event-outcome-reference.png'});}
 }
 return {ok:true,records};
}
