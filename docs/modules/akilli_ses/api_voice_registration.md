# API — voice_registration_field_extract

`POST /api/voice_registration_field_extract/`

Tek istekte **tek alan** çözümlenir. Kayıt öncesi kullanım: **AllowAny** + rate limit (JWT opsiyonel).

## İstek

```json
{
  "field": "email",
  "audio": "<base64>",
  "mimeType": "audio/m4a",
  "context": {
    "source": "voice_registration",
    "member_type": "corporate",
    "corporate_type": "spk",
    "company_profile_id": null
  }
}
```

### field değerleri

`full_name`, `phone`, `email`, `location`, `address_detail`, `company_name`, `company_license_no`, `spk_tc_no`, `office_no`, `consultant_license_no`, `consultant_company`, `corporate_type`

### context

| Alan | Zorunlu | Açıklama |
|------|---------|----------|
| `source` | evet | `"voice_registration"` |
| `member_type` | evet | `individual` \| `consultant` \| `corporate` |
| `corporate_type` | kurumsal | `emlak` \| `spk` \| `lihkab` |
| `company_profile_id` | hayır | Danışman bağlamı |

## Başarı yanıtı

```json
{
  "ok": true,
  "field": "email",
  "raw_text": "sercan yanaz et gmail nokta com",
  "value": "sercanyanaz@gmail.com",
  "is_valid": true,
  "message": null
}
```

### location value örneği

```json
{
  "ok": true,
  "field": "location",
  "raw_text": "Bursa Osmangazi Yunuseli Mahallesi",
  "value": {
    "city_id": 16,
    "town_id": 123,
    "quarter_id": 456,
    "il": "Bursa",
    "ilce": "Osmangazi",
    "mahalle": "Yunuseli",
    "tkgm_value": 78901,
    "proparcel_value": 78901
  },
  "is_valid": true,
  "message": null
}
```

### consultant_company value örneği

```json
{
  "ok": true,
  "field": "consultant_company",
  "value": {
    "company_profile_id": 42,
    "company_name": "Örnek Emlak A.Ş.",
    "corporate_type": "emlak"
  },
  "is_valid": true
}
```

## Hata yanıtı

```json
{
  "ok": false,
  "field": "email",
  "raw_text": "sercan gmail",
  "value": null,
  "is_valid": false,
  "error": "invalid_email",
  "message": "E-posta adresi doğru algılanamadı. Lütfen tekrar söyleyin."
}
```

## Hata kodları

`invalid_audio`, `invalid_field`, `invalid_email`, `invalid_phone`, `invalid_location`, `invalid_address`, `invalid_name`, `invalid_license`, `invalid_company`, `company_not_found`, `feature_locked`, `openai_error`, `transcription_failed`, `rate_limited`

## Backend işlem sırası

1. Base64 decode + mimeType doğrula
2. OpenAI Whisper → `raw_text` (alan bazlı prompt)
3. OpenAI Chat → alan değeri JSON (`phone`/`email`/`spk_tc_no` için **rakam string**)
4. Backend field validator
5. Mobil frontend kritik alanlarda ikinci doğrulama

### Telefon Chat örneği

Whisper: `"Sıfır beş yüz otuz sekiz, beş yüz seksen bir, otuz dört doksan dokuz."`  
Chat çıktısı: `{"value": "5385813499"}`

## pp33 uygulama

- Servis: `myapp/services/voice_registration_ai/field_extract.py`
- View: `myapp/views/voice_registration.py`
- URL: `api/voice_registration_field_extract/`
- Test: `test_modulleri/voice_registration/tests/run_tests.py`

Mobil FastAPI proxy (yerel dev): `backend/server.py` → Django forward

Referans şablon (mobil repo): `backend/django_templates/voice_registration_field_extract.py`

## Güvenlik

- Şifre alanı bu endpoint'te yok
- Debug log'da base64 saklanmaz
- Rate limit: anonim IP başına dakika limiti
