import test from 'node:test';
import assert from 'node:assert/strict';
import {startBattle,stepBattle} from '../../web/core/battle.js';
import {unitCenter,unitStats,coreOf,cellAt} from '../../web/core/rules.js';
import {cloneState} from '../../web/core/state.js';
import {fixture,place,battle} from './helpers/battle-fixture.mjs';

const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const pin=(e,x=14,z=10.5)=>Object.assign(e,{x,z,h:0,speed:0,hp:1e5,maxHp:1e5,cooldown:1e5,abilityClock:1e5,surgeClock:1e5});
const pauseUnits=s=>{for(const u of s.units)u.cooldown=1e5;};
const point=(s,u)=>({...unitCenter(u),h:cellAt(s,unitCenter(u).x,unitCenter(u).z).h});

test('attack events identify exact rule centers, elevations, target and simulation time without adding sound events',()=>{
  const s=fixture(),u=place(s,'pulse_array',10,10,{h:2}),[e]=battle(s);pin(e);u.cooldown=0;
  const out=stepBattle(s,.05),shot=out.events.find(e=>e.type==='shot');
  assert.equal(out.events.length,1);assert.equal(shot.sourceId,u.uid);assert.equal(shot.sourceKind,'unit');assert.equal(shot.sourceType,u.type);
  assert.equal(shot.targetId,e.id);assert.equal(shot.targetKind,'enemy');assert.equal(shot.targetType,e.type);
  assert.deepEqual(shot.from,point(s,u));assert.deepEqual(shot.to,{x:e.x,z:e.z,h:e.h});
  assert.equal(shot.action,'attack');assert.equal(shot.stage,'release');assert.equal(shot.actionKind,'direct');close(shot.time,s.battle.time);
  close(u.facing,Math.atan2(e.x-unitCenter(u).x,e.z-unitCenter(u).z));assert.equal(u.actionTargetId,e.id);assert.equal(u.lastActionAt,shot.time);assert.equal(e.lastHitAt,shot.time);
  close(shot.damage,e.maxHp-e.hp);assert.equal(shot.shieldDamage,0);
  const sequence=shot.sequence;u.cooldown=0;const next=stepBattle(s,.05).events.find(e=>e.type==='shot');assert.ok(next.sequence>sequence);assert.ok(next.time>shot.time);
  const before=cloneState(s);for(const dt of [0,-1,NaN,Infinity])assert.deepEqual(stepBattle(s,dt),{events:[],finished:null});assert.deepEqual(s,before);
});

test('chain and extra drones retain one primary action and distinguish actual secondary origins',()=>{
  for(const type of ['pulse_array','drone_loom']){
    const s=fixture(),u=place(s,type,10,10,{tier:2,branch:'A',h:1}),[a,b]=battle(s,['static_drifter','static_drifter']);pin(a,13,10.5);pin(b,15,10.5);u.cooldown=0;
    const shots=stepBattle(s,.05).events.filter(e=>e.type==='shot');assert.equal(shots.length,2);const [first,second]=shots;
    assert.equal(first.secondary,undefined);assert.equal(second.secondary,true);assert.equal(second.time,first.time);assert.equal(u.actionTargetId,first.targetId);
    assert.equal(second.sourceId,u.uid);assert.equal(second.kind,'chain');assert.equal(second.actionKind,type==='drone_loom'?'drone':'chain');
    assert.deepEqual(second.from,type==='drone_loom'?point(s,u):first.to);assert.ok(second.damage>0);
  }
});

test('repair identifies the actual recipient and clamped healing; full-health and disabled support cannot pulse',()=>{
  const s=fixture(),u=place(s,'memory_mechanic',10,10,{tier:2,branch:'B'}),target=place(s,'phase_blade',12,10),[e]=battle(s);pin(e,30,10);pauseUnits(s);target.hp-=1;u.cooldown=0;
  const heal=stepBattle(s,.05).events.find(e=>e.type==='heal');assert.equal(heal.targetId,target.uid);assert.equal(heal.targetKind,'unit');assert.deepEqual(heal.to,point(s,target));assert.equal(heal.healed,1);assert.ok(heal.amount>heal.healed);assert.equal(u.actionKind,'repair');assert.equal(heal.armorUntil,s.battle.time+3);
  u.cooldown=0;assert.ok(!stepBattle(s,.05).events.some(e=>e.sourceId===u.uid));
  s.bandwidth=0;target.hp-=10;u.cooldown=0;assert.ok(!stepBattle(s,.05).events.some(e=>e.sourceId===u.uid));
});

test('support feedback follows existing cooldowns, range, global scope and disabled state',()=>{
  const s=fixture();s.bandwidth=100;const choir=place(s,'frequency_choir',10,10),near=place(s,'phase_blade',12,10),far=place(s,'phase_blade',25,10),relay=place(s,'bandwidth_relay',20,10),[e]=battle(s);pin(e,35,10);pauseUnits(s);choir.cooldown=relay.cooldown=0;
  const events=stepBattle(s,.05).events.filter(e=>e.type==='support'),a=events.find(e=>e.sourceId===choir.uid),b=events.find(e=>e.sourceId===relay.uid);
  assert.deepEqual(a.targets,[near.uid]);assert.ok(!a.targets.includes(far.uid));assert.equal(a.global,false);assert.equal(a.action,'buff');assert.equal(choir.actionKind,'buff');
  assert.equal(b.global,true);assert.equal(b.targetId,'core');assert.equal(b.radius,null);assert.equal(b.value,unitStats(s,relay).support_value);
  assert.equal(stepBattle(s,.05).events.filter(e=>e.type==='support').length,0);
  s.bandwidth=0;e.jamUntil=100;e.jamStrength=100;choir.cooldown=relay.cooldown=0;assert.equal(stepBattle(s,.05).events.filter(e=>e.type==='support').length,0);
});

test('movement reports actual cumulative travel and facing while roots and invalid steps hold the gait clock',()=>{
  const s=fixture(),[e]=battle(s);Object.assign(e,{x:20,z:4,speed:2,cooldown:1e5,abilityClock:1e5,pathRevision:-1});const initial=e.motion.distance;
  stepBattle(s,.05);close(e.motion.dz,.1);close(e.motion.dx,0);close(e.motion.distance,initial+.1);close(e.facing,0);
  stepBattle(s,.05);close(e.motion.distance,initial+.2);const before=cloneState(e.motion);stepBattle(s,0);assert.deepEqual(e.motion,before);
  e.root=1;stepBattle(s,.05);close(e.motion.distance,initial+.2);assert.equal(e.motion.dx,0);assert.equal(e.motion.dz,0);
});

test('teleport has distinct origin/destination and never turns instantaneous relocation into walking distance',()=>{
  const s=fixture(),[e]=battle(s,['phase_teleporter']);pin(e,20,5);e.abilityClock=0;const walked=e.motion.distance;
  const event=stepBattle(s,.05).events.find(e=>e.ability==='teleport'&&e.stage==='release');assert.deepEqual(event.from,{x:20,z:5,h:0});assert.deepEqual(event.to,{x:20,z:9,h:0});assert.equal(e.motion.distance,walked);
});

test('ordinary melee and ranged attacks orient toward the authoritative target during cooldown too',()=>{
  for(const type of ['static_drifter','remote_hunter']){
    const s=fixture(),u=place(s,'anchor_bulwark',10,10),[e]=battle(s,[type]);pin(e,11,11);e.cooldown=0;pauseUnits(s);
    const hit=stepBattle(s,.05).events.find(e=>e.type==='hit');assert.equal(hit.sourceId,e.id);assert.equal(hit.targetId,u.uid);assert.deepEqual(hit.to,point(s,u));assert.equal(hit.actionKind,type==='remote_hunter'?'ranged':'melee');assert.equal(e.actionTargetId,u.uid);
    const last=e.lastActionAt;stepBattle(s,.05);assert.equal(e.lastActionAt,last);assert.equal(e.actionTargetId,u.uid);
  }
});

test('terrain attacks retain the attacker and exact struck elevation after the cell changes',()=>{
  const s=fixture();for(let x=0;x<41;x++)cellAt(s,x,7).h=2;s.terrain.revision++;
  const [e]=battle(s,['siege_ram']);pin(e,20,6);Object.assign(e,{attack:1000,cooldown:0,speed:2,pathRevision:-1});
  const out=stepBattle(s,.05),hit=out.events.find(e=>e.actionKind==='terrain'),broken=out.events.find(e=>e.type==='terrain');
  assert.ok(hit&&broken);assert.equal(hit.sourceId,e.id);assert.equal(hit.targetKind,'terrain');assert.deepEqual(hit.to,{x:20,z:7,h:2});
  assert.equal(broken.sourceId,e.id);assert.equal(broken.targetId,'20,7');assert.deepEqual(broken.to,{x:20,z:7,h:1});assert.equal(hit.to.h,2);
});

test('retaliation reports reflect and counter impacts without duplicating the original hit sound',()=>{
  const s=fixture();s.relics=['return_current'];const u=place(s,'anchor_bulwark',10,10,{tier:2,branch:'A'}),[e]=battle(s);pin(e,11,11);e.cooldown=0;pauseUnits(s);
  const out=stepBattle(s,.05),hit=out.events.find(e=>e.type==='hit');assert.equal(out.events.length,1);assert.deepEqual(hit.retaliation.map(e=>e.kind),['reflect','counter']);
  assert.ok(hit.retaliation.every(r=>r.sourceId===u.uid&&r.targetId===e.id&&r.damage>0));assert.equal(u.lastActionAt,s.battle.time);assert.equal(u.actionKind,'melee');assert.equal(e.lastHitAt,s.battle.time);
});

test('ability windup uses remaining simulation delay, with separate release facts and unchanged legacy warning fields',()=>{
  const s=fixture(),[e]=battle(s,['memory_medic']);pin(e);e.hp-=100;e.abilityClock=.5;
  const warning=stepBattle(s,.05).events.find(e=>e.stage==='windup');close(warning.duration,.45);close(warning.endsAt,e.castUntil);close(e.warningUntil-s.battle.time,1.1);assert.equal(e.actionKind,'ability-windup');
  let release;for(let i=0;i<11&&!release;i++)release=stepBattle(s,.05).events.find(e=>e.stage==='release');
  assert.ok(release);assert.equal(release.actionKind,'ability-release');assert.ok(release.time+1e-9>=warning.endsAt);assert.ok(release.time-warning.endsAt<=.05+1e-9);assert.equal(e.castUntil,0);assert.equal(e.actionKind,'ability-release');assert.equal(release.impacts[0].targetId,e.id);assert.ok(release.impacts[0].amount>0);
});

test('surge preserves locked targets and full windup, then supplies one release action plus secondary impacts',()=>{
  const s=fixture();s.pressureLevel=10;s.bandwidth=100;const a=place(s,'bandwidth_relay',12,10),b=place(s,'anchor_bulwark',14,10),[e]=battle(s,['noise_hive']);pin(e,10,10);pauseUnits(s);e.surgeClock=.01;
  const warning=stepBattle(s,.05).events.find(e=>e.kind==='surge');assert.equal(warning.actionKind,'surge-windup');assert.equal(warning.duration,1.5);close(warning.endsAt-warning.time,1.5);assert.equal(e.actionKind,'surge-windup');const ids=[...warning.targets],walked=e.motion.distance;
  let release;for(let i=0;i<31&&!release;i++){const out=stepBattle(s,.05);release=out.events.find(e=>e.kind==='surge-hit');if(release){assert.equal(out.events.filter(e=>e.actionKind==='surge'&&e.secondary).length,2);assert.equal(e.actionKind,'surge-release');}}
  assert.ok(release);assert.deepEqual(release.targets,ids);assert.deepEqual(warning.targets,ids);assert.equal(e.surgeTargets.length,0);assert.equal(e.motion.distance,walked);assert.ok(a.hp<unitStats(s,a).hp&&b.hp<unitStats(s,b).hp);
});

test('deaths retain detached unit and boss model snapshots after removal, including branch and phase',()=>{
  for(const boss of [false,true]){
    const s=fixture(),u=place(s,'phase_blade',10,10,{tier:2,branch:'B'}),[e]=battle(s,[boss?'noise_hive':'static_drifter']);pin(e,11,11);
    if(boss){e.hp=1;e.phase=2;u.cooldown=0;}else{u.hp=1;u.cooldown=1e5;e.attack=1e6;e.cooldown=0;}
    const event=stepBattle(s,.05).events.find(e=>e.action==='death');assert.ok(event);assert.equal(event.entity.type,boss?e.type:u.type);assert.equal(event.entity.id,boss?e.id:u.uid);assert.equal(event.entity.phase,boss?2:0);assert.equal(event.entity.branch,boss?null:'B');assert.equal(event.entity.tier,boss?null:2);
    const x=event.entity.x;if(boss)e.x=0;else u.x=0;assert.equal(event.entity.x,x);
  }
});

test('breach is identified separately from death and ordinary enemies explicitly depart without a false death action',()=>{
  const s=fixture(),[e]=battle(s);Object.assign(e,coreOf(s),{cooldown:0,abilityClock:1e5});const out=stepBattle(s,.05),hit=out.events.find(e=>e.action==='breach');
  assert.equal(hit.targetId,'core');assert.equal(hit.targetKind,'core');assert.equal(hit.despawn,true);assert.equal(hit.actionKind,'breach');assert.ok(!out.events.some(e=>e.action==='death'));assert.ok(!s.battle.enemies.some(t=>t.id===e.id));
});

test('restart removes stale action state; cancelled and completed battles cannot release queued presentation events',()=>{
  const s=fixture(),u=place(s,'frequency_choir',10,10);Object.assign(u,{lastActionAt:200,actionKind:'buff',actionTargetId:'e99',facing:2});startBattle(s);assert.equal(u.lastActionAt,null);assert.equal(u.actionKind,null);assert.equal(u.actionTargetId,null);assert.equal(u.facing,0);
  for(const phase of ['prep','map','lost']){s.phase=phase;const before=cloneState(s);assert.deepEqual(stepBattle(s,.05),{events:[],finished:null});assert.deepEqual(s,before);}
  s.phase='battle';s.battle.result='won';assert.deepEqual(stepBattle(s,.05),{events:[],finished:'won'});
});
