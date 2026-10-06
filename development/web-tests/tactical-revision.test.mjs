import test from 'node:test';
import assert from 'node:assert/strict';
import * as Run from '../../game/web/core/state.js';
import * as R from '../../game/web/core/rules.js';
import {startBattle,stepBattle,makeEncounter} from '../../game/web/core/battle.js';
import {towers,enemies,legacyEvents as events,messengers,nexusRelics} from '../../game/web/core/content.js';
import {eventChoice} from '../../game/web/core/event-balance.js';
import {actEnemies,frontlineByAct} from '../../game/web/core/enemy-expansion.js';
import {enemyStats,enemyAbilityProfile,xpRequirement,difficultySummary} from '../../game/web/core/difficulty.js';
import {unitEffectLines,unitEffectText} from '../../game/web/core/unit-details.js';
import {inventoryStatus,discardUnits,addItem} from '../../game/web/core/inventory.js';
import {inventoryBody} from '../../game/web/inventory-view.js';
import {upgradeComparison,enemyDetails,header,actTransitionScreen} from '../../game/web/screens.js';
import {createSaveStore} from '../../game/web/core/save.js';
import {fixture,place,battle,tick} from './helpers/battle-fixture.mjs';

const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const inert=(s,action)=>{const before=Run.cloneState(s);assert.equal(action().ok,false);assert.deepEqual(s,before);};
const store=()=>{const data=new Map();return createSaveStore({getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},'tactical.isolated');};
const pin=(e,x,z,extra={})=>Object.assign(e,{x,z,h:0,speed:0,attack:0,cooldown:1e6,abilityClock:1e6,hp:10000,maxHp:10000,...extra});
const enterEvent=(id,revision=4)=>{const s=Run.newRun(`event-r4:${id}`);s.difficultyRevision=revision;s.nexus.forEach(room=>room.skipped=true);s.phase='map';s.act=events[id].act-1;s.maxSpirit=250;s.spirit=240;s.focus=1000;s.bandwidth=100;s.resistance=20;s.depth=6;addItem(s,'clarity');const node=s.maps[s.act].nodes.find(n=>n.floor===1);Object.assign(node,{type:'event',event:id});s.nextNodes=[node.id];assert.equal(Run.enterNode(s,node.id).ok,true);return s;};

test('deployed and destroyed constructs occupy bag slots; confirmation removes complete selections atomically',()=>{
 const s=fixture('bag-r4',{revision:4}),deployed=place(s,'anchor_bulwark',10,10),wreck=place(s,'resonance_guard',14,10,{hp:0});Run.addUnit(s,'pulse_array');
 const bag=inventoryStatus(s);assert.equal(bag.used,3);assert.equal(bag.deployed.length,2);assert.equal(bag.stored.length,1);
 const html=inventoryBody(s);for(const u of s.units)assert.ok(html.includes(`data-discard-uid="${u.uid}"`));assert.match(html,/已部署 2 个/);assert.match(html,/损毁/);
 for(const selection of [[],null,'u1',[deployed.uid,'missing'],[1]])inert(s,()=>discardUnits(s,selection));
 const before=Run.cloneState(s);inventoryBody(s);assert.deepEqual(s,before);
 assert.equal(discardUnits(s,[deployed.uid,wreck.uid]).ok,true);assert.equal(inventoryStatus(s).used,1);assert.equal(R.bandwidthState(s).used,0);
 s.phase='battle';inert(s,()=>discardUnits(s,[s.units[0].uid]));
});

test('new depth growth grants three bandwidth at every milestone while existing revisions retain one',()=>{
 for(const revision of [1,2,3,4]){const s=Run.newRun(`bandwidth-${revision}`);s.difficultyRevision=revision;let bandwidth=20;while(s.depth<12){assert.equal(Run.addXP(s,xpRequirement(s)),1);bandwidth+=revision>=4?3:1;assert.equal(s.bandwidth,bandwidth);}Run.addXP(s,100000);assert.equal(s.bandwidth,bandwidth);}
 const s=Run.newRun('bandwidth-gift');s.relics.push('nexus_study_credit');Run.addXP(s,xpRequirement(s));assert.equal(s.bandwidth,24);
});

test('resonance shield and attack have separate radii, exact coverage, disabled state and actual damage reduction',()=>{
 for(const branch of [null,'A','B']){
  const s=fixture(`guard-${branch}`,{revision:4}),guard=place(s,'resonance_guard',10,10,{tier:branch?2:1,branch}),radius=branch==='A'?6:3,ally=place(s,'anchor_bulwark',10+radius,10);
  const aura=R.unitAuras(s,guard).find(a=>a.id==='guard');assert.equal(aura.radius,radius);assert.ok(radius>R.unitStats(s,guard).range);assert.ok(R.auraCoverage(s,guard,aura).affected.includes(ally));assert.equal(R.auraCovers(s,guard,guard,aura),false);
  ally.x+=.001;assert.equal(R.auraCovers(s,guard,ally,aura),false);ally.x-=.001;
  const [enemy]=battle(s);pin(enemy,ally.x+.5,ally.z+1.5,{attack:70,cooldown:0});for(const u of s.units)u.cooldown=1e6;
  const expected=R.incomingDamage(s,ally,enemy,70)*.82,before=ally.hp;stepBattle(s,.05);close(before-ally.hp,expected);
  guard.hp=0;assert.equal(R.auraCoverage(s,guard,aura).active,false);assert.deepEqual(R.auraCoverage(s,guard,aura).affected,[]);
 }
 const s=fixture('global-aura',{revision:4}),relay=place(s,'bandwidth_relay',4,4);assert.equal(R.unitAuras(s,relay)[0].radius,null);assert.equal(R.unitAuras(s,relay)[0].target,'global');
});

test('all upgrade clauses show cumulative totals and only altered clauses receive emphasis',()=>{
 const s=fixture('upgrade-text',{revision:4});
 for(const type of Object.keys(towers))for(const tier of [1,2])for(const branch of ['A','B']){
  const u={type,tier,branch:tier===1?null:branch,x:null,z:null,hp:1},next={...u,tier:tier+1,branch},before=unitEffectLines(s,u),after=unitEffectLines(s,next),html=upgradeComparison(s,u,branch);
  const highlighted=[...html.matchAll(/class="effect-changed" data-effect="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(highlighted,after.filter(part=>!before.some(old=>old.id===part.id&&old.text===part.text)).map(part=>part.id));
  assert.doesNotMatch(unitEffectText(s,next),/额外提高|T1为|更强/);
 }
 assert.match(unitEffectText(s,{type:'frequency_choir',tier:1,hp:1}),/攻速 \+12%，攻击力 \+6%/);
 assert.match(unitEffectText(s,{type:'frequency_choir',tier:2,branch:'A',hp:1}),/攻速 \+24%，攻击力 \+12%/);
 assert.match(unitEffectText(s,{type:'frequency_choir',tier:3,branch:'A',hp:1}),/攻速 \+36%，攻击力 \+18%/);
});

test('enemy behavior is expanded, pressure zero has no effect rows and XP is beside depth',()=>{
 const s=Run.newRun('information-r4');
 for(const enemy of Object.values(enemies)){const html=enemyDetails(s,enemy);assert.match(html,/class="enemy-behavior"/);assert.doesNotMatch(html,/<summary>行为|data-difficulty-summary/);}
 assert.deepEqual(difficultySummary(0),[]);for(let i=1;i<=10;i++)assert.ok(difficultySummary(i).length>0);
 const html=header(s);assert.match(html,/resource depth[\s\S]*精神深度[\s\S]*hud-xp-bar/);assert.doesNotMatch(html,/class="xp-strip"/);
 s.depth=12;assert.match(header(s),/id="hud-xp-bar" value="1" max="1"/);
});

test('event recovery displays the whole integer amount at full or nearly full stability and applies a cap',()=>{
 let count=0;
 for(const event of Object.values(events))for(let index=0;index<event.choices.length;index++)if(eventChoice({difficultyRevision:4},event,index).effects.spirit>0){
  for(const missing of [0,.6]){const s=enterEvent(event.id);s.spirit=s.maxSpirit-missing;const p=Run.eventPreview(s,index),amount=p.effects.spirit,initial=Run.cloneState(s);assert.ok(Number.isInteger(amount));assert.ok(p.details.includes(`精神 +${amount}`));assert.deepEqual(s,initial);assert.equal(Run.nodeAction(s,'event',{index}).ok,true);assert.ok(s.spirit<=s.maxSpirit);if(!p.effects.max_spirit)assert.equal(s.spirit,s.maxSpirit);}
  count++;
 }
 assert.equal(count,11);
});

test('all 84 modern event exchanges amplify declared risks and rewards and remain atomic across save/reload',()=>{
 let count=0,riskCount=0;
 for(const event of Object.values(events))for(let index=0;index<event.choices.length;index++){
  const modern=enterEvent(event.id),old=enterEvent(event.id,3),a=Run.eventPreview(modern,index),b=Run.eventPreview(old,index);
  assert.deepEqual(eventChoice(old,event,index).effects,event.choices[index].effects);
  for(const key of ['focus','spirit','bandwidth','resistance','xp'])if(b.effects[key]){if(b.effects[key]<0){assert.ok(a.effects[key]<=b.effects[key],`${event.id}/${key}`);riskCount++;}else assert.ok(a.effects[key]>=b.effects[key],`${event.id}/${key}`);}
  assert.equal(a.canChoose,true,`${event.id}/${index}`);const original=Run.cloneState(modern);assert.equal(Run.nodeAction(modern,'cancel').ok,true);assert.deepEqual(modern,original);
  assert.equal(Run.nodeAction(modern,'event',{index}).ok,true);const saved=store();assert.equal(saved.save(modern).ok,true,`${event.id}/${index}`);const restored=saved.load().state;assert.deepEqual(restored.currentNode.eventData,modern.currentNode.eventData);inert(restored,()=>Run.nodeAction(restored,'event',{index}));assert.equal(Run.nodeAction(restored,'event-continue').ok,true);count++;
 }
 assert.equal(count,84);assert.equal(riskCount,17);
});

test('each messenger samples three out of six; offers are seeded, varied, unique and saved before choice',()=>{
 const seen=Object.fromEntries(Object.values(messengers).map(m=>[m.id,{offers:new Set(),gifts:new Set()}]));
 for(const m of Object.values(messengers)){assert.equal(m.gifts.length,6);assert.equal(new Set(m.gifts.map(g=>g.id)).size,6);}
 for(let i=0;i<300;i++){
  const s=Run.newRun(`six-gifts-${i}`);assert.deepEqual(s.nexus,Run.newRun(`six-gifts-${i}`).nexus);
  for(const room of s.nexus){assert.equal(room.options.length,3);assert.equal(new Set(room.options).size,3);assert.ok(room.options.every(id=>nexusRelics[id].messenger===room.messenger));seen[room.messenger].offers.add([...room.options].sort().join(','));room.options.forEach(id=>seen[room.messenger].gifts.add(id));}
  if(i<10){const save=store();assert.equal(save.save(s).ok,true);assert.deepEqual(save.load().state.nexus,s.nexus);}
 }
 for(const [id,entry]of Object.entries(seen)){assert.equal(entry.gifts.size,6,id);assert.ok(entry.offers.size>=10,`${id}: ${entry.offers.size} combinations`);}
});

test('rectangular terrain selections preview whole costs, cancel freely, fail atomically and undo as one action',()=>{
 const s=fixture('terrain-box',{revision:4});s.focus=1000;
 const command={tool:'raise',brush:'box',x:12,z:12,x2:5,z2:5},before=Run.cloneState(s),preview=R.previewTerrain(s,command);
 assert.equal(preview.ok,true);assert.equal(preview.cells.length,64);assert.equal(preview.selectionCells.length,64);assert.equal(preview.cost,200);assert.equal(preview.paths.length,3);assert.deepEqual(s,before);
 assert.equal(R.applyTerrainBatch(s,[command]).ok,true);assert.equal(s.focus,800);assert.equal(s.terrainUndo.length,1);assert.equal(s.terrainEdits,64);assert.ok(preview.barriers.length>0);assert.equal(R.undoTerrain(s).ok,true);assert.equal(s.focus,1000);assert.deepEqual(s.terrain.cells,before.terrain.cells);
 for(const invalid of [{...command,x2:41},{...command,x2:5.5},{...command,x:18,z:36,x2:22,z2:40},{...command,x:2,z:2,x2:1e9}])inert(s,()=>R.applyTerrainBatch(s,[invalid]));
 place(s,'phase_blade',7,7);inert(s,()=>R.applyTerrainBatch(s,[command]));s.units=[];s.focus=199;inert(s,()=>R.applyTerrainBatch(s,[command]));s.focus=1000;s.phase='battle';inert(s,()=>R.applyTerrainBatch(s,[command]));
});

test('act-exclusive formations contain all nine new types, distinct air threats and stronger later opponents',()=>{
 const seen=new Set();let previousAverage=0;
 for(let act=0;act<3;act++){
  const normal=Object.values(enemies).filter(e=>e.act===act+1&&e.kind==='normal'),s=Run.newRun(`act-roster-${act}`);s.act=act;s.floor=8;
  const avg=normal.reduce((sum,e)=>sum+enemyStats(s,e).maxHp,0)/normal.length;assert.ok(avg>previousAverage*1.3);previousAverage=avg;
  assert.ok(normal.some(e=>e.air));assert.equal(frontlineByAct[act].length,3);
  for(let seed=0;seed<30;seed++)for(const type of ['battle','elite']){s.seed=`roster-${seed}`;const encounter=makeEncounter(s,{id:`${act}:${seed}`,type});assert.deepEqual(encounter,makeEncounter(Run.cloneState(s),{id:`${act}:${seed}`,type}));for(const q of encounter.queue){assert.equal(enemies[q.type].act,act+1);seen.add(q.type);}for(const entry of encounter.entries){assert.equal(entry.groundCount+entry.airCount,entry.count);assert.equal(entry.airCount,encounter.queue.filter(q=>q.entry===entry.id&&enemies[q.type].air).length);}}
 }
 for(const e of actEnemies)assert.ok(seen.has(e.id),e.id);
 const s=Run.newRun('ability-r4');assert.equal(enemyAbilityProfile(s,enemies.repair_skiff).healFraction,.11);assert.equal(enemyAbilityProfile(s,enemies.archive_warden).shieldFraction,.18);assert.equal(enemyAbilityProfile(s,enemies.null_wing).jamDuration,4);assert.equal(enemyAbilityProfile(s,enemies.null_wing).jamStrength,3);
 s.difficultyRevision=3;s.act=2;assert.ok(makeEncounter(s).queue.every(q=>!actEnemies.some(e=>e.id===q.type)),'legacy queues retain the original catalog');
});

test('tracking drones launch without instant damage, follow motion, retarget, mark, and stop with a disabled source',()=>{
 for(const branch of ['A','B']){
  const s=fixture(`tracking-${branch}`,{revision:4}),u=place(s,'drone_loom',10,10,{tier:2,branch,h:1}),[first,second]=battle(s,['floating_noise','static_drifter']);pin(first,17,10);pin(second,16,14);u.cooldown=0;
  const old=[first.hp,second.hp];const result=stepBattle(s,.05);assert.equal(first.hp,old[0]);assert.equal(second.hp,old[1]);assert.equal(s.battle.drones.length,branch==='A'?2:1);assert.ok(result.events.some(e=>e.stage==='launch'&&e.actionKind==='drone'));
  const drone=s.battle.drones[0],initialFacing=drone.facing;const target=s.battle.enemies.find(e=>e.id===drone.target);target.z+=2;u.cooldown=10000;stepBattle(s,.05);assert.notEqual(drone.facing,initialFacing);
  const before=Run.cloneState(s);stepBattle(s,0);assert.deepEqual(s,before,'paused simulation does not move a drone');
  tick(s,1);assert.ok(first.hp<old[0]||second.hp<old[1]);if(branch==='B')assert.ok(first.marked>0||second.marked>0);
  u.cooldown=0;stepBattle(s,.05);const tracking=s.battle.drones[0];assert.ok(tracking);s.battle.enemies.find(e=>e.id===tracking.target).dead=true;const survivor=s.battle.enemies.find(e=>!e.dead);stepBattle(s,.05);assert.ok(!s.battle.drones.length||s.battle.drones.every(d=>d.target===survivor.id));
  const hp=survivor.hp;s.bandwidth=0;stepBattle(s,.05);assert.equal(s.battle.drones.length,0);assert.equal(survivor.hp,hp);
 }
});

test('new flying interference leaves the existing boss phase strengths at six, eight and ten',()=>{
 const s=fixture('jam-spec-versus-live',{revision:4}),[boss,wing]=battle(s,['bandwidth_requisitioner','null_wing']);pin(boss,10,10);pin(wing,20,10);
 for(const [phase,ratio,strength]of [[0,1,6],[1,.6,8],[2,.3,10]]){boss.hp=boss.maxHp*ratio;boss.abilityClock=0;wing.abilityClock=0;stepBattle(s,.01);assert.equal(boss.phase,phase);assert.equal(boss.jamStrength,strength);assert.equal(wing.jamStrength,3);}
 assert.match(enemyDetails(s,enemies.bandwidth_requisitioner),/6 \/ 8 \/ 10 带宽/);
});

test('boss death keeps survivors and future arrivals active, and later lethal damage still defeats the run',()=>{
 for(const lethal of [false,true]){
  const s=fixture(`boss-clear-${lethal}`,{revision:4}),u=place(s,'pulse_array',10,10,{tier:3,branch:'A',h:1}),[boss,survivor]=battle(s,['noise_hive','static_drifter']);pin(boss,12,10,{hp:1,maxHp:1000});pin(survivor,0,0);u.cooldown=0;
  s.battle.queue.push({type:'spike_runner',entry:'north',at:s.battle.time+1,group:0});
  stepBattle(s,.05);assert.equal(s.battle.bossKilled,true);assert.equal(s.battle.result,null);assert.ok(s.battle.enemies.some(e=>e.id===survivor.id));inert(s,()=>Run.finishBattle(s,{won:true}));
  if(lethal){const core=R.coreOf(s);pin(survivor,core.x,core.z,{attack:20,core_damage:10000,cooldown:0});stepBattle(s,.05);assert.equal(s.battle.result,'lost');assert.equal(Run.finishBattle(s,{won:false}).ok,true);assert.ok(Run.getSummary(s).bosses.includes('noise_hive'));assert.ok(s.discoveries.archives.includes('noise_hive'));}
  else{survivor.dead=true;stepBattle(s,.05);assert.equal(s.battle.result,null);tick(s,1.1);assert.equal(s.battle.spawned,s.battle.queue.length);assert.equal(s.battle.result,null);const remaining=s.battle.enemies[0];pin(remaining,12,10,{hp:1});u.cooldown=0;stepBattle(s,.05);assert.equal(s.battle.result,'won');}
 }
});

test('a healing boss telegraphs a finite push after six attacks, crosses a blocker and resists root only during that push',()=>{
 const s=fixture('healing-stalemate',{revision:4}),wall=place(s,'anchor_bulwark',10,10,{hp:100000}),[boss]=battle(s,['memory_reforger']);wall.cooldown=100000;pin(boss,10,9,{speed:1.3,attack:20,cooldown:0,abilityClock:1,pathRevision:-1});
 let attacks=0,warning=null;
 for(let i=0;i<250&&!warning;i++){const result=stepBattle(s,.05);attacks+=result.events.filter(e=>e.type==='hit'&&e.enemy===boss.id).length;warning=result.events.find(e=>e.actionKind==='push-windup');}
 assert.equal(attacks,6);assert.ok(warning);assert.equal(warning.duration,1.1);const from={x:boss.x,z:boss.z};boss.root=100;
 for(let i=0;i<20;i++)stepBattle(s,.05);assert.equal(boss.x,from.x);assert.equal(boss.z,from.z);
 let released=false;for(let i=0;i<6;i++)released ||= stepBattle(s,.05).events.some(e=>e.actionKind==='push-release');assert.equal(released,true);
 for(let i=0;i<40;i++)stepBattle(s,.05);assert.ok(Math.hypot(boss.x-from.x,boss.z-from.z)>2,'frontline repair cannot hold the boss forever');
 while(s.battle.time<boss.pushUntil+.1)stepBattle(s,.05);const stopped={x:boss.x,z:boss.z};for(let i=0;i<10;i++)stepBattle(s,.05);assert.equal(boss.x,stopped.x);assert.equal(boss.z,stopped.z,'root resumes after the advertised advance window');
 assert.match(enemyDetails(null,enemies.memory_reforger),/攻击构造 6 次后/);assert.match(enemyDetails(s,enemies.memory_reforger),/预警 1.1 秒/);assert.doesNotMatch(enemyDetails({...s,difficultyRevision:3},enemies.memory_reforger),/破阵/);
});

test('chapter transitions wait for rewards and a manual command, persist through reload, and reject repeated entry',()=>{
 const s=Run.newRun('chapter-r4');Run.chooseNexus(s,s.nexus[0].options[0]);const boss=s.maps[0].nodes.find(n=>n.type==='boss');s.nextNodes=[boss.id];Run.enterNode(s,boss.id);Run.finishBattle(s,{won:true});
 assert.equal(s.phase,'reward');inert(s,()=>Run.continueAct(s));while(s.phase==='reward')Run.chooseReward(s,s.rewardQueue[0].kind==='item'?'skip':s.rewardQueue[0].options[0]);
 assert.equal(s.phase,'interlude');assert.equal(s.act,0);assert.deepEqual(Run.availableNodes(s),[]);const initial=Run.cloneState(s),html=actTransitionScreen(s);assert.match(html,/data-action="act-continue"/);assert.match(html,/幕间转场/);assert.deepEqual(s,initial);
 const save=store();assert.equal(save.save(s).ok,true);const restored=save.load().state;assert.equal(restored.phase,'interlude');assert.deepEqual(restored.units,s.units);assert.equal(Run.continueAct(restored).ok,true);assert.equal(restored.phase,'nexus');assert.equal(restored.currentNode,null);assert.equal(restored.floor,-1);assert.equal(restored.act,1);inert(restored,()=>Run.continueAct(restored));
 const corrupt=Run.cloneState(s);corrupt.nextAct=2;assert.equal(save.save(corrupt).ok,false);
 for(let i=s.units.length;i<=s.inventory.capacity;i++)Run.addUnit(s,'pulse_array');inert(s,()=>Run.continueAct(s));assert.equal(discardUnits(s,[s.units.at(-1).uid]).ok,true);assert.equal(Run.continueAct(s).ok,true);
});
