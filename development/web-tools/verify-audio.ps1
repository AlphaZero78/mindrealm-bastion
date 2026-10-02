param(
    [switch]$SkipSetup
)

$ErrorActionPreference = 'Stop'
# The script is independent of the caller's current directory.
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$toolRoot = Join-Path $env:LOCALAPPDATA 'MindrealmTools\ffmpeg'
$ffmpeg = Get-ChildItem -LiteralPath $toolRoot -Filter 'ffmpeg.exe' -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 1
$ffprobe = Get-ChildItem -LiteralPath $toolRoot -Filter 'ffprobe.exe' -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 1
if (($null -eq $ffmpeg -or $null -eq $ffprobe) -and -not $SkipSetup) {
    New-Item -ItemType Directory -Force -Path $toolRoot | Out-Null
    $archive = Join-Path $env:TEMP 'mindrealm_ffmpeg_release_essentials.zip'
    Invoke-WebRequest -Uri 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip' -OutFile $archive
    Expand-Archive -LiteralPath $archive -DestinationPath $toolRoot -Force
    $ffmpeg = Get-ChildItem -LiteralPath $toolRoot -Filter 'ffmpeg.exe' -Recurse -File | Select-Object -First 1
    $ffprobe = Get-ChildItem -LiteralPath $toolRoot -Filter 'ffprobe.exe' -Recurse -File | Select-Object -First 1
}
if ($null -eq $ffmpeg -or $null -eq $ffprobe) {
    throw 'FFmpeg is unavailable. Run this script without -SkipSetup to install it in the user tool directory.'
}

$audioRoot = Join-Path $projectRoot 'assets\third_party\opengameart\singularity'
$durations = @()
foreach ($name in @('singularity_calm.mp3', 'singularity_action.mp3')) {
    $path = Join-Path $audioRoot $name
    if (-not (Test-Path -LiteralPath $path)) { throw "Adaptive music layer is missing: $name" }
    $durationText = & $ffprobe.FullName -v error -select_streams 'a:0' -show_entries 'stream=duration' -of 'default=noprint_wrappers=1:nokey=1' $path
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    $durations += [double]::Parse($durationText.Trim(), [Globalization.CultureInfo]::InvariantCulture)
    $analysis = (& $ffmpeg.FullName -hide_banner -nostats -i $path -af 'loudnorm=I=-18:TP=-1:LRA=11:print_format=summary' -f null NUL 2>&1 | Out-String)
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    $integratedMatch = [regex]::Match($analysis, 'Input Integrated:\s+([-+0-9.]+) LUFS')
    $peakMatch = [regex]::Match($analysis, 'Input True Peak:\s+([-+0-9.]+) dBTP')
    if (-not $integratedMatch.Success -or -not $peakMatch.Success) { throw "Could not parse EBU R128 result for $name" }
    $integrated = [double]::Parse($integratedMatch.Groups[1].Value, [Globalization.CultureInfo]::InvariantCulture)
    $truePeak = [double]::Parse($peakMatch.Groups[1].Value, [Globalization.CultureInfo]::InvariantCulture)
    if ([Math]::Abs($integrated + 18.0) -gt 0.2) { throw "$name integrated loudness is $integrated LUFS; expected -18 +/- 0.2" }
    if ($truePeak -gt -1.0) { throw "$name true peak is $truePeak dBTP; expected no more than -1 dBTP" }
    Write-Host "AUDIO_LAYER_OK name=$name lufs=$integrated true_peak=$truePeak duration=$($durations[-1])"
}
if ([Math]::Abs($durations[0] - $durations[1]) -gt 0.01) {
    throw "Adaptive layers are not sample-aligned in duration: $($durations[0]) vs $($durations[1])"
}
Write-Host 'AUDIO_VERIFY_OK layers=2 target_lufs=-18 max_true_peak=-1'
