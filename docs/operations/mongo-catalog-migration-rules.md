# Mongo katalog migration kuralları (mobil özet)

**Kanonik rehber pp33'te:** `proparcel_v1` → `docs/operations/mongo-catalog-migration-rules.md`

Bu dosya mobil geliştiriciler ve lokal agent oturumları için kısa özet; backend dokümantasyonu mobil repo'da tutulmaz.

---

## Kök problem

`accounts_creditpackage` (Tepe Kredi satış paketleri) ve `purchasing_kredits` (işlem maliyetleri) UserDb Mongo'da **canlı prod konfigürasyonudur**. Django `migrate` veya backfill komutları aynı yazım yolunu (`mongo_catalog_repo`) kullanınca admin'de güncellenmiş fiyat/maliyet değerleri migration'daki eski hardcoded seed'lere dönebilir — özellikle ilgisiz bir feature migration'ı bile `upsert_purchasing_credit` çağırarak katalog zincirini tetikler.

## Ortam kuralları

| Ortam | Migrate | Katalog komutları |
|-------|---------|-------------------|
| pp33 | Evet | Evet (kurallara uygun) |
| pp32 | Hayır | Hayır |
| Lokal PC | Hayır | Hayır |

## Prod yasakları (özet)

- `setup_credit_packages` — 6 kurumsal slug tam overwrite
- Migration seed'de `patch.update(seed)` — mevcut kayıt ezilir
- `migrate accounts zero` veya migration kaydı silip yeniden migrate
- `migrate` ile `repair_purchasing_kredits_catalog` aynı otomasyon zinciri

## Deploy (pp33 — backend ekibi)

1. `python manage.py showmigrations accounts --plan` — bekleyen RunPython seed'lerini incele
2. Admin'de referans paket fiyatı + maliyet not al
3. `python manage.py migrate`
4. Smoke test: admin değerleri, `GET /api/packages/`, `GET /api/credit/costs/`

## pp33 dokümanları

```powershell
rclone cat pp33:/ProParcel/docs/operations/mongo-catalog-migration-rules.md
rclone cat pp33:/ProParcel/docs/backend/credit_package_catalog.md
rclone cat pp33:/ProParcel/docs/changes/2026-06-03-purchasing-kredits-single-source.md
```

## pp32

Worker ortamında migrate/katalog komutu çalıştırılmaz: `pp32:/ProParcel/docs/operations/mongo-catalog-data-safety.md`
