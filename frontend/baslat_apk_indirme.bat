@echo off
setlocal EnableDelayedExpansion
REM ProParcel APK indirme sunucusu — 176.238.6.240:8002
cd /d %~dp0

set SERVER_IP=176.238.6.240
set PORT=8002
set APP_VERSION=1.0.0

if not exist "app_releases" mkdir app_releases
if exist "apk_releases\ProParcel.apk" if not exist "app_releases\ProParcel.apk" copy /Y "apk_releases\ProParcel.apk" "app_releases\ProParcel.apk"

powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\generate_mobile_download_page.ps1" -PublicIp %SERVER_IP% -Port %PORT% -Version %APP_VERSION%

echo.
echo ========================================
echo APK Indirme Sunucusu
echo ========================================
echo.
echo Telefondan: http://%SERVER_IP%:%PORT%/
echo Direkt APK: http://%SERVER_IP%:%PORT%/ProParcel.apk
echo Django:     http://%SERVER_IP%:8000/apk/
echo.
echo Durdurmak icin CTRL+C
echo ========================================
echo.

cd app_releases
python -m http.server %PORT% --bind 0.0.0.0

pause
