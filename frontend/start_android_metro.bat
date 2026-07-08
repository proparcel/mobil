@echo off

REM Android build + Metro (8082) — Metro kapaliysa acar

cd /d %~dp0

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_android_metro.ps1" %*

exit /b %ERRORLEVEL%

