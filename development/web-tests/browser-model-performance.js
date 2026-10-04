async page=>{
 const url=new URL(page.url());if(url.searchParams.get('qa')!=='1'||url.port==='4173')throw Error('Use isolated QA storage');
 const issues=[];page.on('pageerror',e=>issues.push(e.message));page.on('console',m=>{if(['error','warning'].includes(m.type()))issues.push(m.text());});
 await page.reload();await page.waitForFunction(()=>window.__mindrealm?.field.realtime?.ready);const cases=[];
 for(const size of [{width:1440,height:900},{width:1920,height:1080}]){
  await page.setViewportSize(size);
  const result=await page.evaluate(async()=>{
   const R=await import('/web/core/state.js'),C=await import('/web/core/content.js'),Rules=await import('/web/core/rules.js'),T=await import('/assets/third_party/three/three.bundle.js'),View=await import('/web/view/battlefield.js');
   const s=R.newRun('realtime-stress');R.chooseNexus(s,s.nexus[0].options[0]);R.enterNode(s,R.availableNodes(s)[0].id);s.units=[];s.bandwidth=500;s.depth=12;
   for(const cell of s.terrain.cells)if(!cell.protected){cell.h=0;cell.ramp=-1;}s.terrain.revision++;
   const kinds=Object.keys(C.towers);
   for(let i=0;i<24;i++){const u=R.addUnit(s,kinds[i%12],3,i%2?'A':'B'),col=i%6,row=Math.floor(i/6),x=4+col*6,z=7+row*6;if(C.towers[u.type].role==='ranged')for(let dz=0;dz<3;dz++)for(let dx=0;dx<3;dx++)s.terrain.cells[(z+dz)*41+x+dx].h=1;
    const verdict=Rules.deploy(s,u.uid,x,z);if(!verdict.ok){for(let z=1;z<37&&u.x===null;z++)for(let x=1;x<37&&u.x===null;x++)Rules.deploy(s,u.uid,x,z);}
   }
   const enemyKinds=Object.keys(C.enemies);s.battle={time:12,enemies:[],drones:Array.from({length:96},(_,i)=>({id:`stress-drone-${i}`,x:8+i%12*2.2,z:11+Math.floor(i/12)*2.3,h:2.2,facing:i*.5,motion:{dx:0,dz:0,dh:0}})),disabled:[],itemBuffs:[],itemShield:0,nexusShield:0};
   for(let i=0;i<100;i++){const type=enemyKinds[i%enemyKinds.length],c=C.enemies[type];s.battle.enemies.push({...c,id:`probe${i}`,type,x:9+(i%10)*2.4,z:10+Math.floor(i/10)*2.2,h:0,hp:c.hp,maxHp:c.hp,phase:i%3,facing:0,motion:{dx:.01,dz:.015,distance:i*.2,dt:.05},lastActionAt:0,castUntil:0,shield:0});}
   const q=window.__mindrealm;q.getSettings().tutorial=false;q.getSettings().uiScale=1;q.getSettings().reducedMotion=false;q.loadState(s);const state=q.getState(),field=q.field;field.frameBoard();field.changeZoom(1.18);field.render(performance.now());
   const sourceBefore=JSON.stringify(state);field.render(performance.now()+16);if(JSON.stringify(state)!==sourceBefore)throw Error('Renderer changed game state');
   let maxProjectionError=0;for(const yaw of [0,.4,Math.PI/2,Math.PI,5.9]){const camera={...field.camera,yaw};field.realtime.begin(camera,state.terrain,field.canvas.width,field.canvas.height);for(const [x,z,h]of[[3,4,0],[20,24,4],[38,36,2]]){const p=new T.Vector3(x,h*.95,z).project(field.realtime.camera),actual={x:(p.x+1)*camera.width/2,y:(1-p.y)*camera.height/2},expected=View.worldToScreen(x,z,h,camera);maxProjectionError=Math.max(maxProjectionError,Math.hypot(actual.x-expected.x,actual.y-expected.y));}}
   if(maxProjectionError>1e-7)throw Error('3D camera disagrees with picking '+maxProjectionError);
   const original=field.render,renderTimes=[],frameTimes=[];let painted=0,previous=0;
   field.render=function(...args){const start=performance.now();const result=original.apply(this,args);if(painted++>=45)renderTimes.push(performance.now()-start);return result;};
   try{await new Promise(resolve=>{let count=0;const tick=time=>{if(previous&&count>45)frameTimes.push(time-previous);previous=time;state.battle.time+=1/60;for(let i=0;i<state.battle.drones.length;i++){const d=state.battle.drones[i];d.x=8+i%12*2.2+Math.sin(state.battle.time*2+i)*.7;d.z=11+Math.floor(i/12)*2.3+Math.cos(state.battle.time*2+i)*.4;d.facing=state.battle.time*2+i;d.motion={dx:.02,dz:.01,dh:0};}for(let i=0;i<state.battle.enemies.length;i++){const enemy=state.battle.enemies[i],distance=.018;enemy.x=9+(i%10)*2.4+Math.sin(state.battle.time+i)*.6;enemy.z=10+Math.floor(i/10)*2.2+Math.cos(state.battle.time+i)*.3;enemy.motion={dx:distance,dz:.005,distance:enemy.motion.distance+distance,dt:1/60};enemy.facing=Math.sin(state.battle.time*.8+i)*.7;}
    if(++count<225)requestAnimationFrame(tick);else resolve();};requestAnimationFrame(tick);});}finally{field.render=original;}
   const stats=values=>{const sorted=[...values].sort((a,b)=>a-b),at=p=>+sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))].toFixed(2);return {n:sorted.length,median:at(.5),p95:at(.95),max:at(1)};};
   const gl=field.realtime.renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');return {viewport:[innerWidth,innerHeight],units:state.units.filter(u=>u.x!==null).length,enemies:100,drones:96,renderer:field.realtime.snapshot(),renderMs:stats(renderTimes),frameMs:stats(frameTimes),gpu:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),maxProjectionError,errors:field.errors};
  });
  cases.push(result);await page.screenshot({path:`mindrealm-realtime-art/stress-${size.width}.png`});
 }
 if(issues.length)throw Error(JSON.stringify(issues));return {ok:true,cases,issues};
}
