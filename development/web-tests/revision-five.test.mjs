import test from 'node:test';
import assert from 'node:assert/strict';
import * as Run from '../../game/web/core/state.js';
import * as R from '../../game/web/core/rules.js';
import {events,eventFor,towers,legacyEvents} from '../../game/web/core/content.js';
import {eventClues} from '../../game/web/core/event-redesign.js';
import {eventStories} from '../../game/web/core/event-stories.js';
import {tierThree} from '../../game/web/core/tower-progression.js';
import {unitEffectLines} from '../../game/web/core/unit-details.js';
import {killRewardScale,combatFocusReward} from '../../game/web/core/difficulty.js';
import {addItem} from '../../game/web/core/inventory.js';
import {createSaveStore} from '../../game/web/core/save.js';
import {stepBattle} from '../../game/web/core/battle.js';
import {fixture,place,battle,tick} from './helpers/battle-fixture.mjs';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const store=()=>{const data=new Map();return createSaveStore({getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},'r5.isolated');};
const inert=(s,fn)=>{const before=Run.cloneState(s);assert.equal(fn().ok,false);assert.deepEqual(s,before);};
const pin=(enemy,x,z,extra={})=>Object.assign(enemy,{x,z,h:0,speed:0,attack:0,cooldown:1e6,abilityClock:1e6,hp:10000,maxHp:10000,shield:0,...extra});
const current=seed=>{const s=fixture(seed,{revision:5});s.depth=6;s.bandwidth=100;s.focus=1000;return s;};
function eventState(id,{prepared=true,revision=5}={}){
 const s=Run.newRun(`r5:${id}`);s.difficultyRevision=revision;s.nexus.forEach(n=>n.skipped=true);s.phase='map';s.act=events[id].act-1;
 if(prepared){s.depth=6;s.focus=1000;s.resistance=20;s.spirit=70;s.bandwidth=30;s.eventClues=Object.keys(eventClues);Run.addUnit(s,'memory_mechanic');Run.addUnit(s,'frequency_choir');for(const [i,u]of s.units.entries()){if(i<3){u.tier=2;u.branch='A';}u.hp=R.unitStats(s,u).maxHp*.6;}addItem(s,'clarity');addItem(s,'stasis');}
 const node=s.maps[s.act].nodes.find(n=>n.floor===1);Object.assign(node,{type:'event',event:id});s.nextNodes=[node.id];assert.equal(Run.enterNode(s,node.id).ok,true);return s;
}

test('revision five economy prices every edit cumulatively and keeps earlier rules intact',()=>{
 const s=current('economy'),u=Run.addUnit(s,'pulse_array'),old={...s,difficultyRevision:4};
 assert.equal(R.upgradeCost(s,u),Math.ceil(90*towers[u.type].upkeep/45));assert.ok(R.upgradeCost(s,u)>R.upgradeCost(old,u));
 u.tier=2;u.branch='A';assert.equal(R.upgradeCost(s,u),Math.ceil(190*towers[u.type].upkeep/45));assert.ok(R.upgradeCost(s,u)>R.upgradeCost(old,u));
 assert.deepEqual([R.terrainCost(s,8),R.terrainCost(s,9),R.terrainCost(s,17)],[40,46,95]);assert.equal(R.terrainCost(old,21),43);
 const command={tool:'raise',brush:'box',x:4,z:4,x2:12,z2:4},before=Run.cloneState(s),preview=R.previewTerrain(s,command);assert.equal(preview.cost,46);assert.deepEqual(s,before);
 assert.equal(R.applyTerrainBatch(s,[command]).ok,true);assert.equal(s.focus,before.focus-46);assert.equal(R.terrainCost(s,1),6);assert.equal(R.undoTerrain(s).ok,true);assert.equal(s.focus,before.focus);assert.deepEqual(s.terrain.cells,before.terrain.cells);
 s.focus=45;inert(s,()=>R.applyTerrainBatch(s,[command]));
 for(let act=0;act<3;act++)for(const type of ['battle','elite','boss']){s.act=act;assert.ok(combatFocusReward(s,type)<combatFocusReward({...s,difficultyRevision:4},type));}
 assert.deepEqual(killRewardScale(s),{xp:.65,focus:.4});
});

test('fractional kill focus accumulates across a battle and does not round each small enemy upward',()=>{
 const s=current('kill-focus'),u=place(s,'pulse_array',10,10,{h:1}),enemies=battle(s,Array(4).fill('static_drifter'));
 for(const [i,e]of enemies.entries())pin(e,12,10+i*.2,{hp:1,focus:3,xp:0,pressure:0});const focus=s.focus;u.cooldown=0;tick(s,4);
 assert.equal(s.stats.kills,4);assert.equal(s.focus-focus,4);near(s.battle.focusCarry,.8);
});

test('paid growth and fusion reject over-budget bandwidth atomically; free growth returns to storage',()=>{
 const s=current('upgrade-bandwidth'),u=place(s,'pulse_array',10,10,{h:1});s.bandwidth=R.unitStats(s,u).bandwidth;const before=Run.cloneState(s);
 assert.equal(R.growthPreview(s,u,'A').ok,false);inert(s,()=>R.upgrade(s,u.uid,'A'));assert.deepEqual(s,before);
 const preview=R.growthPreview(s,u,'A',{free:true});assert.equal(preview.returnToStorage,true);assert.equal(R.upgrade(s,u.uid,'A',{free:true}).ok,true);assert.equal(u.x,null);assert.equal(u.tier,2);assert.equal(s.focus,before.focus);assert.equal(R.unitStats(s,u).bandwidth,s.bandwidth+1);
 const f=current('fusion-bandwidth'),core=place(f,'phase_blade',10,10);Run.addUnit(f,core.type);Run.addUnit(f,core.type);f.bandwidth=R.unitStats(f,core).bandwidth;inert(f,()=>R.fuse(f,core.uid,'A'));f.bandwidth++;assert.equal(R.fuse(f,core.uid,'A').ok,true);assert.equal(f.units.length,1);assert.equal(R.bandwidthState(f).used,f.bandwidth);
});

test('a single relay may be deployed at any tier, including when the existing relay needs repair',()=>{
 for(const tier of [1,2,3]){const s=current(`relay-${tier}`),a=place(s,'bandwidth_relay',4,4,{tier,branch:tier>1?'A':null}),b=Run.addUnit(s,a.type);const p=R.placement(s,b,10,4);assert.equal(p.ok,false);assert.match(p.reason,/最多部署 1/);inert(s,()=>R.deploy(s,b.uid,10,4));a.hp=0;assert.equal(R.placement(s,b,10,4).ok,false);assert.equal(R.repair(s,a.uid).ok,true);assert.equal(a.x,null);assert.equal(R.deploy(s,b.uid,10,4).ok,true);}
});

test('every T3 branch keeps T2 and adds a real mechanic with smaller base growth and higher bandwidth',()=>{
 const s=current('all-t3');
 for(const type of Object.keys(towers))for(const branch of ['A','B']){const u={type,tier:2,branch,x:null,z:null,hp:1},t2=R.unitStats(s,u),t3=R.unitStats(s,{...u,tier:3}),extra=tierThree[type][branch];assert.equal(t3.bandwidth,t2.bandwidth+1);assert.ok(t3.effects.includes(t2.effect));assert.ok(t3.effects.includes(extra.effect));assert.notEqual(extra.effect,t2.effect);if(t2.attack)near(t3.attack/t2.attack,1.8/1.35);else assert.equal(t3.attack,0);const text=unitEffectLines(s,{...u,tier:3});assert.ok(text.some(line=>line.id!=='evolution'&&(!unitEffectLines(s,u).some(old=>old.text===line.text))),`${type}/${branch} has an actionable new description`);}
});

test('T3 hit effects reach direct, splash, chain, piercing and tracking-drone targets',()=>{
 for(const [type,branch,effect]of [['anchor_bulwark','A','root'],['phase_blade','B','armorBreak'],['boundary_riveter','B','armorBreak'],['pulse_array','A','marked'],['focus_rail','A','armorBreak'],['focus_rail','B','marked'],['arc_mortar','A','marked'],['drone_loom','A','armorBreak']]){
  const s=current(`${type}-${branch}`),u=place(s,type,10,10,{tier:3,branch,h:towers[type].role==='ranged'?1:0}),targets=battle(s,['static_drifter','static_drifter']);targets.forEach((e,i)=>pin(e,12+i*.2,11,{armor:20}));u.cooldown=0;
  if(type==='drone_loom')tick(s,.7);else stepBattle(s,.05);
  assert.ok(targets.some(e=>e[effect]>0),`${type}/${branch} applies ${effect}`);
  if(['phase_blade','pulse_array','arc_mortar','drone_loom'].includes(type)||type==='focus_rail'&&branch==='A')assert.ok(targets.every(e=>e.hp<e.maxHp),`${type}/${branch} reaches additional target`);
 }
 const s=current('damage-specials');for(const [type,branch,air,low,multiplier]of [['phase_blade','A',false,true,1.65],['drone_loom','B',true,false,1.8]]){const u=place(s,type,10,10,{tier:3,branch,h:air?1:0}),target={x:12,z:11,h:0,hp:low?20:100,maxHp:100,air,armor:0},plain={...target,air:false,hp:100};near(R.solveAttack(s,u,target).damage/R.solveAttack(s,u,plain).damage,multiplier);u.x=null;}
});

test('T3 regeneration, armor, slow, self-repair and repair secondary effects operate in battle',()=>{
 const s=current('t3-auras'),guard=place(s,'resonance_guard',10,10,{tier:3,branch:'A'}),relay=place(s,'bandwidth_relay',10,13,{tier:3,branch:'A'}),choir=place(s,'frequency_choir',13,10,{tier:3,branch:'A'}),ally=place(s,'anchor_bulwark',13,13),slow=place(s,'resonance_guard',17,10,{tier:3,branch:'B'}),[enemy]=battle(s);pin(enemy,18,11);for(const u of s.units)u.cooldown=10000;ally.hp-=100;const hp=ally.hp;stepBattle(s,.05);near(ally.hp-hp,R.unitStats(s,ally).maxHp*.01*.05);assert.equal(ally.temporaryArmor,3);assert.ok(enemy.slow>0);
 guard.hp=0;relay.hp=0;choir.hp=0;const frozen=ally.hp;stepBattle(s,.05);assert.equal(ally.hp,frozen);assert.equal(ally.temporaryArmor,0);
 const d=current('disabled-armor'),source=place(d,'frequency_choir',10,10,{tier:3,branch:'A'}),stopped=place(d,'anchor_bulwark',13,10),[far]=battle(d);pin(far,0,0);stepBattle(d,.05);assert.equal(stopped.temporaryArmor,3);d.bandwidth=R.unitStats(d,source).bandwidth;stepBattle(d,.05);assert.ok(d.battle.disabled.includes(stopped.uid));assert.equal(stopped.temporaryArmor,0);stopped.armorBuffUntil=d.battle.time+.1;stepBattle(d,.05);assert.equal(stopped.temporaryArmor,3);stepBattle(d,.1);assert.equal(stopped.temporaryArmor,0);
 const r=current('t3-self'),wall=place(r,'anchor_bulwark',10,10,{tier:3,branch:'B'}),[e]=battle(r);pin(e,0,0);wall.hp-=100;wall.lastHitAt=-10;const prior=wall.hp;stepBattle(r,.05);near(wall.hp-prior,R.unitStats(r,wall).maxHp*.025*.05);
 for(const branch of ['A','B']){const x=current(`repair-${branch}`),medic=place(x,'memory_mechanic',10,10,{tier:3,branch}),a=place(x,'anchor_bulwark',13,10),b=place(x,'phase_blade',10,13),[enemy]=battle(x);pin(enemy,0,0);a.hp=10;b.hp=10;medic.cooldown=0;const result=stepBattle(x,.05),heals=result.events.filter(e=>e.type==='heal'&&e.unit===medic.uid);assert.equal(heals.length,branch==='A'?1:2);if(branch==='A')assert.ok(a.repairShieldUntil>x.battle.time);else{near(heals[1].amount/heals[0].amount,.6);assert.ok(b.armorBuffUntil>x.battle.time);}}
});

test('duplicate support auras use their strongest value and damage still stops when a source is disabled',()=>{
 const attack=count=>{const s=current(`choirs-${count}`),u=place(s,'pulse_array',10,10,{h:1});for(let i=0;i<count;i++)place(s,'frequency_choir',8,12+i*2,{tier:i===0?2:1,branch:i===0?'A':null});const [e]=battle(s);pin(e,13,11);u.cooldown=1;stepBattle(s,.05);const cooldown=u.cooldown;u.cooldown=0;const before=e.hp;stepBattle(s,.05);return {cooldown,damage:before-e.hp};};
 assert.deepEqual(attack(1),attack(2));
 const pressure=count=>{const s=current(`filters-${count}`),u=place(s,'pulse_array',10,10,{h:1});for(let i=0;i<count;i++)place(s,'resistance_beacon',12,12+i*2,{tier:3,branch:'B'});const [e]=battle(s);pin(e,13,11,{hp:1,pressure:100});u.cooldown=0;stepBattle(s,.05);return s.stats.pressureLog[0];};
 const one=pressure(1),two=pressure(2);near(one.modified,70);near(one.resistance,two.resistance);near(one.modified,two.modified);near(one.damage,two.damage);
 const j=current('jam-immunity'),relay=place(j,'bandwidth_relay',4,4,{tier:3,branch:'B'});battle(j);j.battle.jam=12;assert.equal(R.bandwidthState(j).cap,j.bandwidth+Math.round(R.unitStats(j,relay).support_value));relay.hp=0;assert.equal(R.bandwidthState(j).cap,j.bandwidth-12);
});

test('six shop constructs, two eligible T2 offers and all purchased flags survive saving',()=>{
 for(const revision of [4,5]){const s=Run.newRun(`shop-${revision}`);s.difficultyRevision=revision;s.phase='map';s.nexus.forEach(n=>n.skipped=true);s.depth=5;s.focus=2000;const node=s.maps[0].nodes.find(n=>n.floor===1);node.type='shop';s.nextNodes=[node.id];Run.enterNode(s,node.id);assert.equal(node.stock.units.length,revision===5?6:3);assert.equal(node.stock.units.filter(u=>u.tier===2).length,revision===5?2:1);const offer=node.stock.units.at(-1),saved=store();assert.equal(Run.nodeAction(s,'buy-unit',{id:offer.key}).ok,true);assert.equal(saved.save(s).ok,true);assert.deepEqual(saved.load().state.currentNode.stock,node.stock);inert(s,()=>Run.nodeAction(s,'buy-unit',{id:offer.key}));}
});

test('108 authored choices persist exact resolved results, preserve cancellation and prevent rerolls',()=>{
 let count=0,healing=0;
 for(const event of Object.values(events)){
  assert.equal(event.choices.length,3);assert.equal(eventStories[event.id].choices.length,3);assert.ok(eventStories[event.id].intro.length>=60);assert.equal(new Set(event.choices.map(c=>c.label)).size,3);
  for(let index=0;index<3;index++){
   const s=eventState(event.id),original=Run.cloneState(s),preview=Run.eventPreview(s,index),resolved=Run.eventPreview(s,index,{}, {resolveRisk:true});assert.equal(preview.canChoose,true,`${event.id}/${index}: ${preview.details.join(';')}`);assert.equal(Run.nodeAction(s,'cancel').ok,true);assert.deepEqual(s,original);inert(s,()=>Run.nodeAction(s,'event-continue'));
   const copy=Run.cloneState(s);assert.equal(Run.nodeAction(s,'event',{index}).ok,true);assert.equal(Run.nodeAction(copy,'event',{index}).ok,true);assert.deepEqual(copy,s);assert.deepEqual(s.currentNode.eventData.outcome.details,resolved.details);assert.ok(s.currentNode.eventData.outcome.text.length>=20);inert(s,()=>Run.nodeAction(s,'event',{index}));
   const saved=store();assert.equal(saved.save(s).ok,true,`${event.id}/${index}`);const loaded=saved.load();assert.equal(loaded.ok,true);assert.deepEqual(loaded.state.currentNode.eventData,s.currentNode.eventData);assert.equal(Run.nodeAction(s,'event-continue').ok,true);assert.equal(Run.nodeAction(loaded.state,'event-continue').ok,true);assert.deepEqual(loaded.state,s);assert.ok(['map','reward','prep'].includes(s.phase));if(s.phase==='prep')assert.equal(s.currentNode.type,'elite');else assert.equal(s.stats.completedNodes,1);count++;if(event.choices[index].effects.spirit>0)healing++;
  }
 }
 assert.equal(count,108);assert.equal(healing,3);
});

test('event requirements, clues, actual healing, capacity-only growth and lethal costs stay explicit',()=>{
 const locked=eventState('closed_shop',{prepared:false});inert(locked,()=>Run.nodeAction(locked,'event',{index:0}));assert.match(Run.eventPreview(locked,0).details.join(' '),/通行码/);locked.eventClues=['relay_key'];assert.equal(Run.nodeAction(locked,'event',{index:0}).ok,true);assert.deepEqual(locked.eventClues,[]);
 const requirement=eventState('false_memory',{prepared:false});requirement.resistance=0;inert(requirement,()=>Run.nodeAction(requirement,'event',{index:1}));
 const heal=eventState('quiet_room');heal.spirit=99;assert.match(Run.eventPreview(heal,0).details.join(' '),/精神 \+1(?:\s|$)/);Run.nodeAction(heal,'event',{index:0});assert.equal(heal.spirit,100);
 const cap=eventState('cooling_well'),hp=cap.spirit;Run.nodeAction(cap,'event',{index:1});assert.equal(cap.maxSpirit,108);assert.equal(cap.spirit,hp);
 const lethal=eventState('noise_market');lethal.spirit=1;assert.match(Run.eventPreview(lethal,0).details.join(' '),/将导致本局失败/);Run.nodeAction(lethal,'event',{index:0});assert.equal(lethal.phase,'lost');assert.equal(lethal.summary.eventDamage,1);
 for(const roll of [0,.99]){const risk=eventState('noise_market');risk.currentNode.eventData.rolls[0]=roll;const before=risk.focus;Run.nodeAction(risk,'event',{index:0});assert.equal(risk.focus-before,roll===0?80:20);}
});

test('old event catalogs keep their original choices and corrupt event metadata cannot replace a save',()=>{
 const old=eventState('noise_market',{revision:4});assert.equal(eventFor(old,'noise_market'),legacyEvents.noise_market);const focus=old.focus;Run.nodeAction(old,'event',{index:0});assert.equal(old.focus-focus,95);
 const s=eventState('quiet_room'),saved=store();assert.equal(saved.save(s).ok,true);for(const mutate of [n=>n.eventData.id='missing',n=>n.eventData.rolls=[-1],n=>n.eventData.unitsByRole.ranged='anchor_bulwark']){const invalid=Run.cloneState(s);mutate(invalid.currentNode);assert.equal(saved.save(invalid).ok,false);assert.equal(saved.load().ok,true);}
});
