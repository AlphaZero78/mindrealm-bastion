import { readFile, writeFile } from 'node:fs/promises';
import { loadGameplayContract, gameplayRole } from './gameplay-contract.mjs';

const file = new URL('../release/mindrealm-entity-pack/game/assets/game/models/models.json', import.meta.url);
const manifest = JSON.parse(await readFile(file, 'utf8'));
const gameplay = await loadGameplayContract(Object.keys(manifest.entities));
let changed = 0;
for (const [id, definition] of Object.entries(manifest.entities)) {
  const role = gameplayRole({ id, kind: definition.kind === 'enemies' ? 'monster' : 'building' }, gameplay);
  if (definition.role !== role) {
    console.log(`${id}: ${definition.role} -> ${role}`);
    changed++;
  }
  if (process.argv.includes('--write')) definition.role = role;
}
if (process.argv.includes('--write')) await writeFile(file, JSON.stringify(manifest, null, 2) + '\n');
else if (changed) throw new Error(`${changed} 个职责需要同步`);
console.log(`Gameplay contract checked: ${Object.keys(manifest.entities).length} entities; ${changed} corrections.`);
