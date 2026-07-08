# iPhone USB + Personal Hotspot ile Metro baglantisi (iOS port 8081).
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
. "$PSScriptRoot/metro-smart.ps1"

Write-Host "=== iPhone USB Metro (Personal Hotspot) ===" -ForegroundColor Cyan
Write-Host ""

$usbIp = $null
$adapters = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object {
  $_.IPAddress -notmatch '^127\.' -and $_.IPAddress -notmatch '^169\.254\.' -and
  $_.PrefixOrigin -ne 'WellKnown'
}

foreach ($a in $adapters) {
  $alias = (Get-NetIPAddress -IPAddress $a.IPAddress -ErrorAction SilentlyContinue).InterfaceAlias
  if ($alias -match 'Apple|iPhone|Mobile Device') {
    $usbIp = $a.IPAddress
    Write-Host "USB ag bulundu: $alias -> $usbIp" -ForegroundColor Green
    break
  }
}

if (-not $usbIp) {
  $hotspot = $adapters | Where-Object { $_.IPAddress -match '^172\.20\.10\.' } | Select-Object -First 1
  if ($hotspot) {
    $usbIp = $hotspot.IPAddress
    Write-Host "Hotspot alt agi IP: $usbIp" -ForegroundColor Green
  }
}

if (-not $usbIp) {
  Write-Host "USB ag IP bulunamadi." -ForegroundColor Red
  Write-Host ""
  Write-Host "Kontrol listesi:"
  Write-Host "  1. iPhone: Ayarlar -> Kisisel Erisim Noktasi -> AC"
  Write-Host "  2. USB kablo takili, 'Bu bilgisayara guven' onayli"
  Write-Host "  3. Windows: Apple Devices veya iTunes kurulu (USB surucu)"
  exit 1
}

$metroUrl = "http://${usbIp}:$METRO_PORT_IOS"
Write-Host ""
Write-Host "Dev client Enter URL:" -ForegroundColor Cyan
Write-Host "  $metroUrl" -ForegroundColor Green
Write-Host ""

if (Test-MetroListening -Port $METRO_PORT_IOS) {
  Write-Host "[ios] Metro zaten acik (port $METRO_PORT_IOS) — yeniden baslatilmiyor." -ForegroundColor Green
  Invoke-FocusMetroWindow -Platform ios
  exit 0
}

Write-Host "Metro baslatiliyor (port $METRO_PORT_IOS)..." -ForegroundColor Yellow
& "$PSScriptRoot/../start_ios_metro.ps1" -Lan
