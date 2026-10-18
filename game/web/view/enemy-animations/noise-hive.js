import { TAU, clamp, smooth, ease, fract, wheelSupportHeight, wheelRollAngle } from '../enemy-rig.js';

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const rotation = (x = 0, y = 0, z = 0) => ({ rotation: [x, y, z] });
const neutral = () => ({ joints: {}, root: { rotation: [0, 0, 0], position: [0, 0, 0] } });
const RADIUS = .32;
const WHEELS = ['wheelLF', 'wheelLM', 'wheelLR', 'wheelRF', 'wheelRM', 'wheelRR'];

function transmission(joints, travel) {
  const angle = wheelRollAngle(travel, RADIUS);
  for (const id of WHEELS) joints[id] = rotation(angle);
  joints.chassis = { position: [0, 0, wheelSupportHeight(angle, RADIUS) - RADIUS] };
}

function doors(joints, openness, asymmetry = 0) {
  joints.doorL = rotation(0, 0, -.88 * openness - .12 * asymmetry);
  joints.doorR = rotation(0, 0, .88 * openness - .07 * asymmetry);
}

function contactStroke(progress) {
  const p = clamp(progress);
  if (p < .23) return .105 * smooth(p / .23);
  if (p < .44) { const t = (p - .23) / .21; return .105 - .385 * t * t; }
  if (p < .60) return -.280 + .070 * smooth((p - .44) / .16);
  return -.210 * (1 - smooth((p - .60) / .40));
}

function dead(progress, travel) {
  const p = clamp(progress), unlock = ease(p, 0, .24);
  const sag = ease(p, .18, .79), rest = ease(p, .68, 1);
  const joints = {};
  transmission(joints, travel);
  joints.body = { position: [.012 * sag, .026 * sag, -.092 * sag], rotation: [.029 * sag, .021 * rest, 0] };
  joints.reactor = { position: [0, .015 * sag, -.12 * sag], rotation: [.055 * sag, 0, 0] };
  joints.roof = rotation(.31 * sag, -.035 * rest, .019 * rest);
  joints.ram = { position: [0, .11 * unlock, 0] };
  joints.telemetry = rotation(.13 * sag, -.055 * rest, 0);
  doors(joints, .24 * unlock, rest);
  for (const [tag, side] of [['L', -1], ['R', 1]]) {
    joints['throat' + tag] = rotation(.036 * sag, 0, 0);
    joints['plunger' + tag] = { position: [0, .14 * unlock, 0] };
    joints['pump' + tag] = rotation(.055 * sag, side * .13 * sag, 0);
    joints['broadcast' + tag] = rotation(.22 * sag, side * (tag === 'L' ? .43 : .25) * unlock, -side * .045 * rest);
    joints['vent' + tag] = rotation(0, side * (tag === 'L' ? .46 : .30) * unlock, 0);
    joints['sensor' + tag] = rotation(.14 * sag, 0, 0);
  }
  return { joints, root: { rotation: [0, 0, 0], position: [0, 0, 0] } };
}

/** Pure machinery pose; reinforcement creation and haste live in battle.js. */
export function animate(ctx = {}) {
  const action = ctx.action || 'idle', p = clamp(finite(ctx.progress));
  const phase = clamp(Math.floor(finite(ctx.phase)), 0, 2);
  const travel = Math.max(0, finite(ctx.travel));
  if (['preview', 'disabled', 'stopped', 'static'].includes(action)) return neutral();
  if (action === 'wreck') return dead(1, ctx.reducedMotion ? 0 : travel);
  if (action === 'death') return dead(ctx.reducedMotion ? 1 : p, ctx.reducedMotion ? 0 : travel);
  if (ctx.reducedMotion) return neutral();

  const moving = (ctx.moving === true || action === 'move') && finite(ctx.speed) > 0;
  const hit = clamp(Math.max(finite(ctx.hit), ['hit', 'hurt', 'damage'].includes(action) ? 1 - smooth(p) : 0));
  const windup = ctx.stage === 'windup' || ctx.stage === 'prepare' || ctx.actionKind?.endsWith('windup');
  const casting = ['cast', 'ability', 'summon'].includes(action);
  const surge = casting && (ctx.ability === 'surge' || ctx.actionKind?.startsWith('surge'));
  const push = casting && (ctx.ability === 'push' || ctx.actionKind?.startsWith('push'));
  const active = phase >= 1 && !!ctx.abilityActive && !!ctx.boosted;
  const elapsed = Math.max(0, finite(ctx.abilityElapsed));
  const remaining = Math.max(0, finite(ctx.abilityRemaining, active ? 3 : 0));
  const fieldHold = active ? (1 - ease(elapsed, 2.65, 3)) * ease(remaining, 0, .35) : 0;
  const joints = {}, root = { rotation: [0, 0, 0], position: [0, 0, 0] };
  transmission(joints, travel);

  // The actual wheel-rim contact transition drives spring compression.
  // There is no clock wobble, and warning/release retain independent traction.
  const seam = 1 - smooth(Math.abs(fract(travel / (RADIUS * TAU) * 12) - .5) * 2);
  let load = moving ? .008 + .005 * seam : 0;
  let open = 0, draw = 0, aim = .64 * fieldHold, vent = .16 * fieldHold;
  let feedL = 0, feedR = 0, reaction = 0, reactor = .022 * fieldHold;
  let lid = 0, ram = 0, pressure = 0;

  if (casting && !surge && !push) {
    if (windup) {
      aim = ease(p, 0, .28);
      open = ease(p, .07, .34);
      draw = ease(p, .25, .89);
      feedL = feedR = .105 * draw;
      reactor = .047 * draw;
      pressure = .15 * draw;
      vent = .12 * ease(p, .15, .48);
      lid = -.035 * draw;
    } else {
      // p=0 equals the loaded warning endpoint. Two mechanical outlets
      // discharge inside one presentation; the simulation spawns instantly.
      open = 1 - ease(p, .58, 1);
      draw = 1 - ease(p, .37, .86);
      aim = Math.max(1 - ease(p, .55, 1), .64 * fieldHold);
      const left = ease(p, .02, .23) * (1 - ease(p, .31, .70));
      const right = ease(p, .08, .29) * (1 - ease(p, .39, .78));
      feedL = .105 * (1 - ease(p, 0, .20)) - .255 * left;
      feedR = .105 * (1 - ease(p, .02, .26)) - .255 * right;
      reaction = Math.max(left, right);
      reactor = .047 * draw - .034 * reaction + .022 * fieldHold * ease(p, .60, 1);
      pressure = .15 * draw - .065 * reaction;
      vent = Math.max(.12 * (1 - ease(p, .66, 1)) + .17 * reaction, .16 * fieldHold * ease(p, .55, 1));
      lid = -.035 * draw + .032 * reaction;
    }
    load += .012 * draw + .020 * reaction;
  } else if (push) {
    const ready = windup ? ease(p, 0, .76) : 1 - ease(p, .36, 1);
    ram = .11 * ready;
    lid = -.025 * ready;
    reactor = -.03 * ready;
    vent = .23 * ready;
    load += .025 * ready;
  } else if (surge) {
    const ready = windup ? ease(p, 0, .85) : 1 - ease(p, .34, 1);
    const release = windup ? 0 : ease(p, .02, .20) * (1 - ease(p, .35, .70));
    aim = Math.max(ready, .64 * fieldHold);
    reactor = -.055 * ready + .071 * release;
    lid = -.047 * ready + .073 * release;
    vent = .23 * ready;
    reaction = release;
    load += .025 * ready;
  } else if (['attack', 'breach', 'terrain'].includes(action)) {
    ram = contactStroke(p);
    reaction = ease(p, .28, .44) * (1 - ease(p, .58, .81));
    load += .035 * reaction;
  }

  // A finite servo sector scan belongs to the real 3 s haste interval.
  // Its step interpolation freezes with battle time and has no idle motion.
  const sector = clamp(elapsed / .42, 0, 6), step = Math.floor(sector);
  const scan = fieldHold * .020 * (step + smooth(fract(sector)));
  load += .032 * hit;
  const driveLean = ctx.boosted && moving ? ease(elapsed, 0, .30) : 0;
  joints.body = { position: [.008 * hit, .022 * reaction + .012 * hit, -load], rotation: [.043 * reaction - .025 * hit - .012 * driveLean, .020 * hit, 0] };
  joints.reactor = { position: [0, .013 * reaction, reactor - .019 * hit] };
  joints.roof = rotation(lid + .047 * hit, 0, 0);
  joints.ram = { position: [0, ram + .043 * hit, 0] };
  joints.telemetry = rotation(.058 * hit, 0, 0);
  doors(joints, open);
  for (const [tag, side] of [['L', -1], ['R', 1]]) {
    joints['throat' + tag] = rotation(.020 * reaction - .022 * hit, 0, 0);
    joints['plunger' + tag] = { position: [0, (tag === 'L' ? feedL : feedR) + .036 * hit, 0] };
    joints['pump' + tag] = { position: [0, 0, -.020 * pressure], rotation: [-.030 * reaction, side * pressure, 0] };
    joints['broadcast' + tag] = rotation(-.17 * aim + .062 * hit, side * (.075 * aim + .043 * hit), side * scan);
    joints['vent' + tag] = rotation(0, side * (vent + .065 * hit), 0);
    joints['sensor' + tag] = rotation(-.025 * draw + .077 * hit, 0, 0);
  }
  return { joints, root };
}
