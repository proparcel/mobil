# Endeksa Mongo konum eşleme aktarımı

Sahibinden Mongo → MongoDB `Endeksa` (il / ilçe / mahalle pv ↔ Endeksa ID).

> pp33'te SQL Server erişimi kesildiği için kaynak **Sahibinden Mongo** koleksiyonlarıdır
> (`city`, `town`, `quarter`, `endeksa`). SQL şema ile alanlar aynıdır.

## Hedef

| Mongo DB | Koleksiyon | Seviye | Endeksa API |
|----------|------------|--------|-------------|
| `Endeksa` | `city` | İl | `CityId` |
| `Endeksa` | `town` | İlçe | `CountyId` |
| `Endeksa` | `quarter` | Mahalle | `DistrictId` |

Kaynak: `Sahibinden.city` / `town` / `quarter` / `endeksa`.

Env: `MONGO_ENDEKSA_DB=Endeksa` (varsayılan). Bridge: `get_endeksa_db()`.

## Alan eşlemesi

### city

| Alan | Kaynak | Not |
|------|--------|-----|
| `Id` | `city.Id` | PP il PK |
| `Proparcel_value` | `city.Proparcel_value` | |
| `Proparcel_name` / `Proparcel_text` | `city` | |
| `Endeksa_value` | `city.CityPlaka` | API `CityId` (= plaka; örn. Bursa 16) |
| `Endeksa_name` | `city.Proparcel_name` | |

`Sahibinden.endeksa.CityId` **PP `City.Id`** tutar (Bursa=23). API `CityId` ise **plaka**dır.

### town

| Alan | Kaynak |
|------|--------|
| `Id`, `CityId` | `town` (PP) |
| `Proparcel_*` | `town` |
| `Endeksa_value` | `town.Endeksa_value` (= API `CountyId`) |
| `Endeksa_name` | `town.Proparcel_name` |

### quarter

Kanonik kaynak: `Sahibinden.endeksa` (+ `quarter` join for `Proparcel_text`).

| Alan | Kaynak |
|------|--------|
| `Id` | `quarter.Id` veya `endeksa.Id` |
| `CityId` / `TownId` | PP id'ler |
| `Proparcel_value` | `endeksa.Proparcel_value` |
| `Proparcel_text` | `quarter.Proparcel_text` |
| `Endeksa_value` | `endeksa.Endeksa_value` (= API `DistrictId`) |
| `Endeksa_text` | `endeksa.Endeksa_text` |
| `QuarterId`, `Population` | `endeksa` |

## Komut

pp33 üzerinde:

```bash
python manage.py migrate_endeksa_location_mappings --dry-run
python manage.py migrate_endeksa_location_mappings --apply --replace-all
python manage.py migrate_endeksa_location_mappings --verify --strict
```

Opsiyonel filtre: `--city-id`, `--town-id` (PP Id).

## İndeksler

| Koleksiyon | İndeks |
|------------|--------|
| `city` | unique `Endeksa_value`, `Proparcel_value` |
| `town` | unique `Endeksa_value`, `CityId`, `Proparcel_value` |
| `quarter` | unique `Endeksa_value`, `Proparcel_value`, `(TownId, CityId)` |

## Doğrulama örneği

Bursa / Nilüfer / 19 Mayıs:

```js
use Endeksa
db.city.findOne({ Endeksa_value: 16 })
db.town.findOne({ Endeksa_value: 1829 })
db.quarter.findOne({ Endeksa_value: 140338 })
```

## Kod

- `myapp/scripts/endeksa/location_migration.py`
- `myapp/management/commands/migrate_endeksa_location_mappings.py`
- `myapp/scripts/database/mongo_bridge.py` → `get_endeksa_db()`

## Notlar

- Mevcut `Sahibinden` Mongo koleksiyonlarına yazılmaz; yalnız okunur.
- `--apply` yalnızca `--replace-all` ile çalışır (drop + reload).
- NULL `Endeksa_value` satırlar aktarılmaz; dry-run orphan sayılarını gösterir.
