import { defineEntity } from './contract.js';
import { createGameClips } from '../animations.js';
import { ENTITY_BY_ID } from '../catalog.js';

export const entityDefinitions = {};
const groupModules = [
  { key: 'base-frontier', load: () => import('./base-frontier.js') },
  { key: 'noise-support', load: () => import('./noise-support.js') },
  { key: 'memory-factory', load: () => import('./memory-factory.js') },
  { key: 'heavy-ground', load: () => import('./heavy-ground.js') },
  { key: 'signal-operations', load: () => import('./signal-operations.js') },
  { key: 'elite-watch', load: () => import('./elite-watch.js') },
  { key: 'boss-frontier', load: () => import('./boss-frontier.js') },
  { key: 'boss-control', load: () => import('./boss-control.js') },
  { key: 'melee-towers', load: () => import('./melee-towers.js') },
  { key: 'mixed-towers', load: () => import('./mixed-towers.js') },
  { key: 'support-towers', load: () => import('./support-towers.js') },
  { key: 'core-tower-variants', load: () => import('./core-tower-variants.js') },
];
let initialization;

export function initializeEntityDefinitions() {
  if (!initialization) initialization = (async () => {
    const modules = await Promise.all(groupModules.map(async ({ key, load }) => ({ group: key, ...await load() })));
    for (const module of modules) {
      for (const definition of module.entities) {
        if (entityDefinitions[definition.id]) throw new Error(`Duplicate entity ${definition.id}`);
        entityDefinitions[definition.id] = { ...definition, group: module.group };
      }
    }
    const { buildCoreModel } = await import('../models.js');
    for (const [id, locomotion] of [['memory_runner', 'runner'], ['repair_skiff', 'hover'], ['null_wing', 'hover']]) {
      if (entityDefinitions[id]) throw new Error(`Duplicate legacy entity ${id}`);
      entityDefinitions[id] = defineEntity({
        id, name: ENTITY_BY_ID[id].name, kind: 'monster', role: 'normal', locomotion,
        variants: ['base'], concept: ENTITY_BY_ID[id].concept, mechanism: ENTITY_BY_ID[id].mechanism,
        build: () => buildCoreModel(id), clips: (root, joints) => createGameClips(id, root, joints),
      });
    }
  })();
  return initialization;
}
