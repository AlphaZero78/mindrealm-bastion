class_name AssetRegistry
extends RefCounted

const KENNEY_SPACE := "res://assets/third_party/kenney/space-kit/"
const KENNEY_TOWER := "res://assets/third_party/kenney/tower-defense-kit/"
const KENNEY_MODULAR := "res://assets/third_party/kenney/modular-space-kit/"
const MUSIC := "res://assets/third_party/opengameart/dark-sci-fi-audio/"
const SFX := "res://assets/third_party/kenney/sci-fi-sounds/"
const UI := "res://assets/third_party/kenney/ui-sci-fi/"

const UI_TEXTURES := {
	"panel": UI + "button_square_header_large_rectangle_screws.png",
	"button": UI + "button_square_header_large_rectangle.png",
	"bar": UI + "bar_round_gloss_large.png",
}

const TOWER_MODELS := {
	"anchor_bulwark": KENNEY_TOWER + "tower-round-bottom-a.glb",
	"phase_blade": KENNEY_TOWER + "tower-round-top-b.glb",
	"boundary_riveter": KENNEY_TOWER + "tower-square-bottom-b.glb",
	"resonance_guard": KENNEY_TOWER + "tower-round-middle-b.glb",
	"pulse_array": KENNEY_SPACE + "turret_single.glb",
	"focus_rail": KENNEY_SPACE + "turret_double.glb",
	"arc_mortar": KENNEY_TOWER + "weapon-cannon.glb",
	"drone_loom": KENNEY_SPACE + "satelliteDish_detailed.glb",
	"bandwidth_relay": KENNEY_SPACE + "machine_wireless.glb",
	"memory_mechanic": KENNEY_SPACE + "machine_generator.glb",
	"frequency_choir": KENNEY_SPACE + "satelliteDish_large.glb",
	"resistance_beacon": KENNEY_TOWER + "tower-round-top-a.glb",
}

const ENEMY_MODELS := {
	"static_drifter": KENNEY_SPACE + "craft_cargoA.glb",
	"spike_runner": KENNEY_SPACE + "craft_speederA.glb",
	"shield_echo": KENNEY_SPACE + "craft_cargoB.glb",
	"tempo_amplifier": KENNEY_SPACE + "craft_speederB.glb",
	"fracture_seed": KENNEY_SPACE + "alien.glb",
	"floating_noise": KENNEY_TOWER + "enemy-ufo-a.glb",
	"remote_hunter": KENNEY_SPACE + "craft_racer.glb",
	"siege_ram": KENNEY_SPACE + "craft_miner.glb",
	"memory_medic": KENNEY_SPACE + "machine_generator.glb",
	"bandwidth_jammer": KENNEY_SPACE + "machine_wireless.glb",
	"phase_teleporter": KENNEY_SPACE + "craft_speederC.glb",
	"replication_node": KENNEY_SPACE + "craft_cargoB.glb",
	"pressure_cantor": KENNEY_TOWER + "enemy-ufo-b.glb",
	"armored_worm": KENNEY_SPACE + "craft_miner.glb",
	"shield_conductor": KENNEY_TOWER + "enemy-ufo-c.glb",
	"signal_summoner": KENNEY_SPACE + "machine_generatorLarge.glb",
	"resistance_corruptor": KENNEY_TOWER + "enemy-ufo-d.glb",
	"detonation_shell": KENNEY_SPACE + "craft_speederD.glb",
	"frequency_hunter": KENNEY_SPACE + "turret_double.glb",
	"terrain_dismantler": KENNEY_SPACE + "craft_miner.glb",
	"proliferation_protocol": KENNEY_SPACE + "machine_generatorLarge.glb",
	"spirit_taxer": KENNEY_TOWER + "enemy-ufo-d.glb",
	"noise_hive": KENNEY_SPACE + "hangar_largeA.glb",
	"mirror_censor": KENNEY_TOWER + "enemy-ufo-c.glb",
	"memory_reforger": KENNEY_SPACE + "machine_generatorLarge.glb",
	"bandwidth_requisitioner": KENNEY_SPACE + "gate_complex.glb",
	"chorus_overseer": KENNEY_SPACE + "satelliteDish_large.glb",
	"zero_frequency_mind": KENNEY_MODULAR + "gate.glb",
}

const MUSIC_TRACKS := {
	"menu": MUSIC + "title.ogg",
	"map": MUSIC + "sector.ogg",
	"node": MUSIC + "hover.ogg",
	"reward": MUSIC + "transmission.ogg",
	"calm_battle": MUSIC + "airy.ogg",
	"prebattle": MUSIC + "airy.ogg",
	"battle": MUSIC + "pulse.ogg",
	"boss": MUSIC + "urgent.ogg",
	"danger": MUSIC + "urgent.ogg",
	"defeat": MUSIC + "transmission.ogg",
	"ending": MUSIC + "transmission.ogg",
	"victory": MUSIC + "victory.ogg",
}

const SOUND_EFFECTS := {
	"laser_small": SFX + "laserSmall_000.ogg",
	"laser_large": SFX + "laserLarge_001.ogg",
	"impact": SFX + "impactMetal_002.ogg",
	"explosion": SFX + "explosionCrunch_003.ogg",
	"shield": SFX + "forceField_001.ogg",
	"ambient": SFX + "computerNoise_001.ogg",
	"boss": SFX + "lowFrequency_explosion_000.ogg",
	"node": SFX + "doorOpen_001.ogg",
	"deploy": SFX + "forceField_001.ogg",
	"terrain": SFX + "impactMetal_002.ogg",
	"deny": SFX + "lowFrequency_explosion_000.ogg",
}

static func model_for_tower(id: String) -> String:
	return str(TOWER_MODELS.get(id, KENNEY_TOWER + "tower-round-bottom-a.glb"))

static func model_for_enemy(id: String) -> String:
	return str(ENEMY_MODELS.get(id, KENNEY_TOWER + "enemy-ufo-a.glb"))

static func required_assets() -> Array[String]:
	var result: Array[String] = [
		KENNEY_MODULAR + "template-floor.glb",
		KENNEY_MODULAR + "gate-lasers.glb",
		KENNEY_TOWER + "selection-a.glb",
	]
	for path in TOWER_MODELS.values():
		if not result.has(str(path)):
			result.append(str(path))
	for path in ENEMY_MODELS.values():
		if not result.has(str(path)):
			result.append(str(path))
	for path in MUSIC_TRACKS.values():
		result.append(str(path))
	for path in SOUND_EFFECTS.values():
		result.append(str(path))
	return result
