import { createHash, randomUUID } from 'node:crypto';
import { readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { towers, enemies, messengers, events } from '../../web/core/content.js';
import { AUDIO_FILES } from '../../web/view/audio.js';
import { ENTITY_ART } from '../../web/view/entity-art.js';
import { MODEL_PORTRAITS } from '../../web/view/model-portraits.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const manifestPath = 'assets/third_party/ASSET_MANIFEST.sha256';
const modelRoot = 'development/assets/model_sources';
const licensePaths = [
  'assets/third_party/game-icons/LICENSE.txt',
  'assets/third_party/fusion-pixel-font/OFL.txt',
  'assets/third_party/kenney/sci-fi-sounds/License.txt',
  'assets/third_party/opengameart/singularity/LICENSE.txt',
  'assets/third_party/opengameart/dark-sci-fi-audio/LICENSE.txt',
  'assets/third_party/node/LICENSE.txt',
  'assets/third_party/three/LICENSE.txt',
  'assets/third_party/polyhaven/LICENSE.txt',
  ...['space-kit', 'modular-space-kit', 'tower-defense-kit'].map(
    kit => `${modelRoot}/kenney/${kit}/License.txt`),
];
const modelExtensions = new Set(['.glb', '.gltf', '.bin', '.png', '.jpg', '.jpeg']);
const order = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const sidecar = file => /\.(?:import|uid)$/i.test(file) || /(?:^|\/)\.gdignore$/i.test(file);
const isLicense = file => /(?:^|\/)(?:licen[cs]e|copying|notice|ofl)(?:[._-][^/]*)?$/i.test(file);

function inside(root, path) {
  const absolute = resolve(root, path), fromRoot = relative(root, absolute);
  if (!fromRoot || isAbsolute(fromRoot) || fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || resolve(root, fromRoot) !== absolute)
    throw Error(`Asset path must remain within the project: ${path}`);
  return absolute;
}

async function walk(root, folder) {
  const result = [];
  for (const entry of await readdir(inside(root, folder), { withFileTypes: true })) {
    const path = `${folder}/${entry.name}`;
    if (entry.isSymbolicLink()) throw Error(`Asset symlinks are not traversed: ${path}`);
    if (entry.isDirectory()) result.push(...await walk(root, path));
    else if (entry.isFile()) result.push(path);
  }
  return result.sort(order);
}

/** Actual browser loads: catalog-backed sprites, the audio registry and CSS URLs. */
export async function runtimeAssetPaths(root = projectRoot) {
  const css = await readFile(inside(root, 'web/style.css'), 'utf8');
  const models=JSON.parse(await readFile(inside(root,'assets/game/models/models.json'),'utf8'));
  const cssAssets = [...css.matchAll(/url\(\s*['"]?(\/assets\/[^)'"\s]+)['"]?\s*\)/g)]
    .map(match => match[1].slice(1));
  return [...new Set([
    ...Object.keys(towers).map(id => `assets/game/sprites/towers/${id}.png`),
    ...Object.keys(enemies).map(id => `assets/game/sprites/enemies/${id}.png`),
    ...Object.values(ENTITY_ART).map(art => art.animationPath.slice(1)),
    ...Object.values(AUDIO_FILES).map(path => path.replace(/^\//, '')),
    ...cssAssets,
    ...Object.values(messengers).map(m=>`assets/third_party/game-icons/${m.art}.svg`),
    ...Object.keys(events).map(id=>`assets/game/events/${id}.png`),
    ...Object.values(MODEL_PORTRAITS).map(art=>art.path.slice(1)),
    ...Object.values(models.sources).map(model=>model.path.slice(1)),
    'assets/game/models/models.json','assets/game/lighting/studio_small_09_pmrem.bin',
    'assets/third_party/three/three.bundle.js',
    ...['nor_gl.png','rough.jpg','diff.jpg'].map(name=>`assets/third_party/polyhaven/blue_metal_plate_${name}`),
  ])].sort(order);
}

/** Read-only inventory. Importing this module never writes a manifest. */
export async function inventoryAssets(root = projectRoot) {
  const [assets, models, runtime] = await Promise.all([
    walk(root, 'assets'), walk(root, modelRoot), runtimeAssetPaths(root),
  ]);
  const present = new Set([...assets, ...models]);
  for (const path of [...runtime, ...licensePaths]) {
    inside(root, path);
    if (!present.has(path)) throw Error(`Required runtime asset or license is missing: ${path}`);
  }
  const sources = models.filter(path => !sidecar(path) &&
    (modelExtensions.has(extname(path).toLowerCase()) || isLicense(path)));
  const authoringAssets=['assets/third_party/polyhaven/studio_small_09_1k.hdr'];
  const retained = [...new Set([...runtime, ...licensePaths, ...sources, ...authoringAssets])].sort(order);
  const retainedSet = new Set(retained);
  const unusedAssets = assets.filter(path => path !== manifestPath && !sidecar(path) && !retainedSet.has(path));
  const assetDirectories = [...new Set(assets.map(path => path.slice(0, path.lastIndexOf('/'))))];
  const sidecarOnlyDirectories = assetDirectories.filter(folder =>
    assets.filter(path => path.slice(0, path.lastIndexOf('/')) === folder).every(sidecar));
  return {
    runtime, retained, sourceFiles: sources,
    unusedAssets,
    unusedAssetDirectories: [...new Set(unusedAssets.map(path => path.slice(0, path.lastIndexOf('/'))))].sort(order),
    sidecarOnlyDirectories,
    godotSidecars: assets.filter(sidecar),
    modelSidecars: models.filter(sidecar),
  };
}

export async function manifestText(root = projectRoot) {
  const inventory = await inventoryAssets(root);
  const rows = await Promise.all(inventory.retained.map(async path => {
    const bytes = await readFile(inside(root, path));
    if (!bytes.length) throw Error(`Retained asset is empty: ${path}`);
    return `${createHash('sha256').update(bytes).digest('hex')}  ${path}`;
  }));
  return { inventory, text: '# SHA-256 manifest for required Web runtime assets, licenses and retained neutral model sources.\n' + rows.join('\n') + '\n' };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--write', '--list', '--dry-run'].includes(arg)) ||
      (args.includes('--write') && args.includes('--dry-run'))) {
    throw Error('Usage: node development/web-tools/refresh-asset-manifest.mjs [--dry-run | --write] [--list]');
  }
  const { inventory, text } = await manifestText();
  if (args.includes('--write')) {
    // Only this explicit command mutates the manifest. Hash all inputs first.
    const target = inside(projectRoot, manifestPath);
    const temporary = `${target}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, text, { encoding: 'utf8', flag: 'wx' });
      await rename(temporary, target);
    } finally {
      await rm(temporary, { force: true });
    }
  }
  console.log(JSON.stringify({
    status: args.includes('--write') ? 'MINDREALM_MANIFEST_REFRESHED' : 'MINDREALM_ASSET_INVENTORY_ONLY',
    manifest: manifestPath,
    written: args.includes('--write'),
    counts: {
      runtime: inventory.runtime.length, retained: inventory.retained.length,
      modelSourcesAndLicenses: inventory.sourceFiles.length,
      unusedAssets: inventory.unusedAssets.length,
      assetSidecars: inventory.godotSidecars.length, modelSidecars: inventory.modelSidecars.length,
    },
    unusedAssetDirectories: inventory.unusedAssetDirectories,
    sidecarOnlyDirectories: inventory.sidecarOnlyDirectories,
    unusedAssets: inventory.unusedAssets,
    ...(args.includes('--list') ? { runtime: inventory.runtime, retained: inventory.retained,
      godotSidecars: inventory.godotSidecars, modelSidecars: inventory.modelSidecars } : {}),
  }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
