# Sunucu Yapılandırma Rehberi

Bu rehber, bilgisayarınızı sunucu olarak kullanarak mobil uygulamanın dış IP üzerinden erişilebilir olmasını sağlar.

## Dış IP: 78.189.238.18

## 1. Backend Sunucusu Yapılandırması

### Backend Port: 8001

Backend sunucusu zaten `0.0.0.0` adresinde dinliyor (tüm ağ arayüzlerinde). Bu doğru yapılandırma.

### Backend'i Başlatma:

```bash
cd c:\ProParcel\mobile\mobil_github\backend
python server.py
```

Veya uvicorn ile:

```bash
cd c:\ProParcel\mobile\mobil_github\backend
uvicorn server:app --host 0.0.0.0 --port 8001
```

### Backend'in Çalıştığını Kontrol Etme:

Tarayıcıda şu adresi açın:
```
http://78.189.238.18:8001/api/
```

Veya yerel olarak:
```
http://localhost:8001/api/
```

## 2. Windows Firewall Ayarları

Backend'in dışarıdan erişilebilir olması için Windows Firewall'da port 8001'i açmanız gerekir.

### PowerShell ile Firewall Kuralı Ekleme (Yönetici Olarak):

```powershell
New-NetFirewallRule -DisplayName "ProParcel Backend Port 8001" -Direction Inbound -LocalPort 8001 -Protocol TCP -Action Allow
```

### Manuel Olarak:

1. Windows Defender Firewall'u açın
2. "Gelen Kuralları" seçin
3. "Yeni Kural" tıklayın
4. "Bağlantı Noktası" seçin
5. TCP, 8001 portunu seçin
6. "Bağlantıya İzin Ver" seçin
7. Tüm profilleri seçin
8. İsim: "ProParcel Backend Port 8001"

## 3. Router/Modem Ayarları (Gerekirse)

Eğer bilgisayarınız bir router arkasındaysa, port forwarding yapılandırmanız gerekebilir:

- **Dış Port:** 8001
- **İç IP:** Bilgisayarınızın yerel IP adresi (örn: 192.168.1.xxx)
- **İç Port:** 8001
- **Protokol:** TCP

### Yerel IP Adresinizi Öğrenme:

```powershell
ipconfig | findstr IPv4
```

## 4. Frontend Yapılandırması

Frontend zaten yapılandırıldı:
- `.env` dosyasında: `EXPO_PUBLIC_API_URL=http://78.189.238.18:8001`
- `app.config.js` dosyasında da yedek olarak tanımlandı

### Yapılandırmayı Kontrol Etme:

```bash
cd c:\ProParcel\mobile\mobil_github\frontend
type .env
```

Çıktı şöyle olmalı:
```
EXPO_PUBLIC_API_URL=http://78.189.238.18:8001
```

## 5. APK Build ve Test

### APK Oluşturma:

```bash
cd c:\ProParcel\mobile\mobil_github\frontend
npx expo run:android --variant release
```

APK dosyası şu konumda oluşur:
```
android/app/build/outputs/apk/release/app-release.apk
```

### Test Etme:

1. APK'yı telefonunuza yükleyin
2. Uygulamayı açın
3. Ada/Parsel sorgusu yapın
4. Backend'e bağlanıp bağlanmadığını kontrol edin

## 6. Sorun Giderme

### Backend'e Bağlanılamıyor:

1. **Backend çalışıyor mu?**
   ```bash
   # Başka bir terminalde test edin
   curl http://localhost:8001/api/
   ```

2. **Firewall açık mı?**
   ```powershell
   Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*8001*"}
   ```

3. **Port dinleniyor mu?**
   ```powershell
   netstat -an | findstr 8001
   ```

4. **Dış IP'den erişilebilir mi?**
   - Başka bir cihazdan (telefonunuzdan WiFi dışında) test edin
   - Tarayıcıda `http://78.189.238.18:8001/api/` adresini açın

### Mobil Uygulama Backend'e Bağlanamıyor:

1. **WiFi ve Mobil Veri:**
   - WiFi'deyken: Yerel IP kullanılabilir (192.168.x.x)
   - Mobil verideyken: Dış IP kullanılmalı (78.189.238.18)

2. **Environment Variable Kontrolü:**
   - APK build edilirken `.env` dosyasındaki değerler kullanılır
   - Build sonrası `.env` değişiklikleri APK'ya yansımaz
   - Yeni bir build yapmanız gerekir

3. **CORS Hatası:**
   - Backend'de CORS zaten yapılandırılmış (`allow_origins=["*"]`)
   - Eğer hata alırsanız, backend'i yeniden başlatın

## 7. Güvenlik Notları

⚠️ **ÖNEMLİ:** Dış IP'yi herkese açık yapmak güvenlik riski oluşturabilir.

- Sadece güvendiğiniz ağlardan erişim sağlayın
- Mümkünse VPN kullanın
- Backend'de authentication ekleyin
- HTTPS kullanmayı düşünün (Let's Encrypt ile ücretsiz sertifika)

## 8. Dinamik IP Adresi

Eğer IP adresiniz değişiyorsa:

1. **Dinamik DNS kullanın** (örn: No-IP, DuckDNS)
2. Veya `.env` dosyasını güncelleyip yeni APK build edin

## 9. Backend'i Otomatik Başlatma (Opsiyonel)

Windows'ta backend'i otomatik başlatmak için:

1. `start_backend.bat` dosyası oluşturun:
   ```batch
   @echo off
   cd c:\ProParcel\mobile\mobil_github\backend
   python server.py
   ```

2. Windows Task Scheduler ile başlangıçta çalıştırın
