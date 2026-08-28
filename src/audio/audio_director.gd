class_name AudioDirector
extends Node

var music_a: AudioStreamPlayer
var music_b: AudioStreamPlayer
var ambient: AudioStreamPlayer
var active_music: AudioStreamPlayer
var inactive_music: AudioStreamPlayer
var current_state := ""
var _fade_tween: Tween
var _sfx_players: Array[AudioStreamPlayer] = []

func setup() -> void:
	_ensure_bus("Music")
	_ensure_bus("SFX")
	_ensure_bus("UI")
	music_a = AudioStreamPlayer.new()
	music_a.bus = "Music"
	add_child(music_a)
	music_b = AudioStreamPlayer.new()
	music_b.bus = "Music"
	add_child(music_b)
	active_music = music_a
	inactive_music = music_b
	ambient = AudioStreamPlayer.new()
	ambient.bus = "SFX"
	ambient.stream = load(AssetRegistry.SOUND_EFFECTS["ambient"])
	_enable_loop(ambient.stream)
	ambient.volume_db = -24.0
	add_child(ambient)
	ambient.play()
	for _i in 8:
		var player := AudioStreamPlayer.new()
		player.bus = "SFX"
		add_child(player)
		_sfx_players.append(player)

func play_state(state: String, fade_seconds: float = 1.2) -> void:
	if current_state == state or not AssetRegistry.MUSIC_TRACKS.has(state):
		return
	current_state = state
	var stream := load(AssetRegistry.MUSIC_TRACKS[state]) as AudioStream
	if stream == null:
		return
	_enable_loop(stream)
	inactive_music.stream = stream
	inactive_music.volume_db = -45.0
	inactive_music.play()
	if _fade_tween != null and _fade_tween.is_running():
		_fade_tween.kill()
	_fade_tween = create_tween().set_parallel(true)
	_fade_tween.tween_property(active_music, "volume_db", -45.0, fade_seconds)
	_fade_tween.tween_property(inactive_music, "volume_db", -8.0, fade_seconds)
	var swap := active_music
	active_music = inactive_music
	inactive_music = swap

func play_sfx(id: String, volume_db: float = -8.0) -> void:
	if not AssetRegistry.SOUND_EFFECTS.has(id):
		return
	for player in _sfx_players:
		if not player.playing:
			player.stream = load(AssetRegistry.SOUND_EFFECTS[id])
			player.volume_db = volume_db
			player.play()
			return

func set_pause_duck(paused: bool) -> void:
	if active_music == null or ambient == null:
		return
	var tween := create_tween().set_parallel(true)
	tween.tween_property(active_music, "volume_db", -17.0 if paused else -8.0, 0.22)
	tween.tween_property(ambient, "volume_db", -36.0 if paused else -24.0, 0.22)

func shutdown() -> void:
	if _fade_tween != null and _fade_tween.is_valid():
		_fade_tween.kill()
	for player in [music_a, music_b, ambient]:
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

func _ensure_bus(bus_name: String) -> void:
	if AudioServer.get_bus_index(bus_name) >= 0:
		return
	AudioServer.add_bus()
	AudioServer.set_bus_name(AudioServer.bus_count - 1, bus_name)

func _enable_loop(stream: AudioStream) -> void:
	if stream is AudioStreamOggVorbis:
		(stream as AudioStreamOggVorbis).loop = true
