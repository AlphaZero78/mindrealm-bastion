import {clamp,ease,fract,pulse,smooth,stroke,TAU,wheelRollAngle,wheelSupportHeight} from '../enemy-rig.js';

const WHEELS=['FL','FR','RL','RR'],R=.35;
const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;

/** Pure presentation for the passive-armoured short-stroke wagon. */
export function animate(context={}){
 const action=context.action||'idle',dead=action==='death'||action==='wreck';
 if(['preview','static','disabled','stopped'].includes(action))return {joints:{}};
 if(context.reducedMotion&&!dead)return {joints:{}};
 const p=dead&&(action==='wreck'||context.reducedMotion)?1:clamp(finite(context.progress));
 const travel=Math.max(0,finite(context.travel));
 const moving=!dead&&(context.moving===true||action==='move');
 // A paused simulation keeps travel, clock and action progress fixed. Wheel
 // orientation is retained even when the action label returns to idle.
 const angle=dead&&context.reducedMotion?0:wheelRollAngle(travel,R);
 const support=wheelSupportHeight(angle,R)-R;
 const joints={chassis:{position:[0,0,support]}};
 for(const id of WHEELS)joints['wheel'+id]={rotation:[angle,0,0]};

 if(dead){
  const loss=ease(p,.04,.84),unlatch=ease(p,.16,.92);
  joints.loadFrame={position:[0,.047*loss,-.17*loss],rotation:[.038*loss,0,0]};
  joints.pressRam={position:[0,-.10*loss,-.018*loss],rotation:[.15*loss,0,0]};
  joints.compressionL={position:[0,.075*loss,0]};
  joints.compressionR={position:[0,.075*loss,0]};
  joints.hood={position:[0,.026*unlatch,-.025*unlatch],rotation:[-.17*unlatch,.07*unlatch,-.04*unlatch]};
  joints.sight={rotation:[.54*unlatch,0,0]};
  joints.ventL={rotation:[.13*loss,-.36*unlatch,0]};
  joints.ventR={rotation:[.13*loss,.36*unlatch,0]};
  return {joints};
 }

 const hit=action==='hit'?1-smooth(p):clamp(finite(context.hit));
 const attacking=action==='attack'||action==='breach';
 const terrain=context.actionKind==='terrain';
 // Rim seam loading follows distance. It is carried by the sprung frame,
 // while the chassis and all tyre contacts follow the support function.
 const seam=moving?1-smooth(Math.abs(fract(angle/TAU*12)-.5)*2):0;
 let compression=moving?.006+.004*seam:0,frameY=0,framePitch=0;
 let ram=0,pressure=0,contact=0,vent=0;
 if(attacking){
  const work=stroke(p,.23,.40);
  ram=-(terrain?.305:.27)*work;
  pressure=pulse(p,0,.23,.77);
  contact=pulse(p,.31,.40,.73);
  compression+=.025*pressure+.019*contact;
  frameY+=.045*contact;
  framePitch+=.018*contact;
  vent=.14*pressure;
 }
 // Armour is always present. A cast action has no secondary mechanism for
 // this enemy; battle.js supplies no armored warning or release event.
 ram+=.033*hit;
 compression+=.024*hit;
 frameY+=.028*hit;
 framePitch+=.015*hit;
 joints.loadFrame={position:[0,frameY,-compression],rotation:[framePitch,0,0]};
 joints.pressRam={position:[0,ram,0]};
 joints.compressionL={position:[0,-.052*pressure,0]};
 joints.compressionR={position:[0,-.052*pressure,0]};
 joints.sight={rotation:[-.02*contact+.04*hit,0,0]};
 joints.ventL={rotation:[0,-vent,0]};
 joints.ventR={rotation:[0,vent,0]};
 return {joints};
}
