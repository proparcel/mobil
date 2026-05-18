# HTML sayfası oluşturma script'i
param(
    [string]$ApkExists = "0"
)

# String'i boolean'a çevir
$ApkExistsBool = ($ApkExists -eq "1" -or $ApkExists -eq "true" -or $ApkExists -eq "True")

# HTML içeriğini satır satır oluştur (Türkçe karakterler için)
$htmlLines = @()
$htmlLines += "<!DOCTYPE html>"
$htmlLines += "<html>"
$htmlLines += "<head>"
$htmlLines += "    <title>ProParcel APK İndirme</title>"
$htmlLines += "    <meta charset=`"UTF-8`">"
$htmlLines += "    <meta name=`"viewport`" content=`"width=device-width, initial-scale=1.0`">"
$htmlLines += "    <style>"
$htmlLines += "        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #1a1f3a; color: white; }"
$htmlLines += "        .container { max-width: 500px; margin: 0 auto; background: #2a3f5f; padding: 30px; border-radius: 10px; }"
$htmlLines += "        h1 { color: #4a9eff; }"
$htmlLines += "        .download-btn { display: inline-block; padding: 15px 30px; background: #4a9eff; color: white; text-decoration: none; border-radius: 5px; font-size: 18px; margin: 20px 0; }"
$htmlLines += "        .download-btn:hover { background: #3a8eef; }"
$htmlLines += "        .download-btn.disabled { background: #666; cursor: not-allowed; }"
$htmlLines += "        .download-btn.disabled:hover { background: #555; }"
$htmlLines += "        .info { margin: 20px 0; color: #ccc; }"
$htmlLines += "        .warning { margin: 20px 0; color: #ffaa00; background: #3a2f1a; padding: 15px; border-radius: 5px; }"
$htmlLines += "    </style>"
$htmlLines += "</head>"
$htmlLines += "<body>"
$htmlLines += "    <div class=`"container`">"
$htmlLines += "        <h1>ProParcel APK</h1>"

if ($ApkExistsBool) {
    $htmlLines += "        <p class=`"info`">Mobil uygulamayı indirmek için aşağıdaki butona tıklayın</p>"
    $htmlLines += "        <a href=`"ProParcel.apk`" class=`"download-btn`" download>APK'yı İndir</a>"
    $htmlLines += "        <p class=`"info`">Dosya boyutu: ~163 MB</p>"
    $htmlLines += "        <p class=`"info`">Android 7.0 ve üzeri gereklidir</p>"
} else {
    $htmlLines += "        <div class=`"warning`">"
    $htmlLines += "            <strong>APK Dosyası Bulunamadı</strong><br>"
    $htmlLines += "            APK dosyası henüz build edilmemiş veya silinmiş.<br>"
    $htmlLines += "            Lütfen önce APK build edin: build_apk_proparcel_simple.bat"
    $htmlLines += "        </div>"
    $htmlLines += "        <a href=`"#`" class=`"download-btn disabled`" onclick=`"return false;`">APK'yı İndir (Mevcut Değil)</a>"
    $htmlLines += "        <p class=`"info`">Android 7.0 ve üzeri gereklidir</p>"
}

$htmlLines += "    </div>"
$htmlLines += "</body>"
$htmlLines += "</html>"

# UTF-8 BOM'suz olarak kaydet (Türkçe karakterler için)
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$filePath = Join-Path $scriptDir "apk_releases\index.html"
$dirPath = Split-Path $filePath -Parent
if (-not (Test-Path $dirPath)) {
    New-Item -ItemType Directory -Path $dirPath -Force | Out-Null
}

# Satırları birleştir ve UTF-8 BOM'suz kaydet
$htmlContent = $htmlLines -join "`r`n"
[System.IO.File]::WriteAllText($filePath, $htmlContent, $utf8NoBom)
