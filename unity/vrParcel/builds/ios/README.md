# Unity iOS export çıktısı (git'e commit edilmez)

Unity Editor → Build Settings → iOS → Export Project hedefi:

```
mobile/mobil_github/unity/vrParcel/builds/ios/
```

Beklenen dosyalar:

- `UnityFramework.framework`
- `Data/`

Export sonrası Mac'te:

```bash
cd mobile/mobil_github/frontend
bash scripts/embed-unity-ios.sh
npx expo prebuild --platform ios
```

Bkz. `docs/mobile/modules/vr_parcel/mac_xcode_unity_build.md`
