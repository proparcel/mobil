# iPhone Metro baglanti yardimi — LAN (sabit URL) veya tunnel (farkli ag).

param(
  [switch]$Tunnel
)

. "$PSScriptRoot/metro-ports.ps1"

$latestDevBuildUrl = "https://expo.dev/accounts/sercanyanaz/projects/frontend/builds/ec10f148-51ff-420f-841a-4f2c10cf6464"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan

if ($Tunnel) {
  Write-Host "  FARKLI AG — TUNNEL modu" -ForegroundColor Green
  Write-Host "============================================================" -ForegroundColor Cyan
  Write-Host ""
  Write-Host "  1. Metro acilinca 'Tunnel ready' satirini bekleyin." -ForegroundColor White
  Write-Host "  2. Terminaldeki proparcel://... satirini kopyalayin." -ForegroundColor White
  Write-Host "  3. URL coz:" -ForegroundColor White
  Write-Host '     npm run iphone:decode-url -- "proparcel://..."' -ForegroundColor Green
  Write-Host "  4. Telefonda Enter URL manually -> cikan https://... adresini girin." -ForegroundColor White
  Write-Host ""
  Write-Host "  Tunnel basarisiz olursa (reading body):" -ForegroundColor Yellow
  Write-Host "    npm run iphone:fix   (cache temiz + yeniden dene)" -ForegroundColor Gray
  Write-Host "    veya birkac dakika bekleyip tekrar deneyin (Expo Ngrok limiti)." -ForegroundColor Gray
} else {
  $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.InterfaceAlias -notmatch 'Loopback|vEthernet|WSL' -and $_.IPAddress -notmatch '^169\.'
  } | Select-Object -First 1).IPAddress
  if (-not $ip) { $ip = 'BILGISAYAR_IP' }
  $lanUrl = "http://${ip}:$METRO_PORT_IOS"

  Write-Host "  AYNI WiFi — LAN modu (sabit URL)" -ForegroundColor Green
  Write-Host "============================================================" -ForegroundColor Cyan
  Write-Host ""
  Write-Host "  Telefon Enter URL manually:" -ForegroundColor White
  Write-Host "    $lanUrl" -ForegroundColor Green -BackgroundColor Black
  Write-Host ""
  Write-Host "  Farkli agdaysaniz: npm run iphone:dev:tunnel" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  Dev IPA (bir kez): $latestDevBuildUrl" -ForegroundColor Gray
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
