@echo off
chcp 65001 >nul
echo ============================================
echo ProParcel APK Download Server Başlatılıyor
echo ============================================
echo.

REM APK klasörüne git
cd /d "%~dp0"

REM Python'un yüklü olup olmadığını kontrol et
python --version >nul 2>&1
if errorlevel 1 (
    echo [HATA] Python bulunamadı!
    echo Lütfen Python'u yükleyin: https://www.python.org/downloads/
    pause
    exit /b 1
)

echo [1/3] Windows Firewall kontrol ediliyor...
powershell -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -Command \"$rule = Get-NetFirewallRule | Where-Object { $_.DisplayName -like ''*APK*8002*'' -or ($_.DisplayName -like ''*ProParcel*8002*'') }; if (-not $rule) { New-NetFirewallRule -DisplayName ''ProParcel APK Server - 8002'' -Direction Inbound -Protocol TCP -LocalPort 8002 -Action Allow -Profile Any -Description ''ProParcel APK indirme sunucusu için 8002 portu'' -ErrorAction SilentlyContinue; Write-Host ''Firewall kuralı eklendi'' } else { Write-Host ''Firewall kuralı zaten mevcut'' }\"' -Wait -WindowStyle Hidden"

echo [2/3] Firewall kuralı kontrol edildi
echo.

echo [3/3] APK Server başlatılıyor...
echo.
echo ============================================
echo Server Bilgileri:
echo ============================================
echo Yerel: http://192.168.1.100:8002
echo Dış:   http://78.189.238.18:8002
echo APK:   http://78.189.238.18:8002/ProParcel.apk
echo.
echo ============================================
echo Durdurmak için CTRL+C tuşlarına basın
echo ============================================
echo.

REM Python server'ı başlat
python http_server.py

pause
