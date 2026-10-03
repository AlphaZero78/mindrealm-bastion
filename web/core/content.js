// Stable content IDs and seeded randomness are shared by browser and simulation.
import { difficultySummary } from './difficulty.js';
import { extraEvents } from './extra-events.js';
import { nexusRelics } from './nexus-content.js';
export { messengers, nexusRelics } from './nexus-content.js';
const data = {
  "acts": [
    {
      "id": "noise_frontier",
      "name": "噪声边境",
      "floors": 17,
      "normal_focus": 35,
      "elite_focus": 80,
      "color": "36d8e8",
      "bosses": [
        "noise_hive",
        "mirror_censor"
      ]
    },
    {
      "id": "memory_factory",
      "name": "记忆工厂",
      "floors": 16,
      "normal_focus": 40,
      "elite_focus": 90,
      "color": "d6a24a",
      "bosses": [
        "memory_reforger",
        "bandwidth_requisitioner"
      ]
    },
    {
      "id": "control_core",
      "name": "统御核心",
      "floors": 15,
      "normal_focus": 45,
      "elite_focus": 100,
      "color": "d44c9d",
      "bosses": [
        "chorus_overseer",
        "zero_frequency_mind"
      ]
    }
  ],
  "towers": [
    {
      "id": "anchor_bulwark",
      "name": "锚定壁垒",
      "role": "melee",
      "description": "地面承伤构造。进入其近战范围的敌人优先攻击它；不能拦停空中目标。适合守住狭窄通路，依靠远程火力完成击杀。",
      "hp": 260,
      "attack": 18,
      "rate": 1.1,
      "range": 2.16,
      "armor": 9,
      "bandwidth": 3,
      "upkeep": 40,
      "footprint": [
        2,
        2
      ],
      "targets": "ground",
      "attack_kind": "direct",
      "ability": "taunt",
      "branches": {
        "A": {
          "name": "反震锚",
          "description": "每次承伤后若仍存活，立即以65%攻击力反击攻击者；反震伤害忽略护甲。",
          "hp_mult": 1.2,
          "attack_mult": 1.25,
          "effect": "counter"
        },
        "B": {
          "name": "深层基座",
          "description": "获得额外护甲；3格内其他构造承伤降低18%。",
          "hp_mult": 1.45,
          "attack_mult": 0.9,
          "effect": "guard"
        }
      },
      "sprite_id": "anchor_bulwark"
    },
    {
      "id": "phase_blade",
      "name": "相位刃",
      "role": "melee",
      "description": "快速攻击地面目标，每次攻击以伤害的10%恢复自身耐久。适合持续接敌，低护甲意味着需要支援保护。",
      "hp": 170,
      "attack": 34,
      "rate": 0.62,
      "range": 2.48,
      "armor": 4,
      "bandwidth": 3,
      "upkeep": 45,
      "footprint": [
        2,
        2
      ],
      "targets": "ground",
      "attack_kind": "direct",
      "ability": "lifesteal",
      "branches": {
        "A": {
          "name": "吸能刃",
          "description": "吸血由10%提高到22%攻击伤害。",
          "hp_mult": 1.15,
          "attack_mult": 1.18,
          "effect": "lifesteal_plus"
        },
        "B": {
          "name": "解甲刃",
          "description": "每次命中永久削去目标2点护甲，最低0。",
          "hp_mult": 1,
          "attack_mult": 1.35,
          "effect": "armor_break"
        }
      },
      "sprite_id": "phase_blade"
    },
    {
      "id": "boundary_riveter",
      "name": "边界铆钉",
      "role": "melee",
      "description": "受到攻城敌人的伤害降低45%。只能守住地面，适合挡在拆障者前方，保护身后的高台和射手。",
      "hp": 315,
      "attack": 14,
      "rate": 1.35,
      "range": 2.08,
      "armor": 12,
      "bandwidth": 4,
      "upkeep": 55,
      "footprint": [
        3,
        2
      ],
      "targets": "ground",
      "attack_kind": "direct",
      "ability": "siege_resist",
      "branches": {
        "A": {
          "name": "自修铆钉",
          "description": "连续4秒未受攻击后，每秒恢复2.5%最大耐久。",
          "hp_mult": 1.3,
          "attack_mult": 1,
          "effect": "self_repair"
        },
        "B": {
          "name": "束缚铆钉",
          "description": "每次攻击将目标定身0.65秒。",
          "hp_mult": 1.12,
          "attack_mult": 1.15,
          "effect": "root"
        }
      },
      "sprite_id": "boundary_riveter"
    },
    {
      "id": "resonance_guard",
      "name": "共振守卫",
      "role": "melee",
      "description": "使3格内其他构造受到的攻击伤害降低18%；同类护盾不重复叠加。需要靠近前线，不能保护自己。",
      "hp": 225,
      "attack": 20,
      "rate": 1,
      "range": 2.32,
      "armor": 7,
      "bandwidth": 4,
      "upkeep": 52,
      "footprint": [
        2,
        2
      ],
      "targets": "ground",
      "attack_kind": "direct",
      "ability": "ally_shield",
      "branches": {
        "A": {
          "name": "群体共振",
          "description": "盟友减伤覆盖从3格扩大到6格，仍降低18%承伤。",
          "hp_mult": 1.18,
          "attack_mult": 1,
          "effect": "wide_shield"
        },
        "B": {
          "name": "压力导流",
          "description": "射程内敌人死亡时，原始精神压力降低30%。",
          "hp_mult": 1.1,
          "attack_mult": 1.2,
          "effect": "pressure_sink"
        }
      },
      "sprite_id": "resonance_guard"
    },
    {
      "id": "pulse_array",
      "name": "脉冲针列",
      "role": "ranged",
      "description": "高速直接射击，能攻击地面和空中。必须部署在高台，地形会挡住射线；适合远处截击以降低死亡压力。",
      "hp": 105,
      "attack": 19,
      "rate": 0.42,
      "range": 8.8,
      "armor": 2,
      "bandwidth": 3,
      "upkeep": 42,
      "footprint": [
        2,
        2
      ],
      "targets": "all",
      "attack_kind": "direct",
      "ability": "rapid",
      "branches": {
        "A": {
          "name": "连锁针列",
          "description": "命中后向目标3.5格内另一名敌人连锁一次，造成60%伤害并单独结算护甲。",
          "hp_mult": 1,
          "attack_mult": 1.15,
          "effect": "chain"
        },
        "B": {
          "name": "防空针列",
          "description": "对空伤害额外提高80%，对地仍可攻击。",
          "hp_mult": 1.05,
          "attack_mult": 1.25,
          "effect": "anti_air"
        }
      },
      "sprite_id": "pulse_array"
    },
    {
      "id": "focus_rail",
      "name": "聚焦轨炮",
      "role": "ranged",
      "description": "长射程直接射击，默认优先当前生命最高的敌人。单发威力高、攻击间隔长；适合精英和首领，需要其他火力补漏。",
      "hp": 115,
      "attack": 78,
      "rate": 1.75,
      "range": 11.52,
      "armor": 3,
      "bandwidth": 5,
      "upkeep": 68,
      "footprint": [
        3,
        2
      ],
      "targets": "all",
      "attack_kind": "direct",
      "ability": "high_hp_priority",
      "branches": {
        "A": {
          "name": "穿透轨",
          "description": "忽略60%护甲，贯穿弹道后方敌人造成65%伤害；每名目标独立检查高度、视线与护甲。",
          "hp_mult": 1,
          "attack_mult": 1.2,
          "effect": "pierce"
        },
        "B": {
          "name": "处决轨",
          "description": "目标生命低于30%时伤害额外提高65%。",
          "hp_mult": 1.05,
          "attack_mult": 1.35,
          "effect": "execute"
        }
      },
      "sprite_id": "focus_rail"
    },
    {
      "id": "arc_mortar",
      "name": "弧光迫击炮",
      "role": "ranged",
      "description": "间接攻击能越过地形；只攻击地面，爆炸半径2.3格，次级目标承受65%伤害，并减速1.2秒。适合聚集的地面敌人。",
      "hp": 120,
      "attack": 54,
      "rate": 2.2,
      "range": 10.24,
      "armor": 2,
      "bandwidth": 5,
      "upkeep": 65,
      "footprint": [
        3,
        3
      ],
      "targets": "ground",
      "attack_kind": "indirect",
      "ability": "splash",
      "branches": {
        "A": {
          "name": "扩散弹",
          "description": "爆炸半径从2.3扩大到3.4格，减速持续从1.2提高到2.5秒。",
          "hp_mult": 1,
          "attack_mult": 1.12,
          "effect": "large_splash"
        },
        "B": {
          "name": "腐蚀弹",
          "description": "每次爆炸命中使目标永久失去2点护甲，最低0。",
          "hp_mult": 1.05,
          "attack_mult": 1.25,
          "effect": "corrosion"
        }
      },
      "sprite_id": "arc_mortar"
    },
    {
      "id": "drone_loom",
      "name": "无人机织机",
      "role": "ranged",
      "description": "无人机间接攻击地面与空中目标，能越过地形遮挡。射程较短于轨炮，适合有遮挡的高台和多入口防守。",
      "hp": 135,
      "attack": 26,
      "rate": 0.95,
      "range": 9.6,
      "armor": 3,
      "bandwidth": 5,
      "upkeep": 62,
      "footprint": [
        3,
        2
      ],
      "targets": "all",
      "attack_kind": "indirect",
      "ability": "drone",
      "branches": {
        "A": {
          "name": "蜂群织机",
          "description": "每轮派出第二架无人机，攻击另一名射程内目标并造成60%伤害。",
          "hp_mult": 1,
          "attack_mult": 1.1,
          "effect": "extra_drone"
        },
        "B": {
          "name": "标记织机",
          "description": "命中后标记目标4秒，使其受到的后续伤害提高15%。",
          "hp_mult": 1.1,
          "attack_mult": 1.15,
          "effect": "mark"
        }
      },
      "sprite_id": "drone_loom"
    },
    {
      "id": "bandwidth_relay",
      "name": "带宽中继",
      "role": "support",
      "description": "启用时提供额外带宽（T1为5）；自身占用带宽。损坏或过载禁用后立刻停止增益，因此应优先部署并保护它。",
      "hp": 150,
      "attack": 0,
      "rate": 1,
      "range": 6.4,
      "armor": 5,
      "bandwidth": 2,
      "upkeep": 50,
      "footprint": [
        2,
        2
      ],
      "targets": "none",
      "attack_kind": "support",
      "ability": "bandwidth_plus",
      "support_value": 5,
      "branches": {
        "A": {
          "name": "宽域中继",
          "description": "强化全局带宽供给；禁用时停止提供带宽。",
          "hp_mult": 1.15,
          "attack_mult": 1,
          "effect": "bandwidth_plus_more"
        },
        "B": {
          "name": "抗扰中继",
          "description": "启用时吸收3点临时带宽干扰；同分支中继不叠加该缓冲。",
          "hp_mult": 1.35,
          "attack_mult": 1,
          "effect": "jam_resist"
        }
      },
      "sprite_id": "bandwidth_relay"
    },
    {
      "id": "memory_mechanic",
      "name": "记忆维修师",
      "role": "support",
      "description": "周期性维修范围内缺失耐久最多的存活构造。不能复活已经损坏的构造，也不主动攻击；需要放在安全位置覆盖前线。",
      "hp": 140,
      "attack": 18,
      "rate": 1.25,
      "range": 7.2,
      "armor": 4,
      "bandwidth": 4,
      "upkeep": 58,
      "footprint": [
        2,
        2
      ],
      "targets": "ally",
      "attack_kind": "support",
      "ability": "repair",
      "branches": {
        "A": {
          "name": "紧急维修",
          "description": "对耐久低于35%的目标，每次维修量提高60%。",
          "hp_mult": 1.1,
          "attack_mult": 1.4,
          "effect": "critical_repair"
        },
        "B": {
          "name": "装甲覆写",
          "description": "被维修者获得3点护甲，持续3秒。",
          "hp_mult": 1.2,
          "attack_mult": 1.15,
          "effect": "armor_repair"
        }
      },
      "sprite_id": "memory_mechanic"
    },
    {
      "id": "frequency_choir",
      "name": "频率合唱器",
      "role": "support",
      "description": "提高范围内友军的攻击频率，并以频率加成的一半提高伤害（T1为12%频率、6%伤害）。不攻击，适合密集的支援网络。",
      "hp": 125,
      "attack": 0,
      "rate": 1,
      "range": 6.72,
      "armor": 3,
      "bandwidth": 4,
      "upkeep": 56,
      "footprint": [
        2,
        2
      ],
      "targets": "none",
      "attack_kind": "support",
      "ability": "haste_aura",
      "support_value": 0.12,
      "branches": {
        "A": {
          "name": "激励合唱",
          "description": "友军攻击频率额外提高12%，伤害额外提高6%；与本体阶级增益相加。",
          "hp_mult": 1.1,
          "attack_mult": 1,
          "effect": "strong_haste"
        },
        "B": {
          "name": "迟滞合唱",
          "description": "持续使范围内敌人移动速度降低40%，离开范围后短暂消退。保留本体的友军强化。",
          "hp_mult": 1.15,
          "attack_mult": 1,
          "effect": "slow_aura"
        }
      },
      "sprite_id": "frequency_choir"
    },
    {
      "id": "resistance_beacon",
      "name": "抗性信标",
      "role": "support",
      "description": "启用时提高本局抗性（T1为3），直接吸收抵达火种的死亡压力。自身不攻击，损坏或禁用后停止提供抗性。",
      "hp": 165,
      "attack": 0,
      "rate": 1,
      "range": 8,
      "armor": 6,
      "bandwidth": 4,
      "upkeep": 60,
      "footprint": [
        2,
        2
      ],
      "targets": "none",
      "attack_kind": "support",
      "ability": "resistance_plus",
      "support_value": 3,
      "branches": {
        "A": {
          "name": "深层抗性",
          "description": "强化全局精神抗性；启用时持续生效。",
          "hp_mult": 1.25,
          "attack_mult": 1,
          "effect": "resistance_plus_more"
        },
        "B": {
          "name": "压力滤波",
          "description": "射程内敌人死亡时原始精神压力降低30%，并保留本体抗性。适合覆盖预计击杀区。",
          "hp_mult": 1.15,
          "attack_mult": 1,
          "effect": "pressure_filter"
        }
      },
      "sprite_id": "resistance_beacon"
    }
  ],
  "enemies": [
    {
      "id": "static_drifter",
      "name": "静噪漂移体",
      "act": 1,
      "hp": 82,
      "speed": 1,
      "attack": 14,
      "armor": 1,
      "pressure": 4,
      "xp": 18,
      "focus": 2,
      "core_damage": 4,
      "air": false,
      "ability": "none",
      "kind": "normal"
    },
    {
      "id": "spike_runner",
      "name": "尖峰奔袭体",
      "act": 1,
      "hp": 55,
      "speed": 1.65,
      "attack": 11,
      "armor": 0,
      "pressure": 3,
      "xp": 16,
      "focus": 2,
      "core_damage": 4,
      "air": false,
      "ability": "sprint",
      "kind": "normal"
    },
    {
      "id": "shield_echo",
      "name": "护盾回声",
      "act": 1,
      "hp": 118,
      "speed": 0.82,
      "attack": 13,
      "armor": 5,
      "pressure": 5.5,
      "xp": 24,
      "focus": 3,
      "core_damage": 5,
      "air": false,
      "ability": "shield",
      "kind": "normal"
    },
    {
      "id": "tempo_amplifier",
      "name": "节拍增幅器",
      "act": 1,
      "hp": 76,
      "speed": 0.92,
      "attack": 10,
      "armor": 1,
      "pressure": 4.5,
      "xp": 26,
      "focus": 3,
      "core_damage": 4,
      "air": false,
      "ability": "haste",
      "kind": "normal"
    },
    {
      "id": "fracture_seed",
      "name": "裂解种子",
      "act": 1,
      "hp": 96,
      "speed": 0.88,
      "attack": 12,
      "armor": 2,
      "pressure": 7,
      "xp": 28,
      "focus": 4,
      "core_damage": 5,
      "air": false,
      "ability": "split",
      "kind": "normal"
    },
    {
      "id": "floating_noise",
      "name": "悬浮噪点",
      "act": 1,
      "hp": 68,
      "speed": 1.25,
      "attack": 10,
      "armor": 1,
      "pressure": 4,
      "xp": 22,
      "focus": 3,
      "core_damage": 4,
      "air": true,
      "ability": "air",
      "kind": "normal"
    },
    {
      "id": "remote_hunter",
      "name": "远距猎杀者",
      "act": 2,
      "hp": 135,
      "speed": 0.9,
      "attack": 24,
      "armor": 3,
      "pressure": 6,
      "xp": 36,
      "focus": 5,
      "core_damage": 6,
      "air": false,
      "ability": "tower_hunter",
      "kind": "normal"
    },
    {
      "id": "siege_ram",
      "name": "攻城冲锤",
      "act": 2,
      "hp": 230,
      "speed": 0.62,
      "attack": 36,
      "armor": 8,
      "pressure": 9,
      "xp": 48,
      "focus": 7,
      "core_damage": 8,
      "air": false,
      "ability": "siege",
      "kind": "normal"
    },
    {
      "id": "memory_medic",
      "name": "记忆医师",
      "act": 2,
      "hp": 116,
      "speed": 0.82,
      "attack": 12,
      "armor": 3,
      "pressure": 6.5,
      "xp": 42,
      "focus": 6,
      "core_damage": 5,
      "air": false,
      "ability": "heal",
      "kind": "normal"
    },
    {
      "id": "bandwidth_jammer",
      "name": "带宽干扰体",
      "act": 2,
      "hp": 145,
      "speed": 0.78,
      "attack": 16,
      "armor": 4,
      "pressure": 8,
      "xp": 46,
      "focus": 7,
      "core_damage": 6,
      "air": false,
      "ability": "jam",
      "kind": "normal"
    },
    {
      "id": "phase_teleporter",
      "name": "相位迁跃体",
      "act": 2,
      "hp": 108,
      "speed": 1.05,
      "attack": 18,
      "armor": 2,
      "pressure": 7,
      "xp": 40,
      "focus": 6,
      "core_damage": 7,
      "air": false,
      "ability": "teleport",
      "kind": "normal"
    },
    {
      "id": "replication_node",
      "name": "复制节点",
      "act": 2,
      "hp": 165,
      "speed": 0.72,
      "attack": 14,
      "armor": 5,
      "pressure": 9,
      "xp": 50,
      "focus": 8,
      "core_damage": 7,
      "air": false,
      "ability": "copy",
      "kind": "normal"
    },
    {
      "id": "pressure_cantor",
      "name": "压力咏唱者",
      "act": 3,
      "hp": 180,
      "speed": 0.85,
      "attack": 23,
      "armor": 5,
      "pressure": 14,
      "xp": 62,
      "focus": 9,
      "core_damage": 8,
      "air": false,
      "ability": "pressure_aura",
      "kind": "normal"
    },
    {
      "id": "armored_worm",
      "name": "装甲蠕行体",
      "act": 3,
      "hp": 330,
      "speed": 0.58,
      "attack": 32,
      "armor": 12,
      "pressure": 12,
      "xp": 70,
      "focus": 10,
      "core_damage": 10,
      "air": false,
      "ability": "armored",
      "kind": "normal"
    },
    {
      "id": "shield_conductor",
      "name": "护盾指挥体",
      "act": 3,
      "hp": 195,
      "speed": 0.74,
      "attack": 20,
      "armor": 6,
      "pressure": 10,
      "xp": 64,
      "focus": 9,
      "core_damage": 7,
      "air": false,
      "ability": "group_shield",
      "kind": "normal"
    },
    {
      "id": "signal_summoner",
      "name": "信号召集体",
      "act": 3,
      "hp": 205,
      "speed": 0.7,
      "attack": 18,
      "armor": 5,
      "pressure": 12,
      "xp": 72,
      "focus": 11,
      "core_damage": 9,
      "air": false,
      "ability": "summon",
      "kind": "normal"
    },
    {
      "id": "resistance_corruptor",
      "name": "抗性腐蚀体",
      "act": 3,
      "hp": 170,
      "speed": 0.92,
      "attack": 22,
      "armor": 4,
      "pressure": 13,
      "xp": 68,
      "focus": 10,
      "core_damage": 9,
      "air": true,
      "ability": "corrode_resistance",
      "kind": "normal"
    },
    {
      "id": "detonation_shell",
      "name": "爆裂外壳",
      "act": 3,
      "hp": 155,
      "speed": 1,
      "attack": 21,
      "armor": 3,
      "pressure": 15,
      "xp": 66,
      "focus": 10,
      "core_damage": 11,
      "air": false,
      "ability": "explode",
      "kind": "normal"
    },
    {
      "id": "frequency_hunter",
      "name": "截频猎手",
      "act": 1,
      "hp": 760,
      "speed": 1,
      "attack": 34,
      "armor": 8,
      "pressure": 22,
      "xp": 180,
      "focus": 20,
      "core_damage": 18,
      "air": false,
      "ability": "tower_hunter",
      "kind": "elite"
    },
    {
      "id": "terrain_dismantler",
      "name": "地形拆解者",
      "act": 2,
      "hp": 1120,
      "speed": 0.65,
      "attack": 58,
      "armor": 14,
      "pressure": 28,
      "xp": 260,
      "focus": 28,
      "core_damage": 24,
      "air": false,
      "ability": "siege",
      "kind": "elite"
    },
    {
      "id": "proliferation_protocol",
      "name": "增殖协议体",
      "act": 2,
      "hp": 880,
      "speed": 0.78,
      "attack": 31,
      "armor": 10,
      "pressure": 30,
      "xp": 240,
      "focus": 28,
      "core_damage": 22,
      "air": false,
      "ability": "summon",
      "kind": "elite"
    },
    {
      "id": "spirit_taxer",
      "name": "精神税吏",
      "act": 3,
      "hp": 1380,
      "speed": 0.72,
      "attack": 48,
      "armor": 16,
      "pressure": 45,
      "xp": 340,
      "focus": 36,
      "core_damage": 30,
      "air": true,
      "ability": "corrode_resistance",
      "kind": "elite"
    },
    {
      "id": "noise_hive",
      "name": "噪声母巢",
      "act": 1,
      "hp": 3600,
      "speed": 0.42,
      "attack": 42,
      "armor": 12,
      "pressure": 55,
      "xp": 600,
      "focus": 80,
      "core_damage": 8,
      "air": false,
      "ability": "summon",
      "hint": "会以可见脉冲召集受限增援。",
      "kind": "boss"
    },
    {
      "id": "mirror_censor",
      "name": "镜像审查官",
      "act": 1,
      "hp": 3300,
      "speed": 0.5,
      "attack": 48,
      "armor": 10,
      "pressure": 50,
      "xp": 600,
      "focus": 80,
      "core_damage": 9,
      "air": false,
      "ability": "copy",
      "hint": "会复制本场已出现的功能型信号。",
      "kind": "boss"
    },
    {
      "id": "memory_reforger",
      "name": "记忆重铸机",
      "act": 2,
      "hp": 5200,
      "speed": 0.4,
      "attack": 58,
      "armor": 18,
      "pressure": 70,
      "xp": 850,
      "focus": 100,
      "core_damage": 10,
      "air": false,
      "ability": "heal",
      "hint": "周期性重铸受损敌人并维修自身。",
      "kind": "boss"
    },
    {
      "id": "bandwidth_requisitioner",
      "name": "带宽征用者",
      "act": 2,
      "hp": 4950,
      "speed": 0.46,
      "attack": 62,
      "armor": 16,
      "pressure": 72,
      "xp": 850,
      "focus": 100,
      "core_damage": 11,
      "air": false,
      "ability": "jam",
      "hint": "会在明确倒计时后征用带宽。",
      "kind": "boss"
    },
    {
      "id": "chorus_overseer",
      "name": "合唱监管者",
      "act": 3,
      "hp": 7200,
      "speed": 0.38,
      "attack": 72,
      "armor": 20,
      "pressure": 95,
      "xp": 1200,
      "focus": 130,
      "core_damage": 12,
      "air": true,
      "ability": "group_shield",
      "hint": "以合唱连接多路敌人并共享护盾。",
      "kind": "boss"
    },
    {
      "id": "zero_frequency_mind",
      "name": "零频主脑",
      "act": 3,
      "hp": 7800,
      "speed": 0.34,
      "attack": 78,
      "armor": 18,
      "pressure": 105,
      "xp": 1300,
      "focus": 140,
      "core_damage": 8,
      "air": false,
      "ability": "siege",
      "hint": "会改变战场规则重点并亲自拆解屏障。",
      "kind": "boss"
    }
  ],
  "relics": [
    {
      "id": "elevated_lens",
      "name": "高台透镜",
      "theme": "高地远程",
      "description": "高度2以上远程伤害提高15%。",
      "effect": "highground_damage",
      "value": 0.15
    },
    {
      "id": "clear_horizon",
      "name": "澄明地平线",
      "theme": "高地远程",
      "description": "直接射击射程提高8%。",
      "effect": "direct_range",
      "value": 0.08
    },
    {
      "id": "skyhook_rounds",
      "name": "天钩弹芯",
      "theme": "高地远程",
      "description": "对飞行目标伤害提高25%。",
      "effect": "anti_air_damage",
      "value": 0.25
    },
    {
      "id": "calibrated_scope",
      "name": "校准瞄具",
      "theme": "高地远程",
      "description": "远程攻击忽略2点护甲。",
      "effect": "ranged_pierce",
      "value": 2
    },
    {
      "id": "overlook_protocol",
      "name": "俯瞰协议",
      "theme": "高地远程",
      "description": "高度3或4的单位攻击间隔降低12%。",
      "effect": "height_rate",
      "value": 0.12
    },
    {
      "id": "impact_lattice",
      "name": "冲击晶格",
      "theme": "近战承伤",
      "description": "近战最大耐久提高18%。",
      "effect": "melee_hp",
      "value": 0.18
    },
    {
      "id": "return_current",
      "name": "回流电流",
      "theme": "近战承伤",
      "description": "启用中的近战承伤时，将实际所受伤害的8%反射给攻击者；反震伤害忽略护甲。",
      "effect": "melee_reflect",
      "value": 0.08
    },
    {
      "id": "cheap_relocation",
      "name": "柔性基座",
      "theme": "近战承伤",
      "description": "搬迁和撤回费用降低40%。",
      "effect": "relocate_discount",
      "value": 0.4
    },
    {
      "id": "repair_reserve",
      "name": "维修储备",
      "theme": "近战承伤",
      "description": "维修费用降低25%。",
      "effect": "repair_discount",
      "value": 0.25
    },
    {
      "id": "lasting_anchor",
      "name": "恒定锚",
      "theme": "近战承伤",
      "description": "低于35%耐久时护甲提高5。",
      "effect": "low_hp_armor",
      "value": 5
    },
    {
      "id": "mesh_network",
      "name": "网状心智",
      "theme": "支援网络",
      "description": "支援范围提高15%。",
      "effect": "support_range",
      "value": 0.15
    },
    {
      "id": "shared_clock",
      "name": "共享时钟",
      "theme": "支援网络",
      "description": "受支援单位攻击间隔降低8%。",
      "effect": "support_rate",
      "value": 0.08
    },
    {
      "id": "maintenance_loop",
      "name": "维护回路",
      "theme": "支援网络",
      "description": "每场战斗结束时，缺失耐久最多的存活构造恢复8%最大耐久；保持原位置。",
      "effect": "post_repair",
      "value": 0.08
    },
    {
      "id": "redundant_relay",
      "name": "冗余中继",
      "theme": "支援网络",
      "description": "战斗中的带宽干扰先由额外2点缓冲吸收。中继禁用后仍停止提供带宽。",
      "effect": "overload_buffer",
      "value": 2
    },
    {
      "id": "local_shield",
      "name": "局部屏蔽",
      "theme": "支援网络",
      "description": "支援单位附近友军获得2点护甲。",
      "effect": "support_armor",
      "value": 2
    },
    {
      "id": "distant_silence",
      "name": "远端静默",
      "theme": "远距压力控制",
      "description": "距离火种12格外死亡压力降低20%。",
      "effect": "far_pressure",
      "value": 0.2
    },
    {
      "id": "resistance_prism",
      "name": "抗性棱镜",
      "theme": "远距压力控制",
      "description": "精神抗性提高4。",
      "effect": "resistance",
      "value": 4
    },
    {
      "id": "slow_decay",
      "name": "缓释衰减",
      "theme": "远距压力控制",
      "description": "减速目标死亡压力降低15%。",
      "effect": "slow_pressure",
      "value": 0.15
    },
    {
      "id": "clean_kill",
      "name": "洁净终止",
      "theme": "远距压力控制",
      "description": "单次过量伤害超过目标生命25%时压力降低20%。",
      "effect": "overkill_pressure",
      "value": 0.2
    },
    {
      "id": "pulse_absorber",
      "name": "脉冲吸收器",
      "theme": "远距压力控制",
      "description": "每10秒完全吸收一次不高于8的压力伤害。",
      "effect": "pressure_absorb",
      "value": 8
    },
    {
      "id": "redline_amplifier",
      "name": "红线放大器",
      "theme": "低精神爆发",
      "description": "精神稳定低于35%时伤害提高20%。",
      "effect": "low_spirit_damage",
      "value": 0.2
    },
    {
      "id": "crisis_focus",
      "name": "危机专注",
      "theme": "低精神爆发",
      "description": "精神稳定首次低于50%时获得30专注。",
      "effect": "crisis_focus",
      "value": 30
    },
    {
      "id": "pain_filter",
      "name": "疼痛滤波器",
      "theme": "低精神爆发",
      "description": "精神稳定低于25%时抗性提高5。",
      "effect": "crisis_resistance",
      "value": 5
    },
    {
      "id": "final_resolve",
      "name": "最终决意",
      "theme": "低精神爆发",
      "description": "每场战斗首次致命伤害改为保留1点精神稳定。",
      "effect": "death_guard",
      "value": 1
    },
    {
      "id": "volatile_clarity",
      "name": "易爆清醒",
      "theme": "低精神爆发",
      "description": "精神稳定低于35%时攻击提高15%；维修费始终增加15%。",
      "effect": "volatile",
      "value": 0.15
    },
    {
      "id": "wide_channel",
      "name": "宽信道",
      "theme": "带宽扩张",
      "description": "带宽上限提高4。",
      "effect": "bandwidth",
      "value": 4
    },
    {
      "id": "compact_encoding",
      "name": "紧凑编码",
      "theme": "带宽扩张",
      "description": "T1单位占用带宽减少1，最低1。",
      "effect": "t1_bandwidth",
      "value": 1
    },
    {
      "id": "overload_buffer",
      "name": "过载缓冲",
      "theme": "带宽扩张",
      "description": "战斗中带宽下降先由3点缓冲吸收。",
      "effect": "overload_buffer",
      "value": 3
    },
    {
      "id": "signal_dividend",
      "name": "信号红利",
      "theme": "带宽扩张",
      "description": "战斗结束时每5点未使用带宽获得4专注。",
      "effect": "unused_bandwidth_focus",
      "value": 4
    },
    {
      "id": "relay_efficiency",
      "name": "中继效率",
      "theme": "带宽扩张",
      "description": "带宽中继自身占用减少1。",
      "effect": "relay_cost",
      "value": 1
    }
  ],
  "talents": [
    {
      "id": "height_mastery",
      "name": "高差掌握",
      "theme": "高地远程",
      "description": "远程单位对低处目标每级高度差额外获得3%射程与伤害，最多四级。",
      "effect": "height_bonus",
      "value": 0.03
    },
    {
      "id": "target_solution",
      "name": "目标解算",
      "theme": "高地远程",
      "description": "优先级设为最高生命时，远程单位伤害提高12%。",
      "effect": "high_hp_damage",
      "value": 0.12
    },
    {
      "id": "clear_line",
      "name": "清晰射界",
      "theme": "高地远程",
      "description": "直接攻击射程增加8%；仍需满足地形视线。",
      "effect": "direct_range",
      "value": 0.08
    },
    {
      "id": "mortar_math",
      "name": "弹道数学",
      "theme": "高地远程",
      "description": "范围轰击的爆炸半径提高18%。",
      "effect": "indirect_radius",
      "value": 0.18
    },
    {
      "id": "unbroken_line",
      "name": "不破阵线",
      "theme": "近战承伤",
      "description": "每场战斗中每个近战单位首次受到普通致命攻击时保留1点耐久。",
      "effect": "melee_guard",
      "value": 1
    },
    {
      "id": "counter_rhythm",
      "name": "反击节律",
      "theme": "近战承伤",
      "description": "启用中的近战每承受5次攻击后若仍存活，立即以65%攻击力反击；反震伤害忽略护甲。",
      "effect": "counter_hits",
      "value": 5
    },
    {
      "id": "hardened_footing",
      "name": "硬化立足",
      "theme": "近战承伤",
      "description": "近战单位受到的攻击伤害降低10%。",
      "effect": "melee_reduction",
      "value": 0.1
    },
    {
      "id": "field_patch",
      "name": "现场补片",
      "theme": "近战承伤",
      "description": "战斗结束时存活近战恢复5%耐久。",
      "effect": "melee_post_repair",
      "value": 0.05
    },
    {
      "id": "linked_support",
      "name": "支援链接",
      "theme": "支援网络",
      "description": "同时被至少两个支援覆盖的友军，维修、合唱强化和支援护甲效果提高15%；不改变全局带宽或抗性。",
      "effect": "support_overlap",
      "value": 0.15
    },
    {
      "id": "triage_logic",
      "name": "分诊逻辑",
      "theme": "支援网络",
      "description": "维修优先级额外考虑即将受到的威胁。",
      "effect": "triage",
      "value": 1
    },
    {
      "id": "shield_memory",
      "name": "护盾记忆",
      "theme": "支援网络",
      "description": "支援单位范围内的友军护甲额外提高2。",
      "effect": "support_armor",
      "value": 2
    },
    {
      "id": "distributed_clock",
      "name": "分布时钟",
      "theme": "支援网络",
      "description": "维修型支援的维修量提高10%。",
      "effect": "support_efficiency",
      "value": 0.1
    },
    {
      "id": "distance_doctrine",
      "name": "距离教义",
      "theme": "远距压力控制",
      "description": "击杀距离每超过10格，额外降低2%压力。",
      "effect": "distance_pressure",
      "value": 0.02
    },
    {
      "id": "resistance_memory",
      "name": "抗性记忆",
      "theme": "远距压力控制",
      "description": "完全吸收压力后临时提高1抗性，可叠3层。",
      "effect": "resistance_stack",
      "value": 3
    },
    {
      "id": "early_warning",
      "name": "早期预警",
      "theme": "远距压力控制",
      "description": "高压力敌人出现时自动标记。",
      "effect": "pressure_mark",
      "value": 1
    },
    {
      "id": "soft_impact",
      "name": "柔性冲击",
      "theme": "远距压力控制",
      "description": "范围击杀造成的总压力降低10%。",
      "effect": "aoe_pressure",
      "value": 0.1
    },
    {
      "id": "crisis_accuracy",
      "name": "危机精度",
      "theme": "低精神爆发",
      "description": "精神稳定低于35%时，所有构造射程提高10%。",
      "effect": "crisis_range",
      "value": 0.1
    },
    {
      "id": "calm_aftershock",
      "name": "余震平复",
      "theme": "低精神爆发",
      "description": "精英死亡后恢复3精神稳定。",
      "effect": "elite_spirit",
      "value": 3
    },
    {
      "id": "risk_conversion",
      "name": "风险转化",
      "theme": "低精神爆发",
      "description": "精神稳定低于35%时，击杀敌人获得的专注提高20%；不影响节点奖励。",
      "effect": "crisis_reward",
      "value": 0.2
    },
    {
      "id": "wakeful_rage",
      "name": "清醒之怒",
      "theme": "低精神爆发",
      "description": "每损失10精神稳定，本场伤害提高2%。",
      "effect": "lost_spirit_damage",
      "value": 0.02
    },
    {
      "id": "expanded_bus",
      "name": "扩展总线",
      "theme": "带宽扩张",
      "description": "深度升级额外增加1带宽。",
      "effect": "level_bandwidth",
      "value": 1
    },
    {
      "id": "graceful_overload",
      "name": "优雅过载",
      "theme": "带宽扩张",
      "description": "战斗中的带宽干扰先由额外1点缓冲吸收。",
      "effect": "overload_buffer",
      "value": 1
    },
    {
      "id": "priority_channel",
      "name": "优先信道",
      "theme": "带宽扩张",
      "description": "最早部署的三个存活构造护甲提高2。",
      "effect": "priority_armor",
      "value": 2
    },
    {
      "id": "relay_feedback",
      "name": "中继反馈",
      "theme": "带宽扩张",
      "description": "恢复过载单位时使其下一次攻击强化30%。",
      "effect": "reactivate_damage",
      "value": 0.3
    }
  ],
  "events": [
    {
      "id": "noise_market",
      "act": 1,
      "title": "噪声黑市",
      "text": "一段违规频率提出交换。",
      "choices": [
        {
          "label": "承受12精神伤害，获得60专注",
          "effects": {
            "spirit": -12,
            "focus": 60
          }
        },
        {
          "label": "拒绝交易，获得2抗性",
          "effects": {
            "resistance": 2
          }
        }
      ]
    },
    {
      "id": "false_memory",
      "act": 1,
      "title": "伪造记忆",
      "text": "一段温暖回忆的校验值不正确。",
      "choices": [
        {
          "label": "删除它，免费升级一个单位",
          "effects": {
            "free_upgrade": 1
          }
        },
        {
          "label": "保留它，恢复18精神稳定",
          "effects": {
            "spirit": 18
          }
        }
      ]
    },
    {
      "id": "narrow_channel",
      "act": 1,
      "title": "窄带通道",
      "text": "压缩协议可以换取即时清晰。",
      "choices": [
        {
          "label": "永久失去2带宽，恢复30精神",
          "effects": {
            "bandwidth": -2,
            "spirit": 30
          }
        },
        {
          "label": "绕行，获得25专注",
          "effects": {
            "focus": 25
          }
        }
      ]
    },
    {
      "id": "abandoned_relay",
      "act": 1,
      "title": "废弃中继",
      "text": "中继仍保留少量可用组件。",
      "choices": [
        {
          "label": "拆取组件，获得45专注",
          "effects": {
            "focus": 45
          }
        },
        {
          "label": "重写固件，获得2带宽",
          "effects": {
            "bandwidth": 2
          }
        }
      ]
    },
    {
      "id": "quiet_room",
      "act": 1,
      "title": "静默室",
      "text": "这里没有统治信号，只有自己的呼吸。",
      "choices": [
        {
          "label": "停留，恢复25精神稳定",
          "effects": {
            "spirit": 25
          }
        },
        {
          "label": "记录结构，获得80经验",
          "effects": {
            "xp": 80
          }
        }
      ]
    },
    {
      "id": "stress_test",
      "act": 1,
      "title": "压力测试",
      "text": "旧设备要求用痛觉证明身份。",
      "choices": [
        {
          "label": "支付10精神，随机单位永久+10%耐久",
          "effects": {
            "spirit": -10,
            "tower_hp": 0.1
          }
        },
        {
          "label": "拆除设备，获得30专注",
          "effects": {
            "focus": 30
          }
        }
      ]
    },
    {
      "id": "frequency_twin",
      "act": 1,
      "title": "频率双生",
      "text": "一个与你相近的偏频信号请求同步。",
      "choices": [
        {
          "label": "同步，获得一个随机T1单位",
          "effects": {
            "unit": 1
          }
        },
        {
          "label": "保持独立，获得3抗性",
          "effects": {
            "resistance": 3
          }
        }
      ]
    },
    {
      "id": "clean_signal",
      "act": 1,
      "title": "清洁信号",
      "text": "短暂的无噪声窗口出现。",
      "choices": [
        {
          "label": "修复所有单位10%耐久",
          "effects": {
            "repair_all": 0.1
          }
        },
        {
          "label": "集中解码，获得50专注",
          "effects": {
            "focus": 50
          }
        }
      ]
    },
    {
      "id": "memory_tax",
      "act": 2,
      "title": "记忆税站",
      "text": "工厂要求缴纳可验证的自我片段。",
      "choices": [
        {
          "label": "失去15精神，获得100专注",
          "effects": {
            "spirit": -15,
            "focus": 100
          }
        },
        {
          "label": "强行通过，随机单位损失20%耐久",
          "effects": {
            "tower_damage": 0.2
          }
        }
      ]
    },
    {
      "id": "assembly_line",
      "act": 2,
      "title": "构造流水线",
      "text": "空置生产线还能完成一次指令。",
      "choices": [
        {
          "label": "复制一个T1单位",
          "effects": {
            "duplicate_t1": 1
          }
        },
        {
          "label": "免费维修两个单位",
          "effects": {
            "free_repairs": 2
          }
        }
      ]
    },
    {
      "id": "archived_voice",
      "act": 2,
      "title": "归档之声",
      "text": "被删除的人留下了维护口诀。",
      "choices": [
        {
          "label": "记住口诀，维修费永久降低10%",
          "effects": {
            "repair_discount": 0.1
          }
        },
        {
          "label": "公开归档，获得120经验",
          "effects": {
            "xp": 120
          }
        }
      ]
    },
    {
      "id": "unstable_lift",
      "act": 2,
      "title": "不稳定升降机",
      "text": "它能跨越精神层级，也可能撕裂防线。",
      "choices": [
        {
          "label": "乘坐，获得收藏品但损失20精神",
          "effects": {
            "relic": 1,
            "spirit": -20
          }
        },
        {
          "label": "拆取动力，获得70专注",
          "effects": {
            "focus": 70
          }
        }
      ]
    },
    {
      "id": "resistance_pool",
      "act": 2,
      "title": "抗性池",
      "text": "凝固的抗性可以永久吸收或临时出售。",
      "choices": [
        {
          "label": "吸收，获得4抗性",
          "effects": {
            "resistance": 4
          }
        },
        {
          "label": "出售，获得90专注",
          "effects": {
            "focus": 90
          }
        }
      ]
    },
    {
      "id": "maintenance_strike",
      "act": 2,
      "title": "维护罢工",
      "text": "自动维修机拒绝继续为统治服务。",
      "choices": [
        {
          "label": "协助罢工，所有受损单位恢复15%",
          "effects": {
            "repair_all": 0.15
          }
        },
        {
          "label": "接管机器，免费升级一个单位",
          "effects": {
            "free_upgrade": 1
          }
        }
      ]
    },
    {
      "id": "split_identity",
      "act": 2,
      "title": "分裂身份",
      "text": "两个版本的你争夺同一段带宽。",
      "choices": [
        {
          "label": "保留谨慎版本，获得2带宽和2抗性",
          "effects": {
            "bandwidth": 2,
            "resistance": 2
          }
        },
        {
          "label": "保留激进版本，单位伤害永久+5%",
          "effects": {
            "tower_damage_bonus": 0.05
          }
        }
      ]
    },
    {
      "id": "closed_shop",
      "act": 2,
      "title": "关闭的商店",
      "text": "货架被封存，但价格标签仍在闪烁。",
      "choices": [
        {
          "label": "支付80专注，取得随机收藏品",
          "effects": {
            "focus": -80,
            "relic": 1
          }
        },
        {
          "label": "拆掉货架，获得随机单位",
          "effects": {
            "unit": 1
          }
        }
      ]
    },
    {
      "id": "final_broadcast",
      "act": 3,
      "title": "最终广播",
      "text": "统治者承诺交出安宁，条件是停止抵抗。",
      "choices": [
        {
          "label": "拒绝，获得5抗性",
          "effects": {
            "resistance": 5
          }
        },
        {
          "label": "伪装接受，恢复35精神但失去2带宽",
          "effects": {
            "spirit": 35,
            "bandwidth": -2
          }
        }
      ]
    },
    {
      "id": "mass_memory",
      "act": 3,
      "title": "大众记忆库",
      "text": "无数未被抹除的意志在等待出口。",
      "choices": [
        {
          "label": "释放它们，获得200经验",
          "effects": {
            "xp": 200
          }
        },
        {
          "label": "借用力量，获得150专注",
          "effects": {
            "focus": 150
          }
        }
      ]
    },
    {
      "id": "control_key",
      "act": 3,
      "title": "控制密钥",
      "text": "密钥可以解除干扰，也能强化火力。",
      "choices": [
        {
          "label": "解除干扰，获得4带宽",
          "effects": {
            "bandwidth": 4
          }
        },
        {
          "label": "改写武器，单位伤害永久+8%",
          "effects": {
            "tower_damage_bonus": 0.08
          }
        }
      ]
    },
    {
      "id": "last_workshop",
      "act": 3,
      "title": "最后工坊",
      "text": "工坊只够执行一次全局维护。",
      "choices": [
        {
          "label": "所有单位恢复25%耐久",
          "effects": {
            "repair_all": 0.25
          }
        },
        {
          "label": "随机两个单位免费升级",
          "effects": {
            "free_upgrades": 2
          }
        }
      ]
    },
    {
      "id": "identity_checkpoint",
      "act": 3,
      "title": "身份检查点",
      "text": "检查点无法同时处理意志与构造。",
      "choices": [
        {
          "label": "证明意志，恢复40精神",
          "effects": {
            "spirit": 40
          }
        },
        {
          "label": "证明构造，获得一个T2单位",
          "effects": {
            "unit_t2": 1
          }
        }
      ]
    },
    {
      "id": "resonance_storm",
      "act": 3,
      "title": "共振风暴",
      "text": "风暴能擦除损伤，也会削弱清醒。",
      "choices": [
        {
          "label": "进入风暴，单位全部修满但损失25精神",
          "effects": {
            "repair_all": 1,
            "spirit": -25
          }
        },
        {
          "label": "收集边缘能量，获得100专注",
          "effects": {
            "focus": 100
          }
        }
      ]
    },
    {
      "id": "forbidden_archive",
      "act": 3,
      "title": "禁用档案",
      "text": "档案记录了首领机制的原始版本。",
      "choices": [
        {
          "label": "阅读，完全公开本幕首领并获得收藏品",
          "effects": {
            "boss_reveal": 1,
            "relic": 1
          }
        },
        {
          "label": "销毁，获得6抗性",
          "effects": {
            "resistance": 6
          }
        }
      ]
    },
    {
      "id": "many_voices",
      "act": 3,
      "title": "众声协议",
      "text": "许多偏频者愿意共享最后一段信道。",
      "choices": [
        {
          "label": "接入，获得5带宽但敌人压力+10%",
          "effects": {
            "bandwidth": 5,
            "pressure_mult": 0.1
          }
        },
        {
          "label": "保持独立，恢复30精神并获得60专注",
          "effects": {
            "spirit": 30,
            "focus": 60
          }
        }
      ]
    }
  ]
};
export const acts=data.acts;
export const towers=Object.fromEntries(data.towers.map(x=>[x.id,x]));
const enemyDescriptions = {
 static_drifter:'沿地面通路接近火种，攻击拦路的近战构造。没有特殊能力，适合用来判断防线基础火力。',
 spike_runner:'预警后获得65%额外移动速度，持续2.5秒。生命较低，减速和提前部署的交叉火力能阻止它穿过空隙。',
 shield_echo:'出生自带35%最大生命护盾，之后周期性补充至15%最大生命护盾。护盾先于生命承受伤害。',
 tempo_amplifier:'预警后形成6格加速光环，使附近敌人移动速度提高20%，持续4秒。优先处理它可以拆散快速推进的敌群。',
 fracture_seed:'死亡时尝试分裂出两只尖峰奔袭体；分裂消耗本场共享的10%增援预算，预算耗尽后不会分裂。',
 floating_noise:'飞行敌人直接越过地形和地面阻挡。需要能攻击空中的脉冲针列、轨炮或无人机提前拦截。',
 remote_hunter:'在6格距离内猎杀构造，能够攻击高台远程和支援。高地保护会削弱它从低处造成的伤害。',
 siege_ram:'可攻击3.6格内的各类构造，攻击峭壁时造成3倍地形伤害。应在它拆开屏障前集火。',
 memory_medic:'预警后恢复6格内敌人9%最大生命，包括自身。持续集火比平均分散伤害更有效。',
 bandwidth_jammer:'预警后使可用带宽降低2，持续3秒，多名干扰者可以叠加。预留带宽或使用中继缓冲能避免新部署单位停机。',
 phase_teleporter:'预警后沿当前地面路线向前迁跃最多4格。可越过一段火力区，需要纵深防线或定身拖延。',
 replication_node:'复制6格内一名非增援普通敌人；附近没有目标时生成护盾回声。复制消耗全场共享增援预算。',
 pressure_cantor:'预警后持续4秒，使6格内敌人的死亡压力提高25%。先在远离火种处击杀它能降低随后消灭敌群的风险。',
 armored_worm:'高护甲的缓慢推进者，攻击带35%穿甲。解甲刃和穿透轨可以削弱它的主要优势。',
 shield_conductor:'预警后为6格内敌人补充至12%最大生命的护盾。护盾不相加，持续输出可在下次脉冲前突破。',
 signal_summoner:'预警后召唤一只静噪漂移体，消耗全场共享增援预算。不会无限增殖。',
 resistance_corruptor:'预警后使精神抗性降低2，持续5秒，多名腐蚀者可以叠加。避免在腐蚀期间于火种附近击杀高压力目标。',
 detonation_shell:'死亡时对3.5格内构造造成1.6倍攻击力的爆炸冲击。远程击杀或分散防线能降低损失。',
 frequency_hunter:'精英远程猎杀者，能攻击6格内的各类构造。到达火种后持续攻击，不会自行离场。',
 terrain_dismantler:'精英攻城者，拆障伤害为普通攻击的3倍，能直接威胁3.6格内的各类构造。到达火种后持续攻击。',
 proliferation_protocol:'精英召唤者，预警后引入受共享增援预算限制的漂移体。到达火种后持续攻击，需要直接消灭其本体。',
 spirit_taxer:'精英精神税吏，预警后腐蚀4抗性5秒，并直接施加2精神伤害。应在高压力敌群靠近前优先消灭。',
 noise_hive:'第四敌群出现的召唤首领，预警后尝试召唤两只受共享预算限制的增援。生命降到70%和35%以下时进入更快的控制阶段。',
 mirror_censor:'第四敌群出现的复制首领，预警后复制附近普通信号，数量受共享增援预算限制。生命降低会加快能力循环。',
 memory_reforger:'第四敌群出现的修复首领，预警后修复6格内敌人及自身。需要集中输出，避免让不同目标轮流接受重铸。',
 bandwidth_requisitioner:'第四敌群出现的干扰首领，预警后征用6带宽5秒。较低生命阶段进一步压迫防线，预留带宽与保护中继能稳定火力。',
 chorus_overseer:'第四敌群出现的飞行首领，预警后共享18%最大生命护盾。必须保留对空火力；后续阶段同时扰乱带宽。',
 zero_frequency_mind:'第四敌群出现的攻城首领，预警后冲击10格内最多三座构造，并能快速拆解峭壁。低生命阶段进一步改变近处战场。'
};
const bossArchives = {
 noise_hive:'档案01 · 最初的服从不是命令，而是每个人都以为其他人已经答应了。母巢把这份错觉复制成噪声，直到城市只剩一种节拍。你切断母巢后，人群重新听见了彼此不同的声音。',
 mirror_censor:'档案02 · 审查官从不创造思想。它截取反抗者说过的话，复制语气，删去犹疑，再用无数个镜像替他们宣布认输。镜面破碎后，偏频者留下了一个不必与任何人相同的答案。',
 memory_reforger:'档案03 · 工厂曾为创伤提供修复，后来却开始把修复定义为遗忘。重铸机一次次抹平伤口，也抹去人们选择反抗的理由。停机之后，记忆可以疼痛，也可以成为下一次选择的依据。',
 bandwidth_requisitioner:'档案04 · 每一个思考都被登记为占用，每一段私人记忆都要缴纳信道。征用者声称只有完全清空个体，系统才能稳定。你用仍然完整的防线证明：秩序不需要以消失为代价。',
 chorus_overseer:'档案05 · 合唱最初意味着众多声音相互倾听。监管者把它改造成只能唱同一音的护盾，让每个不同的声音都像一条裂缝。信号断开时，裂缝连接起来，变成了彼此可以呼应的通路。',
 zero_frequency_mind:'档案06 · 零频主脑追求一个没有噪声、没有冲突、也没有选择的世界。它把醒觉火种称作必须拆除的故障。最后一条控制指令停止后，火种仍在燃烧，而城市开始自己决定明天。'
};
const bossMechanics = {
 noise_hive:'每次召唤两只漂移体，受全场10%增援预算限制。第二阶段开始，每次能力使6格内敌人加速20%，持续3秒。',
 mirror_censor:'每次复制最多两名增援，受全场共享预算限制。第二阶段开始，每次能力为自己补充至2.5%最大生命护盾。',
 memory_reforger:'第一/二/三阶段，每次能力恢复6格内敌人及自身7%/8.5%/10%最大生命。',
 bandwidth_requisitioner:'第一/二/三阶段，每次能力征用6/8/10带宽，持续5秒；最新部署的单位最先停机。',
 chorus_overseer:'每次能力为6格内敌人补充至18%最大生命护盾。第二阶段开始额外征用6带宽，持续2秒。此首领始终飞行。',
 zero_frequency_mind:'第一/二/三阶段，冲击半径10/11/12格，最多击中3/4/5座构造，造成65%/75%/85%攻击力伤害；拆障伤害为3/4/5倍攻击力。'
};
export const enemies=Object.fromEntries(data.enemies.map(x=>[x.id,{...x,description:enemyDescriptions[x.id]+(['tower_hunter','siege'].includes(x.ability)?' 连续射击三次后显示提示并向火种推进2.5秒；贴身近战仍可阻挡。':''),archive:bossArchives[x.id]||null,mechanics:bossMechanics[x.id] ? `${bossMechanics[x.id]} 生命低于70%/35%时进入第二/三阶段，能力间隔为6.5/5.7/4.9秒；每次能力先预警1.1秒。` : null}]));
export const relics={...Object.fromEntries(data.relics.map(x=>[x.id,x])),...nexusRelics};
export const talents=Object.fromEntries(data.talents.map(x=>[x.id,x]));
export const events=Object.fromEntries([...data.events,...extraEvents].map(x=>[x.id,x]));
// Unlocks expand later runs only. The active run saves its exact pool so buying a
// discovery between sessions cannot change an already generated route or offer.
export const contentUnlocks = [
 { id:'overlook_archive', name:'俯瞰档案', cost:30, relics:['overlook_protocol'], events:['frequency_twin'], description:'将俯瞰协议收藏品与频率双生事件加入后续单局。' },
 { id:'anchor_archive', name:'坚守档案', cost:30, relics:['lasting_anchor'], events:['clean_signal'], description:'将恒定锚收藏品与清洁信号事件加入后续单局。' },
 { id:'network_archive', name:'协同档案', cost:30, relics:['local_shield'], events:['maintenance_strike'], description:'将局部屏蔽收藏品与维护罢工事件加入后续单局。' },
 { id:'pressure_archive', name:'静默档案', cost:30, relics:['pulse_absorber'], events:['split_identity'], description:'将脉冲吸收器收藏品与分裂身份事件加入后续单局。' },
 { id:'redline_archive', name:'临界档案', cost:30, relics:['volatile_clarity'], events:['resonance_storm'], description:'将易爆清醒收藏品与共振风暴事件加入后续单局。' },
 { id:'channel_archive', name:'众声档案', cost:30, relics:['relay_efficiency'], events:['many_voices'], description:'将中继效率收藏品与众声协议事件加入后续单局。' }
];
export function contentPool(profile = {}) {
 const unlocked = new Set(profile.unlockedContent || []);
 const allowed = (kind, catalog) => Object.keys(catalog).filter(id => !catalog[id].exclusive && !contentUnlocks.some(pack => pack[kind]?.includes(id) && !unlocked.has(pack.id)));
 return { towers:Object.keys(towers), relics:allowed('relics', relics), talents:Object.keys(talents), events:allowed('events', events) };
}
export function hashSeed(input){let h=2166136261;for(const c of String(input)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
export function seededRandom(seed){let s=hashSeed(seed);return ()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export function shuffle(items,random){const out=[...items];for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
const effectKeys=Object.freeze([...new Set([...Object.values(relics),...Object.values(talents)].flatMap(item=>item.fx?Object.keys(item.fx):[item.effect]))]);
export function effects(state){
 const result={attack:0,ranged_attack:0,melee_attack:0,armor:0,hp:0,range:0,haste:0,repair_discount:0,move_discount:0,terrain_discount:0,upgrade_discount:0,bandwidth:0,resistance:0,pressure_reduction:0};
 for(const key of effectKeys)result[key]??=0;
 for(const id of [...(state.relics||[]),...(state.talents||[])]){const item=relics[id]||talents[id];if(item)for(const [key,value] of Object.entries(item.fx||{[item.effect]:item.value}))result[key]=(result[key]||0)+value;}
 for(const [key,value]of Object.entries(state.modifiers||{}))result[key]=(result[key]||0)+value;
 result.attack+=result.tower_damage_bonus||0;result.move_discount+=result.relocate_discount||0;
 const ratio=state.spirit/Math.max(1,state.maxSpirit);if(ratio<.35){result.attack+=result.low_spirit_damage+result.volatile;result.range+=result.crisis_range;}if(ratio<.25)result.resistance+=result.crisis_resistance;
 result.repair_discount-=result.volatile;
 const live=(state.units||[]).filter(u=>Number.isFinite(u.x)&&u.hp>0),active=live.filter(u=>!(state.battle?.disabled||[]).includes(u.uid));
 if(live.length<=8){result.attack+=result.nexus_small_army||0;result.armor+=result.nexus_small_armor||0;}
 if(new Set(active.map(u=>towers[u.type].role)).size===3)result.attack+=result.nexus_trinity||0;
 if(state.phase==='battle')for(const buff of state.battle?.itemBuffs||[])if(buff.until>state.battle.time)result[buff.effect]=(result[buff.effect]||0)+buff.value;
 return result;
}
// Compatibility catalog for callers; the difficulty module owns every value.
export const pressureLevels=Object.freeze(Array.from({length:11},(_,level)=>difficultySummary(level).join(' ')));
