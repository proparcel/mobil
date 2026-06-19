# Metro Bundler Bağlantı Sorunu Çözümü (Türkçe)

## 🔴 Sorun: "No apps connected"

Metro bundler çalışıyor ama telefon bağlanmıyor.

## ✅ Hızlı Çözüm

### 1. Uygulamayı Yeniden Yükle

**Otomatik (Script):**
```cmd
reload_app.bat
```

**Manuel:**
- Telefonu sallayın → Dev Menu açılır → "Reload" seçin
- VEYA uygulamada `R` tuşuna 2 kez basın

### 2. Uygulamayı Yeniden Başlat

```cmd
REM Uygulamayı kapat
adb shell am force-stop com.anonymous.frontend

REM Uygulamayı aç
adb shell am start -n com.anonymous.frontend/.MainActivity
```

### 3. Metro'yu Yeniden Başlat

```cmd
REM Metro'yu durdur (Ctrl+C)
REM Sonra tekrar başlat:
start_metro_clean.bat
```

## 📋 Adım Adım Kontrol Listesi

### ✅ Cihaz Bağlantısı
```cmd
adb devices
```
**Beklenen:** `RFCY31ZF7RP    device`

### ✅ Port Forwarding
```cmd
adb reverse --list
```
**Beklenen:** `tcp:8081 tcp:8081`

### ✅ Metro Bundler
- Metro penceresinde "Dev server ready" mesajı görünmeli
- Port 8081'de dinliyor olmalı

### ✅ Uygulama Durumu
- Uygulama telefonda çalışıyor olmalı
- Uygulama açık ve görünür olmalı

## 🔧 Yaygın Sorunlar ve Çözümleri

### Sorun 1: Uygulama Metro'ya bağlanmıyor

**Çözüm:**
1. Uygulamayı tamamen kapatın (arka plandan da)
2. Metro'yu yeniden başlatın: `start_metro_clean.bat`
3. Uygulamayı tekrar açın
4. Telefonu sallayın ve "Reload" seçin

### Sorun 2: "Unable to load script" hatası

**Çözüm:**
```cmd
REM Port forwarding'i yeniden kur
adb reverse tcp:8081 tcp:8081

REM Metro cache'i temizle ve başlat
npm start -- --reset-cache
```

### Sorun 3: Port 8081 kullanımda

**Çözüm:**
```cmd
REM Port'u kullanan process'i bul ve kapat
for /f "tokens=5" %a in ('netstat -ano ^| findstr :8081 ^| findstr LISTENING') do taskkill /F /PID %a

REM Sonra Metro'yu başlat
start_metro_clean.bat
```

### Sorun 4: Wi-Fi Bağlantısı (USB çalışmıyorsa)

**Adımlar:**
1. Bilgisayarınızın IP adresini bulun:
   ```cmd
   ipconfig | findstr IPv4
   ```
   Örnek: `192.168.1.100`

2. Cihaz ve bilgisayar aynı Wi-Fi ağında olmalı

3. Metro penceresinde:
   - `d` tuşuna basın (Dev Menu)
   - "Settings" seçin
   - "Debug server host & port for device" seçin
   - IP adresini girin: `192.168.1.100:8081`

4. Uygulamayı yeniden yükleyin

## 🚀 Hızlı Komutlar

```cmd
REM Cihazları listele
adb devices

REM Port forwarding kur
adb reverse tcp:8081 tcp:8081

REM Port forwarding kontrol et
adb reverse --list

REM Uygulamayı yeniden yükle (R tuşu)
adb shell input text "RR"

REM Uygulamayı kapat
adb shell am force-stop com.anonymous.frontend

REM Uygulamayı aç
adb shell am start -n com.anonymous.frontend/.MainActivity

REM Metro'yu temiz başlat
start_metro_clean.bat

REM Uygulamayı yeniden yükle (script)
reload_app.bat
```

## 📱 Telefon Üzerinde Yapılacaklar

1. **USB Hata Ayıklama Açık mı?**
   - Ayarlar → Geliştirici Seçenekleri → USB Hata Ayıklama ✅

2. **Uygulama Çalışıyor mu?**
   - Uygulamayı açın ve çalıştığından emin olun

3. **Dev Menu'ye Erişim**
   - Telefonu sallayın VEYA
   - `adb shell input keyevent 82` (Menu tuşu)

4. **Manuel Reload**
   - Dev Menu → "Reload" seçin

## 🔍 Debug İpuçları

### Metro Loglarını Kontrol Et
Metro penceresinde hata mesajları var mı bakın.

### ADB Loglarını Kontrol Et
```cmd
adb logcat | findstr ReactNative
```

### Port Durumunu Kontrol Et
```cmd
netstat -ano | findstr :8081
```

### Metro Bağlantısını Test Et
Tarayıcıda açın: `http://localhost:8081/status`
- "packager-status": "running" görünmeli

## ✅ Başarı Kriterleri

Metro bağlantısı başarılı olduğunda:
- ✅ Metro penceresinde "Reloading connected app(s)..." görünür
- ✅ Uygulama telefonda yeniden yüklenir
- ✅ "No apps connected" uyarısı kaybolur
- ✅ Metro loglarında bundle işlemleri görünür

## 📞 Hala Çalışmıyor mu?

1. **Her şeyi yeniden başlat:**
   ```cmd
   REM ADB'yi yeniden başlat
   adb kill-server
   adb start-server
   
   REM Metro'yu temiz başlat
   start_metro_clean.bat
   
   REM Uygulamayı yeniden yükle
   reload_app.bat
   ```

2. **Cache'leri temizle:**
   ```cmd
   REM Metro cache
   rmdir /s /q .metro-cache
   
   REM Node modules cache
   rmdir /s /q node_modules\.cache
   
   REM Android build cache
   rmdir /s /q android\app\build
   
   REM Sonra Metro'yu başlat
   npm start -- --reset-cache
   ```

3. **USB kablosunu değiştir:**
   - Bazı kablolar sadece şarj için çalışır
   - Veri aktarımı yapabilen bir kablo kullanın

4. **USB portunu değiştir:**
   - Farklı bir USB portu deneyin
