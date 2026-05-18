# Cursor Local History -> screens/routes ve ilgili dosyalari app/routes'e kopyala
$HistoryRoot = "$env:APPDATA\Cursor\User\History"
$ProjectPrefix = "file:///c%3A/ProParcel/"
$TargetRoot = "C:\ProParcel"
$patterns = @(
    "mobile/mobil_github/frontend/screens/routes/",
    "mobile/mobil_github/frontend/components/app/UserMenuSheet",
    "mobile/mobil_github/frontend/components/app/UserMenuSheetList",
    "mobile/mobil_github/frontend/components/app/userMenuItems",
    "mobile/mobil_github/frontend/components/WelcomeBottomSheet",
    "mobile/mobil_github/frontend/components/AppTourOverlay",
    "mobile/mobil_github/frontend/components/BinaEstimateModal",
    "mobile/mobil_github/frontend/components/MustakilEvEstimateModal",
    "mobile/mobil_github/frontend/components/KonutDaireModal",
    "mobile/mobil_github/frontend/components/app/HomeMapToolsSheet",
    "mobile/mobil_github/frontend/services/portalService",
    "mobile/mobil_github/frontend/services/vitrinSearchService",
    "mobile/mobil_github/frontend/services/portalFavoritesApi",
    "mobile/mobil_github/frontend/src/types/portal",
    "mobile/mobil_github/frontend/src/types/vitrin",
    "mobile/mobil_github/frontend/config/portalSite",
    "mobile/mobil_github/frontend/components/app/AranacaklarVitrinFiltersSheet",
    "mobile/mobil_github/frontend/components/app/PortalDetailScoresBlock",
    "mobile/mobil_github/frontend/components/app/PortalInsightSummaryCard",
    "mobile/mobil_github/frontend/components/app/PortalMulkScoreDetailCard",
    "mobile/mobil_github/frontend/components/app/PortalFruitInvestmentCard",
    "mobile/mobil_github/frontend/components/app/PortalSolarEnergyCard",
    "mobile/mobil_github/frontend/components/app/PortalWindEnergyCard",
    "mobile/mobil_github/frontend/components/app/PortalSlopeTerrainCard",
    "mobile/mobil_github/frontend/components/app/PortalParcelSplitDetailCard",
    "mobile/mobil_github/frontend/components/app/ListingDescriptionRich"
)

$restored = 0
$skipped = 0

Get-ChildItem $HistoryRoot -Directory | ForEach-Object {
    $entriesPath = Join-Path $_.FullName "entries.json"
    if (-not (Test-Path $entriesPath)) { return }
    try {
        $meta = Get-Content $entriesPath -Raw -Encoding UTF8 | ConvertFrom-Json
    } catch { return }
    if (-not $meta.resource) { return }
    $resource = [Uri]::UnescapeDataString($meta.resource.Replace($ProjectPrefix, "").Replace("/", "\"))
    $match = $false
    foreach ($p in $patterns) {
        if ($resource -like ($p.Replace("/", "\") + "*")) { $match = $true; break }
    }
    if (-not $match) { return }
    if (-not $meta.entries -or $meta.entries.Count -eq 0) { return }

    $latest = $meta.entries | Sort-Object { [long]$_.timestamp } -Descending | Select-Object -First 1
    $src = Join-Path $_.FullName $latest.id
    if (-not (Test-Path $src)) { $skipped++; return }

    $dest = Join-Path $TargetRoot $resource
    # screens/routes -> app/routes
    $dest = $dest -replace '\\screens\\routes\\', '\app\routes\'

    $destDir = Split-Path $dest -Parent
    if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
    Copy-Item -LiteralPath $src -Destination $dest -Force
    $restored++
    Write-Host "OK $dest"
}

Write-Host "Done: $restored restored, $skipped skipped."
