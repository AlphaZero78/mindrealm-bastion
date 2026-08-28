class_name BattlefieldView
extends Node3D

var run: RunState
var catalog: ContentCatalog
var simulation: BattleSimulation
var camera_pivot: Node3D
var camera: Camera3D
var terrain_root: Node3D
var tower_root: Node3D
var enemy_root: Node3D
var effects_root: Node3D
var preview_root: Node3D
var tower_nodes: Dictionary = {}
var enemy_nodes: Dictionary = {}
var camera_quadrant := 0
var camera_distance := 27.0
var camera_target := Vector3.ZERO
var selected_tower_id := ""
var preview_cell := Vector2i(-1, -1)
var preview_valid := false
var preview_reason := ""
var terrain_preview_delta := 0
var _terrain_revision := -1

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
	if force_terrain or _terrain_revision != _terrain_hash():
		_refresh_terrain()
		_terrain_revision = _terrain_hash()
	_refresh_towers()
	_refresh_enemies()
	_refresh_preview()

func set_selected_tower(instance_id: String) -> void:
	selected_tower_id = instance_id
	_refresh_preview()

func set_terrain_preview_delta(value: int) -> void:
	terrain_preview_delta = value
	_refresh_preview()

func set_preview(cell: Vector2i, valid: bool, reason: String = "") -> void:
	preview_cell = cell
	preview_valid = valid
	preview_reason = reason
	_refresh_preview()

func clear_preview() -> void:
	preview_cell = Vector2i(-1, -1)
	preview_reason = ""
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
	var cell := Vector2i(roundi(hit.x + 12.0), roundi(hit.z + 12.0))
	if cell.x < 0 or cell.y < 0 or cell.x >= GameDefs.BOARD_SIZE or cell.y >= GameDefs.BOARD_SIZE:
		return Vector2i(-1, -1)
	return cell

func rotate_camera(direction: int) -> void:
	camera_quadrant = posmod(camera_quadrant + direction, 4)
	_update_camera()

func zoom_camera(amount: float) -> void:
	camera_distance = clampf(camera_distance + amount, 18.0, 38.0)
	_update_camera()

func pan_camera(offset: Vector2) -> void:
	var right := Vector3(camera.global_transform.basis.x.x, 0.0, camera.global_transform.basis.x.z).normalized()
	var forward := Vector3(-camera.global_transform.basis.z.x, 0.0, -camera.global_transform.basis.z.z).normalized()
	camera_target += right * offset.x + forward * offset.y
	camera_target.x = clampf(camera_target.x, -8.0, 8.0)
	camera_target.z = clampf(camera_target.z, -8.0, 8.0)
	_update_camera()

func focus_core() -> void:
	camera_target = Vector3(0.0, 0.0, 6.0)
	_update_camera()

func _build_world() -> void:
	if camera_pivot != null:
		return
	terrain_root = Node3D.new()
	terrain_root.name = "Terrain"
	add_child(terrain_root)
	tower_root = Node3D.new()
	tower_root.name = "Towers"
	add_child(tower_root)
	enemy_root = Node3D.new()
	enemy_root.name = "Enemies"
	add_child(enemy_root)
	effects_root = Node3D.new()
	effects_root.name = "Effects"
	add_child(effects_root)
	preview_root = Node3D.new()
	preview_root.name = "Preview"
	add_child(preview_root)

	var environment_node := WorldEnvironment.new()
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color("071019")
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("6b88a1")
	environment.ambient_light_energy = 0.42
	environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	environment.glow_enabled = true
	environment.fog_enabled = true
	environment.fog_light_color = Color("1b3942")
	environment.fog_density = 0.008
	environment_node.environment = environment
	add_child(environment_node)

	var key_light := DirectionalLight3D.new()
	key_light.rotation_degrees = Vector3(-58.0, -28.0, 0.0)
	key_light.light_color = Color("bcd9e8")
	key_light.light_energy = 1.25
	key_light.shadow_enabled = true
	add_child(key_light)
	var rim_light := DirectionalLight3D.new()
	rim_light.rotation_degrees = Vector3(-35.0, 145.0, 0.0)
	rim_light.light_color = Color("d44c9d")
	rim_light.light_energy = 0.42
	add_child(rim_light)

	camera_pivot = Node3D.new()
	camera_pivot.name = "CameraRig"
	add_child(camera_pivot)
	camera = Camera3D.new()
	camera.name = "Camera3D"
	camera.fov = 48.0
	camera.near = 0.1
	camera.far = 120.0
	camera_pivot.add_child(camera)
	focus_core()

func _update_camera() -> void:
	if camera == null:
		return
	var angle := deg_to_rad(45.0 + float(camera_quadrant) * 90.0)
	var horizontal := camera_distance * 0.72
	var offset := Vector3(sin(angle) * horizontal, camera_distance * 0.72, cos(angle) * horizontal)
	camera.global_position = camera_target + offset
	camera.look_at(camera_target, Vector3.UP)

func _refresh_terrain() -> void:
	for child in terrain_root.get_children():
		child.queue_free()
	var floor_mesh := _extract_mesh(AssetRegistry.KENNEY_MODULAR + "template-floor.glb")
	if floor_mesh == null:
		var fallback := BoxMesh.new()
		fallback.size = Vector3(0.94, 0.18, 0.94)
		floor_mesh = fallback
	var aabb := floor_mesh.get_aabb()
	var model_extent := maxf(maxf(absf(aabb.size.x), absf(aabb.size.z)), 0.001)
	var model_scale := 0.94 / model_extent
	for height in 4:
		var multi_instance := MultiMeshInstance3D.new()
		var multi := MultiMesh.new()
		multi.transform_format = MultiMesh.TRANSFORM_3D
		multi.use_colors = true
		multi.mesh = floor_mesh
		var cells: Array[Vector2i] = []
		for y in GameDefs.BOARD_SIZE:
			for x in GameDefs.BOARD_SIZE:
				if int(run.heights[y][x]) == height:
					cells.append(Vector2i(x, y))
		multi.instance_count = cells.size()
		for index in cells.size():
			var cell := cells[index]
			var transform := Transform3D(Basis().scaled(Vector3(model_scale, model_scale, model_scale)), _cell_world(cell, height))
			multi.set_instance_transform(index, transform)
			var variation := float((cell.x * 19 + cell.y * 7) % 5) * 0.025
			var base_color: Color = [Color("25313a"), Color("344047"), Color("44484d"), Color("554f4d")][height]
			multi.set_instance_color(index, base_color.lightened(variation))
		multi_instance.multimesh = multi
		multi_instance.name = "Height%d" % height
		terrain_root.add_child(multi_instance)
	_build_core_and_entries()

func _build_core_and_entries() -> void:
	var core := _instantiate_model(AssetRegistry.KENNEY_SPACE + "machine_generatorLarge.glb", Color("39f2e7"), 2.7)
	core.name = "AwakeningEmber"
	core.position = _cell_world(Vector2i(12, 18), 0) + Vector3(0.0, 0.55, 0.0)
	terrain_root.add_child(core)
	var light := OmniLight3D.new()
	light.light_color = Color("39f2e7")
	light.light_energy = 4.0
	light.omni_range = 8.0
	core.add_child(light)
	for entry_name in GameDefs.ENTRY_CELLS:
		var entry: Vector2i = GameDefs.ENTRY_CELLS[entry_name]
		var gate := _instantiate_model(AssetRegistry.KENNEY_MODULAR + "gate-lasers.glb", Color("d44c9d"), 1.5)
		gate.name = "Entry_%s" % entry_name
		gate.position = _cell_world(entry, 0) + Vector3(0.0, 0.2, 0.0)
		if entry_name in ["west", "east"]:
			gate.rotation.y = PI * 0.5
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
			var role := str(tower.get("role", ""))
			var color := Color("e3ad49") if role == "melee" else (Color("36d8e8") if role == "ranged" else Color("9f76e8"))
			node = _instantiate_model(AssetRegistry.model_for_tower(str(tower["id"])), color, 1.2)
			node.name = instance_id
			tower_root.add_child(node)
			tower_nodes[instance_id] = node
		var cell := Vector2i(int(tower["cell"][0]), int(tower["cell"][1]))
		var height := int(run.heights[cell.y][cell.x])
		node.position = _cell_world(cell, height) + Vector3(0.0, 0.38, 0.0)
		node.visible = float(tower.get("durability", 0.0)) > 0.0
		node.scale = Vector3.ONE * (0.92 if bool(tower.get("disabled", false)) else 1.0)
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
			var color := _enemy_signal_color(str(enemy["id"]), bool(enemy.get("boss", false)), bool(enemy.get("elite", false)))
			var target_size := 1.0
			if bool(enemy.get("elite", false)):
				target_size = 1.55
			if bool(enemy.get("boss", false)):
				target_size = 2.5
			node = _instantiate_model(AssetRegistry.model_for_enemy(str(enemy["id"])), color, target_size)
			node.name = instance_id
			enemy_root.add_child(node)
			_add_health_bar(node)
			enemy_nodes[instance_id] = node
		var position: Vector2 = enemy["position"]
		var target := Vector3(position.x - 12.0, 0.48 + (1.7 if bool(enemy.get("air", false)) else 0.0), position.y - 12.0)
		node.position = node.position.lerp(target, 0.42)
		_update_health_bar(node, float(enemy["hp_ratio"]))
		_update_telegraph(node, not str(enemy.get("telegraph", "")).is_empty())
	for instance_id in enemy_nodes.keys():
		if not active_ids.has(instance_id):
			var old: Node3D = enemy_nodes[instance_id]
			if is_instance_valid(old):
				old.queue_free()
			enemy_nodes.erase(instance_id)

func _enemy_signal_color(id: String, boss: bool, elite: bool) -> Color:
	if boss:
		return {
			"noise_hive": Color("ff315f"),
			"mirror_censor": Color("f255c9"),
			"memory_reforger": Color("ff754b"),
			"bandwidth_requisitioner": Color("d63bff"),
			"chorus_overseer": Color("ffb13b"),
			"zero_frequency_mind": Color("b127ff"),
		}.get(id, Color("ff254f"))
	if elite:
		return Color("ff5b9b")
	return Color("e83d91")

func _refresh_preview() -> void:
	for child in preview_root.get_children():
		child.queue_free()
	if preview_cell.x < 0 or preview_cell.y < 0 or preview_cell.x >= GameDefs.BOARD_SIZE or preview_cell.y >= GameDefs.BOARD_SIZE:
		return
	var height := int(run.heights[preview_cell.y][preview_cell.x])
	var selection := _instantiate_model(AssetRegistry.KENNEY_TOWER + "selection-a.glb", Color("42e8ba") if preview_valid else Color("ff496c"), 0.98)
	selection.position = _cell_world(preview_cell, height) + Vector3(0.0, 0.18, 0.0)
	preview_root.add_child(selection)
	if selected_tower_id.is_empty():
		if terrain_preview_delta != 0 and preview_valid:
			_draw_terrain_route_preview()
		return
	var tower := run.get_tower(selected_tower_id)
	if tower.is_empty():
		return
	var range_value := RuleService.attack_range(tower, height)
	var ring_mesh := ImmediateMesh.new()
	var material := StandardMaterial3D.new()
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.albedo_color = Color(0.25, 0.95, 0.85, 0.8) if preview_valid else Color(1.0, 0.2, 0.35, 0.8)
	ring_mesh.surface_begin(Mesh.PRIMITIVE_LINE_STRIP, material)
	for i in 65:
		var angle := TAU * float(i) / 64.0
		ring_mesh.surface_add_vertex(Vector3(cos(angle) * range_value, 0.08, sin(angle) * range_value))
	ring_mesh.surface_end()
	var ring := MeshInstance3D.new()
	ring.mesh = ring_mesh
	ring.position = _cell_world(preview_cell, height)
	preview_root.add_child(ring)

func _draw_terrain_route_preview() -> void:
	var preview_heights := run.heights.duplicate(true)
	preview_heights[preview_cell.y][preview_cell.x] = clampi(int(preview_heights[preview_cell.y][preview_cell.x]) + terrain_preview_delta, 0, 3)
	var route_mesh := ImmediateMesh.new()
	var material := StandardMaterial3D.new()
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.albedo_color = Color(0.96, 0.67, 0.25, 0.92)
	material.emission_enabled = true
	material.emission = material.albedo_color
	route_mesh.surface_begin(Mesh.PRIMITIVE_LINES, material)
	for entry in GameDefs.ENTRY_CELLS.values():
		var path := RuleService.path_to_core(entry, preview_heights, run.towers)
		for index in range(maxi(0, path.size() - 1)):
			var from: Vector2i = path[index]
			var to: Vector2i = path[index + 1]
			var from_height := int(preview_heights[from.y][from.x])
			var to_height := int(preview_heights[to.y][to.x])
			route_mesh.surface_add_vertex(_cell_world(from, from_height) + Vector3(0.0, 0.32, 0.0))
			route_mesh.surface_add_vertex(_cell_world(to, to_height) + Vector3(0.0, 0.32, 0.0))
	route_mesh.surface_end()
	var routes := MeshInstance3D.new()
	routes.name = "AffectedRoutes"
	routes.mesh = route_mesh
	preview_root.add_child(routes)

func _instantiate_model(path: String, tint: Color, target_size: float) -> Node3D:
	var root := Node3D.new()
	if ResourceLoader.exists(path):
		var packed := load(path) as PackedScene
		if packed != null:
			var instance := packed.instantiate()
			root.add_child(instance)
			var bounds := _node_bounds(instance)
			var extent := maxf(maxf(bounds.size.x, bounds.size.y), bounds.size.z)
			if extent > 0.001:
				instance.scale = Vector3.ONE * (target_size / extent)
			_tint_meshes(instance, tint)
			return root
	var fallback := MeshInstance3D.new()
	var mesh := CylinderMesh.new()
	mesh.top_radius = target_size * 0.28
	mesh.bottom_radius = target_size * 0.45
	mesh.height = target_size
	fallback.mesh = mesh
	var material := _industrial_material(tint)
	fallback.material_override = material
	root.add_child(fallback)
	return root

func _extract_mesh(path: String) -> Mesh:
	if not ResourceLoader.exists(path):
		return null
	var packed := load(path) as PackedScene
	if packed == null:
		return null
	var instance := packed.instantiate()
	var result := _find_mesh(instance)
	if result != null:
		var material := _industrial_material(Color("394850"))
		for surface in result.get_surface_count():
			result.surface_set_material(surface, material)
	instance.free()
	return result

func _find_mesh(node: Node) -> Mesh:
	if node is MeshInstance3D and node.mesh != null:
		return node.mesh.duplicate()
	for child in node.get_children():
		var found := _find_mesh(child)
		if found != null:
			return found
	return null

func _node_bounds(node: Node) -> AABB:
	var bounds := AABB()
	var initialized := false
	if node is MeshInstance3D and node.mesh != null:
		bounds = node.mesh.get_aabb()
		initialized = true
	for child in node.get_children():
		var child_bounds := _node_bounds(child)
		if child_bounds.size.length() > 0.0:
			bounds = bounds.merge(child_bounds) if initialized else child_bounds
			initialized = true
	return bounds

func _tint_meshes(node: Node, tint: Color) -> void:
	if node is MeshInstance3D:
		node.material_override = _industrial_material(tint)
	for child in node.get_children():
		_tint_meshes(child, tint)

func _industrial_material(color: Color) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.metallic = 0.72
	material.roughness = 0.38
	material.emission_enabled = true
	material.emission = color * 0.18
	material.emission_energy_multiplier = 0.65
	material.vertex_color_use_as_albedo = true
	return material

func _add_health_bar(node: Node3D) -> void:
	var background := MeshInstance3D.new()
	background.name = "HealthBack"
	var back_mesh := BoxMesh.new()
	back_mesh.size = Vector3(1.0, 0.07, 0.05)
	background.mesh = back_mesh
	background.position = Vector3(0.0, 1.25, 0.0)
	background.material_override = _industrial_material(Color("241722"))
	node.add_child(background)
	var fill := MeshInstance3D.new()
	fill.name = "HealthFill"
	var fill_mesh := BoxMesh.new()
	fill_mesh.size = Vector3(1.0, 0.08, 0.06)
	fill.mesh = fill_mesh
	fill.position = Vector3(0.0, 1.25, -0.01)
	fill.material_override = _industrial_material(Color("e83d91"))
	node.add_child(fill)

func _update_health_bar(node: Node3D, ratio: float) -> void:
	var fill := node.get_node_or_null("HealthFill") as MeshInstance3D
	if fill != null:
		fill.scale.x = clampf(ratio, 0.0, 1.0)
		fill.position.x = (fill.scale.x - 1.0) * 0.5

func _update_telegraph(node: Node3D, active: bool) -> void:
	var ring := node.get_node_or_null("AbilityTelegraph") as MeshInstance3D
	if ring == null and active:
		ring = MeshInstance3D.new()
		ring.name = "AbilityTelegraph"
		var torus := TorusMesh.new()
		torus.inner_radius = 0.78
		torus.outer_radius = 0.94
		torus.rings = 20
		torus.ring_segments = 8
		ring.mesh = torus
		ring.position = Vector3(0.0, 0.12, 0.0)
		ring.material_override = _industrial_material(Color("ffb43b"))
		node.add_child(ring)
	if ring != null:
		ring.visible = active
		if active:
			var pulse := 1.0 + sin(Time.get_ticks_msec() * 0.018) * 0.12
			ring.scale = Vector3.ONE * pulse

func _cell_world(cell: Vector2i, height: int) -> Vector3:
	return Vector3(float(cell.x - 12), float(height) * 0.72, float(cell.y - 12))

func _terrain_hash() -> int:
	return JSON.stringify(run.heights).hash()
