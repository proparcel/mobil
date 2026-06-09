# VR Parsel Unity Sahnesi — Kurulum

Unity projesi: `mobile/mobil_github/unity/vrParcel/`

## Gerekli paketler

- AR Foundation
- ARKit XR Plugin (iOS)
- ARCore XR Plugin (Android)
- TextMeshPro

## Sahne hiyerarşisi (`VrParcelScene`)

```
VrParcelScene
├── AR Session
├── XR Origin (AR Session Origin)
│   ├── Main Camera
│   ├── AR Plane Manager
│   ├── AR Raycast Manager
│   ├── AR Anchor Manager
│   ├── AR Occlusion Manager (LiDAR modu)
│   └── AR Mesh Manager (LiDAR modu, opsiyonel)
├── VrArSessionController
├── ReferencePointCapture
├── VrParcelWorldRoot          ← kamera child'ı DEĞİL; XR Origin altında sabit kök
├── ParcelBorderRenderer       ← LineRenderer useWorldSpace=true
├── VrParcelBridge
└── Canvas (Screen Space)
    └── VrStepUiController
```

## Script bağlantıları

| GameObject | Script | Referanslar |
|------------|--------|-------------|
| XR Origin | `VrArSessionController` | arSession, sessionOrigin, planeManager, occlusionManager, meshManager |
| ReferencePointCapture | `ReferencePointCapture` | raycastManager, occlusionManager, arCamera |
| ParcelBorderRenderer | `ParcelBorderRenderer` | lineMaterial, cornerMarkerPrefab, labelPrefab |
| VrParcelBridge | `VrParcelBridge` | referenceCapture, parcelRenderer, uiController, arSessionController |
| Canvas | `VrStepUiController` | titleText, messageText, statusText, fineTunePanel, referenceCapture |

## RN → Unity mesaj sözleşmesi

| UnitySendMessage | Metod | Açıklama |
|------------------|-------|----------|
| `VrParcelBridge` | `OnOpenSession` | JSON: `{ parcel, mode, mapReferences }` |
| `VrParcelBridge` | `ComputeCalibrationFromThreePoints` | 3 AR noktasından transform |
| `VrParcelBridge` | `DrawParcel` | World-space LineRenderer |
| `VrParcelBridge` | `ApplyFineTune` | `"dx,dz,dyaw"` CSV string |
| `VrParcelBridge` | `OnScreenTap` | `"x,y"` ekran koordinatı → AR raycast |
| `VrParcelBridge` | `OnCloseSession` | Oturumu kapat |

## Unity → RN olayları

| Olay | Ne zaman |
|------|----------|
| `ar_step_changed` | AR tap adımı değişince |
| `calibration_complete` | 3-nokta transform hesaplanınca |
| `parcel_drawn` | LineRenderer world çizimi bitince |

Native: `VrParcelNativeCallback.Emit` → iOS `VrParcelEmitEvent`

## Mod davranışı

| Mod | AR özellikleri |
|-----|----------------|
| `lidar_precise` | Depth raycast öncelikli, occlusion + mesh aktif |
| `arkit_standard` | Plane raycast, estimated ground fallback |
| `arcore_standard` | Plane raycast (Android) |

## Android export (Faz 3 — Windows geliştirme)

1. Unity Editor → **ProParcel → VR → Configure Android Build Settings**
2. Build Settings → Android → Export Project → `builds/android/`
3. `npm run prebuild:android:safe` (`withUnityLibraryEmbed.js`)
4. `npm run android` — ARCore cihaz

Detay: `docs/mobile/modules/vr_parcel/android_windows_unity_build.md`

## iOS export

1. Unity Editor → **ProParcel → VR → Create VrParcel Scene**
2. **ProParcel → VR → Configure iOS Build Settings**
3. Build Settings → iOS → Export → `builds/ios/`
4. Mac: `frontend/scripts/embed-unity-ios.sh` + `npx expo prebuild --platform ios`
5. Plugin `withUnityFrameworkEmbed.js` UnityFramework embed + `VR_UNITY_LINKED` (export varken)
6. `VrUnityHost.swift` / `VrUnityModule.swift` — repo’da aktif (UnitySendMessage)
7. Unity plugin: `Assets/Plugins/iOS/VrParcelNativeEmitBridge.mm` → RN event bus

Ayrıntılı Mac checklist: `docs/mobile/modules/vr_parcel/mac_xcode_unity_build.md`

## Android export (Faz 3)

1. Export Project → `unityLibrary` modülü
2. `settings.gradle` içine include edin
3. `VrUnityModule.kt` → `UnityPlayer` activity/view host
