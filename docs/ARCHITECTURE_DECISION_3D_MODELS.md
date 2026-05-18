# 3D Modeller API Mimari Karar Dokümantasyonu

## Genel Bakış

Bu dokümantasyon, 3D modeller listesi API'si için sunucu mimarisi kararını açıklar. Projede hem Django (Port 8000) hem de FastAPI (Port 8001) sunucularında aynı endpoint mevcuttur.

**Tarih**: 2026-01-24  
**Durum**: Django tercih edildi (optimizasyon yapıldı)

## Mevcut Durum

### Endpoint'ler

1. **Django Endpoint** (`myapp/views/models_api.py`)
   - URL: `http://localhost:8000/api/3d-models-list/`
   - Port: 8000
   - Framework: Django
   - Veritabanı: UserDb (MSSQL)
   - Authentication: Opsiyonel (kullanıcı bilgisi varsa sahip olunan modelleri gösterir)

2. **FastAPI Endpoint** (`mobile/mobil_github/backend/server.py`)
   - URL: `http://localhost:8001/api/3d-models-list/`
   - Port: 8001
   - Framework: FastAPI
   - Veritabanı: UserDb (MSSQL) - Direkt bağlantı
   - Authentication: Yok (herkese açık)

### Mobil Uygulama Konfigürasyonu

**Dosya**: `mobile/mobil_github/frontend/config/api.ts`

```typescript
const DEFAULT_API_URL = 'http://10.0.2.2:8000'; // Django
const DEFAULT_MODELS_URL = 'http://10.0.2.2:8000'; // Django
```

Mobil uygulama varsayılan olarak Django sunucusunu kullanır.

## Mimari Seçenekler

### Seçenek 1: Tek Sunucu (Django) ✅ Seçildi

**Yaklaşım**: Sadece Django sunucusunu kullan, FastAPI'yi kaldır veya kullanma.

#### Artıları

1. **Tek Yönetim Noktası**
   - Tek bir backend sunucusu yönetmek daha kolay
   - Tek bir port yönetimi (8000)
   - Daha az karmaşıklık

2. **Kod Tekrarı Yok**
   - Endpoint sadece bir yerde tanımlı
   - Bakım ve güncelleme daha kolay
   - Tek bir veritabanı bağlantısı

3. **Web ve Mobil Aynı API**
   - Web uygulaması ve mobil uygulama aynı endpoint'i kullanır
   - Tutarlılık sağlar
   - Tek bir doğruluk kaynağı (single source of truth)

4. **Django ORM Avantajları**
   - Django'nun güçlü ORM'i
   - Model ilişkileri kolay yönetilir
   - Migration sistemi

5. **Authentication Entegrasyonu**
   - Django'nun authentication sistemi ile entegre
   - Kullanıcı sahip olunan modelleri görebilir
   - Admin kontrolü kolay

#### Eksileri

1. **Performans**
   - Django, FastAPI'ye göre daha yavaş olabilir (async/await yok)
   - Ancak optimizasyon ile bu sorun çözüldü (prefetch_related, select_related)

2. **Mobil Özelleştirme**
   - Mobil için özel optimizasyonlar yapmak zor olabilir
   - Web ve mobil ihtiyaçları farklı olabilir

3. **Tek Nokta Başarısızlık**
   - Django çökerse hem web hem mobil etkilenir

#### Optimizasyonlar Yapıldı

1. **Veritabanı Sorguları Optimize Edildi**
   ```python
   # Önceki: N+1 problem (her kategori için ayrı sorgu)
   categories = Model3DCategory.objects.all()
   for category in categories:
       models = Model3DObject.objects.filter(category=category)
   
   # Sonra: Tek sorguda tüm veriler (prefetch_related)
   categories = Model3DCategory.objects.prefetch_related(
       Prefetch('model_objects', queryset=Model3DObject.objects.select_related('category'))
   )
   ```

2. **Logging Eklendi**
   - Request başlangıç/bitiş zamanları
   - Veritabanı sorgu süreleri
   - Toplam response süresi
   - Hata yakalama ve detaylı loglar

3. **Timeout Artırıldı**
   - Mobil uygulamada 30 saniyeden 60 saniyeye çıkarıldı

### Seçenek 2: Ayrı Sunucular (Django + FastAPI)

**Yaklaşım**: Django web için, FastAPI mobil için kullan.

#### Artıları

1. **Bağımsız Ölçeklendirme**
   - Mobil trafiği artarsa sadece FastAPI'yi ölçeklendir
   - Web trafiği artarsa sadece Django'yu ölçeklendir

2. **Performans**
   - FastAPI async/await ile daha hızlı olabilir
   - Mobil için özel optimizasyonlar yapılabilir

3. **Bağımsız Deployment**
   - Mobil API'sini web'den bağımsız deploy edebilirsin
   - Bir sunucu çökerse diğeri çalışmaya devam eder

4. **Teknoloji Esnekliği**
   - FastAPI'de farklı teknolojiler kullanılabilir
   - Mobil için özel özellikler eklenebilir

#### Eksileri

1. **Kod Tekrarı**
   - Aynı endpoint iki yerde tanımlı
   - Bakım ve güncelleme iki katına çıkar
   - Bug fix'ler iki yerde yapılmalı

2. **İki Veritabanı Bağlantısı**
   - Django ve FastAPI ayrı bağlantılar kullanır
   - Connection pool yönetimi iki katına çıkar

3. **İki Port Yönetimi**
   - 8000 ve 8001 portları açık olmalı
   - Firewall kuralları iki katına çıkar
   - Network yapılandırması daha karmaşık

4. **Tutarsızlık Riski**
   - İki endpoint farklı sonuçlar dönebilir
   - Test ve doğrulama iki katına çıkar

5. **Karmaşıklık**
   - İki sunucu yönetmek daha zor
   - Monitoring ve logging iki katına çıkar
   - Debugging daha zor

### Seçenek 3: Fallback Mekanizması

**Yaklaşım**: Önce Django'yu dene, başarısız olursa FastAPI'ye geç.

#### Artıları

1. **Yüksek Erişilebilirlik**
   - Bir sunucu çökerse diğeri devreye girer
   - Redundancy sağlar

2. **Esneklik**
   - Her iki sunucuyu da kullanabilir
   - Performans testleri yapılabilir

#### Eksileri

1. **Karmaşıklık**
   - Fallback mantığı eklenmeli
   - İki endpoint'in tutarlı olması gerekir
   - Hata senaryoları daha karmaşık

2. **Kod Tekrarı**
   - İki endpoint de bakım gerektirir
   - Bug fix'ler iki yerde yapılmalı

3. **Tutarsızlık Riski**
   - İki endpoint farklı sonuçlar dönebilir
   - Kullanıcı deneyimi tutarsız olabilir

## Karar: Tek Sunucu (Django)

### Neden Django Seçildi?

1. **Mevcut Altyapı**
   - Django zaten ana proje sunucusu
   - Web uygulaması Django kullanıyor
   - Veritabanı bağlantıları mevcut

2. **Optimizasyon Sonrası Performans**
   - Veritabanı sorguları optimize edildi
   - Response süresi kabul edilebilir seviyede
   - Logging ile performans izlenebilir

3. **Bakım Kolaylığı**
   - Tek bir endpoint yönetmek daha kolay
   - Kod tekrarı yok
   - Tutarlılık sağlanır

4. **Authentication Entegrasyonu**
   - Django'nun authentication sistemi ile entegre
   - Kullanıcı sahip olunan modelleri görebilir
   - Admin kontrolü kolay

### FastAPI Ne Olacak?

FastAPI endpoint'i şu an için kullanılmıyor ancak:
- **Gelecekte kullanılabilir**: Performans sorunları devam ederse FastAPI'ye geçiş yapılabilir
- **Test amaçlı**: Performans karşılaştırması için kullanılabilir
- **Yedek**: Django çökerse geçici olarak kullanılabilir

## Test ve Performans

### Test Scripti

**Dosya**: `mobile/mobil_github/backend/test_3d_models_endpoints.py`

Bu script her iki endpoint'i test eder ve performans karşılaştırması yapar.

**Kullanım**:
```bash
cd mobile/mobil_github/backend
python test_3d_models_endpoints.py
```

### Performans Metrikleri

Django endpoint optimizasyonu sonrası:
- **Veritabanı sorguları**: N+1 problem çözüldü (prefetch_related)
- **Response süresi**: Optimize edildi (loglardan izlenebilir)
- **Timeout**: 30 saniyeden 60 saniyeye çıkarıldı

## Gelecek Planları

1. **Monitoring**
   - Django endpoint performansını izle
   - Response sürelerini logla
   - Hata oranlarını takip et

2. **Caching**
   - Model listesi için cache eklenebilir
   - Redis veya Django cache kullanılabilir
   - Cache invalidation stratejisi belirlenmeli

3. **FastAPI Geçişi (Gerekirse)**
   - Performans sorunları devam ederse FastAPI'ye geçiş değerlendirilebilir
   - Geçiş planı hazırlanmalı
   - Test senaryoları oluşturulmalı

## Sonuç

**Karar**: Django endpoint'i kullanılmaya devam edilecek.

**Gerekçe**:
- Tek sunucu yönetimi daha kolay
- Optimizasyon sonrası performans yeterli
- Kod tekrarı yok
- Web ve mobil aynı API'yi kullanır
- Authentication entegrasyonu mevcut

**FastAPI**:
- Şu an için kullanılmıyor
- Gelecekte performans sorunları devam ederse değerlendirilebilir
- Test ve yedek amaçlı tutulabilir

## İlgili Dosyalar

- Django Endpoint: `myapp/views/models_api.py`
- FastAPI Endpoint: `mobile/mobil_github/backend/server.py`
- Mobil Konfigürasyon: `mobile/mobil_github/frontend/config/api.ts`
- Model Catalog: `mobile/mobil_github/frontend/src/maps/models/modelCatalog.ts`
- Test Scripti: `mobile/mobil_github/backend/test_3d_models_endpoints.py`
