# Expo ile Test Rehberi

## ÖNEMLİ: Expo Go Çalışmaz!

Bu uygulama **Mapbox** gibi native modüller içerdiği için standart **Expo Go** uygulaması ile çalışmaz. Development build (dev client) kullanmanız gerekir.

## Yöntem 1: USB ile Direkt Yükleme (Önerilen)

Bu yöntem development build'i direkt telefona yükler ve test eder.

### Adımlar:

1. **Telefonunuzu Hazırlayın:**
   - USB Hata Ayıklama açık olmalı
   - Telefonu USB ile bilgisayara bağlayın
   - "USB Hata Ayıklamaya İzin Ver" uyarısını onaylayın

2. **Telefonu Kontrol Edin:**
   ```bash
   adb devices
   ```
   Telefonunuz listede görünmelidir.

3. **Development Build'i Yükleyin ve Test Edin:**
   ```bash
   cd c:\ProParcel\mobile\mobil_github\frontend
   npx expo run:android
   ```
   
   Bu komut:
   - Native kodları derler
   - Development build APK oluşturur
   - Telefonunuza yükler
   - Uygulamayı başlatır
   - Expo development server'ı başlatır

4. **Kod Değişikliklerini Test Edin:**
   - Kodda değişiklik yaptığınızda otomatik reload olur
   - Veya `r` tuşuna basarak reload edebilirsiniz

## Yöntem 2: Önce Build, Sonra Dev Server

Eğer uygulama zaten yüklüyse:

1. **Expo Development Server'ı Başlatın:**
   ```bash
   cd c:\ProParcel\mobile\mobil_github\frontend
   npx expo start --dev-client
   ```

2. **Telefonda Uygulamayı Açın:**
   - Yüklü uygulamayı açın
   - Otomatik olarak development server'a bağlanacak

## Yöntem 3: Batch Dosyası ile (Kolay)

```bash
cd c:\ProParcel\mobile\mobil_github\frontend
test_dev_build.bat
```

## Test Checklist

- [ ] USB Hata Ayıklama açık
- [ ] Telefon USB ile bağlı
- [ ] `adb devices` telefonu görüyor
- [ ] Backend çalışıyor (Django + FastAPI)
- [ ] `.env` dosyası doğru: `EXPO_PUBLIC_API_URL=http://78.189.238.18:8001`

## Kod Değişikliklerini Test Etme

### Hot Reload

Kodda değişiklik yaptığınızda:
- Otomatik reload olur (Fast Refresh)
- Veya terminalde `r` tuşuna basın

### Full Reload

```bash
# Terminal'de:
r  # Reload
m  # Menü
```

## Network Testi

### 1. Backend Kontrolü

Terminal'de şunu çalıştırın:
```bash
curl http://78.189.238.18:8001/api/
```

Veya tarayıcıdan:
```
http://78.189.238.18:8001/api/
```

### 2. Uygulamada Test

- Ada/Parsel sorgusu yapın
- Console loglarını kontrol edin (terminalde görünecek)
- Hata mesajlarını kontrol edin

### 3. Logcat ile Detaylı Loglar

Başka bir terminal açın:
```bash
adb logcat | findstr "ReactNativeJS"
```

Veya tüm loglar:
```bash
adb logcat
```

## Sorun Giderme

### "No Android device found"

**Çözüm:**
- Telefonu USB ile bağlayın
- USB Hata Ayıklama açık mı kontrol edin
- `adb devices` ile telefonu görüyor musunuz kontrol edin

### "Metro bundler connection failed"

**Çözüm:**
- Aynı WiFi ağında olmalısınız
- Veya `adb reverse` kullanın:
  ```bash
  adb reverse tcp:8081 tcp:8081
  ```

### Network hatası devam ediyor

**Kontrol:**
1. Backend çalışıyor mu?
2. `.env` dosyası doğru mu?
3. Console loglarında hangi URL kullanılıyor?

### Uygulama açılıyor ama bağlanamıyor

**Çözüm:**
- Expo development server çalışıyor mu?
- Terminal'de `npx expo start --dev-client` çalıştırın
- Telefonda uygulamayı yeniden açın

## Development vs Production Build

- **Development Build**: Hot reload, debug modunda, daha yavaş
- **Production Build (APK)**: Optimize edilmiş, release modunda, daha hızlı

Test için development build kullanın, son kullanıcı için production APK build edin.

## Hızlı Başlangıç

```bash
# 1. Telefonu USB ile bağla
# 2. Kontrol et
adb devices

# 3. Development build'i yükle ve test et
cd c:\ProParcel\mobile\mobil_github\frontend
npx expo run:android

# 4. Kod değişikliklerinde otomatik reload olacak
# 5. Network testi yap (Ada/Parsel sorgusu)
```

## Önemli Notlar

⚠️ **Development build ilk seferde 5-10 dakika sürebilir**

⚠️ **Her kod değişikliğinde yeniden build GEREKMEZ** - Hot reload çalışır

⚠️ **Environment variable değişiklikleri için yeniden build gerekir**

⚠️ **Native kod değişiklikleri (AndroidManifest.xml, etc.) için yeniden build gerekir**
