/**
 * Drone yerel bildirim planlayıcısı.
 *
 * `expo-notifications` native modül gerektirir; mevcut APK'da yüklü değilse
 * Metro "Unknown module" benzeri fatal hatalar verir. Bu yüzden istemci tarafında
 * expo-notifications kullanılmaz — tamamlanan işler için tracker içinde Alert
 * veya sunucu bildirimleri kullanılır.
 */
export async function notifyDroneVideoReady(_jobId: string, _label?: string): Promise<void> {
  /* no-op */
}

export async function notifyDroneExportSavedToGallery(_jobId: string): Promise<void> {
  /* no-op */
}

export async function notifyDroneExportFailed(_jobId: string, _reason?: string): Promise<void> {
  /* no-op */
}
