# android/ workspace'te kilitli (EBUSY) iken gecici dizinde prebuild + calistirma.
# Ana projedeki android/ klasorune dokunmaz.
$ErrorActionPreference = "Stop"
$srcRoot = Split-Path -Parent $PSScriptRoot
$destRoot = "C:\Temp\ProParcelAndroidDev"
$srcAndroid = Join-Path $srcRoot "android"
$destAndroid = Join-Path $destRoot "android"

Write-Host "=== android-setup-temp ==="
Write-Host "Kaynak: $srcRoot"
Write-Host "Hedef:  $destRoot"

if (-not (Test-Path $destRoot)) {
  New-Item -ItemType Directory -Path $destRoot -Force | Out-Null
}

# node_modules: junction (hizli) veya yoksa kopyala
$srcNm = Join-Path $srcRoot "node_modules"
$destNm = Join-Path $destRoot "node_modules"
if (Test-Path $destNm) {
  if ((Get-Item $destNm).Attributes -band [IO.FileAttributes]::ReparsePoint) {
    Write-Host "node_modules junction mevcut."
  }
} elseif (Test-Path $srcNm) {
  Write-Host "node_modules junction olusturuluyor..."
  cmd /c "mklink /J `"$destNm`" `"$srcNm`"" | Out-Host
}

$exclude = @("android", "node_modules", ".metro-cache", "apk_releases", "release_builds", "ios", "android._stale_*")
Write-Host "Proje dosyalari senkronize ediliyor (android haric)..."
if (Get-Command robocopy -ErrorAction SilentlyContinue) {
  $xd = $exclude | ForEach-Object { "/XD"; $_ }
  & robocopy $srcRoot $destRoot /MIR /NFL /NDL /NJH /NJS /nc /ns /np @xd /XF "*.apk" "*.aab" 2>&1 | Out-Null
} else {
  Write-Host "robocopy yok; Copy-Item (yavas)..."
  Get-ChildItem $srcRoot -Force | Where-Object { $_.Name -notin $exclude } | ForEach-Object {
    Copy-Item $_.FullName (Join-Path $destRoot $_.Name) -Recurse -Force
  }
}

Push-Location $destRoot
try {
  if (Test-Path $destAndroid) {
    Write-Host "Gecici android/ siliniyor..."
    Remove-Item $destAndroid -Recurse -Force -ErrorAction SilentlyContinue
  }
  Write-Host "expo prebuild --platform android --clean ..."
  npx expo prebuild --platform android --clean
  node ./scripts/apply-android-native-fix.js
  Write-Host ""
  Write-Host "=== TAMAM ==="
  Write-Host "Gecici proje: $destRoot"
  Write-Host ""
  Write-Host "Terminal 1 (Metro):"
  Write-Host "  cd $destRoot"
  Write-Host "  npm run start:dev"
  Write-Host ""
  Write-Host "Terminal 2 (USB cihaz):"
  Write-Host "  cd $destRoot"
  Write-Host "  adb reverse tcp:8081 tcp:8081"
  Write-Host "  npm run android:run-only"
} finally {
  Pop-Location
}

if (Test-Path $srcAndroid) {
  Write-Host ""
  Write-Host "NOT: Ana projede android/ hala kilitli olabilir."
  Write-Host "Cursor kapali iken: npm run unlock:android"
  Write-Host "veya yeniden baslat sonrasi silin."
}
