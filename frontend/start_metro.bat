@echo off
cd /d %~dp0

set ADB_PATH=C:\Android\Sdk\platform-tools\adb.exe

if exist "%ADB_PATH%" (
    echo Setting up ADB port forwarding (8082)...
    "%ADB_PATH%" reverse tcp:8082 tcp:8082 >nul 2>&1
    if errorlevel 1 (
        echo [WARNING] Could not setup port forwarding. Device might not be connected.
    ) else (
        echo [OK] Port forwarding configured for Android Metro (8082).
    )
    echo.
)

echo Android Metro bundler baslatiliyor (port 8082)...
echo.
npm run start:dev
pause
