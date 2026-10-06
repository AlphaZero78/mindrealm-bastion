import {eventStory} from './event-stories.js';
import {eventFor,seededRandom,towers} from './content.js';
import {eventClues} from './event-redesign.js';
import {unitStats} from './rules.js';

export const eventModifierInfo=Object.freeze({
 repair_discount:['永久维修折扣',true],upgrade_discount:['永久升阶折扣',true],move_discount:['永久搬迁折扣',true],terrain_discount:['永久地形折扣',true],
 tower_damage_bonus:['全部构造攻击',true],ranged_attack:['远程构造攻击',true],melee_armor:['近战构造护甲',false],support_range:['支援基础范围',true],pressure_mult:['敌人死亡压力',true]
});

/** Preserve old run amounts; current runs receive larger, explicit exchanges. */
export function eventChoice(state,event,index){
 event=event&&eventFor(state,event.id);const choice=event?.choices[index];if(!choice)return null;
 if((state.difficultyRevision||1)>=5)return {...choice,effects:{...choice.effects}};
 const effects={...choice.effects},modern=(state.difficultyRevision||1)>=4;
 if(modern){
  const act=event.act-1,risk=1.5+act*.15,reward=1.6+act*.2;
  for(const key of ['spirit','focus','bandwidth','resistance','xp','max_spirit'])if(effects[key]){
   const value=effects[key],factor=value<0?risk:reward,step=key==='focus'?5:1;
   effects[key]=Math.sign(value)*Math.max(step,Math.round(Math.abs(value)*factor/step)*step);
  }
  for(const key of ['tower_hp','repair_all','repair_discount','tower_damage_bonus'])if(effects[key])effects[key]=Math.min(key==='repair_all'?1:.9,Math.round(effects[key]*reward*100)/100);
  for(const key of ['tower_damage','pressure_mult'])if(effects[key])effects[key]=Math.min(.9,Math.round(effects[key]*risk*100)/100);
  if(effects.free_upgrade){delete effects.free_upgrade;effects.free_upgrades=2;}
  else if(effects.free_upgrades)effects.free_upgrades=Math.min(3,effects.free_upgrades+1);
  if(effects.free_repairs)effects.free_repairs=Math.min(4,effects.free_repairs+1);
  if(effects.capacity)effects.capacity+=1;
  if(effects.relic)effects.max_spirit=(effects.max_spirit||0)+6+act*2;
  if(effects.unit||effects.unit_t2)effects.bandwidth=(effects.bandwidth||0)+2;
  if(effects.item){if(effects.focus<0)effects.spirit=(effects.spirit||0)+10+act*4;else effects.focus=(effects.focus||0)+15+act*10;}
 }
 return {...choice,effects,label:eventStory(state,event.id)?.choices[index]?.label||choice.label};
}

export function eventResolution(state,choice,index){
 const outcomes=choice.risk;if(!outcomes?.length)return {effects:{...choice.effects},title:choice.title,text:choice.text};
 const data=state.currentNode.eventData,roll=data.rolls?.[index]??seededRandom(`${state.seed}:event-risk:${state.currentNode.id}:${index}`)();
 let remaining=roll*outcomes.reduce((sum,outcome)=>sum+outcome.weight,0),selected=outcomes.at(-1);
 for(const outcome of outcomes){remaining-=outcome.weight;if(remaining<0){selected=outcome;break;}}
 const effects={...choice.effects};for(const [key,value] of Object.entries(selected.effects))effects[key]=typeof value==='number'?(effects[key]||0)+value:value;
 return {effects,title:selected.title||choice.title,text:selected.text||choice.text};
}
export function eventRequirements(state,choice){
 const requirement=choice.requires||{},rows=[],alive=state.units.filter(u=>u.hp>0),add=(met,text)=>rows.push({met,text});
 if(requirement.depth)add(state.depth>=requirement.depth,`需要精神深度 ${requirement.depth}（当前 ${state.depth}）`);
 if(requirement.resistance)add(state.resistance>=requirement.resistance,`需要基础抗性 ${requirement.resistance}（当前 ${state.resistance}）`);
 if(requirement.role){const count=alive.filter(u=>towers[u.type].role===requirement.role).length;add(count>=requirement.count,`需要 ${requirement.count} 座存活${{melee:'近战',ranged:'远程',support:'支援'}[requirement.role]}（当前 ${count}）`);}
 if(requirement.tier){const count=alive.filter(u=>u.tier>=requirement.tier).length;add(count>=requirement.count,`需要 ${requirement.count} 座 T${requirement.tier} 以上存活构造（当前 ${count}）`);}
 if(requirement.distinct_roles){const count=new Set(alive.map(u=>towers[u.type].role)).size;add(count>=requirement.distinct_roles,`需要近战、远程、支援三类存活构造（当前 ${count} 类）`);}
 if(requirement.damaged){const count=state.units.filter(u=>u.hp<unitStats(state,u).maxHp).length;add(count>=requirement.damaged,`需要受损构造（当前 ${count} 座）`);}
 if(requirement.injured)add(state.spirit<state.maxSpirit,'需要火种尚未恢复至上限');
 const clue=choice.effects.consume_clue;if(clue)add((state.eventClues||[]).includes(clue),`需要线索：${eventClues[clue].name}`);
 return rows;
}
