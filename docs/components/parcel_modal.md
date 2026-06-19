# Parsel Modal (ParcelModal) Dokümantasyonu

## Özellik/Görev

`ParcelModal` component'i, parsel bilgilerini gösteren bir modal bileşenidir. Bu modal, kullanıcıya parsel detaylarını (konum, ada/parsel numarası, alan, fiyat bilgileri vb.) gösterir.

Modal, aşağıdan yukarı doğru açılan (bottom sheet) bir yapıya sahiptir ve kullanıcı tarafından aşağı kaydırarak kapatılabilir.

## Girdiler

### Props

```typescript
interface ParcelModalProps {
  visible: boolean;                    // Modal görünürlüğü
  onClose: () => void;                 // Modal kapatma callback'i
  properties: Record<string, any>;     // Parsel properties (TKGM verileri)
  analysisData?: ProParcelResponse | null;  // Pro analiz verileri (opsiyonel)
  onShare?: () => void;                // Paylaşım callback'i (opsiyonel, kullanılmıyor)
}
```

### Veri Kaynakları

1. **properties** - TKGM'den gelen temel parsel bilgileri
   - `adaNo`, `ada`, `Ada` - Ada numarası
   - `parselNo`, `parsel`, `Parsel` - Parsel numarası
   - `mahalleAd`, `mahalle`, `quarter` - Mahalle adı
   - `ilAd`, `il`, `city` - İl adı
   - `ilceAd`, `ilce`, `town` - İlçe adı
   - `alan`, `area`, `Area`, `area_m2` - Alan bilgisi
   - `nitelik`, `Nitelik` - Nitelik bilgisi

2. **analysisData** - Pro analiz verileri (Pro mod için)
   - `parameters_data.parcel_values` - Parsel değerleri
   - Birim fiyat ve toplam fiyat bilgileri

## İç Akış

### 1. Modal Açılma/Kapanma Animasyonu

```typescript
useEffect(() => {
  if (visible) {
    translateY.value = withTiming(0, { 
      duration: 350,
      easing: Easing.out(Easing.exp)
    });
  } else {
    translateY.value = withTiming(SCREEN_HEIGHT, { 
      duration: 250,
      easing: Easing.in(Easing.exp)
    });
  }
}, [visible]);
```

Modal, React Native Reanimated kullanarak smooth bir animasyon ile açılır/kapanır.

### 2. Gesture Handling

```typescript
const gesture = Gesture.Pan()
  .onUpdate((event) => {
    if (event.translationY > 0) {
      translateY.value = event.translationY;
    }
  })
  .onEnd((event) => {
    if (event.translationY > 150 || event.velocityY > 500) {
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: 200 }, () => {
        runOnJS(onClose)();
      });
    } else {
      translateY.value = withTiming(0, { 
        duration: 250,
        easing: Easing.out(Easing.exp)
      });
    }
  });
```

Kullanıcı modal'ı aşağı kaydırarak kapatabilir:
- 150px'den fazla kaydırılırsa veya
- 500 velocity'den fazla hızla kaydırılırsa → modal kapanır
- Aksi halde → modal yerine geri döner

### 3. Veri Birleştirme

```typescript
const mergedProperties = useMemo(() => {
  const parametersData: any = analysisData?.parameters_data || {};
  const parcelValues = parametersData?.parcel_values || {};
  return { ...properties, ...parametersData, ...parcelValues };
}, [properties, analysisData]);
```

Properties ve analysisData birleştirilerek tek bir object oluşturulur. Bu sayede hem basit mod hem de pro mod verileri aynı şekilde işlenebilir.

### 4. Özet Bilgi Oluşturma

```typescript
const summary = useMemo(() => {
  // Konum bilgileri
  const il = pickValue(mergedProperties, ['ilAd', 'il', 'city', ...]);
  const ilce = pickValue(mergedProperties, ['ilceAd', 'ilce', 'town', ...]);
  // ... diğer alanlar
  
  // Fiyat bilgileri
  const unitRaw = pickRaw(mergedProperties, PRICE_KEYS_UNIT);
  let totalRaw = pickRaw(mergedProperties, PRICE_KEYS_TOTAL);
  
  // Toplam fiyat yoksa birim fiyat * alan hesaplanır
  if (totalRaw === null) {
    const unitNum = parseTurkishPrice(unitRaw as any);
    const areaNum = parseAreaToNumber(alanRaw);
    if (unitNum > 0 && areaNum > 0) totalRaw = unitNum * areaNum;
  }
  
  return { il, ilce, mahalle, ada, parsel, alan, nitelik, mevkii, unitPriceText, totalPriceText };
}, [mergedProperties]);
```

Özet bilgi, mergedProperties'ten gerekli alanlar extract edilerek oluşturulur. Fiyat bilgileri formatlanır ve gösterime hazır hale getirilir.

### 5. Render

Modal şu bölümlerden oluşur:

1. **Fiyat Bölümü (priceRow)**
   - Birim fiyat kartı (m² başına)
   - Toplam fiyat kartı (tahmini toplam)

2. **Bilgi Alanı (infoArea)**
   - **Header Info:** Konum bilgisi ve nitelik badge'i
   - **Data Grid:** Ada, Parsel, Alan kutuları
   - **Footer:** Tarih bilgisi

## Çıktılar

### Render Edilen UI Elementleri

1. **Modal Overlay** - Modal arka planı (transparent, tıklanabilir)
2. **Animated Modal Content** - Modal içeriği (bottom sheet)
   - Grabber (üst kısımda küçük çubuk)
   - ScrollView içeriği
     - Fiyat kartları
     - Bilgi alanı

### Görsel Çıktılar

- **Birim Fiyat Kartı:** Mavi tonlarda, "m² başına" etiketi ile
- **Toplam Fiyat Kartı:** Yeşil tonlarda, "tahmini toplam" etiketi ile
- **Konum Bilgisi:** İl/İlçe ve Mahalle bilgisi
- **Nitelik Badge:** Mavi border'li badge
- **Data Boxes:** Ada, Parsel, Alan bilgileri grid formatında

## Helper Fonksiyonlar

### normalizeKey
```typescript
const normalizeKey = (key: string): string => {
  // Key'i normalize eder (diacritics kaldırma, lowercase, whitespace temizleme)
}
```
Key'leri normalize ederek karşılaştırma yapmayı kolaylaştırır.

### isHiddenKey
```typescript
const isHiddenKey = (key: string): boolean => {
  // Belirli key'lerin gizlenip gizlenmeyeceğini kontrol eder
}
```
Gizlenecek alanları belirler (pafta, quarter_type_name vb.).

### pickValue
```typescript
const pickValue = (source: Record<string, any>, keys: string[]): string => {
  // Verilen key'lerden ilk bulunan değeri döndürür, yoksa '-'
}
```
Birden fazla olası key'den ilk bulunan değeri döndürür. Hiçbiri bulunamazsa '-' döndürür.

### pickRaw
```typescript
const pickRaw = (source: Record<string, any>, keys: string[]): any => {
  // Verilen key'lerden ilk bulunan ham değeri döndürür, yoksa null
}
```
pickValue'ya benzer, ancak ham değeri döndürür (formatlanmamış).

### parseAreaToNumber
```typescript
const parseAreaToNumber = (value: any): number => {
  // Alan değerini sayıya çevirir
}
```
Alan değerini (string veya number) sayıya çevirir. "1.234 m²" → 1234.

### formatArea
```typescript
const formatArea = (value: any): string => {
  // Alan değerini formatlar: "1.234 m²"
}
```
Alan değerini Türkçe formatında string'e çevirir.

### formatPriceMaybe
```typescript
const formatPriceMaybe = (raw: any): string => {
  // Fiyat değerini formatlar, yoksa '-'
}
```
Fiyat değerini Türkçe formatında string'e çevirir (priceParser kullanır).

## Fiyat Key Listeleri

### PRICE_KEYS_UNIT (Birim Fiyat)
```typescript
const PRICE_KEYS_UNIT = [
  'unite_price', 'unitPrice', 'unit_price', 'birim_fiyat', 'birimFiyat', 
  'BirimFiyat', 'pricePerSquareMeter', 'price_per_square_meter', 
  'm2_price', 'm2Price', 'M2Price', 'KYM_M2Price',
  'quarter_uniteprice', 'quarter_uniteprice_km_estimated', 
  'quarter_uniteprice_median',
];
```

### PRICE_KEYS_TOTAL (Toplam Fiyat)
```typescript
const PRICE_KEYS_TOTAL = [
  'price_of_tarla', 'total_price', 'toplam_fiyat', 'TotalPrice', 
  'totalPrice', 'ToplamFiyat', 'estimated_total_price', 
  'estimatedTotalPrice', 'estimated_price', 'km_recommended_price',
];
```

Bu listeler, farklı API response formatlarından fiyat bilgilerini extract etmek için kullanılır.

## Kullanım

### Basit Örnek

```typescript
<ParcelModal
  visible={parcelModalVisible}
  onClose={() => setParcelModalVisible(false)}
  properties={parcelData.properties}
  analysisData={parcelData.analysisData}
/>
```

### Pro Mod ile

```typescript
<ParcelModal
  visible={parcelModalVisible}
  onClose={() => setParcelModalVisible(false)}
  properties={parcelData.properties || {}}
  analysisData={parcelData.analysisData}  // Pro analiz verileri
/>
```

### Basit Mod ile

```typescript
<ParcelModal
  visible={parcelModalVisible}
  onClose={() => setParcelModalVisible(false)}
  properties={selectedParcel.properties || {}}
  analysisData={null}  // Basit modda null
/>
```

## Stil Özellikleri

### Modal Boyutu
- Modal yüksekliği: Ekran yüksekliğinin %55'i (`MODAL_HEIGHT = SCREEN_HEIGHT * 0.55`)

### Renkler
- **Arka plan:** `#1e293b` (koyu gri)
- **Border:** `#3b82f6` (mavi)
- **Birim fiyat kartı:** `#eff6ff` (açık mavi), border: `#bfdbfe`
- **Toplam fiyat kartı:** `#ecfdf5` (açık yeşil), border: `#a7f3d0`
- **Metin:** `#ffffff` (beyaz), `#94a3b8` (açık gri)

### Animasyonlar
- **Açılma:** 350ms, `Easing.out(Easing.exp)`
- **Kapanma:** 250ms, `Easing.in(Easing.exp)`
- **Gesture kapanma:** 200ms

## Diğer Modüller

### Bağımlılıklar

**React Native:**
- `Modal` - Modal container
- `View`, `Text`, `TouchableOpacity`, `ScrollView` - UI elementleri
- `Dimensions` - Ekran boyutları

**Third-party:**
- `react-native-gesture-handler` - Gesture handling
- `react-native-reanimated` - Animasyonlar
- `expo-vector-icons` - İkonlar
- `react-native-safe-area-context` - Safe area desteği

**Local:**
- `priceParser` - Fiyat parsing ve formatlama
- `parcelResponse` types - TypeScript tipleri

## Notlar

- Modal, kullanıcı tarafından aşağı kaydırarak kapatılabilir
- Gesture handler, yukarı kaydırmayı engeller (sadece aşağı)
- Fiyat bilgileri yoksa veya null ise '-' gösterilir
- Toplam fiyat yoksa birim fiyat * alan hesaplanır
- Modal içeriği scroll edilebilir (uzun içerikler için)
- Safe area insets kullanılır (iPhone notch vb. için)
- Hidden fields listesi içinde belirtilen alanlar gösterilmez (pafta, quarter_type_name vb.)

## İlgili Dokümanlar

- `docs/index.md` - Ana ekran dokümantasyonu (ParcelModal kullanımı)
- `utils/priceParser.md` - Fiyat parsing dokümantasyonu
- `types/parcelResponse.md` - Parsel response tipleri
