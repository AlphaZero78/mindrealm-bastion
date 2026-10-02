async page=>{
 page.setDefaultTimeout(12000);
 const config=await page.evaluate(()=>({host:location.hostname,port:location.port,qa:new URLSearchParams(location.search).get('qa'),mode:new URLSearchParams(location.search).get('entityAudit')||'baseline'}));
 if(!['127.0.0.1','localhost'].includes(config.host)||config.port==='4173'||config.qa!=='1')throw Error('Entity audit requires a dedicated loopback QA port, never the player server');
 const errors=[],onError=x=>errors.push(x.message),onConsole=x=>{if(x.type()==='error')errors.push(x.text());};page.on('pageerror',onError);page.on('console',onConsole);
 const checks=[];
 const check=(name,ok,details)=>{checks.push({name,passed:!!ok,details});if(!ok)throw Error(`${name}: ${JSON.stringify(details)}`);};
 const stable=()=>page.waitForFunction(()=>window.__mindrealm&&!window.__mindrealm.transitions.active&&!window.__mindrealm.dialogs.active&&!window.__mindrealm.dialogs.animations.size);
 const capture=async name=>{await stable();await page.screenshot({path:`${config.mode}-${name}.png`});};
 const click=action=>page.locator(`[data-action="${action}"]`).first().click();
 const verifyUpgrade=async()=>{
  const initial=await page.evaluate(()=>({screen:window.__mindrealm.snapshot().screen,phase:window.__mindrealm.getState()?.phase}));
  if(initial.screen!=='menu'){await click('menu');if(initial.screen==='run'&&initial.phase==='battle')await page.locator('.modal-footer .primary').click();await stable();}
  await click('new');await page.locator('#seed-input').fill('entity-upgrade-qa');await page.locator('.modal-footer .primary').click();await stable();
  await page.locator('.map-node.available').first().click();await click('enter');await stable();await page.setViewportSize({width:960,height:540});
  await page.locator('[data-action="select-unit"][data-uid="u1"]').click();
  const before=await page.evaluate(()=>JSON.stringify(window.__mindrealm.getState()));
  await page.locator('[data-action="upgrade"][data-uid="u1"]').click();await stable();
  const previews=await page.locator('.choice-card .sprite').evaluateAll(items=>items.map(e=>({variant:e.dataset.artVariant,crop:e.querySelector('svg')?.getAttribute('viewBox'),imageY:e.querySelector('image')?.getAttribute('y')})));
  check('upgrade previews both future branches',previews.length===2&&previews[0].variant==='T2A'&&previews[1].variant==='T2B'&&previews[0].crop===previews[1].crop&&previews[0].imageY!==previews[1].imageY,previews);
  await capture('upgrade-branches-960');await page.locator('[data-dialog-upgrade="B"]').scrollIntoViewIfNeeded();await capture('upgrade-branch-b-960');
  await page.getByRole('button',{name:'取消',exact:true}).click();await stable();
  check('cancel upgrade preserves entire run',(await page.evaluate(()=>JSON.stringify(window.__mindrealm.getState())))===before);
  await page.locator('[data-action="upgrade"][data-uid="u1"]').click();await page.locator('[data-dialog-upgrade="B"]').click();await stable();
  const upgraded=await page.evaluate(()=>{const q=window.__mindrealm,u=q.getState().units.find(u=>u.uid==='u1');return{unit:{...u},focus:q.getState().focus,icon:document.querySelector('[data-action="select-unit"][data-uid="u1"] .sprite')?.dataset.artVariant};});
  check('confirmed upgrade updates persisted unit and icon',upgraded.unit.tier===2&&upgraded.unit.branch==='B'&&upgraded.icon==='T2B',upgraded);
  await page.locator('[data-action="upgrade"][data-uid="u1"]').click();await stable();
  const terminal=await page.locator('.choice-card .sprite').evaluateAll(items=>items.map(e=>e.dataset.artVariant));
  check('T3 preview follows the selected branch',terminal.length===1&&terminal[0]==='T3B',terminal);
  await capture('upgrade-t3-preview-960');await page.getByRole('button',{name:'取消',exact:true}).click();await stable();
  // Placement goes through the real canvas after the authoritative read-only
  // predicate locates an in-view legal cell; no direct deployment mutation.
  await page.locator('[data-action="select-unit"][data-uid="u1"]').click();
  const target=await page.evaluate(async()=>{const q=window.__mindrealm,R=await import('/web/core/rules.js'),s=q.getState(),u=s.units.find(u=>u.uid==='u1'),rect=q.field.canvas.getBoundingClientRect(),candidates=[];for(let z=10;z<32;z++)for(let x=10;x<32;x++)if(R.placement(s,u,x,z).ok){const p=q.field.p(x+.5,z+.5,0);if(p.x>20&&p.y>20&&p.x<rect.width-20&&p.y<rect.height-20)candidates.push({x,z,cx:rect.left+p.x,cy:rect.top+p.y,d:Math.hypot(x-20,z-20)});}return candidates.sort((a,b)=>a.d-b.d)[0];});
  check('upgraded unit has an in-view legal deployment',!!target,target);await page.mouse.click(target.cx,target.cy);await stable();
  const prior=await page.evaluate(()=>{const q=window.__mindrealm;return{unit:{...q.getState().units.find(u=>u.uid==='u1')},focus:q.getState().focus};});
  check('upgraded unit deployed through canvas',prior.unit.x===target.x&&prior.unit.z===target.z,prior);
  await capture('upgraded-deployed-960');await click('menu');await stable();await click('continue');await stable();
  const continued=await page.evaluate(()=>{const q=window.__mindrealm;return{unit:{...q.getState().units.find(u=>u.uid==='u1')},focus:q.getState().focus,frame:q.field.entityFrames.find(f=>f.key==='unit:u1')};});
  check('continue restores branch state and actual rendered variant',JSON.stringify(prior.unit)===JSON.stringify(continued.unit)&&prior.focus===continued.focus&&continued.frame?.variant==='T2B'&&continued.frame?.variantIndex===2,continued);
  await capture('continued-branch-960');return{upgraded,continued};
 };
 try{
  await page.waitForFunction(()=>window.__mindrealm);await page.setViewportSize({width:1920,height:1080});
  if(config.mode==='upgrade'){const result=await verifyUpgrade();return{status:'MINDREALM_ENTITY_UPGRADE_UI_OK',checks,result,errors};}
  if(config.mode==='smoke'){
   await click('new');await page.locator('#seed-input').fill('reference-0');await page.locator('.modal-footer .primary').click();await stable();await page.locator('.map-node.available').first().click();await click('enter');await stable();await page.setViewportSize({width:960,height:540});
   await page.locator('[data-action="select-unit"][data-uid="u1"]').click();
   const untouched=await page.evaluate(()=>JSON.stringify(window.__mindrealm.getState()));
   const target=await page.evaluate(async()=>{const q=window.__mindrealm,R=await import('/web/core/rules.js'),s=q.getState(),u=s.units.find(u=>u.uid==='u1'),r=q.field.canvas.getBoundingClientRect();for(let z=18;z<25;z++)for(let x=16;x<26;x++)if(R.placement(s,u,x,z).ok){const p=q.field.p(x+.5,z+.5,0);return{x:r.left+p.x,y:r.top+p.y};}});
   check('smoke has a legal preview target',!!target,target);await page.mouse.move(target.x,target.y);await page.waitForFunction(()=>window.__mindrealm.field.entityFrames.some(f=>f.action==='preview'));
   const preview=await page.evaluate(()=>({verdict:window.__mindrealm.getContext().preview,frame:window.__mindrealm.field.entityFrames.find(f=>f.action==='preview')}));
   check('960 legal ghost uses the current model',preview.verdict?.ok&&preview.frame?.variant==='T1',preview);await capture('960-legal-preview');await page.keyboard.press('Escape');
   check('cancel preview does not change the run',untouched===await page.evaluate(()=>JSON.stringify(window.__mindrealm.getState())));
   await page.evaluate(async()=>{const q=window.__mindrealm,H=await import('/development/web-tests/helpers/reference-strategy.mjs');H.prepareReference(q.getState());q.render();});
   await page.locator('[data-action="warehouse-tab"][data-tab="deployed"]').click();await page.locator('[data-action="select-unit"][data-uid="u6"]').click();await stable();
   const outline=await page.evaluate(async()=>{const q=window.__mindrealm,f=q.field,u=q.getState().units.find(u=>u.uid==='u6'),art=(await import('/web/view/entity-art.js')).ENTITY_ART[u.type],g=f.entityGeometry(u),box=f.modelBox(f.p(g.x,g.z,g.h),f.modelSize(u,g),art),ctx=f.ctx,originalMove=ctx.moveTo,originalLine=ctx.lineTo,points=[];ctx.moveTo=function(x,y){points.push({x,y});return originalMove.call(this,x,y);};ctx.lineTo=function(x,y){points.push({x,y});return originalLine.call(this,x,y);};try{f.drawUnitOutline(u,'#ead28c');}finally{ctx.moveTo=originalMove;ctx.lineTo=originalLine;}return{box,outline:{left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))}};});
   check('selection corners enclose the actual enlarged model',Math.abs(outline.outline.left-(outline.box.left-3))<.001&&Math.abs(outline.outline.right-(outline.box.right+3))<.001&&Math.abs(outline.outline.top-(outline.box.top-3))<.001&&Math.abs(outline.outline.bottom-(outline.box.bottom+3))<.001,outline);await capture('960-selected-model');await page.keyboard.press('Escape');
   await click('start');await page.locator('.modal-footer .primary').click();await page.locator('[data-action="speed"][data-speed="3"]').click();
   await page.waitForFunction(()=>window.__mindrealm.getState().battle?.enemies.some(e=>e.air&&e.hp>0),{},{timeout:20000});await click('pause');await stable();
   const flight=await page.evaluate(()=>{const q=window.__mindrealm,f=q.field,enemy=q.getState().battle.enemies.find(e=>e.air&&e.hp>0)||f.entityMotion.deaths.find(d=>d.entity.air)?.entity;if(!enemy)return null;const g=f.entityGeometry(enemy,true),readOnlySnapshot={...enemy,h:2},snapshotGeometry=f.entityGeometry(readOnlySnapshot,true);return{enemy:{id:enemy.id,type:enemy.type,h:enemy.h,air:enemy.air},geometry:g,snapshotGeometry,clock:f.entityMotion.snapshot().clock};});
   check('flying entity uses authoritative height plus flight offset',flight&&Math.abs(flight.geometry.h-((flight.enemy.h??0)+1.3))<.001,flight);
   check('corpse-style height snapshot overrides underlying cell',flight&&Math.abs(flight.snapshotGeometry.h-3.3)<.001,{scope:'read-only geometry query; no fixture added to the run',height:flight?.snapshotGeometry.h});await capture('960-flight-height');
   const diagnostics=await page.evaluate(()=>({render:window.__mindrealm.field.errors,audio:window.__mindrealm.audio.errors}));check('smoke has no runtime errors',!errors.length&&!diagnostics.render.length&&!diagnostics.audio.length,diagnostics);
   return{status:'MINDREALM_ENTITY_FINAL_SMOKE_OK',checks,errors};
  }
  const atlas=await page.evaluate(async animated=>{const C=await import('/web/core/content.js'),A=animated?(await import('/web/view/entity-art.js')).ENTITY_ART:null,records=[];for(const [kind,catalog]of [['towers',C.towers],['enemies',C.enemies]])for(const item of Object.values(catalog)){
   const image=new Image();image.src=A?.[item.id].staticPath||`/assets/game/sprites/${kind}/${item.id}.png`;await image.decode();const record={kind,id:item.id,name:item.name,role:item.role||item.kind,ability:item.ability,air:!!item.air,width:image.naturalWidth,height:image.naturalHeight,branches:item.branches?Object.fromEntries(Object.entries(item.branches).map(([key,value])=>[key,{name:value.name,effect:value.effect}])):undefined};
   if(A){const animation=new Image();animation.src=A[item.id].animationPath;await animation.decode();Object.assign(record,{art:A[item.id],animationWidth:animation.naturalWidth,animationHeight:animation.naturalHeight});}records.push(record);
  }return records;},config.mode==='acceptance');
  if(atlas.filter(x=>x.kind==='towers').length!==12||atlas.filter(x=>x.kind==='enemies').length!==28)throw Error('Incomplete entity catalog');
  if(config.mode==='acceptance'){
   check('complete icon and animated atlases',atlas.every(x=>x.width===x.art.cell*x.art.directions&&x.height===x.art.cell*x.art.iconRows&&x.animationWidth===x.art.cell*x.art.directions&&x.animationHeight===x.art.cell*x.art.rows),atlas.map(x=>({id:x.id,width:x.width,height:x.height,animationWidth:x.animationWidth,animationHeight:x.animationHeight})));
   check('presentation adapter available',await page.evaluate(()=>typeof window.__mindrealm.field.entityMotion?.snapshot==='function'&&Array.isArray(window.__mindrealm.field.entityFrames)));
   // These labelled contact sheets inspect authored pixels, not combat results.
   // They use the same art contract but never write a run or a player setting.
   const groups=[['towers-a',atlas.filter(x=>x.kind==='towers').slice(0,6)],['towers-b',atlas.filter(x=>x.kind==='towers').slice(6)],['enemies-a',atlas.filter(x=>x.kind==='enemies'&&x.role!=='boss').slice(0,11)],['enemies-b',atlas.filter(x=>x.kind==='enemies'&&x.role!=='boss').slice(11)],['bosses',atlas.filter(x=>x.role==='boss')]];
   for(const [name,records]of groups){
    try{
     const pixels=await page.evaluate(async({records,name})=>{
      const canvas=document.createElement('canvas');canvas.id='qa-entity-contact';canvas.width=1300;canvas.height=80+records.length*105;canvas.style.cssText='position:absolute;left:0;top:0;z-index:999999;width:1300px;max-width:none;';document.body.append(canvas);
      const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.fillStyle='#10292c';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#eee7d4';ctx.font='18px Pixel,monospace';ctx.fillText(`QA 资产接触图 / ${name} / 展示帧，非实战`,24,28);const cells=[];
      for(let i=0;i<records.length;i++){
       const record=records[i],art=record.art,image=new Image();image.src=art.animationPath;await image.decode();const y=80+i*105;
       ctx.fillStyle='#eee7d4';ctx.font='15px Pixel,monospace';ctx.fillText(record.name,20,y+32);ctx.font='11px monospace';ctx.fillText(record.id,20,y+51);
       const poses=record.kind==='towers'?art.variants.map((variant,j)=>({variant,row:j*art.poseRows,label:variant})):record.role==='boss'?art.variants.flatMap((variant,j)=>[{variant,row:j*art.poseRows,label:`${variant} idle`},{variant,row:j*art.poseRows+8,label:`${variant} cast`}]):[0,2,6,8,9].map(pose=>({variant:'base',row:pose,label:['idle','move','attack','windup','release'][[0,2,6,8,9].indexOf(pose)]}));
       for(let j=0;j<poses.length;j++){const pose=poses[j],x=240+j*170;ctx.drawImage(image,0,pose.row*art.cell,art.cell,art.cell,x,y-10,80,80);ctx.fillText(pose.label,x,y+86);cells.push({id:record.id,row:pose.row,variant:pose.variant});}
      }return cells;
     },{records,name});
     await page.locator('#qa-entity-contact').screenshot({path:`acceptance-contact-${name}.png`});
     checks.push({name:`authored contact sheet ${name}`,passed:true,details:{cells:pixels.length,evidence:`acceptance-contact-${name}.png`,scope:'capture only; visual review required'}});
    }finally{await page.evaluate(()=>document.querySelector('#qa-entity-contact')?.remove());}
   }
  }
  await click('codex');await capture('codex-towers-top');
  const towerCards=page.locator('.codex-entry');await towerCards.last().scrollIntoViewIfNeeded();await capture('codex-towers-bottom');
  await page.locator('[data-action="codex-tab"][data-tab="enemies"]').click();
  const enemies=page.locator('.codex-entry');
  for(const [label,index]of [['top',0],['middle',12],['bosses',27]]){await enemies.nth(index).scrollIntoViewIfNeeded();await capture(`codex-enemies-${label}`);}
  await click('menu');await click('new');await page.locator('#seed-input').fill('reference-0');await page.locator('.modal-footer .primary').click();
  await page.locator('.map-node.available').first().click();await click('enter');
  await page.evaluate(async()=>{const q=window.__mindrealm,H=await import('/development/web-tests/helpers/reference-strategy.mjs');H.prepareReference(q.getState());q.render();});
  await capture('battle-prep');await click('start');await page.locator('.modal-footer .primary').click();
  await page.waitForFunction(()=>{const s=window.__mindrealm.getState();return s.phase==='battle'&&s.battle.enemies.some(enemy=>!enemy.dead);});
  await capture('battle-live');await click('pause');await stable();
  const paused=await page.evaluate(()=>({time:window.__mindrealm.getState().battle.time,positions:window.__mindrealm.getState().battle.enemies.map(e=>[e.id,e.x,e.z])}));
  await capture('battle-paused-a');await page.waitForTimeout(350);await capture('battle-paused-b');
  const pauseStable=await page.evaluate(before=>{const b=window.__mindrealm.getState().battle;return b.time===before.time&&JSON.stringify(b.enemies.map(e=>[e.id,e.x,e.z]))===JSON.stringify(before.positions);},paused);
  if(!pauseStable)throw Error('Simulation advanced while paused');
  if(config.mode==='acceptance'){
   const readMotion=()=>page.evaluate(()=>{const q=window.__mindrealm;return{time:q.getState().battle.time,motion:q.field.entityMotion.snapshot(),frames:q.field.entityFrames.map(x=>({...x}))};});
   const before=await readMotion();await page.waitForTimeout(400);const after=await readMotion();
   check('pause freezes pose and corpse age',JSON.stringify(before)===JSON.stringify(after),{before,after});
   await page.locator('canvas[aria-label^="战场"]').focus();await page.keyboard.down('e');
   let directions;
   try{directions=await page.evaluate(()=>new Promise(resolve=>{const seen={},start=performance.now();const tick=now=>{for(const f of window.__mindrealm.field.entityFrames)(seen[f.key]??=new Set()).add(f.direction);if(now-start<4300)requestAnimationFrame(tick);else resolve(Object.fromEntries(Object.entries(seen).map(([key,value])=>[key,[...value].sort()])));};requestAnimationFrame(tick);}));}
   finally{await page.keyboard.up('e');}
   check('continuous camera turn reaches all eight directions',Object.keys(directions).length>0&&Object.values(directions).every(values=>values.length===8),directions);
   check('camera input does not advance paused battle',(await readMotion()).time===before.time);
   await capture('battle-eight-direction-camera');
   for(const speed of [1,2,3]){
    await page.locator(`[data-action="speed"][data-speed="${speed}"]`).click();await click('pause');
    // Observe actual animation frames. The QA fixed-step shortcut intentionally
    // skips event presentation and therefore cannot prove attack animation.
    const sample=await page.evaluate(()=>new Promise(resolve=>{
     const q=window.__mindrealm,frames=[],start=performance.now(),startTime=q.getState().battle.time;let maxClockError=0;
     const tick=now=>{const b=q.getState().battle;if(!b){resolve({ended:true});return;}
      maxClockError=Math.max(maxClockError,Math.abs(q.field.entityMotion.snapshot().clock-b.time*1000));
      frames.push(...q.field.entityFrames.map(x=>({...x})));
      if(now-start<900)requestAnimationFrame(tick);else resolve({wall:(now-start)/1000,simulation:b.time-startTime,maxClockError,frames});
     };requestAnimationFrame(tick);
    }));
    await click('pause');await stable();
    check(`${speed}x uses simulation clock`,!sample.ended&&sample.maxClockError<.001,{ended:sample.ended,maxClockError:sample.maxClockError});
    const rate=sample.simulation/sample.wall;
    check(`${speed}x advances at selected speed`,Math.abs(rate-speed)<.45,{rate,wall:sample.wall,simulation:sample.simulation});
    check(`${speed}x frames remain in declared atlas`,sample.frames.length>0&&sample.frames.every(f=>{const art=atlas.find(a=>a.id===f.type)?.art;return art&&Number.isInteger(f.pose)&&f.pose>=0&&f.pose<art.poseRows&&f.row===f.variantIndex*art.poseRows+f.pose&&f.row>=0&&f.row<art.rows&&art.variants[f.variantIndex]===f.variant&&Number.isInteger(f.direction)&&f.direction>=0&&f.direction<art.directions&&Number.isFinite(f.facing);}),{count:sample.frames.length,actions:[...new Set(sample.frames.map(f=>f.action))]});
    await capture(`battle-${speed}x-paused`);
   }
   await page.locator('[data-action="speed"][data-speed="1"]').click();await click('pause');
   await page.waitForFunction(()=>window.__mindrealm.field.entityFrames.some(f=>f.key.startsWith('unit:')&&f.action==='attack'),{},{timeout:20000});
   const attack=await readMotion();
   check('real tower attack consumed by renderer',attack.frames.some(f=>f.key.startsWith('unit:')&&f.action==='attack'),attack.frames.filter(f=>f.action==='attack'));
   await click('pause');await stable();await capture('battle-attack');
   const originalReduced=await page.evaluate(()=>window.__mindrealm.getSettings().reducedMotion);
   await click('settings');await stable();await page.locator('#motion-setting').check();await click('back');await stable();
   const reduced=await readMotion();
   check('reduced motion keeps stable locomotion pose',reduced.frames.every(f=>!['move','hover'].includes(f.action)||f.pose===0),reduced);
   check('reduced motion suppresses hit and spawn shake',reduced.frames.every(f=>f.hit===0&&f.spawn===0));
   await capture('battle-reduced-motion');
   // Keep the isolated game's preference as it was for callers who continue QA.
   await click('settings');await stable();await page.locator('#motion-setting').setChecked(originalReduced);await click('back');await stable();
   await verifyUpgrade();
  }
  // Baseline records observations only. Acceptance checks above cover the real
  // first battle; exhaustive entity/branch fixtures are reported separately.
  const renderer=await page.evaluate(()=>{const q=window.__mindrealm;return{fields:Object.keys(q.field),phase:q.getState().phase,animationSnapshot:q.field.entityMotion?.snapshot()||null,renderErrors:q.field.errors,audioErrors:q.audio.errors};});
  if(errors.length||renderer.renderErrors.length||renderer.audioErrors.length)throw Error(JSON.stringify({errors,renderer}));
  return{status:config.mode==='acceptance'?'MINDREALM_ENTITY_ANIMATION_LIVE_OK':'MINDREALM_ENTITY_VISUAL_BASELINE_CAPTURED',mode:config.mode,atlas,pauseSimulationStable:pauseStable,checks,renderer,errors};
 }finally{page.off('pageerror',onError);page.off('console',onConsole);}
}
