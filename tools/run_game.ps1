$ErrorActionPreference = 'Stop'
$versions = Import-PowerShellDataFile -LiteralPath (Join-Path $PSScriptRoot 'versions.psd1')
$godot = Join-Path $versions.GodotFolder $versions.GodotGuiExe
if (-not (Test-Path -LiteralPath $godot)) {
    & (Join-Path $PSScriptRoot 'setup_godot.ps1')
}
& $godot --path (Split-Path -Parent $PSScriptRoot)

