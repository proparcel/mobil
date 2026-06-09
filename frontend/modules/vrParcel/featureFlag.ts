/**
 * VR Parsel modülü feature flag.
 * Kaldırma: flag false + entegrasyon noktalarını silmek yeterli.
 */
export const VR_PARCEL_ENABLED =
  process.env.EXPO_PUBLIC_VR_PARCEL_ENABLED === "1" ||
  process.env.EXPO_PUBLIC_VR_PARCEL_ENABLED === "true";
