@echo off
REM ProParcel APK Indirme Sunucusu
REM APK'yi indirmek icin HTML sayfasi ile sunucu baslatir

cd /d %~dp0

set SERVER_IP=78.189.238.18
set PORT=8002
set APK_FILE=apk_releases\ProParcel.apk
set HTML_FILE=apk_releases\index.html

REM APK releases klasorunu olustur
if not exist "apk_releases" mkdir apk_releases

REM APK dosyasi var mi kontrol et
if exist "%APK_FILE%" (
    echo APK dosyasi bulundu: %APK_FILE%
    
    REM APK boyutunu al
    for %%A in ("%APK_FILE%") do (
        set size=%%~zA
        set /a sizeMB=!size!/1024/1024
    )
    
    REM HTML sayfasi olustur
    (
        echo ^<!DOCTYPE html^>
        echo ^<html lang="tr"^>
        echo ^<head^>
        echo     ^<meta charset="UTF-8"^>
        echo     ^<meta name="viewport" content="width=device-width, initial-scale=1.0"^>
        echo     ^<title^>ProParcel APK Indir^</title^>
        echo     ^<style^>
        echo         body {
        echo             font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        echo             background: linear-gradient(135deg, #1a1f3a 0%%, #2d3561 100%%^);
        echo             color: white;
        echo             margin: 0;
        echo             padding: 0;
        echo             display: flex;
        echo             justify-content: center;
        echo             align-items: center;
        echo             min-height: 100vh;
        echo         }
        echo         .container {
        echo             background: rgba(255, 255, 255, 0.1^);
        echo             backdrop-filter: blur(10px^);
        echo             border-radius: 20px;
        echo             padding: 40px;
        echo             text-align: center;
        echo             box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3^);
        echo             max-width: 500px;
        echo             width: 90%%;
        echo         }
        echo         .logo {
        echo             font-size: 48px;
        echo             margin-bottom: 20px;
        echo         }
        echo         h1 {
        echo             margin: 0 0 10px 0;
        echo             font-size: 32px;
        echo         }
        echo         .subtitle {
        echo             color: #b8c5d1;
        echo             margin-bottom: 30px;
        echo             font-size: 16px;
        echo         }
        echo         .download-btn {
        echo             display: inline-block;
        echo             background: linear-gradient(135deg, #667eea 0%%, #764ba2 100%%^);
        echo             color: white;
        echo             padding: 15px 40px;
        echo             text-decoration: none;
        echo             border-radius: 50px;
        echo             font-size: 18px;
        echo             font-weight: bold;
        echo             transition: transform 0.2s, box-shadow 0.2s;
        echo             box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4^);
        echo             margin: 10px;
        echo         }
        echo         .download-btn:hover {
        echo             transform: translateY(-2px^);
        echo             box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6^);
        echo         }
        echo         .info {
        echo             margin-top: 30px;
        echo             padding: 20px;
        echo             background: rgba(255, 255, 255, 0.05^);
        echo             border-radius: 10px;
        echo             font-size: 14px;
        echo         }
        echo         .info-item {
        echo             margin: 10px 0;
        echo             color: #b8c5d1;
        echo         }
        echo         .warning {
        echo             margin-top: 20px;
        echo             padding: 15px;
        echo             background: rgba(255, 193, 7, 0.2^);
        echo             border-left: 4px solid #ffc107;
        echo             border-radius: 5px;
        echo             font-size: 13px;
        echo             text-align: left;
        echo         }
        echo     ^</style^>
        echo ^</head^>
        echo ^<body^>
        echo     ^<div class="container"^>
        echo         ^<div class="logo"^>📱^</div^>
        echo         ^<h1^>ProParcel^</h1^>
        echo         ^<p class="subtitle"^>Akilli Parsel Analiz ve Degerleme Sistemi^</p^>
        echo         ^<a href="ProParcel.apk" class="download-btn" download^>APK'yi Indir^</a^>
        echo         ^<div class="info"^>
        echo             ^<div class="info-item"^>^<strong^>Versiyon:^</strong^> 1.0.0^</div^>
        echo             ^<div class="info-item"^>^<strong^>Boyut:^</strong^> !sizeMB! MB^</div^>
        echo             ^<div class="info-item"^>^<strong^>Platform:^</strong^> Android^</div^>
        echo         ^</div^>
        echo         ^<div class="warning"^>
        echo             ^<strong^>⚠ Dikkat:^</strong^> Android ayarlarindan "Bilinmeyen kaynaklardan yukleme" secenegini aktif etmeniz gerekebilir.
        echo         ^</div^>
        echo     ^</div^>
        echo ^</body^>
        echo ^</html^>
    ) > "%HTML_FILE%"
    
    echo HTML sayfasi olusturuldu: %HTML_FILE%
    
) else (
    echo.
    echo UYARI: APK dosyasi bulunamadi!
    echo Lutfen once 'build_apk.bat' scriptini calistirarak APK'yi olusturun.
    echo.
    
    REM APK yoksa uyari HTML sayfasi olustur
    (
        echo ^<!DOCTYPE html^>
        echo ^<html lang="tr"^>
        echo ^<head^>
        echo     ^<meta charset="UTF-8"^>
        echo     ^<title^>ProParcel APK - Bulunamadi^</title^>
        echo     ^<style^>
        echo         body {
        echo             font-family: Arial, sans-serif;
        echo             background: #1a1f3a;
        echo             color: white;
        echo             display: flex;
        echo             justify-content: center;
        echo             align-items: center;
        echo             min-height: 100vh;
        echo             margin: 0;
        echo         }
        echo         .container {
        echo             text-align: center;
        echo             padding: 40px;
        echo         }
        echo     ^</style^>
        echo ^</head^>
        echo ^<body^>
        echo     ^<div class="container"^>
        echo         ^<h1^>APK Bulunamadi^</h1^>
        echo         ^<p^>Lutfen once 'build_apk.bat' scriptini calistirarak APK'yi olusturun.^</p^>
        echo     ^</div^>
        echo ^</body^>
        echo ^</html^>
    ) > "%HTML_FILE%"
    
    pause
    exit /b 1
)

REM Python HTTP sunucusu baslat
echo.
echo ========================================
echo APK Indirme Sunucusu Baslatiliyor
echo ========================================
echo.
echo Sunucu IP: %SERVER_IP%
echo Port: %PORT%
echo.
echo Indirme Linkleri:
echo - Tarayici: http://%SERVER_IP%:%PORT%
echo - Direkt APK: http://%SERVER_IP%:%PORT%/ProParcel.apk
echo - Django APK Sayfasi: http://%SERVER_IP%:8000/apk/
echo.
echo NOT: Yeni APK build ettikten sonra HTML guncellemek icin
echo      sunucuyu yeniden baslatmaniz onerilir (gerekli degil - APK dosyasi otomatik guncellenir)
echo.
echo Durdurmak icin CTRL+C basin
echo.
echo ========================================
echo.

REM APK releases klasorune git ve sunucu baslat
cd apk_releases
python -m http.server %PORT%

pause
