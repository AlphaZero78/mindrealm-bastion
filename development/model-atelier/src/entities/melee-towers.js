import * as THREE from '../../vendor/three/build/three.module.js';
import { defineEntity } from './contract.js';
import {
  palette, group, mesh, box as roundedBox, panel as beveledPanel,
  cylinder as turnedCylinder, annulusGeometry,
} from '../geometry.js';
import { createRigClip, TAU, ease, pulse } from '../animations.js';
import { addMechanicalLink, withMechanicalLinks } from './mechanical-links.js';

const VARIANTS = ['T1', 'T2A', 'T2B', 'T3A', 'T3B'];
const CLIP_ORDER = ['idle', 'move', 'attack', 'windup', 'release', 'ability', 'shutdown'];

function variantSpec(variant) {
  if (!VARIANTS.includes(variant)) throw new Error(`Unknown melee tower variant: ${variant}`);
  return { level: Number(variant[1]), branch: variant.slice(2) || null };
}

function part(parent, name, position = [0, 0, 0], rotation = [0, 0, 0]) {
  return group(parent, name, position, rotation);
}

function box(parent, name, size, position, material, rotation = [0, 0, 0]) {
  const bevel = Math.min(0.045, Math.min(...size) * 0.23);
  return roundedBox(parent, name, size, position, material, rotation, bevel);
}

function cylinder(parent, name, top, bottom, height, position, material, rotation = [0, 0, 0], segments = 16, openEnded = false) {
  if (openEnded) return mesh(parent, name, new THREE.CylinderGeometry(top, bottom, height, Math.max(24, segments), 1, true), material, position, rotation);
  const radialSegments = segments < 12 ? segments : Math.max(24, segments);
  return turnedCylinder(parent, name, top, bottom, height, position, material, rotation, radialSegments);
}

function cone(parent, name, radius, height, position, material, rotation = [0, 0, 0], segments = 8) {
  return mesh(parent, name, new THREE.ConeGeometry(radius, height, segments), material, position, rotation);
}

function sphere(parent, name, radius, position, material, scale = [1, 1, 1]) {
  return mesh(parent, name, new THREE.SphereGeometry(radius, 24, 16), material, position, [0, 0, 0], scale);
}

function ring(parent, name, radius, tube, position, material, rotation = [0, 0, 0], arc = TAU) {
  return mesh(parent, name, new THREE.TorusGeometry(radius, tube, 8, 48, arc), material, position, rotation);
}

function profile(parent, name, points, depth, position, material, rotation = [0, 0, 0], bevel = 0.014) {
  return beveledPanel(parent, name, points, depth, position, material, rotation, Math.min(bevel, depth * 0.20));
}

function plate(parent, name, width, height, depth, cut, position, material, rotation = [0, 0, 0]) {
  const x = width / 2, y = height / 2, c = Math.min(cut, x * 0.8, y * 0.8);
  return beveledPanel(parent, name, [
    [-x + c, -y], [x - c, -y], [x, -y + c], [x, y - c],
    [x - c, y], [-x + c, y], [-x, y - c], [-x, -y + c],
  ], depth, position, material, rotation, Math.min(0.022, depth * 0.16), c * 0.16);
}

function beam(parent, name, start, end, width, depth, material) {
  const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
  const direction = b.clone().sub(a);
  const node = box(parent, name, [width, direction.length(), depth], a.clone().add(b).multiplyScalar(0.5).toArray(), material);
  node.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return node;
}

function pipe(parent, name, points, radius, material) {
  const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
  return mesh(parent, name, new THREE.TubeGeometry(curve, 24, radius, 8, false), material);
}

function socket(parent, name, position, p, rotation = [Math.PI / 2, 0, 0], radius = 0.18) {
  const mount = part(parent, name, position, rotation);
  cylinder(mount, `${name}_seat`, radius, radius * 1.08, 0.12, [0, 0, 0], p.dark);
  mesh(mount, `${name}_retainer`, annulusGeometry(radius * 1.06, radius * 0.67, 0.06, 32), p.edge, [0, 0.07, 0]);
  cylinder(mount, `${name}_plug`, radius * 0.62, radius * 0.62, 0.15, [0, 0.02, 0], p.gold, [0, 0, 0], 8);
  return mount;
}

function anchoredBase(root, prefix, p, width, depth, heavy = false) {
  const foundation = part(root, `${prefix}_foundation`);
  box(foundation, `${prefix}_lower_deck`, [width * 0.72, 0.2, depth * 0.64], [0, 0.28, 0], p.dark);
  plate(foundation, `${prefix}_upper_deck`, width * 0.74, depth * 0.65, 0.12, 0.15, [0, 0.43, 0], p.hull, [-Math.PI / 2, 0, 0]);
  plate(foundation, `${prefix}_front_apron`, width * 0.66, 0.3, 0.1, 0.07, [0, 0.35, -depth * 0.335], p.armor);
  box(foundation, `${prefix}_apron_inset`, [width * 0.4, 0.075, 0.025], [0, 0.36, -depth * 0.395], p.accent);
  for (const side of [-1, 1]) {
    for (const end of [-1, 1]) {
      const tag = `${side < 0 ? 'L' : 'R'}${end < 0 ? 'F' : 'R'}`;
      const x = side * width * 0.39, z = end * depth * 0.36;
      const shoe = part(root, `${prefix}_shoe_${tag}`, [x, 0, z]);
      box(shoe, `${prefix}_pad_${tag}`, [heavy ? 0.7 : 0.6, 0.16, heavy ? 0.76 : 0.66], [0, 0.08, 0], p.dark);
      plate(shoe, `${prefix}_pad_cap_${tag}`, heavy ? 0.64 : 0.55, heavy ? 0.68 : 0.58, 0.08, 0.09, [0, 0.19, 0], p.armor, [-Math.PI / 2, 0, 0]);
      cylinder(shoe, `${prefix}_pile_barrel_${tag}`, 0.13, 0.17, 0.32, [0, 0.35, 0], p.hull, [0, 0, 0], 12);
      cone(shoe, `${prefix}_ground_spike_${tag}`, 0.13, 0.22, [0, 0.11, 0], p.edge, [0, 0, Math.PI], 6);
      ring(shoe, `${prefix}_pile_washer_${tag}`, 0.15, 0.025, [0, 0.515, 0], p.gold, [Math.PI / 2, 0, 0]);
      cylinder(shoe, `${prefix}_pile_bolt_${tag}`, 0.09, 0.09, 0.08, [0, 0.54, 0], p.edge, [0, 0, 0], 6);
      for (const jaw of [-1, 1]) {
        box(shoe, `${prefix}_jaw_${tag}_${jaw}`, [0.12, 0.18, 0.42], [jaw * (heavy ? 0.29 : 0.25), 0.2, 0], p.hull, [0, 0, jaw * 0.12]);
      }
    }
  }
  const ribs = part(root, `${prefix}_load_ribs`);
  for (const side of [-1, 1]) {
    for (const end of [-1, 1]) {
      beam(ribs, `${prefix}_rib_${side}_${end}`, [side * width * 0.38, 0.22, end * depth * 0.34], [side * width * 0.2, 0.46, end * depth * 0.18], 0.13, 0.13, p.edge);
      beam(ribs, `${prefix}_rib_lower_${side}_${end}`, [side * width * 0.3, 0.18, end * depth * 0.36], [side * width * 0.12, 0.26, end * depth * 0.28], 0.1, 0.12, p.hull);
    }
  }
}

function mindCore(parent, prefix, p, position, size = 1) {
  const mount = part(parent, `${prefix}_mind_mount`, position);
  mount.scale.setScalar(size);
  cylinder(mount, `${prefix}_mind_socket`, 0.34, 0.38, 0.16, [0, 0, 0.11], p.dark, [Math.PI / 2, 0, 0], 16);
  ring(mount, `${prefix}_mind_bezel`, 0.34, 0.045, [0, 0, -0.01], p.edge);
  for (const side of [-1, 1]) {
    beam(mount, `${prefix}_mind_cage_v_${side}`, [side * 0.32, -0.22, 0.04], [side * 0.32, 0.22, 0.04], 0.055, 0.07, p.gold);
    box(mount, `${prefix}_mind_cage_h_${side}`, [0.22, 0.05, 0.08], [0, side * 0.32, 0.04], p.hull);
  }
  const rotor = part(mount, `${prefix}_mind_gimbal`);
  ring(rotor, `${prefix}_mind_ring_outer`, 0.27, 0.026, [0, 0, -0.055], p.gold, [0.25, 0, 0]);
  ring(rotor, `${prefix}_mind_ring_inner`, 0.22, 0.022, [0, 0, -0.06], p.accent, [0, Math.PI / 2, 0]);
  for (let i = 0; i < 3; i++) {
    const angle = i * TAU / 3;
    box(rotor, `${prefix}_mind_index_${i}`, [0.075, 0.075, 0.07], [Math.cos(angle) * 0.27, Math.sin(angle) * 0.27, -0.055], p.edge, [0, 0, angle]);
  }
  const heart = part(rotor, `${prefix}_mind_heart`, [0, 0, -0.09]);
  mesh(heart, `${prefix}_mind_crystal`, new THREE.OctahedronGeometry(0.19, 0), p.core, [0, 0, 0], [0, 0, Math.PI / 4], [0.78, 1.2, 0.78]);
  sphere(heart, `${prefix}_mind_seed`, 0.085, [0, 0, -0.02], p.energy);
  return { rotor, heart };
}

function makeClips(root, joints, definitions) {
  return CLIP_ORDER.map(name => {
    const [duration, pose] = definitions[name];
    return createRigClip(root, joints, name, duration, withMechanicalLinks(root, joints, pose));
  });
}

function buildBulwark(variant) {
  const { level, branch } = variantSpec(variant);
  const p = palette('ally');
  const root = new THREE.Group();
  root.name = `anchor_bulwark_${variant}_root`;
  root.userData = { variant, level, branch };
  anchoredBase(root, 'bulwark', p, 2.3, 1.85, true);

  const yaw = part(root, 'bulwark_slew', [0, 0.48, 0]);
  const frame = part(yaw, 'bulwark_load_frame');
  box(frame, 'bulwark_frame_foot', [1.18, 0.2, 0.88], [0, 0.09, 0], p.dark);
  for (const side of [-1, 1]) {
    box(frame, `bulwark_upright_${side}`, [0.22, 1.28, 0.28], [side * 0.47, 0.76, 0.13], p.hull);
    beam(frame, `bulwark_frame_diag_${side}`, [side * 0.72, 0.12, 0.34], [side * 0.45, 1.38, 0.12], 0.13, 0.15, p.edge);
    box(frame, `bulwark_upright_cap_${side}`, [0.32, 0.15, 0.4], [side * 0.47, 1.4, 0.1], p.gold);
  }
  box(frame, 'bulwark_crown_beam', [1.18, 0.18, 0.36], [0, 1.42, 0.1], p.armor);
  pipe(frame, 'bulwark_spinal_conduit', [[-0.32, 0.15, 0.4], [-0.34, 0.7, 0.42], [0, 1.32, 0.38], [0.34, 0.7, 0.42], [0.32, 0.15, 0.4]], 0.035, p.accent);

  const shield = part(yaw, 'bulwark_shield_lift', [0, 0.88, -0.55]);
  plate(shield, 'bulwark_main_shield', 1.16, 1.18, 0.14, 0.17, [0, 0, 0], p.armor);
  plate(shield, 'bulwark_inner_shield', 0.82, 0.84, 0.07, 0.12, [0, 0, -0.1], p.hull);
  for (const side of [-1, 1]) {
    const cheek = part(shield, `bulwark_shield_cheek_${side}`, [side * 0.58, -0.03, 0.045], [0, side * 0.16, 0]);
    plate(cheek, `bulwark_cheek_plate_${side}`, 0.35, 1.02, 0.13, 0.08, [0, 0, 0], p.hull);
    box(cheek, `bulwark_cheek_edge_${side}`, [0.065, 0.8, 0.16], [side * 0.15, 0, 0], p.edge);
  }
  box(shield, 'bulwark_shield_top_rail', [1.15, 0.09, 0.19], [0, 0.54, 0], p.edge);
  box(shield, 'bulwark_shield_bottom_rail', [0.94, 0.11, 0.2], [0, -0.55, 0], p.dark);
  const core = mindCore(shield, 'bulwark', p, [0, 0.03, -0.19], 0.92);

  const joints = { yaw, shield, core: core.rotor, heart: core.heart };
  for (const side of [-1, 1]) addMechanicalLink(root, joints, `bulwarkShieldLift${side < 0 ? 'L' : 'R'}`, {
    from: { node: yaw, point: [side * 0.36, 0.45, 0.1] },
    to: { node: shield, point: [side * 0.36, -0.2, 0.08] },
    radius: 0.035, sleeveRadius: 0.065, sleeveLength: 0.26, materials: p,
  });
  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R';
    socket(yaw, `bulwark_arm_socket_${id}`, [side * 0.69, 1.16, -0.02], p, [Math.PI / 2, 0, 0], 0.22);
    const arm = part(yaw, `bulwark_ram_arm_${id}`, [side * 0.69, 1.16, -0.05]);
    beam(arm, `bulwark_arm_bone_${id}`, [0, 0, 0], [side * 0.18, -0.14, -0.35], 0.19, 0.2, p.hull);
    mesh(arm, `bulwark_ram_cylinder_${id}`, annulusGeometry(0.17, 0.075, 0.48, 32), p.dark, [side * 0.14, -0.12, -0.26], [Math.PI / 2, 0, 0]);
    mesh(arm, `bulwark_ram_return_tube_${id}`, annulusGeometry(0.09, 0.075, 0.52, 32), p.hull, [side * 0.14, -0.12, 0.21], [Math.PI / 2, 0, 0]);
    const fist = part(arm, `bulwark_ram_fist_${id}`, [side * 0.18, -0.15, -0.67]);
    cylinder(fist, `bulwark_ram_rod_${id}`, 0.065, 0.065, 1.36, [-side * 0.04, 0.03, 0.42], p.edge, [Math.PI / 2, 0, 0], 24);
    plate(fist, `bulwark_fist_block_${id}`, 0.47, 0.48, 0.38, 0.08, [0, 0, 0], p.armor);
    plate(fist, `bulwark_fist_face_${id}`, 0.4, 0.38, 0.09, 0.06, [0, 0, -0.23], p.dark);
    for (let i = -1; i <= 1; i++) {
      cylinder(fist, `bulwark_knuckle_${id}_${i}`, 0.065, 0.085, 0.16, [i * 0.125, 0, -0.32], p.edge, [Math.PI / 2, 0, 0], 6);
    }
    joints[`arm${id}`] = arm;
    joints[`fist${id}`] = fist;
  }

  const tauntCrown = part(yaw, 'bulwark_taunt_crown', [0, 1.57, -0.06]);
  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R';
    const horn = part(tauntCrown, `bulwark_taunt_horn_${id}`, [side * 0.36, 0, -0.12], [0, side * 0.18, 0]);
    cylinder(horn, `bulwark_horn_body_${id}`, 0.22, 0.1, 0.44, [0, 0, -0.12], p.gold, [-Math.PI / 2, 0, 0], 16, true);
    ring(horn, `bulwark_horn_lip_${id}`, 0.22, 0.03, [0, 0, -0.34], p.edge);
    cylinder(horn, `bulwark_horn_throat_${id}`, 0.075, 0.075, 0.08, [0, 0, 0.09], p.energy, [Math.PI / 2, 0, 0], 12);
    ring(horn, `bulwark_horn_field_${id}`, 0.145, 0.014, [0, 0, -0.345], p.field);
    joints[`taunt${id}`] = horn;
  }
  beam(tauntCrown, 'bulwark_crown_bridge', [-0.37, 0, 0.08], [0.37, 0, 0.08], 0.12, 0.12, p.hull);

  if (!branch) {
    socket(yaw, 'bulwark_capped_counter_mount', [-0.28, 0.72, 0.48], p, [Math.PI / 2, 0, 0], 0.14);
    socket(yaw, 'bulwark_capped_guard_mount', [0.28, 0.72, 0.48], p, [Math.PI / 2, 0, 0], 0.14);
  }

  if (branch === 'A') {
    const counter = part(yaw, 'bulwark_counter_recoil', [0, 1.02, 0.42]);
    box(counter, 'bulwark_counter_crossmember', [1.22, 0.18, 0.22], [0, 0, 0.16], p.hull);
    for (const side of [-1, 1]) {
      const id = side < 0 ? 'L' : 'R';
      cylinder(counter, `bulwark_counter_case_${id}`, 0.17, 0.17, 0.56, [side * 0.43, 0, 0], p.dark, [Math.PI / 2, 0, 0], 12, true);
      cylinder(counter, `bulwark_counter_rod_${id}`, 0.065, 0.065, 0.76, [side * 0.43, 0, -0.08], p.edge, [Math.PI / 2, 0, 0], 12);
      for (let i = 0; i < (level === 3 ? 7 : 5); i++) {
        ring(counter, `bulwark_counter_spring_${id}_${i}`, 0.15, 0.022, [side * 0.43, 0, -0.18 + i * 0.075], p.gold);
      }
      box(counter, `bulwark_reaction_mass_${id}`, [0.3, 0.34, 0.24], [side * 0.43, 0, 0.39], p.armor);
    }
    joints.counter = counter;
    if (level === 3) {
      const crown = part(yaw, 'bulwark_counter_crown', [0, 1.78, -0.18]);
      plate(crown, 'bulwark_counter_brow', 1.26, 0.34, 0.26, 0.08, [0, 0, 0], p.armor);
      for (const side of [-1, 1]) {
        cylinder(crown, `bulwark_crown_rebound_drum_${side}`, 0.16, 0.16, 0.32, [side * 0.43, 0.23, 0.03], p.dark, [0, 0, Math.PI / 2], 12);
        ring(crown, `bulwark_crown_drum_band_${side}`, 0.16, 0.025, [side * 0.43, 0.23, 0.03], p.energy, [0, Math.PI / 2, 0]);
        beam(crown, `bulwark_crown_load_link_${side}`, [side * 0.48, -0.12, 0], [side * 0.43, 0.24, 0.03], 0.09, 0.1, p.edge);
      }
    }
  }

  if (branch === 'B') {
    const guard = part(yaw, 'bulwark_guard_manifold', [0, 1.63, 0.18]);
    cylinder(guard, 'bulwark_guard_hub', 0.22, 0.28, 0.24, [0, 0, 0], p.dark, [0, 0, 0], 12);
    ring(guard, 'bulwark_guard_halo', 0.38, 0.035, [0, 0.16, 0], p.energy, [Math.PI / 2, 0, 0]);
    for (let i = 0; i < (level === 3 ? 5 : 3); i++) {
      const angle = (i / (level === 3 ? 5 : 3)) * TAU;
      const vane = part(guard, `bulwark_guard_vane_${i}`, [Math.cos(angle) * 0.36, 0.22, Math.sin(angle) * 0.36], [0, -angle, 0]);
      plate(vane, `bulwark_guard_vane_plate_${i}`, 0.18, 0.46, 0.06, 0.04, [0, 0.12, 0], p.armor);
      box(vane, `bulwark_guard_vane_cell_${i}`, [0.07, 0.28, 0.075], [0, 0.12, -0.02], p.accent);
    }
    joints.guard = guard;
    for (const side of [-1, 1]) {
      const id = side < 0 ? 'L' : 'R';
      socket(shield, `bulwark_wing_socket_${id}`, [side * 0.69, 0, 0.03], p, [Math.PI / 2, 0, 0], 0.16);
      const wing = part(shield, `bulwark_guard_wing_${id}`, [side * 0.7, 0, 0.02]);
      plate(wing, `bulwark_guard_wing_plate_${id}`, 0.45, level === 3 ? 1.34 : 1.08, 0.13, 0.09, [side * 0.18, level === 3 ? 0.1 : 0, 0], p.armor, [0, side * 0.25, 0]);
      box(wing, `bulwark_guard_wing_spine_${id}`, [0.08, level === 3 ? 1.16 : 0.9, 0.17], [side * 0.34, 0, 0.04], p.edge);
      if (level === 3) {
        plate(wing, `bulwark_guard_upper_flange_${id}`, 0.52, 0.32, 0.16, 0.06, [side * 0.23, 0.66, 0.03], p.hull);
        box(wing, `bulwark_guard_flange_cell_${id}`, [0.24, 0.06, 0.18], [side * 0.23, 0.67, -0.02], p.energy);
      }
      joints[`wing${id}`] = wing;
    }
    const deep = part(root, 'bulwark_deep_foundation');
    for (const side of [-1, 1]) {
      box(deep, `bulwark_deep_pad_${side}`, [0.54, 0.16, 0.62], [side * 0.78, 0.08, 1.03], p.dark);
      cylinder(deep, `bulwark_deep_pile_${side}`, 0.15, 0.2, 0.52, [side * 0.78, 0.35, 1.03], p.hull, [0, 0, 0], 12);
      ring(deep, `bulwark_deep_lock_${side}`, 0.18, 0.03, [side * 0.78, 0.59, 1.03], p.gold, [Math.PI / 2, 0, 0]);
      beam(deep, `bulwark_deep_outrigger_${side}`, [side * 0.78, 0.26, 1.03], [side * 0.42, 0.48, 0.4], 0.18, 0.18, p.edge);
      if (level === 3) {
        box(deep, `bulwark_outer_pad_${side}`, [0.58, 0.16, 0.72], [side * 1.32, 0.08, 0.18], p.dark);
        cylinder(deep, `bulwark_outer_pile_${side}`, 0.14, 0.19, 0.38, [side * 1.32, 0.28, 0.18], p.armor, [0, 0, 0], 12);
        beam(deep, `bulwark_outer_load_path_${side}`, [side * 1.32, 0.25, 0.18], [side * 0.66, 0.54, 0.12], 0.16, 0.2, p.hull);
      }
    }
  }
  return { root, joints };
}

function bulwarkClips(root, joints) {
  const branch = root.userData.branch;
  return makeClips(root, joints, {
    idle: [3.2, (u, t, { set }) => {
      const wave = Math.sin(TAU * u);
      set('yaw', { r: [0, wave * 0.035, 0] });
      set('shield', { p: [0, wave * 0.025, 0] });
      set('core', { r: [wave * 0.12, wave * 0.3, 0] });
      set('heart', { s: [1 + wave * 0.06, 1 + wave * 0.09, 1 + wave * 0.06] });
      set('armL', { r: [wave * 0.035, 0, 0] });
      set('armR', { r: [-wave * 0.035, 0, 0] });
      set('tauntL', { r: [0, wave * 0.04, 0] });
      set('tauntR', { r: [0, -wave * 0.04, 0] });
    }],
    move: [2.4, (u, t, { set }) => {
      const wave = Math.sin(TAU * u), cycle = Math.sin(TAU * u * 2);
      set('yaw', { r: [0, wave * 0.24, 0] });
      set('shield', { r: [cycle * 0.055, 0, 0] });
      set('fistL', { p: [0, 0, -0.11 * (0.5 + 0.5 * wave)] });
      set('fistR', { p: [0, 0, -0.11 * (0.5 - 0.5 * wave)] });
      set('core', { r: [0, wave * 0.5, 0] });
      set('heart', { s: [1 + cycle * 0.04, 1 + cycle * 0.04, 1 + cycle * 0.04] });
    }],
    attack: [1.15, (u, t, { set }) => {
      const left = pulse(u, 0.03, 0.3, 0.58), right = pulse(u, 0.4, 0.68, 0.96);
      set('yaw', { r: [0, (left - right) * 0.15, 0] });
      set('shield', { r: [(left + right) * 0.09, 0, 0], p: [0, 0, (left + right) * 0.07] });
      set('armL', { r: [-left * 0.22, 0, -left * 0.08] });
      set('armR', { r: [-right * 0.22, 0, right * 0.08] });
      set('fistL', { p: [0, 0, -left * 0.58] });
      set('fistR', { p: [0, 0, -right * 0.58] });
      set('heart', { s: [1 + (left + right) * 0.12, 1 + (left + right) * 0.16, 1 + (left + right) * 0.12] });
      if (joints.counter) set('counter', { p: [0, 0, (left + right) * 0.18] });
    }],
    windup: [1.6, (u, t, { set }) => {
      const charge = ease(u, 0, 0.9);
      set('shield', { p: [0, charge * 0.15, charge * 0.08], r: [-charge * 0.1, 0, 0] });
      set('armL', { r: [charge * 0.3, 0, -charge * 0.12] });
      set('armR', { r: [charge * 0.3, 0, charge * 0.12] });
      set('fistL', { p: [0, 0, charge * 0.24] });
      set('fistR', { p: [0, 0, charge * 0.24] });
      set('tauntL', { r: [charge * 0.4, -charge * 0.25, 0] });
      set('tauntR', { r: [charge * 0.4, charge * 0.25, 0] });
      set('core', { r: [charge * 0.7, charge * 1.2, 0] });
      set('heart', { s: [1 + charge * 0.28, 1 + charge * 0.38, 1 + charge * 0.28] });
      if (joints.counter) set('counter', { p: [0, 0, charge * 0.2] });
      if (joints.guard) set('guard', { p: [0, charge * 0.16, 0] });
    }],
    release: [1.25, (u, t, { set }) => {
      const hit = pulse(u, 0, 0.24, 0.72), taunt = pulse(u, 0.12, 0.42, 0.95);
      set('yaw', { r: [0, Math.sin(u * Math.PI) * 0.12, 0] });
      set('shield', { p: [0, -hit * 0.08, -hit * 0.18], r: [hit * 0.16, 0, 0] });
      set('fistL', { p: [0, 0, -hit * 0.72] });
      set('fistR', { p: [0, 0, -hit * 0.72] });
      set('armL', { r: [-hit * 0.32, 0, 0] });
      set('armR', { r: [-hit * 0.32, 0, 0] });
      set('tauntL', { r: [-taunt * 0.2, -taunt * 0.35, 0], s: [1 + taunt * 0.16, 1 + taunt * 0.16, 1 + taunt * 0.24] });
      set('tauntR', { r: [-taunt * 0.2, taunt * 0.35, 0], s: [1 + taunt * 0.16, 1 + taunt * 0.16, 1 + taunt * 0.24] });
      set('core', { r: [hit * 0.8, taunt * 1.8, 0] });
      set('heart', { s: [1 + taunt * 0.32, 1 + taunt * 0.32, 1 + taunt * 0.32] });
      if (joints.counter) set('counter', { p: [0, 0, hit * 0.3] });
    }],
    ability: [3.0, (u, t, { set }) => {
      const open = 0.5 - 0.5 * Math.cos(TAU * u), beat = Math.sin(TAU * u * 3);
      set('shield', { p: [0, open * 0.18, 0] });
      set('tauntL', { r: [0, -open * 0.55, 0], s: [1 + open * 0.12, 1 + open * 0.12, 1 + open * 0.12] });
      set('tauntR', { r: [0, open * 0.55, 0], s: [1 + open * 0.12, 1 + open * 0.12, 1 + open * 0.12] });
      set('core', { r: [open * 0.4, u * TAU, 0] });
      set('heart', { s: [1 + open * 0.18 + beat * 0.04, 1 + open * 0.26 + beat * 0.04, 1 + open * 0.18 + beat * 0.04] });
      set('armL', { r: [open * 0.12, 0, 0] });
      set('armR', { r: [open * 0.12, 0, 0] });
      if (joints.counter) set('counter', { p: [0, 0, (0.5 + 0.5 * beat) * 0.25], r: [beat * 0.04, 0, 0] });
      if (joints.guard) set('guard', { p: [0, open * 0.24, 0], r: [0, u * TAU, 0] });
      if (joints.wingL) set('wingL', { r: [0, -open * 0.5, -open * 0.16] });
      if (joints.wingR) set('wingR', { r: [0, open * 0.5, open * 0.16] });
    }],
    shutdown: [2.8, (u, t, { set }) => {
      const fall = ease(u, 0.04, 0.82), flicker = Math.max(0, Math.sin(TAU * u * 4)) * (1 - fall);
      set('yaw', { r: [fall * 0.08, fall * 0.22, fall * 0.12] });
      set('shield', { p: [0, -fall * 0.36, fall * 0.12], r: [fall * 0.55, 0, fall * 0.12] });
      set('armL', { r: [fall * 0.65, 0, -fall * 0.35] });
      set('armR', { r: [fall * 0.9, 0, fall * 0.22] });
      set('fistL', { p: [0, -fall * 0.2, fall * 0.2], r: [fall * 0.5, 0, 0] });
      set('fistR', { p: [0, -fall * 0.28, fall * 0.28], r: [fall * 0.72, 0, 0] });
      set('tauntL', { r: [fall * 0.9, -fall * 0.25, -fall * 0.3] });
      set('tauntR', { r: [fall * 1.1, fall * 0.2, fall * 0.25] });
      set('core', { r: [fall * 0.6, fall * 1.4, fall * 0.4] });
      set('heart', { s: [1 - fall * 0.82 + flicker * 0.08, 1 - fall * 0.82 + flicker * 0.08, 1 - fall * 0.82 + flicker * 0.08] });
      if (joints.counter) set('counter', { p: [0, -fall * 0.18, fall * 0.3], r: [fall * 0.35, 0, 0] });
      if (joints.guard) set('guard', { p: [0, -fall * 0.28, 0], r: [fall * 0.5, 0, fall * 0.3] });
      if (joints.wingL) set('wingL', { r: [fall * 0.3, -fall * 0.3, -fall * 0.5] });
      if (joints.wingR) set('wingR', { r: [fall * 0.2, fall * 0.35, fall * 0.65] });
    }],
  });
}

const BLADE_POINTS = [
  [-0.11, 0], [-0.2, 0.38], [-0.16, 0.9], [-0.02, 1.38],
  [0.15, 1.13], [0.22, 0.73], [0.13, 0.18], [0.1, 0],
];

function mirrored(points, side) {
  const result = points.map(([x, y]) => [x * side, y]);
  return side < 0 ? result.reverse() : result;
}

function buildPhaseBlade(variant) {
  const { level, branch } = variantSpec(variant);
  const p = palette('ally');
  const root = new THREE.Group();
  root.name = `phase_blade_${variant}_root`;
  root.userData = { variant, level, branch };
  anchoredBase(root, 'phase', p, 2.08, 1.78);

  const yaw = part(root, 'phase_slew', [0, 0.47, 0]);
  const frame = part(yaw, 'phase_fork_frame');
  box(frame, 'phase_frame_foot', [1.06, 0.18, 0.78], [0, 0.08, 0], p.dark);
  for (const side of [-1, 1]) {
    beam(frame, `phase_swept_pillar_${side}`, [side * 0.57, 0.12, 0.28], [side * 0.42, 1.18, 0.04], 0.14, 0.18, p.hull);
    beam(frame, `phase_pillar_edge_${side}`, [side * 0.65, 0.14, 0.2], [side * 0.5, 1.1, -0.02], 0.055, 0.08, p.edge);
    socket(frame, `phase_blade_mount_${side}`, [side * 0.47, 1.02, -0.04], p, [0, 0, Math.PI / 2], 0.19);
  }
  pipe(frame, 'phase_reclaim_spine', [[-0.42, 0.12, 0.36], [-0.36, 0.65, 0.48], [0, 1.12, 0.43], [0.36, 0.65, 0.48], [0.42, 0.12, 0.36]], 0.045, p.accent);

  const head = part(yaw, 'phase_weapon_head', [0, 0.98, -0.12]);
  box(head, 'phase_head_crossbar', [1.18, 0.18, 0.28], [0, 0, 0], p.hull);
  const core = mindCore(head, 'phase', p, [0, 0.26, -0.2], 0.88);
  const joints = { yaw, head, core: core.rotor, heart: core.heart };
  for (const side of [-1, 1]) addMechanicalLink(root, joints, `phaseHeadSupport${side < 0 ? 'L' : 'R'}`, {
    from: { node: yaw, point: [side * 0.38, 0.62, 0.24] },
    to: { node: head, point: [side * 0.38, -0.02, 0.08] },
    radius: 0.025, sleeveRadius: 0.055, sleeveLength: 0.1, materials: p,
  });

  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R';
    const blade = part(head, `phase_blade_${id}`, [side * 0.54, 0.03, -0.19], [0, 0, -side * 0.13]);
    cylinder(blade, `phase_blade_hinge_${id}`, 0.18, 0.18, 0.3, [0, 0, 0], p.dark, [0, 0, Math.PI / 2], 12);
    ring(blade, `phase_blade_hinge_ring_${id}`, 0.18, 0.028, [side * 0.17, 0, 0], p.gold, [0, Math.PI / 2, 0]);
    profile(blade, `phase_sabre_body_${id}`, mirrored(BLADE_POINTS, side), 0.14, [0, 0.05, 0], p.hull);
    profile(blade, `phase_sabre_inlay_${id}`, mirrored([
      [-0.045, 0.18], [-0.09, 0.48], [-0.06, 0.88], [0, 1.18], [0.065, 0.85], [0.08, 0.42], [0.045, 0.18],
    ], side), 0.025, [0, 0.05, -0.09], p.energy, [0, 0, 0], 0.004);
    beam(blade, `phase_sabre_edge_${id}`, [side * 0.14, 0.22, -0.015], [side * 0.2, 0.79, -0.015], 0.045, 0.17, p.edge);
    pipe(blade, `phase_blade_return_${id}`, [[0, 0.02, 0.1], [side * 0.16, 0.28, 0.11], [side * 0.1, 0.72, 0.1], [0, 1.03, 0.08]], 0.027, p.gold);
    if (branch === 'A') {
      const collector = part(blade, `phase_siphon_collar_${id}`, [0, 0.26, 0.03]);
      ring(collector, `phase_siphon_ring_${id}`, 0.22, 0.035, [0, 0, 0], p.accent, [Math.PI / 2, 0, 0]);
      box(collector, `phase_siphon_intake_${id}`, [0.32, 0.16, 0.24], [0, 0, 0.02], p.dark);
      if (level === 3) {
        profile(blade, `phase_echo_sabre_${id}`, mirrored(BLADE_POINTS.map(([x, y]) => [x * 0.82, y * 0.82]), -side), 0.09, [-side * 0.24, 0.12, 0.18], p.armor);
        beam(blade, `phase_echo_blade_link_${id}`, [0, 0.1, 0.14], [-side * 0.24, 0.22, 0.18], 0.1, 0.12, p.gold);
      }
      joints[`collector${id}`] = collector;
    }
    if (branch === 'B') {
      const shear = part(blade, `phase_shear_${id}`, [side * 0.13, 0.13, -0.03]);
      profile(shear, `phase_counter_cutter_${id}`, mirrored(BLADE_POINTS.map(([x, y]) => [x * 0.72, y * (level === 3 ? 0.9 : 0.74)]), -side), 0.11, [0, 0, 0], p.armor);
      box(shear, `phase_shear_rail_${id}`, [0.09, level === 3 ? 1.04 : 0.82, 0.16], [-side * 0.09, 0.46, 0.03], p.dark, [0, 0, side * 0.08]);
      const teeth = level === 3 ? 5 : 3;
      for (let i = 0; i < teeth; i++) {
        const y = 0.32 + i * 0.17;
        profile(blade, `phase_armor_tooth_${id}_${i}`, mirrored([[0, 0], [0.18, 0.08], [0, 0.15]], side), 0.17, [side * 0.13, y, 0], p.edge, [0, 0, 0], 0.005);
      }
      joints[`shear${id}`] = shear;
    }
    joints[`blade${id}`] = blade;
  }

  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R';
    const housing = part(yaw, `phase_pump_housing_${id}`, [side * 0.28, 0.63, 0.43]);
    cylinder(housing, `phase_pump_glass_${id}`, 0.13, 0.13, 0.62, [0, 0, 0], p.glass, [0, 0, 0], 12, true);
    cylinder(housing, `phase_pump_fluid_${id}`, 0.09, 0.09, 0.42, [0, -0.05, 0], p.energy, [0, 0, 0], 12);
    ring(housing, `phase_pump_seat_${id}`, 0.14, 0.025, [0, -0.31, 0], p.edge, [Math.PI / 2, 0, 0]);
    ring(housing, `phase_pump_cap_${id}`, 0.14, 0.025, [0, 0.31, 0], p.edge, [Math.PI / 2, 0, 0]);
    const pump = part(yaw, `phase_pump_piston_${id}`, [side * 0.28, 0.63, 0.43]);
    cylinder(pump, `phase_pump_rod_${id}`, 0.045, 0.045, 0.76, [0, 0.1, 0], p.edge, [0, 0, 0], 10);
    cylinder(pump, `phase_pump_head_${id}`, 0.14, 0.14, 0.09, [0, 0.48, 0], p.gold, [0, 0, 0], 12);
    pipe(yaw, `phase_reclaim_line_${id}`, [[side * 0.28, 0.92, 0.43], [side * 0.45, 1.12, 0.3], [side * 0.47, 1.04, -0.02]], 0.035, p.accent);
    joints[`pump${id}`] = pump;
  }

  if (!branch) {
    socket(yaw, 'phase_capped_reservoir_mount', [0, 1.16, 0.44], p, [Math.PI / 2, 0, 0], 0.17);
  }

  if (branch === 'A') {
    const reservoir = part(yaw, 'phase_reservoir_rack', [0, 1.05, 0.5]);
    box(reservoir, 'phase_reservoir_backbone', [level === 3 ? 1.65 : 1.2, 0.15, 0.22], [0, -0.4, 0], p.hull);
    const count = level === 3 ? 4 : 2;
    for (let i = 0; i < count; i++) {
      const x = (i - (count - 1) / 2) * 0.4;
      const capsule = part(reservoir, `phase_reservoir_${i}`, [x, 0, 0]);
      cylinder(capsule, `phase_reservoir_glass_${i}`, 0.15, 0.15, 0.7, [0, 0, 0], p.glass, [0, 0, 0], 12, true);
      cylinder(capsule, `phase_reservoir_charge_${i}`, 0.105, 0.105, 0.48, [0, -0.06, 0], p.energy, [0, 0, 0], 12);
      sphere(capsule, `phase_reservoir_top_${i}`, 0.15, [0, 0.35, 0], p.armor, [1, 0.45, 1]);
      sphere(capsule, `phase_reservoir_bottom_${i}`, 0.15, [0, -0.35, 0], p.dark, [1, 0.45, 1]);
      ring(capsule, `phase_reservoir_band_${i}`, 0.15, 0.025, [0, 0.12, 0], p.gold, [Math.PI / 2, 0, 0]);
    }
    const manifold = part(reservoir, 'phase_reclaim_manifold', [0, -0.52, -0.03]);
    cylinder(manifold, 'phase_manifold_rotor', 0.24, 0.24, 0.16, [0, 0, 0], p.dark, [Math.PI / 2, 0, 0], 16);
    ring(manifold, 'phase_manifold_ring', 0.24, 0.035, [0, 0, -0.1], p.energy);
    for (const side of [-1, 1]) box(manifold, `phase_manifold_valve_${side}`, [0.28, 0.08, 0.12], [side * 0.22, 0, 0], p.gold);
    joints.manifold = manifold;
  }

  if (branch === 'B') {
    const yoke = part(head, 'phase_breaker_yoke', [0, 0.92, 0.02]);
    box(yoke, 'phase_breaker_crosshead', [1.36, 0.18, 0.3], [0, 0, 0], p.dark);
    for (const side of [-1, 1]) {
      beam(yoke, `phase_breaker_yoke_link_${side}`, [side * 0.62, 0, 0], [side * 0.48, -0.68, 0.06], 0.12, 0.15, p.gold);
      cone(yoke, `phase_breaker_yoke_tooth_${side}`, 0.11, 0.38, [side * 0.55, -0.22, -0.12], p.edge, [Math.PI / 2, 0, 0], 5);
    }
    if (level === 3) {
      const breaker = part(head, 'phase_central_armor_splitter', [0, 0.12, -0.48]);
      profile(breaker, 'phase_splitter_wedge', [[-0.16, 0], [-0.23, 0.68], [0, 1.34], [0.23, 0.68], [0.16, 0]], 0.22, [0, 0, 0], p.armor);
      profile(breaker, 'phase_splitter_energy_seam', [[-0.035, 0.18], [0, 1.08], [0.035, 0.18]], 0.025, [0, 0, -0.135], p.energy, [0, 0, 0], 0.003);
      box(breaker, 'phase_splitter_root_clamp', [0.5, 0.2, 0.34], [0, 0.08, 0], p.dark);
      joints.breaker = breaker;
    }
  }
  return { root, joints };
}

function phaseBladeClips(root, joints) {
  const branch = root.userData.branch;
  return makeClips(root, joints, {
    idle: [2.6, (u, t, { set }) => {
      const wave = Math.sin(TAU * u);
      set('yaw', { r: [0, wave * 0.06, 0] });
      set('head', { r: [wave * 0.025, 0, 0] });
      set('bladeL', { r: [wave * 0.045, 0, wave * 0.055] });
      set('bladeR', { r: [-wave * 0.045, 0, -wave * 0.055] });
      set('pumpL', { p: [0, wave * 0.055, 0] });
      set('pumpR', { p: [0, -wave * 0.055, 0] });
      set('core', { r: [wave * 0.18, wave * 0.45, 0] });
      set('heart', { s: [1 + wave * 0.08, 1 + wave * 0.12, 1 + wave * 0.08] });
    }],
    move: [2.0, (u, t, { set }) => {
      const scan = Math.sin(TAU * u), cycle = Math.sin(TAU * u * 2);
      set('yaw', { r: [0, scan * 0.38, 0] });
      set('head', { r: [cycle * 0.08, 0, 0] });
      set('bladeL', { r: [scan * 0.14, 0, cycle * 0.08] });
      set('bladeR', { r: [scan * 0.14, 0, -cycle * 0.08] });
      set('pumpL', { p: [0, cycle * 0.07, 0] });
      set('pumpR', { p: [0, -cycle * 0.07, 0] });
      set('core', { r: [0, scan * 0.65, 0] });
    }],
    attack: [0.9, (u, t, { set }) => {
      const cut = pulse(u, 0.02, 0.38, 0.72), reclaim = pulse(u, 0.42, 0.68, 0.98);
      set('yaw', { r: [0, (0.5 - u) * cut * 0.9, 0] });
      set('head', { p: [0, -cut * 0.08, -cut * 0.2], r: [cut * 0.12, 0, 0] });
      set('bladeL', { r: [-cut * 1.28, 0, -cut * 0.55] });
      set('bladeR', { r: [-cut * 1.28, 0, cut * 0.55] });
      set('pumpL', { p: [0, reclaim * 0.18, 0] });
      set('pumpR', { p: [0, reclaim * 0.18, 0] });
      set('core', { r: [cut * 0.6, reclaim * 1.2, 0] });
      set('heart', { s: [1 + reclaim * 0.25, 1 + reclaim * 0.32, 1 + reclaim * 0.25] });
      if (joints.shearL) set('shearL', { r: [0, 0, cut * 0.52] });
      if (joints.shearR) set('shearR', { r: [0, 0, -cut * 0.52] });
      if (joints.breaker) set('breaker', { r: [-cut * 0.85, 0, 0] });
    }],
    windup: [1.25, (u, t, { set }) => {
      const charge = ease(u, 0, 0.88);
      set('head', { p: [0, charge * 0.12, charge * 0.16], r: [-charge * 0.12, 0, 0] });
      set('bladeL', { r: [charge * 0.48, 0, charge * 0.42] });
      set('bladeR', { r: [charge * 0.48, 0, -charge * 0.42] });
      set('pumpL', { p: [0, -charge * 0.16, 0] });
      set('pumpR', { p: [0, -charge * 0.16, 0] });
      set('core', { r: [charge * 0.8, charge * 1.8, 0] });
      set('heart', { s: [1 + charge * 0.34, 1 + charge * 0.44, 1 + charge * 0.34] });
      if (joints.manifold) set('manifold', { r: [0, 0, charge * 1.4] });
      if (joints.shearL) set('shearL', { r: [0, 0, -charge * 0.48] });
      if (joints.shearR) set('shearR', { r: [0, 0, charge * 0.48] });
    }],
    release: [1.0, (u, t, { set }) => {
      const cut = pulse(u, 0, 0.27, 0.66), suck = pulse(u, 0.3, 0.62, 0.98);
      set('yaw', { r: [0, Math.sin(u * Math.PI) * 0.42, 0] });
      set('head', { p: [0, -cut * 0.16, -cut * 0.34] });
      set('bladeL', { r: [-cut * 1.58, 0, -cut * 0.76] });
      set('bladeR', { r: [-cut * 1.58, 0, cut * 0.76] });
      set('pumpL', { p: [0, suck * 0.24, 0] });
      set('pumpR', { p: [0, suck * 0.24, 0] });
      set('core', { r: [suck * 0.7, suck * 2.2, 0] });
      set('heart', { s: [1 + suck * 0.4, 1 + suck * 0.48, 1 + suck * 0.4] });
      if (joints.manifold) set('manifold', { r: [0, 0, suck * TAU] });
      if (joints.shearL) set('shearL', { r: [0, 0, cut * 0.72] });
      if (joints.shearR) set('shearR', { r: [0, 0, -cut * 0.72] });
      if (joints.breaker) set('breaker', { r: [-cut * 1.15, 0, 0] });
    }],
    ability: [2.8, (u, t, { set }) => {
      const open = 0.5 - 0.5 * Math.cos(TAU * u), pump = Math.sin(TAU * u * 2);
      set('head', { r: [-open * 0.16, 0, 0] });
      set('bladeL', { r: [-open * 0.35, 0, open * 0.2] });
      set('bladeR', { r: [-open * 0.35, 0, -open * 0.2] });
      set('pumpL', { p: [0, pump * 0.18, 0] });
      set('pumpR', { p: [0, -pump * 0.18, 0] });
      set('core', { r: [open * 0.5, u * TAU, 0] });
      set('heart', { s: [1 + open * 0.3, 1 + open * 0.38, 1 + open * 0.3] });
      if (joints.manifold) set('manifold', { r: [0, 0, u * TAU * 2], s: [1 + open * 0.12, 1 + open * 0.12, 1 + open * 0.12] });
      if (joints.collectorL) set('collectorL', { r: [0, pump * 0.35, 0] });
      if (joints.collectorR) set('collectorR', { r: [0, -pump * 0.35, 0] });
      if (joints.shearL) set('shearL', { r: [0, 0, open * 0.65] });
      if (joints.shearR) set('shearR', { r: [0, 0, -open * 0.65] });
      if (joints.breaker) set('breaker', { r: [-open * 0.45, 0, 0] });
    }],
    shutdown: [2.5, (u, t, { set }) => {
      const fall = ease(u, 0.03, 0.84), flicker = Math.max(0, Math.sin(TAU * u * 5)) * (1 - fall);
      set('yaw', { r: [fall * 0.12, -fall * 0.18, -fall * 0.1] });
      set('head', { p: [0, -fall * 0.3, fall * 0.12], r: [fall * 0.35, 0, fall * 0.18] });
      set('bladeL', { p: [0, -fall * 0.18, 0], r: [fall * 0.65, 0, -fall * 0.62] });
      set('bladeR', { p: [0, -fall * 0.25, fall * 0.08], r: [fall * 0.9, 0, fall * 0.78] });
      set('pumpL', { p: [0, -fall * 0.2, 0], r: [0, 0, fall * 0.18] });
      set('pumpR', { p: [0, -fall * 0.26, 0], r: [0, 0, -fall * 0.24] });
      set('core', { r: [fall * 0.7, fall * 1.3, fall * 0.4] });
      set('heart', { s: [1 - fall * 0.84 + flicker * 0.07, 1 - fall * 0.84 + flicker * 0.07, 1 - fall * 0.84 + flicker * 0.07] });
      if (joints.manifold) set('manifold', { r: [fall * 0.5, 0, fall * 1.1] });
      if (joints.shearL) set('shearL', { r: [0, 0, fall * 0.7] });
      if (joints.shearR) set('shearR', { r: [0, 0, -fall * 0.9] });
      if (joints.breaker) set('breaker', { p: [0, -fall * 0.22, 0], r: [fall * 0.8, 0, fall * 0.3] });
    }],
  });
}

function buildBoundaryRiveter(variant) {
  const { level, branch } = variantSpec(variant);
  const p = palette('ally');
  const root = new THREE.Group();
  root.name = `boundary_riveter_${variant}_root`;
  root.userData = { variant, level, branch };
  anchoredBase(root, 'riveter', p, 2.72, 1.96, true);

  const carriage = part(root, 'riveter_carriage', [0, 0.48, 0]);
  const chassis = part(carriage, 'riveter_siege_chassis');
  box(chassis, 'riveter_lower_tub', [1.7, 0.32, 1.18], [0, 0.24, 0], p.dark);
  plate(chassis, 'riveter_sloped_front', 1.5, 0.66, 0.16, 0.12, [0, 0.55, -0.59], p.armor, [-0.2, 0, 0]);
  plate(chassis, 'riveter_front_laminate', 1.18, 0.4, 0.08, 0.07, [0, 0.55, -0.7], p.hull, [-0.2, 0, 0]);
  for (const side of [-1, 1]) {
    beam(chassis, `riveter_lower_load_strut_${side}`, [side * 0.9, 0.12, 0.5], [side * 0.55, 0.72, -0.48], 0.17, 0.2, p.edge);
    cylinder(chassis, `riveter_siege_buffer_${side}`, 0.14, 0.17, 0.56, [side * 0.69, 0.47, 0.38], p.gold, [0, 0, side * 0.4], 12);
  }

  const joints = { carriage };
  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R';
    const shell = part(carriage, `riveter_shell_${id}`, [side * 0.82, 0.82, -0.05], [0, side * 0.56, 0]);
    plate(shell, `riveter_shell_outer_${id}`, 0.66, 0.92, 0.15, 0.12, [0, 0, 0], p.armor);
    plate(shell, `riveter_shell_inner_${id}`, 0.48, 0.7, 0.09, 0.08, [0, 0, -0.11], p.hull);
    box(shell, `riveter_shell_rail_${id}`, [0.09, 0.78, 0.18], [side * 0.25, 0, 0.02], p.edge);
    for (const y of [-0.26, 0.26]) {
      cylinder(shell, `riveter_shell_bolt_${id}_${y}`, 0.065, 0.065, 0.09, [0, y, -0.18], p.gold, [Math.PI / 2, 0, 0], 6);
    }
    joints[`shell${id}`] = shell;
  }

  const gantry = part(carriage, 'riveter_gantry');
  for (const side of [-1, 1]) {
    for (const end of [-1, 1]) {
      box(gantry, `riveter_column_${side}_${end}`, [0.18, 1.38, 0.2], [side * 0.57, 1.03, end * 0.31], p.hull);
      beam(gantry, `riveter_gantry_brace_${side}_${end}`, [side * 0.73, 0.36, end * 0.42], [side * 0.57, 1.62, end * 0.31], 0.09, 0.11, p.edge);
    }
    box(gantry, `riveter_top_sidebeam_${side}`, [0.22, 0.2, 0.94], [side * 0.57, 1.69, 0], p.armor);
  }
  box(gantry, 'riveter_top_bridge', [1.4, 0.2, 0.26], [0, 1.69, 0.31], p.hull);
  pipe(gantry, 'riveter_pressure_line', [[-0.58, 0.42, 0.43], [-0.7, 1.42, 0.42], [0, 1.8, 0.4], [0.7, 1.42, 0.42], [0.58, 0.42, 0.43]], 0.04, p.accent);

  const press = part(carriage, 'riveter_press', [0, 1.47, 0]);
  plate(press, 'riveter_press_crosshead', 1.18, 0.34, 0.54, 0.08, [0, 0, -0.04], p.armor);
  cylinder(press, 'riveter_main_pressure_ram', 0.22, 0.26, 0.46, [0, 0.32, 0.04], p.dark, [0, 0, 0], 16);
  ring(press, 'riveter_pressure_band', 0.24, 0.035, [0, 0.43, 0.04], p.gold, [Math.PI / 2, 0, 0]);
  box(press, 'riveter_pressure_distribution_head', [0.94, 0.22, 0.64], [0, 0.63, -0.12], p.hull);
  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R';
    mesh(press, `riveter_hammer_guide_${id}`, annulusGeometry(0.20, 0.106, 0.80, 32), p.hull, [side * 0.38, 0.32, -0.45]);
    ring(press, `riveter_hammer_guide_seal_${id}`, 0.157, 0.025, [side * 0.38, -0.08, -0.45], p.edge, [Math.PI / 2, 0, 0]);
  }
  joints.press = press;
  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R';
    const hammer = part(press, `riveter_hammer_${id}`, [side * 0.38, -0.12, -0.45]);
    cylinder(hammer, `riveter_hammer_stem_${id}`, 0.095, 0.095, 1.0, [0, 0.18, 0], p.edge, [0, 0, 0], 24);
    cylinder(hammer, `riveter_hammer_case_${id}`, 0.18, 0.2, 0.52, [0, -0.2, 0], p.hull, [0, 0, 0], 12);
    cylinder(hammer, `riveter_hammer_rod_${id}`, 0.075, 0.075, 0.56, [0, -0.66, 0], p.edge, [0, 0, 0], 12);
    cylinder(hammer, `riveter_hammer_head_${id}`, 0.25, 0.29, 0.2, [0, -0.96, 0], p.dark, [0, 0, 0], 8);
    plate(hammer, `riveter_hammer_face_${id}`, 0.42, 0.42, 0.08, 0.06, [0, -1.07, 0], p.edge, [-Math.PI / 2, 0, 0]);
    for (let i = 0; i < 3; i++) ring(hammer, `riveter_hammer_spring_${id}_${i}`, 0.19, 0.022, [0, -0.05 - i * 0.11, 0], p.gold, [Math.PI / 2, 0, 0]);
    joints[`hammer${id}`] = hammer;
  }

  const ram = part(carriage, 'riveter_horizontal_ram', [0, 0.84, -0.65]);
  const ramGuide = part(carriage, 'riveter_horizontal_guide', [0, 0.84, -0.65]);
  mesh(ramGuide, 'riveter_horizontal_case', annulusGeometry(0.25, 0.098, 0.58, 32), p.hull, [0, 0, 0], [Math.PI / 2, 0, 0]);
  cylinder(ram, 'riveter_horizontal_rod', 0.085, 0.085, 1.20, [0, 0, -0.07], p.edge, [Math.PI / 2, 0, 0], 24);
  cylinder(ram, 'riveter_horizontal_die', 0.27, 0.21, 0.2, [0, 0, -0.72], p.dark, [Math.PI / 2, 0, 0], 8);
  cylinder(ram, 'riveter_horizontal_rivet', 0.11, 0.16, 0.22, [0, 0, -0.89], p.gold, [Math.PI / 2, 0, 0], 6);
  joints.ram = ram;

  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R';
    const jaw = part(carriage, `riveter_capture_jaw_${id}`, [side * 0.5, 0.3, -0.88], [0, -side * 0.15, 0]);
    plate(jaw, `riveter_jaw_plate_${id}`, 0.34, 0.54, 0.22, 0.07, [side * 0.12, 0, 0], p.hull, [0, 0, side * 0.18]);
    for (const y of [-0.16, 0.16]) {
      cone(jaw, `riveter_jaw_tooth_${id}_${y}`, 0.09, 0.3, [side * 0.29, y, -0.05], p.edge, [0, 0, -side * Math.PI / 2], 5);
    }
    cylinder(jaw, `riveter_jaw_pivot_${id}`, 0.13, 0.13, 0.42, [0, 0, 0.08], p.gold, [0, 0, 0], 12);
    joints[`jaw${id}`] = jaw;
  }

  const core = mindCore(carriage, 'riveter', p, [0, 1.11, -0.34], 0.82);
  joints.core = core.rotor;
  joints.heart = core.heart;

  const feed = part(carriage, 'riveter_feed', [0, 1.78, 0.34]);
  cylinder(feed, 'riveter_feed_drum', 0.28, 0.28, 0.64, [0, 0, 0], p.dark, [0, 0, Math.PI / 2], 12);
  for (const side of [-1, 1]) {
    ring(feed, `riveter_feed_flange_${side}`, 0.3, 0.035, [side * 0.33, 0, 0], p.gold, [0, Math.PI / 2, 0]);
    for (let i = 0; i < 4; i++) {
      const angle = i * TAU / 4;
      cylinder(feed, `riveter_feed_round_${side}_${i}`, 0.055, 0.075, 0.2, [side * 0.2, Math.cos(angle) * 0.2, Math.sin(angle) * 0.2], p.edge, [0, 0, Math.PI / 2], 6);
    }
  }
  box(feed, 'riveter_feed_rail', [0.18, 0.62, 0.16], [0, -0.42, -0.06], p.hull, [0.25, 0, 0]);
  joints.feed = feed;

  if (!branch) {
    socket(carriage, 'riveter_capped_repair_mount', [-0.91, 0.72, 0.4], p, [0, 0, Math.PI / 2], 0.16);
    socket(carriage, 'riveter_capped_winch_mount', [0.91, 0.72, 0.4], p, [0, 0, Math.PI / 2], 0.16);
  }

  if (branch === 'A') {
    const rack = part(carriage, 'riveter_repair_cassette', [0.83, 0.82, 0.46]);
    box(rack, 'riveter_cassette_frame', [0.42, 0.94, 0.36], [0, 0, 0], p.dark);
    for (let i = 0; i < (level === 3 ? 5 : 3); i++) {
      plate(rack, `riveter_spare_laminate_${i}`, 0.34, 0.5, 0.055, 0.05, [0, -0.2 + i * 0.11, -0.22 + i * 0.055], p.armor, [0.1, 0, 0]);
    }
    const armCount = level === 3 ? 2 : 1;
    for (let index = 0; index < armCount; index++) {
      const side = armCount === 1 ? -1 : (index === 0 ? -1 : 1);
      const id = side < 0 ? 'L' : 'R';
      socket(carriage, `riveter_repair_socket_${id}`, [side * 0.92, 0.69, 0.38], p, [0, 0, Math.PI / 2], 0.18);
      const shoulder = part(carriage, `riveter_repair_shoulder_${id}`, [side * 0.92, 0.72, 0.38]);
      cylinder(shoulder, `riveter_repair_slew_${id}`, 0.19, 0.19, 0.26, [0, 0, 0], p.dark, [0, 0, Math.PI / 2], 12);
      beam(shoulder, `riveter_repair_upper_${id}`, [0, 0, 0], [0, 0.56, 0], 0.14, 0.17, p.hull);
      beam(shoulder, `riveter_repair_upper_edge_${id}`, [side * 0.1, 0.02, 0], [side * 0.1, 0.52, 0], 0.045, 0.08, p.edge);
      const elbow = part(shoulder, `riveter_repair_elbow_${id}`, [0, 0.56, 0]);
      cylinder(elbow, `riveter_repair_elbow_pin_${id}`, 0.15, 0.15, 0.28, [0, 0, 0], p.gold, [0, 0, Math.PI / 2], 12);
      beam(elbow, `riveter_repair_forearm_${id}`, [0, 0, 0], [-side * 0.16, 0.24, -0.38], 0.13, 0.15, p.armor);
      const tool = part(elbow, `riveter_repair_tool_${id}`, [-side * 0.16, 0.24, -0.4]);
      cylinder(tool, `riveter_repair_tool_case_${id}`, 0.11, 0.15, 0.3, [0, 0, 0], p.dark, [Math.PI / 2, 0, 0], 12);
      ring(tool, `riveter_repair_weld_ring_${id}`, 0.12, 0.025, [0, 0, -0.18], p.energy);
      cone(tool, `riveter_repair_nozzle_${id}`, 0.07, 0.2, [0, 0, -0.28], p.edge, [Math.PI / 2, 0, 0], 8);
      joints[`repair${id}`] = shoulder;
      joints[`elbow${id}`] = elbow;
      joints[`tool${id}`] = tool;
    }
    if (level === 3) {
      const carousel = part(carriage, 'riveter_repair_carousel', [0, 1.98, 0.4]);
      ring(carousel, 'riveter_carousel_track', 0.46, 0.055, [0, 0, 0], p.hull, [Math.PI / 2, 0, 0]);
      cylinder(carousel, 'riveter_carousel_hub', 0.16, 0.2, 0.2, [0, 0, 0], p.gold, [0, 0, 0], 12);
      for (let i = 0; i < 6; i++) {
        const angle = i * TAU / 6;
        const cassette = part(carousel, `riveter_carousel_plate_${i}`, [Math.cos(angle) * 0.45, 0, Math.sin(angle) * 0.45], [0, -angle, 0]);
        plate(cassette, `riveter_carousel_laminate_${i}`, 0.2, 0.36, 0.07, 0.035, [0, -0.18, 0], p.armor);
        box(cassette, `riveter_carousel_clamp_${i}`, [0.12, 0.09, 0.12], [0, 0.04, 0], p.edge);
      }
      joints.carousel = carousel;
    }
  }

  if (branch === 'B') {
    for (const side of [-1, 1]) {
      const id = side < 0 ? 'L' : 'R';
      socket(carriage, `riveter_winch_socket_${id}`, [side * 0.96, 0.68, 0.26], p, [0, 0, Math.PI / 2], 0.19);
      const spool = part(carriage, `riveter_tether_spool_${id}`, [side * 0.98, 0.69, 0.25]);
      cylinder(spool, `riveter_spool_core_${id}`, 0.18, 0.18, 0.38, [0, 0, 0], p.dark, [0, 0, Math.PI / 2], 12);
      for (let i = -2; i <= 2; i++) ring(spool, `riveter_spool_winding_${id}_${i}`, 0.19, 0.025, [i * 0.065, 0, 0], p.gold, [0, Math.PI / 2, 0]);
      for (const end of [-1, 1]) ring(spool, `riveter_spool_flange_${id}_${end}`, 0.25, 0.035, [end * 0.23, 0, 0], p.armor, [0, Math.PI / 2, 0]);
      pipe(carriage, `riveter_tether_line_${id}`, [[side * 0.98, 0.67, 0.06], [side * 0.92, 0.42, -0.35], [side * 0.56, 0.3, -0.88]], 0.035, p.edge);
      joints[`spool${id}`] = spool;
      if (level === 3) {
        const upper = part(carriage, `riveter_upper_spool_${id}`, [side * 0.86, 1.24, 0.32]);
        cylinder(upper, `riveter_upper_spool_core_${id}`, 0.14, 0.14, 0.32, [0, 0, 0], p.hull, [0, 0, Math.PI / 2], 12);
        ring(upper, `riveter_upper_spool_flange_${id}`, 0.21, 0.035, [0, 0, 0], p.energy, [0, Math.PI / 2, 0]);
        beam(carriage, `riveter_upper_spool_mount_${id}`, [side * 0.72, 0.85, 0.34], [side * 0.86, 1.24, 0.32], 0.12, 0.13, p.edge);
        joints[`upperSpool${id}`] = upper;
      }
    }
    const bind = part(carriage, 'riveter_binding_yoke', [0, 0.48, -1.0]);
    box(bind, 'riveter_binding_crossbar', [1.18, 0.16, 0.2], [0, 0.28, 0], p.hull);
    for (const side of [-1, 1]) {
      box(bind, `riveter_binding_tine_${side}`, [0.16, 0.62, 0.18], [side * 0.5, 0, 0], p.armor, [0, 0, side * 0.12]);
      cone(bind, `riveter_binding_stake_${side}`, 0.12, 0.4, [side * 0.5, -0.42, 0], p.edge, [0, 0, Math.PI], 6);
      if (level === 3) cone(bind, `riveter_binding_outer_stake_${side}`, 0.1, 0.5, [side * 0.72, -0.2, 0.03], p.gold, [0, 0, Math.PI], 6);
    }
    ring(bind, 'riveter_binding_lock_halo', 0.26, 0.03, [0, 0.28, -0.13], p.energy);
    joints.bind = bind;
  }
  return { root, joints };
}

function riveterClips(root, joints) {
  const branch = root.userData.branch;
  return makeClips(root, joints, {
    idle: [3.0, (u, t, { set }) => {
      const wave = Math.sin(TAU * u);
      set('carriage', { r: [0, wave * 0.025, 0] });
      set('press', { p: [0, wave * 0.025, 0] });
      set('hammerL', { p: [0, wave * 0.035, 0] });
      set('hammerR', { p: [0, -wave * 0.035, 0] });
      set('ram', { p: [0, 0, wave * 0.025] });
      set('feed', { r: [wave * 0.12, 0, 0] });
      set('core', { r: [wave * 0.15, wave * 0.38, 0] });
      set('heart', { s: [1 + wave * 0.06, 1 + wave * 0.09, 1 + wave * 0.06] });
    }],
    move: [2.5, (u, t, { set }) => {
      const scan = Math.sin(TAU * u), test = Math.sin(TAU * u * 2);
      set('carriage', { r: [0, scan * 0.16, 0] });
      set('press', { p: [0, 0.06 * (0.5 + 0.5 * test), 0] });
      set('hammerL', { p: [0, -0.08 * (0.5 + 0.5 * scan), 0] });
      set('hammerR', { p: [0, -0.08 * (0.5 - 0.5 * scan), 0] });
      set('ram', { p: [0, 0, -0.09 * (0.5 + 0.5 * test)] });
      set('jawL', { r: [0, scan * 0.16, 0] });
      set('jawR', { r: [0, -scan * 0.16, 0] });
      set('core', { r: [0, scan * 0.5, 0] });
    }],
    attack: [1.4, (u, t, { set }) => {
      const left = pulse(u, 0.02, 0.25, 0.48), right = pulse(u, 0.38, 0.62, 0.85), ram = pulse(u, 0.68, 0.84, 1);
      set('carriage', { r: [(left + right) * 0.035, (left - right) * 0.06, 0] });
      set('press', { p: [0, -(left + right) * 0.12, 0] });
      set('hammerL', { p: [0, -left * 0.48, 0] });
      set('hammerR', { p: [0, -right * 0.48, 0] });
      set('ram', { p: [0, 0, -ram * 0.42] });
      set('feed', { r: [(left + right + ram) * 0.5, 0, 0] });
      set('jawL', { r: [0, ram * 0.28, 0] });
      set('jawR', { r: [0, -ram * 0.28, 0] });
      set('heart', { s: [1 + ram * 0.18, 1 + ram * 0.22, 1 + ram * 0.18] });
      if (joints.bind) set('bind', { p: [0, -ram * 0.12, 0] });
    }],
    windup: [1.55, (u, t, { set }) => {
      const charge = ease(u, 0, 0.9);
      set('press', { p: [0, charge * 0.3, 0] });
      set('hammerL', { p: [0, charge * 0.14, 0] });
      set('hammerR', { p: [0, charge * 0.14, 0] });
      set('ram', { p: [0, 0, charge * 0.22] });
      set('jawL', { r: [0, -charge * 0.42, 0] });
      set('jawR', { r: [0, charge * 0.42, 0] });
      set('feed', { r: [charge * 0.8, 0, 0] });
      set('core', { r: [charge * 0.6, charge * 1.6, 0] });
      set('heart', { s: [1 + charge * 0.3, 1 + charge * 0.4, 1 + charge * 0.3] });
      set('shellL', { p: [charge * 0.08, 0, 0] });
      set('shellR', { p: [-charge * 0.08, 0, 0] });
      if (joints.bind) set('bind', { p: [0, charge * 0.26, 0] });
    }],
    release: [1.3, (u, t, { set }) => {
      const hit = pulse(u, 0, 0.25, 0.7), settle = pulse(u, 0.25, 0.58, 1);
      set('carriage', { r: [hit * 0.075, 0, 0] });
      set('press', { p: [0, -hit * 0.28, 0] });
      set('hammerL', { p: [0, -hit * 0.58, 0] });
      set('hammerR', { p: [0, -hit * 0.58, 0] });
      set('ram', { p: [0, 0, -hit * 0.55] });
      set('feed', { r: [hit * 1.3 + settle * 0.4, 0, 0] });
      set('jawL', { r: [0, hit * 0.52, 0] });
      set('jawR', { r: [0, -hit * 0.52, 0] });
      set('shellL', { p: [-hit * 0.06, 0, hit * 0.04] });
      set('shellR', { p: [hit * 0.06, 0, hit * 0.04] });
      set('core', { r: [hit * 0.7, settle * 1.8, 0] });
      set('heart', { s: [1 + hit * 0.3, 1 + hit * 0.36, 1 + hit * 0.3] });
      if (joints.bind) set('bind', { p: [0, -hit * 0.3, 0] });
    }],
    ability: [3.2, (u, t, { set }) => {
      const open = 0.5 - 0.5 * Math.cos(TAU * u), cycle = Math.sin(TAU * u * 2);
      set('press', { p: [0, open * 0.08, 0] });
      set('shellL', { p: [-open * 0.08, 0, 0], r: [0, -open * 0.12, 0] });
      set('shellR', { p: [open * 0.08, 0, 0], r: [0, open * 0.12, 0] });
      set('core', { r: [open * 0.45, u * TAU, 0] });
      set('heart', { s: [1 + open * 0.26, 1 + open * 0.34, 1 + open * 0.26] });
      set('feed', { r: [u * TAU * 0.5, 0, 0] });
      set('jawL', { r: [0, open * 0.2, 0] });
      set('jawR', { r: [0, -open * 0.2, 0] });
      if (branch === 'A') {
        if (joints.repairL) set('repairL', { r: [-open * 0.65, open * 0.25, open * 0.65] });
        if (joints.elbowL) set('elbowL', { r: [-open * 0.8, 0, -open * 0.45] });
        if (joints.toolL) set('toolL', { r: [0, 0, u * TAU * 2], s: [1 + cycle * 0.08, 1 + cycle * 0.08, 1 + cycle * 0.08] });
        if (joints.repairR) set('repairR', { r: [-open * 0.55, -open * 0.25, -open * 0.65] });
        if (joints.elbowR) set('elbowR', { r: [-open * 0.9, 0, open * 0.45] });
        if (joints.toolR) set('toolR', { r: [0, 0, -u * TAU * 2], s: [1 - cycle * 0.08, 1 - cycle * 0.08, 1 - cycle * 0.08] });
        if (joints.carousel) set('carousel', { r: [0, u * TAU, 0] });
      } else {
        set('ram', { p: [0, 0, -open * 0.18] });
        set('jawL', { r: [0, open * 0.58, 0] });
        set('jawR', { r: [0, -open * 0.58, 0] });
      }
      if (joints.bind) set('bind', { p: [0, -open * 0.24, 0], r: [open * 0.12, 0, 0] });
      if (joints.spoolL) set('spoolL', { r: [u * TAU * 2, 0, 0] });
      if (joints.spoolR) set('spoolR', { r: [-u * TAU * 2, 0, 0] });
      if (joints.upperSpoolL) set('upperSpoolL', { r: [-u * TAU * 2, 0, 0] });
      if (joints.upperSpoolR) set('upperSpoolR', { r: [u * TAU * 2, 0, 0] });
    }],
    shutdown: [2.9, (u, t, { set }) => {
      const fall = ease(u, 0.03, 0.84), flicker = Math.max(0, Math.sin(TAU * u * 4)) * (1 - fall);
      set('carriage', { r: [fall * 0.08, fall * 0.12, -fall * 0.12] });
      set('press', { p: [0, -fall * 0.48, fall * 0.08], r: [fall * 0.18, 0, fall * 0.16] });
      set('hammerL', { p: [0, -fall * 0.32, 0], r: [0, 0, -fall * 0.2] });
      set('hammerR', { p: [0, -fall * 0.42, fall * 0.06], r: [fall * 0.2, 0, fall * 0.3] });
      set('ram', { p: [0, -fall * 0.12, fall * 0.22], r: [fall * 0.45, 0, 0] });
      set('jawL', { r: [fall * 0.3, -fall * 0.6, -fall * 0.25] });
      set('jawR', { r: [fall * 0.2, fall * 0.72, fall * 0.3] });
      set('feed', { p: [0, -fall * 0.24, 0], r: [fall * 1.1, 0, fall * 0.2] });
      set('shellL', { p: [-fall * 0.12, -fall * 0.12, 0], r: [fall * 0.3, -fall * 0.25, -fall * 0.35] });
      set('shellR', { p: [fall * 0.16, -fall * 0.18, 0], r: [fall * 0.4, fall * 0.28, fall * 0.42] });
      set('core', { r: [fall * 0.65, fall * 1.2, fall * 0.4] });
      set('heart', { s: [1 - fall * 0.84 + flicker * 0.07, 1 - fall * 0.84 + flicker * 0.07, 1 - fall * 0.84 + flicker * 0.07] });
      if (joints.repairL) set('repairL', { r: [fall * 0.6, 0, -fall * 0.8] });
      if (joints.elbowL) set('elbowL', { r: [fall * 0.8, 0, fall * 0.5] });
      if (joints.repairR) set('repairR', { r: [fall * 0.7, 0, fall * 0.85] });
      if (joints.elbowR) set('elbowR', { r: [fall * 0.9, 0, -fall * 0.5] });
      if (joints.carousel) set('carousel', { p: [0, -fall * 0.28, 0], r: [fall * 0.3, fall * 0.8, 0] });
      if (joints.spoolL) set('spoolL', { r: [fall * 2.2, 0, -fall * 0.3] });
      if (joints.spoolR) set('spoolR', { r: [-fall * 2.5, 0, fall * 0.35] });
      if (joints.bind) set('bind', { p: [0, -fall * 0.28, fall * 0.12], r: [fall * 0.5, 0, fall * 0.2] });
    }],
  });
}

export const entities = [
  defineEntity({
    id: 'anchor_bulwark',
    name: '锚定壁垒',
    kind: 'building',
    role: 'melee',
    locomotion: 'anchored',
    variants: VARIANTS,
    concept: '四脚深锚承载的可转近战壁垒，双伸缩拳与正面共振角负责嘲讽和贴身击退。',
    mechanism: 'A 分支把冲击导入外露反震弹簧与配重；B 分支展开护佑翼板、深层桩脚和友军减伤发射冠。',
    build: buildBulwark,
    clips: bulwarkClips,
  }),
  defineEntity({
    id: 'phase_blade',
    name: '相位刃',
    kind: 'building',
    role: 'melee',
    locomotion: 'anchored',
    variants: VARIANTS,
    concept: '锚定双刀架上的弧形相位刃，刀脊回流管、双泵和前置心智晶体把命中能量抽回机体。',
    mechanism: 'A 分支增加吸能环、储能与回流歧管；B 分支增加对向剪刃、解甲齿和解甲冲角。',
    build: buildPhaseBlade,
    clips: phaseBladeClips,
  }),
  defineEntity({
    id: 'boundary_riveter',
    name: '边界铆钉',
    kind: 'building',
    role: 'melee',
    locomotion: 'anchored',
    variants: VARIANTS,
    concept: '宽跨锚脚、层叠抗攻城壳与门式液压架构成的近战铆压机，双垂锤、水平铆冲和夹持颚协同工作。',
    mechanism: 'A 分支以机械修臂和替换装甲盒执行自修；B 分支以绞盘、系桩索和束缚钳完成命中定身。',
    build: buildBoundaryRiveter,
    clips: riveterClips,
  }),
];
