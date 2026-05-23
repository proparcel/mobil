@echo off
REM ProParcel - Google Play AAB without 3D model asset packs (smaller first release)

cd /d %~dp0

if not exist "android\gradlew.bat" (
    echo HATA: android\gradlew.bat yok. Once native projeyi olusturun:
    echo   npx expo prebuild --platform android
    echo veya gelistirme makinenizdeki tam android\ klasorunu kopyalayin.
    pause
    exit /b 1
)

if not exist "android\app\keystore.properties" (
    echo UYARI: android\app\keystore.properties yok - release DEBUG imzasi ile derlenir.
    echo Google Play icin: keystore.properties.example -^> keystore.properties
    echo.
)

echo ========================================
echo ProParcel Google Play AAB (no models)
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

echo [2/2] AAB derleniyor (bundleRelease)...
cd android
call gradlew.bat bundleRelease
set GRADLE_EXIT=%errorlevel%
cd ..
if not %GRADLE_EXIT%==0 (
    echo.
    echo HATA: bundleRelease basarisiz.
    pause
    exit /b %GRADLE_EXIT%
)

set AAB_PATH=android\app\build\outputs\bundle\release\app-release.aab
if exist "%AAB_PATH%" (
    if not exist "release_builds" mkdir release_builds
    set TIMESTAMP=%date:~-4%%date:~3,2%%date:~0,2%-%time:~0,2%%time:~3,2%%time:~6,2%
    set TIMESTAMP=%TIMESTAMP: =0%
    copy /Y "%AAB_PATH%" "release_builds\ProParcel-1.0.1-no-models-%TIMESTAMP%.aab" >nul
    echo.
    echo ========================================
    echo AAB Basariyla Olusturuldu (modeller yok)
    echo ========================================
    echo AAB: %CD%\release_builds\ProParcel-1.0.1-no-models-%TIMESTAMP%.aab
    echo Ham: %CD%\%AAB_PATH%
    echo.
    echo Google Play Console -^> Release -^> App bundle alanina yukleyin.
    echo.
) else (
    echo AAB dosyasi beklenen konumda bulunamadi: %AAB_PATH%
)

pause
