# USB ile Android debug: Metro (8082) ve istege bagli Django (8000) port yonlendirme.
$ErrorActionPreference = "SilentlyContinue"
. "$PSScriptRoot/metro-ports.ps1"
. "$PSScriptRoot/metro-smart.ps1"

Ensure-AdbReverse -Port $METRO_PORT_ANDROID
