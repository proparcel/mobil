@echo off
REM ProParcel - Google Play AAB (App Bundle) build
REM Asset pack'ler build oncesi uretilir; modeller AAB icine pack olarak gider.

cd /d %~dp0

echo ========================================
echo ProParcel Google Play AAB Build
echo ========================================
echo.

REM 1) Mapbox download token tek kaynaktan android/gradle.properties'e yazilir
echo [1/5] Mapbox token senkronize ediliyor...
node .\scripts\sync-android-mapbox-token.js --strict
if errorlevel 1 (
    echo HATA: Mapbox download token eksik. Detay: doc\MAPBOX_TOKEN_ARCHITECTURE.md
    pause
    exit /b 1
)
echo.

REM 2) Backend'den guncel model listesi
echo [2/5] Model manifest guncelleniyor...
call npm run gen:model-packs-manifest
if errorlevel 1 (
    echo HATA: gen:model-packs-manifest basarisiz.
    pause
    exit /b 1
)
echo.

REM 3) Eski pack'leri sil, sunucudan .glb indir
echo [3/5] Asset pack'ler yenileniyor (refresh:android-asset-packs)...
call npm run refresh:android-asset-packs
if errorlevel 1 (
    echo.
    echo HATA: gen:android-asset-packs basarisiz. AAB'de model pack'leri bos olur.
    echo assets\packs\models_manifest.json ve ag baglantisini kontrol edin.
    pause
    exit /b 1
)
echo.

REM 4) AAB derle
echo [4/5] AAB derleniyor (bundleRelease)...
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

REM Cikti
set AAB_PATH=android\app\build\outputs\bundle\release\app-release.aab
if exist "%AAB_PATH%" (
    if not exist "release_builds" mkdir release_builds
    for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set TIMESTAMP=%%i
    copy /Y "%AAB_PATH%" "release_builds\ProParcel-com-proparcel-mobile-with-models-%TIMESTAMP%.aab" >nul
    echo AAB: %CD%\release_builds\ProParcel-com-proparcel-mobile-with-models-%TIMESTAMP%.aab
    echo Ham: %CD%\%AAB_PATH%
    echo.
) else (
    echo AAB dosyasi beklenen konumda bulunamadi: %AAB_PATH%
)

pause
