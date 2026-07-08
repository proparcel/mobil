param(
  [ValidateSet('ios', 'android', 'all')]
  [string]$Platform = 'android'
)

. "$PSScriptRoot/metro-ports.ps1"

switch ($Platform) {
  'ios' {
    Stop-MetroPort -Port $METRO_PORT_IOS
  }
  'android' {
    Stop-MetroPort -Port $METRO_PORT_ANDROID
  }
  'all' {
    Stop-MetroPort -Port $METRO_PORT_IOS
    Stop-MetroPort -Port $METRO_PORT_ANDROID
  }
}
