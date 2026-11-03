import { copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(sourceRoot, '../..');
const targetRoot = path.join(projectRoot, 'qa/game-integration');
const mapping = JSON.parse(await readFile(path.join(sourceRoot, 'migration-map.json'), 'utf8'));

for (const [source, destination] of Object.entries(mapping.files)) {
  if (!destination.startsWith('development/web-tests/') || destination.includes('..')) throw Error(`Invalid migration destination: ${destination}`);
  const target = path.join(targetRoot, destination);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(path.join(sourceRoot, source), target);
  console.log(`${source} -> ${destination}`);
}
