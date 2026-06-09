# ProParcel VR Parcel — Unity Project



Unity AR Foundation projesi.



## Hızlı başlangıç — Android (Windows, önerilen)

### Unity Hub'da doğru klasör

**Açın:** `mobile/mobil_github/unity/vrParcel/`  
**Açmayın:** `.../vrParcel/proparcel/` (alt klasör — ProParcel menüsü yok)

Hub'da proje yolu şöyle görünmeli:
`C:\ProParcel\mobile\mobil_github\unity\vrParcel`

1. Unity Hub → **vrParcel** (proparcel değil)

2. **ProParcel → VR → Create VrParcel Scene**

3. **ProParcel → VR → Configure Android Build Settings**

4. XR → Android → ARCore ✓

5. Export → `builds/android/unityLibrary/`

6. `docs/mobile/modules/vr_parcel/android_windows_unity_build.md`



## iOS (Mac, sonra)



→ `docs/mobile/modules/vr_parcel/mac_xcode_unity_build.md`



## Scriptler



- `VrParcelBridge.cs` — session, calibration, draw

- `ReferencePointCapture.cs` — AR raycast tap

- `ParcelBorderRenderer.cs` — world-space LineRenderer

- `VrParcelNativeCallback.cs` — Unity → RN (Android + iOS)



Detay: `SCENE_SETUP.md`

