# AI Video editör (mobil)

## Amaç

Yatay (16:9) AI Video üretim editörü. Parsel sorgusu veya harita zorunlu değildir; kullanıcı referans görselleri yükleyerek proje oluşturur. Backend `editor_mode: ai_video` ile runway pipeline üzerinden video üretir.

**Eski AI Video Studio kaldırıldı:** `/api/v1/self/ai-video-studio/*` ve `ai-video-studio` route artık mobilde yok. Tek giriş noktası bu editördür.

## Giriş noktaları

| Kaynak | Hedef |
|--------|--------|
| Ana menü → AI İşlemleri → **AI Video** | `ai-video-new-editor` |
| Landing kartı (`ai-video`) | `ai-video-new-editor` |
| Bildirim `listing_ai_video_ready` | `ai-video-new-editor?jobId=...` |

Route adı stack içinde `ai-video-new-editor` olarak kalır (geriye dönük derleme uyumu).

## Dosya haritası

| Dosya | Rol |
|-------|-----|
| `frontend/screens/routes/ai-video-new-editor.tsx` | Ana editör ekranı (16:9 önizleme, sahne strip, ayarlar) |
| `frontend/services/aiVideoNewEditorService.ts` | Runway prep/production, script, IAP referans, export |
| `frontend/services/hydrateAiVideoJobContext.ts` | Mevcut job bağlamını yükleme |
| `frontend/components/ai-video-new/AiVideoImageUploadModal.tsx` | Yeni proje / yeni sahne görsel yükleme |
| `frontend/components/ai-video-new/AiVideoNewPurchaseModal.tsx` | `action_type: ai_video` lisans IAP |
| `frontend/components/ai-video-new/CompletedAiVideoPicker.tsx` | Hazır `ai_video` projeleri seçici |
| `frontend/components/ai-video-new/LandscapeVideoFrame.tsx` | 16:9 önizleme çerçevesi |
| `frontend/components/ai-video-new/KeywordPillInput.tsx` | Referans kelime girişi |
| `frontend/src/constants/aiDroneProductionPipeline.ts` | `AI_VIDEO_NEW_PRODUCTION_STEPS`, `MOBILE_AI_VIDEO_NEW_CLIENT_SOURCE` |

Sahne strip, müzik, seslendirme ve birleştirme bileşenleri **Pratik Video (AI Drone)** editörü ile paylaşılır. Strip davranışı: `frontend/docs/drone-scene-strip-flow.md`.

## Üretim pipeline adımları

`AI_VIDEO_NEW_PRODUCTION_STEPS` (`aiDroneProductionPipeline.ts`):

1. **upload** — Referans görselleri (kullanıcı modal)
2. **script** — `POST /api/drone-editor/ai-video-script/`
3. **prep** — `POST /api/drone-recording-runway/prep/` (`editor_mode: ai_video`)
4. **ref_upload** — Görsellerin sunucuya yüklenmesi
5. **payment** — `AiVideoNewPurchaseModal` (`com.proparcel.license.ai_video` / IAP)
6. **production** — `POST /api/drone-recording-runway/`
7. **polling** — Runway job durumu
8. **ready** — Önizleme hazır

## Kimlik ve filtreleme

- `editor_mode`: `ai_video`
- `reference_id` öneki: `ai_video_` / `ai_video:`
- Videolarım / picker: `droneVideoMatchesEditorMode(item, "ai_video")` (`droneVideoEditorMode.ts`)

## Menü (AI İşlemleri alt menüsü)

Güncel sıra (`UserMenuSheetList.tsx`):

1. AI Video → `ai-video-new-editor`
2. AI Resim → `ai-image-animation-purchase`
3. AI Drone Video → `ai-drone-hub`
4. Videolarım → `ai-drone-my-videos`
5. AI İşlerim → `ai-drone-jobs`

## İlgili dokümanlar

- [drone-scene-strip-flow.md](../../frontend/docs/drone-scene-strip-flow.md) — sahne kartları, birleştirme, silme
- [STORE_LICENSE_IAP.md](../../frontend/docs/STORE_LICENSE_IAP.md) — mağaza lisans IAP (varsa)
