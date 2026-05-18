# Mobil Proje Geliştirme Kuralları

## Genel İlkeler

Bu doküman, ProParcel mobil uygulaması geliştirme sürecindeki temel kuralları ve prensipleri içerir.

## Build İşlemi Kuralı

### Önemli Not: Build İşlemlerini AI Yapmaz

**KURAL:** AI asistanı build işlemleri yapmaz. Build işlemleri tamamen geliştirici tarafından manuel olarak gerçekleştirilir.

#### Neden Bu Kural Var?

1. **Build Süreçleri Zaman Alıcı:** Build işlemleri genellikle uzun sürer ve terminali bloklar.
2. **Hata Ayıklama Gerektirir:** Build hataları genellikle manuel müdahale ve geliştirici kararları gerektirir.
3. **Kaynak Tüketimi:** Build işlemleri sistem kaynaklarını yoğun kullanır.
4. **Geliştirici Kontrolü:** Build işlemi sonrası test ve doğrulama geliştirici tarafından yapılmalıdır.

#### AI Asistanın Rolü

AI asistan şunları yapar:
- ✅ **Kod yazımı ve düzenleme**
- ✅ **Hata analizi ve çözüm önerileri**
- ✅ **Konfigürasyon dosyalarını güncelleme**
- ✅ **Dokümantasyon oluşturma**
- ✅ **Kod inceleme ve iyileştirme önerileri**

AI asistan şunları yapmaz:
- ❌ **Build komutları çalıştırma** (`npx expo run:android`, `npm run build` vb.)
- ❌ **Uzun süren build işlemlerini başlatma**
- ❌ **Build sonrası uygulamayı çalıştırma**

#### Build İşlemleri Nasıl Yapılır?

Build işlemleri geliştirici tarafından terminal üzerinden manuel olarak gerçekleştirilir:

```bash
# Örnek build komutları (Geliştirici tarafından çalıştırılır)
cd mobile/mobil_github/frontend
npx expo prebuild --clean
npx expo run:android
```

#### İstisnalar

Bazı durumlarda AI asistan build komutları çalıştırabilir:
- ✅ **Hızlı kontrol komutları** (örn: `npm install`, `npm list`)
- ✅ **Test komutları** (kısa süren unit testler)
- ✅ **Linter kontrolü** (`npm run lint`)
- ✅ **Format kontrolü** (`npm run format`)

Ancak asla uzun süren build ve run işlemleri yapılmaz.

## Mapbox SDK Kurulumu

### Token Yönetimi

Mapbox SDK kullanımı için iki farklı token gerekir:

1. **Downloads Token (sk. ile başlar)**
   - Konum: `android/gradle.properties`
   - Değişken: `MAPBOX_DOWNLOADS_TOKEN`
   - Kullanım: Android SDK'nın indirilmesi için gerekli
   - Token eklendikten sonra `npx expo prebuild --clean` çalıştırılmalı

2. **Public Access Token (pk. ile başlar)**
   - Konum: `config/mapbox.ts`
   - Değişken: `MAPBOX_ACCESS_TOKEN`
   - Kullanım: Harita görüntüleme için gerekli
   - Runtime'da harita görüntülemek için kullanılır

### Build Süreci

Mapbox SDK kullanımı için:

1. Downloads token'ı `android/gradle.properties` dosyasına ekleyin
2. Public access token'ı `config/mapbox.ts` dosyasına ekleyin
3. **Build işlemini geliştirici yapar:**
   ```bash
   npx expo prebuild --clean
   npx expo run:android
   ```

## Dokümantasyon Kuralı

### Doküman Konumu

Her doküman kendi proje klasöründe ilgili yerde oluşturulur:
- Mobil proje dokümanları: `mobile/mobil_github/frontend/docs/`
- Backend dokümanları: `myapp/static/docs/backend/`
- Frontend dokümanları: `myapp/static/docs/frontend/`

### Doküman Güncelleme

- Değişiklik olduğunda ilgili doküman güncellenir
- Eski içerik tamamen silinir, yeni içerik yazılır
- "Değişim", "Yenilik" gibi başlıklar eklenmez
- Doküman her zaman güncel durumu yansıtır

## Kod Geliştirme Kuralları

### Dosya Yapısı

- Her bileşen kendi klasöründe (`app/components/`)
- Config dosyaları `config/` klasöründe
- Dokümanlar `docs/` klasöründe

### TypeScript/React Native

- TypeScript kullanılır
- React Native bileşenleri functional component olarak yazılır
- Expo Router kullanılır (file-based routing)

### Modüler Yapı

- Her özellik bağımsız ve izole olmalı
- Ortak kullanım yerine bağımsız yapı tercih edilir
- Bir yapı başka dosyaya taşındığında eski dosya ile bağ kesilir

## Referanslar

- Ana mimari dokümantasyon: `myapp/static/docs/architecture.md`
- Mapbox kurulum rehberi: `MAPBOX_SETUP.md`
- Çizim karşılaştırması: `DRAWING_COMPARISON.md`

