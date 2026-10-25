async sourcePage=>{
 const destination=new URL(sourcePage.url()),remote=destination.hostname==='alphazero78.github.io';
 if(!remote&&(!['127.0.0.1','localhost'].includes(destination.hostname)||destination.port==='4173'))throw Error('Use an isolated local server or the published game');
 const base=remote?'/mindrealm-bastion/':destination.pathname.endsWith('/')?destination.pathname:destination.pathname+'/';
 const context=await sourcePage.context().browser().newContext({viewport:{width:1280,height:800}}),page=await context.newPage();
 const errors=[],mediaRequests=[],checks=[];let expectedFailure=false;
 page.on('pageerror',error=>errors.push(error.message));
 page.on('request',request=>{if(request.url().endsWith('/opening-pv.mp4'))mediaRequests.push(request.url());});
 page.on('requestfailed',request=>{if(!expectedFailure&&request.failure()?.errorText!=='net::ERR_ABORTED')errors.push(request.url()+': '+request.failure()?.errorText);});
 const check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
 const idle=()=>page.waitForFunction(()=>document.querySelector('#app')&&!document.querySelector('#app').inert);
 const storage=()=>page.evaluate(()=>JSON.stringify(Object.entries(localStorage).sort(([a],[b])=>a.localeCompare(b))));
 await page.addInitScript(()=>{
  window.__pvTestGains=[];const Native=window.AudioContext;
  if(Native)window.AudioContext=class extends Native{createGain(){const gain=super.createGain();window.__pvTestGains.push(gain);return gain;}};
 });
 try{
  await page.goto(destination.href);await page.locator('[data-action="pv"]').waitFor();await idle();
  check(mediaRequests.length===0,'menu does not fetch the video');
  check(!await page.evaluate(()=>window.__mindrealm!==undefined),'production has no development bridge');
  if(!remote){
   await page.evaluate(async base=>{const R=await import(base+'web/core/state.js'),S=await import(base+'web/core/save.js'),store=S.createSaveStore(localStorage);store.save(R.newRun('pv-preserved-expedition'));const p=store.loadProfile();p.fragments=29;store.saveProfile(p);store.saveSettings({...store.loadSettings(),master:.6});localStorage.setItem('pv-unrelated-key','preserve');},base);
   await page.reload();await page.locator('[data-action="pv"]').waitFor();await idle();
  }
  const before=await storage();await page.screenshot({path:`D:/game_build_archive/pv-integration-20261025/${remote?'live':'local'}-menu.png`});
  const open=async()=>{await idle();await page.locator('[data-action="pv"]').click();await page.locator('.pv-dialog[open]').waitFor();};
  const playing=()=>page.waitForFunction(()=>{const v=document.querySelector('.pv-video');return v&&v.readyState>=3&&!v.paused&&v.currentTime>.25;});
  const close=async()=>{await page.locator('[data-pv-close]').click();await page.locator('.pv-dialog').waitFor({state:'detached'});};
  await open();await playing();
  const media=await page.locator('video').evaluate(v=>({duration:v.duration,width:v.videoWidth,height:v.videoHeight,src:v.currentSrc,volume:v.volume}));
  check(Math.abs(media.duration-135)<.1&&media.width===1920&&media.height===1080,'embedded 135-second 1080p video actually decodes');
  check(media.src.includes(base+'assets/game/pv/opening-pv.mp4'),'video stays on the game origin and deployment subpath');
  await page.waitForFunction(()=>window.__pvTestGains[0]?.gain.value<.01);check(true,'menu audio is silent while PV is open');
  if(!remote){await page.locator('video').focus();await page.keyboard.press('Space');await page.waitForFunction(()=>document.querySelector('video').paused);await page.keyboard.press('Space');await playing();check(true,'keyboard pause and resume work');}
  await page.locator('video').evaluate(v=>{v.pause();v.currentTime=73;});
  await page.waitForFunction(()=>{const v=document.querySelector('video');return !v.seeking&&v.readyState>=2&&Math.abs(v.currentTime-73)<.2;});
  await page.screenshot({path:`D:/game_build_archive/pv-integration-20261025/${remote?'live':'local'}-pv.png`});check(true,'seeking decodes a frame in the middle of the film');
  if(!remote){await page.locator('[data-pv-fullscreen]').click();await page.waitForFunction(()=>!!document.fullscreenElement);await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.fullscreenElement);await page.waitForTimeout(250);check(await page.locator('.pv-dialog[open]').count()===1,'fullscreen exits while keeping the player open');}
  await page.locator('video').evaluate(v=>{window.__closedPV=v;v.currentTime=132.5;});await page.waitForFunction(()=>{const v=document.querySelector('video');return !v.seeking&&v.readyState>=2&&v.currentTime>132;});
  await page.keyboard.press('Escape');await page.locator('.pv-dialog').waitFor({state:'detached'});
  check(await page.evaluate(()=>window.__closedPV.paused&&!window.__closedPV.getAttribute('src')),'Escape stops and unloads playback');
  await page.waitForFunction(()=>window.__pvTestGains[0]?.gain.value>.5);check(true,'menu audio returns after closing');
  check(await page.locator('[data-action="pv"]').evaluate(e=>e===document.activeElement),'focus returns to the menu PV button');
  check(await storage()===before,'watching PV preserves all saved data and settings');
  if(!remote){
   await open();await playing();check(await page.locator('video').evaluate(v=>v.currentTime<3),'reopening starts at the beginning');await close();
   expectedFailure=true;await page.route('**/opening-pv.mp4',route=>route.abort());await open();await page.locator('[data-pv-retry]').waitFor();await page.unroute('**/opening-pv.mp4');await page.locator('[data-pv-retry]').click();await playing();await close();expectedFailure=false;check(true,'failed loading can retry and recover');
   await page.setViewportSize({width:960,height:540});await open();await playing();const bounds=await page.locator('.pv-dialog').boundingBox();check(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=961&&bounds.y+bounds.height<=541,'player fits a 960 by 540 window');await close();
   check(await storage()===before,'repeat, retry and small-window viewing preserve storage');
   await page.locator('[data-action="continue"]').click();await page.locator('.nexus-room').waitFor();check(true,'the saved expedition still continues after viewing');
  }
  check(errors.length===0,JSON.stringify(errors));return{status:'PV_BROWSER_OK',remote,media,checks,videoRequests:mediaRequests.length,errors};
 }catch(error){throw Error(JSON.stringify({message:error.message,checks,errors}));}finally{await context.close();}
}
