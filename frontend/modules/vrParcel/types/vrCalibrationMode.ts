export type VrCalibrationMode =
  | "lidar_precise"
  | "arkit_standard"
  | "arcore_standard"
  | "map_only_fallback"
  | "unsupported";

export type VrModeUiCopy = {
  title: string;
  subtitle: string;
};

export function getVrModeUiCopy(mode: VrCalibrationMode): VrModeUiCopy {
  switch (mode) {
    case "lidar_precise":
      return {
        title: "LiDAR Hassas Kalibrasyon",
        subtitle: "Bu cihaz LiDAR destekliyor. Referans noktaları daha hassas algılanabilir.",
      };
    case "arkit_standard":
      return {
        title: "Standart iPhone AR Kalibrasyon",
        subtitle:
          "Bu cihazda LiDAR bulunmuyor. Kalibrasyon kamera takibi ve harita referansları ile yapılacak.",
      };
    case "arcore_standard":
      return {
        title: "Android AR Kalibrasyon",
        subtitle:
          "Bu cihaz ARCore destekliyor. Referans noktalarını kamera üzerinde işaretleyerek parseli hizalayabilirsiniz.",
      };
    case "map_only_fallback":
      return {
        title: "Harita Görünümü",
        subtitle: "Bu cihazda kamera üzerinden VR parsel çizimi desteklenmiyor.",
      };
    default:
      return {
        title: "VR Desteklenmiyor",
        subtitle: "Bu cihaz kamera üzerinden VR parsel çizimini desteklemiyor.",
      };
  }
}
