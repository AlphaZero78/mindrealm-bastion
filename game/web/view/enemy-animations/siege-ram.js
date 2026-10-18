import {TAU,clamp,smooth,ease,pulse,fract,wheelSupportHeight, wheelRollAngle} from '../enemy-rig.js';

const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
const rotation=(rx=0,ry=0,rz=0)=>({rotation:[rx,ry,rz]});
const neutral=()=>({joints:{},root:{rotation:[0,0,0],position:[0,0,0]}});
const wheelIds=['wheelLF','wheelLM','wheelLR','wheelRF','wheelRM','wheelRR'];
const radius=.31;

// One 420 ms presentation cycle: rearward preload, accelerating forward
// stroke, compression against the target, then a controlled return.
function workCycle(progress,terrain){
 const p=clamp(progress),reach=terrain?.47:.38;
 let ram;
 if(p<.22)ram=.135*smooth(p/.22);
 else if(p<.43){const t=(p-.22)/.21;ram=.135-(.135+reach)*t*t;}
 else if(p<.58)ram=-reach+.07*smooth((p-.43)/.15);
 else ram=(-reach+.07)*(1-smooth((p-.58)/.42));
 return {
  ram,
  brace:pulse(p,0,.21,.98),
  pressure:p<.43?ease(p,0,.22):1-ease(p,.43,.89),
  reaction:pulse(p,.34,.43,.73),
  focus:pulse(p,.22,.43,.67),
 };
}

function wreckPose(progress,travel){
 const p=clamp(progress),unlock=ease(p,.02,.24),sag=ease(p,.19,.76),settle=ease(p,.74,1);
 const wheelAngle=wheelRollAngle(travel,radius),joints={chassis:{position:[0,0,wheelSupportHeight(wheelAngle,radius)-radius]}};
 // Wheel brakes seize before pressure bleeds away. Contacts and axles remain
 // planted while the powerpack mount and the guided crosshead lose support.
 for(const id of wheelIds)joints[id]=rotation(wheelAngle);
 joints.loadFrame={position:[0,.035*sag,-.16*sag],rotation:[.085*sag,0,0]};
 joints.powerpack={rotation:[.09*sag,-.21*sag,.055*settle],position:[-.022*sag,.026*sag,-.065*sag]};
 joints.ram={position:[0,.12*unlock,-.037*sag],rotation:[.07*sag,0,0]};
 joints.preloadL={position:[0,.085*unlock,0]};
 joints.preloadR={position:[0,.065*unlock,0]};
 joints.braceL=rotation(.18*unlock);
 joints.braceR=rotation(.08*unlock);
 joints.shoeL=rotation(-.18*unlock);
 joints.shoeR=rotation(-.08*unlock);
 joints.ventL=rotation(0,-.47*unlock,0);
 joints.ventR=rotation(0,.19*unlock,0);
 joints.flywheel=rotation(travel/.17+.34*(1-(1-p)*(1-p)));
 joints.sight=rotation(.18*sag,0,-.08*settle);
 return {joints,root:{rotation:[0,0,0],position:[0,0,0]}};
}

export function animate(context={}){
 const action=context.action||'idle',p=clamp(finite(context.progress));
 const travel=Math.max(0,finite(context.travel));
 if(['preview','disabled','stopped','static'].includes(action))return neutral();
 if(action==='wreck')return wreckPose(1,context.reducedMotion?0:travel);
 if(action==='death')return wreckPose(context.reducedMotion?1:p,context.reducedMotion?0:travel);
 if(context.reducedMotion)return neutral();

 const moving=(action==='move'||context.moving)&&finite(context.speed)>0;
 const hit=clamp(finite(context.hit));
 const wheelAngle=wheelRollAngle(travel,radius);
 const joints={chassis:{position:[0,0,wheelSupportHeight(wheelAngle,radius)-radius]}};
 for(const id of wheelIds)joints[id]=rotation(wheelAngle);

 // Traction turns through the actual cumulative model-space distance. The
 // frame settles over individual tread seams; the wheel centers stay fixed.
 const seam=1-smooth(Math.abs(fract(wheelAngle/TAU*12)-.5)*2);
 let load=moving?.008+.004*seam:0,recoil=0,framePitch=0,ram=0,brace=0,pressure=0;
 let flywheel=travel/.17,vent=0;
 if(moving){
  // Shoes clear the ground and the crosshead locks in its transport position
  // during the finite 2.5 s advance imposed by the battle simulation.
  brace=-.065;
  ram=.025;
  vent=.055;
 }

 if(action==='attack'){
  const cycle=workCycle(p,context.actionKind==='terrain');
  ram=cycle.ram;brace=.22*cycle.brace;pressure=cycle.pressure;
  load+=.024*cycle.reaction;
  recoil=.073*cycle.reaction;
  framePitch=.027*cycle.reaction;
  vent=.18*cycle.pressure;
  // One closed flywheel revolution couples the powerpack to the pump. Its
  // final angle is equivalent to rest, so finishing the cycle is continuous.
  flywheel+=TAU*smooth(p);
  joints.sight=rotation(-.022*cycle.focus);
 }else if(action==='cast'){
  const windup=context.stage==='windup'||String(context.actionKind||'').includes('windup');
  if(windup){
   // Ordinary siege has a pressure-preparation warning in the simulation.
   // This primes the reservoirs and guide lock without adding a damage pulse.
   pressure=smooth(p);ram=.095*pressure;brace=.18*pressure;
   vent=.15*pressure;load+=.010*pressure;
  }else{
   const release=1-ease(p,0,1);
   pressure=release;ram=.095*release;brace=.18*release;vent=.15*release;
  }
 }

 // Hit is the runtime's 170 ms impact envelope. Reaction is absorbed by the
 // suspended frame and sleeves, retaining the circular wheel contacts.
 recoil+=.038*hit;load+=.021*hit;framePitch+=.018*hit;
 ram+=.042*hit;pressure=Math.max(pressure,.18*hit);
 joints.loadFrame={position:[0,recoil,-load],rotation:[framePitch,0,0]};
 joints.ram={position:[0,ram,0]};
 joints.preloadL={position:[0,-.055*pressure,0]};
 joints.preloadR={position:[0,-.055*pressure,0]};
 joints.braceL=rotation(brace);
 joints.braceR=rotation(brace);
 joints.shoeL=rotation(-brace);
 joints.shoeR=rotation(-brace);
 joints.flywheel=rotation(flywheel);
 joints.ventL=rotation(0,-vent,0);
 joints.ventR=rotation(0,vent,0);
 if(hit)joints.sight=rotation(.065*hit);
 return {joints,root:{rotation:[0,0,0],position:[0,0,0]}};
}
