# iPhone development client kurulumu (Metro tek basina uygulama yuklemez)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "=== 1) iPhone UDID kaydi (internal build icin) ===" -ForegroundColor Cyan
Write-Host "Acilan pencerede: eas device:create -> QR veya kablo ile cihaz ekle" -ForegroundColor Yellow
$deviceCmd = "cd '$PWD'; eas device:create; Read-Host 'UDID kaydi bitti - Enter'"
Start-Process powershell -ArgumentList @("-NoExit", "-Command", $deviceCmd)

Write-Host ""
Write-Host "=== 2) Yeni development IPA (EAS cloud, yaklasik 15-25 dk) ===" -ForegroundColor Cyan
npm run eas:sync-env
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

npm run clean:eas-upload
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$env:EAS_NO_VCS = "1"
$env:NODE_ENV = "development"
eas build --platform ios --profile development --non-interactive
if ($LASTEXITCODE -ne 0) {
  Write-Host "Build basarisiz veya credentials eksik. Deneyin: npm run eas:build:ios" -ForegroundColor Red
  exit $LASTEXITCODE
}

$buildListJson = eas build:list --platform ios --profile development --limit 1 --json --non-interactive
$buildId = ($buildListJson | ConvertFrom-Json)[0].id
Write-Host ""
Write-Host "Build ID: $buildId" -ForegroundColor Green
$url = "https://expo.dev/accounts/sercanyanaz/projects/frontend/builds/$buildId"
Write-Host "Telefonda Safari ile acin ve Install:" -ForegroundColor Green
Write-Host $url
Start-Process $url

Write-Host ""
Write-Host "=== 3) Metro (kurulumdan sonra) ===" -ForegroundColor Cyan
Write-Host "npm run start:ios-dev  -> QR ile baglan"
