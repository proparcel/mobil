# Hisseli Parsel Bölme Ekranı (parcel-split)

## Özellik / Görev

`parcel-split` route’u, hisseli parsel bölme MVP ekranıdır. Beyaz zemin üzerinde parent polygon çizilir; kullanıcı profil (Arsa/Tarla) seçer, yol kenarlarını kendisi işaretler, hedef m² veya adet + yön ile bölme yapar. Sonuç parçalar, split çizgileri, etiketler ve ihlal uyarıları gösterilir.

Giriş: ShapeDrawingModal → Ölçüm → "Hisseli Parsellere Böl" (tek parsel seçiliyken). Modal kapatılır, bu ekrana navigate edilir.

## Girdiler

### Route params (`useLocalSearchParams`)

- `parentPolygon`: GeoJSON Polygon veya `{ type, ring }` (stringify veya obje). Zorunlu.
- `parcelId`, `profileDefault` (opsiyonel).

## İç akış

1. `normalizeToRing(parentPolygon)` ile ring elde edilir.
2. `buildEdges(ring)` ile kenarlar; kullanıcı "Yol Kenarı Seç" ile tap ile toggle eder.
3. Alt panel: Profil, Yol seçimi, Mod (m²/adet), Yön, Hesapla. Arsa’da en az 1 yol kenarı zorunlu.
4. "Hesapla" → `computeSplit` (strip split + validasyon) → pieces, splitLines, fixedCuts.
5. Canvas’ta pan/pinch, fit-to-view, zoom +/–; parça seçimi (tap).

## Arayüz

- **Header:** Geri, "Hisseli Parsel Bölme", Info (yardım sheet).
- **Canvas:** Parent polygon, edge overlay, split lines, pieces, labels, warnings. Pan/pinch, fit-to-view.
- **StatsChip (sağ üst):** Toplam m², hedef, uygunsuz sayısı; tıklanınca parça listesi sheet.
- **FloatingTools (sağ alt):** Zoom +/–, Fit-to-view.
- **BottomPanel (alt, collapsible):** Profil, Yol Kenarı Seçimi, Mod, Yön, Hesapla.
- **BottomSheets:** Help (Info’dan), Piece list (StatsChip’ten).

## Dosya konumları

- Route: `app/routes/parcel-split.tsx`
- Bileşenler: `components/app/parcelSplit/` (Canvas2D, Layer*, BottomPanel, StatsChip, FloatingTools, HelpBottomSheet, PieceListBottomSheet, theme, useViewTransform)
- Transform: `src/utils/parcelSplitTransform.ts`
- Engine: `src/utils/parcelSplitEngine.ts`
- Tipler: `src/types/parcelSplit.ts`

## Sonraki aşama (MVP dışı)

Koridor, auto-orientation, auto-fix, export/save, min width / aspect ratio kuralları.
