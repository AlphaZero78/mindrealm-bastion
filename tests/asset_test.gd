extends SceneTree

func _init() -> void:
	var missing: Array[String] = []
	for path in AssetRegistry.required_assets():
		if not ResourceLoader.exists(path):
			missing.append(path)
			continue
		var resource := load(path)
		if resource == null:
			missing.append(path + "（加载失败）")
	if not missing.is_empty():
		for path in missing:
			push_error("资源验证失败：%s" % path)
		quit(1)
		return
	print("GODOT_ASSET_LOAD_OK files=%d" % AssetRegistry.required_assets().size())
	quit(0)
