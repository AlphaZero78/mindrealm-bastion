import test from 'node:test';
import assert from 'node:assert/strict';
import {CURRENT_DIFFICULTY_REVISION,normalizeDifficulty,difficultyProfile,difficultySummary,enemyStats,enemyAbilityProfile} from '../../game/web/core/difficulty.js';
import {makeEncounter,stepBattle} from '../../game/web/core/battle.js';
import {newRun,cloneState} from '../../game/web/core/state.js';
import {enemies} from '../../game/web/core/content.js';
import {unitStats,incomingDamage} from '../../game/web/core/rules.js';
import {fixture,place,battle,tick} from './helpers/battle-fixture.mjs';

const close=(actual,expected,message='')=>assert.ok(Math.abs(actual-expected)<1e-7,`${message}: ${actual} != ${expected}`);
const revised=(level=0)=>Object.assign(fixture('difficulty-combat'),{pressureLevel:level,difficultyRevision:2});
const pin=(e,x=10,z=10)=>Object.assign(e,{x,z,h:0,speed:0,cooldown:1e6,abilityClock:1e6,surgeClock:1e6});
const surgeFixture=(level=8)=>{
  const s=revised(level);s.bandwidth=100;
  const first=place(s,'bandwidth_relay',12,10),second=place(s,'bandwidth_relay',14,10),taunt=place(s,'anchor_bulwark',16,10);
  const [e]=battle(s,['noise_hive']);pin(e);for(const u of s.units)u.cooldown=1e6;
  e.surgeClock=.01;return {s,e,first,second,taunt};
};

test('difficulty normalization uses pressureLevel only and revision selection cannot reinterpret an old save',()=>{
  assert.equal(CURRENT_DIFFICULTY_REVISION,5);
  for(const v of [null,undefined,NaN,Infinity,-Infinity,'10',{},[],{pressureLevel:NaN}])assert.equal(normalizeDifficulty(v),0);
  assert.equal(normalizeDifficulty(-1),0);assert.equal(normalizeDifficulty(10.9),10);assert.equal(normalizeDifficulty(4.9),4);
  assert.equal(normalizeDifficulty({pressureLevel:0,difficulty:10}),0);
  assert.equal(difficultyProfile(10).revision,CURRENT_DIFFICULTY_REVISION);
  for(const revision of [undefined,1])assert.equal(difficultyProfile({pressureLevel:10,difficultyRevision:revision}).revision,1);
  assert.equal(difficultyProfile({pressureLevel:10,difficultyRevision:2}).revision,2);
});

test('new profiles strengthen individuals monotonically without economy or population penalties',()=>{
  let previous=difficultyProfile(0);
  for(let level=0;level<=10;level++){
    const p=difficultyProfile(level);
    for(const key of ['hpMultiplier','attackMultiplier','speedMultiplier','breachMultiplier','pressureMultiplier','armorBonus'])assert.ok(p[key]>=previous[key],`${level} ${key}`);
    assert.equal(p.serviceMultiplier,1);assert.equal(p.campHeal,.3);assert.equal(p.earlyEnemyAct,0);assert.equal(p.functionalDensity,.4);assert.equal(p.jamBonus,0);
    close(p.attackMultiplier,1+.09*level);close(p.speedMultiplier,1+.016*level);close(p.breachMultiplier,1+.065*level);close(p.pressureMultiplier,1+.06*level);
    assert.equal(p.armorBonus,Math.floor(level/3));close(p.abilityIntervalMultiplier,1-.02*level);close(p.controlDurationMultiplier,1-Math.max(0,level-5)*.05);
    assert.equal(p.surge.enabled,level>=8);assert.ok(difficultySummary(level).every(line=>typeof line==='string'&&!/NaN|undefined/.test(line)));
    previous=p;
  }
  assert.equal(difficultyProfile(0).hpMultiplier,1);assert.equal(difficultyProfile(10).hpMultiplier,3.2);
});

test('all difficulties share exact seeded formations, arrivals, entrances, reinforcements and XP/focus budgets',()=>{
  for(let seed=0;seed<6;seed++)for(let act=0;act<3;act++)for(const type of ['battle','elite','boss']){
    const s=newRun(`difficulty-formation-${seed}`);Object.assign(s,{difficultyRevision:2,act,floor:[0,4,10][seed%3],pressureLevel:0,currentNode:{id:`probe-${act}-${type}`,type,boss:s.maps[act].boss}});
    const expected=makeEncounter(s),rewards=expected.queue.reduce((sum,q)=>[sum[0]+enemies[q.type].xp,sum[1]+enemies[q.type].focus],[0,0]);
    for(let level=0;level<=10;level++){
      s.pressureLevel=level;const current=makeEncounter(s);assert.deepEqual(current,expected);
      assert.deepEqual(current.queue.reduce((sum,q)=>[sum[0]+enemies[q.type].xp,sum[1]+enemies[q.type].focus],[0,0]),rewards);
      assert.equal(current.reinforcementBudget,Math.floor(current.total*.1));
    }
    const legacy=cloneState(s);legacy.difficultyRevision=1;legacy.pressureLevel=0;assert.deepEqual(makeEncounter(legacy),expected,'revision 2 uses the original standard formation');
  }
});

test('spawned enemy attributes and rewards match the same public preview for every species and difficulty',()=>{
  for(let level=0;level<=10;level++){
    const s=revised(level);s.act=2;s.floor=14;s.modifiers.pressure_mult=.1;
    const actual=battle(s,Object.keys(enemies));assert.equal(actual.length,Object.keys(enemies).length);
    for(const e of actual){const expected=enemyStats(s,enemies[e.type]);for(const key of ['maxHp','attack','speed','armor','core_damage','pressure','xp','focus'])close(e[key],expected[key],`${level} ${e.type} ${key}`);}
  }
});

test('legacy revisions retain their exact spawn, prices, camps, pool, control and boss interval formulas',()=>{
  for(let level=0;level<=10;level++)for(const revision of [undefined,1]){
    const s=revised(level);s.difficultyRevision=revision;s.act=1;s.floor=15;
    const p=difficultyProfile(s),spec=enemies.static_drifter,v=enemyStats(s,spec),scale=1+.08+15*.015;
    close(v.maxHp,spec.hp*scale*(level>=1?1.1:1)*(level>=10?1.1:1));
    close(v.attack,spec.attack*(level>=2?1.1:1)*(level>=10?1.1:1));close(v.pressure,spec.pressure*(level>=6?1.15:1)*(level>=10?1.1:1));
    close(v.speed,spec.speed*1.5);assert.equal(v.armor,spec.armor);assert.equal(v.core_damage,spec.core_damage);
    assert.equal(p.campHeal,level>=5?.2:.3);assert.equal(p.serviceMultiplier,level>=7?1.15:1);assert.equal(p.earlyEnemyAct,level>=3?1:0);assert.equal(p.functionalDensity,level>=4?.5:.25);assert.equal(p.controlDurationMultiplier,1);assert.equal(p.surge.enabled,false);
    const info=enemyAbilityProfile(s,enemies.bandwidth_requisitioner,2);close(info.cycle,4.9*(level>=9?.8:1));assert.equal(info.jamDuration,5);assert.equal(p.jamBonus,level>=8?2:0);
  }
});

test('actual ordinary ability cadence scales smoothly while boss preview includes real recovery windows',()=>{
  for(const level of [0,5,10]){
    const s=revised(level),[e]=battle(s,['spike_runner']);pin(e);e.abilityClock=0;stepBattle(s,.05);close(e.abilityClock,enemyAbilityProfile(s,enemies.spike_runner).cycle);assert.ok(e.sprintUntil>s.battle.time);
    for(let phase=0;phase<3;phase++){const info=enemyAbilityProfile(s,enemies.bandwidth_requisitioner,phase);assert.ok(info.cycle-info.jamDuration>=1.1-1e-9);}
  }
});

test('boss self healing and shielding grow by square root and ordinary support cannot bypass that limit',()=>{
  for(const level of [0,5,10])for(const type of ['memory_reforger','chorus_overseer','mirror_censor']){
    const s=revised(level),[e]=battle(s,[type]);pin(e);e.hp=e.maxHp*.34;e.abilityClock=0;
    const info=enemyAbilityProfile(s,e,2),before=e.hp;stepBattle(s,.05);
    if(type==='memory_reforger')close(e.hp-before,info.healAmount);else close(e.shield,info.shieldAmount);
    const expected=enemyStats(s,enemies[type]).baseHp*Math.sqrt(difficultyProfile(s).hpMultiplier);close(enemyStats(s,enemies[type]).supportHp,expected);
  }
  for(const type of ['memory_medic','shield_conductor']){
    const s=revised(10),[helper,boss]=battle(s,[type,'noise_hive']);pin(helper);pin(boss,11,10);boss.hp*=.3;helper.abilityClock=0;
    const before=boss.hp,base=boss.maxHp/Math.sqrt(difficultyProfile(s).hpMultiplier);stepBattle(s,.05);
    if(type==='memory_medic')close(boss.hp-before,base*.09);else close(boss.shield,base*.12);
  }
});

test('new interference actually expires for at least 1.1 seconds before the next boss pulse',()=>{
  const s=revised(10),[e]=battle(s,['bandwidth_requisitioner']);pin(e);e.hp=e.maxHp*.34;e.abilityClock=0;stepBattle(s,.05);
  const end=e.jamUntil,next=s.battle.time+e.abilityClock;close(next-end,1.1);
  while(s.battle.time<end+.1)stepBattle(s,.05);assert.equal(s.battle.jam,0);assert.ok(e.abilityClock>.9);
});

test('slow and root durations are shortened at high pressure without changing damage or high ground protection',()=>{
  for(const type of ['boundary_riveter','arc_mortar','frequency_choir']){
    const values=[];for(const level of [0,10]){
      const s=revised(level),u=place(s,type,10,10,{tier:2,branch:type==='arc_mortar'?'A':'B',h:type==='arc_mortar'?1:0}),[e]=battle(s);pin(e,12,10);e.hp=e.maxHp=1e6;u.cooldown=0;stepBattle(s,.05);
      values.push((type==='boundary_riveter'?e.root:e.slow)+.05);
    }close(values[1],values[0]*.75,type);
  }
  const s=revised(10),u=place(s,'pulse_array',10,10,{h:4}),enemy={...enemies.remote_hunter,x:15,z:10,pierce:.5};
  assert.ok(incomingDamage(s,u,enemy,100)<incomingDamage(s,u,{...enemy,x:10,z:10},100));
});

test('frequency surge has a full independent windup, fixed origin, two marked targets and taunt priority',()=>{
  const {s,e,first,second,taunt}=surgeFixture();e.speed=1;const origin={x:e.x,z:e.z};const health=s.units.map(u=>u.hp);
  const warning=stepBattle(s,.05).events.find(x=>x.kind==='surge');assert.ok(warning);assert.equal(warning.duration,1.5);assert.equal(warning.radius,8);assert.deepEqual(e.surgeTargets,[taunt.uid,first.uid]);assert.equal(e.warningUntil,0);
  for(let i=0;i<29;i++)stepBattle(s,.05);assert.deepEqual(s.units.map(u=>u.hp),health);close(e.x,origin.x);close(e.z,origin.z);
  const outcome=stepBattle(s,.05);assert.equal(outcome.events.filter(x=>x.type==='hit').length,2);assert.ok(first.hp<health[0]);assert.equal(second.hp,health[1]);assert.ok(taunt.hp<health[2]);
  assert.equal(e.surgeWarningUntil,0);assert.deepEqual(e.surgeTargets,[]);assert.equal(e.surgeOrigin,null);close(e.surgeClock,12);assert.equal(s.battle.reinforcements,0);
});

test('frequency surge honors armor and high ground, ignores unmarked or out-of-radius targets, and has no global damage',()=>{
  const results=[];
  for(const h of [0,4]){
    const s=revised(10),u=place(s,'bandwidth_relay',12,10,{h}),outside=place(s,'bandwidth_relay',19,10),[e]=battle(s,['noise_hive']);pin(e);e.surgeClock=0;const hp=u.hp,spirit=s.spirit;
    stepBattle(s,.05);const expected=incomingDamage(s,u,e,e.attack*.55);tick(s,1.5);close(hp-u.hp,expected);assert.equal(outside.hp,unitStats(s,outside).hp);assert.equal(s.spirit,spirit);results.push(hp-u.hp);
  }
  assert.ok(results[1]<results[0]);
});

test('cancelled battle, invalid steps, killed caster and broken recipients do not produce delayed surge damage',()=>{
  {
    const {s,e}=surgeFixture();stepBattle(s,.05);const snapshot=cloneState(s);for(const dt of [0,-1,NaN,Infinity])stepBattle(s,dt);assert.deepEqual(s,snapshot);
    s.phase='prep';stepBattle(s,.25);assert.equal(e.surgeWarningUntil,snapshot.battle.enemies[0].surgeWarningUntil);assert.deepEqual(s.units,snapshot.units);
  }
  {
    const {s,e,first}=surgeFixture();stepBattle(s,.05);const hp=first.hp;e.dead=true;tick(s,2);assert.equal(first.hp,hp);
  }
  {
    const {s,e,first,taunt,second}=surgeFixture();stepBattle(s,.05);first.hp=0;taunt.hp=0;const hp=second.hp;tick(s,1.5);assert.equal(second.hp,hp);assert.equal(e.surgeWarningUntil,0);
  }
  {
    const {s,first}=surgeFixture();stepBattle(s,.05);s.battle.result='lost';const hp=first.hp;tick(s,2);assert.equal(first.hp,hp);
  }
});

test('reflecting a lethal surge stops further recipients and cannot breach after the killing blow',()=>{
  const s=revised(8);s.bandwidth=100;s.relics=['return_current'];
  const a=place(s,'phase_blade',20,24),b=place(s,'phase_blade',22,24),[e]=battle(s,['noise_hive']);pin(e,20,24);e.surgeClock=0;for(const u of s.units)u.cooldown=1e6;
  stepBattle(s,.05);e.hp=.01;e.cooldown=0;e.xp=0;const spirit=s.spirit,secondHp=b.hp;tick(s,1.5);
  assert.equal(s.battle.result,'won');assert.equal(b.hp,secondHp);assert.equal(s.spirit,spirit);assert.ok(a.hp<unitStats(s,a).hp);
});

test('frequency surge is absent below level eight and in legacy runs; empty radius remains harmless',()=>{
  for(const revision of [1,2])for(const level of [0,7,8,10]){
    const s=revised(level);s.difficultyRevision=revision;const [e]=battle(s,['noise_hive']);pin(e);e.surgeClock=0;
    const out=stepBattle(s,.05);assert.equal(out.events.some(x=>x.kind==='surge'),revision===2&&level>=8);const spirit=s.spirit;tick(s,1.5);assert.equal(s.spirit,spirit);assert.equal(s.battle.reinforcements,0);
  }
});

test('high pressure still enforces a hundred active enemies and the shared ten percent reinforcement limit',()=>{
  const s=revised(10);s.spirit=s.maxSpirit=1e6;battle(s,Array.from({length:120},()=> 'signal_summoner'));assert.equal(s.battle.enemies.length,100);
  for(const e of s.battle.enemies){pin(e);e.abilityClock=0;}stepBattle(s,.05);assert.equal(s.battle.reinforcements,0);
  for(let i=0;i<8;i++){
    for(const e of s.battle.enemies.slice(0,20))e.dead=true;stepBattle(s,.05);
    for(const e of s.battle.enemies){pin(e);e.abilityClock=0;}stepBattle(s,.05);
    assert.ok(s.battle.enemies.length<=100);
  }
  assert.equal(s.battle.reinforcementBudget,12);assert.equal(s.battle.reinforcements,12);assert.equal(s.battle.maxActive,100);
});
