# Cursor Local History -> mobil_github dosyalarina geri yukle (Git kullanmaz)
$HistoryRoot = "$env:APPDATA\Cursor\User\History"
$ProjectPrefix = "file:///c%3A/ProParcel/"
$TargetRoot = "C:\ProParcel"
$restored = 0
$skipped = 0

Get-ChildItem $HistoryRoot -Directory | ForEach-Object {
    $entriesPath = Join-Path $_.FullName "entries.json"
    if (-not (Test-Path $entriesPath)) { return }
    try {
        $meta = Get-Content $entriesPath -Raw -Encoding UTF8 | ConvertFrom-Json
    } catch { return }
    if (-not $meta.resource -or $meta.resource -notlike "*mobil_github*") { return }
    if (-not $meta.entries -or $meta.entries.Count -eq 0) { return }

    $latest = $meta.entries | Sort-Object { [long]$_.timestamp } -Descending | Select-Object -First 1
  $rel = [Uri]::UnescapeDataString($meta.resource.Replace($ProjectPrefix, "").Replace("/", "\"))
    $dest = Join-Path $TargetRoot $rel
    $src = Join-Path $_.FullName $latest.id
    if (-not (Test-Path $src)) { $skipped++; return }

    $destDir = Split-Path $dest -Parent
    if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
    Copy-Item -LiteralPath $src -Destination $dest -Force
    $restored++
}

Write-Host "Cursor history restore: $restored files copied, $skipped skipped."
