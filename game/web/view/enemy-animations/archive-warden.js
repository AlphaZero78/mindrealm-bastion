import {clamp,ease,smooth,wheelRollAngle,wheelSupportHeight} from '../enemy-rig.js';

const R=.31;
const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
const rot=(x=0,y=0,z=0)=>({rotation:[x,y,z]});
const neutral=()=>({joints:{},root:{rotation:[0,0,0],position:[0,0,wheelSupportHeight(0,R)-R]}});

function axlePose(context,joints){
 const angle=wheelRollAngle(Math.max(0,finite(context.travel)),R);
 // The rim axle is global X after its authored +90 degree Y mounting.
 for(const side of ['L','R'])for(let i=0;i<3;i++)joints['wheel'+side+i]=rot(angle);
 return wheelSupportHeight(angle,R)-R;
}

function security(joints,open,draw,press,index,gauge=0){
 joints.doorL=rot(0,0,-.98*open);
 joints.doorR=rot(0,0,.98*open);
 joints.shieldPress={position:[0,.035*draw-.095*press-.016*gauge,0]};
 joints.indexCam=rot(0,Math.PI*.5*index,0);
 joints.pump={position:[0,0,.082*draw-.045*press]};
 joints.heatL=rot(0,-.30*press,0);
 joints.heatR=rot(0,.30*press,0);
 joints.receiver=rot(-.045*open+.028*press);
}

function fallen(context,p){
 const joints={},relief=ease(p,0,.22),settle=ease(p,.18,.86),unlatch=ease(p,.20,.74);
 const support=axlePose(context,joints);
 joints.vaultSaddle={rotation:[.085*settle,-.028*settle,0],position:[0,0,-.115*settle]};
 joints.pump={position:[0,0,-.12*relief]};
 joints.shieldPress={position:[0,.075*relief,0]};
 joints.indexCam=rot(0,-.21*relief,0);
 joints.doorL=rot(.055*settle,0,-.21*unlatch);
 joints.doorR=rot(.055*settle,0,.28*unlatch);
 joints.heatL=rot(0,-.13*relief);
 joints.heatR=rot(0,.13*relief);
 joints.receiver=rot(.19*settle);
 joints.contactRam={rotation:[-.035*settle,0,0],position:[0,.072*relief,0]};
 return {joints,root:{rotation:[0,0,0],position:[0,0,support]}};
}

export function animate(context={}){
 const action=context.action||'idle',p=clamp(finite(context.progress));
 if(action==='preview'||action==='disabled')return neutral();
 if(action==='wreck')return fallen(context,1);
 if(action==='death')return fallen(context,context.reducedMotion?1:p);
 if(context.reducedMotion)return neutral();

 const joints={},support=axlePose(context,joints);
 const moving=context.moving===true||action==='move';
 const casting=['cast','ability','shield','buff'].includes(action);
 const warning=context.stage==='windup'||context.stage==='prepare'||context.actionKind==='ability-windup';
 const attacking=['attack','breach','terrain'].includes(action);
 const gauge=clamp(finite(context.shieldFraction)/.18);
 const attackWarning=attacking&&warning;
 // Melee, terrain and breach arrive as actual hit/release events. Their first
 // displayed frame is the loaded contact. Rebound then draws the tube back
 // inside its guide and reseats it; an explicit warning uses the same preload.
 const pre=attackWarning?ease(p,0,.74):attacking?ease(p,.18,.40)*(1-ease(p,.57,.90)):0;
 const work=attacking&&!attackWarning?1-ease(p,0,.28):0;
 const attackStroke=.055*pre-.160*work;
 // The six-wheel carrier stays planted. Motion compresses the sprung upper
 // saddle, while the receiver and pressure work remain mechanically separate.
 const seat=(moving?.018:0)+.021*pre+.016*work;
 joints.vaultSaddle={rotation:[-.03*pre+.065*work,0,0],position:[0,0,-seat]};
 joints.contactRam={position:[0,attackStroke,0]};
 if(gauge)joints.shieldPress={position:[0,-.016*gauge,0]};

 if(casting){
  // Full warning endpoint equals release frame zero. The press stroke starts
  // at the shield grant, and recovery stays inside the actual .42 s display.
  const open=warning?ease(p,.10,.79):1-ease(p,.42,.97);
  const draw=warning?ease(p,.37,.97):1-ease(p,0,.24);
  const index=warning?ease(p,.13,.72):1-ease(p,.42,.97);
  const press=warning?0:ease(p,0,.18)*(1-ease(p,.29,.69));
  security(joints,open,draw,press,index,gauge);
  const preload=warning?ease(p,0,.28):1-ease(p,.69,1);
  joints.vaultSaddle.position[2]-=.021*preload;
  joints.vaultSaddle.rotation[0]+=.014*open-.025*press;
 }

 const explicitHit=['hit','hurt','damage'].includes(action)?(p<.11?smooth(p/.11):1-ease(p,.11,1)):0;
 const hit=clamp(Math.max(finite(context.hit),explicitHit));
 if(hit){
  const impulse=hit*hit;
  joints.vaultSaddle.position[2]-=.026*impulse;
  joints.vaultSaddle.rotation[0]-=.072*impulse;
  joints.vaultSaddle.rotation[1]+=.025*impulse;
  for(const side of ['L','R']){
   const current=joints['door'+side]?.rotation||[0,0,0];
   joints['door'+side]=rot(current[0]+.045*impulse,current[1],current[2]+(side==='L'?-.026:.026)*impulse);
  }
  const press=joints.shieldPress?.position||[0,0,0];
  joints.shieldPress={position:[press[0],press[1]+.022*impulse,press[2]]};
  const pump=joints.pump?.position||[0,0,0];
  joints.pump={position:[pump[0],pump[1],pump[2]-.017*impulse]};
 }
 return {joints,root:{rotation:[0,0,0],position:[0,0,support]}};
}
