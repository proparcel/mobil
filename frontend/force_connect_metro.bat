@echo off
REM Force React Native App to Connect to Metro Bundler
cd /d %~dp0

echo ========================================
echo Force Metro Connection
echo ========================================
echo.

REM ADB path
set ADB_PATH=C:\Android\Sdk\platform-tools\adb.exe

if not exist "%ADB_PATH%" (
    echo [ERROR] ADB not found at: %ADB_PATH%
    pause
    exit /b 1
)

REM Check device connection
echo [1/5] Checking device connection...
"%ADB_PATH%" devices | findstr "device$" >nul
if errorlevel 1 (
    echo [ERROR] No device connected!
    pause
    exit /b 1
)

for /f "tokens=1" %%a in ('"%ADB_PATH%" devices ^| findstr "device$"') do (
    echo [OK] Device found: %%a
)
echo.

REM Setup port forwarding
echo [2/5] Setting up port forwarding...
"%ADB_PATH%" reverse --remove-all >nul 2>&1
timeout /t 1 /nobreak >nul
"%ADB_PATH%" reverse tcp:8081 tcp:8081
if errorlevel 1 (
    echo [WARNING] Port forwarding setup failed.
) else (
    echo [OK] Port forwarding configured.
)
echo.

REM Check if app is installed
echo [3/5] Checking if app is installed...
"%ADB_PATH%" shell pm list packages | findstr "frontend" >nul
if errorlevel 1 (
    echo [WARNING] App might not be installed. Continuing anyway...
) else (
    echo [OK] App is installed.
)
echo.

REM Stop the app completely
echo [4/5] Stopping app completely...
"%ADB_PATH%" shell am force-stop com.anonymous.frontend
timeout /t 2 /nobreak >nul
echo [OK] App stopped.
echo.

REM Clear app data (optional, helps with connection issues)
echo [INFO] Clearing app cache (optional, helps with connection)...
"%ADB_PATH%" shell pm clear com.anonymous.frontend >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Could not clear app data (might need user permission).
) else (
    echo [OK] App cache cleared.
)
echo.

REM Start the app
echo [5/5] Starting app...
"%ADB_PATH%" shell am start -n com.anonymous.frontend/.MainActivity
if errorlevel 1 (
    echo [ERROR] Failed to start app!
    pause
    exit /b 1
)
echo [OK] App started.
echo.

REM Wait a moment for app to initialize
echo [INFO] Waiting for app to initialize...
timeout /t 3 /nobreak >nul

REM Try to send reload command
echo [INFO] Sending reload command...
"%ADB_PATH%" shell input text "RR"
timeout /t 1 /nobreak >nul

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo The app should now connect to Metro bundler.
echo.
echo Check Metro bundler window - you should see:
echo   "Reloading connected app(s)..."
echo.
echo If still not connected:
echo   1. Shake device to open Dev Menu
echo   2. Select "Settings"
echo   3. Select "Debug server host ^& port for device"
echo   4. Enter: localhost:8081
echo   5. Go back and select "Reload"
echo.
pause
