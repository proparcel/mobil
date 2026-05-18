@echo off
REM ProParcel - Google Play AAB (App Bundle) build
REM Asset pack'ler build oncesi uretilir; modeller AAB icine pack olarak gider.

cd /d %~dp0

echo ========================================
echo ProParcel Google Play AAB Build
echo ========================================
echo.

REM 1) Istege bagli: Backend'den guncel model listesi (models_manifest.json)
echo [1/3] Model manifest guncelleniyor (istege bagli)...
call npm run gen:model-packs-manifest 2>nul
if errorlevel 1 (
    echo Uyari: gen:model-packs-manifest atlandi veya hata verdi. Mevcut manifest kullanilacak.
)
echo.

REM 2) Zorunlu: Asset pack'lere .glb dosyalarini yaz (veya backend'den indir)
echo [2/3] Asset pack'ler dolduruluyor (gen:android-asset-packs)...
call npm run gen:android-asset-packs
if errorlevel 1 (
    echo.
    echo HATA: gen:android-asset-packs basarisiz. AAB'de model pack'leri bos olur.
    echo assets\packs\models_manifest.json ve ag baglantisini kontrol edin.
    pause
    exit /b 1
)
echo.

REM 3) AAB derle
echo [3/3] AAB derleniyor (bundleRelease)...
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
    set TIMESTAMP=%date:~-4%%date:~3,2%%date:~0,2%-%time:~0,2%%time:~3,2%%time:~6,2%
    set TIMESTAMP=%TIMESTAMP: =0%
    copy /Y "%AAB_PATH%" "release_builds\ProParcel-1.0.0-%TIMESTAMP%.aab" >nul
    echo.
    echo ========================================
    echo AAB Basariyla Olusturuldu!
    echo ========================================
    echo AAB: %CD%\release_builds\ProParcel-1.0.0-%TIMESTAMP%.aab
    echo Ham: %CD%\%AAB_PATH%
    echo.
) else (
    echo AAB dosyasi beklenen konumda bulunamadi: %AAB_PATH%
)

pause
