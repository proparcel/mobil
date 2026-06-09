import type { ParcelTerrain3d } from '../../../src/types/portal';

/** Grid / tip doğrulama — Unity açılmadan önce zorunlu. Hata mesajı veya null. */
export function validateTerrainPayload(payload: ParcelTerrain3d | null | undefined): string | null {
  if (!payload || typeof payload !== 'object') {
    return 'Geçersiz 3D eğim paketi.';
  }
  if (payload.type !== 'parcel_terrain_3d') {
    return 'Beklenmeyen paket tipi.';
  }
  const terrain = payload.terrain;
  if (!terrain || terrain.gridType !== 'regular') {
    return 'Geçersiz terrain grid.';
  }
  const { width, height, elevations, slopes, mask } = terrain;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 'Geçersiz grid boyutu.';
  }
  const n = width * height;
  if (elevations.length !== n || slopes.length !== n || mask.length !== n) {
    return 'Grid uzunlukları uyuşmuyor.';
  }
  if (!Array.isArray(payload.parcel?.localPolygon)) {
    return 'Parsel sınır verisi eksik.';
  }
  if (!Array.isArray(payload.render?.slopeColorStops) || payload.render.slopeColorStops.length === 0) {
    return 'Eğim renk skalası eksik.';
  }
  return null;
}
