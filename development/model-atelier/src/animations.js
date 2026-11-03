import * as THREE from '../vendor/three/build/three.module.js';

const TAU = Math.PI * 2;
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const ease = (value, start = 0, end = 1) => smooth((value - start) / (end - start));
const pulse = (value, start, peak, end) => value < peak ? ease(value, start, peak) : 1 - ease(value, peak, end);
const stroke = (value, start, end) => value < start ? 0 : value < end ? ease(value, start, end) : 1 - ease(value, end, Math.min(1, end + 0.22));

export { TAU, clamp, ease, pulse, smooth };
export function createRigClip(root, joints, name, duration, pose, { fps = 30 } = {}) {
  return animationClip(root, joints, name, duration, pose, fps);
}

function animationClip(root, joints, name, duration, pose, fps = 30) {
  if (!Number.isFinite(fps) || fps < 1 || fps > 120) throw new Error('Animation sampling must be between 1 and 120 frames per second');
  const nodes = Object.entries(joints);
  const rest = nodes.map(([, node]) => ({
    position: node.position.clone(), rotation: node.rotation.clone(), quaternion: node.quaternion.clone(), scale: node.scale.clone(),
  }));
  const samples = nodes.map(() => ({ position: [], quaternion: [], scale: [] }));
  const times = [];
  const frames = Math.ceil(duration * fps);
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const delta = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const previous = nodes.map(() => null);
  for (let frame = 0; frame <= frames; frame++) {
    const time = duration * frame / frames;
    const states = new Map();
    const set = (key, value = {}) => states.set(key, { relative: true, ...value });
    const raw = (key, value = {}) => states.set(key, { relative: false, ...value });
    pose(time / duration, time, { set, raw });
    nodes.forEach(([key, node], index) => {
      const base = rest[index], state = states.get(key) || {};
      const p = state.p || [0, 0, 0], r = state.r || [0, 0, 0], s = state.s || [1, 1, 1];
      if (state.relative) {
        position.copy(base.position).add(new THREE.Vector3(...p));
        quaternion.copy(base.quaternion).multiply(delta.setFromEuler(euler.set(...r)));
        scale.copy(base.scale).multiply(new THREE.Vector3(...s));
      } else {
        position.fromArray(state.p || base.position.toArray());
        quaternion.setFromEuler(euler.fromArray(state.r || base.rotation.toArray()));
        scale.fromArray(state.s || base.scale.toArray());
      }
      if (previous[index] && previous[index].dot(quaternion) < 0) quaternion.set(-quaternion.x, -quaternion.y, -quaternion.z, -quaternion.w);
      previous[index] = quaternion.clone();
      samples[index].position.push(...position.toArray());
      samples[index].quaternion.push(...quaternion.toArray());
      samples[index].scale.push(...scale.toArray());
    });
    times.push(time);
  }
  const tracks = [];
  nodes.forEach(([, node], index) => {
    tracks.push(new THREE.VectorKeyframeTrack(`${node.name}.position`, times, samples[index].position));
    tracks.push(new THREE.QuaternionKeyframeTrack(`${node.name}.quaternion`, times, samples[index].quaternion));
    tracks.push(new THREE.VectorKeyframeTrack(`${node.name}.scale`, times, samples[index].scale));
  });
  return new THREE.AnimationClip(name, duration, tracks);
}

function memoryPoses(joints) {
  const bodyBase = joints.body.position.clone();
  const hips = ['L', 'R'].map(id => ({ id, side: id === 'L' ? -1 : 1, offset: id === 'L' ? 0 : 0.5, rest: joints[`hip${id}`].position.clone() }));
  const inverse = new THREE.Quaternion();
  const bodyRotation = new THREE.Quaternion();
  const target = new THREE.Vector3();
  function legs(api, phase, bodyY, pitch, roll, walking, speed = 1) {
    bodyRotation.setFromEuler(new THREE.Euler(pitch, 0, roll));
    inverse.copy(bodyRotation).invert();
    for (const leg of hips) {
      const p = ((phase * speed + leg.offset) % 1 + 1) % 1;
      let footY = 0.095, footZ = leg.side * 0.055;
      if (walking) {
        if (p < 0.62) footZ += -0.34 + 0.68 * p / 0.62;
        else {
          const recovery = (p - 0.62) / 0.38;
          footZ += 0.34 - 0.68 * smooth(recovery);
          footY += 0.22 * Math.sin(recovery * Math.PI);
        }
      }
      target.set(leg.rest.x, footY, footZ).sub(new THREE.Vector3(0, bodyY, 0)).applyQuaternion(inverse).sub(leg.rest);
      const dy = target.y, dz = target.z;
      const upper = 0.62, lower = 0.58;
      const distance = Math.max(0.08, Math.min(upper + lower - 0.005, Math.hypot(dy, dz)));
      const cosJoint = Math.max(-1, Math.min(1, (upper * upper + lower * lower - distance * distance) / (2 * upper * lower)));
      const knee = -(Math.PI - Math.acos(cosJoint));
      const hip = Math.atan2(-dz, -dy) - Math.atan2(lower * Math.sin(knee), upper + lower * Math.cos(knee));
      api.raw(`hip${leg.id}`, { r: [hip, 0, 0] });
      api.raw(`knee${leg.id}`, { r: [knee, 0, 0] });
      api.raw(`ankle${leg.id}`, { r: [-pitch - hip - knee, 0, -roll] });
    }
  }
  return {
    idle: (u, t, api) => {
      const phase = u * 2, bob = Math.cos(phase * TAU * 2) * 0.027;
      const pitch = -0.065, roll = Math.sin(phase * TAU) * 0.025;
      api.set('body', { p: [0, bob, 0], r: [pitch, 0, roll] });
      api.set('counterweight', { r: [Math.sin(phase * TAU) * 0.52, 0, 0] });
      api.set('cassette', { r: [Math.sin(phase * TAU * 2) * 0.025, 0, 0] });
      api.set('core', { r: [0, phase * TAU, 0] });
      api.set('lid', { r: [0.055 + Math.sin(t * 3) * 0.025, 0, 0] });
      legs(api, phase, bodyBase.y + bob, pitch, roll, true);
    },
    attack: (u, t, api) => {
      const load = pulse(u, 0, 0.27, 0.65), thrust = stroke(u, 0.27, 0.46), impact = pulse(u, 0.36, 0.48, 0.72);
      const pitch = -0.065 - impact * 0.12, bob = -load * 0.07;
      api.set('body', { p: [0, bob, -impact * 0.05], r: [pitch, 0, 0] });
      api.set('punch', { p: [0, 0, -thrust * 0.48] });
      api.set('counterweight', { r: [load * 0.38 - impact * 0.54, 0, 0] });
      api.set('core', { s: [1 + load * 0.12, 1 + load * 0.12, 1 + load * 0.12] });
      api.set('lid', { r: [load * 0.20, 0, 0] });
      api.set('ventL', { r: [0, 0, -impact * 0.34] });
      api.set('ventR', { r: [0, 0, impact * 0.34] });
      legs(api, 0, bodyBase.y + bob, pitch, 0, false);
    },
    ability: (u, t, api) => {
      const engage = ease(u, 0, 0.13) * (1 - ease(u, 0.86, 1));
      const phase = u * 4, bob = -engage * 0.17 + Math.cos(phase * TAU * 2) * 0.032;
      const pitch = -0.065 - engage * 0.20, roll = Math.sin(phase * TAU) * 0.035;
      api.set('body', { p: [0, bob, 0], r: [pitch, 0, roll] });
      api.set('counterweight', { r: [Math.sin(phase * TAU) * 0.72, 0, 0] });
      api.set('cassette', { r: [-engage * 0.11, 0, 0] });
      api.set('lid', { r: [engage * 0.50, 0, 0] });
      api.set('core', { r: [0, phase * TAU, 0], s: [1 + engage * 0.14, 1 + engage * 0.14, 1 + engage * 0.14] });
      api.set('ventL', { r: [0, 0, -engage * 0.90] });
      api.set('ventR', { r: [0, 0, engage * 0.90] });
      api.set('punch', { p: [0, 0, engage * 0.09] });
      legs(api, phase, bodyBase.y + bob, pitch, roll, true);
    },
    shutdown: (u, t, api) => {
      const fall = ease(u, 0.04, 0.88), unload = ease(u, 0.25, 0.92);
      const pitch = -0.065 - fall * 0.57, bob = -fall * 0.74;
      api.set('body', { p: [0, bob, fall * 0.08], r: [pitch, 0, fall * 0.12] });
      api.set('counterweight', { r: [fall * 1.05, 0, 0] });
      api.set('cassette', { r: [unload * 0.18, 0, 0] });
      api.set('lid', { r: [unload * 1.30, 0, 0] });
      api.set('core', { p: [0, unload * 0.39, unload * 0.06], r: [unload * 0.55, unload * 1.20, 0], s: [1 - unload * 0.40, 1 - unload * 0.40, 1 - unload * 0.40] });
      api.set('punch', { p: [0, -unload * 0.08, unload * 0.08], r: [-unload * 0.35, 0, 0] });
      api.set('ventL', { r: [0, 0, -unload * 0.70] });
      api.set('ventR', { r: [0, 0, unload * 0.70] });
      legs(api, 0, bodyBase.y + bob, pitch, fall * 0.12, false);
    },
  };
}

function repairPoses() {
  return {
    idle: (u, t, api) => {
      const wave = Math.sin(u * TAU);
      api.set('flight', { p: [0, wave * 0.055, 0], r: [Math.sin(u * TAU * 2) * 0.018, 0, wave * 0.030] });
      api.set('wingL', { r: [wave * 0.035, 0, -wave * 0.050] });
      api.set('wingR', { r: [wave * 0.035, 0, wave * 0.050] });
      api.set('tipL', { r: [wave * 0.12, 0, 0] });
      api.set('tipR', { r: [-wave * 0.12, 0, 0] });
      api.set('halo', { r: [0, u * TAU, 0] });
      api.set('distributor', { r: [0, -u * TAU, 0] });
      api.set('heart', { p: [0, Math.sin(u * TAU * 2) * 0.025, 0] });
      api.set('stitchL', { r: [wave * 0.07, 0, wave * 0.06] });
      api.set('stitchR', { r: [-wave * 0.07, 0, -wave * 0.06] });
      for (let i = 0; i < 3; i++) api.set(`magnet${i}`, { r: [Math.sin(u * TAU + i * TAU / 3) * 0.08, 0, 0] });
    },
    attack: (u, t, api) => {
      const first = pulse(u, 0, 0.27, 0.57), second = pulse(u, 0.34, 0.62, 0.92);
      api.set('flight', { r: [-0.10 * Math.max(first, second), 0, 0] });
      api.set('stitchL', { r: [-first * 0.52, -first * 0.28, first * 0.17] });
      api.set('stitchR', { r: [-second * 0.52, second * 0.28, -second * 0.17] });
      api.set('heartL', { p: [-first * 0.045, 0, 0] });
      api.set('heartR', { p: [second * 0.045, 0, 0] });
      api.set('halo', { r: [0, u * TAU * 0.5, first * 0.25] });
      api.set('distributor', { r: [0, -u * TAU, 0] });
      api.raw('pulse', { s: [0.001 + second * 0.62, 0.001 + second * 0.62, 0.001 + second * 0.62] });
    },
    ability: (u, t, api) => {
      const open = ease(u, 0, 0.18) * (1 - ease(u, 0.83, 1)), close = pulse(u, 0.12, 0.47, 0.78);
      const sew = Math.sin(u * TAU * 5);
      api.set('flight', { p: [0, Math.sin(u * TAU) * 0.035, 0], r: [0, 0, Math.sin(u * TAU) * 0.025] });
      api.set('heartL', { p: [close * 0.083, 0, 0], r: [0, 0, close * 0.12] });
      api.set('heartR', { p: [-close * 0.083, 0, 0], r: [0, 0, -close * 0.12] });
      api.set('heart', { s: [1 + close * 0.13, 1 + close * 0.13, 1 + close * 0.13] });
      api.set('halo', { r: [0, u * TAU * 2, 0], s: [1 + open * 0.15, 1 + open * 0.15, 1 + open * 0.15] });
      api.set('wingL', { r: [-open * 0.14, open * 0.15, -open * 0.20] });
      api.set('wingR', { r: [-open * 0.14, -open * 0.15, open * 0.20] });
      api.set('stitchL', { r: [-open * 0.42 + sew * 0.10 * open, -open * 0.18, open * 0.26] });
      api.set('stitchR', { r: [-open * 0.42 - sew * 0.10 * open, open * 0.18, -open * 0.26] });
      api.set('distributor', { r: [0, -u * TAU * 3, 0] });
      for (let i = 0; i < 3; i++) {
        const q = (u * 3 + i / 3) % 1, size = open * (0.18 + q * 1.30) + 0.001;
        if (i === 0) api.raw('pulse', { s: [size, size, size] });
      }
    },
    shutdown: (u, t, api) => {
      const fall = ease(u, 0.05, 0.92), fold = ease(u, 0.18, 0.90);
      api.set('flight', { p: [0, -fall * 1.03, fall * 0.12], r: [fall * 0.22, fall * 0.14, fold * 0.48] });
      api.set('wingL', { r: [fold * 0.35, fold * 0.32, -fold * 0.64] });
      api.set('wingR', { r: [fold * 0.18, -fold * 0.25, fold * 0.32] });
      api.set('tipL', { r: [fold * 0.70, 0, 0] });
      api.set('tipR', { r: [fold * 0.60, 0, 0] });
      api.set('heartL', { p: [-fall * 0.15, -fall * 0.18, 0], r: [0, 0, -fall * 0.38] });
      api.set('heartR', { p: [fall * 0.12, -fall * 0.22, 0], r: [0, 0, fall * 0.30] });
      api.set('halo', { r: [fall * 0.58, fall * 0.45, fold * 0.24] });
      api.set('stitchL', { r: [fold * 0.65, 0, -fold * 0.35] });
      api.set('stitchR', { r: [fold * 0.45, 0, fold * 0.35] });
      api.set('distributor', { r: [fold * 0.5, fall * 0.8, 0] });
      for (let i = 0; i < 3; i++) api.set(`magnet${i}`, { r: [fall * (0.15 + i * 0.12), 0, fold * 0.15 * (i - 1)] });
    },
  };
}

function nullPoses() {
  return {
    idle: (u, t, api) => {
      const wave = Math.sin(u * TAU);
      api.set('flight', { p: [0, wave * 0.05, 0], r: [0.018 * Math.sin(u * TAU * 2), 0, wave * 0.022] });
      api.set('prism', { r: [0, u * TAU, 0] });
      api.set('forkL', { r: [wave * 0.035, -wave * 0.045, 0] });
      api.set('forkR', { r: [-wave * 0.035, wave * 0.045, 0] });
      api.set('tineLU', { r: [0, 0, wave * 0.04] });
      api.set('tineRU', { r: [0, 0, -wave * 0.04] });
      api.set('ring0', { r: [0, u * TAU, 0] });
      api.set('ring1', { r: [0, -u * TAU, 0] });
      api.set('ring2', { r: [0, u * TAU * 0.5, 0] });
      api.set('keel', { r: [0, wave * 0.08, 0] });
    },
    attack: (u, t, api) => {
      const load = pulse(u, 0, 0.24, 0.67), thrust = stroke(u, 0.25, 0.46);
      api.set('flight', { p: [0, -load * 0.04, -thrust * 0.07], r: [-load * 0.16, 0, 0] });
      api.set('probe', { p: [0, 0, -thrust * 0.48] });
      api.set('prism', { r: [load * 0.24, u * TAU * 0.4, 0] });
      api.set('forkL', { r: [load * 0.13, load * 0.13, 0] });
      api.set('forkR', { r: [load * 0.13, -load * 0.13, 0] });
      api.set('ring0', { r: [0, u * TAU, load * 0.15] });
      api.set('ring1', { r: [0, -u * TAU, -load * 0.15] });
    },
    ability: (u, t, api) => {
      const open = ease(u, 0, 0.18) * (1 - ease(u, 0.84, 1));
      api.set('flight', { p: [0, Math.sin(u * TAU) * 0.035, 0] });
      api.set('prism', { r: [0, u * TAU * 2, 0], s: [1 - open * 0.10, 1 + open * 0.25, 1 - open * 0.10] });
      api.set('forkL', { r: [-open * 0.16, -open * 0.38, -open * 0.16] });
      api.set('forkR', { r: [-open * 0.16, open * 0.38, open * 0.16] });
      api.set('tineLU', { r: [0, 0, -open * 0.20] });
      api.set('tineLL', { r: [0, 0, open * 0.20] });
      api.set('tineRU', { r: [0, 0, open * 0.20] });
      api.set('tineRL', { r: [0, 0, -open * 0.20] });
      for (let i = 0; i < 3; i++) {
        const spread = 1 + open * (0.12 + i * 0.08);
        api.set(`ring${i}`, { p: [0, open * (i - 1) * 0.16, 0], r: [open * (i - 1) * 0.12, u * TAU * (i % 2 ? -1 : 1), 0], s: [spread, 1, spread] });
      }
      const q = (u * 3) % 1, size = open * (0.20 + q * 1.15) + 0.001;
      api.raw('field', { s: [size, size, size] });
      api.set('keel', { r: [open * 0.24, 0, 0] });
    },
    shutdown: (u, t, api) => {
      const fall = ease(u, 0.02, 0.91), fold = ease(u, 0.15, 0.95);
      api.set('flight', { p: [0, -fall * 1.08, fall * 0.11], r: [fall * 0.25, -fall * 0.17, -fall * 0.40] });
      api.set('prism', { p: [0, -fall * 0.17, 0], r: [fall * 0.50, fall * 0.80, fold * 0.32], s: [1 - fold * 0.30, 1 - fold * 0.30, 1 - fold * 0.30] });
      api.set('forkL', { r: [fold * 0.34, -fold * 0.60, -fold * 0.55] });
      api.set('forkR', { r: [fold * 0.20, fold * 0.62, fold * 0.46] });
      for (let i = 0; i < 3; i++) api.set(`ring${i}`, { p: [0, -fold * (0.18 + i * 0.08), 0], r: [fold * (0.2 + i * 0.25), fold * (i - 1) * 0.8, fold * 0.12], s: [1 - fold * 0.15, 1, 1 - fold * 0.15] });
      api.set('probe', { p: [0, 0, fold * 0.12] });
      api.set('keel', { r: [fold * 0.68, 0, 0] });
    },
  };
}

function focusPoses() {
  return {
    idle: (u, t, api) => {
      const wave = Math.sin(u * TAU);
      api.set('baseRing', { r: [0, u * TAU, 0] });
      api.set('yaw', { r: [0, wave * 0.14, 0] });
      api.set('pitch', { r: [0.035 + wave * 0.045, 0, 0] });
      api.set('outer', { r: [0, 0, wave * 0.18] });
      api.set('inner', { r: [0, wave * 0.19, -wave * 0.10] });
      api.set('focus', { r: [0, 0, u * TAU], p: [0, wave * 0.015, 0] });
      api.set('coils', { r: [0, 0, -u * TAU * 0.25] });
    },
    attack: (u, t, api) => {
      const charge = pulse(u, 0, 0.48, 0.72), fire = pulse(u, 0.48, 0.54, 0.70), recover = ease(u, 0.53, 0.96);
      api.set('yaw', { r: [0, Math.sin(u * Math.PI) * 0.07, 0] });
      api.set('pitch', { r: [0.08 - fire * 0.06, 0, 0] });
      api.set('outer', { r: [0, 0, charge * 0.44 - recover * 0.44] });
      api.set('inner', { r: [0, -charge * 0.24 + recover * 0.24, 0] });
      api.set('gun', { p: [0, 0, fire * 0.17 * (1 - recover)] });
      api.set('focus', { p: [0, 0, -charge * 0.19], r: [0, 0, u * TAU * 2], s: [1 - charge * 0.28, 1 - charge * 0.28, 1 + charge * 0.35] });
      api.raw('charge', { s: [charge * 1.15 + 0.001, charge * 1.15 + 0.001, charge * 1.15 + 0.001] });
      const beam = fire * (1 - ease(u, 0.55, 0.69)) + 0.001;
      api.raw('beam', { s: [beam, beam, beam] });
      api.set('coils', { r: [0, 0, charge * 0.65] });
    },
    ability: (u, t, api) => {
      const charge = ease(u, 0, 0.43) * (1 - ease(u, 0.83, 1));
      const fire = pulse(u, 0.45, 0.55, 0.77);
      api.set('pitch', { r: [0.13 * charge - fire * 0.08, 0, 0] });
      api.set('yaw', { r: [0, Math.sin(u * Math.PI) * -0.16, 0] });
      api.set('outer', { r: [0, 0, u * TAU] });
      api.set('inner', { r: [0, -charge * 0.24, -u * TAU] });
      api.set('gun', { p: [0, 0, fire * 0.22] });
      api.set('focus', { p: [0, 0, -charge * 0.28], r: [0, 0, u * TAU * 3], s: [1 - charge * 0.32, 1 - charge * 0.32, 1 + charge * 0.70] });
      api.set('coils', { r: [0, 0, u * TAU * 2], s: [1 + charge * 0.12, 1 + charge * 0.12, 1] });
      api.raw('charge', { s: [charge * 1.35 + 0.001, charge * 1.35 + 0.001, charge * 1.35 + 0.001] });
      const beam = fire * 1.25 + 0.001;
      api.raw('beam', { s: [beam, beam, beam] });
    },
    shutdown: (u, t, api) => {
      const close = ease(u, 0.04, 0.90);
      api.set('yaw', { r: [0, close * 0.35, 0] });
      api.set('pitch', { r: [-close * 0.48, 0, 0] });
      api.set('outer', { r: [0, 0, close * 0.72] });
      api.set('inner', { r: [0, close * 0.60, 0] });
      api.set('gun', { p: [0, -close * 0.07, close * 0.08] });
      api.set('focus', { p: [0, 0, close * 0.72], s: [1 - close * 0.30, 1 - close * 0.30, 1 - close * 0.30] });
      api.set('coils', { r: [0, 0, close * 0.30] });
    },
  };
}

function mortarPoses() {
  return {
    idle: (u, t, api) => {
      const wave = Math.sin(u * TAU);
      api.set('yaw', { r: [0, wave * 0.13, 0] });
      api.set('cradle', { r: [wave * 0.055, 0, 0] });
      api.set('rim', { r: [0, u * TAU * 0.25, 0] });
      api.set('throwRing', { r: [wave * 0.10, -u * TAU * 0.50, 0] });
      api.set('orb', { p: [0, wave * 0.055, 0], r: [0, u * TAU, wave * 0.15] });
      for (let i = 0; i < 3; i++) api.set(`petal${i}`, { r: [0.07 + wave * 0.055, 0, 0] });
    },
    attack: (u, t, api) => {
      const lift = pulse(u, 0, 0.32, 0.84), launch = pulse(u, 0.30, 0.43, 0.70), recover = ease(u, 0.44, 0.94);
      api.set('yaw', { r: [0, Math.sin(u * Math.PI) * 0.16, 0] });
      api.set('cradle', { r: [-lift * 0.33 + launch * 0.75 - recover * 0.15, 0, 0] });
      api.set('throwRing', { r: [launch * 1.45, -u * TAU * 0.7, 0] });
      api.set('orb', { p: [0, lift * 0.15 - launch * 0.13, 0], s: [1 - launch * 0.98, 1 - launch * 0.98, 1 - launch * 0.98] });
      const q = clamp((u - 0.31) / 0.49), visible = u > 0.31 && u < 0.80 ? Math.min(1, q * 10, (1 - q) * 10) : 0.001;
      api.raw('projectile', { p: [0, 1.30 + q * 2.1 - q * q * 1.30, -0.10 - q * 1.90], r: [q * TAU, q * TAU * 0.5, 0], s: [visible, visible, visible] });
      for (let i = 0; i < 3; i++) api.set(`petal${i}`, { r: [lift * 0.28 + launch * 0.35, 0, 0] });
    },
    ability: (u, t, api) => {
      const open = ease(u, 0, 0.20) * (1 - ease(u, 0.83, 1));
      api.set('cradle', { r: [-open * 0.24, 0, 0] });
      api.set('yaw', { r: [0, Math.sin(u * TAU) * 0.16, 0] });
      api.set('throwRing', { r: [open * 0.44, u * TAU * 2, 0] });
      api.set('rim', { r: [0, -u * TAU, 0] });
      api.set('orb', { p: [0, open * 0.24, 0], r: [0, u * TAU * 2, 0], s: [1 + open * 0.35, 1 + open * 0.35, 1 + open * 0.35] });
      for (let i = 0; i < 3; i++) api.set(`petal${i}`, { r: [open * 0.72, 0, Math.sin(u * TAU * 3 + i * TAU / 3) * open * 0.10] });
      const q = (u * 3) % 1, size = open * (0.20 + q * 1.45) + 0.001;
      api.raw('pulse', { s: [size, size, size] });
    },
    shutdown: (u, t, api) => {
      const close = ease(u, 0.03, 0.92);
      api.set('yaw', { r: [0, close * 0.34, 0] });
      api.set('cradle', { r: [-close * 0.51, 0, 0] });
      api.set('throwRing', { r: [-close * 0.40, close * 0.30, 0] });
      api.set('orb', { p: [0, -close * 0.26, 0], s: [1 - close * 0.45, 1 - close * 0.45, 1 - close * 0.45] });
      for (let i = 0; i < 3; i++) api.set(`petal${i}`, { r: [-close * 0.31, 0, 0] });
    },
  };
}

function beaconPoses() {
  return {
    idle: (u, t, api) => {
      const breath = Math.sin(u * TAU);
      api.set('core', { p: [0, breath * 0.045, 0], r: [0, u * TAU * 0.50, 0], s: [1 + breath * 0.035, 1 + breath * 0.055, 1 + breath * 0.035] });
      api.set('spark', { p: [breath * 0.035, breath * 0.04, 0], r: [0, -u * TAU, 0] });
      api.set('halo', { r: [0, -u * TAU * 0.5, 0] });
      api.set('crown', { r: [0, u * TAU, 0] });
      for (let i = 0; i < 3; i++) api.set(`petal${i}`, { r: [0.06 + breath * 0.05, 0, 0] });
    },
    attack: (u, t, api) => {
      const release = pulse(u, 0, 0.38, 0.86), q = clamp((u - 0.23) / 0.67), size = u < 0.23 ? 0.001 : (0.15 + q * 1.45) * (1 - ease(u, 0.78, 1)) + 0.001;
      api.set('core', { p: [0, release * 0.15, 0], r: [0, u * TAU, 0], s: [1 + release * 0.18, 1 + release * 0.18, 1 + release * 0.18] });
      api.set('halo', { r: [0, u * TAU * 2, release * 0.13] });
      api.set('petalSystem', { r: [0, release * 0.20, 0] });
      for (let i = 0; i < 3; i++) api.set(`petal${i}`, { r: [release * 0.48, 0, 0] });
      api.raw('pulse', { s: [size, size, size] });
    },
    ability: (u, t, api) => {
      const open = ease(u, 0.02, 0.36) * (1 - ease(u, 0.78, 1));
      api.set('core', { p: [0, open * 0.28, 0], r: [0, u * TAU * 1.5, 0], s: [1 + open * 0.16, 1 + open * 0.25, 1 + open * 0.16] });
      api.set('spark', { p: [Math.sin(u * TAU * 2) * open * 0.08, open * 0.12, 0] });
      api.set('petalSystem', { r: [0, open * 0.60, 0] });
      for (let i = 0; i < 3; i++) api.set(`petal${i}`, { r: [open * 0.77, 0, 0] });
      api.set('halo', { r: [0, -u * TAU * 2, 0], s: [1 + open * 0.16, 1, 1 + open * 0.16] });
      api.set('crown', { p: [0, open * 0.12, 0], r: [0, u * TAU * 2, 0] });
      const size = open + 0.001;
      api.raw('field', { s: [size, size, size] });
      const q = (u * 2) % 1, wave = open * (0.2 + q * 1.2) + 0.001;
      api.raw('pulse', { s: [wave, wave, wave] });
    },
    shutdown: (u, t, api) => {
      const close = ease(u, 0.02, 0.91);
      api.set('core', { p: [0, -close * 0.43, 0], r: [0, close * 0.35, close * 0.14], s: [1 - close * 0.37, 1 - close * 0.32, 1 - close * 0.37] });
      api.set('spark', { p: [0, -close * 0.27, 0], s: [1 - close * 0.55, 1 - close * 0.55, 1 - close * 0.55] });
      api.set('halo', { r: [close * 0.26, close * 0.45, 0], s: [1 - close * 0.22, 1, 1 - close * 0.22] });
      api.set('crown', { p: [0, -close * 0.19, 0] });
      for (let i = 0; i < 3; i++) api.set(`petal${i}`, { r: [-close * 0.23, 0, 0] });
    },
  };
}

export function createClips(id, root, joints) {
  const poses = id === 'memory_runner' ? memoryPoses(joints)
    : id === 'repair_skiff' ? repairPoses(joints)
    : id === 'null_wing' ? nullPoses(joints)
    : id === 'focus_rail' ? focusPoses(joints)
    : id === 'arc_mortar' ? mortarPoses(joints)
    : beaconPoses(joints);
  const durations = id === 'memory_runner' ? { idle: 1.2, attack: 1.4, ability: 1.8, shutdown: 2.0 }
    : ['repair_skiff', 'null_wing'].includes(id) ? { idle: 3.0, attack: 1.5, ability: 3.6, shutdown: 2.2 }
    : id === 'focus_rail' ? { idle: 4.0, attack: 1.75, ability: 3.4, shutdown: 2.0 }
    : id === 'arc_mortar' ? { idle: 4.0, attack: 2.2, ability: 3.6, shutdown: 2.0 }
    : { idle: 4.0, attack: 2.6, ability: 4.2, shutdown: 2.4 };
  return Object.entries(poses).map(([name, pose]) => animationClip(root, joints, name, durations[name], pose));
}

export function createGameClips(id, root, joints, definition = null) {
  if (definition?.clips) return definition.clips(root, joints);
  const clips = createClips(id, root, joints);
  const byName = Object.fromEntries(clips.map(clip => [clip.name, clip]));
  const move = byName.idle.clone();
  move.name = 'move';
  const ability = byName.ability;
  const first = ability.duration * 0.55;
  const second = ability.duration - first;
  const windup = THREE.AnimationUtils.subclip(ability, 'windup', 0, Math.ceil(first * 30), 30);
  windup.duration = first;
  const release = THREE.AnimationUtils.subclip(ability, 'release', Math.floor(first * 30), Math.ceil(ability.duration * 30), 30);
  release.duration = second;
  return [byName.idle, move, byName.attack, windup, release, ability, byName.shutdown];
}
