# Paylaşım Handler (shareHandler) Dokümantasyonu

## Özellik/Görev

`shareHandler.ts`, parsel bilgilerini ekran görüntüsü olarak paylaşmak için kullanılan handler fonksiyonunu içerir. Bu handler, harita ve modal görüntülerini yakalar, birleştirir ve kullanıcıya paylaşım seçenekleri sunar.

Handler, `createShareHandler` factory fonksiyonu ile oluşturulur ve paylaşım işlemini adım adım yönetir.

## Girdiler

### ShareHandlerParams Interface

```typescript
export interface ShareHandlerParams {
  parcelData: any;                          // Parsel verisi (geometry, properties, analysisData)
  mapRef: React.RefObject<any>;             // Mapbox MapView referansı
  combinedContainerRef: React.RefObject<any>; // ViewShot referansı (CombinedScreenshotContainer)
  mapReadyRef: React.MutableRefObject<MapReadyState>; // Harita hazır durumu referansı
  isSharingRef: React.MutableRefObject<boolean>; // Paylaşım durumu referansı
  setIsProcessingShare: (processing: boolean) => void; // Paylaşım işlemi state setter
  setCapturedMapUri: (uri: string | null) => void; // Yakalanan harita görüntüsü state setter
  setCapturedModalUri: (uri: string | null) => void; // Yakalanan modal görüntüsü state setter
  setShareModalVisible: (visible: boolean) => void; // Paylaşım modal görünürlüğü state setter
}
```

### MapReadyState Interface

```typescript
interface MapReadyState {
  didFinishLoadingMap: boolean;
  didFinishLoadingStyle: boolean;
  isIdle: boolean;
}
```

## İç Akış

### 1. Handler Oluşturma (createShareHandler)

```typescript
export const createShareHandler = (params: ShareHandlerParams) => {
  return async () => {
    // Paylaşım işlemi fonksiyonu
  };
};
```

Factory fonksiyonu, parametreleri closure içinde tutarak paylaşım handler fonksiyonu oluşturur.

### 2. Validasyon

```typescript
if (!parcelData) {
  Alert.alert('Hata', 'Parsel bilgisi bulunamadı.');
  return;
}
```

Parsel verisi yoksa hata gösterilir ve işlem durdurulur.

### 3. Paylaşım İşlemi Başlatma

```typescript
setIsProcessingShare(true);
isSharingRef.current = true; // Share sırasında kamera değişikliklerini durdur
```

Paylaşım işlemi başlatılır ve kamera değişiklikleri durdurulur (kullanıcı haritayı hareket ettirmesin).

### 4. Görüntü Boyutları Hesaplama

```typescript
const dimensions = getCombinedImageDimensions();
```

Birleşik görüntü boyutları hesaplanır (A4 oranı).

### 5. Harita Görüntüsü Yakalama

#### 5.1. MapView Ref Kontrolü

```typescript
if (!mapRef.current) {
  // MapView ref'inin hazır olmasını bekle (maksimum 2 saniye)
  let mapRetries = 0;
  while (!mapRef.current && mapRetries < 20) {
    await new Promise(r => setTimeout(r, 100));
    mapRetries++;
  }
  if (!mapRef.current) {
    throw new Error('MapView ref bulunamadı');
  }
}
```

MapView referansının hazır olmasını bekler (maksimum 2 saniye).

#### 5.2. Render Bekleme

```typescript
await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
await new Promise(resolve => setTimeout(resolve, 150)); // Kısa "settle" payı
```

MapView'ın tamamen render olmasını bekler.

#### 5.3. Map Idle Bekleme

```typescript
await waitForMapIdle(mapReadyRef, 5000);
```

Map idle durumunu bekler (style/annotation apply bitene kadar). Bu, haritanın tamamen hazır olmasını garanti eder.

#### 5.4. Mapbox Snapshot

```typescript
mapUri = await tryMapboxSnap(mapRef, dimensions);
```

Mapbox snapshot'ı alır (başarısızsa empty string döner).

### 6. Combined Container Güncelleme

```typescript
setCapturedMapUri(mapUri ?? '');
```

Yakalanan harita görüntüsü state'e set edilir (CombinedScreenshotContainer'a aktarılır).

### 7. React State Commit Bekleme

```typescript
await new Promise(res => requestAnimationFrame(() => res(null)));
await new Promise(res => requestAnimationFrame(() => res(null)));
await new Promise(res => res(null))); // Ekstra frame
await new Promise(r => setTimeout(r, 150)); // Image render + layout settle
```

React state commit garantisi için multiple frame beklenir. Image render ve layout settle için yeterli bekleme yapılır.

### 8. ViewShot Ref Kontrolü

```typescript
let retries = 0;
while (!combinedContainerRef.current?.capture && retries < 30) {
  await new Promise(r => setTimeout(r, 100));
  retries++;
}
```

ViewShot referansının hazır olmasını bekler (maksimum 3 saniye).

### 9. Combined ViewShot Yakalama

```typescript
combinedUri = await combinedContainerRef.current.capture();
```

CombinedScreenshotContainer'ın ViewShot'unu kullanarak birleşik görüntü yakalanır (harita + modal).

### 10. Query URL Oluşturma

```typescript
const queryLink = generateShareLink(parcelData);
const shareText = queryLink 
  ? `ProParcel'de bu parseli görüntüle:\n${queryLink}`
  : null;
```

Paylaşım için query URL oluşturulur.

### 11. Paylaşım

```typescript
const shareResult = shareText 
  ? await shareImageWithText(combinedUri, shareText)
  : await shareImage(combinedUri);
```

Görüntü ve metin (link) ile paylaşılır.

### 12. Temizlik

```typescript
finally {
  setCapturedMapUri(null);
  setCapturedModalUri(null);
  await cleanupTempFiles([mapUri, combinedUri]);
  isSharingRef.current = false;
  setIsProcessingShare(false);
}
```

State'ler temizlenir, geçici dosyalar silinir ve paylaşım durumu sıfırlanır.

## Çıktılar

### Paylaşım Sonucu

Handler, görüntüyü paylaşır ve kullanıcıya paylaşım seçenekleri sunar. Paylaşım başarılı/başarısız durumu loglanır.

### State Değişiklikleri

- `isProcessingShare`: Paylaşım işlemi sırasında true, sonrasında false
- `capturedMapUri`: Yakalanan harita görüntüsü URI'si (paylaşım sırasında set edilir, sonrasında null)
- `capturedModalUri`: Yakalanan modal görüntüsü URI'si (kullanılmıyor, null kalır)
- `shareModalVisible`: Paylaşım modal görünürlüğü (paylaşım sonrası false)

### Geçici Dosyalar

Yakalanan görüntüler geçici dosyalar olarak oluşturulur ve paylaşım sonrası temizlenir.

## Kullanım

### Handler Oluşturma

```typescript
import { createShareHandler } from './utils/handlers/shareHandler';

const handleShare = useCallback(
  createShareHandler({
    parcelData: activeParcelData,
    mapRef,
    combinedContainerRef,
    mapReadyRef,
    isSharingRef,
    setIsProcessingShare,
    setCapturedMapUri,
    setCapturedModalUri,
    setShareModalVisible,
  }),
  [activeParcelData]
);
```

### Handler Çağırma

```typescript
const handleCameraPress = useCallback(async () => {
  if (!parcelData) {
    Alert.alert('Uyarı', 'Önce bir parsel seçmeniz gerekiyor.');
    return;
  }
  setIsProcessingShare(true);
  try {
    await handleShare();
  } catch (error) {
    // Hata zaten handler içinde handle ediliyor
  }
}, [parcelData, handleShare]);
```

## İç Akış Detayları

### Harita Yakalama Süreci

1. **MapView Ref Kontrolü:** MapView referansının hazır olması beklenir
2. **Render Bekleme:** MapView'ın tamamen render olması beklenir
3. **Map Idle Bekleme:** Haritanın idle durumuna gelmesi beklenir (style/annotation apply bitene kadar)
4. **Snapshot:** Mapbox snapshot API'si kullanılarak görüntü yakalanır

### Combined Container Yakalama Süreci

1. **State Güncelleme:** Yakalanan harita görüntüsü state'e set edilir
2. **React State Commit:** Multiple frame beklenir (React state commit garantisi)
3. **Image Render:** Image render ve layout settle için yeterli bekleme
4. **ViewShot Ref Kontrolü:** ViewShot referansının hazır olması beklenir
5. **Capture:** CombinedScreenshotContainer'ın ViewShot'unu kullanarak birleşik görüntü yakalanır

### Paylaşım Süreci

1. **Query URL Oluşturma:** Parsel verilerinden share link oluşturulur
2. **Görüntü + Metin Paylaşımı:** `shareImageWithText` ile görüntü ve metin birlikte paylaşılır
3. **Platform Farkları:** iOS ve Android için farklı stratejiler kullanılır

## Hata Yönetimi

### Hata Durumları

1. **Parsel Verisi Yok:**
   - Alert gösterilir
   - İşlem durdurulur

2. **MapView Ref Hazır Değil:**
   - Maksimum 2 saniye beklenir
   - Hazır olmazsa hata fırlatılır

3. **Map Idle Timeout:**
   - Maksimum 5 saniye beklenir
   - Timeout olursa devam edilir (placeholder ile)

4. **Mapbox Snapshot Başarısız:**
   - Warning loglanır
   - Placeholder ile devam edilir (empty string)

5. **ViewShot Ref Hazır Değil:**
   - Maksimum 3 saniye beklenir
   - Hazır olmazsa hata fırlatılır

6. **Combined Container Yakalama Hatası:**
   - Hata loglanır
   - Alert gösterilir
   - İşlem durdurulur

7. **Paylaşım Hatası:**
   - Hata loglanır
   - Alert gösterilir
   - Temizlik yapılır

### Temizlik (Finally Block)

Her durumda (başarılı/başarısız):
- State'ler temizlenir
- Geçici dosyalar silinir
- Paylaşım durumu sıfırlanır

## Zaman Aşımı Değerleri

- **MapView Ref Bekleme:** 2 saniye (20 retry × 100ms)
- **Map Idle Bekleme:** 5 saniye
- **ViewShot Ref Bekleme:** 3 saniye (30 retry × 100ms)
- **React State Commit:** 3 frame + 150ms
- **Image Render:** 150ms
- **Settle Payı:** 150ms

## Diğer Modüller

### Bağımlılıklar

**React Native:**
- `Alert` - Hata mesajları
- `Share` - Native paylaşım API'si
- `Platform` - Platform kontrolü

**Local:**
- `screenshotManager` - Görüntü paylaşımı ve temizlik fonksiyonları
  - `shareImage` - Basit görüntü paylaşımı
  - `shareImageWithText` - Görüntü ve metin paylaşımı
  - `cleanupTempFiles` - Geçici dosya temizleme
  - `getCombinedImageDimensions` - Görüntü boyutları hesaplama
- `mapboxSnapshot` - Mapbox snapshot fonksiyonları
  - `waitForMapIdle` - Map idle durumu bekleme
  - `tryMapboxSnap` - Mapbox snapshot alma
  - `MapReadyState` - Map hazır durumu interface'i
- `queryUrlGenerator` - Query URL oluşturma
  - `generateShareLink` - Paylaşım linki oluşturma

**Component'ler:**
- `CombinedScreenshotContainer` - Birleşik screenshot container'ı (ViewShot ile)

### Kullanıldığı Yerler

- `app/index.tsx` - Ana ekranda paylaşım özelliği
- `handleShare` handler'ı oluşturulur ve `handleCameraPress` içinde çağrılır
- Paylaşım butonu (kamera ikonu) tıklandığında tetiklenir

## Notlar

- Handler, async bir fonksiyon döndürür
- Paylaşım sırasında kamera değişiklikleri durdurulur (`isSharingRef.current = true`)
- Mapbox snapshot başarısız olursa placeholder ile devam edilir
- Combined container yakalama için yeterli bekleme yapılır (React state commit garantisi)
- Geçici dosyalar paylaşım sonrası otomatik olarak temizlenir
- Platform'a göre farklı paylaşım stratejileri kullanılır (iOS/Android)
- Android'de görüntü ve metin ayrı dialog'larda paylaşılır
- iOS'te görüntü ve metin birlikte paylaşılabilir
- Query URL oluşturulamazsa sadece görüntü paylaşılır
- Tüm hata durumları handle edilir ve kullanıcıya bildirilir

## İlgili Dokümanlar

- `docs/index.md` - Ana ekran dokümantasyonu (shareHandler kullanımı)
- `utils/screenshotManager.md` - Screenshot yönetimi dokümantasyonu
- `utils/mapboxSnapshot.md` - Mapbox snapshot dokümantasyonu
- `utils/queryUrlGenerator.md` - Query URL oluşturma dokümantasyonu
- `components/CombinedScreenshotContainer.md` - Screenshot container dokümantasyonu
