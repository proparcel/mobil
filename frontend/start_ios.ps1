# Metrosuz iOS - Metro baslatmaz. Aciksa URL gosterir ve pencereye odaklanir.
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
Set-Location $root

. "$root/scripts/metro-smart.ps1"

$port = $METRO_PORT_IOS

Write-Host ""
Write-Host "=== start_ios (metrosuz, port $port) ===" -ForegroundColor Cyan
Write-Host ""

if (Test-MetroListening -Port $port) {
  Write-Host "[ios] Metro acik ($port) - URL asagida." -ForegroundColor Green
  & "$root/scripts/iphone-connect-help.ps1"
  Invoke-FocusMetroWindow -Platform ios
  exit 0
}

Write-Host "[ios] Metro port $port kapali - Metro baslatilmiyor." -ForegroundColor Yellow
Write-Host "[ios] Metro acmak icin: start_ios_metro.bat veya npm run start:ios_metro" -ForegroundColor Yellow
Write-Host ""
& "$root/scripts/iphone-connect-help.ps1"
exit 1
