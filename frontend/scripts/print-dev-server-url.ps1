# Metro acikken telefona girilecek URL
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
  $_.InterfaceAlias -notmatch 'Loopback|vEthernet|WSL' -and $_.IPAddress -notmatch '^169\.'
} | Select-Object -First 1).IPAddress
if (-not $ip) { $ip = 'BILGISAYAR_IP' }
Write-Host ""
Write-Host "Telefonda 'Enter URL manually':" -ForegroundColor Cyan
Write-Host "  http://${ip}:8081" -ForegroundColor Green
Write-Host ""
Write-Host "veya Metro terminalindeki QR (expo.dev build QR degil!)" -ForegroundColor Yellow
