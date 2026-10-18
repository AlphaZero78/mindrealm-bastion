import {TAU,clamp,smooth,ease,pulse,fract,stroke,wheelRollAngle,wheelSupportHeight} from '../enemy-rig.js';

const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
const rotation=(rx=0,ry=0,rz=0)=>({rotation:[rx,ry,rz]});
const neutral=()=>({joints:{},root:{rotation:[0,0,0],position:[0,0,0]}});

function transmission(joints,travel){
 const angle=wheelRollAngle(Math.max(0,finite(travel)),.29);
 joints.chassis={position:[0,0,wheelSupportHeight(angle,.29)-.29]};
 for(const side of ['L','R'])for(let i=0;i<3;i++)joints['wheel'+side+i]=rotation(angle);
}

function failed(progress,context){
 const p=clamp(progress),bleed=ease(p,0,.30),sink=ease(p,.18,.83),rest=ease(p,.73,1),joints={};
 transmission(joints,context.reducedMotion?0:context.travel);
 joints.frame={position:[0,0,-.024*sink]};
 joints.bell={rotation:[.055*sink,.19*sink,0],position:[0,.028*sink,-.095*sink]};
 joints.clapper=rotation(0,-.34*bleed,0);
 joints.hammer=rotation(0,.46*ease(p,.10,.66),0);
 joints.pressureCase=rotation(.13*sink,0,.055*sink);
 joints.pump={position:[0,0,-.068*bleed]};
 joints.cam=rotation(0,-.31*bleed,0);
 joints.ventL=rotation(0,-.55*bleed+.41*rest,0);
 joints.ventR=rotation(0,.55*bleed-.41*rest,0);
 joints.ram={position:[0,.065*bleed,0]};
 joints.sensor=rotation(.18*sink,0,.055*sink);
 return {joints,root:{rotation:[0,0,0],position:[0,0,0]}};
}

// A single loaded strike: withdraw, hit the skirt, rebound in decreasing
// steps and settle. The bell's answer starts after hammer contact.
function firstStrike(elapsed){
 const q=clamp(elapsed/.42);
 return {
  hammer:.32*(1-ease(q,0,.19))-.43*pulse(q,.08,.21,.47)+.09*pulse(q,.46,.65,1),
  bell:.042*pulse(q,.16,.31,.58)-.024*pulse(q,.47,.65,.88)+.008*pulse(q,.72,.87,1),
  clapper:-.31*pulse(q,.20,.36,.62)+.15*pulse(q,.55,.73,1),
 };
}

export function animate(context={}){
 const action=context.action||'idle',p=clamp(finite(context.progress));
 if(action==='preview'||action==='disabled')return neutral();
 if(action==='wreck')return failed(1,context);
 if(action==='death')return failed(context.reducedMotion?1:p,context);

 const active=!!context.abilityActive;
 const elapsed=Math.max(0,finite(context.abilityElapsed));
 const remaining=Math.max(0,finite(context.abilityRemaining,active?4:0));
 const held=active?ease(remaining,0,.30):0;
 const casting=['cast','ability','pressure_aura'].includes(action);
 const windup=casting&&(context.stage==='windup'||context.stage==='prepare'||context.actionKind==='ability-windup');
 if(context.reducedMotion){
  const open=windup?1:held;
  return {joints:{hammer:rotation(0,windup?.32:0,0),pump:{position:[0,0,.06*open]},ventL:rotation(0,-.49*open,0),ventR:rotation(0,.49*open,0)},root:{rotation:[0,0,0],position:[0,0,0]}};
 }

 const joints={},travel=Math.max(0,finite(context.travel));
 transmission(joints,travel);
 const moving=(context.moving===true||action==='move')&&finite(context.speed,.7)>0;
 const load=moving?.005+.004*clamp(finite(context.speed),0,2):0;
 joints.frame={position:[0,0,-load]};

 let open=held,hammer=0,bell=0,clapper=0,pump=.060*held,cam=0;
 if(active){
  const duration=Math.max(.001,elapsed+remaining);
  // The governor makes five complete turns in the actual field interval;
  // its zero velocity endpoints retain the parked flange orientation.
  cam=-TAU*5*smooth(elapsed/duration);
  if(elapsed<.42){
   ({hammer,bell,clapper}=firstStrike(elapsed));
  }else if(elapsed>.55){
   const beat=fract((elapsed-.55)/.72),drive=stroke(beat,.28,.39)*held;
   hammer=-.26*drive;
   bell=.023*pulse(beat,.32,.43,.64)*held-.011*pulse(beat,.58,.73,.98)*held;
   clapper=-.19*pulse(beat,.38,.53,.77)*held;
   pump+=.018*pulse(beat,.18,.36,.80)*held;
  }
 }

 if(windup){
  open=ease(p,0,.82);hammer=.32*ease(p,.08,.92);
  pump=.060*open;cam=0;
 }else if(casting){
  // The 420 ms release sample can be inspected on its own. In combat the
  // live elapsed clock keeps it continuous with the full four-second field.
  const release=firstStrike(active&&Number.isFinite(context.abilityElapsed)?elapsed:p*.42);
  hammer=release.hammer;bell=release.bell;clapper=release.clapper;
  open=active?held:1-ease(p,.64,1);
  pump=.060*open-.043*pulse(p,.06,.22,.53);
 }

 joints.hammer=rotation(0,hammer,0);
 joints.bell=rotation(0,bell,0);
 joints.clapper=rotation(0,clapper,0);
 joints.pump={position:[0,0,pump]};
 joints.cam=rotation(0,cam,0);
 joints.ventL=rotation(0,-.49*open,0);joints.ventR=rotation(0,.49*open,0);

 if(['attack','breach','terrain'].includes(action)){
  const work=stroke(p,.22,.42),brace=pulse(p,0,.20,1),contact=pulse(p,.36,.46,.69);
  joints.ram={position:[0,-.265*work,0]};
  joints.frame={position:[0,0,-load-.014*brace],rotation:[.013*contact,0,0]};
  joints.pressureCase=rotation(.026*contact,0,0);
  joints.sensor=rotation(.065*contact,0,0);
 }

 const hit=clamp(Math.max(finite(context.hit),['hit','hurt','damage'].includes(action)?1-smooth(p):0));
 if(hit>0){
  const impulse=hit*hit;
  joints.bell={rotation:[.018*impulse,bell+.057*impulse,0],position:[.010*impulse,.007*impulse,-.012*impulse]};
  joints.clapper=rotation(0,clapper-.085*impulse,0);
  joints.pressureCase=rotation(-.045*impulse,0,.013*impulse);
  joints.sensor=rotation(-.075*impulse,0,0);
 }
 return {joints,root:{rotation:[0,0,0],position:[0,0,0]}};
}
