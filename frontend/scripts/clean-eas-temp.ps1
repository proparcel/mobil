# EAS CLI gecici klasorlerini siler (ENOSPC sonrasi).
$ErrorActionPreference = "SilentlyContinue"
$targets = @(
  Join-Path $env:TEMP "eas-cli-nodejs"
  Join-Path $env:TEMP "eas-archive-inspect"
)
foreach ($t in $targets) {
  if (Test-Path $t) {
    Remove-Item -LiteralPath $t -Recurse -Force
    Write-Host "Silindi: $t"
  }
}
Write-Host "Tamam."
