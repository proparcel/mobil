# App Store: Apple credentials (ilk sefer interaktif) + production IPA + istege bagli submit
# PowerShell: .\scripts\setup-ios-app-store.ps1
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "=== 1/4 Ortam ===" -ForegroundColor Cyan
npm run eas:sync-env
npm run clean:eas-upload

Write-Host "`n=== 2/4 Apple credentials (production / App Store) ===" -ForegroundColor Cyan
Write-Host "EAS sorulari: Apple hesabi, Team, Distribution Certificate -> Let EAS manage" -ForegroundColor Yellow
$env:EAS_NO_VCS = "1"
eas credentials:configure-build -p ios -e production
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n=== 3/4 Production IPA (EAS cloud) ===" -ForegroundColor Cyan
$env:NODE_ENV = "production"
eas build --platform ios --profile production
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n=== 4/4 IPA indir ===" -ForegroundColor Cyan
if (-not (Test-Path "ios_release_builds")) { New-Item -ItemType Directory -Path "ios_release_builds" | Out-Null }
Set-Location ios_release_builds
eas build:download -p ios --non-interactive
Set-Location ..

Write-Host "`nTamam. App Store Connect:" -ForegroundColor Green
Write-Host "  eas submit --platform ios --profile production --latest"
Write-Host "  veya Mac Transporter ile ios_release_builds\*.ipa"
