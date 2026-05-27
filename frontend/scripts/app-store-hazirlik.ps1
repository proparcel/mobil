# App Store on hazirlik (otomatik adimlar). Apple credentials ayri pencerede interaktif yapilir.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "=== Ortam + EAS upload temizligi ===" -ForegroundColor Cyan
npm run eas:sync-env
npm run clean:eas-upload
npm run eas:inspect:ios

Write-Host "`nMapbox sk: EAS secret RNMAPBOX_MAPS_DOWNLOAD_TOKEN (projede kayitli)." -ForegroundColor Green
Write-Host "Apple: ayri acilan PowerShell penceresinde credentials tamamlanmali." -ForegroundColor Yellow
Write-Host "Sonra bu klasorde: npm run eas:release:ios" -ForegroundColor Yellow
