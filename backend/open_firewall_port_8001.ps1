# Windows Firewall'da 8001 portunu açmak için PowerShell scripti
# Yönetici olarak çalıştırın!

Write-Host "Windows Firewall'da 8001 portunu açılıyor..." -ForegroundColor Yellow

# Gelen trafik için kural ekle
New-NetFirewallRule -DisplayName "FastAPI Mobile Server - 8001" `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort 8001 `
    -Action Allow `
    -Profile Any `
    -Description "FastAPI mobil server için 8001 portu" `
    -ErrorAction SilentlyContinue

if ($?) {
    Write-Host "✓ 8001 portu için firewall kuralı eklendi/güncellendi" -ForegroundColor Green
} else {
    Write-Host "Kural zaten mevcut veya hata oluştu. Mevcut kuralları kontrol ediliyor..." -ForegroundColor Yellow
    $existing = Get-NetFirewallRule | Where-Object { $_.DisplayName -like "*8001*" -or $_.DisplayName -like "*FastAPI*" }
    if ($existing) {
        Write-Host "Mevcut kurallar:" -ForegroundColor Cyan
        $existing | Format-Table DisplayName, Enabled, Direction, Action
    }
}

# Mevcut kuralları göster
Write-Host "`n8001 portu ile ilgili firewall kuralları:" -ForegroundColor Cyan
Get-NetFirewallRule | Where-Object { $_.DisplayName -like "*8001*" -or $_.DisplayName -like "*FastAPI*" } | Format-Table DisplayName, Enabled, Direction, Action, Profile

# Port dinleme durumunu kontrol et
Write-Host "`n8001 portunu dinleyen servisler:" -ForegroundColor Cyan
$listening = Get-NetTCPConnection -LocalPort 8001 -State Listen -ErrorAction SilentlyContinue
if ($listening) {
    $listening | Format-Table LocalAddress, LocalPort, State, OwningProcess
    $process = Get-Process -Id $listening.OwningProcess -ErrorAction SilentlyContinue
    if ($process) {
        Write-Host "İşlem: $($process.ProcessName) (PID: $($process.Id))" -ForegroundColor Green
    }
} else {
    Write-Host "8001 portu şu anda dinlemede değil!" -ForegroundColor Red
    Write-Host "Lütfen FastAPI server'ı başlatın: python server.py" -ForegroundColor Yellow
}

Write-Host "`n✅ Firewall kontrolü tamamlandı!" -ForegroundColor Green
