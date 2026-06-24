# Sesli Sorgu — Akıllı Ses referansı

Parsel **Akıllı Sorgu** ses kanalı; Akıllı Ses modülünün ilk alt özelliği.

## Kanonik doküman

Tam teknik detay: [`docs/components/smart_query.md`](../../components/smart_query.md)

## Özet

- Kullanıcı sesle il/ilçe/mahalle/ada/parsel söyler
- `POST /api/speech_query_extract/` → Whisper + Chat
- Sonuç Ada-Parsel form seed'ine dönüşür

## Giriş noktaları

| UI | Dosya |
|----|-------|
| Ana harita orb | `HomeVoiceQueryOrb.tsx` |
| Ada-Parsel modal `smart` sekmesi | `ParcelSearchModal.tsx` |

## Erişim

- Giriş zorunlu
- `features.smart_query` veya uygun `customer_type`
- Detay: [`customer_type_feature_gates_mobile.md`](../../components/customer_type_feature_gates_mobile.md)

## Akıllı Ses ile ilişki

Ses kaydı, animasyon ve debug log **ortak altyapıdan** gelir ([ortak_altyapi.md](./ortak_altyapi.md)). API ve resolve katmanları **ayrıdır**; sesli üyelik endpoint'ine karıştırılmaz.
