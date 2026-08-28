$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$versions = Import-PowerShellDataFile (Join-Path $PSScriptRoot 'versions.psd1')
$godot = Join-Path $env:LOCALAPPDATA "MindrealmTools\Godot\$($versions.GodotVersion)\Godot_v4.7.2-stable_win64_console.exe"
if (-not (Test-Path -LiteralPath $godot)) { throw '请先运行 tools/setup_godot.ps1。' }
$visualUser = Join-Path $env:TEMP 'mindrealm_bastion_visual_user'
New-Item -ItemType Directory -Force -Path $visualUser | Out-Null
$env:APPDATA = $visualUser
& $godot --display-driver windows --rendering-driver opengl3 --audio-driver Dummy --resolution 1600x900 --path $projectRoot --script 'res://tests/visual/capture_visuals.gd'
exit $LASTEXITCODE
