# Metro Bundler "No apps connected" Çözümü

## 🔴 Sorun
Metro bundler çalışıyor, cihaz bağlı, ama Metro uygulamayı görmüyor:
```
warn No apps connected. Sending "reload" to all React Native apps failed.
```

## ✅ Çözüm Adımları

### 1. Uygulamayı Yeniden Başlat (En Etkili)

**Script kullan:**
```cmd
force_connect_metro.bat
```

**Manuel:**
```cmd
REM Uygulamayı kapat
adb shell am force-stop com.anonymous.frontend

REM Port forwarding'i yeniden kur
adb reverse --remove-all
adb reverse tcp:8081 tcp:8081

REM Uygulamayı aç
adb shell am start -n com.anonymous.frontend/.MainActivity
```

### 2. Metro Debug Server Host'u Manuel Ayarla

Bazen uygulama Metro'nun nerede olduğunu bilmiyor. Manuel olarak ayarlayın:

1. **Telefonda:**
   - Uygulamayı açın
   - Telefonu sallayın (Dev Menu açılır)
   - "Settings" seçin
   - "Debug server host & port for device" seçin
   - Şunu girin: `localhost:8081`
   - Geri dönün ve "Reload" seçin

2. **ADB ile (alternatif):**
   ```cmd
   REM Dev Menu'yu aç
   adb shell input keyevent 82
   
   REM Sonra manuel olarak Settings'e gidin ve localhost:8081 girin
   ```

### 3. Uygulama Cache'ini Temizle

Bazen cache sorunları bağlantıyı engeller:

```cmd
REM App data'yı temizle (uygulama ayarları sıfırlanır)
adb shell pm clear com.anonymous.frontend

REM Sonra uygulamayı yeniden başlat
adb shell am start -n com.anonymous.frontend/.MainActivity
```

### 4. Metro'yu Cache Temizleyerek Başlat

```cmd
REM Metro'yu durdur (Ctrl+C)
REM Sonra cache temizleyerek başlat:
npm start -- --reset-cache
```

### 5. Uygulamayı Yeniden Derle ve Yükle

Eğer hiçbiri işe yaramazsa, uygulamayı yeniden derleyin:

```cmd
REM Metro'yu durdur
REM Sonra:
npm run android
```

Bu, uygulamayı yeniden derler ve yükler, Metro bağlantısını da yeniden kurar.

## 🔍 Debug: Uygulama Çalışıyor mu?

```cmd
REM Uygulama process'ini kontrol et
adb shell "ps | grep frontend"
```

Eğer process görünüyorsa, uygulama çalışıyor demektir.

## 🔍 Debug: Port Forwarding Aktif mi?

```cmd
REM Port forwarding listesi
adb reverse --list
```

Şunu görmeli: `tcp:8081 tcp:8081`

## 🔍 Debug: Metro Çalışıyor mu?

```cmd
REM Port 8081'de dinleyen process
netstat -ano | findstr :8081 | findstr LISTENING
```

Process görünmeli.

## 🔍 Debug: Metro Status Endpoint

Tarayıcıda açın: `http://localhost:8081/status`

JSON response görmeli:
```json
{
  "packager-status": "running"
}
```

## ✅ Başarı Kriterleri

Metro bağlantısı başarılı olduğunda:

1. **Metro penceresinde:**
   ```
   INFO  Reloading connected app(s)...
   ```
   "No apps connected" uyarısı kaybolur.

2. **Uygulama telefonda:**
   - Bundle yüklenir
   - Uygulama çalışır
   - Hata mesajları kaybolur

3. **Metro loglarında:**
   - Bundle build mesajları görünür
   - "Bundling..." mesajları görünür

## 🚀 Hızlı Fix Script

`force_connect_metro.bat` script'i tüm adımları otomatik yapar:
- Port forwarding'i yeniden kurar
- Uygulamayı kapatır
- Cache'i temizler (opsiyonel)
- Uygulamayı yeniden başlatır
- Reload komutu gönderir

## 📝 Notlar

1. **İlk Başlatma:** Uygulama ilk kez başlatıldığında Metro'ya bağlanması biraz zaman alabilir (5-10 saniye).

2. **Release Build:** Eğer release build kullanıyorsanız, Metro'ya bağlanmaz. Debug build kullanın.

3. **Wi-Fi vs USB:** USB bağlantısı daha güvenilirdir. Wi-Fi bağlantısında IP adresi ayarlamak gerekebilir.

4. **Firewall:** Windows Firewall port 8081'i engelliyor olabilir. Kontrol edin.

## 🔧 Gelişmiş: React Native DevSettings

Uygulama içinde programatik olarak Metro host'u ayarlayabilirsiniz:

```javascript
import { DevSettings } from 'react-native';

// Metro host'u ayarla
DevSettings.setIsDebuggingRemotely(true);
```

Ancak genellikle manuel ayarlama daha güvenilirdir.
