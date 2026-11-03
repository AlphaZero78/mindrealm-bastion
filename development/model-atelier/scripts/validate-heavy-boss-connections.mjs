import { registerHooks } from 'node:module';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'three') return { url: new URL('../vendor/three/build/three.module.js', import.meta.url).href, shortCircuit: true };
  if (specifier.startsWith('three/addons/')) return { url: new URL('../vendor/three/examples/jsm/' + specifier.slice(13), import.meta.url).href, shortCircuit: true };
  return next(specifier, context);
} });
const THREE = await import('../vendor/three/build/three.module.js');
const files = ['heavy-ground', 'signal-operations', 'elite-watch', 'boss-frontier', 'boss-control'];
const definitions = (await Promise.all(files.map(file => import(`../src/entities/${file}.js`)))).flatMap(module => module.entities);
const only = process.argv.find(arg => arg.startsWith('--id='))?.slice(5);
const runtime = process.argv.includes('--runtime');
const { createEntityMixer } = runtime ? await import('../src/runtime/entity-animation.js') : {};
const records = [], errors = [];
const requiredConnections = {
  armored_worm: ['wormNeck'], ordered_sentinel: ['sentinelWristL', 'sentinelWristR'],
  shield_conductor: ['shieldCrownStem'], noise_hive: ['noiseRam', 'noiseCrownLift', 'noiseCarouselLift'],
  mirror_censor: ['mirrorRamL', 'mirrorRamR', 'mirrorCrownLiftL', 'mirrorCrownLiftR'],
  memory_reforger: ['reforgerPressRam', 'reforgerPressGuideL', 'reforgerPressGuideR', 'reforgerCrownLift'],
  zero_frequency_mind: ['zeroSuspensionLF', 'zeroSuspensionLB', 'zeroSuspensionRF', 'zeroSuspensionRB', 'zeroSiegeRam'],
};
function world(node, point = [0, 0, 0]) { return node.localToWorld(new THREE.Vector3(...point)); }
for (const definition of definitions.filter(definition => !only || definition.id === only)) for (const variant of definition.variants) {
  const label = `${definition.id}/${variant}`;
  try {
    const { root, joints } = definition.build(variant), clips = definition.clips(root, joints);
    assert.deepEqual(clips.map(clip => clip.name), ['idle','move','attack','windup','release','ability','shutdown']);
    const links = root.userData.mechanicalLinks || [];
    for (const key of requiredConnections[definition.id] || []) assert.ok(links.some(link => link.key === key), `${label}: required support ${key} missing`);
    const linked = links.map(link => ({ ...link, fromNode: root.getObjectByName(link.from.node), toNode: root.getObjectByName(link.to.node), sleeveNode: root.getObjectByName(link.sleeve), rodNode: root.getObjectByName(link.rod), shaftNode: root.getObjectByName(link.shaft) }));
    let maximumEndpointError = 0, minimumEngagement = Infinity, maximumAxisError = 0;
    const restHips = Object.entries(joints).filter(([key]) => /(^hip|_Hip$)/.test(key)).map(([key, node]) => [key, node.position.clone()]);
    for (const clip of clips) {
      const mixer = new THREE.AnimationMixer(root), action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play();
      for (let frame = 0; frame <= 32; frame++) {
        mixer.setTime(clip.duration * frame / 32); root.updateMatrixWorld(true);
        root.traverse(node => { for (const value of node.matrixWorld.elements) assert.ok(Number.isFinite(value), `${label}/${clip.name}: non-finite transform`); });
        for (const link of linked) {
          const a = world(link.fromNode, link.from.point), b = world(link.toNode, link.to.point);
          const actualA = world(link.sleeveNode), actualB = world(link.rodNode);
          const error = Math.max(a.distanceTo(actualA), b.distanceTo(actualB));
          maximumEndpointError = Math.max(maximumEndpointError, error);
          assert.ok(error < 0.004, `${label}/${clip.name}/${link.key}: detached endpoint ${error}`);
          const axis = b.clone().sub(a).normalize(), shaftTip = world(link.shaftNode, [0, 1, 0]);
          const axial = shaftTip.clone().sub(a).dot(axis);
          const engagement = link.sleeveLength - axial;
          const perpendicular = shaftTip.clone().sub(a).addScaledVector(axis, -axial).length();
          minimumEngagement = Math.min(minimumEngagement, engagement); maximumAxisError = Math.max(maximumAxisError, perpendicular);
          assert.ok(engagement > link.overlap - 0.004 && perpendicular < 0.004, `${label}/${clip.name}/${link.key}: sleeve disengagement ${engagement}/${perpendicular}`);
        }
        if (clip.name !== 'shutdown') for (const [key, rest] of restHips) {
          assert.ok(joints[key].position.distanceTo(rest) < 0.0001, `${label}/${clip.name}/${key}: hip left its chassis mounting`);
        }
        if (definition.id === 'frequency_hunter' || definition.id === 'archive_warden') {
          const hips = Object.keys(joints).filter(key => /^hip/.test(key));
          for (const key of hips) assert.ok(Math.abs(joints[key].position.x) > 0.4, `${label}/${clip.name}: hips collapsed to the center`);
        }
      }
      mixer.stopAllAction(); mixer.uncacheRoot(root);
    }
    if (definition.id === 'entropy_engine') {
      const turret = joints.turret.position, reactor = joints.reactor.position;
      assert.ok(reactor.z - turret.z > 1.1, `${label}: reactor and turret footprints overlap`);
    }
    if (['noise_hive','mirror_censor','memory_reforger','bandwidth_requisitioner'].includes(definition.id)) {
      for (const [key] of restHips) assert.equal(joints[key].parent, joints.body, `${label}/${key}: leg root must follow its actual chassis`);
    }
    let runtimeEndpointError = 0, runtimeAxisError = 0, runtimeSamples = 0;
    if (runtime) {
      const controller = createEntityMixer(root, clips, { grounded: false });
      for (const stage of ['windup', 'release']) for (const travel of [0.15, 0.75, 1.35]) for (const progress of [0.17, 0.51, 0.91]) {
        controller.sample({ action: 'cast', stage, moving: true, travel, progress, clock: 1000 });
        root.updateMatrixWorld(true); runtimeSamples++;
        for (const link of linked) {
          const a = world(link.fromNode, link.from.point), b = world(link.toNode, link.to.point);
          const error = Math.max(a.distanceTo(world(link.sleeveNode)), b.distanceTo(world(link.rodNode)));
          const axis = b.clone().sub(a).normalize(), shaftTip = world(link.shaftNode, [0, 1, 0]);
          const axial = shaftTip.clone().sub(a).dot(axis);
          const perpendicular = shaftTip.clone().sub(a).addScaledVector(axis, -axial).length();
          runtimeEndpointError = Math.max(runtimeEndpointError, error); runtimeAxisError = Math.max(runtimeAxisError, perpendicular);
          assert.ok(error < 0.0001 && perpendicular < 0.0001, `${label}/${stage}/${link.key}: mixed-action link lost its axis ${error}/${perpendicular}`);
          assert.ok(link.sleeveLength - axial > link.overlap - 0.0001, `${label}/${stage}/${link.key}: mixed-action sleeve disengagement`);
        }
      }
      controller.dispose();
    }
    records.push({ id: definition.id, variant, clips: clips.length, framesPerClip: 33, links: links.length, maximumEndpointError, maximumAxisError, minimumEngagement: Number.isFinite(minimumEngagement) ? minimumEngagement : null, runtimeSamples, runtimeEndpointError, runtimeAxisError });
    console.log(`${label}: ${clips.length} clips, ${links.length} mechanical links, endpoint ${maximumEndpointError.toExponential(2)}`);
  } catch (error) { errors.push({ id: definition.id, variant, message: error.message }); console.error(`${label}: ${error.message}`); }
}
if (!only) assert.equal(records.length + errors.length, 31, 'All 19 entities and 31 appearances must be inspected');
await mkdir(new URL('../qa/refinement/', import.meta.url), { recursive: true });
await writeFile(new URL(`../qa/refinement/heavy-boss${only ? '-' + only : ''}${runtime ? '-runtime' : ''}.json`, import.meta.url), JSON.stringify({ scope: 'Actual source clips: articulated endpoint retention, sleeve engagement and chassis attachments; optional real moving-action runtime sampling. Visual review and exported GLB inspection are separate.', records, errors }, null, 2) + '\n');
assert.equal(errors.length, 0, `${errors.length} appearance(s) failed connection validation`);
