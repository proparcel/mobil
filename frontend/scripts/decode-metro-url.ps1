param(
  [string]$DeepLink = ""
)

if (-not $DeepLink) {
  $DeepLink = (Get-Clipboard -Raw -ErrorAction SilentlyContinue)
}

if (-not $DeepLink -or $DeepLink -notmatch '[?&]url=([^&\s]+)') {
  Write-Host ""
  Write-Host "Kullanim:" -ForegroundColor Yellow
  Write-Host '  npm run iphone:decode-url -- "proparcel://expo-development-client/?url=..."' -ForegroundColor Gray
  Write-Host ""
  Write-Host "Metro terminalindeki proparcel:// satirini tirnak icinde yapistirin." -ForegroundColor Gray
  Write-Host ""
  exit 1
}

$url = [System.Uri]::UnescapeDataString($Matches[1])
Write-Host ""
Write-Host "Telefonda Enter URL manually:" -ForegroundColor Cyan
Write-Host "  $url" -ForegroundColor Green
Write-Host ""
Write-Host "(proparcel:// DEGIL - yalnizca yukaridaki https/http adresi)" -ForegroundColor Yellow
Write-Host ""
