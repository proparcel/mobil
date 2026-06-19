# Metro Bundler Connection Troubleshooting Guide

## 🔴 Common Error: "Unable to load script"

This error occurs when your React Native app cannot connect to the Metro bundler running on your development machine.

## ✅ Quick Fix

Run the automated fix script:

**PowerShell:**
```powershell
cd c:\ProParcel\mobile\mobil_github\frontend
.\fix_metro_connection.ps1
```

**Batch (CMD):**
```cmd
cd c:\ProParcel\mobile\mobil_github\frontend
fix_metro_connection.bat
```

## 📋 Manual Troubleshooting Steps

### 1. Check Device Connection

First, verify your Android device is connected:

```powershell
# Check ADB path
C:\Android\Sdk\platform-tools\adb.exe devices
```

You should see your device listed. If not:
- Enable USB Debugging on your device:
  - Settings → About Phone → Tap "Build Number" 7 times
  - Settings → Developer Options → Enable "USB Debugging"
- If device shows "unauthorized", check your device and allow USB debugging

### 2. Setup ADB Port Forwarding (USB Connection)

For USB-connected devices, you need to forward port 8081:

```powershell
C:\Android\Sdk\platform-tools\adb.exe reverse tcp:8081 tcp:8081
```

Verify it worked:
```powershell
C:\Android\Sdk\platform-tools\adb.exe reverse --list
```

You should see: `tcp:8081 tcp:8081`

### 3. Start Metro Bundler

Make sure Metro bundler is running:

```powershell
cd c:\ProParcel\mobile\mobil_github\frontend
npm start
```

Or with cache reset:
```powershell
npm start -- --reset-cache
```

Metro should start on `http://localhost:8081`

### 4. Reload the App

On your device:
- Shake the device to open Dev Menu
- Or press `R` twice (if keyboard connected)
- Select "Reload"

Or from command line:
```powershell
C:\Android\Sdk\platform-tools\adb.exe shell input text "RR"
```

## 🌐 Wi-Fi Connection (Alternative to USB)

If USB connection doesn't work, you can connect via Wi-Fi:

### Step 1: Find Your Computer's IP Address

**Windows:**
```powershell
ipconfig | findstr IPv4
```

Look for your local network IP (e.g., `192.168.1.100`)

### Step 2: Connect Device via ADB over Wi-Fi

**First time setup (requires USB initially):**
```powershell
# Connect via USB first
adb devices

# Get device IP (check device Wi-Fi settings or use):
adb shell ip addr show wlan0

# Connect via TCP/IP (replace DEVICE_IP with actual IP)
adb tcpip 5555
adb connect DEVICE_IP:5555

# Disconnect USB, device should still be connected
adb devices
```

### Step 3: Configure Metro for Wi-Fi

1. Start Metro bundler: `npm start`
2. In Metro window, press `d` to open Dev Menu
3. Select "Settings" → "Debug server host & port for device"
4. Enter: `YOUR_COMPUTER_IP:8081` (e.g., `192.168.1.100:8081`)
5. Reload the app

## 🔧 Advanced Troubleshooting

### Clear All Caches

```powershell
# Clear Metro cache
cd c:\ProParcel\mobile\mobil_github\frontend
Remove-Item -Recurse -Force .metro-cache -ErrorAction SilentlyContinue

# Clear node_modules cache
Remove-Item -Recurse -Force node_modules\.cache -ErrorAction SilentlyContinue

# Clear Android build cache
Remove-Item -Recurse -Force android\app\build -ErrorAction SilentlyContinue

# Restart Metro with clean cache
npm start -- --reset-cache
```

### Restart ADB Server

If ADB is having issues:

```powershell
C:\Android\Sdk\platform-tools\adb.exe kill-server
C:\Android\Sdk\platform-tools\adb.exe start-server
C:\Android\Sdk\platform-tools\adb.exe devices
```

### Check Metro Port

Verify Metro is actually running on port 8081:

```powershell
netstat -an | findstr ":8081"
```

Or test connection:
```powershell
Test-NetConnection -ComputerName localhost -Port 8081
```

### Check Firewall

Windows Firewall might be blocking port 8081:

1. Open Windows Defender Firewall
2. Click "Advanced settings"
3. Check "Inbound Rules" for port 8081
4. If blocked, create a new rule to allow port 8081

### Network Security Configuration

If you're still having issues, check if your app has network security restrictions. The AndroidManifest.xml should have:

```xml
<uses-permission android:name="android.permission.INTERNET"/>
```

For development, you might also need to allow cleartext traffic (HTTP) in `android/app/src/debug/AndroidManifest.xml`:

```xml
<application
    android:usesCleartextTraffic="true"
    ...>
```

## 📱 Device-Specific Issues

### Samsung Devices
- May require additional USB drivers
- Download Samsung USB drivers from Samsung's website

### Huawei/Xiaomi Devices
- May require enabling "USB Debugging (Security Settings)"
- Check device-specific developer options

### Emulator
- Android Emulator uses `10.0.2.2` instead of `localhost`
- Metro should work automatically with emulator
- If not, check emulator network settings

## 🚀 Quick Reference Commands

```powershell
# Check devices
adb devices

# Setup port forwarding
adb reverse tcp:8081 tcp:8081

# Check port forwarding
adb reverse --list

# Restart ADB
adb kill-server && adb start-server

# Start Metro
npm start

# Start Metro with cache reset
npm start -- --reset-cache

# Reload app
adb shell input text "RR"
```

## 📝 Still Not Working?

1. **Check Metro logs**: Look at the Metro bundler terminal for errors
2. **Check device logs**: `adb logcat | findstr ReactNative`
3. **Try different USB cable/port**: Some cables are charge-only
4. **Restart everything**: Device, computer, ADB, Metro
5. **Check React Native version compatibility**: Ensure Metro and React Native versions are compatible

## 🔗 Related Files

- `metro.config.js` - Metro bundler configuration
- `start_metro.bat` - Simple Metro starter script
- `fix_metro_connection.ps1` - Automated fix script (PowerShell)
- `fix_metro_connection.bat` - Automated fix script (Batch)
- `ADB_FIX.md` - ADB installation troubleshooting
