param(
    [Parameter(Mandatory = $true)][string]$Script,
    [Parameter(Mandatory = $true)][string]$Output,
    [string]$Session = 'enemy-rework'
)
$ErrorActionPreference = 'Stop'
$taskRepo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..')).TrimEnd('\')
$taskOutput = [IO.Path]::GetFullPath($Output)
if ($taskOutput.StartsWith($taskRepo + '\', [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Browser reports belong outside the repository.'
}
$taskDirectory = Split-Path -Parent $taskOutput
[IO.Directory]::CreateDirectory($taskDirectory) | Out-Null
[IO.Directory]::CreateDirectory((Join-Path $taskDirectory 'mindrealm-realtime-art')) | Out-Null
Push-Location -LiteralPath $taskDirectory
try {
    $taskResult = & npx.cmd --yes --package '@playwright/cli' playwright-cli "-s=$Session" --raw run-code --filename $Script
    $taskText = $taskResult -join "`n"
    [IO.File]::WriteAllText($taskOutput, $taskText, [Text.UTF8Encoding]::new($false))
    if ($LASTEXITCODE -ne 0) { throw ('Browser audit failed; inspect local report ' + $taskOutput) }
    $null = $taskText | ConvertFrom-Json
    Write-Output ('BROWSER_AUDIT_REPORT ' + $taskOutput)
} finally {
    Pop-Location
}
