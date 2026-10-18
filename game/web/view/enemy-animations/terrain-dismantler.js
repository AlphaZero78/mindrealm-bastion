import {clamp,smooth,ease,pulse,fract} from '../enemy-rig.js';

const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
const rotation=(x=0,y=0,z=0)=>({rotation:[x,y,z]});
const neutral=()=>({joints:{},root:{rotation:[0,0,0],position:[0,0,0]}});
const feet=[
 {id:'LF',side:-1,front:-1,offset:0},
 {id:'RR',side:1,front:1,offset:.25},
 {id:'RF',side:1,front:-1,offset:.50},
 {id:'LR',side:-1,front:1,offset:.75},
];
const legLength=.45,stanceFraction=.76,stride=.42,cycleDistance=stride/stanceFraction;

/** Solve the authored .45/.45 links against one level ankle target. */
function solveLeg(y,down){
 const d=Math.min(legLength*2-.00001,Math.hypot(y,down));
 const knee=Math.PI-Math.acos(clamp((2*legLength*legLength-d*d)/(2*legLength*legLength),-1,1));
 const hip=Math.atan2(y,down)-Math.acos(clamp(d/(2*legLength),-1,1));
 return {hip,knee,ankle:-hip-knee};
}
function setLeg(joints,id,y,down){
 const leg=solveLeg(y,down);
 joints['hip'+id]=rotation(leg.hip);
 joints['knee'+id]=rotation(leg.knee);
 joints['ankle'+id]=rotation(leg.ankle);
}
function plant(joints,squat){
 for(const foot of feet)setLeg(joints,foot.id,0,.90-squat);
}
function crawl(joints,travel){
 let roll=0,pitch=0;
 for(const foot of feet){
  const p=fract(travel/cycleDistance+foot.offset),stance=p<stanceFraction;
  const t=stance?p/stanceFraction:(p-stanceFraction)/(1-stanceFraction);
  // Stance moves +Y at one unit per travelled unit, cancelling the -Y
  // root advance. Only a single foot is on the lifted return arc at a time.
  const y=stance?stride*(t-.5):stride*(.5-smooth(t));
  const clearance=stance?0:.13*4*t*(1-t);
  setLeg(joints,foot.id,y,.86-clearance);
  if(!stance){const transfer=4*t*(1-t);roll+=foot.side*.035*transfer;pitch+=foot.front*.020*transfer;}
 }
 return {roll,pitch};
}

/** Closed mechanical work cycle: retract, place, cut, withdraw, reset. */
function toolCycle(progress,terrain){
 const p=clamp(progress),retract=ease(p,0,.22),place=ease(p,.22,.44);
 const withdraw=ease(p,.62,.84),reset=ease(p,.84,1);
 const prepared=retract*(1-reset),worked=place*(1-withdraw);
 const brace=pulse(p,0,.24,.98),contact=pulse(p,.39,.47,.71);
 const boom=(-.30*prepared+(terrain?.91:.62)*worked);
 const elbow=.55*prepared-.74*worked;
 // By .44 the pressure aperture points forward; the rotor then cuts in
 // one measured sector. Its four chisels and twelve-sided rim are symmetric.
 const index=(terrain?Math.PI:Math.PI/2)*ease(p,.40,.68);
 return {boom,elbow,brace,contact,index,pressure:pulse(p,0,.32,.92)};
}

function wreckPose(progress){
 const p=clamp(progress),unlock=ease(p,.02,.25),settle=ease(p,.15,.85);
 const joints={},squat=.27*settle;
 plant(joints,squat);
 const boom=.40*settle,elbow=-.09*settle;
 joints.deck={position:[0,.025*settle,-.015*settle],rotation:[0,.018*settle,0]};
 joints.boom=rotation(boom);
 joints.elbow=rotation(elbow);
 joints.wrist=rotation(-boom-elbow+.09*settle);
 joints.rotor=rotation(0,Math.PI/2*(1-(1-p)**3),0);
 joints.shroudL={position:[0,0,-.06*unlock]};
 joints.shroudR={position:[0,0,-.045*unlock]};
 joints.sight=rotation(.21*settle,0,-.045*unlock);
 return {joints,root:{rotation:[0,0,0],position:[0,0,-squat]}};
}

export function animate(context={}){
 const action=context.action||'idle',p=clamp(finite(context.progress));
 if(['preview','disabled','stopped','static'].includes(action))return neutral();
 if(action==='wreck')return wreckPose(1);
 if(action==='death')return wreckPose(context.reducedMotion?1:p);
 if(context.reducedMotion)return neutral();

 const travel=Math.max(0,finite(context.travel));
 const moving=(action==='move'||context.moving)&&finite(context.speed)>0;
 const joints={},root={rotation:[0,0,0],position:[0,0,0]};
 let boom=0,elbow=0,toolTilt=0,index=0,pressure=0,reaction=0,roll=0,pitch=0;
 let deckY=0,deckZ=0;
 if(moving){
  const transfer=crawl(joints,travel);roll=transfer.roll;pitch=transfer.pitch;
  root.position[2]=-.04;
  // Transport lock carries the head closer to the platform. Walking is
  // independent of cast/attack presentation, including the finite advance.
  boom=.055;elbow=.14;
 }

 if(['attack','terrain','breach'].includes(action)){
  const terrain=context.actionKind==='terrain'||action==='terrain';
  const work=toolCycle(p,terrain);
  boom=work.boom;elbow=work.elbow;index=work.index;pressure=work.pressure;
  reaction=work.contact;toolTilt=(terrain?.12:.04)*work.contact;
  if(!moving){const squat=.055*work.brace;plant(joints,squat);root.position[2]=-squat;}
  deckY=.032*reaction;deckZ=-.024*reaction;
 }else if(action==='cast'){
  const windup=context.stage==='windup'||String(context.actionKind||'').includes('windup');
  // Non-boss siege has a real preparation warning but no area-damage cast.
  // The machinery primes and vents without adding a second attack stroke.
  pressure=windup?smooth(p):1-smooth(p);
  boom-=.11*pressure;elbow+=.16*pressure;
 }

 const explicitHit=['hit','hurt','damage'].includes(action)?pulse(p,0,.14,1):0;
 const hit=clamp(Math.max(finite(context.hit),explicitHit));
 pitch-=.055*hit;roll+=.027*hit;deckY+=.035*hit;deckZ-=.015*hit;
 boom-=.035*hit;elbow+=.06*hit;
 joints.deck={position:[0,deckY,deckZ],rotation:[pitch,roll,0]};
 joints.boom=rotation(boom);
 joints.elbow=rotation(elbow);
 // A local counter-rotation keeps the cutter normal controlled as both
 // parent hinges move; the small contact tilt lets the bottom chisel bite.
 joints.wrist=rotation(-boom-elbow+toolTilt);
 joints.rotor=rotation(0,index,0);
 joints.shroudL={position:[0,0,.075*pressure-.02*reaction]};
 joints.shroudR={position:[0,0,.075*pressure-.02*reaction]};
 joints.sight=rotation(.045*hit-.035*reaction,0,0);
 return {joints,root};
}
