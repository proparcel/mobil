@echo off
REM Metro'yu gorunur ayri pencerede calistirir. r / a tuslari SADECE o pencerede calisir.
cd /d %~dp0

echo [1/3] Eski Metro durduruluyor (8081)...
powershell -NoProfile -Command "$p=(Get-NetTCPConnection -LocalPort 8081 -EA SilentlyContinue|Select -First 1).OwningProcess;if($p){Stop-Process -Id $p -Force -EA SilentlyContinue;Write-Host ('  Durduruldu PID '+$p)}else{Write-Host '  8081 zaten bos'}"

set ADB_PATH=C:\Android\Sdk\platform-tools\adb.exe
if exist "%ADB_PATH%" (
  echo [2/3] adb reverse tcp:8081 ...
  "%ADB_PATH%" reverse tcp:8081 tcp:8081 >nul 2>&1
) else (
  echo [2/3] adb bulunamadi, USB reverse atlandi.
)

echo [3/3] Metro YENI PENCEREDE aciliyor...
echo.
echo   ONEMLI: r ile yenilemek icin "ProParcel Metro" baslikli pencereye tiklayin.
echo   Bu pencerede "r" YAZMAYIN - sadece tek harf r tusuna basin.
echo   Durdurmak: npm run stop:metro
echo.

start "ProParcel Metro" cmd /k "title ProParcel Metro && cd /d %~dp0 && set NODE_ENV=development&& set CI=&& npx expo start --clear --dev-client --lan --scheme proparcel --port 8081"

ping 127.0.0.1 -n 4 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\focus-metro-window.ps1"

exit /b 0
