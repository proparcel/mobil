# Asset pack'e kopyalanacak modeller

Bu klasördeki .glb dosyaları `npm run gen:android-asset-packs` ile pack dizinine kopyalanır; ardından `gen:debug-assets-models` ile APK içine gömülür (**telefon indirmez**).

**Projede görülmesi:** Script kaynak dosyayı şu sırayla arar:
1. Manifest'teki `path` (örn. `assets/models/car/Car.glb`) → `frontend/assets/models/car/Car.glb`
2. `assets/models/<groupId>/<filename>` (manifest'teki groupId + filename)
3. Aynı grup klasöründe **herhangi bir** .glb (örn. `car/` içinde tek .glb varsa o kullanılır)

Dosyayı bulamazsa `staticUrl` ile indirmeye çalışır; sunucu kapalıysa hata verir. **İndirme olmaması için** .glb dosyalarını ilgili klasörlere koyun: `assets/models/car/`, `assets/models/house/`, `assets/models/tree/` vb.

**Android build öncesi:** `npm run gen:android-asset-packs` sonra `npm run gen:debug-assets-models` (veya `npm run android` ikisini de çalıştırır).

**Mobilde çizim:** Mapbox ModelLayer büyük GLB dosyalarında (genelde > 50 MB) parse/render başarısız olabiliyor. Admin'den model eklerken **orijinal web'e**, **küçültülmüş (Draco+quantize) mobil'e** otomatik yazılır; büyük modeller haritada çizilir.

## Klasör ve dosya eşlemesi (models_manifest.json)

| id | Klasör | Dosya adı | Pack çıktısı |
|----|--------|-----------|--------------|
| 1 | car/ | Araba.glb | model_1.glb |
| 2 | grass/ | grass.glb | model_2.glb |
| 3 | house/ | House.glb | model_3.glb |
| 4 | house/ | modern_villa.glb | model_4.glb |
| 5 | house/ | post_modern_villa.glb | model_5.glb |
| 6 | house/ | post_modern_villa_110M2.glb | model_6.glb |
| 7 | house/ | post_modern_villa_1000M2.glb | model_7.glb |
| 8 | tree/ | Cam_Agaci.glb | model_8.glb |
| 9 | tree/ | tree2.glb | model_9.glb |
| 10 | tree/ | tree3.glb | model_10.glb |
| 11 | tree/ | tree4.glb | model_11.glb |
| 12 | tree/ | tree5.glb | model_12.glb |
| 13 | tree/ | tree6.glb | model_13.glb |
| 14 | tree/ | tree7.glb | model_14.glb |
| 15 | tree/ | tree8.glb | model_15.glb |
| 16 | tree/ | tree9.glb | model_16.glb |
| 17 | tree/ | tree10.glb | model_17.glb |
| 18 | tree/ | tree10mt.glb | model_18.glb |

İlgili .glb dosyalarını yukarıdaki klasörlere koyun, sonra:

```bash
npm run gen:android-asset-packs
```

Script local dosya varsa hedefi her zaman günceller (0 byte olsa bile).
