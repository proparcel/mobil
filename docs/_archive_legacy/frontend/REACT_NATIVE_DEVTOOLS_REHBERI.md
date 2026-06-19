# React Native DevTools Kullanım Rehberi

## 🎯 DevTools Nedir?

React Native DevTools, uygulamanızın JavaScript kodunu debug etmek, console loglarını görmek ve performansı analiz etmek için kullanılan bir araçtır.

## 🚀 DevTools'u Açma Yöntemleri

### Yöntem 1: Metro Terminalinde Kısayol (En Kolay)

Metro bundler terminalinde:
```
j
```
tuşuna basın. Bu, DevTools'u varsayılan tarayıcınızda açar.

### Yöntem 2: Script Kullanma

```cmd
open_devtools.bat
```

Bu script otomatik olarak DevTools'u tarayıcıda açar.

### Yöntem 3: Manuel URL Açma

Tarayıcınızda şu URL'leri açın:

**Ana DevTools:**
```
http://localhost:8081/debugger-ui/
```

**Alternatif:**
```
http://localhost:8081/debugger/
```

**Status Sayfası:**
```
http://localhost:8081/status
```

## 📋 DevTools Özellikleri

### 1. Console Logs
- `console.log()`, `console.error()`, `console.warn()` mesajlarını görüntüler
- Uygulama içindeki tüm JavaScript loglarını gösterir

### 2. Debugger
- Breakpoint koyabilirsiniz
- Kod adım adım çalıştırabilirsiniz
- Değişken değerlerini inceleyebilirsiniz

### 3. Network Tab
- API isteklerini görüntüler
- Network trafiğini analiz eder

### 4. Performance
- Render performansını analiz eder
- Yavaş component'leri tespit eder

## 🔧 DevTools Kullanımı

### Console Logları Görüntüleme

1. **Uygulama kodunda:**
   ```javascript
   console.log('Bu mesaj DevTools\'da görünecek');
   console.error('Hata mesajı');
   console.warn('Uyarı mesajı');
   ```

2. **DevTools'da:**
   - Console sekmesine gidin
   - Loglar otomatik olarak görünecek

### Debugger Kullanma

1. **Kodunuza breakpoint ekleyin:**
   ```javascript
   debugger; // Bu satırda durur
   ```

2. **Veya Chrome DevTools'da:**
   - Sources sekmesine gidin
   - Dosyayı bulun
   - Satır numarasına tıklayarak breakpoint ekleyin

3. **Debugging:**
   - F10: Step over (bir sonraki satıra geç)
   - F11: Step into (fonksiyon içine gir)
   - F8: Continue (devam et)

### Network İsteklerini İzleme

1. DevTools'da Network sekmesine gidin
2. Uygulamanızda bir işlem yapın (API çağrısı, vb.)
3. Network istekleri otomatik olarak görünecek

## 🌐 Chrome DevTools ile Bağlanma

React Native DevTools, Chrome DevTools ile entegre çalışır:

1. **DevTools'u açın:**
   ```
   http://localhost:8081/debugger-ui/
   ```

2. **Chrome DevTools'u açın:**
   - F12 tuşuna basın
   - VEYA Sağ tık → "Inspect" seçin

3. **Console'u kullanın:**
   - Chrome DevTools Console'unda JavaScript komutları çalıştırabilirsiniz
   - React Native uygulamanızın state'ine erişebilirsiniz

## 📱 Uygulama ile Bağlantı

DevTools'un çalışması için:

1. ✅ Metro bundler çalışıyor olmalı (`npm start`)
2. ✅ Uygulama telefonda/emülatörde çalışıyor olmalı
3. ✅ Uygulama Metro'ya bağlı olmalı

**Bağlantı kontrolü:**
- Metro terminalinde "Reloading connected app(s)..." mesajı görünmeli
- "No apps connected" uyarısı olmamalı

## 🔍 Yaygın Sorunlar

### Sorun 1: DevTools Açılmıyor

**Çözüm:**
```cmd
REM Metro'nun çalıştığını kontrol et
netstat -ano | findstr :8081

REM Metro'yu yeniden başlat
npm start
```

### Sorun 2: Console Logları Görünmüyor

**Çözüm:**
1. DevTools'da Console sekmesine gidin
2. Filter ayarlarını kontrol edin (log, error, warn seçili olmalı)
3. Uygulamayı yeniden yükleyin (telefonda R tuşuna 2 kez basın)

### Sorun 3: Breakpoint Çalışmıyor

**Çözüm:**
1. `debugger;` statement kullanın (kod içinde)
2. Chrome DevTools Sources sekmesinde breakpoint ekleyin
3. Uygulamayı yeniden yükleyin

### Sorun 4: Network İstekleri Görünmüyor

**Çözüm:**
- Network sekmesinde "Preserve log" seçeneğini açın
- Uygulamayı yeniden yükleyin
- API çağrısı yapan bir işlem yapın

## 🚀 Hızlı Komutlar

```cmd
REM DevTools'u aç
open_devtools.bat

REM Metro'yu başlat
npm start

REM Metro'yu cache temizleyerek başlat
npm start -- --reset-cache

REM Uygulamayı yeniden yükle
reload_app.bat
```

## 📝 İpuçları

1. **Metro Terminal Kısayolları:**
   - `r` - Reload app
   - `d` - Open Dev Menu
   - `j` - Open DevTools
   - `Ctrl+C` - Stop Metro

2. **Chrome DevTools Kısayolları:**
   - `F12` - Open/Close DevTools
   - `Ctrl+Shift+J` - Open Console
   - `Ctrl+Shift+I` - Open Inspector

3. **Log Filtreleme:**
   - DevTools Console'da log seviyesine göre filtreleyebilirsiniz
   - Sadece error'ları görmek için filter'a "error" yazın

4. **Performance Analizi:**
   - Performance sekmesini kullanarak render sürelerini analiz edin
   - Yavaş component'leri tespit edin

## 🔗 İlgili Dosyalar

- `open_devtools.bat` - DevTools'u açan script
- `start_metro_clean.bat` - Metro'yu temiz başlatan script
- `reload_app.bat` - Uygulamayı yeniden yükleyen script

## 📚 Daha Fazla Bilgi

- [React Native Debugging](https://reactnative.dev/docs/debugging)
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/)
- [Metro Bundler](https://metrobundler.dev/)
