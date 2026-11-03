import { registerHooks } from 'node:module';
import { access, copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
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

const { normalizeEntityManifest } = await import('../src/runtime/entity-assets.js');
const { buildTrackingDroneGLB } = await import('../src/runtime/authoring/tracking-drone-model.js');

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUTPUT = path.join(ROOT, 'release', 'mindrealm-entity-pack');
const VIEW = path.join(OUTPUT, 'game', 'web', 'view');
const THREE = path.join(OUTPUT, 'game', 'assets', 'third_party', 'three');
const BUNDLE = path.join(THREE, 'three.bundle.js');
const MODELS = path.join(OUTPUT, 'game', 'assets', 'game', 'models');
const args = process.argv.slice(2);
const option = name => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
};
const sampleRequested = args.includes('--sample');
const runtimeOnly = args.includes('--runtime-only');
const manifestArgument = option('--manifest');
const modelsRootArgument = option('--models-root');
const exists = async file => access(file).then(() => true, () => false);
const slash = value => value.split(path.sep).join('/');

function relativeImport(fromFile, targetFile) {
  const value = slash(path.relative(path.dirname(fromFile), targetFile));
  return value.startsWith('.') ? value : `./${value}`;
}

function rewriteThreeImports(source, destination, threeTarget = BUNDLE) {
  return source
    .replace(/(['"])three\/addons\/([^'"]+)\1/g, (_, quote, addon) => `${quote}${relativeImport(destination, path.join(THREE, 'addons', addon))}${quote}`)
    .replace(/(['"])three\1/g, (_, quote) => `${quote}${relativeImport(destination, threeTarget)}${quote}`);
}

async function writeRuntime(sourceName, destinationName = sourceName) {
  const source = await readFile(path.join(ROOT, 'src', 'runtime', sourceName), 'utf8');
  const destination = path.join(VIEW, destinationName);
  await writeFile(destination, rewriteThreeImports(source, destination));
}

async function writeBattlefieldAdapter() {
  const file = process.env.MINDREALM_GAME_VIEW || 'D:/game_build/game/web/view/battlefield.js';
  let source = await readFile(file, 'utf8');
  const replacements = [
    ['if(!this.realtime)for(const id of [...TOWERS,...ENEMIES])', 'for(const id of [...TOWERS,...ENEMIES])'],
    ["if(this.realtime){if(geometry)this.realtime.add(type,pose,geometry,{opacity,wreck,reducedMotion:!!this.selection.reducedMotion});this.entityFrames.push", "if(this.realtime&&this.realtime.add(type,pose,geometry,{opacity,wreck,reducedMotion:!!this.selection.reducedMotion})){this.entityFrames.push"],
    ["this.realtime?.begin(this.camera,this.state.terrain,this.canvas.width,this.canvas.height);this.overlays=[];", "this.realtime?.prepareState(this.state);this.realtime?.begin(this.camera,this.state.terrain,this.canvas.width,this.canvas.height);this.overlays=[];"],
  ];
  for (const [before, after] of replacements) {
    if (!source.includes(before) && source.includes(after)) continue;
    if (!source.includes(before)) throw new Error(`游戏战场适配接口已变化：${before}`);
    source = source.replace(before, after);
  }
  await writeFile(path.join(VIEW, 'battlefield.js'), source);
}

async function writeThreeAddon(relative) {
  const source = await readFile(path.join(ROOT, 'vendor', 'three', 'examples', 'jsm', relative), 'utf8');
  const destination = path.join(THREE, 'addons', relative);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, rewriteThreeImports(source, destination, path.join(THREE, 'three.module.js')));
}

async function sampleManifest() {
  const atelier = JSON.parse(await readFile(path.join(ROOT, 'models', 'manifest.json'), 'utf8'));
  const entities = {};
  for (const item of atelier.models) {
    const enemy = item.kind === 'monster';
    const variant = enemy ? 'base' : 'T1';
    entities[item.id] = {
      name: item.name,
      kind: enemy ? 'enemies' : 'towers',
      role: 'normal',
      locomotion: ['repair_skiff', 'null_wing'].includes(item.id) ? 'hover' : enemy ? 'runner' : 'anchored',
      forward: '-z',
      stride: 1.5,
      bounds: item.bounds,
      variants: { [variant]: { source: `models/${item.id}/${variant}.glb` } },
    };
  }
  return {
    manifest: {
      format: 2,
      sample: true,
      note: 'Six-model runtime sample only; not the full Mindrealm roster.',
      entities,
    },
    modelsRoot: path.join(ROOT, 'models'),
    sample: true,
  };
}

async function readManifest() {
  if (sampleRequested) return sampleManifest();
  const file = manifestArgument ? path.resolve(ROOT, manifestArgument) : path.join(ROOT, 'models', 'models.json');
  if (!manifestArgument && !await exists(file)) return sampleManifest();
  const manifest = JSON.parse(await readFile(file, 'utf8'));
  normalizeEntityManifest(manifest);
  return {
    manifest,
    modelsRoot: modelsRootArgument ? path.resolve(ROOT, modelsRootArgument) : path.dirname(file),
    sample: false,
  };
}

async function copyModels({ manifest, modelsRoot, sample }) {
  const copied = new Set();
  let variants = 0;
  for (const [id, definition] of Object.entries(manifest.entities)) {
    if (id === 'tracking_drone') continue;
    for (const [variant, entry] of Object.entries(definition.variants)) {
      const relative = entry.source.slice('models/'.length);
      const source = sample ? path.join(modelsRoot, `${id}.glb`) : path.join(modelsRoot, relative);
      const destination = path.join(MODELS, relative);
      if (!copied.has(destination)) {
        await mkdir(path.dirname(destination), { recursive: true });
        await copyFile(source, destination);
        copied.add(destination);
      }
      variants++;
    }
  }
  const drone = await buildTrackingDroneGLB();
  await mkdir(path.join(MODELS, 'tracking_drone'), { recursive: true });
  await writeFile(path.join(MODELS, 'tracking_drone', 'base.glb'), Buffer.from(drone));
  await writeFile(path.join(MODELS, 'models.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return { variants, files: copied.size + 1 };
}

const preserveAssets = runtimeOnly || (!sampleRequested && !manifestArgument && await exists(path.join(MODELS, 'models.json')));
if (!preserveAssets) await rm(OUTPUT, { recursive: true, force: true });
await mkdir(VIEW, { recursive: true });
await mkdir(THREE, { recursive: true });
await mkdir(MODELS, { recursive: true });

for (const file of (await readdir(path.join(ROOT, 'src', 'runtime'))).filter(file => file.endsWith('.js') && file !== 'index.js')) await writeRuntime(file);
await writeRuntime('index.js', 'whole-entity-runtime.js');
await writeFile(path.join(VIEW, 'entity-renderer.js'), `import { WholeEntityRenderer } from './whole-entity-renderer.js';
export class EntityRenderer extends WholeEntityRenderer {
  constructor(options = {}) { super({ ...options, preload: options.preload ?? 'core' }); }
}
export default EntityRenderer;
`);
await writeBattlefieldAdapter();

for (const file of ['three.core.js', 'three.module.js']) await copyFile(path.join(ROOT, 'vendor', 'three', 'build', file), path.join(THREE, file));
await copyFile(path.join(ROOT, 'vendor', 'three', 'LICENSE.txt'), path.join(THREE, 'LICENSE.txt'));
for (const file of ['loaders/GLTFLoader.js', 'utils/BufferGeometryUtils.js', 'utils/SkeletonUtils.js', 'environments/RoomEnvironment.js']) await writeThreeAddon(file);
await writeFile(BUNDLE, [
  "export * from './three.module.js';",
  "export { GLTFLoader } from './addons/loaders/GLTFLoader.js';",
  "export { clone, retarget, retargetClip } from './addons/utils/SkeletonUtils.js';",
  '',
].join('\n'));

if (preserveAssets) {
  const manifest = JSON.parse(await readFile(path.join(MODELS, 'models.json'), 'utf8'));
  normalizeEntityManifest(manifest);
  // A clean full-roster build has not gone through the six-model sample pack.
  // The independent drone must be produced by this path as well.
  await mkdir(path.join(MODELS, 'tracking_drone'), { recursive: true });
  await writeFile(path.join(MODELS, 'tracking_drone', 'base.glb'), Buffer.from(await buildTrackingDroneGLB()));
  const variants = Object.values(manifest.entities).reduce((sum, definition) => sum + Object.keys(definition.variants).length, 0);
  console.log(`Runtime code refreshed: ${path.relative(ROOT, OUTPUT)}`);
  console.log(`${Object.keys(manifest.entities).length} existing entities / ${variants} variants retained; model files were not rewritten.`);
} else {
  const selected = await readManifest();
  const copied = await copyModels(selected);
  const count = Object.keys(selected.manifest.entities).length;
  console.log(`Runtime pack: ${path.relative(ROOT, OUTPUT)}`);
  console.log(`${count} manifest entities, ${copied.variants} variants, ${copied.files} GLB files including independent tracking_drone.`);
  if (selected.sample) console.log('SAMPLE ONLY: existing six atelier models were used; no full-roster replacement is claimed.');
}
