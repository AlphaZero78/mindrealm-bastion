import { TAU, clamp, ease, fract, smooth } from '../enemy-rig.js';

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const rot = (x = 0, y = 0, z = 0) => ({ rotation: [x, y, z] });
const neutral = () => ({ joints: {}, root: { rotation: [0, 0, 0], position: [0, 0, 0] } });
const pulse = (p, a, b, c) => ease(p, a, b) * (1 - ease(p, b, c));

function gates(joints, open) {
  // Each door swings forward around its actual outer vertical hinge. It
  // clears the circular bore while leaving its hinge captive in the bracket.
  joints.gateL = rot(0, 0, -1.30 * open);
  joints.gateR = rot(0, 0, 1.30 * open);
}

function propulsion(joints, power, brace = 0, unload = 0) {
  const pitch = .135 * power - .19 * brace;
  joints.nozzleL = rot(pitch + .075 * unload, -.045 * unload);
  joints.nozzleR = rot(pitch + .075 * unload, .045 * unload);
  joints.nozzleA = rot(.10 * power - .16 * brace - .11 * unload);
  joints.rudder = rot(-.075 * power - .08 * brace + .24 * unload);
}

function fallen(progress) {
  const p = clamp(progress), vent = ease(p, 0, .24), stop = ease(p, .08, .57), settle = ease(p, .60, 1);
  const joints = {};
  gates(joints, .20 * vent * (1 - settle));
  propulsion(joints, 0, 0, stop);
  joints.chassis = rot(.13 * settle);
  joints.reactor = rot(.15 * stop);
  joints.pump = { position: [0, 0, -.08 * stop] };
  joints.collector = { position: [0, .055 * stop, 0] };
  joints.contactRam = { position: [0, .040 * stop, 0] };
  joints.ramTip = { position: [0, .018 * settle, 0] };
  joints.sensor = rot(.11 * stop);
  // EntityRenderer supplies the simulation's 1.3-cell flight-height drop.
  // The authored shell only pitches above the still-connected nozzle sockets.
  return { joints, root: { rotation: [0, 0, 0], position: [0, 0, 0] } };
}

/** Continuous flight and the five-second retort are independent mechanisms. */
export function animate(context = {}) {
  const action = context.action || 'idle', p = clamp(finite(context.progress));
  if (action === 'preview' || action === 'disabled') return neutral();
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
    // Keep the real active interval readable with held doors and a loaded
    // gauge, without rotating the electrodes or reciprocating the valve.
    if (active) { gates(joints, held); joints.pump = { position: [0, 0, .025 * held] }; }
    return { joints, root };
  }

  const travel = Math.max(0, finite(context.travel));
  const moving = (context.moving === true || action === 'move') && finite(context.speed, .92) > 0;
  const power = moving ? clamp(finite(context.speed, .92) / 1.45, 0, 1.15) : 0;
  propulsion(joints, power);
  joints.chassis = rot(.048 * power);
  // The four-ear compressor is a drive cam, so its angle follows model travel
  // and freezes at the travelled angle whenever movement stops.
  joints.compressor = rot(0, -TAU * fract(travel / .46), 0);

  let open = held, draw = 0, compression = 0, pump = 0, collector = 0, rotorAngle = 0;
  if (active) {
    const duration = Math.max(.001, elapsed + remaining);
    // Ten complete electrode revolutions span the real interval. Smooth
    // engagement/disengagement parks the four-ear rotor at its original face.
    rotorAngle = -TAU * 10 * smooth(elapsed / duration);
    const eccentric = (1 - Math.cos(rotorAngle)) * .5;
    draw = 1 - ease(elapsed, 0, .21);
    compression = pulse(elapsed, 0, .15, .36);
    pump = held * (.025 + .045 * draw - .044 * compression - .032 * eccentric);
    collector = held * (.018 * draw - .040 * compression - .010 * eccentric);
  }
  if (casting && windup) {
    open = ease(p, .10, .80);
    draw = ease(p, .34, .98);
    compression = 0;
    pump = .070 * draw;
    collector = .018 * draw;
    rotorAngle = 0;
  } else if (casting && !active) {
    // This branch also gives editor action previews one complete mechanical
    // cycle. Gameplay hands release directly to the real active interval.
    open = 1 - ease(p, .54, 1);
    draw = 1 - ease(p, 0, .24);
    compression = pulse(p, 0, .24, .70);
    pump = .070 * draw - .028 * compression;
    collector = .018 * draw - .042 * compression;
    rotorAngle = -TAU * smooth(p);
  }

  gates(joints, open);
  joints.fieldRotor = rot(0, rotorAngle, 0);
  joints.pump = { position: [0, 0, pump] };
  joints.collector = { position: [0, collector, 0] };
  joints.reactor = rot(-.016 * open - .020 * compression);
  joints.sensor = rot(-.045 * open);

  if (['attack', 'breach', 'terrain'].includes(action)) {
    const prepare = ease(p, 0, .20), work = ease(p, .20, .39), returnToSeat = 1 - ease(p, .63, 1);
    const contact = pulse(p, .34, .44, .64), brace = pulse(p, 0, .21, .74);
    // At maximum reach the .33 shaft still overlaps the .30 guide sleeve.
    joints.contactRam = { position: [0, (.045 * prepare - .200 * work) * returnToSeat, 0] };
    joints.ramTip = { position: [0, .027 * contact, 0] };
    propulsion(joints, power, brace);
    joints.chassis = rot(.048 * power + .065 * work * returnToSeat - .032 * prepare * returnToSeat);
    root.position[1] = -.030 * contact;
  }

  const explicitHit = ['hit', 'hurt', 'damage'].includes(action) ? p < .12 ? smooth(p / .12) : 1 - ease(p, .12, 1) : 0;
  const hit = clamp(Math.max(finite(context.hit), explicitHit));
  if (hit > 0) {
    const impulse = hit * hit;
    const reactor = joints.reactor.rotation;
    joints.reactor = rot(reactor[0] - .10 * impulse, .025 * impulse);
    joints.sensor = rot(-.045 * open + .12 * impulse);
    joints.pump.position[2] += .014 * impulse;
    const left = joints.gateL.rotation, right = joints.gateR.rotation;
    joints.gateL = rot(.045 * impulse, 0, left[2] - .04 * impulse);
    joints.gateR = rot(.045 * impulse, 0, right[2] + .04 * impulse);
    // A short asymmetric thrust correction holds the hull; the body itself
    // does not oscillate with the hit envelope or a wall-clock sine.
    joints.nozzleL.rotation[1] -= .065 * impulse;
    joints.nozzleR.rotation[1] += .030 * impulse;
  }
  return { joints, root };
}
