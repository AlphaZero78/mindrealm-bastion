// Run through run-browser-audit.ps1 on an isolated development server.
async page=>{
 const url=new URL(page.url());
 if(!['127.0.0.1','localhost'].includes(url.hostname)||url.port==='4173'||url.searchParams.get('qa')!=='1')throw Error('Use an isolated loopback development server with ?qa=1');
 const checks=[],errors=[],samples=[];page.setDefaultTimeout(15000);
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 const check=(ok,message)=>{if(!ok)throw Error(message);checks.push(message);};
 const idle=()=>page.waitForFunction(()=>window.__mindrealm&&!__mindrealm.transitions.active&&!__mindrealm.dialogs.active&&!document.querySelector('#app').inert);
 const click=async selector=>{await idle();await page.locator(selector).first().click();await idle();};
 await page.setViewportSize({width:1280,height:720});await page.reload();await idle();await page.evaluate(()=>document.fonts.ready);
 const storageBefore=await page.evaluate(()=>JSON.stringify(Object.entries(localStorage)));
 await page.evaluate(()=>{
  window.__menuTransitionSamples=[];
  document.addEventListener('click',event=>{
   if(!event.target.closest('[data-action]'))return;
   const field=document.querySelector('#battlefield'),style=getComputedStyle(field);
   window.__menuTransitionSource={visibility:style.visibility,rect:field.getBoundingClientRect().toJSON()};
  },true);
  document.addEventListener('click',event=>{
   const action=event.target.closest('[data-action]')?.dataset.action,record=__mindrealm.transitions.record;
   if(!action||!record)return;
   const bitmap=record.bitmap;
   window.__menuTransitionSamples.push({action,source:window.__menuTransitionSource,destination:document.body.dataset.screen,canvases:record.overlay.querySelectorAll('canvas').length,background:getComputedStyle(record.overlay).backgroundColor,bitmap:bitmap?{left:bitmap.style.left,top:bitmap.style.top,width:bitmap.style.width,height:bitmap.style.height}:null});
   if(window.__freezeMenuTransition){
    window.__freezeMenuTransition=false;
    for(const animation of record.animations){animation.pause();animation.currentTime=0;}
    __mindrealm.transitions.armTimeout(record,3000,'screenshot-timeout');
   }
  });
 });
 const navigate=async(action,expected,{capture=false}={})=>{
  await idle();
  const previous=await page.evaluate(freeze=>{window.__freezeMenuTransition=freeze;return __menuTransitionSamples.length;},capture);
  await page.locator(`[data-action="${action}"]`).first().click();
  const evidence=await page.evaluate(index=>__menuTransitionSamples[index],previous);
  check(evidence?.canvases===expected,`${action}: outgoing snapshot contains ${expected} visible battlefield layer(s)`);
  check(evidence.background==='rgba(0, 0, 0, 0)',`${action}: shared background remains exposed`);samples.push(evidence);
  if(capture){
   await page.screenshot({path:'output/playwright/menu-settings-transition.jpg',type:'jpeg',quality:78});
   await page.evaluate(()=>{const q=__mindrealm,r=q.transitions.record;if(r){for(const animation of r.animations)animation.play();q.transitions.armTimeout(r,q.transitions.duration+120,'timeout');}});
  }
  await idle();
  return evidence;
 };
 for(const action of ['settings','help','credits','codex']){
  await navigate(action,0,{capture:action==='settings'});
  check(await page.evaluate(()=>getComputedStyle(document.querySelector('#battlefield')).visibility==='hidden'),'menu subpage keeps the live battlefield hidden');
  await navigate(action==='codex'?'menu':'back',0);
 }
 await click('[data-action="new"]');await page.locator('#seed-input').waitFor();
 await page.locator('[data-modal="close"]').click();await idle();
 check(await page.evaluate(()=>document.body.dataset.screen==='menu'&&!__mindrealm.store.has()&&!document.querySelector('#seed-input')),'cancelling new expedition returns to the menu without creating a save');
 await page.evaluate(()=>{window.__freezeMenuTransition=true;});await page.locator('[data-action="settings"]').click();
 await page.keyboard.press('Escape');await idle();
 check(await page.evaluate(()=>document.body.dataset.screen==='menu'&&!document.querySelector('[data-screen-transition]')),'Escape interrupts a transition and returns cleanly');
 await page.evaluate(()=>{window.__freezeMenuTransition=true;});await page.locator('[data-action="settings"]').click();
 await page.setViewportSize({width:960,height:540});await idle();
 check(await page.evaluate(()=>!document.querySelector('[data-screen-transition]')&&!document.querySelector('#app').inert),'resize releases the transition and input lock');
 await navigate('back',0);await navigate('settings',0);
 await page.locator('#motion-setting').check();await click('[data-action="back"]');
 check(await page.evaluate(()=>document.body.dataset.screen==='menu'&&!__mindrealm.transitions.active),'reduced motion navigation completes immediately');
 await click('[data-action="settings"]');await page.locator('#motion-setting').uncheck();await navigate('back',0);
 await page.emulateMedia({reducedMotion:'reduce'});await click('[data-action="help"]');await click('[data-action="back"]');
 check(await page.evaluate(()=>!document.querySelector('[data-screen-transition]')),'system reduced motion leaves no transition layer');
 await page.emulateMedia({reducedMotion:'no-preference'});await page.setViewportSize({width:1280,height:720});
 await click('[data-action="pv"]');
 await page.waitForFunction(()=>{const video=document.querySelector('.pv-video');return video?.readyState>=3&&!video.paused&&video.currentTime>.25;});
 check(await page.evaluate(()=>{const p=document.querySelector('.pv-dialog'),text=p.innerText;return !/AI\s*生成|MiniMax|Qwen|\bH3\b|AI[- ]generated/i.test(text)&&p.querySelector('.pv-footer span').textContent==='2 分 15 秒';}),'PV displays its duration without generation or model labels');
 check(await page.evaluate(()=>Math.abs(document.querySelector('.pv-video').duration-135)<.1),'embedded 135-second PV plays after the label update');
 await page.evaluate(()=>document.querySelector('.pv-video').pause());
 await page.screenshot({path:'output/playwright/pv-clean-footer.jpg',type:'jpeg',quality:78});
 await page.keyboard.press('Escape');await idle();
 check(await page.evaluate(()=>!document.querySelector('.pv-dialog')&&document.activeElement?.dataset.action==='pv'),'closing the PV restores menu focus');
 await click('[data-action="new"]');await page.locator('#seed-input').fill('menu-transition-regression');
 await page.locator('.modal-footer .primary').click();await idle();
 await click('[data-action="nexus-gift"]');await page.locator('.modal-footer .primary').click();await idle();
 await click('.map-node.available');await page.waitForFunction(()=>__mindrealm.field.realtime?.ready);
 const runBefore=await page.evaluate(()=>JSON.stringify(__mindrealm.getState()));
 const battle=await navigate('settings',1);
 check(battle.bitmap.left===`${battle.source.rect.left}px`&&battle.bitmap.width===`${battle.source.rect.width}px`,'leaving battle preserves its actual viewport in the outgoing snapshot');
 await navigate('back',0);
 check(await page.evaluate(()=>document.body.dataset.screen==='battle'&&getComputedStyle(document.querySelector('#battlefield')).visibility==='visible'&&__mindrealm.field.interactive),'returning to preparation restores the visible interactive battlefield');
 check(await page.evaluate(before=>JSON.stringify(__mindrealm.getState())===before,runBefore),'settings navigation preserves expedition state');
 await click('[data-action="start"]');await page.locator('.modal-footer .primary').click();await idle();
 await page.waitForFunction(()=>__mindrealm.getState().battle.time>0);
 await click('[data-action="pause"]');await navigate('settings',1);await navigate('back',0);
 check(await page.evaluate(()=>__mindrealm.getState().phase==='battle'&&__mindrealm.getContext().paused&&__mindrealm.field.interactive),'paused battle survives settings and back with input restored');
 check(await page.evaluate(()=>JSON.stringify(Object.entries(localStorage)))===storageBefore,'isolated QA navigation leaves browser storage untouched');
 const runtime=await page.evaluate(()=>({render:__mindrealm.field.errors,audio:__mindrealm.audio.errors}));
 check(errors.length===0&&runtime.render.length===0&&runtime.audio.length===0,'no browser, renderer or audio errors');
 return {status:'MINDREALM_MENU_TRANSITIONS_OK',checks,samples,errors,runtime};
}
