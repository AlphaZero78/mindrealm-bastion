import {newRun,availableNodes,enterNode,finishBattle,chooseReward,nodeAction,eventPreview} from '../../../web/core/state.js';
import {towers,relics,talents} from '../../../web/core/content.js';
import {unitStats,unitCenter,onField,placement,deploy,withdraw,repair,repairCost,upgrade,upgradeCost,bandwidthState,pathToCore,entriesOf,solveAttack,cellAt} from '../../../web/core/rules.js';
import {makeEncounter,startBattle,stepBattle} from '../../../web/core/battle.js';

const branchFor=u=>['pulse_array','focus_rail','phase_blade','bandwidth_relay','memory_mechanic','frequency_choir','resistance_beacon'].includes(u.type)?'A':'B';
const roleValue={pulse_array:100,focus_rail:85,memory_mechanic:62,bandwidth_relay:110,phase_blade:50,frequency_choir:55,drone_loom:75,arc_mortar:70,resistance_beacon:25,anchor_bulwark:40,boundary_riveter:25,resonance_guard:25};
const growValue=u=>(roleValue[u.type]||0)*(onField(u)?1.5:1)/(u.tier||1);
const knownEntrances=new WeakMap();

export function chooseReferenceReward(state) {
  const offer=state.rewardQueue[0];if(!offer)return null;
  if(offer.kind==='upgrade')return offer.options.find(id=>id.endsWith(`:${branchFor(state.units.find(u=>u.uid===offer.uid))}`))||offer.options[0];
  const value=id=>{
    if(offer.kind==='unit'){
      const count=state.units.filter(u=>u.type===id).length;
      if(id==='bandwidth_relay')return count<3?180-count*20:50;
      if(id==='memory_mechanic')return count<2?130-count*25:20;
      if(id==='frequency_choir')return count<1?90:20;
      return (roleValue[id]||0)-count*(id==='pulse_array'?5:20);
    }
    const spec=relics[id]||talents[id];return ({bandwidth:120,t1_bandwidth:110,highground_damage:105,anti_air_damage:100,direct_range:90,height_bonus:95,melee_hp:35,repair_discount:80,post_repair:70,low_spirit_damage:60,melee_guard:60,support_rate:85,support_efficiency:65,level_bandwidth:100,high_hp_damage:75,relay_cost:90,overload_buffer:85,height_rate:90}[spec?.effect]||40);
  };
  return [...offer.options].sort((a,b)=>value(b)-value(a))[0];
}

export function prepareReference(state) {
  // Every decision below uses the same public commands exposed to the player.
  // Resources, terrain, rolls, health and queues are never granted or overwritten.
  for(const u of state.units.filter(u=>u.everDeployed&&u.hp<unitStats(state,u).hp*.65).sort((a,b)=>growValue(b)-growValue(a))){
    if(state.focus>=repairCost(state,u)+12)repair(state,u.uid);
  }
  const eligible=state.units.filter(u=>u.hp>0&&u.tier<3&&(onField(u)||['pulse_array','bandwidth_relay'].includes(u.type))).sort((a,b)=>growValue(b)-growValue(a));
  for(const u of eligible){const cost=upgradeCost(state,u);if(state.focus>=cost+16)upgrade(state,u.uid,branchFor(u));}
  const encounter=makeEncounter(state),samples=[];
  for(const entry of encounter.entries){const path=pathToCore(state,entry.x,entry.z);for(let i=2;i<path.length;i+=2)samples.push({...path[i],air:false,h:cellAt(state,path[i].x,path[i].z).h,weight:entry.count/encounter.total*(.8+i/path.length)});}
  const reposition=(knownEntrances.get(state)||0)<encounter.entries.length;knownEntrances.set(state,encounter.entries.length);
  const order=state.units.filter(u=>u.hp>0&&(!onField(u)||reposition&&towers[u.type].role==='ranged')).sort((a,b)=>(roleValue[b.type]||0)*(b.tier*.55+.45)-(roleValue[a.type]||0)*(a.tier*.55+.45));
  for(const u of order){
    const stats=unitStats(state,u),live=state.units.filter(t=>onField(t)&&t.hp>0);
    const bandwidth=bandwidthState(state);if(!onField(u)&&stats.ability!=='bandwidth_plus'&&bandwidth.cap-bandwidth.used<stats.bandwidth)continue;
    if(stats.role==='melee'&&live.filter(t=>towers[t.type].role==='melee').length>=1)continue;
    if(u.type==='memory_mechanic'&&live.filter(t=>t.type===u.type).length>=2)continue;
    if(u.type==='frequency_choir'&&live.some(t=>t.type===u.type))continue;
    let best=null;
    for(let z=12;z<=32;z++)for(let x=10;x<=30;x++){
      const p=placement(state,u,x,z);if(!p.ok)continue;
      const probe={...u,x,z},center=unitCenter(probe);let score=0;
      if(stats.role==='ranged'){
        for(const target of samples){const shot=solveAttack(state,probe,target);if(shot.ok)score+=target.weight*(stats.attack/stats.rate)*(.6+shot.damage/Math.max(1,stats.attack));}
        // Cover the fire itself so a boss cannot force relocation mid-battle.
        if(solveAttack(state,probe,{x:20,z:24,h:0,air:true}).ok)score+=70;else score*=.4;
        score-=Math.hypot(center.x-20,center.z-24)*.12;
      }else if(stats.role==='support'){
        for(const ally of live){const d=Math.hypot(center.x-unitCenter(ally).x,center.z-unitCenter(ally).z);if(d<=stats.range)score+=(towers[ally.type].role==='ranged'?15:10)*(1-d/stats.range*.3);}
        score-=Math.hypot(center.x-20,center.z-24)*.5;
        if(u.type==='bandwidth_relay')score-=samples.reduce((s,p)=>s+(Math.hypot(center.x-p.x,center.z-p.z)<3?3:0),0);
      }else{
        for(const target of samples)if(Math.hypot(center.x-target.x,center.z-target.z)<stats.range)score+=target.weight*20;
        score-=Math.abs(center.z-19)*.8+Math.abs(center.x-20)*.2;
      }
      if(!best||score>best.score)best={x,z,score};
    }
    if(best&&(u.x!==best.x||u.z!==best.z))deploy(state,u.uid,best.x,best.z);
  }
}

function referenceNode(state) {
  const node=state.currentNode;
  if(node.type==='camp'){
    if(state.spirit<state.maxSpirit*.65)return nodeAction(state,'heal');
    const upgradeTarget=state.units.filter(u=>u.tier<3&&u.hp>0).sort((a,b)=>growValue(b)-growValue(a))[0];
    if(upgradeTarget)return nodeAction(state,'upgrade',{uid:upgradeTarget.uid,branch:branchFor(upgradeTarget)});
    const wounded=state.units.filter(u=>u.hp<unitStats(state,u).hp).sort((a,b)=>repairCost(state,b)-repairCost(state,a))[0];
    return wounded?nodeAction(state,'repair',{uid:wounded.uid}):nodeAction(state,'heal');
  }
  if(node.type==='workshop'){
    for(const u of state.units.filter(u=>u.everDeployed&&u.hp<unitStats(state,u).hp*.65))if(state.focus>repairCost(state,u)+20)nodeAction(state,'repair',{uid:u.uid});
    return nodeAction(state,'leave');
  }
  if(node.type==='shop'){
    const relay=node.stock.units.find(u=>!u.sold&&u.id==='bandwidth_relay');if(relay&&state.units.filter(u=>u.type==='bandwidth_relay').length<3)nodeAction(state,'buy-unit',{id:relay.key});
    if(state.focus>220){const item=node.stock.relics.find(x=>!x.sold);if(item)nodeAction(state,'buy-relic',{id:item.key});}return nodeAction(state,'leave');
  }
  if(node.type==='treasure')return nodeAction(state,'treasure',{id:node.options[0]});
  if(node.type==='event'){
    const value=p=>!p?.canChoose?-Infinity:(p.effects.focus||0)+(p.effects.spirit||0)*(state.spirit<state.maxSpirit*.7?4:1)+(p.effects.bandwidth||0)*25+(p.effects.relic?80:0)+(p.effects.free_upgrade?80:0)+(p.effects.free_upgrades||0)*80+(p.effects.resistance||0)*5;
    const choices=[eventPreview(state,0),eventPreview(state,1)];return nodeAction(state,'event',{index:value(choices[1])>value(choices[0])?1:0});
  }
  throw new Error(`Unhandled service ${node.type}`);
}

export function runReference(seed,{pressure=0,maxBattleSeconds=360,dt=.05,strategy='reference',onNode=()=>{},hooks={}}={}) {
  const state=newRun(String(seed),pressure),battles=[];let steps=0;
  while(!['won','lost'].includes(state.phase)&&steps++<300){
    if(state.phase==='map'){
      const value=n=>({camp:state.spirit<state.maxSpirit*.6?120:75,treasure:100,event:85,unknown:65,shop:state.focus>240?65:15,workshop:15,battle:45,elite:state.act===0?25:40,boss:50}[n.type]||0);
      const next=[...availableNodes(state)].sort((a,b)=>value(b)-value(a))[0];if(!next)throw new Error(`No reachable node in ${state.phase}`);const result=enterNode(state,next.id);if(!result.ok)throw new Error(result.reason);
    }else if(state.phase==='node'){const result=(hooks.node||referenceNode)(state);if(!result.ok)throw new Error(result.reason);}
    else if(state.phase==='reward'){const result=chooseReward(state,(hooks.reward||chooseReferenceReward)(state));if(!result.ok)throw new Error(result.reason);}
    else if(state.phase==='prep'){
      if(strategy==='reference'||strategy==='defensive'||strategy==='opening'&&state.act===0&&state.floor===0)(hooks.prepare||prepareReference)(state);startBattle(state);while(!state.battle.result&&state.battle.time<maxBattleSeconds)stepBattle(state,dt);
      if(!state.battle.result)throw new Error(`Battle timed out ${seed} ${state.currentNode.id}, ${state.battle.enemies.map(e=>`${e.type}:${Math.round(e.hp)}@${e.x.toFixed(1)},${e.z.toFixed(1)}`).join(',')}`);
      battles.push({act:state.act,floor:state.floor,type:state.currentNode.type,result:state.battle.result,seconds:state.battle.time,spirit:state.spirit,units:state.units.filter(onField).length,focus:state.focus});
      finishBattle(state,{won:state.battle.result==='won'});onNode(state,battles.at(-1));
    }else throw new Error(`Unexpected phase ${state.phase}`);
  }
  if(!['won','lost'].includes(state.phase))throw new Error(`Run exceeded finite node/reward bound: ${state.phase}`);
  return {state,battles};
}
