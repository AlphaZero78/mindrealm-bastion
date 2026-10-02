import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {makeEncounter,startBattle,stepBattle} from '../../web/core/battle.js';
import {unitStats,unitCenter,cellAt,solveAttack,bandwidthState,pathToCore,repairCost,moveCost,incomingDamage} from '../../web/core/rules.js';
import {addUnit,newRun,enterNode,availableNodes,finishBattle,cloneState} from '../../web/core/state.js';
import {enemies,towers} from '../../web/core/content.js';
import {fixture,place,battle,tick} from './helpers/battle-fixture.mjs';

const pin=(enemy,x,z,{hp=10000,...rest}={})=>Object.assign(enemy,{x,z,h:0,speed:0,hp,maxHp:hp,attack:0,cooldown:10000,abilityClock:10000,...rest});
const oneShot=(type,{branch=null,tier=1,enemy='static_drifter',mods={}}={})=>{
  const s=fixture();Object.assign(s,mods);const u=place(s,type,10,10,{tier,branch,h:towers[type].role==='ranged'?1:0});const [e]=battle(s,[enemy]);pin(e,12.4,10.5);u.cooldown=0;return {s,u,e};
};

test('encounters use 3/4/5 distinct groups, deterministic sequence, entry unlocks, one elite/boss and a shared ten percent budget',()=>{
  for(let act=0;act<3;act++)for(const [type,groups]of [['battle',3],['elite',4],['boss',5]])for(const floor of [0,4,10]){
    const s=newRun(`encounters-${act}-${floor}`);s.act=act;s.floor=floor;s.currentNode={id:`test-${act}-${floor}`,type,boss:s.maps[act].boss};
    const encounter=makeEncounter(s);assert.deepEqual(encounter,makeEncounter(cloneState(s)));assert.equal(encounter.groups.length,groups);assert.equal(encounter.total,encounter.queue.length);assert.equal(encounter.reinforcementBudget,Math.floor(encounter.total*.1));
    const ordinary=encounter.queue.filter(q=>enemies[q.type].kind==='normal');assert.ok(ordinary.filter(q=>!['none','sprint'].includes(enemies[q.type].ability)).length>=Math.floor(ordinary.length/4));
    assert.equal(encounter.entries.length,act===2?4:act===1?(floor>=4?4:3):floor>=10?3:floor>=4?2:1);
    for(let i=1;i<groups;i++){const last=encounter.queue.filter(q=>q.group===i-1).at(-1);assert.ok(encounter.groups[i].at-last.at>=4);}
    const strong=encounter.queue.filter(q=>enemies[q.type].kind!=='normal');assert.equal(strong.length,type==='battle'?0:1);if(strong.length)assert.equal(strong[0].group,type==='elite'?2:3);
  }
});

test('battle snapshots remain at preparation; pause is no simulation and every enemy is recorded in discovery',()=>{
  const s=fixture(),u=place(s,'phase_blade',10,10);u.armorBuffUntil=103;u.temporaryArmor=3;u.guardUsed=true;const before=cloneState(s);battle(s,['floating_noise']);assert.equal(s.preBattle.phase,'prep');assert.deepEqual(s.preBattle.terrain,before.terrain);assert.ok(s.discoveries.enemies.includes('floating_noise'));assert.equal(u.armorBuffUntil,0);assert.equal(u.temporaryArmor,0);assert.equal(u.guardUsed,false);
  const snapshot=cloneState(s);assert.deepEqual(s,snapshot);assert.equal(startBattle(s).ok,false);
  s.phase='prep';const step=stepBattle(s,.2);assert.equal(step.finished,null);assert.equal(s.battle.time,snapshot.battle.time);
});

test('basic shots, all elevation pairs and modified maximum range use the same solution as preview',()=>{
  for(let originH=0;originH<5;originH++)for(let targetH=0;targetH<5;targetH++){
    const {s,u,e}=oneShot('pulse_array');for(let z=10;z<=11;z++)for(let x=10;x<=11;x++)cellAt(s,x,z).h=originH;
    pin(e,15,10.5,{h:targetH,armor:7});const expected=solveAttack(s,u,e);stepBattle(s,.05);assert.ok(expected.ok);assert.ok(Math.abs(e.maxHp-e.hp-expected.damage)<1e-8);
  }
  const {s,u,e}=oneShot('focus_rail',{mods:{talents:['height_mastery'],relics:['clear_horizon']}});
  for(let z=10;z<=11;z++)for(let x=10;x<=12;x++)cellAt(s,x,z).h=4;
  pin(e,28,10.5);const expected=solveAttack(s,u,e);assert.equal(expected.ok,true);stepBattle(s,.05);assert.ok(e.hp<e.maxHp,'far but preview-valid shot must fire');
});

test('all offensive tower branches apply their distinct combat effect',()=>{
  {
    const {s,u,e}=oneShot('phase_blade',{tier:2,branch:'A'});u.hp*=.3;const hp=u.hp;stepBattle(s,.05);assert.ok(u.hp>hp);
  }
  for(const [type,branch,field]of [['phase_blade','B','armorBreak'],['boundary_riveter','B','root'],['drone_loom','B','marked']]){
    const {s,e}=oneShot(type,{tier:2,branch});e.armor=20;stepBattle(s,.05);assert.ok(e[field]>0,`${type} ${field}`);
  }
  for(const [type,branch]of [['pulse_array','A'],['drone_loom','A'],['focus_rail','A'],['arc_mortar','A'],['arc_mortar','B']]){
    const {s,u,e}=oneShot(type,{tier:2,branch});s.battle.queue.push({type:'static_drifter',entry:'north',at:0,group:0});stepBattle(s,.001);const second=s.battle.enemies.at(-1);pin(second,14,10.5,{armor:80});u.cooldown=0;const hp=second.hp;stepBattle(s,.05);assert.ok(second.hp<hp,`${type} ${branch} hits secondary`);
    if(type==='arc_mortar'){assert.ok(e.slow>0);if(branch==='B')assert.ok(second.armorBreak>0);}
  }
  const aa=oneShot('pulse_array',{tier:2,branch:'B',enemy:'floating_noise'});const ground=solveAttack(aa.s,aa.u,{...aa.e,air:false}),air=solveAttack(aa.s,aa.u,aa.e);assert.ok(Math.abs(air.damage-(ground.damage+aa.e.armor)*1.8+aa.e.armor)<1e-8);
  const ex=oneShot('focus_rail',{tier:2,branch:'B'});const normal=solveAttack(ex.s,ex.u,ex.e);ex.e.hp=ex.e.maxHp*.2;assert.ok(solveAttack(ex.s,ex.u,ex.e).damage>normal.damage*1.5);
});

test('support targets most missing health; both repair branches, haste, slow aura, shield and self repair work',()=>{
  for(const branch of ['A','B']){
    const s=fixture(),repair=place(s,'memory_mechanic',10,10,{tier:2,branch}),a=place(s,'anchor_bulwark',12,10),b=place(s,'phase_blade',14,10);a.hp=100;b.hp=120;
    battle(s);repair.cooldown=0;stepBattle(s,.05);assert.ok(a.hp>100);assert.equal(b.hp,120);if(branch==='B')assert.ok(a.armorBuffUntil>s.battle.time);
  }
  const s=fixture(),choir=place(s,'frequency_choir',10,10,{tier:2,branch:'B'}),u=place(s,'pulse_array',12,10,{h:1});const [e]=battle(s);pin(e,16,10.5);u.cooldown=1;stepBattle(s,.05);assert.ok(u.cooldown<.95);assert.ok(e.slow>0);
  const self=oneShot('boundary_riveter',{tier:2,branch:'A'});self.u.hp*=.5;const hp=self.u.hp;self.s.battle.time=8;stepBattle(self.s,.05);assert.ok(self.u.hp>hp);
  for(const branch of ['A','B']){const shield=oneShot('resonance_guard',{tier:2,branch});assert.ok(unitStats(shield.s,shield.u).effect=== (branch==='A'?'wide_shield':'pressure_sink'));}
});

test('enemies can damage disabled defenders, flying units bypass ground melee, and destroyed support is inert immediately',()=>{
  const s=fixture(),u=place(s,'anchor_bulwark',18,10);s.bandwidth=3;const [e]=battle(s);pin(e,19,10.5,{attack:30,cooldown:0});s.battle.jam=3;
  e.jamUntil=100;e.ability='jam';u.cooldown=0;const hp=u.hp;stepBattle(s,.05);assert.ok(u.hp<hp);assert.ok(s.battle.disabled.includes(u.uid));assert.equal(e.hp,e.maxHp);
  const f=fixture(),melee=place(f,'anchor_bulwark',18,10),[fly]=battle(f,['floating_noise']);pin(fly,19,10.5,{speed:2,attack:30,cooldown:0});const y=fly.z;stepBattle(f,.05);assert.ok(fly.z>y);assert.equal(melee.hp,unitStats(f,melee).hp);
  const d=fixture(),relay=place(d,'bandwidth_relay',10,10),gun=place(d,'pulse_array',12,10,{h:1});d.bandwidth=3;const [hunter]=battle(d,['remote_hunter']);pin(hunter,10.5,10.5,{attack:1000,cooldown:0});relay.hp=1;stepBattle(d,.05);assert.equal(relay.hp,0);assert.equal(bandwidthState(d).cap,3);assert.ok(!d.battle.disabled.includes(gun.uid));
});

test('temporary overload restores automatically and grants next-shot feedback only to reactivated units',()=>{
  const s=fixture();s.bandwidth=6;s.talents=['relay_feedback'];const first=place(s,'anchor_bulwark',8,8),last=place(s,'pulse_array',10,10,{h:1}),[e]=battle(s,['bandwidth_jammer']);pin(e,15,10.5,{jamUntil:100});stepBattle(s,.05);assert.deepEqual(s.battle.disabled,[last.uid]);
  e.jamUntil=0;last.cooldown=0;const hp=e.hp,expected=solveAttack(s,last,e).damage;stepBattle(s,.05);assert.equal(s.battle.disabled.length,0);assert.ok(Math.abs(hp-e.hp-expected*1.3)<1e-8);assert.equal(last.reactivate,false);
});

test('healing, shielding, haste, teleport, jam, corrosion, sprint and pressure aura produce telegraphed functional results',()=>{
  for(const [type,field]of [['shield_echo','shield'],['tempo_amplifier','hasteUntil'],['bandwidth_jammer','jamUntil'],['resistance_corruptor','corrosionUntil'],['spike_runner','sprintUntil'],['pressure_cantor','pressureAuraUntil']]){
    const s=fixture(),[e]=battle(s,[type]);pin(e,10,10);e.abilityClock=.5;let out=stepBattle(s,.05);assert.ok(out.events.some(x=>x.type==='warning'));e.abilityClock=0;stepBattle(s,.05);assert.ok(e[field]>0,`${type} ${field}`);
  }
  const h=fixture(),[healer,friend]=battle(h,['memory_medic','static_drifter']);pin(healer,10,10);pin(friend,11,10);friend.hp=100;healer.abilityClock=0;stepBattle(h,.05);assert.ok(friend.hp>100);
  const g=fixture(),[shield,ally]=battle(g,['shield_conductor','static_drifter']);pin(shield,10,10);pin(ally,11,10);shield.abilityClock=0;stepBattle(g,.05);assert.ok(ally.shield>0);
  const t=fixture(),[teleporter]=battle(t,['phase_teleporter']);pin(teleporter,20,5);teleporter.abilityClock=0;stepBattle(t,.05);assert.equal(teleporter.z,9);
});

test('shared summon/copy/split reinforcements stop at ten percent and active enemy cap never exceeds one hundred',()=>{
  const s=fixture();s.spirit=s.maxSpirit=100000;const types=Array.from({length:120},(_,i)=>['signal_summoner','replication_node','fracture_seed'][i%3]);battle(s,types);assert.equal(s.battle.enemies.length,100);
  s.battle.reinforcementBudget=12;for(const e of s.battle.enemies){pin(e,10+e.id.length,10);e.abilityClock=0;}
  stepBattle(s,.05);assert.equal(s.battle.enemies.length,100);assert.equal(s.battle.reinforcements,0);
  // Allow planned arrivals to finish, then give the shared budget available slots.
  for(const e of s.battle.enemies.slice(0,30))e.dead=true;stepBattle(s,.05);stepBattle(s,.05);assert.ok(s.battle.enemies.length<=100);
  s.battle.spawned=s.battle.queue.length;for(const e of s.battle.enemies.slice(0,30))e.dead=true;stepBattle(s,.05);
  for(let i=0;i<20;i++){for(const e of s.battle.enemies)e.abilityClock=0;stepBattle(s,.05);}
  assert.equal(s.battle.reinforcements,12);assert.ok(s.battle.maxActive<=100);assert.ok(s.battle.enemies.length<=100);
});

test('blocked ground enemies destroy the cheapest cliff permanently and resume moving',()=>{
  const s=fixture();for(let x=0;x<41;x++)cellAt(s,x,7).h=2;s.terrain.revision++;
  const [e]=battle(s,['siege_ram']);pin(e,20,6,{attack:36,cooldown:0,speed:2});const old=s.terrain.revision;tick(s,7);
  assert.ok(s.terrain.revision>old);assert.ok(cellAt(s,20,7).h<2);assert.ok(e.z>7);assert.ok(pathToCore(s,20,0).every(p=>!p.barrier));
});

test('hunters fire three-shot volleys then advance; a healer outside turret coverage cannot create an endless battle',()=>{
  for(const type of ['remote_hunter','frequency_hunter','siege_ram']){
    const s=fixture(),target=place(s,'phase_blade',19,18),healer=place(s,'memory_mechanic',18,16,{tier:3,branch:'A'});const [e]=battle(s,[type]);pin(e,20,14,{attack:10,speed:1.5,cooldown:0});target.cooldown=10000;
    let warnings=0;const origin={x:e.x,z:e.z};for(let i=0;i<150;i++){const out=stepBattle(s,.05);warnings+=out.events.filter(x=>x.label==='齐射结束 · 向火种推进').length;}
    assert.ok(warnings>=1,type);assert.ok(Math.hypot(e.x-origin.x,e.z-origin.z)>1,type);assert.ok(healer.hp>0);
  }
});

test('explosion kills cannot resurrect through lifesteal or count a reflected chain destruction twice',()=>{
  const leech=oneShot('phase_blade',{tier:2,branch:'A',enemy:'detonation_shell'});leech.u.hp=1;pin(leech.e,11.8,10.5,{hp:1,pressure:0,xp:0,attack:1000});leech.u.cooldown=0;stepBattle(leech.s,.05);assert.equal(leech.u.hp,0,'lifesteal cannot revive an already destroyed construct');assert.equal(leech.s.stats.destroyed,1);
  const reflected=oneShot('phase_blade',{enemy:'detonation_shell',mods:{relics:['return_current']}});reflected.u.hp=30;reflected.u.cooldown=10000;pin(reflected.e,11.8,10.5,{hp:1,pressure:0,xp:0,attack:20,cooldown:0});stepBattle(reflected.s,.05);assert.equal(reflected.u.hp,0);assert.equal(reflected.s.stats.destroyed,1,'recursive explosion reports destruction exactly once');
});

test('a boss killed by reflected siege damage cannot damage further recipients in that volley',()=>{
  const s=fixture();s.relics=['return_current'];const first=place(s,'phase_blade',10,10),second=place(s,'phase_blade',13,10);second.hp=1;const [boss]=battle(s,['zero_frequency_mind']);pin(boss,10.5,10.5,{hp:.1,attack:20,abilityClock:0,xp:0});first.cooldown=second.cooldown=10000;stepBattle(s,.05);assert.equal(s.battle.result,'won');assert.equal(second.hp,1);assert.equal(s.stats.destroyed,0);
});

test('all six bosses stay targetable after reaching fire and a killing blow stops other lethal events immediately',()=>{
  for(const boss of Object.values(enemies).filter(e=>e.kind==='boss')){
    const s=fixture(),u=place(s,'pulse_array',15,22,{tier:3,branch:'B',h:1});const [e]=battle(s,[boss.id]);pin(e,18,24,{hp:5,air:boss.air,core_damage:9999,cooldown:0});u.cooldown=0;s.spirit=1;
    assert.equal(solveAttack(s,u,e).ok,true,boss.id);const result=stepBattle(s,.05);assert.equal(result.finished,'won',boss.id);assert.ok(s.spirit>0);assert.equal(s.stats.kills,1);
  }
});

test('death pressure logs exact distance, resistance and final damage; near deaths hurt more, aura modifies pressure',()=>{
  const run=(z,relics=[],talents=[],aura=false)=>{const s=fixture();s.relics=relics;s.talents=talents;const u=place(s,'pulse_array',16,z,{tier:3,branch:'A',h:1});const [e,source]=battle(s,['detonation_shell','pressure_cantor']);pin(e,18.5,z+.5,{hp:1,pressure:40});pin(source,19,z+.5,{pressureAuraUntil:aura?100:0});u.cooldown=0;stepBattle(s,.05);return s;};
  const near=run(21),far=run(5);assert.ok(near.stats.pressure>far.stats.pressure);const log=near.stats.pressureLog[0];assert.ok(Math.abs(log.modified/(1+(log.distance/6)**2)-log.resistance-log.damage)<1e-8);assert.ok(Math.abs(log.modified-log.distanceReduction-log.resistance-log.damage)<1e-8);assert.ok(log.raw===40);assert.ok(log.damage>0);
  const protectedRun=run(5,['pulse_absorber'],['resistance_memory']);assert.equal(protectedRun.stats.pressure,0);assert.ok(protectedRun.stats.pressure<far.stats.pressure);assert.equal(protectedRun.battle.resistanceStacks,1);
  const aura=run(21,[],[],true);assert.ok(aura.stats.pressureLog[0].modified>log.modified);
});

test('experience levels up inside battle and queues rewards without changing locked phase',()=>{
  const {s,u,e}=oneShot('pulse_array');s.xp=199;s.spirit=50;pin(e,12.4,10.5,{hp:1,pressure:0,xp:18});u.cooldown=0;stepBattle(s,.05);assert.equal(s.depth,2);assert.equal(s.maxSpirit,105);assert.ok(s.spirit>=60);assert.equal(s.phase,'battle');assert.equal(s.pendingUnitRewards,1);assert.equal(s.pendingTalents,1);
});

test('static relic and talent effects alter authoritative damage, armor, range, maintenance and bandwidth',()=>{
  const {s,u,e}=oneShot('pulse_array');const damage=()=>solveAttack(s,u,e).damage,range=()=>solveAttack(s,u,e).range;let base=damage();
  s.relics=['elevated_lens'];for(let x=10;x<=11;x++)for(let z=10;z<=11;z++)cellAt(s,x,z).h=2;const without=cloneState(s);without.relics=[];assert.ok(damage()>solveAttack(without,u,e).damage);
  s.relics=['clear_horizon'];const r=range();s.relics=[];assert.ok(r>range());
  s.talents=['clear_line'];assert.ok(range()>r-.001);s.talents=[];
  e.air=true;s.relics=['skyhook_rounds'];base=damage();s.relics=[];assert.ok(base>damage());e.air=false;
  e.armor=10;s.relics=['calibrated_scope'];base=damage();s.relics=[];assert.ok(Math.abs(base-damage()-2)<1e-8);
  s.talents=['height_mastery'];base=range();s.talents=[];assert.ok(base>range());
  u.priority='hp';s.talents=['target_solution'];base=damage();s.talents=[];assert.ok(base>damage());
  for(let x=10;x<=11;x++)for(let z=10;z<=11;z++)cellAt(s,x,z).h=3;s.relics=['overlook_protocol'];assert.equal(unitStats(s,u).rate,towers.pulse_array.rate*.88);
  s.relics=['redline_amplifier'];s.spirit=34;base=damage();s.relics=[];assert.ok(base>damage());
  s.relics=['volatile_clarity'];u.hp*=.5;const cost=repairCost(s,u);base=damage();s.relics=[];assert.ok(base>damage());assert.ok(cost>repairCost(s,u));
  s.talents=['crisis_accuracy'];base=range();s.talents=[];assert.ok(base>range());
  s.talents=['wakeful_rage'];s.battle.spiritLost=30;base=damage();s.talents=[];assert.ok(base>damage());
  const m=place(s,'phase_blade',12,12);s.relics=['impact_lattice'];assert.equal(unitStats(s,m).hp,Math.round(towers.phase_blade.hp*1.18));
  s.relics=['lasting_anchor'];m.hp=1;assert.equal(unitStats(s,m).armor,towers.phase_blade.armor+5);
  s.relics=['cheap_relocation'];assert.ok(moveCost(s,m)<Math.ceil(towers.phase_blade.upkeep*.15));
  s.relics=['repair_reserve'];const discounted=repairCost(s,m);s.relics=[];assert.ok(discounted<repairCost(s,m));
  s.talents=['hardened_footing'];const reduced=incomingDamage(s,m,e,100);s.talents=[];assert.ok(reduced<incomingDamage(s,m,e,100));
  s.talents=['priority_channel'];assert.equal(unitStats(s,m).armor,towers.phase_blade.armor+2);s.talents=[];
  const sup=place(s,'bandwidth_relay',14,14);s.relics=['mesh_network'];assert.equal(unitStats(s,sup).range,towers.bandwidth_relay.range*1.15);
  s.relics=['relay_efficiency'];assert.equal(unitStats(s,sup).bandwidth,1);
  s.relics=['compact_encoding'];assert.equal(unitStats(s,u).bandwidth,2);
  s.relics=['wide_channel'];base=bandwidthState(s).cap;s.relics=[];assert.equal(base-bandwidthState(s).cap,4);
  s.battle.jam=6;for(const [id,kind,buffer]of [['redundant_relay','relics',2],['overload_buffer','relics',3],['graceful_overload','talents',1]]){s[kind]=[id];base=bandwidthState(s).cap;s[kind]=[];assert.equal(base-bandwidthState(s).cap,buffer);}
});

test('pressure-control relics and talents apply individual conditions and preserve exact log accounting',()=>{
  const run=(items,{dist=14,slow=0,overkill=10000,area=false,elite=false,spirit=100}={})=>{
    const s=fixture();s.relics=items.filter(x=>!['distance_doctrine','soft_impact','calm_aftershock','risk_conversion'].includes(x));s.talents=items.filter(x=>['distance_doctrine','soft_impact','calm_aftershock','risk_conversion'].includes(x));s.spirit=spirit;
    const u=place(s,area?'arc_mortar':'pulse_array',16,Math.round(24-dist),{tier:3,branch:'A',h:1});const [e]=battle(s,[elite?'frequency_hunter':'static_drifter']);pin(e,18,24-dist,{hp:1,pressure:10,slow,maxHp:overkill,xp:0,focus:10});u.cooldown=0;stepBattle(s,.05);return s;
  };
  const base=run([]).stats.pressureLog[0];
  for(const [id,options,factor]of [['distant_silence',{},.8],['slow_decay',{slow:2},.85],['clean_kill',{overkill:1},.8],['distance_doctrine',{},.98],['soft_impact',{area:true},.9]]){const s=run([id],options),log=s.stats.pressureLog[0];assert.ok(Math.abs(log.modified-base.modified*factor)<1e-8,id);}
  for(const [id,expected,options]of [['resistance_prism',4,{}],['pain_filter',5,{spirit:24}]]){const s=run([id],options);assert.equal(s.stats.pressureLog[0].resistance,expected,id);assert.equal(s.stats.pressure,0);}
  const baseFocus=run([],{spirit:30}).focus,extra=run(['risk_conversion'],{spirit:30}).focus;assert.equal(extra-baseFocus,2);
  const elite=run(['calm_aftershock'],{elite:true,spirit:50}),normalElite=run([],{elite:true,spirit:50});assert.ok(Math.abs(elite.spirit-normalElite.spirit-3)<1e-8);
  const s=fixture();s.talents=['early_warning'];const [e]=battle(s,['detonation_shell']);assert.equal(e.pressureMarked,true);
});

test('crisis focus triggers once, lethal spirit guard resets each battle, and simultaneous damage cannot revive a loss',()=>{
  const s=fixture();s.relics=['crisis_focus','final_resolve'];s.spirit=51;const [e]=battle(s);pin(e,20,24,{cooldown:0,core_damage:100});const focus=s.focus;stepBattle(s,.05);assert.equal(s.spirit,1);assert.equal(s.focus,focus+30);assert.equal(s.battle.deathGuardUsed,true);
  s.battle.result=null;s.battle.queue.push({type:'static_drifter',entry:'north',at:0,group:0});stepBattle(s,.05);const next=s.battle.enemies[0];pin(next,20,24,{cooldown:0,core_damage:100});stepBattle(s,.05);assert.equal(s.battle.result,'lost');assert.equal(s.spirit,0);assert.equal(s.focus,focus+30);
  const before=cloneState(s);stepBattle(s,.05);assert.deepEqual(s,before,'terminal loss cannot be reversed by further ticks');
});

test('melee reflection, five-hit counters, branch retaliation and lethal guard each obey their trigger',()=>{
  const run=(type,{relics=[],talents=[],branch=null}={})=>{const {s,u,e}=oneShot(type,{tier:branch?2:1,branch,mods:{relics,talents}});u.cooldown=10000;pin(e,11.8,10.5,{attack:20,cooldown:0});return {s,u,e};};
  const reflect=run('phase_blade',{relics:['return_current']});stepBattle(reflect.s,.05);assert.ok(reflect.e.hp<reflect.e.maxHp);
  const counter=run('phase_blade',{talents:['counter_rhythm']});for(let n=1;n<=5;n++){counter.e.cooldown=0;stepBattle(counter.s,.05);assert.equal(counter.e.hp<counter.e.maxHp,n===5);}
  const anchor=run('anchor_bulwark',{branch:'A'});stepBattle(anchor.s,.05);assert.ok(anchor.e.hp<anchor.e.maxHp);
  const guard=run('phase_blade',{talents:['unbroken_line']});guard.u.hp=1;stepBattle(guard.s,.05);assert.equal(guard.u.hp,1);guard.e.cooldown=0;stepBattle(guard.s,.05);assert.equal(guard.u.hp,0);
});

test('support overlap, repair efficiency, shared clock, protection and triage affect actual recipients',()=>{
  const s=fixture();s.talents=['linked_support','shield_memory','distributed_clock'];s.relics=['local_shield','shared_clock'];
  const repair=place(s,'memory_mechanic',8,10),choir=place(s,'frequency_choir',12,10,{tier:2,branch:'A'}),u=place(s,'pulse_array',10,12,{h:1});const [e]=battle(s);pin(e,15,12.5);u.hp=20;repair.cooldown=0;u.cooldown=0;const hp=u.hp;stepBattle(s,.05);
  assert.ok(Math.abs(u.hp-hp-unitStats(s,repair).attack*1.1*1.15)<1e-8);assert.equal(u.temporaryArmor,4*1.15);assert.equal(u.cooldown,unitStats(s,u).rate*.92);
  const t=fixture();t.talents=['triage_logic'];const med=place(t,'memory_mechanic',10,10),a=place(t,'anchor_bulwark',5,10),b=place(t,'anchor_bulwark',15,10);a.hp-=80;b.hp-=60;const [threat]=battle(t);pin(threat,17,10,{attack:0});med.cooldown=0;const ahp=a.hp,bhp=b.hp;stepBattle(t,.05);assert.equal(a.hp,ahp);assert.ok(b.hp>bhp);
});

test('all six bosses change phase at advertised thresholds and reuse visible windups',()=>{
  for(const type of Object.values(enemies).filter(e=>e.kind==='boss').map(e=>e.id)){
    const s=fixture(),[e]=battle(s,[type]);pin(e,10,10,{maxHp:10000,hp:3400});e.abilityClock=0;
    const out=stepBattle(s,.05);assert.equal(e.phase,2,type);assert.ok(out.events.some(x=>x.type==='boss'));
    assert.ok(Math.abs(e.abilityClock-4.9)<1e-8,type);
    if(type==='memory_reforger')assert.equal(e.hp,4400);
    if(type==='bandwidth_requisitioner')assert.equal(e.jamStrength,10);
    if(type==='mirror_censor')assert.equal(e.shield,250);
    if(type==='chorus_overseer')assert.ok(e.jamUntil>s.battle.time);
    if(type==='noise_hive')assert.ok(e.hasteUntil>s.battle.time);
  }
});

test('one hundred enemies and thirty five constructed units stay finite under representative combat pressure',()=>{
  const s=fixture();s.bandwidth=500;s.spirit=s.maxSpirit=100000;
  for(let i=0;i<35;i++)place(s,['pulse_array','phase_blade','frequency_choir','memory_mechanic','bandwidth_relay'][i%5],4+(i%7)*4,4+Math.floor(i/7)*4,{tier:3,branch:i%2?'A':'B',h:i%5===0?1:0});
  battle(s,Array.from({length:100},(_,i)=>Object.keys(enemies)[i%28]));for(let i=0;i<s.battle.enemies.length;i++)pin(s.battle.enemies[i],5+(i%10)*3,5+Math.floor(i/10)*3,{hp:100000,abilityClock:i%5});
  const started=performance.now();for(let i=0;i<100;i++)stepBattle(s,.05);const average=(performance.now()-started)/100;
  assert.ok(s.battle.maxActive<=100);assert.ok(s.units.every(u=>Number.isFinite(u.hp)));assert.ok(s.battle.enemies.every(e=>Number.isFinite(e.hp)&&Number.isFinite(e.x)&&Number.isFinite(e.z)));
  assert.ok(average<50,`20 Hz simulation budget exceeded: ${average.toFixed(2)} ms`);console.log(`WEB_COMBAT_STRESS enemies=100 towers=35 avg_step_ms=${average.toFixed(3)}`);
});
