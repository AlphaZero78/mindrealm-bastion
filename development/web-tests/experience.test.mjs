import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../../web/core/rules.js';
import * as Run from '../../web/core/state.js';
import * as Saves from '../../web/core/save.js';
import {towers} from '../../web/core/content.js';
import {unitEffectText} from '../../web/core/unit-details.js';
import {mapScreen,nodeScreen,upgradeComparison} from '../../web/screens.js';
import {fixture,place,battle,tick} from './helpers/battle-fixture.mjs';

test('rotated multi-cell placement is atomic, tests every cell, center, cost and cancel',()=>{
 const s=fixture(),u=Run.addUnit(s,'focus_rail');s.focus=1000;
 for(const c of s.terrain.cells)c.h=c.protected?0:1;
 const before=structuredClone(s),trial={...u,rotation:1};
 assert.deepEqual(R.unitFootprint(trial),[2,3]);assert.equal(R.footprint(s,trial,39,3).length,6);
 assert.equal(R.placement(s,u,39,3).ok,false);assert.equal(R.placement(s,trial,39,3).ok,true);
 assert.deepEqual(s,before,'preview and cancel preserve orientation, position and resources');
 assert.equal(R.deploy(s,u.uid,39,3,1).ok,true);assert.deepEqual(R.unitCenter(u),{x:39.5,z:4});assert.equal(u.rotation,1);
 const placed=structuredClone(s);assert.equal(R.deploy(s,u.uid,39,3,0).ok,false);assert.deepEqual(s,placed);
 assert.equal(R.deploy(s,u.uid,39,3,NaN).ok,false);assert.deepEqual(s,placed);
 const v=Run.addUnit(s,'pulse_array');assert.match(R.placement(s,v,39,5).reason,/占用/,'last rotated row is occupied');
 s.phase='battle';assert.equal(R.deploy(s,u.uid,4,4,2).ok,false);
});

test('rotation survives the save format and legacy unrotated units remain readable',()=>{
 const s=Run.newRun('rotation-save');Run.enterNode(s,Run.availableNodes(s)[0].id);const u=s.units.find(u=>u.type==='focus_rail');
 for(const c of s.terrain.cells)c.h=c.protected?0:1;
 assert.equal(R.deploy(s,u.uid,39,3,1).ok,true);
 const values=new Map(),store=Saves.createSaveStore({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},'isolated-rotation');
 assert.equal(store.save(s).ok,true);const loaded=store.load();assert.equal(loaded.ok,true);assert.equal(loaded.state.units.find(x=>x.uid===u.uid).rotation,1);
 const legacy=Run.newRun('legacy');assert.equal(store.save(legacy).ok,true);assert.equal(store.load().ok,true);
});

test('terrain drafts are isolated; one commit, one undo, cumulative tiers, and late failures are atomic',()=>{
 const s=fixture(),before=structuredClone(s),commands=Array.from({length:21},(_,i)=>({tool:'raise',x:2+i%7,z:2+Math.floor(i/7)}));
 const draft=R.previewTerrainBatch(s,commands);assert.equal(draft.ok,true);assert.equal(draft.cost,43);assert.equal(draft.count,21);assert.deepEqual(s,before);
 assert.equal(R.applyTerrainBatch(s,commands).ok,true);assert.equal(s.focus,56);assert.equal(s.terrainEdits,21);assert.equal(s.terrainUndo.length,1);assert.equal(R.terrainCost(s,1),3);
 assert.equal(R.undoTerrain(s).ok,true);assert.equal(s.focus,99);assert.equal(s.terrainEdits,0);assert.deepEqual(s.terrain.cells,before.terrain.cells);
 const partial=fixture();for(const c of commands)assert.equal(R.applyTerrain(partial,c).ok,true);assert.equal(partial.focus,56,'separate confirmations cannot avoid tiers');
 const protectedCommand={tool:'raise',x:20,z:24},now=structuredClone(s);assert.equal(R.applyTerrainBatch(s,[...commands,protectedCommand]).ok,false);assert.deepEqual(s,now);
 s.focus=42;const poor=structuredClone(s);assert.equal(R.applyTerrainBatch(s,commands).ok,false);assert.deepEqual(s,poor);
 s.phase='battle';assert.equal(R.applyTerrainBatch(s,commands).ok,false);assert.equal(R.applyTerrainBatch(s,[]).ok,false);
});

test('terrain price crosses a tier inside a brush; discounts and cancellation use exact costs',()=>{
 const s=fixture();s.focus=999;s.terrainEdits=19;const command={tool:'raise',x:5,z:5,brush:'square'};
 assert.equal(R.previewTerrain(s,command).cost,26);const before=structuredClone(s);R.previewTerrainBatch(s,[command]);assert.deepEqual(s,before);
 R.applyTerrainBatch(s,[command]);assert.equal(s.terrainEdits,28);R.undoTerrain(s);assert.equal(s.terrainEdits,19);assert.equal(s.focus,999);
});

test('support uses the same center distance for coverage and actual repair, includes rotated targets',()=>{
 const s=fixture(),repair=place(s,'memory_mechanic',8,8),near=place(s,'boundary_riveter',11,8),far=place(s,'anchor_bulwark',30,8);near.rotation=1;near.hp-=30;far.hp-=30;
 const c=R.supportCoverage(s,repair);assert.equal(c.active,true);assert.ok(c.affected.some(u=>u.uid===near.uid));assert.ok(!c.affected.some(u=>u.uid===far.uid));
 const old=near.hp,farHp=far.hp;battle(s);tick(s,.1);assert.ok(near.hp>old);assert.equal(far.hp,farHp);
 repair.hp=0;assert.deepEqual(R.supportCoverage(s,repair).affected,[]);
 repair.hp=R.unitStats(s,repair).maxHp;s.bandwidth=0;assert.equal(R.supportCoverage(s,repair).active,false);
});

test('workshop lists deployed units first and current/next effects have no unrelated level multipliers',()=>{
 const s=fixture(),stored=Run.addUnit(s,'pulse_array'),deployed=place(s,'boundary_riveter',4,4);s.phase='node';s.currentNode={type:'workshop',risk:''};
 const html=nodeScreen(s);assert.ok(html.indexOf(`data-unit="${deployed.uid}"`)<html.indexOf(`data-unit="${stored.uid}"`));assert.match(html,/is-deployed/);
 for(const type of Object.keys(towers))for(const branch of ['A','B'])for(const tier of [1,2]){
  const u={type,tier,branch:tier===1?null:branch,hp:1,x:null,z:null};const text=unitEffectText(s,u),comparison=upgradeComparison(s,u,branch);
  assert.ok(text.length>15);assert.doesNotMatch(text,/T2.*T3|倍率/);assert.match(comparison,/当前/);assert.match(comparison,/下一级/);assert.match(comparison,/<table>/);
 }
 const map=mapScreen(Run.newRun('route-ui'));assert.doesNotMatch(map,/id="node-detail"/);assert.match(map,/role="tooltip"/);assert.match(map,/aria-describedby="route-tooltip"/);
});
