# Mapbox Token Architecture

## Tek Kalici Kaynak

Bu projede Mapbox tokenlari icin kalici kaynak:

```text
%USERPROFILE%\.proparcel\mobile.env
```

Bu dosya makineye ozeldir, repo clone'lari arasinda ortaktir ve git'e girmez.
`frontend/.env` sadece repo-local override icindir.

## Tokenlar

```env
EXPO_PUBLIC_MAPBOX_TOKEN=pk...
RNMAPBOX_MAPS_DOWNLOAD_TOKEN=sk...
```

- `EXPO_PUBLIC_MAPBOX_TOKEN` (`pk.*`): uygulama calisirken harita icin kullanilir.
- `RNMAPBOX_MAPS_DOWNLOAD_TOKEN` (`sk.*`): Android/AAB native build sirasinda Mapbox SDK indirmek icin kullanilir.
- Eski `MAPBOX_DOWNLOADS_TOKEN` adi sadece geriye uyumluluk icin okunur; yeni dosyalara yazilmaz.

## Okuma Sirasi

Butun Node build scriptleri ayni loader'i kullanir:

```text
scripts/load-env-file.js
```

Okuma sirasi:

1. `%USERPROFILE%\.proparcel\mobile.env`
2. `frontend/.env`
3. Gercek `process.env` / CI / EAS ortam degiskenleri

`process.env` en yuksek onceliktir. Bu sayede CI/EAS kendi secret/env degerini ezdirmez.

## Android ve AAB

Local Android ve Google Play AAB build'leri su script ile tokeni tek kaynaktan alip Gradle'a yazar:

```text
scripts/sync-android-mapbox-token.js
```

Bu script varsayilan local dev modunda `RNMAPBOX_MAPS_DOWNLOAD_TOKEN=sk...` yoksa uyarip devam eder.
Google Play/AAB yollarinda `--strict` ile calisir ve token yoksa build'i durdurur.

Calisan yollar:

```bat
npm run android
npm run build:bundle:no-models
npm run build:bundle:with-models
build_google_play.bat
build_google_play_no_models.bat
```

Hepsi build oncesi `android/gradle.properties` icine su satiri uretir:

```properties
MAPBOX_DOWNLOADS_TOKEN=sk...
```

Bu uretilmis dosyayi manuel duzenlemeyin.

## EAS

`eas.json` icine `sk.*` token yazilmaz. Cloud EAS build icin ayni isimde secret/env tanimli olmalidir:

```text
RNMAPBOX_MAPS_DOWNLOAD_TOKEN
```

Public `EXPO_PUBLIC_*` degerleri `scripts/sync-eas-env.js` ile `eas.json` profillerine senkronize edilir.

## Kontrol

Token durumunu maskeli gormek icin:

```bat
npm run mapbox:doctor
```

Eksikse tek dosyaya ekleyin:

```bat
mkdir %USERPROFILE%\.proparcel
notepad %USERPROFILE%\.proparcel\mobile.env
```
