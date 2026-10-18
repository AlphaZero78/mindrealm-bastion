import { clamp, ease, fract, smooth } from '../enemy-rig.js';

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const rotation = (x = 0, y = 0, z = 0) => ({ rotation: [x, y, z] });
const neutral = () => ({ joints: {}, root: { rotation: [0, 0, 0], position: [0, 0, 0] } });
const UPPER = .39, LOWER = .38, CYCLE = .80, STANCE = .75;
const LEGS = [['LF', 0], ['RR', .25], ['RF', .50], ['LR', .75]];

/** Solve against a contact target; the exact parent pivots are .39/.38 apart.
 * In stance Y increases by CYCLE*STANCE over that travel interval, cancelling
 * the root's -Y advance. Only swing uses easing and a lifted return path.
 */
function leg(joints, id, y, down, lift = 0) {
  const vertical = Math.max(.16, down - lift);
  const d = Math.min(UPPER + LOWER - .00001, Math.hypot(y, vertical));
  const knee = Math.PI - Math.acos(clamp((UPPER * UPPER + LOWER * LOWER - d * d) / (2 * UPPER * LOWER), -1, 1));
  const hip = Math.atan2(y, vertical) - Math.acos(clamp((UPPER * UPPER + d * d - LOWER * LOWER) / (2 * UPPER * d), -1, 1));
  joints['hip' + id] = rotation(hip);
  joints['knee' + id] = rotation(knee);
  joints['ankle' + id] = rotation(-hip - knee);
}

function support(joints, travel, lower, walking) {
  for (const [id, offset] of LEGS) {
    if (!walking) { leg(joints, id, 0, UPPER + LOWER - lower); continue; }
    const phase = fract(travel / CYCLE + offset), planted = phase < STANCE;
    const t = planted ? phase / STANCE : (phase - STANCE) / (1 - STANCE);
    const stride = CYCLE * STANCE;
    const y = planted ? stride * (t - .5) : stride * (.5 - smooth(t));
    const lift = planted ? 0 : .12 * Math.sin(Math.PI * t);
    leg(joints, id, y, UPPER + LOWER - lower, lift);
  }
}

function treatment(joints, open, draw, press, walking) {
  const carried = walking ? 1 - open : 0;
  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R';
    joints['shoulder' + id] = rotation(-.08 * carried - 1.10 * open + .07 * press, -side * (.015 * carried + .17 * open), side * (.035 * carried + .32 * open));
    joints['elbow' + id] = rotation(.13 * carried + .28 * open - .12 * press, 0, -side * .07 * open);
    joints['wrist' + id] = rotation(-.05 * carried + .82 * open + .05 * press, side * .11 * open, -side * .13 * open);
  }
  // The visible plunger moves inside the fixed .32 guide sleeve. It draws
  // during warning, then performs one positive pressure stroke at release.
  joints.pump = { position: [0, 0, .065 * draw - .080 * press] };
  joints.sensor = rotation(-.075 * open + .04 * press);
  joints.cabinet = rotation(.035 * carried + .025 * open - .035 * press);
}

function fallen(progress) {
  const p = clamp(progress), relief = ease(p, 0, .24), buckle = ease(p, .14, .83), settle = ease(p, .78, 1);
  const lower = .33 * buckle, forward = .065 * buckle, joints = {};
  // The keel falls vertically as all four knee drives lose pressure. Giving
  // each target the opposite root displacement leaves the soles on the floor.
  for (const [id] of LEGS) leg(joints, id, forward, UPPER + LOWER - lower);
  joints.cabinet = rotation(.47 * ease(p, .29, .92), -.025 * settle, .025 * settle);
  joints.sensor = rotation(.16 * buckle);
  joints.pump = { position: [0, 0, .024 * relief - .073 * buckle] };
  joints.shoulderL = rotation(-.22 * relief + .38 * buckle, .045 * buckle, -.09 * buckle);
  joints.shoulderR = rotation(-.27 * relief + .41 * buckle, -.035 * buckle, .08 * buckle);
  joints.elbowL = rotation(.42 * relief - .16 * settle);
  joints.elbowR = rotation(.47 * relief - .20 * settle);
  joints.wristL = rotation(-.28 * buckle);
  joints.wristR = rotation(-.29 * buckle);
  return { joints, root: { rotation: [0, 0, 0], position: [0, -forward, -lower] } };
}

/** Pure state-derived rig: no wall-time motor, state writes or random motion. */
export function animate(context = {}) {
  const action = context.action || 'idle', p = clamp(finite(context.progress));
  if (action === 'preview' || action === 'disabled') return neutral();
  if (action === 'wreck') return fallen(1);
  if (action === 'death') return fallen(context.reducedMotion ? 1 : p);
  if (context.reducedMotion) return neutral();

  const travel = Math.max(0, finite(context.travel));
  // Warnings do not stop core/battle.js movement. Continuing the same travel
  // transmission during a cast preserves planted feet. A frozen travel value
  // also freezes this pose, including the current supporting foot group.
  const walking = travel > 0 && finite(context.speed, .82) > 0;
  const joints = {}, root = { rotation: [0, 0, 0], position: [0, 0, 0] };
  const casting = ['cast', 'ability', 'heal'].includes(action);
  const windup = context.stage === 'windup' || context.stage === 'prepare' || context.actionKind === 'ability-windup';
  const settle = casting ? windup ? ease(p, 0, .20) : 1 - ease(p, .60, 1) : 0;
  const lower = (walking ? .09 : 0) + .035 * settle;
  support(joints, travel, lower, walking);
  root.position[2] = -lower;

  if (walking) {
    // Upper mass stays inside the support triangle. Its small fixed forward
    // pitch expresses carried medical equipment rather than idle oscillation.
    joints.cabinet = rotation(.035);
    joints.shoulderL = rotation(-.08, .015, -.035);
    joints.shoulderR = rotation(-.08, -.015, .035);
    joints.elbowL = rotation(.13);
    joints.elbowR = rotation(.13);
    joints.wristL = rotation(-.05);
    joints.wristR = rotation(-.05);
  }

  if (casting) {
    // 1.1 s actual warning: frame support first, then the tools and compound
    // pump. The 420 ms release starts exactly at the warning's held end pose.
    const open = windup ? ease(p, .17, .72) : 1 - ease(p, .45, .92);
    const draw = windup ? ease(p, .46, .98) : 1 - ease(p, 0, .24);
    const press = windup ? 0 : ease(p, 0, .24) * (1 - ease(p, .34, .67));
    treatment(joints, open, draw, press, walking);
  }

  if (['attack', 'breach', 'terrain'].includes(action)) {
    // Clinical tool contact: fold and brace, thrust the complete joint chain,
    // hold contact, release the elbow load, then reseat the tool in its cradle.
    const prepare = ease(p, 0, .20), work = ease(p, .20, .43), returnStroke = 1 - ease(p, .58, 1);
    const contact = ease(p, .38, .44) * (1 - ease(p, .49, .68));
    const brace = .027 * prepare * returnStroke;
    support(joints, travel, lower + brace, walking);
    root.position[2] = -lower - brace;
    joints.cabinet = rotation((-.055 * prepare + .15 * work) * returnStroke, 0, -.045 * work * returnStroke);
    joints.shoulderR = rotation((-.40 * prepare - 1.07 * work) * returnStroke, -.075 * work * returnStroke, .055 * prepare * returnStroke);
    joints.elbowR = rotation((.58 * prepare - .76 * work + .12 * contact) * returnStroke);
    joints.wristR = rotation((-.18 * prepare + 1.83 * work - .12 * contact) * returnStroke);
    joints.shoulderL = rotation(-.28 * prepare * returnStroke, .075 * prepare * returnStroke, -.10 * prepare * returnStroke);
    joints.elbowL = rotation(.46 * prepare * returnStroke);
    joints.wristL = rotation(-.18 * prepare * returnStroke);
    joints.pump = { position: [0, 0, -.019 * contact] };
    joints.sensor = rotation(-.07 * work * returnStroke);
  }

  const explicitHit = ['hit', 'hurt', 'damage'].includes(action) ? (p < .12 ? smooth(p / .12) : 1 - ease(p, .12, 1)) : 0;
  const hit = clamp(Math.max(finite(context.hit), explicitHit));
  if (hit > 0) {
    const impulse = hit * hit, cabinet = joints.cabinet?.rotation || [0, 0, 0];
    joints.cabinet = rotation(cabinet[0] - .13 * impulse, cabinet[1] + .035 * impulse, cabinet[2]);
    for (const id of ['L', 'R']) {
      const elbow = joints['elbow' + id]?.rotation || [0, 0, 0];
      const wrist = joints['wrist' + id]?.rotation || [0, 0, 0];
      joints['elbow' + id] = rotation(elbow[0] + .14 * impulse, elbow[1], elbow[2]);
      joints['wrist' + id] = rotation(wrist[0] - .11 * impulse, wrist[1], wrist[2]);
    }
    const pump = joints.pump?.position || [0, 0, 0];
    joints.pump = { position: [pump[0], pump[1], pump[2] + .023 * impulse] };
  }
  return { joints, root };
}
