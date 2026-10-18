import {clamp,ease,fract,pulse,smooth,stroke} from '../enemy-rig.js';

const BAY_IDS=['front','middle','rear'];
const DUTY=.72,STRIDE=.38,CYCLE_DISTANCE=STRIDE/DUTY;

// Stance displacement has a constant derivative. World travel is -Y, so
// +Y relative travel keeps the clamp fixed on the ground throughout stance.
function gripCycle(phase){
 const p=fract(phase);
 if(p<DUTY){
  const t=p/DUTY;
  return {y:STRIDE*(t-.5),z:0,load:pulse(t,0,.12,.60),stance:true};
 }
 const t=(p-DUTY)/(1-DUTY);
 return {y:STRIDE*(.5-smooth(t)),z:.115*16*t*t*(1-t)*(1-t),load:0,stance:false};
}

/** Pure armoured worm presentation; passive armour has no invented cast. */
export function animate(context={}){
 const action=context.action||'idle';
 if(['preview','disabled','stopped','static'].includes(action))return {joints:{}};
 const dead=action==='death'||action==='wreck';
 if(context.reducedMotion&&!dead)return {joints:{}};
 const q=action==='wreck'||dead&&context.reducedMotion?1:clamp(Number.isFinite(context.progress)?context.progress:0);
 const moving=!dead&&(context.moving===true||action==='move');
 const travel=Number.isFinite(context.travel)?context.travel:0;
 const phase=fract(travel/CYCLE_DISTANCE);
 const hit=dead?0:action==='hit'?1-smooth(q):clamp(Number.isFinite(context.hit)?context.hit:0);
 const bayOffsets=[];
 const joints={};
 const attacking=action==='attack';
 const contact=attacking?pulse(q,.22,.42,.79):0;
 const windup=attacking?pulse(q,0,.22,.48):0;
 const work=attacking?stroke(q,.24,.43):0;
 const terrain=String(context.actionKind||'')==='terrain';
 const collapse=dead?ease(q,.04,.86):0;

 for(let i=0;i<BAY_IDS.length;i++){
  const id=BAY_IDS[i],cycle=moving?gripCycle(phase-i/3):{y:0,z:0,load:0,stance:true};
  // Shell compression is axial and causally tied to the grip shoe load.
  // Countertranslation below keeps the stance pads fixed despite compression.
  let y=moving?-.035*cycle.load:0;
  let z=moving?-.015*cycle.load:0;
  if(attacking){y+=.045*work*(1-i*.28);z-=.026*windup;}
  y+=.035*hit*(1-i*.24);z-=.012*hit;
  if(dead){y=.032*collapse*(1-i*.35);z=-[.115,.10,.085][i]*collapse;}
  bayOffsets.push({y,z});
  joints[id]={position:[0,y,z]};
  for(const side of ['L','R']){
   const tag=id+side;
   joints['carriage'+tag]={position:[0,cycle.y-y,0]};
   joints['pad'+tag]={position:[0,0,cycle.z-z]};
  }
 }

 // Each broad collar floats halfway between its captured overlapping shells.
 for(const [id,a,b]of [['couplingF',0,1],['couplingR',1,2]]){
  joints[id]={position:[0,(bayOffsets[a].y+bayOffsets[b].y)/2,(bayOffsets[a].z+bayOffsets[b].z)/2]};
 }
 let nose=attacking?-(terrain?.26:.205)*work:0;
 let jaw=attacking?.31*windup-.22*contact:0;
 let headZ=attacking?-.022*contact:0;
 if(hit>0){nose+=.03*hit;jaw+=.09*hit;}
 if(dead){nose=.055*collapse;jaw=.44*ease(q,.15,.90);headZ=-.025*collapse;}
 joints.head={position:[0,nose,headZ]};
 joints.jawL={rotation:[0,0,-jaw]};
 joints.jawR={rotation:[0,0,jaw]};

 if(!moving&&!dead&&!attacking&&hit===0)return {joints:{}};
 return {joints};
}
