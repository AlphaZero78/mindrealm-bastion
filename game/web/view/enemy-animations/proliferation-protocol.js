import { clamp, smooth, ease, wheelRollAngle, wheelSupportHeight } from '../enemy-rig.js';

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const RADIUS = .30;
const WHEELS = ['wheelLF', 'wheelLM', 'wheelLR', 'wheelRF', 'wheelRM', 'wheelRR'];
const neutral = () => ({ joints: {}, root: { rotation: [0, 0, 0], position: [0, 0, 0] } });
const rotation = (x = 0, y = 0, z = 0) => ({ rotation: [x, y, z] });

function transmission(joints, travel) {
  const angle = wheelRollAngle(travel, RADIUS);
  for (const id of WHEELS) joints[id] = rotation(angle);
  // This is the actual bevelled tyre contact radius, rather than an arbitrary
  // bob. The three axle cradles and the complete load frame follow it together.
  joints.chassis = { position: [0, 0, wheelSupportHeight(angle, RADIUS) - RADIUS] };
}

function outlet(joints, upper, lower = upper) {
  joints.upperShutter = rotation(-.95 * upper);
  joints.lowerShutter = rotation(.90 * lower);
}

function contactStroke(progress) {
  const p = clamp(progress);
  if (p < .20) return .075 * smooth(p / .20);
  if (p < .40) { const t = (p - .20) / .20; return .075 - .305 * t * t; }
  if (p < .57) return -.230 + .040 * smooth((p - .40) / .17);
  return -.190 * (1 - smooth((p - .57) / .43));
}

function fallen(progress, travel) {
  const p = clamp(progress), unlock = ease(p, 0, .23);
  const buckle = ease(p, .17, .78), settle = ease(p, .68, 1);
  const joints = {};
  transmission(joints, travel);
  joints.cabinet = { position: [.012 * buckle, .024 * buckle, -.070 * buckle], rotation: [.024 * buckle, .028 * settle, 0] };
  joints.manifold = { rotation: [.080 * buckle, 0, -.025 * settle], position: [0, .015 * buckle, -.015 * settle] };
  joints.injector = { position: [0, .12 * unlock, 0] };
  outlet(joints, .44 * unlock + .20 * settle, .30 * unlock);
  joints.pressureSpine = { rotation: [.25 * buckle, -.09 * settle, 0], position: [0, 0, -.018 * buckle] };
  joints.pressurePiston = { position: [0, 0, -.145 * unlock] };
  joints.contactRam = { position: [0, .10 * unlock, 0] };
  joints.powerpack = rotation(.11 * buckle, .045 * settle);
  joints.sensor = rotation(.18 * buckle);
  joints.ventL = rotation(0, -.37 * unlock - .11 * settle);
  joints.ventR = rotation(0, .27 * unlock);
  joints.valveL = rotation(0, 0, -.27 * unlock);
  joints.valveR = rotation(0, 0, .21 * unlock);
  return { joints, root: { rotation: [0, 0, 0], position: [0, 0, 0] } };
}

/** Pose-only distributor. Reinforcement rules and budget remain in battle. */
export function animate(context = {}) {
  const action = context.action || 'idle', p = clamp(finite(context.progress));
  const travel = Math.max(0, finite(context.travel));
  if (['preview', 'disabled', 'stopped', 'static'].includes(action)) return neutral();
  if (action === 'wreck') return fallen(1, context.reducedMotion ? 0 : travel);
  if (action === 'death') return fallen(context.reducedMotion ? 1 : p, context.reducedMotion ? 0 : travel);
  if (context.reducedMotion) return neutral();

  const joints = {}, root = { rotation: [0, 0, 0], position: [0, 0, 0] };
  transmission(joints, travel);
  // Upper action and traction are independent: warnings and releases do not
  // stop this elite's ground travel unless the simulation itself stops it.
  const moving = (context.moving === true || action === 'move') && finite(context.speed, .78) > 0;
  const explicitHit = ['hit', 'hurt', 'damage'].includes(action) ? 1 - smooth(p) : 0;
  const hit = clamp(Math.max(finite(context.hit), explicitHit));
  const speed = moving ? clamp(finite(context.speed, .78), 0, 2) : 0;
  let open = 0, seat = 0, charge = 0, injector = 0, piston = 0;
  let heat = .04 * speed, reaction = 0, ram = 0;
  let compression = moving ? .007 + .005 * speed : 0;

  if (['cast', 'ability', 'summon'].includes(action)) {
    const windup = context.stage === 'windup' || context.stage === 'prepare' || context.actionKind === 'ability-windup';
    if (windup) {
      open = ease(p, .05, .39);
      seat = ease(p, .18, .56);
      charge = ease(p, .42, 1);
      injector = .095 * charge;
      piston = -.12 * charge;
      heat = .04 * speed + .13 * ease(p, .22, .58);
    } else {
      // p=0 exactly preserves warning completion. One pressure release
      // drives the sole outlet and returns to a closed resting pose.
      const discharge = ease(p, .03, .20) * (1 - ease(p, .31, .68));
      open = 1 - ease(p, .56, 1);
      seat = 1 - ease(p, .44, .82);
      charge = 1 - ease(p, .10, .42);
      injector = .095 * (1 - ease(p, 0, .19)) - .225 * discharge;
      piston = -.12 * charge + .032 * discharge;
      heat = .04 * speed + .13 * (1 - ease(p, .68, 1)) + .08 * discharge;
      reaction = discharge;
    }
    compression += .008 * charge + .016 * reaction;
  } else if (['attack', 'breach', 'terrain'].includes(action)) {
    ram = contactStroke(p);
    reaction = ease(p, .28, .40) * (1 - ease(p, .52, .78));
    compression += .022 * reaction;
    heat += .045 * ease(p, .04, .23) * (1 - ease(p, .62, 1));
  }

  // Summon is instantaneous. abilityActive can describe an allied haste or
  // pressure buff, so it does not keep the pressure mouth falsely working.
  compression += .025 * hit;
  joints.cabinet = { position: [.012 * hit, .027 * reaction + .009 * hit, -compression] };
  joints.manifold = { rotation: [.030 * reaction - .050 * hit, .018 * hit, 0] };
  joints.injector = { position: [0, injector + .025 * hit, 0] };
  outlet(joints, open);
  joints.pressureSpine = { rotation: [.015 * speed + .045 * reaction - .060 * hit, -.020 * hit, 0] };
  joints.pressurePiston = { position: [0, 0, piston - .020 * hit] };
  joints.valveL = { rotation: [0, 0, -.36 * seat], position: [0, -.045 * seat, 0] };
  joints.valveR = { rotation: [0, 0, .36 * seat], position: [0, -.045 * seat, 0] };
  joints.contactRam = { position: [0, ram + .025 * hit, 0] };
  joints.sensor = rotation(-.065 * charge + .085 * hit);
  joints.powerpack = rotation(.025 * reaction + .045 * hit);
  joints.ventL = rotation(0, -heat - .080 * hit);
  joints.ventR = rotation(0, heat + .080 * hit);
  return { joints, root };
}
