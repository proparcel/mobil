@echo off
chcp 65001 >nul
echo ============================================
echo Ngrok Process'leri Durduruluyor
echo ============================================
echo.

taskkill /F /IM ngrok.exe 2>nul
if errorlevel 1 (
    echo [BILGI] Calisan ngrok process'i bulunamadi.
) else (
    echo [OK] Ngrok process'leri durduruldu.
)

echo.
pause
