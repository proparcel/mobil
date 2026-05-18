@echo off
REM Reload React Native App on Connected Device
cd /d %~dp0

echo ========================================
echo Reload React Native App
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
echo [1/3] Checking device connection...
"%ADB_PATH%" devices | findstr "device$" >nul
if errorlevel 1 (
    echo [ERROR] No device connected!
    echo.
    echo Please connect your device via USB and enable USB debugging.
    pause
    exit /b 1
)

for /f "tokens=1" %%a in ('"%ADB_PATH%" devices ^| findstr "device$"') do (
    echo [OK] Device found: %%a
)
echo.

REM Setup port forwarding
echo [2/3] Setting up port forwarding...
"%ADB_PATH%" reverse tcp:8081 tcp:8081 >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Port forwarding setup failed, but might already exist.
) else (
    echo [OK] Port forwarding configured.
)
echo.

REM Reload app
echo [3/3] Reloading app on device...
echo.
echo Sending reload command to device...
echo (This simulates pressing 'R' twice)
echo.

REM Method 1: Send 'R' key twice (works if app is in foreground)
"%ADB_PATH%" shell input text "RR"

REM Method 2: Also try sending reload via broadcast (more reliable)
"%ADB_PATH%" shell am broadcast -a com.anonymous.frontend.RELOAD >nul 2>&1

REM Method 3: Restart the app activity
echo Trying to restart app activity...
"%ADB_PATH%" shell am force-stop com.anonymous.frontend >nul 2>&1
timeout /t 1 /nobreak >nul
"%ADB_PATH%" shell am start -n com.anonymous.frontend/.MainActivity >nul 2>&1

echo.
echo [OK] Reload commands sent!
echo.
echo If the app doesn't reload automatically:
echo   1. Shake your device to open Dev Menu
echo   2. Select "Reload" from the menu
echo   3. Or press 'R' twice in the app
echo.
echo Check Metro bundler window - it should show "Reloading connected app(s)..."
echo.
pause
