import {TAU,clamp,smooth,ease,wheelRollAngle,wheelSupportHeight} from '../enemy-rig.js';

const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
const neutral=()=>({joints:{},root:{rotation:[0,0,0],position:[0,0,0]}});
const wheelIds=['wheelL0','wheelL1','wheelL2','wheelR0','wheelR1','wheelR2'];
const radius=.32;
const rotation=(rx=0,ry=0,rz=0)=>({rotation:[rx,ry,rz]});

function contacts(travel){
 const angle=wheelRollAngle(travel,radius),height=wheelSupportHeight(angle,radius)-radius;
 const joints={chassis:{position:[0,0,height]}};
 for(const id of wheelIds)joints[id]=rotation(angle);
 return {joints,height};
}

function shotCycle(progress,terrain){
 const p=clamp(progress);
 // battle.js delivers ordinary siege damage at the start of this action.
 // Start at the discharge, then absorb recoil before opening the feed cycle.
 const recoil=(terrain?.20:.17)*ease(p,0,.13)*(1-ease(p,.16,.57));
 const discharge=1-ease(p,0,.24);
 const reaction=ease(p,0,.09)*(1-ease(p,.13,.49));
 const index=ease(p,.26,.47);
 const lift=ease(p,.46,.70)*(1-ease(p,.83,1));
 const lock=ease(p,.67,.77)*(1-ease(p,.82,.98));
 return {recoil,discharge,reaction,index,lift,lock};
}

function wreckPose(progress,travel){
 const p=clamp(progress),unlock=ease(p,.02,.26),sag=ease(p,.18,.79),settle=ease(p,.72,1);
 const {joints,height}=contacts(travel);
 // The six rolling contacts stay supported. Failure unloads the sprung deck,
 // drops the breech in its saddle and releases one magazine journal locally.
 joints.loadFrame={position:[0,.026*sag,-.083*sag],rotation:[.029*sag,-.037*sag,0]};
 joints.powerpack={position:[-.024*sag,.018*sag,-.038*sag],rotation:[.05*sag,-.13*sag,0]};
 joints.cannonCradle=rotation(.12*sag,-.065*sag,0);
 joints.recoil={position:[0,.115*unlock,0]};
 joints.muzzle={position:[0,-.017*unlock,0]};
 joints.drum={rotation:[0,.31*unlock,0],position:[.022*sag,.018*sag,-.031*sag]};
 joints.shuttle={position:[-.12*unlock,0,-.045*sag],rotation:[0,-.08*sag,0]};
 joints.indexDrive=rotation(0,.22*unlock,0);
 joints.sight=rotation(.15*sag,0,-.035*settle);
 joints.loaderSight=rotation(.13*sag,.07*sag,0);
 joints.braceL={position:[0,0,-.104-height]};
 joints.braceR={position:[0,0,-.088-height]};
 joints.ventL=rotation(0,-.46*unlock,0);
 joints.ventR=rotation(0,.24*unlock,0);
 return {joints,root:{rotation:[0,0,0],position:[0,0,0]}};
}

export function animate(context={}){
 const action=context.action||'idle',p=clamp(finite(context.progress));
 const travel=Math.max(0,finite(context.travel));
 if(['preview','disabled','stopped','static'].includes(action))return neutral();
 if(action==='wreck')return wreckPose(1,context.reducedMotion?0:travel);
 if(action==='death')return wreckPose(context.reducedMotion?1:p,context.reducedMotion?0:travel);
 if(context.reducedMotion)return neutral();

 const moving=(action==='move'||context.moving===true)&&finite(context.speed)>0;
 const hit=clamp(finite(context.hit));
 const {joints,height}=contacts(travel);
 let recoil=0,pressure=0,discharge=0,reaction=0,index=0,lift=0,lock=0;
 let frameDrop=moving?.009:0,vent=moving?.055:0;

 if(action==='attack'){
  const cycle=shotCycle(p,context.actionKind==='terrain');
  ({recoil,discharge,reaction,index,lift,lock}=cycle);
  pressure=discharge+.42*lock;
  frameDrop+=.026*reaction;
  vent+=.25*discharge+.12*lock;
 }else if(action==='cast'){
  const windup=context.stage==='windup'||String(context.actionKind||'').includes('windup');
  // Elite siege has a real preparation warning but its ordinary ability
  // release owns no damage event. Only pressure and feed interlocks respond.
  pressure=windup?smooth(p):1-ease(p,0,.85);
  lock=.55*pressure;
  vent+=.13*pressure;
 }

 recoil+=.034*hit;
 frameDrop+=.021*hit;
 const frameReaction=.042*reaction+.023*hit;
 joints.loadFrame={position:[0,frameReaction,-frameDrop],rotation:[.018*reaction+.010*hit,0,0]};
 joints.cannonCradle=rotation(-.012*pressure+.016*hit);
 joints.recoil={position:[0,recoil,0]};
 joints.muzzle={position:[0,-.019*discharge,0]};
 joints.sight=rotation(-.025*lock+.045*hit);
 joints.drum=rotation(0,TAU/3*index,0);
 // The diagonal guide has a -60-degree tilt: X/Z = -tan(60 degrees).
 // Shuttle travel follows that measured rail, retaining its captured bearings.
 joints.shuttle={position:[-.62*lift,.016*lock,.358*lift]};
 joints.indexDrive=rotation(0,TAU*index,0);
 joints.loaderSight=rotation(-.045*lock);
 joints.ventL=rotation(0,-vent,0);
 joints.ventR=rotation(0,vent,0);

 // A planted sole stays at Z=.006 even at a nonzero wheel rim angle. During
 // the real 2.5-second advance both shoes retract while travel keeps rolling.
 const brace=moving?0:-.104-height;
 joints.braceL={position:[0,0,brace]};
 joints.braceR={position:[0,0,brace]};
 return {joints,root:{rotation:[0,0,0],position:[0,0,0]}};
}
