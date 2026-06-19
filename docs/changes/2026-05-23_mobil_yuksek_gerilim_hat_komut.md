# Mobil — Yüksek Gerilim (hat bilgisi + harita çizimi) düzeltme komutu

**Tarih:** 2026-05-23  
**Hedef:** Pro Sorgu detay ekranında (`son-30-gun-detay`) yüksek gerilim **bilgilerinin** görünmesi ve hattın **haritada çizilmesi** (web portal ile aynı davranış).  
**Ana dosya:** `frontend/screens/routes/son-30-gun-detay.tsx`  
**Referans (web, doğru davranış):** `frontend-web/src/components/detail/DetailElectricTab.jsx`, `frontend-web/src/lib/portal-electric-line.js`, `frontend-web/src/components/detail/maps/MapboxParcelMap.jsx`  
**Backend (ortak, mobil ayrı deploy etmez):** `accounts/views/portal_recent_queries_views.py` → `_get_portal_geometry_bundle`, `GET .../sections/electric/`

---

## 1. Belirtilen sorunlar

| Belirti | Muhtemel neden |
|--------|----------------|
| Yüksek Gerilim sekmesinde voltaj / alan / “hat var” bilgisi yok veya “Yok” yazıyor | Mobil yalnızca `GET /api/portal/recent-queries/<id>/` cevabındaki `electric_values` / `electric_line_feature` kullanıyor; eski snapshot’larda alan boş kalabiliyor. Web bu sekme için **`sections/electric/`** çağırıyor, mobil **çağırmıyor**. |
| `electric_isExist: true` ama haritada çizgi yok | Hero haritada elektrik katmanı **hiç yok**. Tam ekran harita yalnızca **kullanıcı override** çizgilerini gösteriyor, API’den gelen hattı değil. |
| “Haritada görmek için dokunun” çalışmıyor / boş harita | `electricMapVisible` ekranı `electricOverrideLines` ile besleniyor; tespit edilen hat `electric_line_feature` ile **birleştirilmiyor**. |
| Koordinat var sanılıyor ama çizgi yok | Web’deki **lat/lon normalizasyonu** ve JSON string parse yok; `[lat,lon]` / string feature mobilde `hasLineCoords` false veya Mapbox’a yanlış gidiyor. |

---

## 2. Web ile mobil fark özeti (yapılması gereken hizalama)

### 2.1 Veri kaynağı

**Web (`DetailElectricTab.jsx`):**
```text
GET /api/portal/recent-queries/<id>/sections/electric/
→ buildElectricMapOverlays(sectionData)
→ hero haritaya overlay verir
```

**Mobil (mevcut):**
```text
GET /api/portal/recent-queries/<id>/  (loadDetail)
→ data.electric_values, data.electric_line_feature (tek seferlik)
→ electric sekmesi bu alanları doğrudan okur; section API yok
```

**Komut:** `activeDetailTabId === 'electric'` olduğunda (ilk açılışta bir kez) web ile aynı endpoint’i çağır:

```typescript
// portalService.ts — fonksiyon zaten var:
getPortalDetailSection(snapshotId, 'electric')
```

- Cevabı state’e yaz: örn. `electricSectionData`.
- Sekme UI ve harita overlay bu state’ten beslensin; `loadDetail` cevabı yedek kalsın.
- `solar_energy` / `wind_energy` için yapılan lazy-fetch pattern’i kopyala (`useEffect` + `fetchedRef`).

### 2.2 Harita çizimi

**Web:** Hero `MapboxParcelMap` + `buildElectricMapOverlays` → `electric-line` (turuncu çizgi + glow).

**Mobil hero harita (~3573–3627):** Sadece parsel + emsal; **elektrik ShapeSource yok.**

**Komut:**
1. Paylaşılan mantığı mobilde uygula: `mobile/.../src/utils/portalElectricLine.ts` (web `portal-electric-line.js` portu veya ortak paket).
2. `buildElectricMapOverlays(data)` → GeoJSON `Feature` / `FeatureCollection`.
3. Hero `Mapbox.MapView` içine, `activeDetailTabId === 'electric'` iken (veya electric overlay state dolu iken):

```tsx
<Mapbox.ShapeSource id="electric-line-src" shape={electricLineGeoJSON}>
  <Mapbox.LineLayer id="electric-line-glow" style={{ lineColor: '#FF4500', lineWidth: 8, lineOpacity: 0.35 }} />
  <Mapbox.LineLayer id="electric-line" style={{ lineColor: '#FF4500', lineWidth: 4, lineOpacity: 0.95 }} />
</Mapbox.ShapeSource>
```

4. Sekme değişince overlay’i temizle (web’deki `onMapConfigChange(null, 'electric')` gibi).

### 2.3 Tam ekran “Yüksek Gerilim” haritası (yanlış kullanım)

**Mevcut:** `electricMapVisible` bloğu (~2906–3055) **sadece** `electricOverrideLines` (DFA → hat bildir → yeniden sorgu) için.

**Komut:** İki mod ayır:

| Mod | Açılış | Haritada göster |
|-----|--------|-----------------|
| **Görüntüle** | Electric sekme kartı “Haritada görmek için dokunun” | API/section’dan gelen hat (read-only) + parsel |
| **Override** | DFA `onOpenElectricModal` | Mevcut tap-to-draw + `electricOverrideLines` + KV seçimi + rerun |

Görüntüleme modunda `lineFeatures` şuna benzer olmalı:

```typescript
const detected = buildElectricMapOverlays(electricSectionData ?? data);
const override = electricOverrideLines.map(...);
// detected read-only turuncu; override turuncu/amber kesik çizgi (mevcut stil)
```

### 2.4 Koordinat normalizasyonu (zorunlu)

Web `portal-electric-line.js` içindeki kuralları mobilde de uygula:

- `electric_line_feature` / `clipped_electric_multilinestring` string ise `JSON.parse`.
- `electric_values.electric_line`, `start_coord` / `end_coord`, `electric_start` / `electric_end`.
- Türkiye için `[lat, lon]` → `[lon, lat]` (`toLonLat`).
- `hasLineCoords` hesabı normalize edilmiş feature üzerinden yapılsın (`hasElectricLineData` eşdeğeri).

Aksi halde API doğru olsa bile mobil `hasLineCoords === false` veya Mapbox’ta çizgi ekran dışı kalır.

### 2.5 Hero “Resimler / Harita” sekmesi (Mapbox boyut hatası)

Web’de düzeltilen sorun: harita 1px veya unmount iken Mapbox katmanları boyanmıyor.

**Mobil:** `(heroTopTab === 'images')` iken hero Mapbox **tamamen unmount** ediliyor (~3573).

**Komut (web CSS fix ile uyumlu):**
- Electric sekmesi açıkken `setHeroTopTab('map')` zorla.
- Veya haritayı unmount etme: `opacity: 0` + `pointerEvents: 'none'` ile gizle, boyutu koru; sekme `electric` iken `mapRef` / camera fit tetikle.

---

## 3. Electric sekme UI komutları

Dosya: `son-30-gun-detay.tsx` ~3924–4000.

1. **Veri birleştirme:**
   ```typescript
   const electricPayload = electricSectionData ?? {
     electric_values: data.electric_values,
     electric_line_feature: data.electric_line_feature,
     clipped_electric_multilinestring: data.clipped_electric_multilinestring,
   };
   ```

2. **`electricIsExist`:** Sadece `electric_values.electric_isExist` değil; web `_portal_electric_is_detected` ile uyumlu:
   - `electric_isExist === true` **veya**
   - `electric_area` > 0 **veya**
   - `buildElectricMapOverlays(...).length > 0`

3. **Bilgi kartı:** Voltaj (`KW` / `voltage` / feature.properties), alan (`electric_area` / `electric_area_str`), voltaj sınıfı metinleri web `DetailElectricTab` ile aynı eşikler.

4. **Yasal bilgi / DFA metni:** Web’deki `ELECTRIC_LEGAL_INFO` ve özet cümle isteniyorsa `DetailElectricTab` içeriğini mobil karta taşı (opsiyonel ama “bilgiler gitti” şikayetinde kontrol et).

5. **Yükleme / hata:** Section fetch için `ActivityIndicator` + retry; sessiz fail yapma.

---

## 4. Backend — mobil geliştirici kontrol listesi

Mobil genelde **ayrı backend deploy etmez**; production API güncel olmalı.

| Kontrol | Endpoint / kod |
|--------|----------------|
| Detayda alanlar var mı? | `GET /api/portal/recent-queries/<id>/` → `electric_values`, `electric_line_feature`, `clipped_electric_multilinestring` |
| Section zengin veri | `GET /api/portal/recent-queries/<id>/sections/electric/` |
| Eski snapshot recompute | `portal_recent_queries_views._get_portal_geometry_bundle` + `resolve_parcel_electric_line_feature` |
| Dağıtık sorgu kaydı | `myapp/views/parcel.py` → `electric_line`, `electric_line_feature` |

**Test snapshot (lokal dokümantasyon):** 789 tam geometri; 776/777 recompute ile line döner.

Mobil geliştirici, cihazda API base URL’in güncel sunucuya gittiğini doğrulasın (`config/api.ts`).

---

## 5. Uygulama adımları (sıralı)

1. **`portalElectricLine.ts`** oluştur — `buildElectricMapOverlays`, `hasElectricLineData`, `normalizeElectricInput` (web portu).
2. **`son-30-gun-detay.tsx`** — electric section lazy fetch (`getPortalDetailSection(sid, 'electric')`).
3. Electric sekmesi UI’ı `electricSectionData` + normalize ile güncelle.
4. Hero haritaya electric `ShapeSource` ekle; sekme `electric` iken göster + camera bounds (parsel + hat).
5. `electricMapVisible` — görüntüleme vs override modlarını ayır; görüntülemede API hattını çiz.
6. Hero Resimler/Harita — unmount yerine gizle veya electric’te Harita’ya zorla.
7. **Manuel test** (aşağı).
8. İsteğe bağlı: `__DEV__` log prefix `[PP ElectricMap Mobile]` (web debug ile aynı mesajlar).

---

## 6. Test planı

| # | Adım | Beklenen |
|---|------|----------|
| 1 | Snapshot **789** (veya hat bilinen canlı id) → Son 30 Gün detay | Yüksek Gerilim sekmesi: voltaj, alan, “parsel üzerinden geçiyor” |
| 2 | Aynı kayıt → Electric sekme → Hero **Harita** | Turuncu hat parsel üzerinde |
| 3 | “Haritada görmek için dokunun” | Tam ekran haritada **tespit hattı** (override çizmeden) |
| 4 | DFA → Hat bildir / override akışı | Tap ile çizim + rerun; mevcut davranış bozulmamalı |
| 5 | Snapshot **776/777** (eski, geometri DB’de yok) | Section API ile recompute sonrası bilgi + çizgi |
| 6 | İlanlı kayıt → Resimler sekmesi → Electric | Harita gizlense bile Electric’e geçince çizgi görünür |
| 7 | Metro / fiziksel cihaz | `@rnmapbox/maps` token yüklü; “Harita yüklenemedi” yok |

**API doğrulama (curl veya React Native log):**
```http
GET /api/portal/recent-queries/<id>/sections/electric/
Authorization: Bearer <token>
```
Cevapta `electric_line_feature.geometry.coordinates` en az 2 nokta.

---

## 7. Dokunulmayacak / dikkat

- `rerun-with-road-override` POST gövdesi (`electric_lines`) — mevcut `portalService.rerunPortalQueryWithRoadOverride` aynı kalsın.
- `normalizeElectricOverrideLinesMobile` — override için `[lon, lat]` kalsın; API hattı ile karıştırma.
- Web `portal-electric-debug.js` mobilde zorunlu değil; debug için yeterli.
- `query-map-image` 404 — index ekranı; bu görev kapsamı dışı.

---

## 8. Kabul kriterleri (Definition of Done)

- [ ] Electric sekmesinde hat tespit edilmiş sorgularda voltaj / kamulaştırma alanı anlamlı (boş `—` yalnızca gerçekten veri yoksa).
- [ ] Hero haritada (Harita sekmesi + Yüksek Gerilim detay sekmesi) turuncu hat segmenti görünür.
- [ ] Tam ekran görüntüleme modunda API hattı override çizimi olmadan görünür.
- [ ] `sections/electric` çağrısı yapılıyor; ana detay cevabı eksik olsa bile section ile düzeliyor.
- [ ] Override (hat bildir) akışı regression’sız çalışıyor.

---

## 9. Kısa komut metni (agent / geliştiriciye yapıştır)

```text
Mobil Pro Sorgu detay (son-30-gun-detay.tsx): Yüksek Gerilim sekmesini web DetailElectricTab ile hizala.
1) getPortalDetailSection(snapshotId, 'electric') lazy load ekle.
2) frontend-web/src/lib/portal-electric-line.js mantığını portalElectricLine.ts olarak port et.
3) Hero Mapbox’a buildElectricMapOverlays çıktısını ShapeSource LineLayer ile çiz; activeDetailTabId==='electric' iken göster ve bounds fit et.
4) electricMapVisible ekranını ikiye ayır: API hattı görüntüleme (read-only) vs mevcut override çizimi (DFA).
5) hasLineCoords ve electricIsExist hesaplarını normalize + overlay varlığına göre yap.
6) Hero haritayı Resimler sekmesinde unmount etmeyerek (veya electric’te map tab’a zorlayarak) Mapbox boyut/katman sorununu önle.
Backend değişikliği gerekmiyorsa dokunma; API zaten sections/electric ve detail’de alanları döndürüyor.
Test: snapshot 789 hero+sekme çizgi; 776 section ile bilgi gelir; override akışı bozulmaz.
```

---

## 10. İlgili dosyalar

| Dosya | Rol |
|-------|-----|
| `frontend/screens/routes/son-30-gun-detay.tsx` | Ana UI + haritalar |
| `frontend/services/portalService.ts` | `getPortalDetailSection`, `getPortalRecentQueryDetail` |
| `frontend/src/types/portal.ts` | `electric_values`, `electric_line_feature` tipleri |
| `frontend-web/src/lib/portal-electric-line.js` | Port kaynağı |
| `frontend-web/src/components/detail/DetailElectricTab.jsx` | Davranış referansı |
| `accounts/views/portal_recent_queries_views.py` | API + geometry bundle |
