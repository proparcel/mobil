/**
 * Aranacaklar yerel bildirim planlayıcısı.
 *
 * `expo-notifications` native modül gerektirir; mevcut APK’da yüklü değilse
 * Metro "Unknown module 2084" benzeri hatalar verir. Bu yüzden istemci tarafında
 * planlama yapılmaz — vadesi gelen aramalar sunucuda Celery ile işlenir ve
 * uygulama içi Bildirimler ekranına düşer (`aranacaklar.process_due_followups`).
 */
import type { AranacaklarListRow } from './aranacaklarService';

export async function ensureAranacaklarNotificationPermission(): Promise<boolean> {
  return false;
}

export async function cancelAranacaklarContactNotification(_contactId: string): Promise<void> {
  /* no-op */
}

export async function cancelAllAranacaklarLocalNotifications(): Promise<void> {
  /* no-op */
}

export async function scheduleAranacaklarContactNotification(_row: AranacaklarListRow): Promise<void> {
  /* no-op — sunucu hatırlatması kullanılır */
}

export async function syncAranacaklarListNotifications(_rows: AranacaklarListRow[]): Promise<void> {
  /* no-op */
}
