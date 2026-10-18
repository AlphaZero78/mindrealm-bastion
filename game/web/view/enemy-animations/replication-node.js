import { TAU, clamp, smooth, ease, fract, wheelSupportHeight, wheelRollAngle } from '../enemy-rig.js';

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const rotation = (x = 0, y = 0, z = 0) => ({ rotation: [x, y, z] });
const neutral = () => ({ joints: {}, root: { rotation: [0, 0, 0], position: [0, 0, 0] } });
const WHEELS = ['wheelLF', 'wheelLR', 'wheelRF', 'wheelRR'];
const RADIUS = .28;
function traction(joints, travel) {
  // The model faces -Y. +X rotation cancels the ground speed at the lower
  // wheel tangent. The rotation is independent of the cast/attack overlay.
  const angle = wheelRollAngle(travel,RADIUS);
  for (const id of WHEELS) joints[id] = rotation(angle);
  joints.chassis = { position: [0, 0, wheelSupportHeight(angle, RADIUS) - RADIUS] };
}

function fallen(progress, travel) {
  const p = clamp(progress), unlock = ease(p, 0, .20);
  const sag = ease(p, .14, .79), settle = ease(p, .72, 1);
  const joints = {};
  traction(joints, travel);
  joints.cabinet = { position: [0, .022 * sag, -.075 * sag], rotation: [.035 * sag, 0, 0] };
  joints.powerpack = { rotation: [.09 * sag, -.18 * sag, .035 * settle] };
  joints.feed = { position: [0, -.06 * unlock, -.032 * sag], rotation: [.055 * sag, 0, 0] };
  joints.ejector = { position: [0, .075 * unlock, 0] };
  joints.sensor = rotation(.19 * sag, 0, -.04 * settle);
  for (const [id, side] of [['L', -1], ['R', 1]]) {
    joints['scan' + id] = { position: [0, -.19 * unlock, -.013 * sag] };
    joints['head' + id] = rotation(.16 * sag, side * .18 * sag, -side * .08 * settle);
    joints['clamp' + id] = { position: [side * .065 * unlock, 0, 0] };
    joints['door' + id] = rotation(0, 0, side * (id === 'L' ? .58 : .31) * unlock);
    joints['vent' + id] = rotation(0, -side * (id === 'L' ? .47 : .27) * unlock, 0);
  }
  return { joints, root: { rotation: [0, 0, 0], position: [0, 0, 0] } };
}

function impactStroke(progress) {
  const p = clamp(progress);
  if (p < .20) return .09 * smooth(p / .20);
  if (p < .42) { const t = (p - .20) / .22; return .09 - .30 * t * t; }
  if (p < .57) return -.21 + .055 * smooth((p - .42) / .15);
  return -.155 * (1 - smooth((p - .57) / .43));
}

/** Pure pose only. The battle owns candidate selection, spawn and budget. */
export function animate(ctx = {}) {
  const action = ctx.action || 'idle', p = clamp(finite(ctx.progress));
  const travel = Math.max(0, finite(ctx.travel));
  if (['preview', 'disabled', 'stopped', 'static'].includes(action)) return neutral();
  if (action === 'wreck') return fallen(1, ctx.reducedMotion ? 0 : travel);
  if (action === 'death') return fallen(ctx.reducedMotion ? 1 : p, ctx.reducedMotion ? 0 : travel);
  if (ctx.reducedMotion) return neutral();

  const moving = (ctx.moving || action === 'move') && finite(ctx.speed) > 0;
  const hit = Math.max(clamp(finite(ctx.hit)), action === 'hit' ? 1 - smooth(p) : 0);
  const joints = {}, root = { rotation: [0, 0, 0], position: [0, 0, 0] };
  traction(joints, travel);

  // Seam compression and contact height follow wheel travel, so a paused
  // battle freezes the transmission. Axles and support beams move together.
  const seam = 1 - smooth(Math.abs(fract(travel / (RADIUS * TAU) * 10) - .5) * 2);
  let load = moving ? .008 + .004 * seam : 0;
  let scan = 0, align = 0, grip = 0, door = 0, feed = 0, vent = 0;
  let ejector = 0, reaction = 0, sensor = 0;

  if (['cast', 'ability', 'copy'].includes(action)) {
    const windup = ctx.stage === 'windup' || ctx.stage === 'prepare' || String(ctx.actionKind || '').includes('windup');
    if (windup) {
      // Seat and aim before the carriage crosses the bed. Both concave
      // heads oppose one another; the copied enemy remains a battle entity.
      align = ease(p, 0, .26);
      grip = ease(p, .04, .23);
      scan = ease(p, .28, 1);
      vent = .27 * ease(p, .05, .34);
      sensor = -.045 * align;
      load += .012 * align;
    } else {
      // p=0 exactly matches the completed warning. One finite outfeed stroke
      // follows the release event; the closed last slice returns afterwards.
      align = 1 - ease(p, .56, 1);
      scan = 1 - ease(p, .42, 1);
      grip = 1 - ease(p, .06, .26);
      door = ease(p, 0, .20) * (1 - ease(p, .66, 1));
      feed = ease(p, .14, .39) * (1 - ease(p, .61, 1));
      vent = .27 * (1 - ease(p, .61, 1));
      sensor = -.045 * align;
      load += .012 * align + .014 * ease(p, .14, .31) * (1 - ease(p, .43, .70));
    }
  } else if (action === 'attack' || action === 'breach') {
    ejector = impactStroke(p);
    reaction = ease(p, .29, .42) * (1 - ease(p, .49, .73));
    grip = .33 * ease(p, 0, .17) * (1 - ease(p, .58, 1));
    load += .021 * reaction;
    vent = .09 * ease(p, 0, .20) * (1 - ease(p, .59, 1));
    sensor = -.035 * reaction;
  }

  // The measured 170 ms hit envelope relieves the captive mechanisms. Its
  // reaction stays above the axle frame, retaining all four ground contacts.
  load += .024 * hit;
  ejector += .035 * hit;
  joints.cabinet = { position: [.010 * hit, .029 * reaction + .013 * hit, -load], rotation: [0, 0, 0] };
  joints.powerpack = rotation(.044 * hit, -.028 * reaction, 0);
  joints.sensor = rotation(sensor + .09 * hit);
  joints.feed = { position: [0, -.34 * feed, 0] };
  joints.ejector = { position: [0, ejector, 0] };
  for (const [id, side] of [['L', -1], ['R', 1]]) {
    joints['scan' + id] = { position: [0, -.55 * scan + .022 * hit, 0] };
    joints['head' + id] = { position: [-side * .028 * align, 0, 0], rotation: [.075 * hit, side * .11 * align + side * .055 * hit, -side * .08 * align] };
    joints['clamp' + id] = { position: [-side * .050 * grip, 0, 0] };
    joints['door' + id] = rotation(0, 0, side * 1.08 * door);
    joints['vent' + id] = rotation(0, -side * (vent + .08 * hit), 0);
  }
  return { joints, root };
}
