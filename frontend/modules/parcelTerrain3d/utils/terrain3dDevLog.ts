/** __DEV__ konsol: [PP Terrain3D] snapshotId=… — tam log: npm run terrain:logs */
export function logTerrain3dDev(
  message: string,
  fields: Record<string, string | number | boolean | null | undefined>,
): void {
  if (!__DEV__) return;
  const parts = Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(' ');
  console.log(`[PP Terrain3D] ${message}${parts ? ` ${parts}` : ''}`);
}

export const TERRAIN3D_BACKFILL_ALERT =
  'Bu sorgu kaydı 3D eğim görüntüsünü desteklemiyor. 3D görünüm yalnızca güncel Pro sorgu sonuçlarında kullanılabilir.';

export const TERRAIN3D_FETCH_FAIL_ALERT =
  'Bu parsel için 3D eğim verisi bulunamadı.';

export const TERRAIN3D_INVALID_PAYLOAD_ALERT =
  '3D eğim verisi geçersiz veya eksik.';

export const TERRAIN3D_UNITY_UNAVAILABLE_ALERT =
  '3D eğim görüntüleyici için Unity export güncellenmeli. Unity: Build Settings yalnizca ParcelTerrain3dScene (index 0) → Export → npm run android.';
