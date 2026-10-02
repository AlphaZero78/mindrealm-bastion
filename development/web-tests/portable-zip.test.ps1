param(
    [Parameter(Mandatory = $true)][string]$ZipPath,
    [int]$Port = 14273
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$sourceRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('mindrealm-portable-zip-' + [Guid]::NewGuid().ToString('N'))
$extractRoot = Join-Path $testRoot '中文 空格路径'
$checks = New-Object 'System.Collections.Generic.List[string]'
$serverFile = $null
$resultPath = Join-Path $testRoot 'result.json'
$failure = $null
$packageRoot = $null

function Assert-Check([bool]$Condition, [string]$Name) {
    if (-not $Condition) { throw "FAIL: $Name" }
    $checks.Add($Name)
}

function Run-Entry([string]$File, [string]$Arguments) {
    $info = New-Object Diagnostics.ProcessStartInfo
    $info.FileName = $File
    $info.Arguments = $Arguments
    $info.WorkingDirectory = $testRoot
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    # Deliberately omit global Node.js and use memory-only browser saves.
    $info.EnvironmentVariables['PATH'] = "$env:SystemRoot\System32;$env:SystemRoot\System32\WindowsPowerShell\v1.0"
    $info.EnvironmentVariables['MINDREALM_QA'] = '1'
    $process = [Diagnostics.Process]::Start($info)
    try {
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit(25000)) { $process.Kill(); throw 'Portable entry timed out.' }
        if (-not $stdout.Wait(3000) -or -not $stderr.Wait(3000)) { throw 'Portable entry retained its output pipe.' }
        if ($process.ExitCode -ne 0) { throw ('Portable entry failed: ' + $stderr.Result) }
        return $stdout.Result
    } finally { $process.Dispose() }
}

try {
    if ($Port -eq 4173 -or $Port -lt 1024 -or $Port -gt 65535) { throw 'Use an isolated test port.' }
    if (@(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue).Count) { throw 'The test port is already in use.' }
    [void][IO.Directory]::CreateDirectory($extractRoot)
    [IO.Compression.ZipFile]::ExtractToDirectory([IO.Path]::GetFullPath($ZipPath), $extractRoot)
    $roots = @(Get-ChildItem -LiteralPath $extractRoot -Force)
    Assert-Check ($roots.Count -eq 1 -and $roots[0].PSIsContainer) 'ZIP contains one game folder'
    $packageRoot = $roots[0].FullName
    $expectedRoot = @('game','MANIFEST.sha256','README.txt','启动游戏.cmd','启动游戏.exe')
    $actualRoot = @(Get-ChildItem -LiteralPath $packageRoot -Force | ForEach-Object { $_.Name })
    Assert-Check (@(Compare-Object $expectedRoot $actualRoot).Count -eq 0) 'extracted root contains only player entrypoints and support information'
    $manifest = @(Get-Content -LiteralPath (Join-Path $packageRoot 'MANIFEST.sha256') -Encoding UTF8)
    $verified = 0
    foreach ($row in $manifest) {
        if ($row -notmatch '^([0-9a-f]{64})  (.+)$') { throw 'Invalid manifest row.' }
        $expectedHash = $Matches[1]; $relative = $Matches[2]
        $file = [IO.Path]::GetFullPath((Join-Path $packageRoot $relative))
        if (-not $file.StartsWith($packageRoot + '\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Manifest path escaped the package.' }
        Assert-Check ((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -eq $expectedHash) ('extracted hash: ' + $relative)
        $verified++
        # Compare shipped code and assets directly with the current source.
        if ($relative -match '^game/(web|assets|launcher)/') {
            $sourceFile = Join-Path $sourceRoot $relative.Substring(5)
            Assert-Check ((Get-FileHash -LiteralPath $sourceFile -Algorithm SHA256).Hash.ToLowerInvariant() -eq $expectedHash) ('matches source: ' + $relative)
        }
    }
    $entry = Join-Path $packageRoot '启动游戏.exe'
    $serverFile = Join-Path $packageRoot 'game\launcher\server.mjs'
    $first = Run-Entry $entry "--port $Port --no-browser"
    Assert-Check ($first.Contains("http://127.0.0.1:$Port/?qa=1")) 'EXE starts after unzip without global Node.js'
    $listener = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort $Port -State Listen
    $serverPid = $listener.OwningProcess
    $identity = Get-CimInstance Win32_Process -Filter "ProcessId=$serverPid"
    Assert-Check ($identity.ExecutablePath -eq (Join-Path $packageRoot 'game\runtime\node.exe') -and $identity.CommandLine.Contains($serverFile)) 'server uses extracted bundled runtime and payload'
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health"
    Assert-Check ($health.app -eq 'mindrealm-bastion') 'extracted server health passes'
    $page = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/?qa=1" -UseBasicParsing
    Assert-Check ($page.StatusCode -eq 200 -and $page.Content.Contains('/web/app.js')) 'game page loads from extracted ZIP'
    foreach ($path in @('/web/core/battle.js','/web/view/entity-art.js','/assets/third_party/opengameart/singularity/singularity_calm.mp3')) {
        $response = Invoke-WebRequest -Uri ("http://127.0.0.1:$Port" + $path) -Method Head -UseBasicParsing
        Assert-Check ($response.StatusCode -eq 200) ('extracted resource: ' + $path)
    }
    [void](Run-Entry $entry "--port $Port --no-browser")
    Assert-Check ((Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort $Port -State Listen).OwningProcess -eq $serverPid) 'repeated EXE launch reuses the same server'
    $backup = Join-Path $packageRoot '启动游戏.cmd'
    [void](Run-Entry "$env:SystemRoot\System32\cmd.exe" ('/d /c ""' + $backup + '" -Port ' + $Port + ' -NoBrowser"'))
    Assert-Check ((Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort $Port -State Listen).OwningProcess -eq $serverPid) 'backup CMD starts from an unrelated working directory'
} catch {
    $failure = $_
} finally {
    if ($serverFile) {
        foreach ($process in @(Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -and $_.CommandLine.Contains($serverFile) })) {
            Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
        }
    }
    if (Test-Path -LiteralPath $testRoot) {
        [ordered]@{status=$(if($failure){'PORTABLE_ZIP_FAILED'}else{'PORTABLE_ZIP_OK'});checks=@($checks.ToArray());package=$packageRoot;error=$(if($failure){$failure.ToString()}else{$null})} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $resultPath -Encoding UTF8
    }
}
if ($failure) { throw $failure }
Write-Output "PORTABLE_ZIP_OK checks=$($checks.Count) package=$packageRoot report=$resultPath"
