# ProParcel Metro CMD penceresini one getirir (iOS veya Android).
param(
  [ValidateSet('ios', 'android')]
  [string]$Platform = 'ios'
)

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class PpWin32 {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@

. "$PSScriptRoot/metro-smart.ps1"

$title = Get-MetroWindowTitle -Platform $Platform
$port = Get-MetroPortForPlatform -Platform $Platform

$cmd = Get-CimInstance Win32_Process |
  Where-Object {
    $_.Name -eq 'cmd.exe' -and (
      $_.CommandLine -like "*$title*" -or
      ($_.CommandLine -like '*ProParcel Metro*' -and $Platform -eq 'android')
    )
  } |
  Select-Object -First 1

if (-not $cmd) {
  $cmd = Get-CimInstance Win32_Process |
    Where-Object {
      $_.Name -eq 'cmd.exe' -and $_.CommandLine -like "*--port $port*"
    } |
    Select-Object -First 1
}

if (-not $cmd) {
  Write-Host "Metro penceresi bulunamadi ($Platform, port $port)."
  Write-Host "Acmak icin: npm run metro:window:$Platform"
  exit 1
}

$proc = Get-Process -Id $cmd.ProcessId -ErrorAction SilentlyContinue
if (-not $proc -or $proc.MainWindowHandle -eq [IntPtr]::Zero) {
  Write-Host "Metro cmd var (PID $($cmd.ProcessId)) ama pencere handle yok."
  Write-Host "Gorev cubugundan cmd simgesine tiklayin."
  exit 1
}

[PpWin32]::ShowWindow($proc.MainWindowHandle, 9) | Out-Null
[PpWin32]::SetForegroundWindow($proc.MainWindowHandle) | Out-Null
Write-Host "Metro penceresi one alindi ($Platform, PID $($cmd.ProcessId))."
exit 0
