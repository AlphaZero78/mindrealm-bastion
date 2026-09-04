class_name MapGenerator
extends RefCounted

const NODE_WEIGHTS := {
	"combat": 38,
	"elite": 8,
	"camp": 10,
	"workshop": 8,
	"shop": 9,
	"event": 11,
	"unknown": 16,
}
const SERVICE_TYPES := ["camp", "workshop", "shop"]
const NODE_INFO := {
	"combat": ["常规威胁", "单位选择，可能发现收藏品"],
	"elite": ["高威胁 · 含精英", "保证收藏品与大量专注"],
	"camp": ["安全", "恢复、维修或免费升阶三选一"],
	"workshop": ["安全", "反复维修或升级后主动离开"],
	"shop": ["安全", "购买单位与未持有收藏品"],
	"treasure": ["未知守护", "免费收藏品三选一"],
	"event": ["结果预先说明", "用资源交换永久机会"],
	"unknown": ["部分情报隐藏", "事件、战斗、商店或宝库"],
	"boss": ["极高威胁", "击败本幕控制信号"],
}

static func generate_all(streams: SeedStreams, catalog: ContentCatalog) -> Array:
	var result: Array = []
	for act_index in 3:
		result.append(_generate_act(act_index, streams, catalog))
	return result

static func _generate_act(act_index: int, streams: SeedStreams, catalog: ContentCatalog) -> Dictionary:
	var act_id: String = GameDefs.ACT_IDS[act_index]
	var act_data: Dictionary = catalog.acts[act_id]
	var floor_count := int(act_data["floors"])
	var boss_options: Array = act_data["bosses"]
	var boss_id := str(boss_options[streams.rng_at("boss_%d" % act_index, 0).randi_range(0, boss_options.size() - 1)])
	var floors: Array = []
	# Topology is generated before type assignment. Stable node ids then own their
	# random stream, so adding a tooltip or hovering never changes later results.
	for floor_index in floor_count:
		var floor_nodes: Array = []
		for lane in _lanes_for_floor(act_index, floor_index, floor_count, streams):
			floor_nodes.append({
				"id": "a%d_f%d_l%d" % [act_index + 1, floor_index + 1, lane],
				"act": act_index,
				"floor": floor_index,
				"lane": lane,
				"type": "",
				"display_type": "",
				"map_icon_id": "",
				"connections": [],
				"completed": false,
				"available": floor_index == 0,
			})
		floors.append(floor_nodes)
	_connect_floors(floors)
	_assign_node_types(floors, act_index, streams)
	var used_events: Array[String] = []
	for floor_nodes in floors:
		for node in floor_nodes:
			_populate_payload(node, boss_id, streams, catalog, used_events)
	return {
		"id": act_id,
		"name": GameDefs.ACT_NAMES[act_index],
		"index": act_index,
		"floor_count": floor_count,
		"boss_id": boss_id,
		"boss_reveal": 0,
		"floors": floors,
	}

static func _lanes_for_floor(act_index: int, floor_index: int, floor_count: int, streams: SeedStreams) -> Array[int]:
	if floor_index >= floor_count - 2:
		return [2]
	if act_index == 0 and floor_index == 0:
		return [0, 1, 3, 4]
	var generator := streams.rng_at("map_lanes_%d" % act_index, floor_index)
	var count := generator.randi_range(2, 4)
	var candidates := [0, 1, 2, 3, 4]
	for i in range(candidates.size() - 1, 0, -1):
		var j := generator.randi_range(0, i)
		var swap: int = candidates[i]
		candidates[i] = candidates[j]
		candidates[j] = swap
	var selected: Array[int] = []
	for i in count:
		selected.append(candidates[i])
	selected.sort()
	return selected

static func _assign_node_types(floors: Array, act_index: int, streams: SeedStreams) -> void:
	var floor_count := floors.size()
	var treasure_floor := clampi(int(floor(float(floor_count) * 0.48)), 5, floor_count - 4)
	for floor_index in floor_count:
		var nodes: Array = floors[floor_index]
		if floor_index == floor_count - 1:
			_set_node_type(nodes[0], "boss")
			continue
		if floor_index == floor_count - 2:
			_set_node_type(nodes[0], "camp")
			continue
		if act_index == 0 and floor_index == 0:
			for node in nodes:
				_set_node_type(node, "combat")
			continue
		for node in nodes:
			var type_id := _sample_node_type(node, floor_index, streams)
			# The mandatory pre-boss camp must never be preceded by another service
			# node on any legal route.
			if floor_index == floor_count - 3 and type_id in SERVICE_TYPES:
				type_id = "combat" if int(node["lane"]) % 2 == 0 else "event"
			if type_id in SERVICE_TYPES and _has_incoming_service(node, floors, floor_index):
				type_id = "combat" if int(node["lane"]) % 2 == 0 else "event"
			_set_node_type(node, type_id)
		if floor_index == treasure_floor:
			var treasure_index := streams.rng_at("treasure_node_%d" % act_index, 0).randi_range(0, nodes.size() - 1)
			_set_node_type(nodes[treasure_index], "treasure")
		_ensure_floor_diversity(nodes, floor_index, treasure_floor)

static func _sample_node_type(node: Dictionary, floor_index: int, streams: SeedStreams) -> String:
	var filtered := NODE_WEIGHTS.duplicate()
	if floor_index < 4:
		filtered.erase("elite")
	if floor_index <= 1:
		filtered.erase("shop")
	var total := 0
	for weight in filtered.values():
		total += int(weight)
	var node_id := str(node["id"])
	var roll := streams.rng_at("map_type_%s" % node_id, 0).randi_range(1, total)
	var running := 0
	for type_id in filtered:
		running += int(filtered[type_id])
		if roll <= running:
			return str(type_id)
	return "combat"

static func _has_incoming_service(node: Dictionary, floors: Array, floor_index: int) -> bool:
	if floor_index <= 0:
		return false
	for previous in floors[floor_index - 1]:
		if previous["connections"].has(node["id"]) and str(previous.get("type", "")) in SERVICE_TYPES:
			return true
	return false

static func _ensure_floor_diversity(nodes: Array, floor_index: int, treasure_floor: int) -> void:
	if nodes.size() < 2:
		return
	var first_type := str(nodes[0]["type"])
	var all_same := true
	for node in nodes:
		if str(node["type"]) != first_type:
			all_same = false
			break
	if not all_same:
		return
	var replacement := "event" if first_type != "event" else "combat"
	if floor_index == treasure_floor and first_type == "treasure":
		replacement = "combat"
	_set_node_type(nodes[-1], replacement)

static func _set_node_type(node: Dictionary, type_id: String) -> void:
	node["type"] = type_id
	node["display_type"] = type_id
	node["map_icon_id"] = type_id
	var info: Array = NODE_INFO.get(type_id, ["未知", "未知收益"])
	node["risk_text"] = info[0]
	node["reward_text"] = info[1]

static func _populate_payload(node: Dictionary, boss_id: String, streams: SeedStreams, catalog: ContentCatalog, used_events: Array[String]) -> void:
	var act_number := int(node["act"]) + 1
	var node_id := str(node["id"])
	var actual_type := str(node["type"])
	if actual_type == "unknown":
		var outcomes := ["event", "combat", "shop", "treasure"]
		actual_type = str(outcomes[streams.rng_at("unknown_%s" % node_id, 0).randi_range(0, outcomes.size() - 1)])
		node["resolved_type"] = actual_type
		node["display_type"] = "unknown"
	if actual_type in ["combat", "elite", "boss"]:
		node["unit_rewards"] = _sample_ids(catalog.towers.keys(), 3, streams.rng_at("unit_reward_%s" % node_id, 0))
		node["relic_rewards"] = _sample_ids(catalog.relics.keys(), 3, streams.rng_at("relic_reward_%s" % node_id, 0))
		node["relic_roll"] = streams.rng_at("relic_roll_%s" % node_id, 0).randf()
		if actual_type == "boss":
			node["boss_id"] = boss_id
	if actual_type == "shop":
		node["shop_units"] = _sample_ids(catalog.towers.keys(), 3, streams.rng_at("shop_units_%s" % node_id, 0))
		node["shop_relics"] = _sample_ids(catalog.relics.keys(), 3, streams.rng_at("shop_relics_%s" % node_id, 0))
		node["purchased"] = []
	if actual_type == "treasure":
		node["relic_rewards"] = _sample_ids(catalog.relics.keys(), 3, streams.rng_at("treasure_%s" % node_id, 0))
	if actual_type == "event":
		var pool: Array = catalog.events_for_act(act_number)
		var unused: Array = []
		for event_id in pool:
			if not used_events.has(str(event_id)):
				unused.append(event_id)
		if unused.is_empty():
			unused = pool
		var chosen := str(unused[streams.rng_at("event_%s" % node_id, 0).randi_range(0, unused.size() - 1)])
		node["event_id"] = chosen
		used_events.append(chosen)

static func _sample_ids(source: Array, count: int, generator: RandomNumberGenerator) -> Array[String]:
	var copy := source.duplicate()
	for i in range(copy.size() - 1, 0, -1):
		var j := generator.randi_range(0, i)
		var swap: Variant = copy[i]
		copy[i] = copy[j]
		copy[j] = swap
	var result: Array[String] = []
	for i in mini(count, copy.size()):
		result.append(str(copy[i]))
	return result

static func _connect_floors(floors: Array) -> void:
	for floor_index in range(floors.size() - 1):
		var current: Array = floors[floor_index]
		var next: Array = floors[floor_index + 1]
		var incoming: Dictionary = {}
		for next_node in next:
			incoming[str(next_node["id"])] = 0
		for node in current:
			var ranked := next.duplicate()
			ranked.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return abs(int(a["lane"]) - int(node["lane"])) < abs(int(b["lane"]) - int(node["lane"])))
			var link_count := 2 if ranked.size() > 1 and abs(int(ranked[1]["lane"]) - int(node["lane"])) <= 1 else 1
			for i in link_count:
				var target_id := str(ranked[i]["id"])
				if not node["connections"].has(target_id):
					node["connections"].append(target_id)
					incoming[target_id] = int(incoming[target_id]) + 1
		for next_node in next:
			var target_id := str(next_node["id"])
			if int(incoming[target_id]) > 0:
				continue
			var nearest: Dictionary = current[0]
			for candidate in current:
				if abs(int(candidate["lane"]) - int(next_node["lane"])) < abs(int(nearest["lane"]) - int(next_node["lane"])):
					nearest = candidate
			nearest["connections"].append(target_id)
