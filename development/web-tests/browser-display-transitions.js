// Use the isolated Playwright profile and a QA-only local server on port 4175.
async page=>{
 const checks=[],errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 const check=(ok,message)=>{if(!ok)throw Error(message);checks.push(message);};
 const settled=()=>page.waitForFunction(()=>!window.__mindrealm?.transitions.active&&!window.__mindrealm?.dialogs.active&&!document.querySelector('[data-screen-transition]'));
 const click=async action=>{await settled();await page.locator(`[data-action="${action}"]`).first().click();await settled();};
 await page.setViewportSize({width:1366,height:768});
 // This browser's temporary profile / QA port never shares player storage.
 await page.goto('http://127.0.0.1:4175/');await page.locator('[data-action="settings"]').click();
 await page.locator('#resolution-setting').selectOption('1600x900');await page.locator('#scale-setting').selectOption('1.25');
 await page.reload();await page.locator('[data-action="settings"]').click();
 check(await page.locator('#resolution-setting').inputValue()==='1600x900'&&await page.locator('#scale-setting').inputValue()==='1.25','Resolution and UI scale survive a real page reload');
 await page.goto('http://127.0.0.1:4175/?qa=1');await page.waitForFunction(()=>window.__mindrealm);await page.evaluate(()=>document.fonts.ready);
 await page.evaluate(()=>{document.querySelector('[data-action="settings"]').click();window.__displayTransitionEvidence={active:__mindrealm.transitions.active,inert:document.querySelector('#app').inert,overlays:document.querySelectorAll('[data-screen-transition]').length};});
 check(await page.evaluate(()=>{const v=__displayTransitionEvidence;return v.active&&v.inert&&v.overlays===1;}),'Navigation immediately captures one outgoing frame and locks input');
 await settled();
 check(await page.evaluate(()=>!document.querySelector('#app').inert),'Navigation unlocks after its animation');
 for(const resolution of ['auto','960x540','1280x720','1600x900','1920x1080','2560x1440']){
  await page.locator('#resolution-setting').selectOption(resolution);
  const evidence=await page.evaluate(async resolution=>{const q=__mindrealm,c=q.field.canvas,r=c.getBoundingClientRect(),D=await import('/web/view/display-settings.js'),expected=D.resolveRenderResolution({cssWidth:r.width,cssHeight:r.height,windowWidth:innerWidth,windowHeight:innerHeight,dpr:devicePixelRatio,resolution});return {ok:c.width===expected.pixelWidth&&c.height===expected.pixelHeight&&q.getSettings().resolution===resolution&&q.store.loadSettings().resolution===resolution,width:c.width,height:c.height,active:q.transitions.active};},resolution);
  check(evidence.ok&&!evidence.active,`Preset ${resolution} applies and saves (${evidence.width}x${evidence.height}) without a scene transition`);
 }
 await page.evaluate(()=>{const q=__mindrealm;q._saveSettings=q.store.saveSettings;q.store.saveSettings=()=>({ok:false,reason:'QA simulated storage failure'});});
 await page.locator('#resolution-setting').selectOption('960x540');
 check(await page.evaluate(()=>__mindrealm.getSettings().resolution==='2560x1440'&&document.querySelector('#resolution-setting').value==='2560x1440'),'Failed settings save keeps the previous resolution and selector');
 await page.evaluate(()=>{__mindrealm.store.saveSettings=__mindrealm._saveSettings;delete __mindrealm._saveSettings;});
 await page.locator('#resolution-setting').selectOption('1280x720');
 for(const [width,height]of [[960,540],[1280,720],[1600,900],[1920,1080],[2560,1440]]){
  await page.setViewportSize({width,height});
  for(const scale of ['1','1.25','1.5']){
   await page.locator('#scale-setting').selectOption(scale);
   check(await page.evaluate(()=>{const p=document.querySelector('#resolution-setting'),r=p.getBoundingClientRect(),row=p.parentElement,l=row.querySelector('label').getBoundingClientRect(),root=document.querySelector('.overlay-screen');return r.left>=l.right&&r.right<=innerWidth+1&&r.width>100&&root.scrollWidth<=root.clientWidth+1;}),`${width}x${height} / UI ${scale}: resolution control and Chinese label do not overlap`);
  }
  await page.screenshot({path:`display-settings-${width}.png`});
 }
 await page.setViewportSize({width:1366,height:768});await page.locator('#scale-setting').selectOption('1');
 await page.locator('#motion-setting').check();
 await page.evaluate(()=>document.querySelector('[data-action="back"]').click());
 check(await page.evaluate(()=>!__mindrealm.transitions.active&&!document.querySelector('[data-screen-transition]')),'Reduced motion skips the screen animation');
 await click('settings');await page.locator('#motion-setting').uncheck();
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>document.querySelector('[data-action="back"]').click());
 check(await page.evaluate(()=>!__mindrealm.transitions.active),'Operating system reduced motion also skips transitions');
 await page.emulateMedia({reducedMotion:'no-preference'});
 await click('new');await page.locator('#seed-input').fill('DISPLAY-TRANSITION');
 await page.evaluate(()=>document.querySelector('[data-modal="close"]').click());
 check(await page.evaluate(()=>__mindrealm.dialogs.active&&!document.querySelector('#seed-input')&&document.querySelector('#modal-root').children.length===0&&document.querySelector('#app').inert),'Closing dialog removes live controls immediately and blocks click-through during its fade');
 await settled();
 check(await page.evaluate(()=>document.activeElement?.dataset.action==='new'),'Dialog close restores focus to its trigger after unlocking');
 await click('new');await page.locator('#seed-input').fill('reference-0');await page.locator('.modal-footer .primary').click();await settled();
 await page.evaluate(()=>{const f=__mindrealm.field;f.camera.x=7;f.camera.z=10;f.zoomLevel=2;const render=f.render.bind(f);f.render=(...args)=>{if(!window.__enterCamera)window.__enterCamera={x:f.camera.x,z:f.camera.z,zoom:f.zoomLevel};return render(...args);};document.querySelector('[data-action="enter"]').click();});
 await settled();
 check(await page.evaluate(()=>__enterCamera.x===20.5&&__enterCamera.z===24.5&&__enterCamera.zoom===1.1),'The first preparation frame uses the newly focused camera');
 check(await page.evaluate(()=>__mindrealm.getState().phase==='prep'&&!__mindrealm.getState().units.some(u=>u.x!==null)),'Entering battle preparation completes without unintended deployment');
 const pointBefore=await page.evaluate(()=>__mindrealm.field.project(20.5,24.5));
 await click('settings');await page.locator('#resolution-setting').selectOption('960x540');await click('back');
 const pointAfter=await page.evaluate(()=>__mindrealm.field.project(20.5,24.5));
 check(Math.abs(pointBefore.x-pointAfter.x)<.01&&Math.abs(pointBefore.y-pointAfter.y)<.01,'Changing render resolution preserves CSS camera projection');
 await page.locator('[data-action="select-unit"][data-uid="u4"]').click();
 const point=await page.evaluate(async()=>{const q=__mindrealm,s=q.getState(),R=await import('/web/core/rules.js'),u=s.units.find(u=>u.uid==='u4'),rect=q.field.canvas.getBoundingClientRect();let choices=[];for(let z=12;z<24;z++)for(let x=12;x<30;x++)if(R.placement(s,u,x,z).ok)choices.push({x,z,d:Math.hypot(x-20,z-18)});choices.sort((a,b)=>a.d-b.d);const cell=choices[0],p=q.field.project(cell.x+.5,cell.z+.5,s.terrain.cells[cell.z*41+cell.x].h);return {...cell,px:p.x+rect.x,py:p.y+rect.y};});
 await page.mouse.click(point.px,point.py);
 check(await page.evaluate(point=>{const u=__mindrealm.getState().units.find(u=>u.uid==='u4');return u.x===point.x&&u.z===point.z;},point),'Actual mouse deployment targets the correct cell at 960x540 render resolution');
 await page.screenshot({path:'display-battle-low-resolution.png'});
 await click('settings');
 // Freeze only decorative animations for a deterministic middle-frame image.
 await page.evaluate(()=>{document.querySelector('[data-action="back"]').click();for(const a of document.getAnimations()){a.pause();a.currentTime=100;} });
 await page.screenshot({path:'display-transition-midpoint.png'});
 await page.evaluate(()=>{for(const a of document.getAnimations())a.play();});await settled();
 for(let i=0;i<12;i++){await click('settings');await click('back');}
 check(await page.evaluate(()=>!document.querySelector('[data-screen-transition]')&&!document.querySelector('#app').inert&&!__mindrealm.dialogs.active&&__mindrealm.field.interactive),'Repeated navigation leaves no decorative layers or locked battlefield');
 await page.evaluate(()=>document.querySelector('[data-action="settings"]').click());await page.setViewportSize({width:1280,height:720});await settled();
 check(await page.evaluate(()=>!__mindrealm.transitions.active&&!document.querySelector('#app').inert),'Window resize ends a transition and restores input');
 await click('back');await click('start');await page.locator('.modal-footer .primary').click();
 const timing=await page.evaluate(()=>({active:__mindrealm.transitions.active,time:__mindrealm.getState().battle.time}));
 check(timing.active&&timing.time===0,'Battle simulation waits for the preparation-to-battle transition');
 await settled();await page.waitForFunction(()=>__mindrealm.getState().battle.time>0);
 await page.locator('[data-action="pause"]').click();check(await page.evaluate(()=>!__mindrealm.transitions.active),'Pause and HUD updates do not replay screen transitions');
 check(errors.length===0,`No browser errors: ${errors.join(';')}`);
 return {status:'MINDREALM_DISPLAY_TRANSITIONS_OK',checks,errors};
}
