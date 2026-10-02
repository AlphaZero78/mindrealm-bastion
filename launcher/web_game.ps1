param([switch]$NoBrowser, [int]$Port = 4173)
$ErrorActionPreference = 'Stop'
$gameRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$gameUrl = "http://127.0.0.1:$Port"
$nodeFile = Join-Path $gameRoot 'runtime\node.exe'
if (-not (Test-Path -LiteralPath $nodeFile)) {
    $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
    if (-not $nodeCommand) { throw 'Node.js 22 or newer is required. Use the portable release, or install Node.js from https://nodejs.org/.' }
    $nodeFile = $nodeCommand.Source
}
function Get-GameHealth([int]$TimeoutSeconds) {
    # Windows PowerShell uses WebException; PowerShell 7 uses HttpClient
    # transport/cancellation exceptions. Only this request is allowed to fail.
    try { return Invoke-RestMethod -Uri "$gameUrl/health" -TimeoutSec $TimeoutSeconds }
    catch { return $null }
}
$running = $false
$health = Get-GameHealth 2
if ($null -ne $health) {
    $running = $health.app -eq 'mindrealm-bastion'
    if (-not $running) { throw "Port $Port belongs to another application." }
}
if (-not $running) {
    $serverFile = Join-Path $gameRoot 'launcher\server.mjs'
    $serverLog = Join-Path $env:TEMP "mindrealm-web-$Port.log"
    $serverError = Join-Path $env:TEMP "mindrealm-web-$Port.error.log"
    $env:MINDREALM_PORT = "$Port"
    $server = Start-Process -FilePath $nodeFile -ArgumentList @('"' + $serverFile + '"') -WorkingDirectory $gameRoot -WindowStyle Hidden -RedirectStandardOutput $serverLog -RedirectStandardError $serverError -PassThru
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        Start-Sleep -Milliseconds 150
        if ($server.HasExited) { throw "Game server failed. See $serverError" }
        $health = Get-GameHealth 1
        if ($health.app -eq 'mindrealm-bastion') { $running = $true; break }
    }
    if (-not $running) { throw "Game server did not respond. See $serverLog" }
}
if (-not $NoBrowser) { Start-Process $gameUrl }
Write-Output "MINDREALM_WEB_READY $gameUrl"
