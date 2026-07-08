@echo off

REM Android Metro penceresi (8082) — aciksa dokunma

cd /d %~dp0

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_android_metro.ps1" -MetroOnly

exit /b %ERRORLEVEL%

