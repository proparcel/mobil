# AAB Release Checklist

Bu dokuman Google Play icin ProParcel Android AAB alirken kontrol edilecek kalici kurallari ve surum kaydini tutar.

## Tek Kaynaklar

- Aktif mobil uygulama: `frontend`
- Android paket adi: `com.proparcel.mobile`
- Google Play ciktilari: `frontend/release_builds/`
- Mapbox token kaynagi: `%USERPROFILE%\.proparcel\mobile.env`
- Release keystore:
  - `frontend/android/keystores/proparcel-release.keystore`
  - `frontend/android/app/keystore.properties`

## AAB Almadan Once

1. `android/app/keystore.properties` mevcut olmali.
2. `android/app/build.gradle` release imzasi debug degil release keystore kullanmali.
3. `npm run mapbox:doctor` basarili olmali.
4. Google Play'e yuklenecek her AAB icin `versionCode` daha once kullanilmamis olmali.
5. `versionName` kullaniciya gorunen surumdur; ayni kalabilir, ama `versionCode` mutlaka artmalidir.
6. Modelsiz yayin icin asset pack listesi bosaltilmali: `npm run clear:android-asset-packs`.

## Modelsiz AAB Komutu

```bat
cd C:\ProParcel\mobile\mobil_github\frontend
npm run build:bundle:no-models
```

Beklenen cikti adi:

```text
release_builds\ProParcel-<versionName>-com-proparcel-mobile-no-models-<YYYYMMDD-HHMMSS>.aab
```

## Dogrulama

Build sonrasi en az su kontroller yapilir:

```bat
Select-String -Path android\app\build.gradle -Pattern "versionCode|versionName"
```

- AAB dosya boyutu not edilir.
- `jarsigner -verify -verbose -certs <aab>` ciktisinda signer `CN=ProParcel` olmali.
- Signer `CN=Android Debug` ise AAB Google Play icin kullanilmaz.
- Modelsiz build icin AAB icinde `pp_model_` veya asset pack girdisi bulunmamali.

## Surum Kaydi

> Not: 2026-06-04 sonrası ana sayfa / auth hediye miktarı hardcoded değildir; `/api/gifts/` merkezi hediye sistemi üzerinden gelir.

| Tarih | versionName | versionCode | Variant | AAB | Not |
|---|---:|---:|---|---|---|
| 2026-05-27 | 1.0.7 | 7 | no-models | `ProParcel-1.0.7-com-proparcel-mobile-no-models-20260527-153724.aab` | Google Play reddetti: versionCode 7 daha once kullanilmis. |
| 2026-05-27 | 1.0.7 | 8 | no-models | `ProParcel-1.0.7-com-proparcel-mobile-no-models-20260527-155008.aab` | Hazirlandi; sonraki yuklemede tekrar kullanilmaz. |
| 2026-05-27 | 1.0.8 | 9 | no-models | `ProParcel-1.0.8-com-proparcel-mobile-no-models-20260527-173525.aab` | Ana sayfa hediye alani 10 Kredi / 10 ProSorgu olarak guncellendi. |
| 2026-05-29 | 1.0.8 | 10 | no-models | `ProParcel-1.0.8-com-proparcel-mobile-no-models-20260529-001242.aab` | Guncel kaynak koddan rebuild; bundle icinde `10 Kredi`/`10 ProSorgu` var, `100 Kredi` yok. |
| 2026-05-29 | 1.0.9 | 11 | no-models | `ProParcel-1.0.9-com-proparcel-mobile-no-models-20260529-004120.aab` | Danisman kaydinda `Adres Bilgileri` release bundle icinde dogrulandi; hediye alani `10 Kredi`, eski `100 Kredi` yok. |
| 2026-05-29 | 1.0.10 | 12 | no-models | `ProParcel-1.0.10-com-proparcel-mobile-no-models-20260529-010138.aab` | Ana ekrana `BUILD 27` release isareti eklendi; bundle icinde `BUILD 27`, `10 Kredi`, `Adres Bilgileri` dogrulandi. |
| 2026-05-30 | 1.0.17 | 19 | no-models | `ProParcel-1.0.17-com-proparcel-mobile-no-models-20260530-180443.aab` | Guncel yeniden derleme; manifest 1.0.17/19 dogrulandi. |
| 2026-05-30 | 1.0.18 | 20 | no-models | `ProParcel-1.0.18-com-proparcel-mobile-no-models-20260530-185752.aab` | Danisman firma secimi company_profile_id; profil/kurumsal kayitta vergi alanlari kaldirildi; sorgu detay harita fitBounds. |
| 2026-06-02 | 1.0.19 | 21 | no-models | `ProParcel-1.0.19-com-proparcel-mobile-no-models-20260602-080058.aab` | Landing Basla butonu; misafir Emlak Vitrini; Pro sorgu ada/parsel filtresi; @gorhom/portal Metro patch. |
| 2026-06-02 | 1.0.20 | 22 | no-models | `ProParcel-1.0.20-com-proparcel-mobile-no-models-20260603-025422.aab` | Yeniden derleme (guncel kaynak). |
| 2026-06-03 | 1.0.21 | 23 | no-models | `ProParcel-1.0.21-com-proparcel-mobile-no-models-20260603-045608.aab` | Yeniden derleme. |
| 2026-06-03 | 1.0.22 | 24 | no-models | `ProParcel-1.0.22-com-proparcel-mobile-no-models-20260603-054203.aab` | Yeniden derleme. |
| 2026-06-03 | 1.0.23 | 25 | no-models | `ProParcel-1.0.23-com-proparcel-mobile-no-models-20260603-142423.aab` | Yeniden derleme. |

iOS sürüm kaydı ve EAS kuralları: `docs/build/ios_release_checklist.md` — kullanıcı sürümü Android `versionName` ile hizalı (ör. 2.0.2); son doğru iOS referansı 2.0.1, bir sonraki iOS build ≥ 2.0.2.
