// Playwright CLI run-code callback. Open an isolated QA server's /health first
// (no game assets loaded), then run from an external TEMP directory. The same
// file measures an old package or current source using the open page's origin.
// This is a durable-load presentation fixture, never a balance/victory test.
async page => {
  const origin=page.url().match(/^https?:\/\/[^/]+/)?.[0];if(!origin)throw Error('Open the isolated server /health page first');
  const errors=[],failed=[];page.on('pageerror',e=>errors.push(String(e)));page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()?.errorText}));
  await page.setViewportSize({width:1920,height:1080});await page.goto(`${origin}/?qa=1`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__mindrealm?.field?.images?.size===40);
  const startup=await page.evaluate(async()=>{
    const q=window.__mindrealm,start=performance.now();await Promise.all([...q.field.images.values()].map(img=>img.decode()));await document.fonts.ready;
    const nav=performance.getEntriesByType('navigation')[0],images=[...q.field.images.values()];
    return {assetReadyMs:performance.now(),decodeWaitMs:performance.now()-start,domContentLoadedMs:nav.domContentLoadedEventEnd,imageCount:images.length,decodedPixelBytes:images.reduce((sum,img)=>sum+img.naturalWidth*img.naturalHeight*4,0),largestImage:Math.max(...images.map(img=>img.naturalWidth*img.naturalHeight)),resourceBytes:performance.getEntriesByType('resource').reduce((sum,r)=>sum+r.decodedBodySize,0)};
  });
  const prepared=await page.evaluate(async()=>{
    const Run=await import('/web/core/state.js'),Rules=await import('/web/core/rules.js'),Battle=await import('/web/core/battle.js'),Catalog=await import('/web/core/content.js'),api=window.__mindrealm;
    if(!location.search.includes('qa=1')||!api)throw Error('Isolated in-memory QA is required');api.audio.setVolumes({master:0});
    const state=Run.newRun('ENTITY-MOTION-100',10);state.act=2;state.floor=6;state.currentNode=state.maps[2].nodes.find(n=>n.floor===6);state.currentNode.type='battle';state.phase='prep';state.bandwidth=1000;state.focus=1e6;state.spirit=state.maxSpirit=1e6;
    const types=Object.keys(Catalog.towers),quarters=[[12,12],[28,12],[12,30],[28,30]];while(state.units.length<35)Run.addUnit(state,types[state.units.length%types.length]);
    for(const [index,u]of state.units.entries()){
      u.tier=1+index%3;u.branch=u.tier===1?null:index%2?'A':'B';u.hpBonus=99;u.hp=Rules.unitStats(state,u).hp*.6;
      const [qx,qz]=quarters[index%4];let best=null;for(let z=2;z<39;z++)for(let x=2;x<39;x++){const cost=Math.hypot(x-qx,z-qz);if((!best||cost<best.cost)&&Rules.placement(state,u,x,z).ok)best={x,z,cost};}if(!best)throw Error(`Cannot place ${u.type}`);if(!Rules.deploy(state,u.uid,best.x,best.z).ok)throw Error('Fixture deployment failed');
    }
    Battle.startBattle(state);const enemyTypes=Object.keys(Catalog.enemies),entries=Rules.entriesOf(state);state.battle.queue=Array.from({length:100},(_,i)=>({type:enemyTypes[i<94?i%22:22+i-94],entry:entries[i%4].id,at:0,group:0}));state.battle.total=100;Battle.stepBattle(state,.05);
    for(const [i,e]of state.battle.enemies.entries()){
      e.hp=e.maxHp=1e7;e.abilityClock=1+(i%10)*.4;e.surgeClock=3+(i%4);e.pathRevision=-1;
      const d=2+Math.floor(i/4)*.35,offset=(i%3-1)*.6,positions=[[20+offset,d],[d,24+offset],[40-d,24+offset],[20+offset,40-d]];[e.x,e.z]=positions[i%4];e.h=Rules.cellAt(state,e.x,e.z)?.h||0;
      if(e.kind==='boss'){e.phase=(i-94)%3;e.hp=e.maxHp*[1,.6,.3][e.phase];}
    }
    api.loadState(state);const field=api.field;field.focus();
    const selectedUid=state.units.find(u=>u.type==='focus_rail').uid,original=field.render.bind(field),metrics={active:false,draw:[],interval:[],last:0,events:{},recycled:0,movingFrames:0,minimumEnemies:100,minimumUnits:35,maximumEnemies:100,actions:new Set(),heapPeak:0},previous=new Map();
    const summary=values=>{const sorted=[...values].sort((a,b)=>a-b);return {count:values.length,mean:values.reduce((a,b)=>a+b,0)/Math.max(1,values.length),p95:sorted[Math.floor(sorted.length*.95)]||0,p99:sorted[Math.floor(sorted.length*.99)]||0};};
    field.render=(time,events=[])=>{
      const live=api.getState(),b=live?.battle;
      // Keep every enemy in the real simulation. Recycling ahead of the fire
      // prevents a benchmark becoming easier as normal enemies leave. It does
      // not suppress movement, attacks, casts, healing, shields or projectiles.
      if(b&&live.phase==='battle')for(const [i,e]of b.enemies.entries())if(!e.dead&&Math.max(Math.abs(e.x-20),Math.abs(e.z-24))<9){
        const entry=entries[i%4];e.x=entry.x;e.z=entry.z;e.h=Rules.cellAt(live,e.x,e.z)?.h||0;e.pathRevision=-1;if(metrics.active)metrics.recycled++;
      }
      const start=performance.now();original(time,events);if(!metrics.active)return;
      metrics.draw.push(performance.now()-start);if(metrics.last)metrics.interval.push(time-metrics.last);metrics.last=time;
      for(const event of events)metrics.events[event.type]=(metrics.events[event.type]||0)+1;
      let moving=0;for(const e of b.enemies){const p=previous.get(e.id);if(p&&Math.hypot(e.x-p.x,e.z-p.z)>.0001)moving++;previous.set(e.id,{x:e.x,z:e.z});}
      if(moving)metrics.movingFrames++;const count=b.enemies.filter(e=>!e.dead).length;metrics.minimumEnemies=Math.min(metrics.minimumEnemies,count);metrics.maximumEnemies=Math.max(metrics.maximumEnemies,count);metrics.minimumUnits=Math.min(metrics.minimumUnits,live.units.filter(u=>u.hp>0&&u.x!=null).length);
      for(const frame of field.entityFrames||[])metrics.actions.add(frame.action);
      if(performance.memory)metrics.heapPeak=Math.max(metrics.heapPeak,performance.memory.usedJSHeapSize);
    };
    window.__entityPerf={begin(){metrics.active=true;field.setInteractive(true);field.setSelection({selectedUid});field.keys.add('e');this.timer=setInterval(()=>api.getState().terrain.revision++,250);},finish(){metrics.active=false;field.keys.clear();clearInterval(this.timer);const frame=summary(metrics.interval),draw=summary(metrics.draw),slowest=[...metrics.interval].sort((a,b)=>b-a).slice(0,Math.max(1,Math.ceil(metrics.interval.length*.01))),live=api.getState();return {frame,draw,averageFps:1000/frame.mean,low1Fps:1000/(slowest.reduce((a,b)=>a+b,0)/slowest.length),events:metrics.events,recycled:metrics.recycled,movingFrames:metrics.movingFrames,minimumEnemies:metrics.minimumEnemies,maximumEnemies:metrics.maximumEnemies,minimumUnits:metrics.minimumUnits,bosses:live.battle.enemies.filter(e=>e.kind==='boss').length,actions:[...metrics.actions],usedJSHeapPeak:metrics.heapPeak,simulationSeconds:live.battle.time,range:field.range.length,blockedRange:field.rangeBlocked.length,errors:api.snapshot().errors,audioErrors:api.snapshot().audioErrors};}};
    return {units:state.units.length,enemies:state.battle.enemies.length,bosses:6,viewport:[innerWidth,innerHeight],canvas:[field.canvas.width,field.canvas.height],css:[field.camera.width,field.camera.height],dpr:devicePixelRatio,settings:api.getSettings(),audioMaster:api.audio.volumes.master,userAgent:navigator.userAgent,placement:state.units.map(u=>({type:u.type,tier:u.tier,branch:u.branch,x:u.x,z:u.z})),enemyRoster:state.battle.enemies.map(e=>e.type)};
  });
  await page.waitForFunction(()=>!window.__mindrealm.transitions?.active&&!window.__mindrealm.dialogs?.active);
  if(await page.evaluate(()=>window.__mindrealm.getContext().paused))await page.keyboard.press('Space');
  await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,750)));
  const graphics=await page.evaluate(async()=>{window.__entityPerf.begin();await new Promise(resolve=>{let frames=0;const tick=()=>++frames>=1001?resolve():requestAnimationFrame(tick);requestAnimationFrame(tick);});return window.__entityPerf.finish();});
  if(!await page.evaluate(()=>window.__mindrealm.getContext().paused))await page.keyboard.press('Space');
  const cdp=await page.context().browser().newBrowserCDPSession(),processInfo=await cdp.send('SystemInfo.getProcessInfo'),hardware=await cdp.send('SystemInfo.getInfo');await cdp.detach();
  await page.screenshot({path:'entity-performance.png'});
  const result={status:errors.length||failed.length||graphics.errors.length||graphics.minimumEnemies!==100||graphics.minimumUnits!==35?'ENTITY_PERFORMANCE_INVALID':'ENTITY_PERFORMANCE_OK',scenario:'35 legal T1/T2/T3 A/B towers, 100 moving/casting enemies including six bosses, D10, held E, selected range, terrain invalidation 4 Hz, 1000 RAF intervals',fixtureChanges:'Tower maximum durability ×100, initially 60% durable; enemies have 10 million maximum HP; enemies recycle to entrances within 9 cells of the fire. No player storage; this is presentation load, not victory evidence.',startup,prepared,graphics,processes:processInfo.processInfo,gpu:hardware.gpu.devices,errors,failedResources:failed};
  console.log(JSON.stringify(result));return result;
}
