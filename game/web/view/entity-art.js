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
  scrap_bulwark:['enemies','normal','crawler'],echo_glider:['enemies','normal','hover'],noise_bell:['enemies','elite','crawler'],
  memory_runner:['enemies','normal','runner'],repair_skiff:['enemies','normal','hover'],archive_warden:['enemies','elite','crawler'],
  ordered_sentinel:['enemies','normal','walker'],null_wing:['enemies','normal','hover'],entropy_engine:['enemies','elite','crawler'],
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
      "x": 14,
      "y": 22,
      "width": 52,
      "height": 52
    },
    "iconBounds": {
      "x": 16,
      "y": 30,
      "width": 48,
      "height": 42
    },
    "minVisibleSpan": 32
  },
  "arc_mortar": {
    "bounds": {
      "x": 17,
      "y": 27,
      "width": 46,
      "height": 45
    },
    "iconBounds": {
      "x": 20,
      "y": 27,
      "width": 40,
      "height": 44
    },
    "minVisibleSpan": 36
  },
  "bandwidth_relay": {
    "bounds": {
      "x": 18,
      "y": 20,
      "width": 44,
      "height": 53
    },
    "iconBounds": {
      "x": 17,
      "y": 22,
      "width": 46,
      "height": 49
    },
    "minVisibleSpan": 36
  },
  "boundary_riveter": {
    "bounds": {
      "x": 16,
      "y": 24,
      "width": 48,
      "height": 49
    },
    "iconBounds": {
      "x": 19,
      "y": 30,
      "width": 42,
      "height": 41
    },
    "minVisibleSpan": 32
  },
  "drone_loom": {
    "bounds": {
      "x": 17,
      "y": 17,
      "width": 46,
      "height": 56
    },
    "iconBounds": {
      "x": 18,
      "y": 25,
      "width": 44,
      "height": 46
    },
    "minVisibleSpan": 40
  },
  "focus_rail": {
    "bounds": {
      "x": 14,
      "y": 20,
      "width": 52,
      "height": 53
    },
    "iconBounds": {
      "x": 22,
      "y": 24,
      "width": 36,
      "height": 47
    },
    "minVisibleSpan": 35
  },
  "frequency_choir": {
    "bounds": {
      "x": 19,
      "y": 22,
      "width": 42,
      "height": 50
    },
    "iconBounds": {
      "x": 19,
      "y": 27,
      "width": 42,
      "height": 44
    },
    "minVisibleSpan": 34
  },
  "memory_mechanic": {
    "bounds": {
      "x": 12,
      "y": 21,
      "width": 56,
      "height": 51
    },
    "iconBounds": {
      "x": 21,
      "y": 29,
      "width": 38,
      "height": 42
    },
    "minVisibleSpan": 34
  },
  "phase_blade": {
    "bounds": {
      "x": 11,
      "y": 20,
      "width": 58,
      "height": 52
    },
    "iconBounds": {
      "x": 15,
      "y": 31,
      "width": 50,
      "height": 40
    },
    "minVisibleSpan": 36
  },
  "pulse_array": {
    "bounds": {
      "x": 17,
      "y": 25,
      "width": 46,
      "height": 47
    },
    "iconBounds": {
      "x": 21,
      "y": 26,
      "width": 38,
      "height": 45
    },
    "minVisibleSpan": 33
  },
  "resistance_beacon": {
    "bounds": {
      "x": 18,
      "y": 22,
      "width": 44,
      "height": 51
    },
    "iconBounds": {
      "x": 21,
      "y": 30,
      "width": 38,
      "height": 41
    },
    "minVisibleSpan": 36
  },
  "resonance_guard": {
    "bounds": {
      "x": 19,
      "y": 25,
      "width": 42,
      "height": 47
    },
    "iconBounds": {
      "x": 18,
      "y": 34,
      "width": 44,
      "height": 37
    },
    "minVisibleSpan": 32
  },
  "archive_warden": {
    "bounds": {
      "x": 19,
      "y": 27,
      "width": 42,
      "height": 46
    },
    "iconBounds": {
      "x": 23,
      "y": 30,
      "width": 34,
      "height": 40
    },
    "minVisibleSpan": 36
  },
  "armored_worm": {
    "bounds": {
      "x": 16,
      "y": 35,
      "width": 48,
      "height": 40
    },
    "iconBounds": {
      "x": 28,
      "y": 38,
      "width": 24,
      "height": 37
    },
    "minVisibleSpan": 31
  },
  "bandwidth_jammer": {
    "bounds": {
      "x": 17,
      "y": 22,
      "width": 46,
      "height": 51
    },
    "iconBounds": {
      "x": 22,
      "y": 31,
      "width": 36,
      "height": 41
    },
    "minVisibleSpan": 37
  },
  "bandwidth_requisitioner": {
    "bounds": {
      "x": 18,
      "y": 32,
      "width": 44,
      "height": 42
    },
    "iconBounds": {
      "x": 19,
      "y": 31,
      "width": 42,
      "height": 41
    },
    "minVisibleSpan": 33
  },
  "chorus_overseer": {
    "bounds": {
      "x": 13,
      "y": 11,
      "width": 54,
      "height": 60
    },
    "iconBounds": {
      "x": 13,
      "y": 11,
      "width": 54,
      "height": 60
    },
    "minVisibleSpan": 41
  },
  "detonation_shell": {
    "bounds": {
      "x": 19,
      "y": 35,
      "width": 42,
      "height": 38
    },
    "iconBounds": {
      "x": 23,
      "y": 33,
      "width": 34,
      "height": 36
    },
    "minVisibleSpan": 32
  },
  "echo_glider": {
    "bounds": {
      "x": 13,
      "y": 25,
      "width": 54,
      "height": 47
    },
    "iconBounds": {
      "x": 12,
      "y": 28,
      "width": 56,
      "height": 45
    },
    "minVisibleSpan": 45
  },
  "entropy_engine": {
    "bounds": {
      "x": 19,
      "y": 29,
      "width": 42,
      "height": 44
    },
    "iconBounds": {
      "x": 23,
      "y": 31,
      "width": 36,
      "height": 39
    },
    "minVisibleSpan": 35
  },
  "floating_noise": {
    "bounds": {
      "x": 16,
      "y": 36,
      "width": 47,
      "height": 38
    },
    "iconBounds": {
      "x": 26,
      "y": 35,
      "width": 28,
      "height": 36
    },
    "minVisibleSpan": 24
  },
  "fracture_seed": {
    "bounds": {
      "x": 17,
      "y": 31,
      "width": 46,
      "height": 44
    },
    "iconBounds": {
      "x": 21,
      "y": 34,
      "width": 38,
      "height": 36
    },
    "minVisibleSpan": 34
  },
  "frequency_hunter": {
    "bounds": {
      "x": 19,
      "y": 31,
      "width": 42,
      "height": 42
    },
    "iconBounds": {
      "x": 24,
      "y": 31,
      "width": 32,
      "height": 38
    },
    "minVisibleSpan": 33
  },
  "memory_medic": {
    "bounds": {
      "x": 16,
      "y": 24,
      "width": 48,
      "height": 51
    },
    "iconBounds": {
      "x": 24,
      "y": 31,
      "width": 32,
      "height": 38
    },
    "minVisibleSpan": 33
  },
  "memory_reforger": {
    "bounds": {
      "x": 17,
      "y": 27,
      "width": 46,
      "height": 46
    },
    "iconBounds": {
      "x": 17,
      "y": 26,
      "width": 46,
      "height": 45
    },
    "minVisibleSpan": 34
  },
  "memory_runner": {
    "bounds": {
      "x": 18,
      "y": 29,
      "width": 44,
      "height": 46
    },
    "iconBounds": {
      "x": 26,
      "y": 32,
      "width": 28,
      "height": 39
    },
    "minVisibleSpan": 33
  },
  "mirror_censor": {
    "bounds": {
      "x": 19,
      "y": 25,
      "width": 42,
      "height": 48
    },
    "iconBounds": {
      "x": 22,
      "y": 27,
      "width": 36,
      "height": 43
    },
    "minVisibleSpan": 32
  },
  "noise_bell": {
    "bounds": {
      "x": 19,
      "y": 29,
      "width": 42,
      "height": 44
    },
    "iconBounds": {
      "x": 22,
      "y": 30,
      "width": 35,
      "height": 41
    },
    "minVisibleSpan": 37
  },
  "noise_hive": {
    "bounds": {
      "x": 19,
      "y": 26,
      "width": 42,
      "height": 48
    },
    "iconBounds": {
      "x": 20,
      "y": 26,
      "width": 40,
      "height": 44
    },
    "minVisibleSpan": 35
  },
  "null_wing": {
    "bounds": {
      "x": 7,
      "y": 20,
      "width": 66,
      "height": 55
    },
    "iconBounds": {
      "x": 21,
      "y": 21,
      "width": 38,
      "height": 53
    },
    "minVisibleSpan": 45
  },
  "ordered_sentinel": {
    "bounds": {
      "x": 16,
      "y": 25,
      "width": 48,
      "height": 50
    },
    "iconBounds": {
      "x": 22,
      "y": 30,
      "width": 36,
      "height": 39
    },
    "minVisibleSpan": 35
  },
  "phase_teleporter": {
    "bounds": {
      "x": 18,
      "y": 27,
      "width": 44,
      "height": 48
    },
    "iconBounds": {
      "x": 23,
      "y": 31,
      "width": 34,
      "height": 39
    },
    "minVisibleSpan": 34
  },
  "pressure_cantor": {
    "bounds": {
      "x": 11,
      "y": 7,
      "width": 58,
      "height": 68
    },
    "iconBounds": {
      "x": 13,
      "y": 16,
      "width": 54,
      "height": 51
    },
    "minVisibleSpan": 50
  },
  "proliferation_protocol": {
    "bounds": {
      "x": 19,
      "y": 28,
      "width": 42,
      "height": 46
    },
    "iconBounds": {
      "x": 24,
      "y": 26,
      "width": 32,
      "height": 45
    },
    "minVisibleSpan": 34
  },
  "remote_hunter": {
    "bounds": {
      "x": 14,
      "y": 25,
      "width": 52,
      "height": 48
    },
    "iconBounds": {
      "x": 25,
      "y": 35,
      "width": 30,
      "height": 37
    },
    "minVisibleSpan": 32
  },
  "repair_skiff": {
    "bounds": {
      "x": 5,
      "y": 13,
      "width": 70,
      "height": 62
    },
    "iconBounds": {
      "x": 13,
      "y": 17,
      "width": 54,
      "height": 53
    },
    "minVisibleSpan": 50
  },
  "replication_node": {
    "bounds": {
      "x": 19,
      "y": 32,
      "width": 42,
      "height": 41
    },
    "iconBounds": {
      "x": 23,
      "y": 32,
      "width": 34,
      "height": 39
    },
    "minVisibleSpan": 32
  },
  "resistance_corruptor": {
    "bounds": {
      "x": 8,
      "y": 12,
      "width": 65,
      "height": 62
    },
    "iconBounds": {
      "x": 16,
      "y": 15,
      "width": 48,
      "height": 56
    },
    "minVisibleSpan": 48
  },
  "scrap_bulwark": {
    "bounds": {
      "x": 18,
      "y": 31,
      "width": 44,
      "height": 42
    },
    "iconBounds": {
      "x": 23,
      "y": 33,
      "width": 34,
      "height": 37
    },
    "minVisibleSpan": 33
  },
  "shield_conductor": {
    "bounds": {
      "x": 18,
      "y": 20,
      "width": 44,
      "height": 55
    },
    "iconBounds": {
      "x": 21,
      "y": 28,
      "width": 38,
      "height": 42
    },
    "minVisibleSpan": 36
  },
  "shield_echo": {
    "bounds": {
      "x": 12,
      "y": 14,
      "width": 56,
      "height": 61
    },
    "iconBounds": {
      "x": 20,
      "y": 17,
      "width": 40,
      "height": 49
    },
    "minVisibleSpan": 43
  },
  "siege_ram": {
    "bounds": {
      "x": 19,
      "y": 34,
      "width": 42,
      "height": 40
    },
    "iconBounds": {
      "x": 25,
      "y": 36,
      "width": 30,
      "height": 34
    },
    "minVisibleSpan": 30
  },
  "signal_summoner": {
    "bounds": {
      "x": 19,
      "y": 22,
      "width": 42,
      "height": 51
    },
    "iconBounds": {
      "x": 23,
      "y": 21,
      "width": 34,
      "height": 49
    },
    "minVisibleSpan": 35
  },
  "spike_runner": {
    "bounds": {
      "x": 10,
      "y": 26,
      "width": 60,
      "height": 48
    },
    "iconBounds": {
      "x": 24,
      "y": 32,
      "width": 32,
      "height": 37
    },
    "minVisibleSpan": 31
  },
  "spirit_taxer": {
    "bounds": {
      "x": 12,
      "y": 17,
      "width": 56,
      "height": 57
    },
    "iconBounds": {
      "x": 12,
      "y": 23,
      "width": 56,
      "height": 47
    },
    "minVisibleSpan": 51
  },
  "static_drifter": {
    "bounds": {
      "x": 11,
      "y": 5,
      "width": 58,
      "height": 65
    },
    "iconBounds": {
      "x": 21,
      "y": 26,
      "width": 40,
      "height": 40
    },
    "minVisibleSpan": 36
  },
  "tempo_amplifier": {
    "bounds": {
      "x": 19,
      "y": 31,
      "width": 42,
      "height": 42
    },
    "iconBounds": {
      "x": 21,
      "y": 32,
      "width": 38,
      "height": 37
    },
    "minVisibleSpan": 34
  },
  "terrain_dismantler": {
    "bounds": {
      "x": 15,
      "y": 26,
      "width": 50,
      "height": 49
    },
    "iconBounds": {
      "x": 23,
      "y": 35,
      "width": 34,
      "height": 38
    },
    "minVisibleSpan": 31
  },
  "zero_frequency_mind": {
    "bounds": {
      "x": 19,
      "y": 31,
      "width": 42,
      "height": 43
    },
    "iconBounds": {
      "x": 19,
      "y": 31,
      "width": 42,
      "height": 40
    },
    "minVisibleSpan": 32
  }
};
// END GENERATED ENTITY BOUNDS
export const ENTITY_ART=Object.freeze(Object.fromEntries(Object.entries(definitions).map(([id,[kind,role,locomotion]])=>{
  const variants=Object.freeze(kind==='towers'?[...TOWER_VARIANTS]:role==='boss'?[...BOSS_VARIANTS]:['base']);
  return [id,Object.freeze({cell:80,directions:8,poseRows:10,variants,rows:variants.length*10,iconRows:variants.length,bearing:0,baseline:.72,elevation:55,role,locomotion,kind,minVisibleSpan:ART_BOUNDS[id].minVisibleSpan,bounds:Object.freeze(ART_BOUNDS[id].bounds),iconBounds:Object.freeze(ART_BOUNDS[id].iconBounds),staticPath:`/assets/game/sprites/${kind}/${id}.png`,animationPath:`/assets/game/sprites/animations/${kind}/${id}.png`,deathRows:kind==='enemies'?4:0,deathPath:kind==='enemies'?`/assets/game/sprites/death/enemies/${id}.png`:null})];
})));
