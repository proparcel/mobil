# Yerel Android build / Gradle ciktilarini siler.
# NOT: "gradlew clean" RN New Architecture'da codegen/jni silindikten sonra CMake hatasi verir - bu script kullanin.
$ErrorActionPreference = "SilentlyContinue"
$root = Split-Path -Parent $PSScriptRoot
$unityLibBuild = Join-Path $root "..\unity\vrParcel\builds\android\unityLibrary\build"
$targets = @(
  Join-Path $root "android\app\build"
  Join-Path $root "android\app\.cxx"
  Join-Path $root "android\build"
  Join-Path $root "android\.gradle"
  $unityLibBuild
)
foreach ($t in $targets) {
  if (Test-Path $t) {
    Remove-Item -LiteralPath $t -Recurse -Force
    Write-Host "Silindi: $t"
  }
}
$androidRoot = Join-Path $root "android"
if (-not (Test-Path $androidRoot)) {
  Write-Host ""
  Write-Host "UYARI: android/ klasoru yok (gitignore - prebuild ile olusur)."
  Write-Host "Once: npm run prebuild:android:safe"
  Write-Host "Unity export sonrasi: npm run validate:unity-smoke-export"
  Write-Host "Sonra: npm run android"
} else {
  Write-Host "Tamam. Simdi: npm run android  (gradlew clean KULLANMAYIN)"
}
