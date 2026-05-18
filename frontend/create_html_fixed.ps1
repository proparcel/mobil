# HTML sayfası oluşturma script'i - Türkçe karakter düzeltmeli
param(
    [string]$ApkExists = "0"
)

# String'i boolean'a çevir
$ApkExistsBool = ($ApkExists -eq "1" -or $ApkExists -eq "true" -or $ApkExists -eq "True")

# HTML içeriğini oluştur
$htmlContent = @'
<!DOCTYPE html>
<html>
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <title>ProParcel APK İndirme</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #1a1f3a; color: white; }
        .container { max-width: 500px; margin: 0 auto; background: #2a3f5f; padding: 30px; border-radius: 10px; }
        h1 { color: #4a9eff; }
        .download-btn { display: inline-block; padding: 15px 30px; background: #4a9eff; color: white; text-decoration: none; border-radius: 5px; font-size: 18px; margin: 20px 0; }
        .download-btn:hover { background: #3a8eef; }
        .download-btn.disabled { background: #666; cursor: not-allowed; }
        .download-btn.disabled:hover { background: #555; }
        .info { margin: 20px 0; color: #ccc; }
        .warning { margin: 20px 0; color: #ffaa00; background: #3a2f1a; padding: 15px; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>ProParcel APK</h1>
'@

if ($ApkExistsBool) {
    $htmlContent += @'
        <p class="info">Mobil uygulamayı indirmek için aşağıdaki butona tıklayın</p>
        <a href="ProParcel.apk" class="download-btn" download>APK'yı İndir</a>
        <p class="info">Dosya boyutu: ~163 MB</p>
        <p class="info">Android 7.0 ve üzeri gereklidir</p>
'@
} else {
    $htmlContent += @'
        <div class="warning">
            <strong>APK Dosyası Bulunamadı</strong><br>
            APK dosyası henüz build edilmemiş veya silinmiş.<br>
            Lütfen önce APK build edin: build_apk_proparcel_simple.bat
        </div>
        <a href="#" class="download-btn disabled" onclick="return false;">APK'yı İndir (Mevcut Değil)</a>
        <p class="info">Android 7.0 ve üzeri gereklidir</p>
'@
}

$htmlContent += @'
    </div>
</body>
</html>
'@

# UTF-8 BOM'suz olarak kaydet
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$filePath = Join-Path $scriptDir "apk_releases\index.html"
$dirPath = Split-Path $filePath -Parent
if (-not (Test-Path $dirPath)) {
    New-Item -ItemType Directory -Path $dirPath -Force | Out-Null
}

# UTF-8 encoding ile kaydet (BOM'suz)
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
$bytes = $utf8NoBom.GetBytes($htmlContent)
[System.IO.File]::WriteAllBytes($filePath, $bytes)
