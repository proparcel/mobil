# Kenar Yol Çizimi – Kod Yapısı, İş Akışı ve Giderilecek Sorunlar

Bu doküman, Hisseli Parsel ekranındaki **“Kenar”** modunda yol çizimi özelliğinin mevcut kodunu, iş akışını ve düzeltilmesi gereken davranışları özetler. Başka bir yapay zekâ tarafından geliştirme yapılırken referans olarak kullanılabilir.

---

## 1. Özelliğin Amacı

- Kullanıcı **Yol Çiz** → **Kenar** seçer.
- Parsel sınırındaki bir **kenara** tıklar; kenara paralel bir **şablon yol çizgisi** (iki uçlu segment) belirir.
- Bu çizginin **bir ucundan** sürükleyerek yolun **sadece o tarafını** uzatıp kısaltabilmeli; **diğer uç sabit** kalmalı.
- Sürüklenen uç **başka bir yola** yaklaşırsa, o yol üzerinde **kesişim (merge) noktası** görünmeli; oraya bırakıldığında **iki yol birleştirilmeli**.
- Sürüklenen ucu **herhangi bir yere** bırakırsa yol **sadece oraya kadar** çizilmiş kabul edilmeli.
- **Boş bir yere tıklanınca** çizim **tamamlanmalı** ve parsel hesapları (yol polygon, baseParents, pieces, splitLines) yapılmalı.

---

## 2. İş Akış Şeması (Hedef)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  YOL ÇİZ → KENAR                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐     Hayır    ┌──────────────────────────┐
│  edgeRoadDraft var mı?           │─────────────►│  Kenar seçimi modu       │
└─────────────────────────────────┘              │  (LayerParentEdgePick)   │
         │ Evet                                   │  Tap → kenar seç         │
         ▼                                        └──────────────────────────┘
┌─────────────────────────────────┐                           │
│  Tap: boş alan mı?              │                           │ Tap kenar
         │ Evet                    │                           ▼
         ▼                         │              ┌──────────────────────────┐
┌─────────────────────────────────┐│              │  baseLine + currentLine │
│  handleCompleteEdgeRoad()       ││              │  (trim0=0, trim1=1)     │
│  → applyCenterlineAsRoad        ││              │  edgeRoadDraft set       │
│  → parsel hesapları             ││              └──────────────────────────┘
└─────────────────────────────────┘│                           │
                                   │                           ▼
         │ Hayır (uçlara tap?)     │              ┌──────────────────────────┐
         ▼                         │              │  Uç-drag modu            │
┌─────────────────────────────────┐│              │  Hangi uç: 0 veya 1       │
│  Hangi uç seçili? (0 veya 1)    ││              │  Pan → sadece o uç hareket│
│  → Pan gesture başlat            │◄──────────────│  Diğer uç SABİT          │
└─────────────────────────────────┘               └──────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Pan onUpdate                    │
│  → Sadece seçili uç hareket eder │
│  → merge preview (road/boundary) │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐     Merge     ┌──────────────────────────┐
│  Pan onEnd                       │   noktasında  │  mergeRoads()            │
│  → Bırakılan nokta               │──────────────►│  + applyCenterlineAsRoad │
│  → merge varsa: merge + apply   │               └──────────────────────────┘
│  → yoksa: trim güncelle, tamamla │
│    (boş tap) ile aynı           │
└─────────────────────────────────┘
```

---

## 3. İlgili Dosyalar ve Rolleri

| Dosya | Rol |
|-------|-----|
| `frontend/src/types/parcelSplit.ts` | `EdgeRoadDraft`, `RoadDrawSubMode`, `UiMode` tipleri |
| `frontend/screens/routes/parcel-split.tsx` | State (`edgeRoadDraft`), kenar seçimi, slide tamamlama/iptal, `applyCenterlineAsRoad` |
| `frontend/components/app/parcelSplit/Canvas2D.tsx` | Pan gesture, tap (kenar/boş alan), merge preview, koordinat dönüşümü |
| `frontend/components/app/parcelSplit/LayerEdgeRoadDraft.tsx` | Şablon yol çizgisi ve merge noktası görseli (SVG) |
| `frontend/components/app/parcelSplit/LayerParentEdgePick.tsx` | Kenar seçiminde parent kenarların vurgulanması |
| `frontend/components/app/parcelSplit/modebars/EdgeRoadModeBar.tsx` | “Tamamla” / “İptal” butonları |
| `frontend/src/utils/roadGeometry.ts` | `createEdgeParallelBaseLine`, `createEdgeParallelCenterline`, `extendPolylineToBoundary`, `clipPolylineToRing` |
| `frontend/src/utils/roadMerge.ts` | `computeMergeCandidate`, `mergeRoads`, `appendRoadsByClosestEndpoints`, `RoadMergePreview` |

---

## 4. State ve Veri Yapıları

### 4.1 `EdgeRoadDraft` (parcelSplit.ts)

```ts
type EdgeRoadDraft = {
  edgeIndex: number;           // parent ring'deki kenar indeksi
  baseLine: [Point, Point];   // tam paralel çizgi (kenar boyunca)
  trim0: number;              // 0..1, baseLine üzerinde sol uç
  trim1: number;              // 0..1, baseLine üzerinde sağ uç
  currentLine: [Point, Point]; // trim ile kesilmiş çizgi uçları
};
```

- `currentLine[0]` = baseLine üzerinde `trim0` konumu  
- `currentLine[1]` = baseLine üzerinde `trim1` konumu  

Şu an **slide tek bir delta** ile hem `trim0` hem `trim1` değiştiriliyor (simetrik uzatma/kısaltma). İstenen: **sadece sürüklenen uç** hareket etsin, diğer uç sabit kalsın.

### 4.2 parcel-split.tsx içinde ilgili state

- `edgeRoadDraft: EdgeRoadDraft | null` – kenar seçildikten sonra şablon yol
- `selectedParentEdgeForRoad: number | null` – vurgulanan kenar indeksi
- `roadMergePreview: RoadMergePreview | null` – merge noktası (road/boundary) bilgisi

### 4.3 Canvas2D içinde

- `edgeRoadSlidePreviewDelta: number` – Pan sırasında uygulanacak delta (metre); bırakılınca `handleEdgeRoadSlide` ile state’e yansıyor.

---

## 5. Mevcut İş Akışı (Kod Ne Yapıyor?)

1. **Kenar seçimi**  
   - `roadDrawSubMode === "edge"` ve `!edgeRoadDraft` iken tap → `pickNearestEdge` → `onSelectParentEdgeForRoad(edgeIndex)`.
2. **edgeRoadDraft oluşturulması**  
   - `handleParentEdgeSelectForRoad(edgeIndex)` → `createEdgeParallelBaseLine(ring, edgeIndex, W/2)` → `setEdgeRoadDraft({ baseLine, trim0: 0, trim1: 1, currentLine })`.
3. **Pan (şu an)**  
   - Herhangi bir yerde Pan başlayınca `handleEdgeRoadSlidePreviewUpdate` → `deltaMeters = worldDx*tx + worldDy*ty` (teğet yönü).  
   - `onEnd` → `handlePanEndEdgeRoadSlide` → `handleEdgeRoadSlide(deltaMeters)`.  
   - `handleEdgeRoadSlide`: `trim0 -= d/2`, `trim1 += d/2` (simetrik); her iki uç da hareket ediyor.
4. **Tamamlama**  
   - Sadece **EdgeRoadModeBar** “Tamamla” butonu → `handleCompleteEdgeRoad()` → `applyCenterlineAsRoad(edgeRoadDraft.currentLine)`.  
   - **Boş alana tap** ile tamamlama yok; tap hâlâ sadece “kenar seç” veya edge seçimi için kullanılıyor, `edgeRoadDraft` varken boş tap’e özel dal yok.

---

## 6. Giderilmesi Gereken Sorunlar ve İstenen Davranışlar

### 6.1 Tek uçtan boyutlandırma (diğer uç sabit)

- **Sorun:** Şablon yolun bir ucundan tutup sürükleyince **her iki uç** birlikte hareket ediyor (simetrik trim).
- **İstenen:** Sürüklenen uç hareket etsin, **diğer uç sabit** kalsın; yol boyu sadece o taraftan uzasın/kısalsın.
- **Yaklaşım önerisi:**
  - Tap’te **hangi uç** seçildiğini tespit et: `currentLine[0]` veya `currentLine[1]`’e yakınlık (ekran veya metre toleransı).
  - State’e örn. `edgeRoadDraggingEnd: 0 | 1 | null` ekle (veya mevcut bir “selected handle” ile).
  - Pan sadece `edgeRoadDraft != null` ve bu uç seçiliyken çalışsın.
  - `handleEdgeRoadSlide(deltaMeters, movingEnd: 0 | 1)`:
    - `movingEnd === 0` → sadece `trim0` güncelle (trim1 sabit).
    - `movingEnd === 1` → sadece `trim1` güncelle (trim0 sabit).
  - Canvas2D’de Pan’ın hangi uca ait olduğunu başta (onStart’ta) tap ile belirleyip, onUpdate/onEnd’te bu ucu kullan.

### 6.2 Drag ucunda merge (başka yola yaklaşınca kesişim + birleştirme)

- **Sorun:** Sürüklenen uç başka yola yaklaşınca kesişim noktası ve “bırakınca merge” davranışı tam çalışmıyor / net değil.
- **İstenen:**  
  - Drag edilen uç, mevcut `roadCenterline` veya boundary’ye tolerans içinde yaklaşınca **merge noktası** (cyan halka vb.) görünsün.  
  - Parmak o noktada bırakıldığında **iki yol birleştirilsin** (`mergeRoads` + `applyCenterlineAsRoad`).
- **Mevcut:** `computeMergeCandidate([effectiveP1, effectiveP2], roadCenterline, ring)` edge draft için useEffect’te çağrılıyor; `roadMergePreview` LayerEdgeRoadDraft’a veriliyor.  
- **Eksik:** Pan onEnd’te “bırakılan nokta merge noktasına yeterince yakın mı?” kontrolü ve buna göre `mergeRoads` + apply yolu. Ayrıca edge draft için `effectiveP1/effectiveP2` hesaplaması, sadece **sürüklenen uç** hareket edecek şekilde (tek uç drag) güncellenmeli.

### 6.3 Bırakılan yere kadar yol

- **İstenen:** Merge noktasına snap etmediyse, sürüklenen uç **bırakıldığı yerde** kalsın; yol sadece oraya kadar çizilmiş kabul edilsin (yani `currentLine` = sabit uç + bırakılan nokta).
- **Not:** Bırakılan nokta parent ring dışındaysa `clipPolylineToRing` veya benzeri ile kenara çekilebilir; `applyCenterlineAsRoad` zaten extend/clip kullanıyor olabilir.

### 6.4 Yeniden boyutlandırma ve “bırakınca tamamlama” çalışmıyor

- **Sorun:** Kullanıcı ucu sürükleyip bıraktığında ne “yol burada bitsin” ne de “parsel hesapları yapılsın” davranışı güvenilir çalışıyor.
- **İstenen:**  
  - Pan onEnd’te: merge varsa merge + apply.  
  - Merge yoksa: trim’i bırakılan konuma göre güncelle, **yolu tamamla** (applyCenterlineAsRoad) ve parsel hesaplarını tetikle. Yani “bırakınca” tek başına tamamlama (butona basmadan) çalışsın.

### 6.5 Boş yere tıklayınca tamamlama

- **Sorun:** `edgeRoadDraft` varken boş bir yere tap edildiğinde hiçbir şey olmuyor; tamamlama sadece “Tamamla” butonu ile yapılabiliyor.
- **İstenen:** `edgeRoadDraft != null` iken tap, **ne bir kenar ne de draft uçları** üzerinde değilse (boş alan) → `handleCompleteEdgeRoad()` çağrılsın; mevcut `currentLine` ile yol uygulansın ve parsel hesapları yapılsın.
- **Yer:** `Canvas2D` içinde `handleTapEnd`.  
  - Önce: `uiMode === "draw_road"` ve `roadDrawSubMode === "edge"` ve `edgeRoadDraft != null` dalı ekle.  
  - Tap’in (pw) draft uçlarına veya kenarlara yakın olup olmadığını kontrol et; yakın değilse `onCompleteEdgeRoad` (veya parcel-split’e iletilen tamamlama callback’i) çağır.

---

## 7. Önemli Fonksiyonlar (Referans)

### 7.1 parcel-split.tsx

- **handleParentEdgeSelectForRoad(edgeIndex | null)**  
  Kenar seçilince veya seçim kaldırılınca; edge seçiliyse `createEdgeParallelBaseLine` ile `edgeRoadDraft` set edilir.
- **handleEdgeRoadSlide(deltaMeters)**  
  Şu an: trim0/trim1’i simetrik günceller. Hedef: `(deltaMeters, movingEnd: 0 | 1)` ile sadece ilgili ucu güncelle.
- **handleCompleteEdgeRoad()**  
  `edgeRoadDraft.currentLine` → `applyCenterlineAsRoad(centerline)`; sonra draft ve ilgili state temizlenir.
- **applyCenterlineAsRoad(centerline: Point[])**  
  `extendPolylineToBoundary` → `buildRoadBufferPolygon` → `intersectRoadWithParent` → `subtractRoadFromParent` → `rebuildFromRoad`; `roadPolygon`, `roadCenterline`, `baseParentsRings` güncellenir; parsel çizimi varsa `computeSplitMultiTotalCount` ile pieces/splitLines yeniden hesaplanır.

### 7.2 Canvas2D.tsx

- **handleTapEnd(sx, sy)**  
  Dünya koordinatı `pw` hesaplanır. Edge modda kenar seçimi veya (eklenmeli) edgeRoadDraft varken boş tap → tamamla.
- **handleEdgeRoadSlidePreviewUpdate(translationX, translationY)**  
  Pan sırasında teğet yönünde `deltaMeters` hesaplanır, `setEdgeRoadSlidePreviewDelta(deltaMeters)`.
- **handlePanEndEdgeRoadSlide(translationX, translationY)**  
  Aynı delta hesaplanır, `onEdgeRoadSlide(deltaMeters)` çağrılır. Hedef: hangi uç sürüklendiğini de iletip sadece o ucu güncellemek; gerekirse merge kontrolü ve tamamlama.
- Pan gesture: `uiMode === "draw_road" && edgeRoadDraft != null` iken edge road slide branch’i çalışıyor.

### 7.3 roadMerge.ts

- **computeMergeCandidate(draftPoints, existingRoad, parentRing)**  
  Draft uçlarının boundary veya mevcut yola snap adayı; en yakın adayı `RoadMergePreview` olarak döner.
- **mergeRoads(draftPoints, existingRoad, preview, parentRing)**  
  `RoadMergePreview`’a göre draft ile mevcut yolu birleştirir; birleşik centerline döner.

---

## 8. Kısa Uygulama Kontrol Listesi

1. **Tek uç drag:** Tap ile draft uçlarından birini seç (0 veya 1); state’te “sürüklenen uç” tut; `handleEdgeRoadSlide(delta, movingEnd)` ile sadece o uç için trim güncelle.
2. **Merge on drop:** Pan onEnd’te bırakılan noktayı `roadMergePreview` ile karşılaştır; tolerans içindeyse `mergeRoads` + `applyCenterlineAsRoad(merged)`.
3. **Bırakınca tamamlama:** Merge yoksa trim’i son konuma göre güncelle, hemen `handleCompleteEdgeRoad()` (veya eşdeğer apply) çağır.
4. **Boş tap = tamamla:** `handleTapEnd`’te edgeRoadDraft varken tap, uç/kenar üzerinde değilse `onCompleteEdgeRoad` çağır.

Bu doküman ve kod referansları, kenar yol çiziminin istenen davranışa getirilmesi için başka bir yapay zekâ tarafından kullanılabilir.
