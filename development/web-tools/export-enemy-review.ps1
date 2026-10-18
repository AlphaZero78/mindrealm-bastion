param(
    [Parameter(Mandatory = $true)][string]$Script,
    [Parameter(Mandatory = $true)][string]$Output,
    [string]$Session = 'enemy-rework',
    [string]$ReviewUrl = 'http://127.0.0.1:4197/development/enemy-review',
    [switch]$Reload
)
$ErrorActionPreference = 'Stop'
$taskRepo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..')).TrimEnd('\')
$taskOutput = [IO.Path]::GetFullPath($Output)
if ($taskOutput.StartsWith($taskRepo + '\', [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Review exports belong outside the repository.'
}
$taskDirectory = Split-Path -Parent $taskOutput
[IO.Directory]::CreateDirectory($taskDirectory) | Out-Null
$taskCode = Get-Content -LiteralPath $Script -Raw
$taskEncoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($taskCode))
$taskExpression = "() => eval(new TextDecoder().decode(Uint8Array.from(atob('$taskEncoded'), c => c.charCodeAt(0))))()"
Push-Location -LiteralPath $taskDirectory
try {
    if ($Reload) {
        & npx.cmd --yes --package '@playwright/cli' playwright-cli "-s=$Session" goto $ReviewUrl | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Browser reload failed.' }
    }
    $taskResult = & npx.cmd --yes --package '@playwright/cli' playwright-cli "-s=$Session" --raw eval $taskExpression
    $taskText = $taskResult -join "`n"
    if ($LASTEXITCODE -ne 0) { throw ('Local render export failed: ' + $taskText.Substring(0, [Math]::Min(1200, $taskText.Length))) }
    $null = $taskText | ConvertFrom-Json
    [IO.File]::WriteAllText($taskOutput, $taskText, [Text.UTF8Encoding]::new($false))
    Write-Output ('LOCAL_RENDER_EXPORT ' + $taskOutput)
} finally {
    Pop-Location
}
