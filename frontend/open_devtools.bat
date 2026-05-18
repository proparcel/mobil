@echo off
REM Open React Native DevTools in Browser
cd /d %~dp0

echo ========================================
echo Opening React Native DevTools
echo ========================================
echo.

REM Check if Metro is running
netstat -ano | findstr :8081 | findstr LISTENING >nul
if errorlevel 1 (
    echo [ERROR] Metro bundler is not running on port 8081!
    echo.
    echo Please start Metro bundler first:
    echo   npm start
    echo   OR
    echo   start_metro_clean.bat
    echo.
    pause
    exit /b 1
)

echo [OK] Metro bundler is running.
echo.

REM Try to open DevTools in default browser
echo Opening React Native DevTools in browser...
echo.

REM Method 1: Direct URL
start http://localhost:8081/debugger-ui/

echo.
echo DevTools should open in your default browser.
echo.
echo Alternative methods:
echo   1. In Metro terminal, press 'j' key
echo   2. Open manually: http://localhost:8081/debugger-ui/
echo   3. Open manually: http://localhost:8081/debugger/
echo.
echo Note: Make sure your app is connected to Metro bundler.
echo.
pause
