@echo off
chcp 65001 >nul
echo ============================================
echo ProParcel FastAPI Backend Server Başlatılıyor
echo ============================================
echo.

REM Backend klasörüne git
cd /d %~dp0

REM Python'un yüklü olup olmadığını kontrol et
python --version >nul 2>&1
if errorlevel 1 (
    echo [HATA] Python bulunamadı!
    echo Lütfen Python'u yükleyin: https://www.python.org/downloads/
    pause
    exit /b 1
)

echo [1/3] Windows Firewall kontrol ediliyor...
echo $rule = Get-NetFirewallRule -ErrorAction SilentlyContinue ^| Where-Object { ($_.DisplayName -like '*FastAPI*8001*') -or ($_.DisplayName -like '*ProParcel*8001*') } > "%TEMP%\fw_check_8001.ps1"
echo if (-not $rule) { >> "%TEMP%\fw_check_8001.ps1"
echo     $cmd = 'New-NetFirewallRule -DisplayName \"ProParcel FastAPI Server - 8001\" -Direction Inbound -Protocol TCP -LocalPort 8001 -Action Allow -Profile Any -Description \"ProParcel FastAPI backend sunucusu için 8001 portu\" -ErrorAction SilentlyContinue' >> "%TEMP%\fw_check_8001.ps1"
echo     Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $cmd -Wait -WindowStyle Hidden >> "%TEMP%\fw_check_8001.ps1"
echo     Write-Host 'Firewall kuralı eklendi' >> "%TEMP%\fw_check_8001.ps1"
echo } else { >> "%TEMP%\fw_check_8001.ps1"
echo     Write-Host 'Firewall kuralı zaten mevcut' >> "%TEMP%\fw_check_8001.ps1"
echo } >> "%TEMP%\fw_check_8001.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -File "%TEMP%\fw_check_8001.ps1" 2>nul
del "%TEMP%\fw_check_8001.ps1" 2>nul

echo [2/3] Firewall kuralı kontrol edildi
echo.

echo [3/3] FastAPI Server başlatılıyor...
echo.
echo ============================================
echo Server Bilgileri:
echo ============================================
echo Yerel: http://localhost:8001
echo API:   http://localhost:8001/api/
echo.
echo Dış erişim için ngrok kullanın:
echo   ngrok http 8001
echo.
echo ============================================
echo Durdurmak için CTRL+C tuşlarına basın
echo ============================================
echo.

REM FastAPI server'ı başlat (localhost için 127.0.0.1 kullan)
REM HOST environment variable'ını açıkça set et
set HOST=127.0.0.1
set PORT=8001
python server.py

pause
