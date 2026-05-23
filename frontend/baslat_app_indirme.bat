@echo off
setlocal EnableDelayedExpansion
REM ProParcel mobil indirme sunucusu — Android APK + iOS IPA — 176.238.6.240:8002
cd /d %~dp0

set SERVER_IP=176.238.6.240
set PORT=8002
set APP_VERSION=1.0.0

if not exist "app_releases" mkdir app_releases

if not exist "app_releases\ProParcel.apk" (
    echo UYARI: APK yok. publish_mobile_release.bat veya APK kopyalayin.
)
if not exist "app_releases\ProParcel.ipa" (
    echo UYARI: IPA yok. EAS iOS build sonrasi ProParcel.ipa kopyalayin.
)

powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\generate_mobile_download_page.ps1" -PublicIp %SERVER_IP% -Port %PORT% -Version %APP_VERSION%

for /f "delims=" %%i in ('powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | ? { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1).IPAddress"') do set LAN_IP=%%i

echo.
echo ========================================
echo ProParcel Mobil Indirme Sunucusu
echo ========================================
echo.
echo ONEMLI - Ayni WiFi (telefon):
echo   http://%LAN_IP%:%PORT%/
echo.
echo Dis ag / mobil veri (modem port yonlendirme gerekir):
echo   http://%SERVER_IP%:%PORT%/
echo.
echo APK:    http://%LAN_IP%:%PORT%/ProParcel.apk
echo IPA:    http://%LAN_IP%:%PORT%/ProParcel.ipa
echo iOS:    itms-services manifest (Safari)
echo.
echo Firewall: PowerShell YONETICI - .\ekle_firewall_apk.ps1
echo Kontrol:  powershell -File scripts\kontrol_indirme_sunucu.ps1
echo Durdurmak icin CTRL+C
echo ========================================
echo.

cd app_releases
python -m http.server %PORT% --bind 0.0.0.0

pause
