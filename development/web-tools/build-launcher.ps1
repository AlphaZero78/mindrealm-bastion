param([Parameter(Mandatory = $true)][string]$OutputExe)
$ErrorActionPreference = 'Stop'
$sourceRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..')).TrimEnd('\', '/')
if ($OutputExe -notmatch '^(?:[A-Za-z]:[\\/]|\\\\[^\\]+\\[^\\]+[\\/])') {
    throw 'OutputExe must be an absolute path outside the source repository.'
}
$target = [IO.Path]::GetFullPath($OutputExe)
if ([IO.Path]::GetExtension($target) -ine '.exe') { throw 'OutputExe must end with .exe.' }
if ($target.Equals($sourceRoot, [StringComparison]::OrdinalIgnoreCase) -or
    $target.StartsWith($sourceRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Refusing to write a generated EXE inside the source repository.'
}
# Reject junction/symlink ancestors rather than allowing an outside-looking
# path to redirect generated files back into the source checkout.
$ancestor = $target
while ($ancestor) {
    if (Test-Path -LiteralPath $ancestor) {
        $item = Get-Item -LiteralPath $ancestor -Force
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'OutputExe must not traverse a junction or symbolic link.' }
    }
    $parent = [IO.Path]::GetDirectoryName($ancestor)
    if ($parent -eq $ancestor) { break }
    $ancestor = $parent
}
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compiler -PathType Leaf)) { throw 'Windows .NET Framework 4 C# compiler is missing.' }
$source = Join-Path $sourceRoot 'launcher\GameLauncher.cs'
$buildDirectory = Join-Path ([IO.Path]::GetTempPath()) ('mindrealm-launcher-build-' + [Guid]::NewGuid().ToString('N'))
[void][IO.Directory]::CreateDirectory($buildDirectory)
$temporaryExe = Join-Path $buildDirectory 'GameLauncher.exe'
try {
    & $compiler /nologo /target:winexe /platform:anycpu /optimize+ /debug- /utf8output /codepage:65001 "/out:$temporaryExe" /reference:System.dll /reference:System.Core.dll /reference:System.Windows.Forms.dll /reference:System.Runtime.Serialization.dll $source
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $temporaryExe -PathType Leaf)) { throw "Launcher compilation failed: $LASTEXITCODE" }
    $bytes = [IO.File]::ReadAllBytes($temporaryExe)
    $peOffset = [BitConverter]::ToInt32($bytes, 0x3c)
    if ($bytes[0] -ne 0x4d -or $bytes[1] -ne 0x5a -or
        [BitConverter]::ToUInt32($bytes, $peOffset) -ne 0x4550 -or
        [BitConverter]::ToUInt16($bytes, $peOffset + 24 + 68) -ne 2) {
        throw 'Compiler output is not a Windows GUI PE executable.'
    }
    [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target))
    [IO.File]::Copy($temporaryExe, $target, $true)
    Write-Output "MINDREALM_LAUNCHER_BUILD_OK $target"
} finally {
    # This single known temporary directory was created above for this build.
    $checked = [IO.Path]::GetFullPath($buildDirectory)
    $tempPrefix = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    if ($checked.StartsWith($tempPrefix, [StringComparison]::OrdinalIgnoreCase) -and
        [IO.Path]::GetFileName($checked).StartsWith('mindrealm-launcher-build-')) {
        Remove-Item -LiteralPath $checked -Recurse -Force
    }
}
