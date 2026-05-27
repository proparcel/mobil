# EAS yuklemesi oncesi yerel agir/cache klasorlerini temizler.
# android/ ve ios/ SILINMEZ — yerel debug icin kalir; EAS zaten .easignore ile bunlari yuklemez,
# cloud'da kendi prebuild'ini uretir (release ile celismez).
param(
  [switch]$IncludeNativeFolders
)
$ErrorActionPreference = "SilentlyContinue"
$root = Split-Path -Parent $PSScriptRoot
$targets = @(
  Join-Path $root "apk_releases"
  Join-Path $root "release_builds"
  Join-Path $root "ios_release_builds"
  Join-Path $root "assets\models"
  Join-Path $root ".metro-cache"
  Join-Path $root ".metro-assets-test"
  Join-Path $root ".metro-bundle-test.js"
  # EAS tarball android/.gradle kopyalarken EBUSY verebilir; kaynak android/ kalir.
  Join-Path $root "android\.gradle"
  Join-Path $root "android\build"
  Join-Path $root "android\app\build"
)
if ($IncludeNativeFolders) {
  $targets = @(
    (Join-Path $root "android"),
    (Join-Path $root "ios")
  ) + $targets
}
$gradlew = Join-Path $root "android\gradlew.bat"
if (Test-Path $gradlew) {
  & $gradlew --stop 2>$null | Out-Null
  Write-Host "Gradle daemon durduruldu (android/.gradle kilidi icin)."
}
foreach ($t in $targets) {
  if (Test-Path $t) {
    Remove-Item -LiteralPath $t -Recurse -Force
    Write-Host "Silindi: $t"
  }
}
if ($IncludeNativeFolders) {
  Write-Host "EAS upload hazirligi (native klasorler de silindi)."
} else {
  Write-Host "EAS upload hazirligi (android/ios korundu, yerel build etkilenmez)."
}
