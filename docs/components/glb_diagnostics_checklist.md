# GLB Diagnostics Checklist – Car Render Olmuyor (Mapbox ModelLayer)

React Native Android + `@rnmapbox/maps` (Mapbox v10+), `Mapbox.Models` registry + `ModelLayer` ile GLB render. **Tree çiziliyor, Car çizilmiyor.** Scale/origin elendi; Android interceptor'ün serv ettiği dosya aynı doğrulandı.

---

## 1) Olası Nedenler (Mapbox Android glTF Limitleri + Sessiz Hata Kaynakları)

| # | Neden | Açıklama |
|---|--------|----------|
| 1 | **Vertex limiti (65,536 / mesh)** | 16-bit index; mesh başına 65,536 üst sınır. Car tek meshte daha fazla vertex içeriyorsa sessizce atlanır/culling. |
| 2 | **Desteklenmeyen extension'lar** | `KHR_materials_transmission`, `KHR_materials_clearcoat`, `KHR_materials_ior`, `KHR_materials_specular`, `KHR_materials_sheen`, `KHR_materials_volume`, `EXT_texture_webp`, `KHR_texture_basisu` vb. Mapbox sadece **metallic-roughness PBR** + baseColor/normal/metallicRoughness/occlusion destekler. |
| 3 | **WebP / Basis Universal texture** | Texture’lar WebP veya BasisU ise decode fail → sessiz hata. PNG/JPG olmalı. |
| 4 | **Draco / meshopt** | `KHR_draco_mesh_compression`, `EXT_meshopt_compression` desteklenir; fakat **quantization** veya **farklı encoder** ile üretilmiş Draco bazen Android’de sorun çıkarır. |
| 5 | **Skinning / morph / animation** | Animasyon, skinning, morph target **yok**. Bu özellikler varsa Mapbox parse ederken sessizce hata verebilir veya modeli atlayabilir. |
| 6 | **Vertex attributes** | `JOINTS_0` / `WEIGHTS_0` (skinning), `TANGENT` (normal map) kullanımı; Normal map yoksa `TANGENT` beklenmez. Eksik/uyumsuz attribute seti hata kaynağı olabilir. |
| 7 | **Çok büyük GLB / texture** | Dosya veya texture boyutu çok büyükse (örn. >50 MB önerilen, interceptor 1 GB’a kadar okuyor) decode OOM veya timeout → sessiz fail. |
| 8 | **Origin / birim / koordinat** | Y-up vs Z-up, metre vs cm; model uzayda çok uzakta veya scale’den dolayı görünür hacim dışında (frustum culling) → görünmez. Scale elendi denmiş; yine de **tek başına car + farklı scale** ile test faydalı. |
| 9 | **Layer order / z-fighting** | ModelLayer başka layer’ların altında kalıyorsa veya terrain ile z-fighting varsa “çizilmiyor” izlenimi. |
| 10 | **Registry vs ModelLayer eşleşmesi** | `modelId` (Models registry key) ile ModelLayer `style.modelId` uyuşmuyorsa (typo, sayı/string farkı) model çizilmez. |
| 11 | **Style lifecycle** | Style reload / map recreate sırasında registry temizleniyor veya layer order değişiyorsa car eklenmeden önce kaybolabilir. |
| 12 | **GL / texture decode hataları** | Native tarafta GL hata veya texture decode fail log’lanmadan yutuluyor olabilir. |

---

## 2) Test ve Log Checklist

### A) JS tarafı (Models registry, ModelLayer, ShapeSource/GeoJSON, style lifecycle)

| # | Ne test ediliyor? | Nerede log? | Ne loglanacak? | Nasıl yorumlanır? |
|---|-------------------|-------------|----------------|-------------------|
| A1 | Registry’de car var mı? | `useModelCatalog` / `modelsProp` kullanıldığı yer | `modelsProp` keys, `modelsProp["1"]` (veya car id) | Car id yoksa veya URL boşsa → registry tarafı elenir. |
| A2 | `modelsPropUsed`’da car var mı? | `ShapeDrawingModal` (modelsPropUsed useMemo sonrası) | `modelsPropUsed` keys, car id için value | Sadece kullanılanlar ekleniyorsa; car instance yoksa `modelsPropUsed`’da da olmayabilir. Diagnostics’te tek car instance zorunlu. |
| A3 | ModelLayer’a giden GeoJSON | `ModelsLayer` | Her `modelId` için `modelShape.features.length`, `features[0].geometry.coordinates`, `properties.modelScale` | Koordinat NaN/undefined veya scale [0,0,0] değil mi? |
| A4 | ModelLayer modelId eşleşmesi | `ModelsLayer` | `modelId`, `modelsProp[modelId]` (var/yok), `effectiveScale` | “VAR YOK” log’u → registry’de yok. “modelsProp OK” → JS tarafında kayıt tamam. |
| A5 | Models + ModelLayer mount sırası | `ShapeDrawingMapView` | MapView mount, Models mount, her ModelLayer mount; **layer order** (Terrain, Models, ModelsLayer grupları) | Models, ModelLayer’dan önce mount olmalı. Style reload / recreate sonrası sıra tekrarlanıyor mu? |
| A6 | Style reload / recreate | MapView remount veya styleURL değişimi | “Style reload” / “MapView remount” log’u; hemen sonra `modelsProp` keys, `modelInstances` length, ModelLayer id’leri | Recreate sonrası registry boş veya instance’lar gitmiş mi? |
| A7 | Terrain açık/kapalı | `terrainEnabled` | Terrain render ediliyor mu (evet/hayır), `terrainEnabled` | Car yalnızca terrain **kapalı** iken çiziliyor mu? (z-fighting / layer order için) |
| A8 | ModelLayer on/off | Diagnostics toggle | ModelLayer render ediliyor mu (evet/hayır) | Kapalıyken sadece CircleLayer (debug) görünmeli; car hiç çizilmez. |

**Örnek log satırları (JS):**

```
[3DEDIT] modelsProp: 5 model gömülü URL ile kayıtlı (id'ler: 1, 8, 9, 10, 20).
[ModelsLayer] Mount/update: { instancesCount: 1, modelIds: ['1'], modelsPropKeys: ['1'] }
[ModelsLayer] model_1: modelsProp OK – ModelLayer çiziliyor (1 instance). Boyut/format hatası olursa logcat'te PpLocalModelInterceptor bakın.
[3DEDIT] ShapeDrawingMapView render (layer order): Terrain=on, Models=1, ModelsLayer=1 groups.
[GLB_DIAG] Style/remount: modelsPropKeys=[1], instances=1, modelLayerIds=[models-layer-1].
```

---

### B) Native / Logcat tarafı (Mapbox internal, renderer, gltf, texture, memory, GL)

| # | Ne test ediliyor? | Nerede log? | Ne loglanacak? | Nasıl yorumlanır? |
|---|-------------------|-------------|----------------|-------------------|
| B1 | pp-local istek gidiyor mu? | `PpLocalModelHttpInterceptor` | URL, filename (e.g. `model_1.glb`) | İstek yoksa Mapbox registry URL’i hiç kullanmıyor veya cache’ten gidiyor. |
| B2 | Interceptor 200 + model/gltf-binary | Aynı | “pp-local served from PAD/app assets”, byte length, Content-Type | 200 + `model/gltf-binary` yoksa Mapbox GLB almıyor. |
| B3 | GLB boyutu uyarısı | Interceptor | “Model too large”, “RECOMMENDED_MAX_MB” aşımı | >50 MB uyarı; çok büyükse decode fail olası. |
| B4 | Mapbox HTTP / GLB load | Mapbox SDK log’ları | Mapbox tag’leri altında “model”, “gltf”, “glb”, “texture”, “decode” | SDK’nin GLB’yi istediği, parse ettiği veya hata verdiği satırlar. |
| B5 | GL / renderer hataları | Logcat | `GL`, `Renderer`, `Filament`, `mbgl` vb. | GL error, OOM, texture binding fail. |
| B6 | Texture decode | Mapbox / sistem | “decode”, “bitmap”, “texture” | WebP/BasisU kullanılıyorsa decode fail olabilir. |

**Logcat tag / keyword filtre önerileri:**

```bash
# Interceptor (kendi log’larımız)
adb logcat -s PpLocalModelInterceptor

# Geniş: pp-local + Mapbox model/gltf
adb logcat | grep -iE "PpLocalModel|pp-local|model_.*\.glb|mapbox.*model|mapbox.*gltf|mapbox.*glb|decode|texture|GL |Renderer|Filament|mbgl"
```

**Örnek log satırları (Logcat):**

```
D PpLocalModelInterceptor: HTTP request intercepted: https://pp-local/models/model_1.glb
D PpLocalModelInterceptor: pp-local URL matched: ... → filename=model_1.glb
D PpLocalModelInterceptor: PAD: packName=pp_model_1 assetsPath=... file=... exists=true
D PpLocalModelInterceptor: pp-local served from PAD: model_1.glb (12345678 bytes, 11.77 MB)
```

---

## 3) GLB Diagnostics Mode (Projede Eklenen Özellikler)

- **Tek car instance**: Hardcoded koordinatta (örn. harita merkezi) sadece car (örn. `model_1`) eklenir.
- **Terrain kapalı / açık toggle**: Mevcut `terrainEnabled` ile; Diagnostics UI’dan aç/kapa.
- **Registry’e sadece car ekle toggle**: Açıkken `modelsProp` yalnızca `{ "1": "https://pp-local/models/model_1.glb" }`.
- **ModelLayer en üste al** ve **ModelLayer on/off** toggle: Layer sırası ve ModelLayer’ı kapatma (sadece debug circle).
- **Style reload / recreate** (ör. MapView remount) olduğunda **registry + layer order** log’ları.
- **Logcat tag/keyword** filtre önerileri: Yukarıdaki “Logcat tag / keyword filtre önerileri” kısmı Diagnostics panelinde de metin olarak yer alır.

Diagnostics modu **`__DEV__`** içinde, örn. Model Debug Panel veya ayrı “GLB Diag” panelinden açılır.

---

## 4) GLB İçeriğini Doğrulama: Node Script Önerisi

`scripts/inspect-glb.js` (veya `.ts`):

- `@gltf-transform/core` ile GLB oku.
- **gltf-transform inspect** benzeri çıktı: extension’lar (used + required), texture mime/format, image boyutları, vertex attribute listesi (`POSITION`, `NORMAL`, `TANGENT`, `TEXCOORD_0`, `COLOR_0`, `JOINTS_0`, `WEIGHTS_0`), skinning/morph/animation var mı.
- Raporu **JSON** olarak yaz (örn. `inspect-glb-report.json`).

Örnek kullanım:

```bash
npm run inspect-glb -- path/to/Car.glb
# veya
node scripts/inspect-glb.js path/to/Car.glb [output.json]
# → output.json yoksa input ile aynı dizinde inspect-glb-report.json
```

Örnek rapor yapısı:

```json
{
  "file": "Car.glb",
  "byteLength": 12345678,
  "extensionsUsed": ["KHR_materials_clearcoat", "KHR_texture_transform"],
  "extensionsRequired": ["KHR_materials_clearcoat"],
  "textures": [
    { "mimeType": "image/png", "width": 1024, "height": 1024 }
  ],
  "vertexAttributes": ["POSITION", "NORMAL", "TANGENT", "TEXCOORD_0"],
  "hasSkinning": false,
  "hasMorph": false,
  "hasAnimation": true,
  "meshes": [{ "name": "CarBody", "primitiveCount": 1, "vertexCount": 12000 }],
  "mapboxFriendly": false,
  "mapboxBlockers": ["KHR_materials_clearcoat", "hasAnimation"]
}
```

---

## 5) Dönüşüm Reçetesi (Mapbox Muhtemelen Desteklemiyor)

Rapor + logcat’e göre “Mapbox’ın büyük ihtimalle desteklemediği” özellikler için:

| Özellik | Riski | Önerilen dönüşüm |
|--------|--------|-------------------|
| `KHR_materials_transmission` | Yüksek | Kaldır; base color + opacity ile taklit. |
| `KHR_materials_clearcoat` | Yüksek | Kaldır. |
| `KHR_materials_ior` / `KHR_materials_specular` | Yüksek | Kaldır; metallic-roughness’a indir. |
| `KHR_materials_sheen` | Yüksek | Kaldır. |
| `KHR_materials_volume` | Yüksek | Kaldır. |
| `EXT_texture_webp` | Yüksek | Texture’ları PNG (veya JPG)’ye çevir. |
| `KHR_texture_basisu` | Yüksek | PNG/JPG’ye çevir. |
| `KHR_draco_mesh_compression` | Orta | Deneyebilirsin; sorun varsa Draco’yu kaldır, quantize ile sadeleştir. |
| Quantization (custom) | Orta | `quantize()` ile makul hassasiyet; aşırı quantization bazen sorun çıkarır. |
| Skinning / morph / animation | Yüksek | Kaldır; static mesh export. |
| >65k vertices/mesh | Yüksek | Mesh’i böl veya simplify. |

**Geçici test için “minimal PBR” dönüştürme (gltf-transform):**

```bash
# Gerekli paketler (devDependencies): @gltf-transform/core, @gltf-transform/extensions, @gltf-transform/functions, draco3dgltf

# 1) Extension’ları temizle, metallic-roughness dışı materyalleri PBR’a çevir, gereksiz prune
npx gltf-transform copy input.glb step1.glb
# (copy sadece kopyalar; asıl işlem için aşağıdaki script kullanılır)

# 2) Önerilen Node script: glb-to-minimal-pbr.js
node scripts/glb-to-minimal-pbr.js path/to/Car.glb path/to/Car_minimal.glb [--quantize]
```

**`glb-to-minimal-pbr.js`:** `prune()`, `dedup()`, `flatten()`, isteğe `quantize()`. Clearcoat/transmission/ior/specular kaldırılmaz (re-export gerekir). >65k vertex bölünmez (simplify veya re-export). **>65k vertex için:** `simplify` + `meshoptimizer` (weld + simplify, ratio 0.5–0.6) veya Blender decimate.

**`glb-to-minimal-pbr.js` içinde (pseudo-code) kullanılabilecek gltf-transform adımları:**

```js
const { NodeIO } = require('@gltf-transform/core');
const { prune, dedup, flatten } = require('@gltf-transform/functions');
// 1. Oku
const doc = await io.read('input.glb');
// 2. Kaldır: animasyon, skinning, morph (extension + ilgili buffer’lar)
//    (gltf-transform functions ile veya manuel graph düzenlemesi)
// 3. Prune + dedup + flatten
await doc.transform(prune(), dedup(), flatten());
// 4. Texture’ları PNG’ye çevir (extensions’dan WebP/BasisU kaldır; re-encode)
// 5. Metallic-roughness dışı materyalleri baseColor + metallic/roughness’a indir
// 6. Yaz
await io.write('Car_minimal.glb', doc);
```

**Sadece Draco + quantize + prune (mevcut compress script’e benzer):**

```bash
npm run compress-glb -- Car.glb Car_draco.glb
```

Test sırasında önce **Draco’suz** minimal PBR (animasyon/skinning/morph/transmission/clearcoat vb. yok) ile dene; car çiziliyorsa sorun büyük ihtimalle bu özelliklerden biri.

---

## 6) Özet: Adım Adım Checklist

1. **GLB Diagnostics Mode**’u aç; tek car instance, terrain kapalı, registry sadece car, ModelLayer en üstte.
2. **JS log’ları**: modelsProp’da car, ModelsLayer’da model_1 OK, layer order, style reload sonrası registry/instance log’ları.
3. **Logcat**: PpLocalModelInterceptor’te `model_1.glb` isteği, 200 + model/gltf-binary, byte sayısı.
4. **`inspect-glb`** ile Car.glb raporunu al; `mapboxBlockers` ve `mapboxFriendly`.
5. **minimal PBR** dönüşümü uygula; Car_minimal.glb’yi pack’te model_1 yerine koyup (veya geçici farklı id) aynı koordinatta dene.
6. Hâlâ çizilmiyorsa: **vertex sayısı** (mesh başına ≤65k), **texture format** (PNG/JPG), **Mapbox GL/renderer** logcat filtreleri.

Bu checklist + GLB Diagnostics Mode + inspect script + dönüşüm reçetesi, “car neden render olmuyor?” sorusunu sistematik olarak daraltmak için kullanılır.
