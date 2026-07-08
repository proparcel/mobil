@echo off
REM Fiziksel Cihazda Build ve Çalıştırma Scripti
cd /d %~dp0

echo ========================================
echo Fiziksel Cihazda Build
echo ========================================
echo.

REM ADB path
set ADB_PATH=C:\Android\Sdk\platform-tools\adb.exe

REM Check if ADB exists
if not exist "%ADB_PATH%" (
    echo [ERROR] ADB not found at: %ADB_PATH%
    echo.
    echo Please install Android SDK Platform Tools or update ADB_PATH in this script.
    pause
    exit /b 1
)

REM Check device connection
echo [1/4] Checking device connection...
"%ADB_PATH%" devices | findstr "device$" >nul
if errorlevel 1 (
    echo [ERROR] No device connected!
    echo.
    echo Please:
    echo   1. Enable USB Debugging on your device
    echo   2. Connect device via USB
    echo   3. Allow USB debugging on device
    echo.
    echo Checking devices...
    "%ADB_PATH%" devices
    pause
    exit /b 1
)

for /f "tokens=1" %%a in ('"%ADB_PATH%" devices ^| findstr "device$"') do (
    echo [OK] Device found: %%a
)
echo.

REM Setup port forwarding
echo [2/4] Setting up port forwarding for Metro bundler (8082)...
"%ADB_PATH%" reverse tcp:8082 tcp:8082 >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Port forwarding setup failed, but might already exist.
) else (
    echo [OK] Port forwarding configured (8082 -^> 8082).
)
echo.

echo [3/4] Checking Metro bundler (8082)...
netstat -an | findstr ":8082" >nul
if errorlevel 1 (
    echo [INFO] Metro kapali — android:dev otomatik acacak.
) else (
    echo [OK] Metro zaten calisiyor (8082).
)
echo.

echo [4/4] Build + kurulum (Metro aciksa sadece build)...
echo.
npm run start:android_metro

if errorlevel 1 (
    echo.
    echo [ERROR] Build failed!
    echo.
    echo Troubleshooting:
    echo   1. Check if device is still connected: adb devices
    echo   2. Try restarting ADB: adb kill-server ^&^& adb start-server
    echo   3. Check Metro bundler is running: npm start
    echo   4. See ANDROID_CIHAZ_COZUM.md for more help
    pause
    exit /b 1
)

echo.
echo [SUCCESS] App installed and started on device!
echo.
echo Tips:
echo   - Shake device to open Dev Menu
echo   - Press 'R' twice to reload
echo   - Check Metro bundler window for logs
echo.
pause
