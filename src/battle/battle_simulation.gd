class_name BattleSimulation
extends RefCounted

signal battle_event(payload: Dictionary)
signal battle_finished(won: bool, result: Dictionary)

var run: RunState
var catalog: ContentCatalog
var node: Dictionary
var planned: Array = []
var enemies: Array = []
var active_entries: Array[String] = []
var reinforcement_budget := 0
var reinforcements_used := 0
var spawn_interval := 1.15
var spawn_timer := 0.0
var elapsed := 0.0
var finished := false
var won := false
var jam_amount := 0
var jam_until := 0.0
var barrier_hp: Dictionary = {}
var encounter_xp := 0
var encounter_focus := 0
var result := {}
var _enemy_number := 1
var group_count := 3
var current_group_index := 0
var next_group_countdown := 0.0
var danger_level := 0.0
var group_preview: Array = []
var _group_transition_active := false
var _planned_total := 0

func initialize(run_state: RunState, content: ContentCatalog, battle_node: Dictionary) -> void:
	run = run_state
	catalog = content
	node = battle_node
	active_entries = _entries_for_progress()
	var node_type := run.resolved_node_type(node)
	group_count = 5 if node_type == "boss" else (4 if node_type == "elite" else 3)
	planned = _generate_encounter()
	_planned_total = planned.size()
	group_preview = _build_group_preview()
	reinforcement_budget = ceili(float(planned.size()) * GameDefs.REINFORCEMENT_RATIO)
	spawn_interval = maxf(0.48, 1.18 - float(run.act_index) * 0.14)
	result = {
		"node_id": str(node.get("id", "")),
		"planned": planned.size(),
		"reinforcement_budget": reinforcement_budget,
		"killed": 0,
		"breached": 0,
		"pressure_damage": 0.0,
		"breakthrough_damage": 0.0,
		"xp": 0,
		"focus": 0,
	}
	_recalculate_paths()
	_emit("battle_started", {"planned": planned.size(), "entries": active_entries, "reinforcement_budget": reinforcement_budget, "groups": group_preview})
	_emit("group_started", {"group_index": 0, "group_count": group_count, "preview": group_preview[0]})

func step(delta: float) -> void:
	if finished:
		return
	var bounded_delta := minf(delta, 0.1)
	elapsed += bounded_delta
	_update_group_spawning(bounded_delta)
	if elapsed >= jam_until:
		jam_amount = 0
	var effective := run.effective_bandwidth(_effective_jam())
	var overload := RuleService.apply_overload(run.towers, effective)
	if not overload["disabled"].is_empty():
		run.stats["overload_seconds"] = float(run.stats["overload_seconds"]) + bounded_delta
	_update_support(bounded_delta)
	_update_towers(bounded_delta)
	_update_enemies(bounded_delta)
	_update_danger(bounded_delta)
	if run.spirit <= 0.0:
		_finish(false)
	elif planned.is_empty() and enemies.is_empty():
		_finish(true)

func get_enemy_render_data() -> Array:
	var data: Array = []
	for enemy in enemies:
		if bool(enemy.get("alive", true)):
			data.append({
				"instance_id": enemy["instance_id"],
				"id": enemy["id"],
				"name": enemy["name"],
				"position": enemy["position"],
				"hp_ratio": float(enemy["hp"]) / maxf(1.0, float(enemy["max_hp"])),
				"air": bool(enemy.get("air", false)),
				"boss": bool(enemy.get("boss", false)),
				"elite": bool(enemy.get("elite", false)),
				"telegraph": str(enemy.get("telegraph", "")),
				"facing": float(enemy.get("facing", 0.0)),
				"height": TerrainGenerator.height_at(run.terrain_grid, Vector2i(roundi(Vector2(enemy["position"]).x), roundi(Vector2(enemy["position"]).y))),
			})
	return data

func _generate_encounter() -> Array:
	var act := run.act_index + 1
	var node_type := run.resolved_node_type(node)
	var ranges := [[16, 28], [24, 38], [32, 50]]
	var generator := run.seed_streams.rng_at("encounter_%s" % str(node.get("id", "")), 0)
	var count := generator.randi_range(ranges[act - 1][0], ranges[act - 1][1])
	if node_type == "elite":
		count = ceili(float(count) * 1.12)
	if node_type == "boss":
		# Boss pressure comes from the boss mechanic, not a swollen escort crowd.
		count = ceili(float(count) * 1.10)
	# Pressure 3 previews harder specialist vocabulary one act early without changing bosses.
	var pool_act := mini(3, act + 1) if run.pressure_level >= 3 else act
	var available := catalog.enemy_pool_for_act(pool_act, true)
	var current_specialists: Array[String] = []
	for id in available:
		if str(catalog.enemies[id].get("ability", "none")) != "none" and str(catalog.enemies[id].get("ability", "none")) != "air":
			current_specialists.append(id)
	var basic: Array[String] = []
	for id in available:
		if not current_specialists.has(id):
			basic.append(id)
	var specialist_ratio := 0.25 + float(act - 1) * 0.05
	if run.pressure_level >= 4:
		specialist_ratio += 0.08
	var queue: Array = []
	for index in count:
		var choose_special := float(index) / maxf(1.0, float(count - 1)) >= 0.20 and generator.randf() < specialist_ratio
		var pool := current_specialists if choose_special and not current_specialists.is_empty() else basic
		if pool.is_empty():
			pool = available
		var enemy_id := str(pool[generator.randi_range(0, pool.size() - 1)])
		var group_index := mini(group_count - 1, int(float(index) * float(group_count) / maxf(1.0, float(count))))
		queue.append({"id": enemy_id, "entry": active_entries[(index + group_index) % active_entries.size()], "kind": "normal", "group": group_index})
	if node_type == "elite":
		var elites := catalog.elite_pool_for_act(act)
		var elite_id := str(elites[generator.randi_range(0, elites.size() - 1)])
		queue.append({"id": elite_id, "entry": active_entries[(group_count - 2) % active_entries.size()], "kind": "elite", "group": group_count - 2})
	if node_type == "boss":
		queue.append({"id": str(node.get("boss_id", "noise_hive")), "entry": active_entries[3 % active_entries.size()], "kind": "boss", "group": 3})
	queue.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return int(a.get("group", 0)) < int(b.get("group", 0)))
	return queue

func _build_group_preview() -> Array:
	var previews: Array = []
	for group_index in group_count:
		previews.append({"index": group_index, "count": 0, "entries": [], "kinds": []})
	for item in planned:
		var group_index := clampi(int(item.get("group", 0)), 0, group_count - 1)
		var preview: Dictionary = previews[group_index]
		preview["count"] = int(preview["count"]) + 1
		var entry := str(item.get("entry", "north"))
		if not preview["entries"].has(entry):
			preview["entries"].append(entry)
		var kind := str(item.get("kind", "normal"))
		if not preview["kinds"].has(kind):
			preview["kinds"].append(kind)
	return previews

func _update_group_spawning(delta: float) -> void:
	if planned.is_empty():
		next_group_countdown = 0.0
		return
	var next_group := int(planned[0].get("group", 0))
	if next_group > current_group_index:
		if not _group_transition_active:
			_group_transition_active = true
			next_group_countdown = 4.0 + float((next_group + run.act_index) % 3)
			_emit("group_incoming", {"group_index": next_group, "countdown": next_group_countdown, "preview": group_preview[next_group]})
		next_group_countdown = maxf(0.0, next_group_countdown - delta)
		if next_group_countdown > 0.0:
			return
		current_group_index = next_group
		_group_transition_active = false
		_emit("group_started", {"group_index": current_group_index, "group_count": group_count, "preview": group_preview[current_group_index]})
	spawn_timer -= delta
	if spawn_timer <= 0.0 and not planned.is_empty() and int(planned[0].get("group", 0)) == current_group_index and enemies.size() < GameDefs.ACTIVE_ENEMY_CAP:
		_spawn_enemy(planned.pop_front())
		spawn_timer = spawn_interval

func _update_danger(delta: float) -> void:
	var target := clampf(float(enemies.size()) / maxf(12.0, float(_planned_total) * 0.55), 0.0, 0.55)
	for enemy in enemies:
		if bool(enemy.get("boss", false)):
			target += 0.28
		elif bool(enemy.get("elite", false)):
			target += 0.12
		var distance := Vector2(enemy.get("position", GameDefs.CORE_CENTER)).distance_to(GameDefs.CORE_CENTER)
		if distance < 8.0 * GameDefs.MICROGRID_SCALE:
			target += 0.008
	target += (1.0 - run.spirit / maxf(1.0, run.max_spirit)) * 0.30
	target = clampf(target, 0.0, 1.0)
	var duration := 1.5 if target > danger_level else 4.0
	danger_level = move_toward(danger_level, target, delta / duration)

func _entries_for_progress() -> Array[String]:
	var floor_index := int(node.get("floor", 0))
	if run.act_index == 0:
		if floor_index < 4:
			return ["north"]
		if floor_index < 10:
			var side := "west" if run.seed_streams.rng_at("entry_side", 0).randi_range(0, 1) == 0 else "east"
			return ["north", side]
		return ["north", "west", "east"]
	if run.act_index == 1:
		if floor_index < 7:
			return ["north", "west", "east"]
		return ["north", "west", "east", "south"]
	return ["north", "west", "east", "south"]

func _spawn_enemy(item: Dictionary, is_reinforcement: bool = false) -> void:
	if enemies.size() >= GameDefs.ACTIVE_ENEMY_CAP:
		return
	var id := str(item.get("id", ""))
	var kind := str(item.get("kind", "normal"))
	var definition: Dictionary
	if kind == "boss":
		definition = catalog.bosses.get(id, {}).duplicate(true)
	elif kind == "elite":
		definition = catalog.elites.get(id, {}).duplicate(true)
	else:
		definition = catalog.enemies.get(id, {}).duplicate(true)
	if definition.is_empty():
		return
	var hp_scale := 1.0
	var attack_scale := 1.0
	if run.pressure_level >= 1:
		hp_scale += 0.08
	if run.pressure_level >= 2:
		attack_scale += 0.10
	if run.pressure_level >= 10:
		hp_scale += 0.12
		attack_scale += 0.12
	var entry_name := str(item.get("entry", active_entries[0]))
	var entry: Vector2i = GameDefs.ENTRY_CELLS[entry_name]
	var enemy := definition
	var max_hp := float(definition.get("hp", 100.0)) * hp_scale
	enemy["max_hp"] = max_hp
	enemy["hp"] = max_hp
	enemy["attack"] = float(definition.get("attack", 10.0)) * attack_scale
	enemy["speed"] = float(definition.get("speed", 1.0)) * GameDefs.MICROGRID_SCALE
	enemy["instance_id"] = "E%05d" % _enemy_number
	_enemy_number += 1
	enemy["entry"] = entry_name
	enemy["position"] = Vector2(entry.x, entry.y)
	enemy["path"] = []
	enemy["path_index"] = 1
	enemy["alive"] = true
	enemy["attack_timer"] = 0.0
	enemy["ability_timer"] = 4.0 + float(_enemy_number % 4)
	enemy["slow"] = 0.0
	enemy["root"] = 0.0
	enemy["armor_debuff"] = 0.0
	enemy["at_core"] = false
	enemy["boss"] = kind == "boss"
	enemy["elite"] = kind == "elite"
	enemy["reinforcement"] = is_reinforcement
	enemy["facing"] = 0.0
	enemies.append(enemy)
	_assign_path(enemy)
	_emit("enemy_spawned", {"id": id, "enemy": definition.get("name", id), "name": definition.get("name", id), "entry": entry_name, "group_index": current_group_index, "boss": enemy["boss"], "elite": enemy["elite"]})

func _update_support(delta: float) -> void:
	for tower in run.towers:
		if not _tower_active(tower) or str(tower.get("role", "")) != "support":
			continue
		tower["cooldown"] = maxf(0.0, float(tower.get("cooldown", 0.0)) - delta)
		if str(tower.get("ability", "")) != "repair" or float(tower["cooldown"]) > 0.0:
			continue
		var origin := _tower_center(tower)
		var best: Dictionary = {}
		var best_missing := 0.0
		for ally in run.towers:
			if not bool(ally.get("deployed", false)) or float(ally.get("durability", 0.0)) <= 0.0:
				continue
			if origin.distance_to(_tower_center(ally)) > float(tower.get("range", 4.0)):
				continue
			var missing := float(ally.get("max_durability", 1.0)) - float(ally.get("durability", 0.0))
			if missing > best_missing:
				best_missing = missing
				best = ally
		if not best.is_empty():
			var repair_amount := float(tower.get("attack", 18.0))
			var effect := str(tower.get("branch_effect", ""))
			if effect == "critical_repair" and float(best["durability"]) / maxf(1.0, float(best["max_durability"])) < 0.40:
				repair_amount *= 1.65
			best["durability"] = minf(float(best["max_durability"]), float(best["durability"]) + repair_amount)
			if effect == "armor_repair":
				best["repair_armor_bonus"] = 4.0
				best["repair_armor_until"] = elapsed + 4.0
			tower["cooldown"] = float(tower.get("rate", 1.25))
			_emit("tower_repaired", {"source": tower["instance_id"], "target": best["instance_id"], "amount": repair_amount, "armor_bonus": best.get("repair_armor_bonus", 0.0)})

func _update_towers(delta: float) -> void:
	for tower in run.towers:
		if not _tower_active(tower) or str(tower.get("role", "")) == "support":
			continue
		if str(tower.get("branch_effect", "")) == "self_repair":
			tower["durability"] = minf(float(tower["max_durability"]), float(tower["durability"]) + 1.5 * delta)
		tower["cooldown"] = maxf(0.0, float(tower.get("cooldown", 0.0)) - delta)
		if float(tower["cooldown"]) > 0.0:
			continue
		var target := _select_target(tower)
		if target.is_empty():
			continue
		var attack := float(tower.get("attack", 0.0)) * (1.0 + run.tower_damage_bonus)
		var branch_effect := str(tower.get("branch_effect", ""))
		if bool(target.get("air", false)) and branch_effect == "anti_air":
			attack *= 1.75
		if branch_effect == "execute" and float(target.get("hp", 0.0)) / maxf(1.0, float(target.get("max_hp", 1.0))) <= 0.35:
			attack *= 1.60
		if branch_effect == "extra_drone":
			attack *= 1.45
		var tower_cell := _tower_origin(tower)
		var height := TerrainGenerator.height_at(run.terrain_grid, tower_cell)
		if height >= 2:
			attack *= 1.0 + run.relic_value("highground_damage")
			attack *= 1.0 + run.talent_value("height_bonus") * float(height)
		if bool(target.get("air", false)):
			attack *= 1.0 + run.relic_value("anti_air_damage")
		if float(target.get("hp", 0.0)) / maxf(1.0, float(target.get("max_hp", 1.0))) >= 0.70:
			attack *= 1.0 + run.talent_value("high_hp_damage")
		if run.spirit / run.max_spirit < 0.35:
			attack *= 1.0 + run.relic_value("low_spirit_damage")
			attack *= 1.0 + run.talent_value("crisis_range") * 0.5
		attack *= 1.0 + maxf(0.0, (run.max_spirit - run.spirit) / 10.0) * run.talent_value("lost_spirit_damage")
		var haste := _support_haste(tower)
		if haste > 0.0:
			attack *= 1.0 + haste * 0.5
		var armor := maxf(0.0, float(target.get("armor", 0.0)) - float(target.get("armor_debuff", 0.0)))
		var pierce := run.relic_value("ranged_pierce") if str(tower.get("role", "")) == "ranged" else 0.0
		if branch_effect == "pierce":
			pierce += 12.0
		var attack_solution := RuleService.solve_attack(tower, tower_cell, Vector2(target["position"]), 0, run.terrain_grid, {"pierce": pierce})
		attack *= float(attack_solution.get("height_damage_multiplier", 1.0))
		var damage := RuleService.damage_after_armor(attack, armor, pierce)
		_damage_enemy(target, damage, tower)
		_apply_tower_effect(tower, target, damage)
		var rate := float(tower.get("rate", 1.0))
		if haste > 0.0:
			rate *= 1.0 - haste - run.relic_value("support_rate")
		if height == 3:
			rate *= 1.0 - run.relic_value("height_rate")
		tower["cooldown"] = maxf(0.08, rate)
		_emit("tower_fired", {"tower": tower["instance_id"], "enemy": target["instance_id"], "damage": damage, "kind": tower.get("attack_kind", "direct")})

func _select_target(tower: Dictionary) -> Dictionary:
	var candidates: Array = []
	var tower_cell := _tower_origin(tower)
	var range_bonus := run.relic_value("direct_range")
	if str(tower.get("attack_kind", "direct")) != "direct":
		range_bonus += run.talent_value("indirect_radius")
	if run.spirit / run.max_spirit < 0.35:
		range_bonus += run.talent_value("crisis_range")
	for enemy in enemies:
		if not bool(enemy.get("alive", true)):
			continue
		var targets := str(tower.get("targets", "all"))
		if targets == "ground" and bool(enemy.get("air", false)):
			continue
		if targets == "air" and not bool(enemy.get("air", false)):
			continue
		var enemy_pos: Vector2 = enemy["position"]
		var solution := RuleService.solve_attack(tower, tower_cell, enemy_pos, 0, run.terrain_grid, {"range_mult": range_bonus})
		if not bool(solution.get("can_attack", false)):
			continue
		candidates.append(enemy)
	if candidates.is_empty():
		return {}
	var priority := str(tower.get("priority", "nearest"))
	candidates.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		if priority == "highest_hp":
			return float(a["hp"]) > float(b["hp"])
		var da := Vector2(a["position"]).distance_to(GameDefs.CORE_CENTER)
		var db := Vector2(b["position"]).distance_to(GameDefs.CORE_CENTER)
		if priority == "farthest":
			return da > db
		return da < db
	)
	return candidates[0]

func _apply_tower_effect(tower: Dictionary, target: Dictionary, damage: float) -> void:
	var effect := str(tower.get("branch_effect", ""))
	if effect.is_empty():
		effect = str(tower.get("ability", ""))
	if effect in ["armor_break", "corrosion"]:
		target["armor_debuff"] = minf(12.0, float(target.get("armor_debuff", 0.0)) + 1.5)
	if effect == "root" and not bool(target.get("boss", false)):
		target["root"] = maxf(float(target.get("root", 0.0)), 0.8)
	if effect in ["large_splash", "splash"]:
		var radius := 1.8 if effect == "large_splash" else 1.15
		for other in enemies.duplicate():
			if other != target and bool(other.get("alive", true)) and Vector2(other["position"]).distance_to(Vector2(target["position"])) <= radius:
				_damage_enemy(other, damage * 0.45, tower)
	if effect == "chain":
		var best: Dictionary = {}
		var best_distance := 2.6
		for other in enemies:
			if other == target or not bool(other.get("alive", true)):
				continue
			var distance := Vector2(other["position"]).distance_to(Vector2(target["position"]))
			if distance < best_distance:
				best_distance = distance
				best = other
		if not best.is_empty():
			_damage_enemy(best, damage * 0.55, tower)
	if effect in ["lifesteal", "lifesteal_plus"]:
		var ratio := 0.2 if effect == "lifesteal_plus" else 0.1
		tower["durability"] = minf(float(tower["max_durability"]), float(tower["durability"]) + damage * ratio)
	if effect == "mark":
		target["armor_debuff"] = minf(12.0, float(target.get("armor_debuff", 0.0)) + 2.5)

func _update_enemies(delta: float) -> void:
	for enemy in enemies.duplicate():
		if not bool(enemy.get("alive", true)):
			continue
		enemy["attack_timer"] = maxf(0.0, float(enemy.get("attack_timer", 0.0)) - delta)
		enemy["ability_timer"] = float(enemy.get("ability_timer", 0.0)) - delta
		enemy["root"] = maxf(0.0, float(enemy.get("root", 0.0)) - delta)
		enemy["slow"] = maxf(0.0, float(enemy.get("slow", 0.0)) - delta)
		if float(enemy["ability_timer"]) <= 0.0:
			if bool(enemy.get("ability_pending", false)):
				_execute_enemy_ability(enemy)
				enemy["ability_pending"] = false
				enemy["telegraph"] = ""
				enemy["ability_timer"] = 6.0 + float(_enemy_number % 4)
			else:
				_begin_enemy_ability(enemy)
		if bool(enemy.get("at_core", false)):
			if float(enemy["attack_timer"]) <= 0.0:
				_apply_breakthrough(enemy, false)
				enemy["attack_timer"] = 2.4 if bool(enemy.get("boss", false)) else 1.8
			continue
		if float(enemy.get("root", 0.0)) > 0.0:
			continue
		_move_enemy(enemy, delta)
	_cleanup_dead()

func _move_enemy(enemy: Dictionary, delta: float) -> void:
	if bool(enemy.get("air", false)):
		var position: Vector2 = enemy["position"]
		var direction := position.direction_to(GameDefs.CORE_CENTER)
		enemy["facing"] = atan2(direction.x, direction.y)
		var speed := float(enemy.get("speed", 1.0)) * (0.65 if float(enemy.get("slow", 0.0)) > 0.0 else 1.0)
		if _enemy_in_slow_aura(position):
			speed *= 0.78
		enemy["position"] = position + direction * speed * delta
		if Vector2(enemy["position"]).distance_to(GameDefs.CORE_CENTER) < 0.45:
			_reach_core(enemy)
		return
	var path: Array = enemy.get("path", [])
	var index := int(enemy.get("path_index", 1))
	if path.is_empty() or index >= path.size():
		_assign_path(enemy)
		path = enemy.get("path", [])
		index = int(enemy.get("path_index", 1))
		if path.is_empty() or index >= path.size():
			return
	var next_cell: Vector2i = path[index]
	var blocking_tower := _tower_at_cell(next_cell)
	if not blocking_tower.is_empty():
		if float(enemy["attack_timer"]) <= 0.0:
			_attack_tower(enemy, blocking_tower)
			enemy["attack_timer"] = 1.0
		return
	var position: Vector2 = enemy["position"]
	var current_cell := Vector2i(roundi(position.x), roundi(position.y))
	var edge := RuleService.path_edge_info(current_cell, next_cell, run.terrain_grid)
	if not bool(edge.get("passable", false)):
		if float(enemy["attack_timer"]) <= 0.0:
			_attack_barrier(enemy, Vector2i(int(edge["high_cell"][0]), int(edge["high_cell"][1])))
			enemy["attack_timer"] = 1.0
		return
	var target := Vector2(next_cell.x, next_cell.y)
	var facing_direction := position.direction_to(target)
	if facing_direction.length_squared() > 0.0:
		enemy["facing"] = atan2(facing_direction.x, facing_direction.y)
	var speed := float(enemy.get("speed", 1.0))
	if _enemy_in_slow_aura(position):
		speed *= 0.78
	if float(enemy.get("slow", 0.0)) > 0.0:
		speed *= 0.65
	var new_position := position.move_toward(target, speed * delta)
	enemy["position"] = new_position
	if new_position.distance_to(target) < 0.04:
		enemy["path_index"] = index + 1
		if GameDefs.is_core_cell(next_cell):
			_reach_core(enemy)

func _begin_enemy_ability(enemy: Dictionary) -> void:
	var ability := str(enemy.get("ability", "none"))
	if ability in ["none", "air", "armored", "sprint", "siege"]:
		enemy["ability_timer"] = 6.0 + float(_enemy_number % 4)
		return
	enemy["ability_pending"] = true
	enemy["telegraph"] = ability
	enemy["ability_timer"] = 0.65
	_emit("enemy_telegraph", {"enemy": enemy["name"], "ability": ability, "windup": 0.65})

func _execute_enemy_ability(enemy: Dictionary) -> void:
	var ability := str(enemy.get("ability", "none"))
	match ability:
		"heal":
			for ally in enemies:
				if bool(ally.get("alive", true)) and Vector2(ally["position"]).distance_to(Vector2(enemy["position"])) <= 3.0:
					ally["hp"] = minf(float(ally["max_hp"]), float(ally["hp"]) + float(ally["max_hp"]) * 0.08)
			_emit("enemy_ability", {"enemy": enemy["name"], "ability": "维修波"})
		"haste":
			for ally in enemies:
				if Vector2(ally["position"]).distance_to(Vector2(enemy["position"])) <= 3.0:
					ally["speed"] = float(ally.get("speed", 1.0)) * 1.06
			_emit("enemy_ability", {"enemy": enemy["name"], "ability": "加速脉冲"})
		"jam":
			jam_amount = 4 + run.pressure_level / 3 + (2 if run.pressure_level >= 8 else 0)
			jam_until = elapsed + 4.0
			_emit("bandwidth_jam", {"enemy": enemy["name"], "amount": jam_amount, "duration": 4.0})
		"teleport":
			var path: Array = enemy.get("path", [])
			var index := int(enemy.get("path_index", 1))
			if index + 2 < path.size():
				enemy["path_index"] = index + 2
				var cell: Vector2i = path[index + 1]
				enemy["position"] = Vector2(cell.x, cell.y)
			_emit("enemy_ability", {"enemy": enemy["name"], "ability": "相位迁跃"})
		"summon", "copy", "split":
			_attempt_reinforcement(enemy, ability)
		"group_shield":
			for ally in enemies:
				if ally != enemy and bool(ally.get("alive", true)) and Vector2(ally["position"]).distance_to(Vector2(enemy["position"])) <= 3.5:
					ally["hp"] = minf(float(ally["max_hp"]) * 1.15, float(ally["hp"]) + float(ally["max_hp"]) * 0.06)
			_emit("enemy_ability", {"enemy": enemy["name"], "ability": "群体护盾"})
		"shield":
			enemy["hp"] = minf(float(enemy["max_hp"]) * 1.15, float(enemy["hp"]) + float(enemy["max_hp"]) * 0.06)
			_emit("enemy_ability", {"enemy": enemy["name"], "ability": "自我护盾"})
		"corrode_resistance":
			run.resistance = maxf(0.0, run.resistance - 1.0)
			_emit("resistance_corroded", {"enemy": enemy["name"], "amount": 1})
		"tower_hunter":
			var target := _nearest_non_melee_tower(Vector2(enemy["position"]))
			if not target.is_empty() and Vector2(enemy["position"]).distance_to(_tower_center(target)) <= 6.0:
				_attack_tower(enemy, target)
		"pressure_aura":
			run.pressure_multiplier *= 1.015
			_emit("enemy_ability", {"enemy": enemy["name"], "ability": "压力咏唱"})
	if bool(enemy.get("boss", false)) and run.pressure_level >= 9:
		_pressure_boss_move(enemy)

func _pressure_boss_move(enemy: Dictionary) -> void:
	# The level-9 move is always telegraphed through a typed event and cannot bypass
	# the shared reinforcement cap. Its deterministic cycle keeps seeded runs stable.
	var move_index := int(elapsed / 6.0) % 3
	if move_index == 0:
		jam_amount = maxi(jam_amount, 5 + (2 if run.pressure_level >= 8 else 0))
		jam_until = maxf(jam_until, elapsed + 3.0)
		_emit("boss_phase", {"enemy": enemy["name"], "ability": "统御静默", "bandwidth": -jam_amount, "duration": 3.0})
	elif move_index == 1:
		enemy["hp"] = minf(float(enemy["max_hp"]) * 1.10, float(enemy["hp"]) + float(enemy["max_hp"]) * 0.035)
		_emit("boss_phase", {"enemy": enemy["name"], "ability": "协议护壳", "shield": "3.5%"})
	else:
		_attempt_reinforcement(enemy, "summon")
		_emit("boss_phase", {"enemy": enemy["name"], "ability": "征用回声", "budget": reinforcement_budget})

func _attempt_reinforcement(source: Dictionary, ability: String) -> void:
	if reinforcements_used >= reinforcement_budget or enemies.size() >= GameDefs.ACTIVE_ENEMY_CAP:
		_emit("reinforcement_blocked", {"source": source["name"], "budget": reinforcement_budget})
		return
	var pool := catalog.enemy_pool_for_act(run.act_index + 1, true)
	var id := str(source["id"]) if ability in ["copy", "split"] and catalog.enemies.has(str(source["id"])) else str(pool[run.seed_streams.rng("reinforcement").randi_range(0, pool.size() - 1)])
	_spawn_enemy({"id": id, "entry": source["entry"], "kind": "normal"}, true)
	reinforcements_used += 1
	_emit("reinforcement_spawned", {"source": source["name"], "used": reinforcements_used, "budget": reinforcement_budget})

func _attack_tower(enemy: Dictionary, tower: Dictionary) -> void:
	var cell := _tower_origin(tower)
	var height := TerrainGenerator.height_at(run.terrain_grid, cell)
	var pierce := 8.0 if str(enemy.get("ability", "")) in ["siege", "tower_hunter"] else 0.0
	var armor := float(tower.get("armor", 0.0)) + _defensive_armor_bonus(tower)
	if float(tower.get("repair_armor_until", 0.0)) > elapsed:
		armor += float(tower.get("repair_armor_bonus", 0.0))
	if str(tower.get("ability", "")) == "siege_resist" and str(enemy.get("ability", "")) == "siege":
		armor += 8.0
	var damage := RuleService.enemy_damage_to_tower(float(enemy["attack"]), armor, 0, height, pierce)
	if str(enemy.get("ability", "")) == "siege":
		damage *= 1.5
	tower["durability"] = maxf(0.0, float(tower["durability"]) - damage)
	if str(tower.get("branch_effect", "")) == "counter" and bool(enemy.get("alive", true)):
		_damage_enemy(enemy, maxf(1.0, float(tower.get("attack", 0.0)) * 0.45), tower)
	_emit("tower_damaged", {"tower": tower["instance_id"], "enemy": enemy["name"], "damage": damage})
	if float(tower["durability"]) <= 0.0:
		tower["disabled"] = true
		run.stats["towers_destroyed"] = int(run.stats["towers_destroyed"]) + 1
		_emit("tower_destroyed", {"tower": tower["instance_id"], "enemy": enemy["name"]})
		_recalculate_paths()

func _attack_barrier(enemy: Dictionary, cell: Vector2i) -> void:
	var key := GameDefs.cell_key(cell)
	if not barrier_hp.has(key):
		barrier_hp[key] = 45.0 + float(TerrainGenerator.height_at(run.terrain_grid, cell)) * 40.0
	var multiplier := 2.0 if str(enemy.get("ability", "")) == "siege" else 1.0
	barrier_hp[key] = float(barrier_hp[key]) - float(enemy["attack"]) * multiplier
	_emit("barrier_damaged", {"cell": [cell.x, cell.y], "enemy": enemy["name"], "remaining": maxf(0.0, float(barrier_hp[key]))})
	if float(barrier_hp[key]) <= 0.0:
		var terrain_cell: Dictionary = run.terrain_grid[cell.y][cell.x]
		terrain_cell["height"] = maxi(0, int(terrain_cell.get("height", 0)) - 1)
		terrain_cell["slope"] = ""
		run.terrain_revision += 1
		barrier_hp.erase(key)
		_emit("barrier_broken", {"cell": [cell.x, cell.y], "new_height": terrain_cell["height"]})
		_recalculate_paths()

func _damage_enemy(enemy: Dictionary, amount: float, tower: Dictionary) -> void:
	if not bool(enemy.get("alive", true)):
		return
	enemy["hp"] = float(enemy["hp"]) - amount
	tower["damage_done"] = float(tower.get("damage_done", 0.0)) + amount
	run.stats["damage_by_tower"][str(tower["instance_id"])] = float(run.stats["damage_by_tower"].get(str(tower["instance_id"]), 0.0)) + amount
	if float(enemy["hp"]) <= 0.0:
		_kill_enemy(enemy, tower)

func _kill_enemy(enemy: Dictionary, tower: Dictionary) -> void:
	if not bool(enemy.get("alive", true)):
		return
	enemy["alive"] = false
	tower["kills"] = int(tower.get("kills", 0)) + 1
	result["killed"] = int(result["killed"]) + 1
	run.stats["enemies_killed"] = int(run.stats["enemies_killed"]) + 1
	if bool(enemy.get("elite", false)):
		run.stats["elites_killed"] = int(run.stats["elites_killed"]) + 1
	encounter_xp += int(enemy.get("xp", 0))
	encounter_focus += int(enemy.get("focus", 0))
	var distance := Vector2(enemy["position"]).distance_to(GameDefs.CORE_CENTER)
	var pressure_multiplier := run.pressure_multiplier
	if _pressure_filtered(Vector2(enemy["position"])):
		pressure_multiplier *= 0.72
	if distance >= 12.0:
		pressure_multiplier *= 1.0 - run.relic_value("far_pressure")
	if distance >= 10.0:
		pressure_multiplier *= 1.0 - run.talent_value("distance_pressure") * (distance - 10.0)
	var pressure := RuleService.death_pressure(float(enemy.get("pressure", 0.0)), distance, run.effective_resistance(), maxf(0.1, pressure_multiplier))
	_apply_spirit_damage(float(pressure["damage"]), "pressure")
	result["pressure_damage"] = float(result["pressure_damage"]) + float(pressure["damage"])
	_emit("enemy_killed", {"enemy": enemy["name"], "tower": tower["instance_id"], "pressure": pressure})
	if bool(enemy.get("boss", false)):
		var restore_ratio := 0.35 if run.act_index >= 2 else 0.20
		var restored := run.max_spirit * restore_ratio
		run.spirit = GameDefs.clamp_spirit(run.spirit + restored, run.max_spirit)
		_emit("boss_signal_cut", {"boss": enemy["name"], "restored": restored})
	if str(enemy.get("ability", "")) == "explode":
		for ally in enemies:
			if ally != enemy and bool(ally.get("alive", true)) and Vector2(ally["position"]).distance_to(Vector2(enemy["position"])) <= 1.8:
				ally["hp"] = float(ally["hp"]) - float(enemy.get("attack", 10.0))
	if str(enemy.get("ability", "")) == "split":
		_attempt_reinforcement(enemy, "split")

func _reach_core(enemy: Dictionary) -> void:
	if bool(enemy.get("boss", false)) or bool(enemy.get("elite", false)):
		enemy["at_core"] = true
		enemy["position"] = GameDefs.CORE_CENTER
		_apply_breakthrough(enemy, false)
		enemy["attack_timer"] = 2.4 if bool(enemy.get("boss", false)) else 1.8
	else:
		_apply_breakthrough(enemy, true)

func _apply_breakthrough(enemy: Dictionary, leave_after: bool) -> void:
	var damage := float(enemy.get("core_damage", 5.0))
	_apply_spirit_damage(damage, "breakthrough")
	result["breakthrough_damage"] = float(result["breakthrough_damage"]) + damage
	run.stats["enemies_breached"] = int(run.stats["enemies_breached"]) + 1
	result["breached"] = int(result["breached"]) + 1
	_emit("enemy_breached", {"enemy": enemy["name"], "damage": damage, "persistent": not leave_after})
	if leave_after:
		enemy["alive"] = false

func _apply_spirit_damage(amount: float, source: String) -> void:
	if amount <= 0.0:
		return
	run.spirit = maxf(0.0, run.spirit - amount)
	if source == "pressure":
		run.stats["spirit_death_pressure"] = float(run.stats["spirit_death_pressure"]) + amount
	else:
		run.stats["spirit_breakthrough"] = float(run.stats["spirit_breakthrough"]) + amount

func _finish(success: bool) -> void:
	if finished:
		return
	finished = true
	won = success
	if success:
		var node_type := run.resolved_node_type(node)
		var act_data: Dictionary = catalog.acts[GameDefs.ACT_IDS[run.act_index]]
		var base_focus := int(act_data["elite_focus"] if node_type == "elite" else act_data["normal_focus"])
		if node_type == "boss":
			base_focus = 100
		run.focus += base_focus + encounter_focus
		result["focus"] = base_focus + encounter_focus
		var restore := 12.0 if node_type == "elite" else 8.0
		if node_type == "boss":
			restore = 0.0
		run.spirit = GameDefs.clamp_spirit(run.spirit + restore, run.max_spirit)
		var levels := run.add_experience(encounter_xp)
		result["xp"] = encounter_xp
		result["levels"] = levels
		run.queue_combat_rewards(node, levels)
		run.stats["battles_won"] = int(run.stats["battles_won"]) + 1
		_post_battle_repair()
	else:
		run.end_failure()
	battle_finished.emit(success, result)
	_emit("battle_finished", {"won": success, "result": result})

func _post_battle_repair() -> void:
	var ratio := run.relic_value("post_repair")
	if ratio <= 0.0:
		return
	var best: Dictionary = {}
	var missing := 0.0
	for tower in run.towers:
		var tower_missing := float(tower.get("max_durability", 1.0)) - float(tower.get("durability", 0.0))
		if tower_missing > missing:
			missing = tower_missing
			best = tower
	if not best.is_empty():
		best["durability"] = minf(float(best["max_durability"]), float(best["durability"]) + float(best["max_durability"]) * ratio)
	var melee_ratio := run.talent_value("melee_post_repair")
	if melee_ratio > 0.0:
		for tower in run.towers:
			if str(tower.get("role", "")) == "melee" and float(tower.get("durability", 0.0)) > 0.0:
				tower["durability"] = minf(float(tower["max_durability"]), float(tower["durability"]) + float(tower["max_durability"]) * melee_ratio)

func _assign_path(enemy: Dictionary) -> void:
	if bool(enemy.get("air", false)):
		return
	var entry_name := str(enemy.get("entry", "north"))
	var start := Vector2i(roundi(Vector2(enemy["position"]).x), roundi(Vector2(enemy["position"]).y))
	if start.x < 0 or start.y < 0 or start.x >= GameDefs.BOARD_SIZE or start.y >= GameDefs.BOARD_SIZE:
		start = GameDefs.ENTRY_CELLS[entry_name]
	var path := RuleService.path_to_core(start, run.terrain_grid, run.towers)
	enemy["path"] = path
	enemy["path_index"] = 1 if path.size() > 1 else 0

func _recalculate_paths() -> void:
	for enemy in enemies:
		if bool(enemy.get("alive", true)) and not bool(enemy.get("air", false)) and not bool(enemy.get("at_core", false)):
			_assign_path(enemy)

func _cleanup_dead() -> void:
	for i in range(enemies.size() - 1, -1, -1):
		if not bool(enemies[i].get("alive", true)):
			enemies.remove_at(i)

func _tower_at_cell(cell: Vector2i) -> Dictionary:
	var occupied := RuleService.occupied_cells(run.towers)
	var instance_id := str(occupied.get(GameDefs.cell_key(cell), ""))
	return run.get_tower(instance_id) if not instance_id.is_empty() else {}

func _nearest_non_melee_tower(position: Vector2) -> Dictionary:
	var best: Dictionary = {}
	var best_distance := INF
	for tower in run.towers:
		if not _tower_active(tower) or str(tower.get("role", "")) == "melee":
			continue
		var distance := position.distance_to(_tower_center(tower))
		if distance < best_distance:
			best_distance = distance
			best = tower
	return best

func _tower_active(tower: Dictionary) -> bool:
	return bool(tower.get("deployed", false)) and float(tower.get("durability", 0.0)) > 0.0 and not bool(tower.get("disabled", false))

func _has_support_aura(tower: Dictionary, ability: String) -> bool:
	var center := _tower_center(tower)
	for support in run.towers:
		if _tower_active(support) and str(support.get("ability", "")) == ability and center.distance_to(_tower_center(support)) <= float(support.get("range", 4.0)):
			return true
	return false

func _support_haste(tower: Dictionary) -> float:
	var center := _tower_center(tower)
	var strongest := 0.0
	for support in run.towers:
		if not _tower_active(support) or str(support.get("ability", "")) != "haste_aura":
			continue
		if center.distance_to(_tower_center(support)) > float(support.get("range", 4.0)):
			continue
		var value := float(support.get("support_value", 0.12))
		if str(support.get("branch_effect", "")) == "strong_haste":
			value += 0.10
		strongest = maxf(strongest, value)
	return strongest

func _enemy_in_slow_aura(position: Vector2) -> bool:
	for support in run.towers:
		if _tower_active(support) and str(support.get("branch_effect", "")) == "slow_aura" and position.distance_to(_tower_center(support)) <= float(support.get("range", 4.0)):
			return true
	return false

func _defensive_armor_bonus(tower: Dictionary) -> float:
	var bonus := 6.0 if str(tower.get("branch_effect", "")) == "guard" else 0.0
	var center := _tower_center(tower)
	for guard in run.towers:
		if not _tower_active(guard) or str(guard.get("ability", "")) != "ally_shield":
			continue
		var wide := str(guard.get("branch_effect", "")) == "wide_shield"
		var radius := 4.0 if wide else 2.5
		if center.distance_to(_tower_center(guard)) <= radius:
			bonus = maxf(bonus, 6.0 if wide else 4.0)
	return bonus

func _pressure_filtered(position: Vector2) -> bool:
	for tower in run.towers:
		if not _tower_active(tower):
			continue
		var effect := str(tower.get("branch_effect", ""))
		if effect not in ["pressure_sink", "pressure_filter"]:
			continue
		var radius := float(tower.get("range", 4.0)) + (1.5 if effect == "pressure_filter" else 0.0)
		if position.distance_to(_tower_center(tower)) <= radius:
			return true
	return false

func _effective_jam() -> int:
	var reduction := 0
	for tower in run.towers:
		if _tower_active(tower) and str(tower.get("branch_effect", "")) == "jam_resist":
			reduction += 2
	return maxi(0, jam_amount - reduction)

func _tower_origin(tower: Dictionary) -> Vector2i:
	var cell: Array = tower.get("cell", [-1, -1])
	return Vector2i(int(cell[0]), int(cell[1]))

func _tower_center(tower: Dictionary) -> Vector2:
	var origin := _tower_origin(tower)
	var footprint: Array = tower.get("footprint", [1, 1])
	return Vector2(float(origin.x) + (float(footprint[0]) - 1.0) * 0.5, float(origin.y) + (float(footprint[1]) - 1.0) * 0.5)

func _emit(kind: String, data: Dictionary) -> void:
	var payload := data.duplicate(true)
	payload["kind"] = kind
	payload["time"] = elapsed
	battle_event.emit(payload)
