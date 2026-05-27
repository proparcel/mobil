# USB ile Android debug: Metro (8081) ve istege bagli Django (8000) port yonlendirme.
$ErrorActionPreference = "SilentlyContinue"
$adbCandidates = @(
  "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe",
  "C:\Android\Sdk\platform-tools\adb.exe",
  "adb.exe"
)
$adb = $null
foreach ($c in $adbCandidates) {
  if ($c -eq "adb.exe") {
    $cmd = Get-Command adb.exe -ErrorAction SilentlyContinue
    if ($cmd) { $adb = $cmd.Source; break }
  } elseif (Test-Path $c) {
    $adb = $c
    break
  }
}
if (-not $adb) {
  Write-Host "[android-dev-prepare] adb bulunamadi; Metro icin adb reverse atlandi."
  exit 0
}
$devices = & $adb devices 2>$null | Select-String "device$"
if (-not $devices) {
  Write-Host "[android-dev-prepare] USB cihaz yok; adb reverse atlandi."
  exit 0
}
& $adb reverse tcp:8081 tcp:8081 | Out-Null
& $adb reverse tcp:8000 tcp:8000 | Out-Null
Write-Host "[android-dev-prepare] adb reverse: 8081 (Metro), 8000 (Django yerel)"
