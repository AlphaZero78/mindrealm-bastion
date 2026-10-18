import { TAU, clamp, ease, fract, pulse, smooth, stroke, wheelRollAngle, wheelSupportHeight } from '../enemy-rig.js';

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const rotate = (x = 0, y = 0, z = 0) => ({ rotation: [x, y, z] });
const RADIUS = .30;
const WHEELS = ['LF', 'LA', 'LB', 'LR', 'RF', 'RA', 'RB', 'RR'];
const neutral = () => ({ joints: {}, root: { rotation: [0, 0, 0], position: [0, 0, 0] } });

function transmission(joints, travel) {
  const angle = wheelRollAngle(Math.max(0, finite(travel)), RADIUS);
  for (const id of WHEELS) joints['wheel' + id] = rotate(angle);
  joints.chassis = { position: [0, 0, wheelSupportHeight(angle, RADIUS) - RADIUS] };
}

function channels(joints, phase, opening, axial, camAngle, work = 0) {
  joints.tapRack = { position: [0, axial, 0] };
  joints.channelCam = rotate(0, camAngle);
  joints.coolerL = rotate(0, -.45 * opening);
  joints.coolerR = rotate(0, .45 * opening);
  joints.doorL = rotate(0, -.10 * opening);
  joints.doorR = rotate(0, .10 * opening);
  if (phase >= 1) {
    joints.boosterL = { position: [0, 0, -.008 * opening] };
    joints.boosterR = { position: [0, 0, -.008 * opening] };
    joints.boosterValveL = { position: [0, -.075 * work, 0] };
    joints.boosterValveR = { position: [0, -.075 * work, 0] };
  }
  if (phase >= 2) {
    joints.counterDish = rotate(.16 * opening);
    joints.counterFeed = { position: [0, -.084 * work, 0] };
    joints.rearLid = rotate(-.08 * opening);
  }
}

function fallen(progress, context, phase) {
  const p = clamp(progress), unload = ease(p, 0, .27), fold = ease(p, .18, .82), settle = ease(p, .73, 1);
  const joints = {};
  transmission(joints, context.reducedMotion ? 0 : context.travel);
  channels(joints, phase, .72 * (1 - fold), .095 * unload, -.15 * unload, 0);
  joints.body = { rotation: [.18 * fold, -.09 * fold, .025 * settle], position: [0, .018 * fold, -.055 * fold] };
  joints.jawL = { rotation: [0, 0, -.10 * unload], position: [0, .05 * unload, 0] };
  joints.jawR = { rotation: [0, 0, .13 * unload], position: [0, .05 * unload, 0] };
  joints.telemetry = rotate(-.10 * fold, .07 * settle);
  if (phase >= 1) {
    joints.boosterL = { rotation: [0, -.08 * fold, 0], position: [0, 0, -.025 * fold] };
    joints.boosterR = { rotation: [0, .06 * fold, 0], position: [0, 0, -.025 * fold] };
  }
  if (phase >= 2) {
    joints.counterDish = rotate(.51 * fold, -.12 * settle);
    joints.rearLid = rotate(.20 * fold);
    joints.counterFeed = { position: [0, .10 * unload, 0] };
  }
  return { joints, root: { rotation: [0, 0, 0], position: [0, 0, 0] } };
}

/** Captive channels, indexed cam and drive travel consume simulation facts. */
export function animate(context = {}) {
  const action = context.action || 'idle', p = clamp(finite(context.progress));
  const phase = clamp(Math.floor(finite(context.phase)), 0, 2);
  if (action === 'preview' || action === 'disabled') return neutral();
  if (action === 'wreck') return fallen(1, context, phase);
  if (action === 'death') return fallen(context.reducedMotion ? 1 : p, context, phase);

  const active = !!context.abilityActive;
  const elapsed = Math.max(0, finite(context.abilityElapsed));
  const remaining = Math.max(0, finite(context.abilityRemaining, active ? 1 : 0));
  const duration = Math.max(.001, elapsed + remaining);
  const held = active ? ease(remaining, 0, .32) : 0;
  if (context.reducedMotion) {
    const joints = {};
    channels(joints, phase, active ? 1 : 0, active ? -.035 : 0, 0);
    return { joints, root: { rotation: [0, 0, 0], position: [0, 0, 0] } };
  }

  const joints = {}, root = { rotation: [0, 0, 0], position: [0, 0, 0] };
  transmission(joints, context.travel);
  const moving = (context.moving === true || action === 'move') && finite(context.speed, .46) > 0;
  const load = moving ? .009 + .005 * clamp(finite(context.speed), 0, 2) : 0;
  joints.body = { rotation: [moving ? .010 : 0, 0, 0], position: [0, 0, -load] };

  // Each of the four measured lobes loads one shared six-channel engagement.
  // Whole turns return the plate to its seat; its actual angle drives the rack.
  const drive = active ? smooth(elapsed / duration) : 0;
  const revolutions = (2 + phase) * drive;
  const cam = active ? -TAU * revolutions : 0;
  const cell = active ? stroke(fract(revolutions * 4), .30, .46) * held : 0;
  channels(joints, phase, held, -.035 * held - .018 * cell, cam, cell);

  const casting = action === 'cast' || action === 'ability' || action === 'jam';
  const windup = context.stage === 'windup' || context.stage === 'prepare' || context.actionKind === 'ability-windup';
  const jamCast = casting && !['surge', 'push'].includes(context.ability) && !String(context.actionKind || '').startsWith('surge');
  if (jamCast) {
    const open = windup ? ease(p, .04, .76) : active ? held : 1 - ease(p, .56, 1);
    const draw = windup ? ease(p, .12, .88) : 1 - ease(p, 0, .16);
    const contact = windup ? 0 : pulse(p, 0, .18, .50);
    const running = windup ? 0 : ease(p, .50, 1);
    channels(joints, phase, open, .085 * draw - .115 * contact - .035 * held * running - .018 * cell * running,
      windup ? -.20 * ease(p, .36, .92) : -.20 * (1 - ease(p, 0, .18)) + cam, windup ? -.22 * draw : contact + cell * running);
    joints.body.rotation[0] += .018 * draw - .024 * contact;
    joints.body.position[2] -= .012 * open + .008 * contact;
  }

  if (action === 'attack' || action === 'breach' || action === 'terrain') {
    const work = stroke(p, .25, .44), brace = pulse(p, 0, .22, .94), contact = pulse(p, .43, .49, .68);
    joints.jawL = { rotation: [0, 0, .235 * work], position: [0, -.15 * work, .005 * contact] };
    joints.jawR = { rotation: [0, 0, -.235 * work], position: [0, -.15 * work, .005 * contact] };
    joints.body.rotation[0] += -.038 * brace + .065 * contact;
    joints.body.position[2] -= .018 * brace;
  }

  // Advanced-difficulty surge is a separate warning; the transmission and
  // live jam channels continue while the contact jaws take the surge load.
  if (casting && !jamCast) {
    const brace = windup ? ease(p, .06, .86) : 1 - ease(p, .28, 1);
    const kick = windup ? 0 : pulse(p, .04, .23, .64);
    joints.jawL = { rotation: [0, 0, -.08 * brace + .17 * kick], position: [0, .035 * brace - .075 * kick, 0] };
    joints.jawR = { rotation: [0, 0, .08 * brace - .17 * kick], position: [0, .035 * brace - .075 * kick, 0] };
    joints.body.position[2] -= .018 * brace;
    joints.body.rotation[0] -= .023 * brace - .033 * kick;
  }

  const hit = clamp(Math.max(finite(context.hit), ['hit', 'hurt', 'damage'].includes(action) ? 1 - smooth(p) : 0));
  if (hit > 0) {
    const impulse = hit * hit;
    joints.body.position[2] -= .021 * impulse;
    joints.body.rotation[0] -= .065 * impulse;
    joints.body.rotation[1] += .024 * impulse;
    joints.tapRack.position[1] += .031 * impulse;
    joints.channelCam.rotation[1] += .047 * impulse;
    for (const tag of ['L', 'R']) {
      const jaw = joints['jaw' + tag] || { rotation: [0, 0, 0], position: [0, 0, 0] };
      jaw.position[1] += .029 * impulse;
      joints['jaw' + tag] = jaw;
    }
    if (phase >= 2) joints.counterDish.rotation[0] -= .048 * impulse;
  }
  return { joints, root };
}
