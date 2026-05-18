# Three.js Model Viewer - Mimari Döküman

## Genel Bakış

`threeJsModelViewer.ts` dosyası, React Native mobil uygulaması içinde WebView kullanarak 3D model görüntüleme ve harita üzerinde model ekleme işlevselliği sağlayan bir HTML generator modülüdür. Cesium yerine Three.js ve Mapbox GL JS kullanarak daha hafif ve performanslı bir çözüm sunar.

**Dosya Yolu:** `mobile/mobil_github/frontend/app/utils/threeJsModelViewer.ts`  
**Dosya Boyutu:** ~5644 satır  
**Dil:** TypeScript  
**Çıktı:** HTML string (WebView için)

---

## 1. Ana Hatlar ve Mimari Yapı

### 1.1 Modül Yapısı

```
threeJsModelViewer.ts
├── Interface: ThreeJsModelViewerOptions
├── Export Function: generateThreeJsModelViewerHTML()
└── HTML Output (String Template)
    ├── CSS Styles (732 satır)
    ├── HTML Structure
    └── JavaScript Logic (4900+ satır)
```

### 1.2 Bağımlılıklar

#### Harici Kütüphaneler
- **Three.js v0.161.0**: 3D model render için (ES Module)
- **Mapbox GL JS v3.0.1**: Harita görüntüleme ve custom layer desteği
- **GLTFLoader**: Three.js addon, GLTF model yükleme için

#### Backend API
- **FastAPI Backend** (Port: 8001)
  - `/api/3d-models-list/`: Model listesi endpoint'i
  - `/api/tkgm_view/`: Parsel seçim endpoint'i
  - `/static/models/`: Statik model dosyaları

#### React Native Entegrasyonu
- **WebView Bridge**: `window.ReactNativeWebView.postMessage()` ile iletişim
- **Message Types**: `threejs-ready`, `model-added`, `error`, `debug`, vb.

### 1.3 Genel Mimari Akış

```
React Native Component (ThreeJsModelViewer.tsx)
    ↓
generateThreeJsModelViewerHTML() çağrılır
    ↓
HTML string oluşturulur (CSS + HTML + JS)
    ↓
WebView içinde render edilir
    ↓
Mapbox harita başlatılır
    ↓
Three.js ES Module yüklenir
    ↓
Bridge kurulur (React Native ↔ WebView)
    ↓
Kullanıcı etkileşimleri başlar
```

---

## 2. Tasarımsal Yapı (UI/UX)

### 2.1 Layout Yapısı

#### Ana Container
```css
.model-viewer-container
├── .viewer-header (Header bar)
│   ├── .viewer-title ("3D Model Ekleme")
│   └── .close-btn (Kapat butonu)
└── .viewer-body (Ana içerik)
    ├── .map-container (Harita alanı - %70 desktop, %60 mobile)
    │   ├── #mapbox-map (Mapbox harita)
    │   ├── .map-controls-left (Sol üst kontroller)
    │   ├── .map-controls-right (Sağ üst submenu)
    │   └── .loading-overlay (Yükleme ekranı)
    └── .controls-panel (Kontrol paneli - %30 desktop, %40 mobile)
        ├── .tab-navigation (Tab menüsü)
        └── .tab-contents (Tab içerikleri)
```

### 2.2 Responsive Tasarım

#### Desktop (≥769px)
- **Layout**: Yan yana (flex-direction: row)
- **Map Container**: %70 genişlik
- **Controls Panel**: %30 genişlik, sol border ile ayrılmış

#### Mobile (≤768px)
- **Layout**: Alt alta (flex-direction: column)
- **Map Container**: %60 yükseklik, min-height: 50vh
- **Controls Panel**: %40 yükseklik, max-height: 40vh, scrollable

### 2.3 Renk Şeması

#### Ana Renkler
- **Primary**: `#3b82f6` (Mavi - butonlar, border, aktif durumlar)
- **Background Dark**: `#0f172a` (Ana container arka plan)
- **Background Header**: `#1e293b` (Header arka plan)
- **Background Panel**: `#f8fafc` (Kontrol paneli arka plan)
- **Text Primary**: `#1e293b` (Ana metin)
- **Text Secondary**: `#64748b` (İkincil metin)
- **Error**: `#ef4444` (Hata durumları)

#### Şekil Renkleri
- **Polygon Fill**: `#10b981` (Yeşil, %50 opacity)
- **Polygon Line**: `#059669` (Koyu yeşil)
- **Line**: `#fbbf24` (Sarı)
- **Arrow**: `#f97316` (Turuncu)
- **Marker**: `#06b6d4` (Cyan)
- **Textbox**: `#3b82f6` (Mavi)

### 2.4 UI Bileşenleri

#### Tab Navigation
- **4 Tab**: Model, Bina, Şekil, Metin
- **Aktif Tab**: Mavi border-bottom, mavi text, açık gri background
- **Pasif Tab**: Gri text, transparent background

#### Butonlar
- **Primary Button** (`.btn-add`): Mavi background, beyaz text
- **Danger Button** (`.btn-clear`): Kırmızı background, beyaz text
- **Control Button** (`.control-btn`): Koyu arka plan, mavi border, beyaz text
- **Active State**: Daha parlak mavi, glow efekti, scale transform

#### Form Elemanları
- **Dropdown**: Beyaz background, gri border, 6px border-radius
- **Range Slider**: Tam genişlik, custom styling
- **Color Picker**: 40x32px, border ile çerçeveli
- **Text Input**: Koyu arka plan, mavi border, beyaz text

#### Submenu (Sağ Üst Menü)
- **Container**: Yarı saydam koyu arka plan (`rgba(15, 23, 42, 0.95)`)
- **Header**: Koyu gri, mavi border-bottom
- **Content**: Scrollable, custom scrollbar (mavi)
- **Position**: Absolute, sağ üst köşe, z-index: 2000

### 2.5 Özel UI Öğeleri

#### Loading Overlay
- **Position**: Absolute, full screen
- **Background**: Yarı saydam siyah (`rgba(0, 0, 0, 0.7)`)
- **Content**: Spinner + metin, ortalanmış
- **Z-index**: 2000

#### Debug Info Panel
- **Position**: Absolute, sol alt köşe
- **Background**: Yarı saydam siyah (`rgba(0,0,0,0.8)`)
- **Font**: Monospace, 10px
- **Z-index**: 10001
- **Varsayılan**: Gizli (display: none)

#### Area Finish Button
- **Position**: Fixed, alt orta
- **Background**: Yarı saydam mavi (`rgba(59, 130, 246, 0.95)`)
- **Border**: 2px solid mavi
- **Z-index**: 3000
- **Varsayılan**: Gizli (display: none)

#### Movement Controls (Şekil Hareket)
- **Layout**: 3x3 grid
- **Buttons**: Yukarı, Aşağı, Sol, Sağ ok butonları
- **Style**: Koyu arka plan, mavi border, beyaz text

---

## 3. İşlevsel Yapı

### 3.1 State Yönetimi

#### Global State Object (`window.threeJsState`)
```javascript
{
  // Mapbox
  map: null,                    // Mapbox map instance
  scene: null,                  // Three.js scene (artık kullanılmıyor)
  camera: null,                 // Three.js camera (artık kullanılmıyor)
  renderer: null,               // Three.js renderer (artık kullanılmıyor)
  controls: null,               // Three.js controls (artık kullanılmıyor)
  
  // Model Yönetimi
  selectedModel: null,          // Seçili model value (type:file)
  selectedType: null,           // Model tipi (house/car/tree)
  selectedFile: null,           // Model dosya adı
  models: [],                   // Eski Three.js scene modelleri (artık kullanılmıyor)
  modelLayers: [],              // Mapbox custom layer ID'leri
  selectedModelLayer: null,      // Seçili model layer ID
  selectedModelEntity: null,    // Seçili model entity (Three.js object)
  modelEntities: {},            // Layer ID -> Three.js entity mapping
  
  // Çizim Modları
  drawingMode: null,            // null | 'parcel-selection' | 'rectangle' | 'triangle' | 'circle' | 'ellipse' | 'polygon' | 'line' | 'arrow' | 'marker' | 'textbox' | 'measure-distance' | 'measure-area'
  drawingStartPos: null,        // Çizim başlangıç pozisyonu
  drawingPoints: [],            // Çizim noktaları
  ellipseAxes: [],              // Elips eksenleri
  
  // Şekiller
  shapes: [],                   // Çizilen şekiller array
  selectedShape: null,          // Seçili şekil ID
  selectedShapeLayers: [],      // Seçili şeklin layer ID'leri
  
  // Parsel
  parcelSource: null,           // Parsel source ID
  parcelLayers: [],             // Parsel layer ID'leri
  
  // Ölçüm
  measurementLayers: [],        // Ölçüm layer ID'leri
  measurementFeatures: [],     // Ölçüm feature'ları
  areaPreviewLayer: null,       // Alan ölçüm preview layer ID
  rulerPoints: [],              // Mesafe ölçümü noktaları
  areaPoints: []                // Alan ölçümü noktaları
}
```

### 3.2 Ana Fonksiyonlar

#### 3.2.1 Başlatma Fonksiyonları

**`initMapbox()`**
- Mapbox GL JS haritasını başlatır
- Initial center ve zoom ayarlarını yapar
- Harita event listener'larını kurar
- Three.js başlatma fonksiyonunu çağırır

**`initThreeJs()`**
- Three.js ES Module yüklenmesini bekler
- GLTFLoader'ı dinamik olarak yükler
- Mapbox custom layer'lar için hazırlık yapar
- Background işlem olarak çalışır (non-blocking)

**`loadThreeJsDeps()`**
- THREE ve GLTFLoader'ı yükler
- Cache mekanizması ile tekrar yükleme önler
- Fallback CDN'ler kullanır (unpkg → jsdelivr)

**`initializeGlobalState()`**
- Global state object'ini oluşturur
- Backend URL ve static URL'i set eder
- Mapbox token'ı set eder

#### 3.2.2 Model Yönetimi Fonksiyonları

**`loadModelsList()`**
- Backend API'den model listesini çeker
- Dropdown'ı kategorilere göre doldurur (house, car, tree)
- Hata durumunda non-critical error olarak işler

**`addModelToMap(lng, lat)`**
- Mapbox custom layer olarak 3D model ekler
- Three.js GLTFLoader ile model yükler
- Mercator koordinat dönüşümü yapar
- Model pozisyon, scale, rotation ayarlarını uygular
- Invisible marker ekler (click detection için)
- Model entity'yi state'e kaydeder

**`updateModelPosition(layerId, lng, lat)`**
- Model pozisyonunu günceller
- Mercator koordinatlarını yeniden hesaplar
- Three.js model pozisyonunu günceller
- Marker pozisyonunu günceller

**`updateModelScale(layerId, scale)`**
- Model ölçeğini günceller
- Meters in Mercator hesaplaması yapar
- Three.js model scale'ini günceller

**`updateModelRotation(layerId, rotationDeg)`**
- Model rotasyonunu günceller
- Z ekseni rotasyonunu uygular (X ekseni zaten Math.PI/2)

**`deselectModel()`**
- Model seçimini kaldırır
- Slider'ları disable eder
- State'i temizler

#### 3.2.3 Şekil Çizim Fonksiyonları

**Rectangle (Kare/Dikdörtgen)**
- `handleRectangleClick(point)`: İlk tıklama başlangıç, ikinci tıklama bitiş
- `finishRectangle()`: Rectangle geometry oluşturur, Mapbox layer ekler

**Triangle (Üçgen)**
- `handleTriangleClick(point)`: 3 nokta ile üçgen çizer
- `finishTriangle()`: Triangle geometry oluşturur

**Circle (Yuvarlak)**
- `handleCircleClick(point)`: İlk tıklama merkez, ikinci tıklama yarıçap
- `finishCircle()`: Circle geometry oluşturur

**Ellipse (Elips)**
- `handleEllipseClick(point)`: İlk tıklama merkez, ikinci/üçüncü tıklama eksenler
- `finishEllipse()`: Ellipse geometry oluşturur

**Polygon (Çokgen)**
- `handlePolygonClick(point)`: Her tıklama nokta ekler
- `finishPolygon()`: Double-click ile tamamlanır, polygon geometry oluşturur

**Line (Çizgi)**
- `handleLineClick(point)`: Her tıklama nokta ekler
- `finishLine()`: Double-click ile tamamlanır, LineString geometry oluşturur

**Arrow (Ok)**
- `handleArrowClick(point)`: İlk tıklama başlangıç, ikinci tıklama bitiş + ok başı
- Ok başı üçgen hesaplaması yapar

**Marker (Nokta)**
- `handleMarkerClick(point)`: Tek tıklama ile nokta ekler
- Circle layer olarak eklenir

**TextBox (Metin Kutusu)**
- `handleTextBoxClick(point)`: Prompt ile metin alır
- Rounded rectangle + pin (üçgen) + text label oluşturur
- Pixel'den derece dönüşümü yapar

#### 3.2.4 Şekil Yönetimi Fonksiyonları

**`updateShapeList()`**
- Şekil listesini DOM'a render eder
- Her şekil için list item oluşturur
- Seçili şekli highlight eder

**`selectShape(shapeId)`**
- Şekli seçer
- Şekil özelliklerini gösterir
- Hareket kontrollerini aktif eder

**`updateShapeOutlineColor(shapeId, color)`**
- Şekil çizgi rengini günceller

**`updateShapeFillColor(shapeId, color)`**
- Şekil dolgu rengini günceller

**`updateShapeOutlineWidth(shapeId, width)`**
- Şekil çizgi kalınlığını günceller

**`deleteShape(shapeId)`**
- Şekli siler
- İlgili layer'ları ve source'ları temizler

**`moveShape(shapeId, direction)`**
- Şekli hareket ettirir (yukarı, aşağı, sol, sağ)
- Koordinat dönüşümü yapar

#### 3.2.5 Ölçüm Fonksiyonları

**Mesafe Ölçümü (`measure-distance`)**
- `handleMeasurementDistanceClick(point)`: İki nokta ile mesafe ölçer
- İlk tıklama: Temporary marker
- İkinci tıklama: Çizgi + label + kalıcı marker'lar
- `calculateShapeDistance()`: Haversine formülü ile mesafe hesaplar
- `formatDistance()`: Metre/kilometre formatına çevirir

**Alan Ölçümü (`measure-area`)**
- `handleMeasurementAreaClick(point)`: Çoklu nokta ile alan ölçer
- Her nokta için marker ekler
- Dinamik preview polygon gösterir
- En az 3 nokta ile dinamik alan etiketi gösterir
- `finishAreaMeasurement()`: Double-click veya "Tamamla" butonu ile tamamlanır
- `calculateShapeArea()`: Polygon alan hesaplar (spherical geometry)
- `formatArea()`: m²/hektar formatına çevirir

**`setupAreaFinishButton()`**
- Alan ölçümü tamamla butonunu kurar
- En az 3 nokta varsa butonu gösterir

#### 3.2.6 Parsel Seçim Fonksiyonları

**`handleParcelSelectionClick(lng, lat)`**
- Backend API'ye parsel sorgusu yapar (`/api/tkgm_view/`)
- GeoJSON geometry alır
- Mapbox fill + line layer olarak ekler
- React Native'e `parcel-selected` mesajı gönderir

#### 3.2.7 Yardımcı Fonksiyonlar

**Koordinat Dönüşümü**
- `getMidpoint(p1, p2)`: İki nokta arası orta nokta
- `rgbToHex(rgb)`: RGB/array formatından hex'e dönüşüm

**Event Handler'lar**
- `handleMapClick(e)`: Ana harita tıklama handler'ı
- `handleMapDoubleClick(e)`: Double-click handler (polygon/line/area için)
- `handleMapMouseMove(e)`: Mouse move handler (rectangle/circle/ellipse preview için)

**Submenu Yönetimi**
- `openSubmenu(title, content)`: Sağ üst submenu'yu açar
- `closeSubmenu()`: Submenu'yu kapatır

**Keyboard Handler'lar**
- `setupKeyboardHandlers()`: Klavye kısayollarını kurar
  - `R`: Rectangle
  - `T`: Triangle
  - `C`: Circle
  - `E`: Ellipse
  - `P`: Polygon
  - `L`: Line
  - `A`: Arrow
  - `M`: Marker
  - `X`: TextBox
  - Arrow keys: Seçili şekli hareket ettir

### 3.3 Event Listener'lar

#### DOM Event'leri
- `close-btn`: Modal kapatma
- `model-select-dropdown`: Model seçimi
- `add-model-btn`: Model ekleme modunu aktif etme
- `clear-models-btn`: Tüm modelleri temizleme
- `tab-btn`: Tab geçişi
- `submenu-close`: Submenu kapatma
- `select-parcel-btn`: Parsel seçim modu
- `measurement-menu-btn`: Ölçüm menüsü
- `shape-menu-btn`: Şekil menüsü

#### Mapbox Event'leri
- `map.on('click')`: Harita tıklama
- `map.on('dblclick')`: Double-click
- `map.on('mousemove')`: Mouse hareketi
- `map.on('load')`: Harita yükleme tamamlandı

#### Bridge Event'leri (React Native ↔ WebView)
- `window.sendToReactNative(type, payload)`: React Native'e mesaj gönder
- Mesaj tipleri:
  - `threejs-ready`: Three.js hazır
  - `model-selected`: Model seçildi
  - `model-added`: Model eklendi
  - `models-loaded`: Model listesi yüklendi
  - `models-cleared`: Modeller temizlendi
  - `parcel-selected`: Parsel seçildi
  - `error`: Hata oluştu
  - `debug`: Debug log
  - `close-requested`: Modal kapatma isteği

### 3.4 API Entegrasyonları

#### Backend API Endpoint'leri

**GET `/api/3d-models-list/`**
- **Amaç**: Model listesini çeker
- **Response Format**:
  ```json
  {
    "house": [
      { "name": "Model Adı", "file": "model.gltf" }
    ],
    "car": [...],
    "tree": [...]
  }
  ```
- **Hata Yönetimi**: Non-critical (dropdown'da hata mesajı gösterir, loading ekranını etkilemez)

**POST `/api/tkgm_view/`**
- **Amaç**: Parsel seçimi için koordinat sorgusu
- **Request Body**:
  ```json
  {
    "lat": 39.0,
    "lon": 35.0,
    "map_mode": "2d",
    "is3D": false
  }
  ```
- **Response Format**:
  ```json
  {
    "geometry": { GeoJSON },
    "properties": { ... }
  }
  ```
- **Hata Yönetimi**: Critical (React Native'e error mesajı gönderir)

**Static Files**
- **Path**: `/static/models/{type}/{file}`
- **Types**: `house`, `car`, `tree`
- **Format**: GLTF/GLB

---

## 4. Teknik Detaylar

### 4.1 Three.js Entegrasyonu

#### ES Module Yükleme
- **Importmap** kullanarak ES module import'ları destekler
- **CDN**: unpkg.com (primary), jsdelivr.net (fallback)
- **Version**: 0.161.0
- **Loader**: GLTFLoader (dinamik import)

#### Mapbox Custom Layer
- Three.js modelleri Mapbox custom layer olarak render edilir
- **Rendering Mode**: `3d`
- **Canvas**: Mapbox canvas paylaşılır
- **Camera**: Mapbox transform matrix'i kullanılır
- **Mercator Coordinate**: Mapbox MercatorCoordinate API kullanılır

#### Model Transform
```javascript
// Mercator koordinat dönüşümü
const modelAsMercator = mapboxgl.MercatorCoordinate.fromLngLat([lng, lat], 0);
const metersInMercator = modelAsMercator.meterInMercatorCoordinateUnits();

// Three.js transform
model.position.set(mercator.x, mercator.y, mercator.z);
model.rotation.set(Math.PI / 2, 0, THREE.MathUtils.degToRad(rotationDeg));
model.scale.set(metersInMercator * scale, ...);
```

### 4.2 Mapbox GL JS Kullanımı

#### Layer Yönetimi
- **Source Types**: `geojson`, `custom`
- **Layer Types**: `fill`, `line`, `circle`, `symbol`, `custom`
- **Layer ID Convention**: `{type}-{id}-{suffix}` (örn: `model-layer-1234567890`)

#### Event Handling
- **Click Detection**: Invisible circle layer ile model seçimi
- **Drawing**: Mouse event'leri ile şekil çizimi
- **Preview**: Dinamik layer'lar ile önizleme

### 4.3 Performans Optimizasyonları

#### Lazy Loading
- Three.js ve GLTFLoader dinamik olarak yüklenir
- Model listesi arka planda yüklenir (non-blocking)

#### Caching
- `window._threeJsDepsLoaded`: THREE ve GLTFLoader cache'lenir
- `window._threeJsModuleLoaded`: Module yükleme durumu cache'lenir

#### Layer Management
- Gereksiz layer'lar temizlenir
- Preview layer'lar dinamik olarak oluşturulur/silinir

### 4.4 Hata Yönetimi

#### Error Types
- **`threejs_module_error`**: Three.js yükleme hatası
- **`threejs_module_timeout`**: Three.js yükleme timeout (15s)
- **`model_load_error`**: Model yükleme hatası (non-blocking)
- **`model_add_error`**: Model ekleme hatası
- **`api_error`**: Backend API hatası
- **`parcel_selection_error`**: Parsel seçim hatası

#### Error Handling Strategy
- **Critical Errors**: React Native'e gönderilir, loading ekranı kapatılır
- **Non-Critical Errors**: Console'a log, UI'da bilgilendirme, loading ekranı etkilenmez

### 4.5 Bridge İletişimi

#### Message Format
```javascript
{
  type: "message-type",
  payload: { ... }
}
```

#### Message Types
- **`threejs-ready`**: Three.js hazır, loading ekranı kapatılabilir
- **`model-selected`**: Model seçildi
- **`model-added`**: Model eklendi
- **`models-loaded`**: Model listesi yüklendi
- **`models-cleared`**: Modeller temizlendi
- **`parcel-selected`**: Parsel seçildi
- **`error`**: Hata oluştu
- **`debug`**: Debug log (level: log/warn/error)
- **`close-requested`**: Modal kapatma isteği

---

## 5. Kullanım Senaryoları

### 5.1 Model Ekleme Akışı

1. Kullanıcı model dropdown'ından model seçer
2. Scale ve rotation slider'ları aktif olur
3. "Model Ekle" butonuna tıklar
4. Haritaya tıklama modu aktif olur
5. Kullanıcı haritaya tıklar
6. Model Mapbox custom layer olarak eklenir
7. Model entity state'e kaydedilir
8. React Native'e `model-added` mesajı gönderilir

### 5.2 Şekil Çizim Akışı

1. Kullanıcı "Şekil" menüsüne tıklar
2. Submenu açılır, şekil seçenekleri gösterilir
3. Kullanıcı şekil tipini seçer (rectangle, circle, vb.)
4. Haritaya tıklama modu aktif olur
5. Kullanıcı şekli çizer (tip'e göre farklı adımlar)
6. Şekil Mapbox layer olarak eklenir
7. Şekil listesine eklenir
8. Şekil sekmesinde görüntülenir

### 5.3 Ölçüm Akışı

**Mesafe Ölçümü:**
1. Kullanıcı "Ölçüm" menüsüne tıklar
2. "Mesafe Ölç" butonuna tıklar
3. Haritaya ilk noktaya tıklar (temporary marker)
4. Haritaya ikinci noktaya tıklar
5. Çizgi + label + marker'lar gösterilir
6. Yeni ölçüm yapılabilir (mode aktif kalır)

**Alan Ölçümü:**
1. Kullanıcı "Alan Ölç" butonuna tıklar
2. Haritaya noktalar ekler (her tıklama marker ekler)
3. Dinamik preview polygon gösterilir
4. En az 3 nokta ile dinamik alan etiketi gösterilir
5. Double-click veya "Tamamla" butonu ile tamamlanır
6. Kalıcı polygon + label gösterilir

### 5.4 Parsel Seçim Akışı

1. Kullanıcı "Parsel" butonuna tıklar
2. Haritaya tıklama modu aktif olur
3. Kullanıcı haritaya tıklar
4. Backend API'ye parsel sorgusu yapılır
5. GeoJSON geometry alınır
6. Mapbox fill + line layer olarak gösterilir
7. React Native'e `parcel-selected` mesajı gönderilir

---

## 6. Geliştirme Notları

### 6.1 Dosya Boyutu

- **Mevcut**: ~5644 satır
- **Limit**: 2000 satır (mimari kural)
- **Öneri**: Dosya bölünmeli
  - `threeJsModelViewer-core.ts`: Ana HTML generator
  - `threeJsModelViewer-styles.ts`: CSS stilleri
  - `threeJsModelViewer-functions.ts`: JavaScript fonksiyonları
  - `threeJsModelViewer-types.ts`: TypeScript tipleri

### 6.2 İyileştirme Önerileri

1. **Modüler Yapı**: Fonksiyonları ayrı modüllere böl
2. **Type Safety**: Daha fazla TypeScript tip tanımı
3. **Error Handling**: Daha detaylı hata mesajları
4. **Performance**: Model yükleme optimizasyonu
5. **Accessibility**: ARIA label'ları ekle
6. **Testing**: Unit test'ler ekle

### 6.3 Bilinen Sorunlar

1. **Three.js Yükleme**: ES Module yükleme bazen timeout olabilir
2. **Model Texture**: Bazı modellerde texture path sorunları olabilir
3. **Mobile Performance**: Çok fazla model/shape performansı düşürebilir
4. **Submenu Scroll**: Uzun içeriklerde scroll sorunları olabilir

---

## 7. Bağımlılık Haritası

```
threeJsModelViewer.ts
├── Three.js (ES Module)
│   ├── Core (THREE)
│   └── GLTFLoader (addon)
├── Mapbox GL JS
│   ├── Map instance
│   ├── Custom Layer API
│   └── GeoJSON Source/Layer API
├── Backend API
│   ├── /api/3d-models-list/
│   └── /api/tkgm_view/
└── React Native WebView
    └── Bridge (postMessage)
```

---

## 8. Versiyon Geçmişi

- **v1.0**: İlk versiyon, Three.js + Mapbox entegrasyonu
- **v1.1**: Mapbox custom layer desteği eklendi
- **v1.2**: Şekil çizim araçları eklendi
- **v1.3**: Ölçüm araçları eklendi
- **v1.4**: Parsel seçim özelliği eklendi

---

## 9. Referanslar

- **Three.js Docs**: https://threejs.org/docs/
- **Mapbox GL JS Docs**: https://docs.mapbox.com/mapbox-gl-js/
- **GLTF Format**: https://www.khronos.org/gltf/
- **React Native WebView**: https://github.com/react-native-webview/react-native-webview

---

**Son Güncelleme**: 2024
**Döküman Versiyonu**: 1.0
**Hazırlayan**: AI Assistant (Cursor)
