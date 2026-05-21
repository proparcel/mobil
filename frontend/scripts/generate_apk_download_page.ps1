# ProParcel APK indirme HTML sayfasi (apk_releases/index.html)
param(
    [string]$PublicIp = "176.238.6.240",
    [int]$Port = 8002,
    [string]$Version = "1.0.0"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$releases = Join-Path $root "apk_releases"
$apkPath = Join-Path $releases "ProParcel.apk"
$htmlPath = Join-Path $releases "index.html"

if (-not (Test-Path $releases)) {
    New-Item -ItemType Directory -Path $releases | Out-Null
}

$apkExists = Test-Path $apkPath
$sizeMb = 0
if ($apkExists) {
    $sizeMb = [math]::Round((Get-Item $apkPath).Length / 1MB, 2)
}

$downloadUrl = "http://${PublicIp}:${Port}/ProParcel.apk"
$pageUrl = "http://${PublicIp}:${Port}/"
$djangoUrl = "http://${PublicIp}:8000/apk/"

$apkButton = if ($apkExists) {
    @"
        <a href="ProParcel.apk" class="download-btn" download>APK'yi Indir (v$Version)</a>
        <p class="link-hint">Direkt link: <a href="$downloadUrl">$downloadUrl</a></p>
"@
} else {
    @"
        <div class="error-box">
            <strong>APK henuz yok</strong>
            <p>Once <code>publish_apk_release.bat</code> veya <code>build_apk.bat</code> calistirin.</p>
        </div>
"@
}

$html = @"
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ProParcel APK Indir</title>
  <style>
    body { font-family: 'Segoe UI', sans-serif; background: linear-gradient(135deg, #1a1f3a, #2d3561); color: #fff; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .container { background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); border-radius: 20px; padding: 40px; max-width: 520px; width: 100%; text-align: center; box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
    h1 { margin: 0 0 8px; font-size: 32px; }
    .subtitle { color: #b8c5d1; margin-bottom: 24px; }
    .download-btn { display: inline-block; background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; padding: 16px 36px; border-radius: 999px; text-decoration: none; font-weight: 700; font-size: 18px; margin: 8px 0; }
    .info { margin-top: 24px; text-align: left; background: rgba(0,0,0,0.2); padding: 16px; border-radius: 12px; font-size: 14px; color: #cbd5e1; }
    .info div { margin: 8px 0; }
    .warning { margin-top: 20px; padding: 14px; background: rgba(255,193,7,0.15); border-left: 4px solid #ffc107; border-radius: 8px; text-align: left; font-size: 13px; }
    .error-box { background: rgba(220,53,69,0.2); border-left: 4px solid #dc3545; padding: 16px; border-radius: 8px; text-align: left; }
    .link-hint { font-size: 12px; color: #94a3b8; word-break: break-all; }
    .link-hint a { color: #93c5fd; }
    code { background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div style="font-size:48px">📱</div>
    <h1>ProParcel</h1>
    <p class="subtitle">Akilli Parsel Analiz ve Degerleme — Son surum</p>
    $apkButton
    <div class="info">
      <div><strong>Versiyon:</strong> $Version</div>
      <div><strong>Boyut:</strong> $(if ($apkExists) { "$sizeMb MB" } else { "-" })</div>
      <div><strong>Indirme sayfasi:</strong> <a href="$pageUrl" style="color:#93c5fd">$pageUrl</a></div>
      <div><strong>Django:</strong> <a href="$djangoUrl" style="color:#93c5fd">$djangoUrl</a></div>
    </div>
    <div class="warning">
      <strong>Kurulum:</strong> Ayarlar → Guvenlik → Bilinmeyen uygulamalara izin verin, sonra APK'yi acin.
      Eski surum yukluysa once kaldirin veya uzerine yukleyin.
    </div>
  </div>
</body>
</html>
"@

Set-Content -Path $htmlPath -Value $html -Encoding UTF8
Write-Host "HTML: $htmlPath" -ForegroundColor Green
if ($apkExists) { Write-Host "APK: $apkPath ($sizeMb MB)" -ForegroundColor Green }
