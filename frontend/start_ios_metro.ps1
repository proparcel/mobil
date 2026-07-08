# iOS Metro (8081): aciksa dokunma; kapaliysa baslat.
param(
  [switch]$Lan,
  [switch]$Tunnel,
  [switch]$ForceRestart,
  [switch]$Clear,
  [switch]$MetroOnly
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
Set-Location $root

. "$root/scripts/metro-smart.ps1"

if (-not $Lan -and -not $Tunnel) { $Lan = $true }

$port = $METRO_PORT_IOS
$metroRunning = Test-MetroListening -Port $port

Write-Host ""
Write-Host "=== start_ios_metro (port $port) ===" -ForegroundColor Cyan
Write-Host ""

if ($metroRunning -and -not $ForceRestart) {
  Write-Host "[ios] Metro zaten acik (port $port) - yeniden baslatilmiyor." -ForegroundColor Green
  & "$root/scripts/iphone-connect-help.ps1" -Tunnel:$Tunnel
  Invoke-FocusMetroWindow -Platform ios
  exit 0
}

if ($ForceRestart -and $metroRunning) {
  Stop-MetroPort -Port $port
  Start-Sleep -Seconds 1
}

& "$root/scripts/iphone-connect-help.ps1" -Tunnel:$Tunnel
if (-not $Tunnel) {
  & "$root/scripts/ensure-metro-firewall.ps1" -Port $port
}

$lanIp = Get-LanIp
if ($lanIp) { $env:REACT_NATIVE_PACKAGER_HOSTNAME = $lanIp }
$env:NODE_ENV = "development"
$env:CI = ""

$expoArgs = @(
  "start",
  "--dev-client",
  "--scheme", "proparcel",
  "--port", "$port"
)
if ($Clear) { $expoArgs += "--clear" }
if ($Tunnel) {
  $expoArgs += "--tunnel"
  Write-Host "[ios] TUNNEL modu..." -ForegroundColor Cyan
} else {
  $expoArgs += "--lan"
  Write-Host "[ios] LAN modu..." -ForegroundColor Cyan
}
Write-Host ""

if ($MetroOnly) {
  Start-MetroInWindow -Platform ios -Clear:$Clear
  Wait-MetroReady -Port $port | Out-Null
  Invoke-FocusMetroWindow -Platform ios
  exit 0
}

& npx expo @expoArgs
