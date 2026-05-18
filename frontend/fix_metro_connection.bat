@echo off
REM Metro Bundler Connection Fix Script (Batch Version)
REM This script fixes the "Unable to load script" error

echo ========================================
echo Metro Bundler Connection Fix
echo ========================================
echo.

cd /d %~dp0

REM ADB path
set ADB_PATH=C:\Android\Sdk\platform-tools\adb.exe

REM Check if ADB exists
if not exist "%ADB_PATH%" (
    echo [ERROR] ADB not found at: %ADB_PATH%
    echo.
    echo Please install Android SDK Platform-tools or update the ADB path in this script.
    echo.
    echo Alternative ADB locations to check:
    echo   - C:\Users\%USERNAME%\AppData\Local\Android\Sdk\platform-tools\adb.exe
    echo   - C:\Program Files\Unity\Hub\Editor\*\Editor\Data\PlaybackEngines\AndroidPlayer\SDK\platform-tools\adb.exe
    echo.
    pause
    exit /b 1
)

echo [OK] ADB found: %ADB_PATH%
echo.

REM Step 1: Check device connection
echo [1/4] Checking device connection...
"%ADB_PATH%" devices
if errorlevel 1 (
    echo [ERROR] Failed to check devices!
    echo.
    echo Troubleshooting steps:
    echo   1. Make sure your device is connected via USB
    echo   2. Enable USB Debugging on your device
    echo   3. Try: adb kill-server ^&^& adb start-server
    echo.
    pause
    exit /b 1
)
echo.

REM Step 2: Setup ADB reverse port forwarding
echo [2/4] Setting up ADB reverse port forwarding (8081)...
"%ADB_PATH%" reverse tcp:8081 tcp:8081
if errorlevel 1 (
    echo [WARNING] Port forwarding setup failed, but this might be okay if it already exists.
) else (
    echo [OK] Port forwarding configured: localhost:8081 -^> device:8081
)
echo.

REM Step 3: Check if Metro is running (simple check)
echo [3/4] Checking if Metro bundler is running...
netstat -an | findstr ":8081" >nul
if errorlevel 1 (
    echo [INFO] Metro bundler is NOT running on port 8081
    set METRO_RUNNING=0
) else (
    echo [OK] Metro bundler appears to be running on port 8081
    set METRO_RUNNING=1
)
echo.

REM Step 4: Start Metro if not running
if %METRO_RUNNING%==0 (
    echo [4/4] Starting Metro bundler...
    echo.
    echo Starting Metro bundler in a new window...
    echo You can also start it manually with: npm start
    echo.
    
    start "Metro Bundler" cmd /k "cd /d %~dp0 && echo Metro Bundler Starting... && npm start"
    
    echo [INFO] Waiting 5 seconds for Metro to start...
    timeout /t 5 /nobreak >nul
    echo.
) else (
    echo [4/4] Metro bundler is already running. Skipping start.
)
echo.

REM Summary
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Next steps:
echo   1. Make sure Metro bundler is running (check the Metro window)
echo   2. On your device, shake it or press 'R' twice to reload the app
echo   3. If still not working, try:
echo      - Close and reopen the app on your device
echo      - Run: adb reverse tcp:8081 tcp:8081
echo.
echo For Wi-Fi connection (if USB doesn't work):
echo   1. Find your computer's IP address: ipconfig ^| findstr IPv4
echo   2. Make sure your device and computer are on the same Wi-Fi network
echo   3. In Metro bundler window, press 'd' to open Dev Menu
echo   4. Select 'Settings' -^> 'Debug server host ^& port for device'
echo   5. Enter: YOUR_IP:8081 (e.g., 192.168.1.100:8081)
echo.
echo Troubleshooting commands:
echo   - Check devices: adb devices
echo   - Check port forwarding: adb reverse --list
echo   - Restart ADB: adb kill-server ^&^& adb start-server
echo   - Clear Metro cache: npm start -- --reset-cache
echo.

pause
