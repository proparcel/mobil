# Endeksa — DynamicTrend API

Endeksa fiyat endeksi ve trend verisini çekmek için kullanılan web endpoint'i.

## Kayıtlı örnek URL

```
https://app.endeksa.com/dynamictrend?BuildYear=5&CityId=16&CountryId=1&CountyId=1829&Details=true&DistrictId=140338&FloorNumber=5&HeatType=3&Level=3&PropertyCategory=1&PropertyType=4&Rooms=5&Static=false&Trend=true&Types=true&Wkt=
```

### Örnek sorgu bağlamı

| Alan | Değer | Açıklama |
|------|-------|----------|
| Ülke | `CountryId=1` | Türkiye |
| İl | `CityId=16` | Bursa |
| İlçe | `CountyId=1829` | Nilüfer |
| Mahalle | `DistrictId=140338` | 19 Mayıs |
| Coğrafi seviye | `Level=3` | Mahalle düzeyi (`DistrictId` ile) |
| Emlak kategorisi | `PropertyCategory=1` | Konut |
| Emlak tipi | `PropertyType=4` | Örnek sorguda müstakil segmenti döner |
| Oda | `Rooms=5` | 5+1 filtre |
| Bina yaşı | `BuildYear=5` | Yaş segmenti filtresi |
| Kat | `FloorNumber=5` | Kat segmenti filtresi |
| Isıtma | `HeatType=3` | Isıtma tipi filtresi |
| WKT | boş | Parsel/geometri filtresi yok |

### Yanıt bayrakları

| Parametre | Değer | Etki |
|-----------|-------|------|
| `Trend` | `true` | Aylık zaman serisi (`Trend[]`) |
| `Types` | `true` | Segment kırılımları (`FloorSergment`, `Heating`, `Age`, `HouseType` vb.) |
| `Details` | `true` | Detay segmentleri dahil |
| `Static` | `false` | Dinamik analiz modu |

## HTTP

| Alan | Değer |
|------|-------|
| Method | `GET` |
| Base | `https://app.endeksa.com/dynamictrend` |
| Auth | Tarayıcı oturumu / Endeksa hesabı (public JSON; pratikte web cookie gerekebilir) |
| Content-Type | `application/json` |

## Query parametreleri

| Parametre | Zorunlu | Örnek | Açıklama |
|-----------|---------|-------|----------|
| `CountryId` | Evet | `1` | Ülke |
| `CityId` | Evet | `16` | İl |
| `CountyId` | Hayır | `1829` | İlçe |
| `DistrictId` | Hayır | `140338` | Mahalle |
| `Level` | Evet | `3` | Analiz coğrafi seviyesi |
| `PropertyCategory` | Evet | `1` | Emlak kategorisi (konut vb.) |
| `PropertyType` | Evet | `4` | Alt emlak tipi |
| `Rooms` | Hayır | `5` | Oda sayısı segmenti |
| `BuildYear` | Hayır | `5` | Bina yaşı segmenti |
| `FloorNumber` | Hayır | `5` | Kat segmenti |
| `HeatType` | Hayır | `3` | Isıtma tipi |
| `Wkt` | Hayır | — | GeoJSON/WKT geometri filtresi |
| `Trend` | Hayır | `true` | Trend dizisini döndür |
| `Types` | Hayır | `true` | Tip/segment kırılımlarını döndür |
| `Details` | Hayır | `true` | Detay segmentlerini döndür |
| `Static` | Hayır | `false` | Statik analiz modu |

> Enum değerleri (PropertyType, HeatType, BuildYear vb.) Endeksa UI filtreleriyle eşleşir; kod tarafında sabitlenmediyse önce bu örnek URL ile doğrulayın.

## Yanıt gövdesi (üst seviye)

Örnek kayıt: [`samples/dynamictrend-bursa-nilufer-19mayis.json`](samples/dynamictrend-bursa-nilufer-19mayis.json)

| Alan | Tip | Açıklama |
|------|-----|----------|
| `Trend` | `object[]` | Aylık satış/kira birim fiyat trendi |
| `FloorSergment` | `object[]` | Kat segmenti özeti (Endeksa yazımı: Sergment) |
| `Heating` | `object[]` | Isıtma tipi kırılımı |
| `Age` | `object[]` | Bina yaşı kırılımı |
| `HouseType` | `object[]` | Oda tipi kırılımı (ör. `4+1`, `5+1`) |
| `AreaSegment` | `object[]` | Alan segmenti (örnek sorguda boş) |
| `HeatMapSales` | `object[]` | Satış heatmap noktaları |
| `HeatMapRent` | `object[]` | Kira heatmap noktaları |
| `GeoInfo` | `object` | `Country`, `City`, `County`, `District`, `Quarter` |
| `TrendDate` | `string` | Analiz üretim zamanı (ISO 8601) |
| `TrendPeriod` | `string` | Dönem kodu (ör. `202606`) |
| `Channel` | `string` | Kaynak kanal (ör. `web`) |
| `General` | `array` | Genel meta (örnek yanıtta dizi) |

## Trend kaydı — önemli alanlar

Her `Trend[]` öğesi aşağıdaki alanları içerir (tam liste örnek JSON'da):

| Alan | Açıklama |
|------|----------|
| `PropertyDate` | Ay başı tarih (`2021-01-01T00:00:00`) |
| `DisplayName` | Görünen ay adı (`Ocak 2021`) |
| `UnitPriceForSale` | m² satış birim fiyatı (TL) |
| `MinUnitPriceForSale` / `MaxUnitPriceForSale` | Satış fiyat aralığı |
| `ComparableAreaForSale` | Karşılaştırılabilir satış alanı (m²) |
| `CountForSale` | Satış ilan sayısı |
| `UnitPriceForRent` | m² kira birim fiyatı (TL) |
| `MinUnitPriceForRent` / `MaxUnitPriceForRent` | Kira fiyat aralığı |
| `ComparableAreaForRent` | Karşılaştırılabilir kira alanı |
| `CountForRent` | Kira ilan sayısı |
| `PriceChangeSale` / `PriceChangeRent` | Aylık fiyat değişimi (oran) |
| `IndexSale` / `IndexRent` | Endeks değerleri |
| `Amortization` | Amortisman (yıl) |
| `Yield` | Getiri oranı |
| `ListingPeriodForSale` / `ListingPeriodForRent` | Ortalama ilan süresi (gün) |
| `CityId`, `CountyId`, `DistrictId` | Coğrafi kimlikler |
| `CityName`, `CountyName`, `DistrictName` | Coğrafi adlar |
| `AnalysisType` | Kayıt tipi (`1` = aylık trend) |
| `Level` | Coğrafi seviye |

### AnalysisType (örnek yanıttan)

| Değer | Dizi | Anlam |
|-------|------|-------|
| `1` | `Trend`, `HeatMap*` | Aylık zaman serisi |
| `4` | `FloorSergment` | Kat / yapı segmenti |
| `5` | `Heating` | Isıtma tipi |
| `6` | `Age` | Bina yaşı bandı |

Segment dizilerinde `ListingType` alanı segment adını taşır (ör. `Doğalgaz Kombi`, `0-4`, `Müstakil`).

## ProParcel veri katmanı ilişkisi

SQL tarafında `Endeksa_*` dinamik tabloları fiyat endekslerini tutar (`modul_3_veri_katmani_rehberi`). Bu endpoint ham Endeksa trend verisinin kaynağıdır; ingest/ETL ayrı bir iş akışıdır.

## Mongo konum eşleme

pp33 MongoDB veritabanı: **`Endeksa`** (`MONGO_ENDEKSA_DB`).

| API parametresi | Mongo koleksiyon | Alan | Not |
|-----------------|------------------|------|-----|
| `CityId` | `city` | `Endeksa_value` | İl plaka (`CityPlaka`); Bursa=16 |
| `CountyId` | `town` | `Endeksa_value` | örn. Nilüfer=1829 |
| `DistrictId` | `quarter` | `Endeksa_value` | örn. 19 Mayıs=140338 |

ProParcel tarafı: `Proparcel_value`, `Proparcel_text` / `Proparcel_name`. Mahalle Endeksa adı: `quarter.Endeksa_text`.

Kaynak: Sahibinden Mongo (`city`/`town`/`quarter`/`endeksa`). Aktarım: `python manage.py migrate_endeksa_location_mappings` — ayrıntı: `docs/modules/endeksa/location_mapping_migration.md`.

Örnek (19 Mayıs):

```js
db.city.findOne({ Endeksa_value: 16 })
db.town.findOne({ Endeksa_value: 1829 })
db.quarter.findOne({ Endeksa_value: 140338 })
```

## Doğrulama

1. Örnek URL'yi tarayıcıda veya `curl` ile çağırın.
2. `GeoInfo.District` hedef mahalle ile eşleşmeli (`19 Mayıs`).
3. `Trend` dizisi kronolojik ayları içermeli; örnek yanıtta **78** ay.
4. `TrendDate` güncel analiz tarihini göstermeli.

## Notlar

- `Wkt` boş bırakıldığında sorgu yalnızca id parametreleriyle filtrelenir.
- Türkçe karakterler yanıtta UTF-8 olarak gelir; dosyaya yazarken encoding korunmalıdır.
- Endpoint adı: `dynamictrend` (küçük harf, tek kelime).
