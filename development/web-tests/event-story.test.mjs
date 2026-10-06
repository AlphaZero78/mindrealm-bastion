import test from 'node:test';
import assert from 'node:assert/strict';
import * as Run from '../../game/web/core/state.js';
import {legacyEvents as events} from '../../game/web/core/content.js';
import {legacyEventStories as eventStories} from '../../game/web/core/event-stories.js';
import {addItem} from '../../game/web/core/inventory.js';
import {createSaveStore} from '../../game/web/core/save.js';
import {header,nodeScreen,rewardScreen,summaryScreen} from '../../game/web/screens.js';

class MemoryStorage{data=new Map();getItem(k){return this.data.get(k)??null;}setItem(k,v){this.data.set(k,String(v));}removeItem(k){this.data.delete(k);}}
function encounter(id){
 const state=Run.newRun(`story:${id}`);state.difficultyRevision=4;Run.chooseNexus(state,state.nexus[0].options[0]);state.act=events[id].act-1;
 const node=state.maps[state.act].nodes.find(n=>n.floor===1);node.type='event';node.event=id;state.nextNodes=[node.id];Run.enterNode(state,node.id);
 state.depth=5;state.focus=500;state.spirit=80;for(const u of state.units)u.hp*=.6;addItem(state,'clarity');return state;
}
test('every event has scene prose and a distinct continuation for every real choice',()=>{
 assert.deepEqual(Object.keys(eventStories).sort(),Object.keys(events).sort());
 for(const event of Object.values(events)){
  const story=eventStories[event.id];assert.ok(story.intro.length>=70,event.id);assert.equal(story.choices.length,event.choices.length);
  for(const choice of story.choices){assert.ok(choice.text.length>=45,event.id);assert.ok(choice.title&&choice.label);assert.doesNotMatch(choice.label,/^(离开|直接离开|返回路线|跳过)/);}
  assert.equal(new Set(story.choices.map(c=>c.text)).size,event.choices.length);
 }
});
test('all 84 branches persist applied outcomes and block rerolls, premature rewards and double collection',()=>{
 let branches=0;
 for(const event of Object.values(events))for(let index=0;index<event.choices.length;index++){
  const state=encounter(event.id),before=Run.cloneState(state),store=createSaveStore(new MemoryStorage(),`story.${event.id}.${index}`);
  for(const [action,payload] of [['cancel',{}],['leave',{}],['event-continue',{}],['event',{index:'1'}]]){const result=Run.nodeAction(state,action,payload);assert.equal(result.ok,action==='cancel');assert.deepEqual(state,before);}
  const preview=Run.eventPreview(state,index);assert.equal(preview.canChoose,true);assert.equal(Run.nodeAction(state,'event',{index}).ok,true);
  assert.equal(state.phase,'node');assert.equal(state.stats.completedNodes,before.stats.completedNodes);assert.deepEqual(state.currentNode.eventData.outcome.details,preview.details);
  const applied=Run.cloneState(state);assert.equal(Run.nodeAction(state,'event',{index}).ok,false);assert.deepEqual(state,applied);assert.equal(Run.nodeAction(state,'leave').ok,false);
  assert.equal(store.save(state).ok,true,`${event.id}:${index} save`);const loaded=store.load();assert.equal(loaded.ok,true);const restored=loaded.state;assert.deepEqual(restored.currentNode.eventData.outcome,applied.currentNode.eventData.outcome);
  if(state.rewardQueue.length)assert.equal(Run.chooseReward(state,state.rewardQueue[0].options[0]).ok,false);
  assert.equal(Run.nodeAction(state,'event-continue').ok,true);assert.equal(Run.nodeAction(restored,'event-continue').ok,true);assert.equal(state.stats.completedNodes,before.stats.completedNodes+1);assert.deepEqual(restored,state);
  assert.equal(Run.nodeAction(state,'event-continue').ok,false);branches++;
 }
 assert.equal(branches,84);
});
test('invalid event outcome data is rejected while older unresolved event saves remain readable',()=>{
 const state=encounter('quiet_room'),store=createSaveStore(new MemoryStorage(),'story.compat');assert.equal(store.save(state).ok,true);assert.equal(store.load().state.currentNode.eventData.outcome,undefined);
 Run.nodeAction(state,'event',{index:0});for(const change of [o=>o.index=-1,o=>o.index=99,o=>o.details=[{}],o=>o.label=null]){const invalid=Run.cloneState(state);change(invalid.currentNode.eventData.outcome);assert.equal(store.save(invalid).ok,false);}
 assert.equal(store.save(state).ok,true);assert.equal(store.load().state.phase,'node');
});
test('scene markup uses the real illustration and outcome while XP remains visible at depth cap',()=>{
 const state=encounter('quiet_room');let html=nodeScreen(state);assert.match(html,/quiet_room\.png/);assert.match(html,/event-choice/);assert.doesNotMatch(html,/data-action="node-leave"/);assert.match(html,/hud-xp-bar/);
 Run.nodeAction(state,'event',{index:1});html=nodeScreen(state);assert.match(html,/event-continue/);assert.match(html,/学会构筑沉默/);assert.doesNotMatch(html,/data-action="event-choice"/);
 state.depth=12;state.xp=0;html=header(state);assert.match(html,/已达到最大精神深度/);assert.match(html,/value="1" max="1"/);
});

test('event upgrades show their future model and lethal exchanges retain the selected story',()=>{
 const state=encounter('noise_market'),unit=state.units[0];state.phase='reward';state.rewardQueue=[{kind:'upgrade',title:'重建构造',options:[`${unit.uid}:A`,`${unit.uid}:B`]}];
 const before=Run.cloneState(state),html=rewardScreen(state);assert.match(html,/data-art-variant="T2A"/);assert.match(html,/data-art-variant="T2B"/);assert.deepEqual(state,before);
 const fatal=encounter('noise_market');fatal.spirit=1;assert.equal(Run.nodeAction(fatal,'event',{index:0}).ok,true);assert.equal(fatal.phase,'lost');const ending=summaryScreen(fatal);assert.match(ending,/event-final-record/);assert.match(ending,/交出失眠的片段/);assert.match(ending,/耗尽了火种/);
});
