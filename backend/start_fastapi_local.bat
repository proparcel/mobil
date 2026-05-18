@echo off
REM FastAPI Local Server Baslatma Scripti
REM Local development icin hazirlandi (127.0.0.1)

cd /d %~dp0

REM Environment variables ayarla
set HOST=127.0.0.1
set PORT=8001
set DJANGO_API_URL=http://127.0.0.1:8000

REM Port kontrolu (PowerShell kullanarak)
powershell -Command "$port = Get-NetTCPConnection -LocalPort %PORT% -ErrorAction SilentlyContinue; if ($port) { $pid = $port.OwningProcess; Write-Host 'UYARI: Port %PORT% zaten kullaniliyor! Process ID:' $pid -ForegroundColor Yellow; $response = Read-Host 'Process''i durdurmak ister misiniz? (E/H)'; if ($response -eq 'E' -or $response -eq 'e') { Stop-Process -Id $pid -Force; Start-Sleep -Seconds 1; Write-Host 'Process durduruldu.' -ForegroundColor Green } else { exit 1 } }"

echo ========================================
echo FastAPI Local Server Baslatiliyor
echo ========================================
echo Host: %HOST%
echo Port: %PORT%
echo URL: http://%HOST%:%PORT%
echo API Docs: http://%HOST%:%PORT%/docs
echo API Base: http://%HOST%:%PORT%/api
echo ========================================
echo.
echo Django API URL: %DJANGO_API_URL%
echo.
echo Durdurmak icin CTRL+C basin
echo.

python server.py

pause
