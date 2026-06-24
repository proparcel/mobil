# ProParcel mobil dokümantasyon

Kanonik mobil doküman kökü: **`mobil.git`** → `docs/`

## Giriş

| Doküman | Açıklama |
|---------|----------|
| [architecture.md](architecture.md) | Mobil mimari, doküman kuralları, modül indeksi |
| [development-rules.md](development-rules.md) | Geliştirme kuralları |
| [guides/](guides/) | Kurulum, klavye, operasyon rehberleri |
| [build/](build/) | APK/AAB/iOS build |
| [components/](components/) | UI bileşenleri |
| [modules/](modules/) | VR, Akıllı Ses, terrain, portal vb. modüller |
| [api/](api/) | API / konum endpoint notları |
| [changes/](changes/) | Tarihli değişiklik ve fix kayıtları |
| [utils/](utils/) | Yardımcı modül notları |
| [operations/](operations/) | Lokal temizlik ve doküman taşıma planları |

## Legacy arşiv

Monorepo birleştirmesi öncesi dağınık markdown dosyaları: [`_archive_legacy/`](_archive_legacy/) (referans; yeni yazım `docs/` altında).

## Sunucu / backend

Backend ve web dokümantasyonu **pp33** sunucusundaki `proparcel_v1` reposundadır; mobil repo içinde tutulmaz.

## Çalıştırma

```bash
cd frontend
npm install
npm run start
```

API hedefi: pp33 backend (`EXPO_PUBLIC_API_URL`).
