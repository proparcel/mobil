# ProParcel Platform Stratejisi

## Özet

| Platform | Build / Dağıtım | Expo Kullanımı |
|----------|-----------------|----------------|
| **iOS**  | EAS Build (`eas:ios`, `eas:dev`) | ✅ Tam Expo – EAS ile build, Expo config |
| **Android** | React Native CLI (`npm run android`) | ⚠️ Sadece bağımlılık – Expo modülleri paket içinde |

## Detay

### iOS
- **Build:** `eas build --platform ios` veya `npx expo run:ios` (detay: `docs/build/ios_build_rehberi.md`)
- **Config:** `app.config.js` içindeki `expo.ios` bloğu
- **3D modeller:** HTTPS `source` + `modelsCache` (Android PAD yok)
- Expo tooling ve config tam olarak iOS için kullanılıyor.

### Android
- **Build:** `react-native run-android` (EAS kullanılmıyor)
- **Config:** `android/` klasöründeki native Gradle dosyaları
- `expo-dev-client` bağımlılık olduğu için Android APK içinde Expo modülleri bulunuyor.
- Bu yüzden `android/settings.gradle` içinde Expo autolinking gerekiyor; aksi halde build başarısız olur.

## Neden Android’de de Expo Config Var?

`expo-dev-client` `package.json` bağımlılığı olduğu için:
- Android build sırasında `expo`, `expo-modules-core` vb. derlenir
- `android/settings.gradle` içindeki `expo-autolinking-settings` ve `expoAutolinking.useExpoModules()` bu modüllerin linklenmesi için zorunlu

**Özet:** Android için EAS kullanılmıyor ama Expo paketleri bağımlılık olduğundan Android build’inde Expo Gradle yapılandırması gerekiyor.
