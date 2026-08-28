class_name SaveService
extends RefCounted

const RUN_PATH := "user://saves/active_run.json"
const PROFILE_PATH := "user://saves/profile.json"

static func save_run(run: RunState, path: String = RUN_PATH) -> bool:
	var payload := run.to_dict()
	var payload_text := JSON.stringify(payload)
	var envelope := {
		"schema_version": GameDefs.SAVE_SCHEMA_VERSION,
		"saved_at_unix": Time.get_unix_time_from_system(),
		"checksum": _sha256(payload_text),
		"payload": payload,
	}
	return _atomic_write(path, JSON.stringify(envelope, "  "))

static func load_run(path: String = RUN_PATH) -> RunState:
	var envelope := _read_dictionary(path)
	if envelope.is_empty():
		return null
	if int(envelope.get("schema_version", 0)) != GameDefs.SAVE_SCHEMA_VERSION:
		push_error("不支持的存档版本：%s" % envelope.get("schema_version", 0))
		return null
	var payload: Dictionary = envelope.get("payload", {})
	var payload_text := JSON.stringify(payload)
	if str(envelope.get("checksum", "")) != _sha256(payload_text):
		push_error("存档校验失败")
		return null
	return RunState.from_dict(payload)

static func has_run(path: String = RUN_PATH) -> bool:
	return FileAccess.file_exists(path)

static func clear_run(path: String = RUN_PATH) -> void:
	if FileAccess.file_exists(path):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(path))

static func load_profile(path: String = PROFILE_PATH) -> Dictionary:
	var defaults := {"memory_shards": 0, "max_pressure": 0, "discovered": {}, "boss_archives": [], "tutorial_skipped": false}
	var data := _read_dictionary(path)
	if data.is_empty():
		return defaults
	for key in defaults:
		if not data.has(key):
			data[key] = defaults[key]
	return data

static func save_profile(profile: Dictionary, path: String = PROFILE_PATH) -> bool:
	return _atomic_write(path, JSON.stringify(profile, "  "))

static func _atomic_write(path: String, text: String) -> bool:
	var absolute := ProjectSettings.globalize_path(path)
	var directory := absolute.get_base_dir()
	DirAccess.make_dir_recursive_absolute(directory)
	var temp := absolute + ".tmp"
	var backup := absolute + ".bak"
	var file := FileAccess.open(temp, FileAccess.WRITE)
	if file == null:
		push_error("无法写入临时存档：%s" % temp)
		return false
	file.store_string(text)
	file.flush()
	file.close()
	if FileAccess.file_exists(path):
		if FileAccess.file_exists(path + ".bak"):
			DirAccess.remove_absolute(backup)
		DirAccess.rename_absolute(absolute, backup)
	if DirAccess.rename_absolute(temp, absolute) != OK:
		push_error("无法提交原子存档：%s" % absolute)
		return false
	return true

static func _read_dictionary(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return {}
	var data: Variant = JSON.parse_string(file.get_as_text())
	return data if typeof(data) == TYPE_DICTIONARY else {}

static func _sha256(text: String) -> String:
	var context := HashingContext.new()
	context.start(HashingContext.HASH_SHA256)
	context.update(text.to_utf8_buffer())
	return context.finish().hex_encode()
