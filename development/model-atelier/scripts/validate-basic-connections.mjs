import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';

registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'three') return { url: new URL('../vendor/three/build/three.module.js', import.meta.url).href, shortCircuit: true };
  if (specifier.startsWith('three/addons/')) return { url: new URL(`../vendor/three/examples/jsm/${specifier.slice(13)}`, import.meta.url).href, shortCircuit: true };
  return next(specifier, context);
} });
globalThis.FileReader ||= class { readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.({ target: this }); }); } };

const THREE = await import('../vendor/three/build/three.module.js');
const [{ GLTFExporter }, { GLTFLoader }, { mergeStaticMeshes }, { createEntityMixer }] = await Promise.all([
  import('../vendor/three/examples/jsm/exporters/GLTFExporter.js'), import('../vendor/three/examples/jsm/loaders/GLTFLoader.js'),
  import('../src/geometry.js'), import('../src/runtime/entity-animation.js'),
]);
const definitions = (await Promise.all(['base-frontier', 'noise-support', 'memory-factory'].map(name => import(`../src/entities/${name}.js`)))).flatMap(module => module.entities);
assert.equal(definitions.length, 15);
const sourceChecks = [], exportedChecks = [];
const forwardSliders = {
  static_drifter: ['sd_ram_piston', 'sd_ram_sleeve_jacket'], spike_runner: ['sr_lance_piston', 'sr_lance_sleeve_jacket'],
  shield_echo: ['se_ram_core', 'se_ram_sleeve_jacket'], tempo_amplifier: ['ta_striker_piston', 'ta_striker_sleeve_jacket'],
  fracture_seed: ['fs_drill_piston', 'fs_drill_sleeve_jacket'], floating_noise: ['fn_needle_piston', 'fn_needle_sleeve_jacket'],
  siege_ram: ['ram_piston', 'ram_hydraulic_reservoir'],
};

function relativeBounds(node, ancestor) {
  assert.ok(node?.isMesh, 'Measured part must exist');
  node.geometry.computeBoundingBox();
  return node.geometry.boundingBox.clone().applyMatrix4(ancestor.matrixWorld.clone().invert().multiply(node.matrixWorld));
}
function point(node, coordinates = [0, 0, 0]) { return node.localToWorld(new THREE.Vector3(...coordinates)); }

function inspectSource(root, joints, id, clips) {
  const measurements = { pistonEngagement: Infinity, capacitorEngagement: Infinity, crownEngagement: Infinity, ramClearance: Infinity, scopeRailMargin: Infinity, hatchError: 0, bellClearance: Infinity };
  const sliders = forwardSliders[id]?.map(name => root.getObjectByName(name));
  const cavity = [[-0.40, 0.59], [-0.34, 0.54], [-0.29, 0.50], [-0.08, 0.43], [0.16, 0.34], [0.35, 0.24], [0.39, 0.15], [0.46, 0.11]];
  for (const [name, node] of Object.entries(joints)) if (/^(leg\d+Hip|hip(?:[FR])?[LR])$/.test(name)) assert.equal(node.parent, joints.body, `${id}/${name}: hip must remain attached to the body`);
  for (const clip of clips) {
    const mixer = new THREE.AnimationMixer(root);
    mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1).play();
    for (let frame = 0; frame <= 64; frame++) {
      mixer.setTime(clip.duration * frame / 64);root.updateMatrixWorld(true);
      root.traverse(node => { for (const value of node.matrixWorld.elements) assert.ok(Number.isFinite(value), `${id}/${clip.name}: invalid transform`); });
      if (id === 'replication_node') for (const side of [-1, 1]) {
        const label = side < 0 ? 'L' : 'R', door = joints[`door${label}`];
        for (const y of [-0.27, 0.27]) measurements.hatchError = Math.max(measurements.hatchError, point(door, [0, y, 0]).distanceTo(point(joints.pod, [side * 0.39, 0.55 + y, 0.27])));
      }
      if (clip.name === 'shutdown') continue; // Deliberate broken/de-energized end poses keep their authored motion.
      if (sliders) {
        const [shaft, sleeve] = sliders, space = sleeve.parent;
        measurements.pistonEngagement = Math.min(measurements.pistonEngagement, relativeBounds(shaft, space).max.z - relativeBounds(sleeve, space).min.z);
      }
      if (id === 'shield_echo') for (const side of ['L', 'R']) {
        const sleeve = root.getObjectByName(`se_capacitor_jacket_${side}`), shaft = root.getObjectByName(`se_capacitor_rod_${side}`);
        measurements.capacitorEngagement = Math.min(measurements.capacitorEngagement, relativeBounds(sleeve, joints.body).max.y - relativeBounds(shaft, joints.body).min.y);
      }
      if (id === 'tempo_amplifier') for (const side of [-1, 1]) measurements.crownEngagement = Math.min(measurements.crownEngagement, relativeBounds(root.getObjectByName(`ta_crown_guide_${side}`), joints.body).max.y - relativeBounds(root.getObjectByName(`ta_crown_stem_${side}`), joints.body).min.y);
      if (id === 'siege_ram') measurements.ramClearance = Math.min(measurements.ramClearance, relativeBounds(root.getObjectByName('ram_chamfered_chassis'), joints.body).min.z - relativeBounds(root.getObjectByName('ram_hammer_head'), joints.body).max.z);
      if (id === 'remote_hunter') {
        const saddle = relativeBounds(root.getObjectByName('hunter_scope_sliding_saddle'), joints.gun);
        const rail = relativeBounds(root.getObjectByName('hunter_scope_slide_rail_1'), joints.gun);
        measurements.scopeRailMargin = Math.min(measurements.scopeRailMargin, saddle.min.z - rail.min.z, rail.max.z - saddle.max.z);
      }
      if (id === 'noise_bell') {
        const weight = root.getObjectByName('bell_clapper_weight'), positions = weight.geometry.getAttribute('position');
        const transform = joints.bell.matrixWorld.clone().invert().multiply(weight.matrixWorld), vertex = new THREE.Vector3();
        for (let index = 0; index < positions.count; index++) {
          vertex.fromBufferAttribute(positions, index).applyMatrix4(transform);vertex.y += 0.47;vertex.z += 0.02;
          const segment = cavity.findIndex((p, i) => i && p[0] >= vertex.y && cavity[i - 1][0] <= vertex.y);
          if (segment < 1) continue;
          const [a, b] = [cavity[segment - 1], cavity[segment]], fraction = (vertex.y - a[0]) / (b[0] - a[0]);
          const innerRadius = a[1] + (b[1] - a[1]) * fraction;
          measurements.bellClearance = Math.min(measurements.bellClearance, innerRadius - Math.hypot(vertex.x, vertex.z));
        }
      }
    }
    mixer.stopAllAction();mixer.uncacheRoot(root);
  }
  if (sliders) assert.ok(measurements.pistonEngagement >= 0.07, `${id}: piston pulls free (${measurements.pistonEngagement})`);
  if (id === 'shield_echo') assert.ok(measurements.capacitorEngagement >= 0.08, 'Shield capacitor loses guide engagement');
  if (id === 'tempo_amplifier') assert.ok(measurements.crownEngagement >= 0.08, 'Tuning crown loses its guide');
  if (id === 'siege_ram') assert.ok(measurements.ramClearance >= 0.08, `Hammer retracts inside chassis (${measurements.ramClearance})`);
  if (id === 'remote_hunter') assert.ok(measurements.scopeRailMargin >= 0.05, 'Scope slides off its mounting rail');
  if (id === 'replication_node') {
    assert.ok(measurements.hatchError < 1e-6, 'Hatch hinge leaves the fixed bearing');
    const glass = root.getObjectByName('replicator_chamber_glass').geometry.getAttribute('position');
    for (let i = 0; i < glass.count; i++) assert.ok(glass.getZ(i) >= -1e-7, 'Glass obstructs the front egress opening');
  }
  if (id === 'noise_bell') assert.ok(measurements.bellClearance >= 0.01, `Clapper passes through bell wall (${measurements.bellClearance})`);
  return Object.fromEntries(Object.entries(measurements).filter(([, value]) => Number.isFinite(value)));
}

function measureLinks(root) {
  root.updateMatrixWorld(true);
  let endpoint = 0, axial = 0, engagement = 0;
  for (const link of root.userData.mechanicalLinks || []) {
    const from = root.getObjectByName(link.from.node), to = root.getObjectByName(link.to.node);
    const sleeve = root.getObjectByName(link.sleeve), rod = root.getObjectByName(link.rod), shaft = root.getObjectByName(link.shaft);
    assert.ok(from && to && sleeve && rod && shaft, `${link.key}: exported link metadata must resolve`);
    const a = point(from, link.from.point), b = point(to, link.to.point), axis = b.clone().sub(a).normalize();
    endpoint = Math.max(endpoint, a.distanceTo(point(sleeve)), b.distanceTo(point(rod)));
    const front = point(sleeve, [0, link.sleeveLength, 0]), back = point(shaft, [0, 1, 0]);
    const offset = front.clone().sub(back), expectedOverlap = offset.dot(axis);
    axial = Math.max(axial, offset.clone().addScaledVector(axis, -expectedOverlap).length());
    engagement = Math.max(engagement, Math.abs(expectedOverlap - link.overlap));
  }
  return { endpoint, axial, engagement };
}

for (const definition of definitions) {
  const { root, joints } = definition.build('base');root.name = `${definition.id}__base`;
  const clips = definition.clips(root, joints);
  assert.deepEqual(clips.map(clip => clip.name), ['idle', 'move', 'attack', 'windup', 'release', 'ability', 'shutdown']);
  sourceChecks.push({ id: definition.id, frames: clips.length * 65, ...inspectSource(root, joints, definition.id, clips) });
  mergeStaticMeshes(root);
  const scene = new THREE.Scene();scene.add(root);
  const binary = await new GLTFExporter().parseAsync(scene, { binary: true, trs: true, onlyVisible: false, animations: clips });
  const gltf = await new GLTFLoader().parseAsync(binary, '');
  const model = gltf.scene.getObjectByName(root.name);
  assert.equal(gltf.animations.length, 7);
  const control = createEntityMixer(model, gltf.animations, { grounded: false });
  const maximum = { endpoint: 0, axial: 0, engagement: 0 };
  let samples = 0;
  const inspect = pose => {
    control.sample(pose);const measured = measureLinks(model);samples++;
    for (const [key, value] of Object.entries(measured)) maximum[key] = Math.max(maximum[key], value);
  };
  for (const action of ['idle', 'move', 'attack', 'ability', 'death']) for (let frame = 0; frame <= 32; frame++) inspect({ action, clock: frame * 77, progress: frame / 32, shutdownProgress: frame / 32, travel: frame * 0.087, air: definition.locomotion === 'hover' });
  for (const stage of ['windup', 'release']) for (const moving of [false, true]) for (let frame = 0; frame <= 32; frame++) inspect({ action: 'cast', stage, moving, clock: frame * 93, progress: frame / 32, travel: frame * 0.137, air: definition.locomotion === 'hover' });
  assert.ok(maximum.endpoint < 1e-5 && maximum.axial < 1e-5 && maximum.engagement < 1e-5, `${definition.id}: exported mixed-animation connection mismatch ${JSON.stringify(maximum)}`);
  control.dispose();
  exportedChecks.push({ id: definition.id, clips: gltf.animations.length, links: model.userData.mechanicalLinks?.length || 0, bytes: binary.byteLength, samples, maximum });
  for (const tree of [root, gltf.scene]) tree.traverse(node => { if (node.isMesh) { node.geometry.dispose(); for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.dispose(); } });
  console.log(`${definition.id}: source assembly and exported seven-clip/moving-cast connection checks passed`);
}
const output = new URL('../qa/refinement/basic-connections.json', import.meta.url);
await mkdir(new URL('./', output), { recursive: true });
await writeFile(output, JSON.stringify({ status: 'BASIC_CONNECTION_REFINEMENT_OK', scope: '15 source models, operational sleeve/hinge/cavity checks, and real GLB round trips sampled through the production mixer including moving casts. Visual inspection is separate; this is not arbitrary collision detection.', sourceChecks, exportedChecks }, null, 2) + '\n');
console.log(`BASIC_CONNECTION_REFINEMENT_OK models=${definitions.length} sourceFrames=${sourceChecks.reduce((sum, row) => sum + row.frames, 0)} glbSamples=${exportedChecks.reduce((sum, row) => sum + row.samples, 0)}`);
