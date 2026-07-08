# Android: yerel debug vs EAS release

## Giriş noktaları (`frontend/` kökü)

| Dosya | Ne yapar |
|-------|----------|
| `start_android.bat` | Metrosuz build (Metro açık olmalı, 8082) |
| `start_android_metro.bat` | Metro kapalıysa aç + build |
| `start_ios.bat` | Metrosuz — Metro açmaz, açıksa URL gösterir |
| `start_ios_metro.bat` | Metro kapalıysa aç (8081) |

Portlar: iOS **8081**, Android **8082** (`scripts/metro-ports.ps1`).

## Günlük kullanım

```powershell
cd mobile\mobil_github\frontend

# Tek tık veya:
start_android_metro.bat    # Android — her şey
start_ios_metro.bat        # iPhone Metro

# Metro zaten açıksa (ör. iOS Metro 8081 çalışırken Android build):
start_android.bat          # Sadece build, Metro'ya dokunmaz
start_ios.bat              # Sadece URL / odaklan
```

npm eşdeğerleri: `start:android_metro`, `start:android`, `start:ios_metro`, `start:ios`

## Release (Metro gerekmez)

```powershell
npm run build:apk:no-models
npm run eas:release:android
```

Detay: `doc/metro-ports-windows.md`
