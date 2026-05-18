@echo off
REM FastAPI Production Başlatma Scripti
REM Sunucu IP üzerinden erişilebilir hale getirir
cd /d %~dp0
set HOST=0.0.0.0
set PORT=8001
set SERVER_IP=78.189.238.18
echo ========================================
echo FastAPI Production Server Baslatiliyor
echo ========================================
echo Server IP: %SERVER_IP%
echo Port: %PORT%
echo URL: http://%SERVER_IP%:%PORT%
echo API Docs: http://%SERVER_IP%:%PORT%/docs
echo ========================================
echo.
python server.py
pause
