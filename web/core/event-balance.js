import {eventStories} from './event-stories.js';

/** Preserve old run amounts; current runs receive larger, explicit exchanges. */
export function eventChoice(state,event,index){
 const choice=event?.choices[index];if(!choice)return null;
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
 return {...choice,effects,label:eventStories[event.id]?.choices[index]?.label||choice.label};
}
