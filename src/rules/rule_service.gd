class_name RuleService
extends RefCounted

static func occupied_cells(towers: Array, ignore_instance_id: String = "") -> Dictionary:
	var occupied: Dictionary = {}
	for tower in towers:
		if str(tower.get("instance_id", "")) == ignore_instance_id:
			continue
		if not bool(tower.get("deployed", false)) or float(tower.get("durability", 0.0)) <= 0.0:
			continue
		var origin := _array_cell(tower.get("cell", [-1, -1]))
		var footprint: Array = tower.get("footprint", [1, 1])
		for y in int(footprint[1]):
			for x in int(footprint[0]):
				occupied[GameDefs.cell_key(origin + Vector2i(x, y))] = str(tower.get("instance_id", ""))
	return occupied

static func deployment_error(unit: Dictionary, origin: Vector2i, heights: Array, towers: Array, used_bandwidth: int, max_bandwidth: int, ignore_instance_id: String = "") -> String:
	var footprint: Array = unit.get("footprint", [1, 1])
	var cells: Array[Vector2i] = []
	for y in int(footprint[1]):
		for x in int(footprint[0]):
			var cell := origin + Vector2i(x, y)
			if cell.x < 0 or cell.y < 0 or cell.x >= GameDefs.BOARD_SIZE or cell.y >= GameDefs.BOARD_SIZE:
				return "占地超出战场"
			cells.append(cell)
	var height := int(heights[cells[0].y][cells[0].x])
	for cell in cells:
		if int(heights[cell.y][cell.x]) != height:
			return "完整占地必须处于同一高度"
		if GameDefs.is_core_cell(cell):
			return "醒觉火种保护区域不可部署"
		if GameDefs.is_entry_cell(cell):
			return "敌人入口不可部署"
	var role := str(unit.get("role", ""))
	if role == "melee" and height != 0:
		return "近战构造只能部署在高度0地面"
	if role == "ranged" and (height < 1 or height > 3):
		return "远程构造只能部署在高度1至3高台"
	var occupied := occupied_cells(towers, ignore_instance_id)
	for cell in cells:
		if occupied.has(GameDefs.cell_key(cell)):
			return "格位已被其他构造占用"
	var old_bandwidth := 0
	if not ignore_instance_id.is_empty():
		for tower in towers:
			if str(tower.get("instance_id", "")) == ignore_instance_id and bool(tower.get("deployed", false)):
				old_bandwidth = int(tower.get("bandwidth", 0))
	var projected := used_bandwidth - old_bandwidth + int(unit.get("bandwidth", 0))
	if projected > max_bandwidth:
		return "带宽不足：部署后%d/%d" % [projected, max_bandwidth]
	return ""

static func can_change_terrain(heights: Array, cell: Vector2i, delta: int, towers: Array) -> Dictionary:
	if cell.x < 0 or cell.y < 0 or cell.x >= GameDefs.BOARD_SIZE or cell.y >= GameDefs.BOARD_SIZE:
		return {"ok": false, "reason": "格位超出战场"}
	if GameDefs.is_core_cell(cell):
		return {"ok": false, "reason": "不能修改醒觉火种"}
	if GameDefs.is_entry_cell(cell):
		return {"ok": false, "reason": "不能修改敌人入口"}
	if occupied_cells(towers).has(GameDefs.cell_key(cell)):
		return {"ok": false, "reason": "有构造占用该格"}
	var next_height := int(heights[cell.y][cell.x]) + delta
	if next_height < 0 or next_height > 3:
		return {"ok": false, "reason": "高度必须保持在0至3"}
	for direction in [Vector2i.LEFT, Vector2i.RIGHT, Vector2i.UP, Vector2i.DOWN]:
		var neighbor: Vector2i = cell + direction
		if neighbor.x < 0 or neighbor.y < 0 or neighbor.x >= GameDefs.BOARD_SIZE or neighbor.y >= GameDefs.BOARD_SIZE:
			continue
		if abs(next_height - int(heights[neighbor.y][neighbor.x])) > 1:
			return {"ok": false, "reason": "与相邻格高度差不能超过一级"}
	return {"ok": true, "reason": "", "height": next_height, "cost": 5}

static func attack_range(unit: Dictionary, height: int, modifiers: Dictionary = {}) -> float:
	var result := float(unit.get("range", 1.0))
	if str(unit.get("role", "")) == "ranged":
		result *= 1.0 + 0.10 * float(height)
	result *= 1.0 + float(modifiers.get("range_mult", 0.0))
	return result

static func has_line_of_sight(source: Vector2i, target: Vector2, heights: Array, source_height: int) -> bool:
	var target_cell := Vector2i(roundi(target.x), roundi(target.y))
	var points := _bresenham(source, target_cell)
	if points.size() <= 2:
		return true
	var start_y := float(source_height) + 1.15
	var end_y := 0.65
	for i in range(1, points.size() - 1):
		var cell: Vector2i = points[i]
		if cell.x < 0 or cell.y < 0 or cell.x >= GameDefs.BOARD_SIZE or cell.y >= GameDefs.BOARD_SIZE:
			continue
		var progress := float(i) / float(points.size() - 1)
		var ray_height := lerpf(start_y, end_y, progress)
		if float(heights[cell.y][cell.x]) > ray_height + 0.05:
			return false
	return true

static func death_pressure(raw_pressure: float, distance_cells: float, resistance: float, multiplier: float = 1.0) -> Dictionary:
	var transmitted := raw_pressure * multiplier / (1.0 + pow(distance_cells / 6.0, 2.0))
	var final_damage := maxf(0.0, transmitted - resistance)
	return {
		"raw": raw_pressure * multiplier,
		"distance": distance_cells,
		"transmitted": transmitted,
		"resisted": minf(transmitted, resistance),
		"damage": final_damage,
	}

static func damage_after_armor(attack: float, armor: float, pierce: float = 0.0, minimum_ratio: float = 0.05) -> float:
	var effective_armor := maxf(0.0, armor - pierce)
	var reduced := attack * (100.0 / (100.0 + effective_armor * 8.0))
	return maxf(attack * minimum_ratio, reduced)

static func enemy_damage_to_tower(attack: float, armor: float, attacker_height: int, tower_height: int, pierce: float = 0.0) -> float:
	var result := damage_after_armor(attack, armor, pierce, 0.0)
	if tower_height > attacker_height:
		var reduction := minf(0.45, 0.15 * float(tower_height - attacker_height))
		var pierce_relief := clampf(pierce / 30.0, 0.0, 0.7)
		result *= 1.0 - reduction * (1.0 - pierce_relief)
	return maxf(1.0, result)

static func repair_cost(tower: Dictionary, discount: float = 0.0) -> int:
	var maximum := maxf(1.0, float(tower.get("max_durability", tower.get("hp", 1.0))))
	var missing_ratio := clampf(1.0 - float(tower.get("durability", maximum)) / maximum, 0.0, 1.0)
	return maxi(0, ceili(float(tower.get("upkeep", 0)) * missing_ratio * (1.0 - discount)))

static func relocation_cost(tower: Dictionary, discount: float = 0.0) -> int:
	return maxi(1, ceili(float(tower.get("upkeep", 0)) * 0.15 * (1.0 - discount)))

static func xp_required_for_depth(depth: int) -> int:
	return 200 + maxi(0, depth - 1) * 125

static func effective_bandwidth(towers: Array, base_bandwidth: int, jam: int, relic_bonus: int = 0) -> int:
	var support_bonus := 0
	for tower in towers:
		if bool(tower.get("deployed", false)) and float(tower.get("durability", 0.0)) > 0.0 and not bool(tower.get("disabled", false)) and str(tower.get("ability", "")) == "bandwidth_plus":
			support_bonus += int(tower.get("support_value", 5))
			if str(tower.get("branch_effect", "")) == "bandwidth_plus_more":
				support_bonus += 3
	return maxi(0, base_bandwidth + relic_bonus + support_bonus - jam)

static func apply_overload(towers: Array, effective_max: int) -> Dictionary:
	for tower in towers:
		tower["disabled"] = false
	var deployed: Array = []
	var used := 0
	for tower in towers:
		if bool(tower.get("deployed", false)) and float(tower.get("durability", 0.0)) > 0.0:
			deployed.append(tower)
			used += int(tower.get("bandwidth", 0))
	deployed.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		return int(a.get("deployment_order", 0)) > int(b.get("deployment_order", 0))
	)
	var disabled_ids: Array[String] = []
	for tower in deployed:
		if used <= effective_max:
			break
		tower["disabled"] = true
		used -= int(tower.get("bandwidth", 0))
		disabled_ids.append(str(tower.get("instance_id", "")))
	return {"active_used": used, "disabled": disabled_ids, "shortage": maxi(0, _total_deployed_bandwidth(towers) - effective_max)}

static func path_to_core(entry: Vector2i, heights: Array, towers: Array) -> Array[Vector2i]:
	var occupied := occupied_cells(towers)
	var frontier: Array[Vector2i] = [entry]
	var cost_so_far := {GameDefs.cell_key(entry): 0.0}
	var came_from := {GameDefs.cell_key(entry): ""}
	var target := Vector2i(-1, -1)
	while not frontier.is_empty():
		var best_index := 0
		for i in range(1, frontier.size()):
			if float(cost_so_far[GameDefs.cell_key(frontier[i])]) < float(cost_so_far[GameDefs.cell_key(frontier[best_index])]):
				best_index = i
		var current: Vector2i = frontier.pop_at(best_index)
		if GameDefs.is_core_cell(current):
			target = current
			break
		for direction in [Vector2i.LEFT, Vector2i.RIGHT, Vector2i.UP, Vector2i.DOWN]:
			var next: Vector2i = current + direction
			if next.x < 0 or next.y < 0 or next.x >= GameDefs.BOARD_SIZE or next.y >= GameDefs.BOARD_SIZE:
				continue
			var step_cost := 1.0
			var height := int(heights[next.y][next.x])
			if height > 0:
				step_cost += 7.0 + float(height) * 5.0
			if occupied.has(GameDefs.cell_key(next)):
				# A blocking construct is the intended ordinary-enemy target; a height-1
				# barrier remains slightly more expensive and is chosen only to reroute.
				step_cost += 9.0
			var next_key: String = GameDefs.cell_key(next)
			var new_cost := float(cost_so_far[GameDefs.cell_key(current)]) + step_cost
			if not cost_so_far.has(next_key) or new_cost < float(cost_so_far[next_key]):
				cost_so_far[next_key] = new_cost
				came_from[next_key] = GameDefs.cell_key(current)
				if not frontier.has(next):
					frontier.append(next)
	if target.x < 0:
		return []
	var path: Array[Vector2i] = []
	var cursor := target
	while cursor != entry:
		path.push_front(cursor)
		var previous_key := str(came_from.get(GameDefs.cell_key(cursor), ""))
		if previous_key.is_empty():
			return []
		cursor = GameDefs.key_cell(previous_key)
	path.push_front(entry)
	return path

static func _total_deployed_bandwidth(towers: Array) -> int:
	var total := 0
	for tower in towers:
		if bool(tower.get("deployed", false)) and float(tower.get("durability", 0.0)) > 0.0:
			total += int(tower.get("bandwidth", 0))
	return total

static func _bresenham(start: Vector2i, end: Vector2i) -> Array[Vector2i]:
	var result: Array[Vector2i] = []
	var x0: int = start.x
	var y0: int = start.y
	var x1: int = end.x
	var y1: int = end.y
	var dx: int = absi(x1 - x0)
	var sx: int = 1 if x0 < x1 else -1
	var dy: int = -absi(y1 - y0)
	var sy: int = 1 if y0 < y1 else -1
	var error: int = dx + dy
	while true:
		result.append(Vector2i(x0, y0))
		if x0 == x1 and y0 == y1:
			break
		var twice: int = 2 * error
		if twice >= dy:
			error += dy
			x0 += sx
		if twice <= dx:
			error += dx
			y0 += sy
	return result

static func _array_cell(value: Variant) -> Vector2i:
	if value is Vector2i:
		return value
	if value is Array and value.size() >= 2:
		return Vector2i(int(value[0]), int(value[1]))
	return Vector2i(-1, -1)
