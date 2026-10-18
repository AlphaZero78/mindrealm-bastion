import { clamp, ease, fract, smooth } from '../enemy-rig.js';

const UPPER = .44, LOWER = .42, CYCLE = .70, STANCE = .75;
const LEGS = [['LF', 0, -1], ['RR', .25, 1], ['RF', .50, 1], ['LR', .75, -1]];
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const rot = (x = 0, y = 0, z = 0) => ({ rotation: [x, y, z] });
const neutral = () => ({ joints: {}, root: { rotation: [0, 0, 0], position: [0, 0, 0] } });

/** Exact .44/.42 parent chain; ankle counter-rotation levels the contact sole. */
function leg(joints, id, y, down, lift = 0) {
  const vertical = Math.max(.18, down - lift);
  const d = Math.min(UPPER + LOWER - .000001, Math.hypot(y, vertical));
  const knee = Math.PI - Math.acos(clamp((UPPER * UPPER + LOWER * LOWER - d * d) / (2 * UPPER * LOWER), -1, 1));
  const hip = Math.atan2(y, vertical) - Math.acos(clamp((UPPER * UPPER + d * d - LOWER * LOWER) / (2 * UPPER * d), -1, 1));
  joints['hip' + id] = rot(hip);
  joints['knee' + id] = rot(knee);
  joints['ankle' + id] = rot(-hip - knee);
}

function support(joints, travel, lower, moving, forward = 0) {
  let transfer = 0;
  for (const [id, offset, side] of LEGS) {
    if (!moving) { leg(joints, id, forward, UPPER + LOWER - lower); continue; }
    const phase = fract(travel / CYCLE + offset), stance = phase < STANCE;
    const t = stance ? phase / STANCE : (phase - STANCE) / (1 - STANCE);
    // dy/dtravel = 1 throughout stance, cancelling the model's -Y travel.
    const stride = CYCLE * STANCE;
    const y = forward + (stance ? stride * (t - .5) : stride * (.5 - smooth(t)));
    const lift = stance ? 0 : .11 * 16 * t * t * (1 - t) * (1 - t);
    leg(joints, id, y, UPPER + LOWER - lower, lift);
    if (!stance) transfer = -side * 16 * t * t * (1 - t) * (1 - t);
  }
  return transfer;
}

function distribution(joints, open, draw, compress, gauge = 0) {
  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R';
    // Each rigid lifting frame moves laterally around a seated shoulder.
    // The working bowl counter-inclines so its feed structure remains upright.
    const incline = side * .82 * open, yaw = side * .58 * open;
    joints['shoulder' + id] = rot(0, -incline, 0);
    // ZYX Euler decomposition of Ry(incline) * Rz(yaw). Multiplying by
    // the shoulder's Ry(-incline) leaves only the intended outward yaw.
    joints['reflector' + id] = rot(
      Math.atan2(Math.sin(incline) * Math.sin(yaw), Math.cos(incline)) + .055 * compress,
      Math.asin(clamp(Math.sin(incline) * Math.cos(yaw), -1, 1)),
      Math.atan2(Math.sin(yaw), Math.cos(incline) * Math.cos(yaw)),
    );
  }
  joints.distributor = { position: [0, 0, .105 * draw - .075 * compress + .018 * gauge] };
  joints.sensor = rot(-.07 * open + .035 * compress);
}

function fallen(progress) {
  const p = clamp(progress), vent = ease(p, 0, .21), buckle = ease(p, .15, .84), settle = ease(p, .73, 1);
  const lower = .36 * buckle, forward = .055 * buckle, joints = {};
  support(joints, 0, lower, false, forward);
  joints.vault = rot(.47 * buckle, -.025 * settle, .025 * settle);
  joints.sensor = rot(.12 * buckle);
  joints.ram = { position: [0, .055 * vent, 0] };
  joints.distributor = { position: [0, 0, -.105 * buckle] };
  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R';
    joints['shoulder' + id] = rot(.19 * buckle, side * .20 * buckle);
    joints['reflector' + id] = rot(-.18 * buckle, -side * .16 * buckle, -side * .12 * vent);
  }
  // Opposite target displacement keeps all four ankle contacts on the floor.
  return { joints, root: { rotation: [0, 0, 0], position: [0, -forward, -lower] } };
}

export function animate(context = {}) {
  const action = context.action || 'idle', p = clamp(finite(context.progress));
  if (action === 'preview' || action === 'disabled') return neutral();
  if (action === 'wreck') return fallen(1);
  if (action === 'death') return fallen(context.reducedMotion ? 1 : p);
  if (context.reducedMotion) return neutral();

  const travel = Math.max(0, finite(context.travel));
  const moving = context.moving === true || action === 'move';
  const casting = ['cast', 'ability', 'shield', 'buff'].includes(action);
  const windup = context.stage === 'windup' || context.stage === 'prepare' || context.actionKind === 'ability-windup';
  const settle = casting ? windup ? ease(p, 0, .22) : 1 - ease(p, .69, 1) : 0;
  const attacking = ['attack', 'breach', 'terrain'].includes(action);
  const prepare = attacking ? ease(p, 0, .22) : 0;
  const work = attacking ? ease(p, .22, .40) : 0;
  const recover = attacking ? 1 - ease(p, .64, 1) : 0;
  const contact = attacking ? ease(p, .36, .41) * (1 - ease(p, .47, .60)) : 0;
  const lower = (moving ? .07 : 0) + .03 * settle + .024 * prepare * recover;
  const joints = {}, root = { rotation: [0, 0, 0], position: [0, 0, -lower] };
  const transfer = support(joints, travel, lower, moving);
  joints.vault = rot(moving ? .024 : 0, .022 * transfer, 0);

  const gauge = clamp(finite(context.shieldFraction) / .12);
  if (gauge) joints.distributor = { position: [0, 0, .018 * gauge] };
  if (casting) {
    // The warning's held endpoint exactly matches release frame zero.
    const open = windup ? ease(p, .14, .75) : 1 - ease(p, .46, .94);
    const draw = windup ? ease(p, .44, .98) : 1 - ease(p, 0, .24);
    const compress = windup ? 0 : ease(p, 0, .24) * (1 - ease(p, .34, .69));
    distribution(joints, open, draw, compress, gauge);
    joints.vault.rotation[0] += .025 * open - .035 * compress;
  }
  if (attacking) {
    // The nose remains captured by its .32 sleeve throughout the .14 stroke.
    joints.ram = { position: [0, (.050 * prepare - .190 * work + .035 * contact) * recover, 0] };
    joints.vault.rotation[0] += (-.055 * prepare + .145 * work - .035 * contact) * recover;
    joints.sensor = rot(-.07 * work * recover);
    for (const side of [-1, 1]) {
      const id = side < 0 ? 'L' : 'R';
      joints['shoulder' + id] = rot(.05 * prepare * recover, -side * .10 * prepare * recover);
      joints['reflector' + id] = rot(-.045 * prepare * recover, side * .10 * prepare * recover);
    }
  }

  const hitAction = ['hit', 'hurt', 'damage'].includes(action);
  const explicitHit = hitAction ? p < .12 ? smooth(p / .12) : 1 - ease(p, .12, 1) : 0;
  const hit = clamp(Math.max(finite(context.hit), explicitHit));
  if (hit) {
    const impulse = hit * hit;
    const vault = joints.vault.rotation;
    joints.vault = rot(vault[0] - .12 * impulse, vault[1] + .025 * impulse, vault[2]);
    for (const side of [-1, 1]) {
      const id = side < 0 ? 'L' : 'R', current = joints['reflector' + id]?.rotation || [0, 0, 0];
      joints['reflector' + id] = rot(current[0] + .09 * impulse, current[1], current[2] - side * .045 * impulse);
    }
    const spindle = joints.distributor?.position || [0, 0, 0];
    joints.distributor = { position: [spindle[0], spindle[1], spindle[2] + .020 * impulse] };
  }
  return { joints, root };
}
