@echo off
setlocal EnableDelayedExpansion
REM ProParcel: Android APK + iOS IPA hazirlik + indirme HTML (176.238.6.240)
cd /d %~dp0

set PUBLIC_IP=176.238.6.240
set DOWNLOAD_PORT=8002
set APP_VERSION=1.0.0

if not exist "app_releases" mkdir app_releases

echo ========================================
echo ProParcel Mobil Yayin
echo ========================================
echo.

REM --- Android: mevcut release APK (pp-adb-build veya android\...)
set APK_SRC=
if exist "C:\Temp\pp-adb-build\android\app\build\outputs\apk\release\app-release.apk" (
    set APK_SRC=C:\Temp\pp-adb-build\android\app\build\outputs\apk\release\app-release.apk
)
if not defined APK_SRC if exist "android\app\build\outputs\apk\release\app-release.apk" (
    set APK_SRC=android\app\build\outputs\apk\release\app-release.apk
)
if defined APK_SRC (
    copy /Y "%APK_SRC%" "app_releases\ProParcel.apk"
    echo [OK] APK: app_releases\ProParcel.apk
) else (
    echo [UYARI] APK bulunamadi. Once release build yapin.
)

REM --- iOS: EAS preview IPA (cloud build, birkac dakika)
echo.
echo [iOS] EAS build baslatiliyor (preview / internal)...
call npm run clean:eas-upload
set EAS_NO_VCS=1
call npx eas build --platform ios --profile preview --non-interactive
if errorlevel 1 (
    echo [UYARI] EAS iOS build basarisiz veya iptal. IPA elle app_releases\ProParcel.ipa koyun.
    goto html
)

echo.
echo [iOS] Son basarili build IPA indiriliyor...
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\download_latest_ios_ipa.ps1" -Profile preview
if not exist "app_releases\ProParcel.ipa" (
    echo [UYARI] IPA indirilemedi. EAS panelden indirip app_releases\ProParcel.ipa olarak kaydedin.
) else (
    echo [OK] IPA: app_releases\ProParcel.ipa
)

:html
echo.
echo [HTML] Indirme sayfasi...
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\generate_mobile_download_page.ps1" -PublicIp %PUBLIC_IP% -Port %DOWNLOAD_PORT% -Version %APP_VERSION%

echo.
echo ========================================
echo Hazir
echo ========================================
echo Sunucu: baslat_app_indirme.bat
echo Sayfa:  http://%PUBLIC_IP%:%DOWNLOAD_PORT%/
echo.
pause
