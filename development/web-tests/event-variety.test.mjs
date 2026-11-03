import test from 'node:test';
import assert from 'node:assert/strict';
import * as Run from '../../game/web/core/state.js';
import * as Rules from '../../game/web/core/rules.js';
import {events,eventFor,legacyEvents,previousEvents} from '../../game/web/core/content.js';
import {eventStories} from '../../game/web/core/event-stories.js';
import {addItem} from '../../game/web/core/inventory.js';
import {createSaveStore} from '../../game/web/core/save.js';
import {eventScene} from '../../game/web/event-view.js';
import {revealOldEvent} from './helpers/revealed-event.mjs';

const store=()=>{const values=new Map();return createSaveStore({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},'variety.qa');};
function prepared(id,seed='event-variety'){
 const s=Run.newRun(seed);Run.chooseNexus(s,s.nexus[0].options[0]);s.act=events[id].act-1;s.nexus.forEach(n=>n.skipped=!n.choice);
 s.contentPool.events=Object.keys(events);s.focus=1000;s.bandwidth=30;s.resistance=20;s.spirit=60;s.depth=6;s.inventory.capacity=14;
 s.eventClues=events[id].choices.flatMap(c=>c.effects.consume_clue?[c.effects.consume_clue]:[]);
 s.units.slice(0,3).forEach(u=>{u.tier=2;u.branch='A';});for(const u of s.units)u.hp=Rules.unitStats(s,u).maxHp*.4;addItem(s,'clarity');
 const node=s.maps[s.act].nodes.find(n=>n.floor===1);Object.assign(node,{type:'unknown',revealType:'event',event:id});s.nextNodes=[node.id];return {s,node};
}
const signature=c=>JSON.stringify([Object.entries(c.effects).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,typeof v==='number'?Math.sign(v):v]),c.risk?.map(r=>Object.entries(r.effects).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,typeof v==='number'?Math.sign(v):v]))]);

test('a non-event node has no event preview, including the no-candidate battle fallback',()=>{
 const s=Run.newRun('not-event');assert.equal(Run.eventPreview(s,0),null);Run.chooseNexus(s,s.nexus[0].options[0]);Run.enterNode(s,s.nextNodes[0]);assert.equal(Run.eventPreview(s,0),null);
});

test('36 events have 72 substantive decisions without magnitude-only duplicates',()=>{
 const signatures=new Map();
 for(const event of Object.values(events)){
  assert.equal(event.choices.length,2);assert.equal(eventStories[event.id].choices.length,2);assert.ok(eventStories[event.id].intro.length>=60,event.id);
  for(const [i,c]of event.choices.entries()){
   assert.ok(Object.keys(c.effects).length);assert.ok(c.label&&c.title&&c.text.length>=20);
   assert.ok(!(c.effects.recycle&&c.effects.tower_hp),'recycled construct for a small HP increase was removed');
   const key=signature(c);assert.ok(!signatures.has(key),`${event.id}:${i} repeats ${signatures.get(key)}`);signatures.set(key,`${event.id}:${i}`);
  }
 }
 assert.equal(signatures.size,72);
});

test('every new decision can be offered, previews its exact result and survives save/reload atomically',()=>{
 for(const event of Object.values(events))for(let index=0;index<2;index++){
  const {s,node}=prepared(event.id);assert.ok(Run.eligibleEvents(s,node).some(e=>e.id===event.id),`${event.id} is unreachable`);
  assert.equal(Run.enterNode(s,node.id).ok,true);assert.equal(s.currentNode.eventData.id,event.id);assert.equal(s.currentNode.eventData.designVersion,2);
  assert.ok(event.choices.every((_,i)=>Run.eventPreview(s,i).canChoose));
  const saved=store();assert.equal(saved.save(s).ok,true);const before=Run.cloneState(s),copy=saved.load().state;
  assert.deepEqual(Run.eventPreview(copy,index),Run.eventPreview(s,index));assert.equal(Run.nodeAction(s,'cancel').ok,true);assert.deepEqual(s,before);
  const result=Run.eventPreview(s,index,{}, {resolveRisk:true});assert.equal(Run.nodeAction(s,'event',{index}).ok,true,`${event.id}/${index}`);assert.equal(Run.nodeAction(copy,'event',{index}).ok,true);assert.deepEqual(s,copy);
  assert.deepEqual(s.currentNode.eventData.outcome.details,result.details);const applied=Run.cloneState(s);assert.equal(Run.nodeAction(s,'event',{index}).ok,false);assert.deepEqual(s,applied);
  assert.equal(saved.save(s).ok,true);assert.deepEqual(saved.load().state.currentNode.eventData,s.currentNode.eventData);
  assert.equal(Run.nodeAction(s,'event-continue').ok,true);assert.ok(['reward','map','prep'].includes(s.phase));
 }
});

test('complete offer eligibility rejects unaffordable, unavailable and ineffective options',()=>{
 const cases=[
  ['noise_market',s=>s.inventory.items=[]],['noise_market',s=>s.spirit=5],
  ['false_memory',s=>s.resistance=0],['false_memory',s=>s.depth=1],
  ['closed_shop',s=>s.eventClues=[]],['closed_shop',s=>s.focus=0],
  ['resonance_storm',s=>s.units.forEach(u=>{u.x=10;u.z=10;})],
  ['defense_clinic',s=>s.units.forEach(u=>u.hp=Rules.unitStats(s,u).maxHp)],
  ['quiet_room',s=>s.spirit=s.maxSpirit],['assembly_line',s=>s.units.forEach(u=>{u.tier=3;u.branch='A';})],
  ['lost_courier',s=>{while(s.units.length<s.inventory.capacity)Run.addUnit(s,'pulse_array');}],
  ['last_logistics',s=>{addItem(s,'barrier');addItem(s,'fortify');}],
  ['resonance_vault',s=>s.inventory.itemCapacity=4],['narrow_channel',s=>s.inventory.capacity=20],
  ['archived_voice',s=>s.depth=12]
 ];
 for(const [id,mutate]of cases){const {s,node}=prepared(id);mutate(s);const before=Run.cloneState(s);assert.ok(!Run.eligibleEvents(s,node).some(e=>e.id===id),id);assert.deepEqual(s,before,'eligibility has no side effects');}
});

test('unrevealed legacy nodes use edition 2 while revealed legacy encounters retain their choices',()=>{
 for(const revision of [1,4,5]){
  const {s,node}=prepared('noise_market');s.difficultyRevision=revision;
  assert.equal(Run.enterNode(s,node.id).ok,true);assert.equal(eventFor(s,'noise_market'),events.noise_market);
  const old=prepared('noise_market');old.s.difficultyRevision=revision;old.node.type='event';revealOldEvent(old.s,old.node);
  Run.enterNode(old.s,old.node.id);assert.equal(eventFor(old.s,'noise_market'),revision===5?previousEvents.noise_market:legacyEvents.noise_market);
  const saved=store();assert.equal(saved.save(old.s).ok,true);assert.deepEqual(saved.load().state.currentNode.eventData,old.s.currentNode.eventData);
 }
});

test('event encounters never repeat across a saved expedition and exhaustion becomes a fixed battle',()=>{
 for(let seed=0;seed<8;seed++){
  let {s}=prepared('noise_market',`no-repeat:${seed}`);const seen=new Set();let battles=0;
  for(let act=0;act<3;act++){
   s.act=act;
   for(const nodeId of s.maps[act].nodes.filter(n=>n.floor>0&&n.floor<8).map(n=>n.id)){
    const node=s.maps[act].nodes.find(n=>n.id===nodeId);
    s.phase='map';Object.assign(node,{type:'unknown',revealType:'event'});s.nextNodes=[node.id];
    const twin=Run.cloneState(s);Run.enterNode(s,node.id);Run.enterNode(twin,node.id);assert.deepEqual(s,twin);
    if(s.currentNode.type==='event'){
     const id=s.currentNode.eventData.id;assert.ok(!seen.has(id));seen.add(id);assert.ok(events[id].choices.every((_,i)=>Run.eventPreview(s,i).canChoose));
     const resources=JSON.stringify([s.focus,s.spirit,s.units,s.inventory,s.relics]);Run.nodeAction(s,'event-decline');assert.equal(JSON.stringify([s.focus,s.spirit,s.units,s.inventory,s.relics]),resources);
     assert.match(eventScene(s,''),/继续前进/);const saved=store();assert.equal(saved.save(s).ok,true);s=saved.load().state;Run.nodeAction(s,'event-continue');
    }else {assert.equal(s.currentNode.type,'battle');assert.equal(s.currentNode.eventFallback,true);battles++;}
   }
  }
  assert.ok(seen.size>=5);assert.ok(battles>0);
 }
});

test('recycle eligibility chooses a material that preserves promised upgrade targets',()=>{
 const {s,node}=prepared('assembly_line');s.units.forEach((u,i)=>{u.tier=i===0?1:3;u.branch=i===0?null:'A';});
 Run.enterNode(s,node.id);assert.equal(s.currentNode.eventData.id,'assembly_line');
 const preview=Run.eventPreview(s,1);assert.equal(preview.canChoose,true);assert.notEqual(preview.recycleUid,s.units[0].uid);
 const before=Run.cloneState(s);assert.equal(Run.nodeAction(s,'event',{index:1,uid:s.units[0].uid}).ok,false);assert.deepEqual(s,before);
 assert.equal(Run.nodeAction(s,'event-decline').ok,true);const saved=store();assert.equal(saved.save(s).ok,true);
 const bad=Run.cloneState(s);bad.currentNode.eventData.outcome.index=1;assert.equal(saved.save(bad).ok,false);
});
