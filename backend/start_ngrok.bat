@echo off
chcp 65001 >nul
echo ============================================
echo Ngrok Tunnel Baslatiliyor
echo ============================================
echo.

REM Ngrok'un yuklu olup olmadigini kontrol et
ngrok version >nul 2>&1
if errorlevel 1 (
    echo [HATA] Ngrok bulunamadi!
    echo Ngrok'u yukleyin: https://ngrok.com/download
    echo veya: npm install -g ngrok
    pause
    exit /b 1
)

echo Ngrok tunnel baslatiliyor (Port 8001)...
echo.
echo Not: Eger "endpoint is already online" hatasi alirsaniz:
echo   1. Mevcut ngrok process'lerini durdurun: taskkill /F /IM ngrok.exe
echo   2. Veya farkli bir port kullanin
echo.
echo ============================================
echo Durdurmak icin CTRL+C tuslarina basin
echo ============================================
echo.

ngrok http 8001

pause
