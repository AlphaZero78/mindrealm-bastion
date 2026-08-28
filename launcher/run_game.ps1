param(
    [switch]$SmokeTest
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$toolRoot = Join-Path $projectRoot 'development\tools'
$versions = & (Join-Path $toolRoot 'versions.ps1')
$executableName = if ($SmokeTest) { $versions.GodotExe } else { $versions.GodotGuiExe }
$godot = Join-Path $versions.GodotFolder $executableName
if (-not (Test-Path -LiteralPath $godot)) {
    Write-Host 'Preparing the pinned Godot runtime for first launch...'
    & (Join-Path $toolRoot 'setup_godot.ps1') -SkipExportTemplates
}
$godotArgs = @('--path', $projectRoot)
if ($SmokeTest) {
    $godotArgs = @('--headless', '--audio-driver', 'Dummy', '--path', $projectRoot, '--', '--smoke-test')
}
& $godot @godotArgs
exit $LASTEXITCODE
