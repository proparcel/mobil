# APK Download Server için Firewall Kuralı Ekleme Script'i
# PowerShell'i Yönetici olarak çalıştırın!

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "APK Download Server Firewall Kurali" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Yönetici kontrolü
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[HATA] Bu script Yonetici olarak calistirilmalidir!" -ForegroundColor Red
    Write-Host "PowerShell'i sag tiklayip 'Yonetici olarak calistir' secin." -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host "Port 8002 icin firewall kurali kontrol ediliyor..." -ForegroundColor Yellow

# Mevcut kuralı kontrol et
$existingRule = Get-NetFirewallRule -DisplayName "APK Download Server Port 8002" -ErrorAction SilentlyContinue

if ($existingRule) {
    Write-Host "[BILGI] Firewall kurali zaten mevcut." -ForegroundColor Green
    $rule = Get-NetFirewallRule -DisplayName "APK Download Server Port 8002"
    Write-Host "Durum: $($rule.Enabled)" -ForegroundColor Cyan
    Write-Host "Yon: $($rule.Direction)" -ForegroundColor Cyan
} else {
    Write-Host "[BILGI] Yeni firewall kurali ekleniyor..." -ForegroundColor Yellow
    
    try {
        New-NetFirewallRule -DisplayName "APK Download Server Port 8002" `
            -Direction Inbound `
            -LocalPort 8002 `
            -Protocol TCP `
            -Action Allow `
            -Description "ProParcel APK Download Server" | Out-Null
        
        Write-Host "[BASARILI] Firewall kurali eklendi!" -ForegroundColor Green
        Write-Host "Port 8002 artik acik." -ForegroundColor Green
    } catch {
        Write-Host "[HATA] Firewall kurali eklenemedi: $_" -ForegroundColor Red
        pause
        exit 1
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Firewall kurali hazir!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Simdi sunucuyu baslatabilirsiniz:" -ForegroundColor Yellow
Write-Host "  start_apk_server.bat" -ForegroundColor Cyan
Write-Host ""

pause
