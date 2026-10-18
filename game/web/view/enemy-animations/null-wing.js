import {TAU, clamp, ease, fract, pulse, smooth, stroke} from '../enemy-rig.js';

const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
const triangle=value=>1-4*Math.abs(fract(value)-.5);
const fixed=()=>({joints:{}});

function failedPose(progress) {
  const p=clamp(progress),unload=ease(p,.03,.68),fold=ease(p,.16,.88);
  return {joints:{
    chassis:{rotation:[.11*unload,.065*unload,0]},
    trimL:{rotation:[.31*fold,-.14*fold,0]},
    trimR:{rotation:[.20*fold,.10*fold,0]},
    rudder:{rotation:[.13*fold,.08*fold,.15*fold]},
    sensor:{rotation:[.15*unload,0,0]},
    vectorLF:{rotation:[-.18*unload,-.11*unload,0]},
    vectorRF:{rotation:[-.15*unload,.09*unload,0]},
    vectorLR:{rotation:[.13*unload,-.13*unload,0]},
    vectorRR:{rotation:[.17*unload,.10*unload,0]},
    radioDeck:{position:[0,0,-.035*unload]},
    arrayL:{rotation:[0,.18*fold,-.06*fold]},
    arrayR:{rotation:[0,-.14*fold,.08*fold]},
    arrayC:{rotation:[.48*fold,0,0]},
    tuner:{rotation:[0,0,0]},
    contactRam:{position:[0,.035*unload,0]},
    contactTip:{position:[0,.028*fold,0]},
  }};
}

/** Four vector nozzles keep working during the jam preparation and hold. */
export function animate(context={}) {
  const action=context.action||'idle',p=clamp(finite(context.progress));
  if (action==='death'||action==='wreck') return failedPose(context.reducedMotion||action==='wreck'?1:p);
  if (['preview','disabled','stopped','static'].includes(action)) return fixed();

  const moving=context.moving===true||action==='move';
  const speed=Math.max(0,finite(context.speed,moving?1.07:0));
  const thrust=moving?clamp(speed/1.7,.16,1):0;
  const abilityMatches=!context.ability||context.ability==='jam';
  const active=context.abilityActive===true&&abilityMatches;
  const casting=abilityMatches&&['cast','ability','jam'].includes(action);
  const windup=casting&&(context.stage==='windup'||String(context.actionKind||'').includes('windup'));
  const release=casting&&!windup;
  const elapsed=Math.max(0,finite(context.abilityElapsed));
  const remaining=Math.max(0,finite(context.abilityRemaining,active?4:0));
  const duration=Math.max(.001,elapsed+remaining);
  const held=active?ease(remaining,0,.38):0;
  const scan=active&&!context.reducedMotion?triangle(elapsed/.85)*.024*ease(elapsed,0,.15)*held:0;

  // All corrections belong to actual nozzle trunnions and wing controls.
  // The sealed patrol hull retains a constant translation and attitude.
  const servo=moving&&!context.reducedMotion?triangle(finite(context.travel)/.84)*.012:0;
  let vectorPitch=moving?.075+.11*thrust:0;
  let vectorRoll=servo*.45;
  let trim=moving?-.035-.06*thrust:0;
  let rudder=servo;
  let sensor=moving?-.025*thrust:0;
  let spread=.68*held,back=.29*held,lift=.080*held;
  let tuner=active&&Number.isFinite(context.abilityElapsed)?TAU*6*smooth(clamp(elapsed/duration)):0;
  let ram=0,contact=0;

  if (windup) {
    const open=smooth(p);
    spread=.68*open;back=.29*open;lift=.080*open;
    tuner=0;
    trim-=.02*open;
  } else if (release) {
    const discharge=pulse(p,0,.18,.66);
    // The live active interval preserves the prepared endpoint. Standalone
    // release previews recover through the same physical working stroke.
    const open=active?held:1-smooth(p);
    spread=.68*open;back=.29*open;
    lift=.080*open-.027*discharge;
    if (!active) tuner=TAU*3*smooth(p);
    trim-=.028*discharge;
  }

  if (action==='attack') {
    const work=stroke(p,.23,.47),prepare=pulse(p,0,.23,.46);
    const impact=pulse(p,.23,.47,.73),brake=pulse(p,.47,.68,1);
    ram=-.17*work;
    contact=.042*pulse(p,.45,.54,.75);
    vectorPitch-=.07*prepare;
    vectorPitch+=.10*impact-.12*brake;
    trim+=.15*prepare+.18*brake;
    sensor+=.045*prepare;
  }

  const hit=action==='hit'?1-smooth(p):clamp(finite(context.hit));
  const recoil=context.reducedMotion?0:hit;
  vectorRoll-=.065*recoil;
  trim+=.10*recoil;
  rudder+=.10*recoil;
  sensor+=.07*recoil;
  ram+=.024*recoil;

  if (context.reducedMotion) {
    const open=active||windup?1:0;
    return {joints:{
      vectorLF:{rotation:[moving?.13:0,0,0]},
      vectorRF:{rotation:[moving?.13:0,0,0]},
      vectorLR:{rotation:[moving?.13:0,0,0]},
      vectorRR:{rotation:[moving?.13:0,0,0]},
      trimL:{rotation:[moving?-.06:0,0,0]},
      trimR:{rotation:[moving?-.06:0,0,0]},
      radioDeck:{position:[0,0,.065*open]},
      arrayL:{rotation:[0,-.68*open,0]},
      arrayR:{rotation:[0,.68*open,0]},
      arrayC:{rotation:[-.29*open,0,0]},
      contactRam:{position:[0,action==='attack'?-.10:0,0]},
      contactTip:{position:[0,action==='attack'?.035:0,0]},
    }};
  }

  if (action==='idle'&&!moving&&!active&&!windup&&!release&&!recoil) return fixed();
  return {joints:{
    chassis:{rotation:[.055*recoil,0,.025*recoil]},
    trimL:{rotation:[trim+servo,0,0]},
    trimR:{rotation:[trim-servo,0,0]},
    rudder:{rotation:[0,0,rudder]},
    sensor:{rotation:[sensor,0,-servo*.5]},
    vectorLF:{rotation:[vectorPitch,vectorRoll,0]},
    vectorRF:{rotation:[vectorPitch,-vectorRoll,0]},
    vectorLR:{rotation:[vectorPitch*.92,vectorRoll,0]},
    vectorRR:{rotation:[vectorPitch*.92,-vectorRoll,0]},
    radioDeck:{position:[0,0,lift]},
    arrayL:{rotation:[.02*recoil,-spread+.035*recoil,-scan]},
    arrayR:{rotation:[.015*recoil,spread-.025*recoil,scan]},
    arrayC:{rotation:[-back+.05*recoil,0,scan*.6]},
    tuner:{rotation:[0,0,tuner]},
    contactRam:{position:[0,ram,0]},
    contactTip:{position:[0,contact,0]},
  }};
}
