import { TAU, clamp, ease, fract, pulse, smooth, stroke, wheelSupportHeight, wheelRollAngle } from '../enemy-rig.js';

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const rotation = (x = 0, y = 0, z = 0) => ({ rotation: [x, y, z] });
const WHEELS = ['LF', 'LM', 'LR', 'RF', 'RM', 'RR'];
const RADIUS = .26;
const neutral = () => ({ joints: {}, root: { rotation: [0, 0, 0], position: [0, 0, 0] } });

function transmission(joints, travel) {
  const angle = wheelRollAngle(travel,RADIUS);
  for (const id of WHEELS) joints['wheel' + id] = rotation(angle);
  joints.chassis = {position:[0,0,wheelSupportHeight(angle,RADIUS)-RADIUS]};
}

function crown(joints, open, axial = 0, rotor = 0) {
  joints.mast = { position: [0, 0, .22 * open] };
  joints.panelL = rotation(0, -.77 * open);
  joints.panelR = rotation(0, .77 * open);
  joints.panelF = rotation(.70 * open);
  joints.ventL = rotation(0, -.43 * open);
  joints.ventR = rotation(0, .43 * open);
  joints.rotor = { rotation: [0, 0, rotor], position: [0, 0, axial] };
}

function collapsed(progress, context) {
  const p = clamp(progress), bleed = ease(p, 0, .28), buckle = ease(p, .16, .80), settle = ease(p, .74, 1);
  const joints = {};
  transmission(joints, context.reducedMotion ? 0 : context.travel);
  const exposed = context.abilityActive || finite(context.abilityRemaining, -1) > 0 ? 1 : 0;
  crown(joints, exposed * (1 - ease(p, 0, .58)), -.035 * bleed, .24 * bleed - .14 * settle);
  // The cabinet fails at its captured lower load seat. Its wheel bridge and
  // six contact circles keep their original positions throughout the fall.
  joints.rfCase = { rotation: [.24 * buckle, -.11 * buckle, .055 * settle], position: [0, 0, -.055 * buckle] };
  joints.ventL = rotation(0, -.53 * bleed + .22 * settle);
  joints.ventR = rotation(0, .53 * bleed - .22 * settle);
  joints.striker = { position: [0, .055 * bleed, 0] };
  return { joints, root: { rotation: [0, 0, 0], position: [0, 0, 0] } };
}

/** Pure simulation-time poses. Wheel phase is model wheelRollAngle(travel,radius), including
 * moving ability warnings. No action clock or ability code changes travel.
 */
export function animate(context = {}) {
  const action = context.action || 'idle', p = clamp(finite(context.progress));
  if (action === 'preview' || action === 'disabled') return neutral();
  if (action === 'wreck') return collapsed(1, context);
  if (action === 'death') return collapsed(context.reducedMotion ? 1 : p, context);

  const active = !!context.abilityActive;
  const remaining = finite(context.abilityRemaining, active ? 3 : 0);
  // The live 3 s signal survives until its actual expiry. Closing the array
  // during the final .34 s returns the mechanism continuously to its seat.
  const held = active ? ease(remaining, 0, .34) : 0;
  if (context.reducedMotion) {
    const joints = {};
    crown(joints, active ? 1 : 0);
    return { joints, root: { rotation: [0, 0, 0], position: [0, 0, 0] } };
  }

  const joints = {}, root = { rotation: [0, 0, 0], position: [0, 0, 0] };
  transmission(joints, context.travel);
  const moving = (context.moving === true || action === 'move') && finite(context.speed, .78) > 0;
  const travelLoad = moving ? .006 + .004 * clamp(finite(context.speed), 0, 2) : 0;
  joints.rfCase = { rotation: [moving ? .012 : 0, 0, 0], position: [0, 0, -travelLoad] };

  const elapsed = Math.max(0, finite(context.abilityElapsed));
  const duration = Math.max(.001, elapsed + Math.max(0, remaining));
  // Four complete turns stop at the same angular orientation as the parked
  // cam. Using the actual duration keeps both ends at zero angular velocity.
  const rotor = active && Number.isFinite(context.abilityElapsed)
    ? -TAU * 4 * smooth(elapsed / duration)
    : active ? -TAU * fract(Math.max(0, finite(context.clock)) / 520) : 0;
  const working = active ? .018 * stroke(fract(elapsed / .5), .36, .52) * held : 0;
  crown(joints, held, working, rotor);
  if (active) joints.rfCase.position[2] -= .009 * held;

  if (action === 'cast' || action === 'ability' || action === 'jam') {
    const windup = context.stage === 'windup' || context.stage === 'prepare' || context.actionKind === 'ability-windup';
    const open = windup ? ease(p, .08, .82) : active ? held : 1 - ease(p, .62, 1);
    const draw = windup ? ease(p, .45, .98) : 1 - ease(p, 0, .18);
    const discharge = windup ? 0 : pulse(p, 0, .16, .46);
    const coupledWork = working * (windup ? 0 : ease(p, .46, 1));
    const loadSettle = windup ? open : open * (1 - ease(p, .66, 1));
    crown(joints, open, .024 * draw - .068 * discharge + coupledWork, windup ? 0 : rotor);
    joints.rfCase = {
      rotation: [.012 * (moving ? 1 : 0) + .014 * loadSettle - .022 * discharge, 0, 0],
      position: [0, 0, -travelLoad - .009 * open - .007 * discharge],
    };
  }

  if (action === 'attack' || action === 'breach' || action === 'terrain') {
    const work = stroke(p, .24, .43), brace = pulse(p, 0, .21, 1), contact = pulse(p, .41, .48, .69);
    // The long piston stays captured by the fixed sleeve at maximum stroke.
    // Its wedge is guided above the ground; wheel centres remain untouched.
    joints.striker = { position: [0, -.245 * work, .007 * contact] };
    joints.rfCase.rotation[0] += -.040 * brace + .074 * contact;
    joints.rfCase.position[2] -= .019 * brace;
  }

  const explicitHit = ['hit', 'hurt', 'damage'].includes(action) ? 1 - smooth(p) : 0;
  const hit = clamp(Math.max(finite(context.hit), explicitHit));
  if (hit > 0) {
    const impulse = hit * hit;
    joints.rfCase.rotation[0] -= .075 * impulse;
    joints.rfCase.rotation[1] += .027 * impulse;
    joints.rfCase.position[2] -= .018 * impulse;
    joints.panelL.rotation[1] += .052 * impulse;
    joints.panelR.rotation[1] -= .052 * impulse;
    joints.panelF.rotation[0] -= .052 * impulse;
    joints.rotor.position[2] += .022 * impulse;
    const ram = joints.striker?.position || [0, 0, 0];
    joints.striker = { position: [ram[0], ram[1] + .026 * impulse, ram[2]] };
  }
  return { joints, root };
}
