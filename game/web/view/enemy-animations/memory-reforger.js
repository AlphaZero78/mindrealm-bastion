import { clamp, smooth, ease, wheelRollAngle, wheelSupportHeight } from '../enemy-rig.js';

const RADIUS = .38;
const finite = (v, fallback = 0) => Number.isFinite(v) ? v : fallback;
const rot = (x = 0, y = 0, z = 0) => ({ rotation: [x, y, z] });

function rolling(travel) {
  const angle = wheelRollAngle(Math.max(0, finite(travel)), RADIUS);
  const joints = { chassis: { position: [0, 0, wheelSupportHeight(angle, RADIUS) - RADIUS] } };
  for (const side of ['L', 'R']) for (const end of ['F', 'R']) joints['wheel' + side + end] = rot(angle);
  return joints;
}

function wreck(progress, travel) {
  const p = clamp(progress), relief = ease(p, 0, .27), buckle = ease(p, .19, .80), settle = ease(p, .72, 1);
  const joints = rolling(travel);
  joints.body = { position: [0, .025 * buckle, -.105 * buckle], rotation: [.085 * buckle, -.025 * buckle, -.02 * settle] };
  joints.platen = { position: [0, 0, -.16 * buckle + .045 * relief * (1 - settle)] };
  joints.hood = rot(-.19 * relief + .14 * settle);
  joints.ram = { position: [0, .075 * buckle, -.018 * buckle] };
  joints.jawL = rot(0, 0, -.14 * relief);
  joints.jawR = rot(0, 0, .11 * relief);
  joints.fieldL = rot(.16 * buckle, -.13 * buckle, -.04 * settle);
  joints.fieldR = rot(.12 * buckle, .09 * buckle, .03 * settle);
  joints.coolL = rot(.10 * buckle, -.12 * relief);
  joints.coolR = rot(.08 * buckle, .09 * relief);
  joints.rearFieldL = rot(.14 * buckle);
  joints.rearFieldR = rot(.11 * buckle);
  joints.telemetry = rot(.09 * buckle);
  return { joints };
}

/** Every work stroke follows simulation action progress and every wheel
 * follows model travel. A frozen clock/travel pair preserves the same pose. */
export function animate(context = {}) {
  const action = context.action || 'idle', p = clamp(finite(context.progress));
  const travel = Math.max(0, finite(context.travel)), phase = clamp(Math.floor(finite(context.phase)), 0, 2);
  if (action === 'preview' || action === 'disabled') return { joints: rolling(0) };
  if (action === 'wreck') return wreck(1, travel);
  if (action === 'death') return wreck(context.reducedMotion ? 1 : p, travel);
  if (context.reducedMotion) return { joints: rolling(0) };

  const joints = rolling(travel);
  const moving = context.moving === true || action === 'move';
  const spring = moving ? .015 + .009 * clamp(finite(context.speed) / .70) : 0;
  joints.body = { position: [0, 0, -spring], rotation: [moving ? .014 : 0, 0, 0] };
  if (moving) joints.telemetry = rot(.025);

  const casting = ['cast', 'ability', 'heal'].includes(action);
  const kind = String(context.actionKind || ''), surge = kind.startsWith('surge') || context.ability === 'surge';
  const push = kind.startsWith('push') || context.ability === 'push';
  const windup = context.stage === 'windup' || context.stage === 'prepare' || kind.endsWith('windup');
  if (casting && !surge && !push && kind !== 'phase') {
    // The actual warning's held end pose is the release's initial pose.
    // Instant heal has no sustained duration; draw → press → return is one
    // mechanical pulse, driven entirely by its 420 ms presentation progress.
    const focus = windup ? ease(p, .08, .71) : 1 - ease(p, .46, .96);
    const draw = windup ? ease(p, .32, .98) : 1 - ease(p, 0, .24);
    const press = windup ? 0 : ease(p, .02, .24) * (1 - ease(p, .37, .84));
    joints.platen = { position: [0, 0, .10 * draw - .260 * press] };
    joints.hood = rot(-(.17 - phase * .035) * focus);
    joints.fieldL = rot(0, -.10 * focus, -.025 * press);
    joints.fieldR = rot(0, .10 * focus, .025 * press);
    joints.coolL = rot(0, -.11 * focus);
    joints.coolR = rot(0, .11 * focus);
    joints.rearFieldL = rot(-.07 * focus);
    joints.rearFieldR = rot(-.07 * focus);
    joints.body = { position: [0, .018 * press, -spring - .026 * press], rotation: [.022 * press, 0, 0] };
    joints.telemetry = rot(-.055 * focus);
  }

  if (['attack', 'breach', 'terrain'].includes(action)) {
    const retract = ease(p, 0, .20), drive = ease(p, .20, .43), returnStroke = 1 - ease(p, .57, 1);
    const contact = ease(p, .39, .45) * (1 - ease(p, .52, .74));
    const extension = (.075 * retract - .345 * drive) * returnStroke;
    joints.ram = { position: [0, extension, 0] };
    joints.jawL = rot(0, 0, (.075 * retract + .24 * contact) * returnStroke);
    joints.jawR = rot(0, 0, -(.075 * retract + .24 * contact) * returnStroke);
    joints.body = { position: [0, .035 * contact, -spring - .027 * contact], rotation: [.045 * drive * returnStroke, 0, 0] };
    joints.platen = { position: [0, 0, -.018 * contact] };
    joints.fieldL = rot(0, -.035 * retract * returnStroke);
    joints.fieldR = rot(0, .035 * retract * returnStroke);
  }

  if (casting && surge) {
    // The difficulty frequency shock plants the vehicle at its marked origin;
    // the press drives the pulse while the deployed projectors brace outward.
    const brace = windup ? ease(p, .08, .83) : 1 - ease(p, .52, 1);
    const strike = windup ? 0 : ease(p, 0, .18) * (1 - ease(p, .29, .77));
    joints.platen = { position: [0, 0, .075 * brace - .335 * strike] };
    joints.body = { position: [0, 0, -.027 * brace - .027 * strike], rotation: [0, 0, 0] };
    joints.fieldL = rot(0, -.13 * brace);
    joints.fieldR = rot(0, .13 * brace);
    joints.coolL = rot(0, -.09 * brace);
    joints.coolR = rot(0, .09 * brace);
  }
  if (casting && push) {
    // Actual ground-boss break-through has its own warning and rolling push.
    const brace = windup ? ease(p, 0, .86) : 1 - ease(p, .50, 1);
    joints.ram = { position: [0, -.15 * brace, 0] };
    joints.jawL = rot(0, 0, .19 * brace);
    joints.jawR = rot(0, 0, -.19 * brace);
    joints.body = { position: [0, 0, -spring - .026 * brace], rotation: [.043 * brace, 0, 0] };
  }

  const explicitHit = ['hit', 'hurt', 'damage'].includes(action) ? (p < .12 ? smooth(p / .12) : 1 - ease(p, .12, 1)) : 0;
  const hit = clamp(Math.max(finite(context.hit), explicitHit));
  if (hit > 0) {
    const impulse = hit * hit, bodyPosition = joints.body.position, bodyRotation = joints.body.rotation;
    joints.body = { position: [bodyPosition[0], bodyPosition[1] + .035 * impulse, bodyPosition[2] - .028 * impulse], rotation: [bodyRotation[0] - .075 * impulse, bodyRotation[1], bodyRotation[2] + .024 * impulse] };
    const platen = joints.platen?.position || [0, 0, 0];
    joints.platen = { position: [0, 0, platen[2] + .025 * impulse] };
    for (const [id, side] of [['L', -1], ['R', 1]]) {
      const field = joints['field' + id]?.rotation || [0, 0, 0];
      joints['field' + id] = rot(field[0] + .048 * impulse, field[1] + side * .028 * impulse, field[2]);
    }
  }
  return { joints };
}
