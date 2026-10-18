import {TAU,clamp,smooth,ease,pulse,fract,wheelSupportHeight, wheelRollAngle} from '../enemy-rig.js';

const R=.36;
const wheelIds=['wheelLF','wheelLM','wheelLR','wheelRF','wheelRM','wheelRR'];
const finite=(v,fallback=0)=>Number.isFinite(v)?v:fallback;
const rotation=(rx=0,ry=0,rz=0)=>({rotation:[rx,ry,rz]});

function runningGear(travel){
 const angle=wheelRollAngle(travel,R),offset=wheelSupportHeight(angle,R)-R;
 const joints={chassis:{position:[0,0,offset]}};
 for(const id of wheelIds)joints[id]=rotation(angle);
 return {joints,offset,angle};
}
const neutral=()=>({joints:runningGear(0).joints,root:{rotation:[0,0,0],position:[0,0,0]}});

function fallen(progress,travel){
 const p=clamp(progress),unlock=ease(p,.02,.24),sag=ease(p,.15,.79),settle=ease(p,.70,1);
 const {joints,offset}=runningGear(travel);
 // The seized wheels retain contact. Carried mass collapses on its suspension;
 // guns and ranging forks lose their locks without tipping the contact chassis.
 joints.loadFrame={position:[0,.035*sag,-.18*sag],rotation:[.075*sag,.035*sag,0]};
 joints.powerpack={position:[-.023*sag,.020*sag,-.045*sag],rotation:[.05*sag,-.16*sag,0]};
 joints.turret=rotation(0,0,-.13*unlock);
 joints.elevation=rotation(.25*sag);
 joints.recoil={position:[0,.13*unlock,0]};
 joints.reticle=rotation(.16*settle);
 joints.sensorMast=rotation(.37*sag,0,.075*settle);
 joints.sensorL=rotation(.09*sag,-.18*unlock,-.10*settle);
 joints.sensorR=rotation(.04*sag,.09*unlock,.04*settle);
 joints.feedL={position:[0,.048*unlock,0]};
 joints.feedR={position:[0,.027*unlock,0]};
 joints.ventL=rotation(0,-.40*unlock);
 joints.ventR=rotation(0,.19*unlock);
 // The extended pistons keep at least .11 model units inside their sleeves.
 joints.braceL={position:[0,0,-(.10+offset)*unlock]};
 joints.braceR={position:[0,0,-(.10+offset)*unlock]};
 return {joints,root:{rotation:[0,0,0],position:[0,0,0]}};
}

/** Pure pose: targeting, range, shot count and advance remain in battle.js. */
export function animate(ctx={}){
 const action=ctx.action||'idle',p=clamp(finite(ctx.progress));
 const travel=Math.max(0,finite(ctx.travel));
 if(['preview','disabled','stopped','static'].includes(action))return neutral();
 if(action==='wreck')return fallen(1,ctx.reducedMotion?0:travel);
 if(action==='death')return fallen(ctx.reducedMotion?1:p,ctx.reducedMotion?0:travel);
 if(ctx.reducedMotion)return neutral();

 const {joints,offset,angle}=runningGear(travel);
 const moving=(!!ctx.moving||action==='move'||action==='advance')&&finite(ctx.speed)>0;
 const seam=1-smooth(Math.abs(fract(angle/TAU*12)-.5)*2);
 let load=moving?.010+.006*seam:0,frameRecoil=0,framePitch=0;
 let lock=0,back=0,feed=0,vent=0,brace=0;

 if(moving){
  // Mechanical transport interlocks: forks lean rearward, weapon locks above
  // the front rail and brakes retract. Wheel phase never uses action progress.
  joints.elevation=rotation(-.055);
  joints.sensorMast=rotation(-.09);
  joints.sensorL=rotation(.055,-.075,-.08);
  joints.sensorR=rotation(.055,.075,.08);
  joints.reticle=rotation(.055);
  joints.braceL={position:[0,0,.035]};
  joints.braceR={position:[0,0,.035]};
  vent=.055;
 }

 if(['attack','breach','terrain'].includes(action)){
  // One 420 ms cycle: 0-.20 acquire and preload; .20-.35 work/recoil;
  // .35-1 damp, index the energy feeds, reset the optical lock and lift brakes.
  lock=ease(p,0,.20)*(1-ease(p,.58,1));
  back=pulse(p,.20,.35,.79);
  feed=pulse(p,.42,.65,1);
  vent=.23*pulse(p,.24,.50,1);
  brace=lock;
  frameRecoil=.047*back;
  framePitch=.020*back;
  load+=.028*back;
  joints.elevation=rotation(-.020*lock+.024*back);
  joints.recoil={position:[0,-.025*lock+.18*back,0]};
  joints.reticle=rotation(-.045*lock+.026*back);
  joints.sensorMast=rotation(.025*lock);
  joints.sensorL=rotation(-.022*lock,0,.13*lock);
  joints.sensorR=rotation(-.022*lock,0,-.13*lock);
 }

 if(action==='cast'){
  // tower_hunter has no separate damage ability. A gallery/explicit warning
  // request shows the ranging acquisition and its release/reset mechanism.
  const windup=ctx.stage==='windup'||String(ctx.actionKind||'').includes('windup');
  lock=windup?smooth(p):1-ease(p,0,1);
  brace=lock;vent=.10*lock;
  joints.elevation=rotation(-.020*lock);
  joints.sensorMast=rotation(.025*lock);
  joints.sensorL=rotation(-.022*lock,0,.13*lock);
  joints.sensorR=rotation(-.022*lock,0,-.13*lock);
  joints.reticle=rotation(-.045*lock);
 }

 joints.feedL={position:[0,.060*feed,0]};
 joints.feedR={position:[0,.060*feed,0]};
 joints.ventL=rotation(0,-vent);
 joints.ventR=rotation(0,vent);
 if(brace>0&&!moving){
  // Counter the measured polygonal rim support offset when the sole plants.
  const drop=-(.10+offset)*brace;
  joints.braceL={position:[0,0,drop]};
  joints.braceR={position:[0,0,drop]};
 }

 const explicitHit=['hit','hurt','damage'].includes(action)?pulse(p,0,.16,1):0;
 const hit=clamp(Math.max(finite(ctx.hit),explicitHit));
 frameRecoil+=.033*hit;load+=.024*hit;framePitch+=.033*hit;
 joints.loadFrame={position:[0,frameRecoil,-load],rotation:[framePitch,-.012*hit,0]};
 if(hit){
  const elevation=joints.elevation?.rotation||[0,0,0];
  joints.elevation=rotation(elevation[0]+.045*hit,elevation[1],elevation[2]);
  const recoil=joints.recoil?.position||[0,0,0];
  joints.recoil={position:[recoil[0],recoil[1]+.033*hit,recoil[2]]};
  joints.reticle=rotation((joints.reticle?.rotation?.[0]||0)+.060*hit);
 }
 return {joints,root:{rotation:[0,0,0],position:[0,0,0]}};
}
