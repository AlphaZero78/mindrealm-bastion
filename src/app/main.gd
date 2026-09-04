extends Node

const FIXED_STEP := 0.05
const PRESSURE_TEXT := [
	"标准难度：完整规则，无额外惩罚。",
	"敌人生命提高8%。",
	"敌人攻击提高10%。",
	"困难敌人提前一幕出现。",
	"功能型敌人比例提高8%。",
	"营地恢复由30%降低到24%。",
	"死亡压力提高15%。",
	"节点服务价格提高15%，开局专注降至89。",
	"带宽干扰额外降低2点上限。",
	"首领获得一项额外招式。",
	"敌人生命与攻击再提高12%，死亡压力再提高10%。",
]

var catalog: ContentCatalog
var run: RunState
var profile: Dictionary
var audio: AudioDirector
var battlefield: BattlefieldView
var simulation: BattleSimulation
var ui_layer: CanvasLayer
var ui_root: Control
var screen_state := GameDefs.ScreenState.MENU
var fixed_accumulator := 0.0
var battle_speed := 1.0
var battle_paused := false
var selected_tower_id := ""
var terrain_delta := 0
var terrain_tool := ""
var terrain_brush := "single"
var terrain_slope := "north"
var terrain_line_start := Vector2i(-1, -1)
var status_label: Label
var resource_label: Label
var resource_fields: Dictionary = {}
var compass_label: Label
var threat_label: RichTextLabel
var battle_log: RichTextLabel
var battle_progress: Label
var confirm_dialog: ConfirmationDialog
var popup_panel: PanelContainer
var _screen_refresh_timer := 0.0
var _middle_pan_active := false
var pixel_theme: Theme

func _ready() -> void:
	get_tree().auto_accept_quit = false
	catalog = ContentCatalog.create_default()
	if not catalog.errors.is_empty():
		push_error("内容目录校验失败：\n%s" % "\n".join(catalog.errors))
	profile = SaveService.load_profile()
	pixel_theme = PixelTheme.create_theme()
	audio = AudioDirector.new()
	add_child(audio)
	audio.setup()
	ui_layer = CanvasLayer.new()
	ui_layer.layer = 10
	add_child(ui_layer)
	ui_root = Control.new()
	ui_root.position = Vector2.ZERO
	ui_root.size = Vector2(1600, 900)
	ui_root.scale = Vector2(0.4, 0.4)
	ui_root.theme = pixel_theme
	ui_layer.add_child(ui_root)
	confirm_dialog = ConfirmationDialog.new()
	confirm_dialog.title = "确认"
	confirm_dialog.ok_button_text = "确认"
	confirm_dialog.cancel_button_text = "取消"
	confirm_dialog.theme = pixel_theme
	ui_layer.add_child(confirm_dialog)
	show_menu()
	if bool(profile.get("dev_reset_notice_pending", false)):
		profile["dev_reset_notice_pending"] = false
		SaveService.save_profile(profile)
		call_deferred("show_message", "开发版本已更新", "地形与路线结构已升级到存档版本2，旧开发存档已清除。")
	if "--smoke-test" in OS.get_cmdline_args() or "--smoke-test" in OS.get_cmdline_user_args():
		await get_tree().process_frame
		await get_tree().process_frame
		audio.shutdown()
		var tree := get_tree()
		print("MINDREALM_RELEASE_SMOKE_OK")
		tree.create_timer(0.1).timeout.connect(tree.quit, CONNECT_ONE_SHOT)
		tree.current_scene.queue_free()

func _process(delta: float) -> void:
	if battlefield != null and is_instance_valid(battlefield) and screen_state in [GameDefs.ScreenState.PREBATTLE, GameDefs.ScreenState.BATTLE]:
		var pan_input := Input.get_vector("camera_left", "camera_right", "camera_forward", "camera_back")
		if pan_input.length_squared() > 0.0:
			battlefield.pan_camera(pan_input * delta * 8.0)
		var rotate_direction := int(Input.is_action_pressed("camera_rotate_right")) - int(Input.is_action_pressed("camera_rotate_left"))
		if rotate_direction != 0:
			battlefield.rotate_camera(rotate_direction, delta)
	if screen_state == GameDefs.ScreenState.BATTLE and simulation != null and not simulation.finished and not battle_paused:
		fixed_accumulator += delta * battle_speed
		while fixed_accumulator >= FIXED_STEP:
			simulation.step(FIXED_STEP)
			fixed_accumulator -= FIXED_STEP
		if battlefield != null:
			battlefield.refresh_all()
		_screen_refresh_timer -= delta
		if _screen_refresh_timer <= 0.0:
			_screen_refresh_timer = 0.2
			refresh_hud()
		audio.set_battle_danger(simulation.danger_level, run.resolved_node_type(run.pending_node) == "boss")

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		if popup_panel != null and is_instance_valid(popup_panel):
			popup_panel.queue_free()
			popup_panel = null
			return
		if screen_state == GameDefs.ScreenState.PREBATTLE:
			cancel_action()
			return
	if battlefield == null or not is_instance_valid(battlefield):
		return
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_MIDDLE:
		_middle_pan_active = event.pressed
		get_viewport().set_input_as_handled()
		return
	if event is InputEventMouseMotion and _middle_pan_active:
		battlefield.pan_camera(Vector2(-event.relative.x, -event.relative.y) * 0.018)
		get_viewport().set_input_as_handled()
		return
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_WHEEL_UP:
		battlefield.zoom_camera(-1.8)
		return
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
		battlefield.zoom_camera(1.8)
		return
	if event.is_action_pressed("camera_focus"):
		battlefield.focus_core()
	elif event.is_action_pressed("camera_zoom_in"):
		battlefield.zoom_camera(-1.8)
	elif event.is_action_pressed("camera_zoom_out"):
		battlefield.zoom_camera(1.8)
	if screen_state != GameDefs.ScreenState.PREBATTLE:
		return
	if event is InputEventMouseMotion:
		update_board_preview(event.position)
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
		apply_board_action(event.position)
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_RIGHT and event.pressed:
		cancel_action()

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST:
		if run != null and not run.run_complete:
			if screen_state == GameDefs.ScreenState.BATTLE and not run.prebattle_snapshot.is_empty():
				run = run.restore_prebattle()
			SaveService.save_run(run)
		get_tree().quit()

func _exit_tree() -> void:
	if audio != null and is_instance_valid(audio):
		audio.shutdown()

func show_menu() -> void:
	screen_state = GameDefs.ScreenState.MENU
	clear_world()
	clear_ui()
	audio.play_state("menu")
	var background := ColorRect.new()
	background.color = PixelTheme.BACKGROUND
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	ui_root.add_child(background)
	for band_index in 12:
		var band := ColorRect.new()
		var band_color := PixelTheme.FRIENDLY
		band_color.a = 0.035 if band_index % 2 == 0 else 0.018
		band.color = band_color
		band.position = Vector2(0, float(band_index) * 75.0)
		band.size = Vector2(1600, 1)
		ui_root.add_child(band)
	var left := VBoxContainer.new()
	left.position = Vector2(118, 112)
	left.size = Vector2(490, 650)
	left.add_theme_constant_override("separation", 14)
	ui_root.add_child(left)
	var eyebrow := label("偏频者终端 / OFF-FREQUENCY DEFENSE", 16, Color("48dbe1"))
	left.add_child(eyebrow)
	var title := label("心 域 防 线", 54, Color("e8f2f2"))
	title.add_theme_font_size_override("font_size", 54)
	left.add_child(title)
	left.add_child(label("在被统一的世界里，守住最后一束清醒。", 20, Color("9db6be")))
	var spacer := Control.new()
	spacer.custom_minimum_size.y = 42
	left.add_child(spacer)
	left.add_child(action_button("新游戏", start_new_dialog, true))
	var continue_button := action_button("继续游戏", continue_run)
	continue_button.disabled = not SaveService.has_run()
	left.add_child(continue_button)
	left.add_child(action_button("图鉴与发现记录", show_codex))
	left.add_child(action_button("设置", show_settings))
	left.add_child(action_button("制作人员", show_credits))
	left.add_child(action_button("退出", func() -> void: get_tree().quit()))
	var intel := panel_box(Vector2(770, 150), Vector2(650, 580))
	ui_root.add_child(intel)
	var intel_text := RichTextLabel.new()
	intel_text.bbcode_enabled = true
	intel_text.fit_content = true
	intel_text.text = "[font_size=24][color=#48dbe1]醒觉火种信号：稳定[/color][/font_size]\n\n" + \
		"统治网络正在用审查噪声覆盖大众意识。你是能够改变精神频率的偏频者。\n\n" + \
		"三幕战区 · 持久防线 · 路线构筑\n" + \
		"41×41微网格地形 · 六种首领协议\n" + \
		"一局约48层，失败原因可完整复盘\n\n" + \
		"[color=#d5a24f]首要原则[/color]\n威胁必须可读，选择必须有代价，失败必须能解释。"
	intel.add_child(intel_text)

func start_new_dialog() -> void:
	var dialog := AcceptDialog.new()
	dialog.theme = pixel_theme
	dialog.title = "建立新的精神频率"
	dialog.ok_button_text = "开始新游戏"
	var body := VBoxContainer.new()
	body.custom_minimum_size = Vector2(560, 300)
	body.add_child(label("新游戏会覆盖当前活动单局。种子决定地图、地形、首领和全部奖励。", 16, Color("d7e3e5")))
	var seed_edit := LineEdit.new()
	seed_edit.placeholder_text = "输入种子（留空使用默认种子）"
	seed_edit.text = "偏频-%s" % Time.get_date_string_from_system().replace("-", "")
	body.add_child(seed_edit)
	var pressure := HSlider.new()
	pressure.min_value = 0
	pressure.max_value = int(profile.get("max_pressure", 0))
	pressure.step = 1
	pressure.value = 0
	body.add_child(label("控制压力：0", 18, Color("d5a24f")))
	var pressure_description := label(PRESSURE_TEXT[0], 15, Color("9db6be"))
	body.add_child(pressure_description)
	var pressure_title: Label = body.get_child(2)
	pressure.value_changed.connect(func(value: float) -> void:
		pressure_title.text = "控制压力：%d" % int(value)
		var lines: Array[String] = []
		for i in range(int(value) + 1):
			lines.append(PRESSURE_TEXT[i])
		pressure_description.text = "\n".join(lines)
	)
	dialog.add_child(body)
	dialog.confirmed.connect(func() -> void:
		run = RunState.create_new(seed_edit.text, int(pressure.value), catalog)
		run.refresh_owned_content(catalog)
		SaveService.save_run(run)
		show_map()
	)
	ui_layer.add_child(dialog)
	dialog.popup_centered()

func continue_run() -> void:
	run = SaveService.load_run()
	if run == null:
		show_message("继续游戏失败", "活动存档不存在、损坏或版本不受支持。")
		return
	run.refresh_owned_content(catalog)
	if run.phase == "battle" and not run.prebattle_snapshot.is_empty():
		run = run.restore_prebattle()
		run.refresh_owned_content(catalog)
		show_message("战斗已回退", "战斗过程不作为即时存档点；已恢复到这场战斗的战前状态。")
	match run.phase:
		"map": show_map()
		"prebattle": show_prebattle()
		"node": show_node()
		"reward": show_rewards()
		"settlement": show_settlement()
		_: show_map()

func show_map() -> void:
	if run == null:
		show_menu()
		return
	screen_state = GameDefs.ScreenState.MAP
	clear_world()
	clear_ui()
	audio.play_state("map")
	var background := ColorRect.new()
	background.color = PixelTheme.BACKGROUND
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	ui_root.add_child(background)
	var header := make_header("路线 / %s" % run.current_act().get("name", ""), "地图种子 %s" % run.seed_text)
	ui_root.add_child(header)
	var left := panel_box(Vector2(38, 112), Vector2(310, 720))
	ui_root.add_child(left)
	var left_text := RichTextLabel.new()
	left_text.bbcode_enabled = true
	left_text.text = route_intel_text()
	left.add_child(left_text)
	var scroll := ScrollContainer.new()
	scroll.position = Vector2(380, 112)
	scroll.size = Vector2(850, 720)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	ui_root.add_child(scroll)
	var map_view := MapGraphView.new()
	map_view.setup(run, catalog)
	map_view.node_selected.connect(select_map_node)
	scroll.add_child(map_view)
	await get_tree().process_frame
	scroll.scroll_vertical = maxi(0, int(map_view.custom_minimum_size.y - scroll.size.y))
	var right := panel_box(Vector2(1260, 112), Vector2(300, 720))
	ui_root.add_child(right)
	var route_help := VBoxContainer.new()
	route_help.add_theme_constant_override("separation", 8)
	right.add_child(route_help)
	route_help.add_child(label("路线图例", 22, PixelTheme.RESOURCE))
	route_help.add_child(label("悬停图标查看风险、收益和后续连接。", 14, PixelTheme.MUTED))
	for type_id in ["combat", "elite", "camp", "workshop", "shop", "treasure", "event", "unknown", "boss"]:
		var row := HBoxContainer.new()
		var icon := TextureRect.new()
		icon.texture = PixelTheme.icon(type_id)
		icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		icon.custom_minimum_size = Vector2(36, 36)
		row.add_child(icon)
		var legend_label := label(node_type_name(type_id), 15, PixelTheme.TEXT)
		legend_label.custom_minimum_size.x = 190
		legend_label.autowrap_mode = TextServer.AUTOWRAP_OFF
		row.add_child(legend_label)
		route_help.add_child(row)
	route_help.add_child(label("虚线：未走路径  ·  实线：已完成\n路线确认后不能返回。", 13, PixelTheme.MUTED))

func select_map_node(node_id: String) -> void:
	var node := run.find_node(node_id)
	if node.is_empty():
		return
	var type_name := node_type_name(run.resolved_node_type(node))
	confirm_dialog.dialog_text = "确认进入：%s？\n路线选择一经确认即生效，不能返回本层。" % type_name
	for connection in confirm_dialog.confirmed.get_connections():
		confirm_dialog.confirmed.disconnect(connection.callable)
	confirm_dialog.confirmed.connect(func() -> void:
		if run.choose_node(node_id):
			SaveService.save_run(run)
			if run.phase == "prebattle":
				show_prebattle()
			else:
				show_node()
	, CONNECT_ONE_SHOT)
	confirm_dialog.popup_centered()

func show_prebattle() -> void:
	screen_state = GameDefs.ScreenState.PREBATTLE
	run.phase = "prebattle"
	clear_world()
	clear_ui()
	audio.play_state("prebattle")
	battlefield = BattlefieldView.new()
	add_child(battlefield)
	battlefield.setup(run, catalog)
	build_prebattle_ui()
	SaveService.save_run(run)

func build_prebattle_ui() -> void:
	var top := panel_box(Vector2(24, 18), Vector2(1552, 72))
	ui_root.add_child(top)
	top.add_child(build_resource_strip())
	compass_label = label("", 18, PixelTheme.FRIENDLY)
	compass_label.position = Vector2(1388, 24)
	compass_label.size = Vector2(160, 34)
	compass_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	ui_root.add_child(compass_label)
	var left := panel_box(Vector2(24, 106), Vector2(286, 520))
	ui_root.add_child(left)
	threat_label = RichTextLabel.new()
	threat_label.bbcode_enabled = true
	threat_label.text = threat_text()
	left.add_child(threat_label)
	var right := panel_box(Vector2(1278, 106), Vector2(298, 650))
	ui_root.add_child(right)
	var inspector := VBoxContainer.new()
	inspector.name = "Inspector"
	inspector.add_theme_constant_override("separation", 8)
	right.add_child(inspector)
	inspector.add_child(label("构造 / 地形", 22, PixelTheme.FRIENDLY))
	inspector.add_child(label("从仓库选择构造，再点击战场格位。\n右键或 Esc 取消当前操作。", 14, Color("a5bac0")))
	var brush_row := HBoxContainer.new()
	brush_row.add_child(compact_button("1格", func() -> void: choose_terrain_brush("single")))
	brush_row.add_child(compact_button("3×3", func() -> void: choose_terrain_brush("square")))
	brush_row.add_child(compact_button("直线", func() -> void: choose_terrain_brush("line")))
	inspector.add_child(brush_row)
	var tool_grid := GridContainer.new()
	tool_grid.columns = 2
	tool_grid.add_child(compact_button("升高 ·2/格", func() -> void: choose_terrain_tool("raise")))
	tool_grid.add_child(compact_button("降低 ·2/格", func() -> void: choose_terrain_tool("lower")))
	tool_grid.add_child(compact_button("斜坡 ↻", func() -> void: choose_terrain_tool("slope")))
	tool_grid.add_child(compact_button("铲平", func() -> void: choose_terrain_tool("flatten")))
	inspector.add_child(tool_grid)
	inspector.add_child(compact_button("撤销地形并退款", undo_terrain))
	inspector.add_child(compact_button("取消操作", cancel_action))
	inspector.add_child(action_button("锁定防线 · 开战", confirm_start_battle, true))
	var bottom := panel_box(Vector2(330, 692), Vector2(928, 184))
	ui_root.add_child(bottom)
	var warehouse := VBoxContainer.new()
	bottom.add_child(warehouse)
	warehouse.add_child(label("构造仓库 / 点击选择，首次部署免费", 17, Color("d5a24f")))
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(900, 124)
	warehouse.add_child(scroll)
	var cards := HBoxContainer.new()
	cards.add_theme_constant_override("separation", 8)
	scroll.add_child(cards)
	for tower in run.towers:
		var card := Button.new()
		card.custom_minimum_size = Vector2(144, 112)
		card.icon = atlas_frame_icon(AssetRegistry.sprite_for_tower(str(tower.get("sprite_id", tower["id"]))))
		card.expand_icon = true
		card.text = "%s\nT%d %s\n耐久 %.0f/%.0f\n带宽 %d%s" % [
			tower["name"], tower["tier"], role_name(str(tower["role"])),
			tower["durability"], tower["max_durability"], tower["bandwidth"],
			"\n已部署" if tower["deployed"] else "\n仓库",
		]
		card.tooltip_text = "%s\n攻击 %.0f / 射程 %.1f / 维护 %d\n%s" % [tower["description"], tower["attack"], tower["range"], tower["upkeep"], tower["ability"]]
		card.pressed.connect(func() -> void: select_tower(str(tower["instance_id"])))
		cards.add_child(card)
	status_label = label("选择构造或地形工具。", 15, Color("e7d59a"))
	status_label.position = Vector2(330, 654)
	status_label.size = Vector2(928, 32)
	status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	ui_root.add_child(status_label)
	add_tutorial_banner(false)
	refresh_hud()

func select_tower(instance_id: String) -> void:
	selected_tower_id = instance_id
	terrain_delta = 0
	terrain_tool = ""
	terrain_line_start = Vector2i(-1, -1)
	battlefield.set_selected_tower(instance_id)
	battlefield.set_terrain_preview_command({})
	var tower := run.get_tower(instance_id)
	status("已选择 %s：移动鼠标预览完整占地、射程和合法性。" % tower.get("name", ""), true)
	show_tower_inspector(tower)

func show_tower_inspector(tower: Dictionary) -> void:
	var inspector := ui_root.find_child("Inspector", true, false) as VBoxContainer
	if inspector == null:
		return
	for child in inspector.get_children():
		child.queue_free()
	inspector.add_child(label(str(tower.get("name", "构造")), 22, Color("48dbe1")))
	inspector.add_child(label("%s · T%d%s\n耐久 %.0f/%.0f · 护甲 %.0f\n攻击 %.0f · 射程 %.1f · 带宽 %d\n%s\n优先级：%s" % [
		role_name(str(tower.get("role", ""))), int(tower.get("tier", 1)), str(tower.get("branch", "")),
		float(tower.get("durability", 0)), float(tower.get("max_durability", 0)), float(tower.get("armor", 0)),
		float(tower.get("attack", 0)), float(tower.get("range", 0)), int(tower.get("bandwidth", 0)),
		str(tower.get("description", "")), priority_name(str(tower.get("priority", "nearest")))
	], 14, Color("cbdadc")))
	if bool(tower.get("deployed", false)):
		inspector.add_child(action_button("搬迁（确认后支付%d专注）" % RuleService.relocation_cost(tower, run.relic_value("relocate_discount")), func() -> void: prepare_relocation(str(tower["instance_id"]))))
		inspector.add_child(action_button("收回仓库", func() -> void: confirm_recall(str(tower["instance_id"]))))
	inspector.add_child(action_button("维修（%d专注）" % RuleService.repair_cost(tower, run.repair_discount), func() -> void: repair_tower(str(tower["instance_id"]))))
	if int(tower.get("tier", 1)) < 3:
		var branch_data: Dictionary = catalog.towers[str(tower["id"])].get("branches", {})
		inspector.add_child(action_button("升级 A：%s" % branch_data.get("A", {}).get("description", branch_data.get("A", {}).get("effect", "改变职责")), func() -> void: upgrade_selected("A")))
		inspector.add_child(action_button("升级 B：%s" % branch_data.get("B", {}).get("description", branch_data.get("B", {}).get("effect", "改变职责")), func() -> void: upgrade_selected("B")))
		inspector.add_child(action_button("融合三个同型同阶", func() -> void: fuse_selected()))
	inspector.add_child(action_button("切换攻击优先级", func() -> void: cycle_priority(str(tower["instance_id"]))))
	inspector.add_child(action_button("开始战斗", confirm_start_battle, true))

func choose_terrain_mode(delta: int) -> void:
	choose_terrain_tool("raise" if delta > 0 else "lower")

func choose_terrain_tool(tool: String) -> void:
	selected_tower_id = ""
	terrain_tool = tool
	terrain_delta = 1 if tool == "raise" else (-1 if tool == "lower" else 0)
	terrain_line_start = Vector2i(-1, -1)
	if tool == "slope":
		var directions := ["north", "east", "south", "west"]
		terrain_slope = directions[(directions.find(terrain_slope) + 1) % directions.size()]
	battlefield.set_selected_tower("")
	battlefield.set_terrain_preview_command({"tool": tool, "cells": [], "slope": terrain_slope})
	var names := {"raise":"升高", "lower":"降低", "slope":"铺设斜坡（朝%s）" % terrain_slope, "flatten":"铲平"}
	status("%s工具 · %s笔刷：确认前显示费用、路径、峭壁和射程变化。" % [names.get(tool, tool), terrain_brush], true)

func choose_terrain_brush(brush: String) -> void:
	terrain_brush = brush
	terrain_line_start = Vector2i(-1, -1)
	status("地形笔刷：%s" % {"single":"单格", "square":"3×3", "line":"直线"}.get(brush, brush), true)

func update_board_preview(screen_position: Vector2) -> void:
	var cell := battlefield.screen_to_cell(screen_position)
	if selected_tower_id.is_empty() and terrain_tool.is_empty():
		battlefield.clear_preview()
		return
	if not selected_tower_id.is_empty():
		var tower := run.get_tower(selected_tower_id)
		var error := RuleService.deployment_error(tower, cell, run.terrain_grid, run.towers, run.deployed_bandwidth(), run.effective_bandwidth(), selected_tower_id)
		battlefield.set_preview(cell, error.is_empty(), error)
		status("格位 %d,%d：%s；部署后带宽 %d/%d" % [cell.x, cell.y, "合法" if error.is_empty() else error, run.deployed_bandwidth() + int(tower.get("bandwidth", 0)), run.effective_bandwidth()], error.is_empty())
	else:
		var command := terrain_command_for_cell(cell)
		var check := RuleService.validate_terrain_command(run.terrain_grid, command, run.towers)
		battlefield.set_terrain_preview_command(command)
		battlefield.set_preview(cell, bool(check.get("ok", false)), str(check.get("reason", "")))
		status("格位 %d,%d：%s" % [cell.x, cell.y, "修改%d格 · %d专注 · 路径含%d处峭壁" % [check.get("changes", []).size(), check.get("cost", 0), check.get("barrier_count", 0)] if check.get("ok", false) else check.get("reason", "不可修改")], bool(check.get("ok", false)))

func apply_board_action(screen_position: Vector2) -> void:
	var cell := battlefield.screen_to_cell(screen_position)
	if not selected_tower_id.is_empty():
		deploy_selected(cell)
	elif not terrain_tool.is_empty():
		if terrain_brush == "line" and terrain_line_start.x < 0:
			terrain_line_start = cell
			status("直线起点：%d,%d；点击终点确认预览。" % [cell.x, cell.y], true)
			return
		change_terrain(terrain_command_for_cell(cell))
		terrain_line_start = Vector2i(-1, -1)

func deploy_selected(cell: Vector2i) -> void:
	var tower := run.get_tower(selected_tower_id)
	if tower.is_empty():
		return
	var error := RuleService.deployment_error(tower, cell, run.terrain_grid, run.towers, run.deployed_bandwidth(), run.effective_bandwidth(), selected_tower_id)
	if not error.is_empty():
		status("部署失败：%s" % error, false)
		audio.play_sfx("deny")
		return
	var cost := 0
	if bool(tower.get("deployed", false)) or bool(tower.get("ever_deployed", false)):
		cost = RuleService.relocation_cost(tower, run.relic_value("relocate_discount"))
	if run.focus < cost:
		status("搬迁失败：专注不足，需要%d。原位置未改变。" % cost, false)
		return
	if cost > 0:
		run.focus -= cost
	tower["deployed"] = true
	tower["ever_deployed"] = true
	tower["cell"] = [cell.x, cell.y]
	run.deployment_counter += 1
	tower["deployment_order"] = run.deployment_counter
	status("部署完成：%s 位于 %d,%d；消耗%d专注。" % [tower["name"], cell.x, cell.y, cost], true)
	audio.play_sfx("deploy")
	battlefield.refresh_all()
	rebuild_prebattle_ui_preserving_world()

func change_terrain(command: Dictionary) -> void:
	var result := run.apply_terrain_command(command)
	if not bool(result.get("ok", false)):
		status("地形改造失败：%s" % result.get("reason", "不可修改"), false)
		audio.play_sfx("deny")
		return
	status("地形已更新：修改%d格，消耗%d专注；路径、峭壁、射程与视线已同步刷新。" % [result.get("changes", []).size(), result.get("cost", 0)], true)
	audio.play_sfx("terrain")
	battlefield.refresh_all(true)
	refresh_hud()

func undo_terrain() -> void:
	var result := run.undo_terrain_command()
	status("已撤销最近地形操作并退还%d专注。" % result.get("refund", 0) if result.get("ok", false) else str(result.get("reason", "无法撤销")), bool(result.get("ok", false)))
	if result.get("ok", false):
		battlefield.refresh_all(true)
		refresh_hud()

func terrain_command_for_cell(cell: Vector2i) -> Dictionary:
	var cells: Array = []
	if terrain_brush == "square":
		for y in range(cell.y - 1, cell.y + 2):
			for x in range(cell.x - 1, cell.x + 2):
				cells.append([x, y])
	elif terrain_brush == "line" and terrain_line_start.x >= 0:
		for point in grid_line(terrain_line_start, cell):
			cells.append([point.x, point.y])
	else:
		cells.append([cell.x, cell.y])
	var command := {"tool": terrain_tool, "cells": cells, "slope": terrain_slope}
	if terrain_tool == "flatten":
		command["target_height"] = TerrainGenerator.height_at(run.terrain_grid, cell)
	return command

func grid_line(from: Vector2i, to: Vector2i) -> Array[Vector2i]:
	var result: Array[Vector2i] = []
	var steps := maxi(absi(to.x - from.x), absi(to.y - from.y))
	if steps == 0:
		return [from]
	for index in range(steps + 1):
		var progress := float(index) / float(steps)
		var point := Vector2(from).lerp(Vector2(to), progress)
		var cell := Vector2i(roundi(point.x), roundi(point.y))
		if not result.has(cell):
			result.append(cell)
	return result

func prepare_relocation(instance_id: String) -> void:
	selected_tower_id = instance_id
	terrain_delta = 0
	terrain_tool = ""
	battlefield.set_selected_tower(instance_id)
	status("搬迁预览已开启。取消不会扣费，确认合法新位置后才支付维护费。", true)

func confirm_recall(instance_id: String) -> void:
	var tower := run.get_tower(instance_id)
	var cost := RuleService.relocation_cost(tower, run.relic_value("relocate_discount"))
	confirm_dialog.dialog_text = "收回%s需要%d专注。确认前不会改变原位置。" % [tower.get("name", "单位"), cost]
	for connection in confirm_dialog.confirmed.get_connections():
		confirm_dialog.confirmed.disconnect(connection.callable)
	confirm_dialog.confirmed.connect(func() -> void:
		if run.focus < cost:
			status("收回失败：专注不足。", false)
			return
		run.focus -= cost
		tower["deployed"] = false
		tower["cell"] = [-1, -1]
		cancel_action()
		battlefield.refresh_all()
		rebuild_prebattle_ui_preserving_world()
	, CONNECT_ONE_SHOT)
	confirm_dialog.popup_centered()

func repair_tower(instance_id: String) -> void:
	var tower := run.get_tower(instance_id)
	var cost := RuleService.repair_cost(tower, run.repair_discount)
	if cost <= 0:
		status("该单位无需维修。", false)
		return
	if run.focus < cost:
		status("维修失败：需要%d专注。" % cost, false)
		return
	run.focus -= cost
	tower["durability"] = tower["max_durability"]
	if bool(tower.get("deployed", false)):
		tower["deployed"] = false
		tower["cell"] = [-1, -1]
	status("维修完成：%s 已回到仓库，需重新部署。" % tower["name"], true)
	battlefield.refresh_all()
	rebuild_prebattle_ui_preserving_world()

func upgrade_selected(branch: String) -> void:
	var tower := run.get_tower(selected_tower_id)
	if tower.is_empty():
		return
	var current_tier := int(tower.get("tier", 1))
	var chosen := str(tower.get("branch", "")) if current_tier == 2 else branch
	var branch_data: Dictionary = catalog.towers[str(tower["id"])].get("branches", {}).get(chosen, {})
	var cost := ceili(float(tower.get("upkeep", 0)) * (1.5 if current_tier == 1 else 2.5))
	confirm_dialog.dialog_text = "%s：T%d → T%d%s\n花费：%d 专注\n攻击倍率：×%.2f　耐久倍率：×%.2f\n玩法变化：%s" % [tower["name"], current_tier, current_tier + 1, chosen, cost, branch_data.get("attack_mult", 1.0), branch_data.get("hp_mult", 1.0), branch_data.get("description", branch_data.get("effect", "改变职责"))]
	for connection in confirm_dialog.confirmed.get_connections():
		confirm_dialog.confirmed.disconnect(connection.callable)
	confirm_dialog.confirmed.connect(func() -> void:
		var result := run.upgrade_tower(selected_tower_id, chosen, catalog)
		status("升级完成：T%d%s，消耗%d专注。" % [result.get("tier", 0), result.get("branch", ""), result.get("cost", 0)] if result.get("ok", false) else "升级失败：%s" % result.get("reason", "未知原因"), bool(result.get("ok", false)))
		rebuild_prebattle_ui_preserving_world()
	, CONNECT_ONE_SHOT)
	confirm_dialog.popup_centered()

func fuse_selected() -> void:
	var tower := run.get_tower(selected_tower_id)
	if tower.is_empty():
		return
	var branch := str(tower.get("branch", "A"))
	if branch.is_empty():
		branch = "A"
	confirm_dialog.dialog_text = "融合三个同类型、同阶构造？\n核心：%s\n消耗另外两个材料；融合耐久按三件材料的总耐久比例继承，核心原位置保留。" % tower["name"]
	for connection in confirm_dialog.confirmed.get_connections():
		confirm_dialog.confirmed.disconnect(connection.callable)
	confirm_dialog.confirmed.connect(func() -> void:
		var result := run.fuse_tower(selected_tower_id, branch, catalog)
		status("融合完成：按三件材料总耐久比例继承，核心位置保留。" if result.get("ok", false) else "融合失败：%s" % result.get("reason", "未知原因"), bool(result.get("ok", false)))
		battlefield.refresh_all()
		rebuild_prebattle_ui_preserving_world()
	, CONNECT_ONE_SHOT)
	confirm_dialog.popup_centered()

func cycle_priority(instance_id: String) -> void:
	var tower := run.get_tower(instance_id)
	var priorities := ["nearest", "farthest", "highest_hp"]
	var index := priorities.find(str(tower.get("priority", "nearest")))
	tower["priority"] = priorities[(index + 1) % priorities.size()]
	status("%s攻击优先级：%s" % [tower["name"], priority_name(tower["priority"])], true)
	show_tower_inspector(tower)

func cancel_action() -> void:
	selected_tower_id = ""
	terrain_delta = 0
	terrain_tool = ""
	terrain_line_start = Vector2i(-1, -1)
	if battlefield != null:
		battlefield.set_selected_tower("")
		battlefield.set_terrain_preview_command({})
		battlefield.clear_preview()
	status("操作已取消；未扣除资源，原位置和地形保持不变。", true)

func rebuild_prebattle_ui_preserving_world() -> void:
	clear_ui()
	build_prebattle_ui()
	if not selected_tower_id.is_empty():
		var tower := run.get_tower(selected_tower_id)
		if not tower.is_empty():
			show_tower_inspector(tower)

func confirm_start_battle() -> void:
	var deployed := 0
	var roles := {"melee": 0, "ranged": 0, "support": 0}
	for tower in run.towers:
		if bool(tower.get("deployed", false)) and float(tower.get("durability", 0)) > 0:
			deployed += 1
			roles[str(tower.get("role", "melee"))] += 1
	if deployed == 0:
		status("不能开始：尚未部署任何可用构造。", false)
		return
	var warning := "确认锁定防线并开始战斗？\n战斗中不能部署、搬迁、维修、升级、融合或改造地形。"
	if roles["melee"] == 0:
		warning += "\n\n警告：没有近战阻挡。"
	if roles["ranged"] == 0:
		warning += "\n\n警告：没有远程火力。"
	confirm_dialog.dialog_text = warning
	for connection in confirm_dialog.confirmed.get_connections():
		confirm_dialog.confirmed.disconnect(connection.callable)
	confirm_dialog.confirmed.connect(start_battle, CONNECT_ONE_SHOT)
	confirm_dialog.popup_centered()

func start_battle() -> void:
	run.lock_prebattle_edits()
	run.snapshot_before_battle()
	run.phase = "battle"
	SaveService.save_run(run)
	screen_state = GameDefs.ScreenState.BATTLE
	clear_ui()
	simulation = BattleSimulation.new()
	simulation.initialize(run, catalog, run.pending_node)
	simulation.battle_event.connect(on_battle_event)
	simulation.battle_finished.connect(on_battle_finished)
	battlefield.set_simulation(simulation)
	battlefield.refresh_all()
	audio.play_state("boss" if run.resolved_node_type(run.pending_node) == "boss" else "battle")
	build_battle_ui()

func build_battle_ui() -> void:
	var top := panel_box(Vector2(24, 18), Vector2(1552, 72))
	ui_root.add_child(top)
	top.add_child(build_resource_strip())
	compass_label = label("", 18, PixelTheme.FRIENDLY)
	compass_label.position = Vector2(1388, 24)
	compass_label.size = Vector2(160, 34)
	compass_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	ui_root.add_child(compass_label)
	var left := panel_box(Vector2(24, 108), Vector2(330, 344))
	ui_root.add_child(left)
	battle_log = RichTextLabel.new()
	battle_log.bbcode_enabled = true
	battle_log.scroll_following = true
	battle_log.text = "[color=#48dbe1]战斗信号已建立。[/color]\n"
	left.add_child(battle_log)
	var controls := HBoxContainer.new()
	controls.position = Vector2(548, 812)
	controls.size = Vector2(500, 60)
	controls.add_theme_constant_override("separation", 8)
	ui_root.add_child(controls)
	var pause_button := action_button("暂停", toggle_pause)
	pause_button.custom_minimum_size = Vector2(160, 50)
	controls.add_child(pause_button)
	for speed in [1, 2, 3]:
		var speed_button := action_button("%d×" % speed, func() -> void: set_battle_speed(float(speed)))
		speed_button.custom_minimum_size = Vector2(96, 50)
		controls.add_child(speed_button)
	battle_progress = label("", 16, Color("e7d59a"))
	battle_progress.position = Vector2(1088, 814)
	battle_progress.size = Vector2(470, 54)
	battle_progress.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	ui_root.add_child(battle_progress)
	add_tutorial_banner(true)
	refresh_hud()

func add_tutorial_banner(in_battle: bool) -> void:
	if bool(profile.get("tutorial_skipped", false)) or run == null:
		return
	var battle_index := int(run.stats.get("battles_won", 0))
	if battle_index >= 3:
		return
	var lessons := [
		"教学 1/3：WASD 永远按屏幕方向平移；按住 Q/E 可连续360°旋转，滚轮缩放，F 回到火种。先部署近战，再把远程放到高台。",
		"教学 2/3：战前可用单格、3×3或直线笔刷改造地形，每个实际变化格消耗2专注；可在开战前逐步撤销并退款。",
		"教学 3/3：敌人死亡也会造成精神压力。距离火种越远，平方衰减越强；让高压力敌人在远处被消灭。",
	]
	var banner := PanelContainer.new()
	banner.position = Vector2(388, 102 if in_battle else 104)
	banner.size = Vector2(824, 86)
	banner.custom_minimum_size = Vector2(824, 86)
	var banner_style := StyleBoxFlat.new()
	banner_style.bg_color = Color(0.035, 0.075, 0.10, 0.96)
	banner_style.border_color = Color("d5a24f")
	banner_style.set_border_width_all(1)
	banner_style.set_content_margin_all(12)
	banner.add_theme_stylebox_override("panel", banner_style)
	var row := HBoxContainer.new()
	row.custom_minimum_size = Vector2(798, 60)
	row.add_theme_constant_override("separation", 12)
	var lesson_label := label(lessons[battle_index], 14, Color("dceff0"))
	lesson_label.custom_minimum_size = Vector2(650, 58)
	lesson_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	lesson_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	row.add_child(lesson_label)
	var skip := action_button("跳过教学", func() -> void:
		profile["tutorial_skipped"] = true
		SaveService.save_profile(profile)
		banner.queue_free()
	)
	skip.custom_minimum_size = Vector2(122, 42)
	row.add_child(skip)
	banner.add_child(row)
	ui_root.add_child(banner)

func toggle_pause() -> void:
	battle_paused = not battle_paused
	audio.set_pause_duck(battle_paused)
	status("战斗已暂停。" if battle_paused else "战斗继续。", true)

func set_battle_speed(value: float) -> void:
	battle_speed = value
	battle_paused = false
	audio.set_pause_duck(false)
	if battle_log != null:
		battle_log.append_text("[color=#d5a24f]模拟速度切换为%d×[/color]\n" % int(value))

func on_battle_event(event: Dictionary) -> void:
	if battle_log == null or not is_instance_valid(battle_log):
		return
	var kind := str(event.get("kind", ""))
	if kind == "tower_attack":
		return
	var data: Dictionary = event
	var line := ""
	match kind:
		"enemy_spawned": line = "%s 从%s入口出现" % [data.get("enemy", "敌人"), entry_name(str(data.get("entry", "north")))]
		"group_incoming": line = "[color=#f1c75b]第%d敌群将在 %.1f 秒后抵达[/color]" % [int(data.get("group_index", 0)) + 1, data.get("countdown", 0.0)]
		"group_started": line = "[color=#67e3c1]第%d/%d敌群开始进场[/color]" % [int(data.get("group_index", 0)) + 1, data.get("group_count", 1)]
		"enemy_killed": line = "%s 已消灭" % data.get("enemy", "敌人")
		"death_pressure": line = "[color=#e78fae]死亡压力 %.1f → 距离后 %.1f - 抗性 %.1f = 伤害 %.1f[/color]" % [data.get("raw", 0), data.get("transmitted", 0), data.get("resisted", 0), data.get("damage", 0)]
		"enemy_breached": line = "[color=#ff6c81]%s突破，造成%.1f精神伤害[/color]" % [data.get("enemy", "敌人"), data.get("damage", 0)]
		"bandwidth_jam": line = "[color=#d5a24f]带宽干扰：-%d，持续%.1f秒[/color]" % [data.get("amount", 0), data.get("duration", 0)]
		"tower_destroyed": line = "[color=#ff6c81]%s被摧毁，可在之后维修[/color]" % data.get("tower", "构造")
		"reinforcement_spawned": line = "%s触发增援 %d/%d" % [data.get("source", "增援能力"), data.get("used", 0), data.get("budget", 0)]
		"barrier_broken": line = "地形屏障被破坏，敌人重新寻路"
		"enemy_telegraph": line = "[color=#d5a24f]%s 正在准备 %s（%.2f秒）[/color]" % [data.get("enemy", "敌人"), data.get("ability", "能力"), data.get("windup", 0.0)]
		_:
			if kind in ["enemy_ability", "boss_phase", "battle_started"]:
				line = str(data)
	if not line.is_empty():
		battle_log.append_text(line + "\n")

func on_battle_finished(won: bool, result: Dictionary) -> void:
	battle_paused = true
	audio.set_pause_duck(true)
	battlefield.refresh_all()
	if not won:
		SaveService.save_run(run)
		show_settlement()
		return
	show_message("战斗胜利", "击败 %d / 突破 %d\n获得 %d 专注、%d 经验。" % [result.get("killed", 0), result.get("breached", 0), result.get("focus", 0), result.get("xp", 0)], func() -> void:
		run.phase = "reward" if not run.reward_queue.is_empty() else "map"
		SaveService.save_run(run)
		if run.reward_queue.is_empty():
			finish_battle_node()
		else:
			show_rewards()
	)

func show_rewards() -> void:
	screen_state = GameDefs.ScreenState.REWARD
	clear_world()
	clear_ui()
	audio.play_state("reward")
	var bg := ColorRect.new()
	bg.color = Color("0a151b")
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	ui_root.add_child(bg)
	ui_root.add_child(make_header("信号重构奖励", "必须按单位、收藏品、天赋顺序处理完毕"))
	if run.reward_queue.is_empty():
		finish_battle_node()
		return
	var reward: Dictionary = run.reward_queue[0]
	var kind := str(reward.get("kind", "unit"))
	if kind == "talent" and reward.get("choices", []).is_empty():
		reward["choices"] = run.make_talent_choices(catalog)
	var row := HBoxContainer.new()
	row.position = Vector2(150, 220)
	row.size = Vector2(1300, 460)
	row.add_theme_constant_override("separation", 24)
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	ui_root.add_child(row)
	for id in reward.get("choices", []):
		if (kind == "relic" and run.relic_ids.has(str(id))) or (kind == "talent" and run.talent_ids.has(str(id))):
			continue
		var data := reward_data(kind, str(id))
		var card := Button.new()
		card.custom_minimum_size = Vector2(350, 420)
		card.text = "%s\n\n%s\n\n%s" % [data.get("name", id), reward_kind_name(kind), data.get("description", "")]
		card.pressed.connect(func() -> void: choose_reward(kind, str(id)))
		row.add_child(card)

func choose_reward(kind: String, id: String) -> void:
	match kind:
		"unit": run.add_tower(id, catalog)
		"relic":
			if not run.relic_ids.has(id):
				run.relic_ids.append(id)
			run.refresh_owned_content(catalog)
		"talent":
			if not run.talent_ids.has(id):
				run.talent_ids.append(id)
			run.refresh_owned_content(catalog)
	run.reward_queue.pop_front()
	SaveService.save_run(run)
	show_rewards()

func finish_battle_node() -> void:
	run.complete_current_node()
	SaveService.save_run(run)
	if run.run_complete:
		show_settlement()
	else:
		show_map()

func show_node() -> void:
	screen_state = GameDefs.ScreenState.NODE
	clear_world()
	clear_ui()
	audio.play_state("node")
	var bg := ColorRect.new()
	bg.color = Color("09161d")
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	ui_root.add_child(bg)
	var node_type := run.resolved_node_type(run.pending_node)
	ui_root.add_child(make_header(node_type_name(node_type), "所有得失在确认前完整显示"))
	var content_box := panel_box(Vector2(230, 160), Vector2(1140, 620))
	ui_root.add_child(content_box)
	var content := VBoxContainer.new()
	content.add_theme_constant_override("separation", 14)
	content_box.add_child(content)
	match node_type:
		"camp": build_camp(content)
		"workshop": build_workshop(content)
		"shop": build_shop(content)
		"treasure": build_treasure(content)
		"event": build_event(content)
		_: build_event(content)

func build_camp(content: VBoxContainer) -> void:
	content.add_child(label("静默营地", 30, Color("63ca8a")))
	var restore_ratio := 0.24 if run.pressure_level >= 5 else 0.30
	content.add_child(action_button("恢复 %.0f 精神稳定（最大值的%.0f%%）" % [run.max_spirit * restore_ratio, restore_ratio * 100], func() -> void:
		run.spirit = GameDefs.clamp_spirit(run.spirit + run.max_spirit * restore_ratio, run.max_spirit)
		complete_service_node()
	))
	content.add_child(action_button("免费维修一个最受损单位", func() -> void:
		var tower := most_damaged_tower()
		if not tower.is_empty():
			tower["durability"] = tower["max_durability"]
			tower["deployed"] = false
			tower["cell"] = [-1, -1]
		complete_service_node()
	))
	content.add_child(action_button("免费将一个可升级单位提升一阶", func() -> void:
		for tower in run.towers:
			if int(tower.get("tier", 1)) < 3:
				var branch := str(tower.get("branch", ""))
				run.upgrade_tower(str(tower["instance_id"]), "A" if branch.is_empty() else branch, catalog, true)
				break
		complete_service_node()
	))

func build_workshop(content: VBoxContainer) -> void:
	content.add_child(label("记忆工坊", 30, Color("d29b55")))
	content.add_child(label("可反复维修或升级；只有主动离开后节点才完成。", 16, Color("a5bac0")))
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(1060, 410)
	content.add_child(scroll)
	var list := VBoxContainer.new()
	scroll.add_child(list)
	for tower in run.towers:
		var row := HBoxContainer.new()
		row.add_child(label("%s T%d%s  耐久 %.0f/%.0f" % [tower["name"], tower["tier"], tower["branch"], tower["durability"], tower["max_durability"]], 15, Color("d7e3e5")))
		row.add_child(action_button("维修 %d" % RuleService.repair_cost(tower, run.repair_discount), func() -> void: service_repair(str(tower["instance_id"]))))
		row.add_child(action_button("升级A", func() -> void: service_upgrade(str(tower["instance_id"]), "A")))
		row.add_child(action_button("升级B", func() -> void: service_upgrade(str(tower["instance_id"]), "B")))
		list.add_child(row)
	content.add_child(action_button("离开工坊", complete_service_node, true))

func service_repair(instance_id: String) -> void:
	var tower := run.get_tower(instance_id)
	var cost := RuleService.repair_cost(tower, run.repair_discount)
	if cost <= 0 or run.focus < cost:
		show_message("无法维修", "单位无需维修，或专注不足。")
		return
	run.focus -= cost
	tower["durability"] = tower["max_durability"]
	tower["deployed"] = false
	tower["cell"] = [-1, -1]
	SaveService.save_run(run)
	show_node()

func service_upgrade(instance_id: String, branch: String) -> void:
	var result := run.upgrade_tower(instance_id, branch, catalog)
	if not result.get("ok", false):
		show_message("无法升级", str(result.get("reason", "未知原因")))
		return
	SaveService.save_run(run)
	show_node()

func build_shop(content: VBoxContainer) -> void:
	content.add_child(label("偏频交易站 · 专注 %d" % run.focus, 30, Color("cfb04b")))
	var purchased: Array = run.pending_node.get("purchased", [])
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	content.add_child(row)
	for id in run.pending_node.get("shop_units", []):
		var key := "unit:%s" % id
		var button := action_button("%s\n单位 · 80专注" % catalog.towers[str(id)]["name"], func() -> void: buy_shop_item("unit", str(id), 80))
		button.disabled = purchased.has(key)
		row.add_child(button)
	for id in run.pending_node.get("shop_relics", []):
		var key := "relic:%s" % id
		var button := action_button("%s\n收藏品 · 120专注" % catalog.relics[str(id)]["name"], func() -> void: buy_shop_item("relic", str(id), 120))
		button.disabled = purchased.has(key) or run.relic_ids.has(str(id))
		row.add_child(button)
	content.add_child(action_button("离开商店", complete_service_node, true))

func buy_shop_item(kind: String, id: String, base_cost: int) -> void:
	var cost := ceili(float(base_cost) * (1.15 if run.pressure_level >= 7 else 1.0))
	if run.focus < cost:
		show_message("购买失败", "专注不足：需要%d，当前%d。货架保持不变。" % [cost, run.focus])
		return
	run.focus -= cost
	run.pending_node["purchased"].append("%s:%s" % [kind, id])
	if kind == "unit":
		run.add_tower(id, catalog)
	else:
		run.relic_ids.append(id)
		run.refresh_owned_content(catalog)
	SaveService.save_run(run)
	show_node()

func build_treasure(content: VBoxContainer) -> void:
	content.add_child(label("记忆宝库 · 免费选择一件收藏品", 30, Color("a47be0")))
	var row := HBoxContainer.new()
	content.add_child(row)
	for id in run.pending_node.get("relic_rewards", []):
		var relic: Dictionary = catalog.relics[str(id)]
		var button := action_button("%s\n%s" % [relic["name"], relic["description"]], func() -> void:
			if not run.relic_ids.has(str(id)):
				run.relic_ids.append(str(id))
			run.refresh_owned_content(catalog)
			complete_service_node()
		)
		button.custom_minimum_size = Vector2(330, 180)
		row.add_child(button)

func build_event(content: VBoxContainer) -> void:
	var event_id := str(run.pending_node.get("event_id", ""))
	var event: Dictionary = catalog.events.get(event_id, {})
	if event.is_empty():
		content.add_child(label("信号已经消散。", 28, Color("6694dc")))
		content.add_child(action_button("离开", complete_service_node))
		return
	content.add_child(label(str(event["title"]), 30, Color("6694dc")))
	content.add_child(label(str(event["text"]), 18, Color("cbdadc")))
	for choice in event.get("choices", []):
		content.add_child(action_button(str(choice["label"]), func() -> void:
			var messages := run.apply_event_effects(choice.get("effects", {}), catalog)
			show_message("选择已确认", "\n".join(messages), complete_service_node)
		))

func complete_service_node() -> void:
	run.complete_current_node()
	SaveService.save_run(run)
	show_map()

func show_settlement() -> void:
	screen_state = GameDefs.ScreenState.SETTLEMENT
	clear_world()
	clear_ui()
	audio.play_state("victory" if run.victory else "defeat")
	var bg := ColorRect.new()
	bg.color = Color("07131a")
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	ui_root.add_child(bg)
	var title_text := "信号自由 / 本局胜利" if run.victory else "火种熄灭 / 本局失败"
	ui_root.add_child(make_header(title_text, "种子 %s · 控制压力 %d" % [run.seed_text, run.pressure_level]))
	var box := panel_box(Vector2(220, 140), Vector2(1160, 620))
	ui_root.add_child(box)
	var text := RichTextLabel.new()
	text.bbcode_enabled = true
	var reason := failure_reason()
	text.text = "[font_size=24][color=#48dbe1]局势复盘[/color][/font_size]\n\n" + \
		"到达：第%d幕，第%d层\n完成节点：%d · 战斗胜利：%d · 精英击败：%d\n" % [run.act_index + 1, run.current_floor + 1, run.stats["nodes_completed"], run.stats["battles_won"], run.stats["elites_killed"]] + \
		"击败敌人：%d · 突破敌人：%d · 摧毁构造：%d\n" % [run.stats["enemies_killed"], run.stats["enemies_breached"], run.stats["towers_destroyed"]] + \
		"突破精神伤害：%.1f · 死亡压力伤害：%.1f · 过载时间：%.1f秒\n" % [run.stats["spirit_breakthrough"], run.stats["spirit_death_pressure"], run.stats["overload_seconds"]] + \
		"最终构筑：%d单位 · %d收藏品 · %d天赋 · 深度%d\n\n" % [run.towers.size(), run.relic_ids.size(), run.talent_ids.size(), run.depth] + \
		"[color=#d5a24f]关键结论[/color]\n%s" % reason
	box.add_child(text)
	var shards := int(run.stats["nodes_completed"]) * 2 + int(run.stats["elites_killed"]) * 10 + (50 if run.victory else 0)
	profile["memory_shards"] = int(profile.get("memory_shards", 0)) + shards
	if run.victory:
		profile["max_pressure"] = mini(10, maxi(int(profile.get("max_pressure", 0)), run.pressure_level + 1))
	SaveService.save_profile(profile)
	SaveService.clear_run()
	var menu_button := action_button("返回主界面 · 获得%d记忆碎片" % shards, show_menu, true)
	menu_button.position = Vector2(550, 800)
	menu_button.size = Vector2(500, 58)
	ui_root.add_child(menu_button)

func show_codex() -> void:
	screen_state = GameDefs.ScreenState.CODEX
	clear_world()
	clear_ui()
	var bg := ColorRect.new()
	bg.color = Color("08151c")
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	ui_root.add_child(bg)
	ui_root.add_child(make_header("图鉴与发现记录", "单位12 · 敌人18 · 精英4 · 首领6 · 收藏品30 · 天赋24 · 事件24"))
	var tabs := TabContainer.new()
	tabs.position = Vector2(70, 120)
	tabs.size = Vector2(1460, 680)
	ui_root.add_child(tabs)
	add_codex_tab(tabs, "心智构造", catalog.towers)
	add_codex_tab(tabs, "敌对信号", catalog.enemies)
	add_codex_tab(tabs, "首领档案", catalog.bosses)
	add_codex_tab(tabs, "收藏品", catalog.relics)
	add_codex_tab(tabs, "天赋", catalog.talents)
	var back := action_button("返回", show_menu)
	back.position = Vector2(70, 820)
	back.size = Vector2(220, 52)
	ui_root.add_child(back)

func add_codex_tab(tabs: TabContainer, title: String, entries: Dictionary) -> void:
	var scroll := ScrollContainer.new()
	scroll.name = title
	var grid := GridContainer.new()
	grid.columns = 3
	grid.add_theme_constant_override("h_separation", 12)
	grid.add_theme_constant_override("v_separation", 12)
	scroll.add_child(grid)
	for id in entries:
		var data: Dictionary = entries[id]
		var entry := panel_box(Vector2.ZERO, Vector2(430, 150))
		entry.add_child(label("%s\n%s" % [data.get("name", id), data.get("description", data.get("ability_text", data.get("ability", "")))], 15, Color("d7e3e5")))
		grid.add_child(entry)
	tabs.add_child(scroll)

func show_settings() -> void:
	screen_state = GameDefs.ScreenState.SETTINGS
	clear_world()
	clear_ui()
	var bg := ColorRect.new()
	bg.color = Color("08151c")
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	ui_root.add_child(bg)
	ui_root.add_child(make_header("设置", "音频、画面与可读性"))
	var box := panel_box(Vector2(420, 170), Vector2(760, 560))
	ui_root.add_child(box)
	var list := VBoxContainer.new()
	list.add_theme_constant_override("separation", 16)
	box.add_child(list)
	for bus in ["Master", "Music", "SFX", "UI"]:
		var row := HBoxContainer.new()
		row.add_child(label({"Master":"主音量","Music":"音乐","SFX":"战斗音效","UI":"界面音效"}[bus], 18, Color("d7e3e5")))
		var slider := HSlider.new()
		slider.custom_minimum_size.x = 480
		slider.min_value = 0
		slider.max_value = 1
		slider.step = 0.01
		slider.value = db_to_linear(AudioServer.get_bus_volume_db(AudioServer.get_bus_index(bus)))
		slider.value_changed.connect(func(value: float) -> void: audio.set_bus_volume(bus, value))
		row.add_child(slider)
		list.add_child(row)
	list.add_child(label("镜头：WASD按屏幕方向平移 · 按住Q/E连续360°旋转 · 滚轮缩放 · F回到火种\n战前：左键确认 · 右键/Esc取消 · 地形可逐步撤销\n战斗：暂停及1×/2×/3×固定逻辑步长", 16, PixelTheme.MUTED))
	list.add_child(action_button("返回", show_menu))

func show_credits() -> void:
	show_message("制作人员与资源", "《心域防线》2.5D像素重制\n\n游戏设计与开发：偏频者项目组\n引擎：Godot 4.7.2\n像素UI、图标与音效：Kenney CC0\n单位像素图集：由Kenney CC0模型八方向烘焙\n中文字体：缝合像素字体 OFL-1.1\n自适应音乐：Vitalezzz / Singularity（CC0）\n\n详细来源、哈希和用途见 docs/THIRD_PARTY_ASSETS.md。")

func route_intel_text() -> String:
	var act := run.current_act()
	var reveal := int(act.get("boss_reveal", 0))
	var boss: Dictionary = catalog.bosses[str(act.get("boss_id", ""))]
	var boss_info := "信号轮廓尚不完整"
	if reveal >= 1 or run.current_floor >= 0:
		boss_info = str(boss.get("hint", boss.get("ability_text", "存在强烈控制信号")))
	if reveal >= 3 or run.current_floor >= int(act.get("floor_count", 1)) - 3:
		boss_info = "%s\n%s" % [boss.get("name", "未知首领"), boss.get("ability_text", "")]
	return "[font_size=23][color=#48dbe1]%s[/color][/font_size]\n\n精神稳定 %.0f/%.0f\n专注 %d\n带宽 %d\n抗性 %.0f\n深度 %d\n\n[color=#d5a24f]首领威胁情报[/color]\n%s\n\n完成层：%d/%d" % [act.get("name", ""), run.spirit, run.max_spirit, run.focus, run.base_bandwidth, run.resistance, run.depth, boss_info, run.current_floor + 1, act.get("floor_count", 0)]

func threat_text() -> String:
	var act_number := run.act_index + 1
	var entries := ["北"]
	if act_number == 1 and run.current_floor >= 5:
		entries.append("西")
	if act_number == 1 and run.current_floor >= 10:
		entries.append("东")
	if act_number == 2:
		entries = ["北", "西", "东"]
		if run.current_floor >= 7:
			entries.append("南")
	if act_number >= 3:
		entries = ["北", "西", "东", "南"]
	var node_type := run.resolved_node_type(run.pending_node)
	var encounter_ranges: Array = [[16, 28], [24, 38], [32, 50]]
	var ranges: Array = encounter_ranges[run.act_index]
	var group_total := 5 if node_type == "boss" else (4 if node_type == "elite" else 3)
	return "[font_size=22][color=#f06b67]入口威胁[/color][/font_size]\n\n节点：%s\n预计总量：%d–%d\n连续敌群：%d群（间隔4–6秒）\n启用入口：%s\n首批到达：约1.2秒\n\n[color=#f1c75b]敌人类别[/color]\n基础推进 / 功能型 ≥25%%%s\n\n敌人增援共享预算：初始编队10%%\n同时活动上限：100" % [node_type_name(node_type), ranges[0], ranges[1], group_total, "、".join(entries), "\n精英位于倒数第二群" if node_type == "elite" else ("\n首领位于第四群" if node_type == "boss" else "")]

func refresh_hud() -> void:
	if run == null:
		return
	if not resource_fields.is_empty():
		var jam := simulation._effective_jam() if simulation != null and screen_state == GameDefs.ScreenState.BATTLE else 0
		resource_fields["spirit"].text = "精神 %.1f/%.0f" % [run.spirit, run.max_spirit]
		resource_fields["focus"].text = "专注 %d" % run.focus
		resource_fields["bandwidth"].text = "带宽 %d/%d" % [run.deployed_bandwidth(), run.effective_bandwidth(jam)]
		resource_fields["progress"].text = "%s · 深度%d · 第%d层" % [run.current_act().get("name", ""), run.depth, run.current_floor + 1]
	if compass_label != null and is_instance_valid(compass_label) and battlefield != null:
		compass_label.text = battlefield.compass_text()
	if battle_progress != null and is_instance_valid(battle_progress) and simulation != null:
		battle_progress.text = "%s · 敌群 %d/%d · 危险 %d%%\n下一群 %.1fs · 场上 %d · 增援 %d/%d" % ["已暂停" if battle_paused else "%d×" % int(battle_speed), simulation.current_group_index + 1, simulation.group_count, roundi(simulation.danger_level * 100.0), simulation.next_group_countdown, simulation.enemies.size(), simulation.reinforcements_used, simulation.reinforcement_budget]

func clear_ui() -> void:
	for child in ui_root.get_children():
		child.queue_free()
	status_label = null
	resource_label = null
	resource_fields.clear()
	compass_label = null
	threat_label = null
	battle_log = null
	battle_progress = null
	popup_panel = null
	_middle_pan_active = false

func clear_world() -> void:
	if battlefield != null and is_instance_valid(battlefield):
		battlefield.queue_free()
	battlefield = null
	simulation = null

func make_header(title_text: String, subtitle: String) -> PanelContainer:
	var header := panel_box(Vector2(24, 18), Vector2(1552, 76))
	var row := HBoxContainer.new()
	row.custom_minimum_size = Vector2(1510, 44)
	header.add_child(row)
	var title := label(title_text, 28, Color("e7f3f3"))
	title.custom_minimum_size.x = 830
	title.autowrap_mode = TextServer.AUTOWRAP_OFF
	title.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(title)
	var sub := label(subtitle, 15, Color("8caab1"))
	sub.custom_minimum_size.x = 620
	sub.autowrap_mode = TextServer.AUTOWRAP_OFF
	sub.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	row.add_child(sub)
	return header

func build_resource_strip() -> HBoxContainer:
	resource_fields.clear()
	var row := HBoxContainer.new()
	row.custom_minimum_size = Vector2(1320, 40)
	row.add_theme_constant_override("separation", 22)
	add_resource_badge(row, "home.png", "spirit", PixelTheme.FRIENDLY)
	add_resource_badge(row, "star.png", "focus", PixelTheme.RESOURCE)
	add_resource_badge(row, "signal3.png", "bandwidth", PixelTheme.FRIENDLY)
	add_resource_badge(row, "target.png", "progress", PixelTheme.TEXT, 390)
	return row

func add_resource_badge(row: HBoxContainer, icon_name: String, key: String, color: Color, width: float = 190.0) -> void:
	var badge := HBoxContainer.new()
	badge.custom_minimum_size.x = width
	badge.add_theme_constant_override("separation", 8)
	var icon := TextureRect.new()
	var path := PixelTheme.ICON_ROOT + icon_name
	icon.texture = load(path) as Texture2D if ResourceLoader.exists(path) else null
	icon.modulate = color
	icon.custom_minimum_size = Vector2(28, 28)
	icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	badge.add_child(icon)
	var value := label("", 17, color)
	value.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	value.custom_minimum_size.x = width - 36.0
	badge.add_child(value)
	resource_fields[key] = value
	row.add_child(badge)

func atlas_frame_icon(path: String, frame_index: int = 0) -> Texture2D:
	if not ResourceLoader.exists(path):
		return null
	var atlas := AtlasTexture.new()
	atlas.atlas = load(path) as Texture2D
	atlas.region = Rect2(frame_index * 48, 0, 48, 48)
	return atlas

func panel_box(position_value: Vector2, size_value: Vector2) -> PanelContainer:
	var panel := PanelContainer.new()
	panel.position = position_value
	panel.size = size_value
	panel.add_theme_stylebox_override("panel", PixelTheme.panel_style())
	return panel

func action_button(text_value: String, callback: Callable, primary: bool = false) -> Button:
	var button := Button.new()
	button.text = text_value
	button.custom_minimum_size = Vector2(300, 50)
	button.add_theme_font_size_override("font_size", 17)
	button.add_theme_stylebox_override("normal", PixelTheme.button_style("yellow" if primary else "blue"))
	button.add_theme_stylebox_override("hover", PixelTheme.button_style("yellow" if primary else "green"))
	button.add_theme_stylebox_override("pressed", PixelTheme.button_style("yellow" if primary else "green", true))
	button.pressed.connect(callback)
	return button

func compact_button(text_value: String, callback: Callable) -> Button:
	var button := action_button(text_value, callback)
	button.custom_minimum_size = Vector2(132, 40)
	button.add_theme_font_size_override("font_size", 14)
	return button

func label(text_value: String, font_size: int, color: Color) -> Label:
	var result := Label.new()
	result.text = text_value
	result.add_theme_font_size_override("font_size", font_size)
	result.add_theme_color_override("font_color", color)
	result.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	return result

func status(text_value: String, positive: bool) -> void:
	if status_label != null and is_instance_valid(status_label):
		status_label.text = text_value
		status_label.add_theme_color_override("font_color", Color("72e4bc") if positive else Color("ff7186"))

func show_message(title: String, text_value: String, after: Callable = Callable()) -> void:
	var dialog := AcceptDialog.new()
	dialog.theme = pixel_theme
	dialog.title = title
	dialog.dialog_text = text_value
	dialog.ok_button_text = "确认"
	if after.is_valid():
		dialog.confirmed.connect(after, CONNECT_ONE_SHOT)
	dialog.visibility_changed.connect(func() -> void:
		if not dialog.visible:
			dialog.queue_free()
	)
	ui_layer.add_child(dialog)
	dialog.popup_centered()

func most_damaged_tower() -> Dictionary:
	var result: Dictionary = {}
	var lowest := 2.0
	for tower in run.towers:
		var ratio := float(tower.get("durability", 0)) / maxf(1.0, float(tower.get("max_durability", 1)))
		if ratio < lowest:
			lowest = ratio
			result = tower
	return result

func reward_data(kind: String, id: String) -> Dictionary:
	match kind:
		"unit": return catalog.towers.get(id, {})
		"relic": return catalog.relics.get(id, {})
		"talent": return catalog.talents.get(id, {})
	return {}

func failure_reason() -> String:
	if run.victory:
		return "你切断了最终控制信号。最终构筑与关键路线已写入档案。"
	var values := {
		"突破过多：主通路阻挡或火力覆盖不足。": float(run.stats["spirit_breakthrough"]),
		"死亡压力过高：敌人死在火种附近，需更早击杀、减速或提高抗性。": float(run.stats["spirit_death_pressure"]),
		"带宽过载：新部署单位被依次禁用，支援网络失效。": float(run.stats["overload_seconds"]) * 0.5,
		"单位被摧毁：耐久维护或近战承压不足。": float(run.stats["towers_destroyed"]) * 10.0,
	}
	var best := "防线未能维持稳定；检查入口威胁和单位组合。"
	var best_value := -1.0
	for reason in values:
		if float(values[reason]) > best_value:
			best_value = float(values[reason])
			best = str(reason)
	return best

func node_type_name(id: String) -> String:
	return {"combat":"普通战斗","elite":"精英战斗","camp":"营地","workshop":"工坊","shop":"商店","treasure":"宝库","event":"事件","unknown":"未知节点","boss":"首领战"}.get(id, "未知节点")

func role_name(id: String) -> String:
	return {"melee":"近战","ranged":"远程","support":"支援"}.get(id, "构造")

func reward_kind_name(id: String) -> String:
	return {"unit":"新心智构造","relic":"整局收藏品","talent":"精神深度天赋"}.get(id, "奖励")

func priority_name(id: String) -> String:
	return {"nearest":"离火种最近","farthest":"离火种最远","highest_hp":"当前生命最高"}.get(id, id)

func entry_name(id: String) -> String:
	return {"north":"北","west":"西","east":"东","south":"南"}.get(id, id)
