# Port Forwarding Rehberi - 8001 Portu

## Durum
- ✅ FastAPI Server çalışıyor (0.0.0.0:8001)
- ✅ Windows Firewall aktif (8001 portu açık)
- ❌ Router Port Forwarding yapılmamış/yetersiz

## Sorun
Mobil cihazdan `http://78.189.238.18:8001` adresine erişilemiyor çünkü router'da port forwarding yapılmamış.

## Çözüm: Router Port Forwarding Ayarları

### 1. Router Yönetim Paneline Giriş
- Tarayıcınızda şu adrese gidin: `http://192.168.1.1` (veya router markanıza göre)
- Kullanıcı adı ve şifre ile giriş yapın (genellikle router'ın arkasında yazılıdır)

### 2. Port Forwarding / Virtual Server Ayarları
Router markasına göre menü adı değişebilir:
- **TP-Link**: Advanced → NAT Forwarding → Virtual Servers
- **D-Link**: Advanced → Port Forwarding
- **Asus**: WAN → Virtual Server / Port Forwarding
- **Netgear**: Advanced → Port Forwarding / Port Triggering
- **Turk Telekom**: Advanced Settings → NAT → Virtual Server

### 3. Yeni Kural Ekleme
Aşağıdaki bilgileri girin:

```
Servis Adı/İsim: FastAPI Mobile Server
Dış Port (External Port): 8001
İç IP Adresi (Internal IP): 192.168.1.100
İç Port (Internal Port): 8001
Protokol (Protocol): TCP (veya Both/All)
Durum (Status): Aktif/Enabled
```

### 4. Kaydet ve Uygula
- Ayarları kaydedin
- Router'ın ayarları uygulamasını bekleyin (30-60 saniye)

### 5. Test Etme

#### Yerel Ağdan Test:
```powershell
# Başka bir cihazdan (aynı ağda) test edin:
Test-NetConnection -ComputerName 192.168.1.100 -Port 8001
```

#### Dış Ağdan Test (Mobil Veri Üzerinden):
- Telefonunuzda Wi-Fi'yi kapatın
- Mobil veri kullanın
- Tarayıcıda şu adresi açın: `http://78.189.238.18:8001/api/`
- `{"message":"Hello World"}` yanıtını görmelisiniz

## Alternatif Çözümler

### Geçici Çözüm: Mobil Cihaz Aynı Ağdaysa
Eğer mobil cihaz aynı Wi-Fi ağındaysa, dış IP yerine yerel IP kullanın:
- `http://192.168.1.100:8001` (app.config.js ve index.tsx'de değişiklik gerekir)

### UPnP Kullanımı (Otomatik Port Açma)
Bazı router'larda UPnP aktifse, uygulama otomatik olarak port açabilir:
```powershell
# UPnP kontrolü (router'da UPnP aktif olmalı)
# FastAPI server çalışırken router ayarlarından kontrol edin
```

## Sorun Giderme

### Port Forwarding Yaptım Ama Çalışmıyor
1. **Router'ı yeniden başlatın**
2. **Windows Firewall'ı kontrol edin** (zaten açık)
3. **FastAPI server'ın çalıştığını doğrulayın**:
   ```powershell
   Get-NetTCPConnection -LocalPort 8001 -State Listen
   ```
4. **Router'ın dış IP'sinin değişmediğinden emin olun**:
   - Dinamik IP kullanıyorsanız, IP değişmiş olabilir
   - DDNS (Dynamic DNS) kullanabilirsiniz

### Dinamik IP Sorunu
Eğer router'ınızın dış IP'si sürekli değişiyorsa:
- **DDNS hizmeti** kullanın (No-IP, DuckDNS gibi)
- Router'ınızda DDNS ayarını yapın
- Mobil uygulamada DDNS hostname kullanın

## Kontrol Scripti
Aşağıdaki scripti çalıştırarak durumu kontrol edebilirsiniz:
```powershell
.\check_network_status.ps1
```

## İletişim
Sorun devam ederse:
1. Router marka/modeli
2. Port forwarding ayarlarının ekran görüntüsü
3. `check_network_status.ps1` script çıktısı

ile birlikte sorun bildirimi yapabilirsiniz.
