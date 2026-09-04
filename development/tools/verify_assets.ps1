param(
    [switch]$SkipGodotLoad
)

$ErrorActionPreference = 'Stop'
$developmentRoot = Split-Path -Parent $PSScriptRoot
$projectRoot = Split-Path -Parent $developmentRoot
$manifestPath = Join-Path $projectRoot 'assets\third_party\ASSET_MANIFEST.sha256'
if (-not (Test-Path -LiteralPath $manifestPath)) {
    throw "Third-party asset manifest is missing: $manifestPath"
}

$checked = 0
foreach ($line in Get-Content -LiteralPath $manifestPath -Encoding UTF8) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) { continue }
    $parts = $trimmed -split '\s+', 2
    if ($parts.Count -ne 2) { throw "Invalid asset manifest entry: $trimmed" }
    $expected = $parts[0].ToLowerInvariant()
    $relative = $parts[1].Replace('/', [IO.Path]::DirectorySeparatorChar)
    $path = Join-Path $projectRoot $relative
    if (-not (Test-Path -LiteralPath $path)) { throw "Asset is missing: $relative" }
    $actual = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $expected) { throw "Asset hash mismatch: $relative" }
    $checked++
}

$licenseRoots = @(
    'development\assets\model_sources\kenney\space-kit\License.txt',
    'development\assets\model_sources\kenney\modular-space-kit\License.txt',
    'development\assets\model_sources\kenney\tower-defense-kit\License.txt',
    'assets\third_party\kenney\pixel-ui\LICENSE.txt',
    'assets\third_party\kenney\game-icons\LICENSE.txt',
    'assets\third_party\kenney\input-prompts-pixel\LICENSE.txt',
    'assets\third_party\kenney\sci-fi-sounds\License.txt',
    'assets\third_party\opengameart\dark-sci-fi-audio\LICENSE.txt',
    'assets\third_party\opengameart\singularity\LICENSE.txt',
    'assets\third_party\fusion-pixel-font\OFL.txt'
)
foreach ($relative in $licenseRoots) {
    if (-not (Test-Path -LiteralPath (Join-Path $projectRoot $relative))) {
        throw "License record is missing: $relative"
    }
}

if (-not $SkipGodotLoad) {
    $versions = & (Join-Path $PSScriptRoot 'versions.ps1')
    $godot = Join-Path $versions.GodotFolder $versions.GodotExe
    & $godot --headless --path $projectRoot --script 'res://development/tests/asset_test.gd'
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "ASSET_VERIFY_OK files=$checked licenses=$($licenseRoots.Count)"
