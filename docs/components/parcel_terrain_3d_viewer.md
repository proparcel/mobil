# Mobil — Parsel 3D Eğim Viewer (Unity)

**Tarih:** 2026-06-08  
**Backend referans:** [`docs/backend/terrain_3d_snapshot.md`](../../backend/terrain_3d_snapshot.md)  
**Kimlik:** [`docs/changes/2026-06-05-pro-query-snapshot-id-only-identity.md`](../../changes/2026-06-05-pro-query-snapshot-id-only-identity.md)  
**Hedef ekran:** [`son-30-gun-detay.tsx`](../../../frontend/screens/routes/son-30-gun-detay.tsx)

## Özet

Mobil uygulama DEM indirmez. Kullanıcı **3D Eğim Görüntüle** dediğinde backend'den hazır `parcel_terrain_3d` JSON paketi alınır ve Unity viewer'a verilir.

## Kimlik

| Kullan | Kullanma |
|--------|----------|
| `QueryDfaSnapshot.id` | `queryId`, `analysisId`, ada/parsel ile snapshot arama |
| `detail.snapshot_id` / `detail.id` (aynı sayı) | `terrain3dSnapshotId` (duplicate — yok say) |
| `GET /api/portal/recent-queries/<snapshot_id>/terrain-3d/` | Route param dışında ada/parsel lookup |

## Backfill yok

Eski snapshot'larda 3D veri olmayabilir. Backend geçmiş kayıtları toplu üretmez.

1. Detay yüklenince `terrain3dAvailable` kontrol edilir.
2. **false** → 3D buton devre dışı veya Alert; Unity açılmaz.
3. **true** → tıklanınca `/terrain-3d/` çağrılır, sonra Unity.

Backfill uyarı metni:

> Bu sorgu kaydı 3D eğim görüntüsünü desteklemiyor. 3D görünüm yalnızca güncel Pro sorgu sonuçlarında kullanılabilir.

## API (2 adım)

### Adım 1 — Detay (mesh yok)

`GET /api/portal/recent-queries/<snapshot_id>/`

- `terrain3dAvailable: boolean`
- `slopeSummary` — 2D eğim özeti

### Adım 2 — 3D (lazy)

`GET /api/portal/recent-queries/<snapshot_id>/terrain-3d/`

- **200:** `{ success: true, terrain3d: { type: "parcel_terrain_3d", ... } }`
- **404:** `{ success: false, message: "Bu parsel için 3D eğim verisi bulunamadı." }`

**404 anlamı:** Backend bu snapshot için terrain verisi bulamadı — Unity altyapısı yok anlamına gelmez.

## UI

| Durum | Davranış |
|-------|----------|
| `terrain3dAvailable !== true` | Alert (backfill metni); fetch yok |
| `true` + «3D Eğim Görüntüle» | `getPortalTerrain3d(snapshot_id)` → validate → Unity |
| 404 / hata / validate fail | Alert; navigate yok |
| Unity export yok | Ayrı build Alert |

Eğim sekmesi: `PortalSlopeTerrainCard` (2D) + ayrı 3D buton.

## Modül

| Katman | Konum |
|--------|--------|
| RN modül | `frontend/modules/parcelTerrain3d/` |
| Unity sahne | `unity/vrParcel/Assets/Scripts/Terrain3d/` |
| Expo plugin | `plugins/withParcelTerrain3dNativeModules.js` |

## Payload store

- Yeni payload → eskisini sil
- Ekran unmount → `clearPayload()`
- App background → temizle
- Route param'a büyük JSON konmaz

## Unity sahne geçişi

Boot scene: `VrParcelScene`. Terrain: runtime `LoadScene("ParcelTerrain3dScene")`.

```
CloseVrSession()
LoadScene("ParcelTerrain3dScene")
OpenTerrainViewer(json)
```

## Mesh kuralları

- Row-major: `index = row * width + col`
- Mask: `mask === 0` hücrelerinden üçgen üretilmez (vertex alpha yok)
- Y: `(elevation - minElevation(mask==1)) * heightScale`
- Grid guard: `width * height === elevations.length === slopes.length === mask.length`
- Renk: `render.slopeColorStops[].color` (`#RRGGBB`)

## __DEV__ log

`[PP Terrain3D] snapshotId=… available=… fetch ok|fail`

## Test

| # | Senaryo | Beklenen |
|---|---------|----------|
| 1 | Yeni Pro sorgu | `terrain3dAvailable: true` |
| 2 | 3D tık + 200 | Unity açılır |
| 3 | Eski snapshot | `false` → uyarı |
| 4 | `true` + 404 | uyarı, Unity yok |
| 5 | Detay load | `/terrain-3d/` çağrılmaz |
