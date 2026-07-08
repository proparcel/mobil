# Windows: iPhone'un PC Metro'suna LAN erisimi icin firewall kurali.

param(

  [int]$Port = 8081

)



$ruleName = "ProParcel Metro $Port"

$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue

if ($existing) {

  Write-Host "[firewall] Kural zaten var: $ruleName" -ForegroundColor Gray

  exit 0

}

try {

  New-NetFirewallRule `

    -DisplayName $ruleName `

    -Direction Inbound `

    -Protocol TCP `

    -LocalPort $Port `

    -Action Allow `

    -Profile Private,Domain `

    -ErrorAction Stop | Out-Null

  Write-Host "[firewall] $Port inbound izni eklendi ($ruleName)" -ForegroundColor Green

} catch {

  Write-Host "[firewall] Kural eklenemedi (Admin gerekir). Tunnel modu kullanin." -ForegroundColor Yellow

  Write-Host "  Yonetici PowerShell: New-NetFirewallRule -DisplayName '$ruleName' -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow" -ForegroundColor Gray

}

