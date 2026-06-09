# Unity Android export (git'e commit edilmez)

Unity Editor → Android → Export Project hedefi:

```
mobile/mobil_github/unity/vrParcel/builds/android/
```

Beklenen modül:

```
builds/android/unityLibrary/
```

Sonra Windows:

```powershell
cd mobile\mobil_github\frontend
npm run prebuild:android:safe
npm run android
```

Bkz. `docs/mobile/modules/vr_parcel/android_windows_unity_build.md`
