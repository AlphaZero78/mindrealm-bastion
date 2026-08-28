param(
    [switch]$SkipTests
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$versions = Import-PowerShellDataFile (Join-Path $PSScriptRoot 'versions.psd1')
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
$releaseRoot = [IO.Path]::GetFullPath((Join-Path $releaseParent '心域防线'))
if (-not $releaseRoot.StartsWith($releaseParent + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw "发布目录越界：$releaseRoot"
}
if (Test-Path -LiteralPath $releaseRoot) {
    Remove-Item -LiteralPath $releaseRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $releaseRoot | Out-Null
$releaseExe = Join-Path $releaseRoot '心域防线.exe'
& $godot --headless --path $projectRoot --export-release 'Windows x64' $releaseExe
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $releaseExe)) {
    throw 'Windows x64 导出失败。'
}

$smokeLog = Join-Path $env:TEMP 'mindrealm_release_smoke.log'
if (Test-Path -LiteralPath $smokeLog) { Remove-Item -LiteralPath $smokeLog -Force }
$process = Start-Process -FilePath $releaseExe -ArgumentList @('--log-file', $smokeLog, '--', '--smoke-test') -PassThru -WindowStyle Hidden
if (-not $process.WaitForExit(30000)) {
    $process.Kill()
    throw '发布版启动冒烟测试超时。'
}
if ($process.ExitCode -ne 0) { throw "发布版异常退出：$($process.ExitCode)" }
$smokeText = Get-Content -LiteralPath $smokeLog -Raw -ErrorAction Stop
if ($smokeText -notmatch 'MINDREALM_RELEASE_SMOKE_OK') { throw '发布版未完成冒烟测试。' }
if ($smokeText -match '(?m)^ERROR:|^WARNING:|SCRIPT ERROR:') { throw "发布版日志包含错误或警告：`n$smokeText" }

Write-Host "WINDOWS_BUILD_OK $releaseExe"
