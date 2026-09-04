extends SceneTree

const DEFAULT_RUNS := 100
const MAX_NODES := 60
const MAX_BATTLE_STEPS := 12000

var catalog: ContentCatalog
var failures: Array[String] = []
var total_nodes := 0
var total_battles := 0

func _initialize() -> void:
	catalog = ContentCatalog.create_default()
	var configuration := requested_range()
	for offset in int(configuration["count"]):
		var seed_index := int(configuration["from"]) + offset
		var run := RunState.create_new("完整终局-%d" % seed_index, 0, catalog)
		var terminal := simulate_run(run)
		if not terminal:
			failures.append("种子%d在幕%d层%d未进入胜负结算" % [seed_index, run.act_index + 1, run.current_floor + 1])
	if failures.is_empty():
		print("FULL_RUN_TERMINALS_OK runs=%d nodes=%d battles=%d" % [configuration["count"], total_nodes, total_battles])
		quit(0)
	else:
		for failure in failures:
			printerr("FULL_RUN_FAILURE: %s" % failure)
		printerr("FULL_RUN_TERMINALS_FAILED failures=%d" % failures.size())
		quit(1)

func requested_range() -> Dictionary:
	var from := 0
	var count := DEFAULT_RUNS
	for argument in OS.get_cmdline_user_args():
		if argument.begins_with("--from=") and argument.trim_prefix("--from=").is_valid_int():
			from = argument.trim_prefix("--from=").to_int()
		elif argument.begins_with("--count=") and argument.trim_prefix("--count=").is_valid_int():
			count = maxi(1, argument.trim_prefix("--count=").to_int())
	return {"from":from, "count":count}

func simulate_run(run: RunState) -> bool:
	var node_guard := 0
	while not run.run_complete and node_guard < MAX_NODES:
		node_guard += 1
		var available := run.available_nodes()
		if available.is_empty():
			return false
		var choice_index := run.seed_streams.rng("terminal_route").randi_range(0, available.size() - 1)
		if not run.choose_node(str(available[choice_index]["id"])):
			return false
		total_nodes += 1
		var node_type := run.resolved_node_type(run.pending_node)
		if node_type in ["combat", "elite", "boss"]:
			# The terminal-liveness sweep intentionally submits no combat commands.
			# Its job is to prove that even the weakest legal run reaches a clean
			# defeat (or an unlikely victory) rather than stalling. The separate
			# reference suite proves 20 full three-act victories.
			var sim := BattleSimulation.new()
			sim.initialize(run, catalog, run.pending_node)
			var steps := 0
			while not sim.finished and steps < MAX_BATTLE_STEPS:
				sim.step(0.1)
				steps += 1
			total_battles += 1
			if not sim.finished:
				return false
			if sim.won:
				consume_first_rewards(run)
				run.complete_current_node()
		else:
			resolve_safe_node(run, node_type)
	return run.run_complete and run.phase == "settlement"

func consume_first_rewards(run: RunState) -> void:
	while not run.reward_queue.is_empty():
		var reward: Dictionary = run.reward_queue.pop_front()
		var choices: Array = reward.get("choices", [])
		var kind := str(reward.get("kind", ""))
		if kind == "talent" and choices.is_empty():
			choices = run.make_talent_choices(catalog)
		if choices.is_empty():
			continue
		var id := str(choices[0])
		if kind == "unit":
			run.add_tower(id, catalog)
		elif kind == "relic" and not run.relic_ids.has(id):
			run.relic_ids.append(id)
			run.refresh_owned_content(catalog)
		elif kind == "talent" and not run.talent_ids.has(id):
			run.talent_ids.append(id)
			run.refresh_owned_content(catalog)

func resolve_safe_node(run: RunState, node_type: String) -> void:
	match node_type:
		"camp":
			run.spirit = GameDefs.clamp_spirit(run.spirit + run.max_spirit * 0.30, run.max_spirit)
		"treasure":
			for raw_id in run.pending_node.get("relic_rewards", []):
				var id := str(raw_id)
				if not run.relic_ids.has(id):
					run.relic_ids.append(id)
					run.refresh_owned_content(catalog)
					break
		"event":
			var event: Dictionary = catalog.events.get(str(run.pending_node.get("event_id", "")), {})
			var choices: Array = event.get("choices", [])
			if not choices.is_empty():
				run.apply_event_effects(choices[0].get("effects", {}), catalog)
		"workshop":
			for tower in run.towers:
				var cost := RuleService.repair_cost(tower, run.repair_discount)
				if cost > 0 and run.focus >= cost:
					run.focus -= cost
					tower["durability"] = tower["max_durability"]
					break
	run.complete_current_node()
