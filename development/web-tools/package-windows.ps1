param([string]$ReleaseDirectory, [string]$OutputZip)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$projectDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$releaseParent = Join-Path (Split-Path $projectDirectory -Parent) 'game_build_release'
if (-not $ReleaseDirectory) { $ReleaseDirectory = Join-Path $releaseParent 'Mindrealm-Web' }
if (-not $OutputZip) { $OutputZip = Join-Path $releaseParent (([char]0x5FC3).ToString()+[char]0x57DF+[char]0x9632+[char]0x7EBF+'-Windows.zip') }
$releasePath = [IO.Path]::GetFullPath($ReleaseDirectory).TrimEnd('\')
$archivePath = [IO.Path]::GetFullPath($OutputZip)
function Is-Under([string]$ParentPath, [string]$ChildPath) {
    return $ChildPath.Equals($ParentPath,[StringComparison]::OrdinalIgnoreCase) -or $ChildPath.StartsWith($ParentPath+'\',[StringComparison]::OrdinalIgnoreCase)
}
function File-Sha256([string]$Path) {
    $stream = [IO.File]::OpenRead($Path); $sha = [Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-','').ToLowerInvariant() }
    finally { $sha.Dispose(); $stream.Dispose() }
}
function Assert-NoReparseAncestor([string]$Path) {
    for ($ancestor = $Path; $ancestor; $ancestor = [IO.Path]::GetDirectoryName($ancestor)) {
        if ((Test-Path -LiteralPath $ancestor) -and ((Get-Item -LiteralPath $ancestor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Release and ZIP paths must not traverse a junction or symbolic link.' }
    }
}
if ((Is-Under $projectDirectory $releasePath) -or (Is-Under $projectDirectory $archivePath) -or (Is-Under $releasePath $archivePath)) { throw 'Release and ZIP output must stay outside the source project; ZIP must not be inside the release.' }
if ([IO.Path]::GetExtension($archivePath) -ne '.zip') { throw 'OutputZip must have a .zip extension.' }
Assert-NoReparseAncestor $releasePath
Assert-NoReparseAncestor $archivePath
$manifestFile = Join-Path $releasePath 'MANIFEST.sha256'
$manifestRows = Get-Content -LiteralPath $manifestFile -Encoding UTF8
$expected = @{}
foreach ($row in $manifestRows) {
    if ($row -notmatch '^([0-9a-f]{64})  (.+)$') { throw 'Invalid release manifest row.' }
    $hash = $Matches[1]; $name = $Matches[2]
    $file = [IO.Path]::GetFullPath((Join-Path $releasePath $name))
    if (-not (Is-Under $releasePath $file) -or $expected.ContainsKey($name)) { throw ('Unsafe or duplicate manifest path: '+$name) }
    if ((Get-Item -LiteralPath $file).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw ('Symlink not allowed in portable game: '+$name) }
    if ((File-Sha256 $file) -ne $hash) { throw ('Release hash mismatch: '+$name) }
    $expected[$name] = $hash
}
$launcherName = ([char]0x542F).ToString()+[char]0x52A8+[char]0x6E38+[char]0x620F+'.exe'
foreach ($required in @($launcherName,'game/runtime/node.exe','game/web/app.js','game/launcher/server.mjs','game/version.json')) {
    if (-not $expected.ContainsKey($required)) { throw ('Missing required packaged file: '+$required) }
}
$exe = [IO.File]::ReadAllBytes((Join-Path $releasePath $launcherName))
if ($exe.Length -lt 256 -or $exe[0] -ne 0x4d -or $exe[1] -ne 0x5a) { throw 'Launcher is not a Windows executable.' }
$peOffset = [BitConverter]::ToInt32($exe,60)
if ($peOffset -lt 64 -or $peOffset+94 -gt $exe.Length -or [BitConverter]::ToUInt32($exe,$peOffset) -ne 0x4550 -or [BitConverter]::ToUInt16($exe,$peOffset+92) -ne 2) { throw 'Launcher must be a PE Windows GUI executable.' }
$expected['MANIFEST.sha256'] = File-Sha256 $manifestFile
$allEntries = @(Get-ChildItem -LiteralPath $releasePath -Recurse -Force)
foreach ($entry in $allEntries) { if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Release must not contain junctions or symbolic links.' } }
$files = @($allEntries | Where-Object { -not $_.PSIsContainer })
if ($files.Count -ne $expected.Count) { throw 'Release contains files outside the manifest.' }
foreach ($file in $files) {
    $name = $file.FullName.Substring($releasePath.Length+1).Replace('\','/')
    if (-not $expected.ContainsKey($name)) { throw ('Unexpected release file: '+$name) }
}
$archiveDirectory = Split-Path $archivePath -Parent
[IO.Directory]::CreateDirectory($archiveDirectory) | Out-Null
$temporaryArchive = Join-Path $archiveDirectory ('.mindrealm-'+[Guid]::NewGuid().ToString('N')+'.zip')
try {
    [IO.Compression.ZipFile]::CreateFromDirectory($releasePath,$temporaryArchive,[IO.Compression.CompressionLevel]::Optimal,$true)
    $zip = [IO.Compression.ZipFile]::OpenRead($temporaryArchive)
    try {
        $prefix = (Split-Path $releasePath -Leaf)+'/'
        $seen = @{}
        foreach ($entry in $zip.Entries) {
            if ($entry.FullName.EndsWith('/')) { continue }
            $entryName = $entry.FullName.Replace('\','/')
            if (-not $entryName.StartsWith($prefix,[StringComparison]::Ordinal)) { throw 'Unexpected ZIP root folder.' }
            $relative = $entryName.Substring($prefix.Length)
            if (-not $expected.ContainsKey($relative) -or $seen.ContainsKey($relative)) { throw ('Unexpected or duplicate ZIP entry: '+$entryName) }
            $stream = $entry.Open(); $sha = [Security.Cryptography.SHA256]::Create()
            try { $hash = [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-','').ToLowerInvariant() }
            finally { $sha.Dispose(); $stream.Dispose() }
            if ($hash -ne $expected[$relative]) { throw ('ZIP entry hash mismatch: '+$entryName) }
            $seen[$relative] = $true
        }
        if ($seen.Count -ne $expected.Count) { throw 'ZIP does not contain every release file.' }
    } finally { $zip.Dispose() }
    # Both resolved paths are known files in the same external release folder.
    Move-Item -LiteralPath $temporaryArchive -Destination $archivePath -Force
    $zipHash = File-Sha256 $archivePath
    [IO.File]::WriteAllText($archivePath+'.sha256',$zipHash+'  '+[IO.Path]::GetFileName($archivePath)+"`n",[Text.UTF8Encoding]::new($false))
    [PSCustomObject]@{status='MINDREALM_WINDOWS_ZIP_OK';zip=$archivePath;bytes=(Get-Item -LiteralPath $archivePath).Length;sha256=$zipHash;files=$seen.Count;launcher=$launcherName} | ConvertTo-Json
} finally {
    if (Test-Path -LiteralPath $temporaryArchive) { Remove-Item -LiteralPath $temporaryArchive -Force }
}
