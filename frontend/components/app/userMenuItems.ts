/**
 * Ana harita menüsü ile aynı öğe sırası — tüm ekranlarda `getMenuItems` kullanın.
 */

export type HomeMenuItem = {
  id: string;
  title: string;
  icon: string;
  disabled?: boolean;
  hasSubmenu?: boolean;
};

export function getMenuItems(
  _isProMode: boolean,
  isAuthenticated: boolean,
  isAdmin?: boolean,
  user?: Record<string, unknown> | null,
): HomeMenuItem[] {
  if (!isAuthenticated) {
    return [
      { id: "landing-intro", title: "ProParcel tanıtım", icon: "sparkles-outline", disabled: false },
      { id: "promahalle", title: "ProMahalle", icon: "chatbubbles-outline", disabled: false },
      { id: "hukuki-metinler", title: "Hukuki metinler", icon: "document-text-outline", disabled: false },
      { id: "giris", title: "Giriş", icon: "log-in", disabled: false },
    ];
  }
  const role = String(user?.role || "").toLowerCase();
  const memberType = String(user?.member_type || "").toLowerCase();
  const corporateType = String(user?.corporate_type || "").toLowerCase();
  const canSeeEmsalSalesReport =
    role === "admin" ||
    role === "consultant" ||
    role === "broker" ||
    memberType === "corporate" ||
    memberType === "consultant" ||
    memberType === "expert" ||
    corporateType === "spk";

  return [
    { id: "kullanici", title: "Profil", icon: "person", disabled: false },
    { id: "emlak-vitrini", title: "Emlak Vitrini", icon: "storefront-outline", disabled: false },
    { id: "son-30-gun-pro", title: "Son 30 Gün Pro Sorguları", icon: "calendar", disabled: false },
    { id: "promahalle", title: "ProMahalle", icon: "chatbubbles-outline", disabled: false },
    { id: "ai-video-olusturucu", title: "AI Video Oluşturucu", icon: "film-outline", disabled: false },
    { id: "sosyal-medya-sablonu", title: "Sosyal Medya Postu", icon: "share-social-outline", disabled: false },
    { id: "aranacaklar", title: "Aranacaklar", icon: "call-outline", disabled: false },
    { id: "bildirimler", title: "Bildirimler", icon: "notifications", disabled: false },
    ...(canSeeEmsalSalesReport
      ? [{ id: "emsal-satis-bildir", title: "Emsal Satış Bildir", icon: "stats-chart-outline" as const }]
      : []),
    {
      id: "ilan-islemleri",
      title: "İlan İşlemleri",
      icon: "briefcase-outline",
      disabled: false,
      hasSubmenu: true,
    },
    { id: "dosyalarim", title: "Dosyalarım", icon: "folder", disabled: false, hasSubmenu: true },
    { id: "kredi-paketleri", title: "Kredi Paketleri", icon: "logo-bitcoin", disabled: false },
    { id: "hukuki-metinler", title: "Hukuki Metinler", icon: "document-text-outline", disabled: false },
    ...(isAdmin ? [{ id: "admin-panel", title: "Admin Panel", icon: "shield-checkmark" }] : []),
    { id: "cikis", title: "Çıkış", icon: "log-out", disabled: false },
  ];
}
