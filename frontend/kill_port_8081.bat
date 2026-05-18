@echo off
echo Port 8081'i kullanan process kapatiliyor...
echo.
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8081 ^| findstr LISTENING') do (
    echo PID %%a process'i kapatiliyor...
    taskkill /PID %%a /F
)
echo.
echo Tamamlandi! Simdi dev server'i baslatabilirsiniz:
echo npx expo start --dev-client
echo.
pause
