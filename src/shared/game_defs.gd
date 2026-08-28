class_name GameDefs
extends RefCounted

const BOARD_SIZE := 25
const CORE_MIN := Vector2i(11, 17)
const CORE_MAX := Vector2i(13, 19)
const CORE_CENTER := Vector2(12.0, 18.0)
const ENTRY_CELLS := {
	"north": Vector2i(12, 0),
	"west": Vector2i(0, 12),
	"east": Vector2i(24, 12),
	"south": Vector2i(12, 24),
}
const ACT_FLOORS := [17, 16, 15]
const ACT_NAMES := ["噪声边境", "记忆工厂", "统御核心"]
const ACT_IDS := ["noise_frontier", "memory_factory", "control_core"]
const ACTIVE_ENEMY_CAP := 100
const REINFORCEMENT_RATIO := 0.10
const SAVE_SCHEMA_VERSION := 1

enum ScreenState {
	MENU,
	MAP,
	PREBATTLE,
	BATTLE,
	NODE,
	REWARD,
	SETTLEMENT,
	CODEX,
	SETTINGS,
}

static func is_core_cell(cell: Vector2i) -> bool:
	return cell.x >= CORE_MIN.x and cell.x <= CORE_MAX.x and cell.y >= CORE_MIN.y and cell.y <= CORE_MAX.y

static func is_entry_cell(cell: Vector2i) -> bool:
	return ENTRY_CELLS.values().has(cell)

static func cell_key(cell: Vector2i) -> String:
	return "%d,%d" % [cell.x, cell.y]

static func key_cell(key: String) -> Vector2i:
	var parts := key.split(",")
	return Vector2i(int(parts[0]), int(parts[1]))

static func clamp_spirit(value: float, maximum: float) -> float:
	return clampf(value, 0.0, maximum)

static func deep_copy(value: Variant) -> Variant:
	return JSON.parse_string(JSON.stringify(value))

