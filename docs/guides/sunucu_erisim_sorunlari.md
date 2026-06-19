# APK Sunucu Erişim Sorunları ve Çözümleri

## Sorun: "Sayfa yükleniyor" ama açılmıyor

Bu sorun genellikle şu nedenlerden kaynaklanır:
1. **Firewall kuralı eksik** (en yaygın)
2. **Router port forwarding eksik** (dış IP için)
3. **Sunucu yanıt vermiyor**
4. **Telefon ve bilgisayar aynı ağda değil**

## Hızlı Çözüm

### 1. Firewall Kuralı Ekle (YÖNETİCİ OLARAK)

PowerShell'i **Yönetici olarak** açın ve şu komutu çalıştırın:

```powershell
cd c:\ProParcel\mobile\mobil_github\frontend
.\ekle_firewall_apk.ps1
```

Veya manuel olarak:

```powershell
New-NetFirewallRule -DisplayName "APK Download Server Port 8002" `
    -Direction Inbound `
    -LocalPort 8002 `
    -Protocol TCP `
    -Action Allow `
    -Description "ProParcel APK Download Server"
```

**Windows Defender Firewall GUI:**
1. Windows Defender Firewall'u açın
2. "Gelen kuralları yönet" → "Yeni kural"
3. **Port** seçin → **TCP** → **8002**
4. **Bağlantıya izin ver**
5. Tüm profilleri seçin
6. İsim: "APK Download Server Port 8002"

### 2. Sunucuyu Test Et

```bash
cd c:\ProParcel\mobile\mobil_github\frontend
test_apk_server.bat
```

### 3. Yerel Ağdan Test

Aynı WiFi ağındaki başka bir cihazdan veya tarayıcıdan:

```
http://192.168.1.101:8002/
```

## Telefon Erişim Sorunları

### Durum Kontrolü
✅ Sunucu çalışıyor (localhost ve yerel IP testleri başarılı)
❌ Telefonda "sayfa yükleniyor" ama açılmıyor

### Çözüm Adımları

#### 1. Telefon ve Bilgisayar Aynı WiFi'de mi?

Telefon ve bilgisayarın **aynı WiFi ağında** olduğundan emin olun.

#### 2. Telefon Tarayıcısında Cache Temizle

**Chrome/Android:**
- Menü (3 nokta) → Ayarlar → Gizlilik → Tarama verilerini temizle
- Veya: `Ctrl+Shift+Delete` (klavye varsa)

**Safari/iOS:**
- Ayarlar → Safari → Geçmişi ve Web Sitesi Verilerini Temizle

#### 3. Farklı Tarayıcı Deneyin

- Chrome yerine Firefox deneyin
- Veya Android'de "Dosyalar" uygulamasından direkt APK linkini açın

#### 4. URL'yi Doğru Yazın

**Yerel ağ (WiFi):**
```
http://192.168.1.101:8002/
```

**Dış IP (İnternet - router port forwarding gerekir):**
```
http://78.186.188.162:8002/
```

#### 5. HTTP (S değil) Kullanın

`https://` değil, `http://` kullanın!

#### 6. APK'yı Direkt İndirin

HTML sayfası yerine direkt APK linkini deneyin:

```
http://192.168.1.101:8002/ProParcel.apk
```

#### 7. Telefonun Tarayıcısında Geliştirici Araçları

1. Tarayıcıda sayfayı açın
2. F12 veya "Geliştirici araçları" açın
3. Network sekmesine bakın
4. İsteğin durumunu kontrol edin:
   - **Pending:** İstek gönderiliyor (timeout olabilir)
   - **Failed:** Bağlantı hatası
   - **200 OK:** Başarılı (ama sayfa render edilmiyor olabilir)

#### 8. Alternatif: QR Kod

Bilgisayarda QR kod oluşturun:

```python
# Python ile QR kod oluştur
import qrcode
qr = qrcode.QRCode(version=1, box_size=10, border=5)
qr.add_data('http://192.168.1.101:8002/')
qr.make(fit=True)
img = qrcode.make('http://192.168.1.101:8002/')
img.save('apk_qr.png')
```

Telefonunuzla QR kodu tarayın.

#### 9. APK'yı USB ile Aktarın

En garantili yöntem:

1. `apk_releases\ProParcel.apk` dosyasını USB ile telefona aktarın
2. Telefonda dosya yöneticisinden APK'yı açın
3. "Bilinmeyen kaynaklardan yükleme" izni verin

## Router Port Forwarding (Dış IP İçin)

Eğer dış IP'den (`78.186.188.162:8002`) erişmek istiyorsanız:

1. Router ayarlarına girin (genellikle `192.168.1.1`)
2. Port Forwarding / Virtual Server bölümüne gidin
3. Yeni kural ekleyin:
   - **External Port:** 8002
   - **Internal IP:** 192.168.1.101 (bilgisayarınızın yerel IP'si)
   - **Internal Port:** 8002
   - **Protocol:** TCP
   - **Açıklama:** APK Download Server

## Sunucu Log Kontrolü

Sunucu çalışırken, tarayıcıdan istek yaptığınızda sunucu konsolunda log görünmeli:

```
[192.168.1.xxx] "GET / HTTP/1.1" 200 -
```

Eğer log görünmüyorsa, istek sunucuya ulaşmıyor demektir (firewall sorunu).

## Test Komutları

### Yerel test (aynı bilgisayar):
```bash
curl http://localhost:8002/
```

### Yerel ağ testi:
```bash
curl http://192.168.1.101:8002/
```

### Dış IP testi (başka bir cihazdan):
```bash
curl http://78.186.188.162:8002/
```

### Telefon testi (Terminal/ADB varsa):
```bash
curl -I http://192.168.1.101:8002/
```

Veya tarayıcıda direkt şu linki açın:
```
http://192.168.1.101:8002/ProParcel.apk
```

## Sorun Giderme Adımları

1. ✅ Port 8002 dinleniyor mu? (`netstat -ano | findstr ":8002"`)
2. ✅ Firewall kuralı var mı? (`Get-NetFirewallRule -DisplayName "*8002*"`)
3. ✅ Sunucu çalışıyor mu? (konsolda "Sunucu çalışıyor..." mesajı)
4. ✅ Yerel test çalışıyor mu? (`curl http://localhost:8002/`)
5. ✅ Yerel ağ testi çalışıyor mu? (`curl http://192.168.1.101:8002/`)
6. ✅ Telefon ve bilgisayar aynı WiFi ağında mı?
7. ✅ Router port forwarding yapılandırıldı mı? (dış IP için)

## Önemli Notlar

- **Firewall kuralı YÖNETİCİ yetkisi gerektirir**
- **Router port forwarding sadece dış IP için gereklidir**
- **Yerel ağdan erişim için sadece firewall kuralı yeterlidir**
- Sunucuyu yeniden başlatmak gerekebilir
- Telefondan erişim için HTTP (S değil) kullanın

## En Hızlı Çözüm

Eğer hala çalışmıyorsa:
1. APK'yı USB ile aktarın (en garantili)
2. Cloud storage (Google Drive, Dropbox) kullanın
3. GitHub Releases kullanın
