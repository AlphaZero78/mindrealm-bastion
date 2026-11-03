import { registerHooks } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'three') return { url: new URL('../vendor/three/build/three.module.js', import.meta.url).href, shortCircuit: true };
    if (specifier.startsWith('three/addons/')) {
      return { url: new URL(`../vendor/three/examples/jsm/${specifier.slice('three/addons/'.length)}`, import.meta.url).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
const THREE = await import('../vendor/three/build/three.module.js');
const { GLTFLoader } = await import('../vendor/three/examples/jsm/loaders/GLTFLoader.js');
const { createEntityMixer } = await import('../src/runtime/entity-animation.js');
const { loadGameplayContract } = await import('./gameplay-contract.mjs');
const root = fileURLToPath(new URL('../release/mindrealm-entity-pack/game/', import.meta.url));
const manifest = JSON.parse(await readFile(`${root}assets/game/models/models.json`, 'utf8'));
const gameplay = await loadGameplayContract(Object.keys(manifest.entities));
const loader = new GLTFLoader();
const results = [];
for (const [id, definition] of Object.entries(manifest.entities)) {
  if (definition.kind !== 'enemies' || gameplay.enemies[id].air) continue;
  for (const [variant, entry] of Object.entries(definition.variants)) {
    const bytes = await readFile(`${root}assets/game/${entry.source}`);
    const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    const model = gltf.scene;
    const bounds = new THREE.Box3().setFromObject(model);
    model.position.y = -bounds.min.y;
    const contactPoints = [];
    model.updateMatrixWorld(true);
    model.traverse(node => {
      if (!node.isMesh) return;
      const position = node.geometry.getAttribute('position');
      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
        const e = node.matrixWorld.elements;
        if (e[1] * x + e[5] * y + e[9] * z + e[13] > bounds.min.y + 0.28) continue;
        contactPoints.push({ node, x, y, z });
      }
    });
    const mixer = createEntityMixer(model, gltf.animations, { stride: definition.stride || 1.5 });
    let lowest = Infinity, highest = -Infinity;
    for (let frame = 0; frame <= 24; frame++) {
      mixer.sample({ action: 'move', travel: frame / 24 * 1.5, clock: frame * 1000 / 60 });
      model.updateMatrixWorld(true);
      let minimum = Infinity;
      for (const point of contactPoints) {
        const e = point.node.matrixWorld.elements;
        minimum = Math.min(minimum, e[1] * point.x + e[5] * point.y + e[9] * point.z + e[13]);
      }
      lowest = Math.min(lowest, minimum);
      highest = Math.max(highest, minimum);
    }
    mixer.dispose();
    const geometries = new Set(), materials = new Set();
    model.traverse(node => {
      if (!node.isMesh) return;
      geometries.add(node.geometry);
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) materials.add(material);
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    results.push({ id, variant, points: contactPoints.length, lowest, highest, finite: Number.isFinite(lowest) && Number.isFinite(highest) });
  }
}
await mkdir(new URL('../qa/', import.meta.url), { recursive: true });
await writeFile(new URL('../qa/grounding.json', import.meta.url), JSON.stringify(results, null, 2) + '\n');
console.log(`Measured ${results.length} ground appearances over 25 move frames each.`);
for (const result of [...results].sort((a, b) => a.lowest - b.lowest).slice(0, 14)) console.log(`${result.id}/${result.variant}: minY ${result.lowest.toFixed(4)}…${result.highest.toFixed(4)} (${result.points} contact vertices)`);
if (results.some(result => !result.finite)) throw new Error('接地采样存在无效数值');
