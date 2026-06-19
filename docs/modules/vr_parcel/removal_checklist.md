# VR Parsel Modülü — Kaldırma Checklist

Modülü tamamen kaldırmak için sırayla:

## 1. Feature flag

- `EXPO_PUBLIC_VR_PARCEL_ENABLED=0` veya `featureFlag.ts` içinde `VR_PARCEL_ENABLED = false`

## 2. React Native entegrasyon

- [`App.tsx`](../../../frontend/App.tsx): `registerVrParcelRoute` import ve JSX satırını sil
- [`index.tsx`](../../../frontend/screens/routes/index.tsx):
  - `modules/vrParcel` import
  - `syncLastParcelForVr` çağrısı
  - `syncSelectedParcelForVr` useEffect
  - `<VrPillBarButton />`

## 3. Native Android

- `MainApplication.kt`: `VrUnityPackage` import + `add(VrUnityPackage())`
- Sil: `android/.../vrparcel/VrUnityModule.kt`, `VrUnityPackage.kt`
- Unity export varsa: `unityLibrary` Gradle referanslarını kaldır

## 4. Native iOS

- `VrUnityModule.swift` / `.m` Xcode projesinden çıkar
- UnityFramework embed adımlarını geri al

## 5. Kod klasörleri

- `frontend/modules/vrParcel/` (tüm ağaç)
- `unity/vrParcel/` (Unity projesi)

## 6. Dokümantasyon

- `docs/modules/vr_parcel/` klasörünü sil
- [`architecture.md`](../../architecture.md) doküman ağacından VR satırını sil

## 7. app.config.js (opsiyonel)

- Kamera izin metinlerini VR öncesi haline döndür

## Doğrulama

- Pill bar'da VR ikonu yok
- `vr-parcel` route yok
- Build hatasız
- grep `vrParcel` / `VrUnity` sıfır sonuç (doküman hariç istenirse)
