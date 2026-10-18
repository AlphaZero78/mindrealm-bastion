import { clamp, ease, fract, smooth, pulse } from '../enemy-rig.js';

const finite = (x, fallback = 0) => Number.isFinite(x) ? x : fallback;
const names = ['FL', 'FR', 'RL', 'RR'];
const offsets = [0, .5, .5, 0];
const rotate = (x = 0, y = 0, z = 0) => ({ rotation: [x, y, z] });
const neutral = () => ({ joints: {}, root: { rotation: [0, 0, 0], position: [0, 0, 0] } });

// One .40-unit travel cycle has .64 stance and .36 swing. During stance the
// foot moves +Y by .256, exactly cancelling the root's -.256 travel in -Y.
// Swing returns along a raised path, while the other diagonal pair supports.
function footTarget(phase) {
  const p = fract(phase), stance = p < .64;
  const t = stance ? p / .64 : (p - .64) / .36;
  return {
    y: stance ? -.128 + .256 * t : .128 - .256 * smooth(t),
    lift: stance ? 0 : .105 * Math.sin(Math.PI * t),
  };
}

function placeFeet(joints, root, feet) {
  for (let i = 0; i < names.length; i++) {
    const foot = feet[i], y = foot.y - root.position[1];
    const down = .56 + root.position[2] - foot.lift;
    const d = Math.min(.559999, Math.max(.02, Math.hypot(y, down)));
    const knee = Math.PI - Math.acos(clamp((.1568 - d * d) / .1568, -1, 1));
    const hip = Math.atan2(y, down) - Math.acos(clamp(d / .56, -1, 1));
    joints['hip' + names[i]] = rotate(hip);
    joints['knee' + names[i]] = rotate(knee);
    // Equal and opposite ankle rotation keeps the complete shoe horizontal.
    joints['ankle' + names[i]] = rotate(-hip - knee);
  }
}

/** Pure mechanical pose. Offspring counts and combat rules remain in battle. */
export function animate(ctx = {}) {
  const action = ctx.action || 'idle';
  const dead=action==='death'||action==='wreck';
  if (ctx.reducedMotion&&!dead || ['preview', 'disabled', 'cast'].includes(action)) return neutral();

  const p = dead&&(ctx.reducedMotion||action==='wreck')?1:clamp(finite(ctx.progress));
  const joints = {}, root = { rotation: [0, 0, 0], position: [0, 0, 0] };
  let feet = names.map(() => ({ y: 0, lift: 0 }));
  let articulateFeet = false;

  if (dead) {
    // The 650 ms runtime death window is one complete irreversible sequence:
    // 0-105 ms unlock, 65-300 ms open, 195-460 ms eject the empty cradles,
    // 350-650 ms settle the load onto folded feet and stop at the end stops.
    const unlock = ease(p, 0, .16), open = ease(p, .10, .46);
    const eject = ease(p, .30, .71), settle = ease(p, .54, 1);
    joints.ram = { position: [0, .095 * ease(p, 0, .23), 0] };
    for (const [suffix, side] of [['L', -1], ['R', 1]]) {
      joints['latch' + suffix] = { position: [side * .055 * unlock, .18 * unlock, -.025 * unlock] };
      joints['shell' + suffix] = rotate(0, -side * 1.08 * open);
      joints['sled' + suffix] = { position: [side * .36 * eject, -.11 * eject, 0] };
    }
    root.position[2] = -.20 * settle;
    joints.service = { position: [0, 0, -.035 * settle] };
    placeFeet(joints, root, feet);
    return { joints, root };
  }

  if ((action === 'move' || ctx.moving) && finite(ctx.speed, 1) > 0) {
    // No wall-time fallback: the registered drivetrain follows actual travel.
    // Pauses and speed changes keep the same phase at the same position.
    const phase = finite(ctx.travel) / .40;
    feet = offsets.map(offset => footTarget(phase + offset));
    root.position[2] = -.018;
    articulateFeet = true;
    const supportTransfer = smooth(fract(phase) < .5 ? fract(phase) * 2 : (1 - fract(phase)) * 2);
    // The pressure unit's short guide travels with the weight transfer; the
    // sealed lids, chassis and all ground contact points remain aligned.
    joints.service = { position: [.014 * (1 - 2 * supportTransfer), 0, -.007] };
  }

  if (['attack', 'terrain', 'breach'].includes(action)) {
    const prepare = ease(p, 0, .24), work = ease(p, .24, .43);
    const recover = 1 - ease(p, .57, 1), contact = pulse(p, .41, .46, .58);
    const brace = prepare * (1 - ease(p, .66, 1));
    // All four shoes remain planted while the mass drops to brace the stroke.
    root.position[2] = -.048 * brace;
    root.position[1] = .032 * prepare * recover - .012 * contact;
    feet = names.map(() => ({ y: 0, lift: 0 }));
    articulateFeet = true;
    joints.ram = { position: [0, (.10 * prepare - .42 * work) * recover + .045 * contact, 0] };
    joints.service = { position: [0, 0, -.018 * brace] };
  }

  const explicitHit = ['hit', 'hurt', 'damage'].includes(action)
    ? (p < .13 ? smooth(p / .13) : 1 - ease(p, .13, 1)) : 0;
  const hit = clamp(Math.max(finite(ctx.hit), explicitHit));
  if (hit > 0) {
    // Hydraulic compression absorbs the impact without sliding planted feet.
    root.position[2] -= .025 * hit;
    articulateFeet = true;
    const ram = joints.ram?.position || [0, 0, 0];
    joints.ram = { position: [ram[0], ram[1] + .045 * hit, ram[2]] };
    const service = joints.service?.position || [0, 0, 0];
    joints.service = { position: [service[0], service[1] + .015 * hit, service[2] - .012 * hit] };
  }
  if (articulateFeet) placeFeet(joints, root, feet);
  return { joints, root };
}
