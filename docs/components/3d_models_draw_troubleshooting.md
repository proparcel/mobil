# 3D Modeller: Neden Bazıları Çizilir, Bazıları Çizilmez?

## İsimlendirme (path / name / model_id)

Tek kaynak kuralı:

| Alan | Anlam | Kullanım |
|------|--------|----------|
| **path** | Dosya yolu + orijinal dosya adı (örn. `models/car/Araba.glb`) | API `file` = basename(path); manifest `filename`; asset script tek dosya adı. Dosya adı her yerde path'ten türetilir. |
| **name** | Gösterim adı (örn. Audi, İki Katlı Villa) | Sadece UI (galeri, listeler); dosya/pack türetiminde kullanılmaz. |
| **model_id** | Programatik anahtar (örn. `model_1`) | API'de döner; mobil modelId; Mapbox key; pack adı `pp_model_{id}` ile uyumlu (id = pk). |

Veritabanında tutarlılık için: `python manage.py normalize_3d_model_refs` (isteğe bağlı `--fix-name`).

---

## Hepsi aynı yolu ve çizim yöntemini kullanıyor mu?

**Evet.** Tüm modeller:

- **URL:** `https://pp-local/models/model_<id>.glb`
- **Pack:** `pp_model_<id>` (Play Asset Delivery, fast-follow veya on-demand)
- **Çizim:** Mapbox `Models` + `ModelLayer`, aynı `ModelsLayer` kodu

Farklı davranmanın nedeni kod yolu değil; **veri ve ortam** (pack indirme, dosya boyutu).

---

## Neden bazı modeller çizilmiyor?

### 1. Pack henüz indirilmemiş (on-demand)

- **Ne oluyor:** Model sadece **seçildiğinde** `ensureModelAvailable(modelId)` ile pack indiriliyor. Haritada **kayıtlı (eski) instance** varsa ve kullanıcı o modeli bu oturumda seçmediyse, pack cihazda yok.
- **Sonuç:** Mapbox `model_X.glb` isteği yapıyor → interceptor dosyayı bulamıyor → model çizilmiyor.
- **Yapılan:** Modal açıldığında haritadaki tüm instance’ların `modelId`’lerinden sayısal id çıkarılıp bu id’ler için **arka planda** `ensureModelAvailable` çağrılıyor (pack’ler indiriliyor). Böylece kayıtlı modeller de çizilebilir.

### 2. Model dosyası çok büyük (interceptor limiti)

- **Ne oluyor:** Android’de `PpLocalModelHttpInterceptor` modeli **belleğe** okuyup Mapbox’a veriyor. Güvenlik için bir **üst boyut limiti** var. Eski limit **150 MB** idi; bu limitin üzerindeki `.glb` dosyaları **hiç** servis edilmiyordu (sadece log uyarısı, istek geçiyor → model gelmiyor).
- **Sonuç:** Özellikle büyük villa modelleri (ör. 600–900 MB) çizilmiyordu.
- **Yapılan:** Limit **1 GB** olacak şekilde artırıldı. Çok büyük modellerde düşük RAM’li cihazlarda OOM riski olabilir; gerekirse bu modelleri küçültmek (poly azaltma, sıkıştırma) iyi fikir.

### 3. Pack içinde model dosyası yok (Car.glb vb. çizilmiyor)

- **Ne oluyor:** `android/asset-packs/pp_model_1/` gibi pack klasörü var ama içinde `src/main/assets/models/model_1.glb` yok veya 0 byte. Build öncesi pack'ler doldurulmamış.
- **Sonuç:** Interceptor dosyayı bulamıyor → model çizilmiyor.
- **Çözüm:** Pack'lerin doğru yüklenmesi için build öncesi mutlaka `npm run gen:android-asset-packs` çalıştırın. Script yerel dosya yoksa `models_manifest.json` içindeki `staticUrl` ile indirir; sonunda her pack'ta dosyanın var ve boş olmadığını doğrular. Debug build için: `npm run android:local` (önce gen:android-asset-packs + gen:debug-assets-models, sonra run-android).

---

## Özet

| Durum | Sebep | Çözüm |
|--------|--------|--------|
| Pack yok | On-demand pack, kullanıcı o modeli seçmedi / sayfa yeni açıldı | Instance'lar için pre-fetch eklendi |
| Dosya > limit | Interceptor 150 MB üstü dosyayı vermiyordu | Limit 1 GB yapıldı |
| Pack boş | Build öncesi gen:android-asset-packs çalıştırılmadı veya indirme başarısız | Build öncesi `npm run gen:android-asset-packs`; yerel yoksa staticUrl ile indirilir, script doğrulama yapar |

Tüm modeller aynı URL, pack stratejisi ve çizim yöntemini kullanıyor; farkı yaratan **pack'in indirilmiş olması**, **pack içinde dosyanın gerçekten olması** ve **dosya boyutunun limitin altında olması**.
