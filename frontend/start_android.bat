@echo off

REM Metrosuz Android build (Metro acik olmali, port 8082)

cd /d %~dp0

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_android.ps1" %*

exit /b %ERRORLEVEL%

