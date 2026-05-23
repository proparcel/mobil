// Mapbox: EAS secret RNMAPBOX_MAPS_DOWNLOAD_TOKEN (sk.ey...) prebuild'de plugin'e geçirilir
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "production";
}
const MAPBOX_DOWNLOAD_TOKEN = process.env.RNMAPBOX_MAPS_DOWNLOAD_TOKEN || "";
const iosStandalone = process.env.IOS_STANDALONE === "1";

// Android yerel gelistirme: RN CLI (index.js). Expo Dev Client menusu acilmasin.
// iOS EAS development profili icin expo-dev-client pakette kalir; iOS'ta yalniz IOS_STANDALONE ile cikar.
const DEV_CLIENT_PACKAGES = [
  "expo-dev-client",
  "expo-dev-launcher",
  "expo-dev-menu",
  "expo-dev-menu-interface",
];

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
    autolinking: {
      android: {
        exclude: DEV_CLIENT_PACKAGES,
      },
      ...(iosStandalone
        ? {
            exclude: [...DEV_CLIENT_PACKAGES, "react-native-static-server"],
          }
        : {}),
    },
    jsEngine: "hermes",
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
      icon: "./assets/images/icon.png",
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#1a1f3a",
      },
    },
    extra: {
      eas: {
        projectId: "a489f2e9-e08e-46e9-9ce3-c1346de09384",
      },
      apiUrl: process.env.EXPO_PUBLIC_API_URL || "https://www.proparcel.com",
      authApiUrl: process.env.EXPO_PUBLIC_AUTH_API_URL || "https://www.proparcel.com",
      modelsUrl: process.env.EXPO_PUBLIC_MODELS_URL || "https://www.proparcel.com",
      mapboxAccessToken: process.env.EXPO_PUBLIC_MAPBOX_TOKEN || "",
      ngrokUrl: process.env.EXPO_PUBLIC_NGROK_URL || "",
      // React Navigation kullanıyoruz, Expo Router değil. Lazy bundling "require doesn't exist" hatasına yol açıyor.
      router: { asyncRoutes: false },
    },
    plugins: [
      "./plugins/withIosNoPushEntitlement.js",
      [
        "expo-build-properties",
        {
          ios: {
            useFrameworks: "static",
            deploymentTarget: "15.1",
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
