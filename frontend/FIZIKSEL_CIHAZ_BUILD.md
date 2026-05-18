# Fiziksel Cihazda Build Rehberi

## 📱 Android Cihazda Build

### 1. Telefonu Hazırlama

#### Adım 1: Geliştirici Seçeneklerini Açın
1. **Ayarlar** → **Telefon Hakkında** (veya **Cihaz Hakkında**)
2. **Yapı Numarası**'na **7 kez** tıklayın
3. "Geliştirici oldunuz!" mesajı görünecek

#### Adım 2: USB Hata Ayıklamayı Açın
1. **Ayarlar** → **Geliştirici Seçenekleri**
2. **USB Hata Ayıklama**'yı **AÇIN**
3. Uyarıyı onaylayın

#### Adım 3: Telefonu USB ile Bağlayın
1. Telefonu USB kablosu ile bilgisayara bağlayın
2. Telefonda "USB Hata Ayıklamaya İzin Ver" uyarısı çıkacak
3. **"Bu bilgisayara her zaman izin ver"** kutusunu işaretleyin
4. **İzin Ver**'e tıklayın

### 2. Bağlantıyı Kontrol Etme

```powershell
# ADB yolu (genellikle)
C:\Android\Sdk\platform-tools\adb.exe devices
```

**Beklenen Çıktı:**
```
List of devices attached
ABC123XYZ    device
```

Eğer `unauthorized` görünüyorsa:
- Telefonda USB hata ayıklama iznini tekrar onaylayın
- USB kablosunu çıkarıp tekrar takın

### 3. Port Forwarding (Metro Bundler için)

```powershell
C:\Android\Sdk\platform-tools\adb.exe reverse tcp:8081 tcp:8081
```

Kontrol etmek için:
```powershell
C:\Android\Sdk\platform-tools\adb.exe reverse --list
```

### 4. Build ve Çalıştırma

#### Yöntem 1: Tek Komutla (Önerilen)
```powershell
cd c:\ProParcel\mobile\mobil_github\frontend
npm run android
```

Bu komut:
- Metro bundler'ı başlatır
- Android uygulamasını build eder
- Telefona yükler
- Uygulamayı başlatır

#### Yöntem 2: Adım Adım

**Terminal 1 - Metro Bundler:**
```powershell
cd c:\ProParcel\mobile\mobil_github\frontend
npm start
```

**Terminal 2 - Build ve Yükleme:**
```powershell
cd c:\ProParcel\mobile\mobil_github\frontend
npm run android
```

### 5. Release Build (Production)

APK oluşturmak için:
```powershell
cd c:\ProParcel\mobile\mobil_github\frontend
npm run build:apk
```

APK dosyası şurada olacak:
```
android\app\build\outputs\apk\release\app-release.apk
```

---

## 🍎 iOS Cihazda Build

⚠️ **ÖNEMLİ:** iOS build için **macOS** ve **Xcode** gereklidir. Windows'ta iOS build yapılamaz.

### 1. macOS'ta iOS Build

#### Gereksinimler:
- macOS (en az macOS 12.0)
- Xcode (App Store'dan)
- CocoaPods
- Apple Developer hesabı (gerçek cihaz için)

#### Adım 1: CocoaPods Kurulumu
```bash
sudo gem install cocoapods
```

#### Adım 2: iOS Bağımlılıklarını Yükle
```bash
cd c:\ProParcel\mobile\mobil_github\frontend\ios
pod install
cd ..
```

#### Adım 3: Telefonu Hazırlama
1. iPhone'u USB ile Mac'e bağlayın
2. iPhone'da: **Ayarlar** → **Gizlilik ve Güvenlik** → **Developer Mode**'u açın
3. iPhone'u yeniden başlatın

#### Adım 4: Xcode'da Yapılandırma
1. Xcode'u açın
2. **Xcode** → **Preferences** → **Accounts**
3. Apple ID'nizi ekleyin
4. **Signing & Capabilities** sekmesinde:
   - **Team** seçin
   - **Bundle Identifier** ayarlayın (örn: `com.proparcel.app`)

#### Adım 5: Build ve Çalıştırma
```bash
cd c:\ProParcel\mobile\mobil_github\frontend
npx react-native run-ios --device
```

Veya Xcode'dan:
1. `ios/ProParcel.xcworkspace` dosyasını Xcode'da açın
2. Üst kısımdan cihazınızı seçin
3. **▶ Play** butonuna tıklayın

### 2. Windows'ta iOS Build (EAS Build - Cloud)

Windows'ta iOS build yapmak için **EAS Build** kullanabilirsiniz:

```bash
# EAS CLI kur
npm install -g eas-cli

# Expo hesabına giriş
eas login

# iOS build başlat
cd c:\ProParcel\mobile\mobil_github\frontend
eas build --platform ios --profile development
```

Detaylar için: `mobile/doc/build/ios_build_rehberi.md`

---

## 🔧 Sorun Giderme

### Android: "No devices found"

**Çözüm 1: ADB Server'ı Yeniden Başlat**
```powershell
C:\Android\Sdk\platform-tools\adb.exe kill-server
C:\Android\Sdk\platform-tools\adb.exe start-server
C:\Android\Sdk\platform-tools\adb.exe devices
```

**Çözüm 2: USB Sürücüleri**
- Samsung: Samsung USB Drivers
- Xiaomi: Mi USB Drivers
- Genel: Universal ADB Drivers

**Çözüm 3: USB Kablosu**
- Farklı bir USB kablosu deneyin
- Farklı bir USB portu deneyin
- "Sadece şarj" modunda olabilir, "Dosya aktarımı" moduna geçin

### Android: "Unable to load script"

**Çözüm:**
```powershell
# Port forwarding
C:\Android\Sdk\platform-tools\adb.exe reverse tcp:8081 tcp:8081

# Metro'yu temiz başlat
cd c:\ProParcel\mobile\mobil_github\frontend
npm start -- --reset-cache
```

### iOS: "No code signing identities found"

**Çözüm:**
1. Xcode → Preferences → Accounts
2. Apple ID ekleyin
3. Team seçin
4. Xcode'da "Automatically manage signing" işaretleyin

### iOS: "Device not found"

**Çözüm:**
1. iPhone'u yeniden bağlayın
2. iPhone'da "Bu bilgisayara güven" uyarısını onaylayın
3. Xcode → Window → Devices and Simulators'da cihazı görüyor musunuz kontrol edin

---

## 🚀 Hızlı Komutlar

### Android
```powershell
# Cihaz kontrolü
adb devices

# Port forwarding
adb reverse tcp:8081 tcp:8081

# Build ve çalıştır
cd c:\ProParcel\mobile\mobil_github\frontend
npm run android

# Release APK
npm run build:apk
```

### iOS (macOS)
```bash
# Pod install
cd ios && pod install && cd ..

# Build ve çalıştır
npx react-native run-ios --device

# Xcode'da aç
open ios/ProParcel.xcworkspace
```

---

## 📝 Checklist

### Android
- [ ] USB Hata Ayıklama açık
- [ ] Telefon USB ile bağlı
- [ ] `adb devices` telefonu görüyor
- [ ] Port forwarding yapıldı (`adb reverse tcp:8081 tcp:8081`)
- [ ] Metro bundler çalışıyor
- [ ] Backend çalışıyor (gerekirse)

### iOS
- [ ] macOS ve Xcode kurulu
- [ ] CocoaPods kurulu
- [ ] `pod install` çalıştırıldı
- [ ] Apple Developer hesabı eklendi (Xcode'da)
- [ ] iPhone USB ile bağlı
- [ ] "Bu bilgisayara güven" onaylandı
- [ ] Developer Mode açık (iPhone'da)

---

## 🔗 İlgili Dosyalar

- `ANDROID_CIHAZ_COZUM.md` - Android cihaz sorunları
- `METRO_CONNECTION_TROUBLESHOOTING.md` - Metro bağlantı sorunları
- `mobile/doc/build/ios_build_rehberi.md` - iOS build detayları
- `mobile/doc/build/apk_build_ve_sunucu.md` - APK build rehberi
