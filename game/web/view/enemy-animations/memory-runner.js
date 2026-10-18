import {clamp,ease,fract,pulse,smooth,stroke} from '../enemy-rig.js';

const HIP_Z=.84,ANKLE_Z=.12;
const UPPER=Math.hypot(.18,.38),LOWER=Math.hypot(.225,.34);
const REST_HIP=Math.atan2(.18,.38);
const REST_KNEE=-Math.atan2(.225,.34)-REST_HIP;
const CYCLE_DISTANCE=.80,DUTY=.68,STRIDE=CYCLE_DISTANCE*DUTY;
const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
const legs=[['FL',-.55,0],['FR',-.55,.5],['RL',.55,.5],['RR',.55,0]];

function footCycle(phase,y,sprint){
 const p=fract(phase),stance=p<DUTY,t=stance?p/DUTY:(p-DUTY)/(1-DUTY);
 return {
  y:y-.045+(stance?STRIDE*(t-.5):STRIDE*(.5-smooth(t))),
  z:ANKLE_Z+(stance?0:(.13+.045*sprint)*4*t*(1-t)),
  load:stance?pulse(t,0,.20,.54):0,
  pitch:0,stance,
 };
}
const planted=y=>({y:y-.045,z:ANKLE_Z,pitch:0,load:0,stance:true});

// Invert the complete chest transform around its authored pivot before the
// two-link solve. Front and rear hips consequently keep separate true contacts
// when the hull pitches; a shared ankle-height approximation would slide them.
function solveLeg(foot,hipY,body){
 const c=Math.cos(body.pitch),s=Math.sin(body.pitch);
 const y=foot.y-body.y,z=foot.z-HIP_Z-body.z;
 const localY=y*c+z*s,localZ=HIP_Z-y*s+z*c;
 const dy=localY-hipY,dz=HIP_Z-localZ;
 const distance=clamp(Math.hypot(dy,dz),Math.abs(UPPER-LOWER)+.001,UPPER+LOWER-.001);
 const hip=Math.atan2(dy,dz)+Math.acos(clamp((UPPER*UPPER+distance*distance-LOWER*LOWER)/(2*UPPER*distance),-1,1));
 const knee=-(Math.PI-Math.acos(clamp((UPPER*UPPER+LOWER*LOWER-distance*distance)/(2*UPPER*LOWER),-1,1)));
 const hipDelta=hip-REST_HIP,kneeDelta=knee-REST_KNEE;
 return {hip:hipDelta,knee:kneeDelta,ankle:foot.pitch-body.pitch-hipDelta-kneeDelta};
}

/** Pure mechanism pose. Clock and ability seconds never fabricate travel. */
export function animate(context={}){
 const action=context.action||'idle';
 if(['preview','static','stopped','disabled'].includes(action))return {joints:{}};
 const dead=action==='death'||action==='wreck',reduced=context.reducedMotion===true;
 const q=action==='wreck'||reduced?1:clamp(finite(context.progress));
 const moving=!dead&&!reduced&&(action==='move'||context.moving===true);
 const sprinting=!dead&&context.sprinting===true&&(!context.ability||context.ability==='sprint');
 const elapsed=Math.max(0,finite(context.abilityElapsed,.25));
 const remaining=Math.max(0,finite(context.abilityRemaining,sprinting?2.5:0));
 const sprint=sprinting?(reduced?1:ease(elapsed,0,.20)*ease(remaining,0,.24)):0;
 const travel=Math.max(0,finite(context.travel));
 const phase=fract(travel/CYCLE_DISTANCE);
 const feet=legs.map(([,y,offset])=>moving?footCycle(phase+offset,y,sprint):planted(y));
 const body={y:(moving?-.018:0)-.026*sprint,z:(moving?-.026-.018*Math.max(...feet.map(f=>f.load)):0)-.065*sprint,pitch:(moving?.025:0)+.085*sprint};
 let punch=0,punchPitch=0,clutch=.065*sprint,clutchAngle=.38*sprint,vent=.20*sprint;
 let governor=reduced?0:travel*10;

 if(action==='attack'){
  const work=stroke(q,.23,.44),load=pulse(q,0,.23,.62),impact=pulse(q,.30,.44,.77);
  punch=-.22*work;
  body.y+=.055*impact;
  body.z-=.054*load;
  body.pitch+=.048*work;
  clutchAngle+=.18*load;
  vent+=.12*impact;
 }else if(action==='cast'&&(!context.ability||context.ability==='sprint')){
  const windup=context.stage==='windup'||String(context.actionKind||'').includes('windup');
  if(windup){
   const charge=smooth(q);
   body.z-=.075*charge;body.y-=.022*charge;body.pitch+=.08*charge;
   punch=.075*charge;clutch=-.026*charge;clutchAngle=-.58*charge;vent=.46*charge;
   governor-=Math.PI*.75*charge;
  }else{
   const release=1-ease(q,.16,.74),engage=pulse(q,0,.18,.74);
   body.z-=.075*release;body.y-=.022*release;body.pitch+=.08*release;
   punch=.075*(1-ease(q,0,.24));
   clutch+=-.026*(1-ease(q,0,.14))+.08*engage;
   clutchAngle+=-.58*(1-ease(q,0,.18))+.28*engage;
   vent+=.46*release;
   governor-=Math.PI*.75*(1-ease(q,0,.26));
  }
 }

 const hit=dead||reduced?0:action==='hit'?1-smooth(q):clamp(finite(context.hit));
 if(hit>0){body.y+=.047*hit;body.z-=.035*hit;body.pitch-=.042*hit;punch+=.04*hit;vent+=.16*hit;}
 if(dead){
  const unload=ease(q,.04,.76);
  // Keep the front knee shell above the floor even when death catches its
  // foot at the furthest forward stance contact.
  body.y=.015*unload;body.z=-.25*unload;body.pitch=.12*ease(q,.20,.91);
  // Preserve each last travel contact. A foot already in recovery drops to
  // the floor before the links unload; supporting feet retain their Y contact.
  for(let i=0;i<legs.length;i++){
   const [,y,offset]=legs[i],foot=footCycle(phase+offset,y,0);
   feet[i]={...foot,z:ANKLE_Z+(foot.z-ANKLE_Z)*(1-ease(q,0,.32))};
  }
  punch=.06*unload;punchPitch=.10*unload;clutch=.065*unload;clutchAngle=.67*unload;vent=.62*unload;
 }
 if(action==='idle'&&!sprinting&&hit===0&&!moving)return {joints:governor?{governor:{rotation:[governor,0,0]}}:{}};
 const joints={
  chassis:{rotation:[body.pitch,0,0],position:[0,body.y,body.z]},
  punch:{rotation:[punchPitch,0,0],position:[0,punch,0]},
  governor:{rotation:[governor,0,0]},
  clutch:{rotation:[clutchAngle,0,0],position:[clutch,0,0]},
  ventL:{rotation:[0,-vent,0]},ventR:{rotation:[0,vent,0]},
 };
 for(let i=0;i<legs.length;i++){
  const [id,y]=legs[i],leg=solveLeg(feet[i],y,body);
  joints['hip'+id]={rotation:[leg.hip,0,0]};
  joints['knee'+id]={rotation:[leg.knee,0,0]};
  joints['ankle'+id]={rotation:[leg.ankle,0,0]};
 }
 return {joints};
}
