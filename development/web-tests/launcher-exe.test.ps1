param([int]$BasePort = 4210)
$ErrorActionPreference = 'Stop'
$sourceRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('mindrealm-launcher-test-' + [Guid]::NewGuid().ToString('N'))
$package = Join-Path $testRoot '中文 空格目录\心域 防线'
$payloadRoot = Join-Path $package 'game'
$entry = Join-Path $package '启动游戏.exe'
$checks = New-Object 'System.Collections.Generic.List[string]'
$owned = New-Object 'System.Collections.Generic.List[System.Diagnostics.Process]'
$details = [ordered]@{}
$failure = $null
$priorQA = [Environment]::GetEnvironmentVariable('MINDREALM_QA')

function Assert-Check([bool]$Condition, [string]$Name) {
    if (-not $Condition) { throw "FAIL: $Name" }
    $checks.Add($Name)
}
function Start-Launcher([string]$Arguments) {
    $info = New-Object Diagnostics.ProcessStartInfo
    $info.FileName = $entry
    $info.Arguments = $Arguments
    # Deliberately use an unrelated CWD. The game must use its EXE directory.
    $info.WorkingDirectory = $testRoot
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $process = [Diagnostics.Process]::Start($info)
    Add-Member -InputObject $process -NotePropertyName OutputTask -NotePropertyValue ($process.StandardOutput.ReadToEndAsync())
    Add-Member -InputObject $process -NotePropertyName ErrorTask -NotePropertyValue ($process.StandardError.ReadToEndAsync())
    $owned.Add($process)
    return $process
}
function Read-Launcher([Diagnostics.Process]$Process) {
    if (-not $Process.WaitForExit(25000)) { throw "Launcher hung: $($Process.Id)" }
    if (-not $Process.OutputTask.Wait(2000) -or -not $Process.ErrorTask.Wait(2000)) { throw 'Launcher exited but a child retained its output pipe.' }
    $result = @{ code = $Process.ExitCode; stdout = $Process.OutputTask.Result; stderr = $Process.ErrorTask.Result }
    return $result
}
function Run-Launcher([string]$Arguments) { return Read-Launcher (Start-Launcher $Arguments) }
function Listener([int]$Port) { return ,@(Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) }
function Wait-Listener([int]$Port) {
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        $found = Listener $Port
        if ($found.Count) { return $found[0].OwningProcess }
        Start-Sleep -Milliseconds 100
    }
    throw "No test listener on $Port"
}
function Start-Fixture([string]$Name, [int]$Port, [string]$Script) {
    $file = Join-Path $testRoot ($Name + '.cjs')
    [IO.File]::WriteAllText($file, $Script, (New-Object Text.UTF8Encoding($false)))
    $info = New-Object Diagnostics.ProcessStartInfo
    $info.FileName = Join-Path $payloadRoot 'runtime\node.exe'
    $info.Arguments = '"' + $file + '"'
    $info.WorkingDirectory = $testRoot
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.EnvironmentVariables['MINDREALM_PORT'] = $Port.ToString()
    $process = [Diagnostics.Process]::Start($info)
    $owned.Add($process)
    [void](Wait-Listener $Port)
    return $process
}

try {
    if ($BasePort -lt 1024 -or $BasePort + 5 -gt 65535 -or ($BasePort -le 4173 -and $BasePort + 5 -ge 4173)) { throw 'Use six unprivileged test ports, excluding 4173.' }
    foreach ($port in $BasePort..($BasePort + 5)) {
        if ((Listener $port).Count) { throw "Test port already in use: $port. No processes have been changed." }
    }
    [void][IO.Directory]::CreateDirectory($package)
    [void][IO.Directory]::CreateDirectory($payloadRoot)
    $build = Join-Path $sourceRoot 'development\web-tools\build-launcher.ps1'
    & $build -OutputExe $entry
    $bytes = [IO.File]::ReadAllBytes($entry)
    $pe = [BitConverter]::ToInt32($bytes, 0x3c)
    Assert-Check ($bytes[0] -eq 0x4d -and $bytes[1] -eq 0x5a -and [BitConverter]::ToUInt32($bytes, $pe) -eq 0x4550 -and [BitConverter]::ToUInt16($bytes, $pe + 92) -eq 2) 'real PE with Windows GUI subsystem'
    foreach ($rejected in @((Join-Path $sourceRoot 'launcher\must-not-exist.exe'), 'relative.exe', (Join-Path $testRoot 'wrong.txt'))) {
        $blocked = $false
        try { & $build -OutputExe $rejected } catch { $blocked = $true }
        Assert-Check $blocked ('compiler rejects unsafe output: ' + $rejected)
    }
    $junction = Join-Path $testRoot 'source-alias'
    [void](New-Item -ItemType Junction -Path $junction -Target $sourceRoot)
    $blocked = $false
    try { & $build -OutputExe (Join-Path $junction 'must-not-exist.exe') } catch { $blocked = $true }
    Assert-Check $blocked 'compiler rejects junction pointing back into source'
    [Environment]::SetEnvironmentVariable('MINDREALM_QA', '1')

    foreach ($arguments in @('--port 0 --no-browser', '--port 65536 --no-browser', '--port nope --no-browser', '--port 4210 --port 4211 --no-browser', '--unexpected --no-browser')) {
        $result = Run-Launcher $arguments
        Assert-Check ($result.code -eq 2 -and $result.stderr.Length -gt 0) ('invalid args return without dialog: ' + $arguments)
    }
    $result = Run-Launcher "--port $BasePort --no-browser"
    Assert-Check ($result.code -eq 3 -and $result.stderr.Contains('runtime')) 'missing bundled runtime fails without global fallback'
    [void][IO.Directory]::CreateDirectory((Join-Path $payloadRoot 'runtime'))
    Copy-Item -LiteralPath (Get-Command node.exe -ErrorAction Stop).Source -Destination (Join-Path $payloadRoot 'runtime\node.exe')
    $result = Run-Launcher "--port $BasePort --no-browser"
    Assert-Check ($result.code -eq 3 -and $result.stderr.Contains('server.mjs')) 'missing server fails without dialog'
    [void][IO.Directory]::CreateDirectory((Join-Path $payloadRoot 'launcher'))
    Copy-Item -LiteralPath (Join-Path $sourceRoot 'launcher\server.mjs') -Destination (Join-Path $payloadRoot 'launcher\server.mjs')
    $result = Run-Launcher "--port $BasePort --no-browser"
    Assert-Check ($result.code -eq 3 -and $result.stderr.Contains('index.html')) 'missing game page fails without dialog'
    [void][IO.Directory]::CreateDirectory((Join-Path $payloadRoot 'web'))
    [IO.File]::WriteAllText((Join-Path $payloadRoot 'web\index.html'), '<!doctype html><title>Portable launcher test</title>OWN_PACKAGE_ROOT')
    [void][IO.Directory]::CreateDirectory((Join-Path $payloadRoot 'development\web-tests\helpers'))
    [IO.File]::WriteAllText((Join-Path $payloadRoot 'development\web-tests\helpers\qa.txt'), 'QA_INHERITED')

    $foreign = Start-Fixture 'foreign' ($BasePort + 1) "require('node:http').createServer((q,r)=>{r.end(JSON.stringify({app:'other-program',version:1}));}).listen(process.env.MINDREALM_PORT,'127.0.0.1');"
    $result = Run-Launcher "--port $($BasePort + 1) --no-browser"
    Assert-Check ($result.code -eq 4 -and -not $foreign.HasExited -and (Listener ($BasePort + 1))[0].OwningProcess -eq $foreign.Id) 'foreign HTTP app rejected and left alive'
    $version = Start-Fixture 'wrong-version' ($BasePort + 2) "require('node:http').createServer((q,r)=>{r.end(JSON.stringify({app:'mindrealm-bastion',version:2}));}).listen(process.env.MINDREALM_PORT,'127.0.0.1');"
    $result = Run-Launcher "--port $($BasePort + 2) --no-browser"
    Assert-Check ($result.code -eq 4 -and -not $version.HasExited) 'same app with unsupported health version rejected'
    $silent = Start-Fixture 'silent' ($BasePort + 3) "require('node:net').createServer(s=>s.on('error',()=>{})).listen(process.env.MINDREALM_PORT,'127.0.0.1');"
    $result = Run-Launcher "--port $($BasePort + 3) --no-browser"
    Assert-Check ($result.code -eq 4 -and -not $silent.HasExited) 'silent non HTTP listener rejected and left alive'

    $serverFile = Join-Path $payloadRoot 'launcher\server.mjs'
    try {
        [IO.File]::WriteAllText($serverFile, 'process.exit(23);')
        $result = Run-Launcher "--port $($BasePort + 4) --no-browser"
        Assert-Check ($result.code -eq 5 -and $result.stderr.Contains('23') -and (Listener ($BasePort + 4)).Count -eq 0) 'server startup failure has nonzero code and no stale listener'
    } finally { Copy-Item -LiteralPath (Join-Path $sourceRoot 'launcher\server.mjs') -Destination $serverFile -Force }

    $first = Run-Launcher "--port $BasePort --no-browser"
    $gamePid = Wait-Listener $BasePort
    $identity = Get-CimInstance Win32_Process -Filter "ProcessId=$gamePid"
    Assert-Check ($first.code -eq 0 -and $first.stdout.Contains("http://127.0.0.1:$BasePort/?qa=1") -and $identity.ExecutablePath -eq (Join-Path $payloadRoot 'runtime\node.exe') -and $identity.CommandLine.Contains($serverFile)) 'Chinese spaced path starts bundled Node from game/ and absolute server path'
    Assert-Check ((Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$BasePort/").Content.Contains('OWN_PACKAGE_ROOT')) 'server serves package root despite unrelated working directory'
    Assert-Check ((Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$BasePort/development/web-tests/helpers/qa.txt").Content -eq 'QA_INHERITED') 'QA environment reaches child and QA URL is reported'
    $again = Run-Launcher "--port $BasePort --no-browser"
    Assert-Check ($again.code -eq 0 -and (Listener $BasePort)[0].OwningProcess -eq $gamePid) 'existing game service reused with identical PID'
    Start-Sleep -Milliseconds 400
    Assert-Check ((Listener $BasePort)[0].OwningProcess -eq $gamePid) 'server survives launcher exit without redirected pipe dependency'
    $parallel = @()
    foreach ($index in 1..4) { $parallel += Start-Launcher "--port $($BasePort + 5) --no-browser" }
    $parallelResults = @($parallel | ForEach-Object { Read-Launcher $_ })
    $parallelPid = Wait-Listener ($BasePort + 5)
    $serverProcesses = @(Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -and $_.CommandLine.Contains($serverFile) })
    Assert-Check (@($parallelResults | Where-Object { $_.code -ne 0 }).Count -eq 0 -and $serverProcesses.Count -eq 2) 'four concurrent starts create one additional game server'
    Assert-Check ($parallelPid -ne $gamePid) 'isolated ports remain separate game services'
    $legacyEntry = Join-Path $payloadRoot '启动游戏.exe'
    Copy-Item -LiteralPath $entry -Destination $legacyEntry
    $originalEntry = $entry
    try {
        $entry = $legacyEntry
        $legacy = Run-Launcher "--port $($BasePort + 4) --no-browser"
        Assert-Check ($legacy.code -eq 0) 'existing flat package layout still starts'
    } finally { $entry = $originalEntry }
    $details['gamePid'] = $gamePid
    $details['parallelPid'] = $parallelPid
    $details['parallelExitCodes'] = @($parallelResults | ForEach-Object { $_.code })
    $details['exeBytes'] = $bytes.Length
    $details['executable'] = $entry
} catch {
    $failure = $_
} finally {
    [Environment]::SetEnvironmentVariable('MINDREALM_QA', $priorQA)
    # Stop only recorded test children and Node commands containing this unique
    # test directory. Never stop an unrelated process by its port or image name.
    foreach ($process in $owned) { try { if (-not $process.HasExited) { $process.Kill(); $process.WaitForExit(5000) | Out-Null } } catch {} }
    if ($testRoot.StartsWith([IO.Path]::GetTempPath(), [StringComparison]::OrdinalIgnoreCase) -and [IO.Path]::GetFileName($testRoot).StartsWith('mindrealm-launcher-test-')) {
        foreach ($process in @(Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -and $_.CommandLine.Contains($testRoot) })) {
            Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
        }
    }
    if (Test-Path -LiteralPath $testRoot) {
        # Remove just the test junction itself; do not recurse through its target.
        $junctionPath = Join-Path $testRoot 'source-alias'
        if (Test-Path -LiteralPath $junctionPath) { [IO.Directory]::Delete($junctionPath) }
        $report = [ordered]@{ status = $(if ($failure) { 'LAUNCHER_EXE_SMOKE_FAILED' } else { 'LAUNCHER_EXE_SMOKE_OK' }); checks = @($checks.ToArray()); details = $details; error = $(if ($failure) { $failure.ToString() } else { $null }); evidenceDirectory = $testRoot }
        $report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $testRoot 'result.json') -Encoding UTF8
    }
}
if ($failure) { throw $failure }
Write-Output "LAUNCHER_EXE_SMOKE_OK checks=$($checks.Count) evidence=$testRoot"
