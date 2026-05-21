@echo off
setlocal EnableDelayedExpansion
REM ProParcel: Release APK build + indirme sayfasi (176.238.6.240)
cd /d %~dp0

set PUBLIC_IP=176.238.6.240
set DOWNLOAD_PORT=8002
set APP_VERSION=1.0.0

echo ========================================
echo ProParcel APK Yayin (Build + HTML)
echo ========================================
echo IP: %PUBLIC_IP%:%DOWNLOAD_PORT%
echo.

echo [1/3] Release APK build (birkaç dakika surebilir)...
cd android
call gradlew.bat assembleRelease
if errorlevel 1 (
    echo.
    echo HATA: Gradle build basarisiz.
    cd ..
    pause
    exit /b 1
)
cd ..

set APK_PATH=android\app\build\outputs\apk\release\app-release.apk
if not exist "%APK_PATH%" (
    echo HATA: APK bulunamadi: %APK_PATH%
    pause
    exit /b 1
)

if not exist "apk_releases" mkdir apk_releases
copy /Y "%APK_PATH%" "apk_releases\ProParcel.apk"
echo [2/3] APK kopyalandi: apk_releases\ProParcel.apk

echo [3/3] Indirme sayfasi olusturuluyor...
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\generate_apk_download_page.ps1" -PublicIp %PUBLIC_IP% -Port %DOWNLOAD_PORT% -Version %APP_VERSION%

echo.
echo ========================================
echo Yayin hazir
echo ========================================
echo.
echo 1. Indirme sunucusunu baslatin:
echo    baslat_apk_indirme.bat
echo.
echo 2. Telefondan acin:
echo    http://%PUBLIC_IP%:%DOWNLOAD_PORT%/
echo.
echo 3. Router: TCP %DOWNLOAD_PORT% -^> bu PC (port forwarding)
echo 4. Firewall: ekle_firewall_apk.ps1 (Yonetici)
echo.
pause
