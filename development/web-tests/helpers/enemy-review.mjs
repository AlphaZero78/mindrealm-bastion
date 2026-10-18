import {EntityRenderer} from '../../../game/web/view/entity-renderer.js';
import {enemies} from '../../../game/web/core/content.js';
import * as T from '../../../game/assets/third_party/three/three.bundle.js';

const renderer=new EntityRenderer(),live=document.querySelector('#live-canvas'),liveContext=live.getContext('2d'),sheet=document.querySelector('#sheet');
await renderer.readyPromise;if(!renderer.ready)throw Error(renderer.errors.join('\n'));
const ids=Object.keys(enemies).filter(id=>renderer.catalog.entities[id].visualRevision===2),select=document.querySelector('#enemy');
for(const id of ids){const option=document.createElement('option');option.value=id;option.textContent=enemies[id].name+' / '+id;select.append(option);}
const phaseName=id=>Object.keys(renderer.catalog.entities[id].variants)[0];
const variantSelect=document.querySelector('#variant');
const selectedVariant=id=>Object.hasOwn(renderer.catalog.entities[id].variants,variantSelect.value)?variantSelect.value:phaseName(id);
function updateVariants(){
 variantSelect.replaceChildren();
 for(const [index,variant]of Object.keys(renderer.catalog.entities[select.value].variants).entries()){
  const option=document.createElement('option');option.value=variant;option.textContent=variant==='base'?'基础外观':`第 ${index+1} 阶段`;variantSelect.append(option);
 }
}
const capture=(id,variant,options={})=>{
 const phase=Math.max(0,Object.keys(renderer.catalog.entities[id].variants).indexOf(variant));
 const canvas=renderer.renderStudy(id,variant,{cell:512,phase,ability:enemies[id]?.ability,...options});
 if(options.elevation!==undefined){
  const elevation=options.elevation*Math.PI/180,yaw=options.yaw??Math.PI/4,focus=renderer.view.focusY||0;
  renderer.camera.position.set(Math.sin(yaw)*Math.cos(elevation)*100,focus+Math.sin(elevation)*100,Math.cos(yaw)*Math.cos(elevation)*100);
  renderer.camera.lookAt(0,focus,0);renderer.camera.updateMatrixWorld();renderer.flush();
 }
 const copy=document.createElement('canvas');copy.width=copy.height=512;copy.getContext('2d').drawImage(canvas,0,0);return copy;
};
const tile=(id,variant,label,options={})=>{const figure=document.createElement('figure'),caption=document.createElement('figcaption');caption.textContent=label;figure.append(capture(id,variant,options),caption);sheet.append(figure);};
function sprite(id,variant,state={},framing=null){
 const cell=160,b=renderer.catalog.entities[id].bounds,span=framing||Math.max(b.x,b.z,b.y*1.05)*1.65;
 renderer.begin({x:0,z:0,yaw:0,width:cell,height:cell,scale:cell/span,focusY:.22*span/Math.cos(55*Math.PI/180)},null,cell,cell);renderer.iconMode=true;
 renderer.keyLight.position.set(-7,10,6);renderer.keyLight.target.position.set(0,b.y*.5,0);
 Object.assign(renderer.keyLight.shadow.camera,{left:-span,right:span,top:span,bottom:-span,near:.5,far:35});renderer.keyLight.shadow.camera.updateProjectionMatrix();
 renderer.add(id,{key:'sprite:'+id,clock:0,action:'idle',progress:0,travel:0,speed:1,moving:false,facing:0,stage:'release',variant,...state},{x:0,z:0,h:0,fp:[2,2]});renderer.flush();return renderer.canvas;
}
function spriteSpan(id,variants,poses){
 const matrix=new T.Matrix4(),point=new T.Vector3(),tilt=55*Math.PI/180,c=Math.cos(tilt),s=Math.sin(tilt);let width=0,top=0,bottom=0;
 // Measure the same posed part matrices used by the renderer. One framing
 // contains all directions, attacks, abilities and corpses without clipping.
 for(const [phase,variant]of variants.entries())for(const pose of poses)for(let direction=0;direction<8;direction++){
  renderer.begin({x:0,z:0,yaw:0,width:160,height:160,scale:1,focusY:0},null,160,160);renderer.iconMode=true;
  renderer.add(id,{key:'measure:'+id,clock:0,action:'idle',progress:0,travel:0,speed:1,moving:false,stage:'release',ability:enemies[id]?.ability,...pose,facing:direction*Math.PI/4,variant,phase},{x:0,z:0,h:0,fp:[2,2]});
  for(const batch of renderer.batches.values())if(batch.count){
   if(!batch.geometry.boundingBox)batch.geometry.computeBoundingBox();const b=batch.geometry.boundingBox;
   for(let i=0;i<batch.count;i++){batch.mesh.getMatrixAt(i,matrix);for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){
    point.set(x,y,z).applyMatrix4(matrix);width=Math.max(width,Math.abs(point.x));const v=point.z*s-point.y*c;top=Math.max(top,-v);bottom=Math.max(bottom,v);
   }}
  }
 }
 const pad=.065;return Math.max(width/(.5-pad),top/(.72-pad),bottom/(.28-pad));
}
function bake(list){
 playing=false;
 return list.map(id=>{
  const model=renderer.catalog.entities[id];if(!model||model.kind==='enemies'&&model.visualRevision!==2)throw Error('Entity has no reviewed model: '+id);
  const enemy=model.kind==='enemies',ability=enemies[id]?.ability;
  const variants=Object.keys(model.variants),atlas=document.createElement('canvas'),rest=document.createElement('canvas'),death=document.createElement('canvas'),portrait=document.createElement('canvas');
  atlas.width=rest.width=death.width=640;atlas.height=variants.length*800;rest.height=variants.length*80;death.height=enemy?variants.length*320:1;portrait.width=256;portrait.height=variants.length*256;
  const a=atlas.getContext('2d'),s=rest.getContext('2d'),d=death.getContext('2d'),p=portrait.getContext('2d');
  const passive=enemy&&!['heal','group_shield','summon','copy','teleport','jam','corrode_resistance','siege','sprint','pressure_aura','haste','shield'].includes(ability);
  const poses=[{action:'idle'},{action:'move',moving:true,travel:.08,clock:170},{action:'move',moving:true,travel:.24,clock:350},{action:'move',moving:true,travel:.42,clock:560},{action:'move',moving:true,travel:.62,clock:790},{action:'attack',progress:.1},{action:'attack',progress:.43},{action:'attack',progress:.76},passive?{action:'attack',progress:.2}:{action:'cast',stage:'windup',progress:.85,clock:935},passive?{action:'hit',hit:.85,progress:.15}:{action:'cast',stage:'release',progress:.27,clock:1213}];
  const deathPoses=enemy?[.08,.32,.63,1].map(progress=>({action:'death',progress})):[],framing=spriteSpan(id,variants,[...poses,...deathPoses]);
  for(const [vi,variant]of variants.entries()){
   p.drawImage(renderer.renderIcon(id,variant,256),0,vi*256);
   for(let row=0;row<10;row++)for(let direction=0;direction<8;direction++)a.drawImage(sprite(id,variant,{...poses[row],ability,phase:vi,facing:direction*Math.PI/4},framing),direction*80,(vi*10+row)*80,80,80);
   s.drawImage(atlas,0,vi*800,640,80,0,vi*80,640,80);
   for(let row=0;row<deathPoses.length;row++)for(let direction=0;direction<8;direction++)d.drawImage(sprite(id,variant,{...deathPoses[row],ability,phase:vi,facing:direction*Math.PI/4},framing),direction*80,(vi*4+row)*80,80,80);
  }
  return {id,kind:model.kind,variants,role:model.role,locomotion:model.locomotion,ability,cell:80,directions:8,poseRows:10,deathRows:deathPoses.length,rows:variants.length*10,baseline:.72,bearing:0,elevation:55,framing,source:'actual game EntityRenderer',animation:atlas.toDataURL('image/png'),static:rest.toDataURL('image/png'),...(enemy?{death:death.toDataURL('image/png')}:{}),portrait:portrait.toDataURL('image/png')};
 });
}
function frames(id=select.value){
 window.scrollTo(0,0);
 sheet.replaceChildren();const variant=selectedVariant(id);
 tile(id,variant,enemies[id].name+' · 左右对称 / '+variant,{yaw:0,elevation:18});tile(id,variant,'侧面承重与装配层次',{yaw:Math.PI/2,elevation:18});tile(id,variant,'后部连接 / '+variant,{yaw:Math.PI,elevation:18});
 tile(id,variant,'接地步态 · 支撑/回摆',{action:'move',progress:.23,travel:.43,clock:430});
 tile(id,variant,'攻击工作行程',{action:'attack',progress:.45,clock:450});tile(id,variant,'能力准备 / 独立机构',{action:'cast',stage:'windup',progress:.8,clock:800});
 const d=renderer.catalog.entities[id];document.querySelector('#details').textContent=JSON.stringify({id,variant,parts:Object.values(d.variants).map(p=>p.length),joints:d.rig.length,variants:Object.keys(d.variants),bounds:d.bounds},null,2);
}
function flightResponse(list,{fromSpeed=.15}={}){
 playing=false;
 return list.map(id=>{
  const model=renderer.catalog.entities[id];if(model.locomotion!=='hover')throw Error('Not a stable flight model: '+id);
  const variants=Object.keys(model.variants),canvas=document.createElement('canvas');canvas.width=160;canvas.height=variants.length*80;
  const speeds=[fromSpeed,1.5],poses=speeds.map(speed=>({action:speed>0?'move':'hover',moving:speed>0,clock:560,travel:.31,speed})),framing=spriteSpan(id,variants,poses);
  for(const [phase,variant]of variants.entries())for(const [i,pose]of poses.entries())canvas.getContext('2d').drawImage(sprite(id,variant,{...pose,phase,facing:Math.PI/4},framing),i*80,phase*80,80,80);
  return {id,flightSpeeds:speeds,flightResponse:canvas.toDataURL('image/png'),flightSource:'actual game EntityRenderer, same clock/travel, actual flight command response'};
 });
}
function rollingResponse(list){
 playing=false;
 return list.map(id=>{
  const model=renderer.catalog.entities[id],wheels=Object.values(model.variants)[0].filter(p=>p.source==='refined/drive-wheel');
  if(!wheels.length)throw Error('Entity has no drive wheel: '+id);
  const variants=Object.keys(model.variants),cell=512,travel=wheels[0].size[0]/2*.41,canvas=document.createElement('canvas');
  canvas.width=cell*2;canvas.height=variants.length*cell;
  for(const [phase,variant]of variants.entries())for(const [i,distance]of [0,travel].entries()){
   const frame=renderer.renderStudy(id,variant,{cell,phase,action:'move',moving:true,clock:560,speed:1,travel:distance,yaw:Math.PI/2});
   canvas.getContext('2d').drawImage(frame,i*cell,phase*cell);
  }
  return {id,rollingWheels:wheels.length,rollingCell:cell,rollingTravel:[0,travel],rollingResponse:canvas.toDataURL('image/png'),rollingSource:'actual game EntityRenderer; same clock, speed and world position; actual tyre travel changes'};
 });
}
function group(list=ids.slice(0,5)){
 window.scrollTo(0,0);
 sheet.replaceChildren();for(const id of list)tile(id,phaseName(id),enemies[id].name+' · '+id);
 tile('memory_mechanic','T3A','建筑细节参照 · 记忆维修师 T3A');
}
let playing=true,time=0,last=performance.now();
function renderLive(){const id=select.value,action=document.querySelector('#action').value,stage=document.querySelector('#stage').value;
 if(id){const variant=selectedVariant(id),phase=Object.keys(renderer.catalog.entities[id].variants).indexOf(variant),moving=action==='move'||action==='cast'&&document.querySelector('#moving-cast').checked;
  const canvas=renderer.renderStudy(id,variant,{cell:512,action,stage,phase,moving,ability:enemies[id].ability,clock:time*1000,travel:time*.75,progress:action==='move'?(time*.75/1.5)%1:time%1});liveContext.clearRect(0,0,512,512);liveContext.drawImage(canvas,0,0);
 }
}
function paint(now){const dt=Math.min(.05,(now-last)/1000);last=now;if(playing){time+=dt;renderLive();}
 requestAnimationFrame(paint);
}
select.addEventListener('change',()=>{updateVariants();frames();renderLive();});variantSelect.addEventListener('change',()=>{frames();renderLive();});
for(const control of ['action','stage','moving-cast'])document.querySelector('#'+control).addEventListener('change',renderLive);
document.querySelector('#sheet-button').addEventListener('click',()=>frames());document.querySelector('#group-button').addEventListener('click',()=>group());document.querySelector('#play').addEventListener('click',event=>{playing=!playing;event.target.textContent=playing?'暂停':'继续';});
window.enemyReview={renderer,ids,frames,group,capture,bake,flightResponse,rollingResponse,select(id){select.value=id;updateVariants();frames(id);renderLive();},pause(){playing=false;document.querySelector('#play').textContent='继续';},resume(){playing=true;document.querySelector('#play').textContent='暂停';},get time(){return time;},contactSheet(list){
 const canvas=document.createElement('canvas'),size=400,cols=3,rows=Math.ceil(list.length/cols);canvas.width=cols*size;canvas.height=rows*(size+28);const c=canvas.getContext('2d');c.fillStyle='#d6dedb';c.fillRect(0,0,canvas.width,canvas.height);c.font='16px serif';
 for(const [i,item]of list.entries()){const id=item.id,variant=item.variant||phaseName(id),x=(i%cols)*size,y=Math.floor(i/cols)*(size+28);c.drawImage(capture(id,variant,item),x,y,size,size);c.fillStyle='#263239';c.fillText(item.label||id+' / '+(item.action||'idle'),x+8,y+size+20);}
 return canvas.toDataURL('image/jpeg',.78);
}};
document.querySelector('#status').textContent=`已载入 ${ids.length} / ${Object.keys(enemies).length} 个独立重制模型；全部采用实际游戏渲染器。`;
if(ids.length){updateVariants();frames();requestAnimationFrame(paint);}
