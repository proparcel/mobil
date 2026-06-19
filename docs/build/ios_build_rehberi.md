# iOS (iPhone) build rehberi

## Özet

| Ortam | Yöntem |
|-------|--------|
| **Windows** | EAS Build — `npm run eas:build:ios` (2 GB üstü olmamalı) |
| **macOS** | `npx expo prebuild --platform ios` + Xcode veya `npx expo run:ios` |

`ios/` ve `android/` klasörleri repoda yoktur (`.gitignore`); `expo prebuild` veya EAS ile üretilir.

## Ön koşullar

1. **Expo / EAS hesabı** — `app.config.js` içinde `extra.eas.projectId` tanımlı
2. **Mapbox secret** — EAS’ta `RNMAPBOX_MAPS_DOWNLOAD_TOKEN` (sk.ey…)
3. **Apple Developer** — gerçek cihaz / TestFlight / App Store için

```bash
npm install -g eas-cli
eas login
```

## Windows: EAS ile development build

```powershell
cd c:\ProParcel\mobile\mobil_github\frontend

# Yerel android/apk klasorlerini silip sadece frontend yukler (~100 MB)
npm run eas:build:ios
```

Build bitince QR / link ile iPhone’a **development client** kurulur. Metro:

```powershell
npm run start:dev
```

Telefon ve PC aynı ağda olmalı (veya tunnel).

## macOS: Yerel build

```bash
cd frontend
yarn install

# ios/ üret (bir kez veya config değişince --clean)
npx expo prebuild --platform ios

cd ios && pod install && cd ..

# Simülatör
npx expo run:ios

# Fiziksel iPhone (USB, Developer Mode açık)
npx expo run:ios --device
```

Xcode: `ios/ProParcel.xcworkspace` → Signing & Capabilities → Team seçin.

## 3D modeller (iOS farkı)

- **Android:** Play Asset Delivery + `https://pp-local/...` interceptor
- **iOS:** Sunucudaki `source` URL (HTTPS) + `modelsCache` ile cihaza indirme; haritada doğrudan HTTPS veya cache `file://` kullanılır

## Ortam değişkenleri

`.env` veya EAS secrets:

```
EXPO_PUBLIC_API_URL=https://www.proparcel.com
EXPO_PUBLIC_AUTH_API_URL=https://www.proparcel.com
EXPO_PUBLIC_MODELS_URL=https://www.proparcel.com
EXPO_PUBLIC_MAPBOX_TOKEN=pk....
RNMAPBOX_MAPS_DOWNLOAD_TOKEN=sk.ey....
```

## Sık sorunlar

| Sorun | Çözüm |
|-------|--------|
| Arşiv 2 GB üstü | `npm run eas:build:ios` kullanın (`clean:eas-upload` android/apk/models siler) |
| `ENOSPC` | `npm run clean:eas-temp` + C: boş alan |
| Arşiv boyutu | `npm run eas:inspect:ios` → `%TEMP%\eas-archive-inspect` (hedef &lt; 500 MB) |
| `NODE_ENV` uyarısı | `eas.json` içinde `NODE_ENV` |
| Code signing | Xcode → Team, Bundle ID `com.proparcel.app` |
| Mapbox native hata | `RNMAPBOX_MAPS_DOWNLOAD_TOKEN` + `npx expo prebuild --clean` |
| Eski dev client config | iPhone’dan uygulamayı sil, yeni EAS build kur |
| 3D model seçilemiyor | API `source` alanı ve internet; `[ModelDelivery] iOS` logları |

## İlgili dosyalar

- `app.config.js` — iOS izinleri, Mapbox plugin
- `eas.json` — development / preview / production profilleri
- `src/services/modelDelivery.ts` — platforma göre PAD vs HTTPS cache
