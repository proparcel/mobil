# VR Parsel — Android Unity (Windows geliştirme)

**Not:** ARCore / saha AR modülü `_backup/vrParcel-ar-viewer/` altına taşındı.  
Bu rehber **parsel eğim (ParcelTerrain3d)** Unity export içindir.

## Ön koşullar (Windows)

- Unity Hub + Unity 6 LTS
- **Android Build Support** (SDK/NDK/JDK)
- Node.js, Java 17, Android Studio / platform-tools

## 1. Unity projesi

Unity Hub → `unity/vrParcel/`

Editor menüsü:

1. **ProParcel → Terrain3D → Configure Android Build Settings**
2. **ProParcel → Terrain3D → Clean Android Export Folder**
3. **File → Build Settings → Android**
   - Export Project ✓
   - Export → `builds/android/`

Export sonrası beklenen:

```
unity/vrParcel/builds/android/unityLibrary/
```

## 2. React Native Android prebuild

```powershell
cd mobile\mobil_github\frontend
npm run prebuild:android:safe
```

`withUnityLibraryEmbed.js` export varsa otomatik:

- `settings.gradle` → `:unityLibrary`
- `app/build.gradle` → `implementation project(':unityLibrary')`
- `buildConfigField VR_UNITY_LINKED true`
- `MainActivity` → Unity pause/resume/destroy

Export **yoksa** `VR_UNITY_LINKED=false` — crash olmaz, `isAvailable()` false kalır.

## 3. Cihazda çalıştır

```powershell
npm run android:usb
# veya
npm run android
```

Metro açıkken VR akışını test edin.

## 4. Beklenen akış

1. Basit Sorgu → VR
2. Harita User / A / B
3. `isAvailable()` → **true** (unityLibrary linkli build)
4. Unity AR view (ARCore)
5. Ekran tap → plane raycast → User/A/B world points
6. 3-nokta calibration → `calibration_complete`
7. Parseli Çiz → world-space LineRenderer
8. Telefonu çevirince parsel sabit

## 5. Native köprü (repo)

| Dosya | Rol |
|-------|-----|
| `VrUnityHost.kt` | UnityPlayer (reflection), UnitySendMessage |
| `VrUnityModule.kt` | isAvailable, session JSON |
| `VrUnityViewManager.kt` | RN `VrUnityView` + tap |
| `VrUnityEventEmitter.kt` | Unity → RN events |
| `VrParcelNativeCallback.cs` | AndroidJavaClass → emit |

## 6. Sorun giderme

| Belirti | Çözüm |
|---------|--------|
| Sanal zemin / gökyüzü, gerçek kamera yok | unityLibrary **boş/eski export** — `ScriptingAssemblies.json` içinde `Assembly-CSharp` ve `Unity.XR.ARFoundation` yok. Unity'de Create VrParcel Scene + ARCore + Export; `node scripts/validate-unity-export.js` |
| Export: Vulkan not supported by ARCore | **Player Settings → Android → Graphics APIs** → yalnızca **OpenGLES3** (Vulkan kaldır). Veya **ProParcel → VR → Configure Android Build Settings** tekrar çalıştır |
| Unity yok | Export + `prebuild:android:safe` tekrar |
| ARCore yok | Google Play Services for AR kur |
| Gradle unityLibrary | NDK/SDK sürümlerini RN ile hizala |
| **JDK not found** | **ProParcel → VR → Fix Android JDK/SDK/Gradle Paths** veya Edit → Preferences → External Tools → JDK: `C:\Program Files\Eclipse Adoptium\jdk-17.0.17.10-hotspot` (Embedded JDK kapali) |
| **No Gradle path set / path1 null** | **ProParcel → VR → Fix Android JDK/SDK/Gradle Paths** — Unity bundled Gradle + NDK otomatik ayarlanir. Manuel: External Tools → Gradle → **Installed with Unity (recommended)** |
| **SDK Platform Tools 0.0 < 36.0.0** | `C:\Android\Sdk\platform-tools` guncel degil. `sdkmanager "platform-tools"` ile 36+ kurun; Unity'yi yeniden acin |
| **NDK 27.0 invalid — Unity requires 27.2** | `sdkmanager "ndk;27.2.12479018"` kurun. Sonra **ProParcel → VR → Fix Android JDK/SDK/Gradle Paths** — NDK: `C:\Android\Sdk\ndk\27.2.12479018` |
| **Gradle template version mismatch (expected 23 was 7)** | Eski Unity 2022 export kalmis. **ProParcel → VR → Clean Android Export Folder** sonra tekrar Export |
| XR simulation asset move warnings | **Clean Android Export Folder** XR Temp'i de temizler; veya `Assets/XR/Temp` klasorunu silin |
| Siyah ekran | unityLibrary export tam mı, logcat Unity |

## 7. iOS (sonra)

Mac erişimi → [mac_xcode_unity_build.md](./mac_xcode_unity_build.md)
