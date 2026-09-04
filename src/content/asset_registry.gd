class_name AssetRegistry
extends RefCounted

const SPRITES := "res://assets/game/sprites/"
const MUSIC_AMBIENT := "res://assets/third_party/opengameart/dark-sci-fi-audio/"
const MUSIC_ADAPTIVE := "res://assets/third_party/opengameart/singularity/"
const SFX := "res://assets/third_party/kenney/sci-fi-sounds/"
const PIXEL_UI := "res://assets/third_party/kenney/pixel-ui/"
const GAME_ICONS := "res://assets/third_party/kenney/game-icons/"
const PIXEL_FONT := "res://assets/third_party/fusion-pixel-font/fusion-pixel-10px-zh_hans.ttf"

const TOWER_SPRITES := {
	"anchor_bulwark": SPRITES + "towers/anchor_bulwark.png",
	"phase_blade": SPRITES + "towers/phase_blade.png",
	"boundary_riveter": SPRITES + "towers/boundary_riveter.png",
	"resonance_guard": SPRITES + "towers/resonance_guard.png",
	"pulse_array": SPRITES + "towers/pulse_array.png",
	"focus_rail": SPRITES + "towers/focus_rail.png",
	"arc_mortar": SPRITES + "towers/arc_mortar.png",
	"drone_loom": SPRITES + "towers/drone_loom.png",
	"bandwidth_relay": SPRITES + "towers/bandwidth_relay.png",
	"memory_mechanic": SPRITES + "towers/memory_mechanic.png",
	"frequency_choir": SPRITES + "towers/frequency_choir.png",
	"resistance_beacon": SPRITES + "towers/resistance_beacon.png",
}

const ENEMY_IDS := [
	"static_drifter", "spike_runner", "shield_echo", "tempo_amplifier", "fracture_seed", "floating_noise",
	"remote_hunter", "siege_ram", "memory_medic", "bandwidth_jammer", "phase_teleporter", "replication_node",
	"pressure_cantor", "armored_worm", "shield_conductor", "signal_summoner", "resistance_corruptor", "detonation_shell",
	"frequency_hunter", "terrain_dismantler", "proliferation_protocol", "spirit_taxer",
	"noise_hive", "mirror_censor", "memory_reforger", "bandwidth_requisitioner", "chorus_overseer", "zero_frequency_mind",
]

const MUSIC_TRACKS := {
	"menu": MUSIC_AMBIENT + "title.ogg",
	"map": MUSIC_AMBIENT + "sector.ogg",
	"node": MUSIC_AMBIENT + "hover.ogg",
	"reward": MUSIC_AMBIENT + "transmission.ogg",
	"prebattle": MUSIC_ADAPTIVE + "singularity_calm.mp3",
	"battle_calm": MUSIC_ADAPTIVE + "singularity_calm.mp3",
	"battle_action": MUSIC_ADAPTIVE + "singularity_action.mp3",
	"defeat": MUSIC_AMBIENT + "transmission.ogg",
	"ending": MUSIC_AMBIENT + "transmission.ogg",
	"victory": MUSIC_AMBIENT + "victory.ogg",
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

static func sprite_for_tower(id: String) -> String:
	return str(TOWER_SPRITES.get(id, TOWER_SPRITES["anchor_bulwark"]))

static func sprite_for_enemy(id: String) -> String:
	return SPRITES + "enemies/%s.png" % id

static func required_assets() -> Array[String]:
	var result: Array[String] = [PIXEL_FONT, PIXEL_UI + "panel.png", PIXEL_UI + "panel_inlay.png"]
	for path in TOWER_SPRITES.values():
		result.append(str(path))
	for id in ENEMY_IDS:
		result.append(sprite_for_enemy(id))
	for path in MUSIC_TRACKS.values():
		if not result.has(str(path)):
			result.append(str(path))
	for path in SOUND_EFFECTS.values():
		if not result.has(str(path)):
			result.append(str(path))
	for type_id in PixelTheme.MAP_ICONS:
		var icon_path := PixelTheme.ICON_ROOT + str(PixelTheme.MAP_ICONS[type_id])
		if not result.has(icon_path):
			result.append(icon_path)
	return result
