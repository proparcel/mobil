# iPhone USB + Personal Hotspot ile Metro baglantisi.
# Not: iOS'ta Android adb reverse yok; kablo uzerinden mini-ag (172.20.10.x) kullanilir.
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

Write-Host "=== iPhone USB Metro (Personal Hotspot) ===" -ForegroundColor Cyan
Write-Host ""

# Apple USB ag adaptorunu bul (Personal Hotspot acik + kablo takili olmali)
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

# Hotspot alt agi (172.20.10.x) — cogu kurulumda PC bu aralikta IP alir
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
  Write-Host "Kontrol listesi:" -ForegroundColor Yellow
  Write-Host "  1. iPhone: Ayarlar -> Kisisel Erisim Noktasi -> AC"
  Write-Host "  2. USB kablo takili, 'Bu bilgisayara guven' onayli"
  Write-Host "  3. Windows: Apple Devices veya iTunes kurulu (USB surucu)"
  Write-Host "  4. Ayarlar -> Ag -> Ethernet -> iPhone baglantisi gorunuyor mu?"
  Write-Host ""
  Write-Host "ipconfig ciktisinda 172.20.10.x veya Apple/iPhone adaptorunu arayin."
  exit 1
}

$metroUrl = "http://${usbIp}:8081"
Write-Host ""
Write-Host "Dev client Enter URL:" -ForegroundColor Cyan
Write-Host "  $metroUrl" -ForegroundColor Green
Write-Host ""
Write-Host "Safari test (telefonda acilmali):" -ForegroundColor Cyan
Write-Host "  $metroUrl" -ForegroundColor Green
Write-Host ""
Write-Host "Metro baslatiliyor..." -ForegroundColor Yellow
Write-Host "Baglandiktan sonra kod degisikligi otomatik yenilenir (r = reload)." -ForegroundColor Gray
Write-Host ""

$env:NODE_ENV = "development"
npm run stop:metro 2>$null | Out-Null
npx expo start --dev-client --lan --scheme proparcel --port 8081
