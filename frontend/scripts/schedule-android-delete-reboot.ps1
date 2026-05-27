# Yonetici PowerShell: yeniden baslatinca kilitli android/ klasorunu silmeyi dener.
#Requires -RunAsAdministrator
$ErrorActionPreference = "Stop"
$android = "C:\ProParcel\mobile\mobil_github\frontend\android"
if (-not (Test-Path $android)) {
  Write-Host "android/ yok, gerek yok."
  exit 0
}
$regPath = "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager"
$name = "PendingFileRenameOperations"
# REG_MULTI_SZ: silinecek yol, bos satir
$multi = @("\??\$($android.Replace('/','\'))", "", "")
$existing = (Get-ItemProperty -Path $regPath -Name $name -ErrorAction SilentlyContinue).$name
if ($existing) {
  $multi = @($existing) + $multi
}
Set-ItemProperty -Path $regPath -Name $name -Value $multi -Type MultiString
Write-Host "Yeniden baslatma sonrasi silme planlandi: $android"
Write-Host "PC'yi yeniden baslatin."
