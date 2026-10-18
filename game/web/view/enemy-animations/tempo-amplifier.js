import {TAU,clamp,smooth,ease,pulse,fract,stroke,wheelSupportHeight, wheelRollAngle} from '../enemy-rig.js';

const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
const rotation=(rx=0,ry=0,rz=0)=>({rotation:[rx,ry,rz]});
const neutral=()=>({joints:{},root:{rotation:[0,0,0],position:[0,0,0]}});

function fallen(progress,travel=0){
 const p=clamp(progress),unlock=ease(p,.02,.34),topple=ease(p,.23,.88),settle=ease(p,.77,1);
 const wheel=wheelRollAngle(finite(travel),.27);
 return {joints:{
  chassis:{position:[0,0,wheelSupportHeight(wheel,.27)-.27]},
  wheelLF:rotation(wheel),wheelLR:rotation(wheel),wheelRF:rotation(wheel),wheelRR:rotation(wheel),
  amplifier:{rotation:[.53*topple,-.66*topple,.13*topple],position:[.06*settle,.06*topple,-.065*settle]},
  hornTilt:rotation(.47*topple,0,.12*settle),
  baffleL:rotation(0,0,-.91*unlock),baffleR:rotation(0,0,.30*unlock),
  ventL:rotation(0,-.56*unlock,0),ventR:rotation(0,.42*unlock,0),
  striker:{position:[0,-.045*unlock,0]},
  governor:rotation(0,-.48*unlock,0),sensor:rotation(.47*topple),
  driver:{position:[0,.04*unlock,-.06*topple]},
  diaphragm:{position:[0,.035*unlock,0]},
 },root:{rotation:[0,0,0],position:[0,0,0]}};
}

export function animate(context={}){
 const action=context.action||'idle',p=clamp(finite(context.progress));
 if(action==='preview'||action==='disabled')return neutral();
 if(action==='wreck')return fallen(1,context.reducedMotion?0:context.travel);
 if(action==='death')return fallen(context.reducedMotion?1:p,context.reducedMotion?0:context.travel);
 if(context.reducedMotion){
  if(context.boosted)return {joints:{baffleL:rotation(0,0,-.70),baffleR:rotation(0,0,.70),ventL:rotation(0,-.42,0),ventR:rotation(0,.42,0),hornTilt:rotation(-.08),driver:{position:[0,0,.035]}},root:{rotation:[0,0,0],position:[0,0,0]}};
  return neutral();
 }

 const travel=Math.max(0,finite(context.travel)),wheel=wheelRollAngle(travel,.27);
 const moving=(action==='move'||context.moving)&&finite(context.speed,.92)>0;
 const boosted=!!context.boosted,clock=Math.max(0,finite(context.clock));
 // The timing motor keeps its angular phase across preparation, release and
 // active-field transitions. Only the diaphragm clutch changes engagement.
 const joints={chassis:{position:[0,0,wheelSupportHeight(wheel,.27)-.27]},wheelLF:rotation(wheel),wheelLR:rotation(wheel),wheelRF:rotation(wheel),wheelRR:rotation(wheel),governor:rotation(0,-clock/500*TAU,0)};

 // Every wheel uses distance/radius, so stops retain the axle phase. The
 // unloaded shell moves relative to its axles; the four contact circles stay
 // at Z=0. Propulsion turns with travel; the unloaded casing holds its height.
 if(moving){
  const load=.006+.005*clamp(finite(context.speed),0,2);
  joints.suspensionL={position:[0,0,-load]};
  joints.suspensionR={position:[0,0,-load]};
  joints.hornTilt=rotation(-.035);
 }

 // ctx.boosted is the live hasteUntil flag. It keeps the actual acoustic
 // aperture open for all four combat seconds after the short release event.
 if(boosted){
  const beat=fract(clock/500),pump=stroke(beat,.40,.54);
  joints.baffleL=rotation(0,0,-.70);joints.baffleR=rotation(0,0,.70);
  joints.ventL=rotation(0,-.42,0);joints.ventR=rotation(0,.42,0);
  joints.governor={rotation:[0,-clock/500*TAU,0],position:[0,-.018,0]};
  joints.diaphragm={position:[0,-.048*pump,0]};
  joints.driver={position:[0,0,.035]};
  joints.hornTilt=rotation(-.08);
  joints.sensor=rotation(-.055);
 }

 if(action==='attack'||action==='breach'||action==='terrain'){
  const work=stroke(p,.24,.44),contact=pulse(p,.42,.48,.70);
  // The forefoot bumper has an independent linear ram. Only the upper
  // casing braces around its load bearing pivot, preserving tire contact.
  joints.striker={position:[0,-.245*work,.009*contact]};
  joints.amplifier=rotation(.045*work,0,0);
  joints.hornTilt=rotation((boosted?-.08:-.035)+.095*work);
  joints.suspensionL={position:[0,0,-.016*pulse(p,0,.18,1)]};
  joints.suspensionR={position:[0,0,-.016*pulse(p,0,.18,1)]};
 }

 if(action==='cast'||action==='ability'){
  const windup=context.stage==='windup'||context.stage==='prepare'||context.actionKind==='ability-windup';
  const open=windup?ease(p,0,.80):boosted?1:1-ease(p,.55,1);
  const discharge=windup?0:pulse(p,0,.12,.42);
  const withdrawal=windup?ease(p,.18,.92):1-ease(p,0,.12);
  joints.baffleL=rotation(0,0,-.70*open);joints.baffleR=rotation(0,0,.70*open);
  joints.ventL=rotation(0,-.42*open,0);joints.ventR=rotation(0,.42*open,0);
  joints.driver={position:[0,0,.035*open],rotation:[-.035*discharge,0,0]};
  joints.hornTilt=rotation(-.08*open+.045*discharge);
  joints.sensor=rotation(-.055*open);
  const working=boosted?-.048*stroke(fract(clock/500),.40,.54):0;
  joints.diaphragm={position:[0,.045*withdrawal-.085*discharge+working*(windup?0:ease(p,.42,1)),0]};
  // Sliding the exposed flywheel into its clutch seats the driver. Its cam
  // retains its phase when the live field replaces the short release action.
  joints.governor={rotation:[0,-clock/500*TAU,0],position:[0,-.018*open,0]};
 }

 const explicitHit=['hit','hurt','damage'].includes(action)?1-smooth(p):0;
 const hit=clamp(Math.max(finite(context.hit),explicitHit));
 if(hit>0){
  const impulse=hit*hit,body=joints.amplifier?.rotation||[0,0,0],horn=joints.hornTilt?.rotation||[0,0,0];
  const ram=joints.striker?.position||[0,0,0];
  joints.amplifier=rotation(body[0]-.12*impulse,body[1]+.038*impulse,body[2]);
  joints.hornTilt=rotation(horn[0]+.11*impulse,horn[1],horn[2]);
  joints.striker={position:[ram[0],ram[1]+.038*impulse,ram[2]]};
  joints.sensor=rotation(.085*impulse);
 }
 return {joints,root:{rotation:[0,0,0],position:[0,0,0]}};
}
