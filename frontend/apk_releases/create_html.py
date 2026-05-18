#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HTML sayfası oluşturma script'i - Türkçe karakter desteği ile
"""
import sys
import os

def create_html(apk_exists=True):
    """HTML sayfasını oluşturur"""
    
    html_template = """<!DOCTYPE html>
<html>
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <title>ProParcel APK İndirme</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {{ font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #1a1f3a; color: white; }}
        .container {{ max-width: 500px; margin: 0 auto; background: #2a3f5f; padding: 30px; border-radius: 10px; }}
        h1 {{ color: #4a9eff; }}
        .download-btn {{ display: inline-block; padding: 15px 30px; background: #4a9eff; color: white; text-decoration: none; border-radius: 5px; font-size: 18px; margin: 20px 0; }}
        .download-btn:hover {{ background: #3a8eef; }}
        .download-btn.disabled {{ background: #666; cursor: not-allowed; }}
        .download-btn.disabled:hover {{ background: #555; }}
        .info {{ margin: 20px 0; color: #ccc; }}
        .warning {{ margin: 20px 0; color: #ffaa00; background: #3a2f1a; padding: 15px; border-radius: 5px; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>ProParcel APK</h1>
{content}
    </div>
</body>
</html>"""
    
    if apk_exists:
        content = """        <p class="info">Mobil uygulamayı indirmek için aşağıdaki butona tıklayın</p>
        <a href="ProParcel.apk" class="download-btn" download>APK'yı İndir</a>
        <p class="info">Dosya boyutu: ~163 MB</p>
        <p class="info">Android 7.0 ve üzeri gereklidir</p>"""
    else:
        content = """        <div class="warning">
            <strong>APK Dosyası Bulunamadı</strong><br>
            APK dosyası henüz build edilmemiş veya silinmiş.<br>
            Lütfen önce APK build edin: build_apk_proparcel_simple.bat
        </div>
        <a href="#" class="download-btn disabled" onclick="return false;">APK'yı İndir (Mevcut Değil)</a>
        <p class="info">Android 7.0 ve üzeri gereklidir</p>"""
    
    html_content = html_template.format(content=content)
    
    # UTF-8 BOM'suz olarak binary modda kaydet
    file_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "index.html")
    with open(file_path, 'wb') as f:
        f.write(html_content.encode('utf-8'))
    
    print(f"HTML dosyası oluşturuldu: {file_path}")

if __name__ == "__main__":
    apk_exists = len(sys.argv) > 1 and sys.argv[1] == "1"
    create_html(apk_exists)
