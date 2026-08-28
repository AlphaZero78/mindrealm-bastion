extends SceneTree

var catalog: ContentCatalog
var main: Node

func _initialize() -> void:
	call_deferred("capture_all")

func capture_all() -> void:
	catalog = ContentCatalog.create_default()
	main = load("res://scenes/app/main.tscn").instantiate()
	root.add_child(main)
	await settle_frames(10)
	await capture("menu")
	main.run = RunState.create_new("视觉检查-20260827", 0, catalog)
	main.run.refresh_owned_content(catalog)
	main.show_map()
	await settle_frames(10)
	await capture("map")
	var first_node: Dictionary = main.run.available_nodes()[0]
	main.run.choose_node(str(first_node["id"]))
	main.show_prebattle()
	auto_deploy(main.run)
	main.battlefield.refresh_all()
	await settle_frames(18)
	await capture("prebattle")
	var terrain_cell := find_terrain_preview_cell(main.run)
	if terrain_cell.x >= 0:
		main.choose_terrain_mode(1)
		main.battlefield.set_preview(terrain_cell, true, "")
		await settle_frames(8)
		await capture("terrain_route_preview")
		main.cancel_action()
	main.start_battle()
	await settle_frames(90)
	await capture("battle")
	await capture_boss_gallery()
	print("VISUAL_CAPTURE_OK %s" % ProjectSettings.globalize_path("user://visual_checks"))
	main.free()
	main = null
	catalog = null
	await settle_frames(8)
	quit(0)

func settle_frames(count: int) -> void:
	for _i in count:
		await process_frame

func capture(name: String) -> void:
	var directory := "user://visual_checks"
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(directory))
	var image := root.get_texture().get_image()
	if image == null:
		printerr("VISUAL_CAPTURE_FAILED %s no rendered image" % name)
		quit(1)
		return
	var error := image.save_png("%s/%s.png" % [directory, name])
	if error != OK:
		printerr("VISUAL_CAPTURE_FAILED %s error=%d" % [name, error])
	await process_frame

func auto_deploy(run: RunState) -> void:
	var ordered := run.towers.duplicate()
	ordered.sort_custom(func(a: Dictionary, _b: Dictionary) -> bool:
		return str(a.get("ability", "")) == "bandwidth_plus"
	)
	for tower in ordered:
		for y in GameDefs.BOARD_SIZE:
			var placed := false
			for x in GameDefs.BOARD_SIZE:
				var cell := Vector2i(x, y)
				var reason := RuleService.deployment_error(tower, cell, run.heights, run.towers, run.deployed_bandwidth(), run.effective_bandwidth(), str(tower["instance_id"]))
				if reason.is_empty():
					tower["deployed"] = true
					tower["ever_deployed"] = true
					tower["cell"] = [x, y]
					run.deployment_counter += 1
					tower["deployment_order"] = run.deployment_counter
					placed = true
					break
			if placed:
				break

func find_terrain_preview_cell(run: RunState) -> Vector2i:
	for y in GameDefs.BOARD_SIZE:
		for x in GameDefs.BOARD_SIZE:
			var cell := Vector2i(x, y)
			if bool(RuleService.can_change_terrain(run.heights, cell, 1, run.towers).get("ok", false)):
				return cell
	return Vector2i(-1, -1)

func capture_boss_gallery() -> void:
	for boss_id in catalog.bosses:
		# The gallery swaps simulations while instance ids restart at E00001.
		# Clear the previous visual so every capture resolves the new boss model.
		clear_gallery_enemy_visuals()
		await settle_frames(1)
		var sim := BattleSimulation.new()
		sim.initialize(main.run, catalog, main.run.pending_node)
		sim.planned.clear()
		sim.enemies.clear()
		sim._spawn_enemy({"id": str(boss_id), "entry": "north", "kind": "boss"})
		sim.enemies[0]["position"] = Vector2(12, 12)
		main.simulation = sim
		main.battlefield.set_simulation(sim)
		main.battlefield.refresh_all()
		await settle_frames(6)
		await capture("boss_%s" % boss_id)
		clear_gallery_enemy_visuals()
		main.battlefield.set_simulation(null)
		main.simulation = null
		sim = null
		await settle_frames(2)

func clear_gallery_enemy_visuals() -> void:
	for node in main.battlefield.enemy_nodes.values():
		if is_instance_valid(node):
			node.free()
	main.battlefield.enemy_nodes.clear()
