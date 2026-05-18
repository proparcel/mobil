@echo off
REM Start Metro Bundler - Clean Start (kills existing processes first)
cd /d %~dp0

echo ========================================
echo Metro Bundler - Clean Start
echo ========================================
echo.

REM ADB path
set ADB_PATH=C:\Android\Sdk\platform-tools\adb.exe

REM Setup ADB reverse port forwarding if ADB exists
if exist "%ADB_PATH%" (
    echo [1/3] Setting up ADB port forwarding...
    "%ADB_PATH%" reverse tcp:8081 tcp:8081 >nul 2>&1
    if errorlevel 1 (
        echo [WARNING] Could not setup port forwarding. Device might not be connected.
    ) else (
        echo [OK] Port forwarding configured.
    )
    echo.
)

REM Kill any existing Metro/Node processes on port 8081
echo [2/3] Checking for existing Metro bundler on port 8081...
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

REM Wait a moment for port to be released
timeout /t 2 /nobreak >nul

REM Start Metro bundler
echo [3/3] Starting Metro bundler...
echo.
echo Metro bundler will start in a new window.
echo Close this window or press Ctrl+C to stop Metro.
echo.

start "Metro Bundler" cmd /k "cd /d %~dp0 && echo Metro Bundler Starting... && npm start"

echo.
echo Metro bundler started!
echo Check the Metro window for status.
echo.
pause
