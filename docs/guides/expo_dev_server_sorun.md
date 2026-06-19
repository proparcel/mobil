# Expo Dev Server Port Sorunu Çözümü

## Sorun: Port 8081 Kullanılıyor

Build başarılı ama dev server başlatılamadı çünkü port 8081 kullanılıyor.

## Hızlı Çözümler

### Çözüm 1: Port 8081'i Kullanan Process'i Kapat

1. **Hangi process port 8081'i kullanıyor bulun:**
   ```powershell
   netstat -ano | findstr :8081
   ```
   
   Çıktıda PID numarasını göreceksiniz (son sütun)

2. **Process'i kapatın:**
   ```powershell
   taskkill /PID <PID_NUMARASI> /F
   ```
   
   Örneğin: `taskkill /PID 12345 /F`

3. **Dev server'ı başlatın:**
   ```bash
   cd c:\ProParcel\mobile\mobil_github\frontend
   npx expo start --dev-client
   ```

### Çözüm 2: Farklı Port Kullan (Kolay)

1. **Port 8082 ile dev server başlat:**
   ```bash
   cd c:\ProParcel\mobile\mobil_github\frontend
   npx expo start --dev-client --port 8082
   ```

2. **Telefonda uygulamayı aç:**
   - Uygulama otomatik olarak yeni porta bağlanacak
   - Veya uygulamayı yeniden başlatın

### Çözüm 3: ADB Reverse (USB Bağlantısı İçin)

Telefon USB ile bağlıysa, adb reverse kullanarak port forwarding yapabilirsiniz:

```bash
# Port 8081 için
adb reverse tcp:8081 tcp:8081

# Veya port 8082 kullanıyorsanız
adb reverse tcp:8082 tcp:8082
```

Bu sayede telefon `localhost:8081` adresini bilgisayarınızın `localhost:8081` adresine yönlendirir.

## Şu Anda Ne Yapmalısınız?

### Adım 1: Dev Server'ı Başlatın

**Seçenek A: Port 8082 ile (Önerilen):**
```bash
cd c:\ProParcel\mobile\mobil_github\frontend
npx expo start --dev-client --port 8082
```

**Seçenek B: Port 8081'i kullanan process'i kapatıp 8081 ile:**
```bash
# Önce process'i bulun ve kapatın (yukarıdaki Çözüm 1)
# Sonra:
cd c:\ProParcel\mobile\mobil_github\frontend
npx expo start --dev-client
```

### Adım 2: Telefonda Uygulamayı Açın

- Yüklü uygulamayı açın
- Otomatik olarak dev server'a bağlanacak
- Eğer bağlanamazsa, uygulamayı kapatıp yeniden açın

### Adım 3: Network Testini Yapın

- Ada/Parsel sorgusu yapın
- Terminal'de console loglarını göreceksiniz
- Hata varsa detaylı mesaj görünecek

## Önemli Notlar

✅ **Build başarılı** - APK yüklendi, uygulama telefonunuzda

✅ **Dev server çalışmalı** - Hot reload için gerekli

⚠️ **Port çakışması** - Başka bir Expo/Metro process çalışıyor olabilir

⚠️ **Network testi** - Backend çalışıyor mu kontrol edin (Django + FastAPI)

## Batch Dosyası ile Kolay Başlatma

```bash
cd c:\ProParcel\mobile\mobil_github\frontend
start_dev_server.bat
```

Bu batch dosyası port 8082 ile dev server'ı başlatacak.

## Sorun Devam Ederse

1. **Tüm Node/Expo process'lerini kapatın:**
   - Task Manager'da `node.exe` process'lerini kapatın
   - Veya bilgisayarı yeniden başlatın

2. **Yeniden başlatın:**
   ```bash
   cd c:\ProParcel\mobile\mobil_github\frontend
   npx expo start --dev-client --clear
   ```

3. **ADB reverse ile port forwarding:**
   ```bash
   adb reverse tcp:8081 tcp:8081
   adb reverse tcp:8082 tcp:8082
   ```
