# Ölçüm Yöneticisi (measurementManager) Dokümantasyonu

## Özellik/Görev

`measurementManager.ts`, harita üzerinde mesafe (ruler) ve alan ölçümü yapmak için kullanılan utility fonksiyonlarını içerir. Bu modül, React Native Mapbox uyumlu GeoJSON feature'ları oluşturur ve ölçüm hesaplamaları yapar.

Önemli not: Turf.js paketleri dependency conflict yaratmaması için kullanılmıyor. Bunun yerine fallback fonksiyonlar (Haversine, Shoelace) kullanılıyor. Bu yaklaşım @rnmapbox/maps ile uyumlu ve ek dependency gerektirmiyor.

## Girdiler

### Tipler

```typescript
export type MeasurementMode = null | 'ruler' | 'area';

export interface MeasurementFeature {
  type: 'Feature';
  geometry: {
    type: 'Point' | 'LineString' | 'Polygon';
    coordinates: number[] | number[][] | number[][][];
  };
  properties: {
    label?: string;              // Ölçüm etiketi (örn: "150 m", "1.234 m²")
    isDynamic?: boolean;         // Dinamik ölçüm (kullanıcı hala çiziyor)
    isTemporary?: boolean;       // Geçici ölçüm (henüz tamamlanmamış)
    measurementType?: 'ruler' | 'area';  // Ölçüm tipi
    isLabelOnly?: boolean;       // Sadece label için (nokta gösterilmez)
  };
}

export interface MeasurementState {
  mode: MeasurementMode;
  rulerPoints: [number, number][];    // Cetvel ölçümü noktaları
  areaPoints: [number, number][];     // Alan ölçümü noktaları
  features: MeasurementFeature[];      // Oluşturulan feature'lar
}
```

### Koordinat Formatı

Koordinatlar `[longitude, latitude]` formatında kullanılır (GeoJSON standardı):
- `[number, number]` - Tek nokta (Point)
- `[number, number][]` - Noktalar dizisi (LineString, Polygon)

## İç Akış

### 1. Mesafe Hesaplama (Haversine Formülü)

```typescript
export const haversineDistance = (point1: [number, number], point2: [number, number]): number => {
  const R = 6371000; // Dünya yarıçapı (metre)
  const lat1 = point1[1] * Math.PI / 180;
  const lat2 = point2[1] * Math.PI / 180;
  const dLat = (point2[1] - point1[1]) * Math.PI / 180;
  const dLng = (point2[0] - point1[0]) * Math.PI / 180;
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
};
```

Haversine formülü, küresel yüzey üzerinde iki nokta arasındaki mesafeyi hesaplar. Sonuç metre cinsindendir.

### 2. Alan Hesaplama (Shoelace Formülü)

```typescript
export const simpleAreaCalculation = (coords: [number, number][]): number => {
  if (coords.length < 3) return 0;
  
  // Shoelace formülü (degree² cinsinden alan)
  let area = 0;
  const n = coords.length;
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += coords[i][0] * coords[j][1]; // lon1 * lat2
    area -= coords[j][0] * coords[i][1]; // lon2 * lat1
  }
  
  area = Math.abs(area / 2); // degree² cinsinden
  
  // Degree²'den metrekare'ye dönüşüm
  const avgLat = coords.reduce((sum, c) => sum + c[1], 0) / n;
  const latRad = avgLat * Math.PI / 180;
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLon = 111320 * Math.cos(latRad);
  
  return area * metersPerDegreeLat * metersPerDegreeLon;
};
```

Shoelace formülü, düz zemin varsayımıyla polygon alanını hesaplar. Sonuç metrekare cinsindendir. Bu formül çoğu ölçüm için yeterli hassasiyet sağlar, ancak çok büyük alanlarda veya kutuplara yakın bölgelerde daha fazla hata yapabilir.

### 3. Ruler (Mesafe) Ölçümü Feature'ları

```typescript
export const createRulerFeatures = (
  points: [number, number][],
  distanceValue?: number
): MeasurementFeature[] => {
  // 1. Noktaları Point feature'ları olarak ekle
  // 2. İki nokta varsa LineString feature ekle
  // 3. Etiket (label) Point feature'ı ekle (orta noktada)
};
```

Ruler ölçümü için:
- Her nokta bir Point feature olarak eklenir
- İki nokta varsa aralarında LineString feature oluşturulur
- Mesafe etiketi orta noktada gösterilir (isLabelOnly: true)

### 4. Area (Alan) Ölçümü Feature'ları

```typescript
export const createAreaFeatures = (
  points: [number, number][],
  areaValue?: number,
  isTemporary: boolean = false
): MeasurementFeature[] => {
  // 1. Noktaları Point feature'ları olarak ekle
  // 2. En az 2 nokta varsa Polygon feature ekle (kapalı)
  // 3. En az 3 nokta varsa ve !isTemporary ise etiket ekle (centroid'te)
};
```

Area ölçümü için:
- Her nokta bir Point feature olarak eklenir
- En az 2 nokta varsa kapalı Polygon feature oluşturulur
- En az 3 nokta varsa ve ölçüm tamamlanmışsa (isTemporary: false) alan etiketi centroid'te gösterilir

### 5. Dinamik Ölçüm Feature'ları

```typescript
export const createDynamicRulerLine = (
  startPoint: [number, number],
  currentPoint: [number, number]
): MeasurementFeature => {
  // Kullanıcı hala çizerken gösterilen dinamik çizgi
  // isDynamic: true
};

export const createDynamicAreaLine = (
  lastPoint: [number, number],
  currentPoint: [number, number],
  allPoints: [number, number][]
): MeasurementFeature[] => {
  // Kullanıcı hala çizerken gösterilen dinamik alan
  // Geçici alan hesaplanır ve etiket gösterilir
};
```

Dinamik ölçüm feature'ları, kullanıcı hala ölçüm yaparken (tıklayarak çizerken) gösterilen geçici feature'lardır.

## Çıktılar

### GeoJSON Feature'ları

Modül, React Native Mapbox ile uyumlu GeoJSON Feature'ları üretir:

1. **Point Features:**
   - Nokta koordinatları (ruler ve area ölçümlerinde)
   - Label koordinatları (isLabelOnly: true)

2. **LineString Features:**
   - Ruler ölçümü için çizgi (2 nokta arası)
   - Dinamik çizgiler (createDynamicRulerLine, createDynamicAreaLine)

3. **Polygon Features:**
   - Area ölçümü için polygon (kapalı)

### Hesaplanan Değerler

- **Mesafe:** Metre cinsinden (formatDistance ile formatlanır: "150 m" veya "1.5 km")
- **Alan:** Metrekare cinsinden (formatArea ile formatlanır: "1.234 m²")

## Fonksiyonlar

### Hesaplama Fonksiyonları

#### calculateDistance
```typescript
export const calculateDistance = (
  point1: [number, number], 
  point2: [number, number]
): number
```
İki nokta arası mesafeyi hesaplar (metre cinsinden). Haversine formülü kullanır.

#### haversineDistance
```typescript
export const haversineDistance = (
  point1: [number, number], 
  point2: [number, number]
): number
```
Haversine mesafe formülünü uygular (fallback fonksiyon).

#### calculateArea
```typescript
export const calculateArea = (
  coords: [number, number][]
): number
```
Polygon alanını hesaplar (metrekare cinsinden). Shoelace formülü kullanır.

#### simpleAreaCalculation
```typescript
export const simpleAreaCalculation = (
  coords: [number, number][]
): number
```
Shoelace formülünü uygular (fallback fonksiyon). Degree²'den metrekare'ye dönüşüm yapar.

### Yardımcı Fonksiyonlar

#### getMidpoint
```typescript
export const getMidpoint = (
  point1: [number, number], 
  point2: [number, number]
): [number, number]
```
İki nokta arası orta noktayı hesaplar.

#### getCentroid
```typescript
export const getCentroid = (
  coords: [number, number][]
): [number, number]
```
Polygon merkez noktasını (centroid) hesaplar. Basit ortalama kullanılır (Turf.js dependency conflict'i önlemek için).

#### formatDistance
```typescript
export const formatDistance = (meters: number): string
```
Mesafe değerini formatlar:
- 1000m'den küçükse: "150 m"
- 1000m'den büyükse: "1.5 km"

#### formatArea
```typescript
export const formatArea = (sqMeters: number): string
```
Alan değerini formatlar: "1.234 m²" (Türkçe formatında)

### Feature Oluşturma Fonksiyonları

#### createRulerFeatures
```typescript
export const createRulerFeatures = (
  points: [number, number][],
  distanceValue?: number
): MeasurementFeature[]
```
Ruler (mesafe) ölçümü için GeoJSON feature'ları oluşturur:
- Nokta feature'ları
- LineString feature (2 nokta varsa)
- Label feature (orta noktada)

#### createAreaFeatures
```typescript
export const createAreaFeatures = (
  points: [number, number][],
  areaValue?: number,
  isTemporary: boolean = false
): MeasurementFeature[]
```
Area (alan) ölçümü için GeoJSON feature'ları oluşturur:
- Nokta feature'ları
- Polygon feature (en az 2 nokta varsa)
- Label feature (en az 3 nokta varsa ve !isTemporary)

#### createDynamicRulerLine
```typescript
export const createDynamicRulerLine = (
  startPoint: [number, number],
  currentPoint: [number, number]
): MeasurementFeature
```
Dinamik ruler çizgisi oluşturur (kullanıcı hala çizerken). isDynamic: true.

#### createDynamicAreaLine
```typescript
export const createDynamicAreaLine = (
  lastPoint: [number, number],
  currentPoint: [number, number],
  allPoints: [number, number][]
): MeasurementFeature[]
```
Dinamik area çizgisi oluşturur (kullanıcı hala çizerken). Geçici alan hesaplanır ve etiket gösterilir.

#### getCoordinateDistance
```typescript
export const getCoordinateDistance = (
  coords1: [number, number], 
  coords2: [number, number]
): number
```
İki koordinat arası mesafeyi hesaplar (metre cinsinden). Haversine mesafesini kullanır.

## Kullanım

### Ruler (Mesafe) Ölçümü

```typescript
import { createRulerFeatures, calculateDistance } from './utils/measurementManager';

// İki nokta arası mesafe ölçümü
const points: [number, number][] = [
  [34.0, 39.0],  // [lon, lat]
  [34.001, 39.001]
];

const features = createRulerFeatures(points);
// features: Point feature'ları, LineString feature, Label feature
```

### Area (Alan) Ölçümü

```typescript
import { createAreaFeatures, calculateArea } from './utils/measurementManager';

// Polygon alan ölçümü
const points: [number, number][] = [
  [34.0, 39.0],
  [34.001, 39.0],
  [34.001, 39.001],
  [34.0, 39.001]
];

const area = calculateArea(points);  // metrekare
const features = createAreaFeatures(points, area, false);
// features: Point feature'ları, Polygon feature, Label feature
```

### Dinamik Ölçüm

```typescript
import { createDynamicRulerLine, createDynamicAreaLine } from './utils/measurementManager';

// Kullanıcı hala çizerken gösterilen dinamik çizgi
const dynamicLine = createDynamicRulerLine(startPoint, currentPoint);

// Kullanıcı hala çizerken gösterilen dinamik alan
const dynamicArea = createDynamicAreaLine(lastPoint, currentPoint, allPoints);
```

### Formatlama

```typescript
import { formatDistance, formatArea } from './utils/measurementManager';

const distance = 1500;  // metre
const formatted = formatDistance(distance);  // "1.5 km"

const area = 1234.56;  // metrekare
const formatted = formatArea(area);  // "1.235 m²"
```

## Haritada Gösterim

Oluşturulan feature'lar, index.tsx'te şu şekilde haritada gösterilir:

### Point Features
```typescript
<Mapbox.ShapeSource shape={feature}>
  <Mapbox.CircleLayer 
    style={{ 
      circleRadius: 6, 
      circleColor: isArea ? '#FBBF24' : '#3B82F6' 
    }} 
  />
</Mapbox.ShapeSource>
```

### LineString Features
```typescript
<Mapbox.ShapeSource shape={feature}>
  <Mapbox.LineLayer 
    style={{ 
      lineColor: isRuler ? '#3B82F6' : '#FBBF24', 
      lineWidth: 3 
    }} 
  />
</Mapbox.ShapeSource>
```

### Polygon Features
```typescript
<Mapbox.ShapeSource shape={feature}>
  <Mapbox.FillLayer 
    style={{ 
      fillColor: '#FBBF24', 
      fillOpacity: 0.3 
    }} 
  />
  <Mapbox.LineLayer 
    style={{ 
      lineColor: '#FBBF24', 
      lineWidth: 2 
    }} 
  />
</Mapbox.ShapeSource>
```

### Label Features (isLabelOnly: true)
```typescript
<Mapbox.ShapeSource shape={feature}>
  <Mapbox.SymbolLayer
    style={{
      textField: ['get', 'label'],
      textSize: 14,
      textColor: '#ffffff',
      textHaloColor: '#000000',
      textHaloWidth: 2,
      textAnchor: 'center',
      textAllowOverlap: true,
    }}
  />
</Mapbox.ShapeSource>
```

## Matematiksel Detaylar

### Haversine Formülü

Haversine formülü, küresel yüzey (Dünya) üzerinde iki nokta arasındaki en kısa mesafeyi (great-circle distance) hesaplar:

```
a = sin²(Δlat/2) + cos(lat1) × cos(lat2) × sin²(Δlon/2)
c = 2 × atan2(√a, √(1−a))
d = R × c
```

Burada:
- R = Dünya yarıçapı (6,371,000 metre)
- lat1, lat2 = İki noktanın enlemleri (radyan)
- Δlat, Δlon = Enlem ve boylam farkları (radyan)
- d = Mesafe (metre)

### Shoelace Formülü

Shoelace formülü, düz zemin varsayımıyla polygon alanını hesaplar:

```
area = (1/2) × |Σ(xi × yi+1) - Σ(xi+1 × yi)|
```

Bu formül, degree² cinsinden alan verir. Metrekare'ye dönüşüm için:

```
metersPerDegreeLat = 111,320 metre (sabit)
metersPerDegreeLon = 111,320 × cos(lat) metre (enleme bağlı)
area_m² = area_degree² × metersPerDegreeLat × metersPerDegreeLon
```

## Sınırlamalar ve Notlar

### Haversine Formülü
- Küresel yüzey varsayımı yapar (Dünya mükemmel küre olarak kabul edilir)
- Küçük mesafeler için çok hassas sonuçlar verir
- Çok büyük mesafelerde (kutuplara yakın) küçük hatalar olabilir

### Shoelace Formülü
- Düz zemin varsayımı yapar (yükseklik farkları dikkate alınmaz)
- Çok büyük alanlarda veya kutuplara yakın bölgelerde daha fazla hata yapabilir
- Çoğu pratik kullanım için yeterli hassasiyet sağlar

### Turf.js Kullanılmama Nedeni
- Turf.js paketleri @rnmapbox/maps ile dependency conflict yaratabilir
- Ek dependency eklemek istemiyoruz
- Fallback fonksiyonlar (Haversine, Shoelace) çoğu durum için yeterli

## Diğer Modüller

### Bağımlılıklar

**React Native:**
- Yok (pure JavaScript/TypeScript fonksiyonları)

**Third-party:**
- Yok (dependency conflict'i önlemek için Turf.js kullanılmıyor)

**Local:**
- Yok (standalone utility modülü)

### Kullanıldığı Yerler

- `app/index.tsx` - Ana ekranda ölçüm özellikleri
- Measurement feature'ları haritada gösterilir
- Kullanıcı ölçüm yaptığında bu fonksiyonlar çağrılır

## İlgili Dokümanlar

- `docs/index.md` - Ana ekran dokümantasyonu (measurementManager kullanımı)
- `utils/edgeMeasurementsManager.md` - Kenar ölçüm yönetimi (farklı bir ölçüm türü)
