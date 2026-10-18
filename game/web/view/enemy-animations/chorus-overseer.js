import { clamp, smooth, ease, pulse } from '../enemy-rig.js';

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const pose = (x = 0, y = 0, z = 0) => ({ rotation: [x, y, z] });
const neutral = () => ({ joints: {}, root: { rotation: [0, 0, 0], position: [0, 0, 0] } });

function contactStroke(p) {
  if (p < .24) return .09 * smooth(p / .24);
  if (p < .45) return .09 - .29 * smooth((p - .24) / .21);
  if (p < .61) return -.20 + .035 * smooth((p - .45) / .16);
  return -.165 * (1 - ease(p, .61, 1));
}

function vectorThrust(joints, power, brake, impulse = 0) {
  joints.nozzleF = pose(.12 * power - .13 * brake - .05 * impulse);
  joints.nozzleL = pose(.15 * power - .11 * brake, -.026 * power - .035 * impulse);
  joints.nozzleR = pose(.15 * power - .11 * brake, .026 * power + .02 * impulse);
  joints.rudder = pose(-.075 * power + .035 * brake, .035 * impulse);
}

function shutdown(p, phase) {
  const unlock = ease(p, 0, .25), settle = ease(p, .18, .83), latch = ease(p, .60, 1);
  const joints = {
    harmonicCore: { position: [0, .012 * settle, -.055 * settle], rotation: [.035 * settle, 0, 0] },
    coreCoupler: { position: [0, 0, -.085 * settle] },
    noseRam: { position: [0, .09 * unlock, 0] },
    noseTip: { position: [0, .01 * latch, 0] },
    cantorF: pose(.14 * settle), feedF: { position: [0, .07 * unlock, 0] },
    ventF: pose(.09 * settle),
    relayLift: { position: [0, 0, -[0, .08, .25][phase] * settle] },
    ['relayHead' + phase]: pose([0, .20, .53][phase] * settle),
    jammerRotor: pose(0, 0, -.11 * unlock),
  };
  for (const [tag, side] of [['L', -1], ['R', 1]]) {
    joints['channel' + tag] = pose(0, 0, -side * [0, .68, 1.169][phase] * settle);
    joints['cantor' + tag + phase] = pose(.12 * settle, side * .035 * latch);
    const a = side * ([0, 39, 67][phase] + 12) * Math.PI / 180;
    joints['feed' + tag + phase] = { position: [-Math.sin(a) * .065 * unlock, Math.cos(a) * .065 * unlock, 0] };
    joints['vent' + tag + phase] = pose(.11 * settle, side * .05 * latch);
    joints['shroud' + tag] = pose(0, 0, -side * [0, .681, 1.257][phase] * settle);
  }
  vectorThrust(joints, 0, .14 * settle);
  return { joints, root: { rotation: [0, 0, 0], position: [0, 0, 0] } };
}

/** Shield application, jam and breakthrough remain exclusively in battle.js. */
export function animate(ctx = {}) {
  const action = ctx.action || 'idle', p = clamp(finite(ctx.progress));
  const phase = clamp(Math.floor(finite(ctx.phase)), 0, 2);
  if (['preview', 'static', 'disabled', 'stopped'].includes(action)) return neutral();
  if (action === 'wreck') return shutdown(1, phase);
  if (action === 'death') return shutdown(ctx.reducedMotion ? 1 : p, phase);
  if (ctx.reducedMotion) return neutral();

  const moving = (ctx.moving === true || action === 'move') && finite(ctx.speed) > 0;
  const power = moving ? clamp(finite(ctx.speed) / .65) * (ctx.boosted ? 1.12 : 1) : 0;
  const windup = ctx.stage === 'windup' || ctx.stage === 'prepare' || ctx.actionKind?.endsWith('windup');
  const casting = ['cast', 'ability', 'group_shield', 'surge'].includes(action);
  const surge = casting && (ctx.ability === 'surge' || ctx.actionKind?.startsWith('surge'));
  const pushing = casting && (ctx.ability === 'push' || ctx.actionKind?.startsWith('push'));
  const active = phase >= 1 && !!ctx.abilityActive;
  const elapsed = Math.max(0, finite(ctx.abilityElapsed));
  const remaining = Math.max(0, finite(ctx.abilityRemaining, active ? 2 : 0));
  const jamHold = active ? (1 - ease(elapsed, 1.70, 2)) * ease(remaining, 0, .28) : 0;
  const shield = clamp(finite(ctx.shieldFraction) / .18);
  const hit = clamp(Math.max(finite(ctx.hit), ['hit', 'hurt', 'damage'].includes(action) ? 1 - smooth(p) : 0));

  let aim = .09 * shield, draw = 0, work = 0, heat = 0, core = 0;
  let feedF = 0, feedL = 0, feedR = 0, nose = 0, noseContact = 0, brake = 0;
  let relayAim = .055 * jamHold, relayLift = .025 * jamHold, valve = .14 * jamHold;
  if (casting && !surge && !pushing) {
    if (windup) {
      aim = ease(p, 0, .32);
      draw = ease(p, .20, .87);
      feedF = feedL = feedR = .062 * draw;
      core = .055 * draw;
      heat = .16 * ease(p, .30, .88);
      relayAim = phase >= 1 ? .15 * draw : 0;
      relayLift = phase >= 1 ? .035 * draw : 0;
      valve = phase >= 1 ? .34 * draw : 0;
    } else {
      // Warning p=1 and release p=0 have identical charged geometry.
      // One real shield event is carried by a short staggered signal path.
      aim = Math.max(1 - ease(p, .60, 1), .09 * shield);
      draw = 1 - ease(p, .15, .63);
      const front = pulse(p, .02, .18, .54), left = pulse(p, .10, .27, .65), right = pulse(p, .18, .36, .76);
      feedF = .062 * (1 - ease(p, 0, .18)) - .095 * front;
      feedL = .062 * (1 - ease(p, .05, .26)) - .095 * left;
      feedR = .062 * (1 - ease(p, .12, .34)) - .095 * right;
      work = Math.max(front, left, right);
      core = .055 * draw - .037 * work;
      heat = .16 * (1 - ease(p, .65, 1)) + .19 * work;
      relayAim = phase >= 1 ? Math.max(.15 * (1 - ease(p, .62, 1)), .055 * jamHold) : 0;
      relayLift = phase >= 1 ? Math.max(.035 * (1 - ease(p, .66, 1)), .025 * jamHold) : 0;
      valve = phase >= 1 ? Math.max(.34 * (1 - ease(p, .54, 1)), .14 * jamHold) : 0;
      brake = .08 * work;
    }
  } else if (surge) {
    const charged = windup ? ease(p, 0, .86) : 1 - ease(p, .38, 1);
    work = windup ? 0 : pulse(p, .025, .21, .68);
    aim = Math.max(charged, .09 * shield);
    core = .07 * charged - .105 * work;
    feedF = feedL = feedR = .058 * charged - .078 * work;
    heat = .24 * charged + .12 * work;
    brake = .18 * work;
  } else if (pushing) {
    const loaded = windup ? ease(p, 0, .84) : 1 - ease(p, .40, 1);
    nose = .07 * loaded;
    brake = .10 * loaded;
  } else if (['attack', 'breach', 'terrain'].includes(action)) {
    nose = contactStroke(p);
    noseContact = pulse(p, .36, .47, .73);
    brake = .19 * noseContact;
  }

  const joints = {
    chassis: pose(.037 * power - .012 * brake),
    harmonicCore: { position: [0, .014 * work + .018 * hit, -.015 * work], rotation: [.035 * hit, .017 * hit, 0] },
    coreCoupler: { position: [0, 0, core - .024 * hit] },
    noseRam: { position: [0, nose + .026 * hit, 0] },
    noseTip: { position: [0, .023 * noseContact, 0] },
    cantorF: pose(-.14 * aim + .064 * hit),
    feedF: { position: [0, feedF + .022 * hit, 0] },
    ventF: pose(.18 * heat + .07 * hit),
    relayLift: { position: [0, 0, relayLift - .018 * hit] },
    ['relayHead' + phase]: pose(-relayAim + .045 * hit),
    jammerRotor: pose(0, 0, valve),
  };
  for (const [tag, side] of [['L', -1], ['R', 1]]) {
    const a = side * ([0, 39, 67][phase] + 12) * Math.PI / 180;
    const feed = tag === 'L' ? feedL : feedR;
    joints['channel' + tag] = pose(0, side * .018 * work, side * .05 * draw);
    // The bowl's true local X axis follows the authored stage and yaw.
    joints['cantor' + tag + phase] = pose(-.12 * aim * Math.cos(a) + .055 * hit, -.12 * aim * Math.sin(a), 0);
    joints['feed' + tag + phase] = { position: [-Math.sin(a) * (feed + .018 * hit), Math.cos(a) * (feed + .018 * hit), 0] };
    joints['vent' + tag + phase] = pose(.14 * heat, side * (.10 * heat + .045 * hit));
    joints['shroud' + tag] = pose(0, 0, side * .11 * (phase >= 1 ? Math.max(draw, jamHold) : 0));
  }
  vectorThrust(joints, power, brake, hit);
  return { joints, root: { rotation: [0, 0, 0], position: [0, 0, 0] } };
}
