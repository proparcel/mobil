# FastAPI Production Başlatma Scripti
# Sunucu IP üzerinden erişilebilir hale getirir
cd $PSScriptRoot
$env:HOST = '0.0.0.0'  # Tüm network arayüzlerinden erişilebilir
$env:PORT = '8001'
$serverIP = '78.189.238.18'
Write-Host "========================================" -ForegroundColor Green
Write-Host "FastAPI Production Server Başlatılıyor" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "Server IP: $serverIP" -ForegroundColor Yellow
Write-Host "Port: $env:PORT" -ForegroundColor Yellow
Write-Host "URL: http://$serverIP`:$env:PORT" -ForegroundColor Yellow
Write-Host "API Docs: http://$serverIP`:$env:PORT/docs" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
python server.py
