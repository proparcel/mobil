# EAS yuklemesinden once yerel agir klasorleri siler (iOS build icin android/ gerekmez).
$ErrorActionPreference = "SilentlyContinue"
$root = Split-Path -Parent $PSScriptRoot
$targets = @(
  Join-Path $root "android"
  Join-Path $root "ios"
  Join-Path $root "apk_releases"
  Join-Path $root "release_builds"
  Join-Path $root "assets\models"
  Join-Path $root ".metro-cache"
  Join-Path $root ".metro-assets-test"
  Join-Path $root ".metro-bundle-test.js"
)
foreach ($t in $targets) {
  if (Test-Path $t) {
    Remove-Item -LiteralPath $t -Recurse -Force
    Write-Host "Silindi: $t"
  }
}
Write-Host "EAS upload hazirligi tamam (android/ios EAS prebuild ile uretilir)."
