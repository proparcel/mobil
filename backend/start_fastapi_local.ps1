# FastAPI Local Server Baslatma Scripti (PowerShell)
# Local development icin hazirlandi (127.0.0.1)

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# Environment variables ayarla
$env:HOST = "127.0.0.1"
$env:PORT = "8001"
$env:DJANGO_API_URL = "http://127.0.0.1:8000"

# Port kontrolu
$portInUse = Get-NetTCPConnection -LocalPort $env:PORT -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Host "UYARI: Port $($env:PORT) zaten kullaniliyor!" -ForegroundColor Yellow
    $processId = $portInUse.OwningProcess
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if ($process) {
        Write-Host "Process ID: $processId ($($process.ProcessName))" -ForegroundColor Yellow
        $response = Read-Host "Process'i durdurmak ister misiniz? (E/H)"
        if ($response -eq "E" -or $response -eq "e") {
            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 1
            Write-Host "Process durduruldu. Server baslatiliyor..." -ForegroundColor Green
        } else {
            Write-Host "Cikiliyor..." -ForegroundColor Red
            exit 1
        }
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "FastAPI Local Server Baslatiliyor" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Host: $env:HOST"
Write-Host "Port: $env:PORT"
Write-Host "URL: http://$env:HOST`:$env:PORT"
Write-Host "API Docs: http://$env:HOST`:$env:PORT/docs"
Write-Host "API Base: http://$env:HOST`:$env:PORT/api"
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Django API URL: $env:DJANGO_API_URL"
Write-Host ""
Write-Host "Durdurmak icin CTRL+C basin" -ForegroundColor Yellow
Write-Host ""

python server.py
