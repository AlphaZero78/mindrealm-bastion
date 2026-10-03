async page=>{
 const url=new URL(page.url());if(!['127.0.0.1','localhost'].includes(url.hostname)||url.port==='4173'||url.searchParams.get('qa')!=='1')throw Error('Use isolated QA storage');
 const checks=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.reload();await page.waitForFunction(()=>window.__mindrealm);
 const idle=()=>page.waitForFunction(()=>!window.__mindrealm.transitions.active&&!window.__mindrealm.dialogs.active&&window.__mindrealm.dialogs.animations.size===0);
 await page.evaluate(async()=>{const q=window.__mindrealm,Run=await import('/web/core/state.js'),I=await import('/web/core/inventory.js'),s=Run.newRun('layout-v3');s.phase='map';s.nexus.forEach(room=>room.skipped=true);I.addItem(s,'clarity');I.addItem(s,'stasis');s.depth=5;s.focus=12345;s.inventory.itemCapacity=4;I.addItem(s,'barrier');I.addItem(s,'overclock');const node=s.maps[0].nodes.find(n=>n.floor===1);node.type='shop';s.nextNodes=[node.id];Run.enterNode(s,node.id);q.loadState(s);});await idle();
 for(const size of [{width:1920,height:1080},{width:1366,height:768},{width:960,height:540}])for(const scale of [1,1.25,1.5]){
  await page.setViewportSize(size);await page.evaluate(scale=>{const q=window.__mindrealm;q.getSettings().uiScale=scale;q.render();},scale);await idle();
  const layout=await page.evaluate(()=>{const controls=[...document.querySelectorAll('.topbar button')].filter(e=>e.getClientRects().length);return {slots:document.querySelectorAll('.item-belt button').length,controls:controls.map(e=>({label:e.getAttribute('aria-label')||e.textContent,rect:e.getBoundingClientRect().toJSON()})),width:innerWidth};});
  if(layout.slots!==4||layout.controls.some(c=>c.rect.left<0||c.rect.right>layout.width+1))throw Error(JSON.stringify({size,scale,layout}));checks.push(`four-slot header fits ${size.width} at ${scale}`);
  await page.locator('[data-action="inventory"]').first().click();await idle();const modal=await page.locator('.modal').boundingBox();if(modal.x<0||modal.x+modal.width>size.width+1||modal.y<0||modal.y+modal.height>size.height+1)throw Error(`Inventory exceeds ${size.width}/${scale}`);checks.push(`inventory dialog fits ${size.width} at ${scale}`);
  if(scale===1.5)await page.screenshot({path:`mindrealm-v3-ui/bag-${size.width}-150.png`});await page.locator('[data-modal="close"]').click();await idle();
 }
 await page.evaluate(()=>{const q=window.__mindrealm;q.getSettings().uiScale=1;q.render();});await page.setViewportSize({width:1440,height:900});await idle();await page.locator('[data-action="buy-item"]').first().scrollIntoViewIfNeeded();await page.screenshot({path:'mindrealm-v3-ui/shop-consumables.png'});
 await page.locator('[data-action="shop-service"]').first().scrollIntoViewIfNeeded();await page.screenshot({path:'mindrealm-v3-ui/shop-services.png'});
 if(errors.length)throw Error(errors.join('\n'));return {status:'INVENTORY_LAYOUT_OK',count:checks.length,checks,errors};
}
