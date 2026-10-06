import test from 'node:test';
import assert from 'node:assert/strict';
import * as Run from '../../game/web/core/state.js';
import * as Rules from '../../game/web/core/rules.js';
import {messengers,nexusRelics,relics,towers,contentPool,effects} from '../../game/web/core/content.js';
import {startBattle,stepBattle,useItem} from '../../game/web/core/battle.js';
import {addItem} from '../../game/web/core/inventory.js';
import {createSaveStore} from '../../game/web/core/save.js';
import {fixture,place,battle} from './helpers/battle-fixture.mjs';
import {mapScreen,nexusScreen} from '../../game/web/screens.js';
import {normalizeScene} from '../../game/web/view/audio.js';

const store=()=>{const data=new Map();return createSaveStore({getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},'nexus.isolated');};
const same=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const frozen=(state,fn)=>{const old=Run.cloneState(state);assert.equal(fn().ok,false);assert.deepEqual(state,old);};
const enterGift=(state,id)=>{
 const m=messengers[nexusRelics[id].messenger];state.act=m.act;state.floor=-1;state.currentNode=null;state.phase='nexus';
 state.nextNodes=state.maps[m.act].nodes.filter(n=>n.floor===0).map(n=>n.id);
 state.nexus[m.act]={act:m.act,messenger:m.id,options:[id,...m.gifts.filter(g=>g.id!==id).slice(0,2).map(g=>g.id)],choice:null,skipped:false};
 return Run.chooseNexus(state,id);
};

test('new run begins with three empty item slots and a seed-fixed act-specific messenger before any route',()=>{
 const seen=[new Set(),new Set(),new Set()];
 for(let i=0;i<160;i++){
  const s=Run.newRun(`nexus-seed-${i}`),again=Run.newRun(`nexus-seed-${i}`);assert.deepEqual(s.nexus,again.nexus);
  assert.equal(s.phase,'nexus');assert.equal(s.inventory.itemCapacity,3);assert.deepEqual(s.inventory.items,[]);assert.deepEqual(Run.availableNodes(s),[]);
  frozen(s,()=>Run.enterNode(s,s.nextNodes[0]));frozen(s,()=>Run.chooseNexus(s,'nexus-invalid'));
  for(const room of s.nexus){seen[room.act].add(room.messenger);assert.equal(messengers[room.messenger].act,room.act);assert.equal(new Set(room.options).size,3);}
 }
 assert.deepEqual(seen.map(x=>x.size),[4,4,4]);assert.equal(Object.keys(nexusRelics).length,72);
 assert.equal(normalizeScene('nexus'),'node');
});

test('all 72 gifts are exclusive, apply immediately, preserve durability ratio and survive reload without reroll',()=>{
 const ordinary=contentPool({unlockedContent:['overlook_archive','anchor_archive','network_archive','pressure_archive','redline_archive','channel_archive']}).relics;
 for(const gift of Object.values(nexusRelics)){
  assert.ok(!ordinary.includes(gift.id));const s=Run.newRun('all-gifts');s.units[0].hp*=.4;
  const ratio=s.units[0].hp/Rules.unitStats(s,s.units[0]).maxHp;assert.equal(enterGift(s,gift.id).ok,true);
  assert.equal(s.phase,'map');assert.ok(s.relics.includes(gift.id));assert.ok(s.discoveries.relics.includes(gift.id));assert.equal(Run.availableNodes(s).length,4);
  same(s.units[0].hp/Rules.unitStats(s,s.units[0]).maxHp,ratio);assert.ok(s.spirit>=1&&s.spirit<=s.maxSpirit);
  const saved=store();assert.equal(saved.save(s).ok,true,gift.id);assert.deepEqual(saved.load().state.nexus,s.nexus);assert.deepEqual(saved.load().state.relics,s.relics);
  frozen(s,()=>Run.chooseNexus(s,gift.id));assert.ok(Object.values(effects(s)).every(Number.isFinite));
 }
});

test('gift offers and confirmation render all effect values; queued choice is immutable and malformed rooms are rejected',()=>{
 const s=Run.newRun('confirmation'),saved=store(),room=s.nexus[0];assert.equal(saved.save(s).ok,true);const before=Run.cloneState(s);
 for(let i=0;i<10;i++)assert.match(nexusScreen(s),/心神枢纽/);
 assert.deepEqual(s,before);assert.deepEqual(saved.load().state.nexus,s.nexus);
 for(const id of room.options)assert.ok(nexusScreen(s).includes(relics[id].description));
 for(const mutate of [s=>s.nexus[0].options.pop(),s=>s.nexus[0].messenger='missing',s=>s.nexus[0].choice=room.options[0],s=>s.nexus[0].skipped=true,s=>s.nexus[2].act=0]){
  const bad=Run.cloneState(s);mutate(bad);assert.equal(saved.save(bad).ok,false);assert.deepEqual(saved.load().state.nexus,s.nexus);
 }
});

test('three act entrances interrupt progression exactly once; boss rewards finish before the next nexus and final victory stays final',()=>{
 const s=Run.newRun('three-entrances');
 for(let act=0;act<3;act++){
  assert.equal(s.phase,'nexus');assert.equal(s.act,act);assert.equal(Run.chooseNexus(s,s.nexus[act].options[0]).ok,true);
  const boss=s.maps[act].nodes.find(n=>n.type==='boss');s.nextNodes=[boss.id];assert.equal(Run.enterNode(s,boss.id).ok,true);
  assert.equal(Run.finishBattle(s,{won:true}).ok,true);
  if(act<2){assert.equal(s.phase,'reward');while(s.phase==='reward')assert.equal(Run.chooseReward(s,s.rewardQueue[0].kind==='item'?'skip':s.rewardQueue[0].options[0]).ok,true);assert.equal(s.phase,'interlude');assert.equal(s.act,act);assert.equal(Run.continueAct(s).ok,true);assert.equal(s.floor,-1);assert.equal(s.currentNode,null);}
 }
 assert.equal(s.phase,'won');assert.equal(s.stats.bosses.length,3);assert.equal(s.nexus.filter(r=>r.choice).length,3);
 assert.equal(s.stats.completedNodes,3,'entrance rooms do not inflate the 48 route-node counter');
 assert.equal(s.stats.history.filter(h=>h.text?.startsWith('心神枢纽')).length,3);
});

test('legacy saved runs retain current progress and fixed unknown outcomes, joining the nexus at a future act',()=>{
 const s=Run.newRun('legacy-nexus');delete s.nexus;s.phase='map';s.inventory.items=[{uid:'p1',type:'clarity'}];s.inventory.nextId=1;
 const old=s.maps[0].nodes.find(n=>n.floor===1);old.type='unknown';old.revealType='shop';s.nextNodes=[old.id];
 const saved=store();assert.equal(saved.save(s).ok,true);const loaded=saved.load().state;assert.equal(loaded.phase,'map');assert.equal(loaded.nexus[0].skipped,true);assert.equal(loaded.nexus[1].skipped,false);assert.equal(loaded.inventory.items.length,1);
 assert.equal(Run.enterNode(loaded,old.id).ok,true);assert.equal(loaded.currentNode.type,'shop');
});

test('merged signals have event or battle outcomes only, remain seeded across loads and share one map legend',()=>{
 let events=0,battles=0;
 for(let i=0;i<250;i++)for(let act=0;act<3;act++)for(const node of Run.generateMap(`signals-${i}`,act).nodes){
  assert.notEqual(node.type,'event');if(node.type==='unknown'){assert.ok(['event','battle'].includes(node.revealType));if(node.revealType==='event')events++;else battles++;}
 }
 assert.ok(events/(events+battles)>.72&&events/(events+battles)<.78);
 for(const outcome of ['event','battle']){
  const s=Run.newRun('signal-'+outcome);Run.chooseNexus(s,s.nexus[0].options[0]);const node=s.maps[0].nodes.find(n=>n.floor===1);node.type='unknown';node.revealType=outcome;s.nextNodes=[node.id];
  const saved=store();assert.equal(saved.save(s).ok,true);const copy=saved.load().state;Run.enterNode(s,node.id);Run.enterNode(copy,node.id);assert.deepEqual(copy.currentNode,s.currentNode);assert.equal(s.phase,outcome==='battle'?'prep':'node');assert.equal(s.currentNode.map_icon_id,'unknown');
  assert.doesNotMatch(mapScreen(s),/route-symbol event/);
 }
});

test('new-run item drops include both misses and successes and preserve the earned item across saves',()=>{
 let drops=0;
 for(let i=0;i<60;i++){
  const s=Run.newRun(`drop-v012-${i}`);Run.chooseNexus(s,s.nexus[0].options[0]);Run.enterNode(s,s.nextNodes[0]);Run.finishBattle(s,{won:true});
  if(s.rewardQueue.some(r=>r.kind==='item'))drops++;
  const saved=store();assert.equal(saved.save(s).ok,true);assert.deepEqual(saved.load().state.rewardQueue,s.rewardQueue);
 }
 assert.ok(drops>5&&drops<50);
});

test('tier-specific gifts, army size and active role composition change live stats at their advertised boundaries',()=>{
 const s=fixture(),t1=place(s,'pulse_array',5,5,{h:1}),t2=place(s,'focus_rail',8,5,{h:1,tier:2,branch:'A'}),t3=place(s,'arc_mortar',12,5,{h:1,tier:3,branch:'A'});
 const base=s.units.map(u=>Rules.unitStats(s,u));s.relics=['nexus_many'];same(Rules.unitStats(s,t1).attack,base[0].attack*1.8);same(Rules.unitStats(s,t2).attack,base[1].attack*.8);assert.equal(Rules.unitStats(s,t1).bandwidth,Math.max(1,base[0].bandwidth-1));
 s.relics=['nexus_legacy'];same(Rules.unitStats(s,t3).attack,base[2].attack*1.4);same(Rules.unitStats(s,t1).attack,base[0].attack);
 s.relics=['nexus_few'];same(Rules.unitStats(s,t1).attack,base[0].attack*1.65);for(let i=3;i<9;i++)place(s,'pulse_array',i*3,8,{h:1});same(Rules.unitStats(s,t1).attack,base[0].attack);
 s.units.pop();same(Rules.unitStats(s,t1).attack,base[0].attack*1.65);
 s.relics=['nexus_ensemble'];const melee=place(s,'phase_blade',4,3),support=place(s,'memory_mechanic',6,3);same(Rules.unitStats(s,t1).attack,base[0].attack*1.4);s.battle={disabled:[support.uid]};same(Rules.unitStats(s,t1).attack,base[0].attack);support.hp=0;s.battle=null;same(Rules.unitStats(s,t1).attack,base[0].attack);
});

test('gift damage rules distinguish boss, elite, indirect, direct, high-ground and air targets using the public attack solver',()=>{
 const s=fixture(),u=place(s,'pulse_array',8,8,{h:2}),mortar=place(s,'arc_mortar',12,8,{h:1});const target={x:11,z:9,h:0,hp:10000,maxHp:10000,armor:0,kind:'normal'};
 const baseline=Rules.solveAttack(s,u,target).damage;
 s.relics=['nexus_verdict'];same(Rules.solveAttack(s,u,{...target,kind:'boss'}).damage,baseline*1.65);same(Rules.solveAttack(s,u,{...target,kind:'elite'}).damage,baseline*1.3);same(Rules.solveAttack(s,u,target).damage,baseline);
 s.relics=['nexus_skyfire'];same(Rules.solveAttack(s,u,target).damage,baseline*.85);const indirect=Rules.solveAttack(s,mortar,target).damage;s.relics=[];same(indirect,Rules.solveAttack(s,mortar,target).damage*1.45);
 s.relics=['nexus_horizon'];same(Rules.solveAttack(s,u,target).damage,baseline*1.35);s.relics=['nexus_airlock'];same(Rules.solveAttack(s,u,{...target,air:true}).damage,baseline*1.6);
});

test('opening and reserve shields absorb real death pressure, log separately from items and restore at the next battle',()=>{
 const s=fixture();s.relics=['nexus_sentinel'];const [e]=battle(s);Object.assign(e,{x:20,z:24,hp:1,maxHp:1,pressure:30,ability:'none',speed:0});
 const uid=addItem(s,'pulse_bomb').item.uid;assert.equal(useItem(s,uid).ok,true);same(s.stats.nexusAbsorbed,18);same(s.stats.itemAbsorbed,0);same(s.stats.pressureLog.at(-1).nexusAbsorbed,18);same(s.stats.pressureLog.at(-1).damage,12);same(s.spirit,88);
 s.phase='prep';startBattle(s);same(s.battle.nexusShield,18);
 s.phase='prep';s.relics=['nexus_reserve'];s.bandwidth=20;startBattle(s);same(s.battle.nexusShield,60);
 s.phase='prep';place(s,'pulse_array',5,5,{h:1});s.bandwidth=2;startBattle(s);const bw=Rules.bandwidthState(s);same(s.battle.nexusShield,Math.max(0,bw.cap-bw.used)*4);
});

test('stillness controls newly spawned reinforcements and scales its duration with pressure',()=>{
 for(const pressure of [0,10]){const s=fixture('spawn-slow',{revision:3});s.pressureLevel=pressure;s.relics=['nexus_stillness'];const [e]=battle(s);assert.ok(e.slow> (pressure===0?7.9:5.9)&&e.slow<=(pressure===0?8:6));}
});

test('rebirth protects one enabled construct per battle and cannot revive disabled units',()=>{
 for(const disabled of [false,true]){
  const s=fixture(),u=place(s,'phase_blade',10,10);s.relics=['nexus_rebirth'];const [e]=battle(s);s.bandwidth=disabled?0:20;
  Object.assign(e,{x:10.5,z:11,h:0,hp:1e8,maxHp:1e8,attack:1e6,cooldown:0,speed:0,abilityClock:1e6});u.cooldown=1e6;stepBattle(s,.05);
  if(disabled){assert.equal(u.hp,0);assert.ok(!s.battle.nexusRebirthUsed);}else{same(u.hp,Rules.unitStats(s,u).maxHp*.5);assert.equal(s.battle.nexusRebirthUsed,true);e.cooldown=0;stepBattle(s,.05);assert.equal(u.hp,0);}
 }
});

test('post-battle recovery and immediate bargains apply their exact cost without resurrecting destroyed units',()=>{
 const s=fixture();s.relics=['nexus_home'];const a=place(s,'phase_blade',4,4,{hp:1}),b=place(s,'pulse_array',7,7,{h:1,hp:0});s.spirit=30;Run.finishBattle(s,{won:true});same(s.spirit,53);same(a.hp,1+Rules.unitStats(s,a).maxHp*.35);assert.equal(b.hp,0);
 const fresh=Run.newRun('sacrifice');fresh.spirit=10;const focus=fresh.focus;enterGift(fresh,'nexus_sacrifice');assert.equal(fresh.spirit,1);assert.equal(fresh.focus,focus+140);assert.equal(Rules.bandwidthState(fresh).cap,27);
});

test('stacked far-pressure gifts cap at complete absorption and never record negative pressure',()=>{
 const s=fixture();s.relics=['nexus_terraces','nexus_distance'];s.modifiers.far_pressure=.3;const [e]=battle(s);Object.assign(e,{hp:1,maxHp:1,pressure:100,x:1,z:1,ability:'none'});useItem(s,addItem(s,'pulse_bomb').item.uid);assert.equal(s.stats.pressureLog.at(-1).modified,0);assert.equal(s.stats.pressure,0);assert.equal(s.spirit,100);
});
