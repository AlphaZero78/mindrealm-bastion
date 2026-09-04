class_name RuleService
extends RefCounted

const CARDINALS := [Vector2i.LEFT, Vector2i.RIGHT, Vector2i.UP, Vector2i.DOWN]

static func occupied_cells(towers: Array, ignore_instance_id: String = "") -> Dictionary:
	var occupied: Dictionary = {}
	for tower in towers:
		if str(tower.get("instance_id", "")) == ignore_instance_id:
			continue
		if not bool(tower.get("deployed", false)) or float(tower.get("durability", 0.0)) <= 0.0:
			continue
		var origin := _array_cell(tower.get("cell", [-1, -1]))
		var footprint: Array = tower.get("footprint", [2, 2])
		for y in int(footprint[1]):
			for x in int(footprint[0]):
				occupied[GameDefs.cell_key(origin + Vector2i(x, y))] = str(tower.get("instance_id", ""))
	return occupied

static func deployment_error(unit: Dictionary, origin: Vector2i, terrain_grid: Array, towers: Array, used_bandwidth: int, max_bandwidth: int, ignore_instance_id: String = "") -> String:
	var footprint: Array = unit.get("footprint", [2, 2])
	var cells: Array[Vector2i] = []
	for y in int(footprint[1]):
		for x in int(footprint[0]):
			var cell := origin + Vector2i(x, y)
			if not TerrainGenerator.in_bounds(cell):
				return "占地超出战场"
			cells.append(cell)
	var height := TerrainGenerator.height_at(terrain_grid, cells[0])
	for cell in cells:
		if TerrainGenerator.height_at(terrain_grid, cell) != height:
			return "完整占地必须处于同一高度"
		if GameDefs.is_entry_cell(cell):
			return "敌人入口不可部署"
		if TerrainGenerator.protected_at(terrain_grid, cell) or GameDefs.is_core_cell(cell):
			return "醒觉火种保护区域不可部署"
	var role := str(unit.get("role", ""))
	if role == "melee" and height != 0:
		return "近战构造只能部署在高度0地面"
	if role == "ranged" and (height < 1 or height > GameDefs.MAX_TERRAIN_HEIGHT):
		return "远程构造只能部署在高度1至4高台"
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

static func validate_terrain_command(terrain_grid: Array, command: Dictionary, towers: Array) -> Dictionary:
	var tool := str(command.get("tool", ""))
	if tool not in ["raise", "lower", "slope", "rotate_slope", "flatten"]:
		return {"ok": false, "reason": "未知地形工具"}
	var unique_cells: Array[Vector2i] = []
	for raw_cell in command.get("cells", []):
		var cell := _array_cell(raw_cell)
		if not unique_cells.has(cell):
			unique_cells.append(cell)
	if unique_cells.is_empty():
		return {"ok": false, "reason": "没有选中可修改格"}
	var occupied := occupied_cells(towers)
	var preview := terrain_grid.duplicate(true)
	var changes: Array = []
	for cell in unique_cells:
		if not TerrainGenerator.in_bounds(cell):
			return {"ok": false, "reason": "格位超出战场", "cell": [cell.x, cell.y]}
		if GameDefs.is_entry_cell(cell):
			return {"ok": false, "reason": "不能修改敌人入口", "cell": [cell.x, cell.y]}
		if TerrainGenerator.protected_at(terrain_grid, cell) or GameDefs.is_core_cell(cell):
			return {"ok": false, "reason": "不能修改保护区域", "cell": [cell.x, cell.y]}
		if occupied.has(GameDefs.cell_key(cell)):
			return {"ok": false, "reason": "有构造占用该格", "cell": [cell.x, cell.y]}
		var before: Dictionary = _terrain_cell(terrain_grid[cell.y][cell.x])
		var after := before.duplicate(true)
		match tool:
			"raise":
				after["height"] = int(before["height"]) + 1
				after["slope"] = ""
			"lower":
				after["height"] = int(before["height"]) - 1
				after["slope"] = ""
			"flatten":
				after["height"] = clampi(int(command.get("target_height", 0)), 0, GameDefs.MAX_TERRAIN_HEIGHT)
				after["slope"] = ""
			"slope":
				after["slope"] = str(command.get("slope", "north"))
			"rotate_slope":
				var directions := ["north", "east", "south", "west"]
				var old_index := directions.find(str(before.get("slope", "")))
				after["slope"] = directions[posmod(old_index + 1, directions.size())]
		if int(after["height"]) < 0 or int(after["height"]) > GameDefs.MAX_TERRAIN_HEIGHT:
			return {"ok": false, "reason": "高度必须保持在0至4", "cell": [cell.x, cell.y]}
		if str(after.get("slope", "")) != "" and not GameDefs.SLOPE_DIRECTIONS.has(str(after["slope"])):
			return {"ok": false, "reason": "斜坡方向无效", "cell": [cell.x, cell.y]}
		if before != after:
			preview[cell.y][cell.x] = after
			changes.append({"cell": [cell.x, cell.y], "before": before, "after": after})
	if changes.is_empty():
		return {"ok": false, "reason": "所选格不会发生变化", "cost": 0}
	for change in changes:
		var cell := _array_cell(change["cell"])
		var slope := TerrainGenerator.slope_at(preview, cell)
		if slope.is_empty():
			continue
		var lower_cell: Vector2i = cell + GameDefs.SLOPE_DIRECTIONS[slope]
		if not TerrainGenerator.in_bounds(lower_cell) or TerrainGenerator.height_at(preview, cell) - TerrainGenerator.height_at(preview, lower_cell) != 1:
			return {"ok": false, "reason": "斜坡必须朝向低一级相邻格", "cell": [cell.x, cell.y]}
	var routes: Dictionary = {}
	var barrier_count := 0
	for entry_name in GameDefs.ENTRY_CELLS:
		var path := path_to_core(GameDefs.ENTRY_CELLS[entry_name], preview, towers)
		routes[entry_name] = path
		barrier_count += count_barriers_on_path(path, preview)
	return {
		"ok": true,
		"reason": "",
		"cost": changes.size() * GameDefs.TERRAIN_ACTION_COST,
		"changes": changes,
		"preview_grid": preview,
		"routes": routes,
		"barrier_count": barrier_count,
	}

static func apply_terrain_command(terrain_grid: Array, command: Dictionary, towers: Array) -> Dictionary:
	var validation := validate_terrain_command(terrain_grid, command, towers)
	if not bool(validation.get("ok", false)):
		return validation
	for change in validation["changes"]:
		var cell := _array_cell(change["cell"])
		terrain_grid[cell.y][cell.x] = change["after"].duplicate(true)
	validation.erase("preview_grid")
	return validation

static func undo_terrain_changes(terrain_grid: Array, changes: Array) -> void:
	for change in changes:
		var cell := _array_cell(change.get("cell", [-1, -1]))
		if TerrainGenerator.in_bounds(cell):
			terrain_grid[cell.y][cell.x] = _terrain_cell(change.get("before", {}))

static func can_change_terrain(terrain_grid: Array, cell: Vector2i, delta: int, towers: Array) -> Dictionary:
	var command := {"tool": "raise" if delta > 0 else "lower", "cells": [[cell.x, cell.y]]}
	var result := validate_terrain_command(terrain_grid, command, towers)
	if bool(result.get("ok", false)):
		result["height"] = int(result["changes"][0]["after"]["height"])
	return result

static func solve_attack(attacker: Dictionary, source: Vector2i, target: Vector2, target_height: int, terrain_grid: Array, modifiers: Dictionary = {}) -> Dictionary:
	var source_height := TerrainGenerator.height_at(terrain_grid, source)
	var above := clampi(source_height - target_height, 0, GameDefs.MAX_TERRAIN_HEIGHT)
	var below := clampi(target_height - source_height, 0, GameDefs.MAX_TERRAIN_HEIGHT)
	var range_value := float(attacker.get("range", 1.0)) * (1.0 + 0.08 * float(above))
	range_value *= 1.0 + float(modifiers.get("range_mult", 0.0))
	var distance := Vector2(source).distance_to(target)
	var indirect := str(attacker.get("attack_kind", "direct")) != "direct"
	var within_range := distance <= range_value
	# Range rejection is intentionally performed before ray marching; the result
	# is identical, but a 100-enemy stress frame avoids thousands of needless
	# terrain samples for distant targets.
	var line_clear := within_range and (indirect or _line_of_sight_interpolated(source, target, terrain_grid, source_height, target_height))
	var protection := minf(0.48, 0.12 * float(below))
	if float(modifiers.get("pierce", 0.0)) > 0.0:
		protection *= 0.5
	return {
		"can_attack": within_range and line_clear,
		"distance": distance,
		"range": range_value,
		"line_of_sight": line_clear,
		"source_height": source_height,
		"target_height": target_height,
		"height_damage_multiplier": (1.0 + 0.10 * float(above)) * (1.0 - protection),
		"highground_levels": above,
		"protection": protection,
	}

static func attack_range(unit: Dictionary, height: int, modifiers: Dictionary = {}) -> float:
	var result := float(unit.get("range", 1.0))
	if str(unit.get("role", "")) == "ranged":
		result *= 1.0 + 0.08 * float(clampi(height, 0, GameDefs.MAX_TERRAIN_HEIGHT))
	result *= 1.0 + float(modifiers.get("range_mult", 0.0))
	return result

static func has_line_of_sight(source: Vector2i, target: Vector2, terrain_grid: Array, source_height: int, target_height: int = 0) -> bool:
	return _line_of_sight_interpolated(source, target, terrain_grid, source_height, target_height)

static func death_pressure(raw_pressure: float, distance_cells: float, resistance: float, multiplier: float = 1.0) -> Dictionary:
	var transmitted := raw_pressure * multiplier / (1.0 + pow(distance_cells / 6.0, 2.0))
	var final_damage := maxf(0.0, transmitted - resistance)
	return {"raw": raw_pressure * multiplier, "distance": distance_cells, "transmitted": transmitted, "resisted": minf(transmitted, resistance), "damage": final_damage}

static func damage_after_armor(attack: float, armor: float, pierce: float = 0.0, minimum_ratio: float = 0.05) -> float:
	var effective_armor := maxf(0.0, armor - pierce)
	var reduced := attack * (100.0 / (100.0 + effective_armor * 8.0))
	return maxf(attack * minimum_ratio, reduced)

static func enemy_damage_to_tower(attack: float, armor: float, attacker_height: int, tower_height: int, pierce: float = 0.0) -> float:
	var result := damage_after_armor(attack, armor, pierce, 0.0)
	if tower_height > attacker_height:
		var protection := minf(0.48, 0.12 * float(tower_height - attacker_height))
		if pierce > 0.0:
			protection *= 0.5
		result *= 1.0 - protection
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
	deployed.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return int(a.get("deployment_order", 0)) > int(b.get("deployment_order", 0)))
	var disabled_ids: Array[String] = []
	for tower in deployed:
		if used <= effective_max:
			break
		tower["disabled"] = true
		used -= int(tower.get("bandwidth", 0))
		disabled_ids.append(str(tower.get("instance_id", "")))
	return {"active_used": used, "disabled": disabled_ids, "shortage": maxi(0, _total_deployed_bandwidth(towers) - effective_max)}

static func path_edge_info(from: Vector2i, to: Vector2i, terrain_grid: Array) -> Dictionary:
	var from_height := TerrainGenerator.height_at(terrain_grid, from)
	var to_height := TerrainGenerator.height_at(terrain_grid, to)
	var difference := absi(from_height - to_height)
	if difference == 0:
		return {"passable": true, "ramped": false, "barrier": false, "cost": 1.0, "high_cell": [-1, -1], "height_delta": 0, "slope": ""}
	var high_cell := from if from_height > to_height else to
	var low_cell := to if from_height > to_height else from
	var downhill := low_cell - high_cell
	var slope_name := TerrainGenerator.slope_at(terrain_grid, high_cell)
	var ramped: bool = difference == 1 and GameDefs.SLOPE_DIRECTIONS.get(slope_name, Vector2i.ZERO) == downhill
	return {
		"passable": ramped,
		"ramped": ramped,
		"barrier": not ramped,
		"cost": 1.25 if ramped else 12.0 + float(difference) * 8.0,
		"high_cell": [high_cell.x, high_cell.y],
		"height_delta": difference,
		"slope": slope_name,
	}

static func path_to_core(entry: Vector2i, terrain_grid: Array, towers: Array) -> Array[Vector2i]:
	if not TerrainGenerator.in_bounds(entry):
		return []
	var occupied := occupied_cells(towers)
	var heap: Array = []
	_heap_push(heap, [0.0, entry])
	var cost_so_far := {GameDefs.cell_key(entry): 0.0}
	var came_from := {GameDefs.cell_key(entry): ""}
	var target := Vector2i(-1, -1)
	while not heap.is_empty():
		var item: Array = _heap_pop(heap)
		var current_cost := float(item[0])
		var current: Vector2i = item[1]
		var current_key := GameDefs.cell_key(current)
		if current_cost > float(cost_so_far.get(current_key, INF)) + 0.0001:
			continue
		if GameDefs.is_core_cell(current):
			target = current
			break
		for direction in CARDINALS:
			var next: Vector2i = current + direction
			if not TerrainGenerator.in_bounds(next):
				continue
			var edge := path_edge_info(current, next, terrain_grid)
			var step_cost := float(edge["cost"])
			if occupied.has(GameDefs.cell_key(next)):
				step_cost += 9.0
			var next_key := GameDefs.cell_key(next)
			var new_cost := current_cost + step_cost
			if new_cost < float(cost_so_far.get(next_key, INF)):
				cost_so_far[next_key] = new_cost
				came_from[next_key] = current_key
				_heap_push(heap, [new_cost, next])
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

static func count_barriers_on_path(path: Array, terrain_grid: Array) -> int:
	var count := 0
	for index in range(maxi(0, path.size() - 1)):
		if not bool(path_edge_info(path[index], path[index + 1], terrain_grid)["passable"]):
			count += 1
	return count

static func _line_of_sight_interpolated(source: Vector2i, target: Vector2, terrain_grid: Array, source_height: int, target_height: int) -> bool:
	var start := Vector2(source)
	var distance := start.distance_to(target)
	var steps := maxi(2, ceili(distance * 2.0))
	var start_y := float(source_height) + 1.25
	var end_y := float(target_height) + 0.65
	for index in range(1, steps):
		var progress := float(index) / float(steps)
		var sample := start.lerp(target, progress)
		var cell := Vector2i(roundi(sample.x), roundi(sample.y))
		if cell == source or not TerrainGenerator.in_bounds(cell):
			continue
		var ray_height := lerpf(start_y, end_y, progress)
		if float(TerrainGenerator.height_at(terrain_grid, cell)) > ray_height + 0.05:
			return false
	return true

static func _terrain_cell(value: Variant) -> Dictionary:
	if value is Dictionary:
		return {"height": int(value.get("height", 0)), "slope": str(value.get("slope", "")), "protected": bool(value.get("protected", false))}
	return {"height": int(value), "slope": "", "protected": false}

static func _total_deployed_bandwidth(towers: Array) -> int:
	var total := 0
	for tower in towers:
		if bool(tower.get("deployed", false)) and float(tower.get("durability", 0.0)) > 0.0:
			total += int(tower.get("bandwidth", 0))
	return total

static func _heap_push(heap: Array, item: Array) -> void:
	heap.append(item)
	var index := heap.size() - 1
	while index > 0:
		var parent: int = int((index - 1) / 2)
		if float(heap[parent][0]) <= float(item[0]):
			break
		heap[index] = heap[parent]
		index = parent
	heap[index] = item

static func _heap_pop(heap: Array) -> Array:
	var result: Array = heap[0]
	var last: Array = heap.pop_back()
	if heap.is_empty():
		return result
	var index := 0
	while true:
		var left := index * 2 + 1
		if left >= heap.size():
			break
		var right := left + 1
		var smallest := left
		if right < heap.size() and float(heap[right][0]) < float(heap[left][0]):
			smallest = right
		if float(last[0]) <= float(heap[smallest][0]):
			break
		heap[index] = heap[smallest]
		index = smallest
	heap[index] = last
	return result

static func _array_cell(value: Variant) -> Vector2i:
	if value is Vector2i:
		return value
	if value is Vector2:
		return Vector2i(roundi(value.x), roundi(value.y))
	if value is Array and value.size() >= 2:
		return Vector2i(int(value[0]), int(value[1]))
	return Vector2i(-1, -1)
