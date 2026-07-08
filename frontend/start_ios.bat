@echo off

REM Metrosuz iOS — Metro baslatmaz, aciksa URL gosterir

cd /d %~dp0

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_ios.ps1" %*

exit /b %ERRORLEVEL%

