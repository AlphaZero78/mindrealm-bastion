import { ART_BOUNDS } from './entity-art-bounds.js';

export const ART_POSES = Object.freeze({ idle: 0, move: [1, 2, 3, 4], attack: [5, 6, 7], cast: [8, 9] });
const TOWER_VARIANTS = ['T1', 'T2A', 'T2B', 'T3A', 'T3B'];
const BOSS_VARIANTS = ['phase1', 'phase2', 'phase3'];
const definitions = {
  anchor_bulwark: ['towers', 'melee', 'anchored'], phase_blade: ['towers', 'melee', 'anchored'],
  boundary_riveter: ['towers', 'melee', 'anchored'], resonance_guard: ['towers', 'melee', 'anchored'],
  pulse_array: ['towers', 'ranged', 'anchored'], focus_rail: ['towers', 'ranged', 'anchored'],
  arc_mortar: ['towers', 'ranged', 'anchored'], drone_loom: ['towers', 'ranged', 'anchored'],
  bandwidth_relay: ['towers', 'support', 'anchored'], memory_mechanic: ['towers', 'support', 'anchored'],
  frequency_choir: ['towers', 'support', 'anchored'], resistance_beacon: ['towers', 'support', 'anchored'],
  scrap_bulwark: ['enemies', 'normal', 'crawler'], echo_glider: ['enemies', 'normal', 'hover'], noise_bell: ['enemies', 'elite', 'crawler'],
  memory_runner: ['enemies', 'normal', 'runner'], repair_skiff: ['enemies', 'normal', 'hover'], archive_warden: ['enemies', 'elite', 'crawler'],
  ordered_sentinel: ['enemies', 'normal', 'walker'], null_wing: ['enemies', 'normal', 'hover'], entropy_engine: ['enemies', 'elite', 'crawler'],
  static_drifter: ['enemies', 'normal', 'walker'], spike_runner: ['enemies', 'normal', 'runner'],
  shield_echo: ['enemies', 'normal', 'walker'], tempo_amplifier: ['enemies', 'normal', 'crawler'],
  fracture_seed: ['enemies', 'normal', 'crawler'], floating_noise: ['enemies', 'normal', 'hover'],
  remote_hunter: ['enemies', 'normal', 'crawler'], siege_ram: ['enemies', 'normal', 'crawler'],
  memory_medic: ['enemies', 'normal', 'walker'], bandwidth_jammer: ['enemies', 'normal', 'crawler'],
  phase_teleporter: ['enemies', 'normal', 'walker'], replication_node: ['enemies', 'normal', 'crawler'],
  pressure_cantor: ['enemies', 'normal', 'walker'], armored_worm: ['enemies', 'normal', 'crawler'],
  shield_conductor: ['enemies', 'normal', 'crawler'], signal_summoner: ['enemies', 'normal', 'crawler'],
  resistance_corruptor: ['enemies', 'normal', 'hover'], detonation_shell: ['enemies', 'normal', 'crawler'],
  frequency_hunter: ['enemies', 'elite', 'crawler'], terrain_dismantler: ['enemies', 'elite', 'crawler'],
  proliferation_protocol: ['enemies', 'elite', 'crawler'], spirit_taxer: ['enemies', 'elite', 'hover'],
  noise_hive: ['enemies', 'boss', 'crawler'], mirror_censor: ['enemies', 'boss', 'walker'],
  memory_reforger: ['enemies', 'boss', 'crawler'], bandwidth_requisitioner: ['enemies', 'boss', 'crawler'],
  chorus_overseer: ['enemies', 'boss', 'hover'], zero_frequency_mind: ['enemies', 'boss', 'crawler'],
};

export const ENTITY_ART = Object.freeze(Object.fromEntries(Object.entries(definitions).map(([id, [kind, role, locomotion]]) => {
  const variants = Object.freeze(kind === 'towers' ? [...TOWER_VARIANTS] : role === 'boss' ? [...BOSS_VARIANTS] : ['base']);
  const bounds = ART_BOUNDS[id];
  if (!bounds) throw new Error(`缺少原创图集取景：${id}`);
  return [id, Object.freeze({
    cell: 80, directions: 8, poseRows: 10, variants, rows: variants.length * 10,
    iconRows: variants.length, bearing: 0, baseline: bounds.baseline, elevation: 55,
    role, locomotion, kind, minVisibleSpan: bounds.minVisibleSpan,
    bounds: Object.freeze(bounds.bounds), iconBounds: Object.freeze(bounds.iconBounds),
    staticPath: `/assets/game/sprites/${kind}/${id}.png`,
    animationPath: `/assets/game/sprites/animations/${kind}/${id}.png`,
    deathRows: kind === 'enemies' ? 4 : 0,
    deathPath: kind === 'enemies' ? `/assets/game/sprites/death/enemies/${id}.png` : null,
  })];
})));
