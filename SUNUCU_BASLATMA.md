# Sunucu Başlatma Rehberi

Mobil uygulama iki backend sunucusu gerektirir:

## Sistem Mimarisi

```
Mobil Uygulama (APK)
    ↓
FastAPI Backend (Port 8001) ← Bu çalışmalı!
    ↓
Django Backend (Port 8000) ← Bu da çalışmalı
```

## 1. Django Backend'i Başlatma

### ⚠️ ÖNEMLİ: Django'yu dışarıdan erişilebilir yapmak için `0.0.0.0` kullanın!

**YANLIŞ (Sadece localhost'tan erişilebilir - ŞU ANDA BÖYLE ÇALIŞIYOR!):**
```bash
python manage.py runserver
# veya
python manage.py runserver 127.0.0.1:8000
```

**DOĞRU (Dışarıdan da erişilebilir):**
```bash
cd c:\ProParcel
python manage.py runserver 0.0.0.0:8000
```

**VEYA batch dosyası ile:**
```bash
c:\ProParcel\start_django.bat
```

## 2. FastAPI Backend'i Başlatma

**Yöntem 1: Python script ile:**
```bash
cd c:\ProParcel\mobile\mobil_github\backend
python server.py
```

**Yöntem 2: Batch dosyası ile:**
```bash
cd c:\ProParcel\mobile\mobil_github\backend
start_backend.bat
```

**Yöntem 3: Uvicorn ile:**
```bash
cd c:\ProParcel\mobile\mobil_github\backend
uvicorn server:app --host 0.0.0.0 --port 8001
```

## 3. Her İkisini Aynı Anda Başlatma

İki ayrı terminal/PowerShell penceresi açın:

**Terminal 1 - Django:**
```bash
cd c:\ProParcel
python manage.py runserver 0.0.0.0:8000
```

**Terminal 2 - FastAPI:**
```bash
cd c:\ProParcel\mobile\mobil_github\backend
python server.py
```

## 4. Kontrol Etme

### Django Kontrol:
Tarayıcıda açın:
- Yerel: http://localhost:8000/
- Dış IP: http://78.189.238.18:8000/

### FastAPI Kontrol:
Tarayıcıda açın:
- Yerel: http://localhost:8001/api/
- Dış IP: http://78.189.238.18:8001/api/

API testi için:
```bash
curl http://78.189.238.18:8001/api/
```

## 5. Windows Firewall Ayarları

Her iki port için de firewall kuralı ekleyin:

```powershell
# PowerShell'i Yönetici olarak açın

# Django için (Port 8000)
New-NetFirewallRule -DisplayName "ProParcel Django Port 8000" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow

# FastAPI için (Port 8001)
New-NetFirewallRule -DisplayName "ProParcel FastAPI Port 8001" -Direction Inbound -LocalPort 8001 -Protocol TCP -Action Allow
```

## 6. Otomatik Başlatma (Opsiyonel)

Her iki sunucuyu da Windows başlangıcında otomatik başlatmak için:

### Django için batch dosyası oluşturun: `start_django.bat`
```batch
@echo off
cd c:\ProParcel
python manage.py runserver 0.0.0.0:8000
```

### FastAPI için: `start_fastapi.bat` (zaten mevcut)
```batch
@echo off
cd c:\ProParcel\mobile\mobil_github\backend
python server.py
```

Sonra Windows Task Scheduler ile bu batch dosyalarını başlangıçta çalıştırın.

## 7. Sorun Giderme

### "Address already in use" hatası:
- Port zaten kullanılıyor
- Başka bir process'i kapatın veya farklı port kullanın

### Django "DisallowedHost" hatası:
`settings.py` dosyasında `ALLOWED_HOSTS` ayarını kontrol edin:
```python
ALLOWED_HOSTS = ['*']  # Tüm hostlara izin ver (geliştirme için)
# veya
ALLOWED_HOSTS = ['78.189.238.18', 'localhost', '127.0.0.1']
```

### FastAPI Django'ya bağlanamıyor:
- Django'nun `0.0.0.0:8000` üzerinde çalıştığından emin olun
- Django'nun çalıştığını kontrol edin: http://localhost:8000/

## Önemli Notlar

⚠️ **Güvenlik:**
- Production ortamında `ALLOWED_HOSTS` ve CORS ayarlarını sınırlandırın
- Authentication ekleyin
- HTTPS kullanmayı düşünün

⚠️ **Port Çakışması:**
- Eğer portlar başka bir uygulama tarafından kullanılıyorsa, ya o uygulamayı kapatın ya da port numaralarını değiştirin
