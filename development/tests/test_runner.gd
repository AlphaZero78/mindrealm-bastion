extends SceneTree

var checks := 0
var failures: Array[String] = []
var catalog: ContentCatalog

func _initialize() -> void:
	catalog = ContentCatalog.create_default()
	test_catalog()
	test_seed_reproduction()
	test_maps_1000_seeds()
	test_terrain_and_paths()
	test_deployment_rules()
	test_los_and_combat_math()
	test_enemy_groups_and_danger()
	test_camera_controls()
	test_bandwidth_order()
	test_maintenance_upgrade_and_fusion()
	test_reward_order()
	test_control_pressure()
	test_save_roundtrip()
	test_battle_terminals(100)
	if failures.is_empty():
		print("MINDREALM_TESTS_OK checks=%d maps=1000 battles=100" % checks)
		quit(0)
	else:
		for failure in failures:
			printerr("TEST_FAILURE: %s" % failure)
		printerr("MINDREALM_TESTS_FAILED failures=%d checks=%d" % [failures.size(), checks])
		quit(1)

func expect(condition: bool, message: String) -> void:
	checks += 1
	if not condition:
		failures.append(message)

func test_catalog() -> void:
	var implemented_branch_effects := [
		"counter", "guard", "lifesteal_plus", "armor_break", "self_repair", "root",
		"wide_shield", "pressure_sink", "chain", "anti_air", "pierce", "execute",
		"large_splash", "corrosion", "extra_drone", "mark", "bandwidth_plus_more", "jam_resist",
		"critical_repair", "armor_repair", "strong_haste", "slow_aura", "resistance_plus_more", "pressure_filter",
	]
	expect(catalog.errors.is_empty(), "内容目录应无错误：%s" % "; ".join(catalog.errors))
	expect(catalog.acts.size() == 3, "应有三幕")
	expect(catalog.towers.size() == 12, "应有12种单位")
	expect(catalog.enemies.size() == 18, "应有18种普通/功能敌人")
	expect(catalog.elites.size() == 4, "应有4名精英")
	expect(catalog.bosses.size() == 6, "应有6名首领")
	expect(catalog.relics.size() == 30, "应有30件收藏品")
	expect(catalog.talents.size() == 24, "应有24项天赋")
	expect(catalog.events.size() == 24, "应有24个事件")
	for tower_id in catalog.towers:
		var tower: Dictionary = catalog.towers[tower_id]
		expect(tower.get("branches", {}).has("A") and tower.get("branches", {}).has("B"), "单位%s缺少双分支" % tower_id)
		for branch in ["A", "B"]:
			expect(implemented_branch_effects.has(str(tower["branches"][branch].get("effect", ""))), "单位%s分支%s效果没有模拟实现" % [tower_id, branch])

func test_seed_reproduction() -> void:
	var first := RunState.create_new("固定复现-42", 0, catalog)
	var second := RunState.create_new("固定复现-42", 0, catalog)
	expect(JSON.stringify(first.maps) == JSON.stringify(second.maps), "同种子地图不一致")
	expect(JSON.stringify(first.terrain_grid) == JSON.stringify(second.terrain_grid), "同种子地形不一致")
	expect(first.current_act()["boss_id"] == second.current_act()["boss_id"], "同种子首领不一致")
	var third := RunState.create_new("固定复现-43", 0, catalog)
	expect(JSON.stringify(first.maps) != JSON.stringify(third.maps) or JSON.stringify(first.terrain_grid) != JSON.stringify(third.terrain_grid), "不同种子应产生差异")

func test_maps_1000_seeds() -> void:
	for seed_index in 1000:
		var streams := SeedStreams.new("地图压力-%d" % seed_index)
		var maps := MapGenerator.generate_all(streams, catalog)
		expect(maps.size() == 3, "种子%d幕数量错误" % seed_index)
		for act_index in 3:
			var act: Dictionary = maps[act_index]
			var floors: Array = act["floors"]
			expect(floors.size() == GameDefs.ACT_FLOORS[act_index], "种子%d第%d幕层数错误" % [seed_index, act_index + 1])
			expect(floors[-1].size() == 1 and floors[-1][0]["type"] == "boss", "种子%d第%d幕末层不是唯一首领" % [seed_index, act_index + 1])
			expect(floors[-2].size() == 1 and floors[-2][0]["type"] == "camp", "种子%d第%d幕首领前不是唯一营地" % [seed_index, act_index + 1])
			var treasure_found := false
			for floor_index in floors.size():
				var floor_nodes: Array = floors[floor_index]
				if floor_index < floors.size() - 2:
					expect(floor_nodes.size() >= 2 and floor_nodes.size() <= 4, "种子%d第%d幕第%d层节点数越界" % [seed_index, act_index + 1, floor_index + 1])
				if floor_nodes.size() > 1 and not (act_index == 0 and floor_index == 0):
					var types: Dictionary = {}
					for diversity_node in floor_nodes:
						types[str(diversity_node["type"])] = true
					expect(types.size() >= 2, "种子%d第%d幕第%d层节点类型完全相同" % [seed_index, act_index + 1, floor_index + 1])
				for node in floor_nodes:
					expect(not str(node.get("map_icon_id", "")).is_empty(), "路线节点缺少图标ID")
					if floor_index < 4:
						expect(str(node["type"]) != "elite", "前四层出现精英")
					if str(node["type"]) == "treasure":
						treasure_found = true
					if floor_index < floors.size() - 1:
						expect(not node["connections"].is_empty(), "非末层节点无连接")
				if floor_index > 0:
					for node in floor_nodes:
						var incoming := false
						for previous in floors[floor_index - 1]:
							if previous["connections"].has(node["id"]):
								incoming = true
						expect(incoming, "节点没有上层入口")
				if floor_index > 0:
					for previous in floors[floor_index - 1]:
						for node in floor_nodes:
							if previous["connections"].has(node["id"]):
								var previous_service := str(previous["type"]) in MapGenerator.SERVICE_TYPES
								var current_service := str(node["type"]) in MapGenerator.SERVICE_TYPES
								expect(not (previous_service and current_service), "同一路线连续出现服务节点")
			expect(treasure_found, "种子%d第%d幕缺少保证宝库" % [seed_index, act_index + 1])
		expect(maps[0]["floors"][0].size() == 4, "第一幕第一层必须有四节点")
		for node in maps[0]["floors"][0]:
			expect(node["type"] == "combat", "第一幕第一层必须全为普通战")

func test_terrain_and_paths() -> void:
	for seed_index in 50:
		var grid := TerrainGenerator.generate(SeedStreams.new("地形-%d" % seed_index))
		expect(grid.size() == 41 and grid[0].size() == 41, "地形必须为41×41")
		for y in GameDefs.BOARD_SIZE:
			for x in GameDefs.BOARD_SIZE:
				var height := TerrainGenerator.height_at(grid, Vector2i(x, y))
				expect(height >= 0 and height <= 4, "地形高度越界")
		for entry in GameDefs.ENTRY_CELLS.values():
			var path := RuleService.path_to_core(entry, grid, [])
			expect(not path.is_empty() and GameDefs.is_core_cell(path[-1]), "入口必须可达火种")
	var command_run := RunState.create_new("地形事务", 0, catalog)
	command_run.phase = "prebattle"
	var brush_cells := [[2, 2], [3, 2], [2, 3], [3, 3]]
	var before := command_run.terrain_grid.duplicate(true)
	var preview := RuleService.validate_terrain_command(command_run.terrain_grid, {"tool":"raise", "cells":brush_cells}, command_run.towers)
	expect(preview.get("ok", false) and int(preview.get("cost", 0)) == 8, "批量地形事务应按实际四格计费")
	var applied := command_run.apply_terrain_command({"tool":"raise", "cells":brush_cells})
	expect(applied.get("ok", false) and command_run.terrain_revision == 1, "地形事务应一次提交并更新版本")
	var undone := command_run.undo_terrain_command()
	expect(undone.get("ok", false) and command_run.terrain_grid == before and command_run.focus == 99, "撤销地形事务应原额退款")
	expect(not RuleService.validate_terrain_command(command_run.terrain_grid, {"tool":"raise", "cells":[[GameDefs.CORE_MIN.x, GameDefs.CORE_MIN.y]]}, command_run.towers).get("ok", false), "保护格不能被笔刷修改")
	var edge_grid := make_flat_grid()
	edge_grid[10][10]["height"] = 1
	edge_grid[10][10]["slope"] = "east"
	var ramp_edge := RuleService.path_edge_info(Vector2i(10, 10), Vector2i(11, 10), edge_grid)
	expect(ramp_edge["passable"] and is_equal_approx(float(ramp_edge["cost"]), 1.25), "正确朝向的一级斜坡应双向通行")
	edge_grid[10][10]["slope"] = "north"
	var cliff_edge := RuleService.path_edge_info(Vector2i(10, 10), Vector2i(11, 10), edge_grid)
	expect(not cliff_edge["passable"] and cliff_edge["high_cell"] == [10, 10], "错误朝向的高差边缘应形成可破坏峭壁")
	var barrier_run := RunState.create_new("峭壁永久损坏", 0, catalog)
	barrier_run.terrain_grid[10][10]["height"] = 2
	barrier_run.terrain_grid[10][10]["slope"] = ""
	var barrier_sim := BattleSimulation.new()
	barrier_sim.initialize(barrier_run, catalog, barrier_run.maps[0]["floors"][0][0])
	var revision_before := barrier_run.terrain_revision
	barrier_sim._attack_barrier({"attack":1000.0, "ability":"siege", "name":"测试攻城体"}, Vector2i(10, 10))
	expect(TerrainGenerator.height_at(barrier_run.terrain_grid, Vector2i(10, 10)) == 1 and barrier_run.terrain_revision == revision_before + 1, "峭壁被击毁后应永久降低高侧地形并刷新路径")

func test_deployment_rules() -> void:
	var run := RunState.create_new("部署规则", 0, catalog)
	var melee: Dictionary = run.towers[0]
	var ranged: Dictionary = run.towers[3]
	expect(RuleService.deployment_error(melee, Vector2i(-1, 0), run.terrain_grid, run.towers, 0, 20) == "占地超出战场", "越界原因错误")
	expect(RuleService.deployment_error(melee, GameDefs.CORE_MIN, run.terrain_grid, run.towers, 0, 20) == "醒觉火种保护区域不可部署", "火种保护原因错误")
	expect(RuleService.deployment_error(melee, GameDefs.ENTRY_CELLS["north"], run.terrain_grid, run.towers, 0, 20) == "敌人入口不可部署", "入口原因错误")
	var high_cell := find_cell_with_height(run.terrain_grid, 1, melee.get("footprint", [2, 2]))
	expect(high_cell != Vector2i(-1, -1), "应存在高台")
	expect(RuleService.deployment_error(melee, high_cell, run.terrain_grid, run.towers, 0, 20).contains("近战"), "近战高台原因错误")
	var zero_cell := find_cell_with_height(run.terrain_grid, 0, melee.get("footprint", [2, 2]))
	expect(RuleService.deployment_error(ranged, zero_cell, run.terrain_grid, run.towers, 0, 20).contains("远程"), "远程地面原因错误")
	expect(RuleService.deployment_error(melee, zero_cell, run.terrain_grid, run.towers, 19, 20).contains("带宽不足"), "带宽不足原因错误")
	melee["deployed"] = true
	melee["cell"] = [zero_cell.x, zero_cell.y]
	expect(RuleService.deployment_error(run.towers[1], zero_cell, run.terrain_grid, run.towers, 3, 20).contains("占用"), "重叠占用原因错误")
	var terrain_check := RuleService.can_change_terrain(run.terrain_grid, zero_cell, 1, run.towers)
	expect(not terrain_check["ok"] and str(terrain_check["reason"]).contains("占用"), "占用格不能改地形")
	expect(not RuleService.can_change_terrain(run.terrain_grid, GameDefs.CORE_MIN, 1, run.towers)["ok"], "火种不能改地形")

func test_los_and_combat_math() -> void:
	var flat := make_flat_grid()
	expect(RuleService.has_line_of_sight(Vector2i(2, 2), Vector2(8, 2), flat, 1), "平地视线应畅通")
	flat[2][5]["height"] = 3
	expect(not RuleService.has_line_of_sight(Vector2i(2, 2), Vector2(8, 2), flat, 1), "更高地形应遮挡直射")
	var ranged := {"role":"ranged", "range":10.0}
	expect(is_equal_approx(RuleService.attack_range(ranged, 4), 13.2), "高地四级射程应加32%")
	flat[2][5]["height"] = 0
	flat[2][2]["height"] = 4
	var high_solution := RuleService.solve_attack({"range":10.0, "attack_kind":"direct"}, Vector2i(2, 2), Vector2(8, 2), 0, flat)
	expect(high_solution["can_attack"] and is_equal_approx(float(high_solution["range"]), 13.2) and is_equal_approx(float(high_solution["height_damage_multiplier"]), 1.4), "统一攻击判定应应用四级高地射程和伤害")
	var low_solution := RuleService.solve_attack({"range":20.0, "attack_kind":"indirect"}, Vector2i(8, 2), Vector2(2, 2), 4, flat, {"pierce":1.0})
	expect(is_equal_approx(float(low_solution["protection"]), 0.24), "穿甲应只减半低打高保护")
	expect(is_equal_approx(RuleService.damage_after_armor(100, 999, 0), 5.0), "有效攻击至少造成攻击力5%")
	expect(RuleService.enemy_damage_to_tower(20, 999, 0, 3) >= 1.0, "攻击单位至少造成1伤害")
	var pressure := RuleService.death_pressure(20.0, 6.0, 3.0)
	expect(is_equal_approx(float(pressure["transmitted"]), 10.0) and is_equal_approx(float(pressure["damage"]), 7.0), "死亡压力平方衰减计算错误")

func make_flat_grid() -> Array:
	var grid: Array = []
	for _y in GameDefs.BOARD_SIZE:
		var row: Array = []
		for _x in GameDefs.BOARD_SIZE:
			row.append({"height":0, "slope":"", "protected":false})
		grid.append(row)
	return grid

func test_enemy_groups_and_danger() -> void:
	var cases := [
		{"type":"combat", "groups":3, "special":"", "special_group":-1},
		{"type":"elite", "groups":4, "special":"elite", "special_group":2},
		{"type":"boss", "groups":5, "special":"boss", "special_group":3},
	]
	for battle_case in cases:
		var group_run := RunState.create_new("敌群-%s" % battle_case["type"], 0, catalog)
		var battle_node := {"id":"group_%s" % battle_case["type"], "type":battle_case["type"], "floor":16, "boss_id":"noise_hive"}
		var group_sim := BattleSimulation.new()
		group_sim.initialize(group_run, catalog, battle_node)
		expect(group_sim.group_count == battle_case["groups"] and group_sim.group_preview.size() == battle_case["groups"], "%s战敌群数量错误" % battle_case["type"])
		for preview in group_sim.group_preview:
			expect(int(preview["count"]) > 0 and not preview["entries"].is_empty(), "%s战的每群都应提前显示数量与入口" % battle_case["type"])
		if not str(battle_case["special"]).is_empty():
			var special_items := group_sim.planned.filter(func(item: Dictionary) -> bool: return str(item.get("kind", "")) == battle_case["special"])
			expect(special_items.size() == 1 and int(special_items[0]["group"]) == battle_case["special_group"], "%s应出现在指定敌群" % battle_case["special"])
	var danger_run := RunState.create_new("危险度平滑", 0, catalog)
	var danger_sim := BattleSimulation.new()
	danger_sim.initialize(danger_run, catalog, {"id":"danger", "type":"combat", "floor":0})
	danger_sim.enemies.clear()
	for _index in 60:
		danger_sim.enemies.append({"position":GameDefs.CORE_CENTER, "boss":false, "elite":false})
	danger_run.spirit = 0.0
	danger_sim._update_danger(1.5)
	expect(is_equal_approx(danger_sim.danger_level, 1.0), "危险度上升应在1.5秒内平滑到目标")
	danger_sim.enemies.clear()
	danger_run.spirit = danger_run.max_spirit
	danger_sim._update_danger(1.0)
	expect(is_equal_approx(danger_sim.danger_level, 0.75), "危险度下降应按4秒缓慢回落")

func test_camera_controls() -> void:
	var view := BattlefieldView.new()
	for yaw in [0.0, 45.0, 90.0, 225.0, 359.0]:
		var vectors := BattlefieldView.screen_pan_vectors(yaw)
		var right := BattlefieldView.screen_relative_pan_delta(yaw, Vector2(1.0, 0.0))
		var up := BattlefieldView.screen_relative_pan_delta(yaw, Vector2(0.0, -1.0))
		expect(right.dot(vectors["right"]) > 0.999, "视角%.0f°时D应始终向屏幕右方移动" % yaw)
		expect(up.dot(vectors["up"]) > 0.999, "视角%.0f°时W应始终向屏幕上方移动" % yaw)
		expect(absf(right.dot(up)) < 0.001, "视角%.0f°时屏幕移动轴应保持正交" % yaw)
	view.set_camera_yaw(359.0)
	view.rotate_camera(1, 2.0 / 90.0)
	expect(is_equal_approx(view.camera_yaw_degrees, 1.0), "Q/E连续旋转应在360°正确环绕")
	view.free()

func test_bandwidth_order() -> void:
	var towers: Array = []
	for order in [1, 2, 3]:
		towers.append({"instance_id":"U%d" % order, "deployed":true, "durability":100.0, "bandwidth":4, "deployment_order":order, "disabled":false})
	var result := RuleService.apply_overload(towers, 7)
	expect(result["disabled"] == ["U3", "U2"], "过载应按部署时间从新到旧禁用")
	var recovered := RuleService.apply_overload(towers, 12)
	expect(recovered["disabled"].is_empty() and not towers[0]["disabled"] and not towers[2]["disabled"], "带宽恢复后应自动启用")

func test_maintenance_upgrade_and_fusion() -> void:
	var run := RunState.create_new("成长规则", 0, catalog)
	var tower: Dictionary = run.towers[0]
	tower["durability"] = float(tower["max_durability"]) * 0.5
	expect(RuleService.repair_cost(tower) == ceili(float(tower["upkeep"]) * 0.5), "维修费用应按缺失耐久比例")
	expect(RuleService.relocation_cost(tower) == ceili(float(tower["upkeep"]) * 0.15), "搬迁费用应为维护费15%")
	var focus_before := run.focus
	var upgraded := run.upgrade_tower(str(tower["instance_id"]), "A", catalog)
	expect(upgraded["ok"] and tower["tier"] == 2 and tower["branch"] == "A" and run.focus < focus_before, "T1升级A分支失败")
	expect(not run.upgrade_tower(str(tower["instance_id"]), "B", catalog)["ok"], "T2不应改换分支")
	var fusion_run := RunState.create_new("融合规则", 0, catalog)
	var core: Dictionary = fusion_run.towers[0]
	var extra_a := fusion_run.add_tower(str(core["id"]), catalog)
	var extra_b := fusion_run.add_tower(str(core["id"]), catalog)
	core["durability"] = float(core["max_durability"]) * 0.25
	extra_a["durability"] = float(extra_a["max_durability"]) * 0.5
	extra_b["durability"] = float(extra_b["max_durability"]) * 0.75
	var fused := fusion_run.fuse_tower(str(core["instance_id"]), "B", catalog)
	expect(fused["ok"] and is_equal_approx(float(fused["durability_ratio"]), 0.5), "融合应继承三材料总耐久比例")
	expect(fusion_run.towers.filter(func(item: Dictionary) -> bool: return item["id"] == core["id"]).size() == 1, "融合应消耗另两个材料")
	var branch_run := RunState.create_new("分支实际效果", 0, catalog)
	var relay := branch_run.add_tower("bandwidth_relay", catalog, 2, "A")
	relay["deployed"] = true
	relay["cell"] = [12, 5]
	expect(branch_run.effective_bandwidth() == 28, "宽域中继分支应把基础5点增益提高到8点")
	var beacon := branch_run.add_tower("resistance_beacon", catalog, 2, "A")
	beacon["deployed"] = true
	beacon["cell"] = [10, 5]
	expect(is_equal_approx(branch_run.effective_resistance(), 5.0), "深层抗性分支应实际提供5点抗性")
	var jam_relay := branch_run.add_tower("bandwidth_relay", catalog, 2, "B")
	jam_relay["deployed"] = true
	jam_relay["cell"] = [14, 5]
	var branch_sim := BattleSimulation.new()
	branch_sim.initialize(branch_run, catalog, branch_run.maps[0]["floors"][0][0])
	branch_sim.jam_amount = 6
	expect(branch_sim._effective_jam() == 4, "抗扰中继分支应抵消2点临时带宽干扰")

func test_reward_order() -> void:
	var run := RunState.create_new("奖励顺序", 0, catalog)
	var node: Dictionary = run.maps[0]["floors"][0][0]
	node["relic_roll"] = 0.0
	run.depth = 2
	run.queue_combat_rewards(node, 1)
	var kinds: Array[String] = []
	for reward in run.reward_queue:
		kinds.append(str(reward["kind"]))
	expect(kinds == ["unit", "unit", "relic", "talent"], "奖励必须按单位、收藏品、天赋顺序")

func test_control_pressure() -> void:
	var p5 := RunState.create_new("压力-5", 5, catalog)
	var p6 := RunState.create_new("压力-6", 6, catalog)
	var p7 := RunState.create_new("压力-7", 7, catalog)
	var p10 := RunState.create_new("压力-10", 10, catalog)
	expect(is_equal_approx(p5.pressure_multiplier, 1.0), "压力5只降低营地恢复，不应提前提高死亡压力")
	expect(is_equal_approx(p6.pressure_multiplier, 1.15), "压力6应提高15%死亡压力")
	expect(p7.focus == 89, "压力7应把开局专注降低到89")
	expect(is_equal_approx(p10.pressure_multiplier, 1.265), "压力10应累计死亡压力强化")
	var sim_standard := BattleSimulation.new()
	var standard := RunState.create_new("压力属性", 0, catalog)
	sim_standard.initialize(standard, catalog, standard.maps[0]["floors"][0][0])
	sim_standard.step(0.1)
	var sim_hard := BattleSimulation.new()
	var hard := RunState.create_new("压力属性", 2, catalog)
	sim_hard.initialize(hard, catalog, hard.maps[0]["floors"][0][0])
	sim_hard.step(0.1)
	if not sim_standard.enemies.is_empty() and not sim_hard.enemies.is_empty():
		expect(float(sim_hard.enemies[0]["max_hp"]) > float(sim_standard.enemies[0]["max_hp"]), "压力1生命强化应实际进入战斗")
		expect(float(sim_hard.enemies[0]["attack"]) > float(sim_standard.enemies[0]["attack"]), "压力2攻击强化应实际进入战斗")
	else:
		expect(false, "控制压力属性测试未生成敌人")

func test_save_roundtrip() -> void:
	var run := RunState.create_new("存档复现", 3, catalog)
	run.focus = 77
	run.maps[0]["floors"][0][0]["available"] = false
	var test_path := "user://tests/active_run_test.json"
	expect(SaveService.save_run(run, test_path), "原子保存失败")
	var loaded := SaveService.load_run(test_path)
	expect(loaded != null, "存档读取失败")
	if loaded != null:
		expect(loaded.seed_text == run.seed_text and loaded.focus == 77, "存档资源恢复不一致")
		var normalized_original: Variant = JSON.parse_string(JSON.stringify(run.maps))
		expect(JSON.stringify(loaded.maps) == JSON.stringify(normalized_original), "存档地图/固定货架恢复不一致")
	SaveService.clear_run(test_path)

func test_battle_terminals(seed_count: int) -> void:
	for seed_index in seed_count:
		var run := RunState.create_new("战斗终局-%d" % seed_index, 0, catalog)
		auto_deploy_starters(run)
		var node: Dictionary = run.maps[0]["floors"][0][seed_index % 4]
		var sim := BattleSimulation.new()
		sim.initialize(run, catalog, node)
		var steps := 0
		while not sim.finished and steps < 12000:
			sim.step(0.1)
			steps += 1
		expect(sim.finished, "种子%d战斗1200秒未进入胜败终局" % seed_index)
		expect(sim.reinforcements_used <= sim.reinforcement_budget, "种子%d增援绕过10%%共享预算" % seed_index)
		expect(sim.enemies.size() <= GameDefs.ACTIVE_ENEMY_CAP, "种子%d活动敌人超过100" % seed_index)

func auto_deploy_starters(run: RunState) -> void:
	var ordered: Array = []
	for tower in run.towers:
		if str(tower["ability"]) == "bandwidth_plus":
			ordered.push_front(tower)
		else:
			ordered.append(tower)
	for tower in ordered:
		var best := find_legal_cell(tower, run)
		if best.x < 0:
			continue
		tower["deployed"] = true
		tower["ever_deployed"] = true
		tower["cell"] = [best.x, best.y]
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
		return Vector2(a).distance_to(GameDefs.CORE_CENTER) < Vector2(b).distance_to(GameDefs.CORE_CENTER)
	)
	return candidates[0]

func find_cell_with_height(terrain_grid: Array, wanted: int, footprint: Array = [1, 1]) -> Vector2i:
	for y in GameDefs.BOARD_SIZE:
		for x in GameDefs.BOARD_SIZE:
			var origin := Vector2i(x, y)
			var valid := true
			for footprint_y in int(footprint[1]):
				for footprint_x in int(footprint[0]):
					var cell := origin + Vector2i(footprint_x, footprint_y)
					if not TerrainGenerator.in_bounds(cell) or TerrainGenerator.height_at(terrain_grid, cell) != wanted or TerrainGenerator.protected_at(terrain_grid, cell):
						valid = false
			if valid:
				return origin
	return Vector2i(-1, -1)
