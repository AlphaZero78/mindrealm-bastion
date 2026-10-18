import {clamp, ease, fract, pulse, smooth, stroke} from '../enemy-rig.js';

const finite = (value, fallback=0) => Number.isFinite(value) ? value : fallback;
const neutral = () => ({joints:{}});
// A servo sweeps between bounded correction points. Only its vanes move;
// a stable lift controller keeps the suspended fuselage at a fixed height.
const triangle = x => 1 - 4*Math.abs(fract(x)-.5);
const ROTOR_RATE = .024;
const DEATH_MS = 650;

/** Pure pose: simulation milliseconds power the fans; speed sets thrust vector. */
export function animate(context={}) {
  const action = context.action || 'idle';
  const dead = action==='death' || action==='wreck';
  if (context.reducedMotion&&!dead || ['preview','disabled','stopped','static','idle'].includes(action)) return neutral();
  const p = dead&&(context.reducedMotion||action==='wreck') ? 1 : clamp(finite(context.progress));
  const clock = Math.max(0,finite(context.clock));
  const moving = action==='move' || context.moving===true;
  const speed = Math.max(0,finite(context.speed, moving ? 1.25 : 0));
  const throttle = moving ? clamp(speed/1.8,.25,1) : 0;
  const correction = triangle(clock/1100)*.012;
  let pitch = moving ? .050+.025*throttle : 0;
  let roll = 0, forward = 0, height = 0;
  let vector = moving ? .105+.075*throttle : 0;
  let nozzleBias = correction, rudder = moving ? correction*.8 : correction*.35;
  let sensorPitch = -pitch, sensorYaw = moving ? 0 : correction*.45;
  let ram = 0, tipCompression = 0, impellerWork = 0;
  let rotorL = clock*ROTOR_RATE, rotorR = -clock*ROTOR_RATE;
  let bendL = 0, bendR = 0, nozzleCrush = 0;

  if (action==='attack') {
    const work = stroke(p,.23,.43);
    const preparation = pulse(p,0,.23,.44);
    const contact = pulse(p,.23,.43,.76);
    const braking = pulse(p,.41,.60,1);
    // Thrust tilts aft for the drive stroke, then forward to arrest it.
    vector += -.10*preparation+.27*contact-.12*braking;
    pitch += .14*contact-.025*braking;
    forward = -.135*work;
    height = -.065*contact;
    ram = -.23*work;
    tipCompression = .055*pulse(p,.40,.49,.64);
    rudder += .08*braking;
    sensorPitch = -pitch;
    impellerWork = .32*contact;
  } else if (action==='cast') {
    const windup = context.stage==='windup' || String(context.actionKind||'').includes('windup');
    const calibration = windup ? smooth(p) : 1-smooth(p);
    // This monster's air ability is passive. These pose stages show thrust
    // calibration, so the visual neither fires a weapon nor advertises an aura.
    vector = .10*calibration;
    nozzleBias = .045*calibration;
    rudder = -.13*calibration;
    sensorPitch = .09*calibration-pitch;
    sensorYaw = -.055*calibration;
    impellerWork = .20*calibration;
  }

  const hit = dead ? 0 : action==='hit' ? 1-smooth(p) : clamp(finite(context.hit));
  if (hit>0) {
    forward += .045*hit;
    height -= .02*hit;
    pitch -= .07*hit;
    roll += .045*hit;
    // Differential vectoring counters the received angular impulse.
    nozzleBias -= .095*hit;
    ram += .035*hit;
    sensorPitch = -pitch;
  }

  if (dead) {
    const fall = ease(p,.12,.72);
    const impact = pulse(p,.66,.76,.92);
    pitch = .12*ease(p,.26,.88);
    roll = -.27*ease(p,.17,.80);
    forward = .045*fall;
    height = -.16*fall+.018*impact;
    vector = .20*ease(p,0,.35);
    nozzleBias = 0;
    nozzleCrush = .09*ease(p,.67,.90);
    rudder = .24*ease(p,.17,.81);
    sensorPitch = .13*ease(p,.10,.63);
    sensorYaw = 0;
    ram = .06*ease(p,.60,.89);
    tipCompression = .035*ease(p,.68,.88);
    impellerWork = 0;
    bendL = .66*ease(p,.16,.74);
    bendR = .19*ease(p,.52,.91);
    // Integrate linear fan deceleration over the actual 650 ms death window.
    // Deriving the initial clock keeps the shaft phase continuous at p=0.
    const startClock = Math.max(0,finite(context.deathStartClock,action==='wreck'?0:clock-DEATH_MS*p));
    const arrest = startClock*ROTOR_RATE+ROTOR_RATE*DEATH_MS*(p-.5*p*p);
    rotorL = arrest;
    rotorR = -arrest;
  }

  return {
    joints: {
      chassis: {rotation:[pitch,roll,0],position:[0,forward,height]},
      rotorL: {rotation:[0,0,rotorL+impellerWork]},
      rotorR: {rotation:[0,0,rotorR-impellerWork]},
      brokenBladeL: {rotation:[bendL,0,-bendL*.18]},
      brokenBladeR: {rotation:[bendR,0,bendR*.15]},
      nozzleL: {rotation:[vector,nozzleBias-nozzleCrush,0],position:[0,0,nozzleCrush*.13]},
      nozzleR: {rotation:[vector,-nozzleBias,0]},
      rudder: {rotation:[0,0,rudder]},
      sensor: {rotation:[sensorPitch,0,sensorYaw]},
      ram: {position:[0,ram,0]},
      ramTip: {position:[0,tipCompression,0],rotation:[-.07*tipCompression/.055,0,0]},
    },
  };
}
