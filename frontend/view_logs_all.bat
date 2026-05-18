@echo off
echo ========================================
echo Android Logcat - Tüm Log'lar
echo ========================================
echo.
echo Tüm log'ları gösteriyor (Ctrl+C ile durdurun)
echo ========================================
echo.

adb logcat | findstr /i "MapboxCustomLayerProbe FilamentCustomLayerModule MapViewRegistry"
