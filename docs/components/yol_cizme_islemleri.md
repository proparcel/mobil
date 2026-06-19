# Hisseli Parsel Sayfası – Yol Çizme İşlemleri (Başka Yapay Zeka İçin Komut)

Bu doküman, mobil projedeki **hisseli parsel bölme** ekranında **yol çizme** akışını, state’leri, bileşenleri ve geometri hesaplarını tek bir yerde toplar. Başka bir yapay zeka bu metni okuyarak yol çizme davranışını anlayabilir ve değişiklik yapabilir.

---

## 1. Genel Özet

- **Sayfa:** Hisseli parsel bölme ekranı (`parcel-split` route).
- **Yol çizme:** Kullanıcı parsel içinde bir **polyline** (nokta dizisi) çizer; genişlik (metre) verilir; bu polyline’dan **koridor polygon** üretilir; parent parsel ile **kesişim** alınarak yol alanı, **fark** alınarak yol çıkarılmış “base parent” parçaları elde edilir.
- **Koordinatlar:** Tüm hesaplar **yerel metre** (local metre) ile yapılır. Ring ve noktalar `Point = { x, y }` (metre cinsinden).

---

## 2. UI Modu ve Yol Çizme Modu

- **UiMode** (`src/types/parcelSplit.ts`): `"pan_zoom" | "select_road_edges" | "select_piece" | "edge_slide" | "draw_road"`.
- **Yol çizme modu:** `uiMode === "draw_road"` iken:
  - Canvas’ta **tap** = yol taslağına nokta ekler (draft point).
  - ActionBar’daki “Yol Çiz” toggle açıktır; tekrar basınca mod kapanır.
  - RoadModeBar görünür (Genişlik, Tamamla, Son Sil, İptal).
  - Kenar ölçüleri ve kenar kaydırma modu kapalı olmalı; mod değişince `draw_road` ise taslak noktalar temizlenir.

---

## 3. State (parcel-split.tsx)

Yol çizme ile ilgili state’ler:

| State | Tip | Açıklama |
|-------|-----|----------|
| `roadDraftPoints` | `Point[]` | Kullanıcının tıkladığı noktalar (taslak polyline). Sırayla eklenir. |
| `roadWidthInput` | `string` | Yol genişliği (metre), input’tan gelir; default `"2"`. |
| `roadPolygon` | `Point[] \| null` | Tamamlanmış yol polygon’u (parent ile kesişim sonucu). Null = henüz yol yok. |
| `baseParentsRings` | `Point[][] \| null` | Parent’tan yol çıkarıldıktan sonra kalan polygon(lar). Bölme hesapları bunlar üzerinden yapılır. |
| `roadSelected` | `boolean` | Kullanıcı yol polygon’una tıkladı mı; seçiliyse “Yolu sil” gösterilir. |
| `uiMode` | `UiMode` | `"draw_road"` = yol çizme modu. |

**Önemli:** Yol tamamlanınca `pieces`, `splitLines`, `fixedCuts` sıfırlanır; bölme yeniden “Hesapla” ile yapılır ve `baseParentsRings` kullanılır.

---

## 4. Olaylar ve Handler’lar (parcel-split.tsx)

### 4.1 Yol moduna giriş/çıkış

- **handleActionBarYolCiz:** ActionBar’daki “Yol Çiz” butonuna basıldığında.
  - Zaten `draw_road` ise → `uiMode = "pan_zoom"`.
  - Değilse → `edge_slide` ise önce `select_piece` yapılır, sonra `uiMode = "draw_road"`.
- **onDrawRoadToggle:** Mod kapatılırken taslağı temizlemek için; `setRoadDraftPoints([])`.

### 4.2 Taslak nokta ekleme / silme / iptal

- **handleRoadDraftPoint(world: Point):** Canvas’ta tap → ekran koordinatı `world` (yerel metre)’e çevrilir; bu nokta `roadDraftPoints`’e **append** edilir.
- **handleRemoveLastRoadPoint:** Son noktayı siler; `roadDraftPoints.slice(0, -1)`.
- **handleCancelRoad:** Taslağı temizler ve modu kapatır: `setRoadDraftPoints([])`, `setUiMode("pan_zoom")`.

### 4.3 Yol tamamlama (Tamamla butonu)

- **handleCompleteRoad:**
  1. Koşullar: `ring` (parent) var, en az 3 nokta; `roadDraftPoints.length >= 2`.
  2. Genişlik: `roadWidthInput` parse edilir; geçersizse 2; sınırlar: 0.5–30 m.
  3. **buildRoadBufferPolygon(roadDraftPoints, W)** → yol koridor polygon’u (ring).
  4. **intersectRoadWithParent(roadBufferRing, ring)** → yolun parsel içinde kalan kısmı `roadPoly`. Boş veya &lt; 3 nokta ise Alert “Yol parsel içinde oluşmadı.” ve return.
  5. **subtractRoadFromParent(ring, roadPoly)** → parent’tan yol çıkarılmış parçalar `baseParents` (Point[][]).
  6. `baseParents.length === 0` ise aynı Alert ve return.
  7. State güncellemesi:
     - `setRoadPolygon(roadPoly)`
     - `setBaseParentsRings(baseParents)`
     - `setRoadDraftPoints([])`
     - `setPieces([])`, `setSplitLines([])`, `setFixedCuts([])`, `setSelectedPieceId(null)`, `setSelectedPieceIdsForPanel([])`
     - `setRoadSelected(true)`, `setUiMode("pan_zoom")`

### 4.4 Yol silme

- **handleDeleteRoad:** Yol ve türevlerini sıfırlar: `setRoadPolygon(null)`, `setBaseParentsRings(null)`, pieces/splitLines/fixedCuts/selectedPieceId/selectedPieceIdsForPanel temizlenir, `setRoadSelected(false)`.

---

## 5. Geometri (roadGeometry.ts)

Dosya: `frontend/src/utils/roadGeometry.ts`. Kütüphane: `polygon-clipping`.

### 5.1 buildRoadBufferPolygon(polylinePoints: Point[], widthMeters: number): Point[]

- **Girdi:** Polyline noktaları (en az 2), genişlik (metre).
- **Davranış:** Genişlik 0.5–30 m arasına kısıtlanır; yarı genişlik `W = width/2`. Her segment için sola/sağa dik vektörle paralel noktalar; uçlarda **yuvarlak cap** (12 segment). Sol + sağ + cap’lerle **kapalı ring** döner.
- **Çıktı:** Yol koridor polygon’u (ring, metre koordinat).

### 5.2 intersectRoadWithParent(roadRing: Point[], parentRing: Point[]): Point[] | null

- **Girdi:** Yol koridor ring’i, parent parsel ring’i.
- **Davranış:** `polygon-clipping` ile **intersection**. Hata veya boş sonuç → null.
- **Çıktı:** Yolun parsel içinde kalan polygon’u (ring) veya null.

### 5.3 subtractRoadFromParent(parentRing: Point[], roadRing: Point[]): Point[][]

- **Girdi:** Parent ring, yol (kesişim sonucu) ring.
- **Davranış:** `polygon-clipping` ile **difference**. Sonuç MultiPolygon olabilir; her polygon’un dış ring’i `Point[]` olarak alınır.
- **Çıktı:** Parent’tan yol çıkarılmış bir veya daha fazla polygon (her biri Point[]).

---

## 6. Canvas ve Tap Davranışı (Canvas2D.tsx)

- **handleTapEnd(sx, sy):** Ekran koordinatı `(sx, sy)` → viewTransform ile **world (metre)** noktasına çevrilir: `pw = { x: (sx - tx) / scale, y: (sy - ty) / scale }`.
- **uiMode === "draw_road"** ve **onRoadDraftPoint** varsa: `onRoadDraftPoint(pw)` çağrılır ve **return** (başka tap işlemi yapılmaz).
- **pan_zoom / select_piece:** `roadPolygon` varsa tap ile yol seçimi: `pointInPolygon(pw, roadPolygon)` → `onRoadSelect(true)`; dışarı tap → `onRoadSelect(false)`.

Canvas2D’ye yol ile ilgili geçilen props: `roadDraftPoints`, `roadPolygon`, `onRoadDraftPoint`, `roadSelected`, `onRoadSelect`.

---

## 7. Katmanlar (Layers)

- **LayerRoadDraft** (`LayerRoadDraft.tsx`): `points: Point[]`. Taslak noktaları **daire** (r=0.35 m) ve aralarında **kesikli polyline** (stroke, strokeDasharray) çizer. `roadDraftPoints` boş değilse ve uzunluk ≥ 2 ise çizgi de çizilir.
- **LayerRoadPolygon** (`LayerRoadPolygon.tsx`): `ring: Point[]`, `selected?: boolean`. Tamamlanmış yol polygon’u; seçili değilken gri/slate dolgu ve stroke, seçiliyken mavi dolgu ve stroke.

Canvas2D içinde sıra: LayerRoadDraft ve LayerRoadPolygon, diğer katmanlarla birlikte aynı viewBox’ta çizilir (world koordinat).

---

## 8. ActionBar ve RoadModeBar

- **ActionBar** (`ActionBar.tsx`): “Yol Çiz” toggle. `uiMode === "draw_road"` ise aktif stil. `onYolCizPress` → route’taki `handleActionBarYolCiz`.
- **RoadModeBar** (`modebars/RoadModeBar.tsx`): Sadece `uiMode === "draw_road"` ve `hasRing` iken render edilir.
  - **Genişlik:** TextInput, `roadWidthInput` / `setRoadWidthInput`, placeholder "2", birim "m".
  - **Tamamla:** `onComplete={handleCompleteRoad}`; `roadDraftPointsCount < 2` ise disabled.
  - **Son Sil:** `onRemoveLast={handleRemoveLastRoadPoint}`; nokta yokken disabled.
  - **İptal:** `onCancel={handleCancelRoad}`.

---

## 9. StatsChip (draw_road modunda)

`uiMode === "draw_road"` iken canvas üzerinde StatsChip gösterilir: mod `"draw_road"`, `roadWidth` (roadWidthInput), `pointCount` (roadDraftPoints.length). Bilgi amaçlı; tıklanınca özel bir yol aksiyonu yok (opsiyonel davranış kodda farklı olabilir).

---

## 10. ManagementPanel – Yol Silme

- `roadPolygon` ve `roadSelected` true ise panelde “Yol seçili” + **“Yolu sil”** butonu gösterilir.
- “Yolu sil” → `onDeleteRoad` → `handleDeleteRoad`.

---

## 11. Veri Akışı Özeti (Yol Çizme)

1. Kullanıcı “Yol Çiz”e basar → `uiMode = "draw_road"`.
2. Canvas’ta tap → `handleTapEnd` → world noktası → `handleRoadDraftPoint` → `roadDraftPoints` güncellenir.
3. LayerRoadDraft bu noktaları çizer (daire + polyline).
4. Kullanıcı Genişlik girer (örn. 2 m), “Son Sil” / “İptal” / “Tamamla” kullanır.
5. “Tamamla”: `buildRoadBufferPolygon` → `intersectRoadWithParent` → `subtractRoadFromParent` → `roadPolygon`, `baseParentsRings` set edilir; taslak temizlenir; mod `pan_zoom` olur.
6. Sonraki bölme (“Hesapla”) `baseParentsRings` (varsa) veya tek `ring` ile yapılır.
7. Yol polygon’a tap → seçilir; ManagementPanel’den “Yolu sil” ile yol kaldırılır.

---

## 12. Dosya Referansları

| Ne | Dosya |
|----|--------|
| Route ve state/handlers | `frontend/app/routes/parcel-split.tsx` |
| Yol geometrisi | `frontend/src/utils/roadGeometry.ts` |
| Canvas ve tap | `frontend/components/app/parcelSplit/Canvas2D.tsx` |
| Taslak katmanı | `frontend/components/app/parcelSplit/LayerRoadDraft.tsx` |
| Yol polygon katmanı | `frontend/components/app/parcelSplit/LayerRoadPolygon.tsx` |
| Yol çiz toolbar | `frontend/components/app/parcelSplit/modebars/RoadModeBar.tsx` |
| Üst bar Yol Çiz toggle | `frontend/components/app/parcelSplit/ActionBar.tsx` |
| Tipler | `frontend/src/types/parcelSplit.ts` (Point, UiMode) |

Bu komut, hisseli parsel sayfasındaki yol çizme işlemlerinin tam davranışını ve kod konumlarını tanımlar; başka bir yapay zeka buna göre analiz veya değişiklik yapabilir.
