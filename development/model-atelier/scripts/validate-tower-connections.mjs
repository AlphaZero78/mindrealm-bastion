import { registerHooks } from 'node:module';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'three') return { url: new URL('../vendor/three/build/three.module.js', import.meta.url).href, shortCircuit: true };
  return next(specifier, context);
} });
const THREE = await import('../vendor/three/build/three.module.js');
const { initializeEntityDefinitions, entityDefinitions } = await import('../src/entities/index.js');
const { createGameClips } = await import('../src/animations.js');
await initializeEntityDefinitions();
const ids = ['anchor_bulwark', 'phase_blade', 'boundary_riveter', 'resonance_guard', 'pulse_array', 'drone_loom', 'bandwidth_relay', 'memory_mechanic', 'frequency_choir', 'focus_rail', 'arc_mortar', 'resistance_beacon', 'memory_runner', 'repair_skiff', 'null_wing'];
const report = { scope: 'Explicit mechanical engagements, axis alignment, docking clearances and repair work envelopes across the source animation clips. General mesh collision and visual quality are reviewed separately.', appearances: 0, clips: 0, samples: 0, measurements: {} };
const record = (label, value, mode = 'min') => {
  report.measurements[label] = report.measurements[label] === undefined ? value : Math[mode](report.measurements[label], value);
};
const point = new THREE.Vector3();
function boundsIn(node, frame) {
  const result = new THREE.Box3();
  const inverse = frame.matrixWorld.clone().invert();
  node.traverse(child => {
    if (!child.isMesh) return;
    const matrix = inverse.clone().multiply(child.matrixWorld), positions = child.geometry.getAttribute('position');
    for (let index = 0; index < positions.count; index++) result.expandByPoint(point.fromBufferAttribute(positions, index).applyMatrix4(matrix));
  });
  return result;
}
function overlap(a, b, axis) { return Math.min(a.max[axis], b.max[axis]) - Math.max(a.min[axis], b.min[axis]); }
const clipNames = ['idle', 'move', 'attack', 'windup', 'release', 'ability', 'shutdown'];
for (const id of ids) for (const variant of entityDefinitions[id].variants) {
  const definition = entityDefinitions[id], { root, joints } = definition.build(variant);
  const nodes = new Map(); root.traverse(node => nodes.set(node.name, node));
  const node = name => { const value = nodes.get(name); assert.ok(value, `${id}/${variant}: missing ${name}`); return value; };
  const suffix = name => node(`${id}_${variant}_${name}`);
  const clips = createGameClips(id, root, joints, definition);
  assert.deepEqual(clips.map(clip => clip.name), clipNames);
  report.appearances++; report.clips += clips.length;
  for (const clip of clips) {
    const mixer = new THREE.AnimationMixer(root), action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true; action.play();
    for (let frame = 0; frame <= 48; frame++) {
      const fraction = frame / 48;
      mixer.setTime(clip.duration * fraction); root.updateMatrixWorld(true); report.samples++;
      for (const joint of Object.values(joints)) assert.ok(joint.matrixWorld.elements.every(Number.isFinite), `${id}/${variant}/${clip.name}: finite pose`);
      for (const link of root.userData.mechanicalLinks || []) {
        const from = new THREE.Vector3(...link.from.point).applyMatrix4(node(link.from.node).matrixWorld);
        const to = new THREE.Vector3(...link.to.point).applyMatrix4(node(link.to.node).matrixWorld);
        const error = Math.max(from.distanceTo(node(link.sleeve).getWorldPosition(new THREE.Vector3())), to.distanceTo(node(link.rod).getWorldPosition(new THREE.Vector3())));
        assert.ok(error < 0.001, `${id}/${variant}/${clip.name}/${link.key}: actuator disconnected ${error}`);
        record('actuatorEndpointError', error, 'max');
      }
      if (clip.name === 'shutdown') continue;
      const engage = (label, shaft, guide, reference, axis, minimum) => {
        const value = overlap(boundsIn(shaft, reference), boundsIn(guide, reference), axis);
        assert.ok(value >= minimum, `${id}/${variant}/${clip.name}/${label}: engagement ${value}`); record(label, value);
      };
      if (id === 'anchor_bulwark') for (const side of ['L', 'R']) {
        engage('bulwarkRamEngagement', node(`bulwark_ram_rod_${side}`), node(`bulwark_ram_cylinder_${side}`), joints[`arm${side}`], 'z', 0.18);
        const guide = node(`bulwark_ram_cylinder_${side}`), rod = node(`bulwark_ram_rod_${side}`);
        const delta = rod.getWorldPosition(new THREE.Vector3()).applyMatrix4(guide.matrixWorld.clone().invert());
        const error = Math.hypot(delta.x, delta.z); assert.ok(error < 0.001, `bulwark off-axis rod ${error}`); record('bulwarkRadialAxisError', error, 'max');
      }
      if (id === 'boundary_riveter') engage('riveterHorizontalEngagement', node('riveter_horizontal_rod'), node('riveter_horizontal_case'), node('riveter_horizontal_guide'), 'z', 0.2);
      if (id === 'resonance_guard') for (const side of [-1, 1]) engage('guardRamEngagement', node(`guard_ram_piston_${side}`), node(`guard_ram_cylinder_${side}`), node('guard_fixed_ram_guide'), 'z', 0.2);
      if (id === 'memory_runner') engage('imprintRamEngagement', node('Imprint ram'), node('Imprint guide'), node('Imprint_fixed_guide'), 'z', 0.18);
      if (id === 'null_wing') engage('invasionProbeEngagement', node('Invasion needle'), node('Invasion guide'), node('Invasion_fixed_guide'), 'z', 0.22);
      if (id === 'bandwidth_relay') for (const side of [-1, 1]) engage('relayDockEngagement', suffix(`dock_rail_${side}`), suffix(`dock_fixed_guide_${side}`), joints.elevation, 'z', 0.20);
      if (id === 'pulse_array' && variant === 'T3A') {
        const bar = boundsIn(node('pulse_chain_timing_bar'), joints.carriage);
        for (const index of [5, 6]) {
          const clearance = bar.min.y - boundsIn(joints[`needle${index}`], joints.carriage).max.y;
          assert.ok(clearance > 0.05, `pulse upper row intersects timing bar ${clearance}`); record('pulseUpperTimingClearance', clearance);
        }
      }
      if (id === 'memory_mechanic') {
        const left = joints.weldL.getWorldPosition(new THREE.Vector3()), right = joints.weldR.getWorldPosition(new THREE.Vector3());
        assert.ok(left.x < -0.19 && right.x > 0.19, `${id}/${variant}/${clip.name}: tools crossed`); record('repairToolSeparation', right.x - left.x);
        const plate = boundsIn(suffix('ally_plate'), joints.workpiece), contact = boundsIn(suffix('press_contact'), joints.workpiece);
        const pressClearance = contact.min.y - plate.max.y;
        assert.ok(pressClearance > 0.009, `${id}/${variant}/${clip.name}: press passes through plate ${pressClearance}`); record('repairPressClearance', pressClearance);
        engage('repairScannerEngagement', suffix('aux_inner_ram'), suffix('aux_outer_ram'), suffix('aux_fixed_guide'), 'y', 0.14);
        engage('repairPressEngagement', suffix('press_ram'), suffix('press_guide_sleeve'), suffix('press_fixed_guide'), 'y', 0.20);
        if (clip.name === 'release' && Math.abs(fraction - 0.34) < 0.015) for (const tool of [left, right]) {
          const local = tool.clone().applyMatrix4(joints.workpiece.matrixWorld.clone().invert());
          assert.ok(Math.abs(local.x) <= 0.22 && local.z > -0.16 && local.z < -0.11 && local.y > 0.06 && local.y < 0.105, `repair tool misses workpiece ${local.toArray()}`);
          record('repairPeakTipHeightAbovePlate', local.y - plate.max.y, 'max');
        }
      }
      if (id === 'frequency_choir') for (const label of ['L', 'R', 'C']) {
        assert.equal(joints[`damper${label}`].parent, joints[`voice${label}`], 'damper must follow its voice hinge');
        for (const side of [-1, 1]) engage('choirDamperEngagement', suffix(`damper_piston_${label}_${side}`), suffix(`damper_guide_${label}_${side}`), joints[`voice${label}`], 'y', 0.17);
      }
      if (id === 'drone_loom' && clip.name === 'idle') for (const label of ['L', 'R']) {
        const lower = label.toLowerCase(), drone = boundsIn(joints[`drone${label}`], joints.body);
        const left = boundsIn(node(`loom_bay_${lower}_wall_-1`), joints.body), right = boundsIn(node(`loom_bay_${lower}_wall_1`), joints.body);
        const floor = boundsIn(node(`loom_bay_${lower}_floor`), joints.body), roof = boundsIn(node(`loom_hatch_${lower}_door`), joints.body);
        const clearances = [drone.min.x - left.max.x, right.min.x - drone.max.x, drone.min.y - floor.max.y, roof.min.y - drone.max.y];
        assert.ok(clearances.every(value => value > 0.002), `${id}/${variant}/${label}: dock penetration ${clearances}`);
        record('loomDockMinimumClearance', Math.min(...clearances));
      }
    }
    mixer.stopAllAction(); mixer.uncacheRoot(root);
  }
  const geometries = new Set(), materials = new Set(); root.traverse(node => { if (node.isMesh) { geometries.add(node.geometry); for (const material of Array.isArray(node.material) ? node.material : [node.material]) materials.add(material); } });
  for (const geometry of geometries) geometry.dispose(); for (const material of materials) material.dispose();
}
assert.equal(report.appearances, 63);
report.status = 'TOWER_CONNECTIONS_OK';
await mkdir(new URL('../qa/refinement/', import.meta.url), { recursive: true });
await writeFile(new URL('../qa/refinement/tower-connections.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
