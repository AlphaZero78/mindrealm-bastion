extends SceneTree

func _initialize() -> void:
	var catalog := ContentCatalog.create_default()
	var run := RunState.create_new("压力基准-100", 10, catalog)
	run.act_index = 2
	run.spirit = 100000.0
	run.max_spirit = 100000.0
	run.base_bandwidth = 999
	for index in 28:
		var ids := catalog.towers.keys()
		run.add_tower(str(ids[index % ids.size()]), catalog, 3, "A" if index % 2 == 0 else "B")
	_auto_deploy(run)
	var node: Dictionary = run.maps[2]["floors"][-1][0]
	var sim := BattleSimulation.new()
	sim.initialize(run, catalog, node)
	sim.planned.clear()
	var enemy_ids := catalog.enemy_pool_for_act(3, true)
	for index in GameDefs.ACTIVE_ENEMY_CAP:
		sim._spawn_enemy({
			"id": str(enemy_ids[index % enemy_ids.size()]),
			"entry": ["north", "west", "east", "south"][index % 4],
			"kind": "normal",
		})
	if sim.enemies.size() != GameDefs.ACTIVE_ENEMY_CAP:
		push_error("压力测试未建立100个活动敌人：%d" % sim.enemies.size())
		quit(1)
		return
	var started := Time.get_ticks_usec()
	for _step in 240:
		sim.step(0.05)
	var elapsed_ms := float(Time.get_ticks_usec() - started) / 1000.0
	var average_ms := elapsed_ms / 240.0
	if average_ms >= 50.0:
		push_error("固定步长模拟超过20Hz预算：%.3f ms/step" % average_ms)
		quit(1)
		return
	if sim.reinforcements_used > sim.reinforcement_budget or sim.enemies.size() > GameDefs.ACTIVE_ENEMY_CAP:
		push_error("压力测试中敌人或增援突破上限")
		quit(1)
		return
	print("STRESS_TEST_OK initial_enemies=100 towers=%d avg_step_ms=%.3f" % [run.towers.filter(func(tower: Dictionary) -> bool: return bool(tower.get("deployed", false))).size(), average_ms])
	quit(0)

func _auto_deploy(run: RunState) -> void:
	for tower in run.towers:
		for y in GameDefs.BOARD_SIZE:
			var placed := false
			for x in GameDefs.BOARD_SIZE:
				var cell := Vector2i(x, y)
				var error := RuleService.deployment_error(tower, cell, run.terrain_grid, run.towers, run.deployed_bandwidth(), run.effective_bandwidth(), str(tower["instance_id"]))
				if error.is_empty():
					tower["deployed"] = true
					tower["ever_deployed"] = true
					tower["cell"] = [x, y]
					run.deployment_counter += 1
					tower["deployment_order"] = run.deployment_counter
					placed = true
					break
			if placed:
				break
