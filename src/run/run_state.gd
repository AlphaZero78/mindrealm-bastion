class_name RunState
extends RefCounted

var seed_text := ""
var pressure_level := 0
var spirit := 100.0
var max_spirit := 100.0
var focus := 99
var base_bandwidth := 20
var resistance := 0.0
var depth := 1
var experience := 0
var act_index := 0
var current_floor := -1
var current_node_id := ""
var phase := "map"
var maps: Array = []
var terrain_grid: Array = []
var terrain_revision := 0
var terrain_undo_stack: Array = []
var towers: Array = []
var relic_ids: Array[String] = []
var talent_ids: Array[String] = []
var reward_queue: Array = []
var seed_streams := SeedStreams.new()
var deployment_counter := 0
var next_tower_number := 1
var pending_node: Dictionary = {}
var prebattle_snapshot: Dictionary = {}
var run_complete := false
var victory := false
var pressure_multiplier := 1.0
var tower_damage_bonus := 0.0
var repair_discount := 0.0
var stats := {
	"nodes_completed": 0,
	"battles_won": 0,
	"enemies_killed": 0,
	"enemies_breached": 0,
	"elites_killed": 0,
	"spirit_breakthrough": 0.0,
	"spirit_death_pressure": 0.0,
	"towers_destroyed": 0,
	"overload_seconds": 0.0,
	"damage_by_tower": {},
	"route": [],
	"bosses_defeated": [],
}

static func create_new(seed: String, pressure: int, catalog: ContentCatalog) -> RunState:
	var run := RunState.new()
	run.seed_text = seed.strip_edges()
	if run.seed_text.is_empty():
		run.seed_text = "偏频-0001"
	run.pressure_level = clampi(pressure, 0, 10)
	run.seed_streams = SeedStreams.new(run.seed_text)
	run.maps = MapGenerator.generate_all(run.seed_streams, catalog)
	run.terrain_grid = TerrainGenerator.generate(run.seed_streams)
	run._apply_pressure_rules()
	var starters := [
		"anchor_bulwark", "phase_blade", "resonance_guard",
		"pulse_array", "focus_rail", "arc_mortar",
		"bandwidth_relay",
	]
	for tower_id in starters:
		run.add_tower(str(tower_id), catalog, 1, "")
	return run

func add_tower(tower_id: String, catalog: ContentCatalog, tier: int = 1, branch: String = "") -> Dictionary:
	if not catalog.towers.has(tower_id):
		return {}
	var definition: Dictionary = catalog.towers[tower_id]
	var instance := definition.duplicate(true)
	instance["instance_id"] = "U%04d" % next_tower_number
	next_tower_number += 1
	instance["tier"] = tier
	instance["branch"] = branch
	instance["max_durability"] = float(definition.get("hp", 100.0)) * _tier_hp_multiplier(tier)
	instance["durability"] = instance["max_durability"]
	instance["deployed"] = false
	instance["cell"] = [-1, -1]
	instance["ever_deployed"] = false
	instance["deployment_order"] = 0
	instance["disabled"] = false
	instance["priority"] = "highest_hp" if str(definition.get("ability", "")) == "high_hp_priority" else "nearest"
	instance["kills"] = 0
	instance["damage_done"] = 0.0
	instance["cooldown"] = 0.0
	_apply_branch_stats(instance, catalog)
	towers.append(instance)
	return instance

func get_tower(instance_id: String) -> Dictionary:
	for tower in towers:
		if str(tower.get("instance_id", "")) == instance_id:
			return tower
	return {}

func upgrade_tower(instance_id: String, branch_choice: String, catalog: ContentCatalog, free: bool = false) -> Dictionary:
	var tower := get_tower(instance_id)
	if tower.is_empty():
		return {"ok": false, "reason": "未找到单位"}
	var tier := int(tower.get("tier", 1))
	if tier >= 3:
		return {"ok": false, "reason": "单位已经达到T3"}
	var branch := str(tower.get("branch", ""))
	if tier == 1:
		if not ["A", "B"].has(branch_choice):
			return {"ok": false, "reason": "T1升级必须选择A或B分支"}
		branch = branch_choice
	elif branch_choice != "" and branch_choice != branch:
		return {"ok": false, "reason": "T2只能沿已选分支成长"}
	var cost := 0 if free else ceili(float(tower.get("upkeep", 0)) * (1.5 if tier == 1 else 2.5))
	if focus < cost:
		return {"ok": false, "reason": "专注不足，需要%d" % cost, "cost": cost}
	var durability_ratio := float(tower.get("durability", 0.0)) / maxf(1.0, float(tower.get("max_durability", 1.0)))
	if not free:
		focus -= cost
	tower["tier"] = tier + 1
	tower["branch"] = branch
	var definition: Dictionary = catalog.towers[str(tower["id"])]
	var branch_data: Dictionary = definition.get("branches", {}).get(branch, {})
	tower["max_durability"] = float(definition.get("hp", 100.0)) * _tier_hp_multiplier(tier + 1) * float(branch_data.get("hp_mult", 1.0))
	tower["durability"] = float(tower["max_durability"]) * durability_ratio
	tower["attack"] = float(definition.get("attack", 0.0)) * _tier_attack_multiplier(tier + 1) * float(branch_data.get("attack_mult", 1.0))
	tower["branch_effect"] = str(branch_data.get("effect", ""))
	return {"ok": true, "cost": cost, "tier": tier + 1, "branch": branch}

func fuse_tower(core_instance_id: String, branch_choice: String, catalog: ContentCatalog) -> Dictionary:
	var core := get_tower(core_instance_id)
	if core.is_empty():
		return {"ok": false, "reason": "未找到融合核心"}
	var tier := int(core.get("tier", 1))
	if tier >= 3:
		return {"ok": false, "reason": "T3不能继续融合"}
	var materials: Array = []
	for tower in towers:
		if str(tower.get("id", "")) != str(core.get("id", "")) or int(tower.get("tier", 1)) != tier:
			continue
		if tier == 2 and str(tower.get("branch", "")) != str(core.get("branch", "")):
			continue
		materials.append(tower)
	if materials.size() < 3:
		return {"ok": false, "reason": "需要三个同类型、同阶单位"}
	var selected: Array = [core]
	for candidate in materials:
		if candidate != core and selected.size() < 3:
			selected.append(candidate)
	var total_current := 0.0
	var total_maximum := 0.0
	for material in selected:
		total_current += float(material.get("durability", 0.0))
		total_maximum += float(material.get("max_durability", 1.0))
	var ratio := total_current / maxf(1.0, total_maximum)
	var result := upgrade_tower(core_instance_id, branch_choice, catalog, true)
	if not bool(result.get("ok", false)):
		return result
	core["durability"] = float(core["max_durability"]) * ratio
	for material in selected:
		if material != core:
			towers.erase(material)
	result["consumed"] = 2
	result["durability_ratio"] = ratio
	return result

func apply_event_effects(effects: Dictionary, catalog: ContentCatalog) -> Array[String]:
	var messages: Array[String] = []
	for effect in effects:
		var value: Variant = effects[effect]
		match str(effect):
			"spirit":
				spirit = GameDefs.clamp_spirit(spirit + float(value), max_spirit)
				messages.append("精神稳定%+.0f" % float(value))
			"focus":
				focus = maxi(0, focus + int(value))
				messages.append("专注%+d" % int(value))
			"bandwidth":
				base_bandwidth = maxi(1, base_bandwidth + int(value))
				messages.append("带宽%+d" % int(value))
			"resistance":
				resistance = maxf(0.0, resistance + float(value))
				messages.append("抗性%+.0f" % float(value))
			"xp":
				var levels := add_experience(int(value))
				messages.append("经验+%d，深度提升%d" % [int(value), levels])
			"tower_hp":
				var target := _random_tower()
				if not target.is_empty():
					target["max_durability"] = float(target["max_durability"]) * (1.0 + float(value))
					target["durability"] = float(target["durability"]) * (1.0 + float(value))
					messages.append("%s最大耐久提高" % target["name"])
			"tower_damage_bonus":
				tower_damage_bonus += float(value)
				messages.append("单位伤害永久提高%.0f%%" % (float(value) * 100.0))
			"repair_discount":
				repair_discount = clampf(repair_discount + float(value), 0.0, 0.8)
				messages.append("维修费用永久降低%.0f%%" % (float(value) * 100.0))
			"repair_all":
				repair_all(float(value))
				messages.append("所有单位恢复耐久")
			"tower_damage":
				var damaged := _random_tower()
				if not damaged.is_empty():
					damaged["durability"] = maxf(0.0, float(damaged["durability"]) - float(damaged["max_durability"]) * float(value))
					messages.append("%s受到损伤" % damaged["name"])
			"unit", "duplicate_t1":
				var ids := catalog.towers.keys()
				var id := str(ids[seed_streams.rng("event_unit").randi_range(0, ids.size() - 1)])
				add_tower(id, catalog)
				messages.append("获得%s" % catalog.towers[id]["name"])
			"unit_t2":
				var ids := catalog.towers.keys()
				var id := str(ids[seed_streams.rng("event_unit_t2").randi_range(0, ids.size() - 1)])
				add_tower(id, catalog, 2, "A" if seed_streams.rng("event_branch").randi_range(0, 1) == 0 else "B")
				messages.append("获得T2 %s" % catalog.towers[id]["name"])
			"relic":
				var available: Array = []
				for id in catalog.relics:
					if not relic_ids.has(str(id)):
						available.append(id)
				if not available.is_empty():
					var id := str(available[seed_streams.rng("event_relic").randi_range(0, available.size() - 1)])
					relic_ids.append(id)
					messages.append("获得收藏品：%s" % catalog.relics[id]["name"])
			"free_upgrade", "free_upgrades":
				var amount := int(value)
				for _i in amount:
					var upgradable: Array = []
					for tower in towers:
						if int(tower.get("tier", 1)) < 3:
							upgradable.append(tower)
					if upgradable.is_empty():
						break
					var tower: Dictionary = upgradable[seed_streams.rng("event_upgrade").randi_range(0, upgradable.size() - 1)]
					var branch := str(tower.get("branch", ""))
					if branch.is_empty():
						branch = "A" if seed_streams.rng("event_upgrade_branch").randi_range(0, 1) == 0 else "B"
					upgrade_tower(str(tower["instance_id"]), branch, catalog, true)
					messages.append("免费升级%s" % tower["name"])
			"free_repairs":
				var damaged := towers.duplicate()
				damaged.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
					return float(a.get("durability", 0.0)) / maxf(1.0, float(a.get("max_durability", 1.0))) < float(b.get("durability", 0.0)) / maxf(1.0, float(b.get("max_durability", 1.0)))
				)
				for i in mini(int(value), damaged.size()):
					damaged[i]["durability"] = damaged[i]["max_durability"]
					damaged[i]["deployed"] = false
				messages.append("免费维修%d个单位" % int(value))
			"pressure_mult":
				pressure_multiplier *= 1.0 + float(value)
				messages.append("敌人死亡压力提高%.0f%%" % (float(value) * 100.0))
			"boss_reveal":
				current_act()["boss_reveal"] = 3
				messages.append("本幕首领情报已完全公开")
	refresh_owned_content(catalog)
	return messages

func repair_all(ratio: float) -> void:
	for tower in towers:
		var maximum := float(tower.get("max_durability", 1.0))
		tower["durability"] = minf(maximum, float(tower.get("durability", 0.0)) + maximum * ratio)

func _random_tower() -> Dictionary:
	if towers.is_empty():
		return {}
	return towers[seed_streams.rng("event_tower").randi_range(0, towers.size() - 1)]

func deployed_bandwidth() -> int:
	var total := 0
	for tower in towers:
		if bool(tower.get("deployed", false)) and float(tower.get("durability", 0.0)) > 0.0:
			total += int(tower.get("bandwidth", 0))
	return total

func relic_value(effect: String) -> float:
	var total := 0.0
	for relic in _owned_relic_data:
		if str(relic.get("effect", "")) == effect:
			total += float(relic.get("value", 0.0))
	return total

var _owned_relic_data: Array = []
var _owned_talent_data: Array = []

func refresh_owned_content(catalog: ContentCatalog) -> void:
	_owned_relic_data.clear()
	_owned_talent_data.clear()
	for relic_id in relic_ids:
		if catalog.relics.has(relic_id):
			_owned_relic_data.append(catalog.relics[relic_id])
	for talent_id in talent_ids:
		if catalog.talents.has(talent_id):
			_owned_talent_data.append(catalog.talents[talent_id])
	repair_discount = clampf(relic_value("repair_discount"), 0.0, 0.8)

func talent_value(effect: String) -> float:
	var total := 0.0
	for talent in _owned_talent_data:
		if str(talent.get("effect", "")) == effect:
			total += float(talent.get("value", 0.0))
	return total

func effective_resistance() -> float:
	var total := resistance + relic_value("resistance")
	for tower in towers:
		if bool(tower.get("deployed", false)) and float(tower.get("durability", 0.0)) > 0.0 and not bool(tower.get("disabled", false)) and str(tower.get("ability", "")) == "resistance_plus":
			total += float(tower.get("support_value", 3.0))
			if str(tower.get("branch_effect", "")) == "resistance_plus_more":
				total += 2.0
	if spirit / maxf(1.0, max_spirit) < 0.25:
		total += relic_value("crisis_resistance")
	return total

func effective_bandwidth(jam: int = 0) -> int:
	return RuleService.effective_bandwidth(towers, base_bandwidth, jam, int(relic_value("bandwidth")))

func current_act() -> Dictionary:
	if act_index < 0 or act_index >= maps.size():
		return {}
	return maps[act_index]

func find_node(node_id: String) -> Dictionary:
	for act in maps:
		for floor_nodes in act.get("floors", []):
			for node in floor_nodes:
				if str(node.get("id", "")) == node_id:
					return node
	return {}

func available_nodes() -> Array:
	var result: Array = []
	if run_complete:
		return result
	var act := current_act()
	if act.is_empty():
		return result
	for floor_nodes in act.get("floors", []):
		for node in floor_nodes:
			if bool(node.get("available", false)) and not bool(node.get("completed", false)):
				result.append(node)
	return result

func choose_node(node_id: String) -> bool:
	var node := find_node(node_id)
	if node.is_empty() or not bool(node.get("available", false)) or bool(node.get("completed", false)):
		return false
	for available in available_nodes():
		available["available"] = false
	pending_node = node
	current_node_id = node_id
	current_floor = int(node.get("floor", 0))
	stats["route"].append(node_id)
	phase = "prebattle" if resolved_node_type(node) in ["combat", "elite", "boss"] else "node"
	return true

func complete_current_node() -> void:
	if pending_node.is_empty():
		return
	pending_node["completed"] = true
	stats["nodes_completed"] = int(stats["nodes_completed"]) + 1
	var node_type := resolved_node_type(pending_node)
	if node_type == "boss":
		stats["bosses_defeated"].append(str(pending_node.get("boss_id", "")))
		if act_index >= maps.size() - 1:
			run_complete = true
			victory = true
			phase = "settlement"
			return
		focus += 100
		act_index += 1
		current_floor = -1
		current_node_id = ""
		pending_node = {}
		phase = "map"
		return
	for connection_id in pending_node.get("connections", []):
		var target := find_node(str(connection_id))
		if not target.is_empty():
			target["available"] = true
	current_node_id = ""
	pending_node = {}
	phase = "map"

func resolved_node_type(node: Dictionary) -> String:
	if str(node.get("type", "")) == "unknown":
		return str(node.get("resolved_type", "event"))
	return str(node.get("type", ""))

func add_experience(amount: int) -> int:
	experience += maxi(0, amount)
	var levels_gained := 0
	while depth < 12 and experience >= RuleService.xp_required_for_depth(depth):
		experience -= RuleService.xp_required_for_depth(depth)
		depth += 1
		levels_gained += 1
		max_spirit += 5.0
		spirit = GameDefs.clamp_spirit(spirit + 10.0, max_spirit)
		base_bandwidth += 1
		base_bandwidth += int(talent_value("level_bandwidth"))
		resistance += 1.0
	return levels_gained

func queue_combat_rewards(node: Dictionary, levels_gained: int) -> void:
	var node_type := resolved_node_type(node)
	if node_type == "boss" and act_index >= maps.size() - 1:
		return
	reward_queue.append({"kind": "unit", "choices": node.get("unit_rewards", []).duplicate()})
	for _level in levels_gained:
		reward_queue.append({"kind": "unit", "choices": node.get("unit_rewards", []).duplicate()})
	var should_relic := node_type in ["elite", "boss"] or float(node.get("relic_roll", 1.0)) < 0.20
	if should_relic:
		var choices: Array = []
		for id in node.get("relic_rewards", []):
			if not relic_ids.has(str(id)):
				choices.append(id)
		if not choices.is_empty():
			reward_queue.append({"kind": "relic", "choices": choices})
	for new_depth in range(depth - levels_gained + 1, depth + 1):
		if new_depth % 2 == 0:
			reward_queue.append({"kind": "talent", "choices": []})

func make_talent_choices(catalog: ContentCatalog, count: int = 3) -> Array[String]:
	var available: Array = []
	for id in catalog.talents:
		if not talent_ids.has(str(id)):
			available.append(id)
	var generator := seed_streams.rng("talent_reward")
	var result: Array[String] = []
	while not available.is_empty() and result.size() < count:
		var index := generator.randi_range(0, available.size() - 1)
		result.append(str(available.pop_at(index)))
	return result

func snapshot_before_battle() -> void:
	terrain_undo_stack.clear()
	prebattle_snapshot = {}
	prebattle_snapshot = to_dict(false)

func apply_terrain_command(command: Dictionary) -> Dictionary:
	if phase != "prebattle":
		return {"ok": false, "reason": "只能在战前阶段改造地形"}
	var validation := RuleService.validate_terrain_command(terrain_grid, command, towers)
	if not bool(validation.get("ok", false)):
		return validation
	var cost := int(validation.get("cost", 0))
	if focus < cost:
		return {"ok": false, "reason": "专注不足，需要%d" % cost, "cost": cost}
	var result := RuleService.apply_terrain_command(terrain_grid, command, towers)
	if not bool(result.get("ok", false)):
		return result
	focus -= cost
	terrain_undo_stack.append({"changes": result.get("changes", []).duplicate(true), "refund": cost})
	terrain_revision += 1
	result["remaining_focus"] = focus
	return result

func undo_terrain_command() -> Dictionary:
	if phase != "prebattle":
		return {"ok": false, "reason": "战斗开始后不能撤销地形"}
	if terrain_undo_stack.is_empty():
		return {"ok": false, "reason": "没有可撤销的地形操作"}
	var transaction: Dictionary = terrain_undo_stack.pop_back()
	RuleService.undo_terrain_changes(terrain_grid, transaction.get("changes", []))
	var refund := int(transaction.get("refund", 0))
	focus += refund
	terrain_revision += 1
	return {"ok": true, "refund": refund, "remaining_focus": focus}

func lock_prebattle_edits() -> void:
	terrain_undo_stack.clear()

func restore_prebattle() -> RunState:
	if prebattle_snapshot.is_empty():
		return self
	return RunState.from_dict(prebattle_snapshot)

func end_failure() -> void:
	spirit = 0.0
	run_complete = true
	victory = false
	phase = "settlement"

func to_dict(include_snapshot: bool = true) -> Dictionary:
	var data := {
		"seed_text": seed_text,
		"pressure_level": pressure_level,
		"spirit": spirit,
		"max_spirit": max_spirit,
		"focus": focus,
		"base_bandwidth": base_bandwidth,
		"resistance": resistance,
		"depth": depth,
		"experience": experience,
		"act_index": act_index,
		"current_floor": current_floor,
		"current_node_id": current_node_id,
		"phase": phase,
		"maps": maps,
		"terrain_grid": terrain_grid,
		"terrain_revision": terrain_revision,
		"terrain_undo_stack": terrain_undo_stack,
		"towers": towers,
		"relic_ids": relic_ids,
		"talent_ids": talent_ids,
		"reward_queue": reward_queue,
		"seed_streams": seed_streams.to_dict(),
		"deployment_counter": deployment_counter,
		"next_tower_number": next_tower_number,
		"pending_node": pending_node,
		"run_complete": run_complete,
		"victory": victory,
		"pressure_multiplier": pressure_multiplier,
		"tower_damage_bonus": tower_damage_bonus,
		"repair_discount": repair_discount,
		"stats": stats,
	}
	if include_snapshot:
		data["prebattle_snapshot"] = prebattle_snapshot
	return GameDefs.deep_copy(data)

static func from_dict(data: Dictionary) -> RunState:
	var run := RunState.new()
	for property_name in [
		"seed_text", "pressure_level", "spirit", "max_spirit", "focus", "base_bandwidth", "resistance",
		"depth", "experience", "act_index", "current_floor", "current_node_id", "phase", "maps", "terrain_grid", "terrain_revision", "terrain_undo_stack",
		"towers", "relic_ids", "talent_ids", "reward_queue", "deployment_counter", "next_tower_number",
		"pending_node", "prebattle_snapshot", "run_complete", "victory", "pressure_multiplier",
		"tower_damage_bonus", "repair_discount", "stats"
	]:
		if data.has(property_name):
			run.set(property_name, data[property_name])
	run.seed_streams = SeedStreams.from_dict(data.get("seed_streams", {"base_seed": run.seed_text, "cursors": {}}))
	return run

func _apply_pressure_rules() -> void:
	# Each level is visible in the new-run UI. These values are consumed by encounter and reward systems.
	if pressure_level >= 6:
		pressure_multiplier *= 1.15
	if pressure_level >= 7:
		focus = 89
	if pressure_level >= 10:
		pressure_multiplier *= 1.10

func _apply_branch_stats(instance: Dictionary, catalog: ContentCatalog) -> void:
	var tier := int(instance.get("tier", 1))
	var branch := str(instance.get("branch", ""))
	if tier <= 1 or branch.is_empty():
		return
	var definition: Dictionary = catalog.towers[str(instance["id"])]
	var branch_data: Dictionary = definition.get("branches", {}).get(branch, {})
	instance["max_durability"] = float(instance["max_durability"]) * float(branch_data.get("hp_mult", 1.0))
	instance["durability"] = instance["max_durability"]
	instance["attack"] = float(instance.get("attack", 0.0)) * float(branch_data.get("attack_mult", 1.0)) * _tier_attack_multiplier(tier)
	instance["branch_effect"] = str(branch_data.get("effect", ""))

func _tier_hp_multiplier(tier: int) -> float:
	return [0.0, 1.0, 1.35, 1.75][clampi(tier, 1, 3)]

func _tier_attack_multiplier(tier: int) -> float:
	return [0.0, 1.0, 1.32, 1.72][clampi(tier, 1, 3)]
