# ADB ve Emulator Sorunu Çözümü

## 🔴 Sorun

React Native CLI şu hataları veriyordu:
```
'"C:\Android\Sdk\platform-tools\adb"' is not recognized as an internal or external command
error Failed to launch emulator. Reason: No emulators found
```

## ✅ Çözüm

### 1. ADB Eksikliği

**Sorun:** `C:\Android\Sdk\platform-tools\adb.exe` dosyası yoktu.

**Çözüm:** Unity SDK'daki ADB kopyalandı:
```powershell
Copy-Item "C:\Program Files\Unity\Hub\Editor\2022.3.62f1\Editor\Data\PlaybackEngines\AndroidPlayer\SDK\platform-tools\*" -Destination "C:\Android\Sdk\platform-tools\" -Recurse -Force
```

**Doğrulama:**
```powershell
& "C:\Android\Sdk\platform-tools\adb.exe" devices
# Çıktı: RFCY31ZF7RP	device (telefon bağlı)
```

### 2. Emulator Uyarısı

**Durum:** Emulator bulunamadı uyarısı alınıyor ama bu sorun değil çünkü:
- ✅ Telefon USB ile bağlı (`RFCY31ZF7RP device`)
- ✅ React Native CLI telefonu kullanabilir
- ✅ Emulator gerekli değil (fiziksel cihaz var)

**Not:** Eğer emulator kullanmak isterseniz:
1. Android Studio → Device Manager → Emulator oluşturun/başlatın
2. Veya komut satırından:
   ```cmd
   C:\Android\Sdk\emulator\emulator.exe -list-avds
   C:\Android\Sdk\emulator\emulator.exe -avd <AVD_NAME>
   ```

## 🎯 Sonuç

- ✅ ADB `C:\Android\Sdk\platform-tools\adb.exe` konumunda
- ✅ Telefon bağlı ve görünüyor (`RFCY31ZF7RP device`)
- ✅ React Native CLI artık ADB'yi bulabilir
- ✅ `npm run android` komutu çalışmalı

## 📝 Notlar

1. **Kalıcı Çözüm:** Android SDK Platform-tools'u Android Studio'dan düzgün kurmak daha iyi olur, ama şu anki çözüm de çalışıyor.

2. **Telefon Bağlantısı:**
   - USB Hata Ayıklama açık olmalı
   - `adb devices` ile kontrol edin
   - "unauthorized" görünüyorsa telefonda izin verin

3. **Emulator:** Fiziksel cihaz varsa emulator gerekli değil. Uyarıyı görmezden gelebilirsiniz.

## 🧪 Test

```powershell
# 1. ADB kontrolü
& "C:\Android\Sdk\platform-tools\adb.exe" devices

# 2. React Native build
cd c:\ProParcel\mobile\mobil_github\frontend
npm run android
```

Build başarılı olmalı ve uygulama telefona yüklenmeli.
