import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'qa', 'entity-art');
const destination = path.join(root, 'release', 'mindrealm-entity-pack', 'game');
const validation = spawnSync(process.execPath, ['scripts/validate-entity-art.mjs'], { cwd: root, encoding: 'utf8' });
process.stdout.write(validation.stdout);
process.stderr.write(validation.stderr);
if (validation.status !== 0) throw new Error('图集校验未通过，不安装暂存产物');

const manifest = JSON.parse(await readFile(path.join(destination, 'assets/game/models/models.json'), 'utf8'));
const bounds = JSON.parse(await readFile(path.join(source, 'web/view/entity-art-bounds.json'), 'utf8'));
const portraits = await readFile(path.join(source, 'web/view/model-portraits.js'), 'utf8');
if (Object.keys(bounds).length !== 49 || Object.keys(manifest.entities).length !== 49) throw new Error('实体数量必须为49');
for (const [id, definition] of Object.entries(manifest.entities)) {
  if (!bounds[id]) throw new Error(`缺少图集边界：${id}`);
  if (bounds[id].variants.join(',') !== Object.keys(definition.variants).join(',')) throw new Error(`变体顺序不一致：${id}`);
  if (!portraits.includes(`"${id}"`)) throw new Error(`缺少肖像索引：${id}`);
}
await mkdir(path.join(destination, 'web/view'), { recursive: true });
await cp(path.join(source, 'assets'), path.join(destination, 'assets'), { recursive: true });
await writeFile(path.join(destination, 'web/view/model-portraits.js'), portraits);
await writeFile(path.join(destination, 'assets/game/models/entity-art-bounds.json'), JSON.stringify(bounds, null, 2) + '\n');
await writeFile(path.join(root, 'src/runtime/model-portraits.js'), portraits);
await writeFile(path.join(root, 'src/runtime/entity-art-bounds.js'), `export const ART_BOUNDS = ${JSON.stringify(bounds, null, 2)};\n`);
console.log('Installed 49 original portrait atlases, 49 static/animation atlases, 37 shutdown atlases and their presentation contracts.');
