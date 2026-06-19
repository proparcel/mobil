# ProParcel Mobil Projesi – Ekran Görüntüsü Operasyonu (Yapay Zeka Öğretim Komutu)

Bu belge, ProParcel mobil projesindeki **ekran görüntüsü alma ve paylaşma** işleminin nasıl çalıştığını, başka bir yapay zekaya öğretmek için hazırlanmıştır. Tüm akış, dosya konumları ve kritik noktalar detaylıca açıklanmaktadır.

---

## 1. Genel Bakış

ProParcel mobil uygulamasında **iki farklı ekran görüntüsü senaryosu** vardır:

1. **Ana sayfa (index) – Harita + Parsel bilgisi ekran görüntüsü ve paylaşım**
   - Kullanıcı kamera butonuna basar → ekran görüntüsü önizleme modu açılır
   - Harita + parsel bilgisi alanı birleştirilir, PNG alınır
   - `react-native-share` ile paylaşılır

2. **Hisseli Parsel Böl (parcel-split) – PDF için ekran görüntüleri**
   - Gizli ViewShot bileşenleri ile ana parsel ve her parça için PNG base64 alınır
   - Bu görseller PDF raporuna gömülür

---

## 2. Ana Sayfa Ekran Görüntüsü Akışı (Detaylı)

### 2.1 Tetikleme

- **Konum:** `frontend/screens/routes/index.tsx`
- **Buton:** Alt pill bardaki kamera ikonlu buton (`testID="camera-share-button"`)
- **Handler:** `handleCameraPress` → `setScreenshotPreviewMode(true)` çağırır

```tsx
// Satır ~2476
<TouchableOpacity testID="camera-share-button" onPress={handleCameraPress} style={styles.pillButton}>
  <Ionicons name="camera" size={18} color="#fff" />
</TouchableOpacity>
```

### 2.2 Önizleme Modu (screenshotPreviewMode)

`screenshotPreviewMode === true` olduğunda:

1. **Overlay gösterilir:** SVG ile kesik çizgili mavi çerçeve, harita + bilgi alanının sınırlarını gösterir
2. **Butonlar:**
   - **İptal** (`handleCancelScreenshot`): Önizlemeyi kapatır
   - **Fiyat Gir**: Parsel varsa kullanıcının manuel fiyat girmesini sağlar (override)
   - **Onayla** (`handleConfirmScreenshot`): Gerçek ekran görüntüsü alımı ve paylaşımı başlatır

3. **Gizli CombinedScreenshotContainer:** `position: absolute, left: -10000, top: -10000, opacity: 0` ile ekran dışında render edilir. Bu bileşen ViewShot ile sarılıdır; görünmez ama capture() ile yakalanabilir.

### 2.3 Paylaşım Akışı (shareHandler.ts)

**Dosya:** `frontend/src/utils/handlers/shareHandler.ts`

`createShareHandler` fonksiyonu şu adımları uygular:

1. **Boyut hesaplama:** `getCombinedImageDimensions()` – A4 oranına yakın (baseWidth * 1.7), ekran genişliğinin %95’i ile sınırlı

2. **MapView ref kontrolü:** `mapRef.current` yoksa en fazla 20 retry (100ms aralık) beklenir

3. **Map idle beklenir:** `waitForMapIdle(mapReadyRef, 5000)` – Mapbox style/annotation uygulanana kadar beklenir

4. **Harita snapshot:** `tryMapboxSnap(mapRef, dimensions)` – Mapbox `takeSnap` veya `takeSnapshot` ile harita PNG’si alınır (file:// URI veya base64)

5. **State güncelleme:** `setCapturedMapUri(mapUri)` – CombinedScreenshotContainer bu URI ile harita görselini gösterir

6. **Render commit bekleme:** Birden fazla `requestAnimationFrame` + 150–300 ms timeout (Image yüklenmesi için)

7. **ViewShot ref bekleme:** `combinedContainerRef.current?.capture` en fazla 30 retry (100ms aralık) beklenir

8. **Combined capture:** `combinedContainerRef.current.capture()` – Harita + bilgi alanı tek PNG olarak yakalanır (tmpfile URI)

9. **Paylaşım:** `shareImageWithText(combinedUri, shareText)` veya `shareImage(combinedUri)` – react-native-share ile sistem paylaşım sheet’i açılır

10. **Temizlik:** `cleanupTempFiles([mapUri, combinedUri])`, `setCapturedMapUri(null)`, `setCapturedModalUri(null)`

### 2.4 CombinedScreenshotContainer

**Dosya:** `frontend/components/app/CombinedScreenshotContainer.tsx`

- **react-native-view-shot** ile sarılı View
- **İki mod:**
  - `mapOnly === true`: Sadece harita görseli (parsel yoksa)
  - `mapOnly === false`: Harita + alt bilgi alanı (il, ilçe, mahalle, ada, parsel, alan, nitelik, birim/toplam fiyat)

- **Fiyat override:** `priceOverride` prop’u ile kullanıcı girdiği fiyatlar backend değerlerinin üstüne yazılır
- **Boyutlar:** `getCombinedImageDimensions()` ile hesaplanır

### 2.5 Yardımcı Modüller

| Dosya | Amaç |
|-------|------|
| `src/utils/screenshotManager.ts` | `shareImage`, `shareImageWithText`, `cleanupTempFiles`, `getCombinedImageDimensions` |
| `src/utils/mapboxSnapshot.ts` | `waitForMapIdle`, `tryMapboxSnap` – Mapbox harita PNG yakalama |
| `src/utils/useScreenshotListener.ts` | Sistem ekran görüntüsü alındığında ShareModal açma (ScreenCapture modülü varsa; şu an modül yok, devre dışı) |

---

## 3. Hisseli Parsel Böl – PDF Ekran Görüntüleri

**Dosya:** `frontend/screens/routes/parcel-split.tsx`

### 3.1 Gizli ViewShot Bileşenleri

- **pdfParentRenderRef:** Ana parsel görünümü (PdfRenderCanvas mode="parent")
- **pieceShotRefs:** Her parça için ayrı ViewShot (PdfRenderCanvas mode="piece")

### 3.2 buildPdf İçinde Yakalama

```ts
// Ana parsel
const screenshot = await pdfParentRenderRef.current.capture({
  format: "png", quality: 0.9, result: "base64",
  width: PDF_PARENT_W, height: PDF_PARENT_H,
});

// Her parça için
const b64 = await shotRef.capture({
  format: "png", quality: 0.9, result: "base64",
  width: PDF_THUMB_W, height: PDF_THUMB_H,
});
```

Bu base64 string’ler `parcelSplitPdf.ts` içinde HTML img src olarak kullanılır, sonra `react-native-html-to-pdf` ile PDF’e çevrilir.

Detay için: `docs/HISSELI_PARSEL_PDF_KAYIT_DETAY.md`

---

## 4. Kritik Teknik Noktalar

### 4.1 ViewShot Kullanımı

- **Paket:** `react-native-view-shot`
- **Options:** `format: 'png', quality: 1.0, result: 'tmpfile'` (ana sayfa) veya `result: 'base64'` (PDF)
- **Ref:** `ref.current.capture()` async fonksiyon döndürür; URI veya base64 string verir

### 4.2 Mapbox Snapshot

- `map.takeSnap` veya `map.takeSnapshot` kullanılır
- Parametre formatı: `{ width, height, format: 'png', quality: 1, writeToDisk: true }`
- Bazı sürümlerde sadece boolean (writeToDisk) desteklenir; fallback: `fn.call(map, true)`

### 4.3 Render Zamanlaması

- State güncellemesinden sonra **birden fazla requestAnimationFrame** beklenmeli
- Image `onLoadEnd` benzeri davranış için **150–300 ms** ek bekleme gerekebilir
- ViewShot ref’i bazen gecikmeli bağlanır; retry döngüsü kullanılmalı

### 4.4 Gizli Container Pozisyonu

CombinedScreenshotContainer ekran dışında (`left: -10000`) render edilir; kullanıcı görmez ama ViewShot capture() çalışır. `pointerEvents: 'none'` ile etkileşim engellenir.

---

## 5. Dosya Haritası (Hızlı Referans)

```
frontend/
├── app/routes/
│   ├── index.tsx              # Ana sayfa, handleCameraPress, screenshotPreviewMode, handleConfirmScreenshot
│   └── parcel-split.tsx       # buildPdf, pdfParentRenderRef, pieceShotRefs
├── components/app/
│   └── CombinedScreenshotContainer.tsx  # ViewShot + harita + bilgi alanı
└── src/utils/
    ├── handlers/shareHandler.ts         # createShareHandler – ana paylaşım akışı
    ├── screenshotManager.ts             # shareImage, cleanupTempFiles, getCombinedImageDimensions
    ├── mapboxSnapshot.ts                # waitForMapIdle, tryMapboxSnap
    ├── useScreenshotListener.ts         # Sistem screenshot listener (opsiyonel)
    └── parcelSplitPdf.ts                # PDF HTML şablonu, generateParcelSplitPdf
```

---

## 6. Başka Bir Yapay Zekaya Verilecek Kısa Komut Örneği

> "ProParcel mobil projesinde ekran görüntüsü şöyle çalışır: Ana sayfada kamera butonuna basınca `handleCameraPress` → `screenshotPreviewMode` açılır. Onayla’ya basınca `handleConfirmScreenshot` → `handleShare` (shareHandler) çağrılır. shareHandler: Mapbox’tan `tryMapboxSnap` ile harita PNG’si alınır, `setCapturedMapUri` ile state güncellenir. Ekran dışında gizli `CombinedScreenshotContainer` (ViewShot) bu URI ile harita + parsel bilgisi render eder. `combinedContainerRef.current.capture()` ile tek PNG alınır. react-native-share ile paylaşılır. Kritik: Map idle bekle, birden fazla RAF + Image yükleme timeout’u, ViewShot ref retry döngüsü. Dosyalar: shareHandler.ts, CombinedScreenshotContainer.tsx, mapboxSnapshot.ts, screenshotManager.ts."

---

Bu belge, yapay zekanın ProParcel mobil projesindeki ekran görüntüsü operasyonunu anlaması ve değişiklik yapması için gereken tüm bilgiyi içerir.
