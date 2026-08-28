class_name MapGraphView
extends Control

signal node_selected(node_id: String)

const LANE_X := [110.0, 250.0, 390.0, 530.0, 670.0]
const FLOOR_GAP := 92.0

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
	if run == null or run.current_act().is_empty():
		return
	var act := run.current_act()
	var floors: Array = act["floors"]
	custom_minimum_size = Vector2(800.0, 150.0 + float(floors.size()) * FLOOR_GAP)
	for floor_nodes in floors:
		for node in floor_nodes:
			var floor_index := int(node["floor"])
			var lane := int(node["lane"])
			var position := Vector2(LANE_X[lane], custom_minimum_size.y - 90.0 - float(floor_index) * FLOOR_GAP)
			node_positions[str(node["id"])] = position + Vector2(30.0, 26.0)
			var button := Button.new()
			button.name = str(node["id"])
			button.position = position
			button.size = Vector2(62.0, 54.0)
			button.text = _node_symbol(node)
			button.tooltip_text = _node_tooltip(node)
			button.disabled = not bool(node.get("available", false)) or bool(node.get("completed", false))
			button.modulate = _node_color(node)
			if bool(node.get("completed", false)):
				button.text = "✓"
			button.pressed.connect(func() -> void: node_selected.emit(str(node["id"])))
			add_child(button)
			node_buttons[str(node["id"])] = button
	queue_redraw()

func _draw() -> void:
	if run == null:
		return
	for floor_nodes in run.current_act().get("floors", []):
		for node in floor_nodes:
			var from: Vector2 = node_positions.get(str(node["id"]), Vector2.ZERO)
			for connection in node.get("connections", []):
				var to: Vector2 = node_positions.get(str(connection), Vector2.ZERO)
				if to == Vector2.ZERO:
					continue
				var color: Color = Color(0.22, 0.8, 0.83, 0.75) if bool(node.get("completed", false)) or bool(node.get("available", false)) else Color(0.28, 0.36, 0.42, 0.48)
				draw_line(from, to, color, 3.0, true)

func _node_symbol(node: Dictionary) -> String:
	var type_id := str(node.get("display_type", node.get("type", "unknown")))
	return {
		"combat": "战",
		"elite": "精",
		"camp": "营",
		"workshop": "工",
		"shop": "店",
		"treasure": "藏",
		"event": "事",
		"unknown": "？",
		"boss": "首",
	}.get(type_id, "？")

func _node_color(node: Dictionary) -> Color:
	var type_id := str(node.get("display_type", node.get("type", "unknown")))
	return {
		"combat": Color("57b7ca"),
		"elite": Color("e95479"),
		"camp": Color("63ca8a"),
		"workshop": Color("d29b55"),
		"shop": Color("cfb04b"),
		"treasure": Color("a47be0"),
		"event": Color("6694dc"),
		"unknown": Color("7d8994"),
		"boss": Color("ff365f"),
	}.get(type_id, Color.WHITE)

func _node_tooltip(node: Dictionary) -> String:
	var type_id := str(node.get("display_type", node.get("type", "unknown")))
	var descriptions := {
		"combat": "普通战斗\n风险：标准编队\n收益：单位选择、专注、8精神恢复，20%收藏品机会",
		"elite": "精英战斗\n风险：包含一名功能精英\n收益：大量专注、12精神恢复、保证收藏品",
		"camp": "营地\n恢复30%精神、免费维修或免费升级，三选一",
		"workshop": "工坊\n可反复支付专注维修或升级，主动离开",
		"shop": "商店\n三个单位与三个未持有收藏品，可购买多个",
		"treasure": "宝库\n免费选择一件收藏品",
		"event": "事件\n两个结果清楚的交换选择",
		"unknown": "未知节点\n只公开：可能为事件、战斗、商店或宝库\n结果已由本局种子确定",
		"boss": "首领战\n综合检验本幕构筑，机制情报会逐步公开",
	}
	return "%s\n连接：%s" % [descriptions.get(type_id, "未知"), ", ".join(node.get("connections", []))]
