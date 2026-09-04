class_name TerrainGenerator
extends RefCounted

const CARDINALS := [Vector2i.UP, Vector2i.RIGHT, Vector2i.DOWN, Vector2i.LEFT]

static func generate(seed_streams: SeedStreams) -> Array:
	var generator := seed_streams.rng_at("terrain_v2", 0)
	var grid: Array = []
	for y in GameDefs.BOARD_SIZE:
		var row: Array = []
		for x in GameDefs.BOARD_SIZE:
			row.append(_cell(0, "", false))
		grid.append(row)
	# Broad mesas provide readable firing positions. Their stepped rims and sparse
	# ramps make height useful without turning the board into visual noise.
	_build_platform(grid, Rect2i(8, 7, 8, 8), 2, "south")
	_build_platform(grid, Rect2i(25, 7, 8, 8), 3, "west")
	_build_platform(grid, Rect2i(5, 24, 8, 8), 2, "east")
	_build_platform(grid, Rect2i(28, 25, 8, 8), 3, "north")
	# Two compact firebases overlook the final approach. They create enough
	# readable 2x2 ranged slots for a mature build without sealing the central
	# seven-cell corridor around the fire core.
	_build_platform(grid, Rect2i(12, 23, 7, 6), 2, "east")
	_build_platform(grid, Rect2i(22, 23, 7, 6), 2, "west")
	for patch_index in 14:
		var width := generator.randi_range(2, 5)
		var height := generator.randi_range(2, 5)
		var origin := Vector2i(generator.randi_range(2, GameDefs.BOARD_SIZE - width - 3), generator.randi_range(2, GameDefs.BOARD_SIZE - height - 3))
		var level := generator.randi_range(1, GameDefs.MAX_TERRAIN_HEIGHT)
		for y in range(origin.y, origin.y + height):
			for x in range(origin.x, origin.x + width):
				if abs(x - 20) <= 2 or abs(y - 20) <= 2 or (x >= 17 and x <= 23 and y >= 27):
					continue
				grid[y][x]["height"] = maxi(int(grid[y][x]["height"]), level)
	_carve_guaranteed_routes(grid)
	_mark_protected_cells(grid)
	return grid

static func height_at(grid: Array, cell: Vector2i) -> int:
	if not in_bounds(cell) or grid.is_empty():
		return 0
	var value: Variant = grid[cell.y][cell.x]
	return int(value.get("height", 0)) if value is Dictionary else int(value)

static func slope_at(grid: Array, cell: Vector2i) -> String:
	if not in_bounds(cell) or grid.is_empty():
		return ""
	var value: Variant = grid[cell.y][cell.x]
	return str(value.get("slope", "")) if value is Dictionary else ""

static func protected_at(grid: Array, cell: Vector2i) -> bool:
	if not in_bounds(cell) or grid.is_empty():
		return false
	var value: Variant = grid[cell.y][cell.x]
	return bool(value.get("protected", false)) if value is Dictionary else GameDefs.is_core_cell(cell) or GameDefs.is_entry_cell(cell)

static func in_bounds(cell: Vector2i) -> bool:
	return cell.x >= 0 and cell.y >= 0 and cell.x < GameDefs.BOARD_SIZE and cell.y < GameDefs.BOARD_SIZE

static func _cell(height: int, slope: String = "", protected: bool = false) -> Dictionary:
	return {"height": clampi(height, 0, GameDefs.MAX_TERRAIN_HEIGHT), "slope": slope, "protected": protected}

static func _build_platform(grid: Array, rect: Rect2i, level: int, ramp_side: String) -> void:
	for y in range(rect.position.y, rect.end.y):
		for x in range(rect.position.x, rect.end.x):
			var edge := mini(mini(x - rect.position.x, rect.end.x - 1 - x), mini(y - rect.position.y, rect.end.y - 1 - y))
			grid[y][x]["height"] = mini(level, edge + 1)
	# A two-step stair reaches each major platform while the other edges remain
	# destructible cliffs. A slope points from its high cell toward its lower cell.
	var center := rect.position + rect.size / 2
	var outward: Vector2i = GameDefs.SLOPE_DIRECTIONS[ramp_side]
	for step in range(1, level + 1):
		var high_cell := center - outward * (level - step)
		if in_bounds(high_cell):
			grid[high_cell.y][high_cell.x]["height"] = step
			grid[high_cell.y][high_cell.x]["slope"] = ramp_side

static func _carve_guaranteed_routes(grid: Array) -> void:
	for y in GameDefs.BOARD_SIZE:
		for x in range(19, 22):
			grid[y][x] = _cell(0)
	for x in GameDefs.BOARD_SIZE:
		for y in range(19, 22):
			grid[y][x] = _cell(0)
	# A wider approach around the 5x5 core prevents a multi-cell melee construct
	# from accidentally making every entry rely on breach routing.
	for y in range(21, GameDefs.CORE_MAX.y + 1):
		for x in range(17, 24):
			grid[y][x] = _cell(0)

static func _mark_protected_cells(grid: Array) -> void:
	for y in range(GameDefs.CORE_MIN.y, GameDefs.CORE_MAX.y + 1):
		for x in range(GameDefs.CORE_MIN.x, GameDefs.CORE_MAX.x + 1):
			grid[y][x] = _cell(0, "", true)
	for entry in GameDefs.ENTRY_CELLS.values():
		grid[entry.y][entry.x] = _cell(0, "", true)
