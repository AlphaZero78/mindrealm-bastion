// Shared presentation contract for Kenney-derived offline model atlases.
// Every row is an authored 3D pose; variants change actual model assemblies.
export const ART_POSES=Object.freeze({idle:0,move:[1,2,3,4],attack:[5,6,7],cast:[8,9]});
const TOWER_VARIANTS=['T1','T2A','T2B','T3A','T3B'];
const BOSS_VARIANTS=['phase1','phase2','phase3'];
const definitions={
  anchor_bulwark:['towers','melee','anchored'],phase_blade:['towers','melee','anchored'],
  boundary_riveter:['towers','melee','anchored'],resonance_guard:['towers','melee','anchored'],
  pulse_array:['towers','ranged','anchored'],focus_rail:['towers','ranged','anchored'],
  arc_mortar:['towers','ranged','anchored'],drone_loom:['towers','ranged','anchored'],
  bandwidth_relay:['towers','support','anchored'],memory_mechanic:['towers','support','anchored'],
  frequency_choir:['towers','support','anchored'],resistance_beacon:['towers','support','anchored'],
  static_drifter:['enemies','normal','walker'],spike_runner:['enemies','normal','runner'],
  shield_echo:['enemies','normal','walker'],tempo_amplifier:['enemies','normal','crawler'],
  fracture_seed:['enemies','normal','crawler'],floating_noise:['enemies','normal','hover'],
  remote_hunter:['enemies','normal','crawler'],siege_ram:['enemies','normal','crawler'],
  memory_medic:['enemies','normal','walker'],bandwidth_jammer:['enemies','normal','crawler'],
  phase_teleporter:['enemies','normal','walker'],replication_node:['enemies','normal','crawler'],
  pressure_cantor:['enemies','normal','walker'],armored_worm:['enemies','normal','crawler'],
  shield_conductor:['enemies','normal','crawler'],signal_summoner:['enemies','normal','crawler'],
  resistance_corruptor:['enemies','normal','hover'],detonation_shell:['enemies','normal','crawler'],
  frequency_hunter:['enemies','elite','crawler'],terrain_dismantler:['enemies','elite','crawler'],
  proliferation_protocol:['enemies','elite','crawler'],spirit_taxer:['enemies','elite','hover'],
  noise_hive:['enemies','boss','crawler'],mirror_censor:['enemies','boss','walker'],
  memory_reforger:['enemies','boss','crawler'],bandwidth_requisitioner:['enemies','boss','crawler'],
  chorus_overseer:['enemies','boss','hover'],zero_frequency_mind:['enemies','boss','crawler']
};
// BEGIN GENERATED ENTITY BOUNDS
const ART_BOUNDS={
  "anchor_bulwark": {
    "bounds": {
      "x": 13,
      "y": 22,
      "width": 54,
      "height": 53
    },
    "iconBounds": {
      "x": 16,
      "y": 28,
      "width": 48,
      "height": 44
    },
    "minVisibleSpan": 34
  },
  "arc_mortar": {
    "bounds": {
      "x": 15,
      "y": 22,
      "width": 50,
      "height": 53
    },
    "iconBounds": {
      "x": 17,
      "y": 21,
      "width": 46,
      "height": 51
    },
    "minVisibleSpan": 37
  },
  "bandwidth_relay": {
    "bounds": {
      "x": 15,
      "y": 21,
      "width": 50,
      "height": 54
    },
    "iconBounds": {
      "x": 17,
      "y": 23,
      "width": 46,
      "height": 49
    },
    "minVisibleSpan": 36
  },
  "boundary_riveter": {
    "bounds": {
      "x": 15,
      "y": 24,
      "width": 50,
      "height": 51
    },
    "iconBounds": {
      "x": 17,
      "y": 26,
      "width": 46,
      "height": 46
    },
    "minVisibleSpan": 34
  },
  "drone_loom": {
    "bounds": {
      "x": 15,
      "y": 16,
      "width": 50,
      "height": 59
    },
    "iconBounds": {
      "x": 17,
      "y": 27,
      "width": 46,
      "height": 45
    },
    "minVisibleSpan": 40
  },
  "focus_rail": {
    "bounds": {
      "x": 15,
      "y": 22,
      "width": 50,
      "height": 53
    },
    "iconBounds": {
      "x": 17,
      "y": 20,
      "width": 46,
      "height": 52
    },
    "minVisibleSpan": 35
  },
  "frequency_choir": {
    "bounds": {
      "x": 15,
      "y": 21,
      "width": 50,
      "height": 54
    },
    "iconBounds": {
      "x": 17,
      "y": 23,
      "width": 46,
      "height": 49
    },
    "minVisibleSpan": 36
  },
  "memory_mechanic": {
    "bounds": {
      "x": 12,
      "y": 17,
      "width": 57,
      "height": 58
    },
    "iconBounds": {
      "x": 17,
      "y": 29,
      "width": 46,
      "height": 43
    },
    "minVisibleSpan": 35
  },
  "phase_blade": {
    "bounds": {
      "x": 8,
      "y": 19,
      "width": 64,
      "height": 56
    },
    "iconBounds": {
      "x": 14,
      "y": 27,
      "width": 52,
      "height": 45
    },
    "minVisibleSpan": 35
  },
  "pulse_array": {
    "bounds": {
      "x": 15,
      "y": 21,
      "width": 50,
      "height": 54
    },
    "iconBounds": {
      "x": 17,
      "y": 23,
      "width": 46,
      "height": 49
    },
    "minVisibleSpan": 34
  },
  "resistance_beacon": {
    "bounds": {
      "x": 15,
      "y": 23,
      "width": 50,
      "height": 52
    },
    "iconBounds": {
      "x": 17,
      "y": 27,
      "width": 46,
      "height": 45
    },
    "minVisibleSpan": 36
  },
  "resonance_guard": {
    "bounds": {
      "x": 15,
      "y": 24,
      "width": 50,
      "height": 51
    },
    "iconBounds": {
      "x": 17,
      "y": 32,
      "width": 46,
      "height": 40
    },
    "minVisibleSpan": 34
  },
  "armored_worm": {
    "bounds": {
      "x": 15,
      "y": 30,
      "width": 50,
      "height": 44
    },
    "iconBounds": {
      "x": 24,
      "y": 34,
      "width": 32,
      "height": 39
    },
    "minVisibleSpan": 34
  },
  "bandwidth_jammer": {
    "bounds": {
      "x": 18,
      "y": 27,
      "width": 44,
      "height": 49
    },
    "iconBounds": {
      "x": 19,
      "y": 29,
      "width": 42,
      "height": 41
    },
    "minVisibleSpan": 34
  },
  "bandwidth_requisitioner": {
    "bounds": {
      "x": 19,
      "y": 24,
      "width": 43,
      "height": 52
    },
    "iconBounds": {
      "x": 18,
      "y": 29,
      "width": 44,
      "height": 40
    },
    "minVisibleSpan": 38
  },
  "chorus_overseer": {
    "bounds": {
      "x": 4,
      "y": 7,
      "width": 72,
      "height": 68
    },
    "iconBounds": {
      "x": 6,
      "y": 14,
      "width": 68,
      "height": 52
    },
    "minVisibleSpan": 48
  },
  "detonation_shell": {
    "bounds": {
      "x": 18,
      "y": 30,
      "width": 44,
      "height": 46
    },
    "iconBounds": {
      "x": 19,
      "y": 36,
      "width": 42,
      "height": 34
    },
    "minVisibleSpan": 34
  },
  "floating_noise": {
    "bounds": {
      "x": 17,
      "y": 24,
      "width": 46,
      "height": 44
    },
    "iconBounds": {
      "x": 18,
      "y": 31,
      "width": 45,
      "height": 35
    },
    "minVisibleSpan": 39
  },
  "fracture_seed": {
    "bounds": {
      "x": 18,
      "y": 32,
      "width": 44,
      "height": 44
    },
    "iconBounds": {
      "x": 19,
      "y": 41,
      "width": 42,
      "height": 29
    },
    "minVisibleSpan": 34
  },
  "frequency_hunter": {
    "bounds": {
      "x": 14,
      "y": 23,
      "width": 52,
      "height": 53
    },
    "iconBounds": {
      "x": 19,
      "y": 28,
      "width": 42,
      "height": 42
    },
    "minVisibleSpan": 38
  },
  "memory_medic": {
    "bounds": {
      "x": 14,
      "y": 21,
      "width": 52,
      "height": 48
    },
    "iconBounds": {
      "x": 23,
      "y": 22,
      "width": 34,
      "height": 42
    },
    "minVisibleSpan": 33
  },
  "memory_reforger": {
    "bounds": {
      "x": 14,
      "y": 23,
      "width": 52,
      "height": 53
    },
    "iconBounds": {
      "x": 18,
      "y": 29,
      "width": 44,
      "height": 40
    },
    "minVisibleSpan": 38
  },
  "mirror_censor": {
    "bounds": {
      "x": 5,
      "y": 7,
      "width": 70,
      "height": 68
    },
    "iconBounds": {
      "x": 6,
      "y": 13,
      "width": 68,
      "height": 51
    },
    "minVisibleSpan": 45
  },
  "noise_hive": {
    "bounds": {
      "x": 12,
      "y": 22,
      "width": 56,
      "height": 53
    },
    "iconBounds": {
      "x": 15,
      "y": 26,
      "width": 50,
      "height": 41
    },
    "minVisibleSpan": 36
  },
  "phase_teleporter": {
    "bounds": {
      "x": 23,
      "y": 21,
      "width": 34,
      "height": 48
    },
    "iconBounds": {
      "x": 22,
      "y": 22,
      "width": 37,
      "height": 42
    },
    "minVisibleSpan": 33
  },
  "pressure_cantor": {
    "bounds": {
      "x": 25,
      "y": 21,
      "width": 30,
      "height": 48
    },
    "iconBounds": {
      "x": 24,
      "y": 27,
      "width": 32,
      "height": 37
    },
    "minVisibleSpan": 33
  },
  "proliferation_protocol": {
    "bounds": {
      "x": 18,
      "y": 24,
      "width": 44,
      "height": 52
    },
    "iconBounds": {
      "x": 19,
      "y": 31,
      "width": 42,
      "height": 39
    },
    "minVisibleSpan": 38
  },
  "remote_hunter": {
    "bounds": {
      "x": 16,
      "y": 27,
      "width": 48,
      "height": 49
    },
    "iconBounds": {
      "x": 19,
      "y": 31,
      "width": 42,
      "height": 39
    },
    "minVisibleSpan": 35
  },
  "replication_node": {
    "bounds": {
      "x": 18,
      "y": 31,
      "width": 44,
      "height": 45
    },
    "iconBounds": {
      "x": 19,
      "y": 34,
      "width": 42,
      "height": 36
    },
    "minVisibleSpan": 34
  },
  "resistance_corruptor": {
    "bounds": {
      "x": 12,
      "y": 18,
      "width": 57,
      "height": 53
    },
    "iconBounds": {
      "x": 13,
      "y": 30,
      "width": 54,
      "height": 32
    },
    "minVisibleSpan": 42
  },
  "shield_conductor": {
    "bounds": {
      "x": 18,
      "y": 26,
      "width": 44,
      "height": 50
    },
    "iconBounds": {
      "x": 19,
      "y": 34,
      "width": 42,
      "height": 36
    },
    "minVisibleSpan": 34
  },
  "shield_echo": {
    "bounds": {
      "x": 17,
      "y": 21,
      "width": 46,
      "height": 49
    },
    "iconBounds": {
      "x": 24,
      "y": 27,
      "width": 32,
      "height": 38
    },
    "minVisibleSpan": 32
  },
  "siege_ram": {
    "bounds": {
      "x": 15,
      "y": 30,
      "width": 50,
      "height": 46
    },
    "iconBounds": {
      "x": 19,
      "y": 38,
      "width": 42,
      "height": 37
    },
    "minVisibleSpan": 36
  },
  "signal_summoner": {
    "bounds": {
      "x": 18,
      "y": 27,
      "width": 44,
      "height": 49
    },
    "iconBounds": {
      "x": 19,
      "y": 34,
      "width": 42,
      "height": 36
    },
    "minVisibleSpan": 34
  },
  "spike_runner": {
    "bounds": {
      "x": 18,
      "y": 26,
      "width": 44,
      "height": 43
    },
    "iconBounds": {
      "x": 21,
      "y": 32,
      "width": 38,
      "height": 37
    },
    "minVisibleSpan": 34
  },
  "spirit_taxer": {
    "bounds": {
      "x": 11,
      "y": 16,
      "width": 58,
      "height": 57
    },
    "iconBounds": {
      "x": 12,
      "y": 27,
      "width": 56,
      "height": 37
    },
    "minVisibleSpan": 46
  },
  "static_drifter": {
    "bounds": {
      "x": 25,
      "y": 28,
      "width": 30,
      "height": 41
    },
    "iconBounds": {
      "x": 25,
      "y": 27,
      "width": 30,
      "height": 37
    },
    "minVisibleSpan": 32
  },
  "tempo_amplifier": {
    "bounds": {
      "x": 18,
      "y": 34,
      "width": 44,
      "height": 42
    },
    "iconBounds": {
      "x": 19,
      "y": 39,
      "width": 42,
      "height": 31
    },
    "minVisibleSpan": 34
  },
  "terrain_dismantler": {
    "bounds": {
      "x": 11,
      "y": 24,
      "width": 58,
      "height": 52
    },
    "iconBounds": {
      "x": 19,
      "y": 32,
      "width": 42,
      "height": 43
    },
    "minVisibleSpan": 37
  },
  "zero_frequency_mind": {
    "bounds": {
      "x": 15,
      "y": 21,
      "width": 50,
      "height": 55
    },
    "iconBounds": {
      "x": 18,
      "y": 27,
      "width": 44,
      "height": 42
    },
    "minVisibleSpan": 38
  }
};
// END GENERATED ENTITY BOUNDS
export const ENTITY_ART=Object.freeze(Object.fromEntries(Object.entries(definitions).map(([id,[kind,role,locomotion]])=>{
  const variants=Object.freeze(kind==='towers'?[...TOWER_VARIANTS]:role==='boss'?[...BOSS_VARIANTS]:['base']);
  return [id,Object.freeze({cell:80,directions:8,poseRows:10,variants,rows:variants.length*10,iconRows:variants.length,bearing:0,baseline:.72,elevation:55,role,locomotion,kind,minVisibleSpan:ART_BOUNDS[id].minVisibleSpan,bounds:Object.freeze(ART_BOUNDS[id].bounds),iconBounds:Object.freeze(ART_BOUNDS[id].iconBounds),staticPath:`/assets/game/sprites/${kind}/${id}.png`,animationPath:`/assets/game/sprites/animations/${kind}/${id}.png`})];
})));
