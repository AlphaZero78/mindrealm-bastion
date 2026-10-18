import {clamp, ease, fract, pulse, smooth, stroke} from '../enemy-rig.js';

const HIP_Y = .12, HIP_Z = .92, FOOT_Y = .10, FOOT_Z = .14;
const UPPER = Math.hypot(.24,.42), LOWER = Math.hypot(.22,.36);
const REST_HIP = -Math.atan2(.24,.42);
const REST_CALF = Math.atan2(.22,.36);
const REST_KNEE = REST_CALF - REST_HIP;
const lerp = (a,b,t) => a+(b-a)*t;

// Solve the foot before the links. This keeps support contacts in model space
// while the chest crouches, recoils or pitches over the hip cross-member.
function solveLeg(foot, body) {
  const dy = foot.y - HIP_Y - body.y;
  const dz = HIP_Z + body.z - foot.z;
  const distance = clamp(Math.hypot(dy,dz), Math.abs(UPPER-LOWER)+.001, UPPER+LOWER-.001);
  const hip = Math.atan2(dy,dz) - Math.acos(clamp((UPPER*UPPER+distance*distance-LOWER*LOWER)/(2*UPPER*distance),-1,1));
  const knee = Math.PI-Math.acos(clamp((UPPER*UPPER+LOWER*LOWER-distance*distance)/(2*UPPER*LOWER),-1,1));
  const hipDelta = hip-REST_HIP-body.pitch;
  const kneeDelta = knee-REST_KNEE;
  return {
    hip: hipDelta,
    knee: kneeDelta,
    ankle: foot.pitch-body.pitch-hipDelta-kneeDelta,
    toe: -foot.pitch+foot.toeCurl,
  };
}

function footCycle(phase, sprintAmount) {
  const p = fract(phase), duty = .64;
  const stride = .64, lift = .17+.06*sprintAmount;
  const toeOff = .30+.08*sprintAmount;
  if (p < duty) {
    const t = p/duty, pitch = toeOff*ease(t,.72,1);
    // The toe plate counter-rotates to stay flat. Its pivot is .32 forward
    // and .07 below the ankle, so the heel lift has an exact toe contact.
    return {
      y: FOOT_Y+stride*(t-.5)-.32+.32*Math.cos(pitch)-.07*Math.sin(pitch),
      z: FOOT_Z+.32*Math.sin(pitch)+.07*Math.cos(pitch)-.07,
      pitch, toeCurl: 0, load: pulse(t,0,.16,.45), stance: true,
    };
  }
  const t = (p-duty)/(1-duty);
  const pitch = t < .3 ? lerp(toeOff,-.2,smooth(t/.3)) : lerp(-.2,0,ease(t,.3,1));
  const toeRise = .32*Math.sin(toeOff)+.07*Math.cos(toeOff)-.07;
  const heelClearance = .22*Math.max(0,-Math.sin(pitch));
  return {
    y: FOOT_Y+stride*(.5-smooth(t))-.32+.32*Math.cos(pitch)-.07*Math.sin(pitch),
    z: FOOT_Z+lift*4*t*(1-t)+toeRise*(1-ease(t,0,.3))+heelClearance,
    pitch, toeCurl: .18*pulse(t,.12,.35,.76), load: 0, stance: false,
  };
}

const planted = (y=FOOT_Y,pitch=0) => ({
  y: y-.32+.32*Math.cos(pitch)-.07*Math.sin(pitch),
  z: FOOT_Z+.32*Math.sin(pitch)+.07*Math.cos(pitch)-.07,
  pitch, toeCurl: 0, load: 0, stance: true,
});

/** Pure per-monster presentation. Travel, not wall time, drives the mechanism. */
export function animate(context={}) {
  const action = context.action || 'idle';
  if (['preview','disabled','stopped','static'].includes(action)) return {joints:{}};
  const dead = action==='death' || action==='wreck';
  if(context.reducedMotion&&!dead)return {joints:{}};
  const q = action==='wreck'||dead&&context.reducedMotion ? 1 : clamp(Number.isFinite(context.progress) ? context.progress : 0);
  const moving = !dead && (action==='move' || context.moving===true);
  const sprinting = context.sprinting===true;
  const sprintElapsed=Number.isFinite(context.abilityElapsed)?context.abilityElapsed:.22,sprintRemaining=Number.isFinite(context.abilityRemaining)?context.abilityRemaining:.22;
  const sprintAmount=sprinting?ease(sprintElapsed,0,.22)*ease(sprintRemaining,0,.22):0;
  // Cadence follows actual travel at either speed. Keeping the contact cycle
  // fixed preserves planted feet when sprint starts and ends.
  const cycleDistance=1;
  const phase = fract(Number.isFinite(context.travel) ? context.travel/cycleDistance : q);
  let left = moving ? footCycle(phase,sprintAmount) : planted();
  let right = moving ? footCycle(phase+.5,sprintAmount) : planted();
  const body = {
    y: moving ? -.025-.05*sprintAmount : 0,
    z: moving ? -.022-.035*Math.max(left.load,right.load) : 0,
    pitch: moving ? .095+.095*sprintAmount : 0,
  };
  let ram = 0, latch = 0, brake = 0;
  let governor = moving ? (Number.isFinite(context.travel) ? context.travel*9 : phase*Math.PI*2) : 0;

  if (action==='attack') {
    const work = stroke(q,.25,.43), contact = pulse(q,.25,.43,.78);
    body.y += -.09*work;
    body.z -= .055*pulse(q,0,.25,.62);
    body.pitch += .095*work;
    ram = -.285*work;
    latch = -.14*contact;
    brake = .20*ease(q,.43,.68)*(1-ease(q,.8,1));
    if (!moving) {
      left = planted(-.13);
      right = planted(.29,.20*contact);
    }
  } else if (action==='cast') {
    const windup = context.stage==='windup' || String(context.actionKind||'').includes('windup');
    if (windup) {
      const charge = smooth(q);
      body.y -= .04*charge;
      body.z -= .135*charge;
      body.pitch += .17*charge;
      ram = .075*charge;
      latch = -.68*charge;
      brake = .26*charge;
      governor -= Math.PI*2.5*charge;
      if (!moving) {left=planted(-.14);right=planted(.30);}
    } else {
      const launch = pulse(q,0,.28,.82), release = 1-ease(q,.38,1);
      body.y -= .04*(1-ease(q,0,.28))+.11*launch;
      body.z += -.135*(1-ease(q,0,.3))+.045*launch;
      body.pitch += .17*release;
      ram = .075*(1-ease(q,0,.18));
      latch = -.68*(1-ease(q,0,.16));
      // The cooling vanes open after the pawl releases, then close at speed.
      brake = .26*(1-ease(q,0,.12))+.32*pulse(q,.14,.34,.92);
      governor += Math.PI*3*ease(q,0,.65);
      if (!moving) {left=planted(-.14);right=planted(.30,.35*launch);}
    }
  }

  // A short recoil compresses the links; the foot targets retain contact.
  const hit = dead ? 0 : action==='hit' ? 1-smooth(q) : clamp(Number.isFinite(context.hit) ? context.hit : 0);
  if (hit>0) {body.y+=.055*hit;body.z-=.025*hit;body.pitch-=.055*hit;ram+=.035*hit;brake+=.12*hit;}

  if (dead) {
    const collapse = ease(q,.08,.78);
    body.y = -.055*collapse;
    body.z = -.47*collapse;
    body.pitch = .34*ease(q,.22,.92);
    left=planted(-.08);right=planted(.24);
    ram=.065*collapse;
    latch=-.42*ease(q,0,.45);
    brake=.48*ease(q,.12,.78);
    governor=0;
  }

  if (!moving && !dead && action==='idle' && hit===0) return {joints:{}};
  const joints = {
    chassis: {rotation:[body.pitch,0,0],position:[0,body.y,body.z]},
    ram: {position:[0,ram,0]},
    governor: {rotation:[0,0,governor]},
    latch: {rotation:[latch,0,0]},
    brakeL: {rotation:[0,-brake,0]},
    brakeR: {rotation:[0,brake,0]},
  };
  for (const [suffix,foot] of [['L',left],['R',right]]) {
    const leg = solveLeg(foot,body);
    joints[`hip${suffix}`]={rotation:[leg.hip,0,0]};
    joints[`knee${suffix}`]={rotation:[leg.knee,0,0]};
    joints[`ankle${suffix}`]={rotation:[leg.ankle,0,0]};
    joints[`toe${suffix}`]={rotation:[leg.toe,0,0]};
  }
  return {joints};
}
