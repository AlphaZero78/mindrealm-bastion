const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const fraction=value=>((value%1)+1)%1;
const keyOf=(entity,kind)=>`${kind}:${kind==='unit'?entity.uid:entity.id}`;
const angleTo=(from,to)=>Number.isFinite(to?.x)&&Number.isFinite(to?.z)?Math.atan2(to.x-from.x,to.z-from.z):null;
const actionOf=kind=>['melee','direct','indirect','drone','chain','ranged','siege','terrain','breach','attack'].includes(kind)?'attack':['repair','heal','buff','phase','cast','ability-release','surge-release'].includes(kind)?'cast':kind;

/** Presentation state only. Combat seconds drive every action, hit and corpse.
 * This class never writes to a run, draws randomness or advances the simulation. */
export class EntityMotion {
 constructor(){this.reset();}
 reset(){this.clock=0;this.state=null;this.battle=null;this.tracks=new Map();this.deaths=[];this.serial=0;}
 update(state,events=[],wallTime=0,interpolation=1){
  const battle=state?.battle||null,nextClock=battle?Math.max(0,(battle.time||0)-(1-interpolation)*.05)*1000:wallTime;
  if(this.state!==state||this.battle!==battle||nextClock<this.clock){this.reset();this.state=state;this.battle=battle;}
  this.clock=nextClock;
  this.interpolation=interpolation;
  const present=new Set();
  for(const [kind,list] of [['unit',state?.units||[]],['enemy',battle?.enemies||[]]])for(const entity of list){
   if(kind==='unit'&&(entity.x==null||entity.z==null))continue;
   const key=keyOf(entity,kind);present.add(key);let track=this.tracks.get(key);
   if(!track){track={kind,entity:{...entity},hp:entity.hp,hitAt:-Infinity,spawnAt:-Infinity,actionAt:-Infinity,action:'idle',stage:null,facing:entity.facing||0};this.tracks.set(key,track);}
   if(entity.hp<track.hp)track.hitAt=this.clock;
   if(kind==='enemy'&&track.hp>0&&(entity.hp<=0||entity.dead))this.addDeath(entity,this.clock);
   track.hp=entity.hp;track.entity={...entity};
   if(Number.isFinite(entity.facing))track.facing=entity.facing;
  }
  for(const event of events){
   const at=Number.isFinite(event.time)?event.time*1000:this.clock,sourceKey=`${event.sourceKind}:${event.sourceId}`,track=this.tracks.get(sourceKey);
   if(track&&!event.secondary&&['attack','cast','buff','heal','phase'].includes(event.action)){
    track.actionAt=at;track.action=event.action;track.stage=event.stage;
    const facing=Number.isFinite(event.facing)?event.facing:angleTo(event.from,event.to);if(Number.isFinite(facing))track.facing=facing;
   }
   const target=this.tracks.get(`${event.targetKind}:${event.targetId}`);
   if(target&&['shot','hit'].includes(event.type)&&event.stage!=='launch')target.hitAt=at;
   if(event.action==='spawn'&&track)track.spawnAt=at;
   if(event.action==='death'&&event.entity&&event.sourceKind==='enemy')this.addDeath(event.entity,at);
  }
  for(const [key,track]of this.tracks)if(!present.has(key)){
   // A kill can remove the entity before the next paint. Its explicit death
   // event is the authority; disappearing on a view switch is not a death.
   this.tracks.delete(key);
  }
  this.deaths=this.deaths.filter(death=>this.clock-death.at<650);
 }
 addDeath(entity,at){
  const existing=this.deaths.find(death=>death.entity.id===entity.id);if(existing){existing.entity={...existing.entity,...entity};existing.at=Math.min(existing.at,at);return;}
  this.deaths.push({entity:{...entity},at});if(this.deaths.length>48)this.deaths.splice(0,this.deaths.length-48);
 }
 sample(entity,kind,{reducedMotion=false,ghost=false,variants=['T1']}={}){
  const track=this.tracks.get(keyOf(entity,kind)),clock=this.clock/1000;
  const variant=kind==='unit'?`T${entity.tier||1}${(entity.tier||1)>1?(entity.branch||'A'):''}`:variants.length>1?`phase${clamp(entity.phase||0,0,2)+1}`:'base';
  const variantIndex=Math.max(0,variants.indexOf(variant));
  const facing=Number.isFinite(entity.facing)?entity.facing:track?.facing??entity.direction??0;
  const disabled=entity.disabled||(kind==='unit'&&this.battle?.disabled?.includes(entity.uid));
  const inactive=ghost||entity.hp<=0||entity.dead||disabled;
  let action='idle',progress=0,pose=0;
  const hitAt=Math.max(track?.hitAt??-Infinity,Number.isFinite(entity.lastHitAt)?entity.lastHitAt*1000:-Infinity);
  const hit=!inactive?clamp(1-(this.clock-hitAt)/170,0,1):0;
  const stateAt=Number.isFinite(entity.lastActionAt)?entity.lastActionAt*1000:-Infinity;
  const lastAt=Math.max(track?.actionAt??-Infinity,stateAt),age=(this.clock-lastAt)/1000;
  const lastKind=actionOf(stateAt>=(track?.actionAt??-Infinity)?(entity.actionKind||entity.lastActionKind||'idle'):(track?.action||'idle'));
  const castUntil=Math.max(entity.pushWarningUntil||0,entity.surgeWarningUntil||0,Number.isFinite(entity.castUntil)?entity.castUntil:entity.warningUntil||0);
  const windup=kind==='enemy'&&castUntil>clock;
  if(!inactive){
   if(windup){action='cast';progress=clamp(1-(castUntil-clock)/1.5,0,1);pose=8;}
   else if(age>=0&&age<.42&&['attack','cast','buff','heal','phase'].includes(lastKind)){
    action=['buff','heal','phase','cast'].includes(lastKind)?'cast':'attack';progress=age/.42;
    pose=action==='cast'?9:age<.07?5:age<.18?6:7;
   }else if(kind==='enemy'&&entity.motion&&Math.hypot(entity.motion.dx||0,entity.motion.dz||0)>.00001){
    action='move';progress=fraction(((entity.motion.distance||0)-Math.hypot(entity.motion.dx||0,entity.motion.dz||0)*(1-this.interpolation))/1.5);pose=1+Math.floor(progress*4);
   }else if(kind==='enemy'&&entity.air){action='hover';progress=fraction(clock*.8+(Number(String(entity.id).replace(/\D/g,''))||0)*.17);pose=1+Math.floor(progress*4);}
  }
  if(reducedMotion){if(action==='move'||action==='hover'){pose=0;progress=0;}else if(action==='attack'){pose=6;progress=0;}else if(action==='cast'){progress=0;}}
  if(inactive){action=ghost?'preview':disabled?'disabled':'wreck';pose=0;progress=0;}
  return {key:keyOf(entity,kind),clock:this.clock,action,pose,progress,variant,variantIndex,row:variantIndex*10+pose,facing,hit:reducedMotion?0:hit,spawn:track&&!reducedMotion&&!inactive?clamp(1-(this.clock-track.spawnAt)/350,0,1):0};
 }
 snapshot(){return {clock:this.clock,tracked:this.tracks.size,deaths:this.deaths.map(d=>({id:d.entity.id,age:this.clock-d.at}))};}
}
