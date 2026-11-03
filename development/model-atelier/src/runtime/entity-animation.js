import * as THREE from 'three';
import { GroundContact } from './ground-contact.js';
import { MechanicalConnections } from './mechanical-connections.js';

const clamp01 = value => Math.max(0, Math.min(1, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const fraction = value => ((value % 1) + 1) % 1;

function clipMap(animations) {
  if (animations instanceof Map) return new Map(animations);
  return new Map((animations || []).map(clip => [clip.name, clip]));
}

function loopingTime(duration, cycles) {
  return duration > 0 ? fraction(cycles) * duration : 0;
}

export function resolveEntityAnimation(pose, animations, { reducedMotion = false, stride = 1.5 } = {}) {
  const clips = clipMap(animations);
  const action = pose?.action || 'idle';
  const progress = clamp01(finite(pose?.progress));
  const clock = Math.max(0, finite(pose?.clock)) / 1000;
  let channel = 'idle';
  let candidates = ['idle'];
  let mode = 'clock';
  let once = false;
  let finalPose = false;

  if (action === 'move' || action === 'hover') {
    channel = action;
    candidates = ['move', 'idle'];
    mode = action === 'move' && Number.isFinite(pose?.travel) ? 'travel' : 'progress';
  } else if (action === 'attack') {
    channel = 'attack';
    candidates = ['attack'];
    mode = 'progress';
    once = true;
  } else if (action === 'cast' && pose?.stage === 'windup') {
    channel = 'windup';
    candidates = ['windup', 'ability'];
    mode = 'progress';
    once = true;
    finalPose = progress >= 1;
  } else if (action === 'cast' || action === 'release') {
    channel = 'release';
    candidates = ['release', 'ability'];
    mode = 'progress';
    once = true;
    finalPose = progress >= 1;
  } else if (['disabled', 'wreck', 'death', 'shutdown'].includes(action)) {
    channel = 'shutdown';
    candidates = ['shutdown'];
    mode = action === 'death' && Number.isFinite(pose?.shutdownProgress) ? 'shutdown' : 'final';
    once = true;
    finalPose = true;
  } else if (action === 'ability') {
    channel = 'ability';
    candidates = ['ability', 'release'];
    mode = 'progress';
    once = true;
    finalPose = progress >= 1;
  }

  const name = candidates.find(candidate => clips.has(candidate));
  if (!name) throw new Error(`缺少动画 ${candidates.join(' / ')} (${action})`);
  const clip = clips.get(name);
  let time = 0;
  if (mode === 'clock') time = reducedMotion ? 0 : loopingTime(clip.duration, clock / Math.max(clip.duration, 0.000001));
  else if (mode === 'travel') time = reducedMotion ? 0 : loopingTime(clip.duration, finite(pose.travel) / Math.max(0.000001, stride));
  else if (mode === 'progress') time = reducedMotion && !once ? 0 : loopingTime(clip.duration, progress);
  else if (mode === 'final') time = clip.duration;
  else if (mode === 'shutdown') {
    time = clamp01(pose.shutdownProgress) * clip.duration;
    finalPose = time >= clip.duration;
  }
  if (once && mode === 'progress') time = progress * clip.duration;

  return {
    action, channel, clip, name, time, once,
    loop: once ? THREE.LoopOnce : THREE.LoopRepeat,
    hold: finalPose,
    legacyFallback: name !== channel && !((channel === 'idle' || channel === 'ability') && name === channel),
  };
}

export function createEntityMixer(root, animations, options = {}) {
  if (!root?.isObject3D) throw new TypeError('createEntityMixer 需要 Object3D 根节点');
  const clips = clipMap(animations);
  const mixer = new THREE.AnimationMixer(root);
  const connections = new MechanicalConnections(root);
  // The renderer updates the complete placed hierarchy after sampling.
  // Connection solving and exact contact measurement update their inputs.
  const ground = options.grounded === false ? null : new GroundContact(root, { deferMatrixUpdates: true });
  const upperClips = new Map();
  const actions = new Map();
  let current = null;
  let locomotion = null;
  let lastClock = null;
  let lastSample = null;
  let disposed = false;

  function actionFor(clip, prefix = '') {
    const key = `${prefix}${clip.name}`;
    if (!actions.has(key)) actions.set(key, mixer.clipAction(clip));
    return actions.get(key);
  }

  function upperBody(clip) {
    if (upperClips.has(clip)) return upperClips.get(clip);
    const tracks = clip.tracks.filter(track => {
      const separator = track.name.lastIndexOf('.');
      return !/foot|ankle|leg|knee|hip|wheel|tyre|tire|tread|track|roller|shoe|sole|hoof|skid|pad|segment/i.test(track.name.slice(0, separator));
    });
    const filtered = tracks.length && tracks.length < clip.tracks.length
      ? new THREE.AnimationClip(clip.name, clip.duration, tracks)
      : clip;
    upperClips.set(clip, filtered);
    return filtered;
  }

  function activateAction(action, intent, weight) {
    action.reset();
    action.setLoop(intent.loop, intent.once ? 1 : Infinity);
    action.clampWhenFinished = intent.once;
    action.enabled = weight > 0;
    action.paused = false;
    action.setEffectiveWeight(weight);
    action.setEffectiveTimeScale(1);
    action.play();
  }

  function activate(intent, moving) {
    const locomotionKey = moving?.clip.uuid || '';
    if (current?.channel === intent.channel && current.locomotionKey === locomotionKey) return;
    mixer.stopAllAction();
    current = { action: actionFor(intent.clip), channel: intent.channel, name: intent.name, locomotionKey };
    activateAction(current.action, intent, moving ? 0 : 1);
    if (moving) {
      locomotion = {
        action: actionFor(moving.clip, 'locomotion:'),
        upper: actionFor(upperBody(intent.clip), 'upper:'),
      };
      activateAction(locomotion.action, moving, 1);
      activateAction(locomotion.upper, intent, 1);
    } else locomotion = null;
  }

  function sample(pose, sampleOptions = {}) {
    if (disposed) throw new Error('AnimationMixer 已释放');
    const settings = { ...options, ...sampleOptions };
    const intent = resolveEntityAnimation(pose, clips, settings);
    const moving = pose?.moving && !settings.reducedMotion && ['windup', 'release'].includes(intent.channel)
      ? resolveEntityAnimation({ ...pose, action: pose.air ? 'hover' : 'move' }, clips, settings)
      : null;
    const clock = Math.max(0, finite(pose?.clock));
    const rewind = lastClock !== null && clock < lastClock;
    if (rewind) {
      mixer.stopAllAction();
      current = null;
      locomotion = null;
      lastSample = null;
    }
    activate(intent, moving);
    const signature = `${intent.channel}:${intent.name}:${intent.time}:${intent.hold}:${moving?.clip.name || ''}:${moving?.time ?? ''}`;
    if (signature !== lastSample) {
      ground?.reset();
      current.action.time = intent.time;
      if (locomotion) {
        locomotion.action.time = moving.time;
        locomotion.upper.time = intent.time;
      }
      mixer.update(0);
      connections.apply();
      if (!pose?.air && !['death', 'hover'].includes(pose?.action)) ground?.apply(intent.clip, intent.time, !!moving);
      lastSample = signature;
    }
    lastClock = clock;
    return {
      clip: intent.name,
      requestedClip: intent.channel,
      time: intent.time,
      duration: intent.clip.duration,
      hold: intent.hold,
      rewind,
      legacyFallback: intent.legacyFallback,
      locomotion: locomotion ? { clip: locomotion.action.getClip().name, time: locomotion.action.time } : null,
    };
  }

  function reset() {
    mixer.stopAllAction();
    current = null;
    locomotion = null;
    lastClock = null;
    lastSample = null;
    ground?.reset();
  }

  function dispose() {
    if (disposed) return;
    reset();
    for (const clip of clips.values()) mixer.uncacheAction(clip, root);
    for (const clip of upperClips.values()) mixer.uncacheAction(clip, root);
    mixer.uncacheRoot(root);
    upperClips.clear();
    actions.clear();
    ground?.dispose();
    connections.dispose();
    disposed = true;
  }

  return {
    mixer,
    actions,
    sample,
    reset,
    dispose,
    get current() { return current; },
    get disposed() { return disposed; },
  };
}
