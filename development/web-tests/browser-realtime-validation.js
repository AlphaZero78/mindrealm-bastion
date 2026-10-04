async page=>{
 const url=new URL(page.url());if(!['127.0.0.1','localhost'].includes(url.hostname)||url.searchParams.get('qa')!=='1'||url.port==='4173')throw Error('Use isolated QA storage');
 const issues=[],checks=[];page.on('pageerror',e=>issues.push(e.message));page.on('console',m=>{if(['error','warning'].includes(m.type()))issues.push(m.text());});page.on('response',r=>{if(r.status()>=400)issues.push(`${r.status()} ${r.url()}`);});
 const check=(name,ok,detail)=>{checks.push({name,ok:!!ok,detail});if(!ok)throw Error(JSON.stringify(checks.at(-1)));};
 const idle=()=>page.waitForFunction(()=>window.__mindrealm&&!window.__mindrealm.transitions.active&&!window.__mindrealm.dialogs.active&&!window.__mindrealm.dialogs.animations.size);
 const click=async action=>{await page.locator(`[data-action="${action}"]`).first().click();await idle();};
 await page.reload();await page.waitForFunction(()=>window.__mindrealm?.field.realtime?.ready);await page.setViewportSize({width:1440,height:900});
 const catalog=await page.evaluate(()=>{
  const q=window.__mindrealm,r=q.field.realtime,records=[];q.getSettings().reducedMotion=true;
  const signature=()=>[...r.batches].filter(([,b])=>b.count).map(([key,b])=>[key,...b.mesh.instanceMatrix.array.slice(0,b.count*16)]).flat().join(',');
  const pose=(id,action,progress,variant,reducedMotion=false,facing=.371)=>{r.begin({x:0,z:0,yaw:.63,width:256,height:256,scale:40,focusY:1},null,256,256);r.iconMode=true;r.add(id,{key:'sample',clock:progress*1000,action,progress,facing,variant},{x:0,z:0,h:0,fp:[2,2]},{reducedMotion,wreck:action==='wreck'});r.flush();return signature();};
  for(const [id,d]of Object.entries(r.catalog.entities)){
   const variants=Object.keys(d.variants),images=new Set();for(const variant of variants){r.renderIcon(id,variant,256);const c=document.createElement('canvas');c.width=256;c.height=256;const ctx=c.getContext('2d');ctx.drawImage(r.canvas,0,0);const pixels=ctx.getImageData(0,0,256,256).data;let visible=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i])visible++;if(visible<500)throw Error('Empty model '+id+variant);images.add(c.toDataURL());}
   if(images.size!==variants.length)throw Error('Duplicate branch/phase '+id);
   const v=variants[0],idle=pose(id,'idle',0,v),actions={};for(const action of ['move','attack','cast','death'])actions[action]=pose(id,action,.24,v)!==pose(id,action,.44,v);
   if(!actions.attack&&!actions.cast)throw Error('Missing articulated action '+id);
   if(d.kind==='enemies'&&!actions.move)throw Error('Missing continuous locomotion '+id);
   const disabled=pose(id,'disabled',.24,v)===pose(id,'disabled',.66,v),reduced=pose(id,'move',.24,v,true)===pose(id,'move',.66,v,true);
   if(!disabled||!reduced)throw Error('Inactive/reduced model still moving '+id);
   const turn=pose(id,'idle',.7,v,false,.381);if(turn===idle)throw Error('Quantized facing '+id);
   records.push({id,variants:variants.length,actions,disabled,reduced});
  }
  return {sourceCount:r.sources.size,records};
 });
 check('all 49 models and 109 branch/phase variants render with articulated motion',catalog.records.length===49&&catalog.records.reduce((sum,r)=>sum+r.variants,0)===109,catalog);
 for(const group of ['towers-1','towers-2','enemies','bosses']){
  const download=page.waitForEvent('download');
  await page.evaluate(async group=>{
   const r=window.__mindrealm.field.realtime,C=await import('/web/core/content.js');let entries=Object.entries(r.catalog.entities).filter(([,d])=>group.startsWith('towers')?d.kind==='towers':group==='bosses'?d.role==='boss':d.kind==='enemies'&&d.role!=='boss');
   if(group==='towers-1')entries=entries.slice(0,6);if(group==='towers-2')entries=entries.slice(6);
   const rows=group.startsWith('towers')?5:group==='bosses'?3:Math.ceil(entries.length/6),canvas=document.createElement('canvas');canvas.width=6*224;canvas.height=rows*224;const ctx=canvas.getContext('2d');ctx.fillStyle='#142832';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.textAlign='center';ctx.font='13px Microsoft YaHei';
   entries.forEach(([id,d],i)=>{const variants=group==='enemies'?[Object.keys(d.variants)[0]]:Object.keys(d.variants);variants.forEach((v,j)=>{const col=i%6,row=group==='enemies'?Math.floor(i/6):j;ctx.drawImage(r.renderIcon(id,v,256),col*224+12,row*224,200,200);ctx.fillStyle='#d7e6e8';ctx.fillText(`${(C.towers[id]||C.enemies[id]).name} · ${v}`,col*224+112,row*224+218);});});
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png')),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`models-${group}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  },group);
  await (await download).saveAs(`mindrealm-realtime-art/models-${group}.png`);
 }
 await page.evaluate(async()=>{const q=window.__mindrealm,R=await import('/web/core/state.js'),H=await import('/development/web-tests/helpers/reference-strategy.mjs'),s=R.newRun('reference-0');R.chooseNexus(s,s.nexus[0].options[0]);R.enterNode(s,s.nextNodes[0]);H.prepareReference(s);s.xp=399;q.getSettings().reducedMotion=false;q.getSettings().tutorial=false;q.getSettings().uiScale=1;q.loadState(s);});await idle();
 await click('start');await page.locator('.modal-footer .primary').click();await idle();
 check('experience remains visible with battle drawer closed',await page.locator('#hud-xp-bar').isVisible()&&await page.locator('#footer-drawer').isHidden());
 const samples=[];
 for(const speed of [1,2,3]){
  await page.locator(`[data-action="speed"][data-speed="${speed}"]`).click();
  const sample=await page.evaluate(()=>new Promise(resolve=>{const q=window.__mindrealm,start=performance.now(),initial=q.getState().battle.time;let frames=0,clockError=0,realtime=true;const tick=now=>{const b=q.getState().battle,f=q.field;frames++;clockError=Math.max(clockError,Math.abs(f.entityMotion.clock-Math.max(0,b.time-(1-f.interpolation)*.05)*1000));realtime&&=f.entityFrames.every(x=>x.renderMode==='realtime-webgl');if(now-start<900)requestAnimationFrame(tick);else resolve({wall:(now-start)/1000,simulation:b.time-initial,frames,clockError,realtime});};requestAnimationFrame(tick);}));samples.push({speed,...sample});check(`${speed}x drives interpolated realtime animation`,Math.abs(sample.simulation/sample.wall-speed)<.4&&sample.clockError<.001&&sample.realtime,sample);
 }
 await page.waitForFunction(()=>window.__mindrealm.getState().depth>=2,{},{timeout:15000});
 await page.waitForFunction(()=>document.querySelector('#hud-depth').textContent.trim().startsWith('2'));
 const xp=await page.evaluate(()=>{const s=window.__mindrealm.getState(),bar=document.querySelector('#hud-xp-bar');return {depth:s.depth,xp:s.xp,kills:s.stats.kills,value:bar.value,max:bar.max,text:document.querySelector('#hud-xp-value').textContent};});
 check('actual kill updates experience and wraps level',xp.kills>0&&xp.depth===2&&xp.value===xp.xp&&xp.max===800,xp);
 await click('pause');
 const freeze=()=>page.evaluate(()=>{const q=window.__mindrealm,r=q.field.realtime;return JSON.stringify({time:q.getState().battle.time,clock:q.field.entityMotion.clock,poses:r.frames,matrices:[...r.batches.values()].filter(b=>b.count).map(b=>Array.from(b.mesh.instanceMatrix.array.slice(0,b.count*16)))});});
 const frozen=await freeze();await page.waitForTimeout(500);check('pause freezes transforms and visual time',await freeze()===frozen);
 await page.screenshot({path:'mindrealm-realtime-art/live-models-1440.png'});
 await page.evaluate(()=>{const q=window.__mindrealm;q.field.changeZoom(2.4);q.field.render(performance.now());});await page.screenshot({path:'mindrealm-realtime-art/live-models-close.png'});
 await click('settings');await page.locator('#motion-setting').check();await click('back');
 const reduced=await page.evaluate(()=>window.__mindrealm.field.entityFrames.every(f=>(!['move','hover'].includes(f.action)||f.progress===0)&&f.hit===0&&f.spawn===0));check('actual reduce-motion setting suppresses looping movement',reduced);
 // Upgrade an already deployed construction. Only fixture setup uses direct state access.
 await page.evaluate(async()=>{const q=window.__mindrealm,R=await import('/web/core/state.js'),H=await import('/development/web-tests/helpers/reference-strategy.mjs'),s=R.newRun('reference-0');R.chooseNexus(s,s.nexus[0].options[0]);R.enterNode(s,s.nextNodes[0]);H.prepareReference(s);s.depth=5;s.focus=1000;q.getSettings().reducedMotion=true;q.loadState(s);});await idle();
 const uid=await page.evaluate(()=>window.__mindrealm.getState().units.find(u=>u.x!==null&&u.tier===1).uid);if(await page.locator('#footer-drawer').isHidden())await click('toggle-footer');
 await page.locator('[data-action="warehouse-tab"][data-tab="deployed"]').click();await page.locator(`[data-action="select-unit"][data-uid="${uid}"]`).click();
 const before=await page.evaluate(()=>JSON.stringify(window.__mindrealm.getState()));await click('upgrade');
 const previews=await page.locator('.choice-card .sprite').evaluateAll(items=>items.map(e=>({variant:e.dataset.artVariant,crop:e.querySelector('svg').getAttribute('viewBox'),y:e.querySelector('image').getAttribute('y'),src:e.querySelector('image').getAttribute('href')})));
 check('A and B previews use distinct future portraits',previews.length===2&&previews[0].variant==='T2A'&&previews[1].variant==='T2B'&&previews[0].crop===previews[1].crop&&previews[0].y!==previews[1].y&&previews.every(p=>p.src.includes('/portraits/')),previews);
 await page.setViewportSize({width:960,height:540});await page.screenshot({path:'mindrealm-realtime-art/upgrade-960.png'});await page.getByRole('button',{name:'取消',exact:true}).click();await idle();check('cancel keeps deployed construction and all resources',await page.evaluate(()=>JSON.stringify(window.__mindrealm.getState()))===before);
 await click('upgrade');await page.locator('[data-dialog-upgrade="B"]').click();await idle();
 const upgraded=await page.evaluate(uid=>{const q=window.__mindrealm;q.field.render(performance.now());return {unit:q.getState().units.find(u=>u.uid===uid),frame:q.field.realtime.frames.find(f=>f.key===`unit:${uid}`)};},uid),old=JSON.parse(before).units.find(u=>u.uid===uid);
 check('confirmed upgrade retains location and renders T2B',upgraded.unit.tier===2&&upgraded.unit.branch==='B'&&upgraded.unit.x===old.x&&upgraded.unit.z===old.z&&upgraded.frame.variant==='T2B',upgraded);
 await click('upgrade');const terminal=await page.locator('.choice-card .sprite').evaluateAll(items=>items.map(e=>e.dataset.artVariant));check('T3 preview follows chosen branch',terminal.length===1&&terminal[0]==='T3B',terminal);await page.getByRole('button',{name:'取消',exact:true}).click();await idle();
 await click('menu');await click('continue');const continued=await page.evaluate(uid=>{const q=window.__mindrealm;q.field.render(performance.now());return{unit:q.getState().units.find(u=>u.uid===uid),variant:q.field.realtime.frames.find(f=>f.key===`unit:${uid}`)?.variant};},uid);check('continue restores the same branch and deployment',JSON.stringify(continued.unit)===JSON.stringify(upgraded.unit)&&continued.variant==='T2B',continued);
 const hud=[];
 for(const phase of ['nexus','map','prep','node','reward','won','lost']){
  await page.evaluate(async phase=>{const q=window.__mindrealm,R=await import('/web/core/state.js'),s=R.newRun('hud:'+phase);if(phase!=='nexus')R.chooseNexus(s,s.nexus[0].options[0]);if(['prep','reward'].includes(phase)){R.enterNode(s,s.nextNodes[0]);if(phase==='reward')R.finishBattle(s,{won:true});}if(phase==='node'){const n=s.maps[0].nodes.find(n=>n.floor===1);n.type='event';n.event='quiet_room';s.nextNodes=[n.id];R.enterNode(s,n.id);}if(['won','lost'].includes(phase))s.phase=phase;s.xp=150;q.loadState(s);},phase);await idle();
  const record=await page.locator('#hud-xp-bar').evaluate(e=>{const r=e.getBoundingClientRect();return {barWidth:r.width,barHeight:r.height,top:r.top,bottom:r.bottom,right:r.right,width:innerWidth,height:innerHeight,value:document.querySelector('#hud-xp-bar').value,text:e.textContent};});check(`XP visible on ${phase}`,record.barWidth>50&&record.barHeight>0&&record.top>=0&&record.bottom<=record.height&&record.right<=record.width+1&&record.value===150,record);hud.push({phase,...record});
 }
 await page.evaluate(()=>{const q=window.__mindrealm;q.getState().depth=12;q.getState().xp=0;q.render();});check('depth cap keeps full bar and explicit label',await page.locator('#hud-xp-bar').evaluate(e=>e.value===1&&e.max===1)&&await page.locator('#hud-xp-value').textContent()==='已满级');
 await page.evaluate(async()=>{const q=window.__mindrealm,R=await import('/web/core/state.js'),s=R.newRun('fatal-story');R.chooseNexus(s,s.nexus[0].options[0]);const n=s.maps[0].nodes.find(n=>n.floor===1);n.type='event';n.event='noise_market';s.nextNodes=[n.id];R.enterNode(s,n.id);s.spirit=1;q.loadState(s);});await idle();await page.locator('[data-action="event-choice"][data-index="0"]').click();await page.locator('.modal-footer .primary').click();await idle();
 check('lethal exchange records choice, cost and ending in defeat',await page.evaluate(()=>window.__mindrealm.getState().phase==='lost')&&await page.locator('.event-final-record').count()===1&&/交出失眠的片段/.test(await page.locator('.event-final-record').textContent()));
 const diagnostics=await page.evaluate(()=>({render:window.__mindrealm.field.errors,audio:window.__mindrealm.audio.errors,models:window.__mindrealm.field.realtime.snapshot()}));check('runtime diagnostics remain clear',!issues.length&&!diagnostics.render.length&&!diagnostics.audio.length,diagnostics);
 return {status:'REALTIME_MODELS_XP_UI_OK',checks:checks.length,catalog,samples,xp,hud,diagnostics,issues};
}
