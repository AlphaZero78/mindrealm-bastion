import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {enemies} from '../../game/web/core/content.js';
import {animateEnemy,enemyAnimationIds} from '../../game/web/view/enemy-animation-bank.js';
import {wheelRollAngle,wheelSupportHeight} from '../../game/web/view/enemy-rig.js';
import {validateEnemyModel} from '../web-tools/build-enemy-models.mjs';
import * as T from '../../game/assets/third_party/three/three.bundle.js';

const catalog=JSON.parse(await readFile(new URL('../../game/assets/game/models/models.json',import.meta.url),'utf8'));
const context={action:'idle',progress:0,clock:0,travel:0,speed:1,moving:false,stage:'release',phase:0,hit:0,shieldFraction:0,abilityElapsed:0,abilityRemaining:0,abilityActive:false};
const samples=[
 {},{action:'preview'},{action:'move',moving:true,travel:.17,clock:170},
 {action:'attack',progress:.43,clock:430},
 {action:'cast',stage:'windup',progress:.82,moving:true,travel:.31,clock:902},
 {action:'cast',stage:'release',progress:.27,moving:true,travel:.43,clock:1213},
 {action:'move',moving:true,travel:.63,clock:1800,abilityActive:true,abilityElapsed:.7,abilityRemaining:2.3,boosted:true,sprinting:true,shieldFraction:.12},
 {action:'hit',progress:.2,hit:.85},{action:'death',progress:.63},{action:'wreck'},
 {action:'move',moving:true,travel:.31,reducedMotion:true},{action:'death',progress:.24,reducedMotion:true},
];

test('all 37 enemy assemblies have an independent authoring module and a complete runtime rig',async()=>{
 const names=Object.keys(enemies).sort(),authored=(await readdir(new URL('../assets/enemy_rework/',import.meta.url))).filter(f=>f.endsWith('.mjs')).map(f=>f.slice(0,-4)).sort();
 assert.deepEqual(authored,names);assert.deepEqual([...enemyAnimationIds].sort(),names);
 for(const id of names){
  const module=await import(new URL('../assets/enemy_rework/'+id+'.mjs',import.meta.url)),compiled=validateEnemyModel(module.default,catalog.sources);
  assert.deepEqual(catalog.entities[id],JSON.parse(JSON.stringify(compiled)),id);assert.equal(compiled.visualRevision,2,id);
  assert.equal(compiled.role,enemies[id].kind,id);assert.ok(compiled.rig.length>=4,id);
  for(const parts of Object.values(compiled.variants))for(const part of parts)assert.equal(part.motion,'fixed',id+'/'+part.label);
 }
});

test('enemy action overlays are finite, refer to real joints and remain deterministic when simulation time is frozen',()=>{
 for(const id of Object.keys(enemies)){
  const known=new Set(catalog.entities[id].rig.map(j=>j.id));
  for(let phase=0;phase<(enemies[id].kind==='boss'?3:1);phase++)for(const sample of samples){
   const ctx=Object.freeze({...context,...sample,phase,ability:enemies[id].ability}),before=JSON.stringify(ctx),pose=animateEnemy(id,ctx);
   assert.ok(pose&&typeof pose==='object',id);assert.equal(JSON.stringify(ctx),before,id+' input');assert.deepEqual(animateEnemy(id,ctx),pose,id+' paused pose');
   for(const [name,delta]of Object.entries(pose.joints||{})){
    assert.ok(known.has(name),id+'/'+name);for(const values of [delta.rotation,delta.position])if(values)assert.ok(values.length===3&&values.every(Number.isFinite),id+'/'+name);
   }
   for(const values of [pose.root?.rotation,pose.root?.position])if(values)assert.ok(values.length===3&&values.every(Number.isFinite),id+' root');
  }
 }
});

function transform(rotation=[0,0,0],position=[0,0,0],scale=[1,1,1]){
 return new T.Matrix4().compose(new T.Vector3(...position),new T.Quaternion().setFromEuler(new T.Euler(...rotation,'ZYX')),new T.Vector3(...scale));
}
function rigMatrices(definition,pose){
 const joints=new Map();
 for(const joint of definition.rig){
  const delta=pose.joints?.[joint.id]||{},matrix=new T.Matrix4().makeTranslation(...joint.pivot)
   .multiply(transform(delta.rotation,delta.position))
   .multiply(new T.Matrix4().makeTranslation(...joint.pivot.map(v=>-v)));
  if(joint.parent)matrix.premultiply(joints.get(joint.parent));joints.set(joint.id,matrix);
 }
 return {joints,root:transform(pose.root?.rotation,pose.root?.position)};
}
function partMatrix(part,rig){
 return transform(part.rotation.map(v=>v*Math.PI/180),part.position,part.size)
  .premultiply(rig.joints.get(part.joint)).premultiply(rig.root);
}
async function sourceVertices(source){
 const bytes=await readFile(new URL('../../game/'+catalog.sources[source].path.slice(1),import.meta.url));
 const parsed=await new T.GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const points=[];parsed.scene.updateMatrixWorld(true);
 parsed.scene.traverse(node=>{
  if(!node.isMesh||node.userData.lod!==0)return;
  const positions=node.geometry.attributes.position;
  for(let i=0;i<positions.count;i++){
   const p=new T.Vector3().fromBufferAttribute(positions,i).applyMatrix4(node.matrixWorld);
   points.push(new T.Vector3(p.x,-p.z,p.y));
  }
 });
 assert.ok(points.length>100,'Actual machined LOD0 vertices');return points;
}

test('refined wheel rotation cancels travel at its actual contact radius',()=>{
 for(const radius of [.26,.27,.30,.32,.36])for(const travel of [.03,.17,.63,1.2,4]){
  const angle=wheelRollAngle(travel,radius),step=1e-6,derivative=(wheelRollAngle(travel+step,radius)-wheelRollAngle(travel-step,radius))/(2*step);
  assert.ok(Math.abs(wheelSupportHeight(angle,radius)*derivative-1)<1e-6,`r=${radius} s=${travel}`);
 }
});

test('every wheeled enemy keeps actual GLB tyre vertices planted during movement and moving preparation',async()=>{
 const source='refined/drive-wheel',points=await sourceVertices(source),step=1e-4;
 const rim=points.filter(p=>Math.abs(Math.hypot(p.x,p.y)-.5)<1e-6);
 assert.ok(new Set(rim.map(p=>Math.atan2(p.y,p.x).toFixed(5))).size>=64,'Smooth 64-segment contact rib');
 let checked=0;
 for(const [id,definition]of Object.entries(catalog.entities)){
  if(definition.visualRevision!==2)continue;
  assert.equal(Object.values(definition.variants)[0].filter(p=>p.joint.startsWith('wheel')&&p.source==='tower-defense-kit/tower-round-middle-a').length,0,id+' retained an unrefined wheel');
  const wheels=Object.values(definition.variants)[0].filter(p=>p.source===source&&p.joint.startsWith('wheel')&&!p.detail);if(!wheels.length)continue;
  checked+=wheels.length;
  for(const action of ['move','cast'])for(const travel of [.03,.17,.63,1.2]){
   const ctx={...context,action,stage:'windup',progress:.6,moving:true,travel},rig=rigMatrices(definition,animateEnemy(id,ctx)),nextRig=rigMatrices(definition,animateEnemy(id,{...ctx,travel:travel+step}));
   for(const part of wheels){
    const matrix=partMatrix(part,rig),nextMatrix=partMatrix(part,nextRig);let lowest=null,height=Infinity;
    for(const vertex of points){const p=vertex.clone().applyMatrix4(matrix);if(p.z<height){height=p.z;lowest=vertex;}}
    assert.ok(Math.abs(height)<3e-6,id+'/'+part.joint+' ground '+height);
    const a=lowest.clone().applyMatrix4(matrix),b=lowest.clone().applyMatrix4(nextMatrix),worldDrift=(b.y-(travel+step))-(a.y-travel);
    assert.ok(Math.abs(worldDrift)<2e-8,id+'/'+part.joint+' contact drift '+worldDrift);
   }
  }
 }
 assert.ok(checked>=60,'All wheeled enemies use the detailed tyre');
});

test('walking enemies retain support contacts without sliding, including moving ability preparation',()=>{
 const step=1e-5,activeAbilities=new Set(['heal','shield','group_shield','teleport','pressure_aura','sprint']);
 for(const [id,spec]of Object.entries(enemies)){
  const definition=catalog.entities[id],feet=definition.rig.filter(j=>j.id.startsWith('ankle'));if(feet.length<2)continue;
  for(const action of activeAbilities.has(spec.ability)?['move','cast']:['move'])for(const progress of action==='cast'?[0,.1,.65,1]:[0])for(const travel of [.03,.17,.33,.59,.91]){
   const ctx={...context,action,stage:'windup',progress,moving:true,travel},rig=rigMatrices(definition,animateEnemy(id,ctx)),nextRig=rigMatrices(definition,animateEnemy(id,{...ctx,travel:travel+step}));
   let supports=0;
   for(const foot of feet){
    const a=new T.Vector3(...foot.pivot).applyMatrix4(rig.joints.get(foot.id)).applyMatrix4(rig.root);
    const b=new T.Vector3(...foot.pivot).applyMatrix4(nextRig.joints.get(foot.id)).applyMatrix4(nextRig.root);
    assert.ok(a.z>=foot.pivot[2]-2e-5,id+'/'+foot.id+' penetrated ground contact');
    if(Math.abs(a.z-foot.pivot[2])<2e-5&&Math.abs(b.z-foot.pivot[2])<2e-5){
     supports++;const drift=(b.y-travel-step)-(a.y-travel);
     assert.ok(Math.abs(drift)<2e-7,id+'/'+foot.id+' stance drift '+drift);
    }
   }
   assert.ok(supports>=(feet.length===2?1:2),id+' '+action+' has '+supports+' support contacts');
  }
 }
});

test('sprint startup keeps the runner contact cycle and preparation continuous',()=>{
 const before={...context,action:'cast',stage:'windup',progress:1,moving:true,travel:.24},after={...before,stage:'release',progress:0,sprinting:true,abilityElapsed:0,abilityRemaining:3};
 const a=animateEnemy('spike_runner',before),b=animateEnemy('spike_runner',after);
 for(const name of ['chassis','hipL','kneeL','ankleL','toeL','hipR','kneeR','ankleR','toeR','ram','latch','brakeL','brakeR'])assert.deepEqual(a.joints[name],b.joints[name],name);
});

test('reduced motion shows every enemy and boss phase in its complete fixed death pose',()=>{
 for(const [id,spec]of Object.entries(enemies))for(let phase=0;phase<(spec.kind==='boss'?3:1);phase++){
  const normal=animateEnemy(id,{...context,phase,action:'death',progress:1}),reduced=animateEnemy(id,{...context,phase,action:'death',progress:.1,reducedMotion:true});
  assert.deepEqual(reduced,normal,id+'/'+phase+' fixed collapsed pose');
 }
 for(const id of ['floating_noise','echo_glider']){
  const terminal=animateEnemy(id,{...context,action:'death',progress:1,clock:2100,deathStartClock:1450});
  for(const clock of [1480,1710,2010])assert.deepEqual(animateEnemy(id,{...context,action:'death',progress:.1,clock,deathStartClock:1450,reducedMotion:true}),terminal,id+' keeps the same arrested motor phase');
 }
});
