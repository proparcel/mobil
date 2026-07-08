# Ortak Metro yardimcilari: port kontrolu, pencere baslatma, adb reverse.
$ErrorActionPreference = "Stop"

. "$PSScriptRoot/metro-ports.ps1"

function Get-LanIp {
  $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.InterfaceAlias -notmatch 'Loopback|vEthernet|WSL' -and $_.IPAddress -notmatch '^169\.'
  } | Select-Object -First 1).IPAddress
  return $ip
}

function Test-MetroListening {
  param([int]$Port)
  try {
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
      Select-Object -First 1
    return [bool]$conn
  } catch {
    return $false
  }
}

function Wait-MetroReady {
  param(
    [int]$Port,
    [int]$TimeoutSec = 90
  )
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    if (Test-MetroListening -Port $Port) {
      try {
        $resp = Invoke-WebRequest -Uri "http://127.0.0.1:${Port}/status" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        if ($resp.StatusCode -eq 200) {
          Write-Host "[metro] Port $Port hazir (/status OK)" -ForegroundColor Green
          return $true
        }
      } catch {
        # Dinliyor ama henuz hazir degil
      }
    }
    Start-Sleep -Seconds 2
  }
  Write-Host "[metro] Uyari: Port $Port ${TimeoutSec}s icinde hazir olmadi" -ForegroundColor Yellow
  return $false
}

function Get-MetroWindowTitle {
  param([ValidateSet('ios', 'android')]$Platform)
  if ($Platform -eq 'ios') { return 'ProParcel iOS Metro' }
  return 'ProParcel Android Metro'
}

function Get-MetroPortForPlatform {
  param([ValidateSet('ios', 'android')]$Platform)
  if ($Platform -eq 'ios') { return $METRO_PORT_IOS }
  return $METRO_PORT_ANDROID
}

function Get-AdbPath {
  $adbCandidates = @(
    "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe",
    "C:\Android\Sdk\platform-tools\adb.exe",
    "adb.exe"
  )
  foreach ($c in $adbCandidates) {
    if ($c -eq "adb.exe") {
      $cmd = Get-Command adb.exe -ErrorAction SilentlyContinue
      if ($cmd) { return $cmd.Source }
    } elseif (Test-Path $c) {
      return $c
    }
  }
  return $null
}

function Ensure-AdbReverse {
  param([int]$Port)
  $adb = Get-AdbPath
  if (-not $adb) {
    Write-Host "[adb] Bulunamadi; reverse tcp:$Port atlandi." -ForegroundColor Gray
    return
  }
  $devices = & $adb devices 2>$null | Select-String "device$"
  if (-not $devices) {
    Write-Host "[adb] USB cihaz yok; reverse tcp:$Port atlandi." -ForegroundColor Gray
    return
  }
  & $adb reverse "tcp:${Port}" "tcp:${Port}" | Out-Null
  & $adb reverse tcp:8000 tcp:8000 | Out-Null
  Write-Host "[adb] reverse: $Port (Metro), 8000 (Django yerel)" -ForegroundColor Gray
}

function Start-MetroInWindow {
  param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('ios', 'android')]
    $Platform,
    [switch]$Clear
  )

  $root = Split-Path $PSScriptRoot -Parent
  $port = Get-MetroPortForPlatform -Platform $Platform
  $title = Get-MetroWindowTitle -Platform $Platform

  & "$PSScriptRoot/ensure-metro-firewall.ps1" -Port $port

  if ($Platform -eq 'android') {
    Ensure-AdbReverse -Port $port
  }

  $lanIp = Get-LanIp
  $clearPart = if ($Clear) { " --clear" } else { "" }
  $hostnamePart = if ($lanIp) { "&& set REACT_NATIVE_PACKAGER_HOSTNAME=$lanIp" } else { "" }

  $inner = "title $title && cd /d `"$root`" && set NODE_ENV=development&& set CI=$hostnamePart && npx expo start$clearPart --dev-client --lan --scheme proparcel --port $port"

  Write-Host "[metro] Yeni pencere: $title (port $port)" -ForegroundColor Cyan
  Start-Process cmd -ArgumentList "/k", $inner | Out-Null
}

function Invoke-FocusMetroWindow {
  param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('ios', 'android')]
    $Platform
  )
  & "$PSScriptRoot/focus-metro-window.ps1" -Platform $Platform
}
