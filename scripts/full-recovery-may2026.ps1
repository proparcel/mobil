# Komple mobil kurtarma: Cursor Local History (Mayis 2026) + git reflog API commit
$ErrorActionPreference = "Stop"
$RepoRoot = "C:\ProParcel\mobile\mobil_github"
$Frontend = Join-Path $RepoRoot "frontend"

Write-Host "=== ProParcel mobil komple kurtarma ===" -ForegroundColor Cyan

Push-Location $RepoRoot
try {
    $branch = "recovery/may2026-cursor-$(Get-Date -Format 'yyyyMMdd-HHmm')"
    git checkout -b $branch 2>$null
    if ($LASTEXITCODE -ne 0) {
        git checkout $branch 2>$null
        if ($LASTEXITCODE -ne 0) { git checkout -b $branch }
    }
    Write-Host "Branch: $branch" -ForegroundColor Green

    & "$RepoRoot\scripts\restore-from-cursor-history.ps1"

    $apiCommit = "3696982"
    if (git cat-file -e "${apiCommit}^{commit}" 2>$null) {
        Write-Host "Cherry-pick API commit $apiCommit ..."
        git cherry-pick $apiCommit --no-commit 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Cherry-pick atlandi."
            git cherry-pick --abort 2>$null
        }
    }

    foreach ($pair in @(
            @("frontend\screens\routes", "frontend\app\routes"),
            @("frontend\screens\contexts", "frontend\app\contexts")
        )) {
        $src = Join-Path $RepoRoot $pair[0]
        $dst = Join-Path $RepoRoot $pair[1]
        if (Test-Path $src) {
            if (-not (Test-Path $dst)) { New-Item -ItemType Directory -Path $dst -Force | Out-Null }
            robocopy $src $dst /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
            Write-Host "Synced $($pair[0]) -> $($pair[1])"
        }
    }

    $babelPath = Join-Path $Frontend "babel.config.js"
    $babel = Get-Content $babelPath -Raw
    if ($babel -notmatch "module-resolver") {
        $insert = @"
      [
        `"module-resolver`",
        {
          root: [`".`"],
          alias: { `"@`": `".`" },
          extensions: [`".ts`", `".tsx`", `".js`", `".jsx`", `".json`"],
        },
      ],
"@
        $babel = $babel -replace '("plugins":\s*\[)', "`$1`n$insert"
        Set-Content -Path $babelPath -Value $babel -Encoding UTF8 -NoNewline
        Write-Host "babel.config.js guncellendi"
    }

    $metroPath = Join-Path $Frontend "metro.config.js"
    $metro = Get-Content $metroPath -Raw
    if ($metro -notmatch "resolver\.alias") {
        $block = @"

config.resolver.alias = {
  ...(config.resolver.alias || {}),
  `"@`": path.resolve(__dirname),
};
"@
        $metro = $metro -replace "(config\.resolver\.extraNodeModules = extraNodeModules;)", "`$1$block"
        Set-Content -Path $metroPath -Value $metro -Encoding UTF8 -NoNewline
        Write-Host "metro.config.js guncellendi"
    }

    $util = Join-Path $Frontend "src\utils\portalInsightCardLogic.ts"
    if (-not (Test-Path $util)) {
        $utilBody = "const T = new Set(['bina','villa','mustakil_ev','ciftlik_ev','fabrika','konut','konut_daire','ticari','commercial']);`nexport function isStructurePortalQueryType(q){return T.has(String(q??'').trim().toLowerCase());}"
        Set-Content -Path $util -Value $utilBody -Encoding UTF8
    }

    $routes = (Get-ChildItem "$Frontend\screens\routes\*.tsx" -EA SilentlyContinue).Count
    Write-Host "screens/routes: $routes dosya"
}
finally {
    Pop-Location
}
