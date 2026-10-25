import test from 'node:test';
import assert from 'node:assert/strict';
import {createTutorialSession,currentTutorialStep,advanceTutorial,tutorialActionAllowed,tutorialEncounter,startTutorialBattle,TUTORIAL_TARGETS} from '../../game/web/core/tutorial.js';
import * as Rules from '../../game/web/core/rules.js';
import * as Run from '../../game/web/core/state.js';
import {stepBattle} from '../../game/web/core/battle.js';
import {renderTutorialGuide} from '../../game/web/tutorial-view.js';

const place=(state,key)=>{const target=TUTORIAL_TARGETS[key];return Rules.deploy(state,target.uid,target.x,target.z);};
const ready=()=>{
 const data=createTutorialSession(),{state,session}=data;
 advanceTutorial(session,state,{},'next');
 assert.equal(place(state,'melee').ok,true);advanceTutorial(session,state);
 assert.equal(place(state,'ranged').ok,true);advanceTutorial(session,state);
 assert.equal(Rules.applyTerrain(state,{...TUTORIAL_TARGETS.terrain,tool:'raise',brush:'single'}).ok,true);advanceTutorial(session,state);
 return data;
};

test('tutorial attempts have a fixed map, route, units and queue with independent ownership',()=>{
 const a=createTutorialSession(),b=createTutorialSession();assert.deepEqual(a,b);
 assert.equal(a.state.terrain.size,41);assert.equal(a.state.terrain.entries.length,1);
 assert.deepEqual(a.state.units.map(u=>[u.uid,u.type]),[['u1','anchor_bulwark'],['u2','pulse_array']]);
 assert.deepEqual(a.state.maps[0].nodes.map(n=>n.type),['battle','camp']);
 for(const key of ['melee','ranged']){const t=TUTORIAL_TARGETS[key],u=a.state.units.find(u=>u.uid===t.uid);assert.equal(Rules.placement(a.state,u,t.x,t.z).ok,true);}
 assert.deepEqual(tutorialEncounter(a.state),tutorialEncounter(b.state));assert.equal(tutorialEncounter(a.state).total,6);
 a.state.terrain.cells[0].h=3;a.session.step='done';assert.equal(b.state.terrain.cells[0].h,0);assert.equal(b.session.step,'intro');
});

test('tutorial waits for real deployment and paid terrain changes; wrong actions and cancelled drafts are recoverable',()=>{
 const {state,session}=createTutorialSession(),initial=Run.cloneState(state);
 assert.equal(tutorialActionAllowed(session,state,'start').ok,false);assert.equal(advanceTutorial(session,state),false);
 advanceTutorial(session,state,{},'next');assert.equal(session.step,'deploy-melee');
 const target=TUTORIAL_TARGETS.melee,u=state.units[0];
 assert.equal(tutorialActionAllowed(session,state,'cell',{cell:{x:target.x+1,z:target.z},unit:u}).ok,false);
 assert.equal(tutorialActionAllowed(session,state,'select-unit',{uid:'u2'}).ok,false);assert.deepEqual(state,initial);
 assert.equal(place(state,'melee').ok,true);advanceTutorial(session,state);assert.equal(session.step,'deploy-ranged');
 place(state,'ranged');advanceTutorial(session,state);assert.equal(session.step,'terrain');
 const command={...TUTORIAL_TARGETS.terrain,tool:'raise',brush:'single'},before=Run.cloneState(state),draft=Rules.previewTerrainBatch(state,[command]);assert.equal(draft.ok,true);
 advanceTutorial(session,state,{terrainBatch:draft});assert.equal(session.step,'terrain');assert.deepEqual(state,before);
 advanceTutorial(session,state,{terrainBatch:null});assert.equal(session.step,'terrain');assert.deepEqual(state,before);
 assert.equal(Rules.applyTerrainBatch(state,[command]).ok,true);assert.equal(state.focus,before.focus-5);
 advanceTutorial(session,state);assert.equal(session.step,'start');assert.equal(tutorialActionAllowed(session,state,'undo').ok,false);
});

test('the short tutorial wins through the real battle, offers one reward, then completes a real camp transaction',()=>{
 const {state,session}=ready();assert.equal(startTutorialBattle(state).ok,true);advanceTutorial(session,state);assert.equal(session.step,'battle');
 advanceTutorial(session,state,{paused:true},'pause');advanceTutorial(session,state,{speed:2},'speed');assert.equal(session.hasPaused,true);assert.equal(session.hasChangedSpeed,true);
 for(let ticks=0;ticks<1200&&!state.battle.result;ticks++)stepBattle(state,.05);
 assert.equal(state.battle.result,'won');assert.equal(state.stats.kills,6);assert.ok(state.battle.time<60);
 assert.equal(Run.finishBattle(state,{won:true}).ok,true);advanceTutorial(session,state);assert.equal(session.step,'reward');
 assert.equal(state.rewardQueue.length,1);assert.equal(state.rewardQueue[0].kind,'unit');assert.equal(state.rewardQueue[0].options.length,3);
 assert.equal(Run.chooseReward(state,state.rewardQueue[0].options[0]).ok,true);advanceTutorial(session,state);assert.equal(session.step,'route');
 assert.equal(tutorialActionAllowed(session,state,'map-node',{id:'unknown'}).ok,false);
 assert.equal(Run.enterNode(state,TUTORIAL_TARGETS.campId).ok,true);advanceTutorial(session,state);assert.equal(session.step,'camp');
 const injured=state.spirit;assert.ok(injured<state.maxSpirit);
 assert.equal(Run.nodeAction(state,'cancel').ok,true);advanceTutorial(session,state);assert.equal(session.step,'camp');
 assert.equal(Run.nodeAction(state,'heal').ok,true);advanceTutorial(session,state);assert.equal(session.step,'done');
 assert.equal(state.spirit,state.maxSpirit);assert.equal(state.stats.completedNodes,2);assert.equal(currentTutorialStep(session,state).complete,true);
 assert.match(renderTutorialGuide(session,state),/data-tutorial-action="finish"/);
});

test('a failed tutorial exposes restart and a new attempt restores its fixed starting state',()=>{
 const data=ready();data.state.spirit=0;data.state.phase='lost';advanceTutorial(data.session,data.state);
 assert.equal(data.session.step,'failed');assert.equal(currentTutorialStep(data.session,data.state).failed,true);
 assert.match(renderTutorialGuide(data.session,data.state),/data-tutorial-action="restart"/);
 const restarted=createTutorialSession();assert.equal(restarted.session.step,'intro');assert.equal(restarted.state.spirit,72);
 assert.equal(restarted.state.units.every(u=>u.x===null&&u.z===null),true);assert.equal(Rules.cellAt(restarted.state,18,24).h,0);
});
