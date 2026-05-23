# ProParcel mobil indirme sayfasi (Android APK + iOS IPA)
param(
    [string]$PublicIp = "176.238.6.240",
    [int]$Port = 8002,
    [string]$Version = "1.0.0",
    [string]$BundleId = "com.proparcel.app"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$releases = Join-Path $root "app_releases"
$apkPath = Join-Path $releases "ProParcel.apk"
$ipaPath = Join-Path $releases "ProParcel.ipa"
$manifestPath = Join-Path $releases "manifest.plist"
$htmlPath = Join-Path $releases "index.html"

if (-not (Test-Path $releases)) {
    New-Item -ItemType Directory -Path $releases | Out-Null
}

function Get-SizeMb([string]$path) {
    if (Test-Path $path) { return [math]::Round((Get-Item $path).Length / 1MB, 2) }
    return $null
}

$apkExists = Test-Path $apkPath
$ipaExists = Test-Path $ipaPath
$apkMb = Get-SizeMb $apkPath
$ipaMb = Get-SizeMb $ipaPath

$baseUrl = "http://${PublicIp}:${Port}"
$apkUrl = "$baseUrl/ProParcel.apk"
$ipaUrl = "$baseUrl/ProParcel.ipa"
$manifestUrl = "$baseUrl/manifest.plist"
$iosInstallUrl = "itms-services://?action=download-manifest&url=$manifestUrl"
$pageUrl = "$baseUrl/"

if ($ipaExists) {
    $manifestXml = @"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>items</key>
  <array>
    <dict>
      <key>assets</key>
      <array>
        <dict>
          <key>kind</key>
          <string>software-package</string>
          <key>url</key>
          <string>$ipaUrl</string>
        </dict>
      </array>
      <key>metadata</key>
      <dict>
        <key>bundle-identifier</key>
        <string>$BundleId</string>
        <key>bundle-version</key>
        <string>$Version</string>
        <key>kind</key>
        <string>software</string>
        <key>title</key>
        <string>ProParcel</string>
      </dict>
    </dict>
  </array>
</dict>
</plist>
"@
    Set-Content -Path $manifestPath -Value $manifestXml -Encoding UTF8
}

$androidBlock = if ($apkExists) {
    @"
    <section class="platform">
      <h2>Android</h2>
      <a href="ProParcel.apk" class="download-btn android" download>APK Indir (v$Version)</a>
      <p class="link-hint">Direkt: <a href="$apkUrl">$apkUrl</a></p>
      <p class="size">Boyut: $apkMb MB</p>
    </section>
"@
} else {
    @"
    <section class="platform">
      <h2>Android</h2>
      <div class="error-box"><strong>APK henuz yok</strong><p><code>publish_mobile_release.bat</code> calistirin.</p></div>
    </section>
"@
}

$iosBlock = if ($ipaExists) {
    @"
    <section class="platform">
      <h2>iPhone / iPad</h2>
      <a href="$iosInstallUrl" class="download-btn ios">iOS Kur (v$Version)</a>
      <p class="link-hint">Ham IPA: <a href="$ipaUrl">$ipaUrl</a></p>
      <p class="link-hint">Manifest: <a href="$manifestUrl">$manifestUrl</a></p>
      <p class="size">Boyut: $ipaMb MB</p>
      <p class="note">Safari ile acin. Cihaz Apple Developer hesabinda kayitli olmali (ad-hoc / internal).</p>
    </section>
"@
} else {
    @"
    <section class="platform">
      <h2>iPhone / iPad</h2>
      <div class="error-box"><strong>IPA henuz yok</strong><p><code>eas build --platform ios --profile preview</code> sonrasi IPA buraya kopyalanir.</p></div>
    </section>
"@
}

$html = @"
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ProParcel Mobil Indir</title>
  <style>
    body { font-family: 'Segoe UI', sans-serif; background: linear-gradient(135deg, #1a1f3a, #2d3561); color: #fff; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .container { background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); border-radius: 20px; padding: 32px; max-width: 560px; width: 100%; box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
    h1 { margin: 0 0 6px; font-size: 30px; text-align: center; }
    .subtitle { color: #b8c5d1; margin: 0 0 24px; text-align: center; font-size: 15px; }
    .platform { background: rgba(0,0,0,0.2); border-radius: 14px; padding: 20px; margin-bottom: 16px; text-align: center; }
    .platform h2 { margin: 0 0 14px; font-size: 18px; color: #e2e8f0; }
    .download-btn { display: inline-block; color: #fff; padding: 14px 28px; border-radius: 999px; text-decoration: none; font-weight: 700; font-size: 16px; margin: 6px 0; }
    .download-btn.android { background: linear-gradient(135deg, #22c55e, #16a34a); }
    .download-btn.ios { background: linear-gradient(135deg, #3b82f6, #6366f1); }
    .link-hint { font-size: 12px; color: #94a3b8; word-break: break-all; margin: 6px 0; }
    .link-hint a { color: #93c5fd; }
    .size { font-size: 13px; color: #cbd5e1; margin: 4px 0; }
    .note { font-size: 12px; color: #94a3b8; margin-top: 8px; text-align: left; }
    .info { margin-top: 16px; padding: 14px; background: rgba(0,0,0,0.15); border-radius: 10px; font-size: 13px; color: #cbd5e1; }
    .warning { margin-top: 14px; padding: 12px; background: rgba(255,193,7,0.12); border-left: 4px solid #ffc107; border-radius: 8px; font-size: 12px; text-align: left; }
    .error-box { background: rgba(220,53,69,0.2); border-left: 4px solid #dc3545; padding: 12px; border-radius: 8px; text-align: left; font-size: 13px; }
    .logo { width: 72px; height: 72px; margin: 0 auto 12px; border-radius: 18px; background: linear-gradient(135deg, #667eea, #764ba2); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 28px; }
    code { background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo" aria-hidden="true">PP</div>
    <h1>ProParcel</h1>
    <p class="subtitle">Akilli Parsel Analiz ve Degerleme</p>
    $androidBlock
    $iosBlock
    <div class="info">
      <div><strong>Versiyon:</strong> $Version</div>
      <div><strong>Sunucu:</strong> <a href="$pageUrl" style="color:#93c5fd">$pageUrl</a></div>
    </div>
    <div class="warning">
      <strong>Android:</strong> Bilinmeyen kaynaklardan yuklemeye izin verin.<br>
      <strong>iOS:</strong> Safari ile kurulum; HTTPS gerekebilir (bazi iOS surumlerinde HTTP calismaz).
    </div>
  </div>
</body>
</html>
"@

$utf8Bom = New-Object System.Text.UTF8Encoding $true
[System.IO.File]::WriteAllText($htmlPath, $html, $utf8Bom)
Write-Host "HTML: $htmlPath" -ForegroundColor Green
if ($apkExists) { Write-Host "APK: $apkPath ($apkMb MB)" -ForegroundColor Green }
if ($ipaExists) { Write-Host "IPA: $ipaPath ($ipaMb MB)" -ForegroundColor Green }
if ($ipaExists) { Write-Host "Manifest: $manifestPath" -ForegroundColor Green }
