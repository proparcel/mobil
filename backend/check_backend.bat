@echo off
echo ========================================
echo FastAPI Backend Kontrol Script
echo ========================================
echo.

echo 1. Port 8001 dinleniyor mu?
netstat -ano | findstr :8001
if %errorlevel% neq 0 (
    echo [HATA] Port 8001 dinlenmiyor! FastAPI backend calismiyor.
    echo.
    echo FastAPI backend'i baslatmak icin:
    echo   cd c:\ProParcel\mobile\mobil_github\backend
    echo   python server.py
) else (
    echo [OK] Port 8001 dinleniyor.
)
echo.

echo 2. FastAPI backend'e istek gonderiliyor...
curl -X GET http://127.0.0.1:8001/api/ -w "\nHTTP Status: %%{http_code}\n" 2>nul
if %errorlevel% neq 0 (
    echo [HATA] FastAPI backend'e ulasilamiyor!
) else (
    echo [OK] FastAPI backend calisiyor.
)
echo.

echo 3. Django backend'e istek gonderiliyor...
curl -X GET http://127.0.0.1:8000/ -w "\nHTTP Status: %%{http_code}\n" 2>nul
if %errorlevel% neq 0 (
    echo [HATA] Django backend'e ulasilamiyor!
) else (
    echo [OK] Django backend calisiyor.
)
echo.

echo 4. Ngrok erisim testi (varsa)...
echo [BILGI] Dis erisim icin ngrok kullanin: ngrok http 8001
echo.

pause
