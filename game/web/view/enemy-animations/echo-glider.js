import {TAU, clamp, ease, fract, pulse, smooth, stroke} from '../enemy-rig.js';

const finite = (value, fallback=0) => Number.isFinite(value) ? value : fallback;
const triangle = value => 1-4*Math.abs(fract(value)-.5);
const FAN_RATE = .030;
const DEATH_MS = 650;
const fixed = () => ({joints:{}});

function expiredPose(progress, context) {
  const p = clamp(progress);
  const fold = ease(p,.10,.76);
  const shut = ease(p,.03,.56);
  const echoDrop = ease(p,0,.44);
  const startClock = Math.max(0,finite(context.deathStartClock,context.action==='wreck'?0:finite(context.clock)-DEATH_MS*p));
  // Integrate a linear arrest; the renderer supplies the actual 1.3-high fall.
  const rotor = startClock*FAN_RATE+DEATH_MS*FAN_RATE*(p-p*p/2);
  return {
    joints: {
      flapL: {rotation:[.18*fold,-.34*fold,0]},
      flapR: {rotation:[.13*fold,.22*fold,0]},
      elevator: {rotation:[.28*fold,0,0]},
      rudder: {rotation:[0,.10*fold,.17*fold]},
      tailVentL: {rotation:[.36*shut,0,0]},
      tailVentR: {rotation:[.36*shut,0,0]},
      liftVector: {rotation:[.09*shut,.12*shut,0]},
      liftRotor: {rotation:[0,0,rotor]},
      echoL: {rotation:[-.22*echoDrop,-.31*echoDrop,0]},
      echoR: {rotation:[-.22*echoDrop,.31*echoDrop,0]},
      echoLift: {position:[0,0,-.04*echoDrop]},
      echoRotor: {rotation:[0,0,0]},
      sensor: {rotation:[.10*fold,0,0]},
      attackSled: {position:[0,.035*shut,0]},
      contactTip: {position:[0,.025*fold,0]},
    },
  };
}

/** Mechanical flight controls stay independent from the support cast state. */
export function animate(context={}) {
  const action = context.action || 'idle';
  const p = clamp(finite(context.progress));
  if (action==='death' || action==='wreck') return expiredPose(context.reducedMotion || action==='wreck' ? 1 : p, context);
  if (['preview','disabled','stopped','static','idle'].includes(action)) return fixed();

  const clock = Math.max(0,finite(context.clock));
  const moving = action==='move' || context.moving===true;
  const speed = Math.max(0,finite(context.speed,moving ? 1.16 : 0));
  const thrust = moving ? clamp(speed/2,.18,1) : 0;
  const boosted = context.boosted===true;
  const active = context.abilityActive===true && (!context.ability || context.ability==='haste');
  const elapsed = Math.max(0,finite(context.abilityElapsed));
  const remaining = Math.max(0,finite(context.abilityRemaining,active ? 4 : 0));
  const duration = Math.max(.001,elapsed+remaining);
  const held = active ? ease(remaining,0,.34) : 0;
  const casting = ['cast','ability','haste'].includes(action);
  const windup = casting && (context.stage==='windup' || String(context.actionKind||'').includes('windup'));
  const release = casting && !windup;

  // Small bounded servo corrections act only on real wing controls and the
  // thrust gimbal. The rigid glider does not bob or rock while travelling.
  const servo = context.reducedMotion ? 0 : triangle(clock/1350)*.018;
  let liftPitch = moving ? .075+.08*thrust+(boosted ? .025 : 0) : 0;
  let liftRoll = servo*.45;
  let flap = moving ? -.04-.055*thrust : .015;
  let elevator = moving ? -.035-.035*thrust : 0;
  let rudder = servo;
  let outlet = moving ? -.06-.12*thrust : .04;
  let sensor = moving ? -.022*thrust : 0;
  let echoSpread = .50*held;
  let echoPitch = -.10*held;
  let lift = .075*held;
  let echoAngle = active && Number.isFinite(context.abilityElapsed) ? TAU*8*smooth(clamp(elapsed/duration)) : 0;
  let probe = 0, contact = 0;

  if (windup) {
    const open = smooth(p);
    echoSpread = .50*open;
    echoPitch = -.10*open;
    lift = .11*open;
    echoAngle = 0;
    // Wings remain flight controls; opening the transmitters does not brake.
    elevator -= .018*open;
  } else if (release) {
    const discharge = pulse(p,0,.15,.58);
    echoSpread = Math.max(echoSpread,.50*(1-smooth(p)));
    echoPitch -= .07*discharge;
    lift = .075*held+.035*(1-smooth(p))-.025*discharge;
  }

  if (action==='attack') {
    const work = stroke(p,.23,.46);
    const prepare = pulse(p,0,.23,.44);
    const impact = pulse(p,.23,.46,.73);
    const braking = pulse(p,.46,.64,1);
    probe = -.12*work;
    contact = .042*pulse(p,.43,.52,.71);
    liftPitch += -.06*prepare+.15*impact-.10*braking;
    flap += .10*prepare+.18*braking;
    elevator += .06*prepare-.07*impact+.12*braking;
    outlet += .13*prepare-.10*impact+.16*braking;
    sensor += .06*prepare;
  }

  const hit = action==='hit' ? 1-smooth(p) : clamp(finite(context.hit));
  if (hit>0 && !context.reducedMotion) {
    flap += .12*hit;
    liftRoll -= .08*hit;
    rudder += .09*hit;
    echoPitch += .08*hit;
    probe += .025*hit;
    sensor += .06*hit;
  }

  if (context.reducedMotion) {
    // Fixed open arrays still disclose the real support interval. Destruction
    // was handled above and always retains its final local failure pose.
    return {joints:{
      liftVector:{rotation:[moving ? .10 : 0,0,0]},
      flapL:{rotation:[moving ? -.07 : 0,0,0]},
      flapR:{rotation:[moving ? -.07 : 0,0,0]},
      echoL:{rotation:[0,-(active || windup ? .50 : 0),0]},
      echoR:{rotation:[0,active || windup ? .50 : 0,0]},
      echoLift:{position:[0,0,active || windup ? .075 : 0]},
    }};
  }

  return {
    joints: {
      flapL: {rotation:[flap+servo,0,0]},
      flapR: {rotation:[flap-servo,0,0]},
      elevator: {rotation:[elevator,0,0]},
      rudder: {rotation:[0,0,rudder]},
      tailVentL: {rotation:[outlet,servo*.35,0]},
      tailVentR: {rotation:[outlet,-servo*.35,0]},
      liftVector: {rotation:[liftPitch,liftRoll,0]},
      liftRotor: {rotation:[0,0,clock*FAN_RATE]},
      sensor: {rotation:[sensor,0,-servo*.4]},
      echoL: {rotation:[echoPitch,-echoSpread,0]},
      echoR: {rotation:[echoPitch,echoSpread,0]},
      echoLift: {position:[0,0,lift]},
      echoRotor: {rotation:[0,0,echoAngle]},
      attackSled: {position:[0,probe,0]},
      contactTip: {position:[0,contact,0]},
    },
  };
}
