# Metro + dev client sifir baglanti (debugging not working / reload calismiyor).
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
. "$PSScriptRoot/metro-ports.ps1"

Write-Host ""
Write-Host "=== ProParcel iPhone dev SIFIRLAMA ===" -ForegroundColor Cyan
Write-Host ""

Stop-MetroPort -Port $METRO_PORT_IOS

$cache = Join-Path $root ".metro-cache"
if (Test-Path $cache) {
  Remove-Item -Recurse -Force $cache
  Write-Host "[cache] .metro-cache silindi"
}

$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
  $_.InterfaceAlias -notmatch 'Loopback|vEthernet|WSL' -and $_.IPAddress -notmatch '^169\.'
} | Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "TELEFONDA (sirayla):" -ForegroundColor Yellow
Write-Host "  1) ProParcel uygulamasini TAMAMEN kapat (app switcher)" -ForegroundColor White
Write-Host "  2) Yeniden ac -> onceki sunucu varsa sil / Go Home" -ForegroundColor White
Write-Host "  3) Metro acilinca terminaldeki proparcel:// satirini decode edin:" -ForegroundColor White
Write-Host '     npm run iphone:decode-url -- "proparcel://expo-development-client/?url=..."' -ForegroundColor Gray
Write-Host "     Telefona YALNIZCA decode ciktisini yazin (https://....exp.direct)" -ForegroundColor Green
Write-Host "     Ornek: https://ikqt_ds-sercanyanaz-8082.exp.direct" -ForegroundColor Green
Write-Host "  4) Ilk bundle 30-60 sn surer; (2000+ modules) bekleyin" -ForegroundColor White
Write-Host "  5) Reload icin ONCE Metro penceresinde 'r' basin" -ForegroundColor White
Write-Host ""

$env:NODE_ENV = "development"
$env:CI = ""
if ($ip) { $env:REACT_NATIVE_PACKAGER_HOSTNAME = $ip }

Write-Host "[metro] TUNNEL + --clear baslatiliyor..." -ForegroundColor Cyan
Write-Host ""

& npx expo start --clear --dev-client --tunnel --scheme proparcel --port $METRO_PORT_IOS
