import {clamp,ease,fract,pulse,smooth} from '../enemy-rig.js';

const HIP_Z=.87,ANKLE_Z=.10,DUTY=.74,STRIDE=.28,CYCLE_DISTANCE=STRIDE/DUTY;
const U=Math.hypot(.17,.40),L=Math.hypot(.17,.37),HEIGHT=HIP_Z-ANKLE_Z;
const LEG_DATA=[
 {id:'FL',bend:-1,offset:.08},{id:'FR',bend:-1,offset:.58},
 {id:'RL',bend:1,offset:.58},{id:'RR',bend:1,offset:.08},
];
const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;

function solve(y,height,bend){
 const distance=clamp(Math.hypot(y,height),Math.abs(U-L)+.0001,U+L-.0001);
 const direction=Math.atan2(y,height);
 const hip=direction+bend*Math.acos(clamp((U*U+distance*distance-L*L)/(2*U*distance),-1,1));
 const knee=-bend*(Math.PI-Math.acos(clamp((U*U+L*L-distance*distance)/(2*U*L),-1,1)));
 return {hip,knee};
}
const REST={front:solve(0,HEIGHT,-1),rear:solve(0,HEIGHT,1)};

function step(phase,moving){
 const p=fract(phase);
 if(p<DUTY){const t=p/DUTY;return {y:STRIDE*(t-.5),z:0,load:pulse(t,0,.13,.82),stance:true};}
 const t=(p-DUTY)/(1-DUTY);
 return {y:STRIDE*(.5-smooth(t)),z:moving?.082*16*t*t*(1-t)*(1-t):0,load:0,stance:false};
}

/** Pure four-point load transfer and captive contact press presentation. */
export function animate(context={}){
 const action=context.action||'idle',dead=action==='death'||action==='wreck';
 if(['preview','static','disabled','stopped'].includes(action))return {joints:{}};
 if(context.reducedMotion&&!dead)return {joints:{}};
 const p=dead&&(action==='wreck'||context.reducedMotion)?1:clamp(finite(context.progress));
 const travel=Math.max(0,finite(context.travel));
 const moving=!dead&&(context.moving===true||action==='move');
 const phase=travel/CYCLE_DISTANCE;
 const hit=dead?0:action==='hit'?1-smooth(p):clamp(finite(context.hit));
 const attacking=action==='attack'||action==='breach'||action==='terrain';
 const terrain=context.actionKind==='terrain'||action==='terrain';
 const collapse=dead?ease(p,.06,.86):0;

 // battle.js resolves ordinary melee immediately. The resting sleeves are
 // preloaded; p=0 is the actual contact pose, with no fabricated cast delay.
 const contact=attacking?1-ease(p,.08,.44):0;
 const recoil=attacking?pulse(p,.025,.16,.61):0;
 const recharge=attacking?pulse(p,.48,.72,1):0;
 const ramTravel=-(terrain?.295:.275)*contact+.045*recharge+.018*hit;
 const load=moving?LEG_DATA.reduce((sum,leg)=>sum+step(phase+leg.offset,true).load,0)/4:0;
 const bodyY=.022*recoil+.025*hit+.026*collapse;
 const bodyZ=-.009*load-.020*contact-.022*hit-.235*collapse;
 const joints={chassis:{position:[0,bodyY,bodyZ]}};

 for(const leg of LEG_DATA){
  const rest=leg.bend<0?REST.front:REST.rear;
  // Retain travelled foot phase on stopping; the released shoe seats at the
  // same Y station. Ground contacts compensate body absorption and collapse.
  const cycle=travel>0||moving?step(phase+leg.offset,moving):{y:0,z:0,stance:true};
  const angles=solve(cycle.y-bodyY,HEIGHT+bodyZ-cycle.z,leg.bend);
  const hip=angles.hip-rest.hip,knee=angles.knee-rest.knee;
  joints['hip'+leg.id]={rotation:[hip,0,0]};
  joints['knee'+leg.id]={rotation:[knee,0,0]};
  joints['ankle'+leg.id]={rotation:[-hip-knee,0,0]};
 }

 if(dead){
  const unload=ease(p,.08,.63),unlatch=ease(p,.30,.94);
  joints.mantle={position:[0,.015*unlatch,-.022*unlatch],rotation:[.085*unlatch,-.055*unlatch,0]};
  joints.pressMount={rotation:[.17*unload,0,0]};
  joints.ram={position:[0,.075*unload,0],rotation:[.11*unlatch,0,0]};
  joints.preloadL={position:[0,.095*unload,0]};
  joints.preloadR={position:[0,.070*unload,0]};
  joints.visor={rotation:[.62*unlatch,0,0]};
  return {joints};
 }

 joints.mantle={position:[0,.013*recoil,0],rotation:[.012*recoil+.018*hit,0,0]};
 joints.pressMount={rotation:[.018*recoil,0,0]};
 joints.ram={position:[0,ramTravel,0]};
 joints.preloadL={position:[0,.021*recoil-.022*recharge,0]};
 joints.preloadR={position:[0,.021*recoil-.022*recharge,0]};
 joints.visor={rotation:[-.012*contact+.035*hit,0,0]};
 // armored is a passive property. Any caller-provided cast still retains
 // actual walking and hit response, while the press stays seated.
 return {joints};
}
