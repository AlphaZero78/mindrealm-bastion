import { clamp, smooth, ease, fract, wheelSupportHeight, wheelRollAngle } from '../enemy-rig.js';

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const rotation = (x = 0, y = 0, z = 0) => ({ rotation: [x, y, z] });
const neutral = () => ({ joints: {}, root: { rotation: [0, 0, 0], position: [0, 0, 0] } });
const RADIUS = .26;
const WHEELS = ['wheelLF', 'wheelLR', 'wheelRF', 'wheelRR'];

function transmission(joints, travel) {
  const angle = wheelRollAngle(travel,RADIUS);
  for (const id of WHEELS) joints[id] = rotation(angle);
  // The registered round shell has twelve bevelled radial faces. Axle cradles
  // and load rails follow its exact lower support together, preserving contact.
  joints.chassis = { position: [0, 0, wheelSupportHeight(angle, RADIUS) - RADIUS] };
}

function shutters(joints, amount, asymmetric = 0) {
  joints.doorL = rotation(0, 0, -1.06 * amount - asymmetric);
  joints.doorR = rotation(0, 0, 1.06 * amount);
}

function fallen(progress, travel) {
  const p = clamp(progress), unlock = ease(p, 0, .24);
  const buckle = ease(p, .16, .81), settle = ease(p, .70, 1);
  const joints = {};
  transmission(joints, travel);
  joints.carriage = { position: [0, .018 * buckle, -.064 * buckle] };
  joints.gateway = { rotation: [.23 * buckle, -.09 * buckle, .025 * settle], position: [0, .030 * buckle, -.026 * settle] };
  joints.plunger = { position: [0, .10 * unlock, 0] };
  joints.liner = rotation(0, -.09 * unlock, 0);
  joints.dish = { rotation: [.43 * buckle, -.12 * settle, .035 * settle], position: [0, 0, -.018 * buckle] };
  joints.transceiver = rotation(.13 * buckle, -.045 * settle, 0);
  joints.sensor = rotation(.16 * buckle);
  joints.striker = { position: [0, .060 * unlock, 0] };
  shutters(joints, .29 * unlock, .16 * settle);
  joints.ventL = rotation(0, -.33 * unlock, 0);
  joints.ventR = rotation(0, .22 * unlock, 0);
  return { joints, root: { rotation: [0, 0, 0], position: [0, 0, 0] } };
}

function impactStroke(progress) {
  const p = clamp(progress);
  if (p < .22) return .065 * smooth(p / .22);
  if (p < .43) { const t = (p - .22) / .21; return .065 - .275 * t * t; }
  if (p < .58) return -.210 + .040 * smooth((p - .43) / .15);
  return -.170 * (1 - smooth((p - .58) / .42));
}

/** Pose-only machinery. The battle owns reinforcement type, count and budget. */
export function animate(context = {}) {
  const action = context.action || 'idle', p = clamp(finite(context.progress));
  const travel = Math.max(0, finite(context.travel));
  if (['preview', 'disabled', 'stopped', 'static'].includes(action)) return neutral();
  if (action === 'wreck') return fallen(1, context.reducedMotion ? 0 : travel);
  if (action === 'death') return fallen(context.reducedMotion ? 1 : p, context.reducedMotion ? 0 : travel);
  if (context.reducedMotion) return neutral();

  // Ground movement survives the warning and release. Actual model travel,
  // rather than the upper action's progress or clock, determines every wheel.
  const moving = (context.moving === true || action === 'move') && finite(context.speed, .7) > 0;
  const explicitHit = ['hit', 'hurt', 'damage'].includes(action) ? 1 - smooth(p) : 0;
  const hit = clamp(Math.max(finite(context.hit), explicitHit));
  const joints = {}, root = { rotation: [0, 0, 0], position: [0, 0, 0] };
  transmission(joints, travel);
  const rimSlice = fract(travel / (RADIUS * Math.PI * 2) * 12);
  const contactTransition = 1 - smooth(Math.abs(rimSlice - .5) * 2);
  let compression = moving ? .006 + .004 * contactTransition + .002 * clamp(finite(context.speed), 0, 2) : 0;
  let open = 0, draw = 0, electrode = 0, aim = 0, heat = 0, reaction = 0;
  let striker = 0, collar = 0;

  if (['cast', 'ability', 'summon'].includes(action)) {
    const windup = context.stage === 'windup' || context.stage === 'prepare' || context.actionKind === 'ability-windup';
    if (windup) {
      aim = ease(p, 0, .31);
      open = ease(p, .08, .38);
      draw = ease(p, .38, 1);
      electrode = .09 * draw;
      collar = .18 * draw;
      heat = .21 * ease(p, .12, .48);
    } else {
      // p=0 shares the final warning pose. Summon has no lasting field:
      // one bounded compression stroke ends with a closed, parked machine.
      aim = 1 - ease(p, .55, 1);
      open = 1 - ease(p, .59, 1);
      draw = 1 - ease(p, .36, .88);
      const discharge = ease(p, .05, .22) * (1 - ease(p, .31, .72));
      electrode = .09 * (1 - ease(p, 0, .18)) - .235 * discharge;
      collar = .18 * draw - .050 * discharge;
      heat = .21 * (1 - ease(p, .63, 1));
      reaction = .56 * discharge;
    }
    compression += .009 * draw + .014 * reaction;
  } else if (['attack', 'breach', 'terrain'].includes(action)) {
    striker = impactStroke(p);
    reaction = ease(p, .30, .43) * (1 - ease(p, .52, .76));
    compression += .022 * reaction;
    heat = .07 * ease(p, .02, .24) * (1 - ease(p, .60, 1));
  }

  // A haste effect supplied by an ally can make abilityActive true. This
  // enemy's own summon is instantaneous, so its chamber follows only the
  // actual warning/release action instead of claiming a persistent interval.
  compression += .025 * hit;
  joints.carriage = { position: [.009 * hit, .021 * reaction + .010 * hit, -compression] };
  joints.gateway = { position: [0, .019 * draw, 0], rotation: [.012 * (moving ? 1 : 0) + .055 * reaction - .065 * hit, .025 * hit, 0] };
  joints.plunger = { position: [0, electrode + .025 * hit, 0] };
  joints.liner = rotation(0, collar, 0);
  joints.dish = { rotation: [-.15 * aim + .070 * hit + .030 * reaction, 0, 0], position: [0, 0, .042 * aim - .012 * hit] };
  joints.transceiver = rotation(.050 * hit, 0, 0);
  joints.sensor = rotation(-.040 * draw + .085 * hit);
  joints.striker = { position: [0, striker + .035 * hit, 0] };
  shutters(joints, open);
  joints.ventL = rotation(0, -heat - .070 * hit, 0);
  joints.ventR = rotation(0, heat + .070 * hit, 0);
  return { joints, root };
}
