// Compare a preserved pre-optimization checkout on 4190 with current code on
// 4191. Both are isolated QA servers. All screenshots stay outside the repository.
async page=>{
 const origins=['http://127.0.0.1:4190','http://127.0.0.1:4191'],results=[],timings=[],errors=[];let fixture;
 page.on('pageerror',error=>errors.push(error.message));await page.setViewportSize({width:1440,height:900});
 for(const [version,origin]of origins.entries()){
  await page.goto(`${origin}/?qa=1`);await page.waitForFunction(()=>window.__mindrealm);
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...window.__mindrealm.field.images.values()].map(img=>img.decode()));window.__mindrealm.audio.setVolumes({master:0});});
  if(!fixture)fixture=await page.evaluate(async()=>{
   const Run=await import('/web/core/state.js'),R=await import('/web/core/rules.js'),B=await import('/web/core/battle.js'),C=await import('/web/core/content.js');
   const state=Run.newRun('PERFORMANCE-VISUAL-EQUALITY',10);state.act=2;state.floor=6;state.currentNode=state.maps[2].nodes.find(n=>n.floor===6);state.currentNode.type='battle';state.phase='prep';state.bandwidth=1000;state.focus=1e6;state.spirit=state.maxSpirit=1e6;
   const types=Object.keys(C.towers);while(state.units.length<24)Run.addUnit(state,types[state.units.length%types.length]);
   for(const [index,u]of state.units.entries()){u.tier=index%3+1;u.branch=u.tier===1?null:index%2?'A':'B';u.hpBonus=50;u.hp=R.unitStats(state,u).hp*.65;u.rotation=index%4;let spot;
    for(let z=5;z<35&&!spot;z++)for(let x=5;x<35&&!spot;x++)if(R.placement(state,u,x,z).ok)spot={x,z};if(!spot)throw Error('Missing legal model placement');R.deploy(state,u.uid,spot.x,spot.z,u.rotation);
   }
   B.startBattle(state);const enemyTypes=Object.keys(C.enemies);state.battle.queue=Array.from({length:56},(_,i)=>({type:enemyTypes[i%28],entry:R.entriesOf(state)[i%4].id,at:0,group:0}));state.battle.total=56;B.stepBattle(state,.05);
   for(const [i,e]of state.battle.enemies.entries()){e.hp=e.maxHp=1e6;e.x=8+i%8*3;e.z=9+Math.floor(i/8)*3;e.h=R.cellAt(state,e.x,e.z).h;e.pathRevision=-1;e.abilityClock=1+i%4;if(e.kind==='boss')e.phase=i%3;}
   for(let i=0;i<30;i++)B.stepBattle(state,.05);return state;
  });
  const versionResults=[];
  for(const viewport of [{width:1440,height:900},{width:960,height:540}]){
   await page.setViewportSize(viewport);
   for(const mode of ['ranged','support','overload','crisis','ghost'])for(const yaw of [0,45,90,135,225,315]){
    const result=await page.evaluate(async({fixture,mode,yaw})=>{
     const q=window.__mindrealm,R=await import('/web/core/rules.js'),state=structuredClone(fixture);
     if(mode==='overload'){state.bandwidth=0;state.battle.disabled=R.bandwidthState(state).disabled;}
     if(mode==='crisis'){state.spirit=state.maxSpirit*.2;state.relics=['redline_amplifier'];state.modifiers={range:.15,attack:.2};}
     if(mode==='ghost'){state.phase='prep';state.battle=null;state.preBattle=null;}
     q.loadState(state);q.transitions.finish();q.dialogs.finish();if(state.phase==='battle'&&!q.getContext().paused){document.dispatchEvent(new KeyboardEvent('keydown',{key:' ',code:'Space',bubbles:true}));q.transitions.finish();}
     const f=q.field,u=state.units.find(u=>u.type===(mode==='support'?'memory_mechanic':'focus_rail'));f.camera.x=20;f.camera.z=19;f.camera.yaw=yaw*Math.PI/180;f.zoomLevel=1.65;f.updateScale();f.dirty=true;f.setInteractive(false);f.setSelection(mode==='ghost'?{unit:{...u,rotation:1},previewOrigin:{x:15,z:15}}:{selectedUid:u.uid});
     // Reset scratch surface allocation so both versions begin with identical GPU resources.
     f.entityLayer=null;f.canvas.width=f.canvas.width;f.ctx.setTransform(f.canvas.width/f.camera.width,0,0,f.canvas.height/f.camera.height,0,0);f.ctx.imageSmoothingEnabled=false;f.dirty=true;
     const before=JSON.stringify(q.getState());f.render(1234,state.battle?.events||[]);const pixels=f.ctx.getImageData(0,0,f.canvas.width,f.canvas.height).data;
     const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',pixels))).map(x=>x.toString(16).padStart(2,'0')).join('');
     if(JSON.stringify(q.getState())!==before)throw Error('Renderer changed game state');
     const result={mode,yaw,width:innerWidth,height:innerHeight,canvas:[f.canvas.width,f.canvas.height],hash,range:f.range.length,blocked:f.rangeBlocked.length,frames:f.entityFrames.map(p=>({key:p.key,row:p.row,direction:p.direction,x:p.x,y:p.y,size:p.size})),errors:f.errors};
     const samples=[];for(let i=0;i<24;i++){f.camera.yaw=(yaw+i*.4)*Math.PI/180;f.dirty=true;if(i%8===0)f.rangeKey='';const start=performance.now();f.render(1234);if(i>=4)samples.push(performance.now()-start);}f.camera.yaw=yaw*Math.PI/180;f.dirty=true;f.render(1234);return {result,samples};
    },{fixture,mode,yaw});
    versionResults.push(result.result);timings[version]??=[];timings[version].push(...result.samples);
    if(viewport.width===1440&&yaw===45&&['ranged','support','ghost'].includes(mode))await page.screenshot({path:`mindrealm-v011-qa/${version?'optimized':'baseline'}-${mode}.png`});
   }
  }
  results.push(versionResults);
 }
 const differences=results[0].flatMap((before,i)=>JSON.stringify(before)===JSON.stringify(results[1][i])?[]:[{case:i,before,after:results[1][i]}]);
 if(differences.length||errors.length)throw Error(JSON.stringify({differences:differences.map(d=>({case:d.case,mode:d.before.mode,yaw:d.before.yaw,width:d.before.width,pixels:d.before.hash!==d.after.hash,geometry:JSON.stringify(d.before.frames)!==JSON.stringify(d.after.frames)})),errors}));
 const summary=values=>{const sorted=[...values].sort((a,b)=>a-b);return{samples:values.length,mean:values.reduce((a,b)=>a+b,0)/values.length,p95:sorted[Math.floor(sorted.length*.95)]};};return {status:'RENDER_EQUIVALENCE_OK',cases:results[0].length,pixelHashesMatch:true,frameGeometryMatches:true,rendererMutations:0,fixedRenderBenchmark:{scenario:'Same frozen fixture, camera movement every frame, range refresh every 8 frames; 4 warmups and 20 measured renders per view',baseline:summary(timings[0]),optimized:summary(timings[1])},errors};
}
