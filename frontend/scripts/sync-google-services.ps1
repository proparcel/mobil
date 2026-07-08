# Firebase google-services.json -> android/app/
# Kullanim: frontend/google-services.json dosyasini Firebase Console'dan indirdikten sonra:
#   powershell -File scripts/sync-google-services.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$repoFirebase = Join-Path $root "..\..\..\firebase\google-services.json"
$repoFirebase = (Resolve-Path $repoFirebase -ErrorAction SilentlyContinue)?.Path
$src = if (Test-Path (Join-Path $root "google-services.json")) {
  Join-Path $root "google-services.json"
} elseif ($repoFirebase -and (Test-Path $repoFirebase)) {
  $repoFirebase
} else {
  Join-Path $root "google-services.json"
}
$dest = Join-Path $root "android\app\google-services.json"

if (-not (Test-Path $src)) {
  Write-Host "HATA: $src bulunamadi." -ForegroundColor Red
  Write-Host "Firebase Console -> Proje -> Android uygulama (com.proparcel.mobile) -> google-services.json indir"
  exit 1
}

Copy-Item -Force $src $dest
Write-Host "OK: google-services.json -> android/app/" -ForegroundColor Green
