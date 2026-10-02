import {nodeAction,eventPreview,servicePrice} from '../../../web/core/state.js';
import {towers,relics,talents} from '../../../web/core/content.js';
import {unitStats,unitCenter,onField,placement,deploy,repair,repairCost,upgrade,upgradeCost,bandwidthState,pathToCore,solveAttack,cellAt,coreOf} from '../../../web/core/rules.js';
import {makeEncounter} from '../../../web/core/battle.js';

// A fixed alternative policy, shared by every seed and difficulty. It trades
// relay-A expansion and concentrated fire for fronts, maintenance and jam slack.
// All mutations use public game commands; no inventory, resources, random state,
// terrain, durability or combat values are assigned by this strategy.
const value={anchor_bulwark:105,resonance_guard:100,phase_blade:70,boundary_riveter:85,pulse_array:95,focus_rail:80,arc_mortar:75,drone_loom:85,bandwidth_relay:120,memory_mechanic:115,frequency_choir:70,resistance_beacon:65};
const branches={anchor_bulwark:'B',resonance_guard:'A',phase_blade:'A',boundary_riveter:'A',pulse_array:'B',focus_rail:'B',arc_mortar:'A',drone_loom:'A',bandwidth_relay:'B',memory_mechanic:'B',frequency_choir:'B',resistance_beacon:'B'};
const knownEntrances=new WeakMap();
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const living=state=>state.units.filter(unit=>onField(unit)&&unit.hp>0);
const role=unit=>towers[unit.type].role;
const branchFor=unit=>unit.branch||branches[unit.type]||'A';
const growthValue=unit=>(value[unit.type]||0)*(onField(unit)?1.6:1)/(unit.tier||1);
const supportLimit=type=>({bandwidth_relay:2,memory_mechanic:2,frequency_choir:1,resistance_beacon:1})[type]??Infinity;

function rewardValue(state,id,kind='unit'){
  if(kind==='unit'){
    const amount=state.units.filter(unit=>unit.type===id).length;
    if(amount>=supportLimit(id))return -100-amount;
    if(id==='bandwidth_relay')return amount===0?180:125;
    if(id==='memory_mechanic')return amount===0?165:135;
    const melee=state.units.filter(unit=>role(unit)==='melee').length;
    return (value[id]||0)-amount*24+(towers[id].role==='melee'&&melee<3?40:0);
  }
  const effect=(relics[id]||talents[id])?.effect;
  return ({melee_hp:125,melee_guard:115,repair_discount:120,post_repair:115,support_efficiency:110,overload_buffer:125,bandwidth:100,level_bandwidth:95,relay_cost:90,melee_post_repair:110,support_rate:100,anti_air_damage:100,highground_damage:80,direct_range:75,high_hp_damage:70,height_bonus:65}[effect]||45);
}
export function chooseDefensiveReward(state){
  const offer=state.rewardQueue[0];if(!offer)return null;
  if(offer.kind==='upgrade'){const unit=state.units.find(candidate=>candidate.uid===offer.uid);return offer.options.find(id=>id.endsWith(`:${branchFor(unit)}`))||offer.options[0];}
  return [...offer.options].sort((a,b)=>rewardValue(state,b,offer.kind)-rewardValue(state,a,offer.kind))[0];
}

function repairDefenses(state,viaNode=false){
  const injured=state.units.filter(unit=>unit.everDeployed&&unit.hp<unitStats(state,unit).maxHp*(role(unit)==='melee'||unit.type==='memory_mechanic'?.85:.65)).sort((a,b)=>growthValue(b)-growthValue(a));
  for(const unit of injured)if(state.focus>=repairCost(state,unit)+20){if(viaNode)nodeAction(state,'repair',{uid:unit.uid});else repair(state,unit.uid);}
}

export function prepareDefensive(state){
  repairDefenses(state);
  const encounter=makeEncounter(state),core=coreOf(state),samples=[],lanes=[];
  for(const entry of encounter.entries){
    const route=pathToCore(state,entry.x,entry.z);
    const candidates=route.filter(point=>distance(point,core)>=6&&distance(point,core)<=12);
    const anchor=[...candidates].sort((a,b)=>Math.abs(distance(a,core)-8)-Math.abs(distance(b,core)-8))[0]||route[Math.floor(route.length*.65)]||entry;
    lanes.push({entry:entry.id,anchor,weight:entry.count/encounter.total});
    for(let i=2;i<route.length;i+=3){const point=route[i];samples.push({...point,air:false,h:cellAt(state,point.x,point.z).h,entry:entry.id,weight:entry.count/encounter.total});}
  }
  const desiredMelee=encounter.entries.length>=3?3:2,reserve=encounter.entries.length>=3?3:2;
  const eligible=state.units.filter(unit=>unit.hp>0&&unit.tier<3&&(onField(unit)||['anchor_bulwark','bandwidth_relay','memory_mechanic'].includes(unit.type))).sort((a,b)=>growthValue(b)-growthValue(a));
  for(const unit of eligible){if(!onField(unit)&&living(state).filter(other=>other.type===unit.type).length>=supportLimit(unit.type))continue;const cost=upgradeCost(state,unit);if(state.focus>=cost+24)upgrade(state,unit.uid,branchFor(unit));}
  const reposition=(knownEntrances.get(state)||0)<encounter.entries.length;knownEntrances.set(state,encounter.entries.length);
  const available=state.units.filter(unit=>unit.hp>0&&(!onField(unit)||reposition));
  // Establish a relay and front first, then two anti-air shooters, maintenance,
  // remaining fronts and supporting fire. Sorting is stable and deterministic.
  const ranged=available.filter(unit=>role(unit)==='ranged').sort((a,b)=>(value[b.type]||0)-(value[a.type]||0));
  const melee=available.filter(unit=>role(unit)==='melee').sort((a,b)=>(value[b.type]||0)-(value[a.type]||0));
  // A repaired front returns to storage. Existing healthy shooters already
  // meet the opening quota; new shooters must not consume that front's slot.
  const openingShooters=ranged.filter(unit=>!onField(unit)).slice(0,Math.max(0,2-living(state).filter(unit=>role(unit)==='ranged').length));
  const order=[...available.filter(unit=>unit.type==='bandwidth_relay'),...melee.slice(0,1),...openingShooters,...available.filter(unit=>unit.type==='memory_mechanic'),...melee.slice(1),...ranged.filter(unit=>!openingShooters.includes(unit)),...available.filter(unit=>role(unit)==='support'&&!['bandwidth_relay','memory_mechanic'].includes(unit.type))];
  for(const unit of order){
    const stats=unitStats(state,unit),allies=living(state).filter(other=>other!==unit),bw=bandwidthState({...state,battle:null});
    if(!onField(unit)&&stats.ability!=='bandwidth_plus'&&bw.cap-bw.used<stats.bandwidth+reserve)continue;
    if(role(unit)==='melee'&&allies.filter(other=>role(other)==='melee').length>=desiredMelee)continue;
    if(allies.filter(other=>other.type===unit.type).length>=supportLimit(unit.type))continue;
    const targetLane=[...lanes].sort((a,b)=>{
      const coverage=lane=>allies.filter(other=>role(other)===role(unit)&&distance(unitCenter(other),lane.anchor)<7).length;
      return b.weight/(1+coverage(b)*2)-a.weight/(1+coverage(a)*2);
    })[0];
    let best=null;
    for(let z=10;z<=34;z++)for(let x=8;x<=32;x++){
      if(!placement(state,unit,x,z).ok)continue;
      const probe={...unit,x,z},center=unitCenter(probe),fronts=allies.filter(other=>role(other)==='melee');let score=0;
      if(stats.role==='melee'){
        score-=distance(center,targetLane.anchor)*8;
        for(const sample of samples)if(distance(center,sample)<=stats.range)score+=sample.weight*18;
        for(const other of fronts)score-=Math.max(0,4-distance(center,unitCenter(other)))*14;
        for(const other of allies.filter(other=>other.type==='memory_mechanic'))if(distance(center,unitCenter(other))<unitStats(state,other).range)score+=8;
      }else if(stats.role==='ranged'){
        for(const sample of samples){const shot=solveAttack(state,probe,sample);if(shot.ok)score+=sample.weight*(sample.entry===targetLane.entry?2:0.7)*12;}
        if(solveAttack(state,probe,{...core,h:0,air:true}).ok)score+=12;
        const frontDistance=distance(center,targetLane.anchor);score-=Math.abs(frontDistance-4)*3;
        for(const other of allies.filter(other=>role(other)==='ranged'))score-=Math.max(0,3.5-distance(center,unitCenter(other)))*6;
      }else{
        for(const ally of allies){const separation=distance(center,unitCenter(ally));if(separation>stats.range)continue;
          const maintained=allies.some(other=>other.type==='memory_mechanic'&&distance(unitCenter(other),unitCenter(ally))<=unitStats(state,other).range);
          score+=(unit.type==='memory_mechanic'?(role(ally)==='melee'?32:12)*(maintained?.3:1):14)*(1-separation/stats.range*.25);
        }
        if(unit.type==='bandwidth_relay'){score=-distance(center,core);for(const sample of samples)score-=Math.max(0,4-distance(center,sample))*sample.weight*10;}
        else{score-=Math.max(0,distance(center,core)-8)*2;for(const sample of samples)score-=Math.max(0,2.5-distance(center,sample))*sample.weight*4;}
      }
      if(!best||score>best.score)best={x,z,score};
    }
    if(best&&(unit.x!==best.x||unit.z!==best.z))deploy(state,unit.uid,best.x,best.z);
  }
}

export function defensiveNode(state){
  const node=state.currentNode;
  if(node.type==='camp'){
    if(state.spirit<state.maxSpirit*.7)return nodeAction(state,'heal');
    const injured=state.units.filter(unit=>unit.everDeployed&&unit.hp<unitStats(state,unit).maxHp*.85).sort((a,b)=>growthValue(b)-growthValue(a))[0];
    if(injured)return nodeAction(state,'repair',{uid:injured.uid});
    const target=state.units.filter(unit=>unit.hp>0&&unit.tier<3).sort((a,b)=>growthValue(b)-growthValue(a))[0];
    return target?nodeAction(state,'upgrade',{uid:target.uid,branch:branchFor(target)}):nodeAction(state,'heal');
  }
  if(node.type==='workshop'){repairDefenses(state,true);return nodeAction(state,'leave');}
  if(node.type==='shop'){
    const wanted=node.stock.units.filter(item=>!item.sold&&state.units.filter(unit=>unit.type===item.id).length<supportLimit(item.id)).sort((a,b)=>rewardValue(state,b.id)-rewardValue(state,a.id))[0];
    if(wanted&&rewardValue(state,wanted.id)>=90&&state.focus>=servicePrice(state,80)+35)nodeAction(state,'buy-unit',{id:wanted.key});
    const item=node.stock.relics.filter(item=>!item.sold&&!state.relics.includes(item.id)).sort((a,b)=>rewardValue(state,b.id,'relic')-rewardValue(state,a.id,'relic'))[0];
    if(item&&state.focus>=servicePrice(state,120)+40)nodeAction(state,'buy-relic',{id:item.key});return nodeAction(state,'leave');
  }
  if(node.type==='treasure'){const id=[...node.options].sort((a,b)=>rewardValue(state,b,'relic')-rewardValue(state,a,'relic'))[0];return nodeAction(state,'treasure',{id});}
  if(node.type==='event'){
    const value=preview=>!preview?.canChoose?-Infinity:(preview.effects.spirit||0)*(state.spirit<state.maxSpirit*.75?5:2)+(preview.effects.focus||0)+(preview.effects.bandwidth||0)*25+(preview.effects.resistance||0)*15+(preview.effects.relic?75:0)+(preview.effects.free_upgrade?65:0)+(preview.effects.free_upgrades||0)*65;
    const previews=[eventPreview(state,0),eventPreview(state,1)];return nodeAction(state,'event',{index:value(previews[1])>value(previews[0])?1:0});
  }
  throw new Error(`Unhandled defensive service ${node.type}`);
}
export const defensiveHooks=Object.freeze({prepare:prepareDefensive,reward:chooseDefensiveReward,node:defensiveNode});
