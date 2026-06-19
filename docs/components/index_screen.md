# Ana Ekran (index.tsx) Dokümantasyonu

## Özellik/Görev

`app/index.tsx`, ProParcel mobil uygulamasının ana ekran component'idir. Bu dosya, uygulamanın tüm ana işlevselliğini yönetir:
- Harita görüntüleme (Mapbox)
- Parsel sorgulama (Pro Mod ve Basit Mod)
- Ölçüm araçları (mesafe, alan, kenar ölçüleri)
- 3D harita görünümü
- Paylaşım özellikleri
- Street View entegrasyonu
- Konum yönetimi

## Genel Bakış

Ana ekran, React Native ve Expo Router kullanılarak oluşturulmuş bir functional component'tir. Mapbox GL Native ile harita görüntüleme yapılır ve kullanıcı etkileşimleri için çeşitli handler fonksiyonları içerir.

### İki Mod Desteği

Uygulama iki farklı modda çalışır:

1. **Basit Mod (Simple Mode):**
   - Çoklu parsel yönetimi (maksimum 30 parsel)
   - Sadece TKGM verileri (fiyat bilgisi yok)
   - FIFO (First In First Out) parsel yönetimi

2. **Pro Mod:**
   - Tek parsel yönetimi
   - Tam analiz verileri (fiyatlandırma, değerleme)
   - Property type seçimi gerekli
   - Pro analiz endpoint'i kullanılır

## Girdiler

### Props
Bu component bir props almaz (default export).

### Environment Variables
- `EXPO_PUBLIC_API_URL` - Backend API URL'i (varsayılan: `http://192.168.1.101:8000`)
- `EXPO_PUBLIC_MAPBOX_TOKEN` - Mapbox access token (config/mapbox.ts'den alınır)

### Import Edilen Modüller

**Component'ler:**
- `ParcelModal` - Parsel detay modal'ı
- `ParcelSearchModal` - Parsel arama modal'ı
- `ProModeThreeLoader` - Pro mod yükleme animasyonu
- `PropertyTypeSelectionModal` - Taşınmaz türü seçim modal'ı
- `ShareModal` - Paylaşım modal'ı
- `StreetViewModal` - Street View modal'ı
- `ParcelModalContent` - Parsel modal içeriği
- `CombinedScreenshotContainer` - Birleşik ekran görüntüsü container'ı

**Utilities:**
- `threeDMode` - 3D mod yardımcı fonksiyonları
- `propertyTypeUtils` - Taşınmaz türü yardımcı fonksiyonları
- `shareHandler` - Paylaşım handler fonksiyonları
- `useScreenshotListener` - Screenshot listener hook
- `streetViewHelper` - Street View yardımcı fonksiyonları
- `measurementManager` - Ölçüm yönetimi
- `edgeMeasurementsManager` - Kenar ölçüm yönetimi

**Types:**
- `ProParcelResponse`, `TkgmViewResponse`, `ParcelResponse`, `GeoJSONGeometry` - Parsel veri tipleri

## State Yönetimi

### UI State
- `menuVisible` - Ana menü görünürlüğü
- `activeScreen` - Aktif ekran (ada-parsel formu vb.)
- `parcelModalVisible` - Parsel modal görünürlüğü
- `shareModalVisible` - Paylaşım modal görünürlüğü
- `streetViewModalVisible` - Street View modal görünürlüğü
- `propertyTypeModalVisible` - Property type modal görünürlüğü

### Mod State
- `isProMode` - Pro mod aktif/pasif
- `is3DMode` - 3D mod aktif/pasif
- `infoModeActive` - Info mod aktif/pasif (sadece Pro mod)

### Parsel State
- `parcelData` - Pro mod için parsel verisi
- `simpleModeParcels` - Basit mod için parsel listesi (maksimum 30)
- `selectedParcelForModal` - Basit modda seçili parsel
- `isLoadingParcel` - Parsel yükleme durumu
- `pendingTkgmData` - Property type seçimi için bekleyen TKGM verisi
- `pendingCoordinates` - Property type seçimi için bekleyen koordinatlar

### Measurement State
- `measurementMode` - Ölçüm modu (null, 'ruler', 'area')
- `rulerPoints` - Cetvel ölçümü için noktalar
- `areaPoints` - Alan ölçümü için noktalar
- `measurementFeatures` - Ölçüm feature'ları
- `dynamicLineFeature` - Dinamik çizgi feature'ı
- `edgeMeasurementFeatures` - Kenar ölçüm feature'ları
- `showEdgeMeasurements` - Kenar ölçüleri görünürlüğü
- `simpleModeEdgeMeasureData` - Basit mod için kenar ölçü verisi

### Location State
- `userLocation` - Kullanıcı konumu
- `showUserLocation` - Kullanıcı konumu görünürlüğü
- `locationMenuVisible` - Konum menüsü görünürlüğü
- `rulerMenuVisible` - Ölçüm menüsü görünürlüğü

### Map State
- `mapViewKey` - Harita view key (yeniden render için)
- `mapDefaultSettings` - Harita varsayılan ayarları
- `show3DSlider` - 3D slider görünürlüğü
- `pitchValue` - 3D pitch değeri
- `isBackendOnline` - Backend durumu

### Share State
- `isProcessingShare` - Paylaşım işlemi durumu
- `capturedMapUri` - Yakalanan harita görüntüsü URI'si
- `capturedModalUri` - Yakalanan modal görüntüsü URI'si

### Refs
- `mapRef` - Mapbox MapView referansı
- `cameraRef` - Mapbox Camera referansı
- `combinedContainerRef` - CombinedScreenshotContainer referansı
- `modalContentRef` - Modal içerik referansı
- `camRef` - Kamera durumu referansı
- `mapReadyRef` - Harita hazır durumu referansı
- `isSharingRef` - Paylaşım durumu referansı
- `isProgrammaticMoveRef` - Programatik hareket durumu referansı
- `programmaticTimerRef` - Programatik hareket timer referansı
- `intervalRef` - Heading interval referansı
- `zoomIntervalRef` - Zoom interval referansı
- `menuItemClickedRef` - Menu item tıklama referansı

## İç Akış

### 1. Component İlk Yükleme

```typescript
useEffect(() => {
  // Backend durum kontrolü (her 30 saniyede bir)
  const check = async () => {
    try { 
      const r = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.101:8000'}/`); 
      setIsBackendOnline(r.ok || r.status < 500); 
    } catch { 
      setIsBackendOnline(false); 
    }
  };
  check(); 
  const i = setInterval(check, 30000); 
  return () => { 
    clearInterval(i); 
    stopHeadingChange(); 
    stopZoomChange(); 
  };
}, []);
```

### 2. Parsel Sorgulama Akışı

#### Basit Mod:
1. Kullanıcı Ada/Parsel formu doldurur veya haritaya tıklar
2. `handleAdaParselSubmit` veya `handleMapPress` çağrılır
3. TKGM endpoint'ine sorgu gönderilir (`/api/tkgm_view/`)
4. Gelen veri `addParcelToSimpleMode` ile array'e eklenir (maksimum 30)
5. Harita kamera ayarları güncellenir
6. Parsel haritada çizilir

#### Pro Mod:
1. Kullanıcı Ada/Parsel formu doldurur veya haritaya tıklar
2. `handleAdaParselSubmit` veya `handleMapPress` çağrılır
3. TKGM endpoint'ine sorgu gönderilir (`/api/tkgm_view/`)
4. Property type modal açılır
5. Kullanıcı property type seçer
6. `handlePropertyTypeSelect` çağrılır
7. Pro analiz endpoint'ine sorgu gönderilir (`/api/get_parcel_info/`)
8. Gelen veri `parcelData` state'ine set edilir
9. Harita kamera ayarları güncellenir
10. Parsel haritada çizilir

### 3. Ölçüm Akışı

#### Mesafe Ölçümü (Ruler):
1. Kullanıcı ölçüm menüsünden "Mesafe Ölçüm" seçer
2. `measurementMode` 'ruler' olarak set edilir
3. Kullanıcı haritaya ilk tıklar → ilk nokta set edilir
4. Kullanıcı haritaya ikinci kez tıklar → mesafe hesaplanır ve çizilir
5. Ölçüm tamamlanır

#### Alan Ölçümü (Area):
1. Kullanıcı ölçüm menüsünden "Alan Ölçüm" seçer
2. `measurementMode` 'area' olarak set edilir
3. Kullanıcı haritaya tıklar → nokta eklenir
4. 3+ nokta olduğunda "Tamamla" butonu görünür
5. Kullanıcı "Tamamla" butonuna basar veya long press yapar
6. Alan hesaplanır ve polygon çizilir

#### Kenar Ölçümü (Edge Measurements):
1. Kullanıcı ölçüm menüsünden "Kenar Ölçüleri" seçer
2. **Pro Mod:** `parcelData.analysisData`'dan edge measure data alınır
3. **Basit Mod:** `fetchEdgeMeasuresForSimpleMode` ile API'den edge measure data alınır
4. `createEdgeMeasurementFeatures` ile feature'lar oluşturulur
5. Kenar ölçüleri haritada çizilir

### 4. Paylaşım Akışı

1. Kullanıcı kamera butonuna basar
2. `handleCameraPress` çağrılır
3. `createShareHandler` ile paylaşım handler oluşturulur
4. `screenshotManager` ile harita ve modal görüntüleri yakalanır
5. Görüntüler birleştirilir (`CombinedScreenshotContainer`)
6. Paylaşım modal'ı açılır
7. Kullanıcı paylaşım seçeneğini seçer

### 5. 3D Mod Akışı

1. Kullanıcı 3D butonuna basar
2. `toggle3DMode` çağrılır
3. `apply3DMode` utility fonksiyonu çağrılır
4. Harita view key değiştirilir (yeniden render)
5. Terrain ve Sky layer'lar eklenir
6. 3D kontrolleri görünür hale gelir
7. Pitch, zoom, heading kontrolleri aktif olur

## Çıktılar

### Render Edilen Component'ler

1. **SafeAreaView** - Ana container
2. **Header** - Üst başlık bar'ı
   - Arama butonu
   - ProParcel başlığı (Pro/Basit mod göstergesi)
   - Backend durum göstergesi
   - Menü butonu
3. **Mapbox.MapView** - Harita görünümü
   - Camera kontrolü
   - Parsel shape source'ları
   - Ölçüm feature'ları
   - Kenar ölçüm feature'ları
   - Kullanıcı konumu
4. **ProModeThreeLoader** - Pro mod yükleme animasyonu
5. **ParcelSearchModal** - Parsel arama modal'ı
6. **ParcelModal** - Parsel detay modal'ı
7. **PropertyTypeSelectionModal** - Property type seçim modal'ı
8. **ShareModal** - Paylaşım modal'ı
9. **StreetViewModal** - Street View modal'ı
10. **Bottom Pill Bar** - Alt buton bar'ı
    - Ölçüm menüsü
    - Konum menüsü
    - Info butonu (sadece Pro mod)
    - Yenile butonu
    - Kamera/paylaşım butonu
    - 3D mod butonu
11. **CombinedScreenshotContainer** - Gizli screenshot container (offscreen)

### State Değişiklikleri

Component, kullanıcı etkileşimlerine göre state'leri günceller ve UI'ı yeniden render eder.

## Handler Fonksiyonları

### UI Handlers
- `handleSearchToggle` - Arama formu aç/kapat
- `handleMenuItemPress` - Menü item tıklama
- `handleCloseForm` - Form kapatma
- `toggleMode` - Pro/Basit mod değiştirme
- `toggle3DMode` - 3D mod aç/kapat
- `handleRefresh` - Tüm verileri temizle

### Parsel Handlers
- `handleAdaParselSubmit` - Ada/Parsel formu gönderimi
- `handleMapPress` - Harita tıklama (parsel sorgulama)
- `handlePropertyTypeSelect` - Property type seçimi (Pro mod)
- `handleParcelLocation` - Parsel konumuna git
- `fetchEdgeMeasuresForSimpleMode` - Basit mod için kenar ölçüleri getir

### Measurement Handlers
- `handleMeasurementPress` - Ölçüm tıklama
- `finishAreaMeasurement` - Alan ölçümünü tamamla

### Location Handlers
- `handleLocationButtonPress` - Konum menüsü aç/kapat
- `handleShowMyLocation` - Kullanıcı konumunu göster
- `handleGetDirections` - Yol tarifi al (Google Maps)
- `handleStreetViewPress` - Street View aç

### Camera Handlers
- `onCameraChanged` - Kamera değişikliği
- `handlePitchChange` - Pitch değeri değiştir
- `handleZoomChange` - Zoom değeri değiştir
- `handleHeadingChange` - Heading değeri değiştir
- `startZoomChange` / `stopZoomChange` - Zoom interval
- `startHeadingChange` / `stopHeadingChange` - Heading interval

### Share Handlers
- `handleShare` - Paylaşım handler (createShareHandler ile oluşturulur)
- `handleCameraPress` - Kamera/paylaşım butonu

### Helper Fonksiyonlar
- `normalizeGeometryCoordinates` - Geometri koordinatlarını normalize et
- `calculateBoundsAndCamera` - Parsel bounds ve kamera ayarlarını hesapla
- `getParcelCentroid` - Parsel merkez noktasını hesapla
- `pickValue` - Object'ten değer seç
- `formatArea` - Alan değerini formatla
- `getParcelLabelText` - Parsel etiket metnini oluştur
- `isPointInParcel` - Nokta parsel içinde mi kontrol et
- `getButtonActiveStyle` - Buton aktif stilini döndür
- `addParcelToSimpleMode` - Basit moda parsel ekle
- `generateParcelId` - Parsel ID oluştur

## useEffect Hook'ları

### Backend Durum Kontrolü
```typescript
useEffect(() => {
  // Backend durumunu kontrol et (ilk yüklemede ve her 30 saniyede bir)
  // Cleanup: interval'ları temizle
}, []);
```

### Edge Measurements
```typescript
useEffect(() => {
  // showEdgeMeasurements değiştiğinde edge measurement feature'larını oluştur
  // Pro mod: parcelData.analysisData'dan al
  // Basit mod: simpleModeEdgeMeasureData'dan al
}, [showEdgeMeasurements, parcelData, isProMode, selectedParcelForModal, simpleModeEdgeMeasureData, simpleModeParcels]);
```

## Kullanım

Bu component, Expo Router'ın file-based routing yapısına göre `app/index.tsx` konumunda bulunur ve uygulamanın ana ekranı olarak otomatik olarak render edilir.

### Mod Değiştirme

Kullanıcı header'daki "ProParcel" başlığına tıklayarak Pro Mod ve Basit Mod arasında geçiş yapabilir.

### Parsel Sorgulama

1. **Ada/Parsel Formu ile:**
   - Header'daki arama butonuna tıklayın
   - İl, İlçe, Mahalle seçin
   - Ada ve Parsel numaralarını girin
   - "Sorgula" butonuna basın

2. **Harita Tıklama ile:**
   - Haritada bir yere tıklayın
   - O konumdaki parsel otomatik olarak sorgulanır

### Ölçüm Yapma

1. Alt bar'daki ölçüm butonuna tıklayın
2. Menüden "Mesafe Ölçüm", "Alan Ölçüm" veya "Kenar Ölçüleri" seçin
3. Haritada ölçüm yapın

### Paylaşım

1. Alt bar'daki kamera butonuna tıklayın
2. Ekran görüntüsü hazırlanır
3. Paylaşım modal'ı açılır
4. Paylaşım seçeneğini seçin

## Diğer Modüller

### Bağımlılıklar

**Component'ler:**
- `ParcelModal` - Parsel detay gösterimi
- `ParcelSearchModal` - Parsel arama formu
- `PropertyTypeSelectionModal` - Property type seçimi
- `ShareModal` - Paylaşım seçenekleri
- `StreetViewModal` - Street View görüntüleme
- `ProModeThreeLoader` - Pro mod yükleme animasyonu
- `CombinedScreenshotContainer` - Screenshot container

**Utilities:**
- `threeDMode` - 3D mod yönetimi
- `propertyTypeUtils` - Property type işlemleri
- `shareHandler` - Paylaşım işlemleri
- `measurementManager` - Ölçüm işlemleri
- `edgeMeasurementsManager` - Kenar ölçüm işlemleri
- `screenshotManager` - Screenshot işlemleri
- `streetViewHelper` - Street View işlemleri
- `useScreenshotListener` - Screenshot listener

**API Endpoints:**
- `/api/tkgm_view/` - TKGM parsel sorgusu (Basit mod)
- `/api/get_parcel_info/` - Pro analiz sorgusu (Pro mod)
- `/api/calculate_edge_measures/` - Kenar ölçüleri hesaplama (Basit mod)

**External Services:**
- Mapbox GL Native - Harita görüntüleme
- Google Maps - Yol tarifi
- Google Street View - Sokak görüntüsü

## Notlar

- Component 1337 satır kod içerir (architecture.md'deki 2000 satır limitinin altında)
- Stil dosyaları `app/styles/indexStyles.ts` içinde tanımlıdır (architecture.md kuralına uygun)
- Handler fonksiyonları `app/utils/handlers/` klasöründe bulunur
- Backend durumu her 30 saniyede bir kontrol edilir
- Basit modda maksimum 30 parsel saklanır (FIFO)
- Pro modda sadece tek parsel yönetilir
- 3D mod aktifken Terrain ve Sky layer'lar eklenir
- Screenshot işlemleri gizli bir container'da gerçekleştirilir (offscreen)

## İlgili Dokümanlar

- `docs/architecture.md` - Genel mimari kurallar
- `docs/development-rules.md` - Geliştirme kuralları
- `components/ParcelModal.md` - Parsel modal dokümantasyonu
- `utils/measurementManager.md` - Ölçüm yönetimi dokümantasyonu
- `utils/shareHandler.md` - Paylaşım handler dokümantasyonu
