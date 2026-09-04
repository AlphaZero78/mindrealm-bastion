extends SceneTree

const SEED_IDS := [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]
const MAX_BATTLE_STEPS := 12000

var catalog: ContentCatalog
var failures: Array[String] = []
var total_battles := 0

func _initialize() -> void:
	catalog = ContentCatalog.create_default()
	var requested_seeds := selected_seeds()
	for seed_index in requested_seeds:
		var battles_before := total_battles
		var run := RunState.create_new("参考策略-%d" % seed_index, 0, catalog)
		var terminal := play_run(run)
		print("REFERENCE_SEED seed=%d terminal=%s victory=%s battles=%d" % [seed_index, terminal, run.victory, total_battles - battles_before])
		if not terminal or not run.victory:
			var deployed := run.towers.filter(func(tower: Dictionary) -> bool: return bool(tower.get("deployed", false))).size()
			var formation: Array[String] = []
			for tower in run.towers:
				if bool(tower.get("deployed", false)):
					formation.append("%s:%s@%s" % [tower["instance_id"], tower["role"], str(tower["cell"])])
			failures.append("参考种子%d未通关：幕%d层%d，精神%.1f，部署%d/%d，专注%d，突破伤害%.1f，压力伤害%.1f，摧毁%d，首领%s，输出%s，阵型%s" % [seed_index, run.act_index + 1, run.current_floor + 1, run.spirit, deployed, run.towers.size(), run.focus, run.stats["spirit_breakthrough"], run.stats["spirit_death_pressure"], run.stats["towers_destroyed"], run.current_act().get("boss_id", ""), str(run.stats["damage_by_tower"]), ";".join(formation)])
	if failures.is_empty():
		print("REFERENCE_RUNS_OK runs=%d battles=%d" % [requested_seeds.size(), total_battles])
		quit(0)
	else:
		for failure in failures:
			printerr("REFERENCE_FAILURE: %s" % failure)
		printerr("REFERENCE_RUNS_FAILED failures=%d battles=%d" % [failures.size(), total_battles])
		quit(1)

func selected_seeds() -> Array[int]:
	var result: Array[int] = []
	for argument in OS.get_cmdline_user_args():
		if argument.begins_with("--seed="):
			var value := argument.trim_prefix("--seed=")
			if value.is_valid_int():
				result.append(value.to_int())
	if result.is_empty():
		for seed_index in SEED_IDS:
			result.append(seed_index)
	return result

func play_run(run: RunState) -> bool:
	var node_guard := 0
	while not run.run_complete and node_guard < 60:
		node_guard += 1
		var next := choose_best_node(run.available_nodes(), run)
		if next.is_empty() or not run.choose_node(str(next["id"])):
			return false
		var type_id := run.resolved_node_type(next)
		if type_id in ["combat", "elite", "boss"]:
			prepare_defense(run)
			var sim := BattleSimulation.new()
			sim.initialize(run, catalog, next)
			var steps := 0
			while not sim.finished and steps < MAX_BATTLE_STEPS:
				sim.step(0.1)
				steps += 1
			total_battles += 1
			if not sim.finished:
				return false
			if not sim.won:
				return true
			consume_rewards(run)
			run.complete_current_node()
		else:
			resolve_safe_node(run, type_id)
	if not run.run_complete:
		return false
	return true

func choose_best_node(nodes: Array, run: RunState) -> Dictionary:
	if nodes.is_empty():
		return {}
	var best: Dictionary = nodes[0]
	var best_score := -999
	for node in nodes:
		var type_id := run.resolved_node_type(node)
		# A viable standard build must deliberately earn units and depth. Safe
		# services are valuable when they solve a current problem, not by default.
		var score: int = int({"camp":30, "treasure":92, "workshop":54, "event":62, "shop":56, "unknown":50, "combat":76, "elite":42, "boss":100}.get(type_id, 0))
		if type_id == "camp" and run.spirit < run.max_spirit * 0.70:
			score += 110
		if type_id == "workshop" and run.towers.any(func(tower: Dictionary) -> bool: return float(tower.get("durability", 0.0)) < float(tower.get("max_durability", 1.0)) * 0.75):
			score += 55
		if type_id == "shop" and run.focus >= 120:
			score += 25
		if type_id == "elite" and run.spirit >= run.max_spirit * 0.82:
			score += 46
		if score > best_score:
			best_score = score
			best = node
	return best

func prepare_defense(run: RunState) -> void:
	# The reference policy spends real focus on repairs and branch upgrades.
	for tower in run.towers:
		var cost := RuleService.repair_cost(tower, run.repair_discount)
		if cost > 0 and run.focus >= cost:
			run.focus -= cost
			tower["durability"] = tower["max_durability"]
			tower["deployed"] = false
			tower["cell"] = [-1, -1]
	var upgrade_candidates := run.towers.duplicate()
	upgrade_candidates.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		var score_a := float(a.get("attack", 0.0)) / maxf(0.1, float(a.get("rate", 1.0)))
		var score_b := float(b.get("attack", 0.0)) / maxf(0.1, float(b.get("rate", 1.0)))
		return score_a > score_b
	)
	for tower in upgrade_candidates:
		if int(tower.get("tier", 1)) >= 3:
			continue
		var branch := str(tower.get("branch", ""))
		if branch.is_empty():
			branch = preferred_branch(str(tower.get("id", "")))
		run.upgrade_tower(str(tower["instance_id"]), branch, catalog)
	deploy_best_formation(run)

func deploy_best_formation(run: RunState) -> void:
	for tower in run.towers:
		tower["deployed"] = false
		tower["disabled"] = false
		tower["cell"] = [-1, -1]
	var ranked := run.towers.duplicate()
	ranked.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		var anti_air_a := 700.0 if str(a.get("targets", "")) == "all" else 0.0
		var anti_air_b := 700.0 if str(b.get("targets", "")) == "all" else 0.0
		var score_a := anti_air_a + float(a.get("tier", 1)) * 500.0 + float(a.get("attack", 0.0)) / maxf(0.1, float(a.get("rate", 1.0)))
		var score_b := anti_air_b + float(b.get("tier", 1)) * 500.0 + float(b.get("attack", 0.0)) / maxf(0.1, float(b.get("rate", 1.0)))
		return score_a > score_b
	)
	var relays: Array = []
	var ranged: Array = []
	var melee: Array = []
	var support: Array = []
	for tower in ranked:
		if str(tower.get("ability", "")) == "bandwidth_plus":
			relays.append(tower)
		elif str(tower.get("role", "")) == "ranged":
			ranged.append(tower)
		elif str(tower.get("role", "")) == "melee":
			melee.append(tower)
		else:
			support.append(tower)
	var ordered: Array = []
	ordered.append_array(relays)
	# Preserve lane blockers and anti-air before spending remaining bandwidth on duplicates.
	for index in 2:
		if index < ranged.size():
			ordered.append(ranged[index])
		if index < melee.size():
			ordered.append(melee[index])
	for index in range(2, maxi(ranged.size(), melee.size())):
		if index < ranged.size():
			ordered.append(ranged[index])
		if index < melee.size():
			ordered.append(melee[index])
	ordered.append_array(support)
	for tower in ordered:
		if float(tower.get("durability", 0.0)) <= 0.0:
			continue
		var cell := find_legal_cell(tower, run)
		if cell.x < 0:
			continue
		tower["deployed"] = true
		tower["ever_deployed"] = true
		tower["cell"] = [cell.x, cell.y]
		run.deployment_counter += 1
		tower["deployment_order"] = run.deployment_counter

func find_legal_cell(tower: Dictionary, run: RunState) -> Vector2i:
	var candidates: Array[Vector2i] = []
	for y in GameDefs.BOARD_SIZE:
		for x in GameDefs.BOARD_SIZE:
			var cell := Vector2i(x, y)
			if RuleService.deployment_error(tower, cell, run.terrain_grid, run.towers, run.deployed_bandwidth(), run.effective_bandwidth(), str(tower.get("instance_id", ""))).is_empty():
				candidates.append(cell)
	if candidates.is_empty():
		return Vector2i(-1, -1)
	candidates.sort_custom(func(a: Vector2i, b: Vector2i) -> bool:
		var target_a := position_score(a, tower, run)
		var target_b := position_score(b, tower, run)
		return target_a > target_b
	)
	return candidates[0]

func position_score(cell: Vector2i, tower: Dictionary, run: RunState) -> float:
	var role := str(tower.get("role", ""))
	if role == "support":
		return 80.0 - Vector2(cell).distance_to(micro_position(Vector2(12, 13))) * 4.0
	var active_entries := entry_targets(run, role == "melee")
	var role_index := 0
	for other in run.towers:
		if bool(other.get("deployed", false)) and str(other.get("role", "")) == role:
			role_index += 1
	var target: Vector2 = active_entries[role_index % active_entries.size()]
	var boss_id := str(run.pending_node.get("boss_id", ""))
	# Zero-frequency survives at the core and keeps attacking. Concentrate six
	# ranged constructs there while preserving at least one ranged lane anchor.
	var boss_central := run.resolved_node_type(run.pending_node) == "boss" and (boss_id != "zero_frequency_mind" or role_index < 6)
	if role == "ranged" and (boss_central or role_index < run.act_index + 1):
		target = micro_position(Vector2(12, 14))
	if role == "melee":
		return 120.0 - Vector2(cell).distance_to(target) * 9.0
	var height := TerrainGenerator.height_at(run.terrain_grid, cell)
	var los_bonus := 0.0
	if str(tower.get("attack_kind", "direct")) != "direct" or RuleService.has_line_of_sight(cell, target, run.terrain_grid, height):
		los_bonus = 200.0
	return los_bonus + float(height) * 8.0 - Vector2(cell).distance_to(target) * 7.0 + Vector2(cell).distance_to(GameDefs.CORE_CENTER)

func entry_targets(run: RunState, melee: bool) -> Array[Vector2]:
	var near := 8.0 if melee else 5.0
	var far := 16.0 if melee else 19.0
	var result: Array[Vector2] = [micro_position(Vector2(12, near))]
	if run.act_index == 0 and run.current_floor >= 4:
		var side_is_west := run.seed_streams.rng_at("entry_side", 0).randi_range(0, 1) == 0
		result.append(micro_position(Vector2(near, 12) if side_is_west else Vector2(far, 12)))
	if run.act_index == 0 and run.current_floor >= 10:
		if not result.has(micro_position(Vector2(near, 12))):
			result.append(micro_position(Vector2(near, 12)))
		if not result.has(micro_position(Vector2(far, 12))):
			result.append(micro_position(Vector2(far, 12)))
	if run.act_index == 1:
		result = [micro_position(Vector2(12, near)), micro_position(Vector2(near, 12)), micro_position(Vector2(far, 12))]
		if run.current_floor >= 7:
			result.append(micro_position(Vector2(12, far)))
	if run.act_index >= 2:
		result = [micro_position(Vector2(12, near)), micro_position(Vector2(near, 12)), micro_position(Vector2(far, 12)), micro_position(Vector2(12, far))]
	return result

func micro_position(legacy_position: Vector2) -> Vector2:
	return legacy_position * GameDefs.MICROGRID_SCALE

func consume_rewards(run: RunState) -> void:
	while not run.reward_queue.is_empty():
		var reward: Dictionary = run.reward_queue.pop_front()
		var kind := str(reward.get("kind", ""))
		var choices: Array = reward.get("choices", [])
		if kind == "talent" and choices.is_empty():
			choices = run.make_talent_choices(catalog)
		if choices.is_empty():
			continue
		var id := str(choices[0])
		if kind == "unit":
			id = best_unit_reward(choices)
			run.add_tower(id, catalog)
		elif kind == "relic" and not run.relic_ids.has(id):
			id = best_progression_reward(choices, catalog.relics)
			run.relic_ids.append(id)
			run.refresh_owned_content(catalog)
		elif kind == "talent" and not run.talent_ids.has(id):
			id = best_progression_reward(choices, catalog.talents)
			run.talent_ids.append(id)
			run.refresh_owned_content(catalog)

func best_unit_reward(choices: Array) -> String:
	var best := str(choices[0])
	var best_score := -1.0
	for raw_id in choices:
		var id := str(raw_id)
		var tower: Dictionary = catalog.towers[id]
		var score := float(tower.get("attack", 0.0)) / maxf(0.1, float(tower.get("rate", 1.0)))
		if str(tower.get("targets", "")) == "all":
			score += 100.0
		if str(tower.get("role", "")) == "support" and str(tower.get("ability", "")) == "bandwidth_plus":
			score += 80.0
		if score > best_score:
			best_score = score
			best = id
	return best

func best_progression_reward(choices: Array, source: Dictionary) -> String:
	var best := str(choices[0])
	var best_score := -1.0
	var priorities := {
		"bandwidth": 120.0, "level_bandwidth": 115.0, "t1_bandwidth": 105.0,
		"anti_air_damage": 100.0, "ranged_pierce": 95.0, "highground_damage": 90.0,
		"height_bonus": 90.0, "high_hp_damage": 85.0, "direct_range": 75.0,
		"resistance": 80.0, "far_pressure": 75.0, "distance_pressure": 72.0,
		"post_repair": 65.0, "melee_post_repair": 65.0, "repair_discount": 60.0,
		"support_rate": 55.0, "height_rate": 55.0, "low_spirit_damage": 50.0,
	}
	for raw_id in choices:
		var id := str(raw_id)
		var data: Dictionary = source[id]
		var score := float(priorities.get(str(data.get("effect", "")), 25.0))
		if score > best_score:
			best_score = score
			best = id
	return best

func resolve_safe_node(run: RunState, type_id: String) -> void:
	match type_id:
		"camp":
			run.spirit = GameDefs.clamp_spirit(run.spirit + run.max_spirit * 0.30, run.max_spirit)
		"workshop":
			for tower in run.towers:
				var cost := RuleService.repair_cost(tower, run.repair_discount)
				if cost > 0 and run.focus >= cost:
					run.focus -= cost
					tower["durability"] = tower["max_durability"]
		"shop":
			for id in run.pending_node.get("shop_relics", []):
				if run.focus >= 120 and not run.relic_ids.has(str(id)):
					run.focus -= 120
					run.relic_ids.append(str(id))
					run.refresh_owned_content(catalog)
					break
		"treasure":
			for id in run.pending_node.get("relic_rewards", []):
				if not run.relic_ids.has(str(id)):
					run.relic_ids.append(str(id))
					run.refresh_owned_content(catalog)
					break
		"event":
			var event: Dictionary = catalog.events.get(str(run.pending_node.get("event_id", "")), {})
			if not event.is_empty():
				var choices: Array = event.get("choices", [])
				var index := safest_event_choice(choices)
				if index >= 0:
					run.apply_event_effects(choices[index].get("effects", {}), catalog)
	run.complete_current_node()

func safest_event_choice(choices: Array) -> int:
	var best := -1
	var best_score := -99999.0
	for i in choices.size():
		var effects: Dictionary = choices[i].get("effects", {})
		var score := float(effects.get("spirit", 0.0)) * 5.0 + float(effects.get("bandwidth", 0.0)) * 12.0 + float(effects.get("resistance", 0.0)) * 10.0 + float(effects.get("focus", 0.0)) * 0.25
		if effects.has("relic"):
			score += 35.0
		if effects.has("free_upgrade") or effects.has("free_upgrades"):
			score += 45.0
		if effects.has("tower_damage") or effects.has("pressure_mult"):
			score -= 35.0
		if score > best_score:
			best_score = score
			best = i
	return best

func preferred_branch(tower_id: String) -> String:
	return "B" if tower_id in ["pulse_array", "focus_rail", "arc_mortar", "bandwidth_relay", "frequency_choir"] else "A"
