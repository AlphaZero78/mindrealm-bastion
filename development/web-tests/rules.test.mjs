import test from 'node:test';
import assert from 'node:assert/strict';
import {newRun,addUnit,cloneState} from '../../web/core/state.js';
import * as R from '../../web/core/rules.js';
import {towers} from '../../web/core/content.js';
import {fixture,place,battle} from './helpers/battle-fixture.mjs';

test('deployment checks full footprint, height, protection, overlap, ramps and bandwidth atomically',()=>{
  const s=fixture(),u=addUnit(s,'focus_rail');
  const unchanged=(x,z,reason)=>{const before=cloneState(s);const p=R.placement(s,u,x,z);assert.equal(p.ok,false);assert.match(p.reason,reason);assert.equal(R.deploy(s,u.uid,x,z).ok,false);assert.deepEqual(s,before);};
  unchanged(40,40,/超出/);unchanged(7.5,7,/超出/);unchanged(20,23,/保护/);unchanged(5,5,/高台/);
  for(const c of R.footprint(s,u,5,5))R.cellAt(s,c.x,c.z).h=1;
  R.cellAt(s,7,6).h=2;unchanged(5,5,/等高/);R.cellAt(s,7,6).h=1;
  R.cellAt(s,6,5).ramp=0;unchanged(5,5,/斜坡/);R.cellAt(s,6,5).ramp=-1;
  s.bandwidth=4;unchanged(5,5,/带宽/);s.bandwidth=20;
  const before=cloneState(s),p=R.placement(s,u,5,5);assert.equal(p.ok,true);assert.deepEqual(s,before,'preview/cancel does not mutate');
  assert.equal(R.deploy(s,u.uid,5,5).ok,true);assert.equal(s.focus,99);assert.equal(R.bandwidthState(s).used,5);
  const v=addUnit(s,'pulse_array');assert.match(R.placement(s,v,5,5).reason,/占用/);
  const m=addUnit(s,'phase_blade');assert.match(R.placement(s,m,5,5).reason,/地面/);
  u.hp=0;assert.match(R.placement(s,u,5,5).reason,/损坏/);
});

test('maintenance charges proportional durability, relocation and withdrawal; failures preserve positions',()=>{
  const s=fixture(),u=place(s,'anchor_bulwark',8,8);const full=R.unitStats(s,u).hp;
  u.hp=full*.5;assert.equal(R.repairCost(s,u),20);assert.equal(R.moveCost(s,u),6);
  let before=cloneState(s);s.focus=0;before=cloneState(s);assert.equal(R.repair(s,u.uid).ok,false);assert.equal(R.withdraw(s,u.uid).ok,false);assert.deepEqual(s,before);
  s.focus=99;s.relics=['repair_reserve','cheap_relocation'];assert.equal(R.repairCost(s,u),15);assert.equal(R.moveCost(s,u),4);
  assert.equal(R.withdraw(s,u.uid).ok,true);assert.equal(s.focus,95);assert.equal(u.x,null);
  assert.equal(R.deploy(s,u.uid,10,10).cost,4);assert.equal(R.repair(s,u.uid).cost,15);assert.equal(s.focus,76);assert.equal(u.hp,full);assert.equal(u.x,null);
  before=cloneState(s);assert.equal(R.repair(s,u.uid).ok,false);assert.deepEqual(s,before);
});

test('all twelve units upgrade through either branch and fusion inherits combined health without resetting position',()=>{
  for(const type of Object.keys(towers))for(const branch of ['A','B']){
    const s=fixture(),u=place(s,type,8,8,{h:towers[type].role==='ranged'?1:0});s.focus=1000;u.hp=R.unitStats(s,u).hp*.4;
    let before=cloneState(s);assert.equal(R.upgrade(s,u.uid,'invalid').ok,false);assert.deepEqual(s,before);
    assert.equal(R.upgrade(s,u.uid,branch).ok,true);assert.equal(u.tier,2);assert.ok(Math.abs(u.hp/R.unitStats(s,u).hp-.4)<1e-9);
    before=cloneState(s);assert.equal(R.upgrade(s,u.uid,branch==='A'?'B':'A').ok,false);assert.deepEqual(s,before);
    assert.equal(R.upgrade(s,u.uid,branch).ok,true);assert.equal(u.tier,3);assert.equal(R.upgrade(s,u.uid,branch).ok,false);
    const f=fixture(),core=place(f,type,9,9,{h:towers[type].role==='ranged'?1:0});
    const a=addUnit(f,type),b=addUnit(f,type);core.hp*=.2;a.hp*=.5;b.hp*=.8;
    assert.equal(R.fuse(f,core.uid,branch).ok,true);assert.equal(f.units.length,1);assert.equal(core.tier,2);assert.equal(core.branch,branch);assert.equal(core.x,9);assert.ok(Math.abs(core.hp/R.unitStats(f,core).hp-.5)<1e-9);
    addUnit(f,type,2,branch);addUnit(f,type,2,branch==='A'?'B':'A');before=cloneState(f);assert.equal(R.fuse(f,core.uid,branch).ok,false);assert.deepEqual(f,before);
    f.units.at(-1).branch=branch;assert.equal(R.fuse(f,core.uid,branch).ok,true);assert.equal(core.tier,3);assert.equal(f.units.length,1);
  }
});

test('terrain commands are atomic and undo refunds exact paid amounts; every brush and invalid command is bounded',()=>{
  const s=fixture();
  for(const command of [{x:-1,z:5,tool:'raise'},{x:20,z:24,tool:'raise'},{x:0,z:1,tool:'raise',brush:'square'},{x:5.2,z:6,tool:'raise'},{x:5,z:6,tool:'raise',brush:'bad'},{x:5,z:6,tool:'raise',direction:NaN}]){
    const before=cloneState(s);assert.equal(R.applyTerrain(s,command).ok,false);assert.deepEqual(s,before);
  }
  for(const [brush,count]of [['single',1],['square',9],['line',5]]){
    const command={x:8,z:8,tool:'raise',brush,direction:-1},before=cloneState(s),preview=R.previewTerrain(s,command);assert.equal(preview.ok,true);assert.equal(preview.cells.length,count);assert.equal(preview.cost,count*2);assert.deepEqual(s,before);
    assert.equal(R.applyTerrain(s,command).ok,true);assert.equal(s.focus,99-count*2);assert.equal(R.undoTerrain(s).ok,true);assert.equal(s.focus,99);assert.deepEqual(s.terrain.cells,before.terrain.cells);
  }
  R.cellAt(s,8,8).h=4;assert.equal(R.applyTerrain(s,{x:8,z:8,tool:'raise'}).ok,false);
  assert.equal(R.applyTerrain(s,{x:8,z:8,tool:'flatten'}).ok,true);assert.equal(R.cellAt(s,8,8).h,0);R.undoTerrain(s);
  s.focus=0;const before=cloneState(s);assert.equal(R.applyTerrain(s,{x:7,z:8,tool:'raise'}).ok,false);assert.deepEqual(s,before);
});

test('ramps are directional and destructible cliffs route toward a reachable fire',()=>{
  const s=fixture();R.cellAt(s,8,8).h=1;
  assert.equal(R.edgeInfo(s,{x:8,z:7},{x:8,z:8}).passable,false);
  assert.equal(R.applyTerrain(s,{x:8,z:7,tool:'ramp',direction:2}).ok,true);
  assert.equal(R.edgeInfo(s,{x:8,z:7},{x:8,z:8}).passable,true);
  assert.equal(R.edgeInfo(s,{x:8,z:8},{x:8,z:7}).passable,true);
  assert.equal(R.edgeInfo(s,{x:7,z:8},{x:8,z:8}).passable,false);
  assert.equal(R.edgeInfo(s,{x:0,z:0},{x:8,z:8}).passable,false);
  assert.equal(R.applyTerrain(s,{x:8,z:7,tool:'ramp',direction:2}).ok,true);assert.equal(R.cellAt(s,8,7).ramp,-1);
  for(let x=0;x<41;x++)R.cellAt(s,x,10).h=1;s.terrain.revision++;
  const path=R.pathToCore(s,20,0);assert.ok(path.some(p=>p.barrier));assert.ok(path.length<1681);assert.equal(path.at(-1).distance,0);
  for(let x=0;x<41;x++)R.cellAt(s,x,10).h=0;s.terrain.revision++;assert.ok(R.pathToCore(s,20,0).every(p=>!p.barrier));
});

test('height, range, direct sight and indirect fire share one exact authority across height pairs',()=>{
  for(let from=0;from<=4;from++)for(let to=0;to<=4;to++){
    const s=fixture(),u=place(s,'pulse_array',10,10,{h:from});const target={x:14,z:10.5,h:to,air:false,armor:0,hp:100,maxHp:100};
    const solution=R.solveAttack(s,u,target),high=Math.max(0,from-to);
    assert.ok(Math.abs(solution.range-towers.pulse_array.range*(1+.08*high))<1e-9);
    assert.ok(Math.abs(solution.damage-towers.pulse_array.attack*(from>=to?1+.1*high:1+.12*(from-to)))<1e-9);
    for(const pierce of [0,.5,1]){const incoming=R.incomingDamage(s,u,{x:14,z:10,pierce},100);assert.ok(incoming>=1);}
  }
  const s=fixture(),u=place(s,'pulse_array',10,10,{h:2}),target={x:16,z:10.5,h:0,air:false,armor:0};
  assert.equal(R.solveAttack(s,u,target).ok,true,'own platform edge never blocks downward shots');
  R.cellAt(s,13,11).h=4;assert.equal(R.solveAttack(s,u,target).blocked,true);
  u.type='drone_loom';assert.equal(R.solveAttack(s,u,target).blocked,false);assert.equal(R.solveAttack(s,u,target).ok,true);
  u.type='phase_blade';assert.equal(R.solveAttack(s,u,{...target,air:true}).ok,false);
  u.type='pulse_array';assert.equal(R.solveAttack(s,u,{...target,armor:10000}).damage,towers.pulse_array.attack*.05);
});

test('newest units disable first; relays, destroyed units and jam resistance cannot supply inactive bonuses',()=>{
  const s=fixture();s.bandwidth=9;const first=place(s,'anchor_bulwark',8,8),second=place(s,'phase_blade',10,8),last=place(s,'pulse_array',12,8,{h:1});
  s.battle={jam:4};let bw=R.bandwidthState(s);assert.deepEqual(bw.disabled,[last.uid,second.uid]);assert.equal(bw.activeUsed,3);
  s.battle.jam=0;assert.deepEqual(R.bandwidthState(s).disabled,[]);
  last.hp=0;assert.equal(R.bandwidthState(s).used,6);
  const relay=place(s,'bandwidth_relay',14,8,{tier:2,branch:'B'});s.bandwidth=4;s.battle.jam=12;bw=R.bandwidthState(s);assert.ok(bw.disabled.includes(relay.uid));assert.equal(bw.cap,0);assert.equal(bw.activeUsed,0);
  relay.hp=0;s.battle.jam=0;assert.equal(R.bandwidthState(s).cap,4);
});

test('all preparation mutations and previews reject battle state without spending resources',()=>{
  const s=fixture(),u=place(s,'anchor_bulwark',8,8);u.hp*=.5;addUnit(s,u.type);addUnit(s,u.type);battle(s);const before=cloneState(s);
  for(const action of [()=>R.deploy(s,u.uid,12,12),()=>R.withdraw(s,u.uid),()=>R.repair(s,u.uid),()=>R.upgrade(s,u.uid,'A'),()=>R.fuse(s,u.uid,'B'),()=>R.setPriority(s,u.uid,'far'),()=>R.applyTerrain(s,{x:8,z:7,tool:'raise'}),()=>R.undoTerrain(s)])assert.equal(action().ok,false);
  assert.deepEqual(s,before);
});
