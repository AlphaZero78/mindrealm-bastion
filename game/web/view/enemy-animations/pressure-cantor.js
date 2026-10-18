import { TAU, clamp, ease, fract, smooth, stroke } from '../enemy-rig.js';

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const rot = (x = 0, y = 0, z = 0) => ({ rotation: [x, y, z] });
const neutral = () => ({ joints: {}, root: { rotation: [0, 0, 0], position: [0, 0, 0] } });
const UPPER = .39, LOWER = .36, CYCLE = .72, STANCE = .66;

function contactLeg(joints, id, y, down, lift = 0) {
  const vertical = Math.max(.15, down - lift);
  const d = Math.min(UPPER + LOWER - .000001, Math.hypot(y, vertical));
  const knee = Math.PI - Math.acos(clamp((UPPER * UPPER + LOWER * LOWER - d * d) / (2 * UPPER * LOWER), -1, 1));
  const hip = Math.atan2(y, vertical) - Math.acos(clamp((UPPER * UPPER + d * d - LOWER * LOWER) / (2 * UPPER * d), -1, 1));
  joints['hip' + id] = rot(hip);
  joints['knee' + id] = rot(knee);
  joints['ankle' + id] = rot(-hip - knee);
}

function footTarget(travel, offset) {
  const phase = fract(travel / CYCLE + offset), planted = phase < STANCE;
  const t = planted ? phase / STANCE : (phase - STANCE) / (1 - STANCE);
  const stride = CYCLE * STANCE;
  return {
    y: planted ? stride * (t - .5) : stride * (.5 - smooth(t)),
    lift: planted ? 0 : .13 * Math.sin(Math.PI * t),
    planted,
  };
}

function stanceLoad(travel, offset) {
  const phase = fract(travel / CYCLE + offset);
  return phase < STANCE ? ease(phase, 0, .08) * (1 - ease(phase, .58, STANCE)) : 0;
}

function support(joints, travel, lower, moving, forward = 0) {
  for (const [id, offset] of [['L', 0], ['R', .5]]) {
    const target = moving ? footTarget(travel, offset) : { y: 0, lift: 0 };
    contactLeg(joints, id, target.y + forward, UPPER + LOWER - lower, target.lift);
  }
}

function aperture(joints, open, compression = 0) {
  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R';
    joints['horn' + id] = rot(-.10 * open + .035 * compression, side * .035 * open, side * .055 * open);
    joints['shutter' + id] = rot(0, 0, side * .87 * open);
    joints['vent' + id] = rot(0, side * .38 * open, 0);
  }
  joints.sensor = rot(-.055 * open + .025 * compression);
}

function fallen(progress) {
  const p = clamp(progress), vent = ease(p, 0, .27), buckle = ease(p, .12, .83), settle = ease(p, .76, 1);
  const lower = .29 * buckle, forward = .07 * buckle, joints = {};
  // The ankle targets counter both vertical and forward root displacement,
  // leaving the long contact soles on the ground as the short legs buckle.
  support(joints, 0, lower, false, forward);
  aperture(joints, .28 * vent * (1 - settle));
  joints.resonator = rot(.44 * buckle, -.055 * settle, .025 * settle);
  joints.hornL = rot(.34 * buckle, .045 * settle, -.09 * buckle);
  joints.hornR = rot(.38 * buckle, -.035 * settle, .08 * buckle);
  joints.shutterL = rot(0, 0, -.13 * buckle);
  joints.shutterR = rot(0, 0, .13 * buckle);
  joints.pump = { position: [0, 0, .018 * vent - .064 * buckle] };
  joints.cam = rot(0, -.34 * vent, 0);
  joints.striker = { position: [0, .05 * buckle, -.015 * settle] };
  return { joints, root: { rotation: [0, 0, 0], position: [0, -forward, -lower] } };
}

/** Only the simulation's travel and ability interval drive this mechanism. */
export function animate(context = {}) {
  const action = context.action || 'idle', p = clamp(finite(context.progress));
  if (action === 'preview' || action === 'disabled') return neutral();
  if (action === 'wreck') return fallen(1);
  if (action === 'death') return fallen(context.reducedMotion ? 1 : p);

  const active = !!context.abilityActive;
  const elapsed = Math.max(0, finite(context.abilityElapsed));
  const remaining = Math.max(0, finite(context.abilityRemaining, active ? 4 : 0));
  const held = active ? ease(remaining, 0, .28) : 0;
  if (context.reducedMotion) {
    const joints = {};
    if (active) { aperture(joints, held); joints.pump = { position: [0, 0, .025 * held] }; }
    return { joints, root: { rotation: [0, 0, 0], position: [0, 0, 0] } };
  }

  const travel = Math.max(0, finite(context.travel));
  // Cast is an upper-body action. Core/battle.js continues locomotion during
  // its warning, so a true moving flag keeps the same independent stride.
  const moving = (context.moving === true || action === 'move') && finite(context.speed, .85) > 0;
  const joints = {}, root = { rotation: [0, 0, 0], position: [0, 0, 0] };
  let lower = moving ? .09 : 0;
  let open = held, compression = 0;
  const duration = Math.max(.001, elapsed + remaining);
  // Six complete cam turns span the actual four-second field. Smooth ramping
  // gives zero angular velocity at engagement and disengagement; the parked
  // angle is equivalent at both ends. The follower follows the eccentric.
  const camAngle = active ? -TAU * 6 * smooth(elapsed / duration) : 0;
  const follower = (1 - Math.cos(camAngle)) * .5;
  let pump = held * (.025 - .050 * follower);
  joints.cam = rot(0, camAngle, 0);

  const casting = action === 'cast' || action === 'ability';
  const windup = context.stage === 'windup' || context.stage === 'prepare' || context.actionKind === 'ability-windup';
  if (casting) {
    open = windup ? ease(p, .10, .83) : active ? held : 1 - ease(p, .60, 1);
    const draw = windup ? ease(p, .34, .98) : 1 - ease(p, 0, .20);
    compression = windup ? 0 : ease(p, 0, .17) * (1 - ease(p, .31, .63));
    // The release begins at the warning's held follower height. One loaded
    // compression stroke hands over to the small cam-driven field strokes.
    pump = .066 * draw - .044 * compression + pump * (windup ? 0 : ease(p, .45, 1));
  }

  lower += .025 * open;
  aperture(joints, open, compression);
  joints.pump = { position: [0, 0, pump] };
  const leftLoad = stanceLoad(travel, 0), rightLoad = stanceLoad(travel, .5);
  const carried = moving ? .033 * (rightLoad - leftLoad) / Math.max(.001, leftLoad + rightLoad) : 0;
  joints.resonator = rot((moving ? .023 : 0) - .030 * open - .025 * compression, carried, 0);

  if (['attack', 'breach', 'terrain'].includes(action)) {
    const work = stroke(p, .24, .44), brace = ease(p, 0, .19) * (1 - ease(p, .65, 1));
    const contact = ease(p, .40, .46) * (1 - ease(p, .51, .70));
    // A guided linear ram handles contact; bending both load legs absorbs its
    // recoil while the upper voice cups keep their live-field aperture.
    lower += .025 * brace;
    joints.striker = { position: [0, -.215 * work, .009 * contact] };
    const body = joints.resonator.rotation;
    joints.resonator = rot(body[0] + .065 * work, body[1], body[2]);
    for (const id of ['L', 'R']) {
      const horn = joints['horn' + id].rotation;
      joints['horn' + id] = rot(horn[0] + .035 * work, horn[1], horn[2]);
    }
  }

  support(joints, travel, lower, moving);
  root.position[2] = -lower;
  const explicitHit = ['hit', 'hurt', 'damage'].includes(action) ? (p < .10 ? smooth(p / .10) : 1 - ease(p, .10, 1)) : 0;
  const hit = clamp(Math.max(finite(context.hit), explicitHit));
  if (hit > 0) {
    const impulse = hit * hit, body = joints.resonator.rotation;
    joints.resonator = rot(body[0] - .13 * impulse, body[1] + .030 * impulse, body[2]);
    for (const id of ['L', 'R']) {
      const horn = joints['horn' + id].rotation;
      joints['horn' + id] = rot(horn[0] + .075 * impulse, horn[1], horn[2]);
    }
    joints.pump = { position: [0, 0, pump + .017 * impulse] };
    joints.sensor = rot(.09 * impulse - .055 * open);
  }
  return { joints, root };
}
