import { clamp, ease, fract, smooth, pulse } from '../enemy-rig.js';

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const rotation = (x = 0, y = 0, z = 0) => ({ rotation: [x, y, z] });
const neutral = () => ({ joints: {}, root: { rotation: [0, 0, 0], position: [0, 0, 0] } });
const LEGS = ['LF', 'RF', 'LR', 'RR'];
const CYCLE_TRAVEL = .50;
const STANCE = .60;
const STRIDE = CYCLE_TRAVEL * STANCE;
const SEGMENT = .30;

/** Plant in -Y, carry the same world contact to +Y, then lift and return.
 * During stance d(footY)/d(travel) = STRIDE/(CYCLE_TRAVEL*STANCE) = 1.
 * Since the root advances in -Y, that derivative cancels its displacement.
 * Equal 0.30 links solve the endpoint; the ankle cancels both rotations.
 */
function legPose(phase) {
  const p = fract(phase), stance = p < STANCE;
  const t = stance ? p / STANCE : (p - STANCE) / (1 - STANCE);
  const y = stance ? STRIDE * (t - .5) : STRIDE * (.5 - smooth(t));
  const height = stance ? 0 : .105 * Math.sin(Math.PI * t);
  const down = .56 - height;
  const d = Math.min(SEGMENT * 2 - .0001, Math.hypot(y, down));
  const bend = Math.acos(clamp(d / (SEGMENT * 2), -1, 1));
  const hip = Math.atan2(y, down) - bend;
  return { hip, knee: bend * 2, ankle: -hip - bend * 2, stance, height };
}

function setLeg(joints, suffix, hip, knee, ankle) {
  joints['hip' + suffix] = rotation(hip);
  joints['knee' + suffix] = rotation(knee);
  joints['ankle' + suffix] = rotation(ankle);
}

function brace(joints, root, bend) {
  // Symmetric knee flexion leaves the four sole centres at their rest Y.
  // The root lowers by the exact lost height so the sole bottoms remain fixed.
  for (const suffix of LEGS) setLeg(joints, suffix, -bend, bend * 2, -bend);
  root.position[2] = SEGMENT * 2 * (Math.cos(bend) - 1);
}

function fallen(p) {
  const unlock = ease(p, .02, .30), buckle = ease(p, .12, .78);
  const settle = ease(p, .74, 1), joints = {};
  const root = { rotation: [0, 0, 0], position: [0, 0, 0] };
  brace(joints, root, 1.04 * buckle);
  joints.receiver = rotation(.11 * buckle, -.025 * settle, -.035 * settle);
  joints.turret = rotation(0, 0, -.075 * unlock);
  joints.elevation = rotation(.23 * ease(p, .25, .93));
  joints.recoil = { position: [0, .075 * unlock, 0] };
  joints.scope = rotation(.31 * ease(p, .32, .90));
  joints.feed = rotation(-.32 * unlock);
  joints.ventL = rotation(0, -.20 * unlock);
  joints.ventR = rotation(0, .07 * unlock);
  return { joints, root };
}

/** Pure presentation: the rule engine owns range, volleys and the advance. */
export function animate(ctx = {}) {
  const action = ctx.action || 'idle', p = clamp(finite(ctx.progress));
  if (action === 'preview' || action === 'disabled') return neutral();
  if (action === 'wreck') return fallen(1);
  // Runtime progress spans the complete 650 ms corpse lifetime.
  if (action === 'death') return fallen(ctx.reducedMotion ? 1 : p);
  if (ctx.reducedMotion) return neutral();

  const joints = {}, root = { rotation: [0, 0, 0], position: [0, 0, 0] };
  const travel = Math.max(0, finite(ctx.travel));
  const moving = (action === 'move' || action === 'advance' || ctx.moving) && finite(ctx.speed) > 0;

  if (moving) {
    // Opposite diagonal pairs exchange support. There is always a planted
    // pair, and the 60% stance creates a four-foot overlap at each handoff.
    const phase = travel / CYCLE_TRAVEL;
    const poses = { LF: legPose(phase), RR: legPose(phase), RF: legPose(phase + .5), LR: legPose(phase + .5) };
    for (const suffix of LEGS) {
      const leg = poses[suffix];
      setLeg(joints, suffix, leg.hip, leg.knee, leg.ankle);
    }
    root.position[2] = -.04;
    const load = Math.max(poses.LF.height, poses.RF.height) / .105;
    // The hip bridges stay over the contact feet; only their carried mass
    // compresses its mounting and the long weapon adopts a transport pitch.
    joints.receiver = rotation(.025 + .015 * load, 0, 0);
    joints.elevation = rotation(.065 - .012 * load);
    joints.scope = rotation(.085);
    joints.ventL = rotation(0, -.09);
    joints.ventR = rotation(0, .09);
  }

  if (['attack', 'breach', 'terrain'].includes(action)) {
    // Prepare 0-.22: four-point brace and optical settling. Work .22-.35:
    // straight rearward rail recoil. Return .35-1: recover and re-index cell.
    const prepare = ease(p, 0, .22), recover = 1 - ease(p, .54, 1);
    const recoil = pulse(p, .22, .35, .72), index = pulse(p, .43, .66, 1);
    const aim = prepare * recover;
    brace(joints, root, .15 * aim);
    joints.receiver = rotation(-.014 * aim + .025 * recoil);
    joints.elevation = rotation(-.035 * aim + .028 * recoil);
    joints.recoil = { position: [0, .135 * recoil, 0] };
    joints.scope = rotation(.035 * aim - .022 * recoil);
    joints.feed = rotation(-.24 * index);
    joints.ventL = rotation(0, -.19 * pulse(p, .24, .48, 1));
    joints.ventR = rotation(0, .19 * pulse(p, .24, .48, 1));
  }

  // A direct gallery advance/windup request shows the transport interlock.
  // The live hunter expresses the three-shot rule through its actual move.
  if (action === 'cast' && String(ctx.actionKind || '').includes('advance')) {
    const lock = ease(p, 0, .65);
    brace(joints, root, .08 * lock);
    joints.scope = rotation(.085 * lock);
    joints.elevation = rotation(.065 * lock);
  }

  const explicitHit = ['hit', 'hurt', 'damage'].includes(action)
    ? pulse(p, 0, .16, 1) : 0;
  const hit = clamp(Math.max(finite(ctx.hit), explicitHit));
  if (hit > 0) {
    const body = joints.receiver?.rotation || [0, 0, 0];
    const gun = joints.elevation?.rotation || [0, 0, 0];
    joints.receiver = rotation(body[0] - .070 * hit, body[1], body[2] + .028 * hit);
    joints.elevation = rotation(gun[0] + .056 * hit, gun[1], gun[2]);
    joints.recoil = { position: [0, (joints.recoil?.position?.[1] || 0) + .037 * hit, 0] };
    joints.scope = rotation((joints.scope?.rotation?.[0] || 0) - .064 * hit);
  }
  return { joints, root };
}
