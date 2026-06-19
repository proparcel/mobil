# Kenar Ölçüm Etiket Yerleştirme Sistemi

Bu dokümanda hisseli parsel ekranındaki kenar ölçümü etiketlerinin (örn. "48m") nasıl konumlandırıldığı ve hangi dosyaların ne yaptığı anlatılıyor. Başka bir yapay zeka veya geliştirici bu metni okuyarak sistemi anlayabilir.

---

## 1. Genel Akış (Pipeline)

```
Backend API (/api/calculate_edge_measures/)
    ↓
edge_measure_data (segment_lengths, bbox, main_edges, ...)
    ↓
createEdgeMeasurementFeatures(parcelGeometry, edge_measure_data)  [edgeMeasurementsManager.ts]
    → GeoJSON Feature[] (lon/lat; Point = segment label konumları)
    ↓
edgeFeaturesToMetre(features, originMeters, ringMetre)  [parcel-split.tsx]
    → MetreEdgeFeature[] (local metre; offset + stagger uygulanır)
    ↓
LayerEdgeMeasurements({ features, ring })  [LayerEdgeMeasurements.tsx]
    → SVG Text çizimi (sadece kind === "segment" Point'ler)
```

- **Backend:** Kenar uzunluklarını ve bbox bilgisini döner.
- **edgeMeasurementsManager:** Bu veriyi alıp her poligon segmenti için bir Point feature üretir (konum lon/lat, orta nokta + sabit offset).
- **parcel-split:** Bu feature'ları metre koordinatına çevirir; **ringMetre verilirse** her segment etiketine dik offset (poligon dışına) ve kenar boyunca stagger (üst üste binmeyi azaltmak) uygular.
- **LayerEdgeMeasurements:** Sadece `kind === "segment"` Point'leri SVG `<Text>` ile çizer; isteğe bağlı `ring` ile köşelere kırmızı X çizer.

**Önemli:** `edgeFeaturesToMetre` çağrılırken **üçüncü parametre `ringMetre` mutlaka geçirilmelidir** (parent poligonun metre cinsinden ring'i). Geçirilmezse segment etiketlerine offset/stagger uygulanmaz ve etiketler backend’den gelen ham konumda kalır.

---

## 2. Dosya ve Fonksiyonlar

### 2.1 `src/utils/edgeMeasurementsManager.ts`

**Amaç:** Backend’den gelen `edge_measure_data` ile parsel geometrisini kullanarak GeoJSON Feature listesi üretmek. Her poligon kenarı (segment) için bir Point feature: konum (lon/lat) ve metin (örn. "48m").

**Önemli fonksiyon: `calculateSegmentLabelPositions`**

- **Girdi:** `ring` (lon/lat köşe listesi), `segmentLengths`, `segmentAssignments`, `centroid`.
- **Mantık:**
  1. Her segment için kenar orta noktası: `midLon`, `midLat`.
  2. Kenar vektörü normalize: `(dx, dy)`.
  3. Dik vektör (90°): `(nx, ny) = (-dy, dx)`.
  4. Centroid’e göre yön: centroid’den uzaklaşacak tarafa çevir (`nx*vx + ny*vy < 0` ise `nx,ny` ters çevrilir).
  5. Sabit offset (derece cinsinden, ~14 m karşılığı): `baseOffset = 0.000126` → `labelLon = midLon + nx * baseOffset`, `labelLat = midLat + ny * baseOffset`.
- **Çıktı:** Her segment için `{ type: 'Feature', geometry: { type: 'Point', coordinates: [labelLon, labelLat] }, properties: { kind: 'segment', text: '48m', color } }`.

Burada konum **sadece orta nokta + sabit dik offset**; kenar boyunca kaydırma (stagger) yok. Stagger ekran tarafında (parcel-split) uygulanıyor.

---

### 2.2 `app/routes/parcel-split.tsx`

**Sabitler:**

```ts
const LABEL_OFFSET_PARENT_M = 8;   // Segment etiketleri poligonun bu kadar (m) dışında
const LABEL_STAGGER_ALONG_EDGE_M = 6;  // Dar parsellerde üst üste binmesin diye kenar boyunca max kayma (m)
```

**`ringCentroid(r: Point[]): Point`**  
Ring’in ağırlık merkezi (son nokta kapatma hariç).

**`edgeFeaturesToMetre(features, originMeters, ringMetre?)`**

- **Girdi:**
  - `features`: GeoJSON Feature[] (createEdgeMeasurementFeatures çıktısı).
  - `originMeters`: Lon/lat → metre dönüşümü için referans nokta.
  - `ringMetre`: Parent poligonun **metre cinsinden** ring’i (Point[]). **null ise segment konumlarına offset/stagger uygulanmaz.**

- **Ne yapar:**
  1. LineString feature’ları metre koordinata çevirip olduğu gibi ekler.
  2. Point feature’lar için:
     - `lon,lat` → `lonLatToLocalMeters` ile metre `coords` hesaplanır.
     - **Sadece** `f.properties.kind === "segment"` **ve** `ringMetre != null` ise ek konumlama yapılır:
       - `edgeIndex` = sıradaki segment indeksi (0, 1, 2, …).
       - Ring’ten o segmentin uç noktaları: `a = ringMetre[edgeIndex % n]`, `b = ringMetre[(edgeIndex+1) % n]`.
       - Kenar vektörü: `(dx, dy) = (b.x - a.x, b.y - a.y)`, `len = hypot(dx, dy)`.
       - Dik vektör: `perpX = -dy`, `perpY = dx`.
       - Centroid’e göre yön: `dot = (coords - cent) · perp`; `sign = dot >= 0 ? 1 : -1`; **çift segmentlerde ters:** `if (edgeIndex % 2 === 1) sign = -sign` → `(nx, ny) = sign * (perpX, perpY) / len`.
       - **Dik offset:** `coords += (nx, ny) * LABEL_OFFSET_PARENT_M`.
       - **Kenar boyunca stagger (dar parsellerde üst üste binmeyi azaltmak):**
         - `maxStagger = min(LABEL_STAGGER_ALONG_EDGE_M, len * 0.35)` (veya 0.4).
         - Slot: `edgeIndex % 4` veya `edgeIndex % 8` (8 slot kullanılırsa: `alongSigns = [-1.75, -1.25, -0.75, -0.25, 0.25, 0.75, 1.25, 1.75]`, `along = alongSigns[slot] * maxStagger`).
         - Kenar yönü birim vektör: `(ux, uy) = (dx, dy) / len`.
         - `coords += (ux, uy) * along`.
       - Açı (kenara paralel yazı): `angle = atan2(dy, dx) * 180/π`.
     - Sonuç Point feature `coords`, `text`, `color`, `angle` ile listeye eklenir.

- **Çıktı:** `MetreEdgeFeature[]` (local metre; segment’ler için konum = backend konumu + dik offset + kenar boyunca stagger).

**Çağrı yeri (önemli):**  
Kenar ölçüleri API’den geldikten sonra:

```ts
const features = createEdgeMeasurementFeatures(parentPolygonGeoJSON, data.edge_measure_data);
const metreFeatures = edgeFeaturesToMetre(features, originMeters, ring ?? null);  // ring MUTLAKA verilmeli
setParentEdgeMeasurementsMetre(metreFeatures);
```

`ring` verilmezse segment etiketleri backend’deki sabit offset’li konumda kalır; ekranda stagger/offset değişmez.

---

### 2.3 `components/app/parcelSplit/LayerEdgeMeasurements.tsx`

**Amaç:** `MetreEdgeFeature[]` ve isteğe bağlı `ring` ile SVG’de sadece segment etiketlerini ve köşe X’lerini çizmek.

**Props:** `features: MetreEdgeFeature[]`, `ring?: Point[] | null`.

**Çizim mantığı:**

1. **Point feature’lar:** Sadece `f.type === "Point"` **ve** `f.kind === "segment"` **ve** `f.text` anlamlı olanlar (boş / "0m" vb. atlanır).
   - Konum: `f.coords` (x, y metre).
   - Metin: `f.text`.
   - Açı: `f.angle` varsa `transform={rotate(angle, cx, cy)}` (kenara paralel).
   - Font: `fontSize = 3`, `fontWeight = "600"`, `textAnchor = "middle"`.

2. **LineString:** Bu katmanda çizilmiyor (return null).

3. **Köşe X’leri:** `ring` verilmişse, ring’in her köşesinde (son nokta ilk noktayla aynıysa tekrarlanmaz) küçük kırmızı X (iki çizgi) çizilir; boyut `VERTEX_X_SIZE = 0.4`, stroke `VERTEX_X_COLOR`, strokeWidth 0.15.

**Parça (piece) etiketleri:**  
Aynı dosyada `pieceToEdgeFeaturesMetre(piece)` fonksiyonu var. Her parça kenarı için orta nokta + centroid’e göre dik yönde `LABEL_OFFSET_M = 4` m offset ile bir Point feature üretir; stagger yok. Bu liste `edgeMeasurementsMetre` ile birleştirilip aynı layer’da çizilir.

---

## 3. Özet Tablo

| Aşama | Dosya | Ne yapıyor |
|--------|--------|------------|
| Konum (1) | edgeMeasurementsManager.ts | Her segment için orta nokta + sabit dik offset (lon/lat) → Point feature. |
| Konum (2) | parcel-split.tsx `edgeFeaturesToMetre` | Lon/lat → metre; **ringMetre** varsa dik offset (LABEL_OFFSET_PARENT_M) + kenar boyunca stagger (slot ile); açı hesaplanır. |
| Çağrı | parcel-split.tsx (useEffect) | `edgeFeaturesToMetre(features, originMeters, ring ?? null)` — **ring mutlaka verilmeli.** |
| Çizim | LayerEdgeMeasurements.tsx | Sadece `kind === "segment"` Point’leri SVG Text ile çizer; `ring` ile köşe X’leri. |

---

## 4. İlgili Kod Blokları (Kopyala-yapıştır için)

### 4.1 parcel-split.tsx – Sabitler ve edgeFeaturesToMetre (özet)

```ts
const LABEL_OFFSET_PARENT_M = 8;
const LABEL_STAGGER_ALONG_EDGE_M = 6;

function ringCentroid(r: Point[]): Point { /* ... */ }

function edgeFeaturesToMetre(features, originMeters, ringMetre: Point[] | null = null): MetreEdgeFeature[] {
  const out: MetreEdgeFeature[] = [];
  let segmentPointIndex = 0;
  for (const f of features) {
    // LineString: lon/lat -> metre, push
    if (f.geometry.type === "Point" && f.geometry.coordinates.length >= 2) {
      let coords = lonLatToLocalMeters(f.geometry.coordinates[0], f.geometry.coordinates[1], originMeters);
      let angle: number | undefined;
      if (f.properties.kind === "segment" && ringMetre && ringMetre.length >= 3) {
        const edgeIndex = segmentPointIndex++;
        const n = ringMetre.length;
        const a = ringMetre[edgeIndex % n], b = ringMetre[(edgeIndex + 1) % n];
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
        const cent = ringCentroid(ringMetre);
        const perpX = -dy, perpY = dx;
        const dot = (coords.x - cent.x) * perpX + (coords.y - cent.y) * perpY;
        let sign = dot >= 0 ? 1 : -1;
        if (edgeIndex % 2 === 1) sign = -sign;
        const nx = (sign * perpX) / (len || 1), ny = (sign * perpY) / (len || 1);
        const maxStagger = Math.min(LABEL_STAGGER_ALONG_EDGE_M, len * 0.4);
        const slot = edgeIndex % 8;
        const alongSigns = [-1.75, -1.25, -0.75, -0.25, 0.25, 0.75, 1.25, 1.75];
        const along = alongSigns[slot] * maxStagger;
        const ux = dx / (len || 1), uy = dy / (len || 1);
        coords = {
          x: coords.x + nx * LABEL_OFFSET_PARENT_M + ux * along,
          y: coords.y + ny * LABEL_OFFSET_PARENT_M + uy * along,
        };
        angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      }
      out.push({ kind: f.properties.kind, type: "Point", coords, text: f.properties.text ?? "", color: f.properties.color, ...(angle != null && { angle }) });
    }
  }
  return out;
}
```

**Çağrı (ring şart):**

```ts
const metreFeatures = edgeFeaturesToMetre(features, originMeters, ring ?? null);
```

### 4.2 edgeMeasurementsManager.ts – calculateSegmentLabelPositions (özet)

- Her segment için: `midLon, midLat`; `(dx,dy)` normalize; `(nx,ny) = (-dy,dx)`; centroid’e göre yön; `labelLon/Lat = mid + (nx,ny)*baseOffset` (baseOffset ≈ 0.000126).
- Çıktı: `{ type: 'Feature', geometry: { type: 'Point', coordinates: [labelLon, labelLat] }, properties: { kind: 'segment', text: '48m', color } }`.

### 4.3 LayerEdgeMeasurements.tsx – Sadece segment Point çizimi

- `features.map(f => ...)`: `f.type === "Point" && f.kind === "segment"` ve anlamlı `f.text` ise `<Text x={coords.x} y={coords.y} fontSize={3} transform={rotate(angle)}>{text}</Text>`.
- `ring` varsa köşelerde kırmızı X (Line).

---

Bu doküman, etiket yerleştirme mantığını ve **ring’in neden zorunlu olduğunu** açıklamak için başka bir yapay zekâya veya geliştiriciye verilebilir.
