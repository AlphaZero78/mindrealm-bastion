async page=>{
 const url=new URL(page.url());if(!['127.0.0.1','localhost'].includes(url.hostname)||url.port==='4173'||url.searchParams.get('qa')!=='1')throw Error('Use isolated QA storage');
 const errors=[],requests=[],checked=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)requests.push(r.url());});
 await page.reload();await page.waitForFunction(()=>window.__mindrealm);
 const ids=await page.evaluate(async()=>Object.keys((await import('/web/core/content.js')).messengers));
 for(const id of ids)for(const half of [0,1]){
  await page.evaluate(async({id,half})=>{const R=await import('/web/core/state.js'),C=await import('/web/core/content.js'),m=C.messengers[id],s=R.newRun('catalog-'+id),q=window.__mindrealm;s.act=m.act;s.nextNodes=s.maps[m.act].nodes.filter(n=>n.floor===0).map(n=>n.id);s.nexus[m.act]={act:m.act,messenger:id,options:m.gifts.slice(half*3,half*3+3).map(g=>g.id),choice:null,skipped:false};q.getSettings().reducedMotion=true;q.getSettings().uiScale=1;q.loadState(s);},{id,half});
  const before=await page.evaluate(()=>JSON.stringify(window.__mindrealm.getState()));
  for(const size of [{width:1920,height:1080},{width:960,height:540}]){
   await page.setViewportSize(size);await page.evaluate(()=>window.__mindrealm.render());
   const visible=await page.locator('.nexus-gift').evaluateAll(cards=>cards.length===3&&cards.every(card=>{const r=card.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1&&card.scrollHeight<=card.clientHeight+1;}));
   if(!visible)throw Error('Gift layout clips '+id+' at '+size.width);
   if(size.width===960)await page.screenshot({path:`nexus-r4-messenger-${id}-${half}.png`});
  }
  for(let index=0;index<3;index++){
   await page.locator('[data-action="nexus-gift"]').nth(index).click();await page.locator('.modal-footer button').first().click();
   if(before!==await page.evaluate(()=>JSON.stringify(window.__mindrealm.getState())))throw Error('Gift cancellation changed '+id);
  }
  const art=await page.evaluate(async()=>{const C=await import('/web/core/content.js'),s=window.__mindrealm.getState(),m=C.messengers[s.nexus[s.act].messenger],r=await fetch(`/assets/third_party/game-icons/${m.art}.svg`);return r.ok&&(await r.text()).includes('<svg');});if(!art)throw Error('Missing messenger portrait '+id);
  checked.push({id,half});
 }
 if(errors.length||requests.length)throw Error(JSON.stringify({errors,requests}));
 return {status:'NEXUS_CATALOG_BROWSER_OK',messengers:ids.length,gifts:checked.length*3,visibleLayouts:checked.length*2,cancelledGifts:checked.length*3,checked,errors,requests};
}
