# Windows: android/ klasoru EBUSY ise Gradle/Metro durdur, yeniden adlandir veya sil.
param(
  [switch]$ForceRemoveOnly
)
$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
$android = Join-Path $root "android"

function Stop-Metro8081 {
  try {
    $p = Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($p) {
      Stop-Process -Id $p.OwningProcess -Force -ErrorAction SilentlyContinue
      Write-Host "Metro (8081) durduruldu PID $($p.OwningProcess)"
    }
  } catch { }
}

function Stop-GradleDaemons {
  $gradlew = Join-Path $android "gradlew.bat"
  if (Test-Path $gradlew) {
    Write-Host "Gradle daemon durduruluyor (gradlew --stop)..."
    Push-Location $android
    try {
      & .\gradlew.bat --stop 2>&1 | Out-Host
    } catch { }
    Pop-Location
    Start-Sleep -Seconds 2
  }
}

function Stop-GradleJavaProcesses {
  $killed = 0
  Get-CimInstance Win32_Process -Filter "name='java.exe'" -ErrorAction SilentlyContinue | ForEach-Object {
    $cmd = $_.CommandLine
    if ($cmd -match 'GradleDaemon|gradle-launcher|kotlin-compiler|kotlin\.daemon') {
      Write-Host "Java durduruluyor PID $($_.ProcessId) (Gradle/Kotlin)"
      Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
      $killed = 1
    }
  }
  if ($killed -gt 0) { Start-Sleep -Seconds 3 }
}

function Remove-AndroidFolderRobocopy {
  $empty = Join-Path $env:TEMP ("pp_empty_" + [guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $empty -Force | Out-Null
  try {
    cmd /c "robocopy `"$empty`" `"$android`" /MIR /R:1 /W:1 /NFL /NDL /NJH /NJS" | Out-Null
    Remove-Item -LiteralPath $android -Recurse -Force -ErrorAction Stop
    Write-Host "android/ silindi (robocopy mirror)."
    return $true
  } catch {
    return $false
  } finally {
    Remove-Item -LiteralPath $empty -Recurse -Force -ErrorAction SilentlyContinue
  }
}

function Remove-AndroidFolder {
  if (-not (Test-Path $android)) {
    Write-Host "android/ yok, temiz."
    return $true
  }
  foreach ($i in 1..3) {
    try {
      Remove-Item -LiteralPath $android -Recurse -Force -ErrorAction Stop
      Write-Host "android/ silindi."
      return $true
    } catch {
      Write-Host "Silme denemesi $i basarisiz: $($_.Exception.Message)"
      Start-Sleep -Seconds 2
      Stop-GradleJavaProcesses
      Stop-GradleDaemons
    }
  }
  if (Remove-AndroidFolderRobocopy) { return $true }
  $stale = Join-Path $root ("android._stale_" + (Get-Date -Format "yyyyMMdd_HHmmss"))
  try {
    Rename-Item -LiteralPath $android -NewName (Split-Path $stale -Leaf) -ErrorAction Stop
    Write-Host "android/ kilitli - yeniden adlandirildi: $(Split-Path $stale -Leaf)"
    Write-Host "Eski klasoru sonra elle silebilirsiniz (Android Studio / Explorer kapali iken)."
    return $true
  } catch {
    Write-Host "HATA: android/ ne silindi ne yeniden adlandirildi."
    Write-Host ""
    Write-Host "1) Cursor ve Android Studio tamamen KAPAT"
    Write-Host "2) Windows Terminal (Admin) ac, tekrar: npm run unlock:android"
    Write-Host "3) Veya kilidi atla (gecici build): npm run android:setup:temp"
    Write-Host "4) Veya yeniden baslatma ile sil: npm run schedule:android-delete-reboot (Admin)"
    return $false
  }
}

Write-Host "=== unlock-android-folder ==="
Stop-Metro8081
Stop-GradleJavaProcesses
Stop-GradleDaemons
if ($ForceRemoveOnly) {
  if (-not (Remove-AndroidFolder)) { exit 1 }
  exit 0
}
if (Test-Path $android) {
  if (-not (Remove-AndroidFolder)) { exit 1 }
} else {
  Write-Host "android/ zaten yok."
}
Write-Host "Hazir: npm run prebuild:android veya npm run android:setup"
