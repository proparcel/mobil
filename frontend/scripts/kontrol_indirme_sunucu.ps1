# ProParcel indirme sunucusu tanisi (port 8002)
param(
    [int]$Port = 8002
)

$ErrorActionPreference = "SilentlyContinue"
$publicIp = (Invoke-RestMethod -Uri "https://api.ipify.org" -TimeoutSec 8)
$lanIp = (
    Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object {
        $_.IPAddress -notlike "127.*" -and
        $_.IPAddress -notlike "169.254.*" -and
        $_.PrefixOrigin -ne "WellKnown"
    } |
    Select-Object -First 1 -ExpandProperty IPAddress
)

Write-Host ""
Write-Host "=== ProParcel indirme sunucusu ($Port) ===" -ForegroundColor Cyan
Write-Host "Genel IP (router): $publicIp"
Write-Host "Bu PC yerel IP:   $lanIp"
Write-Host ""

$listen = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($listen) {
    Write-Host "[OK] Port $Port dinleniyor (PID $($listen.OwningProcess))" -ForegroundColor Green
} else {
    Write-Host "[HATA] Port $Port dinlemiyor. baslat_app_indirme.bat calistirin." -ForegroundColor Red
}

$rule = Get-NetFirewallRule -DisplayName "APK Download Server Port 8002" -ErrorAction SilentlyContinue
if ($rule -and ($rule | Where-Object { $_.Enabled -eq "True" })) {
    Write-Host "[OK] Firewall kurali: APK Download Server Port 8002" -ForegroundColor Green
} else {
    Write-Host "[HATA] Firewall kurali YOK veya kapali." -ForegroundColor Red
    Write-Host "       PowerShell'i YONETICI acin: .\ekle_firewall_apk.ps1" -ForegroundColor Yellow
}

foreach ($pair in @(
        @{ Target = "127.0.0.1" },
        @{ Target = $lanIp }
    )) {
    if (-not $pair.Target) { continue }
    try {
        $r = Invoke-WebRequest -Uri "http://$($pair.Target):$Port/" -UseBasicParsing -TimeoutSec 4
        Write-Host "[OK] http://$($pair.Target):$Port/ -> $($r.StatusCode)" -ForegroundColor Green
    } catch {
        Write-Host "[HATA] http://$($pair.Target):$Port/ -> erisilemiyor" -ForegroundColor Red
    }
}

try {
    Invoke-WebRequest -Uri "http://${publicIp}:$Port/" -UseBasicParsing -TimeoutSec 6 | Out-Null
    Write-Host "[OK] http://${publicIp}:$Port/ (bu PC'den)" -ForegroundColor Green
} catch {
    Write-Host "[UYARI] http://${publicIp}:$Port/ bu PC'den acilmadi (normal: router port yonlendirme / NAT hairpin)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "--- Telefonda deneyin ---" -ForegroundColor Cyan
if ($lanIp) {
    Write-Host "Ayni WiFi:  http://${lanIp}:$Port/"
}
Write-Host "Mobil veri / dis ag: http://${publicIp}:$Port/  (modemde TCP $Port -> $lanIp gerekir)"
Write-Host ""
