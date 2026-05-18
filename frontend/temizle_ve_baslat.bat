@echo off
REM Metro Cache Temizleme ve Yeniden Baslatma Scripti
REM Unmatched route sorununu cozmek icin cache'i temizler

cd /d %~dp0

echo ========================================
echo Cache Temizleniyor...
echo ========================================
echo.

REM Yarn cache temizle (opsiyonel)
REM echo [1/3] Yarn cache temizleniyor...
REM call yarn cache clean

REM Watchman cache temizle (varsa)
REM echo [1/3] Watchman cache temizleniyor...
REM call watchman watch-del-all

REM node_modules/.cache temizle
echo [1/3] node_modules/.cache temizleniyor...
if exist "node_modules\.cache" (
    rmdir /s /q "node_modules\.cache"
    echo node_modules/.cache silindi
)

REM Android build cache temizle
echo [2/3] Android build cache temizleniyor...
if exist "android\app\build" (
    rmdir /s /q "android\app\build"
    echo android/app/build silindi
)

REM Metro cache temizle
echo [3/3] Metro cache temizleniyor...
if exist ".metro-cache" (
    rmdir /s /q ".metro-cache"
    echo .metro-cache silindi
)

echo.
echo ========================================
echo Cache Temizleme Tamamlandi
echo ========================================
echo.
echo Simdi Metro bundler'i cache temizleyerek baslatiliyor...
echo.

REM Metro bundler'i cache temizleyerek baslat
call npx react-native start --reset-cache

pause
