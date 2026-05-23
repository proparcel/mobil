# Yerel Android build / Gradle çıktılarını siler (EAS upload ve disk alanı için).
$ErrorActionPreference = "SilentlyContinue"
$root = Split-Path -Parent $PSScriptRoot
$targets = @(
  Join-Path $root "android\app\build"
  Join-Path $root "android\build"
  Join-Path $root "android\.gradle"
)
foreach ($t in $targets) {
  if (Test-Path $t) {
    Remove-Item -LiteralPath $t -Recurse -Force
    Write-Host "Silindi: $t"
  }
}
Write-Host "Tamam. EAS oncesi: repo kokundeki .easignore dosyasinin guncel oldugundan emin olun."
