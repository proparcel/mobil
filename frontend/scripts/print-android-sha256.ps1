# Debug / release APK imza SHA-256 (Android App Links assetlinks.json icin)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$android = Join-Path $root "android"
if (-not (Test-Path $android)) {
  Write-Host "android/ yok. Once: npm run prebuild:android:safe" -ForegroundColor Yellow
  exit 1
}
Push-Location $android
try {
  Write-Host "Gradle signingReport calistiriliyor..." -ForegroundColor Cyan
  .\gradlew.bat signingReport 2>&1 | Select-String -Pattern "SHA-?256:" -Context 0,0
  Write-Host ""
  Write-Host "Sunucu .env ornegi:" -ForegroundColor Green
  Write-Host 'MOBILE_ANDROID_SHA256_CERT_FINGERPRINT=AA:BB:... (yukaridaki SHA256, iki nokta ust uste)' 
  Write-Host ""
  Write-Host "Dogrulama (deploy sonrasi):" -ForegroundColor Cyan
  Write-Host "  https://www.proparcel.com/.well-known/assetlinks.json"
} finally {
  Pop-Location
}
