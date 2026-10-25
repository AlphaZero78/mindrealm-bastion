// Run through Playwright CLI on the isolated development server with ?qa=1.
async page=>{
 const url=new URL(page.url());if(!['127.0.0.1','localhost'].includes(url.hostname)||url.port==='4173'||url.searchParams.get('qa')!=='1')throw Error('Use isolated QA storage');
 const errors=[],samples=[],checks=[],onError=e=>errors.push(e.message);page.on('pageerror',onError);
 const check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
 const idle=()=>page.waitForFunction(()=>window.__mindrealm&&!window.__mindrealm.transitions.active&&!window.__mindrealm.dialogs.active);
 const click=async selector=>{await idle();await page.locator(selector).first().click();await idle();};
 const sample=async(label,staticBackground)=>{
  const result=await page.evaluate(async({label,staticBackground})=>{
   const q=window.__mindrealm,b=q.background;b.setReducedMotion(staticBackground);
   const start=performance.now(),before=b.stats,submit=b.totalSubmitMs,intervals=[];let previous=null,fieldFrames=0;
   const render=q.field.render;q.field.render=function(...args){fieldFrames++;return render.apply(this,args);};
   try{await new Promise(resolve=>{const tick=time=>{if(previous!==null)intervals.push(time-previous);previous=time;if(time-start<1600)requestAnimationFrame(tick);else resolve();};requestAnimationFrame(tick);});}
   finally{q.field.render=render;}
   const wall=performance.now()-start,after=b.stats,sorted=intervals.sort((a,b)=>a-b),frames=after.frames-before.frames;
   return{label,staticBackground,wall,fieldFrames,backgroundFrames:frames,backgroundFps:frames*1000/wall,submitMeanMs:frames?(b.totalSubmitMs-submit)/frames:0,
    raf:{count:sorted.length,mean:sorted.reduce((a,b)=>a+b,0)/sorted.length,median:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)]},background:after};
  },{label,staticBackground});
  check(result.background.pixels<=result.background.pixelBudget,label+' stays within its pixel budget');
  check(staticBackground?result.backgroundFrames===0:result.backgroundFrames>0&&result.backgroundFps<=result.background.targetFps+2,label+(staticBackground?' stops animation':' respects its frame cap'));
  if(label!=='battle')check(result.fieldFrames===0,label+' avoids hidden battlefield rendering');
  samples.push(result);
 };
 try{
  await page.setViewportSize({width:1920,height:1080});await page.reload();await idle();await page.evaluate(()=>document.fonts.ready);
  const hardware=await page.evaluate(()=>{const b=window.__mindrealm.background,gl=b.gl,debug=gl?.getExtension('WEBGL_debug_renderer_info');return{backend:b.stats.backend,gpu:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):null,viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,userAgent:navigator.userAgent};});
  check(hardware.backend==='webgl','real WebGL shader initialized');
  const pixel=()=>page.evaluate(()=>{const b=window.__mindrealm.background;b.draw(performance.now());const gl=b.gl,pixels=new Uint8Array(32*32*4);gl.readPixels(Math.floor(b.canvas.width/2)-16,Math.floor(b.canvas.height/2)-16,32,32,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let hash=2166136261;for(const value of pixels)hash=Math.imul(hash^value,16777619);return{hash:hash>>>0,lit:pixels.some((x,i)=>i%4!==3&&x>0),time:b.elapsed};});
  const first=await pixel();await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,750)));const second=await pixel();
  check(first.lit&&second.lit&&first.hash!==second.hash&&second.time>first.time,'shader visibly changes its rendered pixels over time');
  await sample('menu',false);await sample('menu',true);
  await click('[data-action="codex"]');await click('[data-action="codex-tab"][data-tab="relics"]');
  check(await page.locator('.codex-entry').count()===102,'catalog load includes all 102 relic stickers');
  await sample('catalog',true);await sample('catalog',false);
  await click('[data-action="menu"]');await click('[data-action="settings"]');
  await page.locator('[data-action="motion-setting"]').check();await idle();
  const stopped=await page.evaluate(async()=>{const b=window.__mindrealm.background,before=b.stats;await new Promise(resolve=>setTimeout(resolve,350));return{before,after:b.stats};});
  check(stopped.after.reducedMotion&&!stopped.after.scheduled&&stopped.before.frames===stopped.after.frames,'actual reduced-motion setting stops scheduling');
  await page.locator('[data-action="motion-setting"]').uncheck();await idle();await click('[data-action="back"]');
  const fixture=await page.evaluate(async()=>{
   const q=window.__mindrealm,R=await import('/web/core/state.js'),Rules=await import('/web/core/rules.js'),B=await import('/web/core/battle.js'),C=await import('/web/core/content.js');
   const s=R.newRun('metal-background-stress');s.act=2;s.floor=6;s.currentNode=s.maps[2].nodes.find(n=>n.floor===6);s.currentNode.type='battle';s.phase='prep';s.bandwidth=1000;s.focus=1e6;s.spirit=s.maxSpirit=1e6;
   const types=Object.keys(C.towers).filter(id=>id!=='bandwidth_relay'),quarters=[[12,12],[28,12],[12,30],[28,30]];while(s.units.length<24)R.addUnit(s,types[s.units.length%types.length]);
   for(const [i,u]of s.units.entries()){
    u.tier=2;u.branch=i%2?'A':'B';const [qx,qz]=quarters[i%4];let best=null;
    for(let z=2;z<39;z++)for(let x=2;x<39;x++){const cost=Math.hypot(x-qx,z-qz);if((!best||cost<best.cost)&&Rules.placement(s,u,x,z).ok)best={x,z,cost};}
    if(!best)throw Error(`No legal stress placement for ${u.uid}/${u.type}`);const deployed=Rules.deploy(s,u.uid,best.x,best.z);if(!deployed.ok)throw Error(deployed.reason);u.hp=Rules.unitStats(s,u).maxHp;
   }
   B.startBattle(s);const enemyTypes=Object.keys(C.enemies),entries=Rules.entriesOf(s);
   s.battle.queue=Array.from({length:100},(_,i)=>({type:enemyTypes[i%enemyTypes.length],entry:entries[i%entries.length].id,at:0,group:0}));s.battle.total=100;B.stepBattle(s,.05);
   for(const [i,e]of s.battle.enemies.entries()){e.hp=e.maxHp=1e7;const d=2+Math.floor(i/4)*.48,offset=(i%3-1)*.6;[e.x,e.z]=[[20+offset,d],[d,24+offset],[40-d,24+offset],[20+offset,40-d]][i%4];e.h=Rules.cellAt(s,e.x,e.z)?.h||0;e.pathRevision=-1;}
   q.loadState(s);q.field.focus();return{units:s.units.length,enemies:s.battle.enemies.length};
  });
  await idle();if(!await page.evaluate(()=>window.__mindrealm.getContext().paused))await click('[data-action="pause"]');
  check(fixture.units===24&&fixture.enemies===100,'representative render load has 24 towers and 100 enemies');
  await sample('battle',false);await sample('battle',true);
  await page.setViewportSize({width:960,height:540});await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,180)));
  const small=await page.evaluate(()=>window.__mindrealm.background.stats);check(small.pixels<=90000,'small battle viewport also stays within 90000 pixels');
  await page.screenshot({path:'metal-stress-960.jpg',type:'jpeg',quality:80});
  const fallback=await page.evaluate(()=>{const b=window.__mindrealm.background;b.setReducedMotion(false);const extension=b.gl.getExtension('WEBGL_lose_context');if(!extension)return null;window.__metalRestore=extension;extension.loseContext();return true;});
  if(fallback){
   await page.waitForFunction(()=>window.__mindrealm.background.stats.backend==='css');
   const css=await page.evaluate(()=>({stats:window.__mindrealm.background.stats,animation:getComputedStyle(document.querySelector('#metal-background'),':before').animationName}));
   check(css.animation==='metal-fallback-flow'&&!css.stats.scheduled,'context loss switches to the shared CSS fallback');
   await page.evaluate(()=>window.__metalRestore.restoreContext());await page.waitForFunction(()=>window.__mindrealm.background.stats.backend==='webgl');
   check(await page.evaluate(()=>window.__mindrealm.background.stats.scheduled),'restored context resumes capped animation');await page.evaluate(()=>delete window.__metalRestore);
  }
  check(errors.length===0,'background checks have no page errors');
  return{status:'METAL_FLOW_BROWSER_OK',scope:'Same-device paired RAF measurements. Battle simulation paused to isolate rendering; real combat is covered by tutorial and full-run checks. Submit timing measures CPU submission, not GPU execution.',hardware,checks,samples,pixelChange:{first,second},stopped,fixture,small,fallback,errors};
 }finally{page.off('pageerror',onError);await page.evaluate(()=>window.__mindrealm?.background.setReducedMotion(false));}
}
