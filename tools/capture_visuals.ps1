$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$versions = Import-PowerShellDataFile (Join-Path $PSScriptRoot 'versions.psd1')
$godot = Join-Path $env:LOCALAPPDATA "MindrealmTools\Godot\$($versions.GodotVersion)\Godot_v4.7.2-stable_win64_console.exe"
if (-not (Test-Path -LiteralPath $godot)) { throw '请先运行 tools/setup_godot.ps1。' }
$visualUser = Join-Path $env:TEMP 'mindrealm_bastion_visual_user'
New-Item -ItemType Directory -Force -Path $visualUser | Out-Null
$originalAppData = $env:APPDATA
$originalVariant = $env:MINDREALM_VISUAL_VARIANT
# 1536x864 and 1280x720 are the effective desktop areas of a 1920x1080
# display at 125% and 150% Windows scaling. Godot's fixed logical viewport
# must remain readable at each effective size.
$cases = @(
    @{ Name = '1920x1080_100pct'; Resolution = '1920x1080' },
    @{ Name = '1366x768_100pct'; Resolution = '1366x768' },
    @{ Name = '1536x864_125pct_effective'; Resolution = '1536x864' },
    @{ Name = '1280x720_150pct_effective'; Resolution = '1280x720' }
)
try {
    $env:APPDATA = $visualUser
    foreach ($case in $cases) {
        $env:MINDREALM_VISUAL_VARIANT = $case.Name
        & $godot --display-driver windows --rendering-driver opengl3 --audio-driver Dummy --resolution $case.Resolution --path $projectRoot --script 'res://tests/visual/capture_visuals.gd'
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
    exit 0
}
finally {
    $env:APPDATA = $originalAppData
    $env:MINDREALM_VISUAL_VARIANT = $originalVariant
}
