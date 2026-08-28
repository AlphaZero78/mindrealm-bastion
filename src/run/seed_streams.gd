class_name SeedStreams
extends RefCounted

var base_seed: String = ""
var cursors: Dictionary = {}

func _init(seed_text: String = "MINDFIELD") -> void:
	base_seed = seed_text.strip_edges()
	if base_seed.is_empty():
		base_seed = "MINDFIELD"

func rng(stream_name: String, advance: int = 1) -> RandomNumberGenerator:
	var cursor := int(cursors.get(stream_name, 0))
	var generator := RandomNumberGenerator.new()
	generator.seed = _stable_hash64("%s|%s|%d" % [base_seed, stream_name, cursor])
	cursors[stream_name] = cursor + maxi(advance, 0)
	return generator

func rng_at(stream_name: String, index: int) -> RandomNumberGenerator:
	var generator := RandomNumberGenerator.new()
	generator.seed = _stable_hash64("%s|%s|%d" % [base_seed, stream_name, index])
	return generator

func choose(stream_name: String, values: Array) -> Variant:
	if values.is_empty():
		return null
	return values[rng(stream_name).randi_range(0, values.size() - 1)]

func shuffled(stream_name: String, values: Array) -> Array:
	var result := values.duplicate(true)
	var generator := rng(stream_name)
	for i in range(result.size() - 1, 0, -1):
		var j := generator.randi_range(0, i)
		var swap: Variant = result[i]
		result[i] = result[j]
		result[j] = swap
	return result

func to_dict() -> Dictionary:
	return {"base_seed": base_seed, "cursors": cursors.duplicate(true)}

static func from_dict(data: Dictionary) -> SeedStreams:
	var streams := SeedStreams.new(str(data.get("base_seed", "MINDFIELD")))
	streams.cursors = data.get("cursors", {}).duplicate(true)
	return streams

static func _stable_hash64(text: String) -> int:
	var hash_value: int = 1469598103934665603
	for byte in text.to_utf8_buffer():
		hash_value = hash_value ^ int(byte)
		hash_value = hash_value * 1099511628211
	return hash_value & 0x7fffffffffffffff
