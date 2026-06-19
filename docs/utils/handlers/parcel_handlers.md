# Parsel Handler'ları (parcelHandlers) Dokümantasyonu

## Özellik/Görev

`parcelHandlers.ts`, parsel sorgusu ile ilgili handler fonksiyonlarını içerir. Şu anda sadece `createHandleAdaParselSubmit` fonksiyonu bu dosyada bulunmaktadır.

Not: Dosyanın başındaki yorumda `handleMapPress` ve `handlePropertyTypeSelect` fonksiyonlarından bahsedilmiş olsa da, bu fonksiyonlar henüz handler dosyasına taşınmamış ve `app/index.tsx` içinde direkt olarak tanımlıdır.

## Girdiler

### createHandleAdaParselSubmit Parametreleri

```typescript
export const createHandleAdaParselSubmit = (
  isLoadingParcel: boolean,              // Parsel yükleme durumu
  isProMode: boolean,                    // Pro mod aktif/pasif
  is3DMode: boolean,                     // 3D mod aktif/pasif
  setIsLoadingParcel: (loading: boolean) => void,  // Loading state setter
  setParcelData: (data: ParcelData | null) => void,  // Parsel data state setter
  setActiveScreen: (screen: string | null) => void,  // Active screen state setter
  setParcelModalVisible: (visible: boolean) => void, // Modal görünürlüğü state setter
  cameraRef: CameraRef,                  // Mapbox Camera referansı
  camRef: CamRef,                        // Kamera durumu referansı
  isProgrammaticMoveRef: ProgrammaticMoveRef,  // Programatik hareket durumu referansı
  programmaticTimerRef: ProgrammaticTimerRef   // Programatik hareket timer referansı
) => {
  return async (payload: {
    mahalleTkgmValue: number;  // Mahalle TKGM value
    mahalle: string;           // Mahalle adı
    ada: string;               // Ada numarası
    parsel: string;            // Parsel numarası
  }) => {
    // Handler fonksiyonu
  };
};
```

### Interface Tanımları

```typescript
interface CameraRef {
  current: {
    fitBounds?: (
      min: [number, number],
      max: [number, number],
      padding: number,
      duration: number
    ) => void;
    setCamera?: (settings: {
      centerCoordinate: [number, number];
      zoomLevel: number;
      pitch: number;
      animationDuration: number;
      animationMode: string;
    }) => void;
  } | null;
}

interface CamRef {
  current: {
    pitch?: number;
  };
}

interface ProgrammaticMoveRef {
  current: boolean;
}

interface ProgrammaticTimerRef {
  current: ReturnType<typeof setTimeout> | null;
}
```

## İç Akış

### 1. Handler Oluşturma (createHandleAdaParselSubmit)

Factory fonksiyonu, parametreleri closure içinde tutarak handler fonksiyonu oluşturur.

### 2. Validasyon

```typescript
if (isLoadingParcel) return;
```

Eğer zaten bir parsel sorgusu yapılıyorsa, yeni sorgu başlatılmaz.

### 3. State Güncelleme

```typescript
setIsLoadingParcel(true);
setParcelData(null);
```

Loading state aktif edilir ve mevcut parsel data temizlenir.

### 4. API Endpoint Belirleme

```typescript
const backendUrl = process.env.EXPO_PUBLIC_API_URL || 'http://78.186.188.162:8001';
const endpoint = isProMode ? '/api/get_parcel_info' : '/api/tkgm_view';
const fullUrl = `${backendUrl}${endpoint}`;
```

Pro modda `/api/get_parcel_info` endpoint'i, basit modda `/api/tkgm_view` endpoint'i kullanılır.

### 5. Request Body Oluşturma

```typescript
const requestBody: any = {
  mahalle: payload.mahalle,
  mahalleTkgmValue: payload.mahalleTkgmValue,
  ada: payload.ada,
  parsel: payload.parsel,
  map_mode: '2d',
  is3D: is3DMode,
};
```

Request body oluşturulur. Pro modda property type bilgisi gerekir (ama bu handler'da yok, index.tsx'te handlePropertyTypeSelect'te var).

### 6. API Sorgusu

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 60000);

const response = await fetch(fullUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(requestBody),
  signal: controller.signal,
});

clearTimeout(timeoutId);
```

API sorgusu yapılır:
- 60 saniye timeout ile
- AbortController kullanılarak
- POST method ile

### 7. Response Kontrolü

```typescript
if (!response.ok) {
  const txt = await response.text().catch(() => '');
  throw new Error(`HTTP ${response.status} ${txt}`);
}

const data: ParcelResponse = await response.json();
```

Response kontrol edilir, hata varsa exception fırlatılır.

### 8. Geometry Extraction

```typescript
let geometry: GeoJSONGeometry | null = null;
if (isProMode) {
  const proData = data as ProParcelResponse;
  if (proData.geometry) {
    geometry = proData.geometry;
  } else if (proData.parameters_polygons?.parcel_polygon) {
    // parcel_polygon'dan geometry çıkar
  }
} else {
  const tkgmData = data as TkgmViewResponse;
  if (tkgmData.geometry) geometry = tkgmData.geometry;
}
```

Geometry, response'dan extract edilir:
- Pro mod: `geometry` veya `parameters_polygons.parcel_polygon`'dan
- Basit mod: `geometry`'den direkt

### 9. Geometry Normalizasyonu

```typescript
const normalizedGeometry = isProMode
  ? normalizeGeometryCoordinates(geometry)
  : geometry;
```

Pro modda geometry koordinatları normalize edilir (lat/lon swap kontrolü).

### 10. Properties Extraction

```typescript
let parcelProperties: Record<string, any> = {};
if (isProMode) {
  const proData = data as ProParcelResponse;
  parcelProperties = {
    ...(proData.properties || {}),
    ...(proData.parameters_data?.parcel_values || {}),
  };
} else {
  const tkgmData = data as TkgmViewResponse;
  parcelProperties = tkgmData.properties || {};
}
```

Properties extract edilir:
- Pro mod: `properties` + `parameters_data.parcel_values`
- Basit mod: `properties`

### 11. Parsel Data Set Etme

```typescript
setParcelData({
  geometry: normalizedGeometry,
  properties: parcelProperties,
  analysisData: isProMode ? (data as ProParcelResponse) : null,
});
```

Parsel data state'e set edilir.

### 12. Kamera Odaklama

```typescript
// Bbox hesapla
const bbox = calculateBounds(normalizedGeometry);

// fitBounds varsa kullan (öncelikli)
if (bbox && typeof cameraRef.current.fitBounds === 'function') {
  cameraRef.current.fitBounds([bbox.minLon, bbox.minLat], [bbox.maxLon, bbox.maxLat], 60, 900);
} else {
  // fallback: setCamera
  const cameraSettings = calculateBoundsAndCamera(normalizedGeometry);
  cameraRef.current.setCamera({ ... });
}
```

Kamera, parsel'e odaklanır:
- `fitBounds` varsa öncelikli kullanılır
- Yoksa `calculateBoundsAndCamera` ile center/zoom hesaplanır ve `setCamera` kullanılır

### 13. Modal Açma

```typescript
setActiveScreen(null);  // Search modal'ı kapat
setParcelModalVisible(true);  // Parsel modal'ı aç
```

Search modal'ı kapatılır ve parsel modal'ı açılır.

### 14. Temizlik (Finally Block)

```typescript
finally {
  setIsLoadingParcel(false);
}
```

Loading state sıfırlanır.

## Çıktılar

### State Değişiklikleri

- `isLoadingParcel`: Sorgu sırasında true, sonrasında false
- `parcelData`: Parsel verisi (geometry, properties, analysisData)
- `activeScreen`: null (search modal kapatılır)
- `parcelModalVisible`: true (parsel modal açılır)

### Kamera Değişiklikleri

Kamera, parsel'e odaklanır:
- `fitBounds` kullanılırsa: Parsel bounds'larına fit edilir
- `setCamera` kullanılırsa: Center ve zoom ayarlanır

## Kullanım

### Handler Oluşturma

```typescript
import { createHandleAdaParselSubmit } from './utils/handlers/parcelHandlers';

const handleAdaParselSubmit = useCallback(
  createHandleAdaParselSubmit(
    isLoadingParcel,
    isProMode,
    is3DMode,
    setIsLoadingParcel,
    setParcelData,
    setActiveScreen,
    setParcelModalVisible,
    cameraRef,
    camRef,
    isProgrammaticMoveRef,
    programmaticTimerRef
  ),
  [isProMode, is3DMode]
);
```

### Handler Çağırma

```typescript
// AdaParselForm'dan gelen payload ile
handleAdaParselSubmit({
  mahalleTkgmValue: 12345,
  mahalle: 'Mahalle Adı',
  ada: '123',
  parsel: '456'
});
```

## API Endpoints

### Basit Mod: /api/tkgm_view/

**Method:** POST

**Request Body:**
```json
{
  "mahalle": "Mahalle Adı",
  "mahalleTkgmValue": 12345,
  "ada": "123",
  "parsel": "456",
  "map_mode": "2d",
  "is3D": false
}
```

**Response:** `TkgmViewResponse`
- `geometry`: GeoJSONGeometry
- `properties`: TkgmProperties

### Pro Mod: /api/get_parcel_info/

**Method:** POST

**Request Body:**
```json
{
  "mahalle": "Mahalle Adı",
  "mahalleTkgmValue": 12345,
  "ada": "123",
  "parsel": "456",
  "map_mode": "2d",
  "is3D": false,
  "property_type_override": "Arsa"  // Bu handler'da yok, index.tsx'te handlePropertyTypeSelect'te var
}
```

**Response:** `ProParcelResponse`
- `geometry`: GeoJSONGeometry (opsiyonel)
- `parameters_polygons.parcel_polygon`: GeoJSONGeometry (opsiyonel)
- `properties`: Record<string, any> (opsiyonel)
- `parameters_data.parcel_values`: Parsel değerleri

## Hata Yönetimi

### Hata Durumları

1. **Loading Durumunda:**
   - Yeni sorgu başlatılmaz (early return)

2. **API Timeout:**
   - 60 saniye timeout
   - Timeout olursa AbortController ile iptal edilir
   - Hata fırlatılır

3. **HTTP Hatası:**
   - Response ok değilse hata fırlatılır
   - Status code ve mesaj gösterilir

4. **Geometry Bulunamadı:**
   - Alert gösterilir
   - İşlem durdurulur

5. **Kamera Hatası:**
   - Sessizce fallback yapılır (try-catch içinde)
   - Hata loglanır ama kullanıcıya gösterilmez

### Temizlik (Finally Block)

Her durumda (başarılı/başarısız):
- Loading state sıfırlanır

## Zaman Aşımı Değerleri

- **API Timeout:** 60 saniye
- **Kamera Animasyon Süresi:** 900ms
- **Programmatic Timer:** 950ms (kamera animasyonundan 50ms sonra)
- **setTimeout Delay:** 50ms (source/layer render için)

## Diğer Modüller

### Bağımlılıklar

**React Native:**
- `Alert` - Hata mesajları

**Local:**
- `parcelUtils` - Parsel yardımcı fonksiyonları
  - `normalizeGeometryCoordinates` - Geometry koordinat normalizasyonu
  - `calculateBoundsAndCamera` - Bounds ve kamera ayarları hesaplama
  - `isPointInParcel` - Nokta parsel içinde mi kontrol (import edilmiş ama kullanılmıyor)
- `propertyTypeUtils` - Property type yardımcı fonksiyonları
  - `extractNitelikText` - Nitelik metni çıkarma (import edilmiş ama kullanılmıyor)
  - `generatePropertyTypeTitle` - Property type başlık oluşturma (import edilmiş ama kullanılmıyor)
- `parcelResponse` types - Parsel veri tipleri
  - `ProParcelResponse` - Pro mod response tipi
  - `TkgmViewResponse` - Basit mod response tipi
  - `ParcelResponse` - Genel parsel response tipi
  - `GeoJSONGeometry` - Geometry tipi
  - `ParcelData` - Parsel data tipi

### Kullanıldığı Yerler

- `app/index.tsx` - Ana ekranda Ada/Parsel formu gönderimi
- `handleAdaParselSubmit` handler'ı oluşturulur ve `AdaParselForm` component'inin `onSubmit` prop'u olarak kullanılır

## Notlar

- Handler, factory fonksiyonu olarak tasarlanmıştır (closure kullanır)
- Pro modda `/api/get_parcel_info` endpoint'i kullanılır, ancak property type bilgisi bu handler'da yok
- Basit modda `/api/tkgm_view` endpoint'i kullanılır
- Geometry, farklı response formatlarından extract edilir
- Pro modda geometry normalize edilir (lat/lon swap kontrolü)
- Kamera odaklama için `fitBounds` öncelikli, yoksa `setCamera` kullanılır
- Programmatic move ref kullanılır (kullanıcı hareketi ile programatik hareketi ayırt etmek için)
- Timeout 60 saniye (uzun süren analizler için)
- Tüm hata durumları handle edilir ve kullanıcıya bildirilir
- Not: `handleMapPress` ve `handlePropertyTypeSelect` fonksiyonları henüz bu dosyaya taşınmamış, index.tsx'te tanımlı

## İlgili Dokümanlar

- `docs/index.md` - Ana ekran dokümantasyonu (parcelHandlers kullanımı)
- `components/AdaParselForm.md` - Ada/Parsel form dokümantasyonu
- `utils/parcelUtils.md` - Parsel yardımcı fonksiyonları dokümantasyonu
- `utils/propertyTypeUtils.md` - Property type yardımcı fonksiyonları dokümantasyonu
- `types/parcelResponse.md` - Parsel response tipleri dokümantasyonu
