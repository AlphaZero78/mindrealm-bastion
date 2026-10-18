async page=>{
 const url=new URL(page.url());if(!['127.0.0.1','localhost'].includes(url.hostname)||url.port==='4173'||url.searchParams.get('qa')!=='1')throw Error('Use isolated QA storage');
 const fallback=await page.context().newPage(),issues=[];fallback.on('pageerror',e=>issues.push(e.message));
 try{
  await fallback.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return /webgl/i.test(kind)?null:original.call(this,kind,...args);};});
  await fallback.setViewportSize({width:1440,height:900});await fallback.goto(url.origin+'/?qa=1');
  await fallback.waitForFunction(()=>{const f=window.__mindrealm?.field;return f&&!f.realtime&&f.images.size===49&&f.deathImages.size===37&&[...f.images.values(),...f.deathImages.values()].every(i=>i.complete&&i.naturalWidth);});
  const result=await fallback.evaluate(async()=>{
   const q=window.__mindrealm,R=await import('/web/core/state.js'),C=await import('/web/core/content.js'),s=R.newRun('enemy-fallback-art');R.chooseNexus(s,s.nexus[0].options[0]);R.enterNode(s,R.availableNodes(s)[0].id);s.units=[];s.depth=12;s.bandwidth=500;
   const specs=Object.entries(C.enemies);s.battle={time:10,enemies:specs.map(([type,c],i)=>({...c,id:'fallback-'+i,type,x:7+i%8*3,z:8+Math.floor(i/8)*3.5,h:0,hp:c.hp,maxHp:c.hp,phase:i%3,facing:i*.4,motion:{dx:.04,dz:.02,distance:.37,dt:.05}})),events:[],disabled:[],drones:[]};
   q.getSettings().reducedMotion=false;q.getSettings().tutorial=false;q.loadState(s);const field=q.field;field.frameBoard();field.render(performance.now());
   const living=field.entityFrames.filter(f=>f.key?.startsWith('enemy:'));if(living.length!==37)throw Error('Missing fallback enemy frames');
   const dead=s.battle.enemies.splice(0,10);for(const enemy of dead)field.entityMotion.addDeath({...enemy,hp:0},field.entityMotion.clock-650*.45);field.render(performance.now());
   const death=field.entityFrames.filter(f=>f.action==='death');if(death.length!==10||death.some(f=>f.progress<=0||f.progress>=1||!Number.isFinite(f.variantIndex)))throw Error('Invalid fallback death frame routing');
   q.getSettings().reducedMotion=true;q.render();field.render(performance.now());const fixed=field.entityFrames.filter(f=>f.action==='death');if(fixed.length!==10||fixed.some(f=>f.progress!==1))throw Error('Reduced fallback death does not use fixed final frames');
   const unexpected=field.errors.filter(e=>!e.startsWith('图形加速初始化失败：'));if(unexpected.length)throw Error(JSON.stringify(unexpected));
   return{living:living.length,death:death.length,reducedDeath:fixed.length,animationImages:field.images.size,deathImages:field.deathImages.size,expectedAccelerationFailure:field.errors.filter(e=>e.startsWith('图形加速初始化失败：')),unexpected};
  });
  await fallback.screenshot({path:'mindrealm-enemy-fallback.png'});if(issues.length)throw Error(JSON.stringify(issues));return{status:'ENEMY_FALLBACK_ART_AND_DEATH_OK',...result,issues};
 }finally{await fallback.close();}
}
