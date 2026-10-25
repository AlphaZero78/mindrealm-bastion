import test from 'node:test';
import assert from 'node:assert/strict';
import {enemies} from '../../game/web/core/content.js';
import {newRun} from '../../game/web/core/state.js';
import {enemyBrief,encounterEntries,encounterSidebar} from '../../game/web/encounter-view.js';

test('entrance intelligence counts each scheduled enemy at its own entrance across old entry shapes',()=>{
 const state=newRun('entrance-view'),plan={entries:{north:{id:'north',name:'北入口'},west:{id:'west',name:'西入口'}},queue:[
  {type:'static_drifter',entry:'north',at:2},{type:'static_drifter',entry:{id:'north'},at:5},
  {type:'static_drifter',entry:'west',at:7},{type:'floating_noise',entry:'west',at:3},
  {type:'siege_ram',entry:'east',at:9}
 ]};
 const groups=encounterEntries(state,plan);
 assert.deepEqual(groups.map(g=>[g.id,g.total,g.firstAt]),[['north',2,2],['west',2,3],['east',1,9]]);
 assert.deepEqual(groups[0].enemies.map(e=>[e.type,e.count]),[['static_drifter',2]]);
 assert.deepEqual(groups[1].enemies.map(e=>[e.type,e.count]),[['static_drifter',1],['floating_noise',1]]);
 assert.deepEqual(encounterEntries(state,{...plan,entries:['north','west']}),groups);
 assert.equal(groups.reduce((sum,g)=>sum+g.total,0),plan.queue.length);
});

test('every enemy has a model portrait, a short factual trait and independent movement and siege labels',()=>{
 const state=newRun('all-enemy-intelligence'),specs=Object.values(enemies);
 for(const spec of specs){const brief=enemyBrief(spec);assert.equal(brief.movementLabel,spec.air?'飞行':'陆地');assert.equal(brief.siege,spec.ability==='siege');assert.ok(brief.feature.length>0&&brief.feature.length<=24,spec.id);}
 const html=encounterSidebar(state,{entries:['north'],queue:specs.map((spec,i)=>({type:spec.id,entry:'north',at:i})),total:specs.length},true);
 assert.equal((html.match(/class="entry-enemy"/g)||[]).length,specs.length);
 assert.equal((html.match(/<image href=/g)||[]).length,specs.length);
 for(const spec of specs)assert.ok(html.includes(`data-id="${spec.id}"`),spec.id);
 assert.equal((html.match(/class="enemy-trait siege"/g)||[]).length,specs.filter(e=>e.ability==='siege').length);
 assert.doesNotMatch(html,/金色点线|群连续到达|群间不开放部署|undefined|NaN/);
});

test('explicit collapse labels and empty plans work while boss clearance remains an actionable alert',()=>{
 const state=newRun('empty-intelligence'),plan={entries:[],queue:[],total:0,spawned:0,enemies:[]};
 const closed=encounterSidebar(state,plan,false);
 assert.match(closed,/<details class="threat-panel enemy-intel" >/);assert.match(closed,/threat-open-label">收起/);assert.match(closed,/threat-closed-label">展开/);
 assert.match(closed,/本场暂无计划敌人/);assert.match(closed,/id="hud-wave"[^>]*hidden/);
 state.phase='battle';const alive=encounterSidebar(state,{...plan,bossKilled:true},true);
 assert.match(alive,/首领已击败 · 清理余敌/);assert.doesNotMatch(alive,/id="hud-wave"[^>]*hidden/);
});
