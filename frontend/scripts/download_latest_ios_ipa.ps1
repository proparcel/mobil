# Son basarili iOS EAS build IPA'sini app_releases\ProParcel.ipa olarak indirir
param(
    [string]$Profile = "preview",
    [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
if (-not $OutDir) { $OutDir = Join-Path $root "app_releases" }
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }

$raw = npx eas build:list --platform ios --limit 15 --json --non-interactive 2>&1 | Out-String
$start = $raw.IndexOf('[')
if ($start -lt 0) { $start = $raw.IndexOf('{') }
if ($start -lt 0) { throw "eas build:list basarisiz" }
$builds = $raw.Substring($start) | ConvertFrom-Json
if ($builds -isnot [array]) { $builds = @($builds) }
$match = $builds | Where-Object { $_.status -eq "finished" -and $_.buildProfile -eq $Profile } | Select-Object -First 1
if (-not $match) {
    $match = $builds | Where-Object { $_.status -eq "finished" } | Select-Object -First 1
}
if (-not $match) { throw "Basarili iOS build yok. Once: npm run eas:ios:preview" }

$url = $match.artifacts.applicationArchiveUrl
if (-not $url) { throw "IPA URL yok (build id: $($match.id))" }

$dest = Join-Path $OutDir "ProParcel.ipa"
Write-Host "Indiriliyor: $url"
Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing
Write-Host "OK: $dest ($([math]::Round((Get-Item $dest).Length/1MB,2)) MB)" -ForegroundColor Green
