import { clamp, ease, fract, smooth, pulse } from '../enemy-rig.js';

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const rotation = (x = 0, y = 0, z = 0) => ({ rotation: [x, y, z] });
const neutral = () => ({ joints: {}, root: { rotation: [0, 0, 0], position: [0, 0, 0] } });

/** A planted foot passes from front (-Y) to rear (+Y) as the root advances.
 * Swing uses a lifted return path. Two-link IK keeps every joint connected;
 * the ankle cancels hip + knee pitch so the complete sole stays level.
 */
function legPose(phase) {
  const p = fract(phase), stance = p < .62;
  const t = stance ? p / .62 : (p - .62) / .38;
  const y = stance ? -.21 + .42 * t : .21 - .42 * smooth(t);
  const lift = stance ? 0 : .155 * Math.sin(Math.PI * t);
  const down = .96 - lift;
  const d = Math.min(.999, Math.hypot(y, down));
  const knee = Math.PI - Math.acos(clamp((.5 - d * d) / .5, -1, 1));
  const hip = Math.atan2(y, down) - Math.acos(clamp(d, -1, 1));
  return { hip, knee, ankle: -hip - knee, stance, t };
}

function setLeg(joints, side, hip, knee, ankle) {
  joints['hip' + side] = rotation(hip);
  joints['knee' + side] = rotation(knee);
  joints['ankle' + side] = rotation(ankle);
}

/** Pure presentation pose; the combat state is read, never modified. */
export function animate(context = {}) {
  const action = context.action || 'idle';
  const dead=action==='death'||action==='wreck';
  if (context.reducedMotion&&!dead || ['preview', 'disabled', 'idle', 'cast'].includes(action)) {
    // This unit has ability:none. A cast request therefore holds its rig.
    // The hit envelope is applied below for ordinary idle battle frames.
    if (context.reducedMotion || action !== 'idle' || !(finite(context.hit) > 0)) return neutral();
  }

  const p = dead&&(context.reducedMotion||action==='wreck')?1:clamp(finite(context.progress));
  const joints = {};
  const root = { rotation: [0, 0, 0], position: [0, 0, 0] };

  if (dead) {
    // Loss of knee drive lowers the hips before the chest folds forward.
    // Hip/knee angles are paired; cos(hip)-1 keeps both soles on the ground.
    const buckle = ease(p, .04, .70), hip = -.96 * buckle;
    setLeg(joints, 'L', hip, -2 * hip, hip);
    setLeg(joints, 'R', hip, -2 * hip, hip);
    root.position[2] = Math.cos(hip) - 1;
    joints.torso = rotation(.92 * ease(p, .23, .90), -.04 * buckle, -.05 * buckle);
    joints.head = rotation(.28 * ease(p, .36, .88));
    joints.shoulderL = rotation(-1.15 * buckle);
    joints.elbowL = rotation(.32 * buckle);
    joints.wristL = rotation(-.14 * buckle);
    joints.shoulderR = rotation(-.30 * ease(p, 0, .20) + .10 * buckle);
    joints.elbowR = rotation(.36 * buckle);
    joints.wristR = rotation(-.22 * buckle);
    joints.striker = { position: [0, 0, -.022 * buckle] };
    return { joints, root };
  }

  if ((action === 'move' || context.moving) && finite(context.speed, 1) > 0) {
    // Travel, rather than wall time, drives the transmission. Pausing and
    // combat speed changes preserve the current contact phase.
    const phase = Number.isFinite(context.travel)
      ? context.travel / (.42/.62)
      : finite(context.clock) / 680;
    const left = legPose(phase), right = legPose(phase + .5);
    setLeg(joints, 'L', left.hip, left.knee, left.ankle);
    setLeg(joints, 'R', right.hip, right.knee, right.ankle);
    root.position[2] = -.04;
    // The torso leans toward the supporting side. The hip beam and planted
    // foot positions remain fixed while that upper mass transfers weight.
    const transfer = smooth(fract(phase) < .5 ? fract(phase) * 2 : (1 - fract(phase)) * 2);
    const lean = .047 * (1 - 2 * transfer);
    joints.torso = rotation(.035, lean, 0);
    joints.head = rotation(-.025, -lean * .65, 0);
    joints.shoulderL = rotation(-left.hip * .48);
    joints.elbowL = rotation(.07 + Math.max(0, left.hip) * .35);
    // A carried hammer has less excursion and a bent elbow to support load.
    joints.shoulderR = rotation(-right.hip * .20);
    joints.elbowR = rotation(.09 + Math.max(0, right.hip) * .18);
    joints.wristR = rotation(-.04);
  }

  if (['attack', 'breach', 'terrain'].includes(action)) {
    // Windup 0-.24, work stroke .24-.42, contact .42-.52, return .52-1.
    // Shoulder, elbow and wrist rotate around real axles; the tool follows
    // the wrist chain and its head compresses only along the handle guide.
    const prepare = ease(p, 0, .24), work = ease(p, .24, .42);
    const held = 1 - ease(p, .52, 1), contact = pulse(p, .39, .44, .57);
    const brace = .14 * prepare * (1 - ease(p, .70, 1));
    setLeg(joints, 'L', -brace, brace * 2, -brace);
    setLeg(joints, 'R', -brace, brace * 2, -brace);
    root.position[2] = Math.cos(brace) - 1;
    joints.torso = rotation((-.06 * prepare + .19 * work) * held, 0, (.18 * prepare - .28 * work) * held);
    joints.head = rotation((.07 * prepare - .13 * work) * held, 0, -.04 * work * held);
    joints.shoulderR = rotation((-2.00 * prepare + .78 * work) * held);
    joints.elbowR = rotation((-.60 * prepare + 1.06 * work) * held);
    joints.wristR = rotation((.24 * prepare - .50 * work) * held);
    joints.striker = { position: [0, 0, .035 * contact] };
    joints.shoulderL = rotation((-.25 * prepare - .28 * work) * held);
    joints.elbowL = rotation(.60 * prepare * held);
    joints.wristL = rotation(-.14 * work * held);
  }

  // ctx.hit is the runtime's short 170 ms impact envelope. It layers a local
  // backplate impulse over walking/attacking, keeping the feet and rig intact.
  const explicitHit = ['hit', 'hurt', 'damage'].includes(action)
    ? (p < .15 ? smooth(p / .15) : 1 - ease(p, .15, 1)) : 0;
  const hit = clamp(Math.max(finite(context.hit), explicitHit));
  if (hit > 0) {
    const torso = joints.torso?.rotation || [0, 0, 0];
    const head = joints.head?.rotation || [0, 0, 0];
    const shoulder = joints.shoulderR?.rotation || [0, 0, 0];
    joints.torso = rotation(torso[0] - .14 * hit, torso[1], torso[2] + .055 * hit);
    joints.head = rotation(head[0] - .12 * hit, head[1], head[2]);
    joints.shoulderR = rotation(shoulder[0] + .19 * hit, shoulder[1], shoulder[2]);
    joints.elbowR = rotation((joints.elbowR?.rotation?.[0] || 0) + .10 * hit);
  }
  return { joints, root };
}
