# VR Parsel — Mac Xcode + Unity Local Build

İlk doğrulama **Xcode lokal build** ile yapılır. EAS otomasyonu (`withUnityFrameworkEmbed.js`) Unity export mevcut olduğunda `expo prebuild` sırasında devreye girer; export yoksa `VR_UNITY_LINKED` **eklenmez** (crash önlenir).

## Ön koşullar

- macOS + Xcode 15+
- Unity 6 LTS (veya ekip onaylı LTS)
- Node.js, CocoaPods
- ProParcel `frontend` bağımlılıkları kurulu

## 1. Unity projesi

```bash
# Unity Hub → Open
unity/vrParcel/
```

Unity Editor menüsü:

1. **ProParcel → VR → Create VrParcel Scene** — AR sahnesi + script bağlantıları
2. **ProParcel → VR → Configure iOS Build Settings** — platform iOS, sahne build listesinde
3. **Edit → Project Settings → XR Plug-in Management → iOS → ARKit** etkin
4. **File → Build Settings → iOS → Export Project**

Export hedefi (önerilen):

```
unity/vrParcel/builds/ios/
```

Export sonrası beklenen:

```
builds/ios/UnityFramework.framework
builds/ios/Data/
builds/ios/Unity-iPhone.xcodeproj   (referans; host app Expo ios/ kullanır)
```

## 2. Expo iOS prebuild

```bash
cd frontend
npx expo prebuild --platform ios --clean
```

`withUnityFrameworkEmbed.js` export varsa:

- `ios/Frameworks/UnityFramework.framework` kopyalar
- `ios/UnityData/` kopyalar
- `SWIFT_ACTIVE_COMPILATION_CONDITIONS` → `VR_UNITY_LINKED`
- UnityFramework embed + link
- **Copy Unity Data** run script phase ekler

Export yoksa prebuild normal devam eder; `isAvailable()` false kalır.

Alternatif manuel kopya:

```bash
bash scripts/embed-unity-ios.sh
npx expo prebuild --platform ios   # plugin Xcode patch uygular
```

## 3. CocoaPods + Xcode

```bash
cd ios
pod install
open ProParcel.xcworkspace
```

Xcode kontrol listesi:

| Kontrol | Beklenen |
|---------|----------|
| General → Frameworks | `UnityFramework.framework` **Embed & Sign** |
| Build Phases → Copy Unity Data | `ios/UnityData` → app bundle `Data/` |
| Build Settings → Swift Active Compilation Conditions | `VR_UNITY_LINKED` |
| Signing | Development team + cihaz profili |

## 4. Native köprü (repo’da hazır)

| Dosya | Rol |
|-------|-----|
| `VrUnityHost.swift` | UnityFramework load/run/sendMessage |
| `VrUnityModule.swift` | `isAvailable()`, session JSON → Unity |
| `VrUnityViewManager.swift` | Unity root view + ekran tap → raycast |
| `VrParcelNativeEmit.m` | Unity → RN event bus |
| Unity `VrParcelNativeEmitBridge.mm` | UnityFramework içinde emit callback |

**Önemli:** `VR_UNITY_LINKED` yalnızca UnityFramework gerçekten embed edildikten sonra anlamlıdır. Flag tek başına eklenmemeli.

## 5. Cihazda doğrulama

```bash
cd frontend
npm run start:ios-dev
```

Xcode’dan cihaza Run (development client).

### Beklenen akış

1. Basit Sorgu → VR pill
2. Harita User / A / B referansları
3. `NativeModules.VrUnityModule.isAvailable()` → **true**
4. Unity AR kamerası açılır (placeholder değil)
5. AR tap → gerçek plane/depth raycast → User/A/B world noktaları
6. 3-nokta calibration → `calibration_complete` event
7. Parseli Çiz → lat/lon → local m → AR world → **LineRenderer useWorldSpace=true**
8. Telefonu çevirince parsel sahnede sabit
9. RN SVG/GPS overlay **kapalı** (Unity aktifken yalnızca Unity view)

### Olaylar (Metro log / RN listener)

- `ar_step_changed` → `{ step: "ar_user" | "ar_ref_a" | "ar_ref_b" | "review" }`
- `calibration_complete` → `{ qualityScore }`
- `parcel_drawn` → `{}`

## 6. Sorun giderme

| Belirti | Olası neden |
|---------|-------------|
| `isAvailable()` false | Export yok veya prebuild export sonrası tekrar alınmadı |
| Siyah ekran | `Data/` app bundle’a kopyalanmadı |
| Crash açılışta | `VR_UNITY_LINKED` var ama framework embed yok |
| Tap yanıt yok | AR plane henüz algılanmadı; yatay yüzeye yönlendir |
| Event gelmiyor | `VrParcelSetEmitCallback` — Unity plugin + RN emit registrar |

## 7. Sonraki adım: EAS

İlk doğrulama Xcode lokal build ile tamamlandıktan sonra:

- `builds/ios/` export CI/Mac build agent’ta üretilir
- EAS custom workflow veya Mac builder + `embed-unity-ios.sh` otomasyonu eklenebilir

Detay: [unity_native_entegrasyon.md](./unity_native_entegrasyon.md)
