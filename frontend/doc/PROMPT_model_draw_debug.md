# Model Çizilmiyor – Debug Prompt (Başka yapay zekâya verilecek)

Aşağıdaki metni kopyalayıp ChatGPT / Claude / vb. yapay zekâya yapıştır. **Sıkıştırma yok**; **ağaç çiziliyor, araba çizilmiyor**. Kullanılan yöntemler, olası nedenler ve **test için ne yapılacağı** net olsun.

---

## Kopyala‑yapıştır prompt (Türkçe)

```
Konu: React Native Android uygulamasında Mapbox ModelLayer ile GLB 3D model render. Sıkıştırma yok (web + mobil orijinal GLB). Ağaç modelleri çiziliyor, araba modeli çizilmiyor. Olası nedenleri listeleyip, her biri için test için ne yapmam gerektiğini (hangi loglar, nerede, nasıl yorumlanır) net bir checklist olarak ver.

--- Kullanılan yöntemler ---
- Mapbox.MapView içinde Mapbox.Models (registry) + Mapbox.ModelLayer.
- modelsProp: { [modelId]: "https://pp-local/models/model_<id>.glb" }. modelId = DB primary key (string). Ağaç ve araba aynı format.
- Mapbox.Models: <Mapbox.Models models={modelsProp} />. Tüm modeller aynı registry'ye ekleniyor.
- ModelsLayer: Her modelId için ShapeSource (GeoJSON Point) + CircleLayer (debug) + ModelLayer. ModelLayer style: modelId, modelScale. Instance: coordinate, modelId, modelScale, modelRotation, modelTranslation, modelOpacity.
- Scale: tree [1,1,1], car [4,4,4], house/grass [1,1,1]. getScaleForModelId(modelId) ile kategoriye göre veriliyor.
- Model dosyaları: PAD veya app assets, model_<id>.glb. İstekler https://pp-local/models/model_<id>.glb. Android'de PpLocalModelHttpInterceptor bu URL'leri yakalayıp 200 + Content-Type: model/gltf-binary ile PAD/assets'tan serve ediyor. İndirme yok.
- Terrain: RasterDemSource (mapbox-terrain-dem-v1, tileSize 512, maxZoom 15) + Terrain (exaggeration 1.4). 3D modda açık.
- Yerleştirme: Haritaya tıklayınca addModelInstance(coordinate, modelId, { modelScale }).

--- Durum ---
- Sıkıştırma kapalı. Web ve mobil için hep orijinal GLB kullanılıyor.
- Ağaç: çiziliyor (başarılı).
- Araba: çizilmiyor (başarısız). Aynı pipeline, aynı registry, aynı ModelLayer, aynı pp-local + interceptor. Farklar: kategori car, scale [4,4,4], GLB içeriği (format, extension'lar, koordinat/origin, mesh/materyal vb.).

--- İstediklerim ---

1) Olası tüm ihtimaller  
   "Araba çizilmiyor, ağaç çiziliyor" için mantıklı nedenler. Örneğin:  
   - GLB formatı, sürümü, extension'lar (KHR_texture_transform, KHR_draco_mesh_compression, vb.)  
   - Koordinat sistemi, birim (metre), origin, Y-up vs Z-up  
   - Scale [4,4,4] – model sahne dışında mı, culling, çok küçük/büyük?  
   - ModelLayer / Models config: modelId eşleşmesi, registry URL, layer sırası  
   - Interceptor: pp-local isteği gidiyor mu, 200 + model/gltf-binary dönüyor mu, byte bütünlüğü  
   - Sahne/kamera: model görünür alanda mı, z-fighting, terrain offset  
   - Mesh/materyal: polygon sayısı, texture, transparency  
   - Mapbox SDK sessiz hata, memory, decode vb.

2) Test için ne yapmalıyız  
   Her ihtimal için:  
   - Hangi katmanda log? (JS: ModelsLayer, useModelCatalog, MapView; Kotlin: interceptor; logcat)  
   - Tam olarak ne loglanacak? (örn. interceptor: URL, status, Content-Length, Content-Type; ModelLayer: modelId, modelScale; Mapbox hata callback varsa)  
   - Nasıl yorumlarız? Bu ihtimal doğru mu / elenir mi?  
   - Gerekirse ek test adımları (örn. sadece araba koy, sadece ağaç koy, scale değiştir, aynı noktaya ikisini koy).

Özetle: Olası ihtimaller + test için net checklist (loglar nerede, ne, nasıl yorumlanır). İstersen örnek log satırları veya pseudo-code da yaz.
```

---

## Kısa İngilizce alternatif

```
Context: React Native Android, Mapbox ModelLayer, GLB 3D models. No compression – original GLB for both web and mobile. Models served via custom interceptor: https://pp-local/models/model_<id>.glb → 200 + model/gltf-binary from PAD/app assets. Same pipeline for all: Mapbox.Models + ModelLayer, ShapeSource Points, style { modelId, modelScale }. Scale: tree [1,1,1], car [4,4,4].

Working: Tree models render.  
Failing: Car model does not. Same registry, same ModelLayer, same interceptor. Differences: category car, scale [4,4,4], GLB content (format, extensions, coords, mesh/material).

Request:
1) List all plausible causes for “car doesn’t render, tree does” (format/extensions, coordinate system/units, scale/culling, ModelLayer config, interceptor response, scene/camera, mesh/material, Mapbox silent failures, etc.).
2) For each cause: what to do to test – where to add logs (JS vs Kotlin vs logcat), what exactly to log, how to interpret (confirm vs rule out). Optional: extra test steps (e.g. place only car, only tree, change scale, same location for both).

Goal: Possible causes + concrete testing checklist (logs, location, interpretation). Example log lines or pseudo-code if helpful.
```

---

## Proje referansları

- Models + ModelLayer: `ShapeDrawingMapView.tsx` (Mapbox.Models, ModelsLayer), `ModelsLayer.tsx`, `useModelCatalog.ts` (modelsProp).
- Yerleştirme / scale: `useMapPressHandler.ts`, `ModelManager.ts` (CATEGORY_SCALE), `ShapeDrawingModal.tsx` (getScaleForModelId).
- Interceptor: `PpLocalModelHttpInterceptor.kt` (pp-local, PAD, app assets).
- Terrain: `ShapeDrawingMapView.tsx` (RasterDemSource, Terrain).
