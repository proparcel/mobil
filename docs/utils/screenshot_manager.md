# Ekran Görüntüsü Yöneticisi (screenshotManager) Dokümantasyonu

## Özellik/Görev

`screenshotManager.ts`, ekran görüntüsü yakalama, paylaşım ve geçici dosya yönetimi için kullanılan utility fonksiyonlarını içerir. Bu modül, görüntüleri paylaşmak ve geçici dosyaları temizlemek için kullanılır.

## Girdiler

### Fonksiyon Parametreleri

#### shareImage
```typescript
imageUri: string  // Paylaşılacak görüntü URI'si (file:// veya content://)
```

#### shareImageWithText
```typescript
imageUri: string  // Paylaşılacak görüntü URI'si
text: string      // Paylaşılacak metin (link vb.)
```

#### cleanupTempFiles
```typescript
uris: (string | null)[]  // Temizlenecek dosya URI'leri dizisi
```

#### getCombinedImageDimensions
```typescript
// Parametre almaz, ekran boyutlarından hesaplar
```

## İç Akış

### 1. Görüntü Paylaşımı (shareImage)

```typescript
export const shareImage = async (imageUri: string): Promise<boolean> => {
  // 1. Sharing servisinin kullanılabilir olup olmadığını kontrol et
  // 2. Görüntüyü paylaş
  // 3. Başarı/hata durumunu döndür
};
```

**Adımlar:**
1. `Sharing.isAvailableAsync()` ile paylaşım servisinin kullanılabilir olup olmadığını kontrol eder
2. Kullanılabilir değilse false döndürür
3. `Sharing.shareAsync()` ile görüntüyü paylaşır
4. Başarılıysa true, hata olursa false döndürür

### 2. Görüntü ve Metin Paylaşımı (shareImageWithText)

```typescript
export const shareImageWithText = async (
  imageUri: string, 
  text: string
): Promise<{ success: boolean; linkText: string }> => {
  // Platform'a göre farklı strateji:
  // iOS: Share.share() ile image + message
  // Android: Sharing.shareAsync() ile image, sonra Share.share() ile text (800ms gecikme)
};
```

**iOS Akışı:**
1. `Share.share()` ile görüntü ve mesaj birlikte paylaşılır
2. Hata olursa `Sharing.shareAsync()` ile görüntü paylaşılır
3. 800ms sonra `Share.share()` ile metin paylaşılır (ayrı dialog)

**Android Akışı:**
1. `Sharing.isAvailableAsync()` ile paylaşım servisinin kullanılabilir olup olmadığını kontrol eder
2. Kullanılabilir değilse sadece metin paylaşılır
3. Kullanılabilirse `Sharing.shareAsync()` ile görüntü paylaşılır
4. 800ms sonra `Share.share()` ile metin paylaşılır (ayrı dialog)

**Not:** Android'de görüntü ve metin aynı anda paylaşılamadığı için iki ayrı dialog açılır (800ms gecikme ile).

### 3. Geçici Dosya Temizleme (cleanupTempFiles)

```typescript
export const cleanupTempFiles = async (
  uris: (string | null)[]
): Promise<void> => {
  // 1. Her URI için:
  //    - file:// ile başlıyor mu kontrol et
  //    - Dosya var mı kontrol et (getInfoAsync)
  //    - Varsa sil (deleteAsync)
  // 2. Hataları logla ama devam et
};
```

**Adımlar:**
1. URI dizisindeki her URI için:
   - `file://` ile başlıyorsa (local file)
   - `FileSystem.getInfoAsync()` ile dosya var mı kontrol eder
   - Varsa `FileSystem.deleteAsync()` ile siler
   - Hataları loglar ama devam eder (idempotent: true)

**Not:** `idempotent: true` parametresi, dosya yoksa hata vermez (güvenli silme).

### 4. Birleşik Görüntü Boyutları Hesaplama (getCombinedImageDimensions)

```typescript
export function getCombinedImageDimensions() {
  // 1. Ekran genişliğini al
  // 2. Base width: ekran genişliğinin %95'i veya 800px (küçük olan)
  // 3. Base height: A4 oranı (1.414) kullanarak hesapla
  // 4. Info height: 140px (bilgi alanı)
  // 5. Map height: base height - info height
  // 6. Boyutları döndür
}
```

**Hesaplama:**
- Base width: `Math.min(sw * 0.95, 800)` (ekran genişliğinin %95'i veya 800px)
- Base height: `baseWidth * 1.414` (A4 oranı: √2 ≈ 1.414)
- Info height: 140px (bilgi alanı yüksekliği)
- Map height: `baseHeight - infoHeight` (harita alanı yüksekliği)

**Sonuç:**
```typescript
{
  mapWidth: number,      // Harita genişliği
  mapHeight: number,     // Harita yüksekliği
  modalWidth: number,    // Modal genişliği
  modalHeight: number,   // Modal yüksekliği (140px)
  height: number,        // Toplam yükseklik (A4 oranı)
  totalWidth: number,    // Toplam genişlik
}
```

## Çıktılar

### shareImage

```typescript
Promise<boolean>
```
- `true`: Paylaşım başarılı
- `false`: Paylaşım başarısız (servis kullanılamaz veya hata)

### shareImageWithText

```typescript
Promise<{ success: boolean; linkText: string }>
```
- `success`: Paylaşım başarılı/başarısız
- `linkText`: Paylaşılan metin (her durumda döndürülür)

### cleanupTempFiles

```typescript
Promise<void>
```
- Hata olsa bile exception fırlatmaz (hata loglanır)

### getCombinedImageDimensions

```typescript
{
  mapWidth: number,
  mapHeight: number,
  modalWidth: number,
  modalHeight: number,
  height: number,
  totalWidth: number,
}
```

## Kullanım

### Basit Görüntü Paylaşımı

```typescript
import { shareImage } from './utils/screenshotManager';

const imageUri = 'file:///path/to/image.png';
const success = await shareImage(imageUri);
if (success) {
  console.log('Görüntü paylaşıldı');
}
```

### Görüntü ve Metin Paylaşımı

```typescript
import { shareImageWithText } from './utils/screenshotManager';

const imageUri = 'file:///path/to/image.png';
const linkText = 'https://proparcel.com/share/123';
const result = await shareImageWithText(imageUri, linkText);
if (result.success) {
  console.log('Görüntü ve metin paylaşıldı:', result.linkText);
}
```

### Geçici Dosya Temizleme

```typescript
import { cleanupTempFiles } from './utils/screenshotManager';

const tempFiles = [
  'file:///path/to/temp1.png',
  'file:///path/to/temp2.png',
  null
];

await cleanupTempFiles(tempFiles);
console.log('Geçici dosyalar temizlendi');
```

### Görüntü Boyutları Hesaplama

```typescript
import { getCombinedImageDimensions } from './utils/screenshotManager';

const dimensions = getCombinedImageDimensions();
console.log('Harita boyutları:', dimensions.mapWidth, dimensions.mapHeight);
console.log('Modal boyutları:', dimensions.modalWidth, dimensions.modalHeight);
```

## Platform Farklılıkları

### iOS
- `Share.share()` ile görüntü ve metin birlikte paylaşılabilir
- Hata durumunda fallback olarak `Sharing.shareAsync()` kullanılır
- Metin paylaşımı için 800ms gecikme ile ayrı dialog açılır

### Android
- Görüntü ve metin aynı anda paylaşılamaz
- Önce görüntü paylaşılır (`Sharing.shareAsync()`)
- 800ms sonra metin paylaşılır (`Share.share()`)
- İki ayrı dialog açılır

## Diğer Modüller

### Bağımlılıklar

**Expo:**
- `expo-file-system/legacy` - Dosya sistemi işlemleri
- `expo-sharing` - Paylaşım servisi

**React Native:**
- `Share` - Native paylaşım API'si
- `Dimensions` - Ekran boyutları
- `Platform` - Platform kontrolü
- `Alert` - Alert gösterme (import edilmiş ama kullanılmamış)

### Kullanıldığı Yerler

- `app/utils/handlers/shareHandler.ts` - Paylaşım handler'ı (shareImage, shareImageWithText, cleanupTempFiles, getCombinedImageDimensions kullanır)
- Paylaşım işlemleri sırasında görüntüler yakalanır ve paylaşılır
- Geçici dosyalar paylaşım sonrası temizlenir

## Notlar

- `shareImageWithText` fonksiyonu, platform'a göre farklı strateji kullanır
- Android'de görüntü ve metin ayrı dialog'larda paylaşılır (800ms gecikme ile)
- iOS'te görüntü ve metin birlikte paylaşılabilir
- `cleanupTempFiles` fonksiyonu idempotent'tir (dosya yoksa hata vermez)
- Geçici dosyalar `file://` URI formatında olmalıdır
- `getCombinedImageDimensions` fonksiyonu A4 oranını (1.414) kullanır
- Bilgi alanı yüksekliği 140px (optimize edilmiş)
- Ekran genişliğinin %95'i veya 800px (küçük olan) kullanılır

## İlgili Dokümanlar

- `utils/handlers/shareHandler.md` - Paylaşım handler dokümantasyonu (screenshotManager kullanımı)
- `components/CombinedScreenshotContainer.md` - Screenshot container dokümantasyonu
- `docs/index.md` - Ana ekran dokümantasyonu (paylaşım özelliği)
