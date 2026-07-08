# Eski Expo Dev Client APK'sini kaldir, port forward, temiz debug yukle.
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$adbCandidates = @(
  "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe",
  "C:\Android\Sdk\platform-tools\adb.exe"
)
$adb = $adbCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $adb) {
  Write-Error "adb bulunamadi. Android SDK platform-tools kurulu olmali."
}

$devices = & $adb devices | Select-String "device$"
if (-not $devices) {
  Write-Error "USB cihaz bagli degil. USB hata ayiklama acik olmali."
}

. "$PSScriptRoot/metro-ports.ps1"
. "$PSScriptRoot/metro-smart.ps1"

Write-Host "Eski ProParcel kaldiriliyor (Expo dev launcher iceren build)..."
& $adb uninstall com.proparcel.mobile 2>$null | Out-Null

Ensure-AdbReverse -Port $METRO_PORT_ANDROID
Write-Host "adb reverse: Metro $METRO_PORT_ANDROID, Django 8000"

Write-Host "Native fix + temiz Gradle..."
node ./scripts/apply-android-native-fix.js
if (Test-Path "android\gradlew.bat") {
  Push-Location android
  .\gradlew.bat clean
  Pop-Location
}

Write-Host ""
Write-Host "Sonraki adimlar:"
Write-Host "  Terminal 1: npm run metro:window:android"
Write-Host "  Terminal 2: npm run android:dev"
Write-Host ""
Write-Host "API sunucu (Django): http://178.210.168.33:8000  (.env EXPO_PUBLIC_API_URL)"
Write-Host "Not: Android Metro portu $METRO_PORT_ANDROID'dir; iOS Metro $METRO_PORT_IOS'de ayri calisir."
