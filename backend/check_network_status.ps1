# Network durumunu kontrol eden script
Write-Host "=== Network Durum Kontrolü ===" -ForegroundColor Cyan
Write-Host ""

# 1. FastAPI Server durumu
Write-Host "1. FastAPI Server (8001 portu):" -ForegroundColor Yellow
$server = Get-NetTCPConnection -LocalPort 8001 -State Listen -ErrorAction SilentlyContinue
if ($server) {
    Write-Host "   ✓ Server çalışıyor (PID: $($server.OwningProcess))" -ForegroundColor Green
    $process = Get-Process -Id $server.OwningProcess -ErrorAction SilentlyContinue
    if ($process) {
        Write-Host "   İşlem: $($process.ProcessName)" -ForegroundColor Green
    }
} else {
    Write-Host "   ✗ Server çalışmıyor!" -ForegroundColor Red
}

# 2. Windows Firewall kontrolü
Write-Host "`n2. Windows Firewall (8001 portu):" -ForegroundColor Yellow
$firewallRules = Get-NetFirewallRule | Where-Object { 
    ($_.DisplayName -like "*8001*") -or 
    ($_.DisplayName -like "*FastAPI*") 
}
if ($firewallRules) {
    foreach ($rule in $firewallRules) {
        $status = if ($rule.Enabled) { "✓ Aktif" } else { "✗ Pasif" }
        $color = if ($rule.Enabled) { "Green" } else { "Red" }
        Write-Host "   $status - $($rule.DisplayName) ($($rule.Direction))" -ForegroundColor $color
    }
} else {
    Write-Host "   ⚠ 8001 portu için firewall kuralı bulunamadı!" -ForegroundColor Red
    Write-Host "   Lütfen 'open_firewall_port_8001.ps1' scriptini yönetici olarak çalıştırın!" -ForegroundColor Yellow
}

# 3. Yerel IP kontrolü
Write-Host "`n3. Yerel IP Adresi:" -ForegroundColor Yellow
$localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
    $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" 
}).IPAddress | Select-Object -First 1
Write-Host "   Yerel IP: $localIP" -ForegroundColor Cyan

# 4. Dış IP kontrolü
Write-Host "`n4. Dış IP Kontrolü:" -ForegroundColor Yellow
try {
    $externalIP = (Invoke-WebRequest -Uri "https://api.ipify.org" -UseBasicParsing -TimeoutSec 5).Content.Trim()
    Write-Host "   Dış IP: $externalIP" -ForegroundColor Cyan
    if ($externalIP -eq "78.186.188.162") {
        Write-Host "   ✓ Dış IP eşleşiyor" -ForegroundColor Green
    } else {
        Write-Host "   ⚠ Dış IP eşleşmiyor! Beklenen: 78.186.188.162" -ForegroundColor Red
    }
} catch {
    Write-Host "   ⚠ Dış IP alınamadı: $_" -ForegroundColor Yellow
}

# 5. Port erişilebilirlik testi
Write-Host "`n5. Port Erişilebilirlik Testi:" -ForegroundColor Yellow
Write-Host "   Yerel test (127.0.0.1:8001):" -ForegroundColor Cyan
$localTest = Test-NetConnection -ComputerName 127.0.0.1 -Port 8001 -WarningAction SilentlyContinue
if ($localTest.TcpTestSucceeded) {
    Write-Host "   ✓ Yerel erişim başarılı" -ForegroundColor Green
} else {
    Write-Host "   ✗ Yerel erişim başarısız (server çalışmıyor olabilir)" -ForegroundColor Red
}

Write-Host "   Yerel ağ testi ($localIP:8001):" -ForegroundColor Cyan
$lanTest = Test-NetConnection -ComputerName $localIP -Port 8001 -WarningAction SilentlyContinue
if ($lanTest.TcpTestSucceeded) {
    Write-Host "   ✓ Yerel ağ erişimi başarılı" -ForegroundColor Green
} else {
    Write-Host "   ✗ Yerel ağ erişimi başarısız (firewall engelleyebilir)" -ForegroundColor Red
}

Write-Host "   Dış erişim testi (78.186.188.162:8001):" -ForegroundColor Cyan
$externalTest = Test-NetConnection -ComputerName 78.186.188.162 -Port 8001 -WarningAction SilentlyContinue
if ($externalTest.TcpTestSucceeded) {
    Write-Host "   ✓ Dış erişim başarılı (port forwarding çalışıyor)" -ForegroundColor Green
} else {
    Write-Host "   ✗ Dış erişim başarısız (port forwarding yapılmamış olabilir)" -ForegroundColor Red
    Write-Host "   Router'da 8001 -> $localIP:8001 port forwarding yapılmalı!" -ForegroundColor Yellow
}

# 6. Öneriler
Write-Host "`n=== Öneriler ===" -ForegroundColor Cyan
if (-not $server) {
    Write-Host "1. FastAPI server'ı başlatın: python server.py" -ForegroundColor Yellow
}
if (-not ($firewallRules | Where-Object { $_.Enabled -eq $true })) {
    Write-Host "2. Firewall'ı açın: .\open_firewall_port_8001.ps1 (yönetici olarak)" -ForegroundColor Yellow
}
if (-not $externalTest.TcpTestSucceeded) {
    Write-Host "3. Router'da port forwarding yapın:" -ForegroundColor Yellow
    Write-Host "   - Dış Port: 8001" -ForegroundColor White
    Write-Host "   - İç IP: $localIP" -ForegroundColor White
    Write-Host "   - İç Port: 8001" -ForegroundColor White
    Write-Host "   - Protocol: TCP" -ForegroundColor White
}

Write-Host "`n✅ Kontrol tamamlandı!" -ForegroundColor Green
