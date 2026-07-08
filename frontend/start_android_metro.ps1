# Android build + Metro (8082): Metro aciksa sadece build; kapaliysa Metro ac + build.
param(
  [switch]$Release,
  [switch]$SkipNativeFix,
  [switch]$MetroOnly
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
Set-Location $root

. "$root/scripts/metro-smart.ps1"

Write-Host ""
Write-Host "=== start_android_metro (port $METRO_PORT_ANDROID) ===" -ForegroundColor Cyan
Write-Host ""

& npm run copy:icon-fonts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

node ./scripts/sync-android-mapbox-token.js
Ensure-AdbReverse -Port $METRO_PORT_ANDROID

$port = $METRO_PORT_ANDROID
$metroRunning = Test-MetroListening -Port $port

if ($metroRunning) {
  Write-Host "[android] Metro zaten acik (port $port) - sadece build." -ForegroundColor Green
} else {
  Write-Host "[android] Metro kapali - port $port'ta baslatiliyor..." -ForegroundColor Yellow
  Start-MetroInWindow -Platform android
  Wait-MetroReady -Port $port | Out-Null
}

if ($MetroOnly) {
  Invoke-FocusMetroWindow -Platform android
  exit 0
}

if (-not $SkipNativeFix) {
  node ./scripts/apply-android-native-fix.js
}

$rnArgs = @("run-android", "--no-packager", "--port", "$port")
if ($Release) { $rnArgs += "--variant=release" }

Write-Host "[android] react-native $($rnArgs -join ' ')" -ForegroundColor Cyan
& npx react-native @rnArgs
exit $LASTEXITCODE
