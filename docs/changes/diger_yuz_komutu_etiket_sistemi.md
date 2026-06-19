# Diğer Yapay Zekâya Komut: Kenar Ölçüm Etiket Sistemi ve Başarısız İşlem

Aşağıdaki metni **olduğu gibi kopyalayıp başka bir yapay zekâya (örn. Claude, GPT) yapıştır**. O yapay zeka bu sistemi anlayacak ve **işlemin başarılı olmadığını** bilerek devam edecek.

---

## Kopyala-yapıştır komutu (Türkçe)

```
ProParcel mobil uygulamasında "Hisseli Parsel" (ParcelSplit) ekranında kenar ölçüm etiketleri (örn. "48m") gösteriliyor. Dar hisseli parsellerde bu etiketler üst üste biniyor; yapılan iyileştirme denemesi başarılı olmadı. Senden bu güncel sistemi anlaman ve etiket çakışmasını gerçekten çözmeni istiyorum.

---

GÜNCEL SİSTEM (Pipeline)

1. Backend: POST /api/calculate_edge_measures/ → edge_measure_data (segment_lengths, bbox, main_edges, segment_assignments, vb.) döner.

2. edgeMeasurementsManager.ts:
   - createEdgeMeasurementFeatures(parcelGeometry, edge_measure_data) çağrılır.
   - calculateSegmentLabelPositions içinde her poligon segmenti (ring[i] → ring[i+1]) için:
     - Orta nokta (midLon, midLat), dik vektör (centroid’den dışarı), sabit offset (~14 m derece) ile label konumu (lon/lat) hesaplanır.
     - Her feature’a properties.edgeIndex = i eklenir (ring’deki segment indeksi).
   - Çıktı: GeoJSON Feature[] (Point = segment etiketleri, coordinates = [lon, lat], properties: kind, text, color, edgeIndex).

3. parcel-split.tsx:
   - edgeFeaturesToMetre(features, originMeters, ring ?? null) ile lon/lat → local metre dönüşümü.
   - Segment’ler için: f.properties.edgeIndex kullanılır (yoksa segmentPointIndex fallback). Ring’den ring[edgeIndex], ring[edgeIndex+1] ile kenar alınır; coords = midpoint (orta nokta), angle = atan2(dy,dx)*180/π, edgeIndex çıktıya eklenir. Offset/stagger artık burada yok; placement Canvas2D’de yapılıyor.
   - Çağrı: edgeFeaturesToMetre(features, originMeters, ring ?? null) — ring mutlaka geçirilmeli.

4. Canvas2D.tsx:
   - edgeMeasurementsMetre prop olarak gelir (parent + piece segment’leri).
   - resolveLabelCollisions(features, ring, viewTransform, width, height) ile screen-space collision avoidance yapılıyor:
     - Sadece kind==='segment' ve typeof edgeIndex==='number' olan feature’lar işlenir (parent segment’leri).
     - Ring’den ring[edgeIndex], ring[edgeIndex+1] ile mid, perp (dışarı), along, S = min(6, len*0.35) hesaplanır.
     - Aday pozisyonlar: normal offset [8, 12, 16, 20] m × along offset [-S, -0.5*S, 0, 0.5*S, S].
     - Her aday metre → ekran: worldToScreen(pos, viewTransform) (parcelSplitTransform’tan).
     - Metin bbox (ekran): charCount*3*0.6 metre genişlik, 3 metre yükseklik → scale ile piksel; rectsOverlap ile önceki yerleştirilmiş bbox’larla test; LABEL_BBOX_PADDING_PX = 2.
     - Çakışmayan ilk aday seçilir; normal offset > 8 ise leaderLine: { from: mid, to: pos } eklenir.
     - Hiç uygun aday yoksa fallback: 8 m dışarı + leaderLine.
   - placedEdgeMeasurements = useMemo(() => resolveLabelCollisions(edgeMeasurementsMetre, ring, viewTransform, width, height), [...]) ile hesaplanır; LayerEdgeMeasurements’a placedEdgeMeasurements verilir.

5. LayerEdgeMeasurements.tsx:
   - Sadece kind==='segment' Point’leri SVG Text ile çizer (fontSize=3, angle ile döndürme).
   - feature.leaderLine varsa Line ile mid → coords çizilir (strokeOpacity 0.7).
   - MetreEdgeFeaturePoint tipinde edgeIndex?, leaderLine?: { from: Point; to: Point } var.

İlgili dosyalar:
- frontend/src/utils/edgeMeasurementsManager.ts (createEdgeMeasurementFeatures, calculateSegmentLabelPositions, properties.edgeIndex)
- frontend/screens/routes/parcel-split.tsx (edgeFeaturesToMetre, edgeIndex kullanımı, midpoint çıktı)
- frontend/components/app/parcelSplit/Canvas2D.tsx (resolveLabelCollisions, LABEL_NORMAL_OFFSETS_M, rectsOverlap, worldToScreen, placedEdgeMeasurements)
- frontend/components/app/parcelSplit/LayerEdgeMeasurements.tsx (segment Text, leaderLine Line)
- frontend/src/utils/parcelSplitTransform.ts (worldToScreen(p, viewTransform))

---

SORUN VE BAŞARISIZ İŞLEM

- Hedef: Dar dikdörtgen/hisseli parsellerde kenar ölçüm etiketlerinin üst üste binmesini önlemek.
- Yapılanlar: Backend’e edgeIndex eklendi; edgeFeaturesToMetre edgeIndex kullandı ve segment’leri midpoint olarak çıkardı; Canvas2D’de screen-space collision avoidance (aday seti, metre→piksel bbox, overlap testi, leader-line) eklendi; LayerEdgeMeasurements leader-line çiziyor.
- Sonuç: İşlem başarılı olmadı — etiketler hâlâ üst üste biniyor veya istenen şekilde dağılmıyor.

Senden beklenen: Bu güncel kodu inceleyip neden collision avoidance’ın işe yaramadığını bulman ve etiket çakışmasını gerçekten çözecek bir patch önermen (veya uygulaman). Örneğin: bbox hesabının yanlış olması (döndürülmüş metin, scale birimi), aday sırasının yanlış olması, sadece parent segment’lerin işlenip piece segment’lerin çakışması, viewTransform’un useMemo anında güncel olmaması, vb. olası nedenleri kontrol et.
```

---

## Kısa özet (İngilizce, başka AI için)

```
ProParcel mobile app – ParcelSplit screen: edge measurement labels (e.g. "48m") overlap on narrow parcels. Current pipeline: Backend → createEdgeMeasurementFeatures (adds edgeIndex) → edgeFeaturesToMetre (midpoint + edgeIndex, no offset) → Canvas2D resolveLabelCollisions (candidate positions [8,12,16,20]m × along [-S,-0.5S,0,0.5S,S], screen bbox, rectsOverlap, leader-line) → LayerEdgeMeasurements (Text + optional Line). The collision-avoidance change was implemented but the operation was not successful — labels still overlap. Please analyze the code (edgeMeasurementsManager, parcel-split, Canvas2D, LayerEdgeMeasurements) and fix or replace the placement logic so labels no longer overlap.
```

---

Bu dosyayı açıp "Kopyala-yapıştır komutu" bölümündeki Türkçe metni veya İngilizce özeti kopyalayarak diğer yapay zekâya verebilirsin.
