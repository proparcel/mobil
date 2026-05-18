@echo off
echo ========================================
echo Android Logcat - Filament Custom Layer
echo ========================================
echo.
echo Filtreler:
echo - MapboxCustomLayerProbe
echo - FilamentCustomLayerModule
echo - MapViewRegistry
echo.
echo Log'ları görmek için Ctrl+C ile durdurun
echo ========================================
echo.

adb logcat -s MapboxCustomLayerProbe:D FilamentCustomLayerModule:D MapViewRegistry:D
