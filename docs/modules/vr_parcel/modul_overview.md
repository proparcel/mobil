# VR Parsel Modülü — Genel Bakış

ProParcel mobil uygulamasında son **Basit Sorgu** parselini kamera üzerinde AR world içinde göstermek için izole modül. Parsel sorgusu modül içinde yapılmaz; referans noktalı lokal kalibrasyon ile gerçek koordinat dünyası AR dünyasına hizalanır.

## Klasör haritası

| Katman | Konum |
|--------|--------|
| React Native modül | `frontend/modules/vrParcel/` |
| Unity AR motoru | `unity/vrParcel/` |
| Android native bridge | `frontend/android/.../vrparcel/` |
| iOS native bridge (kaynak) | `frontend/modules/vrParcel/native/ios/` |
| Dokümantasyon | `docs/modules/vr_parcel/` |

## Feature flag

`EXPO_PUBLIC_VR_PARCEL_ENABLED`:

- `1` / `true` → prod'da açık
- `0` / `false` → kapalı
- Tanımsız + `__DEV__` → geliştirme build'inde açık

Kaynak: `modules/vrParcel/featureFlag.ts`

## Entegrasyon noktaları (kaldırma için)

1. [`App.tsx`](../../../frontend/App.tsx) — `registerVrParcelRoute(Stack)`
2. [`index.tsx`](../../../frontend/screens/routes/index.tsx) — `VrPillBarButton`, `syncLastParcelForVr`, `syncSelectedParcelForVr`
3. [`app.config.js`](../../../frontend/app.config.js) — kamera izin metinleri
4. [`MainApplication.kt`](../../../frontend/android/app/src/main/java/com/proparcel/mobile/MainApplication.kt) — `VrUnityPackage`
5. [`architecture.md`](../../architecture.md) — doküman ağacı satırı

## Veri kaynağı

Son parsel: Basit modda `selectedParcelForModal || simpleModeParcels[last]`. Pro mod VR hedefi değildir (Basit Sorgu sonucu).

## İlgili dokümanlar

- [kullanici_akisi.md](./kullanici_akisi.md)
- [kalibrasyon_akisi.md](./kalibrasyon_akisi.md)
- [veri_sozlesmesi.md](./veri_sozlesmesi.md)
- [unity_native_entegrasyon.md](./unity_native_entegrasyon.md)
- [android_windows_unity_build.md](./android_windows_unity_build.md) — **Android ARCore + Unity (Windows, önerilen ilk adım)**
- [mac_xcode_unity_build.md](./mac_xcode_unity_build.md) — Unity iOS export + Xcode lokal doğrulama
- [removal_checklist.md](./removal_checklist.md)
- [test_matrisi.md](./test_matrisi.md)
