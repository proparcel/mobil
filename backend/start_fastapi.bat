@echo off
cd /d %~dp0
set HOST=127.0.0.1
set PORT=8001
echo FastAPI baslatiliyor: http://127.0.0.1:8001
python server.py
pause
