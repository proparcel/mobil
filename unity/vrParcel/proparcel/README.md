# proparcel Unity projesi

VR scriptleri bu klasore kopyalandi. Unity Hub'dan **proparcel** projesini acabilirsiniz.

## ProParcel menusu gorunmuyorsa

1. Unity'yi **tamamen kapatip** tekrar acin (scriptler diskten yeni geldi).
2. Sag altta **paket indirme** bitene kadar bekleyin.
3. **Window → General → Console** — kirmizi hata **0** olmali.
4. Ust menude **ProParcel → VR** cikar.

## Console'da hata varsa

- `ARFoundation` / `ARCore` bulunamadi → Project Settings acik birakip paketlerin inmesini bekleyin.
- Hata devam ederse Console'daki ilk kirmizi satiri paylasin.

## Export hedefi (onemli)

Android export'u su klasore alin (RN buradan okur):

```
C:\ProParcel\mobile\mobil_github\unity\vrParcel\builds\android
```

Build Settings → Export Project → yukaridaki klasoru secin (`proparcel\builds` degil).

## Adimlar

1. **ProParcel → VR → Create VrParcel Scene**
2. **Edit → Project Settings → XR Plug-in Management → Android → ARCore** ✓
3. **ProParcel → VR → Configure Android Build Settings**
4. Export → `../builds/android/` (ust vrParcel klasoru)
5. PC: `npm run prebuild:android:safe` + `npm run android`
