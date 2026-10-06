async page=>{
 const url=new URL(page.url());if(!['127.0.0.1','localhost'].includes(url.hostname)||url.port==='4173'||url.searchParams.get('qa')!=='1')throw Error('Use isolated QA storage');
 const base=url.pathname.endsWith('/')?url.pathname:url.pathname+'/',only=url.searchParams.get('qaMessenger');
 const errors=[],requests=[],checked=[],layouts=[];
 const onError=e=>errors.push(e.message),onResponse=r=>{if(r.status()>=400)requests.push(r.url());};
 page.on('pageerror',onError);page.on('response',onResponse);
 const idle=()=>page.waitForFunction(()=>!window.__mindrealm.dialogs.active&&!window.__mindrealm.transitions.active&&!window.__mindrealm.dialogs.animations.size);
 const click=async selector=>{await idle();await page.locator(selector).click();await idle();};
 try{
  await page.reload();await page.waitForFunction(()=>window.__mindrealm);
  const ids=await page.evaluate(async({base,only})=>Object.keys((await import(base+'web/core/content.js')).messengers).filter(id=>!only||id===only),{base,only});
  if(!ids.length)throw Error('No messenger matches the requested QA subset');
  for(const id of ids)for(const half of [0,1]){
   await page.evaluate(async({base,id,half})=>{
    const R=await import(base+'web/core/state.js'),C=await import(base+'web/core/content.js'),m=C.messengers[id],s=R.newRun('catalog-'+id),q=window.__mindrealm;
    s.act=m.act;s.nextNodes=s.maps[m.act].nodes.filter(n=>n.floor===0).map(n=>n.id);
    s.nexus[m.act]={act:m.act,messenger:id,options:m.gifts.slice(half*3,half*3+3).map(g=>g.id),choice:null,skipped:false};
    q.getSettings().reducedMotion=true;q.getSettings().uiScale=1;q.loadState(s);
   },{base,id,half});
   await idle();await page.locator('.nexus-cg').evaluate(image=>image.decode());
   const art=await page.locator('.nexus-cg').evaluate(image=>({src:image.getAttribute('src'),alt:image.alt,width:image.naturalWidth,height:image.naturalHeight}));
   if(art.src!==base+'assets/game/nexus/'+id+'.png'||art.width<1600||art.height<900||!art.alt)throw Error('Wrong or missing messenger CG: '+id);
   const before=await page.evaluate(()=>JSON.stringify(window.__mindrealm.getState()));
   for(const size of [{width:1920,height:1080},{width:1440,height:900},{width:960,height:540}])for(const scale of [1,1.25,1.5]){
    await page.setViewportSize(size);await page.evaluate(scale=>{const q=window.__mindrealm;q.getSettings().uiScale=scale;q.render();},scale);await idle();
    const layout=await page.evaluate(()=>{
     const room=document.querySelector('.node-screen'),nodes=[...document.querySelectorAll('.nexus-gift,.nexus-gift p,.nexus-gift button,.messenger-caption,.nexus-cg')];
     return{gifts:document.querySelectorAll('.nexus-gift').length,scroll:room.scrollHeight-room.clientHeight,outside:nodes.filter(el=>{const r=el.getBoundingClientRect();return r.left<-.5||r.top<-.5||r.right>innerWidth+.5||r.bottom>innerHeight+.5||el.scrollHeight>el.clientHeight+2;}).map(el=>el.className)};
    });
    if(layout.gifts!==3||layout.scroll>1||layout.outside.length)throw Error(JSON.stringify({id,half,size,scale,layout}));
    layouts.push({id,half,...size,scale});
    if(scale===1&&half===0&&[1920,960].includes(size.width)){await page.waitForFunction(()=>getComputedStyle(document.querySelector('#toast')).opacity==='0');await page.screenshot({path:`narrative-nexus-${id}-${size.width}.png`});}
   }
   await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>{window.__mindrealm.getSettings().uiScale=1;window.__mindrealm.render();});await idle();
   for(let index=0;index<3;index++){
    await page.locator('[data-action="nexus-gift"]').nth(index).click();await idle();await click('.modal-footer button:first-child');
    if(before!==await page.evaluate(()=>JSON.stringify(window.__mindrealm.getState())))throw Error('Gift cancellation changed '+id);
   }
   await page.locator('[data-action="nexus-gift"]').first().click();await idle();await click('.modal-footer .primary');
   const chosen=await page.evaluate(()=>{const q=window.__mindrealm,s=q.getState(),saved=q.store.load();return{phase:s.phase,choice:s.nexus[s.act].choice,relic:s.relics.includes(s.nexus[s.act].choice),saved:saved.ok&&saved.state.nexus[s.act].choice===s.nexus[s.act].choice};});
   if(chosen.phase!=='map'||!chosen.relic||!chosen.saved)throw Error('Gift did not complete and save '+id);
   await click('[data-action="menu"]');await click('[data-action="continue"]');
   if(await page.evaluate(()=>{const s=window.__mindrealm.getState();return s.nexus[s.act].choice;})!==chosen.choice)throw Error('Continue changed gift '+id);
   checked.push({id,half,art,choice:chosen.choice});
  }
  if(errors.length||requests.length)throw Error(JSON.stringify({errors,requests}));
  return{status:'NEXUS_CATALOG_BROWSER_OK',messengers:ids.length,gifts:checked.length*3,visibleLayouts:layouts.length,cancelledGifts:checked.length*3,confirmedGifts:checked.length,checked,errors,requests};
 }finally{page.off('pageerror',onError);page.off('response',onResponse);}
}
