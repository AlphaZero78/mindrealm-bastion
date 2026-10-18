import { TAU, clamp, ease, smooth } from '../enemy-rig.js';

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const rot = (x = 0, y = 0, z = 0) => ({ rotation: [x, y, z] });
const neutral = () => ({ joints: {}, root: { rotation: [0, 0, 0], position: [0, 0, 0] } });
const pulse = (p, a, b, c) => ease(p, a, b) * (1 - ease(p, b, c));

function collectors(joints, open, draw = 0, stop = 0) {
  for (const side of [-1, 1]) {
    const s = side < 0 ? 'L' : 'R';
    joints['arm' + s] = rot(.018 * open + .10 * stop, 0, side * (.24 * open - .34 * stop));
    joints['scoop' + s] = rot(-.16 * open + .25 * stop, side * .035 * stop, -side * .055 * open);
    // Meter rods travel toward the audit frame while their outer tails stay
    // inside the real .29 guide barrels. This is an intake work stroke.
    joints['meter' + s] = { position: [-side * .068 * draw, 0, 0] };
    joints['vent' + s] = rot(-.17 * open + .26 * stop);
  }
}

function thrust(joints, power, braking = 0, stop = 0) {
  for (const side of [-1, 1]) for (const station of ['F', 'A']) {
    const s = (side < 0 ? 'L' : 'R') + station;
    joints['nozzle' + s] = rot(
      (station === 'F' ? .17 : .11) * power - .16 * braking + .20 * stop,
      side * .08 * stop,
    );
  }
  joints.rudder = rot(-.085 * power - .07 * braking + .32 * stop);
}

function fallen(progress) {
  const p = clamp(progress), vent = ease(p, 0, .24), stop = ease(p, .14, .73), settle = ease(p, .68, 1);
  const joints = {};
  collectors(joints, .10 * vent * (1 - stop), .12 * vent * (1 - stop), stop);
  thrust(joints, 0, 0, stop);
  joints.chassis = rot(.055 * settle, -.045 * settle);
  joints.auditFrame = rot(.13 * stop);
  joints.press = { position: [0, 0, -.085 * stop] };
  joints.stamp = { position: [0, 0, .013 * settle] };
  joints.gauge = rot(.14 * stop);
  joints.noseRam = { position: [0, .065 * stop, 0] };
  joints.noseTip = { position: [0, .023 * settle, 0] };
  // The renderer lowers real air enemies from their simulation flight height.
  // This rig only stops and folds the supported equipment above the belly.
  return { joints, root: { rotation: [0, 0, 0], position: [0, 0, 0] } };
}

/** Auditing machinery and propulsion have independent simulation inputs. */
export function animate(context = {}) {
  const action = context.action || 'idle', p = clamp(finite(context.progress));
  if (['preview', 'disabled', 'stopped', 'static'].includes(action)) return neutral();
  if (action === 'wreck') return fallen(1);
  if (action === 'death') return fallen(context.reducedMotion ? 1 : p);

  const active = !!context.abilityActive;
  const elapsed = Math.max(0, finite(context.abilityElapsed));
  const remaining = Math.max(0, finite(context.abilityRemaining, active ? 5 : 0));
  const held = active ? ease(remaining, 0, .34) : 0;
  const casting = ['cast', 'ability', 'corrode_resistance'].includes(action);
  const windup = context.stage === 'windup' || context.stage === 'prepare' || context.actionKind === 'ability-windup';
  const joints = {}, root = { rotation: [0, 0, 0], position: [0, 0, 0] };

  if (context.reducedMotion) {
    // A stable open intake and loaded press show the full live interval.
    collectors(joints, held, held);
    joints.press = { position: [0, 0, -.072 * held] };
    return { joints, root };
  }

  const moving = (context.moving === true || action === 'move') && finite(context.speed, .72) > 0;
  const power = moving ? clamp(finite(context.speed, .72) / 1.15, 0, 1.1) : 0;
  thrust(joints, power);
  joints.chassis = rot(.036 * power);

  let open = held, draw = 0, press = 0, contact = 0, cam = 0;
  if (active) {
    const duration = Math.max(.001, elapsed + remaining);
    // Six complete turns park the four-ear eccentric at its authored face.
    // The cosine is a crank-to-linear conversion confined to the metering rod.
    cam = -TAU * 6 * smooth(elapsed / duration);
    const crank = (1 - Math.cos(cam)) * .5;
    const firstIntake = ease(elapsed, 0, .18);
    draw = held * (.08 + .66 * firstIntake + .26 * crank);
    press = held * (.085 * (1 - firstIntake) - .072 * firstIntake - .010 * crank);
    contact = held * pulse(elapsed, 0, .18, .38);
  }
  if (casting && windup) {
    open = ease(p, .05, .82);
    draw = .08 * ease(p, .34, .98);
    press = .085 * ease(p, .30, 1);
    contact = 0;
    cam = 0;
  } else if (casting && !active) {
    // A standalone study release presents one complete intake and return.
    // In battle the real five-second active state owns the sustained interval.
    open = 1 - ease(p, .60, 1);
    draw = pulse(p, 0, .22, 1);
    press = (.085 * (1 - ease(p, 0, .20)) - .072 * ease(p, 0, .20)) * (1 - ease(p, .62, 1));
    contact = pulse(p, 0, .20, .43);
    cam = -TAU * smooth(p);
  }
  collectors(joints, open, draw);
  joints.auditFrame = rot(-.012 * contact);
  joints.press = { position: [0, 0, press] };
  joints.stamp = { position: [0, 0, .018 * contact] };
  joints.gauge = rot(-.085 * open);
  joints.rearCam = rot(0, cam, 0);

  if (['attack', 'breach'].includes(action)) {
    const prepare = ease(p, 0, .20), work = ease(p, .20, .40), reset = 1 - ease(p, .63, 1);
    const strike = pulse(p, .33, .43, .66), brake = pulse(p, 0, .22, .78);
    // A .45 rod keeps at least .08 captured in its .34 sleeve at full reach.
    joints.noseRam = { position: [0, (.050 * prepare - .220 * work) * reset, 0] };
    joints.noseTip = { position: [0, .033 * strike, 0] };
    thrust(joints, power, brake);
    joints.chassis = rot(.036 * power + .032 * strike - .016 * prepare * reset);
  }

  const explicitHit = ['hit', 'hurt', 'damage'].includes(action)
    ? p < .12 ? smooth(p / .12) : 1 - ease(p, .12, 1) : 0;
  const hit = clamp(Math.max(finite(context.hit), explicitHit));
  if (hit > 0) {
    const impulse = hit * hit;
    joints.auditFrame.rotation[0] += .075 * impulse;
    joints.press.position[2] += .012 * impulse;
    joints.scoopL.rotation[0] += .09 * impulse;
    joints.scoopR.rotation[0] += .055 * impulse;
    joints.nozzleLF.rotation[1] -= .06 * impulse;
    joints.nozzleRA.rotation[1] += .055 * impulse;
    joints.stamp.position[2] += .012 * impulse;
  }
  return { joints, root };
}
