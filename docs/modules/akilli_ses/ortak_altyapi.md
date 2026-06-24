# Akıllı Ses — ortak altyapı

Tüm ses özellikleri tarafından paylaşılan bileşenler.

## Ses kaydı

**Dosya:** `frontend/src/hooks/useSmartQueryAudioRecorder.ts`

- `expo-av` — `RecordingOptionsPresets.HIGH_QUALITY`, metering
- Mikrofon izni — `ensureMicrophonePermission` (`devicePermissions.ts`)
- Durdurma → `react-native-fs` base64
- MIME: iOS `audio/m4a`, Android uzantıya göre
- Dönüş: `{ base64, mimeType, uri }`

## Dinleme animasyonu

**Dosya:** `frontend/components/app/VoiceSearchListeningAnimation.tsx`

Modlar: `idle` | `listening` | `processing`

Sesli üyelik wizard'ında `size` prop ile kompakt görünüm kullanılır.

## Debug günlüğü

**Dosya:** `frontend/src/utils/voiceQueryDebugLog.ts` (genel), `frontend/src/utils/voiceRegistrationDebugLog.ts` (sesli üyelik ayrıntılı)

- Genel yol: `{DocumentDirectory}/voice-query-debug.log` (JSON Lines, max ~512 KB)
- Sesli üyelik: `{DocumentDirectory}/voice-registration-debug.log` (raw_text, normalizasyon, API süresi)
- Detay: [voice_debug_log.md](./voice_debug_log.md)

## API çağrı kalıbı

| Özellik | Servis | Auth |
|---------|--------|------|
| Parsel ses | `smartQueryService` | JWT zorunlu + `smart_query` gate |
| Sesli üyelik | `voiceRegistrationService` | AllowAny (kayıt öncesi) + rate limit |

Ortak: JSON POST, `mimeType` + base64 audio, hata mesajı kullanıcı dostu.

## Konum çözümleme (paylaşılan)

Sesli üyelik `location` adımı:

- `smartQueryResolve.resolveSmartQueryPayload` veya aynı ID tabanlı `locationLookup`
- `locations.json` — `city_id`, `town_id`, `quarter_id` tercih

Parsel modülü kodu import edilir; sesli üyelik servisine gömülmez.
