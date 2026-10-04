import {unblessedRun} from './helpers/unblessed-run.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as CoreRun from '../../web/core/state.js';
const Run={...CoreRun,newRun:unblessedRun};
import * as Rules from '../../web/core/rules.js';
import {items,addItem,discardItem,discardUnits,inventoryStatus} from '../../web/core/inventory.js';
import {itemPreview,useItem,makeEncounter,startBattle,stepBattle} from '../../web/core/battle.js';
import {xpRequirement,upgradeRequirement,enemyStats,killRewardScale} from '../../web/core/difficulty.js';
import {events,enemies} from '../../web/core/content.js';
import {createSaveStore} from '../../web/core/save.js';
import {fixture,place,battle} from './helpers/battle-fixture.mjs';
const clone=Run.cloneState;
const store=()=>{const data=new Map();return createSaveStore({getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},'items.isolated');};
const service=(type,seed='new-shop')=>{const s=Run.newRun(seed);const node=s.maps[0].nodes.find(n=>n.floor===1);node.type=type;s.nextNodes=[node.id];Run.enterNode(s,node.id);return s;};
const equip=(s,type)=>{s.inventory.items=[];return addItem(s,type).item.uid;};
const combat=()=>{const s=fixture('items',{revision:3}),u=place(s,'pulse_array',10,10,{h:1}),[e]=battle(s);Object.assign(e,{x:1,z:1,speed:0,cooldown:1e6,abilityClock:1e6,hp:1e6,maxHp:1e6});return {s,u,e};};
const inert=(s,fn)=>{const before=clone(s);assert.equal(fn().ok,false);assert.deepEqual(s,before);};

test('inventory capacity counts deployed and stored units; all confirmed sets are removed atomically',()=>{
 const s=Run.newRun('overflow'),first=s.nextNodes[0];for(let i=0;i<7;i++)Run.addUnit(s,'pulse_array');
 assert.equal(inventoryStatus(s).used,14);assert.equal(inventoryStatus(s).overflow,2);
 inert(s,()=>Run.enterNode(s,first));inert(s,()=>discardUnits(s,['missing']));inert(s,()=>discardUnits(s,[]));
 assert.equal(discardUnits(s,s.units.slice(-2).map(u=>u.uid)).ok,true);assert.equal(inventoryStatus(s).used,12);assert.equal(Run.enterNode(s,first).ok,true);
 const unit=s.units[0];unit.x=5;unit.z=5;assert.equal(inventoryStatus(s).used,12);assert.equal(inventoryStatus(s).deployed.length,1);assert.equal(discardUnits(s,[unit.uid]).ok,true);assert.equal(inventoryStatus(s).used,11);
 startBattle(s);inert(s,()=>discardUnits(s,[s.units[1].uid]));
});
test('full item slots require an explicit replacement; malformed and stale replacements are inert',()=>{
 const s=Run.newRun('slots');assert.equal(s.inventory.items.length,0);addItem(s,'clarity');addItem(s,'stasis');assert.equal(addItem(s,'barrier').ok,true);assert.equal(s.inventory.items.length,3);
 inert(s,()=>addItem(s,'overclock'));inert(s,()=>addItem(s,'overclock','gone'));inert(s,()=>addItem(s,'invalid'));
 const first=s.inventory.items[0].uid;assert.equal(addItem(s,'overclock',first).ok,true);assert.equal(s.inventory.items.length,3);assert.equal(s.inventory.items[0].type,'overclock');
 inert(s,()=>discardItem(s,first));assert.equal(discardItem(s,s.inventory.items[0].uid).ok,true);
});
test('restoration items expose actual gains, preserve position and refuse wasted or invalid targets',()=>{
 const s=Run.newRun('restore');let uid=equip(s,'clarity');inert(s,()=>useItem(s,uid));s.spirit=91;
 const before=clone(s);assert.equal(itemPreview(s,uid).amount,9);assert.deepEqual(s,before);assert.equal(useItem(s,uid).ok,true);assert.equal(s.spirit,100);
 uid=equip(s,'repair_foam');const u=s.units[0];u.hp*=.2;const original=u.hp,max=Rules.unitStats(s,u).maxHp;
 inert(s,()=>useItem(s,uid,'missing'));assert.equal(useItem(s,uid,u.uid).ok,true);assert.equal(u.hp,original+max*.35);
 const c=combat();c.u.hp*=.5;uid=equip(c.s,'repair_foam');assert.equal(useItem(c.s,uid,c.u.uid).ok,true);assert.equal(c.u.x,10);assert.equal(c.u.hp,Rules.unitStats(c.s,c.u).maxHp*.85);
 uid=equip(c.s,'repair_foam');c.u.hp=0;inert(c.s,()=>useItem(c.s,uid,c.u.uid));
});
test('safe-only batteries cannot be spent in combat and new battle items wait for valid circumstances',()=>{
 const s=Run.newRun('safe');let uid=equip(s,'focus_cell'),focus=s.focus;assert.equal(useItem(s,uid).ok,true);assert.equal(s.focus,focus+30);
 uid=equip(s,'overclock');inert(s,()=>useItem(s,uid));
 const c=combat();uid=equip(c.s,'focus_cell');inert(c.s,()=>useItem(c.s,uid));
 uid=equip(c.s,'cleanser');inert(c.s,()=>useItem(c.s,uid));
 c.e.jamUntil=20;c.e.corrosionUntil=20;c.s.battle.jam=18;c.s.battle.corrosion=2;c.s.battle.disabled=[c.u.uid];
 assert.equal(useItem(c.s,uid).ok,true);assert.equal(c.s.battle.jam,0);assert.equal(c.s.battle.corrosion,0);assert.equal(c.u.reactivate,true,'cleansing preserves reactivation talent triggers');assert.deepEqual(c.s.battle.disabled,[]);stepBattle(c.s,.05);assert.equal(c.s.battle.jam,0);assert.equal(c.e.jamUntil,0);
});
test('timed attack, armor and resistance buffs activate once, survive repeated previews and expire on simulation time',()=>{
 for(const type of ['overclock','fortify','insulator']){
  const {s,u}=combat(),uid=equip(s,type),baseline=Rules.unitStats(s,u),res=s.resistance;assert.equal(useItem(s,uid).ok,true);
  const after=Rules.unitStats(s,u);if(type==='overclock')assert.ok(Math.abs(after.attack-baseline.attack*1.35)<1e-8);if(type==='fortify')assert.equal(after.armor,baseline.armor+5);
  assert.equal(s.resistance,res,'temporary resistance never overwrites permanent progression');
  const next=addItem(s,type).item.uid;inert(s,()=>useItem(s,next));
  for(let i=0;i<items[type].duration*4+1;i++)stepBattle(s,.25);
  assert.equal(Rules.unitStats(s,u).attack,baseline.attack);assert.equal(Rules.unitStats(s,u).armor,baseline.armor);assert.equal(itemPreview(s,next).ok,true);
 }
});
test('stasis affects present enemies and respects pressure control duration; no enemies means no charge',()=>{
 const {s,e}=combat();s.pressureLevel=10;const uid=equip(s,'stasis');assert.equal(useItem(s,uid).ok,true);assert.equal(e.slow,6);
 const next=addItem(s,'stasis').item.uid;s.battle.enemies=[];inert(s,()=>useItem(s,next));
});
test('bombs use authoritative shields, kills, pressure, XP and focus instead of deleting enemies',()=>{
 const {s,e}=combat();Object.assign(e,{hp:60,shield:30,x:20,z:24,pressure:40,xp:20,focus:4});s.resistance=0;s.spirit=100;
 let uid=equip(s,'barrier');assert.equal(useItem(s,uid).ok,true);uid=equip(s,'pulse_bomb');assert.equal(useItem(s,uid).ok,true);
 assert.equal(e.dead,true);assert.equal(e.shield,0);assert.equal(s.stats.kills,1);assert.equal(s.xp,13);assert.equal(s.stats.itemAbsorbed,25);assert.equal(s.stats.pressureLog.at(-1).itemAbsorbed,25);assert.equal(s.spirit,85);assert.equal(s.stats.pressure,15);
});
test('a battle exit restores both consumables and combat effects to the same pre-battle snapshot',()=>{
 const s=Run.newRun('rollback');Run.enterNode(s,s.nextNodes[0]);const uid=equip(s,'overclock'),storage=store();assert.equal(storage.save(s).ok,true);startBattle(s);
 assert.equal(useItem(s,uid).ok,true);assert.equal(s.inventory.items.length,0);assert.equal(storage.save(s).ok,true);
 const loaded=storage.load().state;assert.equal(loaded.phase,'prep');assert.equal(loaded.inventory.items[0].uid,uid);assert.equal(loaded.battle,null);assert.equal(loaded.stats.itemsUsed,undefined);
});
test('battle item drops and replacements resume exactly; full slots can always skip a saved offer',()=>{
 const a=service('battle','item-drop'),b=clone(a);a.inventory.pity=20;b.inventory.pity=20;Run.finishBattle(a,{won:true});Run.finishBattle(b,{won:true});assert.deepEqual(a.rewardQueue,b.rewardQueue);
 assert.equal(a.rewardQueue.at(-1).kind,'item');while(a.rewardQueue[0].kind!=='item')assert.equal(Run.chooseReward(a,a.rewardQueue[0].options[0]).ok,true);
 addItem(a,'clarity');addItem(a,'stasis');addItem(a,'barrier');const storage=store();assert.equal(storage.save(a).ok,true);const copy=storage.load().state;assert.deepEqual(copy.rewardQueue,a.rewardQueue);
 inert(a,()=>Run.chooseReward(a,a.rewardQueue[0].options[0]));assert.equal(Run.chooseReward(a,'skip').ok,true);assert.equal(a.phase,'map');assert.equal(a.inventory.items.length,3);
});
test('shops persist discounted stock, tiered offers, item replacement, limited services and resale',()=>{
 const s=service('shop');addItem(s,'clarity');addItem(s,'stasis');s.focus=1000;s.spirit=50;const node=s.currentNode;
 assert.deepEqual([node.stock.units.length,node.stock.relics.length,node.stock.items.length],[3,3,3]);assert.equal(Run.shopPrice(s,'units',node.stock.units[0]),60);
 const offer=node.stock.items[0],before=s.focus;assert.equal(Run.nodeAction(s,'buy-item',{id:offer.key}).ok,true);assert.equal(s.focus,before-offer.price);inert(s,()=>Run.nodeAction(s,'buy-item',{id:offer.key}));
 const next=node.stock.items[1];inert(s,()=>Run.nodeAction(s,'buy-item',{id:next.key}));assert.equal(Run.nodeAction(s,'buy-item',{id:next.key,replaceUid:s.inventory.items[0].uid}).ok,true);
 assert.equal(Run.nodeAction(s,'shop-service',{id:'capacity'}).ok,true);assert.equal(s.inventory.capacity,14);inert(s,()=>Run.nodeAction(s,'shop-service',{id:'capacity'}));
 assert.equal(Run.nodeAction(s,'shop-service',{id:'pouch'}).ok,true);assert.equal(s.inventory.itemCapacity,4);assert.equal(Run.nodeAction(s,'shop-service',{id:'heal'}).ok,true);assert.equal(s.spirit,70);
 const u=s.units[0],focus=s.focus;assert.equal(Run.nodeAction(s,'sell-unit',{uid:u.uid}).ok,true);assert.equal(s.focus,focus+20);inert(s,()=>Run.nodeAction(s,'sell-unit',{uid:u.uid}));
 const storage=store();assert.equal(storage.save(s).ok,true);assert.deepEqual(storage.load().state.currentNode.stock,s.currentNode.stock);
});
test('targeted events show and consume the chosen inventory unit or item; unaffordable choices stay unchanged',()=>{
 for(const id of ['scrap_bridge','silent_exchange']){
  const s=Run.newRun(id);addItem(s,'clarity');addItem(s,'stasis');s.act=events[id].act-1;const node=s.maps[s.act].nodes.find(n=>n.floor===1);node.type='event';node.event=id;s.nextNodes=[node.id];Run.enterNode(s,node.id);
  const payload=id==='scrap_bridge'?{index:0,uid:s.units[2].uid}:{index:0,itemUid:s.inventory.items[1].uid};
  const before=clone(s),preview=Run.eventPreview(s,0,payload);assert.equal(preview.canChoose,true);assert.deepEqual(s,before);
  inert(s,()=>Run.nodeAction(s,'event',{...payload,uid:'missing',itemUid:'missing'}));assert.equal(Run.nodeAction(s,'event',payload).ok,true);
  if(payload.uid)assert.ok(!s.units.some(u=>u.uid===payload.uid));if(payload.itemUid)assert.ok(!s.inventory.items.some(u=>u.uid===payload.itemUid));
 }
});
test('depth and fusion gates slow v3 growth while revision 2 keeps its exact progression',()=>{
 const s=fixture('growth',{revision:3}),u=place(s,'pulse_array',9,9,{h:1});s.focus=2000;Run.addUnit(s,u.type);Run.addUnit(s,u.type);
 assert.equal(xpRequirement(s),400);Run.addXP(s,399);assert.equal(s.depth,1);inert(s,()=>Rules.upgrade(s,u.uid,'A'));inert(s,()=>Rules.fuse(s,u.uid,'A'));
 Run.addXP(s,1);assert.equal(s.depth,2);assert.equal(xpRequirement(s),800);assert.equal(Rules.upgrade(s,u.uid,'A').ok,true);inert(s,()=>Rules.upgrade(s,u.uid,'A'));
 Run.addXP(s,800+1200+1600);assert.equal(s.depth,5);assert.equal(upgradeRequirement(s,u).ok,true);assert.equal(Rules.upgrade(s,u.uid,'A').ok,true);
 const old=Run.newRun('old');old.difficultyRevision=2;Run.addXP(old,200);assert.equal(old.depth,2);assert.equal(xpRequirement(old),325);assert.deepEqual(killRewardScale(old),{xp:1,focus:1});
});
test('every event keeps a survivable exit when storage is empty, expansions are full and focus is exhausted',()=>{
 for(const event of Object.values(events)){
  const s=Run.newRun(`event-exit-${event.id}`);s.act=event.act-1;s.units=[];s.inventory.items=[];s.inventory.capacity=20;s.inventory.itemCapacity=4;s.focus=0;s.spirit=1;
  const node=s.maps[s.act].nodes.find(n=>n.floor===1);node.type='event';node.event=event.id;s.nextNodes=[node.id];assert.equal(Run.enterNode(s,node.id).ok,true);
  const choices=event.choices.map((_,i)=>({i,p:Run.eventPreview(s,i)})),exit=choices.find(({p})=>p.canChoose&&(p.effects.spirit||0)+s.spirit>0);
  assert.ok(exit,`${event.id} must keep a survivable choice`);assert.equal(Run.nodeAction(s,'event',{index:exit.i}).ok,true);assert.notEqual(s.phase,'lost');
 }
});
test('event tier-two previews match the actual depth-gated compensation',()=>{
 const s=service('event');s.currentNode.eventData.id='identity_checkpoint';s.depth=1;const p=Run.eventPreview(s,1),focus=s.focus;
 assert.match(p.details.join(' '),/T1.*40/);assert.equal(Run.nodeAction(s,'event',{index:1}).ok,true);assert.equal(s.units.at(-1).tier,1);assert.equal(s.focus,focus+40);
});
test('new standard enemies grow across acts without adding population; current economy and XP previews agree',()=>{
 const s=Run.newRun('growth-enemy');Run.enterNode(s,s.nextNodes[0]);const old=clone(s);old.difficultyRevision=2;
 assert.equal(makeEncounter(s).total,makeEncounter(old).total);const spec=enemies.static_drifter;
 assert.ok(enemyStats(s,spec).maxHp>enemyStats(old,spec).maxHp);const first=enemyStats(s,spec).maxHp;s.act=2;s.floor=14;assert.ok(enemyStats(s,spec).maxHp>first*2);
});
test('relay redundancy applies in deployment preview, disables newest units and inherits backups consistently',()=>{
 const s=fixture('relays',{revision:3});const sources=[0,1,2,3].map(i=>place(s,'bandwidth_relay',2+i*3,10,{tier:3,branch:'A'}));
 assert.deepEqual(Rules.relaySupply(s).map(u=>u.amount),[14,8,5,0]);assert.equal(Rules.bandwidthState(s).cap,47);
 sources[0].hp=0;assert.deepEqual(Rules.relaySupply(s).map(u=>u.amount),[14,8,5]);assert.equal(Rules.bandwidthState(s).cap,47);
 s.difficultyRevision=2;assert.equal(Rules.bandwidthState(s).cap,62);
});
test('legacy saves gain an empty inventory without deleting units; invalid new inventory preserves the saved run',()=>{
 const s=Run.newRun('legacy-bag'),storage=store();s.difficultyRevision=2;delete s.inventory;for(let i=0;i<8;i++)Run.addUnit(s,'pulse_array');assert.equal(storage.save(s).ok,true);
 const loaded=storage.load().state;assert.equal(loaded.units.length,15);assert.deepEqual(loaded.inventory.items,[]);assert.equal(inventoryStatus(loaded).overflow,3);assert.equal(loaded.difficultyRevision,2);
 for(const corrupt of [x=>x.capacity=0,x=>x.itemCapacity=99,x=>x.items=[{uid:'p1',type:'missing'}],x=>x.nextId=-1]){const bad=clone(loaded);corrupt(bad.inventory);assert.equal(storage.save(bad).ok,false);assert.equal(storage.load().state.units.length,15);}
});
