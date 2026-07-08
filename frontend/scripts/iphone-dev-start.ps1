# iPhone 11 canli gelistirme — tek komut (tunnel = en guvenilir).
param(
  [switch]$Lan
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
. "$PSScriptRoot/metro-ports.ps1"

$latestDevBuildId = "ec10f148-51ff-420f-841a-4f2c10cf6464"
$latestDevBuildUrl = "https://expo.dev/accounts/sercanyanaz/projects/frontend/builds/$latestDevBuildId"

function Get-LanIp {
  $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.InterfaceAlias -notmatch 'Loopback|vEthernet|WSL' -and $_.IPAddress -notmatch '^169\.'
  } | Select-Object -First 1).IPAddress
  if (-not $ip) { return $null }
  return $ip
}

function Stop-MetroIos {
  Stop-MetroPort -Port $METRO_PORT_IOS
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  ProParcel iPhone CANLI GELISTIRME" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "ONCE TELEFONDA (bir kez / sorun varsa tekrar):" -ForegroundColor Yellow
Write-Host "  1) Expo Go SIL — bu proje Expo Go ile CALISMAZ" -ForegroundColor Red
Write-Host "  2) TestFlight ProParcel varsa SIL (ayni bundle id)" -ForegroundColor Red
Write-Host "  3) Safari -> development IPA kur:" -ForegroundColor White
Write-Host "     $latestDevBuildUrl" -ForegroundColor Green
Write-Host "  4) Ayarlar -> Genel -> VPN ve Cihaz Yonetimi -> Guven" -ForegroundColor White
Write-Host "  5) Uygulama acilinca EXPO DEV LAUNCHER gorunmeli" -ForegroundColor White
Write-Host "     (Enter URL / Recent servers). Direkt ana ekran = YANLIS IPA!" -ForegroundColor Red
Write-Host ""
Write-Host "METRO SONRA TELEFONDA:" -ForegroundColor Yellow
Write-Host "  - iPhone Kamera ile QR OKUTMA (veri yok = normal)" -ForegroundColor Red
Write-Host "  - Dev launcher -> Enter URL manually" -ForegroundColor Green
if ($Lan) {
  $ip = Get-LanIp
  if ($ip) {
    Write-Host "  - LAN URL: http://${ip}:$METRO_PORT_IOS" -ForegroundColor Green
    Write-Host "  - Safari test: http://${ip}:$METRO_PORT_IOS/status" -ForegroundColor Gray
  }
} else {
  Write-Host "  - TUNNEL: Metro acilinca terminaldeki http(s) URL'yi yaz" -ForegroundColor Green
  Write-Host "    (proparcel:// degil, icindeki http... adresi)" -ForegroundColor Gray
}
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

Stop-MetroIos
& "$PSScriptRoot/ensure-metro-firewall.ps1" -Port $METRO_PORT_IOS

$lanIp = Get-LanIp
if ($lanIp) {
  $env:REACT_NATIVE_PACKAGER_HOSTNAME = $lanIp
}
$env:NODE_ENV = "development"
$env:CI = ""

$expoArgs = @(
  "start",
  "--dev-client",
  "--scheme", "proparcel",
  "--port", "$METRO_PORT_IOS",
  "--clear"
)
if ($Lan) {
  $expoArgs += "--lan"
  Write-Host "[metro] LAN modu baslatiliyor..." -ForegroundColor Cyan
} else {
  $expoArgs += "--tunnel"
  Write-Host "[metro] TUNNEL modu baslatiliyor (Wi-Fi/firewall sorunlarini atlar)..." -ForegroundColor Cyan
}
Write-Host ""

& npx expo @expoArgs
