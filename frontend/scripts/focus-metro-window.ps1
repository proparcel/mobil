# ProParcel Metro CMD penceresini one getirir (varsa).
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class PpWin32 {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@

$cmd = Get-CimInstance Win32_Process |
  Where-Object { $_.Name -eq 'cmd.exe' -and $_.CommandLine -like '*ProParcel Metro*' } |
  Select-Object -First 1

if (-not $cmd) {
  Write-Host "Metro penceresi bulunamadi."
  Write-Host "Acmak icin: npm run metro:window"
  Write-Host "Veya ayni pencerede: npm run metro:fg"
  exit 1
}

$proc = Get-Process -Id $cmd.ProcessId -ErrorAction SilentlyContinue
if (-not $proc -or $proc.MainWindowHandle -eq [IntPtr]::Zero) {
  Write-Host "Metro cmd var (PID $($cmd.ProcessId)) ama pencere handle yok."
  Write-Host "Gorev cubugunda cmd simgesine tiklayin veya npm run metro:window ile yeniden acin."
  exit 1
}

[PpWin32]::ShowWindow($proc.MainWindowHandle, 9) | Out-Null
[PpWin32]::SetForegroundWindow($proc.MainWindowHandle) | Out-Null
Write-Host "Metro penceresi one alindi (PID $($cmd.ProcessId))."
exit 0
