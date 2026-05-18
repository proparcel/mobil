# Android Cihaz/Emülatör Sorunu Çözümü

## Sorun
```
CommandError: No Android connected device found, and no emulators could be started automatically.
```

## Çözüm 1: Android Emülatör Başlatma (Önerilen)

### Adım 1: Android Studio'yu Açın
1. Android Studio'yu açın
2. **More Actions** → **Virtual Device Manager** (veya **Tools** → **Device Manager**)

### Adım 2: Emülatör Oluştur/Başlat
1. Mevcut bir emülatör varsa **▶ Play** butonuna tıklayın
2. Yoksa **Create Device** → Bir cihaz seçin (örn: Pixel 5) → **Next** → Sistem görüntüsü seçin → **Finish**

### Adım 3: Emülatörün Başladığını Kontrol Edin
```cmd
adb devices
```
Listede emülatör görünmeli (örn: `emulator-5554`)

### Adım 4: Uygulamayı Çalıştırın
```cmd
cd c:\ProParcel\mobile\mobil_github\frontend
npm run android
```

## Çözüm 2: USB ile Fiziksel Cihaz Bağlama

### Adım 1: Telefonu Hazırlayın
1. **Ayarlar** → **Telefon Hakkında** → **Yapı Numarası**'na 7 kez tıklayın (Geliştirici seçenekleri açılır)
2. **Ayarlar** → **Geliştirici Seçenekleri** → **USB Hata Ayıklama**'yı açın

### Adım 2: USB ile Bağlayın
1. Telefonu USB ile bilgisayara bağlayın
2. Telefonda "USB Hata Ayıklamaya İzin Ver" uyarısını **İzin Ver**'e tıklayın

### Adım 3: Bağlantıyı Kontrol Edin
```cmd
adb devices
```
Telefonunuz listede görünmeli (örn: `ABC123XYZ device`)

### Adım 4: Uygulamayı Çalıştırın
```cmd
cd c:\ProParcel\mobile\mobil_github\frontend
npm run android
```

## Çözüm 3: Emülatörü Komut Satırından Başlatma

### Android Studio SDK Yolu Bulma
```cmd
# Genellikle:
C:\Users\%USERNAME%\AppData\Local\Android\Sdk\emulator\emulator.exe
```

### Emülatör Listesi
```cmd
cd C:\Users\%USERNAME%\AppData\Local\Android\Sdk\emulator
emulator -list-avds
```

### Emülatör Başlatma
```cmd
emulator -avd <EMULATOR_NAME>
```

## Hızlı Kontrol Komutları

```cmd
# Cihazları listele
adb devices

# ADB server'ı yeniden başlat
adb kill-server
adb start-server

# Emülatör kontrolü
adb devices
```

## "Network request failed" – Android gerçek cihaz + Django 0.0.0.0:8000

Django `http://0.0.0.0:8000/` ile çalışıyorsa, **telefon 0.0.0.0 adresine bağlanamaz**. Telefon ve bilgisayar **aynı WiFi**’de olmalı; uygulama **bilgisayarın yerel IP’si**ni kullanmalı.

### Adımlar

1. **Bilgisayarın yerel IP’sini bulun** (WiFi ağınızda):
   ```cmd
   ipconfig
   ```
   **IPv4 Address** satırına bakın (örn: `192.168.1.101`). **Wireless LAN** veya **Ethernet** bölümündeki adres kullanılır.

2. **Proje kökünde `.env` dosyası oluşturun veya düzenleyin** (`mobile/mobil_github/frontend/.env`):
   ```
   API_URL=http://192.168.1.101:8000
   ```
   `192.168.1.101` yerine kendi IP’nizi yazın (sonunda **:8000** kalsın).

3. **Metro’yu yeniden başlatın** (env değişince gerekir):
   ```cmd
   cd c:\ProParcel\mobile\mobil_github\frontend
   npm run android
   ```
   veya Metro’yu durdurup tekrar `npm start` / `npx expo start` çalıştırın.

4. **Django’nun dışarıdan erişime açık olduğundan emin olun**: `runserver 0.0.0.0:8000` kullanıyorsanız bu adım tamam. Windows Firewall 8000 portunu engelliyorsa izin verin.

---

## Sorun Giderme

### "adb: command not found"
**Çözüm:** Android SDK Platform Tools'u PATH'e ekleyin:
```cmd
# Genellikle:
C:\Users\%USERNAME%\AppData\Local\Android\Sdk\platform-tools
```

### "unauthorized" görünüyorsa
**Çözüm:** Telefonda USB hata ayıklama iznini onaylayın

### Emülatör başlamıyor
**Çözüm:** 
- Android Studio'yu yeniden başlatın
- Emülatörü Android Studio'dan başlatın (komut satırı yerine)

### Hala cihaz bulunamıyor
**Çözüm:**
```cmd
adb kill-server
adb start-server
adb devices
```

## Önerilen Workflow

1. **Android Studio'yu açın**
2. **Virtual Device Manager'dan emülatör başlatın** (veya USB ile telefon bağlayın)
3. **Kontrol edin:** `adb devices`
4. **Uygulamayı çalıştırın:** `npm run android`
