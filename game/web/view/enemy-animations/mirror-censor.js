import { clamp, smooth, ease, wheelRollAngle, wheelSupportHeight } from '../enemy-rig.js';

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const RADIUS = .38;
const WHEELS = ['wheelLF', 'wheelLR', 'wheelRF', 'wheelRR'];
const neutral = () => ({ joints: {}, root: { rotation: [0, 0, 0], position: [0, 0, 0] } });

function traction(joints, travel) {
  const angle = wheelRollAngle(travel, RADIUS);
  for (const name of WHEELS) joints[name] = { rotation: [angle, 0, 0] };
  joints.chassis = { position: [0, 0, wheelSupportHeight(angle, RADIUS) - RADIUS] };
  return angle;
}

function stampStroke(p) {
  if (p < .21) return .11 * smooth(p / .21);
  if (p < .43) { const t = (p - .21) / .22; return .11 - .40 * t * t; }
  if (p < .58) return -.29 + .045 * smooth((p - .43) / .15);
  return -.245 * (1 - smooth((p - .58) / .42));
}

// Two bounded indexed output strokes share the same physical platen.
function imprintStroke(p, start, impact, end) {
  if (p <= start || p >= end) return 0;
  if (p < impact) return smooth((p - start) / (impact - start));
  return 1 - smooth((p - impact) / (end - impact));
}

function death(progress, travel) {
  const p = clamp(progress), unlock = ease(p, 0, .21);
  const sag = ease(p, .17, .78), settle = ease(p, .65, 1), joints = {};
  traction(joints, travel);
  joints.vault = { position: [.014 * sag, .025 * sag, -.073 * sag], rotation: [.026 * sag, .019 * settle, 0] };
  joints.cache = { position: [0, .015 * sag, -.15 * sag], rotation: [.045 * settle, 0, 0] };
  joints.platen = { position: [0, .15 * unlock, -.023 * sag] };
  joints.stamp = { position: [0, .13 * unlock, 0] };
  joints.visor = { rotation: [.16 * sag, 0, 0] };
  joints.crown = { rotation: [.26 * sag, .039 * settle, 0], position: [0, 0, -.046 * sag] };
  joints.telemetry = { rotation: [.11 * sag, 0, 0] };
  for (const [tag, side] of [['L', -1], ['R', 1]]) {
    joints['mirror' + tag] = { rotation: [0, 0, side * (.19 * unlock + (tag === 'L' ? .09 : .04) * settle)] };
    joints['slice' + tag] = { position: [0, 0, -.11 * sag] };
    joints['vent' + tag] = { rotation: [0, side * (.25 * unlock + .10 * settle), 0] };
    joints['shield' + tag] = { rotation: [.11 * sag, side * .23 * sag, 0] };
    joints['crownMirror' + tag] = { rotation: [.19 * sag, 0, side * .15 * unlock] };
  }
  return { joints, root: { rotation: [0, 0, 0], position: [0, 0, 0] } };
}

/** Pure articulated machinery. Copy budget, shields and attacks stay in core. */
export function animate(ctx = {}) {
  const action = ctx.action || 'idle', p = clamp(finite(ctx.progress));
  const phase = clamp(Math.floor(finite(ctx.phase)), 0, 2);
  const travel = Math.max(0, finite(ctx.travel));
  if (['preview', 'disabled', 'stopped', 'static'].includes(action)) return neutral();
  if (action === 'wreck') return death(1, ctx.reducedMotion ? 0 : travel);
  if (action === 'death') return death(ctx.reducedMotion ? 1 : p, ctx.reducedMotion ? 0 : travel);
  if (ctx.reducedMotion) return neutral();

  const joints = {}, root = { rotation: [0, 0, 0], position: [0, 0, 0] };
  const angle = traction(joints, travel);
  const moving = (ctx.moving === true || action === 'move') && finite(ctx.speed) > 0;
  const hit = clamp(Math.max(finite(ctx.hit), ['hit', 'hurt', 'damage'].includes(action) ? 1 - smooth(p) : 0));
  const kind = String(ctx.actionKind || '');
  const windup = ctx.stage === 'windup' || ctx.stage === 'prepare' || kind.endsWith('windup');
  const casting = ['cast', 'ability', 'copy'].includes(action);
  const surge = casting && (ctx.ability === 'surge' || kind.startsWith('surge'));
  const push = casting && (ctx.ability === 'push' || kind.startsWith('push'));
  const phaseEvent = casting && kind === 'phase';
  const copying = casting && !surge && !push && !phaseEvent && (ctx.ability === 'copy' || action === 'copy');
  // copy does not set an ability duration. Self-shield is persistent until
  // damage consumes it, so its real fraction holds the shield machinery.
  const shield = phase >= 1 ? clamp(finite(ctx.shieldFraction) / .025) : 0;
  const rimCompression = clamp((RADIUS - wheelSupportHeight(angle, RADIUS)) / .02);
  let load = moving ? .007 + .005 * rimCompression : 0;
  let align = 0, sliceL = 0, sliceR = 0, platen = 0, stamp = 0;
  let reaction = 0, cache = 0, vent = .085 * shield, shieldCharge = 0, crown = 0;

  if (copying) {
    if (windup) {
      align = ease(p, 0, .27);
      const scan = ease(p, .22, .91);
      sliceL = .57 * scan;
      sliceR = .57 * scan;
      platen = .10 * ease(p, .45, 1);
      cache = .047 * ease(p, .30, .93);
      vent = Math.max(vent, .12 * ease(p, .17, .62));
      shieldCharge = phase >= 1 ? ease(p, .43, 1) : 0;
      crown = phase === 2 ? .055 * ease(p, .20, .87) : 0;
    } else {
      align = 1 - ease(p, .59, 1);
      sliceL = .57 * (1 - ease(p, .02, .59));
      sliceR = .57 * (1 - ease(p, .08, .67));
      const first = imprintStroke(p, .01, .19, .43);
      const second = imprintStroke(p, .43, .64, .90);
      reaction = Math.max(first, second);
      platen = .10 * (1 - ease(p, 0, .16)) - .23 * first - .23 * second;
      cache = .047 * (1 - ease(p, .17, .68)) - .018 * reaction;
      vent = Math.max(vent, .12 * (1 - ease(p, .63, 1)) + .15 * reaction);
      shieldCharge = phase >= 1 ? 1 - ease(p, .46, 1) : 0;
      crown = phase === 2 ? .055 * (1 - ease(p, .48, 1)) : 0;
    }
    load += .014 * align + .018 * reaction;
  } else if (surge) {
    const charge = windup ? ease(p, 0, .87) : 1 - ease(p, .40, 1);
    const release = windup ? 0 : imprintStroke(p, .01, .24, .71);
    align = charge;
    cache = -.066 * charge + .076 * release;
    crown = -.052 * charge + .080 * release;
    vent = Math.max(vent, .23 * charge);
    reaction = release;
    load += .033 * charge;
  } else if (push) {
    const charge = windup ? ease(p, 0, .81) : 1 - ease(p, .39, 1);
    stamp = .11 * charge;
    cache = -.035 * charge;
    vent = Math.max(vent, .24 * charge);
    load += .027 * charge;
  } else if (phaseEvent) {
    // The new phase has already deployed its complete meshes. This finite
    // bearing-seating action engages the exposed apparatus after the change.
    const engage = imprintStroke(p, 0, .31, 1);
    cache = .028 * engage;
    crown = phase === 2 ? .045 * engage : 0;
    vent = Math.max(vent, .11 * engage);
  } else if (['attack', 'breach', 'terrain'].includes(action)) {
    stamp = stampStroke(p);
    reaction = imprintStroke(p, .24, .44, .81);
    load += .036 * reaction;
  }

  load += .028 * hit;
  joints.vault = { position: [.011 * hit, .018 * reaction + .012 * hit, -load], rotation: [.032 * reaction - .025 * hit, .019 * hit, 0] };
  joints.cache = { position: [0, .01 * reaction, cache - .022 * hit] };
  joints.platen = { position: [0, platen + .023 * hit, 0] };
  joints.stamp = { position: [0, stamp + .041 * hit, 0] };
  joints.visor = { rotation: [-.035 * align + .066 * hit, 0, 0] };
  joints.crown = { position: [0, 0, crown - .015 * hit] };
  joints.telemetry = { rotation: [.049 * hit, 0, 0] };
  for (const [tag, side] of [['L', -1], ['R', 1]]) {
    // The permanent 0/46/76 degree leaf deployment belongs to its variant.
    // Dynamic alignment is a small finite turn about the same outer hinge.
    const leafTurn = phase === 0 ? .105 : phase === 1 ? -.070 : -.105;
    joints['mirror' + tag] = { rotation: [0, 0, side * (leafTurn * align + .042 * hit)] };
    joints['slice' + tag] = { position: [0, 0, (tag === 'L' ? sliceL : sliceR) - .022 * hit] };
    joints['vent' + tag] = { rotation: [0, side * (vent + .057 * hit), 0] };
    joints['shield' + tag] = { rotation: [-.084 * shieldCharge + .027 * hit, side * (.058 * shield + .095 * shieldCharge + .038 * hit), 0] };
    joints['crownMirror' + tag] = { rotation: [phase === 2 ? -.064 * align + .066 * hit : 0, 0, side * (phase === 2 ? -.035 * align : 0)] };
  }
  return { joints, root };
}
