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
	print("VISUAL_CAPTURE_OK %s" % ProjectSettings.globalize_path(capture_directory()))
	main.audio.shutdown()
	main.clear_world()
	main.clear_ui()
	# Release queued battlefield/UI nodes before removing the owning scene. Audio
	# playback also needs a few frames to hand its decoded streams back.
	await settle_frames(16)
	main.queue_free()
	await settle_frames(16)
	main = null
	catalog = null
	quit(0)

func settle_frames(count: int) -> void:
	for _i in count:
		await process_frame

func capture(name: String) -> void:
	var directory := capture_directory()
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

func capture_directory() -> String:
	var variant := OS.get_environment("MINDREALM_VISUAL_VARIANT").strip_edges()
	if variant.is_empty():
		variant = "default"
	return "user://visual_checks/%s" % variant

func auto_deploy(run: RunState) -> void:
	var ordered := run.towers.duplicate()
	ordered.sort_custom(func(a: Dictionary, _b: Dictionary) -> bool:
		return str(a.get("ability", "")) == "bandwidth_plus"
	)
	for tower in ordered:
		var candidates: Array[Vector2i] = []
		for y in GameDefs.BOARD_SIZE:
			for x in GameDefs.BOARD_SIZE:
				var cell := Vector2i(x, y)
				var reason := RuleService.deployment_error(tower, cell, run.terrain_grid, run.towers, run.deployed_bandwidth(), run.effective_bandwidth(), str(tower["instance_id"]))
				if reason.is_empty():
					candidates.append(cell)
		if candidates.is_empty():
			continue
		var role := str(tower.get("role", "support"))
		var deployed_role := run.towers.filter(func(item: Dictionary) -> bool: return bool(item.get("deployed", false)) and str(item.get("role", "")) == role).size()
		var targets := {
			"melee":[Vector2i(20, 13), Vector2i(13, 20), Vector2i(27, 20), Vector2i(20, 25)],
			"ranged":[Vector2i(14, 24), Vector2i(24, 24), Vector2i(9, 25), Vector2i(29, 25)],
			"support":[Vector2i(20, 23), Vector2i(17, 23), Vector2i(23, 23)],
		}
		var target: Vector2i = targets.get(role, targets["support"])[deployed_role % targets.get(role, targets["support"]).size()]
		candidates.sort_custom(func(a: Vector2i, b: Vector2i) -> bool: return Vector2(a).distance_to(target) < Vector2(b).distance_to(target))
		var best := candidates[0]
		tower["deployed"] = true
		tower["ever_deployed"] = true
		tower["cell"] = [best.x, best.y]
		run.deployment_counter += 1
		tower["deployment_order"] = run.deployment_counter

func find_terrain_preview_cell(run: RunState) -> Vector2i:
	for y in GameDefs.BOARD_SIZE:
		for x in GameDefs.BOARD_SIZE:
			var cell := Vector2i(x, y)
			if bool(RuleService.can_change_terrain(run.terrain_grid, cell, 1, run.towers).get("ok", false)):
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
		sim.enemies[0]["position"] = Vector2(20, 23)
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
