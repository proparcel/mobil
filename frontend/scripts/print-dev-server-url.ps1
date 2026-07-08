# Metro acikken telefona girilecek SABIT LAN URL (dev:iphone ile). iOS = 8081.

. "$PSScriptRoot/metro-ports.ps1"

$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {

  $_.InterfaceAlias -notmatch 'Loopback|vEthernet|WSL' -and $_.IPAddress -notmatch '^169\.'

} | Select-Object -First 1).IPAddress

if (-not $ip) { $ip = 'BILGISAYAR_IP' }

$url = "http://${ip}:$METRO_PORT_IOS"



Write-Host ""

Write-Host "iOS sabit URL (npm run dev:iphone - her gun ayni):" -ForegroundColor Cyan

Write-Host "  $url" -ForegroundColor Green

Write-Host ""

Write-Host "Android Metro ayri: http://${ip}:$METRO_PORT_ANDROID" -ForegroundColor Gray

Write-Host "Safari test: ${url}/status" -ForegroundColor Gray

Write-Host ""

Write-Host "Tunnel (iphone:fix) kullaniyorsaniz URL degisir; decode: npm run iphone:decode-url" -ForegroundColor Yellow

Write-Host ""

