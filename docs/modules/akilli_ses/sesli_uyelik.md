# Sesli Üyelik

Kayıt ekranında **Sesli Komut ile Üye Ol** ile açılan sihirbaz; üyelik formu alanlarını sesle doldurur. Şifre, KVKK, mezuniyet, uzmanlık ve OTP manuel kalır.

## Ön koşullar

| Üyelik | Wizard öncesi |
|--------|---------------|
| Bireysel | `member_type = individual` seçili |
| Kurumsal | `corporate_type` (emlak/spk/lihkab) tab ile seçili |
| Danışman | Firma seçili veya sesli `consultant_company` adımı |

## Akış (sürekli kayıt)

Wizard açıldığında kayıt başlar. Her **Tamam** ile o sorunun sesi durdurulup saklanır, hemen sonraki soru için yeni kayıt başlar (API beklemesi yok). Son sesli adımda Tamam → tüm segmentler **paralel** API'ye gider → wizard kapanır → sonuçlar forma yansır.

```mermaid
sequenceDiagram
  participant U as Kullanici
  participant W as VoiceRegistrationWizard
  participant R as useSmartQueryAudioRecorder
  participant API as Django
  participant F as register_form

  U->>W: Sesli Komut ile Uye Ol
  W->>R: startRecording
  loop Her sesli adim
    U->>U: Cevap soyler
    U->>W: Tamam
    W->>R: stopRecording segment sakla
    W->>R: startRecording sonraki soru
    Note over W,API: API beklemesi yok
  end
  par Paralel istekler
    W->>API: field + segment base64
    W->>API: field + segment base64
  end
  API-->>W: sonuclar
  W->>F: basarili patch onBatchCompleted
  W->>F: hatali alanlar errors kirmizi border
  W->>U: Forma don
```

## Wizard durumları

`idle` → `listening` (sürekli) → adımlar arası anında geçiş → son adımda `processing` → wizard kapanır.

Wizard içinde adım adım “Algılanan sonuç” onayı yok; doğrulama kayıt formunda görünür.

## Form hata işaretleme

Toplu işlem sonrası:
- Başarılı alanlar forma yazılır; ilgili `errors.*` temizlenir.
- Hatalı alanlar forma yazılmaz; `register.tsx` `errors` state ile **kırmızı border** (`inputError` / `pickerTouchError`).
- En az bir hata varsa Alert: *Bazı alanlar algılanamadı. Kırmızı işaretli alanları kontrol edin.*

Alan → error key eşlemesi: `voiceRegistrationFieldToFormErrorKey.ts`

## Dinamik adımlar

`voiceRegistrationSteps.buildVoiceRegistrationSteps(ctx)` — `member_type` + `corporate_type` (danışmanda firmanın tipi).

### Ortak ses adımları

| Sıra | field | Ekran |
|------|-------|-------|
| 1 | `full_name` | Adınızı ve soyadınızı söyleyin. |
| 2 | `phone` | Telefon numaranızı söyleyin. (bireysel opsiyonel) |
| 3 | `email` | E-posta adresinizi söyleyin… |

Danışman: `consultant_company` **email öncesi** (firma seçili değilse).

Kurumsal/danışman:

| field | Ekran |
|-------|-------|
| `location` | İl, ilçe ve mahalle bilginizi söyleyin. |
| `address_detail` | Sokak, cadde, kapı no, kat ve daire… |

Kurumsal ek:

| field | Not |
|-------|-----|
| `company_name` | Opsiyonel; helper: *Yetki belgeniz varsa ve firma değilseniz bu adımı geçin.* Geç → API’ye gitmez |
| `company_license_no` | Zorunlu |
| `spk_tc_no` | Yalnız SPK kurumsal |
| `office_no` | Yalnız LİHKAB kurumsal |

Danışman SPK parent: `consultant_license_no`

`manual_password` adımı wizard UI’da gösterilmez; sesli adımlar bitince wizard kapanır, şifre formdan elle girilir.

## Form patch

| API field | register state |
|-----------|----------------|
| `full_name` | `firstName`, `lastName` |
| `phone` | `phoneNumber` |
| `email` | `email` |
| `location` | `corporateAddress` (city/district/quarter) |
| `address_detail` | `corporateAddress.streetAndNumber` |
| `company_name` | `companyName` |
| `company_license_no` | `companyLicenseNo` |
| `spk_tc_no` | `spkTcNo` |
| `office_no` | `officeNo` |
| `consultant_license_no` | `consultantLicenseNo` |
| `consultant_company` | `selectedCompany` |

## Firma türü stratejisi

Kurumsal tab seçimi wizard öncesi zorunlu. SPK seçilince mezuniyet otomatik Lisans; LİHKAB mezuniyeti temizler. Danışman firma tipini seçilen firmadan devralır.

Detay: plan dokümanı *Firma türü stratejisi* bölümü; test: [test_matrisi.md](./test_matrisi.md).

## Manuel kalan adımlar

- Mezuniyet (SPK kurumsal/danışman zorunlu)
- Profil fotoğrafı / kurumsal logo
- Uzmanlık bölgeleri (LİHKAB hariç)
- Şifre, şifre tekrar, KVKK
- SMS OTP (telefon girildiyse)

## Dosyalar

- `frontend/components/auth/VoiceRegistrationWizard.tsx`
- `frontend/src/hooks/useVoiceRegistrationWizard.ts`
- `frontend/src/hooks/useSmartQueryAudioRecorder.ts`
- `frontend/services/voiceRegistrationService.ts`
- `frontend/src/utils/voiceRegistrationFieldToFormErrorKey.ts`
- `frontend/src/utils/voiceRegistrationSteps.ts`
- `frontend/src/utils/voiceRegistrationResolve.ts`
- `frontend/src/utils/voiceRegistrationValidators.ts`
- `frontend/src/types/voiceRegistration.ts`

## API

[api_voice_registration.md](./api_voice_registration.md)

## Test notları

- Bireysel / kurumsal / danışman — tüm sesli adımlar tek kayıtta tamamlanmalı
- Bilerek hatalı alan → formda kırmızı border + hata mesajı
- Başarılı alanlar dolu, hatalı alan boş veya önceki değerde
- Elle düzenleme border’ı temizler
- Opsiyonel telefon/firma **Geç** → segment marker ve API yok
- `voice-registration-debug.log` — `segment_captured`, `batch_flush_*` olayları
