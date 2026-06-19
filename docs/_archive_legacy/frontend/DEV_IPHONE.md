# iPhone — canlı geliştirici testi (TestFlight yok)

TestFlight mağaza/test dağıtımı içindir. Günlük geliştirme: **EAS development client + Metro**.

## Standart komutlar (iOS-only, Mac yok)

Tüm komutlar: `cd c:\ProParcel\mobile\mobil_github\frontend`

| Ne zaman | Komut |
|----------|--------|
| Native / yeni IPA (kamera, plugin, `app.config.js`) | `npm run eas:build:ios` |
| Her gün canlı JS (Metro) | `npm run start:ios-dev` |

**Not:** Android build kullanılmaz. Sadece bu iki komut + telefonda dev client → Enter URL (`http://BILGISAYAR_IP:8081`).

Wi‑Fi bağlanmazsa yedek: `npm run start:ios-dev:tunnel` (LAN yerine).

## ikon / favicon (iPhone)

EAS `.easignore` icinde **tum `.png` ignore** ediliyordu → iOS IPA’da ne uygulama ikonu ne `favicon.png` vardi. Duzeltildi; **yeni dev build** sart:

```powershell
npm run eas:build:ios
```

Android yerel `run-android` bu ignore’dan etkilenmez (ikonlar diskten gelir).

## Bir kez kurulum

1. TestFlight **ProParcel** varsa kaldırın (aynı `com.proparcel.app`).
2. iPhone Safari:
   https://expo.dev/accounts/sercanyanaz/projects/frontend/builds/4924f3b0-c338-4024-9141-11eb815c3e14
3. **Install** → Ayarlar → VPN ve Cihaz Yönetimi → güven.
4. Cihaz kaydı (bir kez): `eas device:create` (profil onayı).

Yeni development IPA gerekirse:

```powershell
npm run eas:build:ios
```

## Her gün (canlı JS)

```powershell
cd c:\ProParcel\mobile\mobil_github\frontend
npm run start:ios-dev
```

(`dev:iphone` ile aynı amaç; standart: `start:ios-dev`.)

**Iki farkli QR:**
| QR nerede? | Ne ise yarar? |
|------------|----------------|
| expo.dev **build** sayfasi | Sadece IPA **kurulum** (bir kez) |
| **Metro** terminali (dev:iphone sonrasi) | Canli sunucuya **baglanti** |

Metro acikken telefonda:
- Dev uygulamayi ac → **Metro terminalindeki QR** okut, veya
- **Enter URL manually** → `http://BILGISAYAR_IP:8081` (ornek: `http://192.168.1.102:8081`)

IP ogrenmek: `powershell -File scripts/print-dev-server-url.ps1`

- Telefon ve PC **aynı Wi‑Fi**.
- Kod değişince otomatik yenilenir; `r` = reload.

Farklı ağ: `npm run start:ios-dev:tunnel` (ngrok gerekir).

## Ne zaman yeni IPA?

| Değişiklik | Yeterli |
|------------|---------|
| `.tsx` / `.ts` / servisler | Sadece Metro + reload |
| `app.config.js`, native plugin, yeni npm native paket | `npm run eas:build:ios` + tekrar Install |

## Çökme

1. Doğru ikon: **development client** (TestFlight değil).
2. Metro açık mı? `npm run stop:metro` → `npm run start:ios-dev`.
3. `"main" has not been registered` → `index.js` içinde `registerRootComponent(App)` kullanılmalı; Metro’yu `r` ile reload edin.
4. Terminaldeki kırmızı `[ProParcel] JS` logunu kaydedin.
