class_name ContentCatalog
extends RefCounted

var acts: Dictionary = {}
var towers: Dictionary = {}
var enemies: Dictionary = {}
var elites: Dictionary = {}
var bosses: Dictionary = {}
var relics: Dictionary = {}
var talents: Dictionary = {}
var events: Dictionary = {}
var errors: Array[String] = []

static func create_default() -> ContentCatalog:
	var catalog := ContentCatalog.new()
	catalog.load_catalog()
	return catalog

func load_catalog() -> bool:
	errors.clear()
	acts.clear()
	towers.clear()
	enemies.clear()
	elites.clear()
	bosses.clear()
	relics.clear()
	talents.clear()
	events.clear()
	var main := _read_json("res://content/catalog_main.json")
	var progression := _read_json("res://content/catalog_progression.json")
	if main.is_empty() or progression.is_empty():
		return false
	_index_entries(main.get("acts", []), acts, "幕")
	_index_entries(main.get("towers", []), towers, "单位")
	_index_entries(main.get("enemies", []), enemies, "敌人")
	_index_entries(main.get("elites", []), elites, "精英")
	_index_entries(main.get("bosses", []), bosses, "首领")
	_index_entries(progression.get("relics", []), relics, "收藏品")
	_index_entries(progression.get("talents", []), talents, "天赋")
	_index_entries(progression.get("events", []), events, "事件")
	_apply_v2_runtime_fields()
	_validate_counts()
	_validate_references()
	return errors.is_empty()

func tower_ids_for_role(role: String) -> Array[String]:
	var result: Array[String] = []
	for id in towers:
		if str(towers[id].get("role", "")) == role:
			result.append(str(id))
	result.sort()
	return result

func enemy_pool_for_act(act_number: int, include_previous: bool = true) -> Array[String]:
	var result: Array[String] = []
	for id in enemies:
		var entry_act := int(enemies[id].get("act", 1))
		if entry_act == act_number or (include_previous and entry_act < act_number):
			result.append(str(id))
	result.sort()
	return result

func elite_pool_for_act(act_number: int) -> Array[String]:
	var result: Array[String] = []
	for id in elites:
		if int(elites[id].get("act", 1)) <= act_number:
			result.append(str(id))
	result.sort()
	return result

func events_for_act(act_number: int) -> Array[String]:
	var result: Array[String] = []
	for id in events:
		if int(events[id].get("act", 1)) == act_number:
			result.append(str(id))
	result.sort()
	return result

func _read_json(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		errors.append("缺少内容文件：%s" % path)
		return {}
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		errors.append("无法读取内容文件：%s" % path)
		return {}
	var parser := JSON.new()
	var parse_error := parser.parse(file.get_as_text())
	if parse_error != OK:
		errors.append("内容文件格式错误 %s:%d %s" % [path, parser.get_error_line(), parser.get_error_message()])
		return {}
	if typeof(parser.data) != TYPE_DICTIONARY:
		errors.append("内容文件根节点必须为对象：%s" % path)
		return {}
	return parser.data

func _index_entries(entries: Array, target: Dictionary, label: String) -> void:
	for raw in entries:
		if typeof(raw) != TYPE_DICTIONARY:
			errors.append("%s条目不是对象" % label)
			continue
		var id := str(raw.get("id", ""))
		var name := str(raw.get("name", raw.get("title", "")))
		if id.is_empty() or name.is_empty():
			errors.append("%s缺少稳定ID或中文名称" % label)
			continue
		if target.has(id):
			errors.append("%s ID重复：%s" % [label, id])
			continue
		target[id] = raw

func _validate_counts() -> void:
	var expected := {
		"幕": [acts.size(), 3],
		"单位": [towers.size(), 12],
		"敌人": [enemies.size(), 18],
		"精英": [elites.size(), 4],
		"首领": [bosses.size(), 6],
		"收藏品": [relics.size(), 30],
		"天赋": [talents.size(), 24],
		"事件": [events.size(), 24],
	}
	for label in expected:
		if expected[label][0] != expected[label][1]:
			errors.append("%s数量应为%d，实际为%d" % [label, expected[label][1], expected[label][0]])

func _validate_references() -> void:
	for act_id in acts:
		for boss_id in acts[act_id].get("bosses", []):
			if not bosses.has(str(boss_id)):
				errors.append("幕 %s 引用了不存在的首领 %s" % [act_id, boss_id])
	for tower_id in towers:
		var tower: Dictionary = towers[tower_id]
		if not ["melee", "ranged", "support"].has(str(tower.get("role", ""))):
			errors.append("单位职责无效：%s" % tower_id)
		if typeof(tower.get("branches", {})) != TYPE_DICTIONARY or tower.get("branches", {}).size() != 2:
			errors.append("单位必须有A/B两个分支：%s" % tower_id)

func _apply_v2_runtime_fields() -> void:
	for tower_id in towers:
		var tower: Dictionary = towers[tower_id]
		tower["sprite_id"] = str(tower.get("sprite_id", tower_id))
		tower["range"] = float(tower.get("range", 1.0)) * GameDefs.MICROGRID_SCALE
		var old: Array = tower.get("footprint", [1, 1])
		var width := int(old[0])
		var height := int(old[1])
		if width == 1 and height == 1:
			tower["footprint"] = [2, 2]
		elif width == 2 and height == 1:
			tower["footprint"] = [3, 2]
		elif width == 1 and height == 2:
			tower["footprint"] = [2, 3]
		else:
			tower["footprint"] = [3, 3]
	for source in [enemies, elites, bosses]:
		for id in source:
			source[id]["sprite_id"] = str(source[id].get("sprite_id", id))
