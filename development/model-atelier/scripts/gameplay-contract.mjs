import { pathToFileURL } from 'node:url';

export async function loadGameplayContract(ids) {
  const file = process.env.MINDREALM_GAME_CONTENT || 'D:/game_build/game/web/core/content.js';
  const { enemies, towers } = await import(pathToFileURL(file).href);
  const expected = [...Object.keys(enemies), ...Object.keys(towers)].sort();
  if (!ids || [...ids].sort().join('\n') !== expected.join('\n')) {
    throw new Error(`实体覆盖与游戏内容不一致：需要 ${expected.length} 类，收到 ${ids?.length || 0} 类`);
  }
  return { enemies, towers };
}

export function gameplayRole(definition, contract) {
  const source = definition.kind === 'monster' ? contract.enemies : contract.towers;
  const role = source[definition.id]?.[definition.kind === 'monster' ? 'kind' : 'role'];
  if (!role) throw new Error(`游戏职责缺失：${definition.id}`);
  return role;
}
