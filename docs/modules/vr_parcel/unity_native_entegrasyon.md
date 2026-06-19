# VR Parsel — Unity Native Entegrasyon



## Unity projesi



- Konum: `unity/vrParcel/`
- Sahne kurulumu: `unity/vrParcel/SCENE_SETUP.md`
- **Android (Windows, önerilen ilk adım):** [android_windows_unity_build.md](./android_windows_unity_build.md)
- **Mac Xcode adımları:** [mac_xcode_unity_build.md](./mac_xcode_unity_build.md)
- Unity 6 LTS (veya ekip onaylı stabil LTS)
- Paketler: AR Foundation, ARKit XR Plugin, ARCore XR Plugin, TextMeshPro



## Unity as a Library (özet)

**Önerilen sıra:** Android (Windows) → iOS (Mac).

### Android

1. **ProParcel → VR → Create VrParcel Scene**
2. **ProParcel → VR → Configure Android Build Settings**
3. Export → `builds/android/unityLibrary/`
4. `npm run prebuild:android:safe` → `withUnityLibraryEmbed.js`
5. `npm run android` — ARCore cihazda doğrula

### iOS (sonra)

1. **ProParcel → VR → Configure iOS Build Settings**
2. Export → `builds/ios/`
3. `npx expo prebuild --platform ios` → `withUnityFrameworkEmbed.js`
4. Xcode lokal build



## React Native bridge



| Platform | Dosya |
|----------|--------|
| Android host | `modules/vrParcel/native/android/VrUnityHost.kt` |
| Android module | `modules/vrParcel/native/android/VrUnityModule.kt` |
| Android view | `modules/vrParcel/native/android/VrUnityViewManager.kt` |
| Android events | `modules/vrParcel/native/android/VrUnityEventEmitter.kt` |
| Capabilities Android | `modules/vrParcel/native/android/VrArCapabilitiesModule.kt` |
| iOS host | `modules/vrParcel/native/ios/VrUnityHost.swift` |
| iOS module | `modules/vrParcel/native/ios/VrUnityModule.swift` + `.m` |
| iOS view | `modules/vrParcel/native/ios/VrUnityViewManager.swift` |
| Capabilities iOS | `modules/vrParcel/native/ios/VrArCapabilitiesModule.swift` |
| JS | `modules/vrParcel/native/VrUnityModule.ts` |
| Expo plugin (bridge) | `plugins/withVrParcelNativeModules.js` |
| Expo plugin (Android Unity) | `plugins/withUnityLibraryEmbed.js` |
| Expo plugin (iOS Unity) | `plugins/withUnityFrameworkEmbed.js` |
| Mac script | `frontend/scripts/embed-unity-ios.sh` |
| Unity iOS plugin | `unity/vrParcel/Assets/Plugins/iOS/VrParcelNativeEmitBridge.mm` |



`isAvailable()` **yalnızca** UnityFramework embed + `VR_UNITY_LINKED` ile `true` döner. Flag tek başına eklenmez.



## Session JSON sözleşmesi



```json
{
  "parcel": { "parcelId", "center", "polygon", ... },
  "mode": "lidar_precise | arkit_standard | arcore_standard",
  "mapReferences": {
    "userPoint": { "lat", "lon" },
    "referenceA": { "lat", "lon" },
    "referenceB": { "lat", "lon" }
  }
}
```



## Unity mesajları (RN → Unity)



| Metod | Parametre |
|-------|-----------|
| `OnOpenSession` | JSON string |
| `ComputeCalibrationFromThreePoints` | — |
| `DrawParcel` | — |
| `ApplyFineTune` | `"dx,dz,dyaw"` CSV |
| `OnScreenTap` | `"x,y"` ekran koordinatı |
| `OnCloseSession` | — |



## Unity → RN olayları



| Olay | Ne zaman |
|------|----------|
| `ar_step_changed` | AR tap adımı |
| `calibration_complete` | 3-nokta transform |
| `parcel_drawn` | World LineRenderer çizimi |



## AR davranış garantileri



- AR tap: Unity `ReferencePointCapture` plane/depth raycast
- Calibration: 3-nokta similarity transform (`CalibrationTransformCalculator`)
- Parsel: lat/lon → local m → AR world; `LineRenderer.useWorldSpace = true`
- RN SVG/GPS overlay Unity aktifken kullanılmaz
- GPS/pusula parsel çizimi için kullanılmaz



## İzinler



RN tarafında BottomSheet sonrası kamera + konum istenir (`vrPermissions.ts`).

`app.config.js`: `NSCameraUsageDescription`, Android `CAMERA`, konum izinleri + native plugin'ler.



## Build sırası (Mac, ilk doğrulama)



```bash
# 1) Unity export → builds/ios/
# 2)
cd frontend
npx expo prebuild --platform ios --clean
cd ios && pod install
# 3) Xcode → Run device
npm run start:ios-dev
```



EAS cloud build, Xcode lokal doğrulama sonrası custom workflow ile genişletilecek.



## ARCore / ARKit



- iOS: `VrArCapabilitiesModule` → ARKit + LiDAR bayrakları
- Android: `ArCoreApk.checkAvailability` → `supportsARCore`
- Geospatial / Cloud Anchor ilk sürümde yok
