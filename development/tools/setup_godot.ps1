param(
    [switch]$SkipExportTemplates
)

$ErrorActionPreference = 'Stop'
$versions = & (Join-Path $PSScriptRoot 'versions.ps1')
$toolRoot = $versions.GodotFolder
$downloadRoot = Split-Path -Parent $toolRoot
$zipPath = Join-Path $downloadRoot ("Godot_v{0}-stable_win64.exe.zip" -f $versions.GodotVersion)
New-Item -ItemType Directory -Force -Path $toolRoot | Out-Null
$godot = Join-Path $toolRoot $versions.GodotExe
if (-not (Test-Path -LiteralPath $godot)) {
    if (-not (Test-Path -LiteralPath $zipPath)) {
        curl.exe -L --fail --retry 3 --output $zipPath $versions.GodotZipUrl
        if ($LASTEXITCODE -ne 0) { throw 'Godot download failed.' }
    }
    Expand-Archive -LiteralPath $zipPath -DestinationPath $toolRoot -Force
    if (-not (Test-Path -LiteralPath $godot)) {
        throw "Godot executable not found after setup: $godot"
    }
}
& $godot --version

if (-not $SkipExportTemplates) {
    $templateVersion = "$($versions.GodotVersion).stable"
    $templateRoot = Join-Path $env:APPDATA "Godot\export_templates\$templateVersion"
    $releaseTemplate = Join-Path $templateRoot 'windows_release_x86_64.exe'
    if (-not (Test-Path -LiteralPath $releaseTemplate)) {
        $templateArchive = Join-Path $downloadRoot ("Godot_v{0}-stable_export_templates.tpz" -f $versions.GodotVersion)
        # curl resumes an interrupted 1+ GB template archive; extraction below is
        # the integrity check, so a truncated download can never be installed.
        curl.exe -L --fail --retry 3 --continue-at - --output $templateArchive $versions.ExportTemplatesUrl
        if ($LASTEXITCODE -ne 0) { throw 'Godot export template download failed.' }
        $templateTemp = Join-Path $env:TEMP ("mindrealm_templates_{0}" -f ([Guid]::NewGuid().ToString('N')))
        New-Item -ItemType Directory -Force -Path $templateTemp | Out-Null
        try {
            tar -xf $templateArchive -C $templateTemp
            New-Item -ItemType Directory -Force -Path $templateRoot | Out-Null
            Copy-Item -LiteralPath (Join-Path $templateTemp 'templates\windows_release_x86_64.exe') -Destination $releaseTemplate -Force
            Copy-Item -LiteralPath (Join-Path $templateTemp 'templates\windows_debug_x86_64.exe') -Destination (Join-Path $templateRoot 'windows_debug_x86_64.exe') -Force
        }
        finally {
            $resolvedTemp = [IO.Path]::GetFullPath($templateTemp)
            $resolvedTempRoot = [IO.Path]::GetFullPath($env:TEMP)
            if ($resolvedTemp.StartsWith($resolvedTempRoot, [StringComparison]::OrdinalIgnoreCase)) {
                Remove-Item -LiteralPath $resolvedTemp -Recurse -Force -ErrorAction SilentlyContinue
            }
        }
    }
    Write-Host "Export templates ready: $templateRoot"
}
