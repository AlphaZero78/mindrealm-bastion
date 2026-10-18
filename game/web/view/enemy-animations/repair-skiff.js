import {TAU,clamp,ease,pulse,smooth,stroke} from '../enemy-rig.js';

const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
const liftIds=['LF','RF','LR','RR'];
const fixed=()=>({joints:{}});

function failed(progress) {
  const p=clamp(progress),bleed=ease(p,.02,.48),settle=ease(p,.40,.88);
  return {joints:{
    // These are local losses of pressure; the renderer lowers the aircraft.
    liftLF:{rotation:[.28*bleed,-.20*settle,0]},
    liftRF:{rotation:[-.12*bleed,.08*settle,0]},
    liftLR:{rotation:[.17*bleed,-.12*settle,0]},
    liftRR:{rotation:[.05*bleed,.22*settle,0]},
    trimL:{rotation:[.32*settle,0,0]},
    trimR:{rotation:[.17*settle,0,0]},
    coverL:{rotation:[0,-.42*settle,0]},
    coverR:{rotation:[0,.11*settle,0]},
    pump:{position:[0,0,-.04*bleed]},
    distributor:{rotation:[0,0,.17*bleed]},
    sensor:{rotation:[.12*settle,0,0]},
    injector:{position:[0,.045*settle,0]},
    contact:{position:[0,.025*settle,0]},
  }};
}

/** Pure local actuator pose. Healing remains an instantaneous simulation fact. */
export function animate(context={}) {
  const action=context.action||'idle',p=clamp(finite(context.progress));
  if(action==='death'||action==='wreck')return failed(context.reducedMotion||action==='wreck'?1:p);
  if(['preview','static','disabled','stopped','idle'].includes(action))return fixed();

  const moving=action==='move'||context.moving===true;
  const speed=Math.max(0,finite(context.speed,moving ? .95 : 0));
  const throttle=moving?clamp(speed/1.7,.20,1):0;
  // Flight is sustained by four vectoring nozzles. Their fixed command follows
  // real speed; no periodic translation or rotation is assigned to the hull.
  const boost=(context.boosted===true||context.sprinting===true)?1:0;
  let vector=moving ? .055+.095*throttle+.02*boost : 0;
  let brake=0,trim=moving?-.03-.055*throttle:0;
  let open=0,pump=0,disc=0,needle=0,compression=0,sensor=0,roll=0;
  const casting=['cast','ability','heal'].includes(action);
  const ownHeal=casting&&(!context.ability||context.ability==='heal')&&
    !String(context.actionKind||'').startsWith('surge')&&!String(context.actionKind||'').startsWith('push');
  const preparing=ownHeal&&(context.stage==='windup'||String(context.actionKind||'').includes('windup'));

  if(preparing) {
    open=ease(p,.02,.82);
    pump=.18*ease(p,.25,1);
    sensor=-.055*open;
    trim-=.018*open;
  } else if(ownHeal) {
    // p=0 matches the completed warning pose. The pump's work stroke releases
    // first, then the rotating distributor and shutters return to their seats.
    open=1-ease(p,.60,1);
    pump=.18*(1-ease(p,0,.23))-.028*pulse(p,.08,.23,.54);
    disc=TAU*2*smooth(p);
    brake=.035*pulse(p,0,.18,.58);
    trim+=.07*pulse(p,0,.20,.64);
    sensor=-.055*(1-smooth(p));
  }

  if(action==='attack'||action==='breach') {
    const work=stroke(p,.24,.45),prepare=pulse(p,0,.24,.44);
    const contact=pulse(p,.24,.45,.69),arrest=pulse(p,.45,.65,1);
    needle=-.16*work;
    compression=.044*pulse(p,.43,.53,.72);
    vector+=-.085*prepare+.18*contact-.08*arrest;
    brake=.06*prepare+.12*arrest;
    trim+=.10*prepare+.20*arrest;
    sensor=.04*prepare;
  }

  const hit=action==='hit'?1-smooth(p):clamp(finite(context.hit));
  if(hit>0&&!context.reducedMotion) {
    // Fast nozzle counter-vectoring and a brief relief stroke absorb an
    // angular impulse without moving the whole load-bearing frame.
    roll=.10*hit;
    vector-=.045*hit;
    trim+=.105*hit;
    pump-=.018*hit;
    open=Math.max(open,.065*hit);
    needle+=.025*hit;
    sensor+=.06*hit;
  }

  if(context.reducedMotion) {
    // Every action presents a fixed end state. Warning keeps the prepared
    // mechanism visible; the instantaneous release has its returned end pose.
    open=preparing ? 1 : 0;pump=preparing ? .18 : 0;disc=0;
    needle=0;compression=0;roll=0;brake=0;
    vector=moving ? .105 : 0;trim=moving ? -.07 : 0;sensor=preparing ? -.055 : 0;
  }

  const joints={
    coverL:{rotation:[0,-1.02*open,0]},
    coverR:{rotation:[0,1.02*open,0]},
    pump:{position:[0,0,pump]},
    distributor:{rotation:[0,0,disc]},
    trimL:{rotation:[trim+.10*roll,0,0]},
    trimR:{rotation:[trim-.10*roll,0,0]},
    sensor:{rotation:[sensor,0,0]},
    injector:{position:[0,needle,0]},
    contact:{position:[0,compression,0]},
  };
  for(const id of liftIds) {
    const left=id[0]==='L',front=id[1]==='F';
    joints['lift'+id]={rotation:[vector+(front?-brake:brake),(left?-1:1)*roll,0]};
  }
  return {joints};
}
