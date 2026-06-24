# Unity vrParcel — Parsel eğim (Terrain 3D)

**ARCore / saha AR görüntüleme modülü yedeklendi:**  
`mobile/mobil_github/_backup/vrParcel-ar-viewer/`

Bu proje yalnızca **ParcelTerrain3dScene** (parsel eğim / 3D terrain) için kullanılır.

## Unity Hub

`mobile/mobil_github/unity/vrParcel/`

1. **ProParcel → Terrain3D → Configure Android Build Settings**
2. **File → Build Settings → Export Project** → `builds/android/`

## RN

```powershell
cd mobile/mobil_github/frontend
npm run validate:unity-export
npm run fix:android-native
npm run android
```

Parsel eğim ekranı: portal detay → terrain3d (`modules/parcelTerrain3d`).
