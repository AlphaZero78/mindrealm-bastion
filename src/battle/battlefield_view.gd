class_name BattlefieldView
extends Node3D

const LEVEL_HEIGHT := 0.48

var run: RunState
var catalog: ContentCatalog
var simulation: BattleSimulation
var camera: Camera3D
var terrain_root: Node3D
var tower_root: Node3D
var enemy_root: Node3D
var effects_root: Node3D
var preview_root: Node3D
var tower_nodes: Dictionary = {}
var enemy_nodes: Dictionary = {}
var camera_yaw_degrees := 45.0
var orthographic_size := 28.0
var camera_target := Vector3.ZERO
var selected_tower_id := ""
var preview_cell := Vector2i(-1, -1)
var preview_valid := false
var preview_reason := ""
var terrain_preview_command: Dictionary = {}
var _rendered_terrain_revision := -1

func setup(run_state: RunState, content: ContentCatalog) -> void:
	run = run_state
	catalog = content
	_build_world()
	refresh_all(true)

func set_simulation(value: BattleSimulation) -> void:
	simulation = value

func refresh_all(force_terrain: bool = false) -> void:
	if run == null:
		return
	if force_terrain or _rendered_terrain_revision != run.terrain_revision:
		_refresh_terrain()
		_rendered_terrain_revision = run.terrain_revision
	_refresh_towers()
	_refresh_enemies()
	_refresh_preview()

func set_selected_tower(instance_id: String) -> void:
	selected_tower_id = instance_id
	_refresh_preview()

func set_terrain_preview_delta(value: int) -> void:
	terrain_preview_command = {"tool": "raise" if value > 0 else "lower", "cells": [[preview_cell.x, preview_cell.y]]} if value != 0 else {}
	_refresh_preview()

func set_terrain_preview_command(command: Dictionary) -> void:
	terrain_preview_command = command.duplicate(true)
	_refresh_preview()

func set_preview(cell: Vector2i, valid: bool, reason: String = "") -> void:
	preview_cell = cell
	preview_valid = valid
	preview_reason = reason
	if not terrain_preview_command.is_empty():
		terrain_preview_command["cells"] = [[cell.x, cell.y]]
	_refresh_preview()

func clear_preview() -> void:
	preview_cell = Vector2i(-1, -1)
	preview_reason = ""
	terrain_preview_command = {}
	_refresh_preview()

func screen_to_cell(screen_position: Vector2) -> Vector2i:
	if camera == null:
		return Vector2i(-1, -1)
	var origin := camera.project_ray_origin(screen_position)
	var direction := camera.project_ray_normal(screen_position)
	if absf(direction.y) < 0.0001:
		return Vector2i(-1, -1)
	var distance := -origin.y / direction.y
	if distance < 0.0:
		return Vector2i(-1, -1)
	var hit := origin + direction * distance
	var cell := Vector2i(roundi(hit.x / GameDefs.WORLD_CELL_SIZE + 20.0), roundi(hit.z / GameDefs.WORLD_CELL_SIZE + 20.0))
	return cell if TerrainGenerator.in_bounds(cell) else Vector2i(-1, -1)

func rotate_camera(direction: int, delta: float = 1.0 / 60.0) -> void:
	camera_yaw_degrees = fposmod(camera_yaw_degrees + float(direction) * 90.0 * delta, 360.0)
	_update_camera()

func set_camera_yaw(value: float) -> void:
	camera_yaw_degrees = fposmod(value, 360.0)
	_update_camera()

func zoom_camera(amount: float) -> void:
	orthographic_size = clampf(orthographic_size + amount, 18.0, 38.0)
	_update_camera()

static func screen_pan_vectors(yaw_degrees: float) -> Dictionary:
	var yaw := deg_to_rad(yaw_degrees)
	return {
		"right": Vector3(cos(yaw), 0.0, -sin(yaw)).normalized(),
		"up": Vector3(-sin(yaw), 0.0, -cos(yaw)).normalized(),
	}

static func screen_relative_pan_delta(yaw_degrees: float, screen_offset: Vector2) -> Vector3:
	var vectors := screen_pan_vectors(yaw_degrees)
	return vectors["right"] * screen_offset.x - vectors["up"] * screen_offset.y

func pan_camera(screen_offset: Vector2) -> void:
	camera_target += screen_relative_pan_delta(camera_yaw_degrees, screen_offset)
	camera_target.x = clampf(camera_target.x, -8.5, 8.5)
	camera_target.z = clampf(camera_target.z, -8.5, 8.5)
	_update_camera()

func focus_core() -> void:
	camera_target = _cell_world(Vector2i(20, 31), 0)
	camera_target.y = 0.0
	_update_camera()

func compass_text() -> String:
	return "N  %03d°" % roundi(camera_yaw_degrees)

func _build_world() -> void:
	if camera != null:
		return
	terrain_root = Node3D.new()
	terrain_root.name = "Terrain"
	add_child(terrain_root)
	tower_root = Node3D.new()
	tower_root.name = "PixelTowers"
	add_child(tower_root)
	enemy_root = Node3D.new()
	enemy_root.name = "PixelEnemies"
	add_child(enemy_root)
	effects_root = Node3D.new()
	effects_root.name = "PixelEffects"
	add_child(effects_root)
	preview_root = Node3D.new()
	preview_root.name = "Preview"
	add_child(preview_root)
	var environment_node := WorldEnvironment.new()
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = PixelTheme.BACKGROUND
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("d8e5d6")
	environment.ambient_light_energy = 0.72
	environment.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	environment.glow_enabled = false
	environment.fog_enabled = false
	environment_node.environment = environment
	add_child(environment_node)
	var key_light := DirectionalLight3D.new()
	key_light.rotation_degrees = Vector3(-58.0, -28.0, 0.0)
	key_light.light_color = Color("f4ecd8")
	key_light.light_energy = 1.05
	key_light.shadow_enabled = true
	add_child(key_light)
	var fill_light := DirectionalLight3D.new()
	fill_light.rotation_degrees = Vector3(-38.0, 142.0, 0.0)
	fill_light.light_color = PixelTheme.FRIENDLY
	fill_light.light_energy = 0.32
	add_child(fill_light)
	camera = Camera3D.new()
	camera.name = "OrthographicCamera"
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.near = 0.1
	camera.far = 120.0
	add_child(camera)
	focus_core()

func _update_camera() -> void:
	if camera == null:
		return
	var yaw := deg_to_rad(camera_yaw_degrees)
	var horizontal := 22.0
	var vertical := tan(deg_to_rad(55.0)) * horizontal
	var offset := Vector3(sin(yaw) * horizontal, vertical, cos(yaw) * horizontal)
	camera.global_position = camera_target + offset
	camera.size = orthographic_size
	camera.look_at(camera_target, Vector3.UP)
	_update_sprite_frames()

func _refresh_terrain() -> void:
	for child in terrain_root.get_children():
		child.queue_free()
	var colors := [Color("17383b"), Color("245052"), Color("326666"), Color("477b72"), Color("658c78")]
	for height in range(GameDefs.MAX_TERRAIN_HEIGHT + 1):
		var mesh := BoxMesh.new()
		var block_height := 0.16 + float(height) * LEVEL_HEIGHT
		mesh.size = Vector3(GameDefs.WORLD_CELL_SIZE * 0.94, block_height, GameDefs.WORLD_CELL_SIZE * 0.94)
		var multi := MultiMesh.new()
		multi.transform_format = MultiMesh.TRANSFORM_3D
		multi.use_colors = true
		multi.mesh = mesh
		var cells: Array[Vector2i] = []
		for y in GameDefs.BOARD_SIZE:
			for x in GameDefs.BOARD_SIZE:
				var cell := Vector2i(x, y)
				if TerrainGenerator.height_at(run.terrain_grid, cell) == height:
					cells.append(cell)
		multi.instance_count = cells.size()
		for index in cells.size():
			var cell := cells[index]
			var world := _cell_world(cell, 0)
			world.y = block_height * 0.5 - 0.10
			multi.set_instance_transform(index, Transform3D(Basis(), world))
			var variation := float((cell.x * 17 + cell.y * 11) % 4) * 0.025
			multi.set_instance_color(index, colors[height].lightened(variation))
		var instance := MultiMeshInstance3D.new()
		instance.name = "Height%d" % height
		instance.multimesh = multi
		instance.material_override = _pixel_material(Color.WHITE, true)
		terrain_root.add_child(instance)
	_build_slope_markers()
	_build_core_and_entries()

func _build_slope_markers() -> void:
	for y in GameDefs.BOARD_SIZE:
		for x in GameDefs.BOARD_SIZE:
			var cell := Vector2i(x, y)
			var slope := TerrainGenerator.slope_at(run.terrain_grid, cell)
			if slope.is_empty():
				continue
			var marker := MeshInstance3D.new()
			var prism := PrismMesh.new()
			prism.size = Vector3(GameDefs.WORLD_CELL_SIZE * 0.82, LEVEL_HEIGHT * 0.72, GameDefs.WORLD_CELL_SIZE * 0.82)
			marker.mesh = prism
			marker.position = _cell_world(cell, TerrainGenerator.height_at(run.terrain_grid, cell)) + Vector3(0, -LEVEL_HEIGHT * 0.20, 0)
			marker.rotation.y = {"north": 0.0, "east": -PI * 0.5, "south": PI, "west": PI * 0.5}.get(slope, 0.0)
			marker.material_override = _pixel_material(PixelTheme.RESOURCE.darkened(0.2))
			terrain_root.add_child(marker)

func _build_core_and_entries() -> void:
	var core_root := Node3D.new()
	core_root.name = "AwakeningEmber"
	core_root.position = _cell_world(Vector2i(20, 31), 0)
	terrain_root.add_child(core_root)
	for layer in 3:
		var piece := MeshInstance3D.new()
		var mesh := CylinderMesh.new()
		mesh.top_radius = 0.55 - float(layer) * 0.12
		mesh.bottom_radius = 0.75 - float(layer) * 0.12
		mesh.height = 0.36
		mesh.radial_segments = 8
		piece.mesh = mesh
		piece.position.y = 0.18 + float(layer) * 0.32
		piece.material_override = _pixel_material(PixelTheme.FRIENDLY.lightened(float(layer) * 0.08))
		core_root.add_child(piece)
	var light := OmniLight3D.new()
	light.light_color = PixelTheme.FRIENDLY
	light.light_energy = 2.2
	light.omni_range = 5.0
	core_root.add_child(light)
	for entry_name in GameDefs.ENTRY_CELLS:
		var entry: Vector2i = GameDefs.ENTRY_CELLS[entry_name]
		var gate := Node3D.new()
		gate.name = "Entry_%s" % entry_name
		gate.position = _cell_world(entry, 0)
		for side in [-1, 1]:
			var post := MeshInstance3D.new()
			var post_mesh := BoxMesh.new()
			post_mesh.size = Vector3(0.18, 1.25, 0.24)
			post.mesh = post_mesh
			post.position = Vector3(float(side) * 0.42, 0.54, 0)
			post.material_override = _pixel_material(PixelTheme.HOSTILE)
			gate.add_child(post)
		terrain_root.add_child(gate)

func _refresh_towers() -> void:
	var active_ids: Dictionary = {}
	for tower in run.towers:
		if not bool(tower.get("deployed", false)):
			continue
		var instance_id := str(tower["instance_id"])
		active_ids[instance_id] = true
		var node: Node3D = tower_nodes.get(instance_id)
		if node == null or not is_instance_valid(node):
			node = _create_pixel_actor(AssetRegistry.sprite_for_tower(str(tower.get("sprite_id", tower["id"]))), 1.35, PixelTheme.FRIENDLY)
			node.name = instance_id
			tower_root.add_child(node)
			tower_nodes[instance_id] = node
		var cell := Vector2i(int(tower["cell"][0]), int(tower["cell"][1]))
		var footprint: Array = tower.get("footprint", [2, 2])
		var center := Vector2(float(cell.x) + (float(footprint[0]) - 1.0) * 0.5, float(cell.y) + (float(footprint[1]) - 1.0) * 0.5)
		var height := TerrainGenerator.height_at(run.terrain_grid, cell)
		node.position = _grid_world(center, height) + Vector3(0, 0.42, 0)
		node.visible = float(tower.get("durability", 0.0)) > 0.0
		if node is Sprite3D:
			(node as Sprite3D).modulate = Color(0.45, 0.58, 0.58, 0.70) if bool(tower.get("disabled", false)) else PixelTheme.FRIENDLY.lightened(0.06)
		_set_actor_frame(node, deg_to_rad(camera_yaw_degrees))
	for instance_id in tower_nodes.keys():
		if not active_ids.has(instance_id):
			var old: Node3D = tower_nodes[instance_id]
			if is_instance_valid(old):
				old.queue_free()
			tower_nodes.erase(instance_id)

func _refresh_enemies() -> void:
	var render_data: Array = simulation.get_enemy_render_data() if simulation != null else []
	var active_ids: Dictionary = {}
	for enemy in render_data:
		var instance_id := str(enemy["instance_id"])
		active_ids[instance_id] = true
		var node: Node3D = enemy_nodes.get(instance_id)
		if node == null or not is_instance_valid(node):
			var size := 2.35 if bool(enemy.get("boss", false)) else (1.65 if bool(enemy.get("elite", false)) else 1.05)
			node = _create_pixel_actor(AssetRegistry.sprite_for_enemy(str(enemy["id"])), size, PixelTheme.HOSTILE)
			node.name = instance_id
			enemy_root.add_child(node)
			_add_health_bar(node)
			enemy_nodes[instance_id] = node
		var position: Vector2 = enemy["position"]
		var height := int(enemy.get("height", 0))
		var target := _grid_world(position, height) + Vector3(0, 0.34 + (1.25 if bool(enemy.get("air", false)) else 0.0), 0)
		node.position = node.position.lerp(target, 0.42)
		_set_actor_frame(node, float(enemy.get("facing", 0.0)) - deg_to_rad(camera_yaw_degrees))
		_update_health_bar(node, float(enemy["hp_ratio"]))
		_update_telegraph(node, not str(enemy.get("telegraph", "")).is_empty())
	for instance_id in enemy_nodes.keys():
		if not active_ids.has(instance_id):
			var old: Node3D = enemy_nodes[instance_id]
			if is_instance_valid(old):
				old.queue_free()
			enemy_nodes.erase(instance_id)

func _refresh_preview() -> void:
	for child in preview_root.get_children():
		child.queue_free()
	if not TerrainGenerator.in_bounds(preview_cell):
		return
	var height := TerrainGenerator.height_at(run.terrain_grid, preview_cell)
	var footprint := Vector2i.ONE
	if not selected_tower_id.is_empty():
		var tower := run.get_tower(selected_tower_id)
		if not tower.is_empty():
			var raw: Array = tower.get("footprint", [2, 2])
			footprint = Vector2i(int(raw[0]), int(raw[1]))
	for y in footprint.y:
		for x in footprint.x:
			var cell := preview_cell + Vector2i(x, y)
			if TerrainGenerator.in_bounds(cell):
				_add_selection_tile(cell, preview_valid)
	if not terrain_preview_command.is_empty():
		_draw_terrain_route_preview()
		return
	if selected_tower_id.is_empty():
		return
	var tower := run.get_tower(selected_tower_id)
	if tower.is_empty():
		return
	var range_value := RuleService.attack_range(tower, height)
	var ring_mesh := ImmediateMesh.new()
	var material := _pixel_material(PixelTheme.FRIENDLY if preview_valid else PixelTheme.HOSTILE)
	ring_mesh.surface_begin(Mesh.PRIMITIVE_LINE_STRIP, material)
	for i in 65:
		var angle := TAU * float(i) / 64.0
		ring_mesh.surface_add_vertex(Vector3(cos(angle) * range_value * GameDefs.WORLD_CELL_SIZE, 0.08, sin(angle) * range_value * GameDefs.WORLD_CELL_SIZE))
	ring_mesh.surface_end()
	var ring := MeshInstance3D.new()
	ring.mesh = ring_mesh
	ring.position = _cell_world(preview_cell, height)
	preview_root.add_child(ring)

func _add_selection_tile(cell: Vector2i, valid: bool) -> void:
	var selection := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = Vector3(GameDefs.WORLD_CELL_SIZE * 0.92, 0.05, GameDefs.WORLD_CELL_SIZE * 0.92)
	selection.mesh = mesh
	selection.position = _cell_world(cell, TerrainGenerator.height_at(run.terrain_grid, cell)) + Vector3(0, 0.12, 0)
	selection.material_override = _pixel_material(PixelTheme.FRIENDLY if valid else PixelTheme.HOSTILE)
	preview_root.add_child(selection)

func _draw_terrain_route_preview() -> void:
	var command := terrain_preview_command.duplicate(true)
	if command.get("cells", []).is_empty():
		command["cells"] = [[preview_cell.x, preview_cell.y]]
	var validation := RuleService.validate_terrain_command(run.terrain_grid, command, run.towers)
	if not bool(validation.get("ok", false)):
		return
	var preview_grid: Array = validation["preview_grid"]
	var route_mesh := ImmediateMesh.new()
	var material := _pixel_material(PixelTheme.RESOURCE)
	route_mesh.surface_begin(Mesh.PRIMITIVE_LINES, material)
	for path in validation.get("routes", {}).values():
		for index in range(maxi(0, path.size() - 1)):
			var from: Vector2i = path[index]
			var to: Vector2i = path[index + 1]
			route_mesh.surface_add_vertex(_cell_world(from, TerrainGenerator.height_at(preview_grid, from)) + Vector3(0, 0.28, 0))
			route_mesh.surface_add_vertex(_cell_world(to, TerrainGenerator.height_at(preview_grid, to)) + Vector3(0, 0.28, 0))
	route_mesh.surface_end()
	var routes := MeshInstance3D.new()
	routes.name = "AffectedRoutes"
	routes.mesh = route_mesh
	preview_root.add_child(routes)

func _create_pixel_actor(path: String, world_height: float, tint: Color) -> Sprite3D:
	var sprite := Sprite3D.new()
	if ResourceLoader.exists(path):
		sprite.texture = load(path)
	sprite.hframes = 8
	sprite.frame = 0
	sprite.pixel_size = world_height / 48.0
	sprite.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	sprite.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	sprite.alpha_cut = SpriteBase3D.ALPHA_CUT_DISCARD
	sprite.modulate = tint.lightened(0.06)
	return sprite

func _set_actor_frame(node: Node3D, relative_angle: float) -> void:
	if node is Sprite3D:
		(node as Sprite3D).frame = posmod(roundi(relative_angle / (TAU / 8.0)), 8)

func _update_sprite_frames() -> void:
	for node in tower_nodes.values():
		if is_instance_valid(node):
			_set_actor_frame(node, deg_to_rad(camera_yaw_degrees))

func _add_health_bar(node: Node3D) -> void:
	var background := MeshInstance3D.new()
	background.name = "HealthBack"
	var back_mesh := BoxMesh.new()
	back_mesh.size = Vector3(0.82, 0.07, 0.04)
	background.mesh = back_mesh
	background.position = Vector3(0, 1.0, 0)
	background.material_override = _pixel_material(PixelTheme.BACKGROUND)
	node.add_child(background)
	var fill := MeshInstance3D.new()
	fill.name = "HealthFill"
	var fill_mesh := BoxMesh.new()
	fill_mesh.size = Vector3(0.78, 0.08, 0.05)
	fill.mesh = fill_mesh
	fill.position = Vector3(0, 1.0, -0.01)
	fill.material_override = _pixel_material(PixelTheme.HOSTILE)
	node.add_child(fill)

func _update_health_bar(node: Node3D, ratio: float) -> void:
	var fill := node.get_node_or_null("HealthFill") as MeshInstance3D
	if fill != null:
		fill.scale.x = clampf(ratio, 0.0, 1.0)
		fill.position.x = (fill.scale.x - 1.0) * 0.39

func _update_telegraph(node: Node3D, active: bool) -> void:
	var marker := node.get_node_or_null("AbilityTelegraph") as Sprite3D
	if marker == null and active:
		marker = Sprite3D.new()
		marker.name = "AbilityTelegraph"
		marker.texture = PixelTheme.icon("unknown")
		marker.pixel_size = 0.018
		marker.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		marker.modulate = PixelTheme.RESOURCE
		marker.position = Vector3(0, 1.3, 0)
		node.add_child(marker)
	if marker != null:
		marker.visible = active
		if active:
			var pulse := 1.0 + sin(Time.get_ticks_msec() * 0.016) * 0.12
			marker.scale = Vector3.ONE * pulse

func _pixel_material(color: Color, vertex_color: bool = false) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.92
	material.metallic = 0.0
	material.vertex_color_use_as_albedo = vertex_color
	material.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	return material

func _cell_world(cell: Vector2i, height: int) -> Vector3:
	return _grid_world(Vector2(cell), height)

func _grid_world(cell: Vector2, height: int) -> Vector3:
	return Vector3((cell.x - 20.0) * GameDefs.WORLD_CELL_SIZE, float(height) * LEVEL_HEIGHT, (cell.y - 20.0) * GameDefs.WORLD_CELL_SIZE)
