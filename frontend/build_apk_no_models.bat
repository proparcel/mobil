@echo off
REM ProParcel - Release APK without 3D model asset packs (test / sideload)

cd /d %~dp0

if not exist "android\gradlew.bat" (
    echo HATA: android\gradlew.bat yok. Once native projeyi olusturun:
    echo   npx expo prebuild --platform android
    pause
    exit /b 1
)

if not exist "android\app\keystore.properties" (
    echo UYARI: android\app\keystore.properties yok - release DEBUG imzasi ile derlenir.
    echo.
)

echo ========================================
echo ProParcel Release APK (no models)
echo ========================================
echo.

echo [1/2] Asset pack'ler temizleniyor...
call npm run clear:android-asset-packs
if errorlevel 1 (
    echo.
    echo HATA: clear:android-asset-packs basarisiz.
    pause
    exit /b 1
)
echo.

echo [2/2] Release APK derleniyor (assembleRelease)...
cd android
call gradlew.bat assembleRelease
set GRADLE_EXIT=%errorlevel%
cd ..
if not %GRADLE_EXIT%==0 (
    echo.
    echo HATA: assembleRelease basarisiz.
    pause
    exit /b %GRADLE_EXIT%
)

set APK_PATH=android\app\build\outputs\apk\release\app-release.apk
if exist "%APK_PATH%" (
    if not exist "apk_releases" mkdir apk_releases
    copy /Y "%APK_PATH%" "apk_releases\ProParcel-no-models.apk"
    echo.
    echo ========================================
    echo APK Basariyla Olusturuldu (modeller yok)
    echo ========================================
    echo APK: %CD%\apk_releases\ProParcel-no-models.apk
    echo Ham: %CD%\%APK_PATH%
    echo.
) else (
    echo HATA: APK bulunamadi: %APK_PATH%
)

pause
