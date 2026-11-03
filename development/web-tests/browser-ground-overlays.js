async page=>{
 const url=new URL(page.url());if(!['localhost','127.0.0.1'].includes(url.hostname)||url.port==='4173'||url.searchParams.get('qa')!=='1')throw Error('Use isolated QA storage');
 const issues=[];page.on('pageerror',e=>issues.push(e.message));await page.setViewportSize({width:1280,height:800});await page.waitForFunction(()=>window.__mindrealm?.field.realtime?.ready);
 await page.evaluate(async()=>{
  const q=__mindrealm,R=await import('/web/core/state.js'),Rules=await import('/web/core/rules.js'),s=R.newRun('ground-overlays');R.chooseNexus(s,s.nexus[0].options[0]);R.enterNode(s,s.nextNodes[0]);s.units=[];s.nexus.forEach(n=>{n.choice=null;n.skipped=true;});s.relics=[];s.focus=99;
  for(const c of s.terrain.cells){c.h=0;c.ramp=-1;}const paint=(a,b,c,d,h)=>{for(let z=b;z<=d;z++)for(let x=a;x<=c;x++)s.terrain.cells[z*s.terrain.size+x].h=h;};
  paint(15,10,25,19,1);paint(16,11,24,18,2);paint(17,14,23,16,3);
  const rail=R.addUnit(s,'focus_rail');if(!Rules.deploy(s,rail.uid,18,11).ok)throw Error('Rail fixture failed');
  const medic=R.addUnit(s,'memory_mechanic');if(!Rules.deploy(s,medic.uid,27,15).ok)throw Error('Support fixture failed');R.addUnit(s,'anchor_bulwark');
  s.terrain.revision++;q.getSettings().tutorial=false;q.getSettings().reducedMotion=true;q.loadState(s);q.transitions.finish();
  const f=q.field;Object.assign(f.camera,{x:20,z:14,scale:50,yaw:Math.PI/4});f.dirty=true;f.render(performance.now());
 });
 const result=await page.evaluate(async()=>{
  const f=__mindrealm.field,s=__mindrealm.getState(),Rules=await import('/web/core/rules.js'),before=JSON.stringify(s),cases=[];
  const main=f.ctx,draw=f.drawGroundGroups,camera={...f.camera};f.setInteractive(false);f.pointer=null;
  const canvas=()=>{const c=document.createElement('canvas');c.width=f.canvas.width;c.height=f.canvas.height;return c;},layer=canvas(),oracle=canvas(),p=layer.getContext('2d',{willReadFrequently:true}),o=oracle.getContext('2d',{willReadFrequently:true}),rx=layer.width/f.camera.width,ry=layer.height/f.camera.height;
  const poly=(ctx,points,color)=>{ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(const point of points.slice(1))ctx.lineTo(point.x,point.y);ctx.closePath();ctx.fillStyle=color;ctx.fill();};
  let current='';
  f.drawGroundGroups=function(groups,destination,source=this.surfaceState||this.state){
   for(const [height,paint]of groups){
    for(const ctx of [p,o]){ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,layer.width,layer.height);ctx.setTransform(rx,0,0,ry,0,0);}
    draw.call(f,new Map([[height,paint]]),p,source);
    for(const tile of f.projectTerrain(source)){for(const side of tile.sides)poly(o,side.p,'#f00');poly(o,tile.q,tile.h===height?'#00f':'#0f0');}
    const a=p.getImageData(0,0,layer.width,layer.height).data,b=o.getImageData(0,0,layer.width,layer.height).data,face=i=>b[i+3]===0?0:b[i]>245&&b[i+1]<10&&b[i+2]<10?1:b[i+1]>245&&b[i]<10&&b[i+2]<10?2:3;
    let visible=0,leak=0;for(let i=0;i<a.length;i+=4)if(a[i+3]>=18){visible++;const id=face(i),x=i/4%layer.width,y=Math.floor(i/4/layer.width);if(id<3&&x>0&&y>0&&x<layer.width-1&&y<layer.height-1&&[-1,0,1].every(dy=>[-1,0,1].every(dx=>face(i+4*(dy*layer.width+dx))===id)))leak++;}
    if(leak)throw Error(JSON.stringify({current,height,leak}));cases.push({kind:current,yaw:f.camera.yaw,height,visible,leak});
   }
  };
  const inspect=(name,selection)=>{current=name;f.setSelection(selection);f.buildTerrain(f.terrainPreviewState());f.updateRange();f.drawSelectionGround();};
  try{
   for(const yaw of [0,Math.PI/4,Math.PI*.75,Math.PI*1.25]){
    f.camera.yaw=yaw;
    for(const tool of ['raise','lower','flatten']){const command={tool,brush:'single',x:20,z:15},preview=Rules.previewTerrain(s,command);inspect(`terrain-${tool}`,{terrainTool:tool,preview,previewOrigin:{x:20,z:15}});if(preview.ok&&f.surfaceHeight(20,15)!==preview.cells[0].after.h)throw Error('Preview surface does not match proposed height');}
    const blocked=Rules.previewTerrain(s,{tool:'raise',brush:'square',x:18,z:11});inspect('invalid-terrain-box',{terrainTool:'raise',preview:blocked,previewOrigin:{x:18,z:11}});
    inspect('invalid-deployment',{unit:s.units[2],previewOrigin:{x:21,z:13},preview:Rules.placement(s,s.units[2],21,13)});
    inspect('selected-footprint',{selectedUid:s.units[0].uid});inspect('support-recipients',{selectedUid:s.units[1].uid});
    current='ground-path';f.drawGroundPath(Array.from({length:17},(_,i)=>({x:20,z:7+i})),'#ffbb66',3,[2,5]);
   }
  }finally{f.drawGroundGroups=draw;f.ctx=main;f.camera=camera;f.setSelection({});f.buildTerrain();}
  let sideRejected=false;
  for(const tile of [...f.tiles].reverse())for(const side of tile.sides){f.pointer={x:side.p.reduce((n,p)=>n+p.x,0)/4,y:side.p.reduce((n,p)=>n+p.y,0)/4};f.updateHover();if(!f.hover){sideRejected=true;break;}}
  if(!sideRejected)throw Error('Cliff face was never excluded from picking');
  f.pointer=null;f.hover=null;f.setInteractive(true);f.render(performance.now());
  if(before!==JSON.stringify(s))throw Error('Preview altered authoritative state');
  return {cases,sideRejected,unchanged:true,errors:f.errors};
 });
 // Exercise the actual draft/confirmation/cancel/undo flow through the UI.
 await page.evaluate(()=>__mindrealm.render());await page.locator('[data-action="tab-terrain"]').click();await page.locator('[data-action="brush"]').selectOption('single');await page.locator('[data-action="terrain-tool"][data-tool="lower"]').click();
 const point=await page.evaluate(()=>{const f=__mindrealm.field;Object.assign(f.camera,{x:20,z:14,yaw:Math.PI/4});f.zoomLevel=3.3;f.updateScale();f.dirty=true;f.render(performance.now());const r=f.canvas.getBoundingClientRect(),p=f.project(20.5,15.5,3);return{x:r.x+p.x,y:r.y+p.y};});
 const original=await page.evaluate(()=>JSON.stringify([__mindrealm.getState().terrain,__mindrealm.getState().focus]));
 await page.mouse.move(point.x,point.y);await page.waitForFunction(()=>__mindrealm.getContext().preview?.ok);await page.screenshot({path:'output/playwright/terrain-lower-preview.jpg',type:'jpeg',quality:82});
 await page.mouse.click(point.x,point.y);await page.waitForFunction(()=>__mindrealm.getContext().terrainBatch?.ok);
 if(await page.evaluate(()=>JSON.stringify([__mindrealm.getState().terrain,__mindrealm.getState().focus]))!==original)throw Error('Draft charged resources');
 await page.locator('[data-action="terrain-cancel"]').click();
 if(await page.evaluate(()=>JSON.stringify([__mindrealm.getState().terrain,__mindrealm.getState().focus]))!==original)throw Error('Cancel changed terrain');
 await page.mouse.click(point.x,point.y);await page.locator('[data-action="terrain-commit"]').click();await page.getByRole('button',{name:'支付并确认全部',exact:true}).click();await page.waitForFunction(()=>!__mindrealm.dialogs.active);
 const applied=await page.evaluate(()=>({h:__mindrealm.getState().terrain.cells[15*41+20].h,focus:__mindrealm.getState().focus}));if(applied.h!==2||applied.focus>=99)throw Error('Confirmed preview did not apply');if(!await page.evaluate(()=>__mindrealm.store.load().ok))throw Error('Confirmed terrain was not saved');
 await page.locator('[data-action="undo"]').click();
 const restored=await page.evaluate(()=>({h:__mindrealm.getState().terrain.cells[15*41+20].h,focus:__mindrealm.getState().focus}));if(restored.h!==3||restored.focus!==99)throw Error('Undo did not restore terrain and focus');
 if(issues.length||result.errors.length)throw Error(JSON.stringify({issues,result}));
 return {status:'GROUND_OVERLAYS_OK',...result,draftCancelCommitUndo:true,issues};
}
