import test from 'node:test';
import assert from 'node:assert/strict';
import {EntityMotion} from '../../web/view/entity-motion.js';
const variants=['T1','T2A','T2B','T3A','T3B'];
const fixture=()=>({phase:'battle',units:[{uid:'u1',type:'pulse_array',x:2,z:2,hp:100,tier:1,facing:0}],battle:{time:10,enemies:[{id:'e1',type:'static_drifter',x:5,z:5,hp:100,motion:{distance:.8,dx:.05,dz:0}}]}});

test('entity actions and walk phase use simulation time and do not mutate a run',()=>{
 const s=fixture(),m=new EntityMotion(),u=s.units[0];u.lastActionAt=10;u.actionKind='direct';u.facing=Math.PI/2;
 const source=JSON.stringify(s);m.update(s,[],100);const a=m.sample(u,'unit',{variants}),walk=m.sample(s.battle.enemies[0],'enemy');
 assert.equal(a.action,'attack');assert.equal(a.pose,5);assert.equal(a.facing,Math.PI/2);assert.equal(walk.action,'move');assert.equal(walk.pose,3);assert.equal(JSON.stringify(s),source);
 m.update(s,[],100000);assert.deepEqual(m.sample(u,'unit',{variants}),a,'wall clock cannot animate a paused battle');
 s.battle.time=10.1;m.update(s);assert.equal(m.sample(u,'unit').pose,6);s.battle.time=10.3;m.update(s);assert.equal(m.sample(u,'unit').pose,7);s.battle.time=10.5;m.update(s);assert.equal(m.sample(u,'unit').pose,0);
 s.battle.enemies[0].motion.dx=0;m.update(s);assert.equal(m.sample(s.battle.enemies[0],'enemy').action,'idle','stationary ground enemies do not walk in place');
});
test('all tower branches and boss phases select their actual model variant',()=>{
 const s=fixture(),m=new EntityMotion();m.update(s);
 for(const [i,variant]of variants.entries()){const u={...s.units[0],tier:Number(variant[1]),branch:variant[2]||null};assert.equal(m.sample(u,'unit',{variants}).variantIndex,i);}
 for(let phase=0;phase<3;phase++)assert.equal(m.sample({...s.battle.enemies[0],phase},'enemy',{variants:['phase1','phase2','phase3']}).variantIndex,phase);
});
test('actual cast deadline wins over obsolete warning time and repair uses cast release',()=>{
 const s=fixture(),m=new EntityMotion(),e=s.battle.enemies[0],u=s.units[0];Object.assign(e,{castUntil:10.6,warningUntil:11.1});m.update(s);assert.equal(m.sample(e,'enemy').pose,8);
 s.battle.time=10.6;Object.assign(e,{castUntil:0,lastActionAt:10.6,actionKind:'ability-release'});m.update(s);assert.equal(m.sample(e,'enemy').pose,9);
 Object.assign(u,{lastActionAt:10.6,actionKind:'repair'});assert.equal(m.sample(u,'unit').pose,9);
 e.surgeWarningUntil=12;assert.equal(m.sample(e,'enemy').pose,8);
});
test('hit, explicit death and removed enemy retain a bounded visual snapshot, then expire on simulation time',()=>{
 const s=fixture(),m=new EntityMotion(),e=s.battle.enemies[0];m.update(s);s.battle.time=10.1;e.hp=80;m.update(s);assert.equal(m.sample(e,'enemy').hit,1);
 const corpse={...e,phase:2,hp:0};s.battle.enemies=[];m.update(s,[{action:'death',sourceKind:'enemy',sourceId:e.id,time:10.1,entity:corpse}]);assert.equal(m.deaths.length,1);assert.equal(m.deaths[0].entity.phase,2);
 m.update(s,[],1e6);assert.equal(m.deaths.length,1);s.battle.time=10.8;m.update(s);assert.equal(m.deaths.length,0);assert.equal(m.tracks.size,1);
});
test('reduced motion and inactive entities keep status without steps or recoil; new views clear animation',()=>{
 const s=fixture(),m=new EntityMotion(),u=s.units[0];m.update(s);assert.equal(m.sample(s.battle.enemies[0],'enemy',{reducedMotion:true}).pose,0);
 Object.assign(u,{lastActionAt:10,actionKind:'direct'});assert.equal(m.sample(u,'unit',{reducedMotion:true}).pose,6);u.disabled=true;assert.equal(m.sample(u,'unit').action,'disabled');u.disabled=false;u.hp=0;assert.equal(m.sample(u,'unit').action,'wreck');
 m.update(null,[],1000);assert.equal(m.tracks.size,0);assert.equal(m.deaths.length,0);assert.equal(m.clock,1000);
});
