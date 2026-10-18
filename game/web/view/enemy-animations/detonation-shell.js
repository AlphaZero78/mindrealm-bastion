import { TAU, clamp, smooth, ease, fract, wheelSupportHeight, wheelRollAngle } from '../enemy-rig.js';

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const rotation = (x = 0, y = 0, z = 0) => ({ rotation: [x, y, z] });
const neutral = () => ({ joints: {}, root: { rotation: [0, 0, 0], position: [0, 0, 0] } });
const RADIUS = .26;
const WHEELS = ['wheelLF', 'wheelLR', 'wheelRF', 'wheelRR'];

function traction(joints, travel) {
  const angle = wheelRollAngle(travel,RADIUS);
  for (const id of WHEELS) joints[id] = rotation(angle);
  joints.chassis = { position: [0, 0, wheelSupportHeight(angle, RADIUS) - RADIUS] };
}

function depart(progress, travel) {
  // A normal breach sets dead=true without calling killEnemy. Retire the
  // traction cart with its containment cover closed, preserving that rule.
  const p = clamp(progress), sag = ease(p, 0, 1), joints = {};
  traction(joints, travel);
  joints.caisson = { position: [0, .018 * sag, -.042 * sag] };
  joints.ram = { position: [0, .055 * sag, 0] };
  joints.sensor = rotation(.11 * sag);
  return { joints, root: { rotation: [0, 0, 0], position: [0, 0, 0] } };
}

function detonate(progress, travel) {
  const p = clamp(progress), unlock = .45 + .55 * ease(p, 0, .12);
  const impulse = 1 - ease(p, 0, .32), sag = ease(p, .13, .84);
  const settle = ease(p, .45, 1), joints = {};
  traction(joints, travel);

  // The damage event has already occurred at p=0. Its first visible pose
  // therefore releases the locks and poppets and kicks the cover open.
  // Later progress is residual mechanical discharge, with no delayed hit.
  const lid = .18 + .86 * ease(p, 0, .25) - .18 * settle;
  joints.lid = rotation(-lid);
  joints.caisson = { position: [0, .035 * impulse + .018 * sag, -.060 * sag] };
  joints.pressureCore = { position: [0, .010 * impulse, -.022 * sag], rotation: [.025 * sag, -.045 * sag, 0] };
  joints.controller = rotation(.20 * sag, -.11 * settle, .035 * settle);
  joints.gearbox = { position: [0, 0, -.019 * sag], rotation: [.06 * sag, 0, 0] };
  joints.ram = { position: [0, .075 * unlock, 0] };
  joints.sensor = rotation(.15 * sag, 0, -.035 * settle);
  for (const [id, side] of [['L', -1], ['R', 1]]) {
    joints['latch' + id] = { position: [side * .075 * unlock, 0, .015 * unlock], rotation: [0, -side * .30 * unlock, 0] };
    joints['vent' + id] = { position: [0, 0, .027 + .040 * impulse], rotation: [0, side * .11 * sag, 0] };
  }
  return { joints, root: { rotation: [0, 0, 0], position: [0, 0, 0] } };
}

function contactCycle(progress, terrain) {
  const p = clamp(progress), reach = terrain ? .22 : .18;
  // Ordinary enemy attacks are release events. The preloaded cylinder is
  // ready at rest; frame zero is the real contact stroke, then compliance,
  // return and a finite spring reload take place in the 420 ms event window.
  let ram;
  if (p < .16) ram = -reach + .032 * smooth(p / .16);
  else if (p < .57) ram = (-reach + .032) * (1 - smooth((p - .16) / .41));
  else ram = .025 * ease(p, .57, .76) * (1 - ease(p, .76, 1));
  return { ram, reaction: 1 - ease(p, .05, .47), reload: ease(p, .57, .76) * (1 - ease(p, .76, 1)) };
}

/** Pure presentation. Explosion timing and every damage value stay in battle. */
export function animate(ctx = {}) {
  const action = ctx.action || 'idle', p = clamp(finite(ctx.progress));
  const travel = Math.max(0, finite(ctx.travel));
  if (['preview', 'disabled', 'stopped', 'static'].includes(action)) return neutral();
  if (action === 'wreck' || action === 'death') {
    const end = action === 'wreck' || ctx.reducedMotion ? 1 : p;
    const distance = ctx.reducedMotion ? 0 : travel;
    return ctx.actionKind === 'breach' ? depart(end, distance) : detonate(end, distance);
  }
  if (action === 'explosion' || ctx.actionKind === 'explosion') return detonate(ctx.reducedMotion ? 1 : p, ctx.reducedMotion ? 0 : travel);
  if (ctx.reducedMotion) return neutral();

  const joints = {}, root = { rotation: [0, 0, 0], position: [0, 0, 0] };
  traction(joints, travel);
  const moving = (ctx.moving || action === 'move') && finite(ctx.speed) > 0;
  const hit = Math.max(clamp(finite(ctx.hit)), action === 'hit' ? 1 - smooth(p) : 0);
  const seam = 1 - smooth(Math.abs(fract(travel / (RADIUS * TAU) * 12) - .5) * 2);
  let compression = moving ? .007 + .003 * seam : 0, ram = 0, reaction = 0, reload = 0;

  if (action === 'attack' || action === 'breach') {
    const cycle = contactCycle(p, ctx.actionKind === 'terrain');
    ram = cycle.ram; reaction = cycle.reaction; reload = cycle.reload;
    compression += .016 * reaction;
  }
  // explode has no living cast in the real simulation. A generic cast pose
  // retains transport posture, so the viewer cannot invent a periodic blast.
  compression += .021 * hit;
  ram += .025 * hit;
  joints.caisson = { position: [.007 * hit, .036 * reaction + .015 * hit, -compression], rotation: [.009 * reaction, 0, 0] };
  joints.ram = { position: [0, ram, 0] };
  joints.pressureCore = { position: [0, .009 * reaction, -.008 * hit] };
  joints.controller = rotation(.050 * hit, 0, 0);
  joints.sensor = rotation(.082 * hit + .025 * reaction);
  joints.gearbox = rotation(.015 * reaction);
  for (const [id, side] of [['L', -1], ['R', 1]]) {
    joints['latch' + id] = { position: [-side * (.006 * reaction + .003 * reload), 0, 0] };
  }
  return { joints, root };
}
