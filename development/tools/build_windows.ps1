param(
    [switch]$SkipTests
)

$ErrorActionPreference = 'Stop'
$developmentRoot = Split-Path -Parent $PSScriptRoot
$projectRoot = Split-Path -Parent $developmentRoot
$versions = & (Join-Path $PSScriptRoot 'versions.ps1')
$godot = Join-Path $versions.GodotFolder $versions.GodotExe
if (-not (Test-Path -LiteralPath $godot)) {
    & (Join-Path $PSScriptRoot 'setup_godot.ps1')
}
$template = Join-Path $env:APPDATA "Godot\export_templates\$($versions.GodotVersion).stable\windows_release_x86_64.exe"
if (-not (Test-Path -LiteralPath $template)) {
    & (Join-Path $PSScriptRoot 'setup_godot.ps1')
}

& (Join-Path $PSScriptRoot 'verify_assets.ps1')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
if (-not $SkipTests) {
    & (Join-Path $PSScriptRoot 'test.ps1')
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

$releaseParent = [IO.Path]::GetFullPath('D:\game_build_release')
$gameName = -join @([char]0x5FC3, [char]0x57DF, [char]0x9632, [char]0x7EBF)
$releaseRoot = [IO.Path]::GetFullPath((Join-Path $releaseParent $gameName))
if (-not $releaseRoot.StartsWith($releaseParent + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Release path escaped its parent directory: $releaseRoot"
}
if (Test-Path -LiteralPath $releaseRoot) {
    Remove-Item -LiteralPath $releaseRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $releaseRoot | Out-Null
$releaseExe = Join-Path $releaseRoot "$gameName.exe"
& $godot --headless --path $projectRoot --export-release 'Windows x64' $releaseExe
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $releaseExe)) {
    throw 'Windows x64 export failed.'
}

$smokeLog = Join-Path $env:TEMP 'mindrealm_release_smoke.log'
if (Test-Path -LiteralPath $smokeLog) { Remove-Item -LiteralPath $smokeLog -Force }
$process = Start-Process -FilePath $releaseExe -ArgumentList @('--log-file', $smokeLog, '--', '--smoke-test') -PassThru -WindowStyle Hidden
if (-not $process.WaitForExit(30000)) {
    $process.Kill()
    throw 'Release smoke test timed out.'
}
if ($process.ExitCode -ne 0) { throw "Release exited with code $($process.ExitCode)." }
$smokeText = Get-Content -LiteralPath $smokeLog -Raw -ErrorAction Stop
if ($smokeText -notmatch 'MINDREALM_RELEASE_SMOKE_OK') { throw 'Release smoke test did not complete.' }
if ($smokeText -match '(?m)^ERROR:|^WARNING:|SCRIPT ERROR:') { throw "Release log contains errors or warnings:`n$smokeText" }

Write-Host "WINDOWS_BUILD_OK $releaseExe"
