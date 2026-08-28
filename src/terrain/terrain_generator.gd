class_name TerrainGenerator
extends RefCounted

static func generate(seed_streams: SeedStreams) -> Array:
	var generator := seed_streams.rng_at("terrain", 0)
	var heights: Array = []
	for y in GameDefs.BOARD_SIZE:
		var row: Array = []
		for x in GameDefs.BOARD_SIZE:
			var edge_distance := mini(mini(x, y), mini(GameDefs.BOARD_SIZE - 1 - x, GameDefs.BOARD_SIZE - 1 - y))
			var ridge := 0
			if edge_distance > 3:
				ridge = generator.randi_range(0, 3)
			if abs(x - 5) <= 2 or abs(x - 19) <= 2 or abs(y - 5) <= 2 or abs(y - 20) <= 2:
				ridge = mini(3, ridge + 1)
			row.append(ridge)
		heights.append(row)
	_carve_guaranteed_routes(heights)
	_build_guaranteed_platforms(heights)
	_relax_slopes(heights, 10)
	_lock_special_cells(heights)
	_relax_slopes(heights, 4)
	_lock_special_cells(heights)
	return heights

static func _carve_guaranteed_routes(heights: Array) -> void:
	for y in range(0, 18):
		heights[y][12] = 0
	for x in range(0, 14):
		heights[12][x] = 0
	for x in range(12, GameDefs.BOARD_SIZE):
		heights[12][x] = 0
	for y in range(18, GameDefs.BOARD_SIZE):
		heights[y][12] = 0
	for y in range(13, 17):
		for x in range(11, 14):
			heights[y][x] = 0
	# Readable one-cell chokepoints make 1x1 melee constructs meaningful blockers.
	for y in range(6, 11):
		heights[y][11] = 1
		heights[y][13] = 1
	for y in range(20, 24):
		heights[y][11] = 1
		heights[y][13] = 1
	for x in range(6, 11):
		heights[11][x] = 1
		heights[13][x] = 1
	for x in range(15, 20):
		heights[11][x] = 1
		heights[13][x] = 1

static func _relax_slopes(heights: Array, passes: int) -> void:
	for _pass in passes:
		var changed := false
		for y in GameDefs.BOARD_SIZE:
			for x in GameDefs.BOARD_SIZE:
				var current := int(heights[y][x])
				for direction in [Vector2i.LEFT, Vector2i.RIGHT, Vector2i.UP, Vector2i.DOWN]:
					var neighbor: Vector2i = Vector2i(x, y) + direction
					if neighbor.x < 0 or neighbor.y < 0 or neighbor.x >= GameDefs.BOARD_SIZE or neighbor.y >= GameDefs.BOARD_SIZE:
						continue
					var other := int(heights[neighbor.y][neighbor.x])
					if current > other + 1:
						heights[y][x] = other + 1
						current = other + 1
						changed = true
		if not changed:
			break

static func _lock_special_cells(heights: Array) -> void:
	for y in range(GameDefs.CORE_MIN.y, GameDefs.CORE_MAX.y + 1):
		for x in range(GameDefs.CORE_MIN.x, GameDefs.CORE_MAX.x + 1):
			heights[y][x] = 0
	for entry in GameDefs.ENTRY_CELLS.values():
		heights[entry.y][entry.x] = 0

static func _build_guaranteed_platforms(heights: Array) -> void:
	# Four readable 2x2 firing pads ensure every seed supports the full ranged roster.
	# They sit beside, not on, the guaranteed ground lanes so they never become blockers.
	var origins := [Vector2i(8, 5), Vector2i(5, 8), Vector2i(18, 8), Vector2i(15, 20)]
	for origin in origins:
		for y in range(origin.y - 1, origin.y + 3):
			for x in range(origin.x - 1, origin.x + 3):
				if x >= 0 and y >= 0 and x < GameDefs.BOARD_SIZE and y < GameDefs.BOARD_SIZE:
					heights[y][x] = mini(int(heights[y][x]), 2)
		for y in range(origin.y, origin.y + 2):
			for x in range(origin.x, origin.x + 2):
				heights[y][x] = 1
