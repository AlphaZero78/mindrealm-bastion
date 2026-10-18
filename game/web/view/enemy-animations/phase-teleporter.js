import { clamp, ease, fract, smooth, pulse } from '../enemy-rig.js';

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const rotation = (x = 0, y = 0, z = 0) => ({ rotation: [x, y, z] });
const neutral = () => ({ joints: {}, root: { rotation: [0, 0, 0], position: [0, 0, 0] } });
const SEGMENT = .325, LEG_LENGTH = SEGMENT * 2;
const CYCLE = .48, STANCE = .75, STRIDE = CYCLE * STANCE;
const LEGS = [['LF', 0], ['RR', .25], ['RF', .5], ['LR', .75]];

/** The ankle endpoint is solved from the authored .325/.325 pivot spacing.
 * Rigid level shoes are then carried by the counter-rotating ankle. During
 * stance d(relativeY)/d(travel)=1, cancelling the root's forward -Y motion.
 */
function solveLeg(joints, id, y, down, lift = 0) {
  const z = Math.max(.12, down - lift);
  const d = Math.min(LEG_LENGTH - .000001, Math.hypot(y, z));
  const bend = Math.acos(clamp(d / LEG_LENGTH, -1, 1));
  const hip = Math.atan2(y, z) - bend, knee = bend * 2;
  joints['hip' + id] = rotation(hip);
  joints['knee' + id] = rotation(knee);
  joints['ankle' + id] = rotation(-hip - knee);
}

function support(joints, travel, lower, moving, carry = 0) {
  for (const [id, offset] of LEGS) {
    if (!moving) {
      // Preserve the exact straight static chain, including its ground Z=0.
      if (lower === 0 && carry === 0) {
        joints['hip' + id] = rotation();
        joints['knee' + id] = rotation();
        joints['ankle' + id] = rotation();
      } else solveLeg(joints, id, carry, LEG_LENGTH - lower);
      continue;
    }
    const p = fract(travel / CYCLE + offset), planted = p < STANCE;
    const t = planted ? p / STANCE : (p - STANCE) / (1 - STANCE);
    const y = planted ? STRIDE * (t - .5) : STRIDE * (.5 - smooth(t));
    const lift = planted ? 0 : .105 * Math.sin(Math.PI * t);
    solveLeg(joints, id, y + carry, LEG_LENGTH - lower, lift);
  }
}

function guides(joints, close, headLock, press = 0) {
  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R';
    // The trunnions have real Y axes. The jaw pitch counters part of the
    // closing arc, keeping its inward registration face level at the core.
    joints['guide' + id] = rotation(0, -side * .18 * close, 0);
    joints['jaw' + id] = rotation(-.025 * headLock + .035 * press, side * .12 * close, -side * .065 * headLock);
  }
}

function fallen(progress) {
  const p = clamp(progress), relief = ease(p, 0, .24);
  const buckle = ease(p, .14, .84), settle = ease(p, .80, 1);
  const lower = .34 * buckle, carry = .035 * buckle, joints = {};
  support(joints, 0, lower, false, carry);
  joints.body = rotation(.18 * buckle, -.025 * settle, .055 * buckle);
  joints.chamber = { position: [0, 0, -.08 * relief - .018 * settle] };
  joints.ram = { position: [0, .10 * relief, 0] };
  joints.sensor = rotation(.14 * buckle);
  joints.guideL = rotation(.025 * buckle, -.26 * relief, -.04 * buckle);
  joints.guideR = rotation(-.018 * buckle, .34 * relief, .03 * buckle);
  joints.jawL = rotation(.08 * relief, .045 * buckle, -.12 * settle);
  joints.jawR = rotation(.11 * relief, -.06 * buckle, .10 * settle);
  return { joints, root: { rotation: [0, 0, 0], position: [0, -carry, -lower] } };
}

/** Pure state-derived pose. The rule engine owns the ground-route jump. */
export function animate(ctx = {}) {
  const action = ctx.action || 'idle', p = clamp(finite(ctx.progress));
  if (action === 'preview' || action === 'disabled') return neutral();
  if (action === 'wreck') return fallen(1);
  if (action === 'death') return fallen(ctx.reducedMotion ? 1 : p);
  if (ctx.reducedMotion) return neutral();

  const moving = (ctx.moving === true || action === 'move') && finite(ctx.speed, 1) > 0;
  const travel = Math.max(0, finite(ctx.travel));
  const casting = ['cast', 'ability', 'teleport'].includes(action);
  const windup = ctx.stage === 'windup' || ctx.stage === 'prepare' || ctx.actionKind === 'ability-windup';
  const load = casting ? windup ? ease(p, 0, .20) : 1 - ease(p, .12, .74) : 0;
  let lower = (moving ? .075 : 0) + .030 * load;
  const joints = {}, root = { rotation: [0, 0, 0], position: [0, 0, -lower] };
  support(joints, travel, lower, moving);

  if (moving) {
    // Mechanical transport pose is held throughout every planted interval.
    // A frozen combat clock and travel value produce the same full pose.
    joints.body = rotation(.025);
    joints.sensor = rotation(-.025);
  }

  if (casting) {
    // Warning closes and aligns the real guide jaws while walking continues.
    // Release p=0 is exactly the held warning p=1 pose. The actual jump has
    // already occurred: discharge starts immediately, then the jaws reopen.
    const close = windup ? ease(p, .18, .70) : 1 - ease(p, .12, .88);
    const lock = windup ? ease(p, .48, .92) : 1 - ease(p, .04, .44);
    const draw = windup ? ease(p, .40, 1) : 1 - ease(p, 0, .13);
    const press = windup ? 0 : ease(p, 0, .13) * (1 - ease(p, .24, .76));
    guides(joints, close, lock, press);
    joints.chamber = { position: [0, 0, .035 * draw - .065 * press] };
    joints.body = rotation((moving ? .025 : 0) + .018 * close - .018 * press);
    joints.sensor = rotation(-.070 * lock + .025 * press);
  }

  if (['attack', 'breach', 'terrain'].includes(action)) {
    // Captive contact ram: withdraw, drive along its sleeve, unload against
    // the stop collar, and return. Only actual movement drives leg exchange.
    const prepare = pulse(p, 0, .12, .30), work = pulse(p, .12, .29, .77);
    const hold = ease(p, 0, .16) * (1 - ease(p, .66, 1));
    const recoil = pulse(p, .29, .43, .91);
    lower += .035 * hold;
    support(joints, travel, lower, moving);
    root.position[2] = -lower;
    joints.ram = { position: [0, .065 * prepare - .205 * work + .022 * recoil, 0] };
    joints.body = rotation((moving ? .025 : 0) - .020 * prepare + .040 * work);
    joints.chamber = { position: [0, 0, -.020 * work + .009 * recoil] };
    joints.sensor = rotation(-.045 * hold);
    guides(joints, .17 * hold, .12 * hold);
  }

  const explicitHit = ['hit', 'hurt', 'damage'].includes(action) ? pulse(p, 0, .14, 1) : 0;
  const hit = clamp(Math.max(finite(ctx.hit), explicitHit));
  if (hit > 0) {
    const impulse = hit * hit, body = joints.body?.rotation || [0, 0, 0];
    joints.body = rotation(body[0] - .080 * impulse, body[1], body[2] + .028 * impulse);
    const chamber = joints.chamber?.position || [0, 0, 0];
    joints.chamber = { position: [chamber[0], chamber[1], chamber[2] - .023 * impulse] };
    const ram = joints.ram?.position || [0, 0, 0];
    joints.ram = { position: [ram[0], ram[1] + .034 * impulse, ram[2]] };
    joints.sensor = rotation((joints.sensor?.rotation?.[0] || 0) + .070 * impulse);
  }
  return { joints, root };
}
