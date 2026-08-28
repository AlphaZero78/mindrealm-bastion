param(
    [switch]$SkipGodotLoad
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $projectRoot 'assets\third_party\ASSET_MANIFEST.sha256'
if (-not (Test-Path -LiteralPath $manifestPath)) {
    throw "缺少第三方资源清单：$manifestPath"
}

$checked = 0
foreach ($line in Get-Content -LiteralPath $manifestPath -Encoding UTF8) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) { continue }
    $parts = $trimmed -split '\s+', 2
    if ($parts.Count -ne 2) { throw "资源清单格式错误：$trimmed" }
    $expected = $parts[0].ToLowerInvariant()
    $relative = $parts[1].Replace('/', [IO.Path]::DirectorySeparatorChar)
    $path = Join-Path $projectRoot $relative
    if (-not (Test-Path -LiteralPath $path)) { throw "缺少资源：$relative" }
    $actual = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $expected) { throw "资源哈希不匹配：$relative" }
    $checked++
}

$licenseRoots = @(
    'assets\third_party\kenney\space-kit\License.txt',
    'assets\third_party\kenney\modular-space-kit\License.txt',
    'assets\third_party\kenney\tower-defense-kit\License.txt',
    'assets\third_party\kenney\ui-sci-fi\License.txt',
    'assets\third_party\kenney\sci-fi-sounds\License.txt',
    'assets\third_party\opengameart\dark-sci-fi-audio\LICENSE.txt'
)
foreach ($relative in $licenseRoots) {
    if (-not (Test-Path -LiteralPath (Join-Path $projectRoot $relative))) {
        throw "缺少授权记录：$relative"
    }
}

if (-not $SkipGodotLoad) {
    $versions = Import-PowerShellDataFile (Join-Path $PSScriptRoot 'versions.psd1')
    $godot = Join-Path $versions.GodotFolder $versions.GodotExe
    & $godot --headless --path $projectRoot --script 'res://tests/asset_test.gd'
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "ASSET_VERIFY_OK files=$checked licenses=$($licenseRoots.Count)"

