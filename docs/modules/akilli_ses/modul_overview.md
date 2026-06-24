# Akıllı Ses modülü — genel bakış

ProParcel mobil uygulamasında **ses tabanlı kullanıcı etkileşimleri** için paylaşılan altyapı ve bağımsız ürün özellikleri.

## Amaç

- Tek bir ses katmanı (`expo-av`, metering, base64, debug log, animasyon)
- Her özellik kendi servis / wizard / resolve katmanında kalır; parsel Akıllı Sorgu ile karıştırılmaz

## Alt özellikler

| Özellik | Durum | Doküman |
|---------|-------|---------|
| **Sesli Sorgu** (parsel) | Üretimde | [sesli_sorgu_referans.md](./sesli_sorgu_referans.md) → [smart_query.md](../../components/smart_query.md) |
| **Sesli Üyelik** | pp33 backend hazır, cihaz testi bekliyor | [sesli_uyelik.md](./sesli_uyelik.md) |

## Klasör haritası

| Katman | Konum |
|--------|--------|
| Ortak kayıt hook | `frontend/src/hooks/useSmartQueryAudioRecorder.ts` |
| Dinleme animasyonu | `frontend/components/app/VoiceSearchListeningAnimation.tsx` |
| Debug günlüğü | `frontend/src/utils/voiceQueryDebugLog.ts` |
| Parsel ses UI | `frontend/components/app/HomeVoiceQueryOrb.tsx`, `ParcelSearchModal.tsx` |
| Parsel API | `frontend/services/smartQueryService.ts` |
| Sesli üyelik UI | `frontend/components/auth/VoiceRegistrationWizard.tsx` |
| Sesli üyelik hook | `frontend/src/hooks/useVoiceRegistrationWizard.ts` |
| Sesli üyelik API | `frontend/services/voiceRegistrationService.ts` |
| Sesli üyelik adımlar | `frontend/src/utils/voiceRegistrationSteps.ts` |
| Dokümantasyon | `docs/modules/akilli_ses/` |

## Karıştırılmama kuralı

- Parsel Akıllı Sorgu: `smartQueryService`, `smartQueryResolve`, `HomeVoiceQueryOrb`
- Sesli üyelik: `voiceRegistrationService`, `voiceRegistrationResolve`, `VoiceRegistrationWizard`
- Ortak: yalnızca recorder, animasyon, debug log altyapısı

## Backend

- Sesli sorgu: `POST /api/speech_query_extract/` (pp33 Django)
- Sesli üyelik: `POST /api/voice_registration_field_extract/` (pp33 Django)
- Mobil sözleşme: [api_voice_registration.md](./api_voice_registration.md)
- pp33 uygulama: `myapp/services/voice_registration_ai/` + `myapp/views/voice_registration.py`
- Mobil referans şablon (dev proxy): `backend/django_templates/voice_registration_field_extract.py`

## İlgili dokümanlar

- [ortak_altyapi.md](./ortak_altyapi.md)
- [sesli_uyelik.md](./sesli_uyelik.md)
- [test_matrisi.md](./test_matrisi.md)
- [voice_debug_log.md](./voice_debug_log.md)
- [architecture.md](../../architecture.md)
