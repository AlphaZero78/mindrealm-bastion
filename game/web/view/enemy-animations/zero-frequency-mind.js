import {clamp,smooth,ease,pulse,wheelRollAngle,wheelSupportHeight} from '../enemy-rig.js';

const finite=(v,fallback=0)=>Number.isFinite(v)?v:fallback;
const rotate=(rx=0,ry=0,rz=0)=>({rotation:[rx,ry,rz]});
const neutral=()=>({joints:{},root:{rotation:[0,0,0],position:[0,0,0]}});
const radius=.30;
const bankAngle=phase=>[0,32,49][phase]*Math.PI/180;
const crownAngle=phase=>[76,47,0][phase]*Math.PI/180;

function traction(joints,travel){
 const angle=wheelRollAngle(travel,radius);
 joints.chassis={position:[0,0,wheelSupportHeight(angle,radius)-radius]};
 for(const side of ['L','R'])for(let axle=0;axle<4;axle++)joints[`wheel${side}${axle}`]=rotate(angle);
}

function channels(joints,phase,{open=0,pressure=0,stroke=0,spread=0,crown=0}={}){
 joints.shutterL={position:[-.235*open,0,0]};
 joints.shutterR={position:[.235*open,0,0]};
 joints.diaphragm={position:[0,.075*pressure-.115*stroke,0]};
 joints.nullCore={position:[0,.072*pressure-.092*stroke,0]};
 for(const side of [-1,1]){
  const tag=side<0?'L':'R',a=side*bankAngle(phase);
  joints['channel'+tag]=rotate(0,0,side*.09*spread);
  const work=.048*pressure-.090*stroke;
  joints[`feed${tag}${phase}`]={position:[-Math.sin(a)*work,Math.cos(a)*work,0]};
  joints['cover'+tag]=rotate(0,side*(.12*open+.09*pressure),0);
 }
 const tilt=crownAngle(phase),work=-.135*crown;
 joints.crown=rotate(-.095*spread);
 joints.crownFeed={position:[0,-Math.sin(tilt)*work,Math.cos(tilt)*work]};
}

// The 420 ms released attack still describes one coherent mechanical cycle:
// guide doors uncover the drum, the core withdraws, the diaphragm compresses,
// the pressure face releases, and the captured core returns to its stop.
function impactCycle(p,kind){
 const terrain=kind==='terrain',breach=kind==='breach';
 const prepare=ease(p,0,.20)*(1-ease(p,.30,.45));
 const contact=pulse(p,.20,breach?.44:.36,breach?.85:.63);
 const release=pulse(p,.31,.44,.81);
 return {open:pulse(p,0,.22,.96),pressure:prepare,stroke:contact*(terrain?1.18:breach?.92:.80),reaction:release*(terrain?1.20:1),spread:.32*release,crown:.45*contact};
}

function wreck(progress,travel,phase){
 const p=clamp(progress),unload=ease(p,.17,.62),sag=ease(p,.33,.94);
 const joints={};traction(joints,travel);
 channels(joints,phase,{open:0,pressure:0,stroke:-.26*unload,spread:-1.20*unload,crown:.86*unload});
 joints.pressureFrame={position:[0,.025*sag,-.19*sag],rotation:[-.045*sag,0,0]};
 joints.powerpack={position:[0,.025*unload,-.05*sag],rotation:[-.09*sag,.055*sag,0]};
 joints.gate={rotation:[-.20*sag,0,0],position:[0,.035*sag,-.05*sag]};
 joints.sight=rotate(.17*unload,0,.05*sag);
 joints.crown=rotate([.10,.31,.77][phase]*unload);
 joints.coverL=rotate(0,.15*unload,0);
 joints.coverR=rotate(0,-.18*unload,0);
 return {joints,root:{rotation:[0,0,0],position:[0,0,0]}};
}

export function animate(ctx={}){
 const action=ctx.action||'idle',p=clamp(finite(ctx.progress)),phase=clamp(Math.floor(finite(ctx.phase)),0,2);
 const travel=Math.max(0,finite(ctx.travel)),kind=String(ctx.actionKind||'');
 if(['preview','static','stopped','disabled'].includes(action))return neutral();
 if(action==='wreck'||action==='death')return wreck(action==='wreck'||ctx.reducedMotion?1:p,ctx.reducedMotion?0:travel,phase);
 if(ctx.reducedMotion)return neutral();

 const joints={};traction(joints,travel);
 const moving=(ctx.moving||action==='move')&&finite(ctx.speed)>0;
 const hit=clamp(finite(ctx.hit));
 const windup=ctx.stage==='windup'||kind.endsWith('windup');
 const surge=kind.startsWith('surge')||ctx.ability==='surge';
 const push=kind.startsWith('push')||ctx.ability==='push';
 let open=0,pressure=0,stroke=0,spread=0,crown=0,load=moving?.009:0,recoil=0,gatePitch=0;

 if(action==='attack'||action==='terrain'||action==='breach'){
  const c=impactCycle(p,action==='terrain'||action==='breach'?action:kind);
  ({open,pressure,stroke,spread,crown}=c);
  recoil=.055*c.reaction;load+=.035*c.reaction;gatePitch=.036*c.reaction;
 }else if(action==='cast'&&push){
  // Six blocked attacks trigger a real stationary warning. Closed doors and
  // locked pressure channels make the front hull the visible advance device.
  const lock=windup?smooth(p):1-ease(p,.28,1);
  pressure=.24*lock;stroke=.10*lock;crown=.24*lock;
  spread=-.44*lock;load+=.029*lock;gatePitch=-.026*lock;
 }else if(action==='cast'&&surge){
  if(windup){
   const draw=smooth(p);open=.86*draw;pressure=.98*draw;
   spread=.75*draw;crown=-.62*draw;load+=.035*draw;
  }else{
   // A surge is emitted from its marked fixed origin. Crown compression drives
   // the two independent side throats, then the front face unloads to its stop.
   const stored=1-ease(p,0,.20),work=pulse(p,0,.22,.76),ret=1-ease(p,.42,1);
   open=.86*ret;pressure=.98*stored;stroke=1.20*work;spread=.75*ret;crown=-.62*stored+1.20*work;
   recoil=.077*work;load+=.035*stored+.055*work;gatePitch=.053*work;
  }
 }else if(action==='cast'){
  if(windup){
   const draw=smooth(p);open=draw;pressure=.85*draw;
   spread=.60*draw;crown=-.42*draw;load+=.018*draw;
  }else if(kind==='phase'){
   // Geometry already uses the actual stage deployment. Its root bearing
   // settles against its new stop without undoing the authored stage silhouette.
   const latch=1-ease(p,.10,1);open=.24*latch;spread=.3*latch;load+=.022*latch;
  }else{
   const stored=1-ease(p,0,.19),work=pulse(p,0,.19,.64),ret=1-ease(p,.40,1);
   open=ret;pressure=.85*stored;stroke=work;spread=.60*ret;crown=-.42*stored+work;
   recoil=.058*work;load+=.018*stored+.034*work;gatePitch=.040*work;
  }
 }

 // Actual sprint/haste only changes the transport lock and loaded suspension.
 // It never fabricates an enduring siege aura from an allied abilityActive.
 if(moving){
  const boost=(ctx.sprinting?1:0)+(ctx.boosted?.5:0);
  load+=.004*boost;gatePitch-=.012+.006*boost;
  if(action==='move'){pressure=.10;spread=-.10;}
 }
 load+=.026*hit;recoil+=.034*hit;gatePitch+=.024*hit;
 pressure+=.17*hit;
 channels(joints,phase,{open,pressure,stroke,spread,crown});
 joints.pressureFrame={position:[0,recoil,-load],rotation:[gatePitch*.35,0,0]};
 joints.gate={rotation:[gatePitch,0,0]};
 joints.powerpack={position:[0,.017*pressure,-.008*pressure],rotation:[-.025*pressure,0,0]};
 joints.sight=rotate(-.025*pressure+.08*hit,0,0);
 return {joints,root:{rotation:[0,0,0],position:[0,0,0]}};
}
