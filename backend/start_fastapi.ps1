# FastAPI Başlatma Scripti
cd $PSScriptRoot
$env:HOST = '127.0.0.1'
$env:PORT = '8001'
Write-Host "FastAPI başlatılıyor: http://127.0.0.1:8001" -ForegroundColor Green
python server.py
