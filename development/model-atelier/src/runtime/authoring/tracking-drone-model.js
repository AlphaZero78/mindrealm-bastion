import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

const TAU = Math.PI * 2;

function material(color, metalness, roughness, emissive = 0x000000, emissiveIntensity = 0) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness, emissive, emissiveIntensity });
}

function addMesh(parent, name, geometry, surface, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) {
  const mesh = new THREE.Mesh(geometry, surface);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addGroup(parent, name, position = [0, 0, 0]) {
  const group = new THREE.Group();
  group.name = name;
  group.position.set(...position);
  parent.add(group);
  return group;
}

function wingGeometry(side) {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.16);
  shape.lineTo(side * 0.40, -0.04);
  shape.lineTo(side * 0.56, 0.29);
  shape.lineTo(side * 0.20, 0.23);
  shape.lineTo(0, 0.12);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.045, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, steps: 1 });
  geometry.rotateX(Math.PI / 2);
  geometry.center();
  return geometry;
}

function vectorTrack(node, property, times, values) {
  return new THREE.VectorKeyframeTrack(`${node.name}.${property}`, times, values.flat());
}

function scaleTrack(node, times, values) {
  return vectorTrack(node, 'scale', times, values.map(value => Array.isArray(value) ? value : [value, value, value]));
}

function rotationTrack(node, times, rotations) {
  const values = [];
  for (const rotation of rotations) {
    const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation));
    values.push(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
  }
  return new THREE.QuaternionKeyframeTrack(`${node.name}.quaternion`, times, values);
}

function createAnimations(joints) {
  const { flight, scanner, halo, core, emitter, pulse, wingL, wingR } = joints;
  const clips = [];
  const clip = (name, duration, tracks) => clips.push(new THREE.AnimationClip(name, duration, tracks));
  const hover = [0, 0.38, 0];
  const rest = [1, 1, 1];
  const tiny = [0.001, 0.001, 0.001];

  clip('idle', 2.4, [
    vectorTrack(flight, 'position', [0, 1.2, 2.4], [hover, [0, 0.43, 0], hover]),
    rotationTrack(scanner, [0, 1.2, 2.4], [[0, 0, 0], [0, Math.PI, 0], [0, TAU, 0]]),
    rotationTrack(halo, [0, 1.2, 2.4], [[Math.PI / 2, 0, 0], [Math.PI / 2, 0, -Math.PI], [Math.PI / 2, 0, -TAU]]),
  ]);
  clip('move', 0.9, [
    vectorTrack(flight, 'position', [0, 0.45, 0.9], [hover, [0, 0.41, -0.035], hover]),
    rotationTrack(flight, [0, 0.225, 0.45, 0.675, 0.9], [[-0.08, 0, 0], [-0.11, 0, 0.08], [-0.08, 0, 0], [-0.11, 0, -0.08], [-0.08, 0, 0]]),
    rotationTrack(wingL, [0, 0.45, 0.9], [[0, 0, 0.05], [0, 0.12, -0.15], [0, 0, 0.05]]),
    rotationTrack(wingR, [0, 0.45, 0.9], [[0, 0, -0.05], [0, -0.12, 0.15], [0, 0, -0.05]]),
    rotationTrack(scanner, [0, 0.45, 0.9], [[0, 0, 0], [0, Math.PI, 0], [0, TAU, 0]]),
  ]);
  clip('attack', 0.7, [
    rotationTrack(flight, [0, 0.16, 0.28, 0.7], [[0, 0, 0], [0.10, 0, 0], [-0.13, 0, 0], [0, 0, 0]]),
    vectorTrack(emitter, 'position', [0, 0.16, 0.28, 0.7], [[0, -0.17, -0.18], [0, -0.17, -0.25], [0, -0.17, -0.10], [0, -0.17, -0.18]]),
    scaleTrack(core, [0, 0.16, 0.28, 0.7], [rest, [1.30, 1.30, 1.30], [0.82, 0.82, 0.82], rest]),
    scaleTrack(pulse, [0, 0.16, 0.28, 0.55, 0.7], [tiny, tiny, [0.35, 0.35, 0.35], tiny, tiny]),
  ]);
  clip('windup', 1.1, [
    rotationTrack(flight, [0, 1.1], [[0, 0, 0], [0.13, 0, 0]]),
    rotationTrack(wingL, [0, 1.1], [[0, 0, 0.05], [0, 0.28, -0.28]]),
    rotationTrack(wingR, [0, 1.1], [[0, 0, -0.05], [0, -0.28, 0.28]]),
    scaleTrack(core, [0, 0.72, 1.1], [rest, [1.45, 1.45, 1.45], [1.22, 1.22, 1.22]]),
    scaleTrack(halo, [0, 1.1], [rest, [1.25, 1.25, 1.25]]),
  ]);
  clip('release', 0.85, [
    rotationTrack(flight, [0, 0.12, 0.34, 0.85], [[0.13, 0, 0], [-0.16, 0, 0], [0.04, 0, 0], [0, 0, 0]]),
    vectorTrack(emitter, 'position', [0, 0.12, 0.34, 0.85], [[0, -0.17, -0.18], [0, -0.17, -0.04], [0, -0.17, -0.22], [0, -0.17, -0.18]]),
    scaleTrack(core, [0, 0.12, 0.34, 0.85], [[1.22, 1.22, 1.22], [0.72, 0.72, 0.72], [1.35, 1.35, 1.35], rest]),
    scaleTrack(halo, [0, 0.12, 0.85], [[1.25, 1.25, 1.25], rest, rest]),
    scaleTrack(pulse, [0, 0.12, 0.40, 0.70, 0.85], [tiny, [0.20, 0.20, 0.20], [1.45, 1.45, 1.45], [2.1, 2.1, 2.1], tiny]),
  ]);
  clip('ability', 2.0, [
    rotationTrack(scanner, [0, 1, 2], [[0, 0, 0], [0, -Math.PI * 2, 0], [0, -Math.PI * 4, 0]]),
    rotationTrack(halo, [0, 1, 2], [[Math.PI / 2, 0, 0], [Math.PI / 2, Math.PI, Math.PI], [Math.PI / 2, TAU, TAU]]),
    rotationTrack(wingL, [0, 0.5, 1.5, 2], [[0, 0, 0.05], [0, 0.30, -0.30], [0, 0.30, -0.30], [0, 0, 0.05]]),
    rotationTrack(wingR, [0, 0.5, 1.5, 2], [[0, 0, -0.05], [0, -0.30, 0.30], [0, -0.30, 0.30], [0, 0, -0.05]]),
    scaleTrack(core, [0, 0.5, 1, 1.5, 2], [rest, [1.35, 1.35, 1.35], [1.1, 1.1, 1.1], [1.35, 1.35, 1.35], rest]),
    scaleTrack(pulse, [0, 0.45, 0.9, 1.35, 1.8, 2], [tiny, [0.25, 0.25, 0.25], tiny, [0.25, 0.25, 0.25], tiny, tiny]),
  ]);
  clip('shutdown', 1.4, [
    vectorTrack(flight, 'position', [0, 0.45, 1.4], [hover, [0, 0.26, 0.04], [0, -0.06, 0.12]]),
    rotationTrack(flight, [0, 0.45, 1.4], [[0, 0, 0], [0.15, 0.18, 0.30], [0.45, 0.40, 0.85]]),
    rotationTrack(scanner, [0, 1.4], [[0, 0, 0], [0.65, 0.30, -0.25]]),
    rotationTrack(wingL, [0, 1.4], [[0, 0, 0.05], [0.35, -0.35, -0.80]]),
    rotationTrack(wingR, [0, 1.4], [[0, 0, -0.05], [0.35, 0.35, 0.80]]),
    scaleTrack(core, [0, 0.6, 1.4], [rest, [0.65, 0.65, 0.65], [0.12, 0.12, 0.12]]),
    scaleTrack(pulse, [0, 1.4], [tiny, tiny]),
  ]);
  return clips;
}

export function buildTrackingDrone() {
  const surfaces = {
    hull: material(0x8fa8ad, 0.82, 0.28),
    dark: material(0x1b3038, 0.68, 0.42),
    armor: material(0x376c73, 0.55, 0.36),
    gold: material(0xd2b66f, 0.86, 0.24),
    glow: material(0x83f4e2, 0.18, 0.22, 0x53d9ca, 1.1),
    lens: material(0xb9fff3, 0.12, 0.12, 0x63e6d7, 1.8),
  };
  const root = new THREE.Group();
  root.name = 'tracking_drone';
  root.userData = {
    title: '追踪无人机',
    origin: 'Independent original whole-model geometry and seven authored joint clips. No drone_loom parts.',
  };
  const flight = addGroup(root, 'Drone_flight', [0, 0.38, 0]);
  addMesh(flight, 'Faceted_lift_hull', new THREE.SphereGeometry(0.34, 24, 12), surfaces.hull, [0, 0, 0], [0, 0, 0], [1, 0.48, 1.32]);
  addMesh(flight, 'Ventral_armor', new THREE.CylinderGeometry(0.17, 0.25, 0.18, 8), surfaces.dark, [0, -0.13, 0.03]);
  addMesh(flight, 'Octagonal_top_shell', new THREE.CylinderGeometry(0.22, 0.30, 0.13, 8), surfaces.armor, [0, 0.13, 0.025]);
  addMesh(flight, 'Forward_sensor_recess', new THREE.BoxGeometry(0.30, 0.12, 0.09), surfaces.dark, [0, 0.015, -0.42]);
  const core = addGroup(flight, 'Drone_core', [0, 0.015, -0.48]);
  addMesh(core, 'Tracking_lens', new THREE.OctahedronGeometry(0.105, 1), surfaces.lens, [0, 0, 0], [0, 0, Math.PI / 4], [1.15, 0.68, 0.72]);
  addMesh(core, 'Lens_guard', new THREE.TorusGeometry(0.13, 0.018, 8, 32), surfaces.gold);

  const scanner = addGroup(flight, 'Drone_scanner', [0, 0.21, 0.02]);
  addMesh(scanner, 'Scanner_axle', new THREE.CylinderGeometry(0.045, 0.06, 0.13, 12), surfaces.dark);
  addMesh(scanner, 'Scanner_bar', new THREE.BoxGeometry(0.44, 0.035, 0.065), surfaces.gold, [0, 0.075, 0]);
  for (const side of [-1, 1]) addMesh(scanner, `Scanner_contact_${side}`, new THREE.OctahedronGeometry(0.055, 0), surfaces.glow, [side * 0.22, 0.075, 0]);

  const halo = addGroup(flight, 'Drone_halo', [0, -0.075, 0.02]);
  addMesh(halo, 'Lift_field_ring', new THREE.TorusGeometry(0.45, 0.023, 8, 48), surfaces.glow, [0, 0, 0], [Math.PI / 2, 0, 0]);
  for (let index = 0; index < 4; index++) {
    const angle = index * Math.PI / 2;
    addMesh(halo, `Ring_lock_${index}`, new THREE.BoxGeometry(0.075, 0.045, 0.09), surfaces.gold, [Math.cos(angle) * 0.45, 0, Math.sin(angle) * 0.45], [0, -angle, 0]);
  }

  const wingL = addGroup(flight, 'Drone_wing_L', [-0.37, 0.015, 0.03]);
  const wingR = addGroup(flight, 'Drone_wing_R', [0.37, 0.015, 0.03]);
  addMesh(wingL, 'Swept_wing_L', wingGeometry(-1), surfaces.armor);
  addMesh(wingR, 'Swept_wing_R', wingGeometry(1), surfaces.armor);
  for (const [wing, side] of [[wingL, -1], [wingR, 1]]) {
    addMesh(wing, `Wing_signal_${side}`, new THREE.BoxGeometry(0.24, 0.025, 0.035), surfaces.glow, [side * 0.20, 0.035, 0.08], [0, side * -0.35, 0]);
    addMesh(wing, `Wingtip_fin_${side}`, new THREE.BoxGeometry(0.035, 0.15, 0.18), surfaces.dark, [side * 0.42, 0.06, 0.12], [0, 0, side * -0.15]);
  }

  for (const side of [-1, 1]) {
    addMesh(flight, `Engine_housing_${side}`, new THREE.CylinderGeometry(0.085, 0.11, 0.26, 12), surfaces.dark, [side * 0.23, -0.045, 0.34], [Math.PI / 2, 0, 0]);
    addMesh(flight, `Engine_light_${side}`, new THREE.CylinderGeometry(0.058, 0.058, 0.025, 16), surfaces.glow, [side * 0.23, -0.045, 0.485], [Math.PI / 2, 0, 0]);
    addMesh(flight, `Tail_stabilizer_${side}`, new THREE.BoxGeometry(0.035, 0.16, 0.23), surfaces.hull, [side * 0.19, 0.10, 0.35], [0.20, 0, side * -0.24]);
  }

  const emitter = addGroup(flight, 'Drone_emitter', [0, -0.17, -0.18]);
  addMesh(emitter, 'Pulse_emitter', new THREE.CylinderGeometry(0.045, 0.07, 0.30, 12), surfaces.dark, [0, 0, -0.10], [Math.PI / 2, 0, 0]);
  addMesh(emitter, 'Emitter_rim', new THREE.TorusGeometry(0.07, 0.014, 8, 24), surfaces.gold, [0, 0, -0.26]);
  const pulse = addGroup(flight, 'Drone_pulse', [0, -0.17, -0.55]);
  pulse.scale.setScalar(0.001);
  addMesh(pulse, 'Pulse_front', new THREE.TorusGeometry(0.18, 0.018, 8, 32), surfaces.glow);
  addMesh(pulse, 'Pulse_core', new THREE.OctahedronGeometry(0.065, 0), surfaces.lens);

  root.updateMatrixWorld(true);
  const animations = createAnimations({ flight, scanner, halo, core, emitter, pulse, wingL, wingR });
  return { root, animations };
}

export async function buildTrackingDroneGLB() {
  if (!globalThis.FileReader) {
    globalThis.FileReader = class {
      readAsArrayBuffer(blob) {
        blob.arrayBuffer().then(buffer => {
          this.result = buffer;
          this.onloadend?.({ target: this });
        });
      }
    };
  }
  const { root, animations } = buildTrackingDrone();
  const scene = new THREE.Scene();
  scene.name = 'tracking_drone_atelier';
  scene.add(root);
  scene.animations = animations;
  const data = await new GLTFExporter().parseAsync(scene, { binary: true, trs: true, onlyVisible: false, animations });
  if (!(data instanceof ArrayBuffer) || data.byteLength < 1000) throw new Error('tracking_drone GLB 导出失败');
  return data;
}
