# Ada Parsel Form (AdaParselForm) Dokümantasyonu

## Özellik/Görev

`AdaParselForm` component'i, kullanıcıdan Ada/Parsel sorgulama bilgilerini almak için kullanılan bir form bileşenidir. Bu form, İl, İlçe, Mahalle seçimi ve Ada/Parsel numarası girişi yapılmasını sağlar.

Form, hierarchical (hiyerarşik) bir yapıya sahiptir: İl → İlçe → Mahalle sırasıyla seçilir ve her seçim sonrası bir sonraki seviye aktif hale gelir.

## Girdiler

### Props

```typescript
interface AdaParselFormProps {
  onClose: () => void;  // Form kapatma callback'i
  onSubmit?: (payload: {
    mahalleTkgmValue: number;  // Mahalle TKGM value
    mahalle: string;            // Mahalle adı
    ada: string;                // Ada numarası
    parsel: string;             // Parsel numarası
    proparcelValue?: number;    // Proparcel value (opsiyonel)
    city?: string;              // Şehir adı (opsiyonel)
    town?: string;              // İlçe adı (opsiyonel)
  }) => void;  // Form gönderimi callback'i
}
```

### Veri Kaynakları

**locations.json:**
- `app/data/locations.json` - İl, İlçe, Mahalle verilerini içeren JSON dosyası
- Dosya yapısı:
  ```typescript
  {
    cities: City[];  // İller listesi
    total_cities?: number;
    total_towns?: number;
    total_quarters?: number;
  }
  ```

**Type Definitions:**
- `City` - İl tipi (Id, Tkgm_value, Proparcel_text, Towns[])
- `Town` - İlçe tipi (Id, Tkgm_value, Proparcel_text, Quarters[])
- `Quarter` - Mahalle tipi (Id, Tkgm_text, Tkgm_value, Proparcel_text, Proparcel_value, Inactive?)

## İç Akış

### 1. Component İlk Yükleme

```typescript
const locations = locationsJson as unknown as LocationsResponse;
```

Locations JSON dosyası component içinde import edilir ve kullanılır.

### 2. Keyboard Height Takibi

```typescript
useEffect(() => {
  const onShow = (e: any) => {
    const h = e?.endCoordinates?.height;
    if (typeof h === 'number') setKeyboardHeight(h);
  };
  const onHide = () => setKeyboardHeight(0);

  const subShow = Keyboard.addListener('keyboardDidShow', onShow);
  const subHide = Keyboard.addListener('keyboardDidHide', onHide);
  return () => {
    subShow.remove();
    subHide.remove();
  };
}, []);
```

Klavye açıldığında/kapandığında yüksekliği takip eder ve picker modal'ın padding'ini ayarlar.

### 3. Hiyerarşik Seçim Akışı

1. **İl Seçimi:**
   - Kullanıcı "İl seçiniz" butonuna tıklar
   - `openPicker('city')` çağrılır
   - İller listesi modal'da gösterilir
   - Kullanıcı bir il seçer
   - `selectItem` çağrılır, `selectedCity` set edilir
   - İlçe seçimi aktif hale gelir

2. **İlçe Seçimi:**
   - Kullanıcı "İlçe seçiniz" butonuna tıklar (sadece il seçildikten sonra aktif)
   - `openPicker('town')` çağrılır
   - Seçili ilin ilçeleri modal'da gösterilir
   - Kullanıcı bir ilçe seçer
   - `selectItem` çağrılır, `selectedTown` set edilir
   - Mahalle seçimi aktif hale gelir

3. **Mahalle Seçimi:**
   - Kullanıcı "Mahalle seçiniz" butonuna tıklar (sadece ilçe seçildikten sonra aktif)
   - `openPicker('quarter')` çağrılır
   - Seçili ilçenin mahalleleri modal'da gösterilir (Inactive olanlar filtrelenir)
   - Kullanıcı bir mahalle seçer
   - `selectItem` çağrılır, `selectedQuarter` set edilir

4. **Ada/Parsel Girişi:**
   - Kullanıcı Ada ve Parsel numaralarını TextInput'lara girer
   - Numeric keyboard kullanılır

### 4. Arama/Filtreleme

```typescript
const filteredItems = useMemo(() => {
  if (!currentPicker) return [];
  const q = normalizeTr(pickerSearch);
  if (!q) return currentPicker.items.slice(0, MAX_RESULTS);

  const out: any[] = [];
  for (const it of currentPicker.items as any[]) {
    const txt = normalizeTr(String(it?.Proparcel_text || ''));
    if (txt.includes(q)) {
      out.push(it);
      if (out.length >= MAX_RESULTS) break;
    }
  }
  return out;
}, [currentPicker, pickerSearch]);
```

Picker modal'da arama yapılabilir:
- Arama metni normalize edilir (Türkçe karakterler kaldırılır, lowercase)
- `Proparcel_text` alanında arama yapılır
- Maksimum 200 sonuç gösterilir
- Arama metni yoksa ilk 200 sonuç gösterilir

### 5. Form Gönderimi

```typescript
const handleSorgula = () => {
  // Validasyon
  if (!selectedCity || !selectedTown || !selectedQuarter || !ada || !parsel) {
    alert('Lütfen tüm alanları doldurun');
    return;
  }
  
  // Payload oluştur
  const payload = {
    mahalleTkgmValue: Number(selectedQuarter.Tkgm_value),
    mahalle: selectedQuarter.Proparcel_text,
    ada: String(ada).trim(),
    parsel: String(parsel).trim(),
    proparcelValue: Number((selectedQuarter as any).Proparcel_value),
    city: selectedCity.Proparcel_text,
    town: selectedTown.Proparcel_text,
  };
  
  // onSubmit callback'ini çağır
  if (onSubmit) {
    onSubmit(payload);
  }
};
```

Form gönderilmeden önce:
1. Tüm alanların doldurulduğu kontrol edilir
2. Payload object'i oluşturulur
3. `onSubmit` callback'i çağrılır

### 6. Form Temizleme

```typescript
const handleTemizle = () => {
  setSelectedCity(null);
  setSelectedTown(null);
  setSelectedQuarter(null);
  setAda('');
  setParsel('');
};
```

Form temizlendiğinde tüm seçimler ve girişler sıfırlanır.

## Çıktılar

### Render Edilen UI Elementleri

1. **KeyboardAvoidingView** - Ana container (klavye yönetimi için)
2. **ScrollView** - Form container (scroll edilebilir)
3. **Form Fields:**
   - İl seçim butonu (picker)
   - İlçe seçim butonu (picker, il seçildikten sonra aktif)
   - Mahalle seçim butonu (picker, ilçe seçildikten sonra aktif)
   - Ada numarası TextInput (numeric keyboard)
   - Parsel numarası TextInput (numeric keyboard)
4. **Action Buttons:**
   - "Sorgula" butonu (primary, mavi)
   - "Temizle" butonu (secondary, beyaz border)
5. **Picker Modal:**
   - Modal overlay (yarı saydam arka plan)
   - Picker modal container
   - Başlık ve kapatma butonu
   - Arama TextInput
   - FlatList (seçilebilir item'lar)

### Form Gönderimi Çıktısı

Form gönderildiğinde `onSubmit` callback'ine şu payload gönderilir:

```typescript
{
  mahalleTkgmValue: number;     // Mahalle TKGM value (sorgu için gerekli)
  mahalle: string;              // Mahalle adı
  ada: string;                  // Ada numarası (trim edilmiş)
  parsel: string;               // Parsel numarası (trim edilmiş)
  proparcelValue?: number;      // Proparcel value
  city?: string;                // Şehir adı
  town?: string;                // İlçe adı
}
```

## Helper Fonksiyonlar

### normalizeTr
```typescript
const normalizeTr = (s: string): string => {
  // Türkçe karakterleri normalize eder
  // Diacritics kaldırır, lowercase yapar, ı → i çevirir
  // Whitespace'leri normalize eder
}
```

Arama için string'leri normalize eder.

### openPicker
```typescript
const openPicker = (mode: PickerMode) => {
  setPickerSearch('');
  setPickerMode(mode);
};
```

Picker modal'ı açar ve modu set eder.

### closePicker
```typescript
const closePicker = () => {
  setPickerMode(null);
  setPickerSearch('');
};
```

Picker modal'ı kapatır ve arama metnini temizler.

### selectItem
```typescript
const selectItem = (item: any) => {
  if (pickerMode === 'city') {
    setSelectedCity(item as City);
    setSelectedTown(null);  // Alt seviyeleri temizle
    setSelectedQuarter(null);
  } else if (pickerMode === 'town') {
    setSelectedTown(item as Town);
    setSelectedQuarter(null);  // Alt seviyeyi temizle
  } else if (pickerMode === 'quarter') {
    setSelectedQuarter(item as Quarter);
  }
  closePicker();
};
```

Bir item seçildiğinde:
- İlgili state güncellenir
- Alt seviye state'ler temizlenir (hiyerarşik yapı)
- Picker modal kapatılır

## Kullanım

### Basit Örnek

```typescript
<AdaParselForm
  onClose={() => setActiveScreen(null)}
  onSubmit={async (payload) => {
    // Payload ile parsel sorgusu yap
    await handleAdaParselSubmit(payload);
  }}
/>
```

### index.tsx'te Kullanım

```typescript
<ParcelSearchModal 
  visible={activeScreen === 'ada-parsel'} 
  onClose={handleCloseForm} 
  onSubmit={handleAdaParselSubmit} 
/>
```

Not: `ParcelSearchModal` component'i `AdaParselForm`'u sarmalayabilir (wrapper).

## State Yönetimi

### Local State
- `selectedCity` - Seçili il
- `selectedTown` - Seçili ilçe
- `selectedQuarter` - Seçili mahalle
- `ada` - Ada numarası girişi
- `parsel` - Parsel numarası girişi
- `pickerMode` - Aktif picker modu (city/town/quarter/null)
- `pickerSearch` - Picker arama metni
- `keyboardHeight` - Klavye yüksekliği

### Computed Values (useMemo)
- `cityItems` - İller listesi
- `townItems` - Seçili ilin ilçeleri listesi
- `quarterItems` - Seçili ilçenin mahalleleri listesi (Inactive olanlar filtrelenmiş)
- `currentPicker` - Aktif picker bilgileri (title, items)
- `filteredItems` - Filtrelenmiş picker item'ları (arama sonuçları)

## Validasyon

Form gönderilmeden önce şu kontroller yapılır:
- `selectedCity` null olmamalı
- `selectedTown` null olmamalı
- `selectedQuarter` null olmamalı
- `ada` boş string olmamalı
- `parsel` boş string olmamalı

Herhangi biri eksikse alert gösterilir ve form gönderilmez.

## Stil Özellikleri

### Renkler
- **Arka plan:** `#fff` (beyaz)
- **Primary button:** `#1e40af` (mavi)
- **Secondary button:** `#fff` (beyaz, mavi border)
- **Picker disabled:** `#f5f5f5` (açık gri)
- **Modal overlay:** `rgba(0, 0, 0, 0.5)` (yarı saydam siyah)
- **Modal arka plan:** `#fff` (beyaz)

### Spacing
- Form padding: 16px
- Field container margin bottom: 12px
- Button container margin top: 12px
- Button gap: 10px

### Modal
- Modal yüksekliği: %75
- Modal border radius: 20px (üst köşeler)
- Picker item padding: 16px vertical, 20px horizontal

## Diğer Modüller

### Bağımlılıklar

**React Native:**
- `View`, `Text`, `TextInput`, `TouchableOpacity` - UI elementleri
- `ScrollView` - Scroll container
- `Modal` - Picker modal container
- `FlatList` - Picker item listesi
- `KeyboardAvoidingView` - Klavye yönetimi
- `Keyboard` - Klavye event listener'ları
- `ActivityIndicator` - Yükleme göstergesi
- `Platform` - Platform kontrolü

**Third-party:**
- `expo-vector-icons` - İkonlar (Ionicons)
- `react-native-safe-area-context` - Safe area desteği

**Local:**
- `app/data/locations.json` - İl, İlçe, Mahalle verileri

## Notlar

- Form, hiyerarşik bir yapıya sahiptir: İl → İlçe → Mahalle
- Bir seviye seçilmeden alt seviye seçilemez (disabled)
- Mahalle seçiminde Inactive olanlar filtrelenir
- Picker modal'da arama yapılabilir (maksimum 200 sonuç)
- Klavye açıldığında picker modal padding'i ayarlanır
- Form validasyonu client-side'da yapılır
- Ada ve Parsel numaraları numeric keyboard ile girilir
- Safe area insets kullanılır (iPhone notch vb. için)
- TestID'ler eklenmiştir (test edilebilirlik için)

## İlgili Dokümanlar

- `docs/index.md` - Ana ekran dokümantasyonu (AdaParselForm kullanımı)
- `components/ParcelSearchModal.md` - Parsel arama modal dokümantasyonu (wrapper olabilir)
- `components/smart_query.md` - Akıllı Sorgu (OpenAI metin/resim/ses, Django API)
