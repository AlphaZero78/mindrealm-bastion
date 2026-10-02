import {towers,enemies,acts,seededRandom} from './content.js';
import {unitStats,unitCenter,onField,cellAt,coreOf,entriesOf,pathToCore,distanceToCore,edgeInfo,bandwidthState,solveAttack,incomingDamage,clamp,ruleEffects as effects,beginRulesFrame,endRulesFrame,invalidateRulesFrame} from './rules.js';
import {addXP} from './state.js';
import {difficultyProfile,enemyStats,enemyAbilityProfile,enemyRecoveryBase} from './difficulty.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const nodeOf=s=>typeof s.currentNode==='object'?s.currentNode:{id:s.currentNode,type:'battle'};
const aliveUnits=s=>s.units.filter(u=>onField(u)&&u.hp>0);
export function makeEncounter(state,node=nodeOf(state)) {
  const act=state.act||0,floor=state.floor||0,kind=node?.type||'battle',difficulty=difficultyProfile(state);
  const rand=seededRandom(`${state.seed}:encounter:${node?.id||`${act}:${floor}`}`);
  const allEntries=entriesOf(state),entryCount=act>=2?4:act===1?(floor>=4?4:3):floor>=10?3:floor>=4?2:1;
  const entries=allEntries.slice(0,entryCount).map(x=>({...x,count:0}));
  const groupCount=kind==='boss'?5:kind==='elite'?4:3;
  const count=16+act*8+Math.floor(floor/(acts[act]?.floors||17)*12)+(kind==='elite'?4:kind==='boss'?6:0);
  const regular=Object.values(enemies).filter(e=>e.kind==='normal'&&e.act<=act+1+difficulty.earlyEnemyAct);
  const functional=regular.filter(e=>!['none','sprint'].includes(e.ability));
  const base=regular.filter(e=>['none','sprint','armored'].includes(e.ability));
  const groups=Array.from({length:groupCount},(_,i)=>({index:i,at:0,count:0,entries:[],types:[],label:`敌群 ${i+1}`}));
  const queue=[];let clock=2,normalIndex=0;
  for(let g=0;g<groupCount;g++){
    const group=groups[g];group.at=clock;
    const members=Math.floor(count/groupCount)+(g<count%groupCount?1:0);
    for(let k=0;k<members;k++){
      const candidates=(normalIndex%4===2||difficulty.functionalDensity>.25&&normalIndex%3===1)?functional:base;normalIndex++;
      const type=candidates[Math.floor(rand()*candidates.length)].id,entry=entries[(g+k)%entries.length];
      queue.push({type,entry:entry.id,at:clock,group:g});entry.count++;group.count++;
      if(!group.entries.includes(entry.id))group.entries.push(entry.id);if(!group.types.includes(type))group.types.push(type);
      clock+=.75+rand()*.35;
    }
    if(kind==='elite'&&g===groupCount-2||kind==='boss'&&g===3){
      const options=Object.values(enemies).filter(e=>e.kind===(kind==='elite'?'elite':'boss')&&e.act<=act+1);
      const boss=typeof state.bosses?.[act]==='string'?state.bosses[act]:state.bosses?.[act]?.id;
      const type=kind==='boss'?(node.boss||boss||acts[act]?.bosses?.[Math.floor(rand()*2)]||options.at(-1).id):options[Math.floor(rand()*options.length)].id;
      const entry=entries[g%entries.length];queue.push({type,entry:entry.id,at:clock,group:g});clock+=1;entry.count++;group.count++;group.types.push(type);
    }
    clock+=4+rand()*2;
  }
  return {queue,groups,entries,total:queue.length,kind,reinforcementBudget:Math.floor(queue.length*.1),duration:clock};
}
export function startBattle(state) {
  if(state.phase!=='prep')return {ok:false,reason:'请先进入战前阶段'};
  const encounter=makeEncounter(state),snapshot={...state};delete snapshot.battle;delete snapshot.preBattle;
  state.preBattle=JSON.parse(JSON.stringify(snapshot));state.terrainUndo=[];
  state.phase='battle';state.battle={...encounter,enemies:[],time:0,spawned:0,nextId:1,reinforcements:0,initialDepth:state.depth,initialSpirit:state.spirit,spiritLost:0,
    groupIndex:0,nextGroupIn:2,danger:0,jam:0,corrosion:0,resistanceStacks:0,pressureAbsorbAt:0,deathGuardUsed:false,terrainDamage:{},disabled:[],result:null,events:[],eventSequence:0,bossKilled:false,maxActive:0};
  for(const u of state.units){u.cooldown=.1;u.temporaryArmor=0;u.armorBuffUntil=0;u.hitsTaken=0;u.lastHitAt=-100;u.guardUsed=false;u.reactivate=false;u.destroyedThisBattle=false;resetAction(u);}
  state.stats ||= {};for(const key of ['kills','breaches','pressure','breachDamage','destroyed','elites','overloadSeconds'])state.stats[key]??=0;
  state.stats.damageByUnit ||= {};state.stats.history ||= [];state.stats.pressureLog ||= [];
  return {ok:true,reason:'防线已锁定，敌群开始入侵'};
}
// Presentation consumes facts from the simulation clock. These fields are never
// read by combat rules, and contain no animation durations or render objects.
function resetAction(entity){entity.facing=0;entity.actionTargetId=null;entity.actionTargetKind=null;entity.actionKind=null;entity.lastActionAt=null;}
function position(state,entity,kind){
  const p=kind==='unit'?unitCenter(entity):entity;
  return {x:p.x,z:p.z,h:kind==='enemy'?(entity.h??cellAt(state,p.x,p.z)?.h??0):(cellAt(state,p.x,p.z)?.h??0)};
}
function aim(entity,target,id,kind,origin=entity){
  entity.actionTargetId=id??null;entity.actionTargetKind=kind??null;
  const dx=target.x-origin.x,dz=target.z-origin.z;if(Math.abs(dx)+Math.abs(dz)>1e-9)entity.facing=Math.atan2(dx,dz);
}
function emit(state,event){
  const b=state.battle;
  const sourceKind=event.sourceKind||(event.type==='shot'||event.type==='heal'&&event.unit||event.type==='kill'&&event.unit?'unit':event.enemy?'enemy':event.type==='terrain'?'terrain':'core');
  const sourceId=event.sourceId??(sourceKind==='unit'?event.unit:sourceKind==='enemy'?event.enemy:sourceKind==='core'?'core':`${event.x},${event.z}`);
  const source=sourceKind==='unit'?state.units.find(u=>u.uid===sourceId):sourceKind==='enemy'?b.enemies.find(e=>e.id===sourceId):sourceKind==='core'?coreOf(state):null;
  const targetKind=event.targetKind||(event.type==='shot'?'enemy':event.type==='hit'&&event.unit?'unit':null);
  const targetId=event.targetId??(targetKind==='enemy'?event.enemy:targetKind==='unit'?event.type==='hit'?event.unit:null:targetKind==='core'?'core':null);
  const target=targetKind==='unit'?state.units.find(u=>u.uid===targetId):targetKind==='enemy'?b.enemies.find(e=>e.id===targetId):targetKind==='core'?coreOf(state):null;
  const from=event.from||(source?position(state,source,sourceKind):{x:event.x,z:event.z,h:event.h??cellAt(state,event.x,event.z)?.h??0});
  const to=event.to||(target?position(state,target,targetKind):Number.isFinite(event.tx)?{x:event.tx,z:event.tz,h:cellAt(state,event.tx,event.tz)?.h??0}:null);
  const action=event.action||({shot:'attack',hit:'attack',kill:'death',heal:'heal',spawn:'spawn',terrain:'terrain',warning:'cast',boss:'cast',support:'buff'})[event.type];
  if(source&&['unit','enemy'].includes(sourceKind)&&['attack','heal','buff','cast'].includes(action)){
    if(to&&!event.secondary)aim(source,to,targetId,targetKind,position(state,source,sourceKind));
    if(!event.secondary){source.lastActionAt=b.time;source.actionKind=event.actionKind||action;}
  }
  b.eventSequence=(b.eventSequence||0)+1;
  const enriched={...event,time:b.time,sequence:b.eventSequence,action,sourceId,sourceKind,sourceType:source?.type??null,targetId,targetKind,targetType:target?.type??null,from,to,facing:source?.facing??0};
  if(action==='death'&&source)enriched.entity={id:source.id??source.uid,uid:source.uid??null,type:source.type,x:source.x,z:source.z,h:from.h,kind:source.kind??'unit',air:!!source.air,facing:source.facing??0,phase:source.phase??0,tier:source.tier??null,branch:source.branch??null};
  b.events.push(enriched);return enriched;
}
function spawn(state,type,entryId,group=0,parent=null) {
  const b=state.battle;if(b.enemies.filter(e=>!e.dead).length>=100)return null;
  const spec=enemies[type];if(!spec)throw new Error(`未定义敌人 ${type}`);
  const entry=entriesOf(state).find(e=>e.id===entryId)||entriesOf(state)[0],stats=enemyStats(state,spec);
  const e={...stats,type,id:`e${b.nextId++}`,x:parent?.x??entry.x,z:parent?.z??entry.z,h:0,
    group,entry:entry.id,cooldown:1.1,abilityClock:2+(b.nextId%4),warningUntil:0,slow:0,root:0,shield:spec.ability==='shield'?stats.maxHp*.35:0,
    surgeClock:12,surgeWarningUntil:0,surgeTargets:[],surgeOrigin:null,
    armorBreak:0,marked:0,dead:false,breached:false,phase:0,reinforcement:!!parent,pathRevision:-1,path:[],pathIndex:0,
    facing:0,actionTargetId:null,actionTargetKind:null,actionKind:null,lastActionAt:null,lastHitAt:null,castUntil:0,motion:{dx:0,dz:0,distance:0,time:b.time,dt:0}};
  e.h=cellAt(state,e.x,e.z)?.h||0;if(e.ability==='armored')e.pierce=.35;if(e.kind==='boss')e.pierce=.25;
  if(effects(state).pressure_mark&&e.pressure>=12)e.pressureMarked=true;
  b.enemies.push(e);b.maxActive=Math.max(b.maxActive,b.enemies.filter(t=>!t.dead).length);
  if(state.discoveries?.enemies&&!state.discoveries.enemies.includes(type))state.discoveries.enemies.push(type);
  emit(state,{type:e.kind==='boss'?'boss':'spawn',action:'spawn',x:e.x,z:e.z,enemy:e.id,label:e.name,parentId:parent?.id??null});return e;
}
function reinforce(state,parent,type,count=1) {
  const b=state.battle;let added=0;
  for(let i=0;i<count;i++){
    if(b.reinforcements>=b.reinforcementBudget||b.enemies.filter(e=>!e.dead).length>=100)break;
    if(spawn(state,type,parent.entry,parent.group,parent)){b.reinforcements++;added++;}
  }
  return added;
}
function spiritHit(state,amount,source) {
  const b=state.battle,m=effects(state);let damage=Math.max(0,amount);
  if(state.spirit-damage<=0&&m.death_guard&&!b.deathGuardUsed){damage=Math.max(0,state.spirit-1);b.deathGuardUsed=true;emit(state,{type:'heal',...coreOf(state),label:'最后清醒 · 保留 1 精神'});}
  state.spirit=Math.max(0,state.spirit-damage);b.spiritLost+=damage;
  if(source==='breach')state.stats.breachDamage+=damage;else state.stats.pressure+=damage;
  if(m.crisis_focus&&state.spirit<state.maxSpirit*.5&&!state.crisisFocusUsed){state.focus+=m.crisis_focus;state.crisisFocusUsed=true;}
  if(state.spirit<=0)b.result='lost';
  return damage;
}
function currentResistance(state,active) {
  const b=state.battle,m=effects(state);let value=state.resistance+(m.resistance||0)+b.resistanceStacks-b.corrosion;
  for(const u of active){if(u.hp<=0)continue;const s=unitStats(state,u);if(s.ability==='resistance_plus')value+=s.support_value;}
  return Math.max(0,value);
}
function killEnemy(state,e,active,hit={}) {
  if(e.dead)return;e.dead=true;
  const b=state.battle,m=effects(state),dist=distance(e,coreOf(state));state.stats.kills++;
  const rewardMultiplier=state.spirit<state.maxSpirit*.35?1+(m.crisis_reward||0):1;
  addXP(state,e.xp||0);state.focus+=(e.focus||0)*rewardMultiplier;
  if(e.kind==='elite'){state.stats.elites++;state.spirit=Math.min(state.maxSpirit,state.spirit+(m.elite_spirit||0));}
  if(e.kind==='boss'){
    b.bossKilled=true;emit(state,{type:'boss',action:'death',x:e.x,z:e.z,enemy:e.id,label:'控制信号已切断'});
    // Boss death cuts the signal; it does not produce a post-victory lethal shock.
    return;
  }
  let raw=e.pressure;
  if(b.enemies.some(source=>source.pressureAuraUntil>b.time&&distance(e,source)<=6))raw*=1.25;
  if(dist>=12)raw*=1-(m.far_pressure||0);
  if(e.slow>0)raw*=1-(m.slow_pressure||0);
  if(hit.overkill>e.maxHp*.25)raw*=1-(m.overkill_pressure||0);
  if(hit.area)raw*=1-(m.aoe_pressure||0);
  raw*=1-clamp(Math.floor(dist/10)*(m.distance_pressure||0),0,.8);
  raw*=1-clamp(m.pressure_reduction||0,0,.8);
  for(const u of active){if(u.hp<=0)continue;const s=unitStats(state,u);if(distance(e,unitCenter(u))<=s.range&&['pressure_sink','pressure_filter'].includes(s.effect))raw*=.7;}
  const arrival=raw/(1+(dist/6)**2),resistance=currentResistance(state,active);
  let amount=Math.max(0,arrival-resistance),absorbed=0;
  if(m.pressure_absorb&&amount<=m.pressure_absorb&&b.time>=b.pressureAbsorbAt){absorbed=amount;amount=0;b.pressureAbsorbAt=b.time+10;}
  if(amount===0&&m.resistance_stack)b.resistanceStacks=Math.min(m.resistance_stack,b.resistanceStacks+1);
  const actual=spiritHit(state,amount,'pressure');
  const log={source:e.name,raw:e.pressure,modified:raw,distance:dist,distanceReduction:raw-arrival,resistance,absorbed,damage:actual,time:b.time};
  state.stats.pressureLog.push(log);if(state.stats.pressureLog.length>600)state.stats.pressureLog.shift();
  emit(state,{type:'kill',x:e.x,z:e.z,enemy:e.id,amount:actual,label:actual>=1?`压力 −${actual.toFixed(1)}`:'压力已吸收'});
  if(e.ability==='split')reinforce(state,e,'spike_runner',2);
  if(e.ability==='explode')for(const u of aliveUnits(state))if(distance(e,unitCenter(u))<=3.5)hitUnit(state,e,u,e.attack*1.6,active,{actionKind:'explosion',secondary:true});
}
function hitEnemy(state,e,amount,unit,active,{area=false}={}) {
  if(e.dead||e.hp<=0||state.battle.result==='lost'||state.battle.bossKilled)return;
  let actual=amount*(e.marked>0?1.15:1);const shield=Math.min(e.shield,actual);e.shield-=shield;actual-=shield;
  const before=e.hp;e.hp-=actual;
  if(actual>0||shield>0)e.lastHitAt=state.battle.time;
  if(unit){state.stats.damageByUnit[unit.uid]=(state.stats.damageByUnit[unit.uid]||0)+Math.min(before,actual);}
  if(e.hp<=0)killEnemy(state,e,active,{overkill:-e.hp,area});
  return {damage:Math.min(before,actual),shieldDamage:shield};
}
function hitUnit(state,enemy,unit,amount,active,detail={}) {
  if(unit.hp<=0||state.battle.bossKilled||state.battle.result==='lost')return;
  const b=state.battle,m=effects(state),s=unitStats(state,unit);let damage=incomingDamage(state,unit,enemy,amount);
  if(s.ability==='siege_resist'&&enemy.ability==='siege')damage*=.55;
  const guards=active.filter(u=>u.hp>0&&!b.disabled.includes(u.uid)&&u.uid!==unit.uid&&['ally_shield','taunt'].includes(unitStats(state,u).ability)&&distance(unitCenter(u),unitCenter(unit))<= (unitStats(state,u).effect==='wide_shield'?6:3));
  if(guards.some(u=>unitStats(state,u).ability==='ally_shield'||unitStats(state,u).effect==='guard'))damage*=.82;
  if(unit.hp-damage<=0&&s.role==='melee'&&m.melee_guard&&!unit.guardUsed&&enemy.kind==='normal'){damage=Math.max(0,unit.hp-1);unit.guardUsed=true;}
  unit.hp=Math.max(0,unit.hp-damage);unit.lastHitAt=b.time;unit.hitsTaken++;
  const event=emit(state,{type:'hit',stage:'release',actionKind:enemy.ability==='tower_hunter'?'ranged':enemy.ability==='siege'?'siege':'melee',...detail,x:enemy.x,z:enemy.z,tx:unitCenter(unit).x,tz:unitCenter(unit).z,unit:unit.uid,enemy:enemy.id,amount:damage,ability:enemy.ability,retaliation:[]});
  const enabled=!b.disabled.includes(unit.uid);
  if(enabled&&s.role==='melee'&&m.melee_reflect){const impact=hitEnemy(state,enemy,damage*m.melee_reflect,unit,active);if(impact)event.retaliation.push({kind:'reflect',sourceId:unit.uid,targetId:enemy.id,...impact});}
  if(enabled&&unit.hp>0&&(s.effect==='counter'||s.role==='melee'&&m.counter_hits&&unit.hitsTaken%m.counter_hits===0)){
    const impact=hitEnemy(state,enemy,s.attack*.65,unit,active);if(impact){aim(unit,enemy,enemy.id,'enemy',unitCenter(unit));unit.lastActionAt=b.time;unit.actionKind='melee';event.retaliation.push({kind:'counter',sourceId:unit.uid,targetId:enemy.id,...impact});}
  }
  if(unit.hp===0&&!unit.destroyedThisBattle){
    unit.destroyedThisBattle=true;state.stats.destroyed++;emit(state,{type:'kill',...unitCenter(unit),unit:unit.uid,label:'构造损坏 · 可于战后维修'});
    invalidateRulesFrame(state);
    // A destroyed relay stops contributing immediately, including within this step.
    b.disabled=bandwidthState(state).disabled;
    for(let i=active.length-1;i>=0;i--)if(active[i].hp<=0||b.disabled.includes(active[i].uid))active.splice(i,1);
  }
}
function ability(state,e,active) {
  const b=state.battle,near=b.enemies.filter(t=>!t.dead&&distance(e,t)<6),boss=e.kind==='boss';
  const info=enemyAbilityProfile(state,e,e.phase);
  const event={type:boss?'boss':'warning',action:'cast',actionKind:'ability-release',stage:'release',ability:e.ability,phase:e.phase,x:e.x,z:e.z,enemy:e.id,impacts:[]};
  switch(e.ability){
    case 'heal':for(const t of near){const amount=enemyRecoveryBase(state,t)*info.healFraction,before=t.hp;t.hp=Math.min(t.maxHp,t.hp+amount);event.impacts.push({targetId:t.id,targetKind:'enemy',to:position(state,t,'enemy'),kind:'heal',amount:t.hp-before});}emit(state,{...event,type:'heal',radius:6,label:boss?`重铸脉冲 · 自身恢复 ${Math.round(info.healAmount)}`:'重铸脉冲'});break;
    case 'group_shield':for(const t of near){const before=t.shield;t.shield=Math.max(t.shield,enemyRecoveryBase(state,t)*info.shieldFraction);event.impacts.push({targetId:t.id,targetKind:'enemy',to:position(state,t,'enemy'),kind:'shield',amount:t.shield-before});}emit(state,{...event,radius:6,label:'护盾链已连接'});break;
    case 'summon':{const added=reinforce(state,e,'static_drifter',boss?2:1);emit(state,{...event,spawnedIds:added?b.enemies.slice(-added).map(t=>t.id):[],label:'召集信号'});break;}
    case 'copy':{
      const candidates=near.filter(t=>t.id!==e.id&&t.kind==='normal'&&!t.reinforcement),t=candidates[(b.nextId+e.group)%Math.max(1,candidates.length)];
      const added=reinforce(state,e,t?.type||'shield_echo',boss?2:1);emit(state,{...event,spawnedIds:added?b.enemies.slice(-added).map(t=>t.id):[],copiedId:t?.id??null,label:'镜像复制'});break;}
    case 'teleport':{const from=position(state,e,'enemy'),path=pathToCore(state,e.x,e.z),dest=path[Math.min(4,path.length-1)];if(dest){e.x=dest.x;e.z=dest.z;e.h=cellAt(state,e.x,e.z)?.h||0;e.pathRevision=-1;}emit(state,{...event,from,to:position(state,e,'enemy'),label:'相位迁跃'});break;}
    case 'jam':e.jamUntil=b.time+info.jamDuration;e.jamStrength=info.jamStrength;emit(state,{...event,label:`${boss?'带宽征用':'带宽干扰'} −${e.jamStrength}`});break;
    case 'corrode_resistance':e.corrosionUntil=b.time+5;if(e.kind==='elite'){
      const damage=spiritHit(state,2,'pressure');state.stats.pressureLog.push({source:`${e.name} · 精神征收`,raw:2,modified:2,distance:distance(e,coreOf(state)),distanceReduction:0,resistance:0,absorbed:0,damage,time:b.time,kind:'drain'});
      emit(state,{...event,amount:damage,label:'精神征收 −2'});
    }emit(state,{...event,label:'抗性腐蚀'});break;
    case 'sprint':e.sprintUntil=b.time+2.5;emit(state,{...event,label:'尖峰冲刺'});break;
    case 'siege':if(boss){const targets=aliveUnits(state).filter(u=>distance(unitCenter(u),e)<10+e.phase).sort((a,c)=>distance(unitCenter(a),e)-distance(unitCenter(c),e));for(const u of targets.slice(0,3+e.phase))hitUnit(state,e,u,e.attack*(.65+e.phase*.1),active,{actionKind:'shock',secondary:true});emit(state,{...event,radius:10+e.phase,targets:targets.slice(0,3+e.phase).map(u=>u.uid),label:`零频冲击 · 波及 ${3+e.phase} 个构造`});}break;
    case 'pressure_aura':e.pressureAuraUntil=b.time+4;emit(state,{...event,label:'死亡压力增幅'});break;
    case 'haste':e.hasteUntil=b.time+4;emit(state,{...event,label:'加速脉冲'});break;
    case 'shield':e.shield=Math.max(e.shield,e.maxHp*.15);emit(state,{...event,label:'回声护盾'});break;
  }
  if(boss&&e.phase>=1&&e.type==='noise_hive')for(const t of near){t.hasteUntil=b.time+3;event.impacts.push({targetId:t.id,targetKind:'enemy',kind:'haste',until:t.hasteUntil});}
  if(boss&&e.phase>=1&&e.type==='mirror_censor'){const before=e.shield;e.shield=Math.max(e.shield,info.shieldAmount);event.impacts.push({targetId:e.id,targetKind:'enemy',kind:'shield',amount:e.shield-before});}
  if(boss&&e.phase>=1&&e.type==='chorus_overseer'){e.jamUntil=b.time+info.jamDuration;event.impacts.push({targetId:'core',targetKind:'core',kind:'jam',until:e.jamUntil});}
}
function updateAbilities(state,e,dt,active) {
  const b=state.battle,boss=e.kind==='boss',phase=e.hp/e.maxHp<.35?2:e.hp/e.maxHp<.7?1:0;
  if(boss&&phase>e.phase){e.phase=phase;e.abilityClock=Math.min(e.abilityClock,1.2);emit(state,{type:'boss',action:'phase',phase,x:e.x,z:e.z,enemy:e.id,label:`${e.name} · 第 ${phase+1} 阶段`});}
  e.abilityClock-=dt;
  if(e.abilityClock<=1.1&&!e.warningUntil&&['heal','group_shield','summon','copy','teleport','jam','corrode_resistance','siege','sprint','pressure_aura','haste','shield'].includes(e.ability)){
    e.warningUntil=b.time+1.1;emit(state,{type:'warning',stage:'windup',actionKind:'ability-windup',ability:e.ability,phase:e.phase,duration:Math.max(0,e.abilityClock),endsAt:b.time+Math.max(0,e.abilityClock),x:e.x,z:e.z,enemy:e.id,label:`${e.name} · 能力准备`});
  }
  e.castUntil=e.warningUntil?b.time+Math.max(0,e.abilityClock):0;
  if(e.abilityClock<=0){ability(state,e,active);e.warningUntil=0;e.castUntil=0;e.abilityClock=enemyAbilityProfile(state,e,e.phase).cycle;}
}
function updateSurge(state,e,dt,active) {
  const surge=difficultyProfile(state).surge,b=state.battle;
  if(e.kind!=='boss'||!surge.enabled||e.dead||b.bossKilled||b.result==='lost')return;
  e.surgeClock-=dt;
  if(!e.surgeWarningUntil&&e.surgeClock<=surge.warning){
    const targets=aliveUnits(state).filter(u=>distance(unitCenter(u),e)<=surge.range);
    targets.sort((a,c)=>{
      const ta=active.includes(a)&&unitStats(state,a).ability==='taunt'?1:0,tc=active.includes(c)&&unitStats(state,c).ability==='taunt'?1:0;
      return tc-ta||distance(unitCenter(a),e)-distance(unitCenter(c),e)||(a.order||0)-(c.order||0);
    });
    e.surgeTargets=targets.slice(0,surge.maxTargets).map(u=>u.uid);
    e.surgeOrigin={x:e.x,z:e.z,h:e.h};e.surgeWarningUntil=b.time+surge.warning;
    emit(state,{type:'warning',...e.surgeOrigin,enemy:e.id,kind:'surge',actionKind:'surge-windup',stage:'windup',ability:'surge',radius:surge.range,targets:[...e.surgeTargets],duration:surge.warning,endsAt:e.surgeWarningUntil,label:'频震蓄力 · 1.5 秒后冲击'});
  }
  if(e.surgeWarningUntil&&b.time+1e-9>=e.surgeWarningUntil){
    for(const uid of e.surgeTargets){const u=state.units.find(t=>t.uid===uid);if(u&&u.hp>0&&onField(u)&&distance(unitCenter(u),e.surgeOrigin)<=surge.range)hitUnit(state,e,u,e.attack*surge.attackFraction,active,{actionKind:'surge',secondary:true});}
    emit(state,{type:'warning',...e.surgeOrigin,enemy:e.id,kind:'surge-hit',actionKind:'surge-release',stage:'release',ability:'surge',radius:surge.range,targets:[...e.surgeTargets],label:'频震释放'});
    e.surgeWarningUntil=0;e.surgeClock=surge.interval;e.surgeTargets=[];e.surgeOrigin=null;
  }
}
function moveEnemy(state,e,dt,active) {
  const b=state.battle,core=coreOf(state),r=core.size/2;
  if(e.dead||b.bossKilled||b.result==='lost')return;
  // The marked frequency shock keeps a fixed, readable origin during its windup.
  if(e.surgeWarningUntil>b.time)return;
  if(Math.abs(e.x-core.x)<=r&&Math.abs(e.z-core.z)<=r){
    aim(e,core,'core','core');
    if(!e.breached){state.stats.breaches++;e.breached=true;state.stats.history.push({type:'breach',enemy:e.name,time:b.time});}
    if(e.cooldown<=0){const amount=spiritHit(state,e.core_damage,'breach');e.cooldown=e.kind==='normal'?1:2.7;emit(state,{type:'hit',action:'breach',actionKind:'breach',stage:'release',targetId:'core',targetKind:'core',despawn:e.kind==='normal',x:e.x,z:e.z,tx:core.x,tz:core.z,enemy:e.id,amount,label:'火种受击'});e.lastActionAt=b.time;e.actionKind='breach';if(e.kind==='normal')e.dead=true;}
    return;
  }
  const hunter=e.ability==='tower_hunter'||e.ability==='siege',attackRange=hunter?(e.ability==='tower_hunter'?6:3.6):2.15;
  const advancing=hunter&&e.advanceUntil>b.time;
  const victims=aliveUnits(state).filter(u=>(hunter||!e.air&&unitStats(state,u).role==='melee')&&distance(e,unitCenter(u))<=attackRange&&(!advancing||unitStats(state,u).role==='melee'&&distance(e,unitCenter(u))<=1.5));
  victims.sort((a,c)=>{
    const ta=!b.disabled.includes(a.uid)&&unitStats(state,a).ability==='taunt'?1:0,tc=!b.disabled.includes(c.uid)&&unitStats(state,c).ability==='taunt'?1:0;
    return tc-ta||distance(e,unitCenter(a))-distance(e,unitCenter(c));
  });
  if(victims.length){aim(e,unitCenter(victims[0]),victims[0].uid,'unit');if(e.cooldown<=0){
    hitUnit(state,e,victims[0],e.attack,active);e.cooldown=e.kind==='boss'?1.4:1.15;
    // Ranged hunters and siege units fire finite volleys, then advance into the
    // defense. A repair loop outside both sides' attack ranges cannot stall a run.
    if(hunter&&!advancing){e.volleyShots=(e.volleyShots||0)+1;if(e.volleyShots>=3){e.volleyShots=0;e.advanceUntil=b.time+2.5;emit(state,{type:'warning',action:'advance',until:e.advanceUntil,x:e.x,z:e.z,enemy:e.id,label:'齐射结束 · 向火种推进'});}}
  }return;}
  if(e.root>0)return;
  let target=core;
  if(!e.air){
    if(e.pathRevision!==(state.terrain.revision||0)||e.pathIndex>=e.path.length){e.path=pathToCore(state,e.x,e.z);e.pathIndex=1;e.pathRevision=state.terrain.revision||0;}
    target=e.path[e.pathIndex]||core;
    const from={x:Math.round(e.x),z:Math.round(e.z)};
    if(Math.abs(target.x-from.x)+Math.abs(target.z-from.z)===1){const edge=edgeInfo(state,from,target);
      if(!edge.passable&&edge.barrier){
        const c=edge.barrier,key=`${c.x},${c.z}`,cell=cellAt(state,c.x,c.z);
        aim(e,c,key,'terrain');
        if(!cell.protected&&e.cooldown<=0){
          b.terrainDamage[key]=(b.terrainDamage[key]||0)+e.attack*(e.ability==='siege'?3+(e.kind==='boss'?e.phase:0):1);e.cooldown=1;
          emit(state,{type:'hit',actionKind:'terrain',stage:'release',targetId:key,targetKind:'terrain',x:e.x,z:e.z,tx:c.x,tz:c.z,enemy:e.id,label:'攻击峭壁'});
          if(b.terrainDamage[key]>=40+cell.h*12){cell.h=Math.max(0,cell.h-1);cell.ramp=-1;state.terrain.revision++;delete b.terrainDamage[key];emit(state,{type:'terrain',sourceId:e.id,sourceKind:'enemy',targetId:key,targetKind:'terrain',to:{x:c.x,z:c.z,h:cell.h},x:c.x,z:c.z,h:cell.h,label:'峭壁已破坏'});}
        }
        return;
      }
    }
  }
  let speed=e.speed*(e.slow>0?.6:1)*(e.sprintUntil>b.time?1.65:1);
  if(b.enemies.some(other=>!other.dead&&other.hasteUntil>b.time&&distance(e,other)<6))speed*=1.2;
  const dist=distance(e,target),travel=speed*dt,oldX=e.x,oldZ=e.z;
  if(dist<=travel){e.x=target.x;e.z=target.z;if(!e.air)e.pathIndex++;}
  else {e.x+=(target.x-e.x)/dist*travel;e.z+=(target.z-e.z)/dist*travel;}
  e.h=cellAt(state,e.x,e.z)?.h||0;
  const dx=e.x-oldX,dz=e.z-oldZ;e.motion={dx,dz,distance:(e.motion?.distance||0)+Math.hypot(dx,dz),time:b.time,dt};
  if(Math.abs(dx)+Math.abs(dz)>1e-9)e.facing=Math.atan2(dx,dz);
}
function towerActions(state,active,dt) {
  const b=state.battle,m=effects(state),supports=active.filter(u=>unitStats(state,u).role==='support');
  const controlDuration=difficultyProfile(state).controlDurationMultiplier;
  for(const u of [...active]){
    if(state.spirit<=0||b.bossKilled)break;
    if(u.hp<=0||b.disabled.includes(u.uid))continue;
    const s=unitStats(state,u),origin=unitCenter(u),cover=supports.filter(t=>t.hp>0&&!b.disabled.includes(t.uid)&&t.uid!==u.uid&&distance(origin,unitCenter(t))<=unitStats(state,t).range);
    const overlap=cover.length>=2?1+(m.support_overlap||0):1;
    u.temporaryArmor=(cover.length?(m.support_armor||0)*overlap:0)+(u.armorBuffUntil>b.time?3:0);
    const choirs=cover.filter(t=>unitStats(state,t).ability==='haste_aura'),haste=choirs.reduce((sum,t)=>sum+unitStats(state,t).support_value+(unitStats(state,t).effect==='strong_haste'?.12:0),0)*overlap;
    u.cooldown-=dt*(1+haste);if(s.effect==='self_repair'&&b.time-u.lastHitAt>4)u.hp=Math.min(s.hp,u.hp+dt*s.hp*.025);
    if(s.effect==='slow_aura')for(const e of b.enemies)if(!e.dead&&distance(origin,e)<=s.range)e.slow=Math.max(e.slow,.3*controlDuration);
    if(u.cooldown>0)continue;
    if(s.attack_kind==='support'){
      if(s.ability==='repair'){
        const targets=aliveUnits(state).filter(t=>t.hp<unitStats(state,t).hp&&distance(origin,unitCenter(t))<=s.range);
        targets.sort((a,c)=>{
          const threat=t=>m.triage&&b.enemies.some(e=>!e.dead&&distance(e,unitCenter(t))<4)?40:0;
          return (unitStats(state,c).hp-c.hp+threat(c))-(unitStats(state,a).hp-a.hp+threat(a));
        });
        const t=targets[0];if(t){const overlap=supports.some(other=>other.hp>0&&other.uid!==u.uid&&!b.disabled.includes(other.uid)&&distance(unitCenter(t),unitCenter(other))<=unitStats(state,other).range);let amount=s.attack*(1+(m.support_efficiency||0))*(overlap?1+(m.support_overlap||0):1);
          if(s.effect==='critical_repair'&&t.hp<unitStats(state,t).hp*.35)amount*=1.6;
          const before=t.hp;t.hp=Math.min(unitStats(state,t).hp,t.hp+amount);if(s.effect==='armor_repair')t.armorBuffUntil=b.time+3;
          emit(state,{type:'heal',actionKind:'repair',stage:'release',ability:s.ability,effect:s.effect,targetId:t.uid,targetKind:'unit',...origin,tx:unitCenter(t).x,tz:unitCenter(t).z,unit:u.uid,amount,healed:t.hp-before,armorUntil:t.armorBuffUntil||0});u.cooldown=s.rate;
        }
      }else {
        // A support pulse shares its existing cooldown; continuous aura rules
        // above remain authoritative and this silent event cannot change them.
        const global=s.ability==='bandwidth_plus'||s.ability==='resistance_plus';
        const targets=global?[]:active.filter(t=>t.uid!==u.uid&&t.hp>0&&!b.disabled.includes(t.uid)&&distance(origin,unitCenter(t))<=s.range);
        emit(state,{type:'support',sourceKind:'unit',sourceId:u.uid,unit:u.uid,...origin,actionKind:'buff',ability:s.ability,effect:s.effect,radius:global?null:s.range,global,value:s.support_value,targets:targets.map(t=>t.uid),targetKind:global?'core':'unit',targetId:global?'core':null});
        u.cooldown=s.rate;
      }
      continue;
    }
    // solveAttack is the authority for the full modified range; a separate
    // broad-phase multiplier can silently reject legal high-ground targets.
    const candidates=b.enemies.filter(e=>!e.dead&&e.hp>0);
    candidates.sort((a,c)=>u.priority==='hp'?c.hp-a.hp:u.priority==='far'?distanceToCore(state,c)-distanceToCore(state,a):distanceToCore(state,a)-distanceToCore(state,c));
    let target=null,solution=null;
    for(const e of candidates){const check=solveAttack(state,u,{...e,armor:Math.max(0,e.armor-e.armorBreak)});if(check.ok){target=e;solution=check;break;}}
    if(!target)continue;
    const multiplier=(1+haste*.5)*(u.reactivate?1+(m.reactivate_damage||0):1);
    let amount=solution.damage*multiplier;u.reactivate=false;
    const impact=hitEnemy(state,target,amount,u,active,{area:s.ability==='splash'});
    emit(state,{type:'shot',stage:'release',actionKind:s.role==='melee'?'melee':s.ability==='drone'?'drone':s.attack_kind,ability:s.ability,effect:s.effect,...origin,tx:target.x,tz:target.z,unit:u.uid,enemy:target.id,amount,kind:s.attack_kind,...impact});
    if(u.hp>0&&(s.ability==='lifesteal'||s.effect==='lifesteal_plus'))u.hp=Math.min(s.hp,u.hp+amount*(s.effect==='lifesteal_plus'?.22:.1));
    if(s.effect==='armor_break')target.armorBreak=Math.min(target.armor,target.armorBreak+2);
    if(s.effect==='root')target.root=Math.max(target.root,.65*controlDuration);
    if(s.effect==='mark')target.marked=4;
    if(s.ability==='splash'){
      const radius=(s.effect==='large_splash'?3.4:2.3)*(1+(m.indirect_radius||0));
      for(const e of b.enemies)if(e.id!==target.id&&!e.dead&&!e.air&&distance(e,target)<=radius){const splash=solveAttack(state,u,{...e,armor:Math.max(0,e.armor-e.armorBreak)});hitEnemy(state,e,splash.damage*multiplier*.65,u,active,{area:true});e.slow=1.2*controlDuration;if(s.effect==='corrosion')e.armorBreak=Math.min(e.armor,e.armorBreak+2);}
      target.slow=(s.effect==='large_splash'?2.5:1.2)*controlDuration;if(s.effect==='corrosion')target.armorBreak+=2;
    }
    if(s.effect==='chain'||s.effect==='extra_drone'){
      const second=candidates.find(e=>!e.dead&&e.id!==target.id&&(s.effect==='extra_drone'?solveAttack(state,u,e).ok:distance(e,target)<=3.5));
      if(second){const secondary=solveAttack(state,u,{...second,armor:Math.max(0,second.armor-second.armorBreak)});const impact=hitEnemy(state,second,secondary.damage*multiplier*.6,u,active);emit(state,{type:'shot',stage:'release',actionKind:s.effect==='extra_drone'?'drone':'chain',ability:s.ability,effect:s.effect,secondary:true,from:position(state,s.effect==='extra_drone'?u:target,s.effect==='extra_drone'?'unit':'enemy'),x:target.x,z:target.z,tx:second.x,tz:second.z,unit:u.uid,enemy:second.id,kind:'chain',...impact});}
    }
    if(s.effect==='pierce'){
      const dx=target.x-origin.x,dz=target.z-origin.z,len=Math.hypot(dx,dz);
      for(const e of candidates)if(!e.dead&&e.id!==target.id){const projection=((e.x-origin.x)*dx+(e.z-origin.z)*dz)/len,lineDistance=Math.abs((e.x-origin.x)*dz-(e.z-origin.z)*dx)/len;
        const secondary=solveAttack(state,u,{...e,armor:Math.max(0,e.armor-e.armorBreak)});
        if(projection>0&&projection<solution.range&&lineDistance<.7&&secondary.ok)hitEnemy(state,e,secondary.damage*multiplier*.65,u,active);}
    }
    u.cooldown=s.rate*(cover.length?1-(m.support_rate||0):1);
  }
}
export function stepBattle(state,dt=.05) {
  const b=state.battle;if(state.phase!=='battle'||!b)return {events:[],finished:null};
  if(b.result)return {events:[],finished:b.result};
  if(!Number.isFinite(dt)||dt<=0)return {events:[],finished:b.result};
  beginRulesFrame(state);
  try {
  dt=clamp(dt,0,.25);b.events=[];b.time+=dt;
  while(b.spawned<b.queue.length&&b.queue[b.spawned].at<=b.time&&b.enemies.filter(e=>!e.dead).length<100){const q=b.queue[b.spawned++];spawn(state,q.type,q.entry,q.group);}
  b.groupIndex=Math.max(0,...b.groups.filter(g=>g.at<=b.time).map(g=>g.index));
  const next=b.groups.find(g=>g.at>b.time);b.nextGroupIn=next?Math.max(0,next.at-b.time):0;
  b.jam=b.enemies.reduce((sum,e)=>sum+(!e.dead&&e.jamUntil>b.time?(e.jamStrength??(e.kind==='boss'?6:2)):0),0);
  if(b.jam)b.jam+=difficultyProfile(state).jamBonus;
  b.corrosion=b.enemies.reduce((sum,e)=>sum+(!e.dead&&e.corrosionUntil>b.time?(e.kind==='elite'?4:2):0),0);
  const bandwidth=bandwidthState(state),disabled=bandwidth.disabled;
  for(const id of b.disabled)if(!disabled.includes(id)){const u=state.units.find(t=>t.uid===id);if(u)u.reactivate=true;}
  b.disabled=disabled;if(disabled.length)state.stats.overloadSeconds+=dt;
  const active=aliveUnits(state).filter(u=>!disabled.includes(u.uid));
  towerActions(state,active,dt);
  for(const e of [...b.enemies]){
    if(state.spirit<=0||b.bossKilled)break;
    if(e.dead)continue;e.motion={dx:0,dz:0,distance:e.motion?.distance||0,time:b.time,dt};e.actionTargetId=null;e.actionTargetKind=null;e.cooldown-=dt;e.slow=Math.max(0,e.slow-dt);e.root=Math.max(0,e.root-dt);e.marked=Math.max(0,e.marked-dt);
    updateAbilities(state,e,dt,active);updateSurge(state,e,dt,active);moveEnemy(state,e,dt,active);
    if(state.spirit<=0)break;
  }
  b.enemies=b.enemies.filter(e=>!e.dead);
  const nearby=b.enemies.filter(e=>distance(e,coreOf(state))<10).length;
  const wanted=clamp(nearby*.07+b.enemies.length*.008+(1-state.spirit/state.maxSpirit)*.45+(disabled.length?.15:0)+(b.enemies.some(e=>e.kind==='boss')?.16:0),0,1);
  b.danger+=(wanted-b.danger)*(1-Math.exp(-dt/(wanted>b.danger?1.5:4)));
  if(state.spirit<=0)b.result='lost';else if(b.bossKilled||b.spawned>=b.queue.length&&b.enemies.length===0)b.result='won';
  return {events:b.events,finished:b.result};
  } finally {endRulesFrame(state);}
}
