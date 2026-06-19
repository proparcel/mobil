# ProParcel Mobil Uygulama - Sunucu Kurulum Rehberi

Bu doküman, ProParcel mobil uygulamasını sunucuya kurmak için gereken tüm adımları içerir.

## Kisa Ozet

- Kurulum sirasinda once Node.js ve Yarn dogrulanir.
- Mobil frontend bagimliliklari `frontend` altinda kurulur.
- Ortam degiskenleri duzgun tanimlanmadan baglanti testine gecilmez.
- Ag ve erisim problemleri icin `sunucu_erisim_sorunlari.md` ve `port_forwarding_rehberi.md` birlikte kontrol edilir.

## 📋 Gereksinimler

### Temel Araçlar

1. **Node.js (LTS sürümü - önerilen: 18.x veya 20.x)**
   ```bash
   # Node.js versiyonunu kontrol et
   node --version
   # v18.x.x veya v20.x.x olmalı
   ```

2. **Yarn Package Manager**
   - Proje Yarn kullanıyor (npm değil)
   - Node.js ile birlikte gelmez, ayrı kurulmalı

3. **Expo CLI**
   - Expo projelerini yönetmek için

4. **Metro Bundler**
   - Expo/React Native ile birlikte gelir, ayrı kurulum gerekmez
   - `app.config.js`'de `bundler: "metro"` olarak tanımlı

## 🔧 Kurulum Adımları

### 1. Node.js Kurulumu

**Windows (Anaconda ortamında):**
```powershell
# Node.js yoksa, Anaconda Navigator üzerinden conda-forge channel'dan kur:
conda install -c conda-forge nodejs

# Veya direkt:
conda install nodejs

# Versiyon kontrolü:
node --version
npm --version
```

**Linux/Debian/Ubuntu:**
```bash
# NodeSource repository ekle (LTS sürümü için)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Node.js kur
sudo apt-get install -y nodejs

# Versiyon kontrolü:
node --version
npm --version
```

### 2. Yarn Kurulumu

**Windows (npm ile):**
```powershell
npm install -g yarn
```

**Linux/Debian/Ubuntu:**
```bash
# npm ile:
npm install -g yarn

# Veya repository'den:
curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
sudo apt update
sudo apt install yarn
```

**Yarn versiyon kontrolü:**
```bash
yarn --version
# 1.22.22 veya üzeri olmalı
```

### 3. Expo CLI Kurulumu

```bash
# Global olarak Expo CLI kur (önerilen)
npm install -g expo-cli

# Veya npx ile kullan (kurulum gerektirmez)
npx expo --version
```

### 4. Proje Bağımlılıklarını Kurma

```bash
# Proje dizinine git
cd c:\ProParcel\mobile\mobil_github\frontend

# Yarn ile bağımlılıkları kur
yarn install

# VEYA npm ile (yarn yoksa):
# npm install
```

**Önemli Notlar:**
- Proje `package.json`'da `packageManager: "yarn@1.22.22"` tanımlı, Yarn kullanılması önerilir
- İlk kurulum 5-10 dakika sürebilir (node_modules klasörü ~500MB)
- Kurulum sırasında native modüller için gerekli toolchain'ler otomatik kurulur

### 5. Ortam Değişkenlerini Ayarlama

`.env` dosyası oluştur veya mevcut dosyayı düzenle:

```bash
cd c:\ProParcel\mobile\mobil_github\frontend

# .env dosyası oluştur
# Windows PowerShell:
New-Item -Path .env -ItemType File

# Linux:
touch .env
```

`.env` dosyasına ekle:
```env
# Backend API URL (sunucu IP ve port)
EXPO_PUBLIC_API_URL=http://YOUR_SERVER_IP:8001

# Model dosyaları için URL (genellikle aynı backend)
EXPO_PUBLIC_MODELS_URL=http://YOUR_SERVER_IP:8001

# Mapbox Downloads Token (opsiyonel, @rnmapbox/maps için)
MAPBOX_DOWNLOADS_TOKEN=your_mapbox_token_here
RNMAPBOX_MAPS_DOWNLOAD_TOKEN=your_mapbox_token_here
```

**Örnek (sunucu IP 78.186.188.162 ise):**
```env
EXPO_PUBLIC_API_URL=http://78.186.188.162:8001
EXPO_PUBLIC_MODELS_URL=http://78.186.188.162:8001
```

### 6. Metro Bundler ve Development Server'ı Başlatma

**Development Build (Dev Client) için:**
```bash
cd c:\ProParcel\mobile\mobil_github\frontend

# Expo development server başlat (Metro bundler otomatik çalışır)
npx expo start --dev-client

# VEYA package.json script'i ile:
yarn start
```

**Normal Expo Server (Expo Go ile test için - native modüller çalışmaz):**
```bash
npx expo start
```

## 🚀 Production Build (APK/iOS)

### Android APK Build

**Development Build:**
```bash
cd c:\ProParcel\mobile\mobil_github\frontend

# Android development build
npx expo run:android

# Release variant
npx expo run:android --variant release
```

**Standalone APK:**
```bash
# Expo Application Services (EAS) ile:
npx eas build --platform android --profile preview

# Veya lokal build:
cd android
./gradlew assembleRelease  # Linux
gradlew.bat assembleRelease  # Windows
```

### iOS Build

```bash
# EAS ile:
npx eas build --platform ios --profile preview

# Veya lokal (macOS gerekli):
npx expo run:ios
```

## 📦 Metro Bundler Nedir?

**Metro**, React Native ve Expo projeleri için JavaScript bundler'dır. Özellikleri:

- JavaScript/TypeScript dosyalarını birleştirir
- Asset'leri (resimler, fontlar) optimize eder
- Hot reload / Fast Refresh desteği
- Expo ile birlikte gelir, ayrı kurulum gerekmez
- `app.config.js`'de `bundler: "metro"` olarak tanımlı

Metro otomatik olarak `expo start` veya `yarn start` komutu ile başlar.

## 🔍 Sorun Giderme

### Metro Bundler Başlamıyor

```bash
# Cache'i temizle
npx expo start --clear

# Yarn cache'i temizle
yarn cache clean

# node_modules'ü sil ve yeniden kur
rm -rf node_modules  # Linux/Mac
rmdir /s /q node_modules  # Windows
yarn install
```

### Native Modül Hataları

Proje Mapbox gibi native modüller içerir. Expo Go ile çalışmaz, **development build** gerekir:

```bash
# Development build oluştur
npx expo run:android
# veya
npx expo run:ios
```

### Port Çakışması

Metro varsayılan olarak **8081** portunu kullanır:

```bash
# Farklı port ile başlat
npx expo start --port 8082
```

### Network Connection Sorunları

Sunucuda firewall'u kontrol et:
- **8081** portu (Metro bundler) açık olmalı
- **8001** portu (Django backend) açık olmalı

```bash
# Port kontrolü (Linux)
netstat -tulpn | grep 8081
netstat -tulpn | grep 8001

# Windows
netstat -ano | findstr :8081
netstat -ano | findstr :8001
```

## 📝 Özet Komutlar

```bash
# 1. Bağımlılıkları kur
cd c:\ProParcel\mobile\mobil_github\frontend
yarn install

# 2. Ortam değişkenlerini ayarla (.env dosyası)

# 3. Development server başlat (Metro otomatik başlar)
yarn start
# veya
npx expo start --dev-client

# 4. Android build (telefona yükle)
npx expo run:android
```

## 🔗 İlgili Dokümanlar

- `docs/guides/expo_test_rehberi.md` - Test rehberi
- `docs/build/apk_build_ve_sunucu.md` - APK build rehberi
- `docs/guides/sunucu_erisim_sorunlari.md` - Network sorunları
- `frontend/package.json` - Tüm bağımlılıklar
