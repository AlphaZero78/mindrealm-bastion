# Manual cleanup after reviewing docs/WEB_REQUIREMENTS.md.
# This script is never run by the game launcher, build, or tests.
[CmdletBinding(SupportsShouldProcess)]
param()
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..')).TrimEnd('\')
if ($projectRoot -ne 'D:\game_build') { throw 'This cleanup is scoped to D:\game_build.' }
if (-not (Test-Path -LiteralPath 'D:\game_build_release\Mindrealm-Web\MANIFEST.sha256')) { throw 'Verified Web release is missing.' }
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'web\app.js'))) { throw 'Web source is missing.' }
$targets = @('.godot','.playwright-cli','logs','assets\third_party\kenney\game-icons','assets\third_party\kenney\input-prompts-pixel','assets\third_party\kenney\pixel-ui','assets\third_party\kenney\ui-sci-fi','assets\third_party\polyhaven','assets\third_party\quaternius')
foreach ($relativePath in $targets) {
    $target = [IO.Path]::GetFullPath((Join-Path $projectRoot $relativePath))
    if (-not $target.StartsWith($projectRoot + '\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Target escaped project.' }
    if (Test-Path -LiteralPath $target) {
        $resolved = (Resolve-Path -LiteralPath $target).Path
        if ($resolved -ne $target -or ((Get-Item -LiteralPath $resolved -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Unexpected redirected target.' }
        if ($PSCmdlet.ShouldProcess($resolved,'Remove old Godot cache or unused old UI assets')) { Remove-Item -LiteralPath $resolved -Recurse -Force }
    }
}
foreach ($folder in @('assets','development\assets')) {
    $files = Get-ChildItem -LiteralPath (Join-Path $projectRoot $folder) -Recurse -File -Force | Where-Object { $_.Extension -in @('.import','.uid') -or $_.Name -eq '.gdignore' }
    foreach ($file in $files) {
        if (-not $file.FullName.StartsWith($projectRoot + '\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Unexpected sidecar path.' }
        if ($PSCmdlet.ShouldProcess($file.FullName,'Remove Godot sidecar')) { Remove-Item -LiteralPath $file.FullName -Force }
    }
}
foreach ($emptyOldDirectory in @('src','scenes','content','development\tests','development\tools')) {
    $path = Join-Path $projectRoot $emptyOldDirectory
    if ((Test-Path -LiteralPath $path) -and -not (Get-ChildItem -LiteralPath $path -File -Recurse -Force)) {
        if ($PSCmdlet.ShouldProcess($path,'Remove empty old source directories')) { Remove-Item -LiteralPath $path -Recurse -Force }
    }
}
$oldRelease = 'D:\game_build_release\心域防线'
if (Test-Path -LiteralPath $oldRelease) {
    $resolved = (Resolve-Path -LiteralPath $oldRelease).Path
    if ($resolved -ne $oldRelease -or ((Get-Item -LiteralPath $resolved).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Unexpected old release path.' }
    if ($PSCmdlet.ShouldProcess($resolved,'Remove previous Godot executable release')) { Remove-Item -LiteralPath $resolved -Recurse -Force }
}
if ($WhatIfPreference) {
    Write-Output 'MINDREALM_OLD_GODOT_CLEANUP_PREVIEW_ONLY'
} else {
    $stillPresent = @((Join-Path $projectRoot '.godot'),$oldRelease) | Where-Object { Test-Path -LiteralPath $_ }
    if ($stillPresent) { throw ('Old Godot files remain: ' + ($stillPresent -join ', ')) }
    Write-Output 'MINDREALM_OLD_GODOT_CLEANUP_FINISHED'
}
