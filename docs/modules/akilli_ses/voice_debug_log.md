# Sesli işlem debug günlüğü

Sesli üyelik ve genel ses sorgusu hatalarını cihazda izlemek için JSON Lines log dosyaları.

## Dosyalar

| Dosya | Amaç |
|-------|------|
| `{DocumentDirectory}/voice-registration-debug.log` | Sesli üyelik — ayrıntılı (raw_text, normalizasyon, API süresi) |
| `{DocumentDirectory}/voice-query-debug.log` | Tüm ses özellikleri (orb, modal, recorder) |

Mobil kod: `frontend/src/utils/voiceRegistrationDebugLog.ts`, `frontend/src/utils/voiceQueryDebugLog.ts`

## Sesli üyelik log olayları

| event | Ne zaman |
|-------|----------|
| `session_start` | Wizard açıldı |
| `step_started` | Adım başladı |
| `api_request` | Django isteği gönderildi |
| `api_response` | Başarılı çıkarım |
| `extraction_failed` | API `is_valid: false` (e-posta vb.) |
| `local_validation_failed` | Mobil ikinci doğrulama reddi |
| `recovery_success` | API reddetti ama raw_text'ten mobil normalize ile kurtarıldı |
| `api_http_error` | HTTP 4xx/5xx |
| `network_error` | Bağlantı hatası |

E-posta hatasında log satırında tipik alanlar:

- `raw_text` — Whisper transkripti (tam metin)
- `value` — API'nin döndürdüğü değer (maskeli)
- `normalized_from_raw` — mobil normalizasyon denemesi (maskeli)
- `error` / `message` — hata kodu ve kullanıcı mesajı
- `durationMs` — API süresi
- `djangoApi` — hangi backend'e gidildiği

## Cihazdan alma

### Android (adb)

```powershell
adb shell run-as com.proparcel.mobile cat files/voice-registration-debug.log
```

Paket adı farklıysa `adb shell pm list packages | findstr proparcel` ile kontrol edin.

Alternatif (debug build, erişilebilir path):

```powershell
adb pull /data/user/0/<paket>/files/voice-registration-debug.log .
```

### Uygulama içi

Hata ekranında **Hata logunu paylaş** — son ~100 satırı WhatsApp / e-posta ile gönderir.

## Filtreleme

Yalnızca e-posta hataları:

```powershell
Select-String -Path voice-registration-debug.log -Pattern '"field":"email"'
Select-String -Path voice-registration-debug.log -Pattern 'extraction_failed'
```

## E-posta sorun giderme

1. `extraction_failed` satırında `raw_text` okuyun — Whisper ne duydu?
2. `normalized_from_raw` ile `value` karşılaştırın — normalizasyon mu API mi başarısız?
3. `djangoApi` doğru pp33 URL mi?
4. `httpStatus: 404` → endpoint deploy edilmemiş olabilir
5. `transcription_failed` → ses çok kısa veya Whisper boş döndü

## Güvenlik

- Base64 ses loglanmaz
- Telefon / TCKN maskelenir
- E-posta logda kısmen maskelenir (`s***@gmail.com`); `raw_text` debug için tam kalır
