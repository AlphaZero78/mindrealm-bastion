import assert from 'node:assert/strict';
import { cp, readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.resolve(root, process.argv[2] || 'qa/game-integration');
const relative = path.relative(path.join(root, 'qa'), target);
if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('集成目录必须是 qa 的直接子目录');
const options = new Set(process.argv.slice(3));
for (const option of options) if (!['--clean-legacy', '--refresh'].includes(option)) throw new Error(`未知参数 ${option}`);
await readFile(path.join(target, 'package.json'));
await readFile(path.join(target, 'game/web/core/content.js'));
await cp(path.join(root, 'release/mindrealm-entity-pack/game'), path.join(target, 'game'), { recursive: true });
for (const file of ['enemy-rig.test.mjs', 'model-reflection.test.mjs', 'pages.test.mjs', 'runtime-boundary.test.mjs', 'realtime-assets.test.mjs', 'whole-entity-test-helpers.mjs']) {
  await cp(path.join(root, 'tools/migration', file), path.join(target, 'development/web-tests', file));
}
await cp(path.join(root, 'tools/refresh-asset-manifest.mjs'), path.join(target, 'development/web-tools/refresh-asset-manifest.mjs'));

if (options.has('--clean-legacy')) {
  const { inventoryAssets } = await import(pathToFileURL(path.join(target, 'development/web-tools/refresh-asset-manifest.mjs')).href);
  const inventory = await inventoryAssets(target);
  const allowed = file => {
    if (/^game\/assets\/game\/models\/[^/]+\.glb$/.test(file)) return true;
    if (file === 'game/assets/game/lighting/studio_small_09_pmrem.bin') return true;
    return /^game\/assets\/third_party\/polyhaven\/blue_metal_plate_(?:nor_gl\.png|rough\.jpg|diff\.jpg)$/.test(file);
  };
  for (const file of inventory.unusedAssets) {
    assert.ok(allowed(file), `拒绝清理未登记的旧资源：${file}`);
    const absolute = path.resolve(target, file);
    assert.ok(absolute.startsWith(`${target}${path.sep}`));
    await rm(absolute, { force: true });
  }
  console.log(`Removed ${inventory.unusedAssets.length} explicitly obsolete assets from the isolated copy only.`);
  await rm(path.join(target, 'game/manifest.json'), { force: true });
  await rm(path.join(target, 'game/web/view/entity-art-bounds.json'), { force: true });
}
if (options.has('--refresh')) {
  const result = spawnSync(process.execPath, ['development/web-tools/refresh-asset-manifest.mjs', '--write'], { cwd: target, stdio: 'inherit' });
  if (result.status !== 0) throw new Error('副本资源清单刷新失败');
}
console.log(`Integration copy ready: ${target}`);
