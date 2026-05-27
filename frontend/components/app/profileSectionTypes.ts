/**
 * Web `OwnProfilePage` sekmeleri ile hizalı profil bölümleri.
 */
export type ProfileSectionId =
  | "genel"
  | "puan_yorumlar"
  | "rozetler"
  | "ilanlar"
  | "prosorgular"
  | "kullanimlarim"
  | "hesap"
  | "uzmanlik"
  | "firma"
  | "ayarlar"
  | "danisman";

/** Profilden açılan alt ekranlarda geri dönüş hedefi */
export type ProfileReturnRouteParams = {
  returnScreen?: "profile";
  profileSection?: ProfileSectionId;
};

export const PROFILE_SECTION_LABELS: Record<ProfileSectionId, string> = {
  genel: "Genel Bakış",
  puan_yorumlar: "Puan ve yorumlar",
  rozetler: "Rozetler",
  ilanlar: "İlanlar",
  prosorgular: "ProSorgular",
  kullanimlarim: "Kullanımlarım",
  hesap: "Hesap",
  uzmanlik: "Uzmanlık",
  firma: "Firma",
  ayarlar: "Ayarlar",
  danisman: "Danışman Başvurusu",
};
