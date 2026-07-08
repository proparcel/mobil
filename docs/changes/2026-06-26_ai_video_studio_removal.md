# AI Video Studio kaldırma (2026-06-26)

Mobil uygulama tek AI Video editörüne geçti: **AI Video** menü öğesi artık `ai-video-new-editor` ekranını açar.

## Kaldırılanlar

- Route: `ai-video-studio`
- Ekran: `frontend/screens/routes/ai-video-studio.tsx`
- Servis: `frontend/services/aiVideoStudioService.ts` (`/api/v1/self/ai-video-studio/*`)
- Bileşen: `frontend/components/ai-video-studio/AiVideoStudioPurchaseModal.tsx`

## Taşınan / korunan

- `KeywordPillInput` → `frontend/components/ai-video-new/KeywordPillInput.tsx`
- IAP ürünü `com.proparcel.license.ai_video` ve `AiVideoNewPurchaseModal` aynı kaldı
- Stack route adı: `ai-video-new-editor` (değişmedi)

## Yönlendirme güncellemeleri

- Landing `navigateLandingCapability('ai-video')` → `ai-video-new-editor`
- Bildirim `listing_ai_video_ready` → `ai-video-new-editor` + `jobId`

## Menü

- Eski **AI Video** (studio) satırı silindi
- **AI Video Yeni** etiketi **AI Video** oldu

Detay: [ai_video_editor.md](../components/ai_video_editor.md)
