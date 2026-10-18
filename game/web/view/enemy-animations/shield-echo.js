import {clamp,smooth,ease,pulse,fract,stroke} from '../enemy-rig.js';

// Ankle target coordinates are expressed relative to an upright hip. During
// stance the sole stays at Z=0; the two-link solution folds only for the swing.
const leg=(y,lift=0,bodyDrop=0)=>{
 const upper=.50,lower=.50,vertical=1+bodyDrop-lift;
 const distance=clamp(Math.hypot(y,vertical),.04,.9998);
 const knee=Math.PI-Math.acos(clamp((upper*upper+lower*lower-distance*distance)/(2*upper*lower),-1,1));
 const hip=Math.atan2(y,vertical)-Math.acos(clamp((upper*upper+distance*distance-lower*lower)/(2*upper*distance),-1,1));
 return {hip,knee,ankle:-hip-knee};
};

const footPath=phase=>{
 const p=fract(phase),stance=p<.64,t=stance?p/.64:(p-.64)/.36;
 const arch=4*t*(1-t);
 return {y:stance?.40*(t-.5):.40*(.5-smooth(t)),lift:stance?0:.135*arch*arch,stance};
};

function poseLegs(joints,left,right,drop){
 for(const [side,path]of [['L',left],['R',right]]){
  const angles=leg(path.y,path.lift,drop);
  joints[`hip${side}`]={rotation:[angles.hip,0,0]};
  joints[`knee${side}`]={rotation:[angles.knee,0,0]};
  joints[`ankle${side}`]={rotation:[angles.ankle,0,0]};
 }
}

function collapsed(progress){
 const p=smooth(progress),fold=ease(progress,.08,.70),fall=ease(progress,.28,1);
 const joints={chassis:{position:[-.10*fall,.10*fall,-.62*fold]},torso:{rotation:[.54*fall,-.64*fall,.11*fall]},
  ram:{position:[0,.17*fold,-.04*fall],rotation:[-.10*fall,0,0]},
  shieldL:{rotation:[0,.08*fall,.49*p]},shieldR:{rotation:[0,-.19*fall,-.94*p]},
  capacitor:{rotation:[.38*fall,0,0]},ventL:{rotation:[0,-.47*fold,0]},ventR:{rotation:[0,.34*fold,0]},
  emitter:{rotation:[.44*fall,0,.16*fold]},sensor:{rotation:[.74*fall,0,0]},
  linkL:{rotation:[-.16*fold,0,0]},linkR:{rotation:[-.16*fold,0,0]}};
 poseLegs(joints,{y:-.12*fold,lift:0},{y:.12*fold,lift:0},-.62*fold);
 return {joints,root:{rotation:[0,0,0],position:[0,0,0]}};
}

export function animate(context={}){
 const {action='idle',progress=0,travel=0,speed=0,moving=false,stage='',actionKind='',reducedMotion=false}=context;
 const p=clamp(Number.isFinite(progress)?progress:0);
 if(action==='preview'||action==='disabled')return {joints:{}};
 if(action==='wreck')return collapsed(1);
 if(action==='death')return collapsed(reducedMotion?1:p);
 if(reducedMotion)return {joints:{}};

 const joints={};
 const shield=clamp(context.shieldFraction??0),hit=clamp(context.hit??0);
 // A charged projector has one stable working position, independent of clock.
 if(shield>0){joints.emitter={position:[0,-.035,0]};joints.capacitor={position:[0,0,.025]};}
 let drop=0,left={y:0,lift:0},right={y:0,lift:0},brace=0;

 if(action==='move'||moving){
  const distance=Number.isFinite(travel)?travel:0,cycle=fract(distance/(.40/.64));
  left=footPath(cycle);right=footPath(cycle+.5);
  // The keel settles when the unsupported foot passes the loaded foot. Small
  // load transfer belongs to the torso, while pads and ankles stay horizontal.
  const swing=Math.max(left.lift,right.lift)/.135;
  drop=-.035-.018*swing;
  const load=left.stance&&!right.stance?-1:right.stance&&!left.stance?1:0;
  joints.torso={rotation:[.035+clamp(speed,0,2)*.008,0,load*.022]};
  joints.linkL={rotation:[0,load*.010,0]};joints.linkR={rotation:[0,load*.010,0]};
 }

 if(action==='attack'){
  brace=pulse(p,0,.15,1);drop=-.085*brace;
  left={y:-.045*brace,lift:0};right={y:.045*brace,lift:0};
  const work=stroke(p,.27,.45),compression=pulse(p,.42,.49,.72);
  joints.torso={rotation:[work*.12,0,-.025*brace]};
  joints.ram={position:[0,-.31*work,.035*compression],rotation:[.065*compression,0,0]};
  joints.linkL={rotation:[-.12*work,0,0]};joints.linkR={rotation:[-.12*work,0,0]};
  joints.shieldL={rotation:[0,0,.040*compression]};joints.shieldR={rotation:[0,0,-.040*compression]};
  joints.sensor={rotation:[-.035*work,0,0]};
 }

 if(action==='cast'||action==='ability'){
  const windup=stage==='windup'||stage==='prepare'||actionKind==='ability-windup';
  const open=windup?ease(p,.10,.76):1-ease(p,.18,.88);
  const discharge=windup?0:pulse(p,0,.16,.54);
  brace=windup?ease(p,0,.35):1-ease(p,.62,1);
  drop-=.075*brace;
  if(!moving){left={y:-.03*brace,lift:0};right={y:.03*brace,lift:0};}
  joints.torso={rotation:[-.035*brace,0,0]};
  joints.ram={position:[0,-.045*open+.032*discharge,0]};
  joints.shieldL={rotation:[0,0,.92*open]};joints.shieldR={rotation:[0,0,-.92*open]};
  joints.linkL={rotation:[-.027*open,0,0]};joints.linkR={rotation:[-.027*open,0,0]};
  joints.capacitor={position:[0,0,.025*(shield>0?1:0)+.075*open],rotation:[-.065*discharge,0,0]};
  joints.ventL={rotation:[0,-.48*open,0]};joints.ventR={rotation:[0,.48*open,0]};
  joints.emitter={position:[0,-.035*(shield>0?1:0)-.065*open-.072*discharge,.025*open],rotation:[-.09*open+.035*discharge,0,.19*discharge]};
  joints.sensor={rotation:[-.07*open,0,0]};
 }

 const received=action==='hit'||action==='hurt'?1-smooth(p):hit;
 if(received>0){
  const impulse=received*received;
  drop-=.032*impulse;
  const torso=joints.torso||{rotation:[0,0,0]},ram=joints.ram||{position:[0,0,0]};
  joints.torso={...torso,rotation:[(torso.rotation?.[0]||0)-.085*impulse,torso.rotation?.[1]||0,(torso.rotation?.[2]||0)+.028*impulse]};
  joints.ram={...ram,position:[ram.position?.[0]||0,(ram.position?.[1]||0)+.065*impulse,ram.position?.[2]||0]};
  joints.sensor={rotation:[.075*impulse,0,0]};
 }
 if(drop!==0||action==='move'||moving||brace>0){
  joints.chassis={position:[0,0,drop]};poseLegs(joints,left,right,drop);
 }
 return {joints,root:{rotation:[0,0,0],position:[0,0,0]}};
}
