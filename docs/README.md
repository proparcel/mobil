# ProParcel mobil dokümantasyon

Kanonik mobil doküman kökü: **`mobil.git`** → `docs/`

## Giriş

| Doküman | Açıklama |
|---------|----------|
| [architecture.md](architecture.md) | Mobil mimari, doküman kuralları, modül indeksi |
| [development-rules.md](development-rules.md) | Geliştirme kuralları |
| [guides/](guides/) | Kurulum, klavye, operasyon rehberleri |
| [build/](build/) | APK/AAB/iOS build |
| [components/](components/) | UI bileşenleri ([nasil_yapilir_videolari.md](components/nasil_yapilir_videolari.md), [ai_video_editor.md](components/ai_video_editor.md) dahil) |
| [modules/](modules/) | VR, Akıllı Ses, terrain, portal vb. modüller |
| [api/](api/) | API / konum endpoint notları |
| [changes/](changes/) | Tarihli değişiklik ve fix kayıtları |
| [utils/](utils/) | Yardımcı modül notları |
| [operations/](operations/) | Lokal temizlik, doküman taşıma, backend ops özeti |

## Sunucu / backend

Backend ve web dokümantasyonu **pp33** sunucusundaki `proparcel_v1` reposundadır; mobil repo içinde tutulmaz.

| Konu | Mobil özet | Kanonik (pp33) |
|------|------------|----------------|
| Mongo katalog migration/backfill | [operations/mongo-catalog-migration-rules.md](operations/mongo-catalog-migration-rules.md) | `docs/operations/mongo-catalog-migration-rules.md` |

## Legacy arşiv

Monorepo birleştirmesi öncesi dağınık markdown dosyaları: [`_archive_legacy/`](_archive_legacy/) (referans; yeni yazım `docs/` altında).

## Çalıştırma

```bash
cd frontend
npm install
npm run start
```

API hedefi: pp33 backend (`EXPO_PUBLIC_API_URL`).
