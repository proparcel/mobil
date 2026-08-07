/**
 * Ana harita menüsü ile aynı öğe sırası — tüm ekranlarda `getMenuItems` kullanın.
 */

import { isAppAdminUser } from "../../src/utils/adminAccess";
import { canSeeEmsalSalesReportMenu } from "../../src/utils/membership";
import type { User, UserProfile } from "../../src/types/auth";

export type HomeMenuItem = {
  id: string;
  title: string;
  icon: string;
  disabled?: boolean;
  /** Pasif öğeye tıklanınca gösterilecek kısa metin */
  disabledPressTitle?: string;
  hasSubmenu?: boolean;
  /** Admin panel satırı vurgusu */
  highlight?: boolean;
};

export function getMenuItems(
  _isProMode: boolean,
  isAuthenticated: boolean,
  isAdmin?: boolean,
  user?: Record<string, unknown> | User | null,
  profile?: UserProfile | null,
): HomeMenuItem[] {
  if (!isAuthenticated) {
    return [
      { id: "landing-intro", title: "ProParcel tanıtım", icon: "sparkles-outline", disabled: false },
      { id: "emlak-vitrini", title: "Emlak Vitrini", icon: "storefront-outline", disabled: false },
      { id: "promahalle", title: "ProMahalle", icon: "chatbubbles-outline", disabled: false },
      { id: "hukuki-metinler", title: "Hukuki metinler", icon: "document-text-outline", disabled: false },
      { id: "destek", title: "Destek", icon: "help-circle-outline", disabled: false },
      { id: "nasil-yapilir", title: "ProjeOlustur", icon: "play-circle-outline", disabled: false },
      { id: "giris", title: "Giriş", icon: "log-in", disabled: false },
    ];
  }
  const canSeeEmsalSalesReport = canSeeEmsalSalesReportMenu(
    user as User | null | undefined,
    profile,
  );

  const adminUser = isAdmin === true || isAppAdminUser(user);

  return [
    { id: "kullanici", title: "Profil", icon: "person", disabled: false },
    ...(adminUser
      ? [{ id: "admin-panel", title: "Admin Panel", icon: "shield-checkmark", highlight: true }]
      : []),
    { id: "emlak-vitrini", title: "Emlak Vitrini", icon: "storefront-outline", disabled: false },
    {
      id: "ilan-islemleri",
      title: "İlan İşlemleri",
      icon: "briefcase-outline",
      disabled: false,
      hasSubmenu: true,
    },
    { id: "son-30-gun-pro", title: "Son 30 Gün Pro Sorguları", icon: "calendar", disabled: false },
    { id: "sorgularim", title: "Sorgularım", icon: "time-outline", disabled: false },
    { id: "promahalle", title: "ProMahalle", icon: "chatbubbles-outline", disabled: false },
    {
      id: "ai-video",
      title: "AI İşlemleri",
      icon: "film-outline",
      disabled: false,
      hasSubmenu: true,
    },
    { id: "sosyal-medya-sablonu", title: "Sosyal Medya Postu", icon: "share-social-outline", disabled: false },
    ...(canSeeEmsalSalesReport
      ? [{ id: "emsal-satis-bildir", title: "Emsal Bildir", icon: "stats-chart-outline" as const }]
      : []),
    { id: "aranacaklar", title: "Aranacaklar", icon: "call-outline", disabled: false },
    { id: "kredi-paketleri", title: "Kredi Paketleri", icon: "layers-outline", disabled: false },
    { id: "dosyalarim", title: "Dosyalarım", icon: "folder", disabled: false, hasSubmenu: true },
    { id: "bildirimler", title: "Bildirimler", icon: "notifications", disabled: false },
    { id: "hukuki-metinler", title: "Hukuki Metinler", icon: "document-text-outline", disabled: false },
    { id: "destek", title: "Destek", icon: "help-circle-outline", disabled: false },
    { id: "nasil-yapilir", title: "ProjeOlustur", icon: "play-circle-outline", disabled: false },
    { id: "cikis", title: "Çıkış", icon: "log-out", disabled: false },
  ];
}
