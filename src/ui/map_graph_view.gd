class_name MapGraphView
extends Control

signal node_selected(node_id: String)

const LANE_X := [92.0, 236.0, 380.0, 524.0, 668.0]
const FLOOR_GAP := 94.0
const NODE_SIZE := Vector2(54.0, 54.0)

var run: RunState
var catalog: ContentCatalog
var node_positions: Dictionary = {}
var node_buttons: Dictionary = {}

func setup(run_state: RunState, content: ContentCatalog) -> void:
	run = run_state
	catalog = content
	_rebuild()

func _rebuild() -> void:
	for child in get_children():
		child.queue_free()
	node_positions.clear()
	node_buttons.clear()
	var act := run.current_act()
	var floors: Array = act.get("floors", [])
	custom_minimum_size = Vector2(760.0, 150.0 + float(floors.size()) * FLOOR_GAP)
	for floor_index in floors.size():
		for node in floors[floor_index]:
			var lane := int(node.get("lane", 2))
			var position := Vector2(LANE_X[lane], custom_minimum_size.y - 90.0 - float(floor_index) * FLOOR_GAP)
			node_positions[str(node["id"])] = position + NODE_SIZE * 0.5
			var button := TextureButton.new()
			button.name = "Node_%d_%d" % [floor_index, lane]
			button.position = position
			button.size = NODE_SIZE
			button.ignore_texture_size = true
			button.stretch_mode = TextureButton.STRETCH_KEEP_ASPECT_CENTERED
			button.texture_normal = PixelTheme.icon(str(node.get("map_icon_id", node.get("display_type", "unknown"))))
			button.texture_hover = button.texture_normal
			button.disabled = not bool(node.get("available", false)) or bool(node.get("completed", false))
			button.self_modulate = _node_color(node)
			button.tooltip_text = _node_tooltip(node)
			button.mouse_entered.connect(func() -> void:
				button.scale = Vector2(1.12, 1.12)
				button.pivot_offset = NODE_SIZE * 0.5
			)
			button.mouse_exited.connect(func() -> void: button.scale = Vector2.ONE)
			button.pressed.connect(func() -> void: node_selected.emit(str(node["id"])))
			add_child(button)
			node_buttons[str(node["id"])] = button
			_add_state_badge(button, node)
	queue_redraw()

func _add_state_badge(button: TextureButton, node: Dictionary) -> void:
	var state := ""
	if bool(node.get("completed", false)):
		state = "completed"
	elif not bool(node.get("available", false)):
		state = "locked"
	if state.is_empty():
		return
	var badge := TextureRect.new()
	badge.texture = PixelTheme.icon(state)
	badge.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	badge.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	badge.position = Vector2(34, 34)
	badge.size = Vector2(20, 20)
	badge.mouse_filter = Control.MOUSE_FILTER_IGNORE
	button.add_child(badge)

func _draw() -> void:
	if run == null:
		return
	for floor_nodes in run.current_act().get("floors", []):
		for node in floor_nodes:
			var from_id := str(node["id"])
			if not node_positions.has(from_id):
				continue
			for target_id in node.get("connections", []):
				if not node_positions.has(str(target_id)):
					continue
				var target := run.find_node(str(target_id))
				var available_path := bool(target.get("available", false)) or bool(node.get("completed", false))
				var color := PixelTheme.FRIENDLY if available_path else PixelTheme.MUTED
				color.a = 0.95 if available_path else 0.22
				if bool(node.get("completed", false)):
					draw_line(node_positions[from_id], node_positions[str(target_id)], color, 4.0)
				else:
					_draw_dotted_line(node_positions[from_id], node_positions[str(target_id)], color)

func _draw_dotted_line(from: Vector2, to: Vector2, color: Color) -> void:
	var distance := from.distance_to(to)
	var direction := from.direction_to(to)
	var cursor := 0.0
	while cursor < distance:
		var segment_end := minf(distance, cursor + 7.0)
		draw_line(from + direction * cursor, from + direction * segment_end, color, 3.0)
		cursor += 13.0

func _node_color(node: Dictionary) -> Color:
	if bool(node.get("completed", false)):
		return PixelTheme.MUTED.darkened(0.15)
	if bool(node.get("available", false)):
		return PixelTheme.RESOURCE if str(node.get("type", "")) in ["elite", "boss"] else PixelTheme.FRIENDLY
	return Color(0.42, 0.52, 0.52, 0.38)

func _node_tooltip(node: Dictionary) -> String:
	var type_id := str(node.get("display_type", node.get("type", "unknown")))
	var names := {
		"combat":"普通战斗", "elite":"精英战斗", "camp":"营地", "workshop":"工坊",
		"shop":"商店", "treasure":"宝库", "event":"事件", "unknown":"未知", "boss":"首领战",
	}
	var connection_count: int = int(node.get("connections", []).size())
	return "%s\n风险：%s\n主要收益：%s\n后续分支：%d" % [names.get(type_id, "未知节点"), node.get("risk_text", "未知"), node.get("reward_text", "未知"), connection_count]
