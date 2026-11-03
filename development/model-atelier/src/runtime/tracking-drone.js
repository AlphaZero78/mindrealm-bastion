export const TRACKING_DRONE_ID = 'tracking_drone';
export const TRACKING_DRONE_SOURCE = 'models/tracking_drone/base.glb';

export const TRACKING_DRONE_DEFINITION = Object.freeze({
  kind: 'towers',
  role: 'projectile',
  locomotion: 'hover',
  forward: '-z',
  stride: 0.8,
  variants: Object.freeze({
    base: Object.freeze({ source: TRACKING_DRONE_SOURCE }),
  }),
});

export function createTrackingDronePose(drone, clock = 0) {
  const time = Math.max(0, Number.isFinite(clock) ? clock : 0) / 1000;
  return {
    key: `drone:${drone?.id ?? 'unknown'}`,
    variant: 'base',
    action: 'hover',
    clock: time * 1000,
    progress: ((time * 0.9) % 1 + 1) % 1,
    travel: Number.isFinite(drone?.motion?.distance) ? drone.motion.distance : undefined,
    facing: Number.isFinite(drone?.facing) ? drone.facing : 0,
    hit: Number.isFinite(drone?.hit) ? drone.hit : 0,
    spawn: Number.isFinite(drone?.spawn) ? drone.spawn : 0,
    air: true,
  };
}
