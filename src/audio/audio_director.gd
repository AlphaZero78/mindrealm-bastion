class_name AudioDirector
extends Node

# Runtime sources are normalized to -18 LUFS; a small playback trim leaves
# headroom for the correlated calm/action midpoint and UI/SFX transients.
const BASE_MUSIC_DB := -2.0
const SILENT_DB := -60.0

var music_a: AudioStreamPlayer
var music_b: AudioStreamPlayer
var battle_calm: AudioStreamPlayer
var battle_action: AudioStreamPlayer
var ambient: AudioStreamPlayer
var active_music: AudioStreamPlayer
var inactive_music: AudioStreamPlayer
var current_state := ""
var danger_level := 0.0
var danger_target := 0.0
var boss_floor := 0.0
var pause_duck_db := 0.0
var _fade_tween: Tween
var _sfx_players: Array[AudioStreamPlayer] = []

func setup() -> void:
	_ensure_bus("Music")
	_ensure_bus("SFX")
	_ensure_bus("UI")
	_configure_music_bus()
	music_a = _new_music_player()
	music_b = _new_music_player()
	battle_calm = _new_music_player()
	battle_action = _new_music_player()
	active_music = music_a
	inactive_music = music_b
	ambient = AudioStreamPlayer.new()
	ambient.bus = "SFX"
	ambient.stream = load(AssetRegistry.SOUND_EFFECTS["ambient"])
	_enable_loop(ambient.stream)
	ambient.volume_db = -30.0
	add_child(ambient)
	ambient.play()
	for _i in 8:
		var player := AudioStreamPlayer.new()
		player.bus = "SFX"
		add_child(player)
		_sfx_players.append(player)
	set_process(true)

func _process(delta: float) -> void:
	var duration := 1.5 if danger_target > danger_level else 4.0
	danger_level = move_toward(danger_level, danger_target, delta / duration)
	if current_state in ["battle", "boss"]:
		_apply_adaptive_mix()

func play_state(state: String, fade_seconds: float = 1.2) -> void:
	if current_state == state:
		return
	current_state = state
	if state in ["battle", "boss"]:
		_start_adaptive_battle(state == "boss", fade_seconds)
		return
	if not AssetRegistry.MUSIC_TRACKS.has(state):
		return
	danger_target = 0.0
	boss_floor = 0.0
	_fade_adaptive_to_silence(fade_seconds)
	var stream := load(AssetRegistry.MUSIC_TRACKS[state]) as AudioStream
	if stream == null:
		return
	_enable_loop(stream)
	inactive_music.stream = stream
	inactive_music.volume_db = SILENT_DB
	inactive_music.play()
	if _fade_tween != null and _fade_tween.is_running():
		_fade_tween.kill()
	_fade_tween = create_tween().set_parallel(true)
	_fade_tween.tween_property(active_music, "volume_db", SILENT_DB, fade_seconds)
	_fade_tween.tween_property(inactive_music, "volume_db", BASE_MUSIC_DB + pause_duck_db, fade_seconds)
	var swap := active_music
	active_music = inactive_music
	inactive_music = swap

func set_battle_danger(value: float, boss: bool = false) -> void:
	danger_target = clampf(value, 0.0, 1.0)
	boss_floor = 0.55 if boss else 0.0

func play_sfx(id: String, volume_db: float = -10.0) -> void:
	if not AssetRegistry.SOUND_EFFECTS.has(id):
		return
	for player in _sfx_players:
		if not player.playing:
			player.stream = load(AssetRegistry.SOUND_EFFECTS[id])
			player.volume_db = volume_db
			player.play()
			return

func set_pause_duck(paused: bool) -> void:
	pause_duck_db = -9.0 if paused else 0.0
	if current_state not in ["battle", "boss"] and active_music != null:
		var tween := create_tween()
		tween.tween_property(active_music, "volume_db", BASE_MUSIC_DB + pause_duck_db, 0.24)
	if ambient != null:
		var ambient_tween := create_tween()
		ambient_tween.tween_property(ambient, "volume_db", -38.0 if paused else -30.0, 0.24)

func shutdown() -> void:
	set_process(false)
	if _fade_tween != null and _fade_tween.is_valid():
		_fade_tween.kill()
	for player in [music_a, music_b, battle_calm, battle_action, ambient]:
		if player != null:
			player.stop()
			player.stream = null
	for player in _sfx_players:
		player.stop()
		player.stream = null
	current_state = ""

func set_bus_volume(bus_name: String, normalized: float) -> void:
	var index := AudioServer.get_bus_index(bus_name)
	if index < 0:
		return
	AudioServer.set_bus_volume_db(index, linear_to_db(clampf(normalized, 0.001, 1.0)))
	AudioServer.set_bus_mute(index, normalized <= 0.001)

func _new_music_player() -> AudioStreamPlayer:
	var player := AudioStreamPlayer.new()
	player.bus = "Music"
	player.volume_db = SILENT_DB
	add_child(player)
	return player

func _start_adaptive_battle(boss: bool, fade_seconds: float) -> void:
	boss_floor = 0.55 if boss else 0.0
	danger_target = maxf(danger_target, boss_floor)
	if not battle_calm.playing:
		battle_calm.stream = load(AssetRegistry.MUSIC_TRACKS["battle_calm"])
		battle_action.stream = load(AssetRegistry.MUSIC_TRACKS["battle_action"])
		_enable_loop(battle_calm.stream)
		_enable_loop(battle_action.stream)
		battle_calm.play()
		battle_action.play()
	var tween := create_tween().set_parallel(true)
	tween.tween_property(active_music, "volume_db", SILENT_DB, fade_seconds)
	tween.tween_property(inactive_music, "volume_db", SILENT_DB, fade_seconds)
	_apply_adaptive_mix()

func _apply_adaptive_mix() -> void:
	var mix := maxf(danger_level, boss_floor)
	# Equal-power gains avoid a loud bump around the midpoint while preserving
	# phase-aligned calm/action layers.
	var calm_gain := maxf(0.001, cos(mix * PI * 0.5))
	var action_gain := maxf(0.001, sin(mix * PI * 0.5))
	battle_calm.volume_db = BASE_MUSIC_DB + linear_to_db(calm_gain) + pause_duck_db
	battle_action.volume_db = BASE_MUSIC_DB + linear_to_db(action_gain) + pause_duck_db

func _fade_adaptive_to_silence(seconds: float) -> void:
	if battle_calm == null:
		return
	var tween := create_tween().set_parallel(true)
	tween.tween_property(battle_calm, "volume_db", SILENT_DB, seconds)
	tween.tween_property(battle_action, "volume_db", SILENT_DB, seconds)

func _configure_music_bus() -> void:
	var index := AudioServer.get_bus_index("Music")
	if index < 0 or AudioServer.get_bus_effect_count(index) > 0:
		return
	var eq := AudioEffectEQ6.new()
	eq.set_band_gain_db(3, -1.5)
	eq.set_band_gain_db(4, -5.0)
	eq.set_band_gain_db(5, -8.0)
	AudioServer.add_bus_effect(index, eq)
	var limiter := AudioEffectLimiter.new()
	limiter.ceiling_db = -1.0
	limiter.threshold_db = -4.0
	AudioServer.add_bus_effect(index, limiter)

func _ensure_bus(bus_name: String) -> void:
	if AudioServer.get_bus_index(bus_name) >= 0:
		return
	AudioServer.add_bus()
	AudioServer.set_bus_name(AudioServer.bus_count - 1, bus_name)

func _enable_loop(stream: AudioStream) -> void:
	if stream is AudioStreamOggVorbis:
		(stream as AudioStreamOggVorbis).loop = true
	elif stream is AudioStreamMP3:
		(stream as AudioStreamMP3).loop = true
