@echo off
cd /d %~dp0

REM ADB path
set ADB_PATH=C:\Android\Sdk\platform-tools\adb.exe

REM Setup ADB reverse port forwarding if ADB exists
if exist "%ADB_PATH%" (
    echo Setting up ADB port forwarding...
    "%ADB_PATH%" reverse tcp:8081 tcp:8081 >nul 2>&1
    if errorlevel 1 (
        echo [WARNING] Could not setup port forwarding. Device might not be connected.
    ) else (
        echo [OK] Port forwarding configured for Metro bundler.
    )
    echo.
)

echo Metro bundler baslatiliyor...
echo.
npm start
pause
