# Uzmanlık Puanı + Rozetler (Mobil)

Bu doküman, **yalnızca** `member_type=consultant` veya `member_type=corporate` kullanıcılar için mobilde gösterilen **Uzmanlık Puanı** ve **kalıcı rozet** özetini açıklar.

## Görünürlük kuralı

- `member_type === "consultant"` veya `member_type === "corporate"` ise göster.
- `member_type === "individual"` ise UI'da **gösterme**.

Üyelik modeli: [`docs/backend/membership_model.md`](../../../docs/backend/membership_model.md).

## Gösterim yerleri

### Profil sayfası

Dosya: `frontend/screens/routes/profile.tsx`

- Kullanıcı adı altında kısa özet:
  - `Uzmanlık: {expert_score_current} (Seviye) • En Yüksek: {expert_score_peak}`

### Hamburger menü header

Dosya: `frontend/screens/routes/index.tsx`

- Avatar + ad altında tek satır:
  - `Uzmanlık Puanı: {expert_score_current} (Seviye) • Peak: {expert_score_peak}`

## Veri kaynağı

- Profil (mongo-first): `GET /api/profile/read/` → `data.public.expert_score_current`, `expert_score_peak`, `expert_level`
- Rozet listesi (opsiyonel): `GET /api/profile/badges/overview/` → `page_summary.expert_score_*`

## Seviye etiketi

Backend `expert_level` alanı:
- `bronze` → Bronz
- `silver` → Gümüş
- `gold` → Altın
- `platinum` → Platin

Not: `expert_level` peak bazlı olduğu için geriye düşmez.
