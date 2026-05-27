# Android: yerel debug vs EAS release

İki ayrı hat; birbirini silmez.

## Yerel fiziksel cihaz (Windows)

Bir kez native proje:

```powershell
cd mobile\mobil_github\frontend
npm run android:setup
```

`EBUSY: resource busy` (android klasoru kilitli) ise:

```powershell
npm run unlock:android
npm run android:setup
```

Android Studio / Emulator / Explorer’da `android` klasorunu kapat.

Hala `EBUSY`:

1. Gorev Yoneticisi -> **Java(TM) Platform** / OpenJDK islemlerini sonlandir (Gradle kilidi).
2. `npm run unlock:android`
3. Olmazsa PC yeniden baslat, sonra `npm run android:setup`.

`android/` yarim kalmissa (gradlew yok) mutlaka silinmeli veya `android._stale_*` olarak yeniden adlandirilmali.

Günlük geliştirme:

```powershell
npm run stop:metro
npm run start:dev
# ikinci terminal:
npm run android:dev
```

Yerel release APK (Play değil):

```powershell
npm run build:apk:no-models
```

`android/` gitignore'da; sadece senin makinede kalır.

## EAS / Play Store release

Cloud build — yerel `android/` kullanılmaz (`.easignore` içinde `android` var).

```powershell
npm run eas:sync-env
npm run eas:release:android
```

`clean:eas-upload` artık **android/ios silmez**. EAS yine cloud'da prebuild yapar.

İsteğe bağlı agresif temizlik (yerel android'i de siler — dikkat):

```powershell
npm run clean:eas-upload:native
```

## Özet

| Amaç | Komut | Yerel android/ |
|------|--------|----------------|
| USB debug | `android:setup` → `android:dev` | Gerekli, korunur |
| Yerel APK | `build:apk:*` | Gerekli |
| Play AAB | `eas:release:android` | Kullanılmaz (EAS üretir) |
| iOS EAS | `eas:release:ios` | Etkilenmez |
