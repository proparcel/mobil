import { Alert } from "react-native";

export function showNoParcelAlert(): void {
  Alert.alert(
    "Parsel gerekli",
    "Önce Basit Sorgu ile bir parsel seçmelisiniz.",
  );
}

export function showNoPolygonAlert(): void {
  Alert.alert(
    "Parsel sınırı yok",
    "Parsel sınır verisi bulunamadı. Lütfen farklı bir parsel sorgulayın.",
  );
}

export function showCameraRequiredAlert(): void {
  Alert.alert(
    "Kamera izni",
    "VR özelliğini kullanmak için kamera izni vermeniz gerekiyor.",
  );
}

export function showLocationRequiredAlert(): void {
  Alert.alert(
    "Konum izni",
    "Referans noktası kaydı için konum izni gerekli.",
  );
}
