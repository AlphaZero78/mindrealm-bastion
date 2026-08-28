param(
    [switch]$SkipImport
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$versions = Import-PowerShellDataFile (Join-Path $PSScriptRoot 'versions.psd1')
$godotRoot = Join-Path $env:LOCALAPPDATA "MindrealmTools\Godot\$($versions.GodotVersion)"
$godot = Join-Path $godotRoot 'Godot_v4.7.2-stable_win64_console.exe'
if (-not (Test-Path -LiteralPath $godot)) {
    throw "未找到 Godot $($versions.GodotVersion)。请先运行 tools/setup_godot.ps1。"
}

$testUser = Join-Path $env:TEMP 'mindrealm_bastion_test_user'
New-Item -ItemType Directory -Force -Path $testUser | Out-Null
$originalAppData = $env:APPDATA
$env:APPDATA = $testUser
try {
    if (-not $SkipImport) {
        & $godot --headless --path $projectRoot --editor --quit
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
    & $godot --headless --path $projectRoot --script 'res://tests/test_runner.gd'
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & $godot --headless --path $projectRoot --script 'res://tests/reference_runs.gd'
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & $godot --headless --path $projectRoot --script 'res://tests/simulation/performance_test.gd'
    exit $LASTEXITCODE
}
finally {
    $env:APPDATA = $originalAppData
}
