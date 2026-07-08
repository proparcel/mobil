# Metrosuz Android build - Metro acik olmali (port 8082). Metro baslatmaz.
param(
  [switch]$Release,
  [switch]$SkipNativeFix
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
Set-Location $root

. "$root/scripts/metro-smart.ps1"

Write-Host ""
Write-Host "=== start_android (metrosuz build, port $METRO_PORT_ANDROID) ===" -ForegroundColor Cyan
Write-Host ""

& npm run copy:icon-fonts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

node ./scripts/sync-android-mapbox-token.js
Ensure-AdbReverse -Port $METRO_PORT_ANDROID

$port = $METRO_PORT_ANDROID
if (-not (Test-MetroListening -Port $port)) {
  Write-Host "[android] UYARI: Metro port $port kapali - once start_android_metro veya Metro penceresini acin." -ForegroundColor Yellow
} else {
  Write-Host "[android] Metro acik ($port) - sadece build." -ForegroundColor Green
}

if (-not $SkipNativeFix) {
  node ./scripts/apply-android-native-fix.js
}

$rnArgs = @("run-android", "--no-packager", "--port", "$port")
if ($Release) { $rnArgs += "--variant=release" }

Write-Host "[android] react-native $($rnArgs -join ' ')" -ForegroundColor Cyan
& npx react-native @rnArgs
exit $LASTEXITCODE
