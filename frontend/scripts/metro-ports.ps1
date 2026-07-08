# iOS dev client: expo start (8081). Android: expo/react-native (8082).
$script:METRO_PORT_IOS = 8081
$script:METRO_PORT_ANDROID = 8082

function Stop-MetroPort {
  param([int]$Port)
  $pids = @(Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
    ForEach-Object { $_.OwningProcess } | Sort-Object -Unique)
  foreach ($procId in $pids) {
    if (-not $procId) { continue }
    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    Write-Host "[metro] Port $Port durduruldu PID $procId"
  }
  if ($pids.Count -eq 0) { Write-Host "[metro] Port $Port zaten bos" -ForegroundColor Gray }
}
