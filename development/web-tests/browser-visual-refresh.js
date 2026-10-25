async page=>{
 const url=new URL(page.url());if(!['127.0.0.1','localhost'].includes(url.hostname)||url.port==='4173'||url.searchParams.get('qa')!=='1')throw Error('Use isolated QA storage');
 const errors=[],checks=[],surfaces=[];
 const onError=e=>errors.push(e.message);page.on('pageerror',onError);
 const check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
 const idle=()=>page.waitForFunction(()=>window.__mindrealm&&!window.__mindrealm.transitions.active&&!window.__mindrealm.dialogs.active);
 const click=async selector=>{await idle();await page.locator(selector).first().click();await idle();};
 const art=async(selector,kind,expected)=>{
  const keys=await page.locator(selector).evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-sticker-key')));
  check(keys.length===expected&&keys.every(key=>key?.startsWith(kind+':'))&&new Set(keys).size===expected,kind+' stickers resolve on '+selector);
 };
 const capture=async name=>{
  await idle();await page.evaluate(()=>document.fonts.ready);
  const data=await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,canvas:document.querySelectorAll('#metal-background canvas').length,
   panels:[...document.querySelectorAll('.panel,.choice-card,.codex-entry,.nexus-gift,.map-side')].slice(0,8).map(node=>({class:node.className,color:getComputedStyle(node).backgroundColor,image:getComputedStyle(node).backgroundImage}))}));
  check(!data.overflow&&data.canvas===1,name+' uses one continuous background without horizontal overflow');
  surfaces.push({name,...data});await page.screenshot({path:`visual-${name}.jpg`,type:'jpeg',quality:78});
 };
 const fixture=async kind=>page.evaluate(async kind=>{
  const q=window.__mindrealm,R=await import('/web/core/state.js'),C=await import('/web/core/content.js');
  const s=R.newRun('visual-refresh-fixture');q.getSettings().reducedMotion=true;q.getSettings().tutorial=false;q.getSettings().uiScale=1;
  if(kind==='nexus'){q.loadState(s);return;}
  for(const room of s.nexus)room.skipped=true;s.phase='map';
  if(['relic','talent'].includes(kind)){
   const catalog=kind==='relic'?C.relics:C.talents;
   s.phase='reward';s.rewardQueue=[{kind,title:kind==='relic'?'选择收藏品':'选择天赋',options:Object.keys(catalog).sort((a,b)=>catalog[b].description.length-catalog[a].description.length).slice(0,3)}];
  }else{
   const node=s.maps[0].nodes.find(n=>n.floor===1);node.type=kind;node.event='abandoned_relay';s.nextNodes=[node.id];R.enterNode(s,node.id);
  }
  q.loadState(s);
 },kind);
 try{
  await page.setViewportSize({width:1440,height:900});await page.reload();await idle();
  await fixture('nexus');await page.locator('.nexus-cg').evaluate(img=>img.decode());
  await art('.nexus-gift-art>.sticker-icon','relics',3);await capture('nexus-1440');
  await click('[data-action="menu"]');await click('[data-action="codex"]');await click('[data-action="codex-tab"][data-tab="relics"]');
  await art('.codex-entry>.sticker-icon','relics',102);await capture('relics-1440');
  await click('[data-action="catalog-info"]');await art('.modal-body>.sticker-icon','relics',1);await click('[data-modal="close"]');
  await click('[data-action="codex-tab"][data-tab="talents"]');await art('.codex-entry>.sticker-icon','talents',24);
  await page.setViewportSize({width:960,height:540});await capture('talents-960');
  await fixture('talent');await art('.choice-art>.sticker-icon','talents',3);await capture('talent-reward-960');
  await fixture('relic');await art('.choice-art>.sticker-icon','relics',3);await capture('relic-reward-960');
  await fixture('treasure');await art('.choice-art>.sticker-icon','relics',3);
  await page.setViewportSize({width:1440,height:900});await fixture('shop');
  await art('.shop-relics .shop-product-heading>.sticker-icon','relics',3);
  await art('.shop-items .item-sticker','items',3);await capture('shop-1440');
  await fixture('event');await page.locator('.event-cg').evaluate(img=>img.decode());await capture('event-1440');
  await page.evaluate(async()=>{const q=window.__mindrealm,s=q.getState(),C=await import('/web/core/content.js');s.relics=Object.keys(C.relics).slice(0,3);s.talents=Object.keys(C.talents).slice(0,2);q.loadState(s);});
  await click('[data-action="build"]');
  await art('.modal-body [data-sticker-key^="relics:"]','relics',3);await art('.modal-body [data-sticker-key^="talents:"]','talents',2);
  await click('[data-modal="close"]');await click('[data-action="menu"]');await page.setViewportSize({width:960,height:540});
  const menu=await page.locator('.menu-actions .btn,.menu-links .btn').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return{label:node.textContent.trim(),visible:r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth};}));
  check(menu.every(item=>item.visible),'all menu actions including tutorial fit the small window');await capture('menu-960');
  await page.evaluate(()=>{window.__mindrealm.getSettings().reducedMotion=false;window.__mindrealm.render();});
  check(errors.length===0,'refreshed screens have no page errors');
  return{status:'VISUAL_REFRESH_BROWSER_OK',checks,surfaces,menu,errors};
 }finally{page.off('pageerror',onError);}
}
