extends SceneTree

const FRAME_SIZE := 48
const SOURCE_ROOT := "res://development/assets/model_sources/kenney/"
const SOURCE_MODELS := {
	"towers/anchor_bulwark": SOURCE_ROOT + "tower-defense-kit/tower-round-bottom-a.glb",
	"towers/phase_blade": SOURCE_ROOT + "tower-defense-kit/tower-round-top-b.glb",
	"towers/boundary_riveter": SOURCE_ROOT + "tower-defense-kit/tower-square-bottom-b.glb",
	"towers/resonance_guard": SOURCE_ROOT + "tower-defense-kit/tower-round-middle-b.glb",
	"towers/pulse_array": SOURCE_ROOT + "space-kit/turret_single.glb",
	"towers/focus_rail": SOURCE_ROOT + "space-kit/turret_double.glb",
	"towers/arc_mortar": SOURCE_ROOT + "tower-defense-kit/weapon-cannon.glb",
	"towers/drone_loom": SOURCE_ROOT + "space-kit/satelliteDish_detailed.glb",
	"towers/bandwidth_relay": SOURCE_ROOT + "space-kit/machine_wireless.glb",
	"towers/memory_mechanic": SOURCE_ROOT + "space-kit/machine_generator.glb",
	"towers/frequency_choir": SOURCE_ROOT + "space-kit/satelliteDish_large.glb",
	"towers/resistance_beacon": SOURCE_ROOT + "tower-defense-kit/tower-round-top-a.glb",
	"enemies/static_drifter": SOURCE_ROOT + "space-kit/craft_cargoA.glb",
	"enemies/spike_runner": SOURCE_ROOT + "space-kit/craft_speederA.glb",
	"enemies/shield_echo": SOURCE_ROOT + "space-kit/craft_cargoB.glb",
	"enemies/tempo_amplifier": SOURCE_ROOT + "space-kit/craft_speederB.glb",
	"enemies/fracture_seed": SOURCE_ROOT + "space-kit/alien.glb",
	"enemies/floating_noise": SOURCE_ROOT + "tower-defense-kit/enemy-ufo-a.glb",
	"enemies/remote_hunter": SOURCE_ROOT + "space-kit/craft_racer.glb",
	"enemies/siege_ram": SOURCE_ROOT + "space-kit/craft_miner.glb",
	"enemies/memory_medic": SOURCE_ROOT + "space-kit/machine_generator.glb",
	"enemies/bandwidth_jammer": SOURCE_ROOT + "space-kit/machine_wireless.glb",
	"enemies/phase_teleporter": SOURCE_ROOT + "space-kit/craft_speederC.glb",
	"enemies/replication_node": SOURCE_ROOT + "space-kit/craft_cargoB.glb",
	"enemies/pressure_cantor": SOURCE_ROOT + "tower-defense-kit/enemy-ufo-b.glb",
	"enemies/armored_worm": SOURCE_ROOT + "space-kit/craft_miner.glb",
	"enemies/shield_conductor": SOURCE_ROOT + "tower-defense-kit/enemy-ufo-c.glb",
	"enemies/signal_summoner": SOURCE_ROOT + "space-kit/machine_generatorLarge.glb",
	"enemies/resistance_corruptor": SOURCE_ROOT + "tower-defense-kit/enemy-ufo-d.glb",
	"enemies/detonation_shell": SOURCE_ROOT + "space-kit/craft_speederD.glb",
	"enemies/frequency_hunter": SOURCE_ROOT + "space-kit/turret_double.glb",
	"enemies/terrain_dismantler": SOURCE_ROOT + "space-kit/craft_miner.glb",
	"enemies/proliferation_protocol": SOURCE_ROOT + "space-kit/machine_generatorLarge.glb",
	"enemies/spirit_taxer": SOURCE_ROOT + "tower-defense-kit/enemy-ufo-d.glb",
	"enemies/noise_hive": SOURCE_ROOT + "space-kit/hangar_largeA.glb",
	"enemies/mirror_censor": SOURCE_ROOT + "tower-defense-kit/enemy-ufo-c.glb",
	"enemies/memory_reforger": SOURCE_ROOT + "space-kit/machine_generatorLarge.glb",
	"enemies/bandwidth_requisitioner": SOURCE_ROOT + "space-kit/gate_complex.glb",
	"enemies/chorus_overseer": SOURCE_ROOT + "space-kit/satelliteDish_large.glb",
	"enemies/zero_frequency_mind": SOURCE_ROOT + "modular-space-kit/gate.glb",
}

var viewport: SubViewport
var stage: Node3D
var model_holder: Node3D

func _initialize() -> void:
	call_deferred("_bake_all")

func _bake_all() -> void:
	_build_stage()
	await process_frame
	for sprite_id in SOURCE_MODELS:
		var source_path := str(SOURCE_MODELS[sprite_id])
		if not FileAccess.file_exists(source_path):
			push_error("Missing sprite source: %s" % source_path)
			quit(1)
			return
		var atlas := Image.create_empty(FRAME_SIZE * 8, FRAME_SIZE, false, Image.FORMAT_RGBA8)
		atlas.fill(Color(0, 0, 0, 0))
		var state := GLTFState.new()
		var document := GLTFDocument.new()
		var load_error := document.append_from_file(ProjectSettings.globalize_path(source_path), state)
		if load_error != OK:
			push_error("Could not parse sprite source %s: %d" % [source_path, load_error])
			quit(1)
			return
		var instance := document.generate_scene(state)
		model_holder.add_child(instance)
		_fit_model(instance)
		_tint_model(instance, PixelTheme.FRIENDLY if str(sprite_id).begins_with("towers/") else PixelTheme.HOSTILE)
		for direction_index in 8:
			model_holder.rotation.y = -TAU * float(direction_index) / 8.0
			await process_frame
			await process_frame
			var frame := viewport.get_texture().get_image()
			frame.resize(FRAME_SIZE, FRAME_SIZE, Image.INTERPOLATE_NEAREST)
			frame = _with_outline(frame, PixelTheme.BACKGROUND)
			atlas.blit_rect(frame, Rect2i(Vector2i.ZERO, Vector2i(FRAME_SIZE, FRAME_SIZE)), Vector2i(direction_index * FRAME_SIZE, 0))
		instance.queue_free()
		await process_frame
		var output := "res://assets/game/sprites/%s.png" % sprite_id
		DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(output.get_base_dir()))
		var error := atlas.save_png(ProjectSettings.globalize_path(output))
		if error != OK:
			push_error("Could not save %s: %d" % [output, error])
			quit(1)
			return
		print("BAKED_PIXEL_SPRITE %s" % output)
	print("PIXEL_SPRITE_BAKE_OK count=%d" % SOURCE_MODELS.size())
	quit(0)

func _build_stage() -> void:
	viewport = SubViewport.new()
	viewport.size = Vector2i(96, 96)
	viewport.transparent_bg = true
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	viewport.msaa_3d = Viewport.MSAA_DISABLED
	root.add_child(viewport)
	stage = Node3D.new()
	viewport.add_child(stage)
	model_holder = Node3D.new()
	stage.add_child(model_holder)
	var camera := Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = 2.6
	camera.position = Vector3(3.8, 2.8, 4.8)
	camera.look_at_from_position(camera.position, Vector3(0, 0.72, 0), Vector3.UP)
	camera.current = true
	stage.add_child(camera)
	var key := DirectionalLight3D.new()
	key.rotation_degrees = Vector3(-55, -35, 0)
	key.light_color = Color("f4ecd8")
	key.light_energy = 1.35
	stage.add_child(key)
	var fill := DirectionalLight3D.new()
	fill.rotation_degrees = Vector3(-30, 145, 0)
	fill.light_color = Color("67e3c1")
	fill.light_energy = 0.55
	stage.add_child(fill)
	var environment_node := WorldEnvironment.new()
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color(0, 0, 0, 0)
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("8fb4ad")
	environment.ambient_light_energy = 0.55
	environment_node.environment = environment
	stage.add_child(environment_node)

func _fit_model(node: Node) -> void:
	var bounds := _bounds(node, Transform3D.IDENTITY)
	var extent := maxf(maxf(bounds.size.x, bounds.size.y), bounds.size.z)
	if extent <= 0.001:
		return
	var scale_value := 2.0 / extent
	node.scale = Vector3.ONE * scale_value
	node.position = Vector3(-bounds.get_center().x * scale_value, -bounds.position.y * scale_value, -bounds.get_center().z * scale_value)

func _bounds(node: Node, parent_transform: Transform3D) -> AABB:
	var result := AABB()
	var initialized := false
	var current_transform := parent_transform
	if node is Node3D:
		current_transform = parent_transform * (node as Node3D).transform
	if node is MeshInstance3D and node.mesh != null:
		result = current_transform * node.mesh.get_aabb()
		initialized = true
	for child in node.get_children():
		var child_bounds := _bounds(child, current_transform)
		if child_bounds.size.length_squared() > 0.0:
			result = result.merge(child_bounds) if initialized else child_bounds
			initialized = true
	return result

func _tint_model(node: Node, tint: Color) -> void:
	if node is MeshInstance3D:
		var material := StandardMaterial3D.new()
		material.albedo_color = tint
		material.roughness = 0.82
		material.metallic = 0.15
		material.vertex_color_use_as_albedo = true
		node.material_override = material
	for child in node.get_children():
		_tint_model(child, tint)

func _with_outline(source: Image, color: Color) -> Image:
	var output := source.duplicate()
	for y in source.get_height():
		for x in source.get_width():
			if source.get_pixel(x, y).a > 0.08:
				continue
			var neighbor_found := false
			for offset in [Vector2i.LEFT, Vector2i.RIGHT, Vector2i.UP, Vector2i.DOWN, Vector2i(-1, -1), Vector2i(1, -1), Vector2i(-1, 1), Vector2i(1, 1)]:
				var neighbor: Vector2i = Vector2i(x, y) + offset
				if neighbor.x >= 0 and neighbor.y >= 0 and neighbor.x < source.get_width() and neighbor.y < source.get_height() and source.get_pixelv(neighbor).a > 0.14:
					neighbor_found = true
					break
			if neighbor_found:
				output.set_pixel(x, y, color)
	return output
