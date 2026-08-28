param(
    [switch]$SkipImport
)

$ErrorActionPreference = 'Stop'
$developmentRoot = Split-Path -Parent $PSScriptRoot
$projectRoot = Split-Path -Parent $developmentRoot
$versions = & (Join-Path $PSScriptRoot 'versions.ps1')
$godotRoot = Join-Path $env:LOCALAPPDATA "MindrealmTools\Godot\$($versions.GodotVersion)"
$godot = Join-Path $godotRoot 'Godot_v4.7.2-stable_win64_console.exe'
if (-not (Test-Path -LiteralPath $godot)) {
    throw "Godot $($versions.GodotVersion) was not found. Run development/tools/setup_godot.ps1 first."
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
    & $godot --headless --path $projectRoot --script 'res://development/tests/test_runner.gd'
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & $godot --headless --path $projectRoot --script 'res://development/tests/reference_runs.gd'
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & $godot --headless --path $projectRoot --script 'res://development/tests/simulation/performance_test.gd'
    exit $LASTEXITCODE
}
finally {
    $env:APPDATA = $originalAppData
}
