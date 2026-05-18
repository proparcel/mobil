@echo off
REM Restart Metro with Path Alias Support
REM This clears cache and restarts Metro after configuring path aliases
cd /d %~dp0

echo ========================================
echo Restarting Metro with Path Alias Support
echo ========================================
echo.

REM Kill any existing Metro processes on port 8081
echo [1/3] Stopping existing Metro bundler...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8081 ^| findstr LISTENING') do (
    echo Found process %%a using port 8081, killing it...
    taskkill /F /PID %%a >nul 2>&1
    if errorlevel 1 (
        echo [WARNING] Could not kill process %%a
    ) else (
        echo [OK] Process %%a terminated.
    )
)
echo.

REM Clear Metro cache
echo [2/3] Clearing Metro cache...
if exist ".metro-cache" (
    rmdir /s /q ".metro-cache"
    echo [OK] Metro cache cleared.
) else (
    echo [INFO] No Metro cache found.
)
echo.

REM Setup ADB port forwarding
echo [3/3] Setting up ADB port forwarding...
set ADB_PATH=C:\Android\Sdk\platform-tools\adb.exe
if exist "%ADB_PATH%" (
    "%ADB_PATH%" reverse tcp:8081 tcp:8081 >nul 2>&1
    echo [OK] Port forwarding configured.
) else (
    echo [WARNING] ADB not found, skipping port forwarding.
)
echo.

REM Start Metro with cache reset
echo Starting Metro bundler with cache reset...
echo.
echo Metro will start in a new window.
echo Close this window or press Ctrl+C to stop Metro.
echo.

start "Metro Bundler" cmd /k "cd /d %~dp0 && echo Metro Bundler Starting with Path Alias Support... && npm start -- --reset-cache"

echo.
echo Metro bundler started!
echo.
echo Path alias '@' is now configured to point to the root directory.
echo Example: @/src/maps/models/ModelManager -> ./src/maps/models/ModelManager
echo.
pause
