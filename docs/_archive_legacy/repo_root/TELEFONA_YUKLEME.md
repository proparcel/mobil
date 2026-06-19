# Mobil Uygulamayı Telefona Yükleme Rehberi

Bu uygulama Expo React Native ile geliştirilmiştir ve Mapbox gibi native modüller içerdiği için **Expo Go** uygulaması ile çalışmaz. Development build veya production build yapmanız gerekir.

## Yöntem 1: USB ile Doğrudan Yükleme (Önerilen - Geliştirme İçin)

Bu yöntem, uygulamayı geliştirme sırasında test etmek için en uygun yöntemdir.

### Gereksinimler:
- Android Studio kurulu olmalı
- Android SDK kurulu olmalı
- Telefonunuzda "Geliştirici Seçenekleri" ve "USB Hata Ayıklama" açık olmalı
- USB kablosu ile telefonunuz bilgisayara bağlı olmalı

### Adımlar:

1. **Telefonunuzda Geliştirici Seçeneklerini Açın:**
   - Ayarlar > Telefon Hakkında > Yapı Numarası'na 7 kez dokunun
   - Ayarlar > Sistem > Geliştirici Seçenekleri > USB Hata Ayıklama'yi açın

2. **Telefonunuzu USB ile Bilgisayara Bağlayın:**
   - Telefonunuzda "USB Hata Ayıklamaya İzin Ver" uyarısını onaylayın

3. **Proje Klasörüne Gidin:**
   ```bash
   cd c:\ProParcel\mobile\mobil_github\frontend
   ```

4. **Bağımlılıkları Yükleyin (İlk Sefer İçin):**
   ```bash
   npm install
   # veya
   yarn install
   ```

5. **Telefonunuzun Bağlı Olduğunu Kontrol Edin:**
   ```bash
   adb devices
   ```
   Telefonunuz listede görünmelidir.

6. **Uygulamayı Derleyip Telefona Yükleyin:**
   ```bash
   npx expo run:android
   ```
   
   Bu komut:
   - Native kodları derler
   - APK oluşturur
   - Telefonunuza yükler
   - Uygulamayı başlatır
   
   **Not:** İlk seferde bu işlem 5-10 dakika sürebilir.

7. **Uygulama Yüklendikten Sonra:**
   - Uygulama otomatik olarak açılır
   - Daha sonra değişiklik yaptığınızda, sadece JavaScript kodunu güncellemek için:
     ```bash
     npx expo start --dev-client
     ```

---

## Yöntem 2: APK Oluşturup Manuel Yükleme

Bu yöntem, uygulamayı APK dosyası olarak oluşturup telefonunuza manuel olarak yüklemenizi sağlar.

### Adımlar:

1. **Proje Klasörüne Gidin:**
   ```bash
   cd c:\ProParcel\mobile\mobil_github\frontend
   ```

2. **Bağımlılıkları Yükleyin:**
   ```bash
   npm install
   # veya
   yarn install
   ```

3. **APK Oluşturun:**
   ```bash
   npx expo run:android --variant release
   ```
   
   Veya sadece APK dosyasını oluşturmak için:
   ```bash
   cd android
   ./gradlew assembleRelease
   ```
   
   APK dosyası şu konumda oluşur:
   ```
   android/app/build/outputs/apk/release/app-release.apk
   ```

4. **APK'yı Telefonunuza Aktarın:**
   - APK dosyasını USB ile telefonunuza kopyalayın
   - Veya e-posta/cloud servis ile gönderin

5. **Telefonunuzda Yükleyin:**
   - Dosya yöneticisinde APK dosyasını bulun
   - "Bilinmeyen Kaynaklardan Uygulama Yükleme" iznini verin (gerekirse)
   - APK dosyasına dokunarak yükleyin

---

## Yöntem 3: EAS Build ile Cloud Build (İleri Seviye)

Eğer Expo'nun cloud build servisini kullanmak isterseniz:

1. **EAS CLI'yi Yükleyin:**
   ```bash
   npm install -g eas-cli
   ```

2. **EAS'a Giriş Yapın:**
   ```bash
   eas login
   ```

3. **EAS Build Yapılandırması Oluşturun:**
   ```bash
   eas build:configure
   ```

4. **Android APK Oluşturun:**
   ```bash
   eas build --platform android --profile preview
   ```

5. **Build Tamamlandıktan Sonra:**
   - Expo dashboard'dan APK'yı indirin
   - Telefonunuza yükleyin

---

## Sorun Giderme

### "adb devices" komutu telefonu görmüyor:
- USB kablosunu değiştirin
- Telefonunuzda USB modunu "Dosya Aktarımı" veya "MTP" olarak ayarlayın
- USB sürücülerinin yüklü olduğundan emin olun

### "Mapbox native module not available" hatası:
- `npx expo prebuild` komutunu çalıştırın
- Sonra `npx expo run:android` komutunu tekrar çalıştırın

### Build hatası alıyorsanız:
- Android Studio'yu açın ve SDK'ların güncel olduğundan emin olun
- `npx expo prebuild --clean` komutunu çalıştırın
- `android` klasörünü silip tekrar `npx expo prebuild` çalıştırın

### Gradle build hatası:
- Android Studio'da SDK Manager'dan gerekli SDK'ları yükleyin
- `android/local.properties` dosyasında `sdk.dir` yolunun doğru olduğundan emin olun

---

## iOS için (Mac Gerekli)

Eğer iPhone'unuz varsa ve Mac'iniz varsa:

```bash
npx expo run:ios
```

Bu komut iOS simülatöründe çalıştırır. Fiziksel cihaz için:
- Xcode'da projeyi açın
- Signing & Capabilities'den Apple Developer hesabınızı ekleyin
- Cihazınızı seçip çalıştırın

---

## Önemli Notlar

- İlk build işlemi uzun sürebilir (5-15 dakika)
- İnternet bağlantısı gereklidir (bağımlılıklar indirilir)
- Android Studio'nun kurulu olması gereklidir
- En az 8GB RAM önerilir
