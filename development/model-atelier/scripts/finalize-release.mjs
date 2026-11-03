import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../release/mindrealm-entity-pack');
const GAME = path.join(PACK, 'game');
const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const makeZip = args.includes('--zip');
const allowed = new Set(['--check', '--write', '--zip']);
for (const arg of args) if (!allowed.has(arg)) throw new Error(`未知参数 ${arg}`);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const relative = file => path.relative(PACK, file).replaceAll('\\', '/');

async function filesBelow(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error(`发行目录不允许符号链接：${entry.name}`);
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(file));
    else if (entry.isFile()) files.push(file);
  }
  return files.sort();
}

async function validateAssets() {
  const modelFile = path.join(GAME, 'assets/game/models/models.json');
  const manifest = JSON.parse(await readFile(modelFile, 'utf8'));
  assert.equal(manifest.format, 2);
  const entities = Object.entries(manifest.entities);
  assert.equal(entities.length, 49);
  let appearances = 0;
  const required = new Set([
    'game/assets/game/models/models.json',
    'game/assets/game/models/tracking_drone/base.glb',
    'game/web/view/entity-renderer.js',
    'game/web/view/whole-entity-runtime.js',
    'game/web/view/entity-art.js',
    'game/web/view/entity-art-bounds.js',
    'game/web/view/model-portraits.js',
    'game/assets/third_party/three/LICENSE.txt',
    'game/assets/third_party/three/addons/environments/RoomEnvironment.js',
  ]);
  let glbs = 1;
  for (const [id, definition] of entities) {
    const kind = definition.kind;
    assert.ok(kind === 'enemies' || kind === 'towers', id);
    const variants = Object.entries(definition.variants);
    appearances += variants.length;
    const portrait = `game/assets/game/portraits/${id}.png`;
    required.add(portrait);
    const portraitBytes = await readFile(path.join(PACK, portrait));
    assert.equal(portraitBytes.readUInt32BE(16), 256, `${id} portrait width`);
    assert.equal(portraitBytes.readUInt32BE(20), 256 * variants.length, `${id} portrait rows`);
    for (const [variant, entry] of variants) {
      const source = `game/assets/game/models/${id}/${variant}.glb`;
      assert.equal(entry.source, `models/${id}/${variant}.glb`);
      required.add(source);
      const bytes = await readFile(path.join(PACK, source));
      assert.equal(bytes.readUInt32LE(0), 0x46546c67, source);
      assert.equal(bytes.readUInt32LE(4), 2, source);
      assert.equal(bytes.readUInt32LE(8), bytes.length, source);
      const document = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
      const clips = document.animations?.map(clip => clip.name) || [];
      assert.deepEqual(clips, ['idle', 'move', 'attack', 'windup', 'release', 'ability', 'shutdown'], `${id}/${variant} clips`);
      glbs++;
    }
    for (const [file, height] of [
      [`game/assets/game/sprites/${kind}/${id}.png`, 80 * variants.length],
      [`game/assets/game/sprites/animations/${kind}/${id}.png`, 800 * variants.length],
    ]) {
      required.add(file);
      const bytes = await readFile(path.join(PACK, file));
      assert.equal(bytes.readUInt32BE(16), 640, file);
      assert.equal(bytes.readUInt32BE(20), height, file);
    }
    if (kind === 'enemies') {
      const file = `game/assets/game/sprites/death/enemies/${id}.png`;
      required.add(file);
      const bytes = await readFile(path.join(PACK, file));
      assert.equal(bytes.readUInt32BE(16), 640, file);
      assert.equal(bytes.readUInt32BE(20), 320 * variants.length, file);
    }
  }
  assert.equal(appearances, 109);
  assert.equal(glbs, 110);
  const pngs = (await filesBelow(GAME)).filter(file => file.endsWith('.png'));
  assert.equal(pngs.length, 184);
  for (const file of pngs) {
    const bytes = await readFile(file);
    assert.equal(bytes.toString('ascii', 1, 4), 'PNG', relative(file));
  }
  for (const file of required) assert.ok((await readFile(path.join(PACK, file))).length > 0, file);
  return { entities: 49, appearances, glbs, pngs: pngs.length, clips: appearances * 7 };
}

async function inventory() {
  const files = (await filesBelow(PACK)).filter(file => !['manifest.json', 'SHA256SUMS'].includes(relative(file)));
  return Promise.all(files.map(async file => {
    const bytes = await readFile(file);
    return { path: relative(file), bytes: bytes.length, sha256: sha256(bytes) };
  }));
}

const counts = await validateAssets();
if (checkOnly) {
  const manifest = JSON.parse(await readFile(path.join(PACK, 'manifest.json'), 'utf8'));
  assert.deepEqual(manifest.counts, counts);
  const previous = new Map(manifest.files.map(file => [file.path, file]));
  for (const file of await inventory()) {
    const expected = previous.get(file.path);
    assert.ok(expected, `清单遗漏 ${file.path}`);
    assert.equal(expected.bytes, file.bytes, file.path);
    assert.equal(expected.sha256, file.sha256, file.path);
    previous.delete(file.path);
  }
  assert.equal(previous.size, 0, '清单包含已不存在的文件');
  console.log(`PASS complete pack: ${counts.entities} entities, ${counts.appearances} appearances, ${counts.glbs} GLBs, ${counts.pngs} PNGs, ${counts.clips} entity clips.`);
} else {
  const files = await inventory();
  const manifest = {
    format: 'mindrealm-original-entity-pack/1',
    source: 'Original procedural geometry and articulated animations; no stock model parts.',
    entry: 'game/web/view/entity-renderer.js',
    modelManifest: 'game/assets/game/models/models.json',
    counts,
    files,
  };
  await writeFile(path.join(PACK, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(path.join(PACK, 'SHA256SUMS'), files.map(file => `${file.sha256}  ${file.path}`).join('\n') + '\n');
  console.log(`Packaged ${files.length} files: ${counts.entities} entities / ${counts.appearances} appearances / ${counts.glbs} GLBs / ${counts.pngs} PNGs.`);
  if (makeZip) {
    const destination = path.join(path.dirname(PACK), 'mindrealm-entity-pack.zip');
    const temporary = path.join(path.dirname(PACK), `mindrealm-entity-pack.${process.pid}.tmp.zip`);
    await rm(temporary, { force: true });
    try {
      const command = `Compress-Archive -LiteralPath 'mindrealm-entity-pack' -DestinationPath '${path.basename(temporary)}' -CompressionLevel Optimal`;
      const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command], { cwd: path.dirname(PACK), stdio: 'inherit', timeout: 300000 });
      if (result.error) throw result.error;
      if (result.status !== 0) throw new Error(`ZIP 创建失败：${result.status}`);
      await rename(temporary, destination);
      console.log(`ZIP: ${destination} (${(await readFile(destination)).length} bytes)`);
    } finally {
      await rm(temporary, { force: true });
    }
  }
}
