@echo off

REM iOS Metro (8081) — kapaliysa baslatir

cd /d %~dp0

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_ios_metro.ps1" %*

exit /b %ERRORLEVEL%

