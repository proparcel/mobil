# Mobil build ve indirme sunucusu (Android + iOS)

## Genel

| Ayar | Değer |
|------|--------|
| Genel IP | `176.238.6.240` |
| İndirme portu | `8002` |
| İndirme sayfası | http://176.238.6.240:8002/ |
| Android APK | http://176.238.6.240:8002/ProParcel.apk |
| iOS IPA (ham) | http://176.238.6.240:8002/ProParcel.ipa |
| iOS kurulum | Safari → sayfadaki **iOS Kur** (`manifest.plist`) |
| Django sayfa | http://176.238.6.240:8000/apk/ |

Klasör: `app_releases/` (`ProParcel.apk`, `ProParcel.ipa`, `manifest.plist`, `index.html`)

## Tek seferde yayın (önerilen)

```powershell
cd c:\ProParcel\mobile\mobil_github\frontend
.\publish_mobile_release.bat
```

1. Android APK kopyalar / derler
2. iOS: `eas build --platform ios --profile preview` (EAS cloud)
3. IPA → `app_releases\ProParcel.ipa`
4. HTML günceller (Android + iOS linkleri)

Sadece HTML:

```powershell
powershell -File scripts\generate_mobile_download_page.ps1
```

## İndirme sunucusunu başlat

```powershell
.\baslat_app_indirme.bat
```

Sunucu `0.0.0.0:8002` üzerinde dinler.

## Dış erişim için

1. **Windows Firewall:** Yönetici PowerShell → `.\ekle_firewall_apk.ps1`
2. **Router:** TCP `8002` → bu bilgisayarın yerel IP’si (port forwarding)

## Telefonda kurulum

**Android:** Sayfadan APK indir → bilinmeyen kaynaklara izin ver → kur.

**iOS:** iPhone Safari ile http://176.238.6.240:8002/ → **iOS Kur**. Cihaz Apple Developer ad-hoc listesinde olmalı. Bazı iOS sürümlerinde HTTP yerine HTTPS gerekir.

## Sadece Android build

```powershell
.\build_apk.bat
```

## iOS (Windows)

```powershell
npm run eas:ios:preview
```

Log: https://expo.dev/accounts/sercanyanaz/projects/frontend/builds
