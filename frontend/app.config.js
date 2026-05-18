// Mapbox: EAS secret RNMAPBOX_MAPS_DOWNLOAD_TOKEN (sk.ey...) prebuild'de plugin'e geçirilir
const MAPBOX_DOWNLOAD_TOKEN = process.env.RNMAPBOX_MAPS_DOWNLOAD_TOKEN || "";

// PLATFORM: Bu config öncelikle iOS (EAS Build) için kullanılır.
// Android: react-native run-android ile build edilir, bu config Android native yapılandırmasını override etmez.
module.exports = {
  name: "ProParcel",
  displayName: "ProParcel",
  version: "1.0.0",
  expo: {
    name: "ProParcel",
    slug: "frontend",
    scheme: "proparcel",
    newArchEnabled: true,
    jsEngine: "jsc",
    ios: {
      bundleIdentifier: "com.proparcel.app",
      supportsTablet: true,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        // HTTP API bağlantısı için (production + local dev)
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: true,
        },
        NSLocationWhenInUseUsageDescription: "Harita görüntüleme ve parsel sorgulama için konum kullanılır.",
        NSCameraUsageDescription: "Fotoğraf çekme için kamera kullanılır.",
        NSPhotoLibraryUsageDescription: "Resim seçme için fotoğraf kütüphanesi kullanılır.",
        NSPhotoLibraryAddUsageDescription:
          "Çekilen 3D harita görüntülerini fotoğraf galerinize kaydetmek için izin gerekir.",
        NSMicrophoneUsageDescription: "Ses kaydı için mikrofon kullanılır.",
        NSContactsUsageDescription:
          "Rehberden kişi seçerek Aranacaklar listesine eklemek için kişilere erişim gerekir.",
      },
    },
    android: {
      package: "com.proparcel.app",
      permissions: ["android.permission.READ_CONTACTS"],
    },
    extra: {
      eas: {
        projectId: "a489f2e9-e08e-46e9-9ce3-c1346de09384",
      },
      apiUrl: process.env.EXPO_PUBLIC_API_URL || "",
      authApiUrl: process.env.EXPO_PUBLIC_AUTH_API_URL || "",
      modelsUrl: process.env.EXPO_PUBLIC_MODELS_URL || "",
      ngrokUrl: process.env.EXPO_PUBLIC_NGROK_URL || "",
      // React Navigation kullanıyoruz, Expo Router değil. Lazy bundling "require doesn't exist" hatasına yol açıyor.
      router: { asyncRoutes: false },
    },
    plugins: [
      [
        "expo-build-properties",
        {
          ios: {
            buildReactNativeFromSource: true,
          },
        },
      ],
      [
        "expo-media-library",
        {
          photosPermission: "ProParcel, galeriden görüntü seçmek için fotoğraflarınıza erişir.",
          savePhotosPermission: "Çekilen görüntüleri fotoğraf galerinize kaydetmek için izin gerekir.",
          isAccessMediaLocationEnabled: false,
        },
      ],
      [
        "@rnmapbox/maps",
        {
          RNMapboxMapsImpl: "mapbox",
          RNMapboxMapsDownloadToken: MAPBOX_DOWNLOAD_TOKEN,
        },
      ],
    ],
  },
};
