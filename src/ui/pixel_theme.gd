class_name PixelTheme
extends RefCounted

const BACKGROUND := Color("081b20")
const PANEL := Color("102b31")
const PANEL_DARK := Color("0b2228")
const FRIENDLY := Color("67e3c1")
const HOSTILE := Color("f06b67")
const RESOURCE := Color("f1c75b")
const TEXT := Color("f4ecd8")
const MUTED := Color("8fb4ad")
const OUTLINE := Color("1d5960")
const FONT_PATH := "res://assets/third_party/fusion-pixel-font/fusion-pixel-10px-zh_hans.ttf"
const UI_ROOT := "res://assets/third_party/kenney/pixel-ui/"
const ICON_ROOT := "res://assets/third_party/kenney/game-icons/"
const MAP_ICONS := {
	"combat": "target.png",
	"elite": "medal2.png",
	"camp": "home.png",
	"workshop": "gear.png",
	"shop": "cart.png",
	"treasure": "star.png",
	"event": "information.png",
	"unknown": "question.png",
	"boss": "trophy.png",
	"locked": "locked.png",
	"completed": "checkmark.png",
}

static func create_theme() -> Theme:
	var theme := Theme.new()
	if ResourceLoader.exists(FONT_PATH):
		theme.default_font = load(FONT_PATH) as Font
	theme.default_font_size = 20
	theme.set_color("font_color", "Label", TEXT)
	theme.set_color("font_color", "Button", TEXT)
	theme.set_color("font_hover_color", "Button", Color.WHITE)
	theme.set_color("font_pressed_color", "Button", RESOURCE)
	theme.set_color("font_disabled_color", "Button", MUTED.darkened(0.25))
	theme.set_stylebox("panel", "PanelContainer", panel_style())
	theme.set_stylebox("normal", "Button", button_style("blue"))
	theme.set_stylebox("hover", "Button", button_style("green"))
	theme.set_stylebox("pressed", "Button", button_style("green", true))
	theme.set_stylebox("disabled", "Button", button_style("blue", true))
	theme.set_constant("outline_size", "Label", 2)
	theme.set_color("font_outline_color", "Label", BACKGROUND)
	return theme

static func panel_style(inlay: bool = false) -> StyleBox:
	var path := UI_ROOT + ("panel_inlay.png" if inlay else "panel.png")
	if ResourceLoader.exists(path):
		var style := StyleBoxTexture.new()
		style.texture = load(path)
		style.modulate_color = PANEL_DARK if inlay else PANEL
		style.texture_margin_left = 14.0
		style.texture_margin_right = 14.0
		style.texture_margin_top = 14.0
		style.texture_margin_bottom = 14.0
		style.content_margin_left = 18.0
		style.content_margin_right = 18.0
		style.content_margin_top = 16.0
		style.content_margin_bottom = 16.0
		return style
	var fallback := StyleBoxFlat.new()
	fallback.bg_color = PANEL
	fallback.border_color = OUTLINE
	fallback.set_border_width_all(2)
	fallback.set_content_margin_all(16)
	return fallback

static func button_style(color_id: String, pressed: bool = false) -> StyleBox:
	var suffix := "_pressed" if pressed else ""
	var path := "%sbutton_%s%s.png" % [UI_ROOT, color_id, suffix]
	if ResourceLoader.exists(path):
		var style := StyleBoxTexture.new()
		style.texture = load(path)
		var tint: Color = {"blue":OUTLINE, "green":Color("256c61"), "yellow":Color("796423")}.get(color_id, OUTLINE)
		style.modulate_color = tint.darkened(0.16) if pressed else tint
		style.texture_margin_left = 14.0
		style.texture_margin_right = 14.0
		style.texture_margin_top = 14.0
		style.texture_margin_bottom = 14.0
		style.content_margin_left = 16.0
		style.content_margin_right = 16.0
		style.content_margin_top = 10.0
		style.content_margin_bottom = 10.0
		return style
	return panel_style(true)

static func icon(type_id: String) -> Texture2D:
	var file_name := str(MAP_ICONS.get(type_id, MAP_ICONS["unknown"]))
	var path := ICON_ROOT + file_name
	return load(path) as Texture2D if ResourceLoader.exists(path) else null
