# Metro Bundler Connection Fix Script
# This script fixes the "Unable to load script" error by:
# 1. Checking ADB connection
# 2. Setting up port forwarding
# 3. Starting Metro bundler
# 4. Providing network troubleshooting

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Metro Bundler Connection Fix" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Change to frontend directory
$frontendDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $frontendDir

# ADB path
$adbPath = "C:\Android\Sdk\platform-tools\adb.exe"

# Check if ADB exists
if (-not (Test-Path $adbPath)) {
    Write-Host "❌ ADB not found at: $adbPath" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Android SDK Platform-tools or update the ADB path in this script." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Alternative ADB locations to check:" -ForegroundColor Yellow
    Write-Host "  - C:\Users\$env:USERNAME\AppData\Local\Android\Sdk\platform-tools\adb.exe" -ForegroundColor Gray
    Write-Host "  - C:\Program Files\Unity\Hub\Editor\*\Editor\Data\PlaybackEngines\AndroidPlayer\SDK\platform-tools\adb.exe" -ForegroundColor Gray
    Write-Host ""
    $customAdb = Read-Host "Enter custom ADB path (or press Enter to exit)"
    if ($customAdb -and (Test-Path $customAdb)) {
        $adbPath = $customAdb
    } else {
        exit 1
    }
}

Write-Host "✅ ADB found: $adbPath" -ForegroundColor Green
Write-Host ""

# Step 1: Check device connection
Write-Host "[1/4] Checking device connection..." -ForegroundColor Yellow
$devicesOutput = & $adbPath devices 2>&1
$devices = $devicesOutput | Select-String -Pattern "device$" | ForEach-Object { $_.Line -replace "\s+device$", "" }

if ($devices.Count -eq 0) {
    Write-Host "❌ No devices found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting steps:" -ForegroundColor Yellow
    Write-Host "  1. Make sure your device is connected via USB" -ForegroundColor Gray
    Write-Host "  2. Enable USB Debugging on your device:" -ForegroundColor Gray
    Write-Host "     - Settings → About Phone → Tap 'Build Number' 7 times" -ForegroundColor Gray
    Write-Host "     - Settings → Developer Options → Enable 'USB Debugging'" -ForegroundColor Gray
    Write-Host "  3. If device shows 'unauthorized', check your device and allow USB debugging" -ForegroundColor Gray
    Write-Host "  4. Try: adb kill-server && adb start-server" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Current ADB devices output:" -ForegroundColor Yellow
    Write-Host $devicesOutput
    Write-Host ""
    exit 1
}

Write-Host "✅ Found $($devices.Count) device(s):" -ForegroundColor Green
foreach ($device in $devices) {
    Write-Host "   - $device" -ForegroundColor Gray
}
Write-Host ""

# Step 2: Setup ADB reverse port forwarding
Write-Host "[2/4] Setting up ADB reverse port forwarding (8081)..." -ForegroundColor Yellow
$reverseResult = & $adbPath reverse tcp:8081 tcp:8081 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Port forwarding configured: localhost:8081 → device:8081" -ForegroundColor Green
} else {
    Write-Host "⚠️  Port forwarding setup returned: $reverseResult" -ForegroundColor Yellow
    Write-Host "   This might be okay if forwarding already exists." -ForegroundColor Gray
}
Write-Host ""

# Step 3: Check if Metro is running
Write-Host "[3/4] Checking if Metro bundler is running..." -ForegroundColor Yellow
try {
    $metroCheck = Test-NetConnection -ComputerName localhost -Port 8081 -WarningAction SilentlyContinue -ErrorAction SilentlyContinue
    if ($metroCheck.TcpTestSucceeded) {
        Write-Host "✅ Metro bundler is already running on port 8081" -ForegroundColor Green
        $metroRunning = $true
    } else {
        Write-Host "❌ Metro bundler is NOT running on port 8081" -ForegroundColor Red
        $metroRunning = $false
    }
} catch {
    Write-Host "❌ Could not check Metro status (port might be blocked)" -ForegroundColor Yellow
    $metroRunning = $false
}
Write-Host ""

# Step 4: Start Metro if not running
if (-not $metroRunning) {
    Write-Host "[4/4] Starting Metro bundler..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Starting Metro bundler in a new window..." -ForegroundColor Cyan
    Write-Host "You can also start it manually with: npm start" -ForegroundColor Gray
    Write-Host ""
    
    # Start Metro in a new PowerShell window
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendDir'; Write-Host 'Metro Bundler Starting...' -ForegroundColor Cyan; npm start"
    
    Write-Host "⏳ Waiting 5 seconds for Metro to start..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    
    # Check again
    try {
        $metroCheck = Test-NetConnection -ComputerName localhost -Port 8081 -WarningAction SilentlyContinue -ErrorAction SilentlyContinue
        if ($metroCheck.TcpTestSucceeded) {
            Write-Host "✅ Metro bundler is now running!" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Metro might still be starting. Please wait a bit longer." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "⚠️  Could not verify Metro status. Please check the Metro window." -ForegroundColor Yellow
    }
} else {
    Write-Host "[4/4] Metro bundler is already running. Skipping start." -ForegroundColor Green
}
Write-Host ""

# Summary and additional instructions
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Make sure Metro bundler is running (check the Metro window)" -ForegroundColor Gray
Write-Host "  2. On your device, shake it or press 'R' twice to reload the app" -ForegroundColor Gray
Write-Host "  3. If still not working, try:" -ForegroundColor Gray
Write-Host "     - Close and reopen the app on your device" -ForegroundColor Gray
Write-Host "     - Run: adb reverse tcp:8081 tcp:8081" -ForegroundColor Gray
Write-Host ""
Write-Host "For Wi-Fi connection (if USB doesn't work):" -ForegroundColor Yellow
Write-Host "  1. Find your computer's IP address:" -ForegroundColor Gray
Write-Host "     - Run: ipconfig | findstr IPv4" -ForegroundColor Gray
Write-Host "  2. Make sure your device and computer are on the same Wi-Fi network" -ForegroundColor Gray
Write-Host "  3. In Metro bundler window, press 'd' to open Dev Menu" -ForegroundColor Gray
Write-Host "  4. Select 'Settings' → 'Debug server host & port for device'" -ForegroundColor Gray
Write-Host "  5. Enter: YOUR_IP:8081 (e.g., 192.168.1.100:8081)" -ForegroundColor Gray
Write-Host ""
Write-Host "Troubleshooting commands:" -ForegroundColor Yellow
Write-Host "  - Check devices: adb devices" -ForegroundColor Gray
Write-Host "  - Check port forwarding: adb reverse --list" -ForegroundColor Gray
Write-Host "  - Restart ADB: adb kill-server && adb start-server" -ForegroundColor Gray
Write-Host "  - Clear Metro cache: npm start -- --reset-cache" -ForegroundColor Gray
Write-Host ""
